"""Find minZoomViewCoordinates scale that best matches user reference screenshot."""
import asyncio
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

REF = Path(
    r"C:\Users\vagab\.cursor\projects\c-Users-vagab-Desktop-Stand-01-MAP\assets"
    r"\c__Users_vagab_AppData_Roaming_Cursor_User_workspaceStorage_ab202a17754e2ea7a7249cfb94b2ae53_images"
    r"___________2026-06-18_132744-2573f6ef-ddf4-4f28-8edc-4f150faa7326.png"
)
OUT = Path(__file__).resolve().parent / "_cal"


def score(a_path, ref_path):
    a = np.array(Image.open(a_path).convert("RGB"))
    b = np.array(Image.open(ref_path).convert("RGB"))
    h, w = b.shape[:2]
    a = np.array(Image.fromarray(a).resize((w, h), Image.Resampling.BILINEAR))
    b = b[10 : h - 110, :, :]
    a = a[10 : h - 110, :, :]
    ag = a[:, :, 1].astype(np.float32)
    bg = b[:, :, 1].astype(np.float32)
    ag = (ag - ag.mean()) / (ag.std() + 1e-8)
    bg = (bg - bg.mean()) / (bg.std() + 1e-8)
    return float((ag * bg).mean())


async def capture(scale):
    OUT.mkdir(exist_ok=True)
    path = OUT / f"match_{scale:.2f}.png"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=25000)
        data = await page.evaluate(
            """(scale) => {
            const c = CONFIG.MAP_IMAGE.coordinates;
            const center = CONFIG.MAP_IMAGE.center;
            const clng = center[0], clat = center[1];
            const coords = c.map(([lng, lat]) => [clng + (lng - clng) * scale, clat + (lat - clat) * scale]);
            CONFIG.MAP_IMAGE.minZoomViewCoordinates = coords;
            CONFIG.MAP_IMAGE.minZoomViewPadding = {top:90,bottom:240,left:16,right:16};
            CONFIG.MAP_IMAGE.minZoomTighten = 0;
            const minZ = MapProbe._updateMinZoom();
            MapProbe._map.setZoom(minZ);
            return { minZ, coords };
        }""",
            scale,
        )
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(path))
        await browser.close()
    return score(path, REF), data, path


async def main():
    best = (-1.0, None, None)
    for scale in [0.16, 0.18, 0.20, 0.22, 0.24, 0.26, 0.28, 0.30]:
        s, data, path = await capture(scale)
        print(f"scale={scale:.2f} minZ={data['minZ']:.3f} score={s:.4f}")
        if s > best[0]:
            best = (s, scale, data)
    print("best", best[0], "scale", best[1], "minZ", best[2]["minZ"])
    for row in best[2]["coords"]:
        print(f"  [{row[0]:.7f}, {row[1]:.7f}],")


if __name__ == "__main__":
    asyncio.run(main())
