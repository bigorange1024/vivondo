import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import boardUrl from "@assets/board-map-v7.png";
import { BOARD_PNG, tileCenterPercent, tileContinentBarPercent } from "./engine/board";
import { CARD_ZH } from "./engine/deck";
import {
  getAuctionView,
  gunBuildOptions,
  gunDemolishOptions,
  initiativeActorId,
  mafiaEntrances,
  ownedPropertiesForCurrent,
  ownedPropertiesForDebtor,
  propertyTiles,
} from "./engine/game";
import {
  BOARD_TOP_STRIP,
  PLAZA_HUD_PERCENT,
  racetrackSeatPercent,
} from "./engine/racetrack";
import { createSoloSession, type GameState } from "./session/solo";
import {
  IconCoin,
  IconDiceFace,
  IconDischarge,
  IconFactory,
  IconHouse,
  IconPlane,
  IconShip,
  IconSuitcase,
  IconVipCard,
} from "./ui/icons";
import { locationView } from "./ui/location";
import { LocFlag } from "./ui/locFlag";
import { Money } from "./ui/money";

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
  const session = useMemo(() => createSoloSession({ humans: 1, ais: 3 }), []);
  const [state, setState] = useState<GameState>(() => session.getState());
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const [boardScale, setBoardScale] = useState(1);

  useEffect(() => session.subscribe(setState), [session]);

  useEffect(() => {
    const el = boardFrameRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      // Scale by board width only — height-based scale was crushing HUD text/controls
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
  }, []);

  const current = state.players[state.currentPlayerIndex]!;
  const auctionView = getAuctionView(state);
  const auctionActor = auctionView?.actorId
    ? state.players.find((p) => p.id === auctionView.actorId)
    : null;
  const humanBidding =
    !!auctionActor && auctionActor.kind === "human" && !state.winnerId;

  const initiativeActor = (() => {
    const id = initiativeActorId(state);
    return id ? state.players.find((p) => p.id === id) : null;
  })();

  const prompt = state.prompt;

  const humanTurn =
    (current.kind === "human" && !state.winnerId) || humanBidding;
  const humanPairRoll =
    state.phase === "settle" &&
    (prompt.kind === "trackJudge" || prompt.kind === "casinoRoll") &&
    current.kind === "human" &&
    !state.winnerId;

  const humanInitiative =
    state.phase === "initiative" &&
    !!initiativeActor &&
    initiativeActor.kind === "human" &&
    !state.winnerId;
  const canRoll =
    !state.winnerId &&
    (humanInitiative ||
      humanPairRoll ||
      (current.kind === "human" && state.phase === "roll"));
  const canContinue =
    current.kind === "human" &&
    !state.winnerId &&
    !humanPairRoll &&
    ((state.phase === "settle" && state.prompt.kind === "idle") ||
      state.phase === "end");

  const pairFirst =
    prompt.kind === "trackJudge" || prompt.kind === "casinoRoll"
      ? prompt.first
      : (state.initiative?.partialDie ?? null);

  const rollButtonLabel = (() => {
    if (state.phase === "initiative" || humanPairRoll) {
      return pairFirst == null ? "掷第 1 次骰子" : "掷第 2 次骰子";
    }
    return "掷骰 Roll";
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
      prompt.kind === "debtAuctionPick" ||
      prompt.kind === "swap");

  const phaseLabel = state.winnerId
    ? "终局"
    : state.phase === "initiative"
      ? "定出发顺序"
      : humanPairRoll
        ? prompt.kind === "trackJudge"
          ? "跑马场判定"
          : "证券掷骰"
        : current.racetrackPos != null && state.phase === "roll"
          ? "跑马场掷骰"
          : state.phase === "roll"
            ? "掷骰"
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
              <div className="top-meta">
                <span>{state.phase === "initiative" ? "开局" : `回合 ${state.turn}`}</span>
                <span>{current.name}</span>
                {current.racetrackPos != null ? (
                  <span>马场 {current.racetrackPos}</span>
                ) : null}
                {current.hospitalSkips > 0 ? (
                  <span>住院 {current.hospitalSkips}</span>
                ) : null}
                {state.lastEvent ? (
                  <span>上张 {CARD_ZH[state.lastEvent]}</span>
                ) : null}
                <span>{phaseLabel}</span>
                <span>奖池 {state.casinoPool}</span>
                <span>事件卡堆 {state.eventDeck.drawPile.length}</span>
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
                const { x, y } = tileCenterPercent(tile);
                const bar =
                  tile.kind === "property" ? tileContinentBarPercent(tile) : null;
                const showHouses =
                  tile.kind === "property" &&
                  deed.special == null &&
                  deed.houses > 0;
                const showSpecial =
                  tile.kind === "property" && deed.special != null;
                return (
                  <div key={`deed-${tile.index}`}>
                    <div
                      className="deed-mark"
                      title={`${tile.zh} · ${owner.name}`}
                      style={{
                        left: `${x}%`,
                        top: `calc(${y}% + ${4 * boardScale}px)`,
                        background: owner.color,
                      }}
                    >
                      {tile.kind === "facility"
                        ? tile.zh === "石油"
                          ? "油"
                          : "矿"
                        : null}
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
                      ? `${p.name} @ 跑马场${p.racetrackPos}`
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
                        <span className="pcash">
                          <Money amount={p.cash} />
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
                          title="飞机 token：银行禁领薪"
                        >
                          <IconPlane className="inv-ico" />
                          飞机
                        </span>
                        <span
                          className={`inv${p.hasShip ? " on" : ""}`}
                          title="轮船 token：港口减船费"
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
                          title="赌场VIP卡：取消跑马场/强制拍卖"
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
          {humanPairRoll && (
            <div className="panel choice">
              <div className="label">
                {prompt.kind === "trackJudge" ? "跑马场判定" : "证券交易所"}
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
                {buyTile.kind === "facility" ? "无主设施" : "无主地产"}
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
                  购买
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineBuy()}
                >
                  不买
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "facilityOwn" && (
            <div className="panel choice">
              <div className="label">己方设施</div>
              <p>
                {state.tiles[prompt.tileIndex]?.zh} · 可半价{" "}
                <Money amount={500} /> 退回 GM
              </p>
              <div className="actions">
                <button type="button" onClick={() => session.sellFacility()}>
                  半价退回
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.keepFacility()}
                >
                  保留
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "port" && (
            <div className="panel choice">
              <div className="label">港口</div>
              <p>
                出航船费 <Money amount={400} />；轮船 token 可实付{" "}
                <Money amount={200} />。出航后回合结束。
              </p>
              <div className="actions">
                <button
                  type="button"
                  disabled={current.cash < 400}
                  onClick={() => session.portSail(false)}
                >
                  出航 <Money amount={400} />
                </button>
                {current.hasShip && (
                  <button
                    type="button"
                    disabled={current.cash < 200}
                    onClick={() => session.portSail(true)}
                  >
                    用轮船 <Money amount={200} />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.portStay()}
                >
                  停留
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
                    加盖
                  </button>
                ) : (
                  <>
                    {(
                      [
                        ["industry", "工业国"],
                        ["commerce", "商业国"],
                        ["tourism", "旅游国"],
                      ] as const
                    )
                      .filter(
                        ([k]) =>
                          prompt.mode !== "respecialize" ||
                          state.deeds[upgradeTile.index]?.special !== k,
                      )
                      .map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          disabled={current.cash < prompt.cost}
                          onClick={() => session.upgrade(k)}
                        >
                          {label}
                        </button>
                      ))}
                  </>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineUpgrade()}
                >
                  跳过
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
                    ? "可选任意国家地产免费飞往，并领取飞机 token。"
                    : "可付地价×3飞往任意国家地产（获得飞机 token）。"}
                </p>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => session.airportBeginFly()}
                  >
                    起飞
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.airportStay()}
                  >
                    不飞
                  </button>
                </div>
              </div>
            )}

          {humanTurn && prompt.kind === "airportDest" && (
            <div className="panel choice dest-list">
              <div className="label">
                选择目的地{prompt.free ? "（免费）" : ""}
              </div>
              <ul>
                {propertyTiles(state).map((t) => {
                  const fare = prompt.free ? 0 : (t.price ?? 0) * 3;
                  const can = current.cash >= fare;
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn"
                        disabled={!can}
                        onClick={() => session.airportFlyTo(t.index)}
                      >
                        {t.zh}
                        {fare ? (
                          <>
                            {" · "}
                            <Money amount={fare} />
                          </>
                        ) : (
                          " · 免费"
                        )}
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
                返回
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
                    用出院卡取消
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.acceptHospital()}
                >
                  入院
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
                  使用免租
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.declineRentFree()}
                >
                  照常付租
                </button>
              </div>
            </div>
          )}

          {humanTurn && prompt.kind === "portDispatch" && (
            <div className="panel choice">
              <div className="label">港口调度</div>
              <p>
                领取 <Money amount={100} />，或领取轮船 token（已有则不可领船）。
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => session.portDispatchTakeCash()}
                >
                  拿 <Money amount={100} />
                </button>
                <button
                  type="button"
                  disabled={current.hasShip}
                  onClick={() => session.portDispatchTakeShip()}
                >
                  领轮船 token
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
                    用赌场VIP卡取消
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.proceedForceAuction()}
                >
                  选择地产拍卖
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
                      {t.zh} · 地价 <Money amount={t.price ?? 0} /> · 起拍{" "}
                      <Money amount={(t.price ?? 0) * 2} />
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
                ，必须拍卖国家地产。
              </p>
              <ul>
                {ownedPropertiesForDebtor(state).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.pickDebtAuctionTile(t.index)}
                    >
                      {t.zh} · 地价 <Money amount={t.price ?? 0} /> · 起拍{" "}
                      <Money amount={(t.price ?? 0) * 2} />
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
                    出价 <Money amount={auctionView.minBid} />
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
                    一口价 <Money amount={auctionView.auction.buyoutPrice} />
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.auctionPass()}
                  >
                    弃权
                  </button>
                </div>
              ) : (
                <p className="auction-turn">AI 出价中，请稍候…</p>
              )}
            </div>
          )}

          {current.kind === "ai" &&
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
                  强制继续
                </button>
              </div>
            )}

          {humanTurn && prompt.kind === "mafiaEnter" && (
            <div className="panel choice">
              <div className="label">赌城入口</div>
              <p>即将进入跑马场。可弃置赌场VIP卡取消。</p>
              <div className="actions">
                {current.hasVipCard && (
                  <button
                    type="button"
                    onClick={() => session.cancelMafiaEnter()}
                  >
                    用赌场VIP卡取消
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => session.acceptMafiaEnter()}
                >
                  进入跑马场
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
                      {t.zh} · 现 {state.deeds[t.index]?.houses ?? 0} 屋
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="secondary dest-btn-slim"
                    onClick={() => session.skipGunEffect()}
                  >
                    跳过
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
                        {t.zh}
                        {d.special
                          ? ` · 特殊→3屋`
                          : ` · ${d.houses}屋→${d.houses - 1}`}
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    className="secondary dest-btn-slim"
                    onClick={() => session.skipGunEffect()}
                  >
                    跳过
                  </button>
                </li>
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackExit" && (
            <div className="panel choice">
              <div className="label">跑马场离场</div>
              <p>选择一处赌城入口回到大地图。</p>
              <div className="actions exit-actions">
                {mafiaEntrances(state).map((t) => (
                  <button
                    key={t.index}
                    type="button"
                    className="dest-btn"
                    onClick={() => session.chooseRacetrackExit(t.index)}
                  >
                    {t.zh}
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
                        {p.name} @ {state.tiles[p.position]?.zh}
                      </button>
                    </li>
                  ))}
                <li>
                  <button
                    type="button"
                    className="secondary dest-btn-slim"
                    onClick={() => session.skipSwap()}
                  >
                    不换
                  </button>
                </li>
              </ul>
            </div>
          )}
            </div>
          </div>

          <div className="actions main-actions">
            <button
              type="button"
              disabled={!canRoll}
              onClick={() => session.roll()}
            >
              {rollButtonLabel}
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => session.continueTurn()}
            >
              继续 Continue
            </button>
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
    </div>
  );
}
