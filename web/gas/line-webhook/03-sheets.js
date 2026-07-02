// ==================================================================
// スプレッドシート: マスタ / posts / user_map / invites / sessions / pending
// ==================================================================

// --- マスターシート ---

function getStoreCoordsFromMaster_(storeId) {
  var data    = getMasterSheetGridCached_();
  var sidWant = normalizeStoreKeyForWebhook_(storeId);
  var M       = LINE_MASTER_COL;
  for (var i = 1; i < data.length; i++) {
    var sid = data[i][M.STORE_ID];
    if (sid == null || normalizeStoreKeyForWebhook_(sid) !== sidWant) continue;
    var lat = data[i][M.LAT];
    var lng = data[i][M.LNG];
    if (lat == null || lng == null) continue;
    return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
}

function saveStoreCoordsToMaster_(storeId, lat, lng) {
  var ss      = getWebhookSpreadsheetCached_();
  var sheet   = ss.getSheets()[0];
  var data    = getMasterSheetGridCached_();
  var sidWant = normalizeStoreKeyForWebhook_(storeId);
  var M       = LINE_MASTER_COL;

  for (var i = 1; i < data.length; i++) {
    var sid = data[i][M.STORE_ID];
    if (sid != null && normalizeStoreKeyForWebhook_(sid) === sidWant) {
      sheet.getRange(i + 1, M.LAT + 1).setValue(lat);
      sheet.getRange(i + 1, M.LNG + 1).setValue(lng);
      invalidateMasterGridCache_();
      return;
    }
  }

  var numCols = Math.max(sheet.getLastColumn(), M.STORE_ID + 1);
  var newRow  = new Array(numCols).fill('');
  newRow[M.STORE_ID] = storeId;
  newRow[M.LAT]      = lat;
  newRow[M.LNG]      = lng;
  if (numCols > M.NAME) newRow[M.NAME] = storeId;
  sheet.appendRow(newRow);
  invalidateMasterGridCache_();
}

// --- posts ---

function buildPostSheetValues_(row) {
  return [
    row.postId, row.userId, row.role, row.sourceType,
    row.title || '', row.text || '', row.imageUrl || '',
    row.lat, row.lng, row.storeId, row.createdAt,
    row.isVisible === false ? false : true
  ];
}

function findFixedPostRowByStoreId_(data, storeId) {
  var sidWant = normalizeStoreKeyForWebhook_(storeId);
  if (!sidWant) return -1;
  var C = LINE_POSTS_COL;
  var matchRow = -1;
  for (var i = 1; i < data.length; i++) {
    var st = data[i][C.SOURCE_TYPE];
    if (st !== SOURCE_FIXED) continue;
    var sid = data[i][C.STORE_ID];
    if (sid == null || normalizeStoreKeyForWebhook_(sid) !== sidWant) continue;
    matchRow = i + 1;
  }
  return matchRow;
}

function upsertPostRow_(row) {
  var ss    = getWebhookSpreadsheetCached_();
  var sheet = ss.getSheetByName(LINE_SHEETS.POSTS);
  if (!sheet) {
    ensurePostsSheet_(ss);
    sheet = ss.getSheetByName(LINE_SHEETS.POSTS);
  }
  var values = buildPostSheetValues_(row);

  if (row.sourceType === SOURCE_FIXED && row.storeId) {
    var data     = sheet.getDataRange().getValues();
    var sheetRow = findFixedPostRowByStoreId_(data, row.storeId);
    if (sheetRow > 0) {
      var C = LINE_POSTS_COL;
      var existingPostId = data[sheetRow - 1][C.POST_ID];
      if (existingPostId) values[0] = existingPostId;
      sheet.getRange(sheetRow, 1, 1, values.length).setValues([values]);
      return { updated: true, postId: values[0] };
    }
  }

  sheet.appendRow(values);
  return { updated: false, postId: row.postId };
}

function appendPostRow_(row) {
  upsertPostRow_(row);
}

function ensurePostsSheet_(ss) {
  ensureSheetWithHeader_(LINE_SHEETS.POSTS, [
    'postId', 'userId', 'role', 'sourceType', 'title',
    'text', 'imageUrl', 'lat', 'lng', 'storeId', 'createdAt', 'isVisible'
  ], 'POSTS');
}

function getPostsForApi_() {
  var ss    = getWebhookSpreadsheetCached_();
  var sheet = ss.getSheetByName(LINE_SHEETS.POSTS);
  if (!sheet) return { posts: [], updatedAt: new Date().toISOString() };

  var data  = sheet.getDataRange().getValues();
  var posts = [];
  var C     = LINE_POSTS_COL;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[C.POST_ID]) continue;
    if (!parseSheetBoolActive_(row[C.IS_VISIBLE])) continue;
    var title    = row[C.TITLE]     != null ? String(row[C.TITLE]).trim()     : '';
    var text     = row[C.TEXT]      != null ? String(row[C.TEXT]).trim()      : '';
    var imageUrl = row[C.IMAGE_URL] != null ? String(row[C.IMAGE_URL]).trim() : '';
    if (!title && !text && !imageUrl) continue;
    posts.push({
      postId:     String(row[C.POST_ID]),
      userId:     row[C.USER_ID]     != null ? String(row[C.USER_ID])           : '',
      role:       row[C.ROLE]        != null ? String(row[C.ROLE])              : '',
      sourceType: row[C.SOURCE_TYPE] != null ? String(row[C.SOURCE_TYPE])       : '',
      title: title, text: text, imageUrl: imageUrl,
      lat: row[C.LAT], lng: row[C.LNG],
      storeId:    row[C.STORE_ID]    != null ? String(row[C.STORE_ID]).trim()   : '',
      createdAt:  row[C.CREATED_AT] instanceof Date
        ? row[C.CREATED_AT].toISOString()
        : String(row[C.CREATED_AT] || '')
    });
  }
  posts.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return { posts: posts, updatedAt: new Date().toISOString() };
}

