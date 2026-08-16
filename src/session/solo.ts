import {
  acceptHospital,
  acceptCasinoEnter,
  airportBeginFly,
  airportFlyTo,
  airportStay,
  airportFare,
  auctionBid,
  auctionDoBuyout,
  auctionDoPass,
  cancelAirportDest,
  cancelForceAuction,
  cancelCasinoEnter,
  chooseBuy,
  chooseRacetrackExit,
  chooseUpgrade,
  continuePairRoll,
  createInitialState,
  currentPlayer,
  declineBuy,
  declineOilOnSpecialRent,
  declineRentFree,
  declineUpgrade,
  endTurn,
  finishSettlement,
  getAuctionView,
  gunBuildOptions,
  gunDemolishOptions,
  initiativeActorId,
  keepFacility,
  casinoEntrances,
  ownedPropertiesForCurrent,
  ownedPropertiesForDebtor,
  demolishOptionsForDebtor,
  facilitySellOptionsForDebtor,
  pickDebtAuctionTile,
  pickDebtDemolishTile,
  pickDebtFacilitySell,
  pickForceAuctionTile,
  pickGunBuild,
  pickGunDemolish,
  skipGunEffect,
  freeSailTo,
  portSail,
  portStay,
  proceedForceAuction,
  propertyTiles,
  rollDice,
  rollInitiative,
  sellFacility,
  skipSwap,
  skipHospitalTurn,
  swapWith,
  useDischargeCard,
  useOilOnSpecialRent,
  useRentFree,
  type GameConfig,
  type GameState,
  type SpecialKind,
} from "../engine/game";
import { reshuffleDrawPile } from "../engine/deck";

export interface GameSession {
  readonly kind: "solo" | "hotseat" | "online";
  getState(): GameState;
  /** True while an AI turn is being presented with pauses. */
  getAiPlaying(): boolean;
  subscribe(listener: (state: GameState) => void): () => void;
  roll(): void;
  continueTurn(): void;
  skipHospitalTurn(): void;
  buy(): void;
  declineBuy(): void;
  upgrade(special?: SpecialKind): void;
  declineUpgrade(): void;
  airportStay(): void;
  airportBeginFly(usePlane?: boolean): void;
  airportFlyTo(tileIndex: number): void;
  cancelAirportDest(): void;
  portStay(): void;
  portSail(useShip: boolean): void;
  freeSailTo(tileIndex: number): void;
  sellFacility(): void;
  keepFacility(): void;
  useDischargeCard(): void;
  acceptHospital(): void;
  useRentFree(): void;
  declineRentFree(): void;
  useOilOnSpecialRent(): void;
  declineOilOnSpecialRent(): void;
  cancelForceAuction(): void;
  proceedForceAuction(): void;
  pickForceAuctionTile(tileIndex: number): void;
  pickDebtAuctionTile(tileIndex: number): void;
  pickDebtDemolishTile(tileIndex: number): void;
  pickDebtFacilitySell(tileIndex: number): void;
  auctionBid(amount?: number): void;
  auctionBuyout(): void;
  auctionPass(): void;
  cancelCasinoEnter(): void;
  acceptCasinoEnter(): void;
  pickGunBuild(tileIndex: number): void;
  pickGunDemolish(tileIndex: number): void;
  skipGunEffect(): void;
  chooseRacetrackExit(tileIndex: number): void;
  skipSwap(): void;
  swapWith(otherId: string): void;
  /** Serialize current board for persist layer. */
  exportState(): GameState;
  /** Restore a full board snapshot (stops AI, then may resume AI turn). */
  importState(next: GameState): void;
}

