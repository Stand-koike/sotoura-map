# GitHub 初回セットアップ（sotoura-map）

ローカルリポは `外浦MAP/` に用意済み。以下を **GitHub 上で1回** 実行してください。

## 1. リポジトリ作成

1. https://github.com/new
2. Repository name: **`sotoura-map`**
3. Owner: **Stand-koike**
4. Public（Pages 用）
5. **README / .gitignore は追加しない**（空リポ）

## 2. push

```powershell
cd "c:\Users\vagab\Desktop\Stand\01.案件\外浦MAP"
git push -u origin main
```

## 3. GitHub Pages

1. **Settings → Pages**
2. **Build and deployment → Source**: **GitHub Actions**
3. `main` へ push 後、**Actions** タブで `Deploy GitHub Pages` が成功することを確認

公開 URL: `https://stand-koike.github.io/sotoura-map/`

## 4. Repository secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Name | 値 | 必須 |
|------|-----|------|
| `MAPBOX_PUBLIC_TOKEN` | 下田リポと同じ Mapbox `pk.*` | はい |
| `GOOGLE_SHEET_ID` | 外浦用スプレッドシート ID | 後日 |
| `POSTS_SHEET` | 省略可（既定 `posts`） | 任意 |
| `EVENTS_SHEET` | 省略可（既定 `event_schedule`） | 任意 |

`GOOGLE_SHEET_ID` 未設定時も地図は表示されます（ピンのみ未接続）。

シート追加後: secret 登録 → Actions の **Re-run all jobs**。

## 5. 確認

- タブタイトル「外浦マップ」
- イラスト `300.png` が表示
- `web/` に `100.png` 系がないこと（本リポのみ）
