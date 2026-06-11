/**
 * ============================================================
 * LINE → GAS → Google Sheets（外浦MAP / 店舗投稿）
 * 契約定義: web/line-contract.js（GAS 先頭 LINE_* と同期）
 * ============================================================
 *
 * 【秘密情報・運用（本番）】
 *   実 ID・LINE トークン・管理者 ID 等は **ソースに書かない**。
 *   GAS の「プロジェクトの設定」→「スクリプトプロパティ」に登録する（キー一覧は logWebhookScriptPropertyKeys を実行してログ確認）。
 *
 * 【初回セットアップ】
 *   1. logWebhookScriptPropertyKeys を実行し、必須キーをスクリプトプロパティへ手入力
 *   2. setupSheets()（紐づけスクリプトなら表を開いて実行可）
 *   3. ウェブアプリをデプロイ。「アクセスできるユーザー」は「全員」（LINE は匿名アクセス）
 *
 * 【開発用フォールバック】
 *   WEBHOOK_CONFIG にだけ値がある場合は最後の手段として読む。本番ではキーを空のままにしておくこと。
 *
 * 【ロールと投稿】
 *   店舗: 固定座標（スプレッドシート先頭シートの store_id と座標）。
 *   店舗のみ（協力者・運営ロールは廃止。将来拡張余地あり）。
 *
 * 【スプレッドシートでのモデレーション】
 *   posts シートの isVisible を FALSE にするとマップから非表示。
 *
 * 【posts シート列構成（12列・かわら版）】
 *   postId | userId | role | sourceType | title | text | imageUrl |
 *   lat | lng | storeId | createdAt | isVisible
 *
 * 【既存 posts シートの手動マイグレーション】
 *   1. E列に title 列を挿入（ヘッダー: title）
 *   2. 旧 category 列（E列）のデータは不要なら削除
 *   3. spotId 列・expiresAt 列を削除
 *   4. isVisible が最終列（L列）になるよう並べ替え
 *   5. setupSheets() を実行してヘッダー行を確認
 *   旧14列: postId…category,text,…,spotId,createdAt,expiresAt,isVisible
 */

// ---------------------------------------------------------------
/**
 * ローカル試験用フォールバックのみ。**本番は空のまま**し、スクリプトプロパティへ SHEET_ID / LINE_CHANNEL_ACCESS_TOKEN を設定すること。
 */
const WEBHOOK_CONFIG = {
  SHEET_ID: '',
  LINE_CHANNEL_ACCESS_TOKEN: ''
};

// ----------------------------------------------------------------
// LINE 契約（web/line-contract.js と同期 — GAS は単体デプロイのためここに保持）
// ----------------------------------------------------------------
const LINE_SCRIPT_PROPS = {
  SHEET_ID:     ['SHEET_ID', 'YOUR_GOOGLE_SHEET_ID'],
  LINE_TOKEN:   ['LINE_CHANNEL_ACCESS_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'],
  ADMIN_USER:   'ADMIN_LINE_USER_ID',
  REG_PASSWORD: 'REGISTRATION_PASSWORD'
};

const LINE_SHEETS = {
  POSTS:        'posts',
  USER_MAP:     'user_map',
  BOT_SESSIONS: 'bot_sessions',
  PENDING:      'pending_posts'
};

/** posts シート列（0-indexed）— gviz row.c / getValues 共通 */
const LINE_POSTS_COL = {
  POST_ID: 0, USER_ID: 1, ROLE: 2, SOURCE_TYPE: 3, TITLE: 4, TEXT: 5,
  IMAGE_URL: 6, LAT: 7, LNG: 8, STORE_ID: 9, CREATED_AT: 10, IS_VISIBLE: 11
};

const LINE_USER_MAP_COL = {
  USER_ID: 0, ROLE: 1, FIXED_STORE_ID: 2, IS_ACTIVE: 3,
  DISPLAY_NAME: 4, REGISTERED_AT: 5
};

const LINE_BOT_SESSION_COL = {
  USER_ID: 0, STEP: 1, PAYLOAD_JSON: 2, UPDATED_AT: 3
};

const LINE_PENDING_COL = {
  USER_ID: 0, STORE_ID: 1, MESSAGE: 2, IMAGE_URL: 3, SAVED_AT: 4
};

/** 店舗マスタ — config.js COLS.STORE_ID(11) と一致 */
const LINE_MASTER_COL = {
  NAME: 1, LAT: 2, LNG: 3, STORE_ID: 11
};

const LINE_LIMITS = {
  MAX_TITLE_LENGTH:    14,
  MAX_MESSAGE_LENGTH:  50,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  PENDING_EXPIRE_MS:   60 * 1000,
  PENDING_LOAD_GRACE_MS: 5 * 60 * 1000
};

const ROLE_STORE = 'store';
const ROLE_CONTRIBUTOR = 'contributor';
const KNOWN_ROLE_VALUES = [ROLE_STORE, ROLE_CONTRIBUTOR];

const DRIVE_FOLDER_NAME = 'LINE_MAP_IMAGES';

/** @deprecated LINE_* 定数を直接参照すること */
const MASTER_COL_NAME = LINE_MASTER_COL.NAME;
const MASTER_COL_LAT = LINE_MASTER_COL.LAT;
const MASTER_COL_LNG = LINE_MASTER_COL.LNG;
const MASTER_COL_STORE_ID = LINE_MASTER_COL.STORE_ID;
const POSTS_SHEET_NAME = LINE_SHEETS.POSTS;
const BOT_SESSIONS_SHEET_NAME = LINE_SHEETS.BOT_SESSIONS;
const USER_MAP_SHEET_NAME = LINE_SHEETS.USER_MAP;
const PENDING_SHEET_NAME = LINE_SHEETS.PENDING;
const MAX_TITLE_LENGTH = LINE_LIMITS.MAX_TITLE_LENGTH;
const MAX_MESSAGE_LENGTH = LINE_LIMITS.MAX_MESSAGE_LENGTH;
const MAX_IMAGE_SIZE_BYTES = LINE_LIMITS.MAX_IMAGE_SIZE_BYTES;
const PENDING_EXPIRE_MS = LINE_LIMITS.PENDING_EXPIRE_MS;

/** setup Sheets でアクティブ表から補完した ID（その実行中だけ） */
var __webhookSheetIdRuntimeOverride_ = '';

/**
 * スプレッドシート ID。
 * 優先: 実行時オーバーライド → スクリプトプロパティ（SHEET_ID / YOUR_GOOGLE_SHEET_ID）→ WEBHOOK_CONFIG（空でなければ）
 * 同一 webhook メッセージ処理内では結果をメモ化する。
 */
/** 同一実行内の getWebhookSheetId_ 結果（webhook イベント開始時にクリア） */
var __webhookSheetIdMemo_ = undefined;

/** スクリプトプロパティを優先キー順で読む（YOUR_* プレースホルダは無視） */
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

function getWebhookSheetId_() {
  if (__webhookSheetIdMemo_ !== undefined) return __webhookSheetIdMemo_;
  if (__webhookSheetIdRuntimeOverride_) {
    __webhookSheetIdMemo_ = __webhookSheetIdRuntimeOverride_;
    return __webhookSheetIdMemo_;
  }
  var sheetId = readScriptPropertyFromKeyList_(LINE_SCRIPT_PROPS.SHEET_ID);
  if (sheetId) {
    __webhookSheetIdMemo_ = sheetId;
    return __webhookSheetIdMemo_;
  }
  var c = String(WEBHOOK_CONFIG.SHEET_ID || '').trim();
  if (c && c !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(c)) {
    __webhookSheetIdMemo_ = c;
    return __webhookSheetIdMemo_;
  }
  __webhookSheetIdMemo_ = '';
  return __webhookSheetIdMemo_;
}

/** Webhook 用スプレッドシートを開く（SHEET_ID 未設定・権限エラー時は分かりやすい例外） */
function openWebhookSpreadsheet_() {
  var id = getWebhookSheetId_();
  if (!id) {
    throw new Error(
      'SHEET_ID が未設定です。GAS「プロジェクトの設定」→「スクリプトプロパティ」に SHEET_ID（スプレッドシートのID文字列）を登録してください。'
    );
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      'スプレッドシートを開けません。SHEET_ID が正しいか、このGASを「デプロイしたGoogleアカウント」に表の編集権限があるか確認してください。 ' +
        String(e.message || e)
    );
  }
}

/** 同一 webhook イベント内で SpreadsheetApp.openById を繰り返さない */
var __webhookSsCache_ = null;

function getWebhookSpreadsheetCached_() {
  if (__webhookSsCache_) return __webhookSsCache_;
  __webhookSsCache_ = openWebhookSpreadsheet_();
  return __webhookSsCache_;
}

/** 先頭シート（店舗マスタ）の getValues キャッシュ。座標更新後は無効化 */
var __webhookMasterGridMemo_ = undefined;

function invalidateMasterGridCache_() {
  __webhookMasterGridMemo_ = undefined;
}

function getMasterSheetGridCached_() {
  if (__webhookMasterGridMemo_ !== undefined) return __webhookMasterGridMemo_;
  var ss = getWebhookSpreadsheetCached_();
  var sheet = ss.getSheets()[0];
  __webhookMasterGridMemo_ = sheet.getDataRange().getValues();
  return __webhookMasterGridMemo_;
}

