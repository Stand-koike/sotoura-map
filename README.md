# 外浦マップ（sotoura-map）

Google スプレッドシートをデータソースに、**イラスト地図**上へピンを表示するシングルページアプリです。  
**外浦専用**リポジトリ。下田本番は [Stand-koike/shimoda-map](https://github.com/Stand-koike/shimoda-map)（変更しない）。

| パス | 内容 |
|------|------|
| **`web/`** | デプロイ正本（外浦のみ・`300.png` + `config.js`） |
| **`clients/sotoura/`** | 外浦素材正本（`.pgw` / `coordinates.json`） |

---

## Cursor で作業を始めるとき

1. **このリポジトリ（`外浦MAP`）だけ**を Workspace で開く（親フォルダ `01.案件` 全体は開かない）
2. `git branch` → **`main`**
3. [`web/config.js`](web/config.js) の `APP_TITLE` が **「外浦マップ」** であることを確認
4. Agent 依頼の冒頭例:

```
【案件】外浦 / リポ sotoura-map / main
【触らない】shimoda-map、下田の config・100.png 系
```

詳細: [`.cursor/rules/project.md`](.cursor/rules/project.md)

---

## ローカル確認

```powershell
cd web
Copy-Item secrets.example.js secrets.local.js   # 初回のみ
# secrets.local.js に MAPBOX_TOKEN を設定（SHEET_ID は後日可）
python -m http.server 8080
```

`http://localhost:8080/` — 地図は表示、シート未設定時はピンなし。

---

## GitHub Pages（GitHub Actions）

1. リポジトリ **Settings → Pages** → Source: **GitHub Actions**
2. **Settings → Secrets → Actions** に登録:
   - **`MAPBOX_PUBLIC_TOKEN`**（必須）… Mapbox 公開トークン `pk.*`
   - **`GOOGLE_SHEET_ID`**（後日）… 外浦用スプレッドシート ID
   - **`POSTS_SHEET`** / **`EVENTS_SHEET`**（任意）
3. `main` へ push → [`.github/workflows/pages.yml`](.github/workflows/pages.yml) が `web/` を公開

公開 URL 例: `https://stand-koike.github.io/sotoura-map/`

### スプレッドシートを後から足す

1. 外浦用シートを「リンクを知っている全員が閲覧可」に
2. `GOOGLE_SHEET_ID` を Repository secrets に追加
3. 再デプロイ（push または Actions の Re-run）

---

## 素材の流れ

`clients/sotoura/production/` → コピー → `web/` → commit & push

PNG は `clients/*/production/*.png` は Git 除外。`web/300.png` はデプロイ用にコミット。

---

## 下田リポとの関係

| リポ | 役割 |
|------|------|
| `shimoda-map` | 下田本番 Pages |
| `sotoura-map`（本リポ） | 外浦本番 Pages |

`index.html` 等の共通バグ修正は、下田で直したあと cherry-pick または同 diff を本リポへ適用。

---

## GitHub に載せないもの

- `web/secrets.local.js` 等（`.gitignore` 参照）
- `docs/`（ローカル専用）
