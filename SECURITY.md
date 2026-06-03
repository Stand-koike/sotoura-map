# セキュリティ

## 脆弱性の報告

Issue にて受け付けます（公開情報のみを含めてください）。

## 秘密情報

- **Mapbox** の `pk.*` と **Google スプレッドシート ID** は `web/secrets.local.js` にのみ記述し、**Git にコミットしない**（サンプルは `web/secrets.example.js`）。
- **LINE** のチャネルアクセストークン・スプレッドシート ID・管理者 ID 等は **Google Apps Script のスクリプトプロパティ**に登録する（`web/gas-line-webhook.js` の `logWebhookScriptPropertyKeys` 参照）。リポジトリの `gas-line-webhook.js` は **`WEBHOOK_CONFIG` を空のまま**運用し、ソースに実値を入れない。
- ローカルに全文を置く場合のみ `web/gas-line-webhook.local.js` を使い、**Git にコミットしない**（`.gitignore` 済み）。
- フロントに載る `pk` トークンは **Mapbox で URL 制限**を必ず設定すること。
- 履歴に秘密が含まれる場合はトークン **再発行**を推奨する。
