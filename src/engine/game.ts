import {
  BOARD_TILE_COUNT,
  buildBoardTiles,
  type BoardTile,
} from "./board";
import {
  applyOilReduction,
  emptyDeeds,
  playerOwnsFacility,
  receivableRent,
  upgradeCost,
  type DeedState,
  type SpecialKind,
} from "./deeds";
import {
  moveOnTrack,
  rollTrackDelta,
  trackCellKind,
  trackCellZh,
} from "./racetrack";
import {
  auctionBuyout as auctionBuyoutCore,
  auctionPass as auctionPassCore,
  auctionPlaceBid,
  createAuction,
  currentAuctionActor,
  minNextBid,
  syncAuctionCursor,
  type AuctionState,
} from "./auction";
import {
  CARD_ZH,
  createEventDeck,
  discardEventCard,
  drawEventCard,
  holdKindOf,
  returnCardToDraw,
  type EventCardId,
  type EventDeckState,
} from "./deck";

export type PlayerKind = "human" | "ai";
export type TurnPhase = "initiative" | "roll" | "settle" | "end";

/** Opening turn-order by interactive two dice (R-004). */
export interface InitiativeState {
  /** Players who still need an initial sum (front = next). */
  pending: string[];
  /** Already placed, high initial first; same-initial pairs are playoff-ordered. */
  placed: { id: string; initial: number }[];
  /** Pairwise playoff when current initial ties someone already placed. */
  playoff: null | {
    ids: [string, string];
    nextId: string;
    round: Partial<Record<string, number>>;
    /** Original tied total — playoff cannot leap other bands. */
    band: number;
  };
  /** First die of the current two-die roll; null = need first click. */
  partialDie: number | null;
}

export type SettlePrompt =
  | { kind: "idle" }
  | { kind: "buy"; tileIndex: number }
  | {
      kind: "upgrade";
      tileIndex: number;
      cost: number;
      mode: "house" | "specialize" | "respecialize";
    }
  | { kind: "airport" }
  | { kind: "airportDest"; free: boolean }
  | { kind: "port" }
  | { kind: "facilityOwn"; tileIndex: number }
  | { kind: "hospitalAdmit" }
  | { kind: "rentFree"; amount: number; landlordId: string; tileZh: string }
  | { kind: "freeFlight" }
  | { kind: "portDispatch" }
  | { kind: "forceAuction" }
  | { kind: "forceAuctionPick" }
  | { kind: "debtAuctionPick" }
  | { kind: "auction" }
  | { kind: "mafiaEnter" }
  | { kind: "racetrackGunBuild" }
  | { kind: "racetrackGunDemolish" }
  | { kind: "racetrackExit" }
  | { kind: "swap" }
  /** Racetrack money/foot/gun: roll two dice one at a time (D = 1st − 2nd). */
  | { kind: "trackJudge"; first: number | null; pos: number; depth: number }
  /** Stock exchange: roll two dice one at a time after entry fee. */
  | { kind: "casinoRoll"; first: number | null };

export interface PendingDebt {
  amount: number;
  payeeId: string | null;
  reason: string;
  debtorId: string;
}

/** Bankrupt player's remaining country tiles to auction (R-017). */
export interface PendingEstate {
  bankruptId: string;
  queue: number[];
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  kind: PlayerKind;
  cash: number;
  position: number;
  eliminated: boolean;
  hospitalSkips: number;
  hasPlane: boolean;
  hasShip: boolean;
  hasRentFree: boolean;
  hasDischarge: boolean;
  hasVipCard: boolean;
  /** null = on main ring; 0..20 on racetrack. */
  racetrackPos: number | null;
  /** After leaving track onto a mafia tile, skip re-entry once. */
  skipNextMafiaEnter: boolean;
}

const FACILITY_BUYBACK = 500;
const PORT_FARE = 400;
const PORT_SHIP_DISCOUNT = 200;

export interface GameConfig {
  humans: number;
  ais: number;
  startingCash?: number;
}

export interface GameState {
  tiles: BoardTile[];
  deeds: Record<number, DeedState>;
  players: PlayerState[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  prompt: SettlePrompt;
  initiative: InitiativeState | null;
  lastDice: number | null;
  lastCasinoDice: [number, number] | null;
  /** Last racetrack effect dice pair (for D). */
  lastTrackDice: [number, number] | null;
  casinoPool: number;
  eventDeck: EventDeckState;
  lastEvent: EventCardId | null;
  auction: AuctionState | null;
  pendingDebt: PendingDebt | null;
  pendingEstate: PendingEstate | null;
  turn: number;
  log: string[];
  winnerId: string | null;
}

const COLORS = ["#286ec8", "#c83737", "#289046", "#d2aa28"];
const GO_WAGE = 500;

function blankPlayer(
  id: string,
  name: string,
  color: string,
  kind: PlayerKind,
  cash: number,
): PlayerState {
  return {
    id,
    name,
    color,
    kind,
    cash,
    position: 0,
    eliminated: false,
    hospitalSkips: 0,
    hasPlane: false,
    hasShip: false,
    hasRentFree: false,
    hasDischarge: false,
    hasVipCard: false,
    racetrackPos: null,
    skipNextMafiaEnter: false,
  };
}

export function createInitialState(config: GameConfig): GameState {
  const startingCash = config.startingCash ?? 5000;
  const total = config.humans + config.ais;
  if (total < 2 || total > 4) {
    throw new Error("Player count must be 2–4");
  }

  const players: PlayerState[] = [];
  for (let i = 0; i < config.humans; i++) {
    players.push(
      blankPlayer(
        `p${i}`,
        i === 0 ? "你" : `玩家${i + 1}`,
        COLORS[i]!,
        "human",
        startingCash,
      ),
    );
  }
  for (let i = 0; i < config.ais; i++) {
    const idx = config.humans + i;
    players.push(
      blankPlayer(`ai${i}`, `AI ${i + 1}`, COLORS[idx]!, "ai", startingCash),
    );
  }

  const tiles = buildBoardTiles();
  const pending = players.map((p) => p.id);
  const firstIdx = 0;

  return {
    tiles,
    deeds: emptyDeeds(tiles),
    players,
    currentPlayerIndex: firstIdx,
    phase: "initiative",
    prompt: { kind: "idle" },
    initiative: {
      pending,
      placed: [],
      playoff: null,
      partialDie: null,
    },
    lastDice: null,
    lastCasinoDice: null,
    lastTrackDice: null,
    casinoPool: 0,
    eventDeck: createEventDeck(),
    lastEvent: null,
    auction: null,
    pendingDebt: null,
    pendingEstate: null,
    turn: 0,
    log: [
      `请${players[firstIdx]!.name}掷2次骰子，总点数大者先出发，平手需加赛（加赛结果不改变非加赛玩家的出发顺序）`,
      "对局开始 · Vivondo",
    ],
    winnerId: null,
  };
}

/** Who must roll next during opening initiative (null if not in that phase). */
export function initiativeActorId(state: GameState): string | null {
  const init = state.initiative;
  if (state.phase !== "initiative" || !init) return null;
  if (init.playoff) return init.playoff.nextId;
  return init.pending[0] ?? null;
}

function syncInitiativeActor(state: GameState): GameState {
  const id = initiativeActorId(state);
  if (!id) return state;
  const idx = findPlayerIndex(state, id);
  if (idx < 0 || idx === state.currentPlayerIndex) return state;
  return { ...state, currentPlayerIndex: idx };
}

function finalizeInitiative(state: GameState): GameState {
  const init = state.initiative;
  if (!init || init.pending.length > 0 || init.playoff) return state;
  const ordered = init.placed.map(
    (e) => state.players.find((p) => p.id === e.id)!,
  );
  const names = ordered.map((p) => p.name).join(" → ");
  const parts = init.placed.map((e) => {
    const p = state.players.find((x) => x.id === e.id)!;
    return `${p.name}=${e.initial}`;
  });
  return pushLog(
    {
      ...state,
      players: ordered,
      currentPlayerIndex: 0,
      phase: "roll",
      initiative: null,
      turn: 1,
      lastCasinoDice: null,
      lastDice: null,
    },
    `出发顺序确定：${parts.join(" · ")} → ${names}`,
  );
}

/**
 * One die click during opening order (R-004).
 * Humans must click twice (1st die, then 2nd); AI is driven the same way by the session loop.
 */
export function rollInitiative(state: GameState): GameState {
  if (state.phase !== "initiative" || !state.initiative || state.winnerId) {
    return state;
  }
  const actorId = initiativeActorId(state);
  if (!actorId) return state;

  const die = 1 + Math.floor(Math.random() * 6);
  const actor = state.players[findPlayerIndex(state, actorId)]!;
  const init = state.initiative;
  const partial = init.partialDie;

  if (partial == null) {
    let s: GameState = {
      ...state,
      lastDice: die,
      lastCasinoDice: null,
      initiative: { ...init, partialDie: die },
    };
    s = pushLog(s, `${actor.name} 第 1 次掷出 ${die}（请再掷第 2 次）`);
    return syncInitiativeActor(s);
  }

  const total = partial + die;
  let s: GameState = {
    ...state,
    lastCasinoDice: [partial, die],
    lastDice: total,
    initiative: { ...init, partialDie: null },
  };
  s = pushLog(s, `${actor.name} 第 2 次掷出 ${die} · 合计 ${partial}+${die}=${total}`);

  const cur = s.initiative!;
  if (cur.playoff) {
    const playoff = cur.playoff;
    const round = { ...playoff.round, [actorId]: total };
    const [aId, bId] = playoff.ids;
    const aRoll = round[aId];
    const bRoll = round[bId];

    if (aRoll == null || bRoll == null) {
      const nextId = actorId === aId ? bId : aId;
      s = {
        ...s,
        initiative: {
          ...cur,
          playoff: { ...playoff, nextId, round },
          partialDie: null,
        },
      };
      return syncInitiativeActor(s);
    }

    if (aRoll === bRoll) {
      const aP = s.players[findPlayerIndex(s, aId)]!;
      const bP = s.players[findPlayerIndex(s, bId)]!;
      s = pushLog(s, `${aP.name} 与 ${bP.name} 加赛再次相同（${aRoll}），再掷`);
      s = {
        ...s,
        initiative: {
          ...cur,
          playoff: {
            ids: playoff.ids,
            nextId: aId,
            round: {},
            band: playoff.band,
          },
          partialDie: null,
        },
      };
      return syncInitiativeActor(s);
    }

    const firstId = aRoll > bRoll ? aId : bId;
    const secondId = firstId === aId ? bId : aId;
    const band = playoff.band;
    const placed = cur.placed.filter((e) => e.id !== aId && e.id !== bId);
    const insertAt = placed.findIndex((e) => e.initial < band);
    const at = insertAt < 0 ? placed.length : insertAt;
    placed.splice(
      at,
      0,
      { id: firstId, initial: band },
      { id: secondId, initial: band },
    );
    const firstP = s.players[findPlayerIndex(s, firstId)]!;
    const secondP = s.players[findPlayerIndex(s, secondId)]!;
    s = pushLog(
      s,
      `加赛结果：${firstP.name}（${Math.max(aRoll, bRoll)}）先于 ${secondP.name}（${Math.min(aRoll, bRoll)}）`,
    );
    s = {
      ...s,
      initiative: { pending: cur.pending, placed, playoff: null, partialDie: null },
    };
    if (s.initiative!.pending.length === 0) return finalizeInitiative(s);
    const nextName = s.players[findPlayerIndex(s, s.initiative!.pending[0]!)]!.name;
    s = pushLog(s, `下一位：请${nextName}掷2次骰子`);
    return syncInitiativeActor(s);
  }

  // Initial sum for pending[0]
  const pending = cur.pending.slice(1);
  const tied = cur.placed.find((e) => e.initial === total);
  if (tied) {
    const tiedP = s.players[findPlayerIndex(s, tied.id)]!;
    s = pushLog(
      s,
      `${actor.name} 与 ${tiedP.name} 同为 ${total}，进入加赛（只比这两人；不影响其他人顺序）`,
    );
    const ids: [string, string] = [tied.id, actorId];
    const humanId = [tied.id, actorId].find(
      (id) => s.players[findPlayerIndex(s, id)]!.kind === "human",
    );
    const nextId = humanId ?? tied.id;
    const placed = cur.placed.filter((e) => e.id !== tied.id);
    s = {
      ...s,
      initiative: {
        pending,
        placed,
        playoff: { ids, nextId, round: {}, band: total },
        partialDie: null,
      },
    };
    return syncInitiativeActor(s);
  }

  const placed = [...cur.placed];
  const insertAt = placed.findIndex((e) => e.initial < total);
  const at = insertAt < 0 ? placed.length : insertAt;
  placed.splice(at, 0, { id: actorId, initial: total });
  s = {
    ...s,
    initiative: { pending, placed, playoff: null, partialDie: null },
  };
  if (pending.length === 0) return finalizeInitiative(s);
  const nextName = s.players[findPlayerIndex(s, pending[0]!)]!.name;
  s = pushLog(s, `下一位：请${nextName}掷2次骰子`);
  return syncInitiativeActor(s);
}

function pushLog(state: GameState, line: string): GameState {
  return { ...state, log: [line, ...state.log].slice(0, 60) };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]!;
}

