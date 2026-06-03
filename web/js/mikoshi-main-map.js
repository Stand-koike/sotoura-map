/**
 * メイン index.html の既存 Map に神輿レイヤを追加する。
 * スケジュール時間外は非表示。時間内かつレイヤーパネル ON のときだけ表示。
 */
import { loadCheckpoints } from './services/checkpointService.js';
import { RouteService } from './services/routeService.js';

const CP_URL = new URL('../public/data/checkpoints.geojson', import.meta.url).href;
const SEG_URL = new URL('../public/data/route_segments.geojson', import.meta.url).href;
const ICON_URL = new URL('../public/icons/パレードロゴ.png', import.meta.url).href;

/** URL で ?mikoshiPreview=1 等を付けたときのみ true（時刻シフト＋早送り再生） */
let previewUrlActive = false;

/** プレビュー早送り: アンカーと倍率 */
/** @type {{ anchorReal: number, anchorSched: number, speed: number } | null} */
let previewClock = null;

/** プレビュー時: 開始時刻の少し手前からルートを表示（秒）。通常運用では使わない */
const PREVIEW_PREROLL_MS = 120_000;

/** メインマップで ?mikoshiPreview=1 を付けると、スケジュールを「今」基準に寄せる */
function applyPreviewTimeShift(routeService) {
  try {
    const q = new URLSearchParams(window.location.search);
    const on =
      q.get('mikoshiPreview') === '1' ||
      q.get('mikoshiPreview') === 'true' ||
      q.get('mikoshiRehearsal') === '1';
    if (!on) return;
    previewUrlActive = true;
    const sched = routeService.getSchedule();
    if (!sched.length) return;
    const leadRaw = q.get('mikoshiLeadSec');
    const leadSec =
      leadRaw != null && leadRaw !== ''
        ? Math.max(0, Number(leadRaw))
        : 0;
    const shift = Date.now() + leadSec * 1000 - sched[0].tStart;
    routeService.applyTimeShift(shift);
    console.info(
      '[Mikoshi] プレビューモード ON。先頭通過を',
      leadSec === 0 ? '今' : `${leadSec}秒後`,
      '相当にシフトしました。'
    );
  } catch (err) {
    console.warn('[Mikoshi] プレビューシフト失敗', err);
  }
}

/** プレビュー中は「スケジュール上のいま」（時刻の早送り・終了後はループ）。通常は実時間。 */
function scheduleNowMs() {
  if (!previewUrlActive || !previewClock || !routeService) return Date.now();
  const sched = routeService.getSchedule();
  if (!sched.length) return Date.now();
  const t0 = sched[0].tStart;
  const t1 = sched[sched.length - 1].tEnd;
  const span = t1 - t0;
  let t =
    previewClock.anchorSched +
    (Date.now() - previewClock.anchorReal) * previewClock.speed;
  if (span > 1 && t >= t1) {
    t = t0 + ((t - t0) % span);
  }
  return t;
}

function initPreviewClock(routeServiceInstance) {
  previewClock = null;
  if (!previewUrlActive || !routeServiceInstance) return;
  const sched = routeServiceInstance.getSchedule();
  if (!sched.length) return;
  const q = new URLSearchParams(window.location.search);
  const sp = q.get('mikoshiSpeed');
  const speed =
    sp != null && sp !== ''
      ? Math.max(1, Math.min(4000, Number(sp)))
      : 120;
  previewClock = {
    anchorReal: Date.now(),
    anchorSched: sched[0].tStart,
    speed
  };
  console.info(
    '[Mikoshi] プレビュー早送り',
    speed,
    '× 既定。速さは &mikoshiSpeed=（1〜4000）。本番当日は実時間。'
  );
}

/**
 * テスト用: `?mikoshiSegment=seg_01` または `?mikoshiSegments=seg_01,seg_02`
 * 指定した `segment_id` の区間だけを接続・表示（本番 URL では付けない想定）。
 * @returns {Set<string> | null}
 */
