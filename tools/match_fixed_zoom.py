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


def score(a_path):
    a = np.array(Image.open(a_path).convert("RGB"))
    b = np.array(Image.open(REF).convert("RGB"))
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
    OUT.mkdir(exist_ok=True)
    best = (-1, None)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 427, "height": 758})
        await page.goto("http://127.0.0.1:8765/minzoom-probe.html", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=25000)
        for z in [12.5, 13.0, 13.5, 14.0, 14.25, 14.5, 14.75, 15.0, 15.25, 15.5, 16.0]:
            await page.evaluate("(z) => MapProbe._map.setZoom(z)", z)
            await page.wait_for_timeout(300)
            path = OUT / f"fixed_{z:.2f}.png"
            await page.screenshot(path=str(path))
            s = score(path)
            print(f"zoom={z:.2f} score={s:.4f}")
            if s > best[0]:
                best = (s, z)
        await browser.close()
    print("best fixed zoom", best)


asyncio.run(main())
