"""Probe map minZoom bounds at mobile viewport via Playwright."""
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/minzoom-probe.html"
VIEWPORT = {"width": 427, "height": 758}
OUT = Path(__file__).resolve().parent / "minzoom_probe.json"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport=VIEWPORT)
        page.on("console", lambda msg: print("console:", msg.text))
        page.on("pageerror", lambda err: print("pageerror:", err))
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_function("() => window.__MINZOOM_PROBE__", timeout=45000)
        except Exception:
            await page.screenshot(path=str(OUT.with_suffix(".fail.png")))
            text = await page.inner_text("#out")
            print("probe failed, out=", text)
            await browser.close()
            raise
        data = await page.evaluate("() => window.__MINZOOM_PROBE__")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        await page.screenshot(path=str(OUT.with_suffix(".png")))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
