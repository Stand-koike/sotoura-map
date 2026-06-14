# `web/` — ブラウザ向け静的ファイル（外浦MAP）

このフォルダには **マップ画面の HTML・画像・秘密設定のサンプル** が入ります。

**ローカルプレビュー**:

```bash
cd web
python -m http.server 8080
```

→ `http://localhost:8080/`（`secrets.local.js` が必要）。`file://` 直開きは WebGL がブロックされることがあります。

---

| ファイル | 説明 |
|----------|------|
| `index.html` | アプリ本体（単一 HTML・ビルド不要） |
| `line-contract.js` | **LINE 連携契約**（シート名・posts 列定義・機能フラグ） |
| `config.js` | **エリア設定**（MAP_IMAGE・COLS・TRANSLATIONS 等） |
| `config.example.js` | 新エリア用テンプレート |
| `config.local.js` | ローカル上書き（**コミットしない**） |
| `map.png` 等 | イラスト地図（昼のみ `dayOnly`） |
| `secrets.example.js` | サンプル → `secrets.local.js` に複製 |
| `gas-line-webhook.js` | GAS 用 LINE Webhook（**秘密は GAS スクリプトプロパティ**） |
| [LINE_INTEGRATION.md](LINE_INTEGRATION.md) | LINE 連携仕様（店舗投稿・posts 列・フロント契約） |

---

## 外浦MAP の機能概要

| 機能 | 状態 |
|------|------|
| 店舗マスタ（ピン・カード・モーダル） | 有効 |
| ピンクラスタ（ズーム ≤17、代表写真＋件数バッジ） | 有効 |
| 日英切替・カテゴリ絞り込み・タグフィルター | 有効 |
| LINE 店舗投稿 → LIVE バッジ（店舗ピン・かわら版） | 有効 |
| 観光客 GPS 独立ピン | **無効**（`ENABLE_STANDALONE_LIVE_PINS: false`・将来拡張用コード残存） |
| イラスト地図（昼のみ） | 有効 |
| 中央上部ニュースティッカー | **非表示** |
| 神轎ルート / 祭スケジュール | **削除**（将来拡張余地あり） |

---

## 初期設定

1. `secrets.example.js` を `secrets.local.js` にコピーし、`MAPBOX_TOKEN` と `SHEET_ID` を設定
2. 列定義は **`config.js` の `COLS`** を正とする（外浦: [clients/sotoura/production/README.md](../clients/sotoura/production/README.md)）
3. 画像差し替え時は `MAP_IMAGE.cacheVersion` を更新

---

## UI 機能

| 機能 | 操作 |
|------|------|
| カードパネル折りたたみ | パネル右端 `‹ ›` |
| カテゴリ絞り込み | 左上「絞り込み」 |
| レイヤー切替 | 左上「レイヤー」（店舗ピン・空の routes/areas） |
| 詳細表示 | カードまたはピンをクリック |
| 言語切替 | 左上「JP」 |
| 現在地 | 右下 GPS ボタン |
