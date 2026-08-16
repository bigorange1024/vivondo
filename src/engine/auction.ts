/** R-017-C auction helpers (GM-hosted). */

export interface AuctionState {
  tileIndex: number;
  /** Original owner (does not bid). */
  sellerId: string;
  facePrice: number;
  startPrice: number;
  buyoutPrice: number;
  /** Highest accepted bid; 0 = no qualifying bid yet. */
  currentBid: number;
  highBidderId: string | null;
  /** Bid order (eligible players only), first acts first. */
  order: string[];
  /** Still participating (not passed). */
  activeIds: string[];
  /** Index into `order` for whose action is next. */
  cursor: number;
  source: "e18" | "debt" | "estate";
  /** Opening 2d6 results (after tie breaks), for UI/log. */
  rolls: Record<string, number>;
}

export function roll2d6Pair(): [number, number] {
  return [
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
  ];
}

function roll2d6(): number {
  const [a, b] = roll2d6Pair();
  return a + b;
}

/**
 * Order by 2d6 (higher first).
 * Same total forms a band: only those players re-roll among themselves until unique.
 * Playoff rolls never leap past players in other bands (R-004 / R-017-C1).
 *
 * Example: A=7, B=8, C=8, D=10 → bands D | B,C | A; B↔C playoff only → D→B→C→A or D→C→B→A.
 */
export function resolveDiceOrder(playerIds: string[]): {
  order: string[];
  /** Initial 2d6 that decide bands vs everyone else. */
  initialRolls: Record<string, number>;
  /** Display rolls: playoff result within a band, else initial. */
  rolls: Record<string, number>;
} {
  if (playerIds.length === 0) {
    return { order: [], initialRolls: {}, rolls: {} };
  }
  if (playerIds.length === 1) {
    const id = playerIds[0]!;
    const roll = roll2d6();
    return {
      order: [id],
      initialRolls: { [id]: roll },
      rolls: { [id]: roll },
    };
  }

  const initialRolls: Record<string, number> = {};
  for (const id of playerIds) initialRolls[id] = roll2d6();

  const bandScores = [...new Set(Object.values(initialRolls))].sort(
    (a, b) => b - a,
  );
  const order: string[] = [];
  const rolls: Record<string, number> = { ...initialRolls };

  for (const score of bandScores) {
    let group = playerIds.filter((id) => initialRolls[id] === score);
    if (group.length === 1) {
      order.push(group[0]!);
      continue;
    }

    // Pairwise / group playoffs — re-roll only still-tied members inside this band
    const playoff: Record<string, number> = {};
    for (const id of group) playoff[id] = roll2d6();

    let guard = 0;
    while (guard++ < 50) {
      const byVal = new Map<number, string[]>();
      for (const id of group) {
        const v = playoff[id]!;
        const list = byVal.get(v);
        if (list) list.push(id);
        else byVal.set(v, [id]);
      }
      let anyTie = false;
      for (const [, ids] of byVal) {
        if (ids.length > 1) {
          anyTie = true;
          for (const id of ids) playoff[id] = roll2d6();
        }
      }
      if (!anyTie) break;
    }

    group = [...group].sort(
      (a, b) => playoff[b]! - playoff[a]! || a.localeCompare(b),
    );
    for (const id of group) {
      rolls[id] = playoff[id]!;
      order.push(id);
    }
  }

  return { order, initialRolls, rolls };
}

/**
 * Bid order: each rolls 2d6, higher first.
 * Ties re-roll only within the tied band (R-017-C1).
 */
export function resolveBidOrder(playerIds: string[]): {
  order: string[];
  rolls: Record<string, number>;
} {
  const { order, rolls } = resolveDiceOrder(playerIds);
  return { order, rolls };
}

export function createAuction(input: {
  tileIndex: number;
  sellerId: string;
  price: number;
  bidderIds: string[];
  source: "e18" | "debt" | "estate";
}): AuctionState {
  const { order, rolls } = resolveBidOrder(input.bidderIds);
  return {
    tileIndex: input.tileIndex,
    sellerId: input.sellerId,
    facePrice: input.price,
    startPrice: input.price * 2,
    buyoutPrice: input.price * 10,
    currentBid: 0,
    highBidderId: null,
    order,
    activeIds: [...order],
    cursor: 0,
    source: input.source,
    rolls,
  };
}

