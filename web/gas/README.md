# `web/gas/` — Google Apps Script ソース

LINE Webhook とシート初期化スクリプトの編集用フォルダです。

## 構成

| パス | 説明 |
|------|------|
| `line-webhook/*.js` | Webhook **編集用ソース**（7 モジュール） |
| `build-line-webhook.py` | モジュール結合 → `../gas-line-webhook.js` |
| `build-line-webhook.mjs` | 上記の Node 版 |
| `gas-setup-all-sheets-dummy.js` | 新規スプレッドシート用ダミーデータ投入（Webhook と別 `.gs` 可） |

## Webhook の編集・デプロイ

```bash
# リポジトリルートから
python web/gas/build-line-webhook.py
```

生成物 `web/gas-line-webhook.js` を GAS エディタに貼り付け、**新バージョンでデプロイ**します。

秘密情報（`SHEET_ID` / `LINE_CHANNEL_ACCESS_TOKEN`）は GAS **スクリプトプロパティ**に登録し、ソースには入れません。

詳細: [../LINE_INTEGRATION.md](../LINE_INTEGRATION.md)

## モジュール一覧

| ファイル | 内容 |
|----------|------|
| `01-contract.js` | 定数・MSG 文言 |
| `02-infrastructure.js` | 設定・キャッシュ・ユーティリティ |
| `03-sheets.js` | シート操作・招待コード |
| `04-line-api.js` | LINE reply/push・画像取得 |
| `05-posting.js` | 投稿フロー・pending フラッシュ |
| `06-routing.js` | `doPost` / `doGet` ルーティング |
| `07-admin-setup.js` | ヘルプ・管理者・セットアップ |