function parseMikoshiSegmentTestFilter() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get('mikoshiSegments') || q.get('mikoshiSegment');
    if (raw == null || String(raw).trim() === '') return null;
    const ids = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length ? new Set(ids) : null;
  } catch {
    return null;
  }
}

/**
 * @param {import('geojson').FeatureCollection} fc
 * @param {Set<string>} idSet
 */
function featureCollectionOnlySegmentIds(fc, idSet) {
  const features = (fc.features || []).filter((f) =>
    idSet.has(String(f.properties?.segment_id))
  );
  return /** @type {import('geojson').FeatureCollection} */ ({
    type: 'FeatureCollection',
    features
  });
}

/**
 * @param {import('geojson').FeatureCollection} cpFc
 * @param {import('geojson').Feature[]} segmentFeatures
 */
function filterCheckpointsForSegmentFeatures(cpFc, segmentFeatures) {
  const ids = new Set();
  for (const f of segmentFeatures) {
    const p = f.properties || {};
    if (p.start_cp) ids.add(String(p.start_cp));
    if (p.end_cp) ids.add(String(p.end_cp));
  }
  const features = (cpFc.features || []).filter((f) =>
    ids.has(String(f.properties?.checkpoint_id))
  );
  return /** @type {import('geojson').FeatureCollection} */ ({
    type: 'FeatureCollection',
    features
  });
}

const SOURCE_ROUTE = 'mikoshi-route-line';
const SOURCE_PROGRESS = 'mikoshi-route-progress';
const SOURCE_CP = 'mikoshi-checkpoints';

/** @type {import('mapbox-gl').Map | null} */
let map = null;
/** @type {RouteService | null} */
let routeService = null;
/** @type {number | null} */
let rafId = null;
/** @type {import('mapbox-gl').Marker | null} */
let mikoshiMarker = null;
/** 水色ベースラインに表示中の区間 index（全区間マージはしない＝複線に見えないようにする） */
let lastMikoshiRouteBgSegmentIndex = NaN;

const LAYER_IDS = ['mikoshi-layer-route', 'mikoshi-layer-progress', 'mikoshi-layer-checkpoints'];

function isWithinScheduleWindow() {
  if (!routeService) return false;
  const sched = routeService.getSchedule();
  if (!sched.length) return false;
  const nowMs = scheduleNowMs();

  if (previewUrlActive) {
    // プレビュー時: 全体スパン（先頭プリロール付き）で判定
    const t0 = sched[0].tStart;
    const t1 = sched[sched.length - 1].tEnd;
    return nowMs >= t0 - PREVIEW_PREROLL_MS && nowMs <= t1;
  }

  // 通常時: いずれかの区間の [tStart, tEnd] 内にある場合のみ表示。
  // セグメント間の空き時間（例: seg_01終了〜seg_02開始）はレイヤーを非表示にする。
  for (const row of sched) {
    if (nowMs >= row.tStart && nowMs <= row.tEnd) return true;
  }
  return false;
}

function userWantsLayer() {
  if (typeof window.__shimoda_getMikoshiLayerOn === 'function') {
    return window.__shimoda_getMikoshiLayerOn();
  }
  return true;
}

function applyCombinedVisibility() {
  if (!map) return;
  const show = isWithinScheduleWindow() && userWantsLayer();
  const vis = show ? 'visible' : 'none';
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  }
  if (mikoshiMarker) {
    mikoshiMarker.getElement().style.display = show ? '' : 'none';
  }
}

function createMikoshiMarkerElement() {
  const root = document.createElement('div');
  root.className = 'mikoshi-marker';
  const shadow = document.createElement('div');
  shadow.className = 'mikoshi-marker-shadow';
  const body = document.createElement('div');
  body.className = 'mikoshi-marker-body';
  const head = document.createElement('div');
  head.className = 'mikoshi-marker-head';
  const stem = document.createElement('div');
  stem.className = 'mikoshi-marker-stem';
  stem.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.className = 'mikoshi-marker-img';
  img.src = ICON_URL;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  head.appendChild(img);
  body.appendChild(head);
  body.appendChild(stem);
  root.appendChild(shadow);
  root.appendChild(body);
  return root;
}

