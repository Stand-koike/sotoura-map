/**
 * ============================================================
 * 下田MAP — 対象シート一括作成 & ダミーデータ投入（GAS）
 * ============================================================
 *
 * 用途: 新規スプレッドシートで「ブラウザ gviz 先頭シート（店舗マスタ）」＋
 *       LINE Webhook 用シート（posts / user_map / …）を揃え、動作確認用の行を入れる。
 *
 * 使い方:
 *   1. Webhook と同一プロジェクト: スクリプトプロパティの SHEET_ID（または YOUR_GOOGLE_SHEET_ID）が最優先で読まれます。
 *   2. ダミー専用プロジェクトのみ: SETUP_SHEET_ID_FALLBACK に実 ID、または同じくスクリプトプロパティでも可。
 *   3. setupAllSheetsWithDummyData を実行（紐づけスクリプトなら表を開いた状態で可）。
 *   4. 表を「リンクを知っている全員が閲覧可」にし、フロントの SHEET_ID と一致させる。
 *
 * 注意:
 *   - ダミー投入は「マスタにデータ行が無いとき」のみ行います（既存行は消しません）。
 *   - posts / venue_spots に既に行がある場合は、ダミー行は追加しません（重複防止）。
 *   - 補助シートはすべて「末尾」に作成します（片引数 insertSheet の先頭挿入で gviz が壊れるのを防ぐ）。
 *   - 万一マスタが先頭でない場合だけ、実行末尾で先頭へ移動します。
 *
 * gas-line-webhook.js と同一 GAS プロジェクトに共存可（定数は SETUP_* で Webhook と同名 const を重複させない）。
 *
 * 合体時は getWebhookSheetId_()（プロパティ→WEBHOOK_CONFIG）が使えればそれを使用。
 */
const SETUP_SHEET_ID_FALLBACK = 'YOUR_GOOGLE_SHEET_ID';

/** webhook の *_SHEET_NAME と同じ値だが、同名 const を二重宣言しないよう 1 オブジェクトにまとめる */
const SETUP_NAMES = {
  POSTS: 'posts',
  VENUE: 'venue_spots',
  BOT: 'bot_sessions',
  USER_MAP: 'user_map',
  PENDING: 'pending_posts'
};

const SETUP_ROLES = {
  STORE: 'store',
  OPERATOR: 'operator',
  CONTRIBUTOR: 'contributor'
};

const SETUP_SOURCE = {
  FIXED: 'fixed',
  SELECTED: 'selected',
  GPS: 'gps'
};

/** docs/samples/spreadsheet-headers.csv と同一（31 列・A=_reserved …） */
const MASTER_HEADERS = [
  '_reserved', 'name', 'lat', 'lng', 'emoji', 'image_url', 'desc', 'category', 'hidden',
  'store_id', 'reserved', 'status', 'news', 'detail', 'coupon',
  'name_en', 'desc_en', 'category_en', 'news_en', 'detail_en', 'coupon_en',
  'address', 'address_en', 'phone', 'phone_en', 'tags', 'tags_en', 'hours', 'hours_en',
  'image_url_2', 'image_url_3'
];

/**
 * メニュー実行用。getWebhookSheetId_ → スクリプトプロパティ → WEBHOOK_CONFIG → SETUP_SHEET_ID_FALLBACK → 開いている表。
 */
function setupAllSheetsWithDummyData() {
  setupAllSheetsWithDummyDataCore_();
}

/** 旧名互換 */
function setupAllSheetsWithDummyData_() {
  setupAllSheetsWithDummyDataCore_();
}

function setupAllSheetsWithDummyDataCore_() {
  const ss = getTargetSpreadsheet_();

  const master = findOrInitMasterSheet_(ss);
  if (master.getLastRow() < 1) {
    master.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  } else {
    const b1 = String(master.getRange('B1').getValue());
    if (b1 !== 'name') {
      master.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
    }
  }
  master.setFrozenRows(1);
  styleHeaderRow_(master, 1, MASTER_HEADERS.length, '#1565C0');

  if (master.getLastRow() <= 1) {
    const dummies = buildDummyMasterRows_();
    // getRange(row, col, numRows, numCols) ※第3引数は「終了行」ではなく行数
    master.getRange(2, 1, dummies.length, MASTER_HEADERS.length).setValues(dummies);
  }

  ensureUserMapSheet_(ss);
  ensurePendingSheet_(ss);
  ensureBotSessionSheet_(ss);
  ensurePostsSheet_(ss);
  ensureVenueSheet_(ss);

  seedDummyPostsIfEmpty_(ss);
  seedDummyVenuesIfEmpty_(ss);

  moveMasterToGvizFirst_(ss, master);

  console.log('setupAllSheetsWithDummyData: OK（マスタを先頭に配置済み）');
}

