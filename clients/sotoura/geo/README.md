# geo/ — 神輿・ルート GeoJSON

祭礼パレード追従が必要な場合のみ使用。

| ファイル | 用途 |
|----------|------|
| `checkpoints.geojson` | チェックポイント + `arrival_time`（JST `+09:00` 推奨） |
| `route_segments.geojson` | LineString 区間 + `segment_id`, easing |

本番反映: 編集後 `web/public/data/` にコピー。

テスト URL（本番では使わない）:
- `?mikoshiPreview=1`
- `?mikoshiSegment=seg_01`
