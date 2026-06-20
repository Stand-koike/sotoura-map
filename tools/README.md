# `tools/` — 地図キャリブレーション用スクリプト

外浦マップの **最小ズーム・スケール・表示範囲** を調整するときのローカル開発ツールです。  
本番デプロイ（`web/`）には含まれません。

| スクリプト | 用途 |
|------------|------|
| `calibrate_minzoom.py` | 最小ズームの調整 |
| `probe_minzoom.py` | ズーム境界のプローブ |
| `verify_minzoom.py` | 設定値の検証 |
| `match_minzoom_scale.py` | スケール合わせ |
| `estimate_min_zoom_bounds.py` | 表示範囲の推定 |
| `find_scale.py` | スケール探索 |
| `shot_wide.py` | ワイド表示のスクリーンショット |
| `test_minzoom_cases.py` | ケーステスト |

`_cal/` は実行時の一時 PNG 出力用（コミット不要）。