/** pending_posts の読み取りキャッシュ。シート更新後は無効化 */
var __webhookPendingRows_ = undefined;

function invalidatePendingRowsCache_() {
  __webhookPendingRows_ = undefined;
}

function ensurePendingRowsLoaded_() {
  if (__webhookPendingRows_ !== undefined) return;
  var sheet = getPendingSheet(false);
  if (!sheet) {
    __webhookPendingRows_ = null;
    return;
  }
  __webhookPendingRows_ = sheet.getDataRange().getValues();
}

/** シートの userId 列と LINE の userId を安全に比較する（前後空白のゆれ対策） */
function normalizeWebhookUserIdForSheet_(userId) {
  return String(userId == null ? '' : userId).trim();
}

function sheetRowUserIdMatches_(cellVal, userId) {
  return normalizeWebhookUserIdForSheet_(cellVal) === normalizeWebhookUserIdForSheet_(userId);
}

/**
 * LINE チャネルアクセストークン。
 * 優先: スクリプトプロパティ（LINE_CHANNEL_ACCESS_TOKEN / YOUR_LINE_CHANNEL_ACCESS_TOKEN）→ WEBHOOK_CONFIG
 */
var __webhookLineTokenMemo_ = undefined;

function getWebhookLineToken_() {
  if (__webhookLineTokenMemo_ !== undefined) return __webhookLineTokenMemo_;
  var token = readScriptPropertyFromKeyList_(LINE_SCRIPT_PROPS.LINE_TOKEN);
  if (token) {
    __webhookLineTokenMemo_ = token;
    return __webhookLineTokenMemo_;
  }
  var c = String(WEBHOOK_CONFIG.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (c && c !== 'YOUR_LINE_CHANNEL_ACCESS_TOKEN' && !/^YOUR_/i.test(c)) {
    __webhookLineTokenMemo_ = c;
    return __webhookLineTokenMemo_;
  }
  __webhookLineTokenMemo_ = '';
  return __webhookLineTokenMemo_;
}

/** 管理者 LINE ユーザー ID（スクリプトプロパティ ADMIN_LINE_USER_ID） */
var __webhookAdminIdMemo_ = undefined;

function getAdminLineUserId_() {
  if (__webhookAdminIdMemo_ !== undefined) return __webhookAdminIdMemo_;
  var p = PropertiesService.getScriptProperties().getProperty(LINE_SCRIPT_PROPS.ADMIN_USER);
  __webhookAdminIdMemo_ = p != null ? String(p).trim() : '';
  return __webhookAdminIdMemo_;
}

/** 店舗・協力者登録用パスワード（スクリプトプロパティ REGISTRATION_PASSWORD。空なら店舗登録はパスワード不要） */
var __webhookRegPwMemo_ = undefined;

function getRegistrationPassword_() {
  if (__webhookRegPwMemo_ !== undefined) return __webhookRegPwMemo_;
  var p = PropertiesService.getScriptProperties().getProperty(LINE_SCRIPT_PROPS.REG_PASSWORD);
  __webhookRegPwMemo_ = p != null ? String(p).trim() : '';
  return __webhookRegPwMemo_;
}

/** 1行目=タイトル(14字以内)、2行目以降=本文(50字以内) */
function splitTitleAndBody_(text) {
  const raw = String(text == null ? '' : text);
  const lines = raw.split(/\r?\n/);
  const title = lines[0].substring(0, MAX_TITLE_LENGTH).trim();
  const body = lines.slice(1).join('\n').substring(0, MAX_MESSAGE_LENGTH).trim();
  return { title: title, body: body };
}

const STEP_IDLE = 'idle';
const STEP_AWAITING_CONTENT = 'awaiting_content';
const STEP_AWAITING_CATEGORY = 'awaiting_category';
/** 未登録向け: 「登録 店舗」またはキーワード「店／店舗」直後の、店舗名1通（ワンショット「店　名前」も可） */
const STEP_AWAITING_REGISTER_STORE_ID = 'awaiting_register_store_id';
const STEP_AWAITING_STORE_LOCATION   = 'awaiting_store_location';
/** 「登録 〇〇」のあと、スクリプトプロパティの登録パスワードを別メッセージで受け取る */
const STEP_AWAITING_REGISTRATION_PASSWORD = 'awaiting_registration_password';

/** 投稿は消さない方針。expiresAt はシート互換のため遠い未来を入れる */
const POST_RETENTION_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function getPostExpiresAt_(createdAt) {
  return new Date(createdAt.getTime() + POST_RETENTION_MS);
}

const SOURCE_FIXED = 'fixed';
const SOURCE_SELECTED = 'selected';
const SOURCE_GPS = 'gps';

/** 「店」または「店舗」のあとに半角／全角スペース＋店舗名が続く1通（登録用） */
const STORE_REG_ONE_SHOT_SHOP_RE_ = /^店[\s\u3000]+\S/;
const STORE_REG_ONE_SHOT_TENPO_RE_ = /^店舗[\s\u3000]+\S/;
const STORE_REG_PREFIX_TENPO_RE_ = /^店舗[\s\u3000]+/;
const STORE_REG_PREFIX_SHOP_RE_ = /^店[\s\u3000]+/;

function isStoreRegistrationOneShot_(text) {
  return STORE_REG_ONE_SHOT_SHOP_RE_.test(text) || STORE_REG_ONE_SHOT_TENPO_RE_.test(text);
}

function stripStoreRegistrationPrefix_(text) {
  return String(text).trim().replace(STORE_REG_PREFIX_TENPO_RE_, '').replace(STORE_REG_PREFIX_SHOP_RE_, '');
}

/** 「登録」とだけ送られたときのトリム（前後の空白・全角スペース・BOM） */
function normalizeRegisterMenuTrigger_(text) {
  return String(text).replace(/^[\s\u3000\uFEFF]+|[\s\u3000\uFEFF]+$/g, '');
}

/** LINE 返信文言（登録フローで同一文面を共有） */
const MSG_LINE_REGISTRATION_PASSWORD_NEXT_ =
  '🔒 続けて登録パスワードをそのまま1通だけ送ってください。\n（やめるときは「登録解除」）';
const MSG_LINE_CONTRIBUTOR_REGISTRATION_SUSPENDED_ =
  '⚠️ 協力者登録は現在受け付けていません。「登録 店舗」からお店として登録してください。';
const MSG_LINE_LEGACY_ROLE_SUSPENDED_ =
  '⚠️ このロールは現在ご利用いただけません。「登録解除」後「登録 店舗」から再度登録してください。';

/** 店舗登録: メニュー「店舗」またはキーワード「店／店舗」のあと、店舗名だけを促す */
const MSG_LINE_STORE_AWAITING_NAME_AFTER_SHOP_ONLY_ =
  '店舗登録です。\n次のメッセージで**店舗名だけ**を1通で送ってください（マップの店舗一覧と同じ表記）。\n例：風まち';

const MSG_LINE_REGISTER_MENU_BODY_ =
  '店舗登録です👇\n' +
  '「店舗」ボタンのあと、マップの店舗一覧と同じ店舗名を1通で送ってください。';

const MSG_LINE_STORE_REGISTRATION_PW_MISMATCH_ =
  '🔒 登録パスワードが違います。\n店舗名を送ったうえで、別のメッセージでパスワードだけを送ってください。';

/** buildHelpMessage の登録欄（「登録」と送る〜の続き） */
const MSG_LINE_HELP_REGISTER_STORE_HINT_ =
  '・「登録」→ 店舗ボタン → 店舗名1通（例：風まち）\n' +
  '・省略: 「店　風まち」 / 「店舗　風まち」 / 「登録 店舗 風まち」\n\n';

function buildMsgLineRegisteredStoreOk_(storeId) {
  return (
    `✅ 店舗として登録しました（${storeId}）\n\n` +
    `次に📍お店の位置情報を送ってください。\n` +
    `LINEの入力欄「＋」→「位置情報」から現在地またはお店の場所を送ると座標が自動登録されます。\n\n` +
    `後で送り直す場合も同じ手順でOKです。`
  );
}

/** 店舗 store_id の比較用（日本語可・連続空白を1つに） */
function normalizeStoreKeyForWebhook_(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim();
}

/** 1 引数 insertSheet は先頭挿入になり gviz の先頭シート（店舗マスタ）がずれるため末尾に追加する */
function insertSheetAtEnd_(ss, name) {
  const n = ss.getSheets().length;
  return ss.insertSheet(name, n + 1);
}

/** LINE Webhook の位置メッセージから緯度経度を取り出す（キー表記のゆれ対策） */
function readLineLocationLatLng_(msg) {
  if (!msg || typeof msg !== 'object') return { lat: null, lng: null };
  var lat = msg.latitude != null ? msg.latitude : msg.lat;
  var lng = msg.longitude != null ? msg.longitude : msg.lng;
  if ((lat == null || lng == null) && msg.coordinates && typeof msg.coordinates === 'object') {
    lat = msg.coordinates.latitude != null ? msg.coordinates.latitude : msg.coordinates.lat;
    lng = msg.coordinates.longitude != null ? msg.coordinates.longitude : msg.coordinates.lng;
  }
  return { lat: lat, lng: lng };
}

/**
 * 「実行数」の詳細に残りやすいよう Logger にも出す（console のみだと未表示・取得遅延のことがある）
 */
function webhookExecLog_(message) {
  try {
    Logger.log(message);
  } catch (e) {}
  try {
    console.info(message);
  } catch (e2) {}
}

function webhookExecErr_(message) {
  try {
    Logger.log(message);
  } catch (e) {}
  try {
    console.error(message);
  } catch (e2) {}
}

/** 1 メッセージイベントごとにリセット。同一実行内のシート再読み取りを減らす */
var __webhookReqStartMs_ = 0;
/** undefined=未読込 null=シートなし それ以外=getValues の配列 */
var __webhookUserMapRows_ = undefined;
var __webhookBotSessionRows_ = undefined;

function resetWebhookRequestCache_() {
  __webhookUserMapRows_ = undefined;
  __webhookBotSessionRows_ = undefined;
  __webhookSsCache_ = null;
  __webhookSheetIdMemo_ = undefined;
  __webhookLineTokenMemo_ = undefined;
  __webhookRegPwMemo_ = undefined;
  __webhookAdminIdMemo_ = undefined;
  __webhookMasterGridMemo_ = undefined;
  __webhookPendingRows_ = undefined;
}

/** doPost 内・イベント処理の最初で呼ぶ（計測開始とメモリキャッシュ初期化） */
function beginWebhookEventTiming_() {
  __webhookReqStartMs_ = Date.now();
  resetWebhookRequestCache_();
}

/** LINE Messaging API 呼び出し直前の経過 ms。GAS の実行ログで `[timing] ms_until_line_api=` を検索し、デプロイ前後で同一操作を比較する（ch=reply / reply_multi / push）。 */
function logTimingUntilLineApi_(channel) {
  if (!__webhookReqStartMs_) return;
  webhookExecLog_('[timing] ms_until_line_api=' + (Date.now() - __webhookReqStartMs_) + ' ch=' + channel);
}

function invalidateUserMapCache_() {
  __webhookUserMapRows_ = undefined;
}

function ensureUserMapRows_() {
  if (__webhookUserMapRows_ !== undefined) return;
  const sheet = getUserMapSheet(false);
  if (!sheet) {
    __webhookUserMapRows_ = null;
    return;
  }
  __webhookUserMapRows_ = sheet.getDataRange().getValues();
}

function invalidateBotSessionCache_() {
  __webhookBotSessionRows_ = undefined;
}

function ensureBotSessionRows_() {
  if (__webhookBotSessionRows_ !== undefined) return;
  const sheet = getBotSessionSheet(false);
  if (!sheet) {
    __webhookBotSessionRows_ = null;
    return;
  }
  __webhookBotSessionRows_ = sheet.getDataRange().getValues();
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const events = body.events || [];

    events.forEach(event => {
      if (event.type !== 'message') return;

      // 位置→すぐテキストなどの並列Webhookでセッションがずれるのを抑えるため直列化する。
      // waitLock がタイムアウトすると例外で全体が落ち LINE に一切返せなくなるので、失敗時はロックなしで続行する。
      const lock = LockService.getScriptLock();
      var lockHeld = false;
      try {
        lock.waitLock(10000);
        lockHeld = true;
      } catch (lockErr) {
        webhookExecErr_('[doPost] LockService.waitLock ' + String(lockErr && lockErr.message ? lockErr.message : lockErr));
      }
      try {
        beginWebhookEventTiming_();
        const userId = event.source?.userId;
        const replyToken = event.replyToken;
        const msg = event.message;

        if (!msg) {
          if (replyToken) {
            replyText(replyToken, '⚠️ メッセージ本文を取得できませんでした。もう一度お試しください。');
          }
          return;
        }
        if (!userId) {
          if (replyToken) {
            replyText(
              replyToken,
              '⚠️ ユーザー情報を取得できませんでした。\n' +
                '・公式アカウントとの「1対1」のトークで試してください\n' +
                '・グループ利用時は、送信者の userId が届かない設定だと利用できません'
            );
          }
          return;
        }

        const msgType = String(msg.type || '').toLowerCase();
        if (msgType === 'text') {
          handleTextIncoming(userId, replyToken, String(msg.text || '').trim());
          return;
        }
        if (msgType === 'image') {
          handleImageIncoming(userId, replyToken, msg.id);
          return;
        }
        if (msgType === 'location') {
          const ll = readLineLocationLatLng_(msg);
          webhookExecLog_(
            '[webhook] location ' +
              JSON.stringify({
                userPrefix: String(userId).slice(0, 10),
                lat: ll.lat,
                lng: ll.lng
              })
          );
          handleLocationIncoming(userId, replyToken, ll.lat, ll.lng);
          return;
        }

        if (replyToken) {
          replyText(
            replyToken,
            '⚠️ このメッセージ形式には未対応です（type: ' +
              String(msg.type || '?') +
              '）。\n協力者の投稿の流れ: 「＋」→📍位置情報 → 短文テキスト → 📸写真 → カテゴリです。'
          );
        }
      } catch (innerErr) {
        webhookExecErr_('[doPost] event handler ' + String(innerErr && innerErr.message ? innerErr.message : innerErr));
        try {
          const rt = event.replyToken;
          if (rt) {
            replyText(rt, '⚠️ 処理中にエラーが発生しました。しばらくしてからもう一度お試しください。');
          }
        } catch (replyErr) {
          webhookExecErr_('[doPost] error reply ' + String(replyErr && replyErr.message ? replyErr.message : replyErr));
        }
      } finally {
        if (lockHeld) {
          try {
            lock.releaseLock();
          } catch (e) {
            /* ignore */
          }
        }
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    webhookExecErr_('[doPost] ' + String(err && err.message ? err.message : err));
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'posts') {
    const data = getPostsForApi_();
    const callback = e.parameter.callback;
    const json = JSON.stringify(data);
    const out = callback ? `${callback}(${json})` : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

// ==================================================================
// ルーティング
// ==================================================================

/** 店舗ロール登録: 「店」単体→続けの1通で「店」+空白+店舗名を促す */
function beginStoreRegistrationFlow_(userId, replyToken) {
  const uEarly = getUserRecord(userId);
  if (uEarly && uEarly.isActive !== false) {
    replyText(replyToken, 'すでに登録済みです。「登録確認」でロールを確認できます。');
    return;
  }
  setSession(userId, STEP_AWAITING_REGISTER_STORE_ID, {});
  replyText(replyToken, MSG_LINE_STORE_AWAITING_NAME_AFTER_SHOP_ONLY_);
}

function handleTextIncoming(userId, replyToken, text) {
  if (!text) return;

  if (/^マイID$/i.test(text) || /^my\s*id$/i.test(text)) {
    replyText(replyToken, buildMyIdMessage(userId));
    return;
  }
  if (/^ヘルプ$/.test(text) || /^help$/i.test(text)) {
    replyText(replyToken, buildHelpMessage(userId));
    return;
  }
  if (isStoreRegistrationOneShot_(text)) {
    const rest = stripStoreRegistrationPrefix_(text);
    handleRegisterCommand(userId, replyToken, '登録 ' + rest);
    return;
  }
  if (/^(店|店舗)$/.test(text)) {
    beginStoreRegistrationFlow_(userId, replyToken);
    return;
  }
  // 「登録〇〇」より先に完全一致だけ処理する（/^登録/ に「登録確認」「登録解除」が吸われると登録フローに入ってしまう）
  if (/^登録確認$/.test(text)) {
    handleCheckCommand(userId, replyToken);
    return;
  }
  if (/^登録解除$/.test(text)) {
    handleUnregisterCommand(userId, replyToken);
    return;
  }

  const sessRegFlow = getSession(userId);
  if (sessRegFlow.step === STEP_AWAITING_REGISTER_STORE_ID) {
    handleRegisterCommand(userId, replyToken, '登録 ' + text.trim());
    return;
  }
  if (sessRegFlow.step === STEP_AWAITING_REGISTRATION_PASSWORD) {
    handleRegistrationPasswordReply(userId, replyToken, text);
    return;
  }

  const registerMenuNorm = normalizeRegisterMenuTrigger_(text);
  if (registerMenuNorm === '登録') {
    replyWithRegisterQuickReply(replyToken);
    return;
  }

  if (/^登録/.test(text)) {
    handleRegisterCommand(userId, replyToken, text);
    return;
  }

  const adminLineUserId = getAdminLineUserId_();
  if (adminLineUserId && userId === adminLineUserId) {
    if (/^ユーザー一覧$/.test(text)) {
      handleAdminListCommand(replyToken);
      return;
    }
    if (/^削除\s+\S+$/.test(text)) {
      const targetId = text.split(/\s+/)[1];
      handleAdminDeleteCommand(replyToken, targetId);
      return;
    }
    if (/^テスト投稿$/.test(text)) {
      handleAdminTestPost(replyToken, userId);
      return;
    }
  }

  const user = getUserRecord(userId);
  if (!user || user.isActive === false) {
    replyText(replyToken, buildUnknownUserMessage(userId));
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG_LINE_LEGACY_ROLE_SUSPENDED_);
    return;
  }

  flushExpiredPending();

  const sess = getSession(userId);

  if (user.role === ROLE_STORE) {
    if (
      sess.step === STEP_AWAITING_CONTENT &&
      sess.payload.lat != null &&
      sess.payload.lng != null
    ) {
      handleContributorContentText(userId, replyToken, user, text);
      return;
    }
    handleStoreContentText(userId, replyToken, user, text);
  }
}

function handleImageIncoming(userId, replyToken, messageId) {
  // 画像受信時は現在のユーザーの pending を先に使うため、自分自身をフラッシュ対象から除く
  flushExpiredPending(userId);

  const user = getUserRecord(userId);
  if (!user || user.isActive === false) {
    replyText(replyToken, buildUnknownUserMessage(userId));
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG_LINE_LEGACY_ROLE_SUSPENDED_);
    return;
  }

  const sessImg = getSession(userId);
  const inGpsContentFlow =
    sessImg.payload.lat != null &&
    sessImg.payload.lng != null &&
    (user.role === ROLE_CONTRIBUTOR ||
      (user.role === ROLE_STORE && sessImg.step === STEP_AWAITING_CONTENT));

  if (user.role === ROLE_CONTRIBUTOR || inGpsContentFlow) {
    const sess = getSession(userId);
    if (sess.payload.lat == null || sess.payload.lng == null) {
      replyText(
        replyToken,
        '先に📍位置情報メッセージを送ってください。\n「位置を受け取りました」のあとは【順番: 短文テキスト→📸写真→カテゴリ】です。'
      );
      return;
    }
    handleContributorImage(userId, replyToken, user, messageId);
    return;
  }

  let imageUrl;
  try {
    imageUrl = fetchLineImageToDrive(messageId);
  } catch (err) {
    console.error('[handleImageIncoming]', err);
    replyText(replyToken, '⚠️ 画像の取得に失敗しました。もう一度お試しください。');
    return;
  }

  if (user.role === ROLE_STORE) {
    const pendingForImg = loadPending(userId);
    if (pendingForImg && pendingForImg.message) {
      // テキストが先に届いていた → 通常のマージフロー
      mergeImageWithPendingThenFinalize(userId, replyToken, user, imageUrl);
    } else if (pendingForImg && pendingForImg.imageUrl) {
      // すでに画像pending あり → 上書き保存して続行
      savePending(userId, user.fixedStoreId || '', '', imageUrl);
      replyText(replyToken,
        `📸 写真を更新しました。（順番: テキスト→写真）テキストを送るとセットで反映されます（${PENDING_EXPIRE_MS / 60000}分以内）\nテキスト不要ならそのまま待つと自動でマップに反映されます。`);
    } else {
      // 画像が先に届いた → imageUrl を pending に保存してテキストを待つ
      savePending(userId, user.fixedStoreId || '', '', imageUrl);
      replyText(replyToken,
        `📸 写真を受け付けました。（順番: テキスト→写真）テキストを送るとセットで反映されます（${PENDING_EXPIRE_MS / 60000}分以内）\nテキスト不要ならそのまま待つと自動でマップに反映されます。`);
    }
  }
}

function handleLocationIncoming(userId, replyToken, lat, lng) {
  try {
    const latNum = lat != null && lat !== '' ? Number(lat) : NaN;
    const lngNum = lng != null && lng !== '' ? Number(lng) : NaN;
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      replyText(
        replyToken,
        '⚠️ 位置を認識できませんでした。\n' +
          'LINEの入力欄「＋」→「位置情報」から送る📍付きの「位置情報」メッセージにしてください。\n' +
          '（地図アプリのURL・住所の文字だけでは届きません）'
      );
      return;
    }

    const user = getUserRecord(userId);
    if (!user || user.isActive === false) {
      replyText(replyToken, buildUnknownUserMessage(userId));
      return;
    }

    // 店舗登録直後の座標設定フロー
    const sessLoc = getSession(userId);
    if (sessLoc.step === STEP_AWAITING_STORE_LOCATION) {
      const storeId = (sessLoc.payload && sessLoc.payload.storeId) ? sessLoc.payload.storeId : (user.fixedStoreId || '');
      saveStoreCoordsToMaster(storeId, latNum, lngNum);
      deleteSession(userId);
      replyText(replyToken,
        `📍 位置情報を登録しました（${storeId}）\n` +
        `これでライブ投稿が可能になりました🎉\n\n` +
        `投稿の順番: テキスト→📸写真 です。\n` +
        `テキストは1行目=タイトル(14字)、2行目以降=本文(50字)\n` +
        `お店から離れた場所から投稿するときは、先に📍位置情報を送ってから、同じ順番でお願いします。`);
      return;
    }

    if (user.role !== ROLE_STORE) {
      replyText(replyToken, '位置情報投稿は「店舗」登録のアカウントで使えます。');
      return;
    }
    // 位置付き投稿は「テキスト→写真」の順に統一するため、古い pending が残らないようクリアする
    deletePending(userId);
    setSession(userId, STEP_AWAITING_CONTENT, {
      text: '', imageUrl: '', lat: latNum, lng: lngNum, spotId: '', spotName: ''
    });
    webhookExecLog_(
      '[loc] bot_sessions saved ok ' +
        JSON.stringify({
          userPrefix: normalizeWebhookUserIdForSheet_(userId).slice(0, 10),
          lat: latNum,
          lng: lngNum,
          role: user.role
        })
    );
    const tail =
      user.role === ROLE_STORE
        ? '\n（店舗の移動中の投稿としてマップに表示されます）'
        : '';
    replyText(
      replyToken,
      '📍位置を受け取りました。\n【順番】①テキスト（1行目=タイトル14字、2行目以降=本文50字）→②📸写真\n写真だけ先に送ると正しく処理できません。' +
        tail
    );
  } catch (err) {
    var detail = String(err.message || err);
    webhookExecErr_('[handleLocationIncoming] ' + detail);
    replyText(
      replyToken,
      '⚠️ 位置の保存に失敗しました（スプレッドシートへ書き込めませんでした）。\n\n' +
        '管理者は次を確認してください:\n' +
        '・GAS「プロジェクトの設定」→「スクリプトプロパティ」に **SHEET_ID** があるか（**新デプロイ後も**同じプロジェクトか）\n' +
        '・その表を、**ウェブアプリをデプロイしたGoogleアカウント**に「編集者」で共有しているか\n' +
        '・**bot_sessions** シートが保護されておらず、A〜D列に書けるか\n' +
        '・GASの「実行数」でこのリクエストのログに表示されたエラー内容'
    );
  }
}

// ==================================================================
// 店舗: テキスト→保留 / 画像でマージ→カテゴリ
// ==================================================================

function handleStoreContentText(userId, replyToken, user, text) {
  const s0 = getSession(userId);
  if (s0.payload.lat != null && s0.payload.lng != null) {
    deleteSession(userId);
  }
  const rawText = text.substring(0, MAX_TITLE_LENGTH + 1 + MAX_MESSAGE_LENGTH);

  // 画像が先に届いていた場合はテキストを合わせて即確定
  const pendingImg = loadPending(userId);
  if (pendingImg && pendingImg.imageUrl) {
    deletePending(userId);
    const prev = getSession(userId).payload || {};
    proceedToFinalizePost_(userId, replyToken, user, {
      text: rawText,
      imageUrl: pendingImg.imageUrl,
      lat: prev.lat != null ? prev.lat : null,
      lng: prev.lng != null ? prev.lng : null,
      spotId: prev.spotId || '',
      spotName: prev.spotName || ''
    });
    return;
  }

  // テキストを pending に保存して画像を待つ
  savePending(userId, user.fixedStoreId || '', rawText);
  const preview = rawText.split(/\r?\n/)[0].substring(0, 20);
  replyText(replyToken,
    `📝 受け付けました「${preview}」\n【順番: テキスト→写真】続けて📸写真を送ってください（${PENDING_EXPIRE_MS / 60000}分以内）\n写真不要ならそのまま待つと自動でマップに反映されます。`
  );
}

function mergeImageWithPendingThenFinalize(userId, replyToken, user, imageUrl) {
  const pending = loadPendingWithGrace(userId);
  const text = pending ? String(pending.message || '') : '';
  const prev = getSession(userId).payload || {};
  proceedToFinalizePost_(userId, replyToken, user, {
    text,
    imageUrl: imageUrl || '',
    lat: prev.lat != null ? prev.lat : null,
    lng: prev.lng != null ? prev.lng : null,
    spotId: prev.spotId || '',
    spotName: prev.spotName || ''
  });
}

function proceedToFinalizePost_(userId, replyToken, user, payload) {
  setSession(userId, STEP_AWAITING_CATEGORY, payload);
  finalizePostWithCategory(userId, replyToken, user);
}

// ==================================================================
// 協力者: 位置後のみ / テキスト・画像
// ==================================================================

function handleContributorContentText(userId, replyToken, user, text) {
  const sess = getSession(userId);
  if (sess.payload.lat == null || sess.payload.lng == null) {
    replyText(
      replyToken,
      '協力者の投稿は📍位置が先です。\n' +
        '【順番】📍位置情報 → 短文テキスト → 📸写真 → カテゴリ\n' +
        '「📍位置を受け取りました」のあとは、まず短文、そのあと写真を送ってください。\n' +
        '※位置と同時・直後のテキストは届かないことがあります。返信のあとに送ってください。'
    );
    return;
  }
  const truncated = text.substring(0, MAX_MESSAGE_LENGTH).trim();
  if (!truncated) {
    replyText(
      replyToken,
      '位置情報付きの投稿は【順番: 短文テキスト→📸写真】です。\n先に内容のある短文（1文字以上）を送ってから、写真を送ってください。'
    );
    return;
  }
  savePending(userId, '_liv_', truncated);
  replyText(replyToken,
    `📝 受け付けました「${truncated}」\n【順番: テキスト→写真】続けて📸写真を送ってください（${PENDING_EXPIRE_MS / 60000}分以内）`);
}

function handleContributorImage(userId, replyToken, user, messageId) {
  const pendingTxt = loadPending(userId);
  if (!pendingTxt || !String(pendingTxt.message || '').trim()) {
    replyText(
      replyToken,
      '位置情報付きの投稿は【順番: 短文テキスト→📸写真】です。\n短文を先に送ってから写真を送ってください。（写真だけ先に送ると正しく処理できません）'
    );
    return;
  }
  let imageUrl;
  try {
    imageUrl = fetchLineImageToDrive(messageId);
  } catch (err) {
    replyText(replyToken, '⚠️ 画像取得に失敗しました。');
    return;
  }

  mergeImageWithPendingThenFinalize(userId, replyToken, user, imageUrl);
}

// ==================================================================
// 投稿確定
// ==================================================================

function finalizePostWithCategory(userId, replyToken, user) {
  if (user.role !== ROLE_STORE) {
    if (replyToken !== 'PUSH') replyText(replyToken, MSG_LINE_LEGACY_ROLE_SUSPENDED_);
    deleteSession(userId);
    deletePending(userId);
    return;
  }
  const sess = getSession(userId);
  if (sess.step !== STEP_AWAITING_CATEGORY) {
    replyText(replyToken, 'カテゴリ選択のタイミングではありません。投稿を送り直してください。');
    return;
  }
  const { text, imageUrl, lat, lng, spotId, spotName } = sess.payload;
  const split = splitTitleAndBody_(text || '');
  const title = split.title;
  const body = split.body;
  if (!title && !body && !imageUrl) {
    replyText(replyToken, 'タイトル・本文か画像がありません。最初から送り直してください。');
    deleteSession(userId);
    return;
  }

  let sourceType;
  let finalLat = lat;
  let finalLng = lng;
  let storeId = '';

  if (user.role === ROLE_STORE) {
    storeId = user.fixedStoreId || '';
    const latNum = lat != null ? Number(lat) : NaN;
    const lngNum = lng != null ? Number(lng) : NaN;
    const hasGps = !isNaN(latNum) && !isNaN(lngNum);
    if (hasGps) {
      sourceType = SOURCE_GPS;
      finalLat = latNum;
      finalLng = lngNum;
    } else {
      sourceType = SOURCE_FIXED;
      const c = getStoreCoordsFromMaster(storeId);
      if (!c) {
        replyText(replyToken, `店舗座標が見つかりません（店舗名: ${storeId}）。管理者に確認してください。`);
        deleteSession(userId);
        return;
      }
      finalLat = c.lat;
      finalLng = c.lng;
    }
  } else {
    sourceType = SOURCE_GPS;
    storeId = user.fixedStoreId || '';
    if (finalLat == null || finalLng == null) {
      if (replyToken !== 'PUSH') replyText(replyToken, '位置情報がありません。');
      deleteSession(userId);
      return;
    }
  }

  const postId = Utilities.getUuid();
  const createdAt = new Date();

  appendPostRow({
    postId, userId, role: user.role, sourceType,
    title, text: body, imageUrl: imageUrl || '',
    lat: finalLat, lng: finalLng, storeId,
    createdAt, isVisible: true
  });

  deleteSession(userId);
  deletePending(userId);

  let locHint = '';
  if (spotName) locHint = `\n場所:${spotName}`;
  const doneMsg = `✅ マップに反映しました！${locHint}`;
  if (replyToken === 'PUSH') {
    pushText(userId, doneMsg);
  } else {
    replyText(replyToken, doneMsg);
  }
}

// ==================================================================
// posts シート
// ==================================================================

function appendPostRow(row) {
  const ss = getWebhookSpreadsheetCached_();
  let sheet = ss.getSheetByName(POSTS_SHEET_NAME);
  if (!sheet) {
    ensurePostsSheet(ss);
    sheet = ss.getSheetByName(POSTS_SHEET_NAME);
  }

  sheet.appendRow([
    row.postId,
    row.userId,
    row.role,
    row.sourceType,
    row.title || '',
    row.text || '',
    row.imageUrl || '',
    row.lat,
    row.lng,
    row.storeId,
    row.createdAt,
    row.isVisible === false ? false : true
  ]);
}

function ensurePostsSheet(ss) {
  const s = insertSheetAtEnd_(ss, POSTS_SHEET_NAME);
  s.appendRow([
    'postId', 'userId', 'role', 'sourceType', 'title',
    'text', 'imageUrl', 'lat', 'lng', 'storeId',
    'createdAt', 'isVisible'
  ]);
  s.setFrozenRows(1);
  s.getRange('A1:L1').setBackground('#2E7D32').setFontColor('#FFFFFF').setFontWeight('bold');
}

/**
 * WordPress / 外部連携用 JSON（isVisible=TRUE の行のみ、新しい順）
 */
function getPostsForApi_() {
  const ss = getWebhookSpreadsheetCached_();
  const sheet = ss.getSheetByName(POSTS_SHEET_NAME);
  if (!sheet) {
    return { posts: [], updatedAt: new Date().toISOString() };
  }
  const data = sheet.getDataRange().getValues();
  const posts = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const C = LINE_POSTS_COL;
    if (!row[C.POST_ID]) continue;
    const isVisibleRaw = row[C.IS_VISIBLE];
    if (isVisibleRaw === false || String(isVisibleRaw).toUpperCase() === 'FALSE') continue;
    const title = row[C.TITLE] != null ? String(row[C.TITLE]).trim() : '';
    const text = row[C.TEXT] != null ? String(row[C.TEXT]).trim() : '';
    const imageUrl = row[C.IMAGE_URL] != null ? String(row[C.IMAGE_URL]).trim() : '';
    if (!title && !text && !imageUrl) continue;
    const createdAt = row[C.CREATED_AT];
    posts.push({
      postId: String(row[C.POST_ID]),
      userId: row[C.USER_ID] != null ? String(row[C.USER_ID]) : '',
      role: row[C.ROLE] != null ? String(row[C.ROLE]) : '',
      sourceType: row[C.SOURCE_TYPE] != null ? String(row[C.SOURCE_TYPE]) : '',
      title,
      text,
      imageUrl,
      lat: row[C.LAT],
      lng: row[C.LNG],
      storeId: row[C.STORE_ID] != null ? String(row[C.STORE_ID]).trim() : '',
      createdAt: createdAt instanceof Date
        ? createdAt.toISOString()
        : String(createdAt || '')
    });
  }
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { posts, updatedAt: new Date().toISOString() };
}

// ==================================================================
// ユーザーマップ（拡張列）
// userId | role | fixed_store_id | is_active | display_name | registered_at
// ==================================================================

function parseUserRow(row) {
  const C = LINE_USER_MAP_COL;
  if (!row || !row[C.USER_ID]) return null;
  const B = row[C.ROLE];
  const bStr = B != null ? String(B).trim() : '';

  if (KNOWN_ROLE_VALUES.indexOf(bStr) >= 0) {
    const activeCell = row[C.IS_ACTIVE];
    const isActive = activeCell !== false && String(activeCell || 'TRUE').toUpperCase() !== 'FALSE';
    return {
      userId: normalizeWebhookUserIdForSheet_(row[C.USER_ID]),
      role: bStr,
      fixedStoreId: row[C.FIXED_STORE_ID] != null ? String(row[C.FIXED_STORE_ID]).trim() : '',
      isActive,
      displayName: row[C.DISPLAY_NAME] != null ? String(row[C.DISPLAY_NAME]) : '',
      registeredAt: row[C.REGISTERED_AT]
    };
  }

  return {
    userId: normalizeWebhookUserIdForSheet_(row[C.USER_ID]),
    role: ROLE_STORE,
    fixedStoreId: bStr,
    isActive: true,
    displayName: '',
    registeredAt: row[C.FIXED_STORE_ID]
  };
}

function getUserRecord(userId) {
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return null;
  const data = __webhookUserMapRows_;
  for (let i = 1; i < data.length; i++) {
    if (sheetRowUserIdMatches_(data[i][0], userId)) return parseUserRow(data[i]);
  }
  return null;
}

function saveUserRecord(userId, role, fixedStoreId) {
  const sheet = getUserMapSheet(true);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const uid = normalizeWebhookUserIdForSheet_(userId);

  for (let i = 1; i < data.length; i++) {
    if (sheetRowUserIdMatches_(data[i][0], uid)) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[
        role,
        fixedStoreId || '',
        true,
        '',
        now
      ]]);
      invalidateUserMapCache_();
      return;
    }
  }
  sheet.appendRow([uid, role, fixedStoreId || '', true, '', now]);
  invalidateUserMapCache_();
}

