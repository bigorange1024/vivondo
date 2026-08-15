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
  source: "e18" | "debt";
  /** Opening 2d6 results (after tie breaks), for UI/log. */
  rolls: Record<string, number>;
}

function roll2d6(): number {
  return (
    1 +
    Math.floor(Math.random() * 6) +
    (1 + Math.floor(Math.random() * 6))
  );
}

/**
 * Bid order: each rolls 2d6, higher first.
 * Ties re-roll only within the tied group (R-017-C1).
 */
export function resolveBidOrder(playerIds: string[]): {
  order: string[];
  rolls: Record<string, number>;
} {
  if (playerIds.length === 0) return { order: [], rolls: {} };
  if (playerIds.length === 1) {
    const id = playerIds[0]!;
    const roll = roll2d6();
    return { order: [id], rolls: { [id]: roll } };
  }

  const rolls: Record<string, number> = {};
  for (const id of playerIds) rolls[id] = roll2d6();

  let guard = 0;
  while (guard++ < 50) {
    const sorted = [...playerIds].sort(
      (a, b) => rolls[b]! - rolls[a]! || a.localeCompare(b),
    );
    let tiedStart = -1;
    let tiedEnd = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (rolls[sorted[i]!] === rolls[sorted[i + 1]!]) {
        tiedStart = i;
        tiedEnd = i + 1;
        while (
          tiedEnd + 1 < sorted.length &&
          rolls[sorted[tiedEnd + 1]!] === rolls[sorted[tiedStart]!]
        ) {
          tiedEnd += 1;
        }
        break;
      }
    }
    if (tiedStart < 0) {
      return { order: sorted, rolls: { ...rolls } };
    }
    for (let i = tiedStart; i <= tiedEnd; i++) {
      rolls[sorted[i]!] = roll2d6();
    }
  }

  const order = [...playerIds].sort(
    (a, b) => rolls[b]! - rolls[a]! || a.localeCompare(b),
  );
  return { order, rolls: { ...rolls } };
}

export function createAuction(input: {
  tileIndex: number;
  sellerId: string;
  price: number;
  bidderIds: string[];
  source: "e18" | "debt";
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
