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
    var lineContract = (typeof window !== 'undefined' && window.__LINE_CONTRACT__)
        ? window.__LINE_CONTRACT__
        : {};

    window.__SHIMODA_MAP_CONFIG__ = {
        APP_TITLE: '外浦マップ',

        /** GA4 測定 ID（下田と同値・外浦専用は後日） */
        GA_MEASUREMENT_ID: 'G-XW0F1B5T6E',

        MAPBOX_TOKEN: secrets.MAPBOX_TOKEN || 'pk.YOUR_MAPBOX_TOKEN',
        SHEET_ID:     secrets.SHEET_ID     || 'YOUR_GOOGLE_SHEET_ID',

        // ----------------------------------------------------------------
        // COLS — スプレッドシートの実データレイアウト（0-indexed）
        //
        // 実際のデータは image_url の枚数によってオフセットが変わるため
        // index.html の DataModule._parse では動的に計算している。
        // COLS はヘッダー整備後の「あるべき姿」として参照用に残す。
        //
        // スプレッドシートのヘッダー行 (行1) の列定義:
        //   A(_reserved), B(name), C(lat), D(lng), E(emoji),
        //   F(image_url), G(image_url_2), H(image_url_3),
        //   I(desc), J(category), K(hidden), L(store_id), M(reserved),
        //   N(status), O(news), P(url), Q(coupon),
        //   R(address), S(phone), T(tags), U(hours),
        //   V(name_en), W(desc_en), X(category_en), Y(status_en),
        //   Z(news_en), AA(url_en), AB(coupon_en), AC(address_en),
        //   AD(phone_en), AE(tags_en), AF(hours_en)
        // ----------------------------------------------------------------
        COLS: {
            NAME: 1, LAT: 2, LNG: 3, EMOJI: 4,
            URL: 5, IMAGE_URL_2: 6, IMAGE_URL_3: 7,
            DESC: 8, CAT: 9, HIDDEN: 10,
            STORE_ID: 11, RESERVED: 12, STATUS: 13,
            NEWS: 14, LINK_URL: 15, COUPON: 16,
            ADDRESS: 17, PHONE: 18, TAGS: 19, HOURS: 20,
            NAME_EN: 21, DESC_EN: 22, CAT_EN: 23, STATUS_EN: 24,
            NEWS_EN: 25, LINK_URL_EN: 26, COUPON_EN: 27, ADDRESS_EN: 28, PHONE_EN: 29,
            TAGS_EN: 30, HOURS_EN: 31
        },

        COLORS: { DEFAULT: '#0096C7', RED: '#FF5252', YELLOW: '#FFCA28' },

        // ----------------------------------------------------------------
        // イラストマップ（map.webp / map.pgw, EPSG:6676）— 昼 1 枚のみ
        // ----------------------------------------------------------------
        MAP_IMAGE: {
            url:        'map.webp',
            dayOnly:    true,
            urlSunset:  null,
            urlNight:   null,
            cacheVersion: '20260615-sotoura-map-webp',
            solarLat:   null,
            solarLng:   null,
            timezone:   'Asia/Tokyo',
            sunsetPreheatMinutes: 45,
            duskBand:   'nautical',

            coordinates: [
                [138.9467077202, 34.6963523018],
                [138.9883642749, 34.6961924889],
                [138.9881219182, 34.6548949351],
                [138.9464860344, 34.6550545035]
            ],
            latOffset:  0,
            lngOffset:  0,
            center:    [138.9674148192, 34.6756236185],
            /** 起動時の表示中心（海岸・ビーチ中央）とズーム */
            initCenter: [138.97244739182608, 34.675168669479824],
            initZoom:  16.7,
            /** fit 算出後の下限（これ未満にはズームアウト不可） */
            minZoom:   16.2,
            maxZoom:   19,
            initUseFitBounds: false,
            /**
             * ズームアウト下限フレーム（center から約 38% の範囲）。
             * イラスト全体だと fit が頭打ちになるため、意図的に狭く指定。
             * 順序: [NW, NE, SE, SW]
             */
            minZoomViewCoordinates: [
                [138.9595461, 34.6835005],
                [138.9753756, 34.6834398],
                [138.9752835, 34.6677467],
                [138.9594619, 34.6678074]
            ],
            /** minZoom fitBounds 用パディング（PC は下ナビなし） */
            minZoomViewPadding: { top: 90, bottom: 80, left: 50, right: 20, mobileBottom: 240 },
            /** minZoom = max(fit + minZoomTighten, minZoom) */
            minZoomOutBuffer: 0,
            minZoomTighten: 1.0,
            /** fitBounds オフセット px（y 負＝画面下・海側へ） */
            seaFitOffsetX: 0,
            seaFitOffsetY: -70,
            maxBounds: [[138.9424860, 34.6508949], [138.9923643, 34.7003523]],
            bearing:   -90,
            pitch:     45
        },

        POLL_INTERVAL: 30000,

        /** LINE 連携契約（line-contract.js）。列定義・シート名の正 */
        LINE: lineContract,

        /** @deprecated LINE.FEATURES.ENABLE_STANDALONE_LIVE_PINS を参照。互換のため残す */
        ENABLE_STANDALONE_LIVE_PINS: lineContract.FEATURES
            ? lineContract.FEATURES.ENABLE_STANDALONE_LIVE_PINS
            : false,

        /**
         * 店舗ピンのクラスタ表示（Mapbox GeoJSON）
         * clusterMaxZoom 以下でクラスタ、超えたら HTML マーカー
         */
        CLUSTER: {
            enabled:          true,
            clusterMaxZoom:   17,
            clusterRadius:    65,
            clusterMinPoints: 2,
            flyToZoom:        17.5
        },

        POSTS_SHEET: secrets.POSTS_SHEET
            || (lineContract.SHEETS && lineContract.SHEETS.POSTS)
            || 'posts',
        LIVE_POST_POLL_INTERVAL: 30000,

        TRANSLATIONS: {
            ja: {
                all: 'すべて', go: 'Google Mapsで見る', coupon: 'クーポンを使う',
                loading: '読み込み中...', noData: 'データなし', filter: '絞り込み',
                layers: 'レイヤー', newsListTitle: 'お知らせ一覧', updating: 'データ更新中...',
                hours: '営業時間', tags: 'タグ', allTags: 'すべてのタグ', map: 'マップ',
                kawaraView: 'かわら版を見る', kawaraTitle: 'かわら版',
                urlLink: '詳細を見る'
            },
            en: {
                all: 'All', go: 'Open in Google Maps', coupon: 'Use Coupon',
                loading: 'Loading...', noData: 'No Data', filter: 'Filter',
                layers: 'Layers', newsListTitle: 'News List', updating: 'Updating...',
                hours: 'Hours', tags: 'Tags', allTags: 'All Tags', map: 'Map',
                kawaraView: 'View Kawara', kawaraTitle: 'Kawara Board',
                urlLink: 'View details'
            }
        }
    };
})();