function deleteUserFromMap(userId) {
  const sheet = getUserMapSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (sheetRowUserIdMatches_(data[i][0], userId)) {
      sheet.deleteRow(i + 1);
      invalidateUserMapCache_();
      return;
    }
  }
}

function lookupUserIdByFixedStoreId(storeId) {
  const want = normalizeStoreKeyForWebhook_(storeId);
  if (!want) return null;
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return null;
  const data = __webhookUserMapRows_;
  for (let i = 1; i < data.length; i++) {
    const u = parseUserRow(data[i]);
    if (u && u.role === ROLE_STORE && normalizeStoreKeyForWebhook_(u.fixedStoreId) === want) return u.userId;
  }
  return null;
}

function getAllUserMapRows() {
  ensureUserMapRows_();
  if (__webhookUserMapRows_ == null) return [];
  const data = __webhookUserMapRows_;
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const u = parseUserRow(data[i]);
    if (u) {
      rows.push({
        userId: u.userId,
        role: u.role,
        fixedStoreId: u.fixedStoreId,
        registeredAt: u.registeredAt
          ? Utilities.formatDate(new Date(u.registeredAt), 'Asia/Tokyo', 'MM/dd HH:mm')
          : '不明'
      });
    }
  }
  return rows;
}

function getUserMapSheet(createIfMissing) {
  const ss = getWebhookSpreadsheetCached_();
  let sheet = ss.getSheetByName(USER_MAP_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, USER_MAP_SHEET_NAME);
    sheet.appendRow(['userId', 'role', 'fixed_store_id', 'is_active', 'display_name', 'registered_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:F1').setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// bot_sessions: userId | step | payload_json | updated_at
// ==================================================================

function getSession(userId) {
  ensureBotSessionRows_();
  if (__webhookBotSessionRows_ == null) {
    return { step: STEP_IDLE, payload: {} };
  }
  const data = __webhookBotSessionRows_;
  for (let i = 1; i < data.length; i++) {
    if (!sheetRowUserIdMatches_(data[i][0], userId)) continue;
    let payload = {};
    try {
      payload = data[i][2] ? JSON.parse(String(data[i][2])) : {};
    } catch (e) {
      payload = {};
    }
    return { step: String(data[i][1] || STEP_IDLE), payload };
  }
  return { step: STEP_IDLE, payload: {} };
}

function setSession(userId, step, payload) {
  const sheet = getBotSessionSheet(true);
  const data = sheet.getDataRange().getValues();
  const json = JSON.stringify(payload || {});
  const now = new Date();
  const uid = normalizeWebhookUserIdForSheet_(userId);

  for (let i = 1; i < data.length; i++) {
    if (sheetRowUserIdMatches_(data[i][0], uid)) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[step, json, now]]);
      invalidateBotSessionCache_();
      return;
    }
  }
  sheet.appendRow([uid, step, json, now]);
  invalidateBotSessionCache_();
}

