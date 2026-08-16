import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject, type ReactNode } from "react";
import boardUrl from "@assets/board-map-v7.png";
import { BOARD_PNG, LEGEND_CONTINENTS, legendContinentSwatchPercent, legendRulesButtonPercent, tileCenterPercent, tileContinentBarPercent, tileRectPercent } from "./engine/board";
import { cardLabel } from "./engine/deck";
import { continentControllerId } from "./engine/deeds";
import {
  getAuctionView,
  gunBuildOptions,
  gunDemolishOptions,
  initiativeActorId,
  casinoEntrances,
  ownedPropertiesForCurrent,
  ownedPropertiesForDebtor,
  demolishOptionsForDebtor,
  facilitySellOptionsForDebtor,
  propertyTiles,
  type GameConfig,
  type GameState,
} from "./engine/game";
import {
  BOARD_TOP_STRIP,
  PLAZA_HUD_PERCENT,
  racetrackSeatPercent,
} from "./engine/racetrack";
import {
  buildSaveFile,
  deleteSaveSlot,
  readSaveSlot,
  writeSaveSlot,
} from "./persist/saves";
import { createSoloSession, type GameSession } from "./session/solo";
import { BtnLabel } from "./ui/BtnLabel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { RulesManual, RulesOpenButton } from "./ui/RulesManual";
import { EulaModal } from "./ui/EulaModal";
import {
  IconCoin,
  IconDiceFace,
  IconDischarge,
  IconFactory,
  IconHouse,
  IconLandFlag,
  IconPlane,
  IconShip,
  IconSuitcase,
  IconVipCard,
  IconPort,
  IconOil,
  IconMine,
} from "./ui/icons";
import { locationView } from "./ui/location";
import { LocFlag } from "./ui/locFlag";
import { Money } from "./ui/money";
import { SaveSlotModal, type SaveModalMode } from "./ui/SaveSlotModal";
import { SetupScreen } from "./ui/SetupScreen";

/** Design width where HUD type/icons look correct at 1×. */
const BOARD_DESIGN_WIDTH = 900;

