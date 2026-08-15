# -*- coding: utf-8 -*-
"""Generate accurate board-map PNG with simplified flags."""
import math
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent / "board-map-v7.png"
FONTS_DIR = Path(__file__).resolve().parent / "fonts"

ASIA = (198, 40, 40)
EUROPE = (13, 71, 161)
AFRICA = (239, 108, 0)
SA = (142, 116, 200)
CA = (69, 90, 100)
NA = (129, 212, 250)
OCEANIA = (0, 168, 107)
EVENT_FG = (230, 120, 0)
MAFIA_BG = (30, 30, 30)
MAFIA_FG = (240, 240, 240)
TILE_BG = (247, 243, 234)
WHITE = (255, 255, 255)
LINE = (180, 160, 130)
START_BG = (232, 168, 56)
CENTER_BG = (220, 230, 240)  # 雾蓝广场，避免 Monopoly 式绿心
TRACK_INFIELD = (90, 130, 95)  # 跑马场内圈深绿
TRACK_INFIELD_LINE = (140, 160, 175)  # 广场描边偏蓝灰
WOOD = (228, 211, 184)
INK = (42, 42, 42)

# (kind, zh, en, color, price, flag_key)
# 顺时针自左下起点：左边→顶边→右边→底边
# 每边最多 2 个 E；意/美后「黑手党 + E」；伊朗后石油、智利后矿山；英/墨后大西洋港口
LEFT = [
    ("property", "日本", "Japan", ASIA, "560/70", "jp"),
    ("property", "中国", "China", ASIA, "580/75", "cn"),
    ("event", "事件", "Event", None, "", None),
    ("property", "印度", "India", ASIA, "460/60", "in"),
    ("property", "伊朗", "Iran", ASIA, "360/45", "ir"),
    ("facility", "石油", "Oil", None, "1000", "oil"),
    ("property", "沙特", "Saudi Arabia", ASIA, "440/55", "sa"),
    ("property", "俄罗斯", "Russia", EUROPE, "400/50", "ru"),
    ("event", "事件", "Event", None, "", None),
    ("property", "德国", "Germany", EUROPE, "560/70", "de"),
]
TOP = [
    ("property", "英国", "UK", EUROPE, "540/70", "gb"),
    ("port", "港口", "Port", None, "400", "port_n"),
    ("property", "法国", "France", EUROPE, "560/70", "fr"),
    ("property", "意大利", "Italy", EUROPE, "440/55", "it"),
    ("mafia", "黑手党", "Mafia", None, "", None),
    ("event", "事件", "Event", None, "", None),
    ("property", "埃及", "Egypt", AFRICA, "240/30", "eg"),
    ("property", "摩洛哥", "Morocco", AFRICA, "210/25", "ma"),
    ("event", "事件", "Event", None, "", None),
    ("property", "尼日利亚", "Nigeria", AFRICA, "200/25", "ng"),
]
RIGHT = [
    ("property", "南非", "South Africa", AFRICA, "220/30", "za"),
    ("event", "事件", "Event", None, "", None),
    ("property", "阿根廷", "Argentina", SA, "320/40", "ar"),
    ("property", "智利", "Chile", SA, "300/40", "cl"),
    ("facility", "矿山", "Mine", None, "1000", "mine"),
    ("property", "巴西", "Brazil", SA, "420/55", "br"),
    ("property", "古巴", "Cuba", CA, "250/30", "cu"),
    ("event", "事件", "Event", None, "", None),
    ("property", "巴拿马", "Panama", CA, "280/35", "pa"),
    ("property", "哥斯达黎加", "Costa Rica", CA, "260/35", "cr"),
]
BOTTOM = [
    ("property", "墨西哥", "Mexico", NA, "410/50", "mx"),
    ("port", "港口", "Port", None, "400", "port_s"),
    ("property", "加拿大", "Canada", NA, "520/65", "ca"),
    ("property", "美国", "USA", NA, "600/75", "us"),
    ("mafia", "黑手党", "Mafia", None, "", None),
    ("event", "事件", "Event", None, "", None),
    ("property", "新西兰", "New Zealand", OCEANIA, "400/50", "nz"),
    ("property", "澳大利亚", "Australia", OCEANIA, "510/65", "au"),
    ("event", "事件", "Event", None, "", None),
    ("property", "斐济", "Fiji", OCEANIA, "180/20", "fj"),
]

assert len(BOTTOM) == len(LEFT) == len(TOP) == len(RIGHT) == 10


