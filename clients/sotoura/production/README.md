# production/ — 確定版イラスト（本番反映の元）

`web/` にコピーする前に、ここに **PNG + ワールドファイル（.wld または .pgw）のペア** を揃える。

## ファイル命名規則

```
production/
├── map_day.png       ← 必須（昼）
├── map_day.wld       ← 必須（map_day.png とペア）
├── map_sunset.png    ← 任意（夕）
├── map_sunset.wld
├── map_night.png     ← 任意（夜）
├── map_night.wld
└── coordinates.json  ← WGS84 四隅（config.js へ転記）
```

## PNG + ワールドファイル ペア規則

- **同名ベース**でペアにする（例: `300.png` ↔ `300.pgw`、または `map_day.png` ↔ `map_day.wld`）
- **`.pgw`** は GDAL のワールドファイル（`.wld` と同形式・6行）。EPSG:6676 等の投影座標を想定
- 昼・夕・夜の3枚は **同じ pixel サイズ・同じ地理範囲**
- 座標換算は **昼版の .wld / .pgw** を基準に行い、夕/夜も同じ `coordinates` を使う
- ワールドファイルはブラウザは読まない。座標換算と記録用（`.pgw` は Git 管理可）

## coordinates.json

`coordinates.json.example` をコピーして編集。

```json
{
  "crs": "EPSG:4326",
  "corners": {
    "NW": [138.9371389, 34.6812813],
    "NE": [138.9587739, 34.6812018],
    "SE": [138.9587002, 34.6678289],
    "SW": [138.9370686, 34.6679084]
  },
  "coordinates": [
    [138.9371389, 34.6812813],
    [138.9587739, 34.6812018],
    [138.9587002, 34.6678289],
    [138.9370686, 34.6679084]
  ],
  "center": [138.9479213, 34.6745551],
  "maxBounds": [[138.924, 34.654], [138.972, 34.694]],
  "initZoom": 15.6,
  "bearing": -90,
  "pitch": 45,
  "wldSource": "map_day.wld",
  "wldCrs": "EPSG:6676",
  "notes": ""
}
```

`coordinates` の順序: **[NW, NE, SE, SW]**（経度, 緯度）

## web/ への反映

1. PNG を `web/` にコピー（`config.js` の `MAP_IMAGE.url` 等とファイル名を一致させる）
2. `coordinates.json` の値を `web/config.js` の `MAP_IMAGE` に転記
3. `MAP_IMAGE.cacheVersion` を更新（例: `20260603-sotoura`）