function getSetupSheetIdFromScriptProperties_() {
  var props = PropertiesService.getScriptProperties();
  var keys = ['SHEET_ID', 'YOUR_GOOGLE_SHEET_ID'];
  for (var i = 0; i < keys.length; i++) {
    var raw = props.getProperty(keys[i]);
    if (!raw) continue;
    var p = String(raw).trim();
    if (p && p !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(p)) return p;
  }
  return '';
}

function getTargetSpreadsheet_() {
  var id = '';
  if (typeof getWebhookSheetId_ === 'function') {
    id = getWebhookSheetId_() || '';
  }
  if (!id) id = getSetupSheetIdFromScriptProperties_();
  if (!id && typeof WEBHOOK_CONFIG !== 'undefined' && WEBHOOK_CONFIG && WEBHOOK_CONFIG.SHEET_ID) {
    var s = String(WEBHOOK_CONFIG.SHEET_ID).trim();
    if (s && s !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(s)) id = s;
  }
  if (!id && SETUP_SHEET_ID_FALLBACK) {
    var f = String(SETUP_SHEET_ID_FALLBACK).trim();
    if (f && f !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(f)) id = f;
  }
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error(
    '対象スプレッドシートを開いて実行するか、スクリプトプロパティに SHEET_ID（実 ID）を設定してください。' +
    ' キー名は SHEET_ID 推奨（YOUR_GOOGLE_SHEET_ID も可）。'
  );
}

/** 予約名以外のシートを末尾に追加（既定の insertSheet は先頭挿入になり gviz 先頭が崩れる） */
function setupInsertSheetAtEnd_(ss, name) {
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  const n = ss.getSheets().length;
  return ss.insertSheet(name, n + 1);
}

function reservedSheetNamesMap_() {
  const reserved = {};
  [
    SETUP_NAMES.USER_MAP, SETUP_NAMES.POSTS, SETUP_NAMES.VENUE,
    SETUP_NAMES.BOT, SETUP_NAMES.PENDING
  ].forEach(function (name) { reserved[name] = true; });
  return reserved;
}

function findOrInitMasterSheet_(ss) {
  const reserved = reservedSheetNamesMap_();
  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (reserved[sh.getName()]) continue;
    if (String(sh.getRange('B1').getValue()) === 'name') return sh;
  }

  const byName = ss.getSheetByName('Sheet1') || ss.getSheetByName('シート1');
  if (byName && !reserved[byName.getName()]) return byName;

  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (!reserved[sh.getName()]) return sh;
  }

  return setupInsertSheetAtEnd_(ss, 'map_master');
}

/**
 * gviz は先頭タブを読む。末尾挿入で通常は既に先頭だが、手動移動後などにずれたときだけ戻す。
 */
function moveMasterToGvizFirst_(ss, sheet) {
  if (!sheet || sheet.getIndex() === 1) return;
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
}

function styleHeaderRow_(sheet, row, numCols, hex) {
  sheet.getRange(row, 1, row, numCols)
    .setBackground(hex)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
}

function buildDummyMasterRows_() {
  const r = function (cells) {
    const out = [];
    for (let i = 0; i < MASTER_HEADERS.length; i++) {
      out.push(i < cells.length ? cells[i] : '');
    }
    return out;
  };
  return [
    r([
      '', 'デモ和菓子屋', 34.6758, 138.9412, '🍡', '',
      '下田MAP動作確認用ダミー', 'グルメ', '', 'demo-001', '',
      '混', '本日開店中のダミー告知', 'テキスト詳細（ダミー）', '',
      'Demo Wagashi', 'Dummy desc', 'Food', 'Dummy news', 'Dummy detail', '',
      '静岡県下田市（ダミー）', 'Shimoda demo', '0558-000-0000', '0558-000-0000',
      '#デモ, #テスト', '#demo', '10:00〜17:00', '10:00–17:00', '', ''
    ]),
    r([
      '', 'デモカフェ', 34.6705, 138.9465, '☕', '',
      '海岸近くのダミー店舗', 'カフェ', '', 'demo-002', '',
      '空き', '', '', '',
      'Demo Cafe', '', 'Cafe', '', '', '',
      '静岡県下田市（ダミー）', '', '', '',
      '#カフェ', '#cafe', '9:00〜18:00', '', '', ''
    ]),
    r([
      '', 'デモ非表示行', 34.6740, 138.9480, '📍', '',
      'hidden=FALSE のときマップ非表示（仕様確認用）', 'スポット', 'FALSE', 'demo-hidden', '',
      '', '', '', '',
      'Hidden demo', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', ''
    ])
  ];
}

