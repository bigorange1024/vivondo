import type { BoardTile } from "./board";

export type SpecialKind = "industry" | "commerce" | "tourism";

export interface DeedState {
  ownerId: string | null;
  houses: number;
  special: SpecialKind | null;
}

export function emptyDeeds(tiles: BoardTile[]): Record<number, DeedState> {
  const deeds: Record<number, DeedState> = {};
  for (const t of tiles) {
    if (t.kind === "property" || t.kind === "facility" || t.kind === "port") {
      deeds[t.index] = { ownerId: null, houses: 0, special: null };
    }
  }
  return deeds;
}

export function ownsContinent(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
  continent: string,
): boolean {
  const props = tiles.filter(
    (t) => t.kind === "property" && t.continent === continent,
  );
  if (props.length === 0) return false;
  return props.every((t) => deeds[t.index]?.ownerId === ownerId);
}

/** Owner who fully controls a continent, or null. */
export function continentControllerId(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  continent: string,
): string | null {
  const props = tiles.filter(
    (t) => t.kind === "property" && t.continent === continent,
  );
  if (props.length === 0) return null;
  const ownerId = deeds[props[0]!.index]?.ownerId ?? null;
  if (!ownerId) return null;
  return ownsContinent(tiles, deeds, ownerId, continent) ? ownerId : null;
}

export function completeContinentCount(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
): number {
  const continents = new Set(
    tiles
      .filter((t) => t.kind === "property" && t.continent)
      .map((t) => t.continent!),
  );
  let n = 0;
  for (const c of continents) {
    if (ownsContinent(tiles, deeds, ownerId, c)) n += 1;
  }
  return n;
}

export function playerOwnsFacility(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
  zh: "油田" | "矿山",
): boolean {
  return tiles.some(
    (t) =>
      t.kind === "facility" &&
      t.zh === zh &&
      deeds[t.index]?.ownerId === ownerId,
  );
}

/** How many Atlantic ports this player owns (0–2). */
export function ownedPortCount(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
): number {
  return tiles.filter(
    (t) => t.kind === "port" && deeds[t.index]?.ownerId === ownerId,
  ).length;
}

/** Landlord bonus for visiting own port: 20 if 1 port, 50 if 2. */
export function portVisitBonus(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
): number {
  const n = ownedPortCount(tiles, deeds, ownerId);
  if (n >= 2) return 50;
  if (n === 1) return 20;
  return 0;
}

/** How many tourism specials this player owns. */
export function ownedTourismCount(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
): number {
  return tiles.filter(
    (t) =>
      t.kind === "property" &&
      deeds[t.index]?.ownerId === ownerId &&
      deeds[t.index]?.special === "tourism",
  ).length;
}

/** R-013 receivable rent (before oil / rent-free). tourismDice for tourism tiles. */
export function receivableRent(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  tileIndex: number,
  tourismDice?: number,
): number {
  const tile = tiles[tileIndex];
  const deed = deeds[tileIndex];
  if (!tile || tile.kind !== "property" || !deed?.ownerId) return 0;
  const base = tile.rent ?? 0;

  if (deed.special === "industry") return base * 5;
  if (deed.special === "commerce") {
    const n = completeContinentCount(tiles, deeds, deed.ownerId);
    return base * (3 * n);
  }
  if (deed.special === "tourism") {
    const d = tourismDice ?? 1 + Math.floor(Math.random() * 6);
    const n = Math.min(3, ownedTourismCount(tiles, deeds, deed.ownerId));
    return base * (n + d);
  }

  let rent = base * (1 + deed.houses);
  if (
    tile.continent &&
    ownsContinent(tiles, deeds, deed.ownerId, tile.continent)
  ) {
    rent *= 2;
  }
  return rent;
}

/** R-012 step 3 — oil adjustment on receivable. */
export function applyOilReduction(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  payerId: string,
  tileIndex: number,
  receivable: number,
): number {
  if (!playerOwnsFacility(tiles, deeds, payerId, "油田")) return receivable;
  const tile = tiles[tileIndex]!;
  const deed = deeds[tileIndex]!;
  const base = tile.rent ?? 0;

  if (deed.special == null) {
    return Math.max(0, receivable - 10 * (1 + deed.houses));
  }
  // Commerce with 0 receivable stays 0; otherwise pay face base rent only.
  if (deed.special === "commerce" && receivable === 0) return 0;
  return base;
}

export function upgradeCost(
  tiles: BoardTile[],
  deeds: Record<number, DeedState>,
  ownerId: string,
  tileIndex: number,
): number | null {
  const tile = tiles[tileIndex];
  const deed = deeds[tileIndex];
  if (!tile || tile.kind !== "property" || !deed) return null;
  if (deed.ownerId !== ownerId || deed.special != null) return null;
  const price = tile.price ?? 0;
  const mine = playerOwnsFacility(tiles, deeds, ownerId, "矿山") ? 50 : 0;
  if (deed.houses < 3) return Math.max(0, price - mine);
  return Math.max(0, price * 2 - mine);
}