function mapPlayer(
  state: GameState,
  playerIndex: number,
  patch: Partial<PlayerState>,
): GameState {
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, ...patch } : p,
    ),
  };
}

function findPlayerIndex(state: GameState, id: string): number {
  return state.players.findIndex((p) => p.id === id);
}

function findTileIndex(
  state: GameState,
  pred: (t: BoardTile) => boolean,
): number {
  return state.tiles.findIndex(pred);
}

function payExact(
  state: GameState,
  payerIndex: number,
  amount: number,
  payeeId: string | null,
  reason: string,
): GameState {
  if (amount <= 0) return state;
  const payer = state.players[payerIndex]!;
  const paid = Math.min(payer.cash, amount);
  let s = mapPlayer(state, payerIndex, { cash: payer.cash - paid });

  if (payeeId != null) {
    const payeeIndex = findPlayerIndex(s, payeeId);
    if (payeeIndex >= 0) {
      const payee = s.players[payeeIndex]!;
      if (isHospitalized(payee)) {
        s = pushLog(
          s,
          `${payee.name} 住院中，无法收取 ${paid}（${reason}）· 款项归 GM`,
        );
      } else {
        s = mapPlayer(s, payeeIndex, { cash: payee.cash + paid });
      }
    }
  }

  if (paid < amount) {
    s = declareBankrupt(
      s,
      payerIndex,
      `无力支付 ${reason}（应付 ${amount}，实付 ${paid}）`,
    );
  } else {
    s = pushLog(
      s,
      payeeId == null
        ? `${payer.name} 支付 ${amount}（${reason}）`
        : `${payer.name} 向 ${s.players[findPlayerIndex(s, payeeId)]!.name} 支付 ${amount}（${reason}）`,
    );
  }
  return s;
}

/** Keep auction / debt-pick / estate prompts after payDebt. */
function settleAfterPayDebt(state: GameState): GameState {
  if (
    state.prompt.kind === "debtAuctionPick" ||
    state.prompt.kind === "auction" ||
    state.pendingEstate != null
  ) {
    return state;
  }
  return { ...state, prompt: { kind: "idle" } };
}

/**
 * R-017 bankruptcy: mark out; reclaim facilities / tokens / holdable cards
 * to GM (cards → draw pile + shuffle); auction remaining country tiles.
 */
function declareBankrupt(
  state: GameState,
  playerIndex: number,
  reason: string,
): GameState {
  const player = state.players[playerIndex]!;
  if (player.eliminated) return state;

  let s: GameState = state;
  if (s.pendingDebt?.debtorId === player.id) {
    s = { ...s, pendingDebt: null };
  }

  // Facilities: unconditional GM reclaim (never auctioned).
  for (const t of s.tiles) {
    if (t.kind !== "facility") continue;
    if (s.deeds[t.index]?.ownerId !== player.id) continue;
    s = {
      ...s,
      deeds: {
        ...s.deeds,
        [t.index]: { ownerId: null, houses: 0, special: null },
      },
    };
    s = pushLog(s, `${player.name} 出局清仓：${t.zh} 无条件归 GM 无主`);
  }

  // Holdable event cards → draw pile + shuffle (R-030).
  const returned: string[] = [];
  if (player.hasDischarge) {
    s = { ...s, eventDeck: returnCardToDraw(s.eventDeck, "H1") };
    returned.push("出院卡");
  }
  if (player.hasVipCard) {
    s = { ...s, eventDeck: returnCardToDraw(s.eventDeck, "H3") };
    returned.push("赌场VIP卡");
  }
  if (returned.length > 0) {
    s = pushLog(
      s,
      `${player.name} 出局清仓：${returned.join("、")} 回归事件卡堆并洗牌`,
    );
  }

  const tokenBits: string[] = [];
  if (player.hasPlane) tokenBits.push("飞机");
  if (player.hasShip) tokenBits.push("轮船");
  if (player.hasRentFree) tokenBits.push("免租");
  if (tokenBits.length > 0) {
    s = pushLog(
      s,
      `${player.name} 出局清仓：${tokenBits.join("、")} token 由 GM 收回`,
    );
  }

  const queue = auctionableProperties(s, player.id).map((t) => t.index);

  s = mapPlayer(s, playerIndex, {
    cash: 0,
    eliminated: true,
    hasPlane: false,
    hasShip: false,
    hasRentFree: false,
    hasDischarge: false,
    hasVipCard: false,
    racetrackPos: null,
    skipNextMafiaEnter: false,
    hospitalSkips: 0,
  });
  s = pushLog(s, `${player.name} ${reason} · 破产出局`);
  s = checkWinner(s);

  if (queue.length === 0) {
    return { ...s, pendingEstate: null, prompt: { kind: "idle" } };
  }

  s = pushLog(
    s,
    `${player.name} 剩余 ${queue.length} 处国家地产进入破产拍卖（流拍归 GM）`,
  );
  s = {
    ...s,
    pendingEstate: { bankruptId: player.id, queue },
    auction: null,
  };
  return continueEstateLiquidation(s);
}

