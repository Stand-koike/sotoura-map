/**
 * checkpoints.geojson の読込・checkpoint_id 索引・到着時刻(ms) の正規化
 */

function toMillis(isoOrUnknown) {
  if (isoOrUnknown == null || isoOrUnknown === '') return null;
  let s = String(isoOrUnknown).trim();
  // オフセット無し（例: 2026-05-10T01:34:00）は ECMAScript 上「ローカル時刻」となり、PC の TZ で窓が変わる。
  // 下田MAP は日本の祭礼想定のため、時刻のみの ISO 形は JST 固定とする。
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s);
  if (!hasTz && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    s += '+09:00';
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {string} dataUrl GeoJSON URL
 * @param {RequestInit} [fetchInit] 例: `{ cache: 'no-store' }` で更新直後の GeoJSON を確実に取る
 * @returns {Promise<{ fc: import('geojson').FeatureCollection, byId: Map<string, { id: string, name: string, arrivalMs: number|null, feature: import('geojson').Feature }> }>}
 */
export async function loadCheckpoints(dataUrl, fetchInit) {
  const res = await fetch(dataUrl, fetchInit);
  if (!res.ok) throw new Error(`checkpoints fetch ${res.status}`);
  /** @type {import('geojson').FeatureCollection} */
  const fc = await res.json();
  const byId = new Map();
  for (const f of fc.features || []) {
    const id = f.properties?.checkpoint_id;
    if (!id) continue;
    byId.set(id, {
      id,
      name: f.properties?.checkpoint_name ?? id,
      arrivalMs: toMillis(f.properties?.arrival_time),
      feature: f
    });
  }
  return { fc, byId };
}

export { toMillis };
