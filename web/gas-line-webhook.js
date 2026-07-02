/**
 * ============================================================
 * LINE → GAS → Google Sheets（外浦MAP / 店舗投稿）
 * ============================================================
 *
 * 【このファイルについて】
 *   自動生成: web/gas/line-webhook/*.js
 *   再生成:   python web/gas/build-line-webhook.py
 *             または node web/gas/build-line-webhook.mjs
 *
 *   GAS へはこのファイルを貼り付けるか、line-webhook フォルダ内の
 *   各 .js を同一プロジェクトの複数 .gs ファイルとして配置可。
 *
 * 【秘密情報】GAS スクリプトプロパティ: SHEET_ID, LINE_CHANNEL_ACCESS_TOKEN
 * 【運用】web/line-contract.js および web/LINE_INTEGRATION.md を参照
 * ============================================================
 */

/**
 * LINE Webhook 契約定数（web/line-contract.js と同期）
 */

// --- スクリプトプロパティキー ---

const WEBHOOK_CONFIG = {
  SHEET_ID: '',
  LINE_CHANNEL_ACCESS_TOKEN: ''
};

const LINE_SCRIPT_PROPS = {
  SHEET_ID:   ['SHEET_ID', 'YOUR_GOOGLE_SHEET_ID'],
  LINE_TOKEN: ['LINE_CHANNEL_ACCESS_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'],
  ADMIN_USER: 'ADMIN_LINE_USER_ID'
};

// --- シート名 ---

const LINE_SHEETS = {
  POSTS:         'posts',
  USER_MAP:      'user_map',
  BOT_SESSIONS:  'bot_sessions',
  PENDING:       'pending_posts',
  STORE_INVITES: 'store_invites'
};

// --- 列インデックス（0始まり） ---

const LINE_POSTS_COL = {
  POST_ID: 0, USER_ID: 1, ROLE: 2, SOURCE_TYPE: 3, TITLE: 4, TEXT: 5,
  IMAGE_URL: 6, LAT: 7, LNG: 8, STORE_ID: 9, CREATED_AT: 10, IS_VISIBLE: 11
};

const LINE_USER_MAP_COL = {
  USER_ID: 0, ROLE: 1, FIXED_STORE_ID: 2, IS_ACTIVE: 3,
  DISPLAY_NAME: 4, REGISTERED_AT: 5, LINKED_VIA: 6
};

const LINE_STORE_INVITES_COL = {
  INVITE_CODE: 0, STORE_ID: 1, IS_ACTIVE: 2, MAX_USES: 3,
  USE_COUNT: 4, EXPIRES_AT: 5, CREATED_AT: 6, NOTE: 7
};

const LINE_BOT_SESSION_COL = {
  USER_ID: 0, STEP: 1, PAYLOAD_JSON: 2, UPDATED_AT: 3
};

const LINE_MASTER_COL = {
  NAME: 1, LAT: 2, LNG: 3, STORE_ID: 11
};

// --- 制限値 ---

const LINE_LIMITS = {
  MAX_TITLE_LENGTH:      14,
  MAX_MESSAGE_LENGTH:    50,
  MAX_IMAGE_SIZE_BYTES:  5 * 1024 * 1024,
  PENDING_EXPIRE_MS:     60 * 1000,
  PENDING_LOAD_GRACE_MS: 5 * 60 * 1000
};

// --- ロール ---

const ROLE_STORE       = 'store';
const ROLE_CONTRIBUTOR = 'contributor';
const KNOWN_ROLE_VALUES = [ROLE_STORE, ROLE_CONTRIBUTOR];

// --- その他定数 ---

const DRIVE_FOLDER_NAME = 'LINE_MAP_IMAGES';

const STEP_IDLE              = 'idle';
const STEP_AWAITING_CONTENT  = 'awaiting_content';
const STEP_AWAITING_FINALIZE = 'awaiting_finalize';

const SOURCE_FIXED = 'fixed';
const SOURCE_GPS   = 'gps';

const INVITE_CODE_BODY_RE_   = /^[A-Za-z0-9]{4,12}$/;
const INVITE_CODE_PREFIX_RE_ = /^(?:紐づけ|はじめます|リンク)[\s\u3000]+/i;

// --- メッセージ文字列 ---

const MSG = {
  LEGACY_ROLE: '⚠️ このロールは現在ご利用いただけません。「登録解除」後、運営から招待コードを受け取って再度紐づけしてください。',
  HELP_INVITE: '・初回: 運営から受け取った招待コードを1通で送る（例: FUMA7K）\n・「紐づけ FUMA7K」でも可\n\n',
  STORE_LOCATION_REJECTED: '店舗の投稿はお店の固定位置を使います。\n📍位置情報は不要です。\n【順番: テキスト→📸写真】📸写真は必須です。',
  STORE_TEXT_BEFORE_PHOTO: '⚠️ 写真の前にテキストを送ってください。\n【順番: テキスト→📸写真】1行目=タイトル、2行目以降=本文',
  STORE_DUPLICATE_TEXT: '⚠️ すでにテキストを受け取り済みです。\n【順番: テキスト→📸写真】続けて📸写真を送ってください。\nやり直す場合はしばらく待つとリセットされます。',
  STORE_PHOTO_REQUIRED: '⚠️ 📸写真は必須です。テキスト→📸写真の順でもう一度送り直してください。',
  STORE_PENDING_EXPIRED: '⏰ 投稿がタイムアウトしました。\n【順番: テキスト→📸写真】最初からもう一度送り直してください。（📸写真は必須）',
  OLD_REGISTER_REDIRECT: '店舗のセルフ登録は廃止しました。\n運営から受け取った招待コードを1通で送ってください。\n（例: FUMA7K）',
  RICH_GUEST_ONBOARDING:
    '【登録の流れ】\n' +
    '① 運営から招待コードを受け取る\n' +
    '② このトークにコードを1通送る（例: DEMO01）\n' +
    '③「紐づけました」と返信が来たら完了\n\n' +
    '以降は【順番: テキスト→📸写真】でかわら版を投稿できます（📸写真は必須）。\n' +
    '位置情報は不要です。',
  RICH_GUEST_ONBOARDING_CMD: '登録の流れ',
  RICH_MENU_EXAMPLE_CMD: '例文'
};

