import {
  BOARD_TILE_COUNT,
  buildBoardTiles,
  type BoardTile,
} from "./board";
import {
  applyOilReduction,
  emptyDeeds,
  receivableRent,
  upgradeCost,
  type DeedState,
  type SpecialKind,
} from "./deeds";

export type PlayerKind = "human" | "ai";
export type TurnPhase = "roll" | "settle" | "end";

export type SettlePrompt =
  | { kind: "idle" }
  | { kind: "buy"; tileIndex: number }
  | {
      kind: "upgrade";
      tileIndex: number;
      cost: number;
      mode: "house" | "specialize";
    }
  | { kind: "airport" }
  | { kind: "airportDest" };

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  kind: PlayerKind;
  cash: number;
  position: number;
  eliminated: boolean;
  /** Remaining forced skip-roll counts (R-042). */
  hospitalSkips: number;
  hasPlane: boolean;
}

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
  lastDice: number | null;
  lastCasinoDice: [number, number] | null;
  casinoPool: number;
  turn: number;
  log: string[];
  winnerId: string | null;
}

const COLORS = ["#286ec8", "#c83737", "#289046", "#d2aa28"];
const GO_WAGE = 500;

export function createInitialState(config: GameConfig): GameState {
  const startingCash = config.startingCash ?? 5000;
  const total = config.humans + config.ais;
  if (total < 2 || total > 4) {
    throw new Error("Player count must be 2–4");
  }

  const players: PlayerState[] = [];
  for (let i = 0; i < config.humans; i++) {
    players.push({
      id: `p${i}`,
      name: i === 0 ? "你" : `玩家${i + 1}`,
      color: COLORS[i]!,
      kind: "human",
      cash: startingCash,
      position: 0,
      eliminated: false,
      hospitalSkips: 0,
      hasPlane: false,
    });
  }
  for (let i = 0; i < config.ais; i++) {
    const idx = config.humans + i;
    players.push({
      id: `ai${i}`,
      name: `AI ${i + 1}`,
      color: COLORS[idx]!,
      kind: "ai",
      cash: startingCash,
      position: 0,
      eliminated: false,
      hospitalSkips: 0,
      hasPlane: false,
    });
  }

  const tiles = buildBoardTiles();
  return {
    tiles,
    deeds: emptyDeeds(tiles),
    players,
    currentPlayerIndex: 0,
    phase: "roll",
    prompt: { kind: "idle" },
    lastDice: null,
    lastCasinoDice: null,
    casinoPool: 0,
    turn: 1,
    log: ["对局开始 · Vivondo"],
    winnerId: null,
  };
}

function pushLog(state: GameState, line: string): GameState {
  return { ...state, log: [line, ...state.log].slice(0, 50) };
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

/** Pay amount to another player or to GM (null). Partial pay → bankrupt if short. */
function payDebt(
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
      s = mapPlayer(s, payeeIndex, { cash: payee.cash + paid });
    }
  }

  if (paid < amount) {
    s = mapPlayer(s, payerIndex, { cash: 0, eliminated: true });
    s = pushLog(
      s,
      `${payer.name} 无力支付 ${reason}（应付 ${amount}，实付 ${paid}）· 破产出局`,
    );
    s = checkWinner(s);
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

  return pushLog(
    mapPlayer(state, playerIndex, { cash: player.cash + due }),
    `${player.name} ${landedOnGo ? "停留银行领薪" : "途经银行领薪"} +${due}`,
  );
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== "roll" || state.winnerId) return state;
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  if (player.eliminated) return state;

  if (player.hospitalSkips > 0) {
    const left = player.hospitalSkips - 1;
    let s = mapPlayer(state, playerIndex, { hospitalSkips: left });
    s = pushLog(
      s,
      `${player.name} 住院中，跳过掷骰（剩余 ${left} 次）`,
    );
    return { ...s, phase: "end", prompt: { kind: "idle" }, lastDice: null };
  }

  const dice = 1 + Math.floor(Math.random() * 6);
  const from = player.position;
  const to = (from + dice) % BOARD_TILE_COUNT;
  const tile = state.tiles[to]!;

  let s: GameState = {
    ...mapPlayer(state, playerIndex, { position: to }),
    lastDice: dice,
    lastCasinoDice: null,
    phase: "settle",
  };
  s = pushLog(
    s,
    `${player.name} 掷出 ${dice}，前往 ${tile.zh}（${tile.en}）`,
  );
  s = applyGoSalary(s, playerIndex, from, dice, to);
  return beginTileSettlement(s);
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

  // Event / mafia / port — stub for later
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${tile.zh}：本阶段暂未结算（后续接入）`,
  );
}

function settleOwnable(state: GameState, tile: BoardTile): GameState {
  const deed = state.deeds[tile.index]!;
  const player = currentPlayer(state);

  if (deed.ownerId == null) {
    return {
      ...state,
      prompt: { kind: "buy", tileIndex: tile.index },
    };
  }

  if (deed.ownerId === player.id) {
    if (tile.kind === "facility" || deed.special != null) {
      return pushLog(
        { ...state, prompt: { kind: "idle" } },
        `${player.name} 停在自己的 ${tile.zh}`,
      );
    }
    const cost = upgradeCost(
      state.tiles,
      state.deeds,
      player.id,
      tile.index,
    );
    if (cost == null) {
      return { ...state, prompt: { kind: "idle" } };
    }
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

  // Opponent property — rent (facilities: no rent)
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
  let due = applyOilReduction(
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

  if (due <= 0) {
    return pushLog(
      { ...s, prompt: { kind: "idle" } },
      `${player.name} 在 ${tile.zh} 应付地租 0`,
    );
  }

  s = payDebt(s, s.currentPlayerIndex, due, deed.ownerId, `${tile.zh} 地租`);
  return { ...s, prompt: { kind: "idle" } };
}

function settleCorner(state: GameState, tile: BoardTile): GameState {
  const player = currentPlayer(state);

  if (tile.zh.startsWith("银行")) {
    // Salary already applied on move when landing on GO.
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${player.name} 停在银行（起点）`,
    );
  }

  if (tile.zh === "机场") {
    return {
      ...state,
      prompt: { kind: "airport" },
    };
  }

  if (tile.zh === "医院") {
    let s = mapPlayer(state, state.currentPlayerIndex, {
      hospitalSkips: 2,
    });
    s = pushLog(s, `${player.name} 入院住院，将跳过接下来 2 次掷骰`);
    return { ...s, prompt: { kind: "idle" } };
  }

  if (tile.zh === "赌场") {
    return resolveCasino(state);
  }

  return { ...state, prompt: { kind: "idle" } };
}