function continueEstateLiquidation(state: GameState): GameState {
  const pe = state.pendingEstate;
  if (!pe) return { ...state, prompt: { kind: "idle" } };

  const queue = pe.queue.filter(
    (i) => state.deeds[i]?.ownerId === pe.bankruptId,
  );

  if (queue.length === 0) {
    return pushLog(
      { ...state, pendingEstate: null, auction: null, prompt: { kind: "idle" } },
      "破产地产清算完毕",
    );
  }

  // Game already over — reclaim remaining without bidding.
  if (state.winnerId) {
    let s = state;
    for (const i of queue) {
      const tile = s.tiles[i]!;
      s = {
        ...s,
        deeds: {
          ...s.deeds,
          [i]: { ownerId: null, houses: 0, special: null },
        },
      };
      s = pushLog(s, `${tile.zh} 随终局归 GM 无主`);
    }
    return { ...s, pendingEstate: null, auction: null, prompt: { kind: "idle" } };
  }

  const [next, ...rest] = queue;
  const s: GameState = {
    ...state,
    pendingEstate: { bankruptId: pe.bankruptId, queue: rest },
  };
  return startAuction(s, next!, "estate");
}

function auctionableProperties(
  state: GameState,
  ownerId: string,
): BoardTile[] {
  return state.tiles.filter(
    (t) =>
      t.kind === "property" && state.deeds[t.index]?.ownerId === ownerId,
  );
}

function demolishForCash(
  state: GameState,
  playerIndex: number,
  need: number,
): GameState {
  let s = state;
  let guard = 0;
  while (s.players[playerIndex]!.cash < need && guard++ < 40) {
    const player = s.players[playerIndex]!;
    let best: BoardTile | null = null;
    for (const t of auctionableProperties(s, player.id)) {
      const d = s.deeds[t.index]!;
      if (d.special != null || d.houses < 1) continue;
      if (!best || d.houses > s.deeds[best.index]!.houses) best = t;
    }
    if (!best) break;
    const deed = s.deeds[best.index]!;
    const refund = Math.floor((best.price ?? 0) / 2);
    s = {
      ...s,
      deeds: {
        ...s.deeds,
        [best.index]: { ...deed, houses: deed.houses - 1 },
      },
    };
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash + refund,
    });
    s = pushLog(
      s,
      `${player.name} 拆除 ${best.zh} 1 屋，GM 返还 ${refund}`,
    );
  }
  return s;
}

function sellOilMineForCash(
  state: GameState,
  playerIndex: number,
  need: number,
): GameState {
  let s = state;
  const player = s.players[playerIndex]!;
  if (player.cash >= need) return s;

  for (const zh of ["石油", "矿山"] as const) {
    if (s.players[playerIndex]!.cash >= need) break;
    const tile = s.tiles.find(
      (t) =>
        t.kind === "facility" &&
        t.zh === zh &&
        s.deeds[t.index]?.ownerId === player.id,
    );
    if (!tile) continue;
    s = {
      ...s,
      deeds: {
        ...s.deeds,
        [tile.index]: { ownerId: null, houses: 0, special: null },
      },
    };
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash + FACILITY_BUYBACK,
    });
    s = pushLog(
      s,
      `${player.name} 筹资将 ${zh} 半价退回 GM，收回 ${FACILITY_BUYBACK}`,
    );
  }
  return s;
}

/** Pay debt with demolish → facility sell → auction → bankrupt (R-017). */
function payDebt(
  state: GameState,
  payerIndex: number,
  amount: number,
  payeeId: string | null,
  reason: string,
): GameState {
  if (amount <= 0) return state;
  let s = state;
  if (s.players[payerIndex]!.cash >= amount) {
    return payExact(s, payerIndex, amount, payeeId, reason);
  }

  s = demolishForCash(s, payerIndex, amount);
  if (s.players[payerIndex]!.cash >= amount) {
    return payExact(s, payerIndex, amount, payeeId, reason);
  }

  s = sellOilMineForCash(s, payerIndex, amount);
  if (s.players[payerIndex]!.cash >= amount) {
    return payExact(s, payerIndex, amount, payeeId, reason);
  }

  const props = auctionableProperties(s, s.players[payerIndex]!.id);
  if (props.length > 0) {
    return {
      ...s,
      pendingDebt: {
        amount,
        payeeId,
        reason,
        debtorId: s.players[payerIndex]!.id,
      },
      prompt: { kind: "debtAuctionPick" },
    };
  }

  return payExact(s, payerIndex, amount, payeeId, reason);
}

function resumePendingDebt(state: GameState): GameState {
  const debt = state.pendingDebt;
  if (!debt) return { ...state, prompt: { kind: "idle" } };
  const debtorIndex = findPlayerIndex(state, debt.debtorId);
  if (debtorIndex < 0) {
    return { ...state, pendingDebt: null, prompt: { kind: "idle" } };
  }
  const s: GameState = { ...state, pendingDebt: null };
  return payDebt(s, debtorIndex, debt.amount, debt.payeeId, debt.reason);
}

function isHospitalized(player: { hospitalSkips: number }): boolean {
  return player.hospitalSkips > 0;
}

/**
 * Credit cash. While hospitalized (R-042), all income is blocked
 * except forced-auction proceeds (allowInHospital).
 */
function gainCash(
  state: GameState,
  playerIndex: number,
  amount: number,
  reason: string,
  opts?: { allowInHospital?: boolean },
): GameState {
  if (amount <= 0) return state;
  const p = state.players[playerIndex]!;
  if (isHospitalized(p) && !opts?.allowInHospital) {
    return pushLog(
      state,
      `${p.name} 住院中，无法收取 ${amount}（${reason}）`,
    );
  }
  return pushLog(
    mapPlayer(state, playerIndex, { cash: p.cash + amount }),
    `${p.name} 获得 ${amount}（${reason}）`,
  );
}

/** Direct credit used for auction seller proceeds (allowed in hospital). */
function creditAuctionProceeds(
  state: GameState,
  playerIndex: number,
  amount: number,
  reason: string,
): GameState {
  return gainCash(state, playerIndex, amount, reason, {
    allowInHospital: true,
  });
}

function checkWinner(state: GameState): GameState {
  const alive = state.players.filter((p) => !p.eliminated);
  if (alive.length === 1) {
    return pushLog(
      { ...state, winnerId: alive[0]!.id },
      `${alive[0]!.name} 获胜（独占存活）`,
    );
  }
  return state;
}

function applyGoSalary(
  state: GameState,
  playerIndex: number,
  from: number,
  dice: number,
  to: number,
): GameState {
  const passedOrLanded = from + dice >= BOARD_TILE_COUNT;
  if (!passedOrLanded) return state;

  const player = state.players[playerIndex]!;
  const landedOnGo = to === 0;
  const due = landedOnGo ? GO_WAGE * 2 : GO_WAGE;

  if (player.hasPlane) {
    return pushLog(
      mapPlayer(state, playerIndex, { hasPlane: false }),
      `${player.name} 持飞机 token · ${landedOnGo ? "停留" : "途经"}银行不领薪，token 收回`,
    );
  }

  if (isHospitalized(player)) {
    return pushLog(
      state,
      `${player.name} 住院中，无法领取银行工资 ${due}`,
    );
  }

  return gainCash(
    state,
    playerIndex,
    due,
    landedOnGo ? "停留银行领薪" : "途经银行领薪",
  );
}

function applyStopGoSalary(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex]!;
  if (player.hasPlane) {
    return pushLog(
      mapPlayer(state, playerIndex, { hasPlane: false }),
      `${player.name} 持飞机 token · 停留银行不领薪，token 收回`,
    );
  }
  if (isHospitalized(player)) {
    return pushLog(
      state,
      `${player.name} 住院中，无法领取银行工资 ${GO_WAGE * 2}`,
    );
  }
  return gainCash(state, playerIndex, GO_WAGE * 2, "停留银行领薪");
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== "roll" || state.winnerId) return state;
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  if (player.eliminated) return state;

  if (player.hospitalSkips > 0) {
    const left = player.hospitalSkips - 1;
    let s = mapPlayer(state, playerIndex, { hospitalSkips: left });
    s = pushLog(s, `${player.name} 住院中，跳过掷骰（剩余 ${left} 次）`);
    return { ...s, phase: "end", prompt: { kind: "idle" }, lastDice: null };
  }

  // Racetrack turn
  if (player.racetrackPos != null) {
    const dice = 1 + Math.floor(Math.random() * 6);
    let s: GameState = {
      ...state,
      lastDice: dice,
      lastCasinoDice: null,
      phase: "settle",
    };
    s = pushLog(s, `${player.name} 跑马场掷出 ${dice}`);
    return racetrackAdvance(s, dice);
  }

  const dice = 1 + Math.floor(Math.random() * 6);
  const from = player.position;
  const to = (from + dice) % BOARD_TILE_COUNT;
  const tile = state.tiles[to]!;

  let s: GameState = {
    ...mapPlayer(state, playerIndex, { position: to }),
    lastDice: dice,
    lastCasinoDice: null,
    lastTrackDice: null,
    phase: "settle",
  };
  s = pushLog(s, `${player.name} 掷出 ${dice}，前往 ${tile.zh}（${tile.en}）`);
  s = applyGoSalary(s, playerIndex, from, dice, to);
  return beginTileSettlement(s);
}

