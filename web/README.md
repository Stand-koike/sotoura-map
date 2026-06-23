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
| `map.webp` | 本番用イラスト地図（`dayOnly`・PNG 原稿は `clients/sotoura/` に置く） |
| `secrets.example.js` | サンプル → `secrets.local.js` に複製 |
| `gas-line-webhook.js` | GAS 用 LINE Webhook（**自動生成物**・秘密は GAS スクリプトプロパティ） |
| [gas/](gas/README.md) | GAS **編集用ソース**・ビルドスクリプト・シート初期化 |
| [LINE_INTEGRATION.md](LINE_INTEGRATION.md) | LINE 連携仕様（店舗投稿・posts 列・フロント契約） |
| [docs/LINE_ONBOARDING.md](docs/LINE_ONBOARDING.md) | **導入資料**（運営手順・LINE 登録シミュレーション画像付き） |
| [docs/WORDPRESS_INTEGRATION.md](docs/WORDPRESS_INTEGRATION.md) | **WordPress かわら版**（エンジニア向け・API・埋め込み） |
| [wordpress-kawara-widget.js](wordpress-kawara-widget.js) | WordPress 埋め込み用ウィジェット本体 |
| [assets/rich-menu/README.md](assets/rich-menu/README.md) | **リッチメニュー**画像仕様・ボタン文言 |

---

## 外浦MAP の機能概要

| 機能 | 状態 |
|------|------|
| 店舗マスタ（ピン・カード・モーダル） | 有効 |
| ピンクラスタ（ズーム ≤17、代表写真＋件数バッジ） | 有効 |
| 日英切替・カテゴリ絞り込み・タグフィルター | 有効 |
| LINE 店舗投稿 → LIVE バッジ（かわら版） | 有効（運営がマスタ+招待コード、スタッフはコード1通で紐づけ） |
| 観光客 GPS 独立ピン | **無効**（`ENABLE_STANDALONE_LIVE_PINS: false`・将来拡張用コード残存） |
| イラスト地図（昼のみ） | 有効 |
| 中央上部ニュースティッカー | **非表示** |
| 神轎ルート / 祭スケジュール | **削除**（将来拡張余地あり） |

---

## LINE Webhook（GAS）の編集

`gas-line-webhook.js` は **`web/gas/line-webhook/`** 内の 7 ファイルを結合した自動生成物です。ロジックを変更するときはモジュールを編集し、再生成してください。

```bash
python web/gas/build-line-webhook.py
```

生成後、GAS エディタに `gas-line-webhook.js` を貼り付けて**新バージョンでデプロイ**します。GAS 上で複数 `.gs` ファイルに分割して配置しても動作します（ファイル名の数字順が実行順）。

| モジュール | 内容 |
|------------|------|
| `01-contract.js` | 定数・MSG 文言 |
| `02-infrastructure.js` | 設定・キャッシュ・ユーティリティ |
| `03-sheets.js` | シート操作・招待コード |
| `04-line-api.js` | LINE reply/push・画像取得 |
| `05-posting.js` | 投稿フロー |
| `06-routing.js` | `doPost` / `doGet` ルーティング |
| `07-admin-setup.js` | ヘルプ・管理者・セットアップ |

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
