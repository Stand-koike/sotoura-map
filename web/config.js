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
        //   N(status), O(news), P(detail), Q(coupon),
        //   R(address), S(phone), T(tags), U(hours),
        //   V(name_en), W(desc_en), X(category_en), Y(status_en),
        //   Z(news_en), AA(detail_en), AB(coupon_en), AC(address_en),
        //   AD(phone_en), AE(tags_en), AF(hours_en)
        // ----------------------------------------------------------------
        COLS: {
            NAME: 1, LAT: 2, LNG: 3, EMOJI: 4,
            URL: 5, IMAGE_URL_2: 6, IMAGE_URL_3: 7,
            DESC: 8, CAT: 9, HIDDEN: 10,
            STORE_ID: 11, RESERVED: 12, STATUS: 13,
            NEWS: 14, DETAIL: 15, COUPON: 16,
            ADDRESS: 17, PHONE: 18, TAGS: 19, HOURS: 20,
            NAME_EN: 21, DESC_EN: 22, CAT_EN: 23, STATUS_EN: 24,
            NEWS_EN: 25, DETAIL_EN: 26, COUPON_EN: 27, ADDRESS_EN: 28, PHONE_EN: 29,
            TAGS_EN: 30, HOURS_EN: 31
        },

        COLORS: { DEFAULT: '#0096C7', RED: '#FF5252', YELLOW: '#FFCA28' },

        // ----------------------------------------------------------------
        // イラストマップ（map.png / map.pgw, EPSG:6676）— 昼 1 枚のみ
        // ----------------------------------------------------------------
        MAP_IMAGE: {
            url:        'map.png',
            dayOnly:    true,
            urlSunset:  null,
            urlNight:   null,
            cacheVersion: '20260613-sotoura-map',
            solarLat:   null,
            solarLng:   null,
            timezone:   'Asia/Tokyo',
            sunsetPreheatMinutes: 45,
            duskBand:   'nautical',

            coordinates: [
                [138.9435421692, 34.7041577557],
                [138.9893797027, 34.7039822893],
                [138.9890648462, 34.6504415010],
                [138.9432568012, 34.6506166193]
            ],
            latOffset:  0,
            lngOffset:  0,
            center:    [138.9724978, 34.6738471],
            initZoom:  16.8,
            minZoom:   14,
            maxZoom:   19,
            /**
             * 起動時の表示範囲（外浦湾エリア）。未指定時はイラスト全体 fit。
             * 順序: [NW, NE, SE, SW]
             */
            initViewCoordinates: [
                [138.9681121, 34.6779157],
                [138.9769292, 34.6778815],
                [138.9768828, 34.6697785],
                [138.9680665, 34.6698127]
            ],
            initViewPadding: { top: 70, bottom: 55, left: 45, right: 45 },
            initViewOffset:  [0, -50],
            /** 起動時 fit（false なら center + initZoom） */
            initUseFitBounds: true,
            /** minZoom は padding:0 fit + minZoomTighten（ズームアウト下限を少し上げる） */
            minZoomOutBuffer: 0,
            minZoomTighten: 0.45,
            /** fitBounds オフセット px（y 負＝画面下・海側へ） */
            seaFitOffsetX: 0,
            seaFitOffsetY: -70,
            maxBounds: [[138.9427568, 34.6499415], [138.9898797, 34.7046578]],
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
                kawaraView: 'かわら版を見る', kawaraTitle: 'かわら版'
            },
            en: {
                all: 'All', go: 'Open in Google Maps', coupon: 'Use Coupon',
                loading: 'Loading...', noData: 'No Data', filter: 'Filter',
                layers: 'Layers', newsListTitle: 'News List', updating: 'Updating...',
                hours: 'Hours', tags: 'Tags', allTags: 'All Tags', map: 'Map',
                kawaraView: 'View Kawara', kawaraTitle: 'Kawara Board'
            }
        }
    };
})();