function DiceReadout({
  lastDice,
  lastTrackDice,
  lastCasinoDice,
}: {
  lastDice: number | null;
  lastTrackDice: [number, number] | null;
  lastCasinoDice: [number, number] | null;
}) {
  if (lastTrackDice) {
    const [a, b] = lastTrackDice;
    return (
      <div className="dice-readout" title={`${a}−${b}`}>
        <IconDiceFace value={a} className="die-face" />
        <span className="die-op">−</span>
        <IconDiceFace value={b} className="die-face" />
        <span className="die-sum">{a - b}</span>
      </div>
    );
  }
  if (lastCasinoDice) {
    const [a, b] = lastCasinoDice;
    return (
      <div className="dice-readout" title={`${a}+${b}`}>
        <IconDiceFace value={a} className="die-face" />
        <span className="die-op">+</span>
        <IconDiceFace value={b} className="die-face" />
        <span className="die-sum">{a + b}</span>
      </div>
    );
  }
  if (lastDice == null) {
    return <div className="dice-readout muted">—</div>;
  }
  return (
    <div className="dice-readout" title={String(lastDice)}>
      <IconDiceFace value={lastDice} className="die-face" />
      <span className="die-sum">{lastDice}</span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<"setup" | "play">("setup");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const pendingImport = useRef<GameState | null>(null);

  const session = useMemo(() => {
    if (!config) return null;
    return createSoloSession(config);
  }, [config, sessionEpoch]);

  const [state, setState] = useState<GameState | null>(null);
  const [aiPlaying, setAiPlaying] = useState(false);
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const [boardScale, setBoardScale] = useState(1);

  const [saveMode, setSaveMode] = useState<SaveModalMode | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    confirmLabel?: string;
    confirmEn?: string;
    onConfirm: () => void;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [eulaOpen, setEulaOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      setState(null);
      setAiPlaying(false);
      return;
    }
    if (pendingImport.current) {
      const snap = pendingImport.current;
      pendingImport.current = null;
      session.importState(snap);
    }
    setState(session.getState());
    setAiPlaying(session.getAiPlaying());
    return session.subscribe((s) => {
      setState(s);
      setAiPlaying(session.getAiPlaying());
    });
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const el = boardFrameRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      setBoardScale(Math.max(0.72, Math.min(1.15, w / BOARD_DESIGN_WIDTH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [screen, session]);

  const startGame = (cfg: { humans: number; ais: number }) => {
    pendingImport.current = null;
    setConfig({ humans: cfg.humans, ais: cfg.ais, startingCash: 5000 });
    setSessionEpoch((n) => n + 1);
    setScreen("play");
  };

  const goSetup = () => {
    pendingImport.current = null;
    setConfig(null);
    setSessionEpoch((n) => n + 1);
    setScreen("setup");
    setSaveMode(null);
    setConfirm(null);
  };

  const requestRestart = () => {
    setConfirm({
      title: "重新开始？",
      message: "将离开当前对局并回到人数选择。未保存进度会丢失。",
      danger: true,
      confirmLabel: "重开",
      confirmEn: "Restart",
      onConfirm: () => {
        setConfirm(null);
        goSetup();
      },
    });
  };

  const applyLoad = async (slot: number) => {
    const file = await readSaveSlot(slot);
    if (!file) {
      setToast(`存档 #${slot} 不存在 · Save #${slot} missing`);
      return;
    }
    pendingImport.current = file.state;
    setConfig({
      humans: file.config.humans,
      ais: file.config.ais,
      startingCash: file.config.startingCash ?? 5000,
    });
    setSessionEpoch((n) => n + 1);
    setScreen("play");
    setToast(`已读取存档 #${slot} · Loaded slot #${slot}`);
  };

  const applySave = async (slot: number) => {
    if (!session || !config) return;
    const file = buildSaveFile(session.exportState(), config);
    const where = await writeSaveSlot(slot, file);
    setToast(
      where === "disk"
        ? `已保存到本机 save/slot-${slot}.json · Saved to disk slot #${slot}`
        : `已保存到本浏览器本地 #${slot}（非云存档） · Saved in this browser only #${slot}`,
    );
  };

  const applyDelete = async (slot: number) => {
    await deleteSaveSlot(slot);
    setToast(`已删除存档 #${slot} · Deleted slot #${slot}`);
  };

  const onSlotPicked = (slot: number, exists: boolean) => {
    const mode = saveMode;
    setSaveMode(null);
    if (!mode) return;

    if (mode === "save") {
      setConfirm({
        title: exists ? `覆盖存档 #${slot}？` : `保存到 #${slot}？`,
        message: exists
          ? "将覆盖该槽位已有进度，不可撤销。\n网页版存档仅在本浏览器；清数据/换设备会丢失。\n\nThis overwrites the slot permanently. Web saves stay in this browser only and can be lost if you clear site data or switch devices."
          : "将写入当前存档位。网页版（itch 等）只存在本浏览器，不是云存档，无法跨设备同步。\n\nSaves go to the current slot. On itch/web builds they stay in this browser only — not cloud, not synced across devices.",
        confirmLabel: "保存",
        confirmEn: "Save",
        onConfirm: () => {
          setConfirm(null);
          void applySave(slot);
        },
      });
      return;
    }

    if (mode === "load") {
      setConfirm({
        title: `读取存档 #${slot}？`,
        message:
          screen === "play"
            ? "将丢弃当前未保存进度，并恢复该存档盘面。\n\nUnsaved progress will be discarded and this slot loaded."
            : "将加载该存档并进入游戏。\n\nLoad this slot and enter the game.",
        confirmLabel: "读取",
        confirmEn: "Load",
        onConfirm: () => {
          setConfirm(null);
          void applyLoad(slot);
        },
      });
      return;
    }

    setConfirm({
      title: `删除存档 #${slot}？`,
      message:
        "将永久删除该槽位存档，不可撤销。\n\nPermanently delete this slot. This cannot be undone.",
      danger: true,
      confirmLabel: "删除",
      confirmEn: "Delete",
      onConfirm: () => {
        setConfirm(null);
        void applyDelete(slot);
      },
    });
  };

  const shell = (
    <>
      <SaveSlotModal
        open={saveMode != null}
        mode={saveMode ?? "load"}
        onCancel={() => setSaveMode(null)}
        onPick={(slot, info) => onSlotPicked(slot, info.exists)}
      />
      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        danger={confirm?.danger}
        confirmLabel={confirm?.confirmLabel}
        confirmEn={confirm?.confirmEn}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />
      <RulesManual open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <EulaModal open={eulaOpen} onClose={() => setEulaOpen(false)} />
      {toast ? <div className="app-toast">{toast}</div> : null}
    </>
  );

  if (screen === "setup" || !session || !state || !config) {
    return (
      <div className="app">
        <SetupScreen
          onStart={startGame}
          onOpenLoad={() => setSaveMode("load")}
          onOpenDelete={() => setSaveMode("delete")}
          onOpenRules={() => setRulesOpen(true)}
          onOpenEula={() => setEulaOpen(true)}
        />
        {shell}
      </div>
    );
  }

  return (
    <GameTable
      session={session}
      state={state}
      aiPlaying={aiPlaying}
      boardFrameRef={boardFrameRef}
      boardScale={boardScale}
      onRestart={requestRestart}
      onSave={() => setSaveMode("save")}
      onLoad={() => setSaveMode("load")}
      onDelete={() => setSaveMode("delete")}
      onOpenRules={() => setRulesOpen(true)}
      shell={shell}
    />
  );
}

function GameTable({
  session,
  state,
  aiPlaying,
  boardFrameRef,
  boardScale,
  onRestart,
  onSave,
  onLoad,
  onDelete,
  onOpenRules,
  shell,
}: {
  session: GameSession;
  state: GameState;
  aiPlaying: boolean;
  boardFrameRef: RefObject<HTMLDivElement | null>;
  boardScale: number;
  onRestart: () => void;
  onSave: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onOpenRules: () => void;
  shell: ReactNode;
}) {
  const current = state.players[state.currentPlayerIndex]!;
  const auctionView = getAuctionView(state);
  const auctionActor = auctionView?.actorId
    ? state.players.find((p) => p.id === auctionView.actorId)
    : null;
  const prompt = state.prompt;
  const humanBidding =
    !!auctionActor && auctionActor.kind === "human" && !state.winnerId;

  const debtDebtor = state.pendingDebt
    ? state.players.find((p) => p.id === state.pendingDebt!.debtorId)
    : null;
  const humanDebtFundraising =
    !!debtDebtor &&
    debtDebtor.kind === "human" &&
    !debtDebtor.eliminated &&
    (prompt.kind === "debtDemolishPick" ||
      prompt.kind === "debtFacilitySell" ||
      prompt.kind === "debtAuctionPick");

  const initiativeActor = (() => {
    const id = initiativeActorId(state);
    return id ? state.players.find((p) => p.id === id) : null;
  })();

  const humanTurn =
    ((current.kind === "human" && !state.winnerId) ||
      humanBidding ||
      humanDebtFundraising) &&
    !aiPlaying;
  const humanPairRoll =
    state.phase === "settle" &&
    (prompt.kind === "trackJudge" || prompt.kind === "casinoRoll") &&
    current.kind === "human" &&
    !state.winnerId;
  const humanEventMove =
    state.phase === "settle" &&
    prompt.kind === "eventMove" &&
    current.kind === "human" &&
    !state.winnerId;

  const humanInitiative =
    state.phase === "initiative" &&
    !!initiativeActor &&
    initiativeActor.kind === "human" &&
    !state.winnerId;
  const hospitalSkipTurn =
    current.kind === "human" &&
    !state.winnerId &&
    state.phase === "roll" &&
    current.hospitalSkips > 0;

  const canRoll =
    !state.winnerId &&
    !aiPlaying &&
    !hospitalSkipTurn &&
    (humanInitiative ||
      humanPairRoll ||
      humanEventMove ||
      (current.kind === "human" && state.phase === "roll"));
  const canContinue =
    current.kind === "human" &&
    !state.winnerId &&
    !aiPlaying &&
    !humanPairRoll &&
    !humanEventMove &&
    !hospitalSkipTurn &&
    ((state.phase === "settle" && state.prompt.kind === "idle") ||
      state.phase === "end");

  const pairFirst =
    prompt.kind === "trackJudge" || prompt.kind === "casinoRoll"
      ? prompt.first
      : (state.initiative?.partialDie ?? null);

  const rollButtonLabel = (() => {
    if (humanEventMove) {
      return prompt.direction === "back"
        ? { zh: "掷骰决定后退", en: "Roll back" }
        : { zh: "掷骰决定前进", en: "Roll forward" };
    }
    if (state.phase === "initiative" || humanPairRoll) {
      return pairFirst == null
        ? { zh: "掷第 1 次骰子", en: "1st die" }
        : { zh: "掷第 2 次骰子", en: "2nd die" };
    }
    return { zh: "掷骰", en: "Roll" };
  })();

  const playHeightRatio = BOARD_PNG.playSize / BOARD_PNG.height;

  const buyTile =
    prompt.kind === "buy" ? state.tiles[prompt.tileIndex] : null;
  const upgradeTile =
    prompt.kind === "upgrade" ? state.tiles[prompt.tileIndex] : null;

  const auctionTile =
    auctionView != null ? state.tiles[auctionView.auction.tileIndex] : null;

  /** Only compact HUD for tall choice lists that otherwise clip buttons */
  const choiceFocus =
    humanTurn &&
    (prompt.kind === "racetrackExit" ||
      prompt.kind === "racetrackGunBuild" ||
      prompt.kind === "racetrackGunDemolish" ||
      prompt.kind === "airportDest" ||
      prompt.kind === "forceAuctionPick" ||
      prompt.kind === "debtDemolishPick" ||
      prompt.kind === "debtFacilitySell" ||
      prompt.kind === "debtAuctionPick" ||
      prompt.kind === "swap" ||
      prompt.kind === "port" ||
      prompt.kind === "freeSail");

  const phaseLabel = state.winnerId
    ? "终局"
    : aiPlaying
      ? `AI 演示 · ${current.name}`
      : state.phase === "initiative"
      ? "定出发顺序"
      : humanEventMove
        ? prompt.direction === "back"
          ? "事件后退"
          : "事件前进"
      : humanPairRoll
        ? prompt.kind === "trackJudge"
          ? "赌场判定"
          : "证券掷骰"
        : current.racetrackPos != null && state.phase === "roll"
          ? "赌场掷骰"
          : state.phase === "roll"
            ? current.hospitalSkips > 0
              ? "住院跳过"
              : "掷骰"
            : state.phase === "settle"
              ? "结算"
              : "回合结束";

  return (
    <div className="app">
      <main className="layout">
        <section className="board-wrap">
          <div
            className="board-frame"
            ref={boardFrameRef}
            style={
              {
                "--board-scale": boardScale,
              } as CSSProperties
            }
          >
            <img
              className="board-img"
              src={boardUrl}
              alt="花花世界棋盘"
              draggable={false}
            />

            <div
              className="board-top-strip"
              style={{
                left: `${BOARD_TOP_STRIP.left}%`,
                top: `${BOARD_TOP_STRIP.top}%`,
                width: `${BOARD_TOP_STRIP.width}%`,
                height: `${BOARD_TOP_STRIP.height}%`,
              }}
            >
              <div className="brand">
                <strong>花花世界</strong>
                <span className="brand-en">Vivondo</span>
              </div>
              <div className="top-menu">
                <button type="button" className="top-menu-btn" onClick={onRestart}>
                  <BtnLabel zh="重开" en="Restart" />
                </button>
                <button type="button" className="top-menu-btn" onClick={onSave}>
                  <BtnLabel zh="保存" en="Save" />
                </button>
                <button type="button" className="top-menu-btn" onClick={onLoad}>
                  <BtnLabel zh="读取" en="Load" />
                </button>
                <button type="button" className="top-menu-btn" onClick={onDelete}>
                  <BtnLabel zh="删除" en="Delete" />
                </button>
              </div>
              <div className="top-meta">
                <span>{state.phase === "initiative" ? "开局" : `回合 ${state.turn}`}</span>
                <span>{current.name}</span>
                {current.racetrackPos != null ? (
                  <span>赌场 {current.racetrackPos}</span>
                ) : null}
                {current.hospitalSkips > 0 ? (
                  <span>住院 {current.hospitalSkips}</span>
                ) : null}
                {state.lastEvent ? (
                  <span>上张 {cardLabel(state.lastEvent)}</span>
                ) : null}
                <span>{phaseLabel}</span>
                <span>奖池 {state.casinoPool}</span>
                <span className="event-deck-meta">
                  事件卡堆 {state.eventDeck.drawPile.length}
                  <span className="event-deck-tip" role="tooltip">
                    {state.eventDeck.drawPile.length === 0 ? (
                      <span>（抽牌堆为空）</span>
                    ) : (
                      (() => {
                        const counts = new Map<string, number>();
                        for (const id of state.eventDeck.drawPile) {
                          const name = cardLabel(id);
                          counts.set(name, (counts.get(name) ?? 0) + 1);
                        }
                        const tipRank = (name: string) => {
                          if (name.startsWith("赌场VIP卡")) return 0;
                          if (name.startsWith("出院卡")) return 1;
                          return 2;
                        };
                        return [...counts.entries()]
                          .sort((a, b) => {
                            const d = tipRank(a[0]) - tipRank(b[0]);
                            if (d !== 0) return d;
                            return a[0].localeCompare(b[0], "zh");
                          })
                          .map(([name, n]) => (
                            <span key={name}>
                              {n > 1 ? `${name} ×${n}` : name}
                            </span>
                          ));
                      })()
                    )}
                  </span>
                </span>
              </div>
            </div>

            <div
              className="token-layer"
              style={{ height: `${playHeightRatio * 100}%` }}
            >
              {state.tiles.map((tile) => {
                const deed = state.deeds[tile.index];
                if (!deed?.ownerId) return null;
                const owner = state.players.find((x) => x.id === deed.ownerId);
                if (!owner) return null;
                const rect = tileRectPercent(tile);
                const bar =
                  tile.kind === "property" ? tileContinentBarPercent(tile) : null;
                const showHouses =
                  tile.kind === "property" &&
                  deed.special == null &&
                  deed.houses > 0;
                const showSpecial =
                  tile.kind === "property" && deed.special != null;
                const stampSize = rect.width * 0.34;
                const stampLeft = rect.left + rect.width * 0.62;
                const stampTop = rect.top + rect.height * 0.04;
                return (
                  <div key={`deed-${tile.index}`}>
                    {/* Hollow ownership frame: tints the rim only, PNG flag/text stay crisp */}
                    <div
                      className="deed-wash"
                      title={`${tile.zh} · ${owner.name}`}
                      style={{
                        left: `${rect.left}%`,
                        top: `${rect.top}%`,
                        width: `${rect.width}%`,
                        height: `${rect.height}%`,
                        borderColor: owner.color,
                      }}
                    />
                    <div
                      className="deed-stamp"
                      title={`${tile.zh} · ${owner.name}`}
                      style={{
                        left: `${stampLeft}%`,
                        top: `${stampTop}%`,
                        width: `${stampSize}%`,
                        background: owner.color,
                      }}
                    >
                      <span className="deed-stamp-ring" aria-hidden />
                      {tile.kind === "facility" || tile.kind === "port" ? (
                        <span className="deed-stamp-label">
                          {tile.kind === "port"
                            ? "港"
                            : tile.zh === "油田"
                              ? "油"
                              : "矿"}
                        </span>
                      ) : null}
                    </div>
                    {bar && (showHouses || showSpecial) ? (
                      <div
                        className="deed-bar"
                        style={{
                          left: `${bar.left}%`,
                          top: `${bar.top}%`,
                          width: `${bar.width}%`,
                          height: `${bar.height}%`,
                        }}
                        title={
                          showSpecial
                            ? deed.special === "industry"
                              ? "工业国"
                              : deed.special === "commerce"
                                ? "商业国"
                                : "旅游国"
                            : `${deed.houses} 屋`
                        }
                      >
                        {showSpecial ? (
                          deed.special === "industry" ? (
                            <IconFactory className="deed-bar-ico" />
                          ) : deed.special === "commerce" ? (
                            <IconCoin className="deed-bar-ico" />
                          ) : (
                            <IconSuitcase className="deed-bar-ico" />
                          )
                        ) : (
                          Array.from({ length: deed.houses }, (_, i) => (
                            <IconHouse key={i} className="deed-bar-ico" />
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {(() => {
                const alive = state.players
                  .map((p, i) => ({ p, i }))
                  .filter(({ p }) => !p.eliminated);
                /** 2×2 corner offsets so 4 tokens on one tile stay visible */
                const STACK = [
                  [-1, -1],
                  [1, -1],
                  [-1, 1],
                  [1, 1],
                ] as const;
                const keyOf = (p: (typeof state.players)[0]) =>
                  p.racetrackPos != null
                    ? `t:${p.racetrackPos}`
                    : `b:${p.position}`;
                const groups = new Map<string, typeof alive>();
                for (const item of alive) {
                  const k = keyOf(item.p);
                  const g = groups.get(k);
                  if (g) g.push(item);
                  else groups.set(k, [item]);
                }
                return alive.map(({ p, i }) => {
                  const group = groups.get(keyOf(p))!;
                  const stackIdx = group.findIndex((x) => x.p.id === p.id);
                  const isActive = i === state.currentPlayerIndex;
                  const seat =
                    p.racetrackPos != null
                      ? racetrackSeatPercent(p.racetrackPos)
                      : tileCenterPercent(state.tiles[p.position]!);
                  const stepPct = p.racetrackPos != null ? 1.05 : 1.55;
                  const [sx, sy] = STACK[stackIdx] ?? [0, 0];
                  const ox = group.length === 1 ? 0 : sx * stepPct;
                  const oy = group.length === 1 ? 0 : sy * stepPct;
                  const label =
                    p.racetrackPos != null
                      ? `${p.name} @ 赌场${p.racetrackPos}`
                      : `${p.name} @ ${state.tiles[p.position]!.zh}`;
                  return (
                    <div
                      key={p.id}
                      className={`token${p.racetrackPos != null ? " on-track" : ""}${isActive ? " active" : ""}`}
                      title={label}
                      style={{
                        left: `${seat.x + ox}%`,
                        top: `${seat.y + oy}%`,
                        background: p.color,
                        zIndex: isActive ? 40 : 12 + stackIdx,
                      }}
                    />
                  );
                });
              })()}
            </div>

            <div className="legend-owners" aria-hidden={false}>
              {LEGEND_CONTINENTS.map((c, i) => {
                const ownerId = continentControllerId(
                  state.tiles,
                  state.deeds,
                  c.id,
                );
                if (!ownerId) return null;
                const owner = state.players.find((p) => p.id === ownerId);
                if (!owner) return null;
                const sw = legendContinentSwatchPercent(i);
                const label =
                  owner.kind === "ai"
                    ? owner.name.replace(/\s+/g, "")
                    : owner.name;
                return (
                  <div
                    key={c.id}
                    className="legend-owner"
                    title={`${c.zh}已由「${owner.name}」完整控制`}
                    style={{
                      left: `${sw.left}%`,
                      top: `${sw.top}%`,
                      width: `${sw.width}%`,
                      height: `${sw.height}%`,
                      background: owner.color,
                    }}
                  >
                    <span className="legend-owner-name">{label}</span>
                  </div>
                );
              })}
            </div>
            {(() => {
              const slot = legendRulesButtonPercent();
              return (
                <RulesOpenButton
                  className="rules-fab"
                  onClick={onOpenRules}
                  style={{
                    left: `${slot.left}%`,
                    top: `${slot.top}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                />
              );
            })()}

            <div
              className="plaza-hud"
              style={{
                left: `${PLAZA_HUD_PERCENT.left}%`,
                top: `${PLAZA_HUD_PERCENT.top * playHeightRatio}%`,
                width: `${PLAZA_HUD_PERCENT.width}%`,
                height: `${PLAZA_HUD_PERCENT.height * playHeightRatio}%`,
              }}
            >
              <div className="plaza-players">
                {state.players.map((p, idx) => {
                  const loc = locationView(
                    state.tiles[p.position],
                    p.racetrackPos,
                  );
                  const LocIcon = loc.Icon;
                  const locText =
                    p.racetrackPos != null
                      ? `${loc.zh} ${loc.code}·${p.racetrackPos}`
                      : `${loc.zh} ${loc.code}`;
                  const ownedPublic = state.tiles.flatMap((t) => {
                    if (state.deeds[t.index]?.ownerId !== p.id) return [];
                    if (t.kind === "port") {
                      return [
                        {
                          key: `port-${t.index}`,
                          title: t.zh,
                          Icon: IconPort,
                        },
                      ];
                    }
                    if (t.kind === "facility") {
                      const oil = t.zh === "油田" || t.zh === "石油";
                      return [
                        {
                          key: `fac-${t.index}`,
                          title: t.zh,
                          Icon: oil ? IconOil : IconMine,
                        },
                      ];
                    }
                    return [];
                  });
                  const ownedCountries = state.tiles.filter(
                    (t) =>
                      t.kind === "property" &&
                      state.deeds[t.index]?.ownerId === p.id,
                  ).length;
                  return (
                    <div
                      key={p.id}
                      className={`player-card${idx === state.currentPlayerIndex ? " active" : ""}${p.eliminated ? " out" : ""}${p.hospitalSkips > 0 ? " hospital" : ""}`}
                      style={{ borderColor: p.color }}
                    >
                      <div className="prow">
                        <span
                          className="dot"
                          style={{ background: p.color }}
                        />
                        <span className="pname">
                          {p.name}
                          {p.kind === "ai" ? "·AI" : ""}
                        </span>
                        {ownedPublic.length > 0 ? (
                          <span className="pfacilities" aria-label="公共设施">
                            {ownedPublic.map(({ key, title, Icon }) => (
                              <span
                                key={key}
                                className="pfac"
                                title={`拥有：${title}`}
                              >
                                <Icon className="pfac-ico" />
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span className="prow-end">
                          <span
                            className="plands"
                            title={`国家地产 ${ownedCountries}`}
                            aria-label={`国家地产 ${ownedCountries}`}
                          >
                            <IconLandFlag className="plands-ico" />
                            <span className="plands-n">{ownedCountries}</span>
                          </span>
                          <span className="pcash">
                            <Money amount={p.cash} />
                          </span>
                        </span>
                      </div>
                      <div className="ppos" title={`${loc.zh} / ${loc.en}`}>
                        {loc.iso2 ? (
                          <LocFlag iso2={loc.iso2} />
                        ) : (
                          <LocIcon className="loc-ico" />
                        )}
                        <span className="ploc">{locText}</span>
                        {p.hospitalSkips > 0 ? (
                          <span className="badge-h">住院{p.hospitalSkips}</span>
                        ) : null}
                        {p.eliminated ? (
                          <span className="badge-out">出局</span>
                        ) : null}
                      </div>
                      <div className="pinventory">
                        <span
                          className={`inv${p.hasPlane ? " on" : ""}`}
                          title="飞机 token：下次机场可原价机票"
                          aria-label="飞机"
                        >
                          <IconPlane className="inv-ico" />
                          飞机
                        </span>
                        <span
                          className={`inv${p.hasShip ? " on" : ""}`}
                          title="轮船 token：下次港口可免票"
                        >
                          <IconShip className="inv-ico" />
                          轮船
                        </span>
                        <span
                          className={`inv${p.hasRentFree ? " on" : ""}`}
                          title="免租 token：抵一次地租"
                        >
                          <IconHouse className="inv-ico" />
                          免租
                        </span>
                        <span
                          className={`inv card${p.hasDischarge ? " on" : ""}`}
                          title="出院卡：取消入院"
                        >
                          <IconDischarge className="inv-ico" />
                          出院
                        </span>
                        <span
                          className={`inv card${p.hasVipCard ? " on" : ""}`}
                          title="赌场VIP卡：取消进赌场/强制拍卖"
                        >
                          <IconVipCard className="inv-ico" />
                          VIP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className={`plaza-controls${choiceFocus ? " choice-focus" : ""}`}
              >
          <div className="panel dice-panel">
            <div className="label">骰子</div>
            <DiceReadout
              lastDice={state.lastDice}
              lastTrackDice={state.lastTrackDice}
              lastCasinoDice={state.lastCasinoDice}
            />
          </div>

          <div className="panel step-stage">
            <div className="step-result">
              <div className="label">本步结果</div>
              <ul className="result-list">
                {state.log
                  .slice(0, prompt.kind === "auction" ? 1 : 2)
                  .map((line, i) => (
                  <li
                    key={`r-${i}-${line}`}
                    className={i === 0 ? "latest" : undefined}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="step-ops">
          {aiPlaying && (
            <div className="panel choice">
              <div className="label">AI 回合</div>
              <p>
                {current.name} 操作中…
                {state.lastDice != null ? ` · 骰子 ${state.lastDice}` : ""}
              </p>
            </div>
          )}

          {state.winnerId && (
            <div className="panel choice victory">
              <div className="label">胜利</div>
              <p>
                恭喜{" "}
                {state.players.find((p) => p.id === state.winnerId)?.name ??
                  "玩家"}{" "}
                —— 获得最终胜利！
              </p>
            </div>
          )}

          {state.phase === "initiative" && initiativeActor && (
            <div className="panel choice">
              <div className="label">出发顺序</div>
              <p>
                {state.initiative?.playoff
                  ? `加赛：${state.initiative.playoff.ids
                      .map(
                        (id) =>
                          state.players.find((p) => p.id === id)?.name ?? id,
                      )
                      .join(" vs ")} · 请${initiativeActor.name}掷2次骰子（加赛结果不改变非加赛玩家的出发顺序）`
                  : `请${initiativeActor.name}掷2次骰子，总点数大者先出发，平手需加赛（加赛结果不改变非加赛玩家的出发顺序）`}
              </p>
              {state.initiative?.partialDie != null ? (
                <p className="muted">
                  已掷第 1 次：{state.initiative.partialDie} · 请再掷第 2 次
                </p>
              ) : null}
              {state.initiative && state.initiative.placed.length > 0 ? (
                <p className="muted">
                  已定档：
                  {state.initiative.placed
                    .map((e) => {
                      const n =
                        state.players.find((p) => p.id === e.id)?.name ?? e.id;
                      return `${n}=${e.initial}`;
                    })
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          )}
          {humanEventMove && (
            <div className="panel choice">
              <div className="label">
                {prompt.direction === "back" ? "随机后退" : "加速前进"}
              </div>
              <p>
                {prompt.direction === "back"
                  ? "请再掷 1 次骰子，决定沿大地图后退几格（途经起点不领薪）。"
                  : "请再掷 1 次骰子，决定沿大地图前进几格。"}
              </p>
            </div>
          )}
          {humanPairRoll && (
            <div className="panel choice">
              <div className="label">
                {prompt.kind === "trackJudge" ? "赌场判定" : "证券交易所"}
              </div>
              <p>
                {prompt.kind === "trackJudge"
                  ? "请掷2次骰子（差值 = 第1次 − 第2次）"
                  : "请掷2次骰子参与证券结算"}
              </p>
              {pairFirst != null ? (
                <p className="muted">已掷第 1 次：{pairFirst} · 请再掷第 2 次</p>
              ) : null}
            </div>
          )}
          {humanTurn && prompt.kind === "buy" && buyTile && (
            <div className="panel choice">
              <div className="label">
                {buyTile.kind === "facility" || buyTile.kind === "port"
                  ? "无主设施"
                  : "无主地产"}
              </div>
              <p>
                购买 {buyTile.zh}？
                <Money amount={buyTile.price ?? 0} />
                {buyTile.rent != null ? (
                  <>
                    {" · 租 "}
                    <Money amount={buyTile.rent} />
                  </>
                ) : null}
              </p>
              <div className="actions">
                <button
                  type="button"
                  disabled={current.cash < (buyTile.price ?? 0)}
                  onClick={() => session.buy()}
                >
                  <BtnLabel zh="购买" en="Buy" />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineBuy()}
                >
                  <BtnLabel zh="不买" en="Don't buy" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "facilityOwn" && (
            <div className="panel choice">
              <div className="label">
                {state.tiles[prompt.tileIndex]?.kind === "port"
                  ? "己方港口"
                  : "己方设施"}
              </div>
              <p>
                {state.tiles[prompt.tileIndex]?.zh} · 可半价{" "}
                <Money amount={500} /> 退回 GM
              </p>
              <div className="actions">
                <button type="button" onClick={() => session.sellFacility()}>
                  <BtnLabel zh="半价退回" en="Sell back at half price" />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.keepFacility()}
                >
                  <BtnLabel zh="保留" en="Keep facility" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "port" && (
            <div className="panel choice">
              <div className="label">港口出航</div>
              <p className="hint-one-line">
                {current.hasShip
                  ? "船费200 · 可用轮船token免票 · 出航后结束回合"
                  : "船费200 · 出航后得轮船token并结束回合"}
              </p>
              <div className="actions">
                {current.hasShip ? (
                  <>
                    <button
                      type="button"
                      onClick={() => session.portSail(true)}
                    >
                      <BtnLabel zh="免票出航" en="Sail with ship token" />
                    </button>
                    <button
                      type="button"
                      disabled={current.cash < 200}
                      onClick={() => session.portSail(false)}
                    >
                      <BtnLabel zh={<>付费出航 <Money amount={200} /></>} en="Sail · pay 200" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={current.cash < 200}
                    onClick={() => session.portSail(false)}
                  >
                    <BtnLabel zh={<>出航 <Money amount={200} /></>} en="Sail · pay 200" />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.portStay()}
                >
                  <BtnLabel zh="停留" en="Don't sail" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "upgrade" && upgradeTile && (
            <div className="panel choice">
              <div className="label">
                {prompt.mode === "house"
                  ? "加盖房屋"
                  : prompt.mode === "respecialize"
                    ? "改造特殊地产"
                    : "特性化"}
              </div>
              <p>
                {upgradeTile.zh} · 费用 <Money amount={prompt.cost} />
                {prompt.mode === "specialize"
                  ? ` · 第4次=2×地价${upgradeTile.price ?? 0}${
                      prompt.cost < (upgradeTile.price ?? 0) * 2
                        ? "−矿山50"
                        : ""
                    }`
                  : prompt.mode === "house"
                    ? ` · 1×地价${upgradeTile.price ?? 0}${
                        prompt.cost < (upgradeTile.price ?? 0)
                          ? "−矿山50"
                          : ""
                      }`
                    : ""}
                {prompt.mode === "respecialize"
                  ? ` · 现为${
                      state.deeds[upgradeTile.index]?.special === "industry"
                        ? "工业国"
                        : state.deeds[upgradeTile.index]?.special === "commerce"
                          ? "商业国"
                          : "旅游国"
                    }`
                  : ""}
              </p>
              <div className="actions">
                {prompt.mode === "house" ? (
                  <button
                    type="button"
                    disabled={current.cash < prompt.cost}
                    onClick={() => session.upgrade()}
                  >
                    <BtnLabel zh="加盖" en="Build a house" />
                  </button>
                ) : (
                  <>
                    {(
                      [
                        ["industry", "工业国", "Industry"],
                        ["commerce", "商业国", "Commerce"],
                        ["tourism", "旅游国", "Tourism"],
                      ] as const
                    )
                      .filter(
                        ([k]) =>
                          prompt.mode !== "respecialize" ||
                          state.deeds[upgradeTile.index]?.special !== k,
                      )
                      .map(([k, label, en]) => (
                        <button
                          key={k}
                          type="button"
                          disabled={current.cash < prompt.cost}
                          onClick={() => session.upgrade(k)}
                        >
                          <BtnLabel zh={label} en={en} />
                        </button>
                      ))}
                  </>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineUpgrade()}
                >
                  <BtnLabel zh="跳过" en="Skip" />
                </button>
              </div>
            </div>
          )}

          {humanTurn &&
            (prompt.kind === "airport" || prompt.kind === "freeFlight") && (
              <div className="panel choice">
                <div className="label">
                  {prompt.kind === "freeFlight" ? "机场贵宾（免费）" : "机场"}
                </div>
                <p>
                  {prompt.kind === "freeFlight"
                    ? current.hasPlane
                      ? "可免费飞往任意国家地产（已有飞机 token，不再另发）。"
                      : "可免费飞往任意国家地产，并领取飞机 token。"
                    : current.hasPlane
                      ? "机票默认地价×2；可用飞机 token 按原价飞（用后收回）。"
                      : "机票为地价×2；起飞后获得飞机 token。"}
                </p>
                <div className="actions">
                  {prompt.kind === "airport" && current.hasPlane ? (
                    <>
                      <button
                        type="button"
                        onClick={() => session.airportBeginFly(true)}
                      >
                        <BtnLabel zh="用飞机 token（原价）" en="Fly at list price" />
                      </button>
                      <button
                        type="button"
                        onClick={() => session.airportBeginFly(false)}
                      >
                        <BtnLabel zh="不用 token（×2）" en="Fly at 2× price" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => session.airportBeginFly(false)}
                    >
                      <BtnLabel zh="起飞" en="Pick a destination" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.airportStay()}
                  >
                    <BtnLabel zh="不飞" en="Don't fly" />
                  </button>
                </div>
              </div>
            )}

          {humanTurn && prompt.kind === "airportDest" && (
            <div className="panel choice dest-list">
              <div className="label">
                选择目的地
                {prompt.free
                  ? "（免费）"
                  : prompt.usePlane
                    ? "（原价·用飞机 token）"
                    : "（地价×2）"}
              </div>
              <ul>
                {propertyTiles(state).map((t) => {
                  const fare = prompt.free
                    ? 0
                    : prompt.usePlane
                      ? (t.price ?? 0)
                      : (t.price ?? 0) * 2;
                  const can = current.cash >= fare;
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn"
                        disabled={!can}
                        onClick={() => session.airportFlyTo(t.index)}
                      >
                        <BtnLabel
                          zh={
                            fare ? (
                              <>
                                {t.zh} · <Money amount={fare} />
                              </>
                            ) : (
                              `${t.zh} · 免费`
                            )
                          }
                          en={
                            fare
                              ? `Fly to ${t.en}`
                              : `Fly free to ${t.en}`
                          }
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="secondary"
                onClick={() => session.cancelAirportDest()}
              >
                <BtnLabel zh="返回" en="Cancel flight" />
              </button>
            </div>
          )}

          {humanTurn && prompt.kind === "hospitalAdmit" && (
            <div className="panel choice">
              <div className="label">入院</div>
              <p>即将住院跳过 2 次掷骰。可弃置出院卡取消。</p>
              <div className="actions">
                {current.hasDischarge && (
                  <button
                    type="button"
                    onClick={() => session.useDischargeCard()}
                  >
                    <BtnLabel zh="用出院卡取消" en="Cancel with discharge card" />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.acceptHospital()}
                >
                  <BtnLabel zh="入院" en="Enter hospital" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "rentFree" && (
            <div className="panel choice">
              <div className="label">免租 token</div>
              <p>
                {prompt.tileZh} 实付地租 <Money amount={prompt.amount} />
              </p>
              <div className="actions">
                <button type="button" onClick={() => session.useRentFree()}>
                  <BtnLabel zh="使用免租" en="Use rent-free token" />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineRentFree()}
                >
                  <BtnLabel zh="照常付租" en="Pay rent as usual" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "oilSpecialRent" && (
            <div className="panel choice">
              <div className="label">油田 · 特性化地租</div>
              <p>
                {prompt.tileZh} 应收 <Money amount={prompt.receivable} />
                {" · 基础 "}
                <Money amount={prompt.baseRent} />
              </p>
              <p className="hint-one-line">
                发动则只付基础地租，但油田无偿交还 GM；不发动则付全额并保留油田。
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => session.useOilOnSpecialRent()}
                >
                  <BtnLabel
                    zh={
                      <>
                        发动油田 · 付 <Money amount={prompt.baseRent} />
                      </>
                    }
                    en="Use oil · return field"
                  />
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineOilOnSpecialRent()}
                >
                  <BtnLabel
                    zh={
                      <>
                        付全额 · 保留油田 <Money amount={prompt.receivable} />
                      </>
                    }
                    en="Pay full · keep oil"
                  />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "freeSail" && (
            <div className="panel choice">
              <div className="label">港口贵宾（免费出航）</div>
              <p className="hint-one-line">
                {current.hasShip
                  ? "免费前往港口（已有轮船token，不再另发）· 出航后结束"
                  : "免费前往港口并领取轮船token · 出航后结束"}
              </p>
              <div className="actions">
                {state.tiles
                  .filter(
                    (t) =>
                      t.kind === "port" && t.index !== current.position,
                  )
                  .map((t) => (
                    <button
                      key={t.index}
                      type="button"
                      onClick={() => session.freeSailTo(t.index)}
                    >
                      <BtnLabel zh={`前往 ${t.zh}`} en={`Sail to ${t.en}`} />
                    </button>
                  ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.portStay()}
                >
                  <BtnLabel zh="不出航" en="Don't sail" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "forceAuction" && (
            <div className="panel choice">
              <div className="label">强制拍卖</div>
              <p>必须拍卖一处国家地产（视为 0 屋）。</p>
              <div className="actions">
                {current.hasVipCard && (
                  <button
                    type="button"
                    onClick={() => session.cancelForceAuction()}
                  >
                    <BtnLabel zh="用赌场VIP卡取消" en="Cancel with VIP card" />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.proceedForceAuction()}
                >
                  <BtnLabel zh="选择地产拍卖" en="Choose land to auction" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "forceAuctionPick" && (
            <div className="panel choice dest-list">
              <div className="label">选择拍卖地产（E18）</div>
              <ul>
                {ownedPropertiesForCurrent(state).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.pickForceAuctionTile(t.index)}
                    >
                      <BtnLabel
                        zh={
                          <>
                            {t.zh} · 地价 <Money amount={t.price ?? 0} /> · 起拍{" "}
                            <Money amount={(t.price ?? 0) * 2} />
                          </>
                        }
                        en={t.en}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "debtDemolishPick" && state.pendingDebt && (
            <div className="panel choice dest-list">
              <div className="label">筹资拆房</div>
              <p>
                支付 {state.pendingDebt.reason} 还需现金，请选择拆除一处房屋（返还 ⌊地价÷2⌋）。
              </p>
              <ul>
                {demolishOptionsForDebtor(state).map((t) => {
                  const d = state.deeds[t.index]!;
                  const refund = Math.floor((t.price ?? 0) / 2);
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn"
                        onClick={() => session.pickDebtDemolishTile(t.index)}
                      >
                        <BtnLabel
                          zh={
                            <>
                              {t.zh} · {d.houses}屋→{d.houses - 1} · 返还{" "}
                              <Money amount={refund} />
                            </>
                          }
                          en={t.en}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "debtFacilitySell" && state.pendingDebt && (
            <div className="panel choice dest-list">
              <div className="label">筹资退回设施</div>
              <p>
                无房可拆，请选择半价退回一处油田/矿山/港口（各收回{" "}
                <Money amount={500} />）。
              </p>
              <ul>
                {facilitySellOptionsForDebtor(state).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.pickDebtFacilitySell(t.index)}
                    >
                      <BtnLabel
                        zh={
                          <>
                            {t.zh} · 半价退回 <Money amount={500} />
                          </>
                        }
                        en={t.en}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "debtAuctionPick" && state.pendingDebt && (
            <div className="panel choice dest-list">
              <div className="label">筹资拍卖</div>
              <p>
                仍欠 {state.pendingDebt.reason}{" "}
                <Money amount={state.pendingDebt.amount} />
                ，必须选择国家地产拍卖。
              </p>
              <ul>
                {ownedPropertiesForDebtor(state).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.pickDebtAuctionTile(t.index)}
                    >
                      <BtnLabel
                        zh={
                          <>
                            {t.zh} · 地价 <Money amount={t.price ?? 0} /> · 起拍{" "}
                            <Money amount={(t.price ?? 0) * 2} />
                          </>
                        }
                        en={t.en}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt.kind === "auction" && auctionView && auctionTile && (
            <div className="panel choice auction-panel">
              <div className="label">
                拍卖 · {auctionTile.zh}
                {humanBidding ? " · 请你出价" : ` · ${auctionActor?.name ?? "—"}`}
              </div>
              {humanBidding ? (
                <div className="actions auction-actions">
                  <button
                    type="button"
                    disabled={
                      (auctionActor?.cash ?? 0) < auctionView.minBid
                    }
                    onClick={() => session.auctionBid()}
                  >
                    <BtnLabel zh={<>出价 <Money amount={auctionView.minBid} /></>} en="Place bid" />
                  </button>
                  <button
                    type="button"
                    className="dest-btn"
                    disabled={
                      (auctionActor?.cash ?? 0) <
                      auctionView.auction.buyoutPrice
                    }
                    onClick={() => session.auctionBuyout()}
                  >
                    <BtnLabel
                      zh={<>一口价 <Money amount={auctionView.auction.buyoutPrice} /></>}
                      en="Buy now"
                    />
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.auctionPass()}
                  >
                    <BtnLabel zh="弃权" en="Pass this bid" />
                  </button>
                </div>
              ) : (
                <p className="auction-turn">AI 出价中，请稍候…</p>
              )}
            </div>
          )}

          {current.kind === "ai" &&
            !state.winnerId &&
            state.phase === "settle" &&
            prompt.kind === "idle" && (
              <div className="panel choice">
                <div className="label">AI 回合异常</div>
                <p>若长时间无响应，可强制结束该 AI 回合。</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.continueTurn()}
                >
                  <BtnLabel zh="强制继续" en="Force continue" />
                </button>
              </div>
            )}

          {humanTurn && prompt.kind === "casinoEnter" && (
            <div className="panel choice">
              <div className="label">赌城入口</div>
              <p>即将进入赌场。可弃置赌场VIP卡取消。</p>
              <div className="actions">
                {current.hasVipCard && (
                  <button
                    type="button"
                    onClick={() => session.cancelCasinoEnter()}
                  >
                    <BtnLabel zh="用赌场VIP卡取消" en="Cancel with VIP card" />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.acceptCasinoEnter()}
                >
                  <BtnLabel zh="进入赌场" en="Enter the casino" />
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackGunBuild" && (
            <div className="panel choice dest-list">
              <div className="label">老虎机 · 免费加盖</div>
              <p className="hint-one-line">
                选择一处普通地产免费加盖一级房屋
              </p>
              <ul>
                {gunBuildOptions(state, current.id).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn dest-btn-slim"
                      onClick={() => session.pickGunBuild(t.index)}
                    >
                      <BtnLabel
                        zh={`${t.zh} · 现 ${state.deeds[t.index]?.houses ?? 0} 屋`}
                        en={`Free +1 house · ${t.en}`}
                      />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="secondary dest-btn-slim"
                    onClick={() => session.skipGunEffect()}
                  >
                    <BtnLabel zh="跳过" en="Skip free build" />
                  </button>
                </li>
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackGunDemolish" && (
            <div className="panel choice dest-list">
              <div className="label">老虎机 · 拆房</div>
              <p className="hint-one-line">选择一处地产拆掉一级房屋</p>
              <ul>
                {gunDemolishOptions(state, current.id).map((t) => {
                  const d = state.deeds[t.index]!;
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn dest-btn-slim"
                        onClick={() => session.pickGunDemolish(t.index)}
                      >
                        <BtnLabel
                          zh={
                            d.special
                              ? `${t.zh} · 特殊→3屋`
                              : `${t.zh} · ${d.houses}屋→${d.houses - 1}`
                          }
                          en={
                            d.special
                              ? `Downgrade special · ${t.en}`
                              : `Demolish 1 house · ${t.en}`
                          }
                        />
                      </button>
                    </li>
                  );
                })}
                {gunDemolishOptions(state, current.id).length === 0 ? (
                  <li>
                    <button
                      type="button"
                      className="secondary dest-btn-slim"
                      onClick={() => session.skipGunEffect()}
                    >
                      <BtnLabel zh="跳过" en="Skip demolish" />
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackExit" && (
            <div className="panel choice">
              <div className="label">赌场离场</div>
              <p>选择一处赌城入口回到大地图。</p>
              <div className="actions exit-actions">
                {casinoEntrances(state).map((t) => (
                  <button
                    key={t.index}
                    type="button"
                    className="dest-btn"
                    onClick={() => session.chooseRacetrackExit(t.index)}
                  >
                    <BtnLabel zh={t.zh} en={`Exit via ${t.en}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "swap" && (
            <div className="panel choice dest-list">
              <div className="label">位置互换</div>
              <p className="hint-one-line">与一名玩家互换位置（双方不结算新格）</p>
              <ul>
                {state.players
                  .filter(
                    (p) =>
                      !p.eliminated &&
                      p.id !== current.id &&
                      p.racetrackPos == null,
                  )
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="dest-btn dest-btn-slim"
                        onClick={() => session.swapWith(p.id)}
                      >
                        <BtnLabel
                          zh={`${p.name} @ ${state.tiles[p.position]?.zh ?? "—"}`}
                          en="Swap"
                        />
                      </button>
                    </li>
                  ))}
                <li>
                  <button
                    type="button"
                    className="secondary dest-btn-slim"
                    onClick={() => session.skipSwap()}
                  >
                    <BtnLabel zh="不换" en="Don't swap" />
                  </button>
                </li>
              </ul>
            </div>
          )}
            </div>
          </div>

          <div className="actions main-actions">
            {hospitalSkipTurn ? (
              <button type="button" onClick={() => session.skipHospitalTurn()}>
                <BtnLabel
                  zh={`跳过本回合（住院剩余 ${current.hospitalSkips}）`}
                  en="Skip hospital turn"
                />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!canRoll}
                  onClick={() => session.roll()}
                >
                  <BtnLabel zh={rollButtonLabel.zh} en={rollButtonLabel.en} />
                </button>
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => session.continueTurn()}
                >
                  <BtnLabel zh="继续" en="Continue" />
                </button>
              </>
            )}
          </div>
              </div>

              <div className="plaza-log panel log">
                <div className="label">日志</div>
                <ul>
                  {state.log.map((line, i) => (
                    <li key={`${i}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      {shell}
    </div>
  );
}