// --- シートヘッダースタイル ---

const SHEET_HEADER_STYLES = {
  USER_MAP:      { bg: '#4A90D9', fg: '#FFFFFF' },
  PENDING:       { bg: '#FFA000', fg: '#FFFFFF' },
  BOT_SESSIONS:  { bg: '#6A1B9A', fg: '#FFFFFF' },
  STORE_INVITES: { bg: '#00695C', fg: '#FFFFFF' },
  POSTS:         { bg: '#2E7D32', fg: '#FFFFFF' }
};

// ==================================================================
// インフラ: 設定・キャッシュ・ログ・ユーティリティ
// ==================================================================

var __webhookSheetIdRuntimeOverride_ = '';
var __webhookSheetIdMemo_     = undefined;
var __webhookSsCache_         = null;
var __webhookMasterGridMemo_  = undefined;
var __webhookPendingRows_     = undefined;
var __webhookLineTokenMemo_   = undefined;
var __webhookAdminIdMemo_     = undefined;
var __webhookReqStartMs_      = 0;
var __webhookUserMapRows_     = undefined;
var __webhookBotSessionRows_  = undefined;
var __webhookStoreInviteRows_ = undefined;

// --- スクリプトプロパティ ---

function readScriptPropertyFromKeyList_(keyList) {
  if (!keyList || !keyList.length) return '';
  var props = PropertiesService.getScriptProperties();
  for (var i = 0; i < keyList.length; i++) {
    var raw = props.getProperty(keyList[i]);
    if (!raw) continue;
    var p = String(raw).trim();
    if (p && !/^YOUR_/i.test(p)) return p;
  }
  return '';
}

function readScriptProperty_(key) {
  var p = PropertiesService.getScriptProperties().getProperty(key);
  return p != null ? String(p).trim() : '';
}

/**
 * スクリプトプロパティのキーリストから値を解決し、なければ WEBHOOK_CONFIG のフォールバックを使う。
 */
function resolveConfigProp_(keyList, configFallback) {
  var fromProps = readScriptPropertyFromKeyList_(keyList);
  if (fromProps) return fromProps;
  var c = String(configFallback || '').trim();
  return (c && !/^YOUR_/i.test(c)) ? c : '';
}

// --- Spreadsheet アクセス ---

function getWebhookSheetId_() {
  if (__webhookSheetIdMemo_ !== undefined) return __webhookSheetIdMemo_;
  if (__webhookSheetIdRuntimeOverride_) {
    __webhookSheetIdMemo_ = __webhookSheetIdRuntimeOverride_;
    return __webhookSheetIdMemo_;
  }
  __webhookSheetIdMemo_ = resolveConfigProp_(LINE_SCRIPT_PROPS.SHEET_ID, WEBHOOK_CONFIG.SHEET_ID);
  return __webhookSheetIdMemo_;
}

function openWebhookSpreadsheet_() {
  var id = getWebhookSheetId_();
  if (!id) {
    throw new Error(
      'SHEET_ID が未設定です。GAS「プロジェクトの設定」→「スクリプトプロパティ」に SHEET_ID を登録してください。'
    );
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      'スプレッドシートを開けません。SHEET_ID が正しいか、デプロイアカウントに編集権限があるか確認してください。 ' +
        String(e.message || e)
    );
  }
}

function getWebhookSpreadsheetCached_() {
  if (__webhookSsCache_) return __webhookSsCache_;
  __webhookSsCache_ = openWebhookSpreadsheet_();
  return __webhookSsCache_;
}

function resetWebhookRequestCache_() {
  __webhookUserMapRows_     = undefined;
  __webhookBotSessionRows_  = undefined;
  __webhookStoreInviteRows_ = undefined;
  __webhookSsCache_         = null;
  __webhookSheetIdMemo_     = undefined;
  __webhookLineTokenMemo_   = undefined;
  __webhookAdminIdMemo_     = undefined;
  __webhookMasterGridMemo_  = undefined;
  __webhookPendingRows_     = undefined;
}

function beginWebhookEventTiming_() {
  __webhookReqStartMs_ = Date.now();
  resetWebhookRequestCache_();
}

function logTimingUntilLineApi_(channel) {
  if (!__webhookReqStartMs_) return;
  webhookExecLog_('[timing] ms_until_line_api=' + (Date.now() - __webhookReqStartMs_) + ' ch=' + channel);
}

// --- LINE トークン / 管理者 ID ---

function getWebhookLineToken_() {
  if (__webhookLineTokenMemo_ !== undefined) return __webhookLineTokenMemo_;
  __webhookLineTokenMemo_ = resolveConfigProp_(LINE_SCRIPT_PROPS.LINE_TOKEN, WEBHOOK_CONFIG.LINE_CHANNEL_ACCESS_TOKEN);
  return __webhookLineTokenMemo_;
}

function getAdminLineUserId_() {
  if (__webhookAdminIdMemo_ !== undefined) return __webhookAdminIdMemo_;
  __webhookAdminIdMemo_ = readScriptProperty_(LINE_SCRIPT_PROPS.ADMIN_USER);
  return __webhookAdminIdMemo_;
}

// --- ログ ---

function webhookExecLog_(message) {
  try { Logger.log(message); } catch (e) {}
  try { console.info(message); } catch (e2) {}
}

function webhookExecErr_(message) {
  try { Logger.log(message); } catch (e) {}
  try { console.error(message); } catch (e2) {}
}

// --- 汎用ユーティリティ ---

function normalizeWebhookUserIdForSheet_(userId) {
  return String(userId == null ? '' : userId).trim();
}

function sheetRowUserIdMatches_(cellVal, userId) {
  return normalizeWebhookUserIdForSheet_(cellVal) === normalizeWebhookUserIdForSheet_(userId);
}

function normalizeStoreKeyForWebhook_(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim();
}

