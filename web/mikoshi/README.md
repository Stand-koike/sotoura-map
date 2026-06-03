# 神輿ルート追従（Mapbox + Turf）

祭りの神輿を **道路 LineString 上**で時刻連動表示するデモページです。緯度経度の直線補間は使わず、線上距離と `turf.along()` によって位置を決めます。

## ディレクトリ

| パス | 説明 |
|------|------|
| [index.html](index.html) | エントリ（Mapbox CDN・importmap・下部ツールバー） |
| [../js/mikoshi-app.js](../js/mikoshi-app.js) | 初期化 |
| [../js/services/mapService.js](../js/services/mapService.js) | 地図・レイヤ・アイコン |
| [../js/services/checkpointService.js](../js/services/checkpointService.js) | チェックポイント GeoJSON |
| [../js/services/routeService.js](../js/services/routeService.js) | スケジュール・Turf（length / along / lineSlice / nearestPointOnLine） |
| [../js/services/animationService.js](../js/services/animationService.js) | `requestAnimationFrame` ループ |
| [../public/data/checkpoints.geojson](../public/data/checkpoints.geojson) | CP・到着時刻 |
| [../public/data/route_segments.geojson](../public/data/route_segments.geojson) | 区間 LineString・easing |
| [../public/icons/パレードロゴ.png](../public/icons/パレードロゴ.png) | 神輿アイコン（PNG） |

## 必要な設定（env に相当）

- **追加の `.env` は不要**です。
- Mapbox の **公開トークン** `pk.*` を、[../secrets.local.js](../secrets.local.js) に記述します（[../secrets.example.js](../secrets.example.js) をコピー）。
- 未作成の場合、スクリプトが空トークン扱いになり画面上部にエラーが出ます。

```javascript
window.__SHIMODA_MAP_SECRETS__ = {
  MAPBOX_TOKEN: 'pk.……',
  SHEET_ID: '…'  // 本ページでは未使用
};
```

トークンの URL 制限などはリポジトリの運用メモ（例: 親 README / ローカル `docs/OPERATIONS.md`）に従ってください。

## Turf.js の入れ方（ビルドなし）

`index.html` の **import map** で CDN を指します。

```html
<script type="importmap">
{
  "imports": {
    "@turf/turf": "https://esm.sh/@turf/turf@6.5.0"
  }
}
</script>
```

各サービスでは `import * as turf from '@turf/turf'` として利用しています。  
npm / `package.json` は不要です。

## Mapbox の設定

1. [Mapbox アカウント](https://account.mapbox.com/)で **公開アクセストークン**を作成する。  
2. 上記 `secrets.local.js` の `MAPBOX_TOKEN` に貼り付ける。  
3. （推奨）トークンの **URL 制限**を、ホスト名（例: GitHub Pages のドメイン）に合わせる。

本ページは Mapbox GL JS **v3.1** を CDN から読み込みます。

## マーカーアイコンの置き場所と読み込み

- ファイル: [../public/icons/パレードロゴ.png](../public/icons/パレードロゴ.png)（`.svg` も `iconUrlToImageBitmap` で利用可）
- `mapService` が `fetch` → Blob → `Image` → **Canvas 描画** → `createImageBitmap` → `map.addImage('mikoshi-icon', …)` で登録しています。
- **ブラウザは `http://` / `https://` で開く必要**があります（`file://` では `fetch` や WebGL が失敗しがちです）。

## データ仕様（拡張ポイント）

### checkpoints.geojson

- `checkpoint_id` / `checkpoint_name` / `arrival_time`（**推奨**: ISO8601、例 `2026-05-10T10:00:00+09:00`）
- `seq`（任意・表示用）
- geometry: `Point`

終点 CP の `arrival_time` がある場合、**該当区間の終了時刻**として優先されます（`routeService.buildSchedule`）。

### route_segments.geojson

各区間は 1 Feature。

- `segment_id` / `segment_name` / `start_cp` / `end_cp`
- `seq` … **昇順でソートしてから**スケジュール化します。
- `duration_sec` … 終点の `arrival_time` が無いときに終了時刻の算出に利用。
- `easing` … `linear` | `easeInOut` | `stop`（`stop` は区間中は始端に停車し、終了時刻で終端へスナップ）
- geometry: `LineString`（**道路に沿った座標列**。データ品質として前後区間と端点を一致させるのが理想）

### ダミーデータについて

付属の GeoJSON は下田エリア付近の **ダミー折れ線**です。本番では QGIS / OSM 等で道路に沿ってトレースし直してください。

### 動作確認用の時刻

サンプルは **2026-05-10** の時刻になっています。当日の進行を見たい場合は `checkpoints.geojson` の `arrival_time` を**テスト当日の JST**に書き換え、`duration_sec` と整合させてください。

## 起動手順

リポジトリの [../README.md](../README.md) と同様、**カレントを `web/`** にして HTTP サーバーを起動します。

```bash
cd web
python -m http.server 8080
```

ブラウザで次を開く。

- `http://localhost:8080/mikoshi/index.html`

## UI

- **全体表示**… ルート全体が収まるように `fitBounds`。  
- **− / ＋**… 神輿アイコンの `icon-size` を変更。  
- 画面下部に **フェーズ名・区間 index・eased u** を簡易表示。

## 技術メモ

- 移動計算に **`turf.length`**, **`turf.along`**, **`turf.lineSlice`**, **`turf.nearestPointOnLine`** を使用（コードは `routeService.js`）。  
- アニメーションは **`requestAnimationFrame`**（`animationService.js`）。  
- 方位は `turf.bearing` で近傍2点から算出（Mapbox `icon-rotate` 用）。

## メイン「下田マップ」との関係

- **[../index.html](../index.html) にも統合済み**です。マップ読込後に `js/mikoshi-main-map.js` が動的 import され、レイヤーパネルに **「神輿ルート」** が追加されます。
- **表示条件**:（1）`checkpoints` / `route_segments` の **スケジュール時間内**、かつ（2）レイヤーパネルで神輿が **ON**。時間外は自動で非表示（トグル ON でも出ません）。
- **メイン地図で1ルートだけ試す**: `index.html?mikoshiSegment=seg_01` または `seg_02`（本番公開ではパラメータなし）。
- **プレビュー**: メイン URL に **`?mikoshiPreview=1`** を付けると、スケジュールを **いまが先頭 CP 通過時刻**になるようにシフトしつつ、**時刻だけ約 120 倍速**（既定）で進めます（本番は55分かかるルートが数十秒で一周するイメージ）。倍率は **`&mikoshiSpeed=200`** のように **1〜4000** で変更可能。終了後は同じ速さでループします。遅延開始は `&mikoshiLeadSec=30`。
- スタンドアロン版は [index.html](index.html)（`/mikoshi/index.html`）のまま利用できます。