function aiPickAirportDest(
  state: GameState,
  free: boolean,
  usePlane: boolean,
): number | null {
  const player = currentPlayer(state);
  const candidates = propertyTiles(state)
    .map((t) => ({
      t,
      fare: airportFare(t.price ?? 0, { free, usePlane }),
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
  if (actor.cash >= minBid) {
    // Prefer pass if cash is tight after bidding start price
    if (actor.cash < minBid + 200 && auction.currentBid > 0) {
      return auctionDoPass(state);
    }
    return auctionBid(state, minBid);
  }
  return auctionDoPass(state);
}

function settleKey(state: GameState): string {
  const a = state.auction;
  return [
    state.prompt.kind,
    a?.cursor,
    a?.currentBid,
    a?.highBidderId,
    a?.activeIds.join(","),
  ].join("|");
}

function aiResolveSettle(state: GameState): GameState {
  let s = state;
  let guard = 0;
  let lastKey = "";
  let stuckHits = 0;
  while (s.phase === "settle" && s.prompt.kind !== "idle" && guard < 50) {
    guard += 1;
    const key = settleKey(s);
    if (key === lastKey) {
      stuckHits += 1;
      if (stuckHits >= 3) {
        s = {
          ...s,
          auction: null,
          prompt: { kind: "idle" },
          log: [`AI 结算卡住，已跳过（${s.prompt.kind}）`, ...s.log].slice(
            0,
            60,
          ),
        };
        break;
      }
    } else {
      stuckHits = 0;
      lastKey = key;
    }
    const player = currentPlayer(s);

    if (s.prompt.kind === "auction") {
      const view = getAuctionView(s);
      if (!view?.actorId) {
        s = {
          ...s,
          auction: null,
          prompt: { kind: "idle" },
          log: ["拍卖无出价方，已结束", ...s.log].slice(0, 60),
        };
        continue;
      }
      const actor = s.players.find((p) => p.id === view.actorId);
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
      const { cost, mode, tileIndex } = s.prompt;
      if (player.cash >= cost + 600) {
        if (mode === "house") {
          s = chooseUpgrade(s);
        } else if (mode === "specialize") {
          s = chooseUpgrade(s, "industry");
        } else {
          const cur = s.deeds[tileIndex]?.special;
          const next =
            cur === "industry"
              ? "commerce"
              : cur === "commerce"
                ? "tourism"
                : "industry";
          s = chooseUpgrade(s, next);
        }
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
      if (player.hasShip) s = portSail(s, true);
      else if (player.cash >= 200) s = portSail(s, false);
      else s = portStay(s);
      continue;
    }

    if (s.prompt.kind === "freeSail") {
      const ports = s.tiles.filter(
        (t) => t.kind === "port" && t.index !== player.position,
      );
      const dest = ports[0];
      if (dest) s = freeSailTo(s, dest.index);
      else s = portStay(s);
      continue;
    }

    if (s.prompt.kind === "airport" || s.prompt.kind === "freeFlight") {
      const free = s.prompt.kind === "freeFlight";
      const usePlane = !free && player.hasPlane;
      const dest = aiPickAirportDest(s, free, usePlane);
      if (dest == null) {
        // Holding a plane but can't afford ×1? try ×2 without token
        if (!free && usePlane) {
          const destFull = aiPickAirportDest(s, false, false);
          if (destFull != null) {
            s = airportBeginFly(s, false);
            s = airportFlyTo(s, destFull);
            continue;
          }
        }
        s = airportStay(s);
      } else {
        s = airportBeginFly(s, usePlane);
        s = airportFlyTo(s, dest);
      }
      continue;
    }

    if (s.prompt.kind === "airportDest") {
      const dest = aiPickAirportDest(
        s,
        s.prompt.free,
        s.prompt.usePlane,
      );
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

    if (s.prompt.kind === "oilSpecialRent") {
      const save = s.prompt.receivable - s.prompt.baseRent;
      // Sacrifice oil when it saves a meaningful amount.
      s =
        save >= 80
          ? useOilOnSpecialRent(s)
          : declineOilOnSpecialRent(s);
      continue;
    }

    if (s.prompt.kind === "forceAuction") {
      s = player.hasVipCard
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

    if (s.prompt.kind === "debtDemolishPick") {
      const props = demolishOptionsForDebtor(s).sort(
        (a, b) =>
          (s.deeds[b.index]?.houses ?? 0) - (s.deeds[a.index]?.houses ?? 0),
      );
      if (!props[0]) s = { ...s, prompt: { kind: "idle" }, pendingDebt: null };
      else s = pickDebtDemolishTile(s, props[0].index);
      continue;
    }

    if (s.prompt.kind === "debtFacilitySell") {
      const props = facilitySellOptionsForDebtor(s);
      if (!props[0]) s = { ...s, prompt: { kind: "idle" }, pendingDebt: null };
      else s = pickDebtFacilitySell(s, props[0].index);
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

    if (s.prompt.kind === "eventMove") {
      s = continuePairRoll(s);
      continue;
    }

    if (s.prompt.kind === "casinoEnter") {
      s = player.hasVipCard ? cancelCasinoEnter(s) : acceptCasinoEnter(s);
      continue;
    }

    if (s.prompt.kind === "racetrackGunBuild") {
      const opts = gunBuildOptions(s, player.id);
      s = opts[0] ? pickGunBuild(s, opts[0].index) : { ...s, prompt: { kind: "idle" } };
      continue;
    }

    if (s.prompt.kind === "racetrackGunDemolish") {
      const opts = gunDemolishOptions(s, player.id);
      s = opts[0]
        ? pickGunDemolish(s, opts[0].index)
        : { ...s, prompt: { kind: "idle" } };
      continue;
    }

    if (s.prompt.kind === "racetrackExit") {
      const entrances = casinoEntrances(s);
      s = entrances[0]
        ? chooseRacetrackExit(s, entrances[0].index)
        : { ...s, prompt: { kind: "idle" } };
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

  /** Beat between AI presentation steps (focus / roll / settle / end). */
  const AI_BEAT_MS = 200;
  let aiPlaying = false;
  let aiRunId = 0;

  const beat = (runId: number) =>
    new Promise<boolean>((resolve) => {
      globalThis.setTimeout(() => resolve(runId === aiRunId), AI_BEAT_MS);
    });

  const setAiPlaying = (v: boolean) => {
    if (aiPlaying === v) return;
    aiPlaying = v;
    emit();
  };

  let auctionEpoch = 0;

  /** After AI settle becomes idle (e.g. auction done), close turn and chain. */
  const finishAiSettleAndContinue = async (runId: number) => {
    if (runId !== aiRunId || state.winnerId) {
      setAiPlaying(false);
      return;
    }

    // Close settle even if current player just went bankrupt (estate auctions done).
    if (state.phase === "settle" && state.prompt.kind === "idle") {
      state = finishSettlement(state);
    }
    if (state.phase === "end") {
      // Show settle result, then end turn.
      if (!(await beat(runId))) return;
      state = endTurn(state);
      emit();
      await runAiIfNeeded();
      return;
    }

    const cur = state.players[state.currentPlayerIndex]!;
    if (cur.kind !== "ai" || cur.eliminated) {
      setAiPlaying(false);
    }
  };

  const continueAiAuctionIfNeeded = async (runId: number) => {
    if (runId !== aiRunId || state.winnerId) {
      setAiPlaying(false);
      return;
    }
    const epoch = auctionEpoch;

    // Already finished — just advance AI turn (no error log)
    if (state.prompt.kind !== "auction") {
      await finishAiSettleAndContinue(runId);
      return;
    }

    const view = getAuctionView(state);
    const actor = view?.actorId
      ? state.players.find((p) => p.id === view.actorId)
      : null;

    if (!view || !actor) {
      // Recover desynced auction quietly (sale often already logged)
      state = { ...state, auction: null, prompt: { kind: "idle" } };
      emit();
      await finishAiSettleAndContinue(runId);
      return;
    }

    if (actor.kind !== "ai") {
      setAiPlaying(false);
      return;
    }

    if (!(await beat(runId))) return;

    const before = settleKey(state);
    state = aiAuctionStep(state);
    emit();
    if (epoch !== auctionEpoch || runId !== aiRunId) return;

    if (settleKey(state) === before && state.prompt.kind === "auction") {
      state = auctionDoPass(state);
      emit();
    }

    if (state.prompt.kind === "auction") {
      await continueAiAuctionIfNeeded(runId);
    } else {
      await finishAiSettleAndContinue(runId);
    }
  };

  const runAiIfNeeded = async () => {
    const runId = ++aiRunId;
    if (state.winnerId) {
      setAiPlaying(false);
      return;
    }

    // Opening order: auto-roll for AI actors only (keep snappy)
    if (state.phase === "initiative") {
      let guard = 0;
      while (state.phase === "initiative" && guard++ < 80) {
        const actorId = initiativeActorId(state);
        if (!actorId) break;
        const actor = state.players.find((p) => p.id === actorId);
        if (!actor || actor.kind !== "ai") break;
        state = rollInitiative(state);
        emit();
      }
      // Still waiting on a human roll — stop. If finalize flipped to "roll", fall through.
      if (state.phase === "initiative") {
        setAiPlaying(false);
        return;
      }
    }

    const p = state.players[state.currentPlayerIndex]!;

    // Estate / debt auctions may run while current player is already eliminated.
    if (state.phase === "settle" && state.prompt.kind === "auction") {
      setAiPlaying(true);
      await continueAiAuctionIfNeeded(runId);
      return;
    }

    if (p.eliminated) {
      if (state.phase === "settle" && state.prompt.kind === "idle") {
        state = finishSettlement(state);
      }
      if (state.phase === "end") {
        state = endTurn(state);
        emit();
        await runAiIfNeeded();
      } else {
        setAiPlaying(false);
      }
      return;
    }

    if (p.kind !== "ai") {
      setAiPlaying(false);
      return;
    }

    setAiPlaying(true);

    // Resume mid-settle (e.g. after human auction bid ended)
    if (state.phase === "settle") {
      if (state.prompt.kind !== "idle") {
        state = aiResolveSettle(state);
        emit();
        if (state.prompt.kind === "auction") {
          auctionEpoch += 1;
          await continueAiAuctionIfNeeded(runId);
          return;
        }
        if (state.prompt.kind === "idle") {
          await finishAiSettleAndContinue(runId);
          return;
        }
        state = {
          ...state,
          auction: null,
          prompt: { kind: "idle" },
          log: [
            `AI 回合无法处理「${state.prompt.kind}」，已跳过`,
            ...state.log,
          ].slice(0, 60),
        };
        emit();
        await finishAiSettleAndContinue(runId);
        return;
      }
      await finishAiSettleAndContinue(runId);
      return;
    }

    if (state.phase === "end") {
      state = endTurn(state);
      emit();
      await runAiIfNeeded();
      return;
    }

    // --- Presented AI turn from roll ---
    // 1) Focus: current token already enlarged after endTurn; pause.
    if (!(await beat(runId))) return;

    // 2) Roll (HUD dice / hospital skip log)
    state = rollDice(state);
    emit();
    if (!(await beat(runId))) return;

    // 3) Move is applied inside rollDice; resolve settle + show result
    if (state.phase === "settle") {
      state = aiResolveSettle(state);
      if (state.phase === "settle" && state.prompt.kind === "idle") {
        state = finishSettlement(state);
      }
      emit();

      if (state.prompt.kind === "auction") {
        auctionEpoch += 1;
        await continueAiAuctionIfNeeded(runId);
        return;
      }

      if (!(await beat(runId))) return;
    }

    // 4) End turn → next player (focus pause happens at start of next AI turn)
    if (state.phase === "end") {
      state = endTurn(state);
      emit();
    }

    if (runId !== aiRunId) return;

    const n = state.players[state.currentPlayerIndex]!;
    if (
      !state.winnerId &&
      n.kind === "ai" &&
      !n.eliminated &&
      (state.phase === "roll" || state.phase === "end")
    ) {
      await runAiIfNeeded();
      return;
    }

    setAiPlaying(false);
  };

  const afterHumanAuction = () => {
    emit();
    void (async () => {
      if (state.prompt.kind === "auction") {
        auctionEpoch += 1;
        setAiPlaying(true);
        await continueAiAuctionIfNeeded(++aiRunId);
        return;
      }
      const cur = state.players[state.currentPlayerIndex]!;
      if (cur.kind === "ai") {
        setAiPlaying(true);
        await finishAiSettleAndContinue(++aiRunId);
      }
    })();
  };

  // Opening order may put an AI first — start their turn
  queueMicrotask(() => {
    void runAiIfNeeded();
  });

  return {
    kind: "solo",
    getState: () => state,
    getAiPlaying: () => aiPlaying,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    roll() {
      if (state.winnerId) return;
      if (state.phase === "initiative") {
        const actorId = initiativeActorId(state);
        const actor = actorId
          ? state.players.find((p) => p.id === actorId)
          : null;
        if (!actor || actor.kind !== "human") return;
        state = rollInitiative(state);
        emit();
        void runAiIfNeeded();
        return;
      }
      if (
        state.phase === "settle" &&
        (state.prompt.kind === "trackJudge" ||
          state.prompt.kind === "casinoRoll" ||
          state.prompt.kind === "eventMove")
      ) {
        const p = state.players[state.currentPlayerIndex]!;
        if (p.kind !== "human") return;
        state = continuePairRoll(state);
        emit();
        if (state.prompt.kind === "auction") {
          void runAiIfNeeded();
        }
        return;
      }
      const p = state.players[state.currentPlayerIndex]!;
      if (p.kind !== "human" || state.phase !== "roll") return;
      state = rollDice(state);
      emit();
      if (state.prompt.kind === "auction") {
        void runAiIfNeeded();
      }
    },
    continueTurn() {
      if (state.winnerId) return;
      if (state.phase === "settle") {
        if (state.prompt.kind !== "idle") return;
        state = finishSettlement(state);
        state = endTurn(state);
        emit();
        void runAiIfNeeded();
      } else if (state.phase === "end") {
        // Allow unsticking AI end-phase as well
        state = endTurn(state);
        emit();
        void runAiIfNeeded();
      }
    },
    skipHospitalTurn() {
      if (state.winnerId) return;
      const p = state.players[state.currentPlayerIndex]!;
      if (p.kind !== "human" || state.phase !== "roll" || p.hospitalSkips <= 0) {
        return;
      }
      state = skipHospitalTurn(state);
      emit();
      void runAiIfNeeded();
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
    airportBeginFly(usePlane = false) {
      state = airportBeginFly(state, usePlane);
      emit();
    },
    airportFlyTo(tileIndex: number) {
      state = airportFlyTo(state, tileIndex);
      emit();
      if (state.prompt.kind === "auction") {
        void runAiIfNeeded();
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
    freeSailTo(tileIndex: number) {
      state = freeSailTo(state, tileIndex);
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
      if (
        state.prompt.kind === "debtDemolishPick" ||
        state.prompt.kind === "debtFacilitySell" ||
        state.prompt.kind === "debtAuctionPick" ||
        state.prompt.kind === "auction"
      ) {
        void runAiIfNeeded();
      }
    },
    useOilOnSpecialRent() {
      state = useOilOnSpecialRent(state);
      emit();
      if (
        state.prompt.kind === "debtDemolishPick" ||
        state.prompt.kind === "debtFacilitySell" ||
        state.prompt.kind === "debtAuctionPick" ||
        state.prompt.kind === "auction"
      ) {
        void runAiIfNeeded();
      }
    },
    declineOilOnSpecialRent() {
      state = declineOilOnSpecialRent(state);
      emit();
      if (
        state.prompt.kind === "debtDemolishPick" ||
        state.prompt.kind === "debtFacilitySell" ||
        state.prompt.kind === "debtAuctionPick" ||
        state.prompt.kind === "auction"
      ) {
        void runAiIfNeeded();
      }
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
    pickDebtDemolishTile(tileIndex: number) {
      state = pickDebtDemolishTile(state, tileIndex);
      emit();
      if (
        state.prompt.kind === "debtDemolishPick" ||
        state.prompt.kind === "debtFacilitySell" ||
        state.prompt.kind === "debtAuctionPick" ||
        state.prompt.kind === "auction"
      ) {
        void runAiIfNeeded();
      }
    },
    pickDebtFacilitySell(tileIndex: number) {
      state = pickDebtFacilitySell(state, tileIndex);
      emit();
      if (
        state.prompt.kind === "debtDemolishPick" ||
        state.prompt.kind === "debtFacilitySell" ||
        state.prompt.kind === "debtAuctionPick" ||
        state.prompt.kind === "auction"
      ) {
        void runAiIfNeeded();
      }
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
    cancelCasinoEnter() {
      state = cancelCasinoEnter(state);
      emit();
    },
    acceptCasinoEnter() {
      state = acceptCasinoEnter(state);
      emit();
      if (state.prompt.kind === "auction" || state.prompt.kind === "debtAuctionPick" || state.prompt.kind === "debtDemolishPick" || state.prompt.kind === "debtFacilitySell") {
        void runAiIfNeeded();
      }
    },
    pickGunBuild(tileIndex: number) {
      state = pickGunBuild(state, tileIndex);
      emit();
    },
    pickGunDemolish(tileIndex: number) {
      state = pickGunDemolish(state, tileIndex);
      emit();
    },
    skipGunEffect() {
      state = skipGunEffect(state);
      emit();
    },
    chooseRacetrackExit(tileIndex: number) {
      state = chooseRacetrackExit(state, tileIndex);
      emit();
      if (state.prompt.kind === "auction") {
        void runAiIfNeeded();
      }
    },
    skipSwap() {
      state = skipSwap(state);
      emit();
    },
    swapWith(otherId: string) {
      state = swapWith(state, otherId);
      emit();
    },
    exportState() {
      return structuredClone(state);
    },
    importState(next: GameState) {
      aiRunId += 1;
      auctionEpoch += 1;
      aiPlaying = false;
      // Keep remaining card set, but re-shuffle order so reload isn't deterministic.
      state = {
        ...next,
        pendingCasino: next.pendingCasino ?? null,
        eventDeck: reshuffleDrawPile(next.eventDeck),
        lastDice: null,
        lastCasinoDice: null,
        lastTrackDice: null,
      };
      emit();
      void runAiIfNeeded();
    },
  };
}

export type { GameState, GameConfig, SpecialKind };
