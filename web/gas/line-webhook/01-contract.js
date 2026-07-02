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
