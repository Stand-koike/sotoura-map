"""Compare probe screenshot with user reference and search minZoomViewCoordinates scale."""
import asyncio
import json
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
REF = Path(
    r"C:\Users\vagab\.cursor\projects\c-Users-vagab-Desktop-Stand-01-MAP\assets"
    r"\c__Users_vagab_AppData_Roaming_Cursor_User_workspaceStorage_ab202a17754e2ea7a7249cfb94b2ae53_images"
    r"___________2026-06-18_132744-2573f6ef-ddf4-4f28-8edc-4f150faa7326.png"
)
COORDS = [
    [138.9467077202, 34.6963523018],
    [138.9883642749, 34.6961924889],
    [138.9881219182, 34.6548949351],
    [138.9464860344, 34.6550545035],
]
CENTER = [138.9674148192, 34.6756236185]


def lerp_coords(scale):
    """Scale geographic quad around center. scale=1 full illustration."""
    clng, clat = CENTER
    out = []
    for lng, lat in COORDS:
        out.append([clng + (lng - clng) * scale, clat + (lat - clat) * scale])
    return out


def score_images(a_path, b_path):
    a = np.array(Image.open(a_path).convert("RGB"))
    b = np.array(Image.open(b_path).convert("RGB"))
    h, w = b.shape[:2]
    a = np.array(Image.fromarray(a).resize((w, h), Image.Resampling.BILINEAR))
    # crop ref map area (exclude bottom nav)
    b = b[10 : h - 110, :, :]
    a = a[10 : h - 110, :, :]
    ag = a[:, :, 1].astype(np.float32)
    bg = b[:, :, 1].astype(np.float32)
    ag = (ag - ag.mean()) / (ag.std() + 1e-8)
    bg = (bg - bg.mean()) / (bg.std() + 1e-8)
    return float((ag * bg).mean())


async def capture(scale, out_path):
    coords = lerp_coords(scale)
    js_coords = json.dumps(coords)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.evaluate(
            f"""() => {{
            CONFIG.MAP_IMAGE.minZoomViewCoordinates = {js_coords};
            CONFIG.MAP_IMAGE.minZoomTighten = 0;
            MapProbe._ready = false;
            MapProbe.onReady();
        }}"""
        )
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=20000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(out_path))
        data = await page.evaluate("() => window.__MINZOOM_PROBE__")
        await browser.close()
        return data


async def main():
    tmp = ROOT / "tools" / "_cal"
    tmp.mkdir(exist_ok=True)
    best = (-1.0, None, None)
    for scale in [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.0]:
        out = tmp / f"scale_{scale:.2f}.png"
        data = await capture(scale, out)
        s = score_images(out, REF)
        print(f"scale={scale:.2f} minZoom={data['minZoom']:.3f} score={s:.4f}")
        if s > best[0]:
            best = (s, scale, data)
    print("best", best[1], json.dumps(best[2], indent=2))
    coords = lerp_coords(best[1])
    print("minZoomViewCoordinates:")
    for c in coords:
        print(f"  [{c[0]:.7f}, {c[1]:.7f}],")


if __name__ == "__main__":
    asyncio.run(main())
