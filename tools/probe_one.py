"""Single minZoom probe with explicit config override."""
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent / "minzoom_probe.json"

CONFIGS = [
    {
        "label": "full+mobile_pad",
        "coords": None,
        "padding": {"top": 90, "bottom": 240, "left": 16, "right": 16},
        "tighten": 0,
    },
    {
        "label": "scale0.92+mobile_pad",
        "coords": [
            [138.9483643, 34.6946940],
            [138.9866883, 34.6945470],
            [138.9864654, 34.6565532],
            [138.9481603, 34.6567000],
        ],
        "padding": {"top": 90, "bottom": 240, "left": 16, "right": 16},
        "tighten": 0,
    },
]


async def probe_one(case):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=25000)
        await page.evaluate(
            """([coords, padding, tighten]) => {
            if (coords) CONFIG.MAP_IMAGE.minZoomViewCoordinates = coords;
            CONFIG.MAP_IMAGE.minZoomViewPadding = padding;
            CONFIG.MAP_IMAGE.minZoomTighten = tighten;
        }""",
            [case["coords"], case["padding"], case["tighten"]],
        )
        data = await page.evaluate(
            """() => {
            const map = MapProbe._map;
            const cam = MapProbe._cameraLock();
            map.fitBounds(MapProbe._minZoomViewBoundsPair(), {
                padding: MapProbe._minZoomPadding(),
                bearing: cam.bearing,
                pitch: cam.pitch,
                duration: 0,
                maxZoom: CONFIG.MAP_IMAGE.maxZoom ?? 22
            });
            const fitZoom = map.getZoom();
            const minZ = MapProbe._updateMinZoom();
            map.setZoom(minZ);
            return {
                fitZoom,
                minZ,
                padding: MapProbe._minZoomPadding(),
                coords: CONFIG.MAP_IMAGE.minZoomViewCoordinates || CONFIG.MAP_IMAGE.coordinates,
                zoom: map.getZoom()
            };
        }"""
        )
        shot = OUT.with_name(f"probe_{case['label']}.png")
        await page.screenshot(path=str(shot))
        await browser.close()
        print(case["label"], json.dumps(data))


async def main():
    for case in CONFIGS:
        await probe_one(case)


if __name__ == "__main__":
    asyncio.run(main())
