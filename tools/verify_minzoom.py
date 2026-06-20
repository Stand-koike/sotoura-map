"""Verify minZoom on index.html after config change."""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        page.on("pageerror", lambda e: print("pageerror:", e))
        await page.goto("http://127.0.0.1:8765/index.html", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_function("() => State && State.map && State.map.getMinZoom", timeout=60000)
        await page.wait_for_timeout(3000)
        data = await page.evaluate(
            """async () => {
            const map = State.map;
            const minZ = map.getMinZoom();
            map.setZoom(minZ);
            await new Promise(r => map.once('moveend', r));
            const b = map.getBounds();
            return {
                minZoom: minZ,
                zoom: map.getZoom(),
                bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
            };
        }"""
        )
        print(data)
        await page.screenshot(path=str(__file__).replace("verify_minzoom.py", "_cal/app_minzoom.png"))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
