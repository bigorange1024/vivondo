/** Ring board geometry — matches assets/render_board_v7.py */

export type TileKind =
  | "corner"
  | "property"
  | "event"
  | "casinoEntrance"
  | "facility"
  | "port";

export interface BoardTile {
  index: number;
  kind: TileKind;
  zh: string;
  en: string;
  /** Grid col/row on 12×12 outer frame (0..11) */
  col: number;
  row: number;
  price?: number;
  rent?: number;
  continent?: string;
}

type SideSpec = [TileKind, string, string, number?, number?, string?];

const LEFT: SideSpec[] = [
  ["property", "日本", "Japan", 560, 70, "asia"],
  ["property", "中国", "China", 580, 75, "asia"],
  ["event", "事件", "Event"],
  ["property", "印度", "India", 460, 60, "asia"],
  ["property", "伊朗", "Iran", 360, 45, "asia"],
  ["facility", "油田", "Oil Field", 1000],
  ["property", "沙特", "Saudi Arabia", 440, 55, "asia"],
  ["property", "俄罗斯", "Russia", 400, 50, "europe"],
  ["event", "事件", "Event"],
  ["property", "德国", "Germany", 560, 70, "europe"],
];

const TOP: SideSpec[] = [
  ["property", "英国", "UK", 540, 70, "europe"],
  ["port", "利物浦港", "Port of Liverpool", 1000],
  ["property", "法国", "France", 560, 70, "europe"],
  ["property", "意大利", "Italy", 440, 55, "europe"],
  ["casinoEntrance", "蒙特卡洛赌城", "Monte Carlo"],
  ["event", "事件", "Event"],
  ["property", "埃及", "Egypt", 240, 30, "africa"],
  ["property", "摩洛哥", "Morocco", 210, 25, "africa"],
  ["event", "事件", "Event"],
  ["property", "尼日利亚", "Nigeria", 200, 25, "africa"],
];

const RIGHT: SideSpec[] = [
  ["property", "南非", "South Africa", 220, 30, "africa"],
  ["event", "事件", "Event"],
  ["property", "阿根廷", "Argentina", 320, 40, "sa"],
  ["property", "智利", "Chile", 300, 40, "sa"],
  ["facility", "矿山", "Mine", 1000],
  ["property", "巴西", "Brazil", 420, 55, "sa"],
  ["property", "古巴", "Cuba", 250, 30, "ca"],
  ["event", "事件", "Event"],
  ["property", "巴拿马", "Panama", 280, 35, "ca"],
  ["property", "哥斯达黎加", "Costa Rica", 260, 35, "ca"],
];

const BOTTOM: SideSpec[] = [
  ["property", "墨西哥", "Mexico", 410, 50, "na"],
  ["port", "哈利法克斯港", "Port of Halifax", 1000],
  ["property", "加拿大", "Canada", 520, 65, "na"],
  ["property", "美国", "USA", 600, 75, "na"],
  ["casinoEntrance", "拉斯维加斯赌城", "Las Vegas"],
  ["event", "事件", "Event"],
  ["property", "新西兰", "New Zealand", 400, 50, "oceania"],
  ["property", "澳大利亚", "Australia", 510, 65, "oceania"],
  ["event", "事件", "Event"],
  ["property", "斐济", "Fiji", 180, 20, "oceania"],
];

function sideTile(
  index: number,
  col: number,
  row: number,
  spec: SideSpec,
): BoardTile {
  const [kind, zh, en, price, rent, continent] = spec;
  return { index, kind, zh, en, col, row, price, rent, continent };
}

/** Clockwise from Bank (GO) at bottom-left. Length 44. */
export function buildBoardTiles(): BoardTile[] {
  const tiles: BoardTile[] = [];
  let i = 0;

  tiles.push({
    index: i++,
    kind: "corner",
    zh: "银行（起点）",
    en: "Bank (GO)",
    col: 0,
    row: 11,
  });

  for (let s = 0; s < LEFT.length; s++) {
    tiles.push(sideTile(i++, 0, 10 - s, LEFT[s]!));
  }

  tiles.push({
    index: i++,
    kind: "corner",
    zh: "机场",
    en: "Airport",
    col: 0,
    row: 0,
  });

  for (let s = 0; s < TOP.length; s++) {
    tiles.push(sideTile(i++, 1 + s, 0, TOP[s]!));
  }

  tiles.push({
    index: i++,
    kind: "corner",
    zh: "医院",
    en: "Hospital",
    col: 11,
    row: 0,
  });

  for (let s = 0; s < RIGHT.length; s++) {
    tiles.push(sideTile(i++, 11, 1 + s, RIGHT[s]!));
  }

  tiles.push({
    index: i++,
    kind: "corner",
    zh: "证券交易所",
    en: "Stock Exchange",
    col: 11,
    row: 11,
  });

  for (let s = 0; s < BOTTOM.length; s++) {
    tiles.push(sideTile(i++, 10 - s, 11, BOTTOM[s]!));
  }

  if (tiles.length !== 44) {
    throw new Error(`Expected 44 tiles, got ${tiles.length}`);
  }
  return tiles;
}

