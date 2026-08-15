# -*- coding: utf-8 -*-
"""Generate an accurate board-map PNG (10 tiles per side)."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent / "board-map-v6.png"

# Colors
ASIA = (198, 40, 40)
EUROPE = (13, 71, 161)
AFRICA = (239, 108, 0)
SA = (142, 116, 200)
CA = (69, 90, 100)
NA = (129, 212, 250)
OCEANIA = (0, 168, 107)
EVENT = (255, 152, 0)
TILE_BG = (247, 243, 234)
LINE = (180, 160, 130)
CORNER_BG = (236, 231, 223)
START_BG = (232, 168, 56)
CENTER_BG = (220, 235, 215)
WOOD = (228, 211, 184)
INK = (42, 42, 42)

# Board data: (kind, name, color_or_none, price)
# kind: property | event | corner | start
BOTTOM = [  # travel from start leftward; stored in travel order
    ("event", "E", None, ""),
    ("property", "日本", ASIA, "380/48"),
    ("property", "中国", ASIA, "420/55"),
    ("event", "E", None, ""),
    ("property", "印度", ASIA, "360/45"),
    ("property", "伊朗", ASIA, "300/35"),
    ("event", "E", None, ""),
    ("property", "沙特", ASIA, "340/40"),
    ("property", "俄罗斯", EUROPE, "480/65"),
    ("event", "E", None, ""),
]
LEFT = [  # bottom -> top travel
    ("property", "德国", EUROPE, "500/68"),
    ("property", "英国", EUROPE, "520/70"),
    ("event", "E", None, ""),
    ("property", "法国", EUROPE, "480/65"),
    ("property", "意大利", EUROPE, "460/60"),
    ("event", "E", None, ""),
    ("property", "埃及", AFRICA, "160/18"),
    ("property", "摩洛哥", AFRICA, "145/15"),
    ("event", "E", None, ""),
    ("property", "尼日利亚", AFRICA, "140/14"),
]
TOP = [  # left -> right travel
    ("event", "E", None, ""),
    ("property", "南非", AFRICA, "150/16"),
    ("property", "阿根廷", SA, "240/28"),
    ("event", "E", None, ""),
    ("property", "智利", SA, "220/26"),
    ("property", "巴西", SA, "260/32"),
    ("event", "E", None, ""),
    ("property", "古巴", CA, "175/19"),
    ("property", "巴拿马", CA, "190/22"),
    ("event", "E", None, ""),
]
RIGHT = [  # top -> bottom travel
    ("property", "哥斯达黎加", CA, "180/20"),
    ("property", "墨西哥", NA, "420/55"),
    ("event", "E", None, ""),
    ("property", "美国", NA, "560/80"),
    ("property", "加拿大", NA, "500/70"),
    ("event", "E", None, ""),
    ("property", "新西兰", OCEANIA, "420/55"),
    ("property", "澳大利亚", OCEANIA, "480/65"),
    ("event", "E", None, ""),
    ("property", "斐济", OCEANIA, "120/12"),
]

assert len(BOTTOM) == len(LEFT) == len(TOP) == len(RIGHT) == 10


def font(size):
    for name in (
        "msyh.ttc",
        "msyhbd.ttc",
        "simhei.ttf",
        "arial.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyhbd.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_centered(draw, xy, text, fnt, fill=INK):
    x0, y0, x1, y1 = xy
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = x0 + (x1 - x0 - tw) / 2
    ty = y0 + (y1 - y0 - th) / 2
    draw.text((tx, ty), text, font=fnt, fill=fill)


def draw_tile(draw, box, tile, fonts, rotate=0):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    kind, name, color, price = tile

    # Build upright tile then paste if rotated
    img = Image.new("RGB", (max(w, 1), max(h, 1)), TILE_BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)

    if kind == "event":
        d.rectangle([0, 0, w - 1, h - 1], fill=EVENT, outline=LINE, width=2)
        draw_centered(d, (0, 0, w, h), "E", fonts["event"], fill=(255, 255, 255))
    else:
        bar_h = max(8, int(h * 0.16))
        d.rectangle([1, 1, w - 2, bar_h], fill=color)
        # name + price
        name_box = (2, bar_h + 2, w - 2, int(h * 0.62))
        price_box = (2, int(h * 0.62), w - 2, h - 2)
        draw_centered(d, name_box, name, fonts["name"])
        if price:
            draw_centered(d, price_box, price, fonts["price"], fill=(90, 90, 90))

    if rotate:
        img = img.rotate(rotate, expand=True)
        # After expand, may need crop/resize to target box
        img = img.resize((w, h), ImageDraw.Image.Resampling.BICUBIC if hasattr(Image, "Resampling") else Image.BICUBIC)

    return img


def main():
    size = 1400
    margin = 40
    img = Image.new("RGB", (size, size), WOOD)
    draw = ImageDraw.Draw(img)

    # Board outer rect
    board = (margin, margin, size - margin, size - margin)
    draw.rectangle(board, fill=(217, 199, 168), outline=(120, 90, 55), width=4)

    inner = margin + 4
    outer = size - margin - 4
    span = outer - inner
    # 12 cells: corner + 10 + corner
    cell = span / 12

    fonts = {
        "title": font(36),
        "name": font(18),
        "price": font(13),
        "event": font(42),
        "corner": font(22),
        "legend": font(16),
        "small": font(14),
    }

    def cell_box(col, row):
        x0 = int(inner + col * cell)
        y0 = int(inner + row * cell)
        x1 = int(inner + (col + 1) * cell)
        y1 = int(inner + (row + 1) * cell)
        return (x0, y0, x1, y1)

    def paste_tile(col, row, tile):
        box = cell_box(col, row)
        tile_img = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), TILE_BG)
        d = ImageDraw.Draw(tile_img)
        w, h = tile_img.size
        kind, name, color, price = tile
        d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)
        if kind == "event":
            d.rectangle([0, 0, w - 1, h - 1], fill=EVENT, outline=(180, 100, 20), width=2)
            draw_centered(d, (0, 0, w, h), "E", fonts["event"], (255, 255, 255))
        else:
            bar_h = max(10, int(h * 0.18))
            d.rectangle([1, 1, w - 2, bar_h], fill=color)
            draw_centered(d, (2, bar_h + 4, w - 2, int(h * 0.68)), name, fonts["name"])
            draw_centered(d, (2, int(h * 0.68), w - 2, h - 4), price, fonts["price"], (90, 90, 90))
        img.paste(tile_img, (box[0], box[1]))

    def paste_corner(col, row, text, start=False):
        box = cell_box(col, row)
        d = ImageDraw.Draw(img)
        fill = START_BG if start else CORNER_BG
        d.rectangle(box, fill=fill, outline=LINE, width=2)
        if start:
            draw_centered(d, box, "起点", fonts["corner"], (74, 47, 0))
            # small arrow hint under
            x0, y0, x1, y1 = box
            draw_centered(d, (x0, y0 + (y1 - y0) * 0.55, x1, y1), "← 顺时针", fonts["small"], (74, 47, 0))
        else:
            draw_centered(d, box, text, fonts["corner"])

    # Corners: col/row 0..11
    paste_corner(11, 11, "起点", start=True)  # C0
    paste_corner(0, 11, "角格\n待定")  # C3
    paste_corner(0, 0, "角格\n待定")  # C2
    paste_corner(11, 0, "角格\n待定")  # C1

    # Bottom: travel start->left = cols 10..1 at row 11
    for i, tile in enumerate(BOTTOM):
        paste_tile(10 - i, 11, tile)

    # Left: travel up = rows 10..1 at col 0
    for i, tile in enumerate(LEFT):
        paste_tile(0, 10 - i, tile)

    # Top: travel right = cols 1..10 at row 0
    for i, tile in enumerate(TOP):
        paste_tile(1 + i, 0, tile)

    # Right: travel down = rows 1..10 at col 11
    for i, tile in enumerate(RIGHT):
        paste_tile(11, 1 + i, tile)

    # Center
    cbox = cell_box(1, 1)
    cbox2 = cell_box(10, 10)
    center = (cbox[0] + 4, cbox[1] + 4, cbox2[2] - 4, cbox2[3] - 4)
    draw.rectangle(center, fill=CENTER_BG, outline=(150, 170, 140), width=2)
    cx0, cy0, cx1, cy1 = center
    draw_centered(draw, (cx0, cy0 + 40, cx1, cy0 + 100), "中央区 / 骰子", fonts["title"])

    legend = [
        (ASIA, "亚洲"),
        (EUROPE, "欧洲"),
        (AFRICA, "非洲"),
        (SA, "南美"),
        (CA, "中美"),
        (NA, "北美"),
        (OCEANIA, "大洋洲"),
        (EVENT, "事件E"),
    ]
    lx = cx0 + 80
    ly = cy0 + 140
    for i, (col, label) in enumerate(legend):
        row, col_i = divmod(i, 4)
        x = lx + col_i * 200
        y = ly + row * 40
        draw.rectangle([x, y, x + 28, y + 14], fill=col, outline=LINE)
        draw.text((x + 36, y - 2), label, font=fonts["legend"], fill=INK)

    note = "每边中间10格 + 4角 = 44格 | 色条仅顶部 | 示意地价/地租"
    draw_centered(draw, (cx0, cy1 - 80, cx1, cy1 - 40), note, fonts["small"], (80, 80, 80))

    # Verify counts in data
    props = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "property")
    events = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "event")
    assert props == 26 and events == 14

    img.save(OUT, "PNG")
    print(f"Wrote {OUT} props={props} events={events} side=10")


if __name__ == "__main__":
    main()