function deleteSession(userId) {
  const sheet = getBotSessionSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (sheetRowUserIdMatches_(data[i][0], userId)) {
      sheet.deleteRow(i + 1);
      invalidateBotSessionCache_();
      return;
    }
  }
}

function getBotSessionSheet(createIfMissing) {
  const ss = getWebhookSpreadsheetCached_();
  let sheet = ss.getSheetByName(BOT_SESSIONS_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, BOT_SESSIONS_SHEET_NAME);
    sheet.appendRow(['userId', 'step', 'payload_json', 'updated_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:D1').setBackground('#6A1B9A').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// マスター座標（先頭シート = gviz 既定と同一）
// ==================================================================

function getStoreCoordsFromMaster(storeId) {
  const data = getMasterSheetGridCached_();
  const sidWant = normalizeStoreKeyForWebhook_(storeId);

  for (let i = 1; i < data.length; i++) {
    const sid = data[i][MASTER_COL_STORE_ID];
    if (sid != null && normalizeStoreKeyForWebhook_(sid) === sidWant) {
      const lat = data[i][MASTER_COL_LAT];
      const lng = data[i][MASTER_COL_LNG];
      if (lat == null || lng == null) continue;
      return { lat: Number(lat), lng: Number(lng) };
    }
  }
  return null;
}

/**
 * 店舗マスタに storeId の座標を書き込む。
 * 既存行があれば lat/lng 列を更新、なければ最低限の列で行を追加する。
 */
function saveStoreCoordsToMaster(storeId, lat, lng) {
  var ss = getWebhookSpreadsheetCached_();
  var sheet = ss.getSheets()[0];
  var data = getMasterSheetGridCached_();
  var sidWant = normalizeStoreKeyForWebhook_(storeId);

  for (var i = 1; i < data.length; i++) {
    var sid = data[i][MASTER_COL_STORE_ID];
    if (sid != null && normalizeStoreKeyForWebhook_(sid) === sidWant) {
      sheet.getRange(i + 1, MASTER_COL_LAT + 1).setValue(lat);
      sheet.getRange(i + 1, MASTER_COL_LNG + 1).setValue(lng);
      webhookExecLog_('[saveStoreCoordsToMaster] updated row ' + (i + 1) + ' for ' + storeId);
      invalidateMasterGridCache_();
      return;
    }
  }

  // 既存行なし → 新規追加（列数はマスタシートの現在の列数に合わせて空埋め）
  var numCols = Math.max(sheet.getLastColumn(), MASTER_COL_STORE_ID + 1);
  var newRow = new Array(numCols).fill('');
  newRow[MASTER_COL_STORE_ID] = storeId;
  newRow[MASTER_COL_LAT] = lat;
  newRow[MASTER_COL_LNG] = lng;
  // 表示名（name 列）: 新規行では store_id と同じ表記。_reserved(列A)には書かない。
  if (numCols > MASTER_COL_NAME) newRow[MASTER_COL_NAME] = storeId;
  sheet.appendRow(newRow);
  webhookExecLog_('[saveStoreCoordsToMaster] appended new row for ' + storeId);
  invalidateMasterGridCache_();
}

// ==================================================================
// pending_posts
// ==================================================================

/**
 * pending_posts に保存。imageUrl を省略すると既存行の image_url は維持する。
 * message を省略（''）すると既存行の message は維持する。
 */
function savePending(userId, storeKey, message, imageUrl) {
  const uid = normalizeWebhookUserIdForSheet_(userId);
  const sheet = getPendingSheet(true);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (sheetRowUserIdMatches_(data[i][0], uid)) {
      sheet.getRange(i + 1, 2).setValue(storeKey);
      if (message !== undefined && message !== null) sheet.getRange(i + 1, 3).setValue(message);
      sheet.getRange(i + 1, 4).setValue(now);
      if (imageUrl !== undefined && imageUrl !== null) sheet.getRange(i + 1, 5).setValue(imageUrl);
      invalidatePendingRowsCache_();
      return;
    }
  }
  sheet.appendRow([uid, storeKey, message || '', now, imageUrl || '']);
  invalidatePendingRowsCache_();
}

function loadPending(userId) {
  ensurePendingRowsLoaded_();
  if (__webhookPendingRows_ == null) return null;
  const data = __webhookPendingRows_;
  const now = Date.now();
  for (let i = 1; i < data.length; i++) {
    if (!sheetRowUserIdMatches_(data[i][0], userId)) continue;
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (now - savedAt > PENDING_EXPIRE_MS) {
      // 期限切れでも行は残す（flushExpiredPending が別途消す）
      return null;
    }
    return { storeId: data[i][1], message: data[i][2], imageUrl: data[i][4] ? String(data[i][4]) : '' };
  }
  return null;
}

/**
 * 期限切れを考慮してテキストを取り出す（画像到着時のテキスト消失対策）。
 * PENDING_EXPIRE_MS を過ぎていても PENDING_LOAD_GRACE_MS 以内なら返す。
 * 返した場合はその行を削除する。
 */

function loadPendingWithGrace(userId) {
  const sheet = getPendingSheet(false);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const now = Date.now();
  for (let i = 1; i < data.length; i++) {
    if (!sheetRowUserIdMatches_(data[i][0], userId)) continue;
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    const age = now - savedAt;
    if (age > LINE_LIMITS.PENDING_LOAD_GRACE_MS) return null;
    const result = {
      storeId: data[i][1],
      message: data[i][2],
      imageUrl: data[i][4] ? String(data[i][4]) : ''
    };
    sheet.deleteRow(i + 1);
    invalidatePendingRowsCache_();
    return result;
  }
  return null;
}

function deletePending(userId) {
  const sheet = getPendingSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (sheetRowUserIdMatches_(data[i][0], userId)) {
      sheet.deleteRow(i + 1);
      invalidatePendingRowsCache_();
      return;
    }
  }
}

