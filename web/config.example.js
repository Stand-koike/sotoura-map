/**
 * エリア設定テンプレート — 新エリア用
 *
 * 使い方:
 *   1. このファイルを config.js にコピー
 *   2. APP_TITLE / MAP_IMAGE / TRANSLATIONS 等を編集
 *   3. secrets.example.js → secrets.local.js でトークン・SHEET_ID を設定
 *
 * @see docs/AREA_MIGRATION_GUIDE.md
 */
(function () {
    'use strict';

    var secrets = (typeof window !== 'undefined' && window.__SHIMODA_MAP_SECRETS__)
        ? window.__SHIMODA_MAP_SECRETS__
        : {};

    window.__SHIMODA_MAP_CONFIG__ = {
        APP_TITLE: 'YOUR_AREA_MAP',

        GA_MEASUREMENT_ID: '',

        MAPBOX_TOKEN: secrets.MAPBOX_TOKEN || 'pk.YOUR_MAPBOX_TOKEN',
        SHEET_ID:     secrets.SHEET_ID     || 'YOUR_GOOGLE_SHEET_ID',

        COLS: {
            NAME: 1, LAT: 2, LNG: 3, EMOJI: 4,
            URL: 5, IMAGE_URL_2: 6, IMAGE_URL_3: 7,
            DESC: 8, CAT: 9, HIDDEN: 10,
            STORE_ID: 11, RESERVED: 12, STATUS: 13,
            NEWS: 14, DETAIL: 15, COUPON: 16,
            ADDRESS: 17, PHONE: 18, TAGS: 19, HOURS: 20,
            NAME_EN: 21, DESC_EN: 22, CAT_EN: 23, NEWS_EN: 24,
            DETAIL_EN: 25, COUPON_EN: 26, ADDRESS_EN: 27, PHONE_EN: 28,
            TAGS_EN: 29, HOURS_EN: 30
        },

        COLORS: { DEFAULT: '#0096C7', RED: '#FF5252', YELLOW: '#FFCA28' },

        MAP_IMAGE: {
            url:        'map_day.png',
            urlSunset:  'map_sunset.png',
            urlNight:   'map_night.png',
            cacheVersion: 'YYYYMMDD-area',
            solarLat:   null,
            solarLng:   null,
            timezone:   'Asia/Tokyo',
            sunsetPreheatMinutes: 45,
            duskBand:   'nautical',

            // [NW, NE, SE, SW] — WGS84 [lng, lat]。.wld から換算
            coordinates: [
                [0.0, 0.0],
                [0.0, 0.0],
                [0.0, 0.0],
                [0.0, 0.0]
            ],
            latOffset:  0,
            lngOffset:  0,
            center:    [0.0, 0.0],
            initZoom:  15,
            minZoom:   13,
            maxZoom:   19,
            maxBounds: [[0.0, 0.0], [0.0, 0.0]],
            bearing:   0,
            pitch:     45
        },

        POLL_INTERVAL: 30000,

        POSTS_SHEET: secrets.POSTS_SHEET || 'posts',
        LIVE_POST_POLL_INTERVAL: 30000,

        EVENTS_SHEET:                 secrets.EVENTS_SHEET || 'event_schedule',
        EVENT_SCHEDULE_LEAD_MINUTES:  30,
        EVENT_SCHEDULE_POLL_INTERVAL: 60000,
        EVENT_SCHEDULE_TICK_MS:       60000,

        TRANSLATIONS: {
            ja: {
                all: 'すべて', go: 'Google Mapsで見る', coupon: 'クーポンを使う',
                loading: '読み込み中...', noData: 'データなし', filter: '絞り込み',
                layers: 'レイヤー', newsListTitle: 'お知らせ一覧', updating: 'データ更新中...',
                hours: '営業時間', tags: 'タグ', allTags: 'すべてのタグ', map: 'マップ'
            },
            en: {
                all: 'All', go: 'Open in Google Maps', coupon: 'Use Coupon',
                loading: 'Loading...', noData: 'No Data', filter: 'Filter',
                layers: 'Layers', newsListTitle: 'News List', updating: 'Updating...',
                hours: 'Hours', tags: 'Tags', allTags: 'All Tags', map: 'Map'
            }
        }
    };
})();