/**
 * @param {{ lng: number, lat: number }} initialState
 */
function ensureMikoshiMarker(initialState) {
  const Mb = window.mapboxgl;
  if (!Mb || !map || mikoshiMarker) return;
  const el = createMikoshiMarkerElement();
  mikoshiMarker = new Mb.Marker({
    element: el,
    anchor: 'bottom',
    // 進行方向ベアリングはこれまで通り「地図／北基準」。ピッチだけ画面向きにして倒れて見えないようにする。
    rotationAlignment: 'map',
    pitchAlignment: 'viewport'
  })
    .setLngLat([initialState.lng, initialState.lat])
    .addTo(map);
  applyCombinedVisibility();
}

function updateMikoshiMarker(lng, lat, bearing) {
  if (!mikoshiMarker) return;
  mikoshiMarker.setLngLat([lng, lat]);
  if (typeof mikoshiMarker.setRotation === 'function') {
    mikoshiMarker.setRotation(bearing);
  }
}

function setProgressFeat(feature) {
  if (!map?.getSource(SOURCE_PROGRESS)) return;
  if (!feature || !feature.geometry) {
    map.getSource(SOURCE_PROGRESS).setData({ type: 'FeatureCollection', features: [] });
    return;
  }
  const g = feature.geometry;
  const fc =
    g.type === 'LineString' && g.coordinates?.length >= 2
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: g }] }
      : { type: 'FeatureCollection', features: [] };
  map.getSource(SOURCE_PROGRESS).setData(fc);
}

/**
 * 予定ライン（水色）は「現在の区間」1本のみ。seg_01 と seg_02 の形状を同時に出さない。
 * @param {object} st routeService.getState() の戻り
 */
function syncRouteBackgroundToActiveSegment(st) {
  if (!map?.getSource(SOURCE_ROUTE)) return;
  const idx = st.segmentIndex;
  if (idx === lastMikoshiRouteBgSegmentIndex) return;
  lastMikoshiRouteBgSegmentIndex = idx;
  const g = st.line?.geometry;
  if (g?.type === 'LineString' && g.coordinates?.length >= 2) {
    map.getSource(SOURCE_ROUTE).setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: g }]
    });
  } else {
    map.getSource(SOURCE_ROUTE).setData({ type: 'FeatureCollection', features: [] });
  }
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!map || !routeService) return;
  applyCombinedVisibility();
  const now = scheduleNowMs();
  if (!isWithinScheduleWindow()) {
    return;
  }
  const st = routeService.getState(now);
  syncRouteBackgroundToActiveSegment(st);
  const bearing = typeof st.bearing === 'number' ? st.bearing : 0;
  updateMikoshiMarker(st.lng, st.lat, bearing);
  if (st.traversedLine && st.traversedLine.geometry) {
    setProgressFeat(st.traversedLine);
  } else {
    setProgressFeat(null);
  }
}

/**
 * @param {import('mapbox-gl').Map} mapboxMap
 */