function parseSheetBoolActive_(cell) {
  return cell !== false && String(cell || 'TRUE').toUpperCase() !== 'FALSE';
}

function splitTitleAndBody_(text) {
  var raw   = String(text == null ? '' : text);
  var lines = raw.split(/\r?\n/);
  return {
    title: lines[0].substring(0, LINE_LIMITS.MAX_TITLE_LENGTH).trim(),
    body:  lines.slice(1).join('\n').substring(0, LINE_LIMITS.MAX_MESSAGE_LENGTH).trim()
  };
}

function extractInviteCodeFromText_(text) {
  var t = String(text || '').trim().replace(INVITE_CODE_PREFIX_RE_, '').trim();
  if (!INVITE_CODE_BODY_RE_.test(t)) return null;
  return t.toUpperCase();
}

function normalizeInviteCodeKey_(code) {
  return String(code == null ? '' : code).trim().toUpperCase();
}

function readLineLocationLatLng_(msg) {
  if (!msg || typeof msg !== 'object') return { lat: null, lng: null };
  var lat = msg.latitude  != null ? msg.latitude  : msg.lat;
  var lng = msg.longitude != null ? msg.longitude : msg.lng;
  if ((lat == null || lng == null) && msg.coordinates && typeof msg.coordinates === 'object') {
    lat = msg.coordinates.latitude  != null ? msg.coordinates.latitude  : msg.coordinates.lat;
    lng = msg.coordinates.longitude != null ? msg.coordinates.longitude : msg.coordinates.lng;
  }
  return { lat: lat, lng: lng };
}

// --- シート作成ユーティリティ ---

function insertSheetAtEnd_(ss, name) {
  return ss.insertSheet(name, ss.getSheets().length + 1);
}

function styleSheetHeaderRow_(sheet, colCount, style) {
  sheet.getRange(1, 1, 1, colCount)
    .setBackground(style.bg)
    .setFontColor(style.fg)
    .setFontWeight('bold');
}

/** シートが存在しなければ末尾に追加してヘッダー行を設定（gviz 先頭シートを壊さないため insertSheetAtEnd 使用） */
function ensureSheetWithHeader_(sheetName, headers, styleKey) {
  var ss    = getWebhookSpreadsheetCached_();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  sheet = insertSheetAtEnd_(ss, sheetName);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  var style = SHEET_HEADER_STYLES[styleKey];
  if (style) styleSheetHeaderRow_(sheet, headers.length, style);
  return sheet;
}

// --- マスターシートキャッシュ ---

function getMasterSheetGridCached_() {
  if (__webhookMasterGridMemo_ !== undefined) return __webhookMasterGridMemo_;
  __webhookMasterGridMemo_ = getWebhookSpreadsheetCached_().getSheets()[0].getDataRange().getValues();
  return __webhookMasterGridMemo_;
}

function invalidateMasterGridCache_()    { __webhookMasterGridMemo_  = undefined; }
function invalidatePendingRowsCache_()   { __webhookPendingRows_     = undefined; }
function invalidateUserMapCache_()       { __webhookUserMapRows_     = undefined; }
function invalidateBotSessionCache_()    { __webhookBotSessionRows_  = undefined; }
function invalidateStoreInviteCache_()   { __webhookStoreInviteRows_ = undefined; }

// --- シート行操作ユーティリティ ---

function deleteSheetRowByUserId_(sheet, userId, onDelete) {
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (sheetRowUserIdMatches_(data[i][0], userId)) {
      sheet.deleteRow(i + 1);
      if (onDelete) onDelete();
      return true;
    }
  }
  return false;
}

function upsertSheetRowByUserId_(sheet, userId, rowValues, colStart, colCount, onUpdate) {
  var data = sheet.getDataRange().getValues();
  var uid  = normalizeWebhookUserIdForSheet_(userId);
  for (var i = 1; i < data.length; i++) {
    if (sheetRowUserIdMatches_(data[i][0], uid)) {
      sheet.getRange(i + 1, colStart, 1, colCount).setValues([rowValues]);
      if (onUpdate) onUpdate();
      return;
    }
  }
  sheet.appendRow([uid].concat(rowValues));
  if (onUpdate) onUpdate();
}

// --- ユーザー判定 ---

function isAdminUser_(userId) {
  var adminId = getAdminLineUserId_();
  return adminId && userId === adminId;
}

function isActiveUser_(user) {
  return user && user.isActive !== false;
}

function replyIfNotRegistered_(userId, replyToken, user) {
  if (isActiveUser_(user)) return false;
  replyText(replyToken, buildUnknownUserMessage_(userId));
  return true;
}

// --- メッセージ組み立て ---

function buildMsgLineLinkedOk_(storeId) {
  return (
    '✅ 「' + storeId + '」として紐づけました\n\n' +
    'このあと、【順番: テキスト→📸写真】で投稿できます（📸写真は必須）。\n' +
    '1行目=タイトル(' + LINE_LIMITS.MAX_TITLE_LENGTH + '字)、2行目以降=本文(' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字)'
  );
}

function buildRichMenuExampleMessage_() {
  return (
    '本日のおすすめ（タイトル' + LINE_LIMITS.MAX_TITLE_LENGTH + '字以内）\n' +
    '（ここに本文）（本文' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字以内）'
  );
}

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

// ==================================================================
// LINE Messaging API / Drive 画像
// ==================================================================

function lineAuthHeaders_() {
  return { Authorization: 'Bearer ' + getWebhookLineToken_() };
}

function replyText(replyToken, text) {
  if (!replyToken) {
    webhookExecErr_('[replyText] missing replyToken');
    return;
  }
  logTimingUntilLineApi_('reply');
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: lineAuthHeaders_(),
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  webhookExecLog_('[replyText] LINE reply API http=' + code);
  if (code < 200 || code >= 300) {
    webhookExecErr_('[replyText] http=' + code + ' body=' + res.getContentText().slice(0, 500));
  }
}

function pushText(userId, text) {
  logTimingUntilLineApi_('push');
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    contentType: 'application/json',
    headers: lineAuthHeaders_(),
    payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}