def font(size, prefer=None):
    """Load a TTF/OTF. Default uses bundled Noto Sans SC (OFL); Latin display via prefer=."""
    candidates = []
    if prefer:
        candidates.extend(prefer if isinstance(prefer, (list, tuple)) else [prefer])
    # Bundled open fonts first (no Microsoft YaHei — proprietary)
    candidates.extend(
        [
            str(FONTS_DIR / "NotoSansSC-Bold.otf"),
            str(FONTS_DIR / "NotoSansSC-Regular.otf"),
            str(FONTS_DIR / "Cinzel-Bold.ttf"),
            str(FONTS_DIR / "PlayfairDisplay-Bold.ttf"),
            "arial.ttf",
        ]
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_centered(draw, xy, text, fnt, fill=INK):
    x0, y0, x1, y1 = xy
    lines = text.split("\n")
    bbox = draw.textbbox((0, 0), "测", font=fnt)
    line_h = bbox[3] - bbox[1] + 2
    total_h = line_h * len(lines)
    ty = y0 + (y1 - y0 - total_h) / 2
    for i, line in enumerate(lines):
        bb = draw.textbbox((0, 0), line, font=fnt)
        tw = bb[2] - bb[0]
        tx = x0 + (x1 - x0 - tw) / 2
        draw.text((tx, ty + i * line_h), line, font=fnt, fill=fill)


def draw_bilingual(draw, xy, zh, en, fnt_zh, fnt_en, fill=INK, gap=1):
    """Chinese above English, vertically centered in box."""
    x0, y0, x1, y1 = xy
    bz = draw.textbbox((0, 0), zh, font=fnt_zh)
    be = draw.textbbox((0, 0), en, font=fnt_en)
    zh_h = bz[3] - bz[1]
    en_h = be[3] - be[1]
    total_h = zh_h + gap + en_h
    ty = y0 + (y1 - y0 - total_h) / 2
    zw = bz[2] - bz[0]
    draw.text((x0 + (x1 - x0 - zw) / 2, ty - bz[1]), zh, font=fnt_zh, fill=fill)
    ew = be[2] - be[0]
    draw.text((x0 + (x1 - x0 - ew) / 2, ty + zh_h + gap - be[1]), en, font=fnt_en, fill=fill)


def hstripes(d, box, colors):
    x0, y0, x1, y1 = box
    n = len(colors)
    for i, c in enumerate(colors):
        a = y0 + (y1 - y0) * i // n
        b = y0 + (y1 - y0) * (i + 1) // n
        d.rectangle([x0, a, x1, b], fill=c)


def vstripes(d, box, colors):
    x0, y0, x1, y1 = box
    n = len(colors)
    for i, c in enumerate(colors):
        a = x0 + (x1 - x0) * i // n
        b = x0 + (x1 - x0) * (i + 1) // n
        d.rectangle([a, y0, b, y1], fill=c)


def draw_star(d, cx, cy, r, fill, points=5, width=0):
    """Regular star polygon (default 5-point)."""
    pts = []
    for i in range(points * 2):
        ang = -math.pi / 2 + i * math.pi / points
        rad = r if i % 2 == 0 else r * 0.40
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    if width:
        d.polygon(pts, outline=fill, width=width)
    else:
        d.polygon(pts, fill=fill)


def draw_union_jack(d, box):
    """Small Union Jack for cantons (AU / NZ / FJ / GB)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d.rectangle([x0, y0, x1, y1], fill=(1, 33, 105))
    # St Andrew white saltire
    lw = max(2, min(w, h) // 7)
    d.line([x0, y0, x1, y1], fill=WHITE, width=lw)
    d.line([x0, y1, x1, y0], fill=WHITE, width=lw)
    # St Patrick thin red (approx)
    rw = max(1, lw // 2)
    d.line([x0, y0, x1, y1], fill=(200, 16, 46), width=rw)
    d.line([x0, y1, x1, y0], fill=(200, 16, 46), width=rw)
    # St George cross
    cw = max(2, min(w, h) // 5)
    d.rectangle([x0 + w // 2 - cw // 2, y0, x0 + w // 2 + cw // 2, y1], fill=WHITE)
    d.rectangle([x0, y0 + h // 2 - cw // 2, x1, y0 + h // 2 + cw // 2], fill=WHITE)
    rw2 = max(1, cw // 2)
    d.rectangle([x0 + w // 2 - rw2 // 2, y0, x0 + w // 2 + rw2 // 2, y1], fill=(200, 16, 46))
    d.rectangle([x0, y0 + h // 2 - rw2 // 2, x1, y0 + h // 2 + rw2 // 2], fill=(200, 16, 46))


def draw_flag(d, box, key):
    """Simplified recognizable flags."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d.rectangle([x0, y0, x1, y1], outline=(120, 120, 120), width=1)

    def mid():
        return (x0 + x1) // 2, (y0 + y1) // 2

    if key == "jp":
        d.rectangle([x0, y0, x1, y1], fill=WHITE)
        cx, cy = mid()
        r = min(w, h) // 4
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(188, 0, 45))
    elif key == "cn":
        d.rectangle([x0, y0, x1, y1], fill=(222, 41, 16))
        # simple yellow star block
        s = max(2, min(w, h) // 8)
        d.rectangle([x0 + w // 8, y0 + h // 8, x0 + w // 8 + s * 2, y0 + h // 8 + s * 2], fill=(255, 222, 0))
    elif key == "in":
        hstripes(d, box, [(255, 153, 51), WHITE, (18, 136, 7)])
        cx, cy = mid()
        r = min(w, h) // 8
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 0, 128), width=max(1, w // 30))
    elif key == "ir":
        hstripes(d, box, [(35, 159, 64), WHITE, (218, 0, 0)])
        cx, cy = mid()
        # red diamond for national emblem (simplified)
        r = max(3, min(w, h) // 6)
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=(218, 0, 0))
    elif key == "sa":
        d.rectangle([x0, y0, x1, y1], fill=(0, 84, 48))
        # white emblem band so it is not mistaken for Oceania bar color
        d.rectangle([x0 + w // 6, y0 + h // 3, x1 - w // 6, y1 - h // 3], fill=WHITE)
    elif key == "ru":
        hstripes(d, box, [WHITE, (0, 57, 166), (213, 43, 30)])
    elif key == "de":
        hstripes(d, box, [(0, 0, 0), (221, 0, 0), (255, 206, 0)])
    elif key == "gb":
        draw_union_jack(d, box)
    elif key == "fr":
        vstripes(d, box, [(0, 85, 164), WHITE, (239, 65, 53)])
    elif key == "it":
        vstripes(d, box, [(0, 146, 70), WHITE, (206, 43, 55)])
    elif key == "eg":
        hstripes(d, box, [(206, 17, 38), WHITE, (0, 0, 0)])
        cx, cy = mid()
        r = max(2, min(w, h) // 9)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 205, 0))
    elif key == "ma":
        d.rectangle([x0, y0, x1, y1], fill=(193, 39, 45))
        cx, cy = mid()
        # Morocco: green outlined pentagram (not a filled blob)
        r = min(w, h) * 0.32
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rad = r if i % 2 == 0 else r * 0.38
            pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
        d.line(pts + [pts[0]], fill=(0, 98, 51), width=max(2, min(w, h) // 12))
    elif key == "ng":
        vstripes(d, box, [(0, 135, 81), WHITE, (0, 135, 81)])
    elif key == "za":
        d.rectangle([x0, y0, x1, y1], fill=(0, 119, 73))
        d.polygon([(x0, y0), (x0 + w // 2, (y0 + y1) // 2), (x0, y1)], fill=(0, 0, 0))
        d.polygon([(x0, y0 + h // 6), (x0 + w // 3, (y0 + y1) // 2), (x0, y1 - h // 6)], fill=(255, 184, 28))
        d.rectangle([x0 + w // 2, y0, x1, y0 + h // 3], fill=(222, 56, 49))
        d.rectangle([x0 + w // 2, y1 - h // 3, x1, y1], fill=(0, 20, 137))
    elif key == "ar":
        hstripes(d, box, [(116, 172, 223), WHITE, (116, 172, 223)])
        cx, cy = mid()
        r = min(w, h) // 10
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(246, 180, 30))
    elif key == "cl":
        d.rectangle([x0, y0, x1, y0 + h // 2], fill=WHITE)
        d.rectangle([x0, y0 + h // 2, x1, y1], fill=(213, 43, 30))
        d.rectangle([x0, y0, x0 + w // 3, y0 + h // 2], fill=(0, 57, 166))
    elif key == "br":
        d.rectangle([x0, y0, x1, y1], fill=(0, 156, 59))
        cx, cy = mid()
        d.polygon(
            [(cx, y0 + h // 6), (x1 - w // 8, cy), (cx, y1 - h // 6), (x0 + w // 8, cy)],
            fill=(255, 223, 0),
        )
        r = min(w, h) // 7
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 39, 118))
    elif key == "cu":
        hstripes(d, box, [(0, 56, 147), WHITE, (0, 56, 147), WHITE, (0, 56, 147)])
        d.polygon([(x0, y0), (x0 + w // 2, (y0 + y1) // 2), (x0, y1)], fill=(204, 41, 54))
    elif key == "pa":
        d.rectangle([x0, y0, x0 + w // 2, y0 + h // 2], fill=WHITE)
        d.rectangle([x0 + w // 2, y0, x1, y0 + h // 2], fill=(218, 41, 28))
        d.rectangle([x0, y0 + h // 2, x0 + w // 2, y1], fill=(0, 82, 147))
        d.rectangle([x0 + w // 2, y0 + h // 2, x1, y1], fill=WHITE)
    elif key == "cr":
        hstripes(d, box, [(0, 43, 127), WHITE, (206, 17, 38), WHITE, (0, 43, 127)])
    elif key == "mx":
        vstripes(d, box, [(0, 104, 71), WHITE, (206, 17, 38)])
        cx, cy = mid()
        # emblem nearly fills the white stripe (real seal is large)
        r = max(5, int(min(w / 3 * 0.48, h * 0.38)))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(139, 90, 43))  # brownish seal disc
        d.ellipse(
            [cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55],
            fill=(206, 17, 38),
        )
    elif key == "us":
        d.rectangle([x0, y0, x1, y1], fill=(178, 34, 52))
        for i in range(7):
            yy = y0 + h * i // 7
            if i % 2 == 0:
                d.rectangle([x0, yy, x1, y0 + h * (i + 1) // 7], fill=(178, 34, 52))
            else:
                d.rectangle([x0, yy, x1, y0 + h * (i + 1) // 7], fill=WHITE)
        d.rectangle([x0, y0, x0 + w * 2 // 5, y0 + h * 4 // 7], fill=(60, 59, 110))
    elif key == "ca":
        d.rectangle([x0, y0, x1, y1], fill=WHITE)
        d.rectangle([x0, y0, x0 + w // 4, y1], fill=(255, 0, 0))
        d.rectangle([x1 - w // 4, y0, x1, y1], fill=(255, 0, 0))
        cx, cy = mid()
        d.polygon([(cx, y0 + h // 5), (cx + w // 10, cy), (cx, y1 - h // 5), (cx - w // 10, cy)], fill=(255, 0, 0))
    elif key == "nz":
        # Navy blue + Union Jack + Southern Cross as red 5-point stars (white outline)
        d.rectangle([x0, y0, x1, y1], fill=(0, 36, 125))
        jack = (x0, y0, x0 + w // 2, y0 + h // 2)
        draw_union_jack(d, jack)
        cross = [
            (x0 + w * 0.72, y0 + h * 0.20, 0.11),  # top
            (x0 + w * 0.88, y0 + h * 0.40, 0.09),  # right
            (x0 + w * 0.70, y0 + h * 0.72, 0.10),  # bottom
            (x0 + w * 0.56, y0 + h * 0.46, 0.08),  # left
        ]
        for sx, sy, rr in cross:
            rad = min(w, h) * rr
            draw_star(d, sx, sy, rad * 1.15, WHITE, points=5)
            draw_star(d, sx, sy, rad, (200, 16, 46), points=5)
    elif key == "au":
        # Darker blue + Union Jack + large Commonwealth star + Southern Cross (white)
        d.rectangle([x0, y0, x1, y1], fill=(0, 0, 139))
        jack = (x0, y0, x0 + w // 2, y0 + h // 2)
        draw_union_jack(d, jack)
        # Commonwealth star under jack
        cx = x0 + w * 0.25
        cy = y0 + h * 0.72
        draw_star(d, cx, cy, min(w, h) * 0.12, WHITE, points=7)
        # Southern Cross white stars on fly
        cross = [
            (x0 + w * 0.72, y0 + h * 0.18),
            (x0 + w * 0.88, y0 + h * 0.38),
            (x0 + w * 0.70, y0 + h * 0.70),
            (x0 + w * 0.58, y0 + h * 0.42),
            (x0 + w * 0.78, y0 + h * 0.48),  # epsilon
        ]
        for i, (sx, sy) in enumerate(cross):
            rr = max(1, min(w, h) // (11 if i < 4 else 16))
            draw_star(d, sx, sy, rr, WHITE, points=5)
    elif key == "fj":
        # Light cyan + Union Jack + simple shield on fly
        d.rectangle([x0, y0, x1, y1], fill=(121, 173, 236))
        jack = (x0, y0, x0 + w // 2, y0 + h // 2)
        draw_union_jack(d, jack)
        sx0 = x0 + w * 0.58
        sy0 = y0 + h * 0.35
        sx1 = x0 + w * 0.92
        sy1 = y0 + h * 0.88
        d.rectangle([sx0, sy0, sx1, sy1], fill=WHITE, outline=(1, 33, 105), width=max(1, w // 40))
        d.rectangle([sx0, sy0, sx1, sy0 + (sy1 - sy0) // 3], fill=(200, 16, 46))
        d.ellipse(
            [
                (sx0 + sx1) / 2 - (sx1 - sx0) * 0.15,
                (sy0 + sy1) / 2 - (sy1 - sy0) * 0.1,
                (sx0 + sx1) / 2 + (sx1 - sx0) * 0.15,
                (sy0 + sy1) / 2 + (sy1 - sy0) * 0.25,
            ],
            fill=(255, 205, 0),
        )
    else:
        d.rectangle([x0, y0, x1, y1], fill=(200, 200, 200))


def make_property_tile(w, h, zh, en, color, price, flag_key, fonts):
    tile = Image.new("RGB", (w, h), TILE_BG)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)

    bar_h = max(14, int(h * 0.20))
    # flag near top (continent bar is at bottom)
    flag_top = 4
    flag_bot = int(h * 0.42)
    fw = int(w * 0.68)
    fh = max(8, flag_bot - flag_top)
    fx0 = (w - fw) // 2
    draw_flag(d, (fx0, flag_top, fx0 + fw, flag_top + fh), flag_key)

    name_fnt = fonts["name_sm"] if max(len(zh), len(en)) >= 6 else fonts["name"]
    draw_bilingual(
        d,
        (2, int(h * 0.42), w - 2, int(h * 0.68)),
        zh,
        en,
        name_fnt,
        fonts["en"],
    )
    draw_centered(d, (2, int(h * 0.66), w - 2, h - bar_h - 1), price, fonts["price"], (90, 90, 90))

    # continent color bar at bottom
    d.rectangle([1, h - bar_h, w - 2, h - 1], fill=color)
    d.line([1, h - bar_h, w - 2, h - bar_h], fill=LINE, width=1)
    return tile


def make_event_tile(w, h, zh, en, fonts):
    tile = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)
    qfont = font(max(28, int(min(w, h) * 0.42)))
    draw_centered(d, (0, int(h * 0.02), w, int(h * 0.58)), "?", qfont, EVENT_FG)
    draw_bilingual(
        d,
        (2, int(h * 0.58), w - 2, h - 2),
        zh,
        en,
        fonts["name"],
        fonts["en"],
        EVENT_FG,
    )
    return tile


def make_port_tile(w, h, zh, en, fonts):
    """Atlantic port: ship silhouette, not purchasable, fee 400."""
    tile = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)
    black = (0, 0, 0)
    cx, cy = w / 2, h * 0.26
    # hull
    d.polygon(
        [
            (cx - w * 0.34, cy + h * 0.10),
            (cx - w * 0.22, cy + h * 0.22),
            (cx + w * 0.22, cy + h * 0.22),
            (cx + w * 0.34, cy + h * 0.10),
            (cx + w * 0.28, cy + h * 0.02),
            (cx - w * 0.28, cy + h * 0.02),
        ],
        fill=black,
    )
    # cabin + funnel
    d.rectangle([cx - w * 0.10, cy - h * 0.12, cx + w * 0.14, cy + h * 0.02], fill=black)
    d.rectangle([cx + w * 0.02, cy - h * 0.22, cx + w * 0.10, cy - h * 0.12], fill=black)
    # mast
    d.rectangle([cx - w * 0.20, cy - h * 0.20, cx - w * 0.16, cy + h * 0.02], fill=black)
    d.polygon(
        [
            (cx - w * 0.18, cy - h * 0.20),
            (cx - w * 0.04, cy - h * 0.08),
            (cx - w * 0.18, cy - h * 0.06),
        ],
        fill=black,
    )
    # waves
    for i, ox in enumerate((-0.22, 0.0, 0.22)):
        y = cy + h * 0.28
        d.arc(
            [cx + w * ox - w * 0.10, y - h * 0.04, cx + w * ox + w * 0.10, y + h * 0.06],
            200,
            340,
            fill=black,
            width=max(2, w // 40),
        )
    draw_bilingual(
        d,
        (2, int(h * 0.48), w - 2, int(h * 0.68)),
        zh,
        en,
        fonts["name"],
        fonts["en"],
        INK,
    )
    draw_bilingual(
        d,
        (2, int(h * 0.66), w - 2, int(h * 0.84)),
        "大西洋",
        "Atlantic",
        fonts["en"],
        fonts["en"],
        (90, 90, 90),
    )
    draw_bilingual(
        d,
        (2, int(h * 0.82), w - 2, h - 1),
        "互传 400",
        "Transfer 400",
        fonts["price"],
        fonts["en"],
        (90, 90, 90),
    )
    return tile


def draw_corner_icon(d, box, kind):
    """Black silhouette icons for the four corners."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, y0 + h * 0.38
    black = (0, 0, 0)
    if kind == "start":
        # bank / classical facade
        base = cy + h * 0.18
        d.rectangle([cx - w * 0.28, base, cx + w * 0.28, base + h * 0.06], fill=black)
        for i in range(4):
            px = cx - w * 0.22 + i * w * 0.14
            d.rectangle([px, cy - h * 0.02, px + w * 0.05, base], fill=black)
        d.polygon(
            [
                (cx - w * 0.30, cy - h * 0.02),
                (cx, cy - h * 0.20),
                (cx + w * 0.30, cy - h * 0.02),
            ],
            fill=black,
        )
        d.rectangle([cx - w * 0.06, cy + h * 0.04, cx + w * 0.06, base], fill=black)
    elif kind == "airport":
        # airplane top view
        d.polygon(
            [
                (cx, cy - h * 0.22),
                (cx + w * 0.06, cy - h * 0.02),
                (cx + w * 0.32, cy + h * 0.02),
                (cx + w * 0.32, cy + h * 0.08),
                (cx + w * 0.06, cy + h * 0.06),
                (cx + w * 0.05, cy + h * 0.18),
                (cx + w * 0.12, cy + h * 0.22),
                (cx, cy + h * 0.18),
                (cx - w * 0.12, cy + h * 0.22),
                (cx - w * 0.05, cy + h * 0.18),
                (cx - w * 0.06, cy + h * 0.06),
                (cx - w * 0.32, cy + h * 0.08),
                (cx - w * 0.32, cy + h * 0.02),
                (cx - w * 0.06, cy - h * 0.02),
            ],
            fill=black,
        )
    elif kind == "hospital":
        # hospital building + medical cross
        d.rectangle(
            [cx - w * 0.28, cy - h * 0.08, cx + w * 0.28, cy + h * 0.26],
            fill=black,
        )
        d.polygon(
            [
                (cx - w * 0.32, cy - h * 0.08),
                (cx, cy - h * 0.26),
                (cx + w * 0.32, cy - h * 0.08),
            ],
            fill=black,
        )
        # white cross on facade
        d.rectangle(
            [cx - w * 0.05, cy - h * 0.02, cx + w * 0.05, cy + h * 0.18],
            fill=WHITE,
        )
        d.rectangle(
            [cx - w * 0.14, cy + h * 0.04, cx + w * 0.14, cy + h * 0.12],
            fill=WHITE,
        )
        d.rectangle(
            [cx - w * 0.06, cy + h * 0.18, cx + w * 0.06, cy + h * 0.26],
            fill=WHITE,
        )
    else:  # casino — playing cards
        # back card
        d.polygon(
            [
                (cx - w * 0.02, cy - h * 0.16),
                (cx + w * 0.24, cy - h * 0.08),
                (cx + w * 0.18, cy + h * 0.20),
                (cx - w * 0.08, cy + h * 0.12),
            ],
            fill=black,
        )
        # front card
        d.rectangle([cx - w * 0.22, cy - h * 0.14, cx + w * 0.10, cy + h * 0.18], fill=WHITE, outline=black, width=max(2, w // 40))
        d.rectangle([cx - w * 0.20, cy - h * 0.12, cx + w * 0.08, cy + h * 0.16], fill=black)
        # pip
        d.ellipse([cx - w * 0.08, cy - h * 0.02, cx + w * 0.0, cy + h * 0.08], fill=WHITE)


def make_facility_tile(w, h, zh, en, key, fonts):
    """Oil / mine: white card, black silhouette, name + price."""
    tile = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)
    black = (0, 0, 0)
    # icon box (upper area)
    ix0, iy0 = w * 0.14, h * 0.04
    ix1, iy1 = w * 0.86, h * 0.50
    iw, ih = ix1 - ix0, iy1 - iy0
    cx = (ix0 + ix1) / 2

    if key == "oil":
        # classic oil derrick (井架) silhouette
        top = iy0 + ih * 0.02
        mid = iy0 + ih * 0.55
        base = iy0 + ih * 0.82
        ground = iy0 + ih * 0.92
        # A-frame legs
        d.polygon(
            [
                (cx - iw * 0.04, top),
                (cx + iw * 0.04, top),
                (cx + iw * 0.28, base),
                (cx + iw * 0.18, base),
                (cx + iw * 0.02, top + ih * 0.12),
                (cx - iw * 0.02, top + ih * 0.12),
                (cx - iw * 0.18, base),
                (cx - iw * 0.28, base),
            ],
            fill=black,
        )
        # cross beams
        for t in (0.28, 0.45, 0.62):
            y = iy0 + ih * t
            half = iw * (0.06 + 0.18 * ((y - top) / max(1, base - top)))
            d.rectangle([cx - half, y - ih * 0.025, cx + half, y + ih * 0.025], fill=black)
        # crown block
        d.rectangle([cx - iw * 0.07, top, cx + iw * 0.07, top + ih * 0.08], fill=black)
        # drill stem
        d.rectangle([cx - iw * 0.035, mid, cx + iw * 0.035, ground], fill=black)
        # platform
        d.rectangle([cx - iw * 0.36, base - ih * 0.02, cx + iw * 0.36, base + ih * 0.08], fill=black)
        # ground pad
        d.rectangle([cx - iw * 0.42, ground - ih * 0.02, cx + iw * 0.42, ground + ih * 0.06], fill=black)
    else:
        # mountain + pickaxe striking it
        ground = iy0 + ih * 0.90
        # mountain mass
        d.polygon(
            [
                (ix0 + iw * 0.02, ground),
                (ix0 + iw * 0.22, iy0 + ih * 0.38),
                (ix0 + iw * 0.38, iy0 + ih * 0.52),
                (ix0 + iw * 0.52, iy0 + ih * 0.22),
                (ix0 + iw * 0.72, iy0 + ih * 0.48),
                (ix0 + iw * 0.88, ground),
            ],
            fill=black,
        )
        # pickaxe: handle from upper-right into mountain face
        # handle
        hx0, hy0 = ix0 + iw * 0.78, iy0 + ih * 0.08
        hx1, hy1 = ix0 + iw * 0.42, iy0 + ih * 0.48
        # thick handle as polygon along the shaft
        ang = math.atan2(hy1 - hy0, hx1 - hx0)
        nx, ny = -math.sin(ang) * iw * 0.035, math.cos(ang) * iw * 0.035
        d.polygon(
            [
                (hx0 + nx, hy0 + ny),
                (hx0 - nx, hy0 - ny),
                (hx1 - nx, hy1 - ny),
                (hx1 + nx, hy1 + ny),
            ],
            fill=black,
        )
        # pick head (锄头) at contact point
        px, py = hx1, hy1
        d.polygon(
            [
                (px - iw * 0.02, py - ih * 0.02),
                (px + iw * 0.16, py - ih * 0.18),
                (px + iw * 0.20, py - ih * 0.10),
                (px + iw * 0.04, py + ih * 0.04),
                (px - iw * 0.14, py + ih * 0.16),
                (px - iw * 0.18, py + ih * 0.08),
            ],
            fill=black,
        )

    draw_bilingual(
        d,
        (2, int(h * 0.52), w - 2, int(h * 0.78)),
        zh,
        en,
        fonts["name"],
        fonts["en"],
        INK,
    )
    draw_centered(d, (2, int(h * 0.78), w - 2, h - 2), "1000", fonts["price"], (90, 90, 90))
    return tile


def make_mafia_tile(w, h, zh, en, fonts):
    """White card: classic mafia black silhouette + bilingual name."""
    tile = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)

    # silhouette region (upper ~58%)
    sx0, sy0 = int(w * 0.18), int(h * 0.04)
    sx1, sy1 = int(w * 0.82), int(h * 0.56)
    sw, sh = sx1 - sx0, sy1 - sy0
    cx = (sx0 + sx1) / 2
    black = (0, 0, 0)

    # fedora brim
    brim_y = sy0 + sh * 0.22
    d.ellipse(
        [cx - sw * 0.42, brim_y - sh * 0.04, cx + sw * 0.42, brim_y + sh * 0.08],
        fill=black,
    )
    # fedora crown
    d.ellipse(
        [cx - sw * 0.28, sy0 + sh * 0.02, cx + sw * 0.28, brim_y + sh * 0.02],
        fill=black,
    )
    d.rectangle(
        [cx - sw * 0.26, sy0 + sh * 0.10, cx + sw * 0.26, brim_y],
        fill=black,
    )
    # head
    head_top = brim_y + sh * 0.02
    head_bot = sy0 + sh * 0.48
    d.ellipse(
        [cx - sw * 0.20, head_top, cx + sw * 0.20, head_bot],
        fill=black,
    )
    # coat / shoulders
    coat_top = sy0 + sh * 0.42
    d.polygon(
        [
            (cx - sw * 0.48, sy1),
            (cx - sw * 0.38, coat_top),
            (cx - sw * 0.12, coat_top + sh * 0.06),
            (cx, coat_top + sh * 0.02),
            (cx + sw * 0.12, coat_top + sh * 0.06),
            (cx + sw * 0.38, coat_top),
            (cx + sw * 0.48, sy1),
        ],
        fill=black,
    )
    # lapel notch (white cut so coat reads as suit)
    d.polygon(
        [
            (cx - sw * 0.02, coat_top + sh * 0.04),
            (cx - sw * 0.14, sy1),
            (cx + sw * 0.14, sy1),
            (cx + sw * 0.02, coat_top + sh * 0.04),
        ],
        fill=WHITE,
    )
    # restore center torso strip
    d.polygon(
        [
            (cx - sw * 0.06, coat_top + sh * 0.08),
            (cx - sw * 0.08, sy1),
            (cx + sw * 0.08, sy1),
            (cx + sw * 0.06, coat_top + sh * 0.08),
        ],
        fill=black,
    )

    draw_bilingual(
        d,
        (2, int(h * 0.58), w - 2, h - 2),
        zh,
        en,
        fonts["name"],
        fonts["en"],
        INK,
    )
    return tile


def main():
    board_size = 1400
    legend_band = 56
    margin = 40
    img = Image.new("RGB", (board_size, board_size + legend_band), WOOD)
    draw = ImageDraw.Draw(img)
    size = board_size  # board geometry stays square
    board = (margin, margin, size - margin, size - margin)
    draw.rectangle(board, fill=(217, 199, 168), outline=(120, 90, 55), width=4)

    inner = margin + 4
    outer = size - margin - 4
    cell = (outer - inner) / 12

    fonts = {
        "title": font(36),
        "name": font(14),
        "name_sm": font(11),
        "en": font(10),
        "price": font(11),
        "event": font(40),
        "corner": font(16),
        "corner_en": font(11),
        "legend": font(16),
        "small": font(12),
    }

    def cell_box(col, row):
        x0 = int(inner + col * cell)
        y0 = int(inner + row * cell)
        x1 = int(inner + (col + 1) * cell)
        y1 = int(inner + (row + 1) * cell)
        return x0, y0, x1, y1

    def paste(col, row, tile_img):
        x0, y0, x1, y1 = cell_box(col, row)
        img.paste(tile_img.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS), (x0, y0))

    def paste_corner(col, row, zh, en, kind, start=False):
        x0, y0, x1, y1 = cell_box(col, row)
        fill = START_BG if start else WHITE
        draw.rectangle([x0, y0, x1, y1], fill=fill, outline=LINE, width=2)
        icon_bot = y0 + (y1 - y0) * 0.52
        draw_corner_icon(draw, (x0, y0, x1, icon_bot), kind)
        label_fill = (74, 47, 0) if start else INK
        if start:
            draw_bilingual(
                draw,
                (x0, icon_bot - 2, x1, y1 - (y1 - y0) * 0.16),
                zh,
                en,
                fonts["small"],
                fonts["corner_en"],
                label_fill,
            )
            draw_centered(
                draw,
                (x0, y1 - (y1 - y0) * 0.18, x1, y1),
                "↑ 顺时针 CW",
                fonts["corner_en"],
                label_fill,
            )
        else:
            draw_bilingual(
                draw,
                (x0, icon_bot - 2, x1, y1),
                zh,
                en,
                fonts["corner"],
                fonts["corner_en"],
                label_fill,
            )

    def paste_side_tile(col, row, tile):
        x0, y0, x1, y1 = cell_box(col, row)
        w, h = x1 - x0, y1 - y0
        kind, zh, en, color, price, flag_key = tile
        if kind == "event":
            paste(col, row, make_event_tile(w, h, zh, en, fonts))
        elif kind == "mafia":
            paste(col, row, make_mafia_tile(w, h, zh, en, fonts))
        elif kind == "facility":
            paste(col, row, make_facility_tile(w, h, zh, en, flag_key, fonts))
        elif kind == "port":
            paste(col, row, make_port_tile(w, h, zh, en, fonts))
        else:
            paste(col, row, make_property_tile(w, h, zh, en, color, price, flag_key, fonts))

    # 角格：银行（起点）左下，顺时针 机场→医院→赌场
    paste_corner(0, 11, "银行（起点）", "Bank (GO)", "start", start=True)
    paste_corner(0, 0, "机场", "Airport", "airport")
    paste_corner(11, 0, "医院", "Hospital", "hospital")
    paste_corner(11, 11, "赌场", "Casino", "casino")

    for i, tile in enumerate(LEFT):
        paste_side_tile(0, 10 - i, tile)
    for i, tile in enumerate(TOP):
        paste_side_tile(1 + i, 0, tile)
    for i, tile in enumerate(RIGHT):
        paste_side_tile(11, 1 + i, tile)
    for i, tile in enumerate(BOTTOM):
        paste_side_tile(10 - i, 11, tile)

    c1 = cell_box(1, 1)
    c2 = cell_box(10, 10)
    center = (c1[0] + 6, c1[1] + 6, c2[2] - 6, c2[3] - 6)
    cx0, cy0, cx1, cy1 = center
    # soft center plaza
    draw.rectangle(center, fill=CENTER_BG, outline=TRACK_INFIELD_LINE, width=2)

    # Horizontal stadium: 21 near-equal squares (side length S)
    # top/bottom: exact axis-aligned squares; caps: equal angles ≈ S mid-arc
    cw, ch = cx1 - cx0, cy1 - cy0
    n_st = 6
    n_right = 5
    n_left = 4
    n_cells = 2 * n_st + n_right + n_left  # 21
    assert n_cells == 21

    # Upper plaza reserved for HUD; track sits in the lower band
    hud_band_h = ch * 0.38
    track_top = cy0 + hud_band_h
    track_bot = cy1 - 8
    track_h = track_bot - track_top

    # Fit square size S into plaza width + lower band height
    r_mid_over_s = ((n_right + n_left) / 2) / math.pi  # ≈ 1.432
    r_out_over_s = r_mid_over_s + 0.5
    tw_over_s = n_st + 2 * r_out_over_s
    th_over_s = 2 * r_out_over_s
    s_from_w = (cw * 0.92) / tw_over_s
    s_from_h = (track_h * 0.94) / th_over_s
    S = min(s_from_w, s_from_h)
    lane = S
    r_out = r_out_over_s * S
    r_in = r_out - lane
    r_mid = (r_out + r_in) / 2
    straight = n_st * S
    tw = straight + 2 * r_out
    th = 2 * r_out
    ox0 = (cx0 + cx1) / 2 - tw / 2
    oy0 = track_top + (track_h - th) / 2  # vertically center track in lower band
    cx_l = ox0 + r_out
    cx_r = ox0 + r_out + straight
    cy = oy0 + r_out

    # --- Filled HUD mock (upper center plaza) ---
    hud = (cx0 + 12, cy0 + 10, cx1 - 12, track_top - 8)
    hx0, hy0, hx1, hy1 = hud
    hw, hh = hx1 - hx0, hy1 - hy0
    draw.rounded_rectangle(
        [hx0, hy0, hx1, hy1],
        radius=10,
        fill=(252, 250, 245),
        outline=(150, 165, 180),
        width=2,
    )

    def hud_text(xy, text, fnt, fill=(40, 50, 60), anchor="lt"):
        draw.text(xy, text, font=fnt, fill=fill)

    f_title = font(13, prefer=[str(FONTS_DIR / "NotoSansSC-Bold.otf")])
    f_en = fonts["en"]
    f_tiny = font(10, prefer=[str(FONTS_DIR / "NotoSansSC-Regular.otf")])
    f_num = font(18, prefer=[str(FONTS_DIR / "Cinzel-Bold.ttf")])
    f_btn = font(12, prefer=[str(FONTS_DIR / "NotoSansSC-Bold.otf")])

    # Title strip
    hud_text((hx0 + 12, hy0 + 6), "花花世界  Vivondo", f_title, (55, 70, 90))
    hud_text((hx1 - 200, hy0 + 8), "回合 Turn 3 · 蓝方 Blue", f_en, (90, 110, 130))

    # Player cards row
    players = [
        ((40, 110, 200), "蓝 Blue", "¥4820", "机 船 免", True),
        ((200, 55, 55), "红 Red", "¥3150", "机", False),
        ((40, 140, 70), "绿 Green", "¥2680", "免", False),
        ((210, 170, 40), "黄 Yellow", "¥5010", "船", False),
    ]
    pc_y0 = hy0 + 28
    pc_h = max(44, int(hh * 0.28))
    pc_gap = 8
    pc_w = (hw - 20 - pc_gap * 3) / 4
    for i, (col, name, cash, toks, active) in enumerate(players):
        x0 = hx0 + 10 + i * (pc_w + pc_gap)
        x1 = x0 + pc_w
        y1 = pc_y0 + pc_h
        bg = (236, 244, 252) if active else (245, 245, 242)
        outline = col if active else (190, 195, 200)
        draw.rounded_rectangle([x0, pc_y0, x1, y1], radius=6, fill=bg, outline=outline, width=2 if active else 1)
        draw.ellipse([x0 + 6, pc_y0 + 8, x0 + 18, pc_y0 + 20], fill=col)
        hud_text((x0 + 24, pc_y0 + 6), name, f_en, (40, 50, 60))
        hud_text((x0 + 8, pc_y0 + 22), cash, f_btn, (30, 90, 50))
        hud_text((x0 + 8, pc_y0 + 36), toks, f_tiny, (80, 90, 100))
        if active:
            hud_text((x1 - 36, pc_y0 + 6), "行动", f_tiny, col)

    # Mid row: turn / dice / pot
    mid_y0 = pc_y0 + pc_h + 8
    mid_h = max(52, int(hh * 0.30))
    mid_y1 = mid_y0 + mid_h
    # Turn panel
    t0, t1 = hx0 + 10, hx0 + 10 + hw * 0.34
    draw.rounded_rectangle([t0, mid_y0, t1, mid_y1], radius=6, fill=(255, 255, 255), outline=(175, 185, 195), width=1)
    hud_text((t0 + 10, mid_y0 + 6), "阶段 Phase", f_tiny, (110, 120, 130))
    hud_text((t0 + 10, mid_y0 + 20), "⑤ 经营窗口", f_btn, (40, 55, 75))
    hud_text((t0 + 10, mid_y0 + 36), "Build / Specialize", f_tiny, (100, 110, 120))
    # Dice panel
    d0, d1 = t1 + 8, t1 + 8 + hw * 0.22
    draw.rounded_rectangle([d0, mid_y0, d1, mid_y1], radius=6, fill=(255, 255, 255), outline=(175, 185, 195), width=1)
    hud_text((d0 + 10, mid_y0 + 4), "骰子 Dice", f_tiny, (110, 120, 130))
    # die face
    die = 22
    dx = (d0 + d1) / 2 - die / 2
    dy = mid_y0 + 20
    draw.rounded_rectangle([dx, dy, dx + die, dy + die], radius=4, fill=(250, 250, 250), outline=(40, 40, 40), width=2)
    # pips for 5
    pip = 2.2
    for px, py in (
        (dx + 6, dy + 6),
        (dx + die - 6, dy + 6),
        (dx + die / 2, dy + die / 2),
        (dx + 6, dy + die - 6),
        (dx + die - 6, dy + die - 6),
    ):
        draw.ellipse([px - pip, py - pip, px + pip, py + pip], fill=(30, 30, 30))
    # Pot panel
    p0, p1 = d1 + 8, hx1 - 10
    draw.rounded_rectangle([p0, mid_y0, p1, mid_y1], radius=6, fill=(255, 248, 235), outline=(210, 170, 100), width=1)
    hud_text((p0 + 12, mid_y0 + 6), "赌场奖池 Casino Pot", f_tiny, (140, 100, 40))
    hud_text((p0 + 12, mid_y0 + 22), "¥ 800", f_num, (160, 90, 20))
    hud_text((p0 + 100, mid_y0 + 28), "GM 托管 · Auto bank", f_tiny, (130, 110, 80))

    # Action buttons
    btn_y0 = mid_y1 + 8
    btn_y1 = hy1 - 8
    btns = [
        ("掷骰", "Roll", (40, 110, 200), True),
        ("买地", "Buy", (40, 140, 90), True),
        ("加盖", "Build", (90, 90, 140), True),
        ("机场", "Fly", (70, 120, 160), False),
        ("港口", "Port", (70, 120, 160), False),
        ("结束", "End", (140, 80, 80), True),
    ]
    bgap = 6
    bw = (hw - 20 - bgap * (len(btns) - 1)) / len(btns)
    for i, (zh, en, col, on) in enumerate(btns):
        x0 = hx0 + 10 + i * (bw + bgap)
        x1 = x0 + bw
        fill = col if on else (200, 205, 210)
        draw.rounded_rectangle([x0, btn_y0, x1, btn_y1], radius=6, fill=fill, outline=(50, 50, 50), width=1)
        # bilingual centered roughly
        draw_bilingual(
            draw,
            (x0, btn_y0, x1, btn_y1),
            zh,
            en,
            f_btn,
            f_tiny,
            (255, 255, 255) if on else (90, 90, 90),
        )

    boundaries = []
    for i in range(n_st):
        boundaries.append(("top", i / n_st, (i + 1) / n_st))
    for i in range(n_right):
        boundaries.append(("right", i / n_right, (i + 1) / n_right))
    for i in range(n_st):
        boundaries.append(("bottom", i / n_st, (i + 1) / n_st))
    for i in range(n_left):
        boundaries.append(("left", i / n_left, (i + 1) / n_left))

    def cell_poly(kind, u0, u1):
        if kind == "top":
            x0 = cx_l + u0 * straight
            x1 = cx_l + u1 * straight
            return [
                (x0, cy - r_out), (x1, cy - r_out),
                (x1, cy - r_in), (x0, cy - r_in),
            ]
        if kind == "bottom":
            x0 = cx_r - u0 * straight
            x1 = cx_r - u1 * straight
            return [
                (x0, cy + r_out), (x1, cy + r_out),
                (x1, cy + r_in), (x0, cy + r_in),
            ]
        steps = 16
        outer, inner = [], []
        for k in range(steps + 1):
            u = u0 + (u1 - u0) * k / steps
            if kind == "right":
                ang = -math.pi / 2 + u * math.pi
                ox = cx_r + r_out * math.cos(ang)
                oy = cy + r_out * math.sin(ang)
                ix = cx_r + r_in * math.cos(ang)
                iy = cy + r_in * math.sin(ang)
            else:
                ang = math.pi / 2 + u * math.pi
                ox = cx_l + r_out * math.cos(ang)
                oy = cy + r_out * math.sin(ang)
                ix = cx_l + r_in * math.cos(ang)
                iy = cy + r_in * math.sin(ang)
            outer.append((ox, oy))
            inner.append((ix, iy))
        return outer + list(reversed(inner))

    def cell_mid(kind, u0, u1):
        u = (u0 + u1) / 2
        if kind == "top":
            return cx_l + u * straight, cy - r_mid
        if kind == "bottom":
            return cx_r - u * straight, cy + r_mid
        if kind == "right":
            ang = -math.pi / 2 + u * math.pi
            return cx_r + r_mid * math.cos(ang), cy + r_mid * math.sin(ang)
        ang = math.pi / 2 + u * math.pi
        return cx_l + r_mid * math.cos(ang), cy + r_mid * math.sin(ang)

    def point_in_poly(x, y, poly):
        inside = False
        n = len(poly)
        j = n - 1
        for i in range(n):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
                inside = not inside
            j = i
        return inside

    def fill_checkered_poly(poly, n_x=6, n_y=4):
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        minx, maxx = min(xs), max(xs)
        miny, maxy = min(ys), max(ys)
        dx = (maxx - minx) / n_x
        dy = (maxy - miny) / n_y
        draw.polygon(poly, fill=(245, 245, 245), outline=(90, 90, 90))
        for ix in range(n_x):
            for iy in range(n_y):
                if (ix + iy) % 2 == 0:
                    continue
                x0 = minx + ix * dx
                y0 = miny + iy * dy
                if point_in_poly((x0 + dx / 2), (y0 + dy / 2), poly):
                    draw.rectangle([x0, y0, x0 + dx, y0 + dy], fill=(18, 18, 18))
        draw.polygon(poly, outline=(90, 90, 90))

    event_cycle = ("cash", "foot", "cash", "gun")
    cell_kinds = ["start"] + [event_cycle[i % 4] for i in range(20)]

    def draw_track_icon(kind, mx, my, ink, scale):
        s = scale
        if kind == "start":
            # checkered cell alone marks start/finish — no text
            return
        elif kind == "cash":
            # banknote + coin
            draw.rectangle(
                [mx - s * 0.72, my - s * 0.38, mx + s * 0.72, my + s * 0.38],
                outline=ink,
                width=max(2, int(s * 0.12)),
            )
            draw.ellipse(
                [mx - s * 0.26, my - s * 0.26, mx + s * 0.26, my + s * 0.26],
                outline=ink,
                width=max(2, int(s * 0.10)),
            )
            draw.rectangle(
                [mx - s * 0.10, my - s * 0.18, mx + s * 0.10, my + s * 0.18],
                fill=ink,
            )
        elif kind == "foot":
            # clearer shoe-print: elongated sole + heel + 5 toes
            sole = [
                (mx - s * 0.18, my + s * 0.48),
                (mx + s * 0.22, my + s * 0.48),
                (mx + s * 0.32, my + s * 0.10),
                (mx + s * 0.28, my - s * 0.18),
                (mx + s * 0.05, my - s * 0.28),
                (mx - s * 0.22, my - s * 0.18),
                (mx - s * 0.30, my + s * 0.08),
            ]
            draw.polygon(sole, fill=ink)
            draw.ellipse(
                [mx - s * 0.20, my + s * 0.28, mx + s * 0.24, my + s * 0.62],
                fill=ink,
            )
            toes = [
                (-0.30, -0.42, 0.11),
                (-0.12, -0.52, 0.12),
                (0.08, -0.54, 0.11),
                (0.26, -0.46, 0.10),
                (0.40, -0.32, 0.09),
            ]
            for ox, oy, rr in toes:
                draw.ellipse(
                    [
                        mx + s * (ox - rr),
                        my + s * (oy - rr),
                        mx + s * (ox + rr),
                        my + s * (oy + rr),
                    ],
                    fill=ink,
                )
        else:
            # clearer side-view semi-auto pistol
            # barrel + slide
            draw.rounded_rectangle(
                [mx - s * 0.10, my - s * 0.30, mx + s * 0.78, my - s * 0.02],
                radius=max(1, int(s * 0.06)),
                fill=ink,
            )
            # rear sight bump
            draw.rectangle(
                [mx - s * 0.02, my - s * 0.38, mx + s * 0.12, my - s * 0.28],
                fill=ink,
            )
            # front sight
            draw.rectangle(
                [mx + s * 0.62, my - s * 0.38, mx + s * 0.72, my - s * 0.28],
                fill=ink,
            )
            # frame under slide
            draw.rectangle(
                [mx - s * 0.28, my - s * 0.08, mx + s * 0.20, my + s * 0.12],
                fill=ink,
            )
            # trigger
            draw.ellipse(
                [mx - s * 0.08, my + s * 0.02, mx + s * 0.10, my + s * 0.28],
                outline=ink,
                width=max(2, int(s * 0.10)),
            )
            draw.rectangle(
                [mx - s * 0.02, my + s * 0.08, mx + s * 0.06, my + s * 0.22],
                fill=ink,
            )
            # grip
            draw.polygon(
                [
                    (mx - s * 0.28, my + s * 0.08),
                    (mx - s * 0.02, my + s * 0.08),
                    (mx - s * 0.12, my + s * 0.62),
                    (mx - s * 0.42, my + s * 0.58),
                ],
                fill=ink,
            )
            # magazine base
            draw.rectangle(
                [mx - s * 0.38, my + s * 0.52, mx - s * 0.10, my + s * 0.66],
                fill=ink,
            )

    for i, (seg, u0, u1) in enumerate(boundaries):
        poly = cell_poly(seg, u0, u1)
        kind = cell_kinds[i]
        if kind == "start":
            fill_checkered_poly(poly)
        else:
            dark = i % 2 == 1
            fill = (18, 18, 18) if dark else (245, 245, 245)
            draw.polygon(poly, fill=fill, outline=(110, 110, 110))

    draw.ellipse([cx_l - r_in, cy - r_in, cx_l + r_in, cy + r_in], fill=TRACK_INFIELD)
    draw.ellipse([cx_r - r_in, cy - r_in, cx_r + r_in, cy + r_in], fill=TRACK_INFIELD)
    draw.rectangle([cx_l, cy - r_in, cx_r, cy + r_in], fill=TRACK_INFIELD)

    # Title in racetrack infield (dark green): 花花世界 + Vivondo
    title_cx = (cx_l + cx_r) / 2
    title_cy = cy
    zh_font = font(42, prefer=[str(FONTS_DIR / "NotoSansSC-Bold.otf")])
    en_font = font(28, prefer=[str(FONTS_DIR / "Cinzel-Bold.ttf"), str(FONTS_DIR / "PlayfairDisplay-Bold.ttf")])
    title_fill = (252, 248, 230)
    for text, fnt, dy in (
        ("花花世界", zh_font, -22),
        ("Vivondo", en_font, 22),
    ):
        bb = draw.textbbox((0, 0), text, font=fnt)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        draw.text(
            (title_cx - tw / 2, title_cy + dy - th / 2 - bb[1]),
            text,
            font=fnt,
            fill=title_fill,
        )

    for i, (seg, u0, u1) in enumerate(boundaries):
        kind = cell_kinds[i]
        mx, my = cell_mid(seg, u0, u1)
        if kind == "start":
            ink = (20, 20, 20)
        else:
            dark = i % 2 == 1
            ink = (255, 255, 255) if dark else (20, 20, 20)
        draw_track_icon(kind, mx, my, ink, S * 0.40)

    # (no caption under track — checkered start cell is enough)

    legend = [
        (ASIA, "亚洲", "Asia"),
        (EUROPE, "欧洲", "Europe"),
        (AFRICA, "非洲", "Africa"),
        (SA, "南美", "S.America"),
        (CA, "中美", "C.America"),
        (NA, "北美", "N.America"),
        (OCEANIA, "大洋洲", "Oceania"),
        (EVENT_FG, "事件", "Event"),
    ]
    ly = size + 10
    lx = 36
    for i, (col, zh, en) in enumerate(legend):
        x = lx + i * 168
        if zh == "事件":
            draw.rectangle([x, ly + 4, x + 14, ly + 14], fill=WHITE, outline=LINE)
            draw.text((x + 3, ly), "?", font=fonts["small"], fill=EVENT_FG)
        else:
            draw.rectangle([x, ly + 4, x + 14, ly + 14], fill=col, outline=LINE)
        draw.text((x + 20, ly), zh, font=fonts["small"], fill=INK)
        draw.text((x + 20, ly + 14), en, font=fonts["en"], fill=(90, 90, 90))

    props = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "property")
    events = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "event")
    mafias = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "mafia")
    facilities = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "facility")
    ports = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "port")
    non_prop = ("event", "mafia", "facility", "port")
    specials = {
        "LEFT": sum(1 for t in LEFT if t[0] in non_prop),
        "TOP": sum(1 for t in TOP if t[0] in non_prop),
        "RIGHT": sum(1 for t in RIGHT if t[0] in non_prop),
        "BOTTOM": sum(1 for t in BOTTOM if t[0] in non_prop),
    }
    events_per_side = {
        "LEFT": sum(1 for t in LEFT if t[0] == "event"),
        "TOP": sum(1 for t in TOP if t[0] == "event"),
        "RIGHT": sum(1 for t in RIGHT if t[0] == "event"),
        "BOTTOM": sum(1 for t in BOTTOM if t[0] == "event"),
    }
    assert props == 26 and events == 8 and mafias == 2 and facilities == 2 and ports == 2
    assert specials == {"LEFT": 3, "TOP": 4, "RIGHT": 3, "BOTTOM": 4}
    assert all(v <= 2 for v in events_per_side.values())
    assert LEFT[5][0] == "facility" and LEFT[5][5] == "oil"
    assert RIGHT[4][0] == "facility" and RIGHT[4][5] == "mine"
    assert TOP[1][0] == "port" and BOTTOM[1][0] == "port"
    assert TOP[3][0] == "property" and TOP[4][0] == "mafia" and TOP[5][0] == "event"
    assert BOTTOM[3][0] == "property" and BOTTOM[4][0] == "mafia" and BOTTOM[5][0] == "event"
    img.save(OUT, "PNG")
    print(
        f"Wrote {OUT} props={props} events={events} mafia={mafias} "
        f"facilities={facilities} ports={ports} specials={specials} track_cells={n_cells}"
    )


if __name__ == "__main__":
    main()