/** Continue a two-die human roll (track judge / casino) — one die per click. */
export function continuePairRoll(state: GameState): GameState {
  if (state.winnerId) return state;
  const player = currentPlayer(state);
  if (player.kind !== "human") return state;
  const die = 1 + Math.floor(Math.random() * 6);

  if (state.phase === "settle" && state.prompt.kind === "trackJudge") {
    const { first, pos, depth } = state.prompt;
    if (first == null) {
      return pushLog(
        {
          ...state,
          lastDice: die,
          lastTrackDice: null,
          prompt: { kind: "trackJudge", first: die, pos, depth },
        },
        `${player.name} 第 1 次掷出 ${die}（请再掷第 2 次）`,
      );
    }
    const d = first - die;
    let s: GameState = {
      ...state,
      lastDice: die,
      lastTrackDice: [first, die],
    };
    s = pushLog(s, `${player.name} 第 2 次掷出 ${die}`);
    return applyTrackJudge(s, pos, depth, first, die, d);
  }

  if (state.phase === "settle" && state.prompt.kind === "casinoRoll") {
    const { first } = state.prompt;
    if (first == null) {
      return pushLog(
        {
          ...state,
          lastDice: die,
          lastCasinoDice: null,
          prompt: { kind: "casinoRoll", first: die },
        },
        `${player.name} 第 1 次掷出 ${die}（请再掷第 2 次）`,
      );
    }
    let s: GameState = { ...state, lastDice: die };
    s = pushLog(s, `${player.name} 第 2 次掷出 ${die}`);
    return applyCasinoDice(s, first, die);
  }

  return state;
}


function beginTileSettlement(state: GameState): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position]!;

  if (tile.kind === "property" || tile.kind === "facility") {
    return settleOwnable(state, tile);
  }
  if (tile.kind === "corner") {
    return settleCorner(state, tile);
  }
  if (tile.kind === "port") {
    return { ...state, prompt: { kind: "port" } };
  }
  if (tile.kind === "event") {
    return drawAndResolveEvent(state);
  }
  if (tile.kind === "mafia") {
    return settleMafiaEntrance(state);
  }

  return { ...state, prompt: { kind: "idle" } };
}

function settleMafiaEntrance(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.skipNextMafiaEnter) {
    return pushLog(
      {
        ...mapPlayer(state, state.currentPlayerIndex, {
          skipNextMafiaEnter: false,
        }),
        prompt: { kind: "idle" },
      },
      `${player.name} 从跑马场回到赌城入口`,
    );
  }
  if (player.hasVipCard) {
    return { ...state, prompt: { kind: "mafiaEnter" } };
  }
  return enterRacetrack(state);
}

function enterRacetrack(state: GameState): GameState {
  const player = currentPlayer(state);
  let s = mapPlayer(state, state.currentPlayerIndex, { racetrackPos: 0 });
  s = pushLog(
    s,
    `${player.name} 进入跑马场（起终点）· 本回合必须立刻前进`,
  );
  const dice = 1 + Math.floor(Math.random() * 6);
  s = { ...s, lastDice: dice, phase: "settle" };
  s = pushLog(s, `${player.name} 进场掷出 ${dice}`);
  return racetrackAdvance(s, dice);
}

function racetrackAdvance(state: GameState, steps: number): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  if (player.racetrackPos == null) return state;

  const moved = moveOnTrack(player.racetrackPos, steps);
  let s = mapPlayer(state, playerIndex, { racetrackPos: moved.pos });

  if (moved.exited) {
    s = pushLog(s, `${player.name} 跑完一圈，准备离场`);
    return {
      ...mapPlayer(s, playerIndex, { racetrackPos: null }),
      prompt: { kind: "racetrackExit" },
    };
  }

  const kind = trackCellKind(moved.pos);
  s = pushLog(
    s,
    `${player.name} 停在跑马场 ${moved.pos} 格（${trackCellZh(kind)}）`,
  );
  return resolveTrackCell(s, moved.pos, 0);
}

function resolveTrackCell(
  state: GameState,
  pos: number,
  depth: number,
): GameState {
  if (depth > 12) {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      "脚印连锁过深，停止结算",
    );
  }

  const kind = trackCellKind(pos);
  if (kind === "start") {
    return { ...state, prompt: { kind: "idle" } };
  }

  const player = currentPlayer(state);
  if (player.kind === "ai") {
    const { d1, d2, d } = rollTrackDelta();
    return applyTrackJudge(state, pos, depth, d1, d2, d);
  }
  return pushLog(
    {
      ...state,
      prompt: { kind: "trackJudge", first: null, pos, depth },
      lastTrackDice: null,
    },
    `${player.name}请掷2次骰子判定（差值 = 第1次 − 第2次）`,
  );
}

function applyTrackJudge(
  state: GameState,
  pos: number,
  depth: number,
  d1: number,
  d2: number,
  d: number,
): GameState {
  let s: GameState = {
    ...state,
    lastTrackDice: [d1, d2],
    prompt: { kind: "idle" },
  };
  const player = currentPlayer(s);
  const kind = trackCellKind(pos);
  s = pushLog(s, `跑马场判定 ${d1}−${d2}=${d}`);

  if (kind === "money") {
    const amount = d * 40;
    if (amount > 0) {
      s = gainCash(s, s.currentPlayerIndex, amount, "跑马场钞票");
      return { ...s, prompt: { kind: "idle" } };
    }
    if (amount < 0) {
      s = payDebt(s, s.currentPlayerIndex, -amount, null, "跑马场钞票");
      return s.prompt.kind === "debtAuctionPick" || s.prompt.kind === "auction"
        ? s
        : { ...s, prompt: { kind: "idle" } };
    }
    return pushLog({ ...s, prompt: { kind: "idle" } }, "钞票差额为 0");
  }

  if (kind === "foot") {
    if (d === 0) {
      return pushLog({ ...s, prompt: { kind: "idle" } }, "脚印：不移动");
    }
    const from = player.racetrackPos ?? pos;
    const moved = moveOnTrack(from, d);
    s = mapPlayer(s, s.currentPlayerIndex, {
      racetrackPos: moved.exited ? null : moved.pos,
    });
    s = pushLog(
      s,
      `${player.name} 脚印移动 ${d > 0 ? "+" : ""}${d}${moved.exited ? " · 离场" : ` → ${moved.pos} 格`}`,
    );
    if (moved.exited) {
      return { ...s, prompt: { kind: "racetrackExit" } };
    }
    return resolveTrackCell(s, moved.pos, depth + 1);
  }

  // gun
  if (d === 0) {
    return pushLog({ ...s, prompt: { kind: "idle" } }, "老虎机：无事");
  }
  if (d > 0) {
    const opts = gunBuildOptions(s, player.id);
    if (opts.length === 0) {
      return pushLog(
        { ...s, prompt: { kind: "idle" } },
        "老虎机加盖：无可用地产，跳过",
      );
    }
    return { ...s, prompt: { kind: "racetrackGunBuild" } };
  }

  const opts = gunDemolishOptions(s, player.id);
  if (opts.length === 0) {
    return pushLog(
      { ...s, prompt: { kind: "idle" } },
      "老虎机拆房：无可用地产，跳过",
    );
  }
  return { ...s, prompt: { kind: "racetrackGunDemolish" } };
}

export function gunBuildOptions(
  state: GameState,
  ownerId: string,
): BoardTile[] {
  return state.tiles.filter((t) => {
    if (t.kind !== "property") return false;
    const d = state.deeds[t.index];
    return (
      d?.ownerId === ownerId && d.special == null && d.houses >= 0 && d.houses < 3
    );
  });
}

export function gunDemolishOptions(
  state: GameState,
  ownerId: string,
): BoardTile[] {
  return state.tiles.filter((t) => {
    if (t.kind !== "property") return false;
    const d = state.deeds[t.index];
    if (d?.ownerId !== ownerId) return false;
    if (d.special != null) return true;
    return d.houses >= 1;
  });
}

export function cancelMafiaEnter(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "mafiaEnter") {
    return state;
  }
  const player = currentPlayer(state);
  if (!player.hasVipCard) return state;
  let s = mapPlayer(state, state.currentPlayerIndex, { hasVipCard: false });
  s = {
    ...s,
    eventDeck: discardEventCard(s.eventDeck, "H3"),
    prompt: { kind: "idle" },
  };
  return pushLog(s, `${player.name} 弃置赌场VIP卡，取消进入跑马场`);
}

export function acceptMafiaEnter(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "mafiaEnter") {
    return state;
  }
  return enterRacetrack(state);
}

export function pickGunBuild(state: GameState, tileIndex: number): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "racetrackGunBuild") {
    return state;
  }
  const player = currentPlayer(state);
  const opts = gunBuildOptions(state, player.id);
  if (!opts.some((t) => t.index === tileIndex)) return state;
  const deed = state.deeds[tileIndex]!;
  const tile = state.tiles[tileIndex]!;
  let s: GameState = {
    ...state,
    deeds: {
      ...state.deeds,
      [tileIndex]: { ...deed, houses: deed.houses + 1 },
    },
    prompt: { kind: "idle" },
  };
  return pushLog(
    s,
    `${player.name} 老虎机免费加盖 ${tile.zh} → ${deed.houses + 1} 屋`,
  );
}

