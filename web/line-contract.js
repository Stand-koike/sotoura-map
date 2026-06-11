/**
 * LINE 連携の契約定義（外浦MAP）
 *
 * フロント: config.js が読み込み後に参照
 * GAS: gas-line-webhook.js 先頭の LINE_* 定数と同期すること（単体デプロイのためコピー保持）
 *
 * @see LINE_INTEGRATION.md
 */
(function (global) {
    'use strict';

    global.__LINE_CONTRACT__ = {
        /** GAS スクリプトプロパティのキー（優先順） */
        SCRIPT_PROPS: {
            SHEET_ID:     ['SHEET_ID', 'YOUR_GOOGLE_SHEET_ID'],
            LINE_TOKEN:   ['LINE_CHANNEL_ACCESS_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'],
            ADMIN_USER:   'ADMIN_LINE_USER_ID',
            REG_PASSWORD: 'REGISTRATION_PASSWORD'
        },

        /** 使用中のシート名（venue_spots は外浦では未使用） */
        SHEETS: {
            POSTS:        'posts',
            USER_MAP:     'user_map',
            BOT_SESSIONS: 'bot_sessions',
            PENDING:      'pending_posts'
        },

        /**
         * posts シート列（0-indexed・GAS getValues / gviz row.c 共通）
         * postId | userId | role | sourceType | title | text | imageUrl |
         * lat | lng | storeId | createdAt | isVisible
         */
        POSTS_COL: {
            POST_ID:     0,
            USER_ID:     1,
            ROLE:        2,
            SOURCE_TYPE: 3,
            TITLE:       4,
            TEXT:        5,
            IMAGE_URL:   6,
            LAT:         7,
            LNG:         8,
            STORE_ID:    9,
            CREATED_AT:  10,
            IS_VISIBLE:  11
        },

        /** user_map: userId | role | fixed_store_id | is_active | display_name | registered_at */
        USER_MAP_COL: {
            USER_ID:        0,
            ROLE:           1,
            FIXED_STORE_ID: 2,
            IS_ACTIVE:      3,
            DISPLAY_NAME:   4,
            REGISTERED_AT:  5
        },

        /** bot_sessions: userId | step | payload_json | updated_at */
        BOT_SESSION_COL: {
            USER_ID:      0,
            STEP:         1,
            PAYLOAD_JSON: 2,
            UPDATED_AT:   3
        },

        /** pending_posts: userId | store_id | message | image_url | saved_at */
        PENDING_COL: {
            USER_ID:   0,
            STORE_ID:  1,
            MESSAGE:   2,
            IMAGE_URL: 3,
            SAVED_AT:  4
        },

        /**
         * 店舗マスタ列（browser config.js COLS.STORE_ID と一致）
         * A=_reserved, B=name(1) … L=store_id(11)
         */
        MASTER_COL: {
            NAME:     1,
            LAT:      2,
            LNG:      3,
            STORE_ID: 11
        },

        ROLES: {
            STORE:       'store',
            CONTRIBUTOR: 'contributor'
        },

        SOURCE_TYPES: {
            FIXED:    'fixed',
            GPS:      'gps',
            SELECTED: 'selected'
        },

        LIMITS: {
            MAX_TITLE_LENGTH:    14,
            MAX_MESSAGE_LENGTH:  50,
            MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
            PENDING_EXPIRE_MS:   60 * 1000,
            PENDING_LOAD_GRACE_MS: 5 * 60 * 1000
        },

        /** 外浦MAP の機能フラグ */
        FEATURES: {
            /** 店舗ロールのみ有効（協力者・運営は廃止） */
            STORE_ONLY: true,
            /** GPS 独立ピン（観光客投稿など将来拡張） */
            ENABLE_STANDALONE_LIVE_PINS: false
        }
    };
})(typeof window !== 'undefined' ? window : this);
