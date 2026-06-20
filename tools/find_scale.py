import asyncio
from playwright.async_api import async_playwright


async def fit(scale):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=25000)
        z = await page.evaluate(
            """(scale) => {
            const c = CONFIG.MAP_IMAGE.coordinates;
            const center = CONFIG.MAP_IMAGE.center;
            const clng = center[0], clat = center[1];
            const coords = c.map(([lng, lat]) => [clng + (lng - clng) * scale, clat + (lat - clat) * scale]);
            CONFIG.MAP_IMAGE.minZoomViewCoordinates = coords;
            CONFIG.MAP_IMAGE.minZoomViewPadding = {top:90,bottom:240,left:16,right:16};
            const map = MapProbe._map; const cam = MapProbe._cameraLock();
            map.fitBounds(MapProbe._minZoomViewBoundsPair(), {
                padding: MapProbe._minZoomPadding(), bearing: cam.bearing, pitch: cam.pitch, duration: 0, maxZoom: 22
            });
            return map.getZoom();
        }""",
            scale,
        )
        await browser.close()
        return z


async def main():
    for s in [0.15, 0.18, 0.20, 0.22, 0.25, 0.28, 0.30, 0.32, 0.35]:
        z = await fit(s)
        print(f"scale={s:.2f} fitZoom={z:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
