# clients/ — 外浦（sotoura）素材

このリポジトリは **外浦案件のみ** です。

| パス | 役割 |
|------|------|
| [`sotoura/`](sotoura/) | 外浦の素材正本 |
| [`web/`](../web/) | デプロイ用（`production/` からコピー） |

下田の素材は [shimoda-map](https://github.com/Stand-koike/shimoda-map) の `clients/shimoda/` を参照。

## ワークフロー

1. `sotoura/production/` に PNG + `.pgw` / `.wld`
2. `coordinates.json` を作成
3. `web/` に反映 + `config.js` 更新
4. push → GitHub Pages