export function pickGunDemolish(state: GameState, tileIndex: number): GameState {
  if (
    state.phase !== "settle" ||
    state.prompt.kind !== "racetrackGunDemolish"
  ) {
    return state;
  }
  const player = currentPlayer(state);
  const opts = gunDemolishOptions(state, player.id);
  if (!opts.some((t) => t.index === tileIndex)) return state;
  const deed = state.deeds[tileIndex]!;
  const tile = state.tiles[tileIndex]!;
  let nextDeed: DeedState;
  let note: string;
  if (deed.special != null) {
    nextDeed = { ownerId: player.id, houses: 3, special: null };
    note = `${tile.zh} 特殊地产拆除 → 普通 3 屋`;
  } else {
    nextDeed = { ...deed, houses: deed.houses - 1 };
    note = `${tile.zh} 拆除 1 屋 → ${deed.houses - 1} 屋（无退款）`;
  }
  let s: GameState = {
    ...state,
    deeds: { ...state.deeds, [tileIndex]: nextDeed },
    prompt: { kind: "idle" },
  };
  return pushLog(s, `${player.name} 老虎机拆房：${note}`);
}

export function skipGunEffect(state: GameState): GameState {
  if (
    state.phase !== "settle" ||
    (state.prompt.kind !== "racetrackGunBuild" &&
      state.prompt.kind !== "racetrackGunDemolish")
  ) {
    return state;
  }
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 跳过老虎机效果`,
  );
}

export function chooseRacetrackExit(
  state: GameState,
  mafiaTileIndex: number,
): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "racetrackExit") {
    return state;
  }
  const tile = state.tiles[mafiaTileIndex];
  if (!tile || tile.kind !== "mafia") return state;

  const player = currentPlayer(state);
  let s = mapPlayer(state, state.currentPlayerIndex, {
    position: mafiaTileIndex,
    racetrackPos: null,
    skipNextMafiaEnter: true,
  });
  s = pushLog(s, `${player.name} 离场回到 ${tile.zh}`);
  return beginTileSettlement(s);
}

export function mafiaEntrances(state: GameState): BoardTile[] {
  return state.tiles.filter((t) => t.kind === "mafia");
}

function settleOwnable(state: GameState, tile: BoardTile): GameState {
  const deed = state.deeds[tile.index]!;
  const player = currentPlayer(state);

  if (deed.ownerId == null) {
    return { ...state, prompt: { kind: "buy", tileIndex: tile.index } };
  }

  const landlord = state.players.find((p) => p.id === deed.ownerId);
  // Safety: eliminated owners must not collect rent — reclaim as unowned.
  if (landlord?.eliminated) {
    const s: GameState = {
      ...state,
      deeds: {
        ...state.deeds,
        [tile.index]: { ownerId: null, houses: 0, special: null },
      },
    };
    return pushLog(
      { ...s, prompt: { kind: "buy", tileIndex: tile.index } },
      `${tile.zh} 原属已出局玩家，收归 GM 无主`,
    );
  }

  if (deed.ownerId === player.id) {
    if (tile.kind === "facility") {
      return {
        ...state,
        prompt: { kind: "facilityOwn", tileIndex: tile.index },
      };
    }
    if (deed.special != null) {
      const cost = tile.price ?? 0;
      return {
        ...state,
        prompt: {
          kind: "upgrade",
          tileIndex: tile.index,
          cost,
          mode: "respecialize",
        },
      };
    }
    const cost = upgradeCost(state.tiles, state.deeds, player.id, tile.index);
    if (cost == null) return { ...state, prompt: { kind: "idle" } };
    return {
      ...state,
      prompt: {
        kind: "upgrade",
        tileIndex: tile.index,
        cost,
        mode: deed.houses < 3 ? "house" : "specialize",
      },
    };
  }

  if (tile.kind === "facility") {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${player.name} 停在他人的 ${tile.zh}（设施无地租）`,
    );
  }

  const tourismDice =
    deed.special === "tourism"
      ? 1 + Math.floor(Math.random() * 6)
      : undefined;
  const receivable = receivableRent(
    state.tiles,
    state.deeds,
    tile.index,
    tourismDice,
  );
  const due = applyOilReduction(
    state.tiles,
    state.deeds,
    player.id,
    tile.index,
    receivable,
  );

  let s = state;
  if (deed.special === "tourism" && tourismDice != null) {
    s = pushLog(s, `旅游国掷骰 ${tourismDice} · 应收 ${receivable}`);
  }
  if (due !== receivable) {
    s = pushLog(s, `石油减免：应收 ${receivable} → 实付 ${due}`);
  }

  if (due <= 0) {
    return pushLog(
      { ...s, prompt: { kind: "idle" } },
      `${player.name} 在 ${tile.zh} 应付地租 0`,
    );
  }

  if (player.hasRentFree) {
    return {
      ...s,
      prompt: {
        kind: "rentFree",
        amount: due,
        landlordId: deed.ownerId,
        tileZh: tile.zh,
      },
    };
  }

  s = payDebt(s, s.currentPlayerIndex, due, deed.ownerId, `${tile.zh} 地租`);
  return settleAfterPayDebt(s);
}

