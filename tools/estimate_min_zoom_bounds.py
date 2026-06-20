"""Estimate minZoomViewCoordinates from screenshot vs map.webp."""
import numpy as np
from PIL import Image

MAP_PATH = r"c:\Users\vagab\Desktop\Stand\01.案件\外浦MAP\web\map.webp"
SHOT_PATH = (
    r"C:\Users\vagab\.cursor\projects\c-Users-vagab-Desktop-Stand-01-MAP\assets"
    r"\c__Users_vagab_AppData_Roaming_Cursor_User_workspaceStorage_ab202a17754e2ea7a7249cfb94b2ae53_images"
    r"___________2026-06-18_132744-2573f6ef-ddf4-4f28-8edc-4f150faa7326.png"
)

# [NW, NE, SE, SW]
COORDS = [
    [138.9467077202, 34.6963523018],
    [138.9883642749, 34.6961924889],
    [138.9881219182, 34.6548949351],
    [138.9464860344, 34.6550545035],
]


def pixel_to_geo(u, v):
    lng = (
        (1 - u) * (1 - v) * COORDS[0][0]
        + u * (1 - v) * COORDS[1][0]
        + u * v * COORDS[2][0]
        + (1 - u) * v * COORDS[3][0]
    )
    lat = (
        (1 - u) * (1 - v) * COORDS[0][1]
        + u * (1 - v) * COORDS[1][1]
        + u * v * COORDS[2][1]
        + (1 - u) * v * COORDS[3][1]
    )
    return lng, lat


def main():
    map_img = np.array(Image.open(MAP_PATH).convert("RGB"))
    shot = np.array(Image.open(SHOT_PATH).convert("RGB"))
    h, w = shot.shape[:2]
    map_crop = shot[10 : h - 110, :, :]
    ch, cw = map_crop.shape[:2]
    print("screenshot map crop", cw, "x", ch)

    mw, mh = map_img.shape[1], map_img.shape[0]
    scale = 0.08
    small_map = np.array(
        Image.fromarray(map_img).resize(
            (int(mw * scale), int(mh * scale)), Image.Resampling.BILINEAR
        )
    )
    small_shot = np.array(
        Image.fromarray(map_crop).resize(
            (int(cw * 0.5), int(ch * 0.5)), Image.Resampling.BILINEAR
        )
    )

    shot_g = small_shot[:, :, 1].astype(np.float32)
    best = (-1.0, None)

    for ss in [x / 100 for x in range(35, 96, 5)]:
        sh, sw2 = int(small_map.shape[0] * ss), int(small_map.shape[1] * ss)
        if sh >= shot_g.shape[0] or sw2 >= shot_g.shape[1]:
            continue
        patch = np.array(
            Image.fromarray(small_map).resize((sw2, sh), Image.Resampling.BILINEAR)
        )[:, :, 1].astype(np.float32)
        ph, pw = patch.shape
        patch_n = (patch - patch.mean()) / (patch.std() + 1e-8)
        for y in range(0, shot_g.shape[0] - ph, 2):
            for x in range(0, shot_g.shape[1] - pw, 2):
                region = shot_g[y : y + ph, x : x + pw]
                region_n = (region - region.mean()) / (region.std() + 1e-8)
                score = float((patch_n * region_n).mean())
                if score > best[0]:
                    best = (score, (ss, x, y, pw, ph))

    print("best match score", best[0])
    if not best[1]:
        return

    ss, x, y, pw, ph = best[1]
    map_cx = (x + pw / 2) / small_shot.shape[1]
    map_cy = (y + ph / 2) / small_shot.shape[0]
    vis_w = ss
    vis_h = ss * (ph / pw) * (mw / mh)
    nx0 = max(0.0, min(1.0 - vis_w, map_cx - vis_w / 2))
    ny0 = max(0.0, min(1.0 - vis_h, map_cy - vis_h / 2))
    nx1 = nx0 + vis_w
    ny1 = ny0 + vis_h

    nw = pixel_to_geo(nx0, ny0)
    ne = pixel_to_geo(nx1, ny0)
    se = pixel_to_geo(nx1, ny1)
    sw = pixel_to_geo(nx0, ny1)
    print("NW", nw)
    print("NE", ne)
    print("SE", se)
    print("SW", sw)
    print("minZoomViewCoordinates:")
    print(f"  [{nw[0]:.7f}, {nw[1]:.7f}],")
    print(f"  [{ne[0]:.7f}, {ne[1]:.7f}],")
    print(f"  [{se[0]:.7f}, {se[1]:.7f}],")
    print(f"  [{sw[0]:.7f}, {sw[1]:.7f}],")


if __name__ == "__main__":
    main()
