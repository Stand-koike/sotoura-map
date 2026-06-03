import { loadCheckpoints } from './services/checkpointService.js';
import { RouteService } from './services/routeService.js';
import { MapService } from './services/mapService.js';
import { AnimationService } from './services/animationService.js';

const CP_URL = new URL('../public/data/checkpoints.geojson', import.meta.url).href;
const SEG_URL = new URL('../public/data/route_segments.geojson', import.meta.url).href;

/** スタンドアロンデモで追従させる区間（メインマップは従来どおり全セグメント） */
const DEMO_SEGMENT_ID = 'seg_02';

function readToken() {
  const s = window.__SHIMODA_MAP_SECRETS__;
  if (!s?.MAPBOX_TOKEN || s.MAPBOX_TOKEN.includes('YOUR_')) return null;
  return s.MAPBOX_TOKEN;
}

async function loadSegments() {
  const res = await fetch(SEG_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`route_segments ${res.status}`);
  return res.json();
}

/**
 * @param {import('geojson').FeatureCollection} fc
 * @param {string} segmentId
 */
function featureCollectionBySegmentId(fc, segmentId) {
  const features = (fc.features || []).filter(
    (f) => String(f.properties?.segment_id) === segmentId
  );
  return /** @type {import('geojson').FeatureCollection} */ ({ type: 'FeatureCollection', features });
}

/**
 * @param {import('geojson').FeatureCollection} cpFc
 * @param {import('geojson').Feature[]} segmentFeatures
 */
function filterCheckpointsForSegments(cpFc, segmentFeatures) {
  const ids = new Set();
  for (const f of segmentFeatures) {
    const p = f.properties || {};
    if (p.start_cp) ids.add(String(p.start_cp));
    if (p.end_cp) ids.add(String(p.end_cp));
  }
  const features = (cpFc.features || []).filter((f) =>
    ids.has(String(f.properties?.checkpoint_id))
  );
  return /** @type {import('geojson').FeatureCollection} */ ({ type: 'FeatureCollection', features });
}

function showErr(msg) {
  const bar = document.getElementById('mikoshi-error');
  if (bar) {
    bar.textContent = msg;
    bar.hidden = false;
  } else {
    console.error(msg);
  }
}

async function main() {
  const token = readToken();
  if (!token) {
    showErr('Mapbox トークンがありません。web/secrets.local.js（secrets.example.js をコピー）を設定してください。');
    return;
  }

  const [{ fc: cpFc, byId: cpById }, segmentsFc] = await Promise.all([
    loadCheckpoints(CP_URL, { cache: 'no-store' }),
    loadSegments()
  ]);

  const segmentsDemoFc = featureCollectionBySegmentId(segmentsFc, DEMO_SEGMENT_ID);
  if (!segmentsDemoFc.features.length) {
    showErr(`route_segments.geojson に ${DEMO_SEGMENT_ID} がありません。`);
    return;
  }

  const routeService = new RouteService(segmentsDemoFc, cpById);
  const merged = routeService.getMergedRoute();
  const mergedFc = { type: 'FeatureCollection', features: [merged] };

  const checkpointsDisplayFc = filterCheckpointsForSegments(cpFc, segmentsDemoFc.features);

  const initial = routeService.getState();
  const mapService = new MapService({
    container: 'mikoshi-map',
    accessToken: token,
    center: [initial.lng, initial.lat],
    zoom: 16
  });

  await mapService.init({
    mergedRouteFc: mergedFc,
    checkpointsFc: checkpointsDisplayFc,
    initialPoint: [initial.lng, initial.lat]
  });

  mapService.fitRouteBounds(merged);

  let iconSize = 0.675;
  const anim = new AnimationService({
    routeService,
    mapService,
    getIconSize: () => iconSize
  });

  const btnFit = document.getElementById('btn-fit');
  const btnMinus = document.getElementById('btn-icon-minus');
  const btnPlus = document.getElementById('btn-icon-plus');
  const lblPhase = document.getElementById('lbl-phase');

  if (btnFit) {
    btnFit.addEventListener('click', () => mapService.fitRouteBounds(merged));
  }
  const clampIcon = (v) => Math.min(0.85, Math.max(0.25, v));
  if (btnMinus) {
    btnMinus.addEventListener('click', () => {
      iconSize = clampIcon(iconSize - 0.06);
    });
  }
  if (btnPlus) {
    btnPlus.addEventListener('click', () => {
      iconSize = clampIcon(iconSize + 0.06);
    });
  }

  const uiTick = () => {
    if (lblPhase) {
      const st = routeService.getState();
      lblPhase.textContent = `${st.phase} · seg ${st.segmentIndex} · u ${(st.easedU ?? 0).toFixed(3)}`;
    }
    requestAnimationFrame(uiTick);
  };
  requestAnimationFrame(uiTick);

  anim.start();
}

main().catch((e) => {
  console.error(e);
  showErr(e.message || String(e));
});
