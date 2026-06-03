/**
 * requestAnimationFrame ループと神輿表示の更新
 */

export class AnimationService {
  /**
   * @param {{ routeService: import('./routeService.js').RouteService, mapService: import('./mapService.js').MapService, getIconSize?: () => number }} ctx
   */
  constructor(ctx) {
    this._route = ctx.routeService;
    this._map = ctx.mapService;
    this._getIconSize = ctx.getIconSize || (() => 0.675);
    /** @type {number | null} */
    this._raf = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      const now = Date.now();
      const st = this._route.getState(now);
      const bearing = typeof st.bearing === 'number' ? st.bearing : 0;
      this._map.setMikoshiLngLatBearing(st.lng, st.lat, bearing, this._getIconSize());
      if (st.traversedLine && st.traversedLine.geometry) {
        this._map.setProgressLine(st.traversedLine);
      } else {
        this._map.setProgressLine(null);
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }
}
