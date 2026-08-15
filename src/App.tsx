import { useEffect, useMemo, useState } from "react";
import boardUrl from "@assets/board-map-v7.png";
import { BOARD_PNG, tileCenterPercent } from "./engine/board";
import { propertyTiles } from "./engine/game";
import { createSoloSession, type GameState } from "./session/solo";

export default function App() {
  const session = useMemo(() => createSoloSession({ humans: 1, ais: 3 }), []);
  const [state, setState] = useState<GameState>(() => session.getState());

  useEffect(() => session.subscribe(setState), [session]);

  const current = state.players[state.currentPlayerIndex]!;
  const humanTurn = current.kind === "human" && !state.winnerId;
  const canRoll = humanTurn && state.phase === "roll";
  const canContinue =
    humanTurn &&
    ((state.phase === "settle" && state.prompt.kind === "idle") ||
      state.phase === "end");

  const playHeightRatio = BOARD_PNG.playSize / BOARD_PNG.height;
  const prompt = state.prompt;

  const buyTile =
    prompt.kind === "buy" ? state.tiles[prompt.tileIndex] : null;
  const upgradeTile =
    prompt.kind === "upgrade" ? state.tiles[prompt.tileIndex] : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>花花世界</strong>
          <span className="brand-en">Vivondo</span>
        </div>
        <div className="top-meta">
          回合 {state.turn} · {current.name}
          {current.hospitalSkips > 0
            ? ` · 住院剩余 ${current.hospitalSkips}`
            : ""}
          {current.hasPlane ? " · 飞机" : ""}
          {" · "}
          {state.winnerId
            ? "终局"
            : state.phase === "roll"
              ? "掷骰"
              : state.phase === "settle"
                ? "结算"
                : "回合结束"}
          {" · 奖池 "}
          {state.casinoPool}
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
                  {state.tiles[p.position]?.zh ?? "—"}
                  {p.hasPlane ? " ✈" : ""}
                </div>
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
                const owner = state.players.find((p) => p.id === deed.ownerId);
                if (!owner) return null;
                const { x, y } = tileCenterPercent(tile);
                return (
                  <div
                    key={`deed-${tile.index}`}
                    className="deed-mark"
                    title={`${tile.zh} · ${owner.name}${deed.houses ? ` · ${deed.houses}屋` : ""}${deed.special ? ` · ${deed.special}` : ""}`}
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
                      : deed.houses > 0
                        ? String(deed.houses)
                        : ""}
                  </div>
                );
              })}
              {state.players.map((p, i) => {
                if (p.eliminated) return null;
                const tile = state.tiles[p.position]!;
                const { x, y } = tileCenterPercent(tile);
                const offset = (i - (state.players.length - 1) / 2) * 10;
                return (
                  <div
                    key={p.id}
                    className="token"
                    title={`${p.name} @ ${tile.zh}`}
                    style={{
                      left: `calc(${x}% + ${offset}px)`,
                      top: `calc(${y}% + ${offset * 0.3}px)`,
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
              {state.lastCasinoDice
                ? `${state.lastCasinoDice[0]}+${state.lastCasinoDice[1]}`
                : state.lastDice == null
                  ? "—"
                  : state.lastDice}
            </div>
          </div>

          {humanTurn && prompt.kind === "buy" && buyTile && (
            <div className="panel choice">
              <div className="label">无主地产</div>
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

          {humanTurn && prompt.kind === "airport" && (
            <div className="panel choice">
              <div className="label">机场</div>
              <p>可付地价×3飞往任意国家地产（获得飞机 token）。</p>
              <div className="actions">
                <button type="button" onClick={() => session.airportBeginFly()}>
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
              <div className="label">选择目的地</div>
              <ul>
                {propertyTiles(state).map((t) => {
                  const fare = (t.price ?? 0) * 3;
                  const can = current.cash >= fare;
                  return (
                    <li key={t.index}>
                      <button
                        type="button"
                        className="dest-btn"
                        disabled={!can}
                        onClick={() => session.airportFlyTo(t.index)}
                      >
                        {t.zh} · ¥{fare}
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

          <div className="actions">
            <button type="button" disabled={!canRoll} onClick={() => session.roll()}>
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
            已接入：买地 / 付租 / 加盖特性化 · 银行领薪 · 机场 · 医院 · 赌场。事件 /
            港口 / 黑手党稍后。
          </p>
        </aside>
      </main>
    </div>
  );
}
