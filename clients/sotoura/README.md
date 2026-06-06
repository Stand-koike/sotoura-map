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
| `production/300.png` | 昼イラスト（Git 除外・`web/300.png` にコピーしてコミット） |
| `production/300.pgw` | ワールドファイル（EPSG:6676） |
| `production/coordinates.json` | WGS84 四隅 → `web/config.js` 転記元 |

夕・夜は未配置。追加時は `MAP_IMAGE.dayOnly: false` と sunset/night URL を設定。

## ローカル確認

```powershell
Copy-Item clients\sotoura\production\300.png web\300.png   # PNG 更新時
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
