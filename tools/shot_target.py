import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent / "_cal"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=25000)
        for scale in [0.33, 0.34, 0.35]:
            await page.evaluate("""(scale) => {
                const c = CONFIG.MAP_IMAGE.coordinates;
                const center = CONFIG.MAP_IMAGE.center;
                const clng = center[0], clat = center[1];
                const coords = c.map(([lng, lat]) => [clng + (lng - clng) * scale, clat + (lat - clat) * scale]);
                CONFIG.MAP_IMAGE.minZoomViewCoordinates = coords;
                CONFIG.MAP_IMAGE.minZoomViewPadding = {top:90,bottom:240,left:16,right:16};
                CONFIG.MAP_IMAGE.minZoomTighten = 0;
                MapProbe._map.setZoom(MapProbe._updateMinZoom());
            }""", scale)
            await page.wait_for_timeout(400)
            z = await page.evaluate("() => MapProbe._map.getZoom()")
            path = OUT / f"target_{scale:.2f}.png"
            await page.screenshot(path=str(path))
            print(scale, z, path)

asyncio.run(main())