// --- user_map ---

function parseUserRow_(row) {
  var C       = LINE_USER_MAP_COL;
  if (!row || !row[C.USER_ID]) return null;
  var roleStr = row[C.ROLE] != null ? String(row[C.ROLE]).trim() : '';

  if (KNOWN_ROLE_VALUES.indexOf(roleStr) >= 0) {
    return {
      userId:       normalizeWebhookUserIdForSheet_(row[C.USER_ID]),
      role:         roleStr,
      fixedStoreId: row[C.FIXED_STORE_ID] != null ? String(row[C.FIXED_STORE_ID]).trim() : '',
      isActive:     parseSheetBoolActive_(row[C.IS_ACTIVE]),
      displayName:  row[C.DISPLAY_NAME]   != null ? String(row[C.DISPLAY_NAME])           : '',
      registeredAt: row[C.REGISTERED_AT],
      linkedVia:    row[C.LINKED_VIA]     != null ? String(row[C.LINKED_VIA]).trim()       : ''
    };
  }
  // 旧形式（role 列が店舗名になっている行）の後方互換パース
  return {
    userId:       normalizeWebhookUserIdForSheet_(row[C.USER_ID]),
    role:         ROLE_STORE,
    fixedStoreId: roleStr,
    isActive:     true,
    displayName:  '',
    registeredAt: row[C.FIXED_STORE_ID],
    linkedVia:    ''
  };
}

function getUserRecord_(userId) {
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return null;
  for (var i = 1; i < __webhookUserMapRows_.length; i++) {
    if (sheetRowUserIdMatches_(__webhookUserMapRows_[i][0], userId)) {
      return parseUserRow_(__webhookUserMapRows_[i]);
    }
  }
  return null;
}