export async function attachToMainMap(mapboxMap) {
  map = mapboxMap;
  try {
    const fetchFreshGeo = { cache: 'no-store' };
    const [{ fc: cpFc, byId: cpById }, segmentsFc] = await Promise.all([
      loadCheckpoints(CP_URL, fetchFreshGeo),
      fetch(SEG_URL, fetchFreshGeo).then((r) => {
        if (!r.ok) throw new Error(`route_segments ${r.status}`);
        return r.json();
      })
    ]);

    const segmentTestFilter = parseMikoshiSegmentTestFilter();
    let segmentsUse = segmentsFc;
    let cpDisplayFc = cpFc;
    if (segmentTestFilter) {
      const filtered = featureCollectionOnlySegmentIds(segmentsFc, segmentTestFilter);
      if (filtered.features.length) {
        segmentsUse = filtered;
        cpDisplayFc = filterCheckpointsForSegmentFeatures(cpFc, filtered.features);
        console.info(
          '[Mikoshi] テスト用・区間のみ表示:',
          [...segmentTestFilter],
          '（本番公開 URL ではこのパラメータを外してください）'
        );
      } else {
        console.warn(
          '[Mikoshi] mikoshiSegment(s) と一致する区間がありません。全区間で続行します',
          [...segmentTestFilter]
        );
      }
    }

    routeService = new RouteService(segmentsUse, cpById);
    applyPreviewTimeShift(routeService);
    initPreviewClock(routeService);
    if (new URLSearchParams(location.search).get('mikoshiDebug') === '1') {
      const s = routeService.getSchedule();
      if (s.length) {
        const nowMs = scheduleNowMs();
        const layerOn =
          typeof window.__shimoda_getMikoshiLayerOn === 'function'
            ? window.__shimoda_getMikoshiLayerOn()
            : true;
        const inSchedule = isWithinScheduleWindow();
        const activeRow = s.find((r) => nowMs >= r.tStart && nowMs <= r.tEnd);
        console.info('[Mikoshi debug]', {
          segments: s.map((r, i) => ({
            i,
            id: r.feature.properties?.segment_id,
            tStartJst: new Date(r.tStart).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            tEndJst: new Date(r.tEnd).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
          })),
          nowJst: new Date(nowMs).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
          activeSegment: activeRow ? activeRow.feature.properties?.segment_id : null,
          inScheduleWindow: inSchedule,
          layerMikoshiOn: layerOn,
          willRender: inSchedule && layerOn,
          previewUrlActive
        });
        if (!inSchedule) {
          const next = s.find((r) => nowMs < r.tStart);
          if (next) {
            console.info(
              '[Mikoshi] 次の区間開始まで非表示。次区間:',
              next.feature.properties?.segment_id,
              '開始=',
              new Date(next.tStart).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            );
          } else {
            console.info('[Mikoshi] 全区間終了。レイヤーは非表示です。');
          }
        } else if (!layerOn) {
          console.info('[Mikoshi] スケジュール内ですが、レイヤーパネルで「神輿ルート」が OFF です。');
        }
      }
    }
    const initial = routeService.getState(scheduleNowMs());
    const initialRouteFc =
      initial.line?.geometry?.type === 'LineString' &&
      (initial.line.geometry.coordinates?.length ?? 0) >= 2
        ? {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: initial.line.geometry }]
          }
        : { type: 'FeatureCollection', features: [] };
    lastMikoshiRouteBgSegmentIndex = initial.segmentIndex;

    if (!map.getSource(SOURCE_ROUTE)) {
      map.addSource(SOURCE_ROUTE, { type: 'geojson', data: initialRouteFc });
      map.addSource(SOURCE_PROGRESS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addSource(SOURCE_CP, { type: 'geojson', data: cpDisplayFc });
    }

    if (!map.getLayer('mikoshi-layer-route')) {
      map.addLayer({
        id: 'mikoshi-layer-route',
        type: 'line',
        source: SOURCE_ROUTE,
        paint: { 'line-color': '#90caf9', 'line-width': 4, 'line-opacity': 0.92 }
      });
      map.addLayer({
        id: 'mikoshi-layer-progress',
        type: 'line',
        source: SOURCE_PROGRESS,
        paint: { 'line-color': '#1565c0', 'line-width': 5, 'line-opacity': 0.95 }
      });
      map.addLayer({
        id: 'mikoshi-layer-checkpoints',
        type: 'circle',
        source: SOURCE_CP,
        paint: {
          'circle-radius': 6,
          'circle-color': '#fff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0277bd'
        }
      });
    }

    ensureMikoshiMarker(initial);

    window.__mikoshiApplyVisibility = applyCombinedVisibility;

    if (rafId == null) {
      rafId = requestAnimationFrame(tick);
    }
  } catch (e) {
    console.error('[Mikoshi main map] 初期化失敗', e, {
      cpUrl: CP_URL,
      segUrl: SEG_URL
    });
  }
}

export { applyCombinedVisibility };
