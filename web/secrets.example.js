/**
 * ブラウザ用の秘密設定（Mapbox 公開トークン・スプレッドシート ID）
 * このファイルを secrets.local.js にコピーして値を埋め、Git には含めないこと。
 * @see リポジトリ直下の README.md（「秘密情報」・`.gitignore`）
 */
window.__SHIMODA_MAP_SECRETS__ = {
    MAPBOX_TOKEN: 'pk.YOUR_MAPBOX_TOKEN',
    SHEET_ID:     'YOUR_GOOGLE_SHEET_ID',
    /** LINE 投稿シート名（既定: posts） */
    POSTS_SHEET: 'posts',
    /** 祭イベントスケジュールシート名（既定: event_schedule）。省略可。 */
    EVENTS_SHEET: 'event_schedule'
};