function saveUserRecord_(userId, role, fixedStoreId, linkedVia) {
  var sheet = getUserMapSheet_(true);
  var now   = new Date();
  var via   = linkedVia != null ? String(linkedVia).trim() : '';
  upsertSheetRowByUserId_(
    sheet, userId,
    [role, fixedStoreId || '', true, '', now, via],
    2, 6,
    invalidateUserMapCache_
  );
}

function deleteUserFromMap_(userId) {
  deleteSheetRowByUserId_(getUserMapSheet_(false), userId, invalidateUserMapCache_);
}

function lookupAllUserIdsByFixedStoreId_(storeId) {
  var want = normalizeStoreKeyForWebhook_(storeId);
  if (!want) return [];
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return [];
  var ids = [];
  for (var i = 1; i < __webhookUserMapRows_.length; i++) {
    var u = parseUserRow_(__webhookUserMapRows_[i]);
    if (u && u.role === ROLE_STORE && normalizeStoreKeyForWebhook_(u.fixedStoreId) === want) {
      ids.push(u.userId);
    }
  }
  return ids;
}

function deleteAllUsersByFixedStoreId_(storeId) {
  var ids = lookupAllUserIdsByFixedStoreId_(storeId);
  ids.forEach(function (uid) { deleteUserFromMap_(uid); });
  return ids.length;
}

function getAllUserMapRows_() {
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return [];
  var rows = [];
  for (var i = 1; i < __webhookUserMapRows_.length; i++) {
    var u = parseUserRow_(__webhookUserMapRows_[i]);
    if (!u) continue;
    rows.push({
      userId:       u.userId,
      role:         u.role,
      fixedStoreId: u.fixedStoreId,
      registeredAt: u.registeredAt
        ? Utilities.formatDate(new Date(u.registeredAt), 'Asia/Tokyo', 'MM/dd HH:mm')
        : '不明'
    });
  }
  return rows;
}

function getUserMapSheet_(createIfMissing) {
  if (!createIfMissing) return getWebhookSpreadsheetCached_().getSheetByName(LINE_SHEETS.USER_MAP);
  return ensureSheetWithHeader_(LINE_SHEETS.USER_MAP, [
    'userId', 'role', 'fixed_store_id', 'is_active', 'display_name', 'registered_at', 'linked_via'
  ], 'USER_MAP');
}

function ensureUserMapRows_() {
  if (__webhookUserMapRows_ !== undefined) return;
  var sheet = getUserMapSheet_(false);
  __webhookUserMapRows_ = sheet ? sheet.getDataRange().getValues() : null;
}

// --- store_invites ---

function getStoreInvitesSheet_(createIfMissing) {
  if (!createIfMissing) return getWebhookSpreadsheetCached_().getSheetByName(LINE_SHEETS.STORE_INVITES);
  return ensureSheetWithHeader_(LINE_SHEETS.STORE_INVITES, [
    'invite_code', 'store_id', 'is_active', 'max_uses', 'use_count',
    'expires_at', 'created_at', 'note'
  ], 'STORE_INVITES');
}

function ensureStoreInviteRows_() {
  if (__webhookStoreInviteRows_ !== undefined) return;
  var sheet = getStoreInvitesSheet_(false);
  __webhookStoreInviteRows_ = sheet ? sheet.getDataRange().getValues() : null;
}

function parseInviteRow_(row, rowIndex) {
  var C = LINE_STORE_INVITES_COL;
  if (!row || !row[C.INVITE_CODE]) return null;
  var maxUses  = row[C.MAX_USES]  != null && String(row[C.MAX_USES]).trim()  !== '' ? Number(row[C.MAX_USES])  : 0;
  var useCount = row[C.USE_COUNT] != null && String(row[C.USE_COUNT]).trim() !== '' ? Number(row[C.USE_COUNT]) : 0;
  var expiresAt = null;
  if (row[C.EXPIRES_AT]) {
    var d = new Date(row[C.EXPIRES_AT]);
    if (!isNaN(d.getTime())) expiresAt = d;
  }
  return {
    inviteCode: normalizeInviteCodeKey_(row[C.INVITE_CODE]),
    storeId:    row[C.STORE_ID] != null ? String(row[C.STORE_ID]).trim() : '',
    isActive:   parseSheetBoolActive_(row[C.IS_ACTIVE]),
    maxUses:    isFinite(maxUses)  ? maxUses  : 0,
    useCount:   isFinite(useCount) ? useCount : 0,
    expiresAt:  expiresAt,
    rowIndex:   rowIndex
  };
}

