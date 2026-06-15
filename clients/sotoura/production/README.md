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

## スプレッドシート列構成

先頭シート（店舗マスタ）。`web/config.js` の `COLS` は **gviz の 0-indexed 列番号**。

| 列 | gviz index | ヘッダー | COLS キー | 備考 |
|----|------------|----------|-----------|------|
| A | 0 | _reserved | — | 読み取り対象外 |
| B | 1 | name | `NAME` | 必須 |
| C | 2 | lat | `LAT` | 必須 |
| D | 3 | lng | `LNG` | 必須 |
| E | 4 | emoji | `EMOJI` | |
| F | 5 | image_url | `URL` | |
| G | 6 | image_url_2 | `IMAGE_URL_2` | |
| H | 7 | image_url_3 | `IMAGE_URL_3` | |
| I | 8 | desc | `DESC` | |
| J | 9 | category | `CAT` | |
| K | 10 | hidden | `HIDDEN` | `TRUE` / `FALSE` |
| L | 11 | store_id | `STORE_ID` | LINE 投稿紐付け用 |
| M | 12 | reserved | `RESERVED` | |
| N | 13 | status | `STATUS` | |
| O | 14 | news | `NEWS` | |
| P | 15 | detail | `DETAIL` | |
| Q | 16 | coupon | `COUPON` | |
| R | 17 | address | `ADDRESS` | |
| S | 18 | phone | `PHONE` | |
| T | 19 | tags | `TAGS` | `#タグ1, #タグ2` 形式 |
| U | 20 | hours | `HOURS` | |
| V | 21 | name_en | `NAME_EN` | |
| W | 22 | desc_en | `DESC_EN` | |
| X | 23 | category_en | `CAT_EN` | |
| Y | 24 | status_en | `STATUS_EN` | 英語表示時の status |
| Z | 25 | news_en | `NEWS_EN` | |
| AA | 26 | detail_en | `DETAIL_EN` | |
| AB | 27 | coupon_en | `COUPON_EN` | |
| AC | 28 | address_en | `ADDRESS_EN` | |
| AD | 29 | phone_en | `PHONE_EN` | |
| AE | 30 | tags_en | `TAGS_EN` | |
| AF | 31 | hours_en | `HOURS_EN` | |

列を追加・移動した場合は `web/config.js` の `COLS` を更新し、本表も合わせて修正すること。

---

## LINE 店舗スタッフ紐づけ（`store_invites`）

店舗・座標は **先頭シート（上表）で運営が登録**。スタッフは LINE で招待コード1通のみ送る。

| 列 | ヘッダー | 内容 |
|----|----------|------|
| A | `invite_code` | 共有コード（例: `FUMA7K`） |
| B | `store_id` | マスタ L列と一致 |
| C | `is_active` | `TRUE` / `FALSE` |
| D | `max_uses` | `0`=無制限、正の整数=上限人数 |
| E | `use_count` | GAS が自動加算（触らない） |
| F | `expires_at` | 空=無期限 |
| G | `created_at` | 任意 |
| H | `note` | メモ |

**オンボーディング手順**

1. 先頭シートに `store_id`, `lat`, `lng` を登録
2. `store_invites` にコード行を追加（同一店舗で複数スタッフが同じコードを使える）
3. スタッフへ公式 LINE + コードを共有 → コードを1通送信で紐づけ完了

詳細: [web/LINE_INTEGRATION.md](../../../web/LINE_INTEGRATION.md)

## `user_map`（GAS 自動更新・参照用）

| 列 | ヘッダー | 内容 |
|----|----------|------|
| A | `userId` | LINE userId |
| B | `role` | `store` |
| C | `fixed_store_id` | 店舗 ID |
| D | `is_active` | 利用停止は `FALSE` |
| E | `display_name` | 未使用 |
| F | `registered_at` | 紐づけ日時 |
| G | `linked_via` | 使用した招待コード |

同一 `store_id` に複数行（複数スタッフ）可。退職時は該当行を削除。
