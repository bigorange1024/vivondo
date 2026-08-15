import {
  acceptHospital,
  airportBeginFly,
  airportFlyTo,
  airportStay,
  auctionBid,
  auctionDoBuyout,
  auctionDoPass,
  cancelAirportDest,
  cancelForceAuction,
  chooseBuy,
  chooseUpgrade,
  createInitialState,
  currentPlayer,
  declineBuy,
  declineRentFree,
  declineUpgrade,
  endTurn,
  finishSettlement,
  getAuctionView,
  keepFacility,
  ownedPropertiesForCurrent,
  ownedPropertiesForDebtor,
  pickDebtAuctionTile,
  pickForceAuctionTile,
  portDispatchTakeCash,
  portDispatchTakeShip,
  portSail,
  portStay,
  proceedForceAuction,
  propertyTiles,
  rollDice,
  sellFacility,
  skipSwap,
  swapWith,
  useDischargeCard,
  useRentFree,
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
  portStay(): void;
  portSail(useShip: boolean): void;
  sellFacility(): void;
  keepFacility(): void;
  useDischargeCard(): void;
  acceptHospital(): void;
  useRentFree(): void;
  declineRentFree(): void;
  portDispatchTakeCash(): void;
  portDispatchTakeShip(): void;
  cancelForceAuction(): void;
  proceedForceAuction(): void;
  pickForceAuctionTile(tileIndex: number): void;
  pickDebtAuctionTile(tileIndex: number): void;
  auctionBid(amount?: number): void;
  auctionBuyout(): void;
  auctionPass(): void;
  skipSwap(): void;
  swapWith(otherId: string): void;
  save?(): string;
  load?(raw: string): void;
}

function aiPickAirportDest(state: GameState, free: boolean): number | null {
  const player = currentPlayer(state);
  const candidates = propertyTiles(state)
    .map((t) => ({
      t,
      fare: free ? 0 : (t.price ?? 0) * 3,
      unowned: state.deeds[t.index]?.ownerId == null,
    }))
    .filter((c) => c.fare <= player.cash)
    .sort((a, b) => {
      if (a.unowned !== b.unowned) return a.unowned ? -1 : 1;
      return a.fare - b.fare;
    });
  return candidates[0]?.t.index ?? null;
}

function aiAuctionStep(state: GameState): GameState {
  const view = getAuctionView(state);
  if (!view?.actorId) return state;
  const actor = state.players.find((p) => p.id === view.actorId);
  if (!actor || actor.kind !== "ai") return state;

  const { auction, minBid } = view;
  if (actor.cash >= auction.buyoutPrice && actor.cash > auction.buyoutPrice + 800) {
    return auctionDoBuyout(state);
  }
  if (actor.cash >= minBid + 300) {
    return auctionBid(state, minBid);
  }
  return auctionDoPass(state);
}