function lookupInvite_(code) {
  var want = normalizeInviteCodeKey_(code);
  if (!want) return null;
  ensureStoreInviteRows_();
  if (__webhookStoreInviteRows_ == null) return null;
  for (var i = 1; i < __webhookStoreInviteRows_.length; i++) {
    var inv = parseInviteRow_(__webhookStoreInviteRows_[i], i);
    if (inv && inv.inviteCode === want) return inv;
  }
  return null;
}

function validateInviteForLink_(invite) {
  if (!invite) return '招待コードが見つかりません。運営に確認してください。';
  if (!invite.isActive) return 'この招待コードは無効です。運営に新しいコードをお問い合わせください。';
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return 'この招待コードは期限切れです。運営に新しいコードをお問い合わせください。';
  }
  if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) {
    return 'この招待コードは利用上限に達しました。運営に新しいコードをお問い合わせください。';
  }
  if (!invite.storeId) return '招待コードの店舗設定が不正です。運営に確認してください。';
  if (!getStoreCoordsFromMaster_(invite.storeId)) {
    return '店舗の座標が未設定です。運営にマスタの lat/lng を登録してもらってください。';
  }
  return null;
}

function incrementInviteUseCount_(invite) {
  var sheet = getStoreInvitesSheet_(false);
  if (!sheet || !invite || invite.rowIndex == null) return;
  var C = LINE_STORE_INVITES_COL;
  sheet.getRange(invite.rowIndex + 1, C.USE_COUNT + 1).setValue((invite.useCount || 0) + 1);
  invalidateStoreInviteCache_();
}

function handleInviteLink_(userId, replyToken, code) {
  var existing = getUserRecord_(userId);
  if (isActiveUser_(existing)) {
    replyText(replyToken,
      'すでに紐づけ済みです（' + (existing.fixedStoreId || '') + '）。\n「登録確認」で確認できます。');
    return;
  }
  var invite = lookupInvite_(code);
  var err    = validateInviteForLink_(invite);
  if (err) {
    replyText(replyToken, '⚠️ ' + err);
    return;
  }
  saveUserRecord_(userId, ROLE_STORE, invite.storeId, invite.inviteCode);
  incrementInviteUseCount_(invite);
  deleteSession_(userId);
  deletePending_(userId);
  replyText(replyToken, buildMsgLineLinkedOk_(invite.storeId));
}

// --- bot_sessions ---

function getSession_(userId) {
  ensureBotSessionRows_();
  if (__webhookBotSessionRows_ == null) return { step: STEP_IDLE, payload: {} };
  for (var i = 1; i < __webhookBotSessionRows_.length; i++) {
    if (!sheetRowUserIdMatches_(__webhookBotSessionRows_[i][0], userId)) continue;
    var payload = {};
    try {
      payload = __webhookBotSessionRows_[i][2]
        ? JSON.parse(String(__webhookBotSessionRows_[i][2]))
        : {};
    } catch (e) { payload = {}; }
    return { step: String(__webhookBotSessionRows_[i][1] || STEP_IDLE), payload: payload };
  }
  return { step: STEP_IDLE, payload: {} };
}

function setSession_(userId, step, payload) {
  var sheet = getBotSessionSheet_(true);
  var json  = JSON.stringify(payload || {});
  var now   = new Date();
  upsertSheetRowByUserId_(
    sheet, userId, [step, json, now],
    2, 3,
    invalidateBotSessionCache_
  );
}