/**
 * 期限切れの pending 行を自動確定して posts に書き込む。
 * excludeUserId を指定した場合、そのユーザーの行はスキップする
 * （画像受信時に自分の pending を先に利用させるため）。
 */
function flushExpiredPending(excludeUserId) {
  invalidatePendingRowsCache_();
  const sheet = getPendingSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const nowMs = Date.now();

  for (let i = data.length - 1; i >= 1; i--) {
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (nowMs - savedAt <= PENDING_EXPIRE_MS) continue;

    const userId = data[i][0];

    if (excludeUserId && sheetRowUserIdMatches_(userId, excludeUserId)) continue;
    const message  = data[i][2] ? String(data[i][2]) : '';
    const imageUrl = data[i][4] ? String(data[i][4]) : '';

    sheet.deleteRow(i + 1);

    if (!message.trim() && !imageUrl) continue;

    const user = getUserRecord(userId);
    if (!user || user.isActive === false || user.role !== ROLE_STORE) continue;

    const sess = getSession(userId);
    if (sess.payload.lat != null && sess.payload.lng != null && !message.trim() && imageUrl) continue;

    const payload = sess.payload.lat != null && sess.payload.lng != null
      ? Object.assign({}, sess.payload, { text: message, imageUrl })
      : {
          text: message, imageUrl, lat: null, lng: null, spotId: '', spotName: '',
          storeId: user.fixedStoreId || ''
        };
    proceedToFinalizePost_(userId, 'PUSH', user, payload);
  }
}

