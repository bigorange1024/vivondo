# -*- coding: utf-8 -*-
"""Generate accurate board-map PNG with real national flags."""
import math
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "board-map-v7.png"
FONTS_DIR = ROOT / "fonts"
# Single flag source shared with the Vite app (HUD LocFlag).
FLAGS_DIR = ROOT.parent / "public" / "flags"
ICONS_DIR = ROOT / "icons"


def _load_icon(name: str) -> Image.Image:
    return Image.open(ICONS_DIR / f"{name}.png").convert("RGBA")


# Board-tile icons (see assets/import_icons.py)
ICONS = {
    name: _load_icon(name)
    for name in (
        "horse-head",
        "horse-head-dark",
        "oil",
        "mine",
        "ship",
        "airport",
        "hospital",
        "exchange",
        "bank",
        "cards",
        "chips",
        "cash",
        "cash-dark",
        "slot",
        "slot-dark",
    )
}

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
TILE_EDGE = (28, 28, 28)  # bold cell outline
TILE_GAP = 3  # half-gap per side → ~6px between adjacent cells
TILE_EDGE_W = 3
START_BG = (232, 168, 56)
CENTER_BG = (220, 230, 240)  # 雾蓝广场，避免 Monopoly 式绿心
TRACK_INFIELD = (90, 130, 95)  # 跑马场内圈深绿
TRACK_INFIELD_LINE = (140, 160, 175)  # 广场描边偏蓝灰
WOOD = (228, 211, 184)
INK = (42, 42, 42)

# (kind, zh, en, color, price, flag_key)
# 顺时针自左下起点：左边→顶边→右边→底边
# 每边最多 2 个 E；意/美后「赌城入口 + E」；伊朗后石油、智利后矿山；英/墨后大西洋港口
LEFT = [
    ("property", "日本", "Japan", ASIA, "560/70", "jp"),
    ("property", "中国", "China", ASIA, "580/75", "cn"),
    ("event", "事件", "Event", None, "", None),
    ("property", "印度", "India", ASIA, "460/60", "in"),
    ("property", "伊朗", "Iran", ASIA, "360/45", "ir"),
    ("facility", "油田", "Oil Field", None, "1000", "oil"),
    ("property", "沙特", "Saudi Arabia", ASIA, "440/55", "sa"),
    ("property", "俄罗斯", "Russia", EUROPE, "400/50", "ru"),
    ("event", "事件", "Event", None, "", None),
    ("property", "德国", "Germany", EUROPE, "560/70", "de"),
]
TOP = [
    ("property", "英国", "UK", EUROPE, "540/70", "gb"),
    ("port", "利物浦港", "Port of Liverpool", None, "1000", "port_n"),
    ("property", "法国", "France", EUROPE, "560/70", "fr"),
    ("property", "意大利", "Italy", EUROPE, "440/55", "it"),
    ("casinoEntrance", "蒙特卡洛赌城", "Monte Carlo", None, "", "cards"),
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
    ("port", "哈利法克斯港", "Port of Halifax", None, "1000", "port_s"),
    ("property", "加拿大", "Canada", NA, "520/65", "ca"),
    ("property", "美国", "USA", NA, "600/75", "us"),
    ("casinoEntrance", "拉斯维加斯赌城", "Las Vegas", None, "", "chips"),
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


def paste_flag(tile: Image.Image, box, key: str):
    """Paste a real national flag PNG into the tile box (cover + thin border)."""
    x0, y0, x1, y1 = [int(v) for v in box]
    tw, th = max(1, x1 - x0), max(1, y1 - y0)
    path = FLAGS_DIR / f"{key}.png"
    d = ImageDraw.Draw(tile)
    if not path.exists():
        d.rectangle([x0, y0, x1, y1], fill=(200, 200, 200), outline=(120, 120, 120), width=1)
        return
    flag = Image.open(path).convert("RGBA")
    fw, fh = flag.size
    # Cover the box while preserving aspect ratio, then center-crop
    scale = max(tw / fw, th / fh)
    nw, nh = max(1, int(fw * scale + 0.5)), max(1, int(fh * scale + 0.5))
    flag = flag.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2)
    top = max(0, (nh - th) // 2)
    flag = flag.crop((left, top, left + tw, top + th))
    if flag.mode == "RGBA":
        base = Image.new("RGB", flag.size, TILE_BG)
        base.paste(flag, mask=flag.split()[3])
        tile.paste(base, (x0, y0))
    else:
        tile.paste(flag.convert("RGB"), (x0, y0))
    d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(120, 120, 120), width=1)


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
    paste_flag(tile, (fx0, flag_top, fx0 + fw, flag_top + fh), flag_key)

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