function guessImageExtFromContentType_(contentType) {
  var ct = String(contentType || '').toLowerCase();
  if (ct.indexOf('png') >= 0) return 'png';
  if (ct.indexOf('gif') >= 0) return 'gif';
  if (ct.indexOf('webp') >= 0) return 'webp';
  if (ct.indexOf('heic') >= 0 || ct.indexOf('heif') >= 0) return 'heic';
  return 'jpg';
}

function getOrCreateLineImageFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function shareLineImageFile_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    webhookExecErr_('[shareLineImageFile_] ' + String(shareErr.message || shareErr));
  }
}

function fetchLineImageToDrive_(messageId) {
  var mid = String(messageId || '').trim();
  if (!mid) throw new Error('messageId が空です');

  var token = getWebhookLineToken_();
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');

  var response = UrlFetchApp.fetch(
    'https://api-data.line.me/v2/bot/message/' + encodeURIComponent(mid) + '/content',
    {
      method: 'GET',
      headers: lineAuthHeaders_(),
      muteHttpExceptions: true
    }
  );
  var code = response.getResponseCode();
  if (code !== 200) {
    var body = response.getContentText().slice(0, 300);
    webhookExecErr_('[fetchLineImageToDrive_] http=' + code + ' messageId=' + mid + ' body=' + body);
    if (code === 401) throw new Error('LINE トークンが無効です（401）');
    if (code === 404) throw new Error('画像の有効期限切れです。もう一度送り直してください（404）');
    throw new Error('LINE 画像 API エラー HTTP ' + code);
  }

  var blob = response.getBlob();
  var bytes = blob.getBytes();
  if (!bytes || !bytes.length) throw new Error('画像データが空です');
  if (bytes.length > LINE_LIMITS.MAX_IMAGE_SIZE_BYTES) throw new Error('サイズ上限超過');

  var ext    = guessImageExtFromContentType_(blob.getContentType());
  var folder = getOrCreateLineImageFolder_();
  var file   = folder.createFile(blob.setName('line_' + mid + '_' + Date.now() + '.' + ext));
  shareLineImageFile_(file);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}

// ==================================================================
// 投稿フロー（店舗 fixed / 協力者 GPS）
// ==================================================================

function pendingWaitMinutes_() {
  return LINE_LIMITS.PENDING_EXPIRE_MS / 60000;
}

function replyPendingTextAck_(replyToken, preview) {
  replyText(replyToken,
    '📝 受け付けました「' + preview + '」\n' +
    '【順番: テキスト→📸写真】続けて📸写真を送ってください（' + pendingWaitMinutes_() + '分以内）\n' +
    '📸写真は必須です。');
}

function handleStoreContentText_(userId, replyToken, user, text) {
  deleteSession_(userId);
  var rawText = text.substring(0, LINE_LIMITS.MAX_TITLE_LENGTH + 1 + LINE_LIMITS.MAX_MESSAGE_LENGTH);
  var pending = loadPending_(userId);

  if (pending && String(pending.message || '').trim()) {
    replyText(replyToken, MSG.STORE_DUPLICATE_TEXT);
    return;
  }

  savePending_(userId, user.fixedStoreId || '', rawText);
  replyPendingTextAck_(replyToken, rawText.split(/\r?\n/)[0].substring(0, 20));
}

function handleContributorContentText_(userId, replyToken, user, text) {
  var sess = getSession_(userId);
  if (sess.payload.lat == null || sess.payload.lng == null) {
    replyText(replyToken,
      '協力者の投稿は📍位置が先です。\n【順番】📍位置情報 → 短文テキスト → 📸写真');
    return;
  }
  var pending = loadPending_(userId);
  if (pending && String(pending.message || '').trim()) {
    replyText(replyToken,
      '⚠️ すでにテキストを受け取り済みです。\n【順番: テキスト→📸写真】続けて📸写真を送ってください。');
    return;
  }
  var truncated = text.substring(0, LINE_LIMITS.MAX_MESSAGE_LENGTH).trim();
  if (!truncated) {
    replyText(replyToken, '先に内容のある短文（1文字以上）を送ってから、写真を送ってください。');
    return;
  }
  savePending_(userId, '_liv_', truncated);
  replyText(replyToken,
    '📝 受け付けました「' + truncated + '」\n【順番: テキスト→📸写真】続けて📸写真を送ってください（' +
    pendingWaitMinutes_() + '分以内）\n📸写真は必須です。');
}

function mergeImageWithPendingThenFinalize_(userId, replyToken, user, imageUrl) {
  var pending = loadPendingWithGrace_(userId);
  var text    = pending ? String(pending.message || '') : '';
  if (!text.trim()) {
    if (replyToken !== 'PUSH') replyText(replyToken, MSG.STORE_TEXT_BEFORE_PHOTO);
    return;
  }
  var sess    = getSession_(userId);
  var useGps  = user.role === ROLE_CONTRIBUTOR && sess.payload.lat != null && sess.payload.lng != null;
  proceedToFinalizePost_(userId, replyToken, user, {
    text:     text,
    imageUrl: imageUrl || '',
    lat:      useGps ? sess.payload.lat : null,
    lng:      useGps ? sess.payload.lng : null,
    spotId:   sess.payload.spotId   || '',
    spotName: sess.payload.spotName || ''
  });
}

function proceedToFinalizePost_(userId, replyToken, user, payload) {
  setSession_(userId, STEP_AWAITING_FINALIZE, payload);
  finalizePost_(userId, replyToken, user);
}

function resolveStorePostCoords_(user) {
  var storeId = user.fixedStoreId || '';
  var coords  = getStoreCoordsFromMaster_(storeId);
  if (!coords) return { error: '店舗座標が見つかりません（店舗名: ' + storeId + '）。管理者に確認してください。' };
  return { storeId: storeId, sourceType: SOURCE_FIXED, lat: coords.lat, lng: coords.lng };
}