function ensureUserMapSheet_(ss) {
  let sheet = ss.getSheetByName(SETUP_NAMES.USER_MAP);
  if (sheet) return;
  sheet = setupInsertSheetAtEnd_(ss, SETUP_NAMES.USER_MAP);
  sheet.appendRow(['userId', 'role', 'fixed_store_id', 'is_active', 'display_name', 'registered_at']);
  sheet.setFrozenRows(1);
  styleHeaderRow_(sheet, 1, 6, '#4A90D9');
}

function ensurePendingSheet_(ss) {
  let sheet = ss.getSheetByName(SETUP_NAMES.PENDING);
  if (sheet) return;
  sheet = setupInsertSheetAtEnd_(ss, SETUP_NAMES.PENDING);
  sheet.appendRow(['userId', 'store_id', 'message', 'saved_at']);
  sheet.setFrozenRows(1);
  styleHeaderRow_(sheet, 1, 4, '#FFA000');
}

function ensureBotSessionSheet_(ss) {
  let sheet = ss.getSheetByName(SETUP_NAMES.BOT);
  if (sheet) return;
  sheet = setupInsertSheetAtEnd_(ss, SETUP_NAMES.BOT);
  sheet.appendRow(['userId', 'step', 'payload_json', 'updated_at']);
  sheet.setFrozenRows(1);
  styleHeaderRow_(sheet, 1, 4, '#6A1B9A');
}

function ensurePostsSheet_(ss) {
  if (ss.getSheetByName(SETUP_NAMES.POSTS)) return;
  const s = setupInsertSheetAtEnd_(ss, SETUP_NAMES.POSTS);
  s.appendRow([
    'postId', 'userId', 'role', 'sourceType', 'category',
    'text', 'imageUrl', 'lat', 'lng', 'storeId', 'spotId',
    'createdAt', 'expiresAt', 'isVisible'
  ]);
  s.setFrozenRows(1);
  styleHeaderRow_(s, 1, 14, '#2E7D32');
}

function ensureVenueSheet_(ss) {
  if (ss.getSheetByName(SETUP_NAMES.VENUE)) return;
  const s = setupInsertSheetAtEnd_(ss, SETUP_NAMES.VENUE);
  s.appendRow(['spotId', 'name', 'lat', 'lng', 'type']);
  s.setFrozenRows(1);
  styleHeaderRow_(s, 1, 5, '#1565C0');
}

function seedDummyPostsIfEmpty_(ss) {
  const sheet = ss.getSheetByName(SETUP_NAMES.POSTS);
  if (!sheet || sheet.getLastRow() > 1) return;

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  sheet.appendRow([
    Utilities.getUuid(),
    'DUMMY_GAS_USER',
    SETUP_ROLES.STORE,
    SETUP_SOURCE.FIXED,
    'お知らせ',
    'ダミーLIVE（店舗紐づけ・demo-001）',
    '',
    '', '',
    'demo-001',
    '',
    now,
    tomorrow,
    true
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    'DUMMY_GAS_OP',
    SETUP_ROLES.OPERATOR,
    SETUP_SOURCE.SELECTED,
    '混雑',
    'ダミーLIVE（会場スポット・vs-stage）',
    '',
    34.6762,
    138.9430,
    '',
    'vs-stage',
    now,
    tomorrow,
    true
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    'DUMMY_GAS_GPS',
    SETUP_ROLES.CONTRIBUTOR,
    SETUP_SOURCE.GPS,
    '景色',
    'ダミーLIVE（GPS 独立マーカー）',
    '',
    34.6720,
    138.9395,
    '',
    '',
    now,
    tomorrow,
    true
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    'DUMMY_HIDDEN',
    SETUP_ROLES.STORE,
    SETUP_SOURCE.FIXED,
    'お知らせ',
    'isVisible=FALSE のモデレーション確認用',
    '',
    '', '',
    'demo-002',
    '',
    now,
    tomorrow,
    false
  ]);
}

function seedDummyVenuesIfEmpty_(ss) {
  const sheet = ss.getSheetByName(SETUP_NAMES.VENUE);
  if (!sheet || sheet.getLastRow() > 1) return;

  sheet.appendRow(['vs-stage', 'メインステージ（ダミー）', 34.6762, 138.9430, 'stage']);
  sheet.appendRow(['vs-info', 'インフォメーション（ダミー）', 34.6745, 138.9445, 'info']);
  sheet.appendRow(['vs-gate', '北口ゲート（ダミー）', 34.6750, 138.9405, 'gate']);
}
