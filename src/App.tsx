import { useEffect, useMemo, useState } from "react";
import boardUrl from "@assets/board-map-v7.png";
import { BOARD_PNG, tileCenterPercent } from "./engine/board";
import { createSoloSession, type GameState } from "./session/solo";

export default function App() {
  const session = useMemo(() => createSoloSession({ humans: 1, ais: 3 }), []);
  const [state, setState] = useState<GameState>(() => session.getState());

  useEffect(() => session.subscribe(setState), [session]);

  const current = state.players[state.currentPlayerIndex]!;
  const canRoll = current.kind === "human" && state.phase === "roll";
  const canContinue =
    current.kind === "human" &&
    (state.phase === "settle" || state.phase === "end");

  const playHeightRatio = BOARD_PNG.playSize / BOARD_PNG.height;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>花花世界</strong>
          <span className="brand-en">Vivondo</span>
        </div>
        <div className="top-meta">
          回合 {state.turn} · {current.name} ·{" "}
          {state.phase === "roll"
            ? "掷骰"
            : state.phase === "settle"
              ? "结算"
              : "回合结束"}
        </div>
      </header>

      <main className="layout">
        <aside className="players">
          {state.players.map((p, idx) => (
            <div
              key={p.id}
              className={`player-card${idx === state.currentPlayerIndex ? " active" : ""}`}
              style={{ borderColor: p.color }}
            >
              <span className="dot" style={{ background: p.color }} />
              <div>
                <div className="pname">
                  {p.name}
                  {p.kind === "ai" ? " (AI)" : ""}
                </div>
                <div className="pcash">¥{p.cash}</div>
                <div className="ppos">
                  {state.tiles[p.position]?.zh ?? "—"}
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
              {state.players.map((p, i) => {
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
                      zIndex: i + 1,
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
              {state.lastDice == null ? "—" : state.lastDice}
            </div>
          </div>
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
            原型：仅掷骰移动与途经起点领薪。买地 / 事件 / 角格结算后续接入。
          </p>
        </aside>
      </main>
    </div>
  );
}
