# `web/` — ブラウザ向け静的ファイル

このフォルダには **マップ画面の HTML・画像・秘密設定のサンプル** が入ります。**Web 用アセット置き場**という意味で `web/` と名付けています。  
元テンプレートはデスクトップの別プロジェクト `map` から流用しています。  

**ローカルプレビュー**（このフォルダで）:

```bash
python -m http.server 8080
```

→ `http://localhost:8080/` で `index.html` が開く（`secrets.local.js` が要る）。`file://` で直接開くと WebGL がブロックされることがあります。

VS Code の **Live Server** で `index.html` を開いてもよい。

---

| ファイル | 説明 |
|----------|------|
| `index.html` | アプリ本体（単一 HTML・ビルド不要） |
| `config.js` | **エリア設定**（MAP_IMAGE・COLS・TRANSLATIONS 等）。新エリアはここを編集 |
| `config.example.js` | 新エリア用テンプレート（**コミットする**） |
| `config.local.js` | ローカル上書き（**コミットしない**）。latOffset 等の微調整用 |
| `100.png` / `100_sunset.png` / `100_nihgt.png` | イラスト地図（昼/夕/夜）。`config.js` の `MAP_IMAGE` と一致 |
| `100.wld` | ワールドファイル（EPSG:6676）。四隅座標換算用（ブラウザは読まない） |
| `secrets.example.js` | サンプル（**コミットする**）。`secrets.local.js` として複製して編集 |
| `secrets.local.js` | Mapbox トークン・`SHEET_ID`（**コミットしない**） |
| `gas-line-webhook.js` | GAS 用テンプレート（**プレースホルダのみ**コミット）。LINE シークレットは GAS 側で設定 |
| [LINE_INTEGRATION.md](LINE_INTEGRATION.md) | LINE 連携の現状仕様（ユーザー識別・投稿フロー・シート列・フロントとの契約） |
| `gas-line-webhook.local.js` | 任意：ローカルに実値入りの全文を保存して GAS へ貼り付け用（**コミットしない**） |
| `mikoshi/index.html` | 神輿ルート単体デモ（Mapbox + Turf）。**メイン index でもレイヤーパネル「神輿ルート」から同じデータを表示可** — 手順は [mikoshi/README.md](mikoshi/README.md) |

**神輿（メイン地図）**: レイヤーパネルで **「神輿ルート」ON** かつ **`checkpoints.geojson` の `arrival_time` で囲まれた時間帯内**のみ表示・移動します（常にブラウザの現在時刻で判定）。時刻外は非表示です。手動でリハーサル再生する場合のみメイン URL に **`?mikoshiPreview=1`**（任意で `mikoshiSpeed`・`mikoshiLeadSec`）を付けてください。**1ルートだけ試す**ときは **`?mikoshiSegment=seg_01`** または **`?mikoshiSegment=seg_02`**（複数は `mikoshiSegments=seg_01,seg_02`）。本番の公開 URL ではこのパラメータは外し、GeoJSON では公式・にぎわいを**別日時**で入れてください（別日でも全区間 ON のときは、前ルート終了〜次ルート開始のあいだは終点で待機表示になります）。詳細は [mikoshi/README.md](mikoshi/README.md)。

---

## 初期設定

1. `secrets.example.js` を `secrets.local.js` にコピーし、`MAPBOX_TOKEN` と `SHEET_ID` を設定する。  
2. 新エリアの場合: `config.example.js` を `config.js` にコピーし、`MAP_IMAGE`・`TRANSLATIONS` 等を編集する。  
3. 画像差し替え時は `MAP_IMAGE.cacheVersion` を更新する（ブラウザキャッシュ対策）。

列の対応関係は **`config.js` の `COLS`** を正とする。外浦の列定義は [clients/sotoura/production/README.md](../clients/sotoura/production/README.md#スプレッドシート列構成) を参照（`status_en` 含む英語列あり）。

---

## UI 機能（PC）

| 機能 | 操作 |
|------|------|
| カードパネル折りたたみ | パネル右端の `‹ ›` ボタンをクリック |
| カテゴリ絞り込み | 左上「絞り込み」ボタン |
| レイヤー切替 | 左上「レイヤー」ボタン |
| 詳細表示 | カードまたはピンをクリック |
| 言語切替（日/英） | 左上「JP」ボタン |
| 現在地表示 | 右下の GPS ボタン |

---

## 画像の差し替え

1. TIFF を出力する場合は PNG に変換し（ブラウザは TIFF を直接読み込めないことが多い）、**`-co WORLDFILE=YES`** などで **`.wld` または `.pgw`** を生成する  
2. PNG をこのフォルダに置き、`config.js` の `MAP_IMAGE.url`（および sunset/night）と一致させる  
3. ワールドファイルから四隅を **WGS84（経度・緯度）** に換算し、`config.js` の `MAP_IMAGE.coordinates`・`center`・`maxBounds` を更新する  
4. **`MAP_IMAGE.cacheVersion` を更新**（例: `20260603-v2`）  
5. ピンと画像のずれは `latOffset` / `lngOffset`（度単位）で微調整可能  