function getPendingSheet(createIfMissing) {
  const ss = getWebhookSpreadsheetCached_();
  let sheet = ss.getSheetByName(PENDING_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, PENDING_SHEET_NAME);
    sheet.appendRow(['userId', 'store_id', 'message', 'saved_at', 'image_url']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:E1').setBackground('#FFA000').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// LINE API
// ==================================================================

function replyText(replyToken, text) {
  if (!replyToken) {
    webhookExecErr_('[replyText] missing replyToken');
    return;
  }
  logTimingUntilLineApi_('reply');
  const payload = { replyToken, messages: [{ type: 'text', text }] };
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  webhookExecLog_('[replyText] LINE reply API http=' + code);
  if (code < 200 || code >= 300) {
    webhookExecErr_('[replyText] http=' + code + ' body=' + res.getContentText().slice(0, 500));
  }
}

function pushText(userId, text) {
  pushMessages(userId, [{ type: 'text', text: text }]);
}

function pushMessages(userId, messages) {
  logTimingUntilLineApi_('push');
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify({ to: userId, messages }),
    muteHttpExceptions: true
  });
}

/** 「登録」時: 店舗ボタン（あと1通で店舗名） */
function buildRegisterQuickReply() {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: '店舗', text: '登録 店舗' } }
    ]
  };
}