export function syncAuctionCursor(auction: AuctionState): AuctionState {
  if (auction.order.length === 0) return auction;
  for (let step = 0; step < auction.order.length; step++) {
    const i = (auction.cursor + step) % auction.order.length;
    const id = auction.order[i]!;
    if (auction.activeIds.includes(id)) {
      return { ...auction, cursor: i };
    }
  }
  return auction;
}

export function currentAuctionActor(auction: AuctionState): string | null {
  const synced = syncAuctionCursor(auction);
  if (synced.activeIds.length === 0) return null;
  return synced.order[synced.cursor] ?? null;
}

export function minNextBid(auction: AuctionState): number {
  if (auction.currentBid <= 0) return auction.startPrice;
  return auction.currentBid + 50;
}

export type AuctionActionResult =
  | { type: "continue"; auction: AuctionState }
  | {
      type: "sold";
      auction: AuctionState;
      buyerId: string;
      salePrice: number;
    }
  | { type: "passedIn"; auction: AuctionState }
  | { type: "reject"; reason: string };

function advanceAfterAction(auction: AuctionState): AuctionState {
  const nextCursor = (auction.cursor + 1) % Math.max(auction.order.length, 1);
  return syncAuctionCursor({ ...auction, cursor: nextCursor });
}

export function auctionPlaceBid(
  auction: AuctionState,
  playerId: string,
  amount: number,
  cash: number,
): AuctionActionResult {
  const synced = syncAuctionCursor(auction);
  const actor = currentAuctionActor(synced);
  if (actor !== playerId) {
    return { type: "reject", reason: "不是你的出价回合" };
  }
  let bid = amount;
  const min = minNextBid(synced);
  if (bid < min) {
    return { type: "reject", reason: `出价至少 ${min}` };
  }
  if (bid > synced.buyoutPrice) bid = synced.buyoutPrice;
  if (cash < bid) {
    return { type: "reject", reason: "现金不足" };
  }

  let next: AuctionState = {
    ...synced,
    currentBid: bid,
    highBidderId: playerId,
  };

  if (bid >= synced.buyoutPrice) {
    return {
      type: "sold",
      auction: next,
      buyerId: playerId,
      salePrice: synced.buyoutPrice,
    };
  }

  next = advanceAfterAction(next);
  return { type: "continue", auction: next };
}

export function auctionBuyout(
  auction: AuctionState,
  playerId: string,
  cash: number,
): AuctionActionResult {
  return auctionPlaceBid(auction, playerId, auction.buyoutPrice, cash);
}

export function auctionPass(
  auction: AuctionState,
  playerId: string,
): AuctionActionResult {
  const synced = syncAuctionCursor(auction);
  const actor = currentAuctionActor(synced);
  if (actor !== playerId) {
    return { type: "reject", reason: "不是你的出价回合" };
  }

  let activeIds = synced.activeIds.filter((id) => id !== playerId);
  let next: AuctionState = { ...synced, activeIds };

  // Winning bidder passes → drop their bid
  if (next.highBidderId === playerId) {
    next = { ...next, currentBid: 0, highBidderId: null };
  }

  if (activeIds.length === 0) {
    if (next.highBidderId && next.currentBid > 0) {
      return {
        type: "sold",
        auction: next,
        buyerId: next.highBidderId,
        salePrice: next.currentBid,
      };
    }
    return { type: "passedIn", auction: next };
  }

  // Only high bidder remains
  if (
    next.highBidderId &&
    activeIds.length === 1 &&
    activeIds[0] === next.highBidderId
  ) {
    return {
      type: "sold",
      auction: next,
      buyerId: next.highBidderId,
      salePrice: next.currentBid,
    };
  }

  // No bid yet and people still active — continue
  if (next.currentBid <= 0 && activeIds.length > 0) {
    next = advanceAfterAction(next);
    return { type: "continue", auction: next };
  }

  next = advanceAfterAction(next);
  return { type: "continue", auction: next };
}