function resolveContributorPostCoords_(user, lat, lng) {
  var latNum = lat != null ? Number(lat) : NaN;
  var lngNum = lng != null ? Number(lng) : NaN;
  if (!isFinite(latNum) || !isFinite(lngNum)) {
    return { error: '位置情報がありません。' };
  }
  return {
    storeId:    user.fixedStoreId || '',
    sourceType: SOURCE_GPS,
    lat:        latNum,
    lng:        lngNum
  };
}

function rejectPostMissingPhoto_(userId, replyToken) {
  deleteSession_(userId);
  deletePending_(userId);
  if (replyToken === 'PUSH') pushText(userId, MSG.STORE_PHOTO_REQUIRED);
  else replyText(replyToken, MSG.STORE_PHOTO_REQUIRED);
}

function finalizePost_(userId, replyToken, user) {
  if (user.role !== ROLE_STORE && user.role !== ROLE_CONTRIBUTOR) {
    if (replyToken !== 'PUSH') replyText(replyToken, MSG.LEGACY_ROLE);
    deleteSession_(userId);
    deletePending_(userId);
    return;
  }

  var sess = getSession_(userId);
  if (sess.step !== STEP_AWAITING_FINALIZE) {
    if (replyToken !== 'PUSH') {
      replyText(replyToken, '投稿のタイミングではありません。投稿を送り直してください。');
    }
    return;
  }

  var p     = sess.payload;
  var split = splitTitleAndBody_(p.text || '');

  if (!String(p.imageUrl || '').trim()) {
    rejectPostMissingPhoto_(userId, replyToken);
    return;
  }

  if (!split.title && !split.body) {
    if (replyToken !== 'PUSH') {
      replyText(replyToken, '⚠️ テキストがありません。【順番: テキスト→📸写真】最初から送り直してください。');
    } else {
      pushText(userId, '⚠️ テキストがありません。【順番: テキスト→📸写真】最初から送り直してください。');
    }
    deleteSession_(userId);
    deletePending_(userId);
    return;
  }

  var resolved = user.role === ROLE_STORE
    ? resolveStorePostCoords_(user)
    : resolveContributorPostCoords_(user, p.lat, p.lng);

  if (resolved.error) {
    if (replyToken !== 'PUSH') replyText(replyToken, resolved.error);
    deleteSession_(userId);
    return;
  }

  var saveResult = upsertPostRow_({
    postId:     Utilities.getUuid(),
    userId:     userId,
    role:       user.role,
    sourceType: resolved.sourceType,
    title:      split.title,
    text:       split.body,
    imageUrl:   p.imageUrl || '',
    lat:        resolved.lat,
    lng:        resolved.lng,
    storeId:    resolved.storeId,
    createdAt:  new Date(),
    isVisible:  true
  });

  deleteSession_(userId);
  deletePending_(userId);

  var doneMsg = saveResult.updated
    ? '✅ マップを更新しました！' + (p.spotName ? '\n場所:' + p.spotName : '')
    : '✅ マップに反映しました！' + (p.spotName ? '\n場所:' + p.spotName : '');
  if (replyToken === 'PUSH') pushText(userId, doneMsg);
  else replyText(replyToken, doneMsg);
}

function handleContributorImage_(userId, replyToken, user, messageId) {
  var pendingTxt = loadPending_(userId);
  if (!pendingTxt || !String(pendingTxt.message || '').trim()) {
    replyText(replyToken,
      '位置情報付きの投稿は【順番: 短文テキスト→📸写真】です。\n短文を先に送ってから写真を送ってください。');
    return;
  }
  var imageUrl;
  try {
    imageUrl = fetchLineImageToDrive_(messageId);
  } catch (err) {
    webhookExecErr_('[handleContributorImage_] fetch ' + String(err.message || err));
    replyText(replyToken, '⚠️ 画像取得に失敗しました。\n' + String(err.message || err));
    return;
  }
  try {
    mergeImageWithPendingThenFinalize_(userId, replyToken, user, imageUrl);
  } catch (err) {
    webhookExecErr_('[handleContributorImage_] finalize ' + String(err.message || err));
    replyText(replyToken, '⚠️ 投稿の保存に失敗しました。もう一度お試しください。');
  }
}

function handleStoreImageIncoming_(userId, replyToken, user, messageId) {
  var pending = loadPending_(userId);
  if (!pending || !String(pending.message || '').trim()) {
    replyText(replyToken, MSG.STORE_TEXT_BEFORE_PHOTO);
    return;
  }
  var imageUrl;
  try {
    imageUrl = fetchLineImageToDrive_(messageId);
  } catch (err) {
    webhookExecErr_('[handleStoreImageIncoming_] fetch ' + String(err.message || err));
    replyText(replyToken, '⚠️ 画像の取得に失敗しました。\n' + String(err.message || err));
    return;
  }
  try {
    mergeImageWithPendingThenFinalize_(userId, replyToken, user, imageUrl);
  } catch (err) {
    webhookExecErr_('[handleStoreImageIncoming_] finalize ' + String(err.message || err));
    replyText(replyToken, '⚠️ 投稿の保存に失敗しました。もう一度お試しください。');
  }
}

function contributorHasGpsSession_(userId) {
  var sess = getSession_(userId);
  return sess.step === STEP_AWAITING_CONTENT &&
    sess.payload.lat != null && sess.payload.lng != null;
}

function notifyPendingExpired_(userId, replyToken) {
  if (replyToken === 'PUSH') pushText(userId, MSG.STORE_PENDING_EXPIRED);
}

// --- pending のタイマーフラッシュ ---

function buildFlushPayload_(user, sess, message, imageUrl) {
  if (user.role === ROLE_CONTRIBUTOR && sess.payload.lat != null && sess.payload.lng != null) {
    return Object.assign({}, sess.payload, { text: message, imageUrl: imageUrl });
  }
  return { text: message, imageUrl: imageUrl, lat: null, lng: null, spotId: '', spotName: '' };
}