function settleCorner(state: GameState, tile: BoardTile): GameState {
  const player = currentPlayer(state);

  if (tile.zh.startsWith("银行")) {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${player.name} 停在银行（起点）`,
    );
  }

  if (tile.zh === "机场") {
    return { ...state, prompt: { kind: "airport" } };
  }

  if (tile.zh === "医院") {
    if (player.hasDischarge) {
      return { ...state, prompt: { kind: "hospitalAdmit" } };
    }
    return admitHospital(state);
  }

  if (tile.zh === "证券交易所" || tile.zh === "赌场") {
    return resolveCasino(state);
  }

  return { ...state, prompt: { kind: "idle" } };
}

function admitHospital(state: GameState): GameState {
  const player = currentPlayer(state);
  const hospital = findTileIndex(state, (t) => t.zh === "医院");
  let s = state;
  if (hospital >= 0 && player.position !== hospital) {
    s = mapPlayer(s, s.currentPlayerIndex, { position: hospital });
  }
  s = mapPlayer(s, s.currentPlayerIndex, { hospitalSkips: 2 });
  return pushLog(
    { ...s, prompt: { kind: "idle" } },
    `${currentPlayer(s).name} 入院住院，将跳过接下来 2 次掷骰；出院前不能收钱（被迫拍卖款除外）`,
  );
}

function resolveCasino(state: GameState): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  const entry = 200;
  const paid = Math.min(player.cash, entry);

  let s = mapPlayer(state, playerIndex, { cash: player.cash - paid });
  s = { ...s, casinoPool: s.casinoPool + paid };

  if (paid < entry) {
    return declareBankrupt(s, playerIndex, "无力支付证券入场费");
  }

  s = pushLog(s, `${player.name} 支付证券入场费 200 · 奖池 ${s.casinoPool}`);

  if (player.kind === "ai") {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    return applyCasinoDice(s, d1, d2);
  }
  return pushLog(
    { ...s, prompt: { kind: "casinoRoll", first: null }, lastCasinoDice: null },
    `${player.name}请掷2次骰子参与证券结算`,
  );
}

function applyCasinoDice(state: GameState, d1: number, d2: number): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  const sum = d1 + d2;
  let s: GameState = { ...state, lastCasinoDice: [d1, d2] };
  s = pushLog(s, `${player.name} 证券掷出 ${d1}+${d2}=${sum}`);

  if (d1 === 1 && d2 === 1) {
    const extra = Math.min(s.players[playerIndex]!.cash, 200);
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash - extra,
    });
    s = { ...s, casinoPool: s.casinoPool + extra };
    if (extra < 200) {
      return declareBankrupt(s, playerIndex, "证券：大失败（双 1）");
    }
    s = pushLog(s, "证券：大失败（双 1）追加 200");
  } else if (d1 === 6 && d2 === 6) {
    const win = s.casinoPool;
    s = { ...s, casinoPool: 0 };
    s = gainCash(s, playerIndex, win, "证券大成功取走奖池");
  } else if (sum === 7) {
    s = { ...s, casinoPool: Math.max(0, s.casinoPool - 200) };
    s = gainCash(s, playerIndex, 200, "证券退还入场费");
  } else if (sum >= 8) {
    const win = Math.min(400, s.casinoPool);
    s = { ...s, casinoPool: s.casinoPool - win };
    s = gainCash(s, playerIndex, win, "证券赢取");
  } else {
    s = pushLog(s, "证券：输（入场费沉没）");
  }

  return settleAfterPayDebt(s);
}

function drawAndResolveEvent(state: GameState): GameState {
  const { card, deck } = drawEventCard(state.eventDeck);
  let s: GameState = {
    ...state,
    eventDeck: deck,
    lastEvent: card,
  };
  const player = currentPlayer(s);
  s = pushLog(s, `${player.name} 抽到事件「${CARD_ZH[card]}」（${card}）`);

  const hold = holdKindOf(card);
  if (hold) {
    return resolveHoldable(s, card, hold);
  }
  return resolveInstant(s, card);
}

function resolveHoldable(
  state: GameState,
  card: EventCardId,
  hold: "discharge" | "vip",
): GameState {
  const player = currentPlayer(state);
  const has =
    hold === "discharge" ? player.hasDischarge : player.hasVipCard;

  if (!has) {
    const patch =
      hold === "discharge" ? { hasDischarge: true } : { hasVipCard: true };
    return pushLog(
      {
        ...mapPlayer(state, state.currentPlayerIndex, patch),
        prompt: { kind: "idle" },
      },
      `${player.name} 获得「${CARD_ZH[card]}」`,
    );
  }

  let s: GameState = {
    ...state,
    eventDeck: returnCardToDraw(state.eventDeck, card),
  };
  s = gainCash(s, s.currentPlayerIndex, 500, "重复持有卡补偿");
  return { ...s, prompt: { kind: "idle" } };
}

function roadFeeAmount(state: GameState, playerId: string): number {
  const owned = state.tiles.filter(
    (t) =>
      t.kind === "property" && state.deeds[t.index]?.ownerId === playerId,
  );
  const hasSpecial = owned.some((t) => state.deeds[t.index]?.special != null);
  if (hasSpecial) return 100;

  let maxHouses = -1;
  for (const t of owned) {
    const d = state.deeds[t.index]!;
    if (d.special != null) continue;
    if (d.houses > maxHouses) maxHouses = d.houses;
  }
  if (maxHouses < 0) return 0;
  return (maxHouses + 1) * 20;
}

function resolveInstant(state: GameState, card: EventCardId): GameState {
  const idx = state.currentPlayerIndex;
  const player = currentPlayer(state);
  let s: GameState = {
    ...state,
    eventDeck: discardEventCard(state.eventDeck, card),
  };

  switch (card) {
    case "E01": {
      s = mapPlayer(s, idx, { position: 0 });
      s = pushLog(s, `${player.name} 前往银行（起点）`);
      s = applyStopGoSalary(s, idx);
      return { ...s, prompt: { kind: "idle" } };
    }
    case "E02": {
      if (player.hasDischarge) {
        return { ...s, prompt: { kind: "hospitalAdmit" } };
      }
      return admitHospital(s);
    }
    case "E03":
      return { ...gainCash(s, idx, 200, "银行错误"), prompt: { kind: "idle" } };
    case "E04":
      return { ...gainCash(s, idx, 100, "选美获奖"), prompt: { kind: "idle" } };
    case "E05":
      return { ...gainCash(s, idx, 150, "股票分红"), prompt: { kind: "idle" } };
    case "E06":
      return settleAfterPayDebt(payDebt(s, idx, 200, null, "所得税"));
    case "E07":
      return settleAfterPayDebt(payDebt(s, idx, 100, null, "医疗费"));
    case "E08": {
      const fee = roadFeeAmount(s, player.id);
      if (fee <= 0) {
        return pushLog(
          { ...s, prompt: { kind: "idle" } },
          `${player.name} 修路费 0`,
        );
      }
      return settleAfterPayDebt(payDebt(s, idx, fee, null, "修路费"));
    }
    case "E09": {
      for (let i = 0; i < s.players.length; i++) {
        if (i === idx || s.players[i]!.eliminated) continue;
        s = payDebt(s, i, 50, player.id, "生日礼金");
        if (
          s.prompt.kind === "debtAuctionPick" ||
          s.prompt.kind === "auction" ||
          s.pendingEstate != null ||
          s.winnerId
        ) {
          return s;
        }
      }
      return { ...s, prompt: { kind: "idle" } };
    }
    case "E10": {
      for (let i = 0; i < s.players.length; i++) {
        if (i === idx || s.players[i]!.eliminated) continue;
        s = payDebt(s, idx, 50, s.players[i]!.id, "董事长分红");
        if (
          s.prompt.kind === "debtAuctionPick" ||
          s.prompt.kind === "auction" ||
          s.pendingEstate != null ||
          s.players[idx]!.eliminated ||
          s.winnerId
        ) {
          return settleAfterPayDebt(s);
        }
      }
      return { ...s, prompt: { kind: "idle" } };
    }
    case "E11": {
      const back = 1 + Math.floor(Math.random() * 6);
      const from = player.position;
      const to = (from - back + BOARD_TILE_COUNT) % BOARD_TILE_COUNT;
      s = mapPlayer(s, idx, { position: to });
      s = pushLog(
        s,
        `${player.name} 后退 ${back} 格至 ${s.tiles[to]!.zh}（逆时针不领薪）`,
      );
      return beginTileSettlement(s);
    }
    case "E12": {
      const fwd = 1 + Math.floor(Math.random() * 6);
      const from = player.position;
      const to = (from + fwd) % BOARD_TILE_COUNT;
      s = mapPlayer(s, idx, { position: to });
      s = pushLog(s, `${player.name} 加速前进 ${fwd} 格至 ${s.tiles[to]!.zh}`);
      s = applyGoSalary(s, idx, from, fwd, to);
      return beginTileSettlement(s);
    }
    case "E13":
      return { ...s, prompt: { kind: "freeFlight" } };
    case "E14":
      return { ...s, prompt: { kind: "portDispatch" } };
    case "E15": {
      if (playerOwnsFacility(s.tiles, s.deeds, player.id, "石油")) {
        return {
          ...gainCash(s, idx, 200, "油价波动（持有石油）"),
          prompt: { kind: "idle" },
        };
      }
      return settleAfterPayDebt(payDebt(s, idx, 100, null, "油价波动"));
    }
    case "E16": {
      if (playerOwnsFacility(s.tiles, s.deeds, player.id, "矿山")) {
        return settleAfterPayDebt(
          payDebt(s, idx, 150, null, "矿难抚恤（持有矿山）"),
        );
      }
      return {
        ...gainCash(s, idx, 50, "矿难抚恤"),
        prompt: { kind: "idle" },
      };
    }
    case "E17": {
      const casino = findTileIndex(s, (t) => t.zh === "证券交易所" || t.zh === "赌场");
      if (casino >= 0) {
        s = mapPlayer(s, idx, { position: casino });
        s = pushLog(s, `${player.name} 被请到证券交易所`);
      }
      return resolveCasino(s);
    }
    case "E18": {
      const props = ownedCountryProperties(s, player.id);
      if (props.length === 0) {
        return pushLog(
          { ...s, prompt: { kind: "idle" } },
          `${player.name} 无国家地产 · 强制拍卖无效`,
        );
      }
      return { ...s, prompt: { kind: "forceAuction" } };
    }
    case "E19":
      return { ...s, prompt: { kind: "swap" } };
    case "E20": {
      if (player.hasRentFree) {
        return pushLog(
          { ...s, prompt: { kind: "idle" } },
          `${player.name} 已持有免租 token，本卡无效`,
        );
      }
      return pushLog(
        {
          ...mapPlayer(s, idx, { hasRentFree: true }),
          prompt: { kind: "idle" },
        },
        `${player.name} 获得免租 token`,
      );
    }
    default:
      return { ...s, prompt: { kind: "idle" } };
  }
}

function ownedCountryProperties(
  state: GameState,
  ownerId: string,
): BoardTile[] {
  return auctionableProperties(state, ownerId);
}

function startAuction(
  state: GameState,
  tileIndex: number,
  source: "e18" | "debt" | "estate",
): GameState {
  const tile = state.tiles[tileIndex]!;
  const deed = state.deeds[tileIndex]!;
  const ownerId = deed.ownerId;
  if (!ownerId || tile.kind !== "property") return state;

  const price = tile.price ?? 0;
  const start = price * 2;
  const bidderIds = state.players
    .filter((p) => !p.eliminated && p.id !== ownerId && p.cash >= start)
    .map((p) => p.id);

  // Reset to plain 0-house before auction listing
  let s: GameState = {
    ...state,
    deeds: {
      ...state.deeds,
      [tileIndex]: { ownerId, houses: 0, special: null },
    },
  };

  if (bidderIds.length === 0) {
    return finalizePassedIn(s, tileIndex, ownerId, price, source);
  }

  const auction = createAuction({
    tileIndex,
    sellerId: ownerId,
    price,
    bidderIds,
    source,
  });

  const rollParts = auction.order.map((id) => {
    const p = s.players[findPlayerIndex(s, id)]!;
    return `${p.name}=${auction.rolls[id]}`;
  });

  const tag =
    source === "estate" ? "破产拍卖" : source === "debt" ? "筹资拍卖" : "强制拍卖";
  s = pushLog(
    s,
    `${tag}开始：${tile.zh} · 起拍 ${auction.startPrice} · 一口价 ${auction.buyoutPrice} · 出价序 ${rollParts.join(" → ")}`,
  );
  return {
    ...s,
    auction: syncAuctionCursor(auction),
    prompt: { kind: "auction" },
  };
}

function finalizePassedIn(
  state: GameState,
  tileIndex: number,
  ownerId: string,
  price: number,
  source: "e18" | "debt" | "estate",
): GameState {
  const ownerIndex = findPlayerIndex(state, ownerId);
  let s = state;

  // Estate pass-in: unconditional GM reclaim, no refund to bankrupt.
  if (source !== "estate" && ownerIndex >= 0) {
    const refund = Math.max(0, price - 50);
    s = creditAuctionProceeds(
      s,
      ownerIndex,
      refund,
      "被迫拍卖流拍退款",
    );
    s = pushLog(
      s,
      `${s.tiles[tileIndex]!.zh} 流拍 · 原地主收回 ${refund}，地产归 GM 无主`,
    );
  } else {
    s = pushLog(
      s,
      `${s.tiles[tileIndex]!.zh} 流拍 · 归 GM 无主`,
    );
  }

  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ownerId: null, houses: 0, special: null },
    },
    auction: null,
  };

  if (source === "estate" || s.pendingEstate) {
    return continueEstateLiquidation(s);
  }
  if (source === "debt" || s.pendingDebt) {
    return resumePendingDebt(s);
  }
  return { ...s, prompt: { kind: "idle" } };
}

function finalizeSold(
  state: GameState,
  auction: AuctionState,
  buyerId: string,
  salePrice: number,
): GameState {
  const tileIndex = auction.tileIndex;
  const tile = state.tiles[tileIndex]!;
  const sellerIndex = findPlayerIndex(state, auction.sellerId);
  const buyerIndex = findPlayerIndex(state, buyerId);
  if (buyerIndex < 0) return state;

  const toOwner = Math.floor(salePrice / 2);
  let s = mapPlayer(state, buyerIndex, {
    cash: state.players[buyerIndex]!.cash - salePrice,
  });

  // Estate sales: bankrupt gets nothing; GM keeps the seller half.
  if (auction.source !== "estate" && sellerIndex >= 0) {
    s = creditAuctionProceeds(
      s,
      sellerIndex,
      toOwner,
      "被迫拍卖成交款",
    );
  }

  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ownerId: buyerId, houses: 0, special: null },
    },
    auction: null,
  };
  s = pushLog(
    s,
    auction.source === "estate"
      ? `${s.players[buyerIndex]!.name} 以 ${salePrice} 拍得破产地产 ${tile.zh}`
      : `${s.players[buyerIndex]!.name} 以 ${salePrice} 拍得 ${tile.zh} · 原地主得 ${toOwner}（GM 收一半）`,
  );

  if (auction.source === "estate" || s.pendingEstate) {
    return continueEstateLiquidation(s);
  }
  if (auction.source === "debt" || s.pendingDebt) {
    return resumePendingDebt(s);
  }
  return { ...s, prompt: { kind: "idle" } };
}

function applyAuctionResult(
  state: GameState,
  result: ReturnType<typeof auctionPlaceBid>,
): GameState {
  if (result.type === "reject") {
    return pushLog(state, result.reason);
  }
  if (result.type === "continue") {
    const synced = result.auction;
    const actorId = currentAuctionActor(synced);
    // Nobody left to act — finish instead of leaving a broken auction prompt
    if (!actorId) {
      if (synced.highBidderId && synced.currentBid > 0) {
        return finalizeSold(
          { ...state, auction: synced },
          synced,
          synced.highBidderId,
          synced.currentBid,
        );
      }
      return finalizePassedIn(
        { ...state, auction: null },
        synced.tileIndex,
        synced.sellerId,
        synced.facePrice,
        synced.source,
      );
    }
    const actor = state.players[findPlayerIndex(state, actorId)]?.name ?? "?";
    let s: GameState = {
      ...state,
      auction: synced,
      prompt: { kind: "auction" },
    };
    if (synced.currentBid > 0 && synced.highBidderId) {
      const high =
        state.players[findPlayerIndex(state, synced.highBidderId)]?.name ??
        "?";
      s = pushLog(
        s,
        `当前最高价 ${synced.currentBid}（${high}）· 下一位 ${actor}`,
      );
    } else {
      s = pushLog(s, `等待出价 · 下一位 ${actor}`);
    }
    return s;
  }
  if (result.type === "sold") {
    return finalizeSold(
      { ...state, auction: result.auction },
      result.auction,
      result.buyerId,
      result.salePrice,
    );
  }
  // passedIn
  const a = result.auction;
  return finalizePassedIn(
    { ...state, auction: null },
    a.tileIndex,
    a.sellerId,
    a.facePrice,
    a.source,
  );
}

export function chooseBuy(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "buy") return state;
  const { tileIndex } = state.prompt;
  const tile = state.tiles[tileIndex]!;
  const price = tile.price ?? 0;
  const player = currentPlayer(state);
  if (player.cash < price) {
    return pushLog(state, `${player.name} 现金不足，无法购买 ${tile.zh}`);
  }

  let s = mapPlayer(state, state.currentPlayerIndex, {
    cash: player.cash - price,
  });
  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ownerId: player.id, houses: 0, special: null },
    },
    prompt: { kind: "idle" },
  };
  const effect =
    tile.zh === "石油"
      ? " · 付租时可减免"
      : tile.zh === "矿山"
        ? " · 加盖费用 −50"
        : "";
  return pushLog(s, `${player.name} 购买 ${tile.zh}，花费 ${price}${effect}`);
}

export function sellFacility(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "facilityOwn") {
    return state;
  }
  const { tileIndex } = state.prompt;
  const tile = state.tiles[tileIndex]!;
  const player = currentPlayer(state);
  const deed = state.deeds[tileIndex];
  if (!deed || deed.ownerId !== player.id || tile.kind !== "facility") {
    return state;
  }

  let s = mapPlayer(state, state.currentPlayerIndex, {
    cash: player.cash + FACILITY_BUYBACK,
  });
  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ownerId: null, houses: 0, special: null },
    },
    prompt: { kind: "idle" },
  };
  return pushLog(
    s,
    `${player.name} 将 ${tile.zh} 半价退回 GM，收回 ${FACILITY_BUYBACK}`,
  );
}

export function keepFacility(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "facilityOwn") {
    return state;
  }
  const tile = state.tiles[state.prompt.tileIndex]!;
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 保留 ${tile.zh}`,
  );
}

