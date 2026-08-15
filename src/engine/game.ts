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
  | { kind: "airportDest"; free: boolean }
  | { kind: "port" }
  | { kind: "facilityOwn"; tileIndex: number }
  | { kind: "hospitalAdmit" }
  | { kind: "rentFree"; amount: number; landlordId: string; tileZh: string }
  | { kind: "freeFlight" }
  | { kind: "portDispatch" }
  | { kind: "forceAuction" }
  | { kind: "forceAuctionPick" }
  | { kind: "swap" };

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
  hasMafiaDeed: boolean;
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
  lastDice: number | null;
  lastCasinoDice: [number, number] | null;
  casinoPool: number;
  eventDeck: EventDeckState;
  lastEvent: EventCardId | null;
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
    hasMafiaDeed: false,
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
    eventDeck: createEventDeck(),
    lastEvent: null,
    turn: 1,
    log: ["对局开始 · Vivondo"],
    winnerId: null,
  };
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

function gainCash(
  state: GameState,
  playerIndex: number,
  amount: number,
  reason: string,
): GameState {
  if (amount <= 0) return state;
  const p = state.players[playerIndex]!;
  return pushLog(
    mapPlayer(state, playerIndex, { cash: p.cash + amount }),
    `${p.name} 获得 ${amount}（${reason}）`,
  );
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

function applyStopGoSalary(state: GameState, playerIndex: number): GameState {
  const player = state.players[playerIndex]!;
  if (player.hasPlane) {
    return pushLog(
      mapPlayer(state, playerIndex, { hasPlane: false }),
      `${player.name} 持飞机 token · 停留银行不领薪，token 收回`,
    );
  }
  return pushLog(
    mapPlayer(state, playerIndex, { cash: player.cash + GO_WAGE * 2 }),
    `${player.name} 停留银行领薪 +${GO_WAGE * 2}`,
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
    s = pushLog(s, `${player.name} 住院中，跳过掷骰（剩余 ${left} 次）`);
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
  s = pushLog(s, `${player.name} 掷出 ${dice}，前往 ${tile.zh}（${tile.en}）`);
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
  if (tile.kind === "port") {
    return { ...state, prompt: { kind: "port" } };
  }
  if (tile.kind === "event") {
    return drawAndResolveEvent(state);
  }
  if (tile.kind === "mafia") {
    return pushLog(
      { ...state, prompt: { kind: "idle" } },
      `${player.name} 踩中黑手党入口 · 跑马场后续接入`,
    );
  }

  return { ...state, prompt: { kind: "idle" } };
}

function settleOwnable(state: GameState, tile: BoardTile): GameState {
  const deed = state.deeds[tile.index]!;
  const player = currentPlayer(state);

  if (deed.ownerId == null) {
    return { ...state, prompt: { kind: "buy", tileIndex: tile.index } };
  }

  if (deed.ownerId === player.id) {
    if (tile.kind === "facility") {
      return {
        ...state,
        prompt: { kind: "facilityOwn", tileIndex: tile.index },
      };
    }
    if (deed.special != null) {
      return pushLog(
        { ...state, prompt: { kind: "idle" } },
        `${player.name} 停在自己的 ${tile.zh}`,
      );
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
  return { ...s, prompt: { kind: "idle" } };
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

  if (tile.zh === "赌场") {
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
    `${currentPlayer(s).name} 入院住院，将跳过接下来 2 次掷骰`,
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
    s = mapPlayer(s, playerIndex, { cash: 0, eliminated: true });
    s = pushLog(s, `${player.name} 无力支付赌场入场费 · 破产出局`);
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
  hold: "discharge" | "mafia",
): GameState {
  const player = currentPlayer(state);
  const has =
    hold === "discharge" ? player.hasDischarge : player.hasMafiaDeed;

  if (!has) {
    const patch =
      hold === "discharge" ? { hasDischarge: true } : { hasMafiaDeed: true };
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
      return {
        ...payDebt(s, idx, 200, null, "所得税"),
        prompt: { kind: "idle" },
      };
    case "E07":
      return {
        ...payDebt(s, idx, 100, null, "医疗费"),
        prompt: { kind: "idle" },
      };
    case "E08": {
      const fee = roadFeeAmount(s, player.id);
      if (fee <= 0) {
        return pushLog(
          { ...s, prompt: { kind: "idle" } },
          `${player.name} 修路费 0`,
        );
      }
      return {
        ...payDebt(s, idx, fee, null, "修路费"),
        prompt: { kind: "idle" },
      };
    }
    case "E09": {
      for (let i = 0; i < s.players.length; i++) {
        if (i === idx || s.players[i]!.eliminated) continue;
        s = payDebt(s, i, 50, player.id, "生日礼金");
        if (s.winnerId) break;
      }
      return { ...s, prompt: { kind: "idle" } };
    }
    case "E10": {
      for (let i = 0; i < s.players.length; i++) {
        if (i === idx || s.players[i]!.eliminated) continue;
        s = payDebt(s, idx, 50, s.players[i]!.id, "董事长分红");
        if (s.players[idx]!.eliminated || s.winnerId) break;
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
      return {
        ...payDebt(s, idx, 100, null, "油价波动"),
        prompt: { kind: "idle" },
      };
    }
    case "E16": {
      if (playerOwnsFacility(s.tiles, s.deeds, player.id, "矿山")) {
        return {
          ...payDebt(s, idx, 150, null, "矿难抚恤（持有矿山）"),
          prompt: { kind: "idle" },
        };
      }
      return {
        ...gainCash(s, idx, 50, "矿难抚恤"),
        prompt: { kind: "idle" },
      };
    }
    case "E17": {
      const casino = findTileIndex(s, (t) => t.zh === "赌场");
      if (casino >= 0) {
        s = mapPlayer(s, idx, { position: casino });
        s = pushLog(s, `${player.name} 被请到赌场`);
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
  return state.tiles.filter(
    (t) =>
      t.kind === "property" && state.deeds[t.index]?.ownerId === ownerId,
  );
}

function runForceAuction(state: GameState, tileIndex: number): GameState {
  const tile = state.tiles[tileIndex]!;
  const deed = state.deeds[tileIndex]!;
  const ownerId = deed.ownerId;
  if (!ownerId || tile.kind !== "property") return state;

  const ownerIndex = findPlayerIndex(state, ownerId);
  const price = tile.price ?? 0;
  const start = price * 2;
  let s = pushLog(
    state,
    `强制拍卖 ${tile.zh}（视为 0 屋普通地）· 起拍 ${start}`,
  );

  const bidders = s.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.eliminated && p.id !== ownerId && p.cash >= start)
    .map(({ p, i }) => ({
      i,
      p,
      roll: 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6),
    }))
    .sort((a, b) => b.roll - a.roll);

  if (bidders.length === 0) {
    const refund = Math.max(0, price - 50);
    if (ownerIndex >= 0) {
      s = mapPlayer(s, ownerIndex, {
        cash: s.players[ownerIndex]!.cash + refund,
      });
    }
    s = {
      ...s,
      deeds: {
        ...s.deeds,
        [tileIndex]: { ownerId: null, houses: 0, special: null },
      },
    };
    return pushLog(
      { ...s, prompt: { kind: "idle" } },
      `${tile.zh} 流拍 · 原地主收回 ${refund}，地产归 GM 无主`,
    );
  }

  const winner = bidders[0]!;
  const sale = start;
  const toOwner = Math.floor(sale / 2);
  s = mapPlayer(s, winner.i, { cash: winner.p.cash - sale });
  if (ownerIndex >= 0) {
    s = mapPlayer(s, ownerIndex, {
      cash: s.players[ownerIndex]!.cash + toOwner,
    });
  }
  s = {
    ...s,
    deeds: {
      ...s.deeds,
      [tileIndex]: { ownerId: winner.p.id, houses: 0, special: null },
    },
  };
  return pushLog(
    { ...s, prompt: { kind: "idle" } },
    `${winner.p.name} 以 ${sale} 拍得 ${tile.zh}（掷 ${winner.roll}）· 原地主得 ${toOwner}`,
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
  return { ...s, prompt: { kind: "idle" } };
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
  if (!player.hasMafiaDeed) return state;
  let s = mapPlayer(state, state.currentPlayerIndex, { hasMafiaDeed: false });
  s = {
    ...s,
    eventDeck: discardEventCard(s.eventDeck, "H3"),
    prompt: { kind: "idle" },
  };
  return pushLog(s, `${player.name} 弃置黑手党地契，取消强制拍卖`);
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
  return runForceAuction(state, tileIndex);
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
  const otherIndex = findPlayerIndex(state, otherId);
  if (otherIndex < 0) return state;
  const other = state.players[otherIndex]!;
  if (other.eliminated || other.id === me.id) return state;

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
      lastDice: null,
      lastCasinoDice: null,
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

export type { SpecialKind, DeedState, EventCardId };