function flushExpiredPending_(excludeUserId) {
  invalidatePendingRowsCache_();
  var sheet = getPendingSheet_(false);
  if (!sheet) return;
  var data  = sheet.getDataRange().getValues();
  var nowMs = Date.now();

  for (var i = data.length - 1; i >= 1; i--) {
    var savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (nowMs - savedAt <= LINE_LIMITS.PENDING_EXPIRE_MS) continue;

    var userId   = data[i][0];
    if (excludeUserId && sheetRowUserIdMatches_(userId, excludeUserId)) continue;

    var message  = data[i][2] ? String(data[i][2]) : '';
    var imageUrl = data[i][4] ? String(data[i][4]) : '';
    sheet.deleteRow(i + 1);

    var user = getUserRecord_(userId);
    if (!isActiveUser_(user)) continue;
    if (user.role !== ROLE_STORE && user.role !== ROLE_CONTRIBUTOR) continue;

    var hasText  = !!message.trim();
    var hasImage = !!String(imageUrl || '').trim();
    if (!hasText && !hasImage) continue;

    if (!hasText || !hasImage) {
      notifyPendingExpired_(userId, 'PUSH');
      continue;
    }

    var sess = getSession_(userId);
    proceedToFinalizePost_(userId, 'PUSH', user, buildFlushPayload_(user, sess, message, imageUrl));
  }
}

