import {
  advanceAfterRoll,
  createInitialState,
  endTurn,
  finishSettlement,
  rollDice,
  type GameConfig,
  type GameState,
} from "../engine/game";

/** Session adapter — Solo first; Hotseat / Online later. */
export interface GameSession {
  readonly kind: "solo" | "hotseat" | "online";
  getState(): GameState;
  subscribe(listener: (state: GameState) => void): () => void;
  roll(): void;
  continueTurn(): void;
  /** Optional local save hook (stub). */
  save?(): string;
  load?(raw: string): void;
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
    const p = state.players[state.currentPlayerIndex]!;
    if (p.kind !== "ai" || p.eliminated) return;
    // Simple AI: roll and end turn after a tick (caller may also invoke).
    state = rollDice(state);
    state = advanceAfterRoll(state);
    emit();
    // Chain if next is also AI
    queueMicrotask(() => {
      const n = state.players[state.currentPlayerIndex]!;
      if (n.kind === "ai" && !n.eliminated && state.phase === "roll") {
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
      if (p.kind !== "human" || state.phase !== "roll") return;
      state = rollDice(state);
      emit();
    },
    continueTurn() {
      if (state.phase === "settle") {
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
    save() {
      return JSON.stringify(state);
    },
    load(raw: string) {
      state = JSON.parse(raw) as GameState;
      emit();
    },
  };
}

export type { GameState, GameConfig };
