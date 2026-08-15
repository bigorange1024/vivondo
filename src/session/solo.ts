import {
  airportBeginFly,
  airportFlyTo,
  airportStay,
  cancelAirportDest,
  chooseBuy,
  chooseUpgrade,
  createInitialState,
  currentPlayer,
  declineBuy,
  declineUpgrade,
  endTurn,
  finishSettlement,
  propertyTiles,
  rollDice,
  type GameConfig,
  type GameState,
  type SpecialKind,
} from "../engine/game";

export interface GameSession {
  readonly kind: "solo" | "hotseat" | "online";
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): () => void;
  roll(): void;
  continueTurn(): void;
  buy(): void;
  declineBuy(): void;
  upgrade(special?: SpecialKind): void;
  declineUpgrade(): void;
  airportStay(): void;
  airportBeginFly(): void;
  airportFlyTo(tileIndex: number): void;
  cancelAirportDest(): void;
  save?(): string;
  load?(raw: string): void;
}

function aiPickAirportDest(state: GameState): number | null {
  const player = currentPlayer(state);
  const candidates = propertyTiles(state)
    .map((t) => ({
      t,
      fare: (t.price ?? 0) * 3,
      unowned: state.deeds[t.index]?.ownerId == null,
    }))
    .filter((c) => c.fare <= player.cash)
    .sort((a, b) => {
      if (a.unowned !== b.unowned) return a.unowned ? -1 : 1;
      return a.fare - b.fare;
    });
  return candidates[0]?.t.index ?? null;
}

function aiResolveSettle(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === "settle" && s.prompt.kind !== "idle" && guard < 20) {
    guard += 1;
    const player = currentPlayer(s);

    if (s.prompt.kind === "buy") {
      const tile = s.tiles[s.prompt.tileIndex]!;
      const price = tile.price ?? 0;
      s =
        player.cash >= price + 400
          ? chooseBuy(s)
          : declineBuy(s);
      continue;
    }

    if (s.prompt.kind === "upgrade") {
      const { cost, mode } = s.prompt;
      if (player.cash >= cost + 600) {
        s = chooseUpgrade(s, mode === "specialize" ? "industry" : undefined);
      } else {
        s = declineUpgrade(s);
      }
      continue;
    }

    if (s.prompt.kind === "airport") {
      const dest = aiPickAirportDest(s);
      if (dest == null) {
        s = airportStay(s);
      } else {
        s = airportBeginFly(s);
        s = airportFlyTo(s, dest);
      }
      continue;
    }

    if (s.prompt.kind === "airportDest") {
      const dest = aiPickAirportDest(s);
      if (dest == null) {
        s = cancelAirportDest(s);
        s = airportStay(s);
      } else {
        s = airportFlyTo(s, dest);
      }
    }
  }
  return s;
}

export function createSoloSession(config?: Partial<GameConfig>): GameSession {
  const full: GameConfig = {
    humans: 1,
    ais: 3,
    startingCash: 5000,
    ...config,
  };

  let state = createInitialState(full);
  const listeners = new Set<(s: GameState) => void>();

  const emit = () => {
    for (const l of listeners) l(state);
  };

  const runAiIfNeeded = () => {
    if (state.winnerId) return;
    const p = state.players[state.currentPlayerIndex]!;
    if (p.kind !== "ai" || p.eliminated) return;

    state = rollDice(state);
    if (state.phase === "settle") {
      state = aiResolveSettle(state);
      state = finishSettlement(state);
    }
    if (state.phase === "end") {
      state = endTurn(state);
    }
    emit();

    queueMicrotask(() => {
      const n = state.players[state.currentPlayerIndex]!;
      if (
        !state.winnerId &&
        n.kind === "ai" &&
        !n.eliminated &&
        state.phase === "roll"
      ) {
        runAiIfNeeded();
      }
    });
  };

  return {
    kind: "solo",
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    roll() {
      const p = state.players[state.currentPlayerIndex]!;
      if (p.kind !== "human" || state.phase !== "roll" || state.winnerId) return;
      state = rollDice(state);
      emit();
    },
    continueTurn() {
      if (state.winnerId) return;
      if (state.phase === "settle") {
        if (state.prompt.kind !== "idle") return;
        state = finishSettlement(state);
        state = endTurn(state);
        emit();
        queueMicrotask(runAiIfNeeded);
      } else if (state.phase === "end") {
        state = endTurn(state);
        emit();
        queueMicrotask(runAiIfNeeded);
      }
    },
    buy() {
      state = chooseBuy(state);
      emit();
    },
    declineBuy() {
      state = declineBuy(state);
      emit();
    },
    upgrade(special?: SpecialKind) {
      state = chooseUpgrade(state, special);
      emit();
    },
    declineUpgrade() {
      state = declineUpgrade(state);
      emit();
    },
    airportStay() {
      state = airportStay(state);
      emit();
    },
    airportBeginFly() {
      state = airportBeginFly(state);
      emit();
    },
    airportFlyTo(tileIndex: number) {
      state = airportFlyTo(state, tileIndex);
      emit();
    },
    cancelAirportDest() {
      state = cancelAirportDest(state);
      emit();
    },
    save() {
      return JSON.stringify(state);
    },
    load(raw: string) {
      state = JSON.parse(raw) as GameState;
      emit();
    },
  };
}

export type { GameState, GameConfig, SpecialKind };