export function otherPortIndex(
  state: GameState,
  fromIndex: number,
): number | null {
  const other = state.tiles.find(
    (t) => t.kind === "port" && t.index !== fromIndex,
  );
  return other?.index ?? null;
}

export function portStay(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "port") return state;
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 停留港口，不出航`,
  );
}

export function portSail(state: GameState, useShip: boolean): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "port") return state;
  const player = currentPlayer(state);
  if (useShip && !player.hasShip) return state;

  const fare = useShip ? PORT_FARE - PORT_SHIP_DISCOUNT : PORT_FARE;
  if (player.cash < fare) {
    return pushLog(state, `${player.name} 现金不足，无法出航（需 ${fare}）`);
  }

  const dest = otherPortIndex(state, player.position);
  if (dest == null) return state;

  let s = mapPlayer(state, state.currentPlayerIndex, {
    cash: player.cash - fare,
    position: dest,
    hasShip: useShip ? false : player.hasShip,
  });
  const shipNote = useShip ? " · 使用轮船 token（−200）" : "";
  s = pushLog(
    s,
    `${player.name} 出航至另一港口，船费 ${fare}${shipNote} · 本回合结束`,
  );
  return { ...s, phase: "end", prompt: { kind: "idle" } };
}

export function declineBuy(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "buy") return state;
  const tile = state.tiles[state.prompt.tileIndex]!;
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 放弃购买 ${tile.zh}`,
  );
}

export function chooseUpgrade(
  state: GameState,
  special?: SpecialKind,
): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "upgrade") return state;
  const { tileIndex, cost, mode } = state.prompt;
  const player = currentPlayer(state);
  const deed = state.deeds[tileIndex]!;
  const tile = state.tiles[tileIndex]!;

  if (player.cash < cost) {
    return pushLog(state, `${player.name} 现金不足，无法加盖 ${tile.zh}`);
  }

  if (mode === "specialize" || mode === "respecialize") {
    if (!special) return state;
    if (mode === "respecialize" && deed.special === special) {
      return pushLog(state, `${player.name} 已是该类型，请选择其他类型`);
    }
    let s = mapPlayer(state, state.currentPlayerIndex, {
      cash: player.cash - cost,
    });
    s = {
      ...s,
      deeds: {
        ...s.deeds,
        [tileIndex]: { ownerId: player.id, houses: 0, special },
      },
      prompt: { kind: "idle" },
    };
    const label =
      special === "industry"
        ? "工业国"
        : special === "commerce"
          ? "商业国"
          : "旅游国";
    return pushLog(
      s,
      mode === "respecialize"
        ? `${player.name} 将 ${tile.zh} 改造成${label}，花费 ${cost}`
        : `${player.name} 将 ${tile.zh} 特性化为${label}，花费 ${cost}`,
    );
  }

  let s = mapPlayer(state, state.currentPlayerIndex, {
    cash: player.cash - cost,
  });
  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ...deed, houses: deed.houses + 1 },
    },
    prompt: { kind: "idle" },
  };
  return pushLog(
    s,
    `${player.name} 在 ${tile.zh} 加盖至 ${deed.houses + 1} 屋，花费 ${cost}`,
  );
}

