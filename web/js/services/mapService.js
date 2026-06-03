/**
 * Mapbox の初期化、アイコン登録、route / checkpoint / 神輿レイヤ
 */

const SOURCE_ROUTE = 'mikoshi-route-line';
const SOURCE_ROUTE_ALT = 'mikoshi-route-line-alt';
const SOURCE_PROGRESS = 'mikoshi-route-progress';
const SOURCE_CP = 'mikoshi-checkpoints';
const SOURCE_MIKOSHI = 'mikoshi-position';

const LAYER_ROUTE = 'mikoshi-layer-route';
const LAYER_ROUTE_ALT = 'mikoshi-layer-route-alt';
const LAYER_PROGRESS = 'mikoshi-layer-progress';
const LAYER_CP = 'mikoshi-layer-checkpoints';
const LAYER_MIKOSHI = 'mikoshi-layer-symbol';

function makeGeoJSON(type, obj) {
  if (type === 'Point') return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: obj.properties || {}, geometry: { type: 'Point', coordinates: obj.coordinates } }] };
  return { type: 'FeatureCollection', features: [] };
}

function isSvgIconUrl(url) {
  try {
    return /\.svg$/i.test(new URL(url).pathname);
  } catch {
    return /\.svg$/i.test(url);
  }
}

/**
 * SVG またはラスタ（PNG 等）を Canvas に描画し、Mapbox addImage 用に使う
 * @param {string} iconUrl
 * @param {number} size
 */
export async function iconUrlToImageBitmap(iconUrl, size = 128) {
  const res = await fetch(iconUrl);
  if (!res.ok) throw new Error(`icon fetch ${res.status}`);
  let objectUrl;
  if (isSvgIconUrl(iconUrl)) {
    const raw = await res.text();
    const blob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    objectUrl = URL.createObjectURL(blob);
  } else {
    objectUrl = URL.createObjectURL(await res.blob());
  }
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export class MapService {
  /**
   * @param {{ container: string, accessToken: string, style?: string, center?: [number, number], zoom?: number }} opts
   */
  constructor(opts) {
    this._opts = opts;
    /** @type {import('mapbox-gl').Map | null} */
    this._map = null;
    this._iconLoaded = false;
  }

  async init({ mergedRouteFc, altMergedRouteFc, checkpointsFc, initialPoint }) {
    mapboxgl.accessToken = this._opts.accessToken;

    this._map = new mapboxgl.Map({
      container: this._opts.container,
      style: this._opts.style || 'mapbox://styles/mapbox/light-v11',
      center: this._opts.center || initialPoint || [138.9428, 34.6754],
      zoom: this._opts.zoom ?? 15,
      pitch: 0,
      attributionControl: true
    });

    await new Promise((resolve, reject) => {
      this._map.once('load', resolve);
      this._map.once('error', reject);
    });

    const canvas = await iconUrlToImageBitmap(
      new URL('../../public/icons/パレードロゴ.png', import.meta.url).href,
      128
    );
    const bitmap = await createImageBitmap(canvas);
    if (!this._map.hasImage('mikoshi-icon')) {
      this._map.addImage('mikoshi-icon', bitmap, { pixelRatio: 2 });
    }
    this._iconLoaded = true;

    const hasAlt =
      altMergedRouteFc &&
      Array.isArray(altMergedRouteFc.features) &&
      altMergedRouteFc.features.length > 0;
    if (hasAlt) {
      this._map.addSource(SOURCE_ROUTE_ALT, { type: 'geojson', data: altMergedRouteFc });
      this._map.addLayer({
        id: LAYER_ROUTE_ALT,
        type: 'line',
        source: SOURCE_ROUTE_ALT,
        paint: {
          'line-color': '#ff9800',
          'line-width': 4,
          'line-opacity': 0.82,
          'line-dasharray': [1.2, 1.2]
        }
      });
    }
    this._map.addSource(SOURCE_ROUTE, { type: 'geojson', data: mergedRouteFc });
    this._map.addSource(SOURCE_PROGRESS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    this._map.addSource(SOURCE_CP, { type: 'geojson', data: checkpointsFc });
    this._map.addSource(SOURCE_MIKOSHI, {
      type: 'geojson',
      data: makeGeoJSON('Point', {
        coordinates: initialPoint || [138.9428, 34.6754],
        properties: { bearing: 0 }
      })
    });

    this._map.addLayer({
      id: LAYER_ROUTE,
      type: 'line',
      source: SOURCE_ROUTE,
      paint: { 'line-color': '#90caf9', 'line-width': 5, 'line-opacity': 0.85 }
    });
    this._map.addLayer({
      id: LAYER_PROGRESS,
      type: 'line',
      source: SOURCE_PROGRESS,
      paint: { 'line-color': '#1976d2', 'line-width': 6, 'line-opacity': 0.9 }
    });
    this._map.addLayer({
      id: LAYER_CP,
      type: 'circle',
      source: SOURCE_CP,
      paint: {
        'circle-radius': 7,
        'circle-color': '#fff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0288d1'
      }
    });
    this._map.addLayer({
      id: LAYER_MIKOSHI,
      type: 'symbol',
      source: SOURCE_MIKOSHI,
      layout: {
        'icon-image': 'mikoshi-icon',
        'icon-size': 0.675,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotation-alignment': 'map',
        'icon-rotate': ['get', 'bearing']
      }
    });

    this._map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
  }

  get map() {
    return this._map;
  }

  setMikoshiLngLatBearing(lng, lat, bearingDeg, iconSize) {
    if (!this._map?.getSource(SOURCE_MIKOSHI)) return;
    const f = {
      type: 'Feature',
      properties: { bearing: bearingDeg },
      geometry: { type: 'Point', coordinates: [lng, lat] }
    };
    this._map.getSource(SOURCE_MIKOSHI).setData({ type: 'FeatureCollection', features: [f] });
    if (typeof iconSize === 'number' && this._map.getLayer(LAYER_MIKOSHI)) {
      this._map.setLayoutProperty(LAYER_MIKOSHI, 'icon-size', iconSize);
    }
  }

  setProgressLine(geojsonFeature) {
    if (!this._map?.getSource(SOURCE_PROGRESS)) return;
    if (!geojsonFeature || !geojsonFeature.geometry) {
      this._map.getSource(SOURCE_PROGRESS).setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const g = geojsonFeature.geometry;
    const fc =
      g.type === 'LineString' && g.coordinates?.length >= 2
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: g }] }
        : { type: 'FeatureCollection', features: [] };
    this._map.getSource(SOURCE_PROGRESS).setData(fc);
  }

  setIconSize(size) {
    if (!this._map?.getLayer(LAYER_MIKOSHI)) return;
    this._map.setLayoutProperty(LAYER_MIKOSHI, 'icon-size', size);
  }

  fitRouteBounds(mergedLineStringFeature, altMergedFeature) {
    if (!this._map || !mergedLineStringFeature?.geometry?.coordinates?.length) return;
    const b = new mapboxgl.LngLatBounds(
      mergedLineStringFeature.geometry.coordinates[0],
      mergedLineStringFeature.geometry.coordinates[0]
    );
    mergedLineStringFeature.geometry.coordinates.forEach((c) => b.extend(c));
    const altCoords = altMergedFeature?.geometry?.coordinates;
    if (Array.isArray(altCoords) && altCoords.length) {
      altCoords.forEach((c) => b.extend(c));
    }
    this._map.fitBounds(b, {
      padding: { top: 100, bottom: 200, left: 40, right: 40 },
      maxZoom: 17,
      duration: 600
    });
  }
}

export { LAYER_MIKOSHI };
