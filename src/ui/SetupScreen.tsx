import { useMemo, useState } from "react";

export interface SetupConfig {
  humans: number;
  ais: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function validateSetup(cfg: SetupConfig): string | null {
  const { humans, ais } = cfg;
  const total = humans + ais;
  if (humans < 1) return "至少需要 1 名人类玩家";
  if (humans > 4) return "人类玩家最多 4 人";
  if (ais < 0) return "AI 数量无效";
  if (total < 2) return "总人数至少 2（不可单人游玩）";
  if (total > 4) return "总人数最多 4";
  if (humans === 0) return "不能全是 AI";
  return null;
}

export function SetupScreen({
  onStart,
  onOpenLoad,
  onOpenDelete,
}: {
  onStart: (cfg: SetupConfig) => void;
  onOpenLoad: () => void;
  onOpenDelete: () => void;
}) {
  const [humans, setHumans] = useState(1);
  const [ais, setAis] = useState(1);

  const cfg = useMemo(() => ({ humans, ais }), [humans, ais]);
  const error = validateSetup(cfg);
  const total = humans + ais;

  const setHumansSafe = (n: number) => {
    const h = clamp(n, 1, 4);
    setHumans(h);
    setAis((a) => clamp(a, 0, 4 - h));
  };
  const setAisSafe = (n: number) => {
    const maxA = 4 - humans;
    setAis(clamp(n, 0, maxA));
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-brand">
          <h1>花花世界</h1>
          <p className="setup-en">Vivondo</p>
        </div>
        <p className="setup-lead">选择人数后开始（2～4 人，至少 1 名人类）</p>

        <div className="setup-row">
          <label htmlFor="setup-humans">人类玩家</label>
          <div className="setup-stepper">
            <button
              type="button"
              aria-label="减少人类"
              disabled={humans <= 1}
              onClick={() => setHumansSafe(humans - 1)}
            >
              −
            </button>
            <span id="setup-humans">{humans}</span>
            <button
              type="button"
              aria-label="增加人类"
              disabled={humans >= 4 || total >= 4}
              onClick={() => setHumansSafe(humans + 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="setup-row">
          <label htmlFor="setup-ais">AI 玩家</label>
          <div className="setup-stepper">
            <button
              type="button"
              aria-label="减少AI"
              disabled={ais <= 0}
              onClick={() => setAisSafe(ais - 1)}
            >
              −
            </button>
            <span id="setup-ais">{ais}</span>
            <button
              type="button"
              aria-label="增加AI"
              disabled={ais >= 4 - humans}
              onClick={() => setAisSafe(ais + 1)}
            >
              +
            </button>
          </div>
        </div>

        <p className="setup-total">
          合计 <strong>{total}</strong> 人
          {error ? <span className="setup-error"> · {error}</span> : null}
        </p>

        <button
          type="button"
          className="setup-start"
          disabled={error != null}
          onClick={() => onStart(cfg)}
        >
          <span className="btn-label">
            <span className="btn-zh">开始游戏</span>
            <span className="btn-en">Start</span>
          </span>
        </button>

        <div className="setup-persist">
          <button type="button" className="secondary" onClick={onOpenLoad}>
            <span className="btn-label">
              <span className="btn-zh">读取存档</span>
              <span className="btn-en">Load</span>
            </span>
          </button>
          <button type="button" className="secondary" onClick={onOpenDelete}>
            <span className="btn-label">
              <span className="btn-zh">删除存档</span>
              <span className="btn-en">Delete</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