def fit_icon(icon: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Scale icon to fit inside max box, preserving aspect."""
    iw, ih = icon.size
    if iw <= 0 or ih <= 0:
        return icon
    scale = min(max_w / iw, max_h / ih)
    tw = max(1, int(iw * scale))
    th = max(1, int(ih * scale))
    return icon.resize((tw, th), Image.Resampling.LANCZOS)


def paste_icon(canvas: Image.Image, icon: Image.Image, box, margin: float = 0.08) -> None:
    """Center-paste RGBA icon into box on RGB/RGBA canvas."""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    fitted = fit_icon(
        icon,
        max(1, int(bw * (1 - 2 * margin))),
        max(1, int(bh * (1 - 2 * margin))),
    )
    px = int(x0 + (bw - fitted.width) / 2)
    py = int(y0 + (bh - fitted.height) / 2)
    canvas.paste(fitted, (px, py), fitted)


def make_port_tile(w, h, zh, en, price_label, fonts):
    """Named port: ship icon + zh/en labels + purchase price."""
    scale = 2
    W, H = w * scale, h * scale
    tile = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, W - 1, H - 1], outline=LINE, width=max(2, scale))
    # Larger ship icon (top ~38% of tile)
    paste_icon(tile, ICONS["ship"], (W * 0.06, H * 0.02, W * 0.94, H * 0.38), margin=0.04)

    tile = tile.resize((w, h), Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(tile)

    def line_at(y, text, fnt, fill):
        bb = d.textbbox((0, 0), text, font=fnt)
        tw = bb[2] - bb[0]
        d.text(((w - tw) / 2, y - bb[1]), text, font=fnt, fill=fill)

    # Names sit lower under the large icon; keep icon size unchanged
    y0 = int(h * 0.50)
    step = max(10, int(h * 0.092))
    line_at(y0, zh, fonts["name_sm"], INK)
    if en.lower().startswith("port of "):
        line_at(y0 + step, "Port of", fonts["en"], INK)
        line_at(y0 + step * 2, en[8:].strip(), fonts["en"], INK)
    else:
        line_at(y0 + step, en, fonts["en"], INK)
    draw_centered(
        d,
        (1, int(h * 0.88), w - 1, h - 2),
        price_label or "1000",
        fonts["price"],
        (90, 90, 90),
    )
    return tile


def draw_corner_icon(d, box, kind, canvas=None):
    """Corner tile icons from AI assets (bank / airport / hospital / exchange)."""
    if canvas is None:
        return
    key = {
        "start": "bank",
        "airport": "airport",
        "hospital": "hospital",
        "exchange": "exchange",
    }.get(kind, "exchange")
    # Exchange: slightly inset after tight crop
    margin = 0.07 if kind in ("exchange", "casino") else 0.10
    paste_icon(canvas, ICONS[key], box, margin=margin)


def make_facility_tile(w, h, zh, en, key, fonts):
    """Oil / mine: white card, AI silhouette, name + price."""
    scale = 2
    W, H = w * scale, h * scale
    tile = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, W - 1, H - 1], outline=LINE, width=max(2, scale))
    icon_key = "oil" if key == "oil" else "mine"
    paste_icon(tile, ICONS[icon_key], (W * 0.06, H * 0.02, W * 0.94, H * 0.52), margin=0.05)

    tile = tile.resize((w, h), Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(tile)
    name_zh = fonts["name_sm"] if len(zh) >= 4 else fonts["name"]
    draw_bilingual(
        d,
        (2, int(h * 0.52), w - 2, int(h * 0.78)),
        zh,
        en,
        name_zh,
        fonts["en"],
        INK,
        gap=0,
    )
    draw_centered(d, (2, int(h * 0.78), w - 2, h - 2), "1000", fonts["price"], (90, 90, 90))
    return tile


def make_casino_entrance_tile(w, h, zh, en, fonts, icon="cards"):
    """White card: poker cards (Monte Carlo) or chips (Las Vegas) + bilingual name."""
    tile = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, w - 1, h - 1], outline=LINE, width=2)
    key = "chips" if icon == "chips" else "cards"
    # Cards need a larger footprint; chips keep a bit more padding
    if key == "cards":
        paste_icon(tile, ICONS[key], (w * 0.06, h * 0.02, w * 0.94, h * 0.58), margin=0.06)
        text_top = int(h * 0.58)
    else:
        paste_icon(tile, ICONS[key], (w * 0.08, h * 0.02, w * 0.92, h * 0.56), margin=0.04)
        text_top = int(h * 0.56)

    name_zh = fonts["name_sm"] if len(zh) >= 5 else fonts["name"]
    draw_bilingual(
        d,
        (2, text_top, w - 2, h - 2),
        zh,
        en,
        name_zh,
        fonts["en"],
        INK,
        gap=0,
    )
    return tile


def main():
    board_size = 1400
    legend_band = 84
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
        "legend": font(18),
        "legend_en": font(14),
        "small": font(12),
    }

    def cell_box(col, row):
        x0 = int(inner + col * cell)
        y0 = int(inner + row * cell)
        x1 = int(inner + (col + 1) * cell)
        y1 = int(inner + (row + 1) * cell)
        return x0, y0, x1, y1

    def tile_box(col, row):
        """Inset content so neighboring tiles are separated by a visible gap."""
        x0, y0, x1, y1 = cell_box(col, row)
        g = TILE_GAP
        return x0 + g, y0 + g, x1 - g, y1 - g

    def stroke_tile(x0, y0, x1, y1):
        draw.rectangle(
            [x0, y0, x1 - 1, y1 - 1],
            outline=TILE_EDGE,
            width=TILE_EDGE_W,
        )

    def paste(col, row, tile_img):
        x0, y0, x1, y1 = tile_box(col, row)
        img.paste(
            tile_img.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS),
            (x0, y0),
        )
        stroke_tile(x0, y0, x1, y1)

    def paste_corner(col, row, zh, en, kind, start=False):
        x0, y0, x1, y1 = tile_box(col, row)
        fill = START_BG if start else WHITE
        draw.rectangle([x0, y0, x1, y1], fill=fill)
        stroke_tile(x0, y0, x1, y1)
        icon_bot = y0 + (y1 - y0) * (0.56 if kind in ("exchange", "casino") else 0.52)
        draw_corner_icon(draw, (x0, y0, x1, icon_bot), kind, canvas=img)
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
        x0, y0, x1, y1 = tile_box(col, row)
        w, h = x1 - x0, y1 - y0
        kind, zh, en, color, price, flag_key = tile
        if kind == "event":
            paste(col, row, make_event_tile(w, h, zh, en, fonts))
        elif kind == "casinoEntrance":
            paste(col, row, make_casino_entrance_tile(w, h, zh, en, fonts, flag_key or "cards"))
        elif kind == "facility":
            paste(col, row, make_facility_tile(w, h, zh, en, flag_key, fonts))
        elif kind == "port":
            paste(col, row, make_port_tile(w, h, zh, en, price, fonts))
        else:
            paste(col, row, make_property_tile(w, h, zh, en, color, price, flag_key, fonts))

    # 角格：银行（起点）左下，顺时针 机场→医院→证券交易所
    paste_corner(0, 11, "银行（起点）", "Bank (GO)", "start", start=True)
    paste_corner(0, 0, "机场", "Airport", "airport")
    paste_corner(11, 0, "医院", "Hospital", "hospital")
    paste_corner(11, 11, "证券交易所", "Stock Exch.", "casino")

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

    # Upper plaza reserved for HUD; track sits lower so it clears the HUD
    hud_band_h = ch * 0.47
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

    # Upper plaza stays plain CENTER_BG — live React HUD overlays it (no baked mock).

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
            return
        dark_cell = ink in ((255, 255, 255), WHITE)
        if kind == "cash":
            icon = ICONS["cash-dark" if dark_cell else "cash"]
            # Wide banknote — width-based, mid size (between prior too-big / too-small)
            tw = max(18, int(s * 1.42))
            th = max(12, int(tw * icon.height / icon.width))
        elif kind == "foot":
            icon = ICONS["horse-head-dark" if dark_cell else "horse-head"]
            th = max(22, int(s * 1.55))
            tw = max(14, int(th * icon.width / icon.height))
        else:
            icon = ICONS["slot-dark" if dark_cell else "slot"]
            th = max(22, int(s * 1.55))
            tw = max(14, int(th * icon.width / icon.height))
        icon = icon.resize((tw, th), Image.Resampling.LANCZOS)
        img.paste(icon, (int(mx - tw / 2), int(my - th / 2)), icon)

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
    ly = size + 14
    lx = 28
    sw = 26
    for i, (col, zh, en) in enumerate(legend):
        x = lx + i * 172
        if zh == "事件":
            draw.rectangle([x, ly + 6, x + sw, ly + 6 + sw], fill=WHITE, outline=LINE, width=2)
            qf = font(20, prefer=[str(FONTS_DIR / "NotoSansSC-Bold.otf")])
            qb = draw.textbbox((0, 0), "?", font=qf)
            draw.text(
                (x + (sw - (qb[2] - qb[0])) / 2, ly + 6 + (sw - (qb[3] - qb[1])) / 2 - qb[1]),
                "?",
                font=qf,
                fill=EVENT_FG,
            )
        else:
            draw.rectangle([x, ly + 6, x + sw, ly + 6 + sw], fill=col, outline=LINE, width=2)
        draw.text((x + sw + 10, ly + 2), zh, font=fonts["legend"], fill=INK)
        draw.text((x + sw + 10, ly + 28), en, font=fonts["legend_en"], fill=(90, 90, 90))

    props = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "property")
    events = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "event")
    casinoEntrances = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "casinoEntrance")
    facilities = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "facility")
    ports = sum(1 for t in BOTTOM + LEFT + TOP + RIGHT if t[0] == "port")
    non_prop = ("event", "casinoEntrance", "facility", "port")
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
    assert props == 26 and events == 8 and casinoEntrances == 2 and facilities == 2 and ports == 2
    assert specials == {"LEFT": 3, "TOP": 4, "RIGHT": 3, "BOTTOM": 4}
    assert all(v <= 2 for v in events_per_side.values())
    assert LEFT[5][0] == "facility" and LEFT[5][5] == "oil"
    assert RIGHT[4][0] == "facility" and RIGHT[4][5] == "mine"
    assert TOP[1][0] == "port" and BOTTOM[1][0] == "port"
    assert TOP[3][0] == "property" and TOP[4][0] == "casinoEntrance" and TOP[5][0] == "event"
    assert BOTTOM[3][0] == "property" and BOTTOM[4][0] == "casinoEntrance" and BOTTOM[5][0] == "event"
    img.save(OUT, "PNG")
    print(
        f"Wrote {OUT} props={props} events={events} casinoEntrance={casinoEntrances} "
        f"facilities={facilities} ports={ports} specials={specials} track_cells={n_cells}"
    )


if __name__ == "__main__":
    main()