function deleteSession_(userId) {
  deleteSheetRowByUserId_(getBotSessionSheet_(false), userId, invalidateBotSessionCache_);
}

function getBotSessionSheet_(createIfMissing) {
  if (!createIfMissing) return getWebhookSpreadsheetCached_().getSheetByName(LINE_SHEETS.BOT_SESSIONS);
  return ensureSheetWithHeader_(LINE_SHEETS.BOT_SESSIONS, [
    'userId', 'step', 'payload_json', 'updated_at'
  ], 'BOT_SESSIONS');
}

function ensureBotSessionRows_() {
  if (__webhookBotSessionRows_ !== undefined) return;
  var sheet = getBotSessionSheet_(false);
  __webhookBotSessionRows_ = sheet ? sheet.getDataRange().getValues() : null;
}

// --- pending_posts ---

function savePending_(userId, storeKey, message, imageUrl) {
  var uid   = normalizeWebhookUserIdForSheet_(userId);
  var sheet = getPendingSheet_(true);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();
  for (var i = 1; i < data.length; i++) {
    if (!sheetRowUserIdMatches_(data[i][0], uid)) continue;
    sheet.getRange(i + 1, 2).setValue(storeKey);
    if (message  !== undefined && message  !== null) sheet.getRange(i + 1, 3).setValue(message);
    sheet.getRange(i + 1, 4).setValue(now);
    if (imageUrl !== undefined && imageUrl !== null) sheet.getRange(i + 1, 5).setValue(imageUrl);
    invalidatePendingRowsCache_();
    return;
  }
  sheet.appendRow([uid, storeKey, message || '', now, imageUrl || '']);
  invalidatePendingRowsCache_();
}

function loadPending_(userId) {
  ensurePendingRows_();
  if (__webhookPendingRows_ == null) return null;
  var now = Date.now();
  for (var i = 1; i < __webhookPendingRows_.length; i++) {
    if (!sheetRowUserIdMatches_(__webhookPendingRows_[i][0], userId)) continue;
    var savedAt = __webhookPendingRows_[i][3] ? new Date(__webhookPendingRows_[i][3]).getTime() : 0;
    if (now - savedAt > LINE_LIMITS.PENDING_EXPIRE_MS) return null;
    return {
      storeId:  __webhookPendingRows_[i][1],
      message:  __webhookPendingRows_[i][2],
      imageUrl: __webhookPendingRows_[i][4] ? String(__webhookPendingRows_[i][4]) : ''
    };
  }
  return null;
}

function loadPendingWithGrace_(userId) {
  var sheet = getPendingSheet_(false);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var now  = Date.now();
  for (var i = 1; i < data.length; i++) {
    if (!sheetRowUserIdMatches_(data[i][0], userId)) continue;
    var savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (now - savedAt > LINE_LIMITS.PENDING_LOAD_GRACE_MS) return null;
    var result = {
      storeId:  data[i][1],
      message:  data[i][2],
      imageUrl: data[i][4] ? String(data[i][4]) : ''
    };
    sheet.deleteRow(i + 1);
    invalidatePendingRowsCache_();
    return result;
  }
  return null;
}

function deletePending_(userId) {
  deleteSheetRowByUserId_(getPendingSheet_(false), userId, invalidatePendingRowsCache_);
}

function getPendingSheet_(createIfMissing) {
  if (!createIfMissing) return getWebhookSpreadsheetCached_().getSheetByName(LINE_SHEETS.PENDING);
  return ensureSheetWithHeader_(LINE_SHEETS.PENDING, [
    'userId', 'store_id', 'message', 'saved_at', 'image_url'
  ], 'PENDING');
}

function ensurePendingRows_() {
  if (__webhookPendingRows_ !== undefined) return;
  var sheet = getPendingSheet_(false);
  __webhookPendingRows_ = sheet ? sheet.getDataRange().getValues() : null;
}
