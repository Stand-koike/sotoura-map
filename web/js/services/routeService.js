import * as turf from '@turf/turf';

const UNITS = { units: 'kilometers' };

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function easeInOutCubic(t) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * @param {'linear'|'easeInOut'|'stop'|string} easing
 * @param {number} elapsedSec 区間内の経過秒
 * @param {number} durationSec
 */
export function applyEasing(easing, elapsedSec, durationSec) {
  const dur = Math.max(durationSec, 1e-6);
  const t = clamp01(elapsedSec / dur);
  switch (String(easing || 'linear')) {
    case 'easeInOut':
      return easeInOutCubic(t);
    case 'stop':
      return elapsedSec >= dur ? 1 : 0;
    case 'linear':
    default:
      return t;
  }
}

/**
 * LineString をつなげた全体ルート（表示用）。折れ点の重複を1点にまとめる。
 * @param {import('geojson').Feature[]} segmentFeatures seq 順
 */
export function mergeRouteLineString(segmentFeatures) {
  const coords = [];
  for (const f of segmentFeatures) {
    const g = f.geometry;
    if (!g || g.type !== 'LineString' || !g.coordinates?.length) continue;
    if (coords.length === 0) {
      coords.push(...g.coordinates);
      continue;
    }
    const [lastLng, lastLat] = coords[coords.length - 1];
    const rest = g.coordinates[0][0] === lastLng && g.coordinates[0][1] === lastLat
      ? g.coordinates.slice(1)
      : g.coordinates;
    coords.push(...rest);
  }
  return turf.lineString(coords);
}

/**
 * @param {Map<string, { arrivalMs: number|null }>} cpById
 * @param {import('geojson').Feature[]} segmentsSorted
 * @returns {Array<{ feature: import('geojson').Feature, tStart: number, tEnd: number, line: import('geojson').Feature<import('geojson').LineString>, lengthKm: number }>}
 */
export function buildSchedule(cpById, segmentsSorted) {
  /** @type {Array<{ feature: import('geojson').Feature, tStart: number, tEnd: number, line: import('geojson').Feature<import('geojson').LineString>, lengthKm: number }>} */
  const rows = [];
  let prevEnd = null;

  for (const feature of segmentsSorted) {
    const p = feature.properties || {};
    const line = /** @type {import('geojson').Feature<import('geojson').LineString>} */ (turf.feature(feature.geometry, p));
    const lengthKm = turf.length(line, UNITS);

    const startCp = p.start_cp;
    const endCp = p.end_cp;
    const startArrival = startCp ? cpById.get(startCp)?.arrivalMs : null;
    const endArrival = endCp ? cpById.get(endCp)?.arrivalMs : null;
    const durationMs = Math.max(0, (Number(p.duration_sec) || 0) * 1000);

    let tStart;
    if (prevEnd === null) {
      tStart = startArrival != null ? startArrival : Date.now();
    } else {
      tStart = Math.max(prevEnd, startArrival != null ? startArrival : prevEnd);
    }

    let tEnd;
    if (endArrival != null) {
      tEnd = endArrival;
    } else {
      tEnd = tStart + durationMs;
    }
    if (tEnd < tStart) {
      tEnd = tStart + durationMs;
    }

    rows.push({
      feature,
      tStart,
      tEnd,
      line,
      lengthKm
    });
    prevEnd = tEnd;
  }
  return rows;
}

/**
 * CP を線にスナップした点（lineSlice / along の基準）
 */
function snapCpToLine(cpFeature, lineFeature) {
  const pt = /** @type {import('geojson').Feature<import('geojson').Point>} */ (
    turf.point(cpFeature.geometry.coordinates)
  );
  const snapped = turf.nearestPointOnLine(lineFeature, pt, UNITS);
  return /** @type {import('geojson').Feature<import('geojson').Point>} */ (snapped);
}

/** @param {import('geojson').Feature<import('geojson').Point>} a */
/** @param {import('geojson').Feature<import('geojson').Point>} b */
function safeLineSlice(a, b, lineFeature) {
  try {
    const d = turf.distance(a, b, UNITS);
    if (d < 1e-12) {
      return turf.lineString([a.geometry.coordinates, b.geometry.coordinates]);
    }
    return turf.lineSlice(a, b, lineFeature);
  } catch {
    return turf.lineString([a.geometry.coordinates, b.geometry.coordinates]);
  }
}

export class RouteService {
  /**
   * @param {import('geojson').FeatureCollection} segmentsFc
   * @param {Map<string, { arrivalMs: number|null, feature: import('geojson').Feature }>} cpById
   */
  constructor(segmentsFc, cpById) {
    this._cpById = cpById;
    const sorted = [...(segmentsFc.features || [])].sort(
      (a, b) => (a.properties?.seq ?? 0) - (b.properties?.seq ?? 0)
    );
    this._schedule = buildSchedule(cpById, sorted);
    this._mergedRoute = mergeRouteLineString(sorted);
  }

  getSchedule() {
    return this._schedule;
  }

  /**
   * 全区間の tStart / tEnd を同一オフセットでずらす（プレビュー・リハ用）
   * @param {number} deltaMs 加算するミリ秒（負も可）
   */
  applyTimeShift(deltaMs) {
    const d = Number(deltaMs) || 0;
    for (const row of this._schedule) {
      row.tStart += d;
      row.tEnd += d;
    }
  }

  getMergedRoute() {
    return this._mergedRoute;
  }

