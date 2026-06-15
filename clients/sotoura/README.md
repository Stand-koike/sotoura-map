# 外浦（sotoura）

| 項目 | 値 |
|------|-----|
| slug | `sotoura` |
| 表示名 | 外浦マップ |
| 本番 | [sotoura-map](https://github.com/Stand-koike/sotoura-map) → GitHub Pages |
| 下田 | [shimoda-map](https://github.com/Stand-koike/shimoda-map)（別リポ・触らない） |

## 素材

| ファイル | 役割 |
|----------|------|
| `production/map.png` | 昼イラスト原稿（Git 除外） |
| `ops/optimize-map-webp.py` | 透明余白トリミング → WebP 化 → 座標再計算 |
| `ops/map.original.png` | 最適化前 PNG の退避（Git 除外） |
| `production/map.pgw` | ワールドファイル（EPSG:6676） |
| `production/coordinates.json` | WGS84 四隅 → `web/config.js` 転記元 |

夕・夜は未配置。追加時は `MAP_IMAGE.dayOnly: false` と sunset/night URL を設定。

## ローカル確認

```powershell
# PNG 原稿を web/ に置いたあと WebP 化（座標・config 更新はスクリプト出力を config.js へ反映）
Copy-Item clients\sotoura\production\map.png web\map.png
python clients\sotoura\ops\optimize-map-webp.py
cd web
python -m http.server 8080
```

微調整: `web/config.local.js` の `latOffset` / `lngOffset`。

## スプレッドシート

| 項目 | 値 |
|------|-----|
| シート | [外浦MAP](https://docs.google.com/spreadsheets/d/16E1nAfvtlVSVCaXfHSfzlAWIAHXeuQWudxFssreehy4/edit) |
| 先頭シート | 店舗マスタ（gviz 取得対象） |
| 列定義 | [`production/README.md`](production/README.md#スプレッドシート列構成) |
| コード側 | `web/config.js` の `COLS`（gviz 0-indexed） |

**公開設定:** 「リンクを知っている全員が閲覧可」にすること。

**Secrets:**
- ローカル: `web/secrets.local.js` の `SHEET_ID`
- 本番: GitHub → Settings → Secrets → `GOOGLE_SHEET_ID`

secret 追加・変更後は Actions の **Re-run all jobs** を実行。

詳細: [production/README.md](production/README.md)
