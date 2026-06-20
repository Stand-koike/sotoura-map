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
    'このあと、テキスト → 📸写真 の順で投稿できます。\n' +
    '1行目=タイトル(' + LINE_LIMITS.MAX_TITLE_LENGTH + '字)、2行目以降=本文(' + LINE_LIMITS.MAX_MESSAGE_LENGTH + '字)'
  );
}
