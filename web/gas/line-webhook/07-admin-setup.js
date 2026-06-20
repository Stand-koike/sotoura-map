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
      '📝 かわら版の投稿順番: テキスト→📸写真\n' +
      'テキストは1行目=タイトル(' + LINE_LIMITS.MAX_TITLE_LENGTH + '字以内)、' +
      '2行目以降=本文(' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字以内)\n' +
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
