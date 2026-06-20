# geo/ — 神輿・ルート GeoJSON

祭礼パレード追従が必要な場合のみ使用。

| ファイル | 用途 |
|----------|------|
| `checkpoints.geojson` | チェックポイント + `arrival_time`（JST `+09:00` 推奨） |
| `route_segments.geojson` | LineString 区間 + `segment_id`, easing |

本番反映: 将来 GeoJSON を使う場合は `web/` へ配置するか、フロントのデータ URL を更新してください（現行外浦マップでは神轎ルート機能は無効）。

テスト URL（本番では使わない）:
- `?mikoshiPreview=1`
- `?mikoshiSegment=seg_01`
