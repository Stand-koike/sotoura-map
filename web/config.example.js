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
            NAME: 1, LAT: 2, LNG: 3, EMOJI: 4, URL: 5, DESC: 6,
            CAT: 7, HIDDEN: 8,
            STORE_ID: 9, RESERVED: 10,
            STATUS: 11, NEWS: 12, DETAIL: 13, COUPON: 14,
            NAME_EN: 15, DESC_EN: 16, CAT_EN: 17, NEWS_EN: 18, DETAIL_EN: 19, COUPON_EN: 20,
            ADDRESS: 21, ADDRESS_EN: 22, PHONE: 23, PHONE_EN: 24,
            TAGS: 25, TAGS_EN: 26, HOURS: 27, HOURS_EN: 28,
            IMAGE_URL_2: 29, IMAGE_URL_3: 30
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
