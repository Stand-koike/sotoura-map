#!/usr/bin/env node
/**
 * web/gas/line-webhook/*.js を結合して gas-line-webhook.js を生成する。
 *
 * Usage: node web/gas/build-line-webhook.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.join(__dirname, 'line-webhook');
const OUTPUT = path.join(__dirname, '..', 'gas-line-webhook.js');

const MODULE_ORDER = [
  '01-contract.js',
  '02-infrastructure.js',
  '03-sheets.js',
  '04-line-api.js',
  '05-posting.js',
  '06-routing.js',
  '07-admin-setup.js'
];

const HEADER = `/**
 * ============================================================
 * LINE → GAS → Google Sheets（外浦MAP / 店舗投稿）
 * ============================================================
 *
 * 【このファイルについて】
 *   自動生成: web/gas/line-webhook/*.js
 *   再生成:   node web/gas/build-line-webhook.mjs
 *
 *   GAS へはこのファイルを貼り付けるか、line-webhook フォルダ内の
 *   各 .js を同一プロジェクトの複数 .gs ファイルとして配置可。
 *
 * 【秘密情報】GAS スクリプトプロパティ: SHEET_ID, LINE_CHANNEL_ACCESS_TOKEN
 * 【運用】web/line-contract.js および web/LINE_INTEGRATION.md を参照
 * ============================================================
 */

`;

const parts = MODULE_ORDER.map((name) => {
  const filePath = path.join(MODULE_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing module: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8').trim();
});

fs.writeFileSync(OUTPUT, HEADER + parts.join('\n\n') + '\n', 'utf8');
console.log('Built ' + OUTPUT + ' (' + MODULE_ORDER.length + ' modules)');
