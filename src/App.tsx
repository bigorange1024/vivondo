import { useEffect, useMemo, useState } from "react";
import boardUrl from "@assets/board-map-v7.png";
import { BOARD_PNG, tileCenterPercent } from "./engine/board";
import { CARD_ZH } from "./engine/deck";
import {
  getAuctionView,
  gunBuildOptions,
  gunDemolishOptions,
  mafiaEntrances,
  ownedPropertiesForCurrent,
  ownedPropertiesForDebtor,
  propertyTiles,
} from "./engine/game";
import { racetrackSeatPercent } from "./engine/racetrack";
import { createSoloSession, type GameState } from "./session/solo";

export default function App() {
  const session = useMemo(() => createSoloSession({ humans: 1, ais: 3 }), []);
  const [state, setState] = useState<GameState>(() => session.getState());

  useEffect(() => session.subscribe(setState), [session]);

  const current = state.players[state.currentPlayerIndex]!;
  const auctionView = getAuctionView(state);
  const auctionActor = auctionView?.actorId
    ? state.players.find((p) => p.id === auctionView.actorId)
    : null;
  const humanBidding =
    !!auctionActor && auctionActor.kind === "human" && !state.winnerId;

  const humanTurn =
    (current.kind === "human" && !state.winnerId) || humanBidding;
  const canRoll =
    current.kind === "human" &&
    !state.winnerId &&
    state.phase === "roll";
  const canContinue =
    current.kind === "human" &&
    !state.winnerId &&
    ((state.phase === "settle" && state.prompt.kind === "idle") ||
      state.phase === "end");

  const playHeightRatio = BOARD_PNG.playSize / BOARD_PNG.height;
  const prompt = state.prompt;

  const buyTile =
    prompt.kind === "buy" ? state.tiles[prompt.tileIndex] : null;
  const upgradeTile =
    prompt.kind === "upgrade" ? state.tiles[prompt.tileIndex] : null;

  const tokenBits = (p: (typeof state.players)[0]) =>
    [
      p.hasPlane ? "飞机" : null,
      p.hasShip ? "轮船" : null,
      p.hasRentFree ? "免租" : null,
      p.hasDischarge ? "出院卡" : null,
      p.hasMafiaDeed ? "黑手党契" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const auctionTile =
    auctionView != null ? state.tiles[auctionView.auction.tileIndex] : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>花花世界</strong>
          <span className="brand-en">Vivondo</span>
        </div>
        <div className="top-meta">
          回合 {state.turn} · {current.name}
          {current.racetrackPos != null
            ? ` · 跑马场格 ${current.racetrackPos}`
            : ""}
          {current.hospitalSkips > 0
            ? ` · 住院剩余 ${current.hospitalSkips}`
            : ""}
          {state.lastEvent ? ` · 上张 ${CARD_ZH[state.lastEvent]}` : ""}
          {state.lastTrackDice
            ? ` · 场内 ${state.lastTrackDice[0]}−${state.lastTrackDice[1]}`
            : ""}
          {" · "}
          {state.winnerId
            ? "终局"
            : current.racetrackPos != null && state.phase === "roll"
              ? "跑马场掷骰"
              : state.phase === "roll"
                ? "掷骰"
                : state.phase === "settle"
                  ? "结算"
                  : "回合结束"}
          {" · 奖池 "}
          {state.casinoPool}
          {" · 牌堆 "}
          {state.eventDeck.drawPile.length}
        </div>
      </header>

      <main className="layout">
        <aside className="players">
          {state.players.map((p, idx) => (
            <div
              key={p.id}
              className={`player-card${idx === state.currentPlayerIndex ? " active" : ""}${p.eliminated ? " out" : ""}`}
              style={{ borderColor: p.color }}
            >
              <span className="dot" style={{ background: p.color }} />
              <div>
                <div className="pname">
                  {p.name}
                  {p.kind === "ai" ? " (AI)" : ""}
                  {p.eliminated ? " · 出局" : ""}
                </div>
                <div className="pcash">¥{p.cash}</div>
                <div className="ppos">
                  {p.racetrackPos != null
                    ? `跑马场 · ${p.racetrackPos}`
                    : (state.tiles[p.position]?.zh ?? "—")}
                </div>
                {tokenBits(p) ? (
                  <div className="ptokens">{tokenBits(p)}</div>
                ) : null}
              </div>
            </div>
          ))}
        </aside>

        <section className="board-wrap">
          <div className="board-frame">
            <img
              className="board-img"
              src={boardUrl}
              alt="花花世界棋盘"
              draggable={false}
            />
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
                return (
                  <div
                    key={`deed-${tile.index}`}
                    className="deed-mark"
                    title={`${tile.zh} · ${owner.name}`}
                    style={{
                      left: `${x}%`,
                      top: `calc(${y}% + 12px)`,
                      background: owner.color,
                    }}
                  >
                    {deed.special
                      ? deed.special === "industry"
                        ? "工"
                        : deed.special === "commerce"
                          ? "商"
                          : "旅"
                      : tile.kind === "facility"
                        ? tile.zh === "石油"
                          ? "油"
                          : "矿"
                        : deed.houses > 0
                          ? String(deed.houses)
                          : ""}
                  </div>
                );
              })}
              {state.players.map((p, i) => {
                if (p.eliminated) return null;
                const seat =
                  p.racetrackPos != null
                    ? racetrackSeatPercent(p.racetrackPos)
                    : tileCenterPercent(state.tiles[p.position]!);
                const offset = (i - (state.players.length - 1) / 2) * 10;
                const label =
                  p.racetrackPos != null
                    ? `${p.name} @ 跑马场${p.racetrackPos}`
                    : `${p.name} @ ${state.tiles[p.position]!.zh}`;
                return (
                  <div
                    key={p.id}
                    className={`token${p.racetrackPos != null ? " on-track" : ""}`}
                    title={label}
                    style={{
                      left: `calc(${seat.x}% + ${offset}px)`,
                      top: `calc(${seat.y}% + ${offset * 0.3}px)`,
                      background: p.color,
                      zIndex: i + 10,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <aside className="controls">
          <div className="panel">
            <div className="label">骰子</div>
            <div className="dice">
              {state.lastTrackDice
                ? `${state.lastTrackDice[0]}−${state.lastTrackDice[1]}`
                : state.lastCasinoDice
                  ? `${state.lastCasinoDice[0]}+${state.lastCasinoDice[1]}`
                  : state.lastDice == null
                    ? "—"
                    : state.lastDice}
            </div>
          </div>

          {humanTurn && prompt.kind === "buy" && buyTile && (
            <div className="panel choice">
              <div className="label">
                {buyTile.kind === "facility" ? "无主设施" : "无主地产"}
              </div>
              <p>
                购买 {buyTile.zh}？¥{buyTile.price}
                {buyTile.rent != null ? ` · 租 ${buyTile.rent}` : ""}
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
                {state.tiles[prompt.tileIndex]?.zh} · 可半价 ¥500 退回 GM
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
              <div className="label">大西洋港口</div>
              <p>出航船费 ¥400；轮船 token 可实付 200。出航后回合结束。</p>
              <div className="actions">
                <button
                  type="button"
                  disabled={current.cash < 400}
                  onClick={() => session.portSail(false)}
                >
                  出航 ¥400
                </button>
                {current.hasShip && (
                  <button
                    type="button"
                    disabled={current.cash < 200}
                    onClick={() => session.portSail(true)}
                  >
                    用轮船 ¥200
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
                {prompt.mode === "house" ? "加盖房屋" : "特性化"}
              </div>
              <p>
                {upgradeTile.zh} · 费用 ¥{prompt.cost}
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
                    <button
                      type="button"
                      disabled={current.cash < prompt.cost}
                      onClick={() => session.upgrade("industry")}
                    >
                      工业国
                    </button>
                    <button
                      type="button"
                      disabled={current.cash < prompt.cost}
                      onClick={() => session.upgrade("commerce")}
                    >
                      商业国
                    </button>
                    <button
                      type="button"
                      disabled={current.cash < prompt.cost}
                      onClick={() => session.upgrade("tourism")}
                    >
                      旅游国
                    </button>
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
                        {fare ? ` · ¥${fare}` : " · 免费"}
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
                {prompt.tileZh} 实付地租 ¥{prompt.amount}
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
              <p>领取 ¥100，或领取轮船 token（已有则不可领船）。</p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => session.portDispatchTakeCash()}
                >
                  拿 ¥100
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
                {current.hasMafiaDeed && (
                  <button
                    type="button"
                    onClick={() => session.cancelForceAuction()}
                  >
                    用黑手党地契取消
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
                      {t.zh} · 地价 {t.price} · 起拍 {(t.price ?? 0) * 2}
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
                仍欠 {state.pendingDebt.reason} ¥{state.pendingDebt.amount}
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
                      {t.zh} · 地价 {t.price} · 起拍 {(t.price ?? 0) * 2}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt.kind === "auction" && auctionView && auctionTile && (
            <div className="panel choice">
              <div className="label">拍卖 · {auctionTile.zh}</div>
              <p>
                起拍 ¥{auctionView.auction.startPrice} · 一口价 ¥
                {auctionView.auction.buyoutPrice}
                {auctionView.auction.currentBid > 0
                  ? ` · 当前 ¥${auctionView.auction.currentBid}`
                  : " · 尚无有效出价"}
              </p>
              <p className="auction-turn">
                当前出价方：{auctionActor?.name ?? "—"}
                {humanBidding ? "（你）" : ""}
              </p>
              {humanBidding && (
                <div className="actions">
                  <button
                    type="button"
                    disabled={
                      (auctionActor?.cash ?? 0) < auctionView.minBid
                    }
                    onClick={() => session.auctionBid()}
                  >
                    出价 ¥{auctionView.minBid}
                  </button>
                  <button
                    type="button"
                    disabled={
                      (auctionActor?.cash ?? 0) <
                      auctionView.auction.buyoutPrice
                    }
                    onClick={() => session.auctionBuyout()}
                  >
                    一口价 ¥{auctionView.auction.buyoutPrice}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => session.auctionPass()}
                  >
                    不出 / 弃权
                  </button>
                </div>
              )}
              {!humanBidding && (
                <p className="hint">等待其他玩家出价…</p>
              )}
            </div>
          )}

          {humanTurn && prompt.kind === "mafiaEnter" && (
            <div className="panel choice">
              <div className="label">黑手党入口</div>
              <p>即将进入跑马场。可弃置黑手党地契取消。</p>
              <div className="actions">
                {current.hasMafiaDeed && (
                  <button
                    type="button"
                    onClick={() => session.cancelMafiaEnter()}
                  >
                    用黑手党地契取消
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
              <div className="label">手枪 · 免费加盖</div>
              <p>选择一块未满 3 屋的普通国家地产（不可特性化）。</p>
              <ul>
                {gunBuildOptions(state, current.id).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.pickGunBuild(t.index)}
                    >
                      {t.zh} · 现 {state.deeds[t.index]?.houses ?? 0} 屋
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackGunDemolish" && (
            <div className="panel choice dest-list">
              <div className="label">手枪 · 拆房</div>
              <p>普通地拆 1 屋无退款；特殊地拆后变普通 3 屋。</p>
              <ul>
                {gunDemolishOptions(state, current.id).map((t) => {
                  const d = state.deeds[t.index]!;
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn"
                        onClick={() => session.pickGunDemolish(t.index)}
                      >
                        {t.zh}
                        {d.special
                          ? ` · 特殊→3屋`
                          : ` · ${d.houses} 屋→${d.houses - 1}`}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "racetrackExit" && (
            <div className="panel choice dest-list">
              <div className="label">跑马场离场</div>
              <p>选择一处黑手党入口回到大地图。</p>
              <ul>
                {mafiaEntrances(state).map((t) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      className="dest-btn"
                      onClick={() => session.chooseRacetrackExit(t.index)}
                    >
                      {t.zh}（格 {t.index}）
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {humanTurn && prompt.kind === "swap" && (
            <div className="panel choice dest-list">
              <div className="label">位置互换</div>
              <p>与一名玩家互换位置（双方不结算新格）。</p>
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
                        className="dest-btn"
                        onClick={() => session.swapWith(p.id)}
                      >
                        {p.name} @ {state.tiles[p.position]?.zh}
                      </button>
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                className="secondary"
                onClick={() => session.skipSwap()}
              >
                不换
              </button>
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              disabled={!canRoll}
              onClick={() => session.roll()}
            >
              掷骰 Roll
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => session.continueTurn()}
            >
              继续 Continue
            </button>
          </div>

          <div className="panel log">
            <div className="label">日志</div>
            <ul>
              {state.log.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
          <p className="hint">
            全环可玩：地产 / 角格 / 港口 / 设施 / 事件 / 拍卖 / 黑手党跑马场。
          </p>
        </aside>
      </main>
    </div>
  );
}