export const BOARD_TILE_COUNT = 44;

/** Board PNG is 1400×1484 (square board + legend). Playable grid is 1400×1400. */
export const BOARD_PNG = {
  width: 1400,
  height: 1484,
  playSize: 1400,
  margin: 44,
  cell: (1400 - 88) / 12,
} as const;

export function tileCenterPercent(tile: BoardTile): { x: number; y: number } {
  const { margin, cell, playSize } = BOARD_PNG;
  const cx = margin + (tile.col + 0.5) * cell;
  const cy = margin + (tile.row + 0.5) * cell;
  return {
    x: (cx / playSize) * 100,
    y: (cy / playSize) * 100,
  };
}

export const CONTINENT_COLORS: Record<string, string> = {
  asia: "#c62828",
  europe: "#0d47a1",
  africa: "#ef6c00",
  sa: "#8e74c8",
  ca: "#455a64",
  na: "#81d4fa",
  oceania: "#00a86b",
};

/** Legend swatches under the board — matches assets/render_board_v7.py. */
export const LEGEND_CONTINENTS = [
  { id: "asia", zh: "亚洲" },
  { id: "europe", zh: "欧洲" },
  { id: "africa", zh: "非洲" },
  { id: "sa", zh: "南美" },
  { id: "ca", zh: "中美" },
  { id: "na", zh: "北美" },
  { id: "oceania", zh: "大洋洲" },
] as const;

/** Color swatch box for a legend continent (% of full board PNG). */
export function legendContinentSwatchPercent(legendIndex: number): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { width, height, playSize } = BOARD_PNG;
  const lx = 28;
  const ly = playSize + 14;
  const sw = 26;
  const step = 172;
  const x = lx + legendIndex * step;
  const y = ly + 6;
  return {
    left: (x / width) * 100,
    top: (y / height) * 100,
    width: (sw / width) * 100,
    height: (sw / height) * 100,
  };
}

/** Bottom-right rules button slot (% of full board PNG). */
export function legendRulesButtonPercent(): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { width, height, playSize } = BOARD_PNG;
  const btnW = 108;
  const btnH = 52;
  const rightPad = 18;
  const topPad = 16;
  return {
    left: ((width - rightPad - btnW) / width) * 100,
    top: ((playSize + topPad) / height) * 100,
    width: (btnW / width) * 100,
    height: (btnH / height) * 100,
  };
}

/** Full tile face box (% of play area), matching render_board_v7 gap. */
export function tileRectPercent(tile: BoardTile): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { margin, cell, playSize } = BOARD_PNG;
  const gap = 3;
  const x0 = margin + tile.col * cell + gap;
  const y0 = margin + tile.row * cell + gap;
  const tw = cell - gap * 2;
  const th = cell - gap * 2;
  return {
    left: (x0 / playSize) * 100,
    top: (y0 / playSize) * 100,
    width: (tw / playSize) * 100,
    height: (th / playSize) * 100,
  };
}

/** Continent color bar at bottom of a property tile (% of play area). Matches render_board_v7. */
export function tileContinentBarPercent(tile: BoardTile): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const rect = tileRectPercent(tile);
  const { cell, playSize } = BOARD_PNG;
  const gap = 3;
  const th = cell - gap * 2;
  const barH = Math.max(14, Math.floor(th * 0.2));
  const barHPct = (barH / playSize) * 100;
  return {
    left: rect.left + (1 / playSize) * 100,
    top: rect.top + rect.height - barHPct,
    width: rect.width - (2 / playSize) * 100,
    height: barHPct,
  };
}
