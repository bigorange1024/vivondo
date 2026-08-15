import {
  BOARD_TILE_COUNT,
  buildBoardTiles,
  type BoardTile,
} from "./board";

export type PlayerKind = "human" | "ai";
export type TurnPhase = "roll" | "settle" | "end";

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  kind: PlayerKind;
  cash: number;
  position: number;
  eliminated: boolean;
}

export interface GameConfig {
  humans: number;
  ais: number;
  startingCash?: number;
}

export interface GameState {
  tiles: BoardTile[];
  players: PlayerState[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  lastDice: number | null;
  turn: number;
  log: string[];
}

const COLORS = ["#286ec8", "#c83737", "#289046", "#d2aa28"];

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
    });
  }

  return {
    tiles: buildBoardTiles(),
    players,
    currentPlayerIndex: 0,
    phase: "roll",
    lastDice: null,
    turn: 1,
    log: ["对局开始 · Vivondo"],
  };
}

function pushLog(state: GameState, line: string): GameState {
  return { ...state, log: [line, ...state.log].slice(0, 40) };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]!;
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== "roll") return state;
  const player = currentPlayer(state);
  if (player.kind !== "human" && player.kind !== "ai") return state;

  const dice = 1 + Math.floor(Math.random() * 6);
  const from = player.position;
  const to = (from + dice) % BOARD_TILE_COUNT;
  const passedGo = from + dice >= BOARD_TILE_COUNT;
  const tile = state.tiles[to]!;

  let cash = player.cash;
  let logLine = `${player.name} 掷出 ${dice}，前往 ${tile.zh}（${tile.en}）`;
  if (passedGo) {
    cash += 500;
    logLine += " · 途经起点领薪 +500";
  }

  const players = state.players.map((p, idx) =>
    idx === state.currentPlayerIndex
      ? { ...p, position: to, cash }
      : p,
  );

  return pushLog(
    {
      ...state,
      players,
      lastDice: dice,
      phase: "settle",
    },
    logLine,
  );
}

/** MVP: skip full tile settlement; advance to end-of-turn. */
export function finishSettlement(state: GameState): GameState {
  if (state.phase !== "settle") return state;
  return { ...state, phase: "end" };
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "end" && state.phase !== "settle") return state;

  const n = state.players.length;
  let next = (state.currentPlayerIndex + 1) % n;
  let guard = 0;
  while (state.players[next]!.eliminated && guard < n) {
    next = (next + 1) % n;
    guard++;
  }

  const wrapped = next <= state.currentPlayerIndex;
  return pushLog(
    {
      ...state,
      currentPlayerIndex: next,
      phase: "roll",
      lastDice: null,
      turn: wrapped ? state.turn + 1 : state.turn,
    },
    `轮到 ${state.players[next]!.name}`,
  );
}

/** One-click for prototype: roll → settle → end turn (AI auto). */
export function advanceAfterRoll(state: GameState): GameState {
  let s = finishSettlement(state);
  s = endTurn(s);
  return s;
}
