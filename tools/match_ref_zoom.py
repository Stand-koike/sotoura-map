"""Find zoom level in full app that best matches user reference screenshot."""
import asyncio
import json
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

REF = Path(
    r"C:\Users\vagab\.cursor\projects\c-Users-vagab-Desktop-Stand-01-MAP\assets"
    r"\c__Users_vagab_AppData_Roaming_Cursor_User_workspaceStorage_ab202a17754e2ea7a7249cfb94b2ae53_images"
    r"___________2026-06-18_132744-2573f6ef-ddf4-4f28-8edc-4f150faa7326.png"
)
OUT_DIR = Path(__file__).resolve().parent / "_cal"
OUT_DIR.mkdir(exist_ok=True)


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


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/index.html", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_function("() => State && State.map", timeout=45000)
        await page.wait_for_timeout(6000)
        best = (-1.0, None, None)
        for z in [12.5, 13.0, 13.5, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0]:
            path = OUT_DIR / f"zoom_{z:.1f}.png"
            data = await page.evaluate(
                f"""async () => {{
                const map = State.map;
                map.setZoom({z});
                await new Promise(r => map.once('moveend', r));
                await new Promise(r => setTimeout(r, 300));
                const b = map.getBounds();
                return {{
                    zoom: map.getZoom(),
                    bounds: {{ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }}
                }};
            }}"""
            )
            await page.screenshot(path=str(path))
            s = score(path, REF)
            print(f"zoom={z:.1f} actual={data['zoom']:.3f} score={s:.4f}")
            if s > best[0]:
                best = (s, z, data)
        print("best zoom", best)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