// ==================================================================
// Webhook エントリ / メッセージルーティング
// ==================================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(processWebhookEvent_);
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    webhookExecErr_('[doPost] ' + String(err && err.message ? err.message : err));
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'posts') {
    var data     = getPostsForApi_();
    var callback = e.parameter.callback;
    var json     = JSON.stringify(data);
    var out      = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

function processWebhookEvent_(event) {
  if (event.type !== 'message') return;

  var lock     = LockService.getScriptLock();
  var lockHeld = false;
  try {
    lock.waitLock(10000);
    lockHeld = true;
  } catch (lockErr) {
    webhookExecErr_('[processWebhookEvent_] waitLock ' +
      String(lockErr && lockErr.message ? lockErr.message : lockErr));
  }

  try {
    beginWebhookEventTiming_();
    dispatchWebhookMessage_(event);
  } catch (innerErr) {
    webhookExecErr_('[processWebhookEvent_] ' +
      String(innerErr && innerErr.message ? innerErr.message : innerErr));
    if (event.replyToken) {
      try {
        replyText(event.replyToken, '⚠️ 処理中にエラーが発生しました。しばらくしてからもう一度お試しください。');
      } catch (replyErr) {
        webhookExecErr_('[processWebhookEvent_] error reply ' +
          String(replyErr && replyErr.message ? replyErr.message : replyErr));
      }
    }
  } finally {
    if (lockHeld) {
      try { lock.releaseLock(); } catch (e) { /* ignore */ }
    }
  }
}

function dispatchWebhookMessage_(event) {
  var userId     = event.source && event.source.userId;
  var replyToken = event.replyToken;
  var msg        = event.message;

  if (!msg) {
    if (replyToken) replyText(replyToken, '⚠️ メッセージ本文を取得できませんでした。もう一度お試しください。');
    return;
  }
  if (!userId) {
    if (replyToken) {
      replyText(replyToken,
        '⚠️ ユーザー情報を取得できませんでした。\n' +
        '・公式アカウントとの「1対1」のトークで試してください\n' +
        '・グループ利用時は userId が届かない設定だと利用できません');
    }
    return;
  }

  switch (String(msg.type || '').toLowerCase()) {
    case 'text':
      handleTextIncoming_(userId, replyToken, String(msg.text || '').trim());
      break;
    case 'image':
      handleImageIncoming_(userId, replyToken, msg.id);
      break;
    case 'location':
      var ll = readLineLocationLatLng_(msg);
      webhookExecLog_('[webhook] location ' + JSON.stringify({
        userPrefix: String(userId).slice(0, 10), lat: ll.lat, lng: ll.lng
      }));
      handleLocationIncoming_(userId, replyToken, ll.lat, ll.lng);
      break;
    default:
      if (replyToken) {
        replyText(replyToken,
          '⚠️ このメッセージ形式には未対応です（type: ' + String(msg.type || '?') + '）。');
      }
  }
}

function tryHandleGlobalTextCommand_(userId, replyToken, text) {
  if (text === MSG.RICH_MENU_EXAMPLE_CMD) {
    replyText(replyToken, buildRichMenuExampleMessage_());
    return true;
  }
  if (text === MSG.RICH_GUEST_ONBOARDING_CMD || text === MSG.RICH_GUEST_ONBOARDING) {
    var u = getUserRecord_(userId);
    replyText(replyToken, isActiveUser_(u) ? buildHelpMessage_(userId) : MSG.RICH_GUEST_ONBOARDING);
    return true;
  }
  if (/^マイID$/i.test(text) || /^my\s*id$/i.test(text)) {
    replyText(replyToken, buildMyIdMessage_(userId));
    return true;
  }
  if (/^ヘルプ$/.test(text) || /^help$/i.test(text)) {
    replyText(replyToken, buildHelpMessage_(userId));
    return true;
  }
  if (/^登録確認$/.test(text)) {
    handleCheckCommand_(userId, replyToken);
    return true;
  }
  if (/^登録解除$/.test(text)) {
    handleUnregisterCommand_(userId, replyToken);
    return true;
  }
  if (isAdminUser_(userId)) {
    if (/^ユーザー一覧$/.test(text)) {
      handleAdminListCommand_(replyToken);
      return true;
    }
    if (/^削除\s+\S+$/.test(text)) {
      handleAdminDeleteCommand_(replyToken, text.split(/\s+/)[1]);
      return true;
    }
    if (/^テスト投稿$/.test(text)) {
      handleAdminTestPost_(replyToken, userId);
      return true;
    }
  }
  return false;
}

function handleTextIncoming_(userId, replyToken, text) {
  if (!text) return;
  if (tryHandleGlobalTextCommand_(userId, replyToken, text)) return;

  var user = getUserRecord_(userId);

  if (!isActiveUser_(user)) {
    var inviteCode = extractInviteCodeFromText_(text);
    if (inviteCode) {
      handleInviteLink_(userId, replyToken, inviteCode);
      return;
    }
    if (/^登録/.test(text) || /^(店|店舗)$/.test(text)) {
      replyText(replyToken, MSG.OLD_REGISTER_REDIRECT);
      return;
    }
    replyText(replyToken, buildUnknownUserMessage_(userId));
    return;
  }

  if (user.role === ROLE_CONTRIBUTOR) {
    flushExpiredPending_();
    if (contributorHasGpsSession_(userId)) {
      handleContributorContentText_(userId, replyToken, user, text);
      return;
    }
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  flushExpiredPending_();
  handleStoreContentText_(userId, replyToken, user, text);
}

function handleImageIncoming_(userId, replyToken, messageId) {
  flushExpiredPending_(userId);
  var user = getUserRecord_(userId);
  if (replyIfNotRegistered_(userId, replyToken, user)) return;

  if (user.role === ROLE_CONTRIBUTOR) {
    var sess = getSession_(userId);
    if (sess.payload.lat == null || sess.payload.lng == null) {
      replyText(replyToken, '先に📍位置情報メッセージを送ってください。');
      return;
    }
    handleContributorImage_(userId, replyToken, user, messageId);
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  handleStoreImageIncoming_(userId, replyToken, user, messageId);
}

function handleLocationIncoming_(userId, replyToken, lat, lng) {
  try {
    var latNum = lat != null && lat !== '' ? Number(lat) : NaN;
    var lngNum = lng != null && lng !== '' ? Number(lng) : NaN;
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      replyText(replyToken,
        '⚠️ 位置を認識できませんでした。\n' +
        'LINEの入力欄「＋」→「位置情報」から📍付きの「位置情報」メッセージにしてください。');
      return;
    }

    var user = getUserRecord_(userId);
    if (replyIfNotRegistered_(userId, replyToken, user)) return;

    if (user.role === ROLE_STORE) {
      replyText(replyToken, MSG.STORE_LOCATION_REJECTED);
      return;
    }
    if (user.role !== ROLE_CONTRIBUTOR) {
      replyText(replyToken, MSG.LEGACY_ROLE);
      return;
    }

    deletePending_(userId);
    setSession_(userId, STEP_AWAITING_CONTENT, {
      text: '', imageUrl: '', lat: latNum, lng: lngNum, spotId: '', spotName: ''
    });
    replyText(replyToken,
      '📍位置を受け取りました。\n【順番】①テキスト（1行目=タイトル' +
      LINE_LIMITS.MAX_TITLE_LENGTH + '字、2行目以降=本文' +
      LINE_LIMITS.MAX_MESSAGE_LENGTH + '字）→②📸写真');
  } catch (err) {
    webhookExecErr_('[handleLocationIncoming_] ' + String(err.message || err));
    replyText(replyToken, '⚠️ 位置の保存に失敗しました。管理者に連絡してください。');
  }
}

// ==================================================================
// ヘルプ / 管理者 / セットアップ / ヘルスチェック
// ==================================================================

// --- コマンドハンドラ ---

function handleCheckCommand_(userId, replyToken) {
  var u = getUserRecord_(userId);
  if (!u) {
    replyText(replyToken, '未登録です。「ヘルプ」で確認してください。');
    return;
  }
  var detail = u.role === ROLE_STORE
    ? '店舗名: ' + u.fixedStoreId
    : '（旧ロール・登録解除後、運営の招待コードで再紐づけしてください）';
  replyText(replyToken, '📋 登録状況\nロール:' + u.role + '\n' + detail + '\n有効:' + (u.isActive !== false));
}

function handleUnregisterCommand_(userId, replyToken) {
  deleteUserFromMap_(userId);
  deleteSession_(userId);
  deletePending_(userId);
  replyText(replyToken, '✅ 登録を解除しました。');
}

function handleAdminListCommand_(replyToken) {
  var rows = getAllUserMapRows_();
  if (rows.length === 0) {
    replyText(replyToken, '登録ユーザーなし');
    return;
  }
  var lines = rows.map(function (r, i) {
    return (i + 1) + '. ' + r.role + ' ' + (r.fixedStoreId || '-') + '\n  ' +
      String(r.userId).slice(0, 12) + '...\n  ' + r.registeredAt;
  });
  replyText(replyToken, '登録一覧\n\n' + lines.join('\n\n'));
}

function handleAdminDeleteCommand_(replyToken, target) {
  var deletedByStore = deleteAllUsersByFixedStoreId_(target);
  if (deletedByStore > 0) {
    replyText(replyToken, '✅ 削除: store ' + target + '（' + deletedByStore + '件）');
    return;
  }
  var hit = 0;
  getAllUserMapRows_().forEach(function (r) {
    if (String(r.userId).indexOf(target) === 0) {
      deleteUserFromMap_(r.userId);
      hit++;
    }
  });
  replyText(replyToken, hit > 0 ? '✅ 該当ユーザーを' + hit + '件削除しました' : '見つかりません');
}

function handleAdminTestPost_(replyToken, adminUserId) {
  var u = getUserRecord_(adminUserId);
  if (!u || u.role !== ROLE_STORE || !u.fixedStoreId) {
    replyText(replyToken, '管理者アカウントが店舗ロールかつ fixed_store_id 付きである必要があります。');
    return;
  }
  var c = getStoreCoordsFromMaster_(u.fixedStoreId);
  if (!c) {
    replyText(replyToken, '店舗座標が未取得です');
    return;
  }
  appendPostRow_({
    postId:     Utilities.getUuid(),
    userId:     adminUserId,
    role:       ROLE_STORE,
    sourceType: SOURCE_FIXED,
    title:      'テスト投稿',
    text:       'かわら版テスト',
    imageUrl:   '',
    lat: c.lat, lng: c.lng,
    storeId:    u.fixedStoreId,
    createdAt:  new Date(),
    isVisible:  true
  });
  replyText(replyToken, '✅ posts にテスト行を書き込みしました');
}

// --- メッセージ組み立て ---

function buildMyIdMessage_(userId) {
  var u    = getUserRecord_(userId);
  var tail = u
    ? '\n登録済: ' + u.role + (u.fixedStoreId ? ' / ' + u.fixedStoreId : '')
    : '\n未登録';
  return '🆔 LINEユーザーID\n\n' + userId + tail;
}

function buildUnknownUserMessage_(userId) {
  return (
    '👋 未紐づけです。\nあなたのID:\n' + userId + '\n\n' +
    '運営から受け取った招待コードを1通で送ってください。\n（例: FUMA7K）\n「ヘルプ」でも手順を確認できます。'
  );
}

function buildHelpMessage_(userId) {
  var head = '📖 コマンド\nマイID / ヘルプ / 登録確認 / 登録解除\n\n' + MSG.HELP_INVITE;
  var u    = getUserRecord_(userId);
  var flow;
  if (!u) {
    flow = '🗺️ 招待コードで紐づけ後、かわら版を投稿できます。';
  } else if (u.role === ROLE_STORE) {
    flow =
      '📝 かわら版の投稿順番: テキスト→📸写真（📸写真は必須）\n' +
      'テキストは1行目=タイトル(' + LINE_LIMITS.MAX_TITLE_LENGTH + '字以内)、' +
      '2行目以降=本文(' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字以内)\n' +
      'テキストを2回送ることはできません。写真の前にテキストを送ってください。\n' +
      '表示位置はお店の固定座標です（📍位置情報は不要）。\n' +
      '端末変更時は「登録解除」と入力してから、新端末で招待コードを再送してください。';
  } else {
    flow = MSG.LEGACY_ROLE;
  }
  return head + flow + '\n\nタイトル:' + LINE_LIMITS.MAX_TITLE_LENGTH +
    '字 / 本文:' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字まで';
}

// --- シートセットアップ ---

function findMasterSheetForGviz_(ss) {
  var reserved = {};
  Object.keys(LINE_SHEETS).forEach(function (k) { reserved[LINE_SHEETS[k]] = true; });
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (reserved[sheets[i].getName()]) continue;
    if (String(sheets[i].getRange('B1').getValue()) === 'name') return sheets[i];
  }
  return ss.getSheetByName('Sheet1') || null;
}

