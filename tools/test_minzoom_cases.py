"""Test minZoom with various padding and coordinate scales."""
import asyncio
import json

from playwright.async_api import async_playwright

REF_PADDING = [
    {"name": "zero", "padding": {"top": 0, "bottom": 0, "left": 0, "right": 0}, "tighten": 0.45},
    {"name": "mobile", "padding": {"top": 90, "bottom": 240, "left": 16, "right": 16}, "tighten": 0},
    {"name": "mobile_tighten", "padding": {"top": 90, "bottom": 240, "left": 16, "right": 16}, "tighten": 0.45},
    {"name": "ref_ui", "padding": {"top": 70, "bottom": 110, "left": 16, "right": 16}, "tighten": 0},
]


async def run_case(scale, pad_name, padding, tighten):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        coords = page.evaluate(
            """([scale]) => {
            const c = CONFIG.MAP_IMAGE.coordinates;
            const center = CONFIG.MAP_IMAGE.center;
            const clng = center[0], clat = center[1];
            return c.map(([lng, lat]) => [clng + (lng - clng) * scale, clat + (lat - clat) * scale]);
        }""",
            [scale],
        )
        await page.evaluate(
            """([coords, padding, tighten]) => {
            CONFIG.MAP_IMAGE.minZoomViewCoordinates = coords;
            CONFIG.MAP_IMAGE.minZoomViewPadding = padding;
            CONFIG.MAP_IMAGE.minZoomTighten = tighten;
            window.__MINZOOM_PROBE__ = null;
            MapProbe._ready = false;
            MapProbe.onReady();
        }""",
            [coords, padding, tighten],
        )
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=20000)
        data = await page.evaluate("() => window.__MINZOOM_PROBE__")
        await browser.close()
        return data


async def main():
    for scale in [0.85, 0.90, 0.95, 1.0]:
        for case in REF_PADDING:
            data = await run_case(scale, case["name"], case["padding"], case["tighten"])
            print(
                f"scale={scale:.2f} {case['name']:16} minZoom={data['minZoom']:.3f} "
                f"bounds=({data['bounds']['west']:.4f},{data['bounds']['south']:.4f})-"
                f"({data['bounds']['east']:.4f},{data['bounds']['north']:.4f})"
            )


if __name__ == "__main__":
    asyncio.run(main())