  /**
   * 現在時刻における神輿位置・方位・ハイライト用ジオメトリ
   * 移動は必ず turf.along 経由（線上距離ベース）
   */
  getState(nowMs = Date.now()) {
    const sched = this._schedule;
    if (!sched.length) {
      return {
        lng: 138.9427692,
        lat: 34.6754033,
        bearing: 0,
        segmentIndex: -1,
        easedU: 0,
        phase: 'empty',
        traversedLine: turf.lineString([[138.9427692, 34.6754033], [138.9427692, 34.6754033]]),
        currentPoint: turf.point([138.9427692, 34.6754033]),
        line: null,
        lengthKm: 0,
        distKm: 0
      };
    }

    const first = sched[0];
    if (nowMs < first.tStart) {
      const row = first;
      const startCp = this._cpById.get(row.feature.properties?.start_cp);
      const p0 = startCp
        ? snapCpToLine(startCp.feature, row.line)
        : turf.along(row.line, 0, UNITS);
      return this._stateFromPoint(row, 0, p0, 'before_first');
    }

    const last = sched[sched.length - 1];
    if (nowMs > last.tEnd) {
      const endCp = this._cpById.get(last.feature.properties?.end_cp);
      const endPt = endCp
        ? snapCpToLine(endCp.feature, last.line)
        : turf.along(last.line, last.lengthKm, UNITS);
      const sCp = this._cpById.get(last.feature.properties?.start_cp);
      const startOnLine = sCp
        ? snapCpToLine(sCp.feature, last.line)
        : turf.along(last.line, 0, UNITS);
      const sliced = safeLineSlice(startOnLine, endPt, last.line);
      return this._bearingState(last, last.lengthKm, endPt, sliced, sched.length - 1, 1, 'after_last');
    }

    // 区間内: 降順で探す。前後の区間で tEnd === tStart のときは後ろの区間を採用（にぎわいへ進む）
    for (let i = sched.length - 1; i >= 0; i--) {
      const row = sched[i];
      if (nowMs >= row.tStart && nowMs <= row.tEnd) {
        const elapsedSec = (nowMs - row.tStart) / 1000;
        const durationSec = Math.max((row.tEnd - row.tStart) / 1000, 1e-6);
        const e = row.feature.properties?.easing || 'linear';
        const easedU = applyEasing(e, elapsedSec, durationSec);
        const distKm = Math.min(easedU * row.lengthKm, row.lengthKm);
        const currentPoint = turf.along(row.line, distKm, UNITS);

        const startCp = this._cpById.get(row.feature.properties?.start_cp);
        const startOnLine = startCp
          ? snapCpToLine(startCp.feature, row.line)
          : turf.along(row.line, 0, UNITS);

        const traversedLine = safeLineSlice(startOnLine, currentPoint, row.line);

        return this._bearingState(row, distKm, currentPoint, traversedLine, i, easedU, 'during');
      }
    }

    for (let i = 0; i < sched.length - 1; i++) {
      const row = sched[i];
      if (nowMs > row.tEnd && nowMs < sched[i + 1].tStart) {
        const endCp = this._cpById.get(row.feature.properties?.end_cp);
        const holdPt = endCp
          ? snapCpToLine(endCp.feature, row.line)
          : turf.along(row.line, row.lengthKm, UNITS);
        const startCp = this._cpById.get(row.feature.properties?.start_cp);
        const startOnLine = startCp
          ? snapCpToLine(startCp.feature, row.line)
          : turf.along(row.line, 0, UNITS);
        const traversedLine = safeLineSlice(startOnLine, holdPt, row.line);
        return this._bearingState(row, row.lengthKm, holdPt, traversedLine, i, 1, 'between_segments');
      }
    }

    const row = last;
    const endCp = this._cpById.get(row.feature.properties?.end_cp);
    const p = endCp
      ? snapCpToLine(endCp.feature, row.line)
      : turf.along(row.line, row.lengthKm, UNITS);
    return this._bearingState(row, row.lengthKm, p, turf.lineString([p.geometry.coordinates, p.geometry.coordinates]), sched.length - 1, 1, 'fallback');
  }

  _bearingState(row, distKm, currentPoint, traversedLine, segmentIndex, easedU, phase) {
    const delta = Math.min(0.00015, Math.max(row.lengthKm * 0.02, 1e-9));
    const aheadKm = Math.min(distKm + delta, row.lengthKm);
    const pAhead = turf.along(row.line, aheadKm, UNITS);
    const [lng, lat] = currentPoint.geometry.coordinates;
    let bearing = 0;
    try {
      bearing = turf.bearing(currentPoint, pAhead);
      if (!Number.isFinite(bearing)) bearing = 0;
    } catch {
      bearing = 0;
    }

    return {
      lng,
      lat,
      bearing,
      segmentIndex,
      easedU,
      phase,
      traversedLine,
      currentPoint,
      line: row.line,
      lengthKm: row.lengthKm,
      distKm
    };
  }

  _stateFromPoint(row, easedU, p0, phase) {
    const startCp = this._cpById.get(row.feature.properties?.start_cp);
    const startOnLine = startCp
      ? snapCpToLine(startCp.feature, row.line)
      : turf.along(row.line, 0, UNITS);
    const traversedLine = safeLineSlice(startOnLine, p0, row.line);
    return {
      lng: p0.geometry.coordinates[0],
      lat: p0.geometry.coordinates[1],
      bearing: 0,
      segmentIndex: 0,
      easedU,
      phase,
      traversedLine,
      currentPoint: p0,
      line: row.line,
      lengthKm: row.lengthKm,
      distKm: 0
    };
  }
}
