# -*- coding: utf-8 -*-
"""Import Grok/AI original icons into assets/icons as clean RGBA PNGs."""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT  # copies live next to render script with long names
OUT = ROOT / "icons"
OUT.mkdir(parents=True, exist_ok=True)

# (dest_name, source filename fragment)
ICONS = [
    ("horse-head", "image-8063c9ba-0ca5-48a6-a9ae-b8cac5efb3a2"),
    ("oil", "image-f06543e2-8fd8-492a-abb1-b611d4904539"),
    ("mine", "image-47ed6457-a07b-441f-9800-e9dc76c8c43c"),
    ("ship", "image-2cc30773-7eeb-48d3-9641-8bd4a60fe288"),
    ("airport", "image-629126d7-7837-4153-b1ff-57448b66a3ab"),
    ("hospital", "image-a753acd8-d34e-4c8e-8285-3fcf88028c8e"),
    ("exchange", "image-944d9150-957c-4f2e-b704-04089a43a335"),
    ("bank", "image-e6fb7cc3-efbb-4c9e-b04a-2ce7c464f195"),
    ("cards", "image-f79d9ecd-e900-45c8-bf16-375ec7720bae"),
    ("chips", "image-0b478bea-0a24-45f6-a948-4bdb4152c6fc"),
    ("cash", "image-b53524e8-ff95-41c0-96ac-a37e6765bc31"),
    ("slot", "image-2b70e6d0-669f-4921-9b35-dbbc9d752bf9"),
]


def find_src(fragment: str) -> Path:
    matches = list(SRC_DIR.glob(f"*{fragment}*.png"))
    if not matches:
        # also search cursor workspace assets folder
        alt = Path(
            r"C:\Users\R9000P\.cursor\projects\c-Users-R9000P-Desktop-dice-board-game\assets"
        )
        matches = list(alt.glob(f"*{fragment}*.png"))
    if not matches:
        raise FileNotFoundError(fragment)
    return matches[0]


def extract_rgba(src: Path, bg_thr: int = 235) -> Image.Image:
    """Knock out near-white paper background; keep ink + gray fills."""
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            # near-white / paper texture → transparent
            if lum >= bg_thr and max(r, g, b) - min(r, g, b) < 28:
                continue
            # soft edge for anti-aliased ink
            if lum > 210:
                alpha = int(255 * (bg_thr - lum) / max(1, bg_thr - 210))
                alpha = max(0, min(255, alpha))
                if alpha < 8:
                    continue
                op[x, y] = (r, g, b, alpha)
            else:
                op[x, y] = (r, g, b, 255)
    bbox = out.getbbox()
    if not bbox:
        raise RuntimeError(f"empty extract: {src}")
    out = out.crop(bbox)
    # Second pass: crop pale empty margins (keep real white fills via dark-ink hull)
    out = tight_ink_crop(out, pad=4)
    # normalize max side ~512 for board use
    side = max(out.size)
    if side > 512:
        s = 512 / side
        out = out.resize(
            (max(1, int(out.width * s)), max(1, int(out.height * s))),
            Image.Resampling.LANCZOS,
        )
    return out


def tight_ink_crop(im: Image.Image, pad: int = 4, alpha_thr: int = 90, dark_lum: int = 110) -> Image.Image:
    """Trim soft gray noise and crop to dark-ink hull (card white fills stay inside)."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r + g + b) / 3
            chroma = max(r, g, b) - min(r, g, b)
            if a < alpha_thr and lum > 60:
                px[x, y] = (0, 0, 0, 0)
            elif a < 160 and lum > 150 and chroma < 25:
                px[x, y] = (0, 0, 0, 0)
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= alpha_thr and (r + g + b) / 3 <= dark_lum:
                xs.append(x)
                ys.append(y)
    if not xs:
        bbox = im.getbbox()
        return im.crop(bbox) if bbox else im
    x0, y0 = max(0, min(xs) - pad), max(0, min(ys) - pad)
    x1, y1 = min(w, max(xs) + 1 + pad), min(h, max(ys) + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def invert_for_dark(icon: Image.Image) -> Image.Image:
    """Swap dark↔light ink for dark track cells; keep alpha."""
    out = icon.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            px[x, y] = (255 - r, 255 - g, 255 - b, a)
    return out


def main():
    for name, frag in ICONS:
        src = find_src(frag)
        icon = extract_rgba(src)
        dest = OUT / f"{name}.png"
        icon.save(dest)
        print(f"{name}: {src.name[-40:]} -> {dest.name} {icon.size}")
    # also bake dark variants for track icons that need invert
    for name in ("horse-head", "cash", "slot"):
        inv = invert_for_dark(Image.open(OUT / f"{name}.png").convert("RGBA"))
        inv.save(OUT / f"{name}-dark.png")
        print(f"  {name}-dark.png")


if __name__ == "__main__":
    main()