function replyWithRegisterQuickReply(replyToken) {
  const qr = buildRegisterQuickReply();
  replyMessages(replyToken, [{ type: 'text', text: MSG_LINE_REGISTER_MENU_BODY_, quickReply: qr }]);
}

function replyMessages(replyToken, messages) {
  if (!replyToken) {
    webhookExecErr_('[replyMessages] missing replyToken');
    return;
  }
  logTimingUntilLineApi_('reply_multi');
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify({ replyToken, messages }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  webhookExecLog_('[replyMessages] LINE reply API http=' + code);
  if (code < 200 || code >= 300) {
    webhookExecErr_('[replyMessages] http=' + code + ' body=' + res.getContentText().slice(0, 500));
  }
}

// ==================================================================
// 登録 / ヘルプ / 管理者
// ==================================================================

function canRegisterSpecialRoles(userId, passwordArg) {
  const adminLineUserId = getAdminLineUserId_();
  if (adminLineUserId && userId === adminLineUserId) return true;
  const regPw = getRegistrationPassword_();
  if (regPw && passwordArg === regPw) return true;
  return false;
}

function handleRegisterCommand(userId, replyToken, text) {
  let t = String(text).trim();
  if (t.startsWith('登録') && t.length > 2 && t.charAt(2) !== ' ' && t.charAt(2) !== '　') {
    t = '登録 ' + t.slice(2);
  }
  const parts = t.split(/\s+/).filter(Boolean);
  const sub = parts[1] ? parts[1].trim() : '';
  const specialPw = parts.slice(2).join(' ') || '';

  if (!sub) {
    replyWithRegisterQuickReply(replyToken);
    return;
  }

  const regPwGlobal = getRegistrationPassword_();

  if (sub === '運営' || sub === 'operator' || sub === '協力' || sub === '協力者' || sub === 'contributor') {
    replyText(replyToken, MSG_LINE_CONTRIBUTOR_REGISTRATION_SUSPENDED_);
    return;
  }

  if (sub === '店舗' || sub === '店') {
    if (parts.length > 2) {
      handleRegisterCommand(userId, replyToken, '登録 ' + parts.slice(2).join(' ').trim());
      return;
    }
    beginStoreRegistrationFlow_(userId, replyToken);
    return;
  }

  const storeIdRaw = sub.replace(/\s+/g, ' ').trim();
  if (!storeIdRaw || storeIdRaw.length > 64) {
    replyText(replyToken, '⚠️ 店舗名が空か長すぎます（64文字まで）。店舗一覧（マスタ）と同じ名前・表記にしてください。');
    return;
  }
  if (/[\r\n\x00]/.test(storeIdRaw)) {
    replyText(replyToken, '⚠️ 改行など使えない文字が含まれます。');
    return;
  }
  const storeId = storeIdRaw;
  const storePw = parts.length > 2 ? parts.slice(2).join(' ') : '';

  const existing = lookupUserIdByFixedStoreId(storeId);
  if (existing && existing !== userId) {
    replyText(replyToken, `⚠️「${storeId}」は別のユーザーが登録済みです。`);
    return;
  }

  if (regPwGlobal) {
    if (!storePw) {
      setSession(userId, STEP_AWAITING_REGISTRATION_PASSWORD, { regKind: 'store', storeId: storeId });
      replyText(replyToken, MSG_LINE_REGISTRATION_PASSWORD_NEXT_);
      return;
    }
    if (storePw !== regPwGlobal) {
      replyText(replyToken, MSG_LINE_STORE_REGISTRATION_PW_MISMATCH_);
      return;
    }
  }

  saveUserRecord(userId, ROLE_STORE, storeId);
  setSession(userId, STEP_AWAITING_STORE_LOCATION, { storeId });

  replyText(replyToken, buildMsgLineRegisteredStoreOk_(storeId));
}

/**
 * STEP_AWAITING_REGISTRATION_PASSWORD の1通目を検証して登録を完了する。
 */
function handleRegistrationPasswordReply(userId, replyToken, passwordText) {
  const sess = getSession(userId);
  if (sess.step !== STEP_AWAITING_REGISTRATION_PASSWORD) return;

  const regPw = getRegistrationPassword_();
  const pw = String(passwordText || '').trim();
  if (!regPw || pw !== regPw) {
    replyText(replyToken, '🔒 登録パスワードが違います。確認してもう一度送るか、「登録解除」でやり直してください。');
    return;
  }

  const kind = sess.payload && sess.payload.regKind;
  if (kind === 'contributor' || kind === 'operator') {
    deleteSession(userId);
    replyText(replyToken, MSG_LINE_CONTRIBUTOR_REGISTRATION_SUSPENDED_);
    return;
  }
  if (kind === 'store') {
    const storeId = sess.payload.storeId != null ? String(sess.payload.storeId).trim() : '';
    if (!storeId) {
      deleteSession(userId);
      replyText(replyToken, '⚠️ 登録セッションが無効です。「登録」からやり直してください。');
      return;
    }
    const existing = lookupUserIdByFixedStoreId(storeId);
    if (existing && existing !== userId) {
      deleteSession(userId);
      replyText(replyToken, `⚠️「${storeId}」は別のユーザーが登録済みです。`);
      return;
    }
    saveUserRecord(userId, ROLE_STORE, storeId);
    setSession(userId, STEP_AWAITING_STORE_LOCATION, { storeId });
    replyText(replyToken, buildMsgLineRegisteredStoreOk_(storeId));
    return;
  }

  deleteSession(userId);
  replyText(replyToken, '⚠️ 登録セッションが無効です。最初からやり直してください。');
}

function handleCheckCommand(userId, replyToken) {
  const u = getUserRecord(userId);
  if (!u) {
    replyText(replyToken, '未登録です。「ヘルプ」で確認してください。');
    return;
  }
  let detail = '';
  if (u.role === ROLE_STORE) detail = `店舗名: ${u.fixedStoreId}`;
  else detail = '（旧ロール・登録解除して店舗として再登録してください）';

  replyText(replyToken,
    `📋 登録状況\nロール:${u.role}\n${detail}\n有効:${u.isActive !== false}`);
}

function handleUnregisterCommand(userId, replyToken) {
  deleteUserFromMap(userId);
  deleteSession(userId);
  deletePending(userId);
  replyText(replyToken, '✅ 登録を解除しました。');
}

function handleAdminListCommand(replyToken) {
  const rows = getAllUserMapRows();
  if (rows.length === 0) {
    replyText(replyToken, '登録ユーザーなし');
    return;
  }
  const lines = rows.map((r, i) =>
    `${i + 1}. ${r.role} ${r.fixedStoreId ? r.fixedStoreId : '-'}\n  ${String(r.userId).slice(0, 12)}...\n  ${r.registeredAt}`
  );
  replyText(replyToken, '登録一覧\n\n' + lines.join('\n\n'));
}

/** store_id（店舗）または LINE userId 先頭一致で削除 */
function handleAdminDeleteCommand(replyToken, target) {
  const byStore = lookupUserIdByFixedStoreId(target);
  if (byStore) {
    deleteUserFromMap(byStore);
    replyText(replyToken, `✅ 削除: store ${target}`);
    return;
  }
  let hit = false;
  getAllUserMapRows().forEach(r => {
    if (String(r.userId).indexOf(target) === 0) {
      deleteUserFromMap(r.userId);
      hit = true;
    }
  });
  replyText(replyToken, hit ? '✅ 該当ユーザーを削除しました' : '見つかりません');
}

function handleAdminTestPost(replyToken, adminUserId) {
  const u = getUserRecord(adminUserId);
  if (!u || u.role !== ROLE_STORE || !u.fixedStoreId) {
    replyText(replyToken, '管理者アカウントが店舗ロールかつ fixed_store_id 付きである必要があります。');
    return;
  }
  const c = getStoreCoordsFromMaster(u.fixedStoreId);
  if (!c) {
    replyText(replyToken, '店舗座標が未取得です');
    return;
  }
  const createdAt = new Date();
  appendPostRow({
    postId: Utilities.getUuid(),
    userId: adminUserId,
    role: ROLE_STORE,
    sourceType: SOURCE_FIXED,
    title: 'テスト投稿',
    text: 'かわら版テスト',
    imageUrl: '',
    lat: c.lat,
    lng: c.lng,
    storeId: u.fixedStoreId,
    createdAt,
    isVisible: true
  });
  replyText(replyToken, '✅ posts にテスト行を書き込みしました');
}

function buildMyIdMessage(userId) {
  const u = getUserRecord(userId);
  let tail = '';
  if (u) {
    tail = `\n登録済: ${u.role}${u.fixedStoreId ? ' / ' + u.fixedStoreId : ''}`;
  } else tail = '\n未登録';

  return `🆔 LINEユーザーID\n\n${userId}${tail}`;
}

function buildUnknownUserMessage(userId) {
  return (
    `👋 未登録です。\nあなたのID:\n${userId}\n\n「ヘルプ」でコマンドを確認し、「登録」から店舗として登録してください。`
  );
}

function buildHelpMessage(userId) {
  const head =
    '📖 コマンド\nマイID / ヘルプ / 登録確認 / 登録解除\n\n' +
    '📍 登録:「登録」と送る\n' +
    MSG_LINE_HELP_REGISTER_STORE_HINT_;

  let flow = '';
  const u = getUserRecord(userId);
  if (!u) {
    flow =
      '🗺️ このあと「登録」から店舗として登録すると投稿できます。\n' +
      'マップモデレーション: posts の isVisible を編集できます。';
  } else if (u.role === ROLE_STORE) {
    flow =
      '📝 かわら版の投稿順番: テキスト→📸写真\n' +
      'テキストは1行目=タイトル(14字以内)、2行目以降=本文(50字以内)\n' +
      '座標はスプレッドシート側のお店情報を使用します。\n' +
      '📍移動中: 📍位置情報→テキスト→📸写真';
  } else {
    flow = MSG_LINE_LEGACY_ROLE_SUSPENDED_;
  }
  return head + flow +
    `\n\nタイトル:${MAX_TITLE_LENGTH}字 / 本文:${MAX_MESSAGE_LENGTH}字まで`;
}

function fetchLineImageToDrive(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('HTTP ' + response.getResponseCode());
  }
  const blob = response.getBlob();
  if (blob.getBytes().length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('サイズ上限超過');
  }
  const folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  const file = folder.createFile(blob.setName(`line_${messageId}_${Date.now()}.jpg`));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w800`;
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ==================================================================
/**
 * gviz 既定は「先頭シート」を読むため、insertSheet 後も店舗マスタが先頭になるよう並べ替える。
 */
function ensureMasterSheetIsGvizFirst_(ss) {
  const master = findMasterSheetForGviz_(ss);
  if (!master) return;
  ss.setActiveSheet(master);
  ss.moveActiveSheet(1);
}

function findMasterSheetForGviz_(ss) {
  const reserved = {};
  Object.keys(LINE_SHEETS).forEach(function (k) { reserved[LINE_SHEETS[k]] = true; });

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (reserved[sh.getName()]) continue;
    if (String(sh.getRange('B1').getValue()) === 'name') return sh;
  }
  const s1 = ss.getSheetByName('Sheet1');
  return s1 || null;
}

/**
 * setupSheets 用: ID がどこにも無ければ、紐づけで開いている表の ID を実行中だけ使う。
 */
function ensureWebhookSheetIdFromActiveIfPlaceholder_() {
  if (getWebhookSheetId_()) return;
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'setupSheets: スクリプトプロパティに SHEET_ID（実 ID）を登録するか、' +
      '紐づけでこのスプレッドシートを開いた状態で実行してください。' +
      ' （開発試験のみ WEBHOOK_CONFIG.SHEET_ID に直書き可）'
    );
  }
  __webhookSheetIdRuntimeOverride_ = active.getId();
  console.log(
    'この実行のためだけスプレッドシート ID をアクティブな表から補完しました。' +
    ' 恒久的にはスクリプトプロパティの SHEET_ID に保存することを推奨します。'
  );
}

function setupSheets() {
  ensureWebhookSheetIdFromActiveIfPlaceholder_();
  const sid = getWebhookSheetId_();
  if (!sid) {
    throw new Error('setupSheets: スプレッドシート ID を取得できませんでした。');
  }
  const ss = SpreadsheetApp.openById(sid);

  getUserMapSheet(true);
  getPendingSheet(true);
  getBotSessionSheet(true);

  if (!ss.getSheetByName(POSTS_SHEET_NAME)) {
    ensurePostsSheet(ss);
    console.log('✅ posts');
  }
  ensureMasterSheetIsGvizFirst_(ss);
  console.log('setupSheets OK');
}

/**
 * GAS エディタから1回実行 → ログ（表示→ログ）にスクリプトプロパティのキー一覧を出す。値はプロジェクトの設定で入力。
 */
function logWebhookScriptPropertyKeys() {
  console.log([
    '=== スクリプトプロパティ（本番の正／ソースに秘密を書かない） ===',
    '[必須] SHEET_ID … /d/〜/edit の間のスプレッドシート ID',
    '[必須] LINE_CHANNEL_ACCESS_TOKEN … LINE 長期チャネルアクセストークン',
    '[任意] ADMIN_LINE_USER_ID … 管理者の LINE userId',
    '[任意] REGISTRATION_PASSWORD … 協力・店舗登録用（空なら店舗登録は無パスワード可）',
    '--- 互換キー（任意・誤記対策） ---',
    'YOUR_GOOGLE_SHEET_ID, YOUR_LINE_CHANNEL_ACCESS_TOKEN',
    '--- 試験用 --- WEBHOOK_CONFIG … ローカル試験のフォールバックのみ。本番は空のまま。'
  ].join('\n'));
}

/**
 * エディタから1回実行。実行ログに接続・設定の可否を出す（秘密は出さない）。
 * LINEで反応がなくてもGASに記録がない場合は、Webhook URL が別デプロイを指している可能性あり。
 */
function runWebhookHealthCheck() {
  var idSet = !!getWebhookSheetId_();
  webhookExecLog_('[health] SHEET_ID スクリプトプロパティ: ' + (idSet ? 'あり' : 'なし'));
  if (!idSet) {
    webhookExecLog_('[health] ここで止まります。プロジェクトの設定 → スクリプトプロパティに SHEET_ID を追加してください。');
    return;
  }
  try {
    var ss = getWebhookSpreadsheetCached_();
    webhookExecLog_('[health] スプレッドシートを開けました: ' + ss.getName());
    var bs = getBotSessionSheet(true);
    webhookExecLog_('[health] bot_sessions 最終行: ' + bs.getLastRow());
  } catch (e) {
    webhookExecErr_('[health] スプレッドシート失敗: ' + String(e.message || e));
    return;
  }
  var tok = getWebhookLineToken_();
  webhookExecLog_('[health] LINE_CHANNEL_ACCESS_TOKEN: ' + (tok ? 'あり（長さ ' + tok.length + '）' : 'なし'));
}

// ==================================================================
// タイムベーストリガー管理
// ==================================================================

/**
 * flushExpiredPending を毎分実行するトリガーを設置する。
 * GAS エディタから手動で1回だけ実行してください。
 * （重複しないよう先に removePendingFlushTrigger を実行してからでも可）
 */
function installPendingFlushTrigger() {
  // 既存の同名トリガーを削除してから追加（重複防止）
  removePendingFlushTrigger();
  ScriptApp.newTrigger('flushExpiredPending')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('flushExpiredPending トリガーを設置しました（毎分）');
}

/**
 * flushExpiredPending のトリガーをすべて削除する。
 */
function removePendingFlushTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'flushExpiredPending'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('flushExpiredPending トリガーを削除しました');
}

function testAppend() {
  appendPostRow({
    postId: Utilities.getUuid(),
    userId: 'TEST',
    role: ROLE_STORE,
    sourceType: SOURCE_FIXED,
    title: 'テスト',
    text: 'かわら版テスト本文',
    imageUrl: '',
    lat: 34.675,
    lng: 138.943,
    storeId: 'test',
    createdAt: new Date(),
    isVisible: true
  });
}
