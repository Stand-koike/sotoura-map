#!/usr/bin/env python3
"""web/gas/line-webhook/*.js を結合して gas-line-webhook.js を生成する。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODULE_DIR = ROOT / "line-webhook"
OUTPUT = ROOT.parent / "gas-line-webhook.js"

MODULE_ORDER = [
    "01-contract.js",
    "02-infrastructure.js",
    "03-sheets.js",
    "04-line-api.js",
    "05-posting.js",
    "06-routing.js",
    "07-admin-setup.js",
]

HEADER = """/**
 * ============================================================
 * LINE → GAS → Google Sheets（外浦MAP / 店舗投稿）
 * ============================================================
 *
 * 【このファイルについて】
 *   自動生成: web/gas/line-webhook/*.js
 *   再生成:   python web/gas/build-line-webhook.py
 *             または node web/gas/build-line-webhook.mjs
 *
 *   GAS へはこのファイルを貼り付けるか、line-webhook フォルダ内の
 *   各 .js を同一プロジェクトの複数 .gs ファイルとして配置可。
 *
 * 【秘密情報】GAS スクリプトプロパティ: SHEET_ID, LINE_CHANNEL_ACCESS_TOKEN
 * 【運用】web/line-contract.js および web/LINE_INTEGRATION.md を参照
 * ============================================================
 */

"""

parts = []
for name in MODULE_ORDER:
    path = MODULE_DIR / name
    if not path.exists():
        raise SystemExit(f"Missing module: {path}")
    parts.append(path.read_text(encoding="utf-8").strip())

OUTPUT.write_text(HEADER + "\n\n".join(parts) + "\n", encoding="utf-8")
print(f"Built {OUTPUT} ({len(MODULE_ORDER)} modules)")