/** R-044 mandatory casino. */
function resolveCasino(state: GameState): GameState {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex]!;
  const entry = 200;
  const paid = Math.min(player.cash, entry);

  let s = mapPlayer(state, playerIndex, { cash: player.cash - paid });
  s = { ...s, casinoPool: s.casinoPool + paid };

  if (paid < entry) {
    s = mapPlayer(s, playerIndex, { cash: 0, eliminated: true });
    s = pushLog(
      s,
      `${player.name} 无力支付赌场入场费 · 破产出局`,
    );
    return { ...checkWinner(s), prompt: { kind: "idle" } };
  }

  s = pushLog(s, `${player.name} 支付赌场入场费 200 · 奖池 ${s.casinoPool}`);

  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const sum = d1 + d2;
  s = { ...s, lastCasinoDice: [d1, d2] };
  s = pushLog(s, `${player.name} 赌场掷出 ${d1}+${d2}=${sum}`);

  if (d1 === 1 && d2 === 1) {
    const extra = Math.min(s.players[playerIndex]!.cash, 200);
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash - extra,
    });
    s = { ...s, casinoPool: s.casinoPool + extra };
    if (extra < 200) {
      s = mapPlayer(s, playerIndex, { cash: 0, eliminated: true });
      s = pushLog(s, "赌场：大失败（双 1）· 破产出局");
      s = checkWinner(s);
    } else {
      s = pushLog(s, "赌场：大失败（双 1）追加 200");
    }
  } else if (d1 === 6 && d2 === 6) {
    const win = s.casinoPool;
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash + win,
    });
    s = { ...s, casinoPool: 0 };
    s = pushLog(s, `赌场：大成功（双 6）取走奖池 ${win}`);
  } else if (sum === 7) {
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash + 200,
    });
    s = { ...s, casinoPool: Math.max(0, s.casinoPool - 200) };
    s = pushLog(s, "赌场：退还入场费 200");
  } else if (sum >= 8) {
    const win = Math.min(400, s.casinoPool);
    s = mapPlayer(s, playerIndex, {
      cash: s.players[playerIndex]!.cash + win,
    });
    s = { ...s, casinoPool: s.casinoPool - win };
    s = pushLog(s, `赌场：赢取 ${win}`);
  } else {
    s = pushLog(s, "赌场：输（入场费沉没）");
  }

  return { ...s, prompt: { kind: "idle" } };
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
  return pushLog(s, `${player.name} 购买 ${tile.zh}，花费 ${price}`);
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

  if (mode === "specialize") {
    if (!special) return state;
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
      `${player.name} 将 ${tile.zh} 特性化为${label}，花费 ${cost}`,
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
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 跳过加盖 ${tile.zh}`,
  );
}

export function airportStay(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airport") return state;
  return pushLog(
    { ...state, prompt: { kind: "idle" } },
    `${currentPlayer(state).name} 选择不飞，停留机场`,
  );
}

export function airportBeginFly(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airport") return state;
  return { ...state, prompt: { kind: "airportDest" } };
}

export function airportFlyTo(state: GameState, destIndex: number): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airportDest") {
    return state;
  }
  const dest = state.tiles[destIndex];
  if (!dest || dest.kind !== "property") return state;

  const price = dest.price ?? 0;
  const fare = price * 3;
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
    `${player.name} 飞往 ${dest.zh}，机票 ${fare}${gainedPlane ? " · 获得飞机 token" : " · 已持有飞机 token"}`,
  );
  s = { ...s, prompt: { kind: "idle" } };
  return beginTileSettlement(s);
}

export function cancelAirportDest(state: GameState): GameState {
  if (state.phase !== "settle" || state.prompt.kind !== "airportDest") {
    return state;
  }
  return { ...state, prompt: { kind: "airport" } };
}

/** Human/AI finished interactive settle (prompt idle) → end phase. */
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
      lastDice: null,
      lastCasinoDice: null,
      turn: wrapped ? state.turn + 1 : state.turn,
    },
    `轮到 ${state.players[next]!.name}`,
  );
}

/** Property destinations for airport UI. */
export function propertyTiles(state: GameState): BoardTile[] {
  return state.tiles.filter((t) => t.kind === "property");
}

export type { SpecialKind, DeedState };
