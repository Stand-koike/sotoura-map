/**
 * エリア設定 — 外浦マップ（area/sotoura ブランチ）
 *
 * main / 下田本番 Pages とは別ブランチ。下田に戻す場合は main の config.js を参照。
 *
 * ローカル上書き: config.local.js（Git 除外）で MAP_IMAGE.latOffset 等を微調整可
 *
 * @see clients/sotoura/production/coordinates.json
 */
(function () {
    'use strict';

    var secrets = (typeof window !== 'undefined' && window.__SHIMODA_MAP_SECRETS__)
        ? window.__SHIMODA_MAP_SECRETS__
        : {};

    window.__SHIMODA_MAP_CONFIG__ = {
        APP_TITLE: '外浦マップ',

        /** GA4 測定 ID（下田と同値・外浦専用は後日） */
        GA_MEASUREMENT_ID: 'G-XW0F1B5T6E',

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

        // ----------------------------------------------------------------
        // イラストマップ（300.png / 300.pgw, EPSG:6676）— 昼 1 枚のみ
        // ----------------------------------------------------------------
        MAP_IMAGE: {
            url:        '300.png',
            dayOnly:    true,
            urlSunset:  null,
            urlNight:   null,
            cacheVersion: '20260603-sotoura',
            solarLat:   null,
            solarLng:   null,
            timezone:   'Asia/Tokyo',
            sunsetPreheatMinutes: 45,
            duskBand:   'nautical',

            coordinates: [
                [138.9681121, 34.6779157],
                [138.9769292, 34.6778815],
                [138.9768828, 34.6697785],
                [138.9680665, 34.6698127]
            ],
            latOffset:  0,
            lngOffset:  0,
            center:    [138.9724978, 34.6738471],
            initZoom:  16.8,
            minZoom:   14,
            maxZoom:   19,
            maxBounds: [[138.9676234, 34.6693717], [138.9773723, 34.6783225]],
            bearing:   -90,
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