function aiResolveSettle(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === "settle" && s.prompt.kind !== "idle" && guard < 40) {
    guard += 1;
    const player = currentPlayer(s);

    if (s.prompt.kind === "auction") {
      const view = getAuctionView(s);
      const actor = view?.actorId
        ? s.players.find((p) => p.id === view.actorId)
        : null;
      if (!actor || actor.kind === "human") break;
      s = aiAuctionStep(s);
      continue;
    }

    if (s.prompt.kind === "buy") {
      const tile = s.tiles[s.prompt.tileIndex]!;
      const price = tile.price ?? 0;
      const reserve = tile.kind === "facility" ? 800 : 400;
      s = player.cash >= price + reserve ? chooseBuy(s) : declineBuy(s);
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

    if (s.prompt.kind === "facilityOwn") {
      s = player.cash < 800 ? sellFacility(s) : keepFacility(s);
      continue;
    }

    if (s.prompt.kind === "port") {
      if (player.hasShip && player.cash >= 200) s = portSail(s, true);
      else if (player.cash >= 1000) s = portSail(s, false);
      else s = portStay(s);
      continue;
    }

    if (s.prompt.kind === "airport" || s.prompt.kind === "freeFlight") {
      const free = s.prompt.kind === "freeFlight";
      const dest = aiPickAirportDest(s, free);
      if (dest == null) s = airportStay(s);
      else {
        s = airportBeginFly(s);
        s = airportFlyTo(s, dest);
      }
      continue;
    }

    if (s.prompt.kind === "airportDest") {
      const dest = aiPickAirportDest(s, s.prompt.free);
      if (dest == null) {
        s = cancelAirportDest(s);
        s = airportStay(s);
      } else {
        s = airportFlyTo(s, dest);
      }
      continue;
    }

    if (s.prompt.kind === "hospitalAdmit") {
      s = player.hasDischarge ? useDischargeCard(s) : acceptHospital(s);
      continue;
    }

    if (s.prompt.kind === "rentFree") {
      s = useRentFree(s);
      continue;
    }

    if (s.prompt.kind === "portDispatch") {
      s = player.hasShip ? portDispatchTakeCash(s) : portDispatchTakeShip(s);
      continue;
    }

    if (s.prompt.kind === "forceAuction") {
      s = player.hasMafiaDeed
        ? cancelForceAuction(s)
        : proceedForceAuction(s);
      continue;
    }

    if (s.prompt.kind === "forceAuctionPick") {
      const props = ownedPropertiesForCurrent(s).sort(
        (a, b) => (a.price ?? 0) - (b.price ?? 0),
      );
      if (!props[0]) s = { ...s, prompt: { kind: "idle" } };
      else s = pickForceAuctionTile(s, props[0].index);
      continue;
    }

    if (s.prompt.kind === "debtAuctionPick") {
      const props = ownedPropertiesForDebtor(s).sort(
        (a, b) => (a.price ?? 0) - (b.price ?? 0),
      );
      if (!props[0]) s = { ...s, prompt: { kind: "idle" }, pendingDebt: null };
      else s = pickDebtAuctionTile(s, props[0].index);
      continue;
    }

    if (s.prompt.kind === "swap") {
      s = skipSwap(s);
      continue;
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

  const continueAiAuctionIfNeeded = () => {
    if (state.prompt.kind !== "auction") return;
    const view = getAuctionView(state);
    const actor = view?.actorId
      ? state.players.find((p) => p.id === view.actorId)
      : null;
    if (!actor || actor.kind !== "ai") return;
    state = aiAuctionStep(state);
    emit();
    queueMicrotask(continueAiAuctionIfNeeded);
  };

  const runAiIfNeeded = () => {
    if (state.winnerId) return;
    const p = state.players[state.currentPlayerIndex]!;
    if (p.kind !== "ai" || p.eliminated) return;

    state = rollDice(state);
    if (state.phase === "settle") {
      state = aiResolveSettle(state);
      if (state.phase === "settle" && state.prompt.kind === "idle") {
        state = finishSettlement(state);
      }
    }
    emit();

    if (state.prompt.kind === "auction") {
      queueMicrotask(continueAiAuctionIfNeeded);
      return;
    }

    if (state.phase === "end") {
      state = endTurn(state);
      emit();
    }

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

  const afterHumanAuction = () => {
    emit();
    queueMicrotask(() => {
      if (state.prompt.kind === "auction") {
        continueAiAuctionIfNeeded();
        return;
      }
      if (state.phase === "settle" && state.prompt.kind === "idle") {
        // wait for continue
      }
      const n = state.players[state.currentPlayerIndex]!;
      if (n.kind === "ai" && state.phase === "roll") {
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
      if (state.prompt.kind === "auction") {
        queueMicrotask(continueAiAuctionIfNeeded);
      }
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
      if (state.prompt.kind === "auction") {
        queueMicrotask(continueAiAuctionIfNeeded);
      }
    },
    cancelAirportDest() {
      state = cancelAirportDest(state);
      emit();
    },
    portStay() {
      state = portStay(state);
      emit();
    },
    portSail(useShip: boolean) {
      state = portSail(state, useShip);
      emit();
    },
    sellFacility() {
      state = sellFacility(state);
      emit();
    },
    keepFacility() {
      state = keepFacility(state);
      emit();
    },
    useDischargeCard() {
      state = useDischargeCard(state);
      emit();
    },
    acceptHospital() {
      state = acceptHospital(state);
      emit();
    },
    useRentFree() {
      state = useRentFree(state);
      emit();
    },
    declineRentFree() {
      state = declineRentFree(state);
      emit();
      if (state.prompt.kind === "debtAuctionPick" || state.prompt.kind === "auction") {
        queueMicrotask(continueAiAuctionIfNeeded);
      }
    },
    portDispatchTakeCash() {
      state = portDispatchTakeCash(state);
      emit();
    },
    portDispatchTakeShip() {
      state = portDispatchTakeShip(state);
      emit();
    },
    cancelForceAuction() {
      state = cancelForceAuction(state);
      emit();
    },
    proceedForceAuction() {
      state = proceedForceAuction(state);
      emit();
    },
    pickForceAuctionTile(tileIndex: number) {
      state = pickForceAuctionTile(state, tileIndex);
      afterHumanAuction();
    },
    pickDebtAuctionTile(tileIndex: number) {
      state = pickDebtAuctionTile(state, tileIndex);
      afterHumanAuction();
    },
    auctionBid(amount?: number) {
      state = auctionBid(state, amount);
      afterHumanAuction();
    },
    auctionBuyout() {
      state = auctionDoBuyout(state);
      afterHumanAuction();
    },
    auctionPass() {
      state = auctionDoPass(state);
      afterHumanAuction();
    },
    skipSwap() {
      state = skipSwap(state);
      emit();
    },
    swapWith(otherId: string) {
      state = swapWith(state, otherId);
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