export function declineUpgrade(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "upgrade") return state;
  const tile = state.tiles[state.prompt.tileIndex]!;
  const verb =
    state.prompt.mode === "respecialize"
      ? "跳过改造"
      : state.prompt.mode === "specialize"
        ? "跳过特性化"
        : "跳过加盖";
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} ${verb} ${tile.zh}`,
  );
}

export function airportStay(state: GameState): GameState {
  if (state.phase !== "settle") return state;
  if (state.prompt.kind === "airport") {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${currentPlayer(state).name} 选择不飞，停留机场`,
    );
  }
  if (state.prompt.kind === "freeFlight") {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${currentPlayer(state).name} 放弃机场贵宾免费起飞`,
    );
  }
  return state;
}

export function airportBeginFly(state: GameState): GameState {
  if (state.phase !== "settle") return state;
  if (state.prompt.kind === "airport") {
    return { ...state, prompt: { kind: "airportDest", free: false } };
  }
  if (state.prompt.kind === "freeFlight") {
    return { ...state, prompt: { kind: "airportDest", free: true } };
  }
  return state;
}

export function airportFlyTo(state: GameState, destIndex: number): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airportDest") {
    return state;
  }
  const free = state.prompt.free;
  const dest = state.tiles[destIndex];
  if (!dest || dest.kind !== "property") return state;

  const price = dest.price ?? 0;
  const fare = free ? 0 : price * 3;
  const player = currentPlayer(state);
  if (player.cash < fare) {
    return pushLog(
      state,
      `${player.name} 无法支付飞往 ${dest.zh} 的机票 ${fare}`,
    );
  }

  const gainedPlane = !player.hasPlane;
  let s = mapPlayer(state, state.currentPlayerIndex, {
    cash: player.cash - fare,
    position: destIndex,
    hasPlane: true,
  });
  s = pushLog(
    s,
    `${player.name} ${free ? "免费" : ""}飞往 ${dest.zh}${fare ? `，机票 ${fare}` : ""}${gainedPlane ? " · 获得飞机 token" : " · 已持有飞机 token"}`,
  );
  s = { ...s, prompt: { kind: "idle" } };
  return beginTileSettlement(s);
}

export function cancelAirportDest(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airportDest") {
    return state;
  }
  return {
    ...state,
    prompt: state.prompt.free ? { kind: "freeFlight" } : { kind: "airport" },
  };
}

export function useDischargeCard(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "hospitalAdmit") {
    return state;
  }
  const player = currentPlayer(state);
  if (!player.hasDischarge) return state;

  let s = mapPlayer(state, state.currentPlayerIndex, { hasDischarge: false });
  s = {
    ...s,
    eventDeck: discardEventCard(s.eventDeck, "H1"),
    prompt: { kind: "idle" },
  };
  return pushLog(s, `${player.name} 弃置出院卡，取消入院`);
}

export function acceptHospital(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "hospitalAdmit") {
    return state;
  }
  return admitHospital(state);
}

export function useRentFree(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "rentFree") {
    return state;
  }
  const player = currentPlayer(state);
  if (!player.hasRentFree) return state;
  const { tileZh, amount } = state.prompt;
  const s = mapPlayer(state, state.currentPlayerIndex, { hasRentFree: false });
  return pushLog(
    { ...s, prompt: { kind: "idle" } },
    `${player.name} 使用免租 token，免付 ${tileZh} 地租 ${amount}`,
  );
}

export function declineRentFree(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "rentFree") {
    return state;
  }
  const { amount, landlordId, tileZh } = state.prompt;
  const s = payDebt(
    state,
    state.currentPlayerIndex,
    amount,
    landlordId,
    `${tileZh} 地租`,
  );
  return settleAfterPayDebt(s);
}

export function portDispatchTakeCash(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "portDispatch") {
    return state;
  }
  return {
    ...gainCash(state, state.currentPlayerIndex, 100, "港口调度"),
    prompt: { kind: "idle" },
  };
}

export function portDispatchTakeShip(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "portDispatch") {
    return state;
  }
  const player = currentPlayer(state);
  if (player.hasShip) {
    return pushLog(state, `${player.name} 已持有轮船 token，不可再领`);
  }
  return pushLog(
    {
      ...mapPlayer(state, state.currentPlayerIndex, { hasShip: true }),
      prompt: { kind: "idle" },
    },
    `${player.name} 领取轮船 token`,
  );
}

export function cancelForceAuction(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "forceAuction") {
    return state;
  }
  const player = currentPlayer(state);
  if (!player.hasVipCard) return state;
  let s = mapPlayer(state, state.currentPlayerIndex, { hasVipCard: false });
  s = {
    ...s,
    eventDeck: discardEventCard(s.eventDeck, "H3"),
    prompt: { kind: "idle" },
  };
  return pushLog(s, `${player.name} 弃置赌场VIP卡，取消强制拍卖`);
}

export function proceedForceAuction(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "forceAuction") {
    return state;
  }
  return { ...state, prompt: { kind: "forceAuctionPick" } };
}

export function pickForceAuctionTile(
  state: GameState,
  tileIndex: number,
): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "forceAuctionPick") {
    return state;
  }
  const player = currentPlayer(state);
  const tile = state.tiles[tileIndex];
  if (
    !tile ||
    tile.kind !== "property" ||
    state.deeds[tileIndex]?.ownerId !== player.id
  ) {
    return state;
  }
  return startAuction(state, tileIndex, "e18");
}

export function pickDebtAuctionTile(
  state: GameState,
  tileIndex: number,
): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "debtAuctionPick") {
    return state;
  }
  const debt = state.pendingDebt;
  if (!debt) return state;
  const tile = state.tiles[tileIndex];
  if (
    !tile ||
    tile.kind !== "property" ||
    state.deeds[tileIndex]?.ownerId !== debt.debtorId
  ) {
    return state;
  }
  return startAuction(state, tileIndex, "debt");
}

export function auctionBid(state: GameState, amount?: number): GameState {
  if (
    state.phase !== "settle" ||
    state.prompt.kind !== "auction" ||
    !state.auction
  ) {
    return state;
  }
  const auction = syncAuctionCursor(state.auction);
  const actorId = currentAuctionActor(auction);
  if (!actorId) return state;
  const actor = state.players[findPlayerIndex(state, actorId)]!;
  const bid = amount ?? minNextBid(auction);
  return applyAuctionResult(
    state,
    auctionPlaceBid(auction, actorId, bid, actor.cash),
  );
}

export function auctionDoBuyout(state: GameState): GameState {
  if (
    state.phase !== "settle" ||
    state.prompt.kind !== "auction" ||
    !state.auction
  ) {
    return state;
  }
  const auction = syncAuctionCursor(state.auction);
  const actorId = currentAuctionActor(auction);
  if (!actorId) return state;
  const actor = state.players[findPlayerIndex(state, actorId)]!;
  return applyAuctionResult(
    state,
    auctionBuyoutCore(auction, actorId, actor.cash),
  );
}

export function auctionDoPass(state: GameState): GameState {
  if (
    state.phase !== "settle" ||
    state.prompt.kind !== "auction" ||
    !state.auction
  ) {
    return state;
  }
  const auction = syncAuctionCursor(state.auction);
  const actorId = currentAuctionActor(auction);
  if (!actorId) return state;
  return applyAuctionResult(state, auctionPassCore(auction, actorId));
}

export function getAuctionView(state: GameState): {
  auction: AuctionState;
  actorId: string | null;
  minBid: number;
} | null {
  if (!state.auction || state.prompt.kind !== "auction") return null;
  const auction = syncAuctionCursor(state.auction);
  return {
    auction,
    actorId: currentAuctionActor(auction),
    minBid: minNextBid(auction),
  };
}

export function skipSwap(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "swap") return state;
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 选择不换位`,
  );
}

export function swapWith(state: GameState, otherId: string): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "swap") return state;
  const me = currentPlayer(state);
  if (me.racetrackPos != null) {
    return pushLog(state, "你在跑马场内，不能换位");
  }
  const otherIndex = findPlayerIndex(state, otherId);
  if (otherIndex < 0) return state;
  const other = state.players[otherIndex]!;
  if (other.eliminated || other.id === me.id) return state;
  if (other.racetrackPos != null) {
    return pushLog(state, "不能与跑马场内的玩家换位");
  }

  const myPos = me.position;
  const theirPos = other.position;
  let s = mapPlayer(state, state.currentPlayerIndex, { position: theirPos });
  s = mapPlayer(s, otherIndex, { position: myPos });
  return pushLog(
    { ...s, prompt: { kind: "idle" } },
    `${me.name} 与 ${other.name} 互换位置（双方均不结算新落点）`,
  );
}

export function finishSettlement(state: GameState): GameState {
  if (state.phase !== "settle") return state;
  if (state.prompt.kind !== "idle") return state;
  return { ...state, phase: "end" };
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "end" && state.phase !== "settle") return state;
  if (state.phase === "settle" && state.prompt.kind !== "idle") return state;
  if (state.winnerId) return state;

  const n = state.players.length;
  let next = (state.currentPlayerIndex + 1) % n;
  let guard = 0;
  while (state.players[next]!.eliminated && guard < n) {
    next = (next + 1) % n;
    guard += 1;
  }

  const wrapped = next <= state.currentPlayerIndex;
  return pushLog(
    {
      ...state,
      currentPlayerIndex: next,
      phase: "roll",
      prompt: { kind: "idle" },
      auction: null,
      lastDice: null,
      lastCasinoDice: null,
      lastTrackDice: null,
      turn: wrapped ? state.turn + 1 : state.turn,
    },
    `轮到 ${state.players[next]!.name}`,
  );
}

export function propertyTiles(state: GameState): BoardTile[] {
  return state.tiles.filter((t) => t.kind === "property");
}

export function ownedPropertiesForCurrent(state: GameState): BoardTile[] {
  return ownedCountryProperties(state, currentPlayer(state).id);
}

export function ownedPropertiesForDebtor(state: GameState): BoardTile[] {
  if (!state.pendingDebt) return [];
  return ownedCountryProperties(state, state.pendingDebt.debtorId);
}

export type { SpecialKind, DeedState, EventCardId, AuctionState };