function ensureMasterSheetIsGvizFirst_(ss) {
  var master = findMasterSheetForGviz_(ss);
  if (!master) return;
  ss.setActiveSheet(master);
  ss.moveActiveSheet(1);
}

function ensureWebhookSheetIdFromActiveIfPlaceholder_() {
  if (getWebhookSheetId_()) return;
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'setupSheets: スクリプトプロパティに SHEET_ID を登録するか、' +
      '紐づけでこのスプレッドシートを開いた状態で実行してください。'
    );
  }
  __webhookSheetIdRuntimeOverride_ = active.getId();
  console.log('実行中のみアクティブ表の ID を補完しました。恒久的には SHEET_ID をプロパティへ。');
}

function setupSheets() {
  ensureWebhookSheetIdFromActiveIfPlaceholder_();
  if (!getWebhookSheetId_()) throw new Error('setupSheets: スプレッドシート ID を取得できませんでした。');
  var ss = SpreadsheetApp.openById(getWebhookSheetId_());
  getUserMapSheet_(true);
  getPendingSheet_(true);
  getBotSessionSheet_(true);
  getStoreInvitesSheet_(true);
  if (!ss.getSheetByName(LINE_SHEETS.POSTS)) {
    ensurePostsSheet_(ss);
    console.log('✅ posts');
  }
  ensureMasterSheetIsGvizFirst_(ss);
  console.log('setupSheets OK');
}

function logWebhookScriptPropertyKeys() {
  console.log([
    '=== スクリプトプロパティ ===',
    '[必須] SHEET_ID',
    '[必須] LINE_CHANNEL_ACCESS_TOKEN',
    '[任意] ADMIN_LINE_USER_ID',
    '--- 互換 --- YOUR_GOOGLE_SHEET_ID, YOUR_LINE_CHANNEL_ACCESS_TOKEN'
  ].join('\n'));
}

function runWebhookHealthCheck() {
  var idSet = !!getWebhookSheetId_();
  webhookExecLog_('[health] SHEET_ID: ' + (idSet ? 'あり' : 'なし'));
  if (!idSet) return;
  try {
    var ss = getWebhookSpreadsheetCached_();
    webhookExecLog_('[health] スプレッドシート: ' + ss.getName());
    webhookExecLog_('[health] bot_sessions 最終行: ' + getBotSessionSheet_(true).getLastRow());
  } catch (e) {
    webhookExecErr_('[health] 失敗: ' + String(e.message || e));
    return;
  }
  var tok = getWebhookLineToken_();
  webhookExecLog_('[health] LINE_TOKEN: ' + (tok ? 'あり（長さ ' + tok.length + '）' : 'なし'));
}

// --- トリガー管理 ---

function installPendingFlushTrigger() {
  removePendingFlushTrigger();
  ScriptApp.newTrigger('flushExpiredPending_')
    .timeBased().everyMinutes(1).create();
  Logger.log('flushExpiredPending_ トリガーを設置しました（毎分）');
}

function removePendingFlushTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      return t.getHandlerFunction() === 'flushExpiredPending_' ||
        t.getHandlerFunction() === 'flushExpiredPending';
    })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('pending フラッシュトリガーを削除しました');
}

// --- デバッグ用 ---

function testAppend() {
  appendPostRow_({
    postId:     Utilities.getUuid(),
    userId:     'TEST',
    role:       ROLE_STORE,
    sourceType: SOURCE_FIXED,
    title:      'テスト',
    text:       'かわら版テスト本文',
    imageUrl:   '',
    lat: 34.675, lng: 138.943,
    storeId:    'test',
    createdAt:  new Date(),
    isVisible:  true
  });
}

// --- 後方互換エイリアス（GAS トリガー・外部参照用） ---

function flushExpiredPending(excludeUserId)            { flushExpiredPending_(excludeUserId); }
function getUserRecord(userId)                         { return getUserRecord_(userId); }
function getStoreCoordsFromMaster(storeId)             { return getStoreCoordsFromMaster_(storeId); }
function saveStoreCoordsToMaster(storeId, lat, lng)    { saveStoreCoordsToMaster_(storeId, lat, lng); }
