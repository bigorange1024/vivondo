import { useEffect, useState } from "react";
import {
  detectSaveBackend,
  formatSaveMeta,
  listSaveSlots,
  SAVE_NOTICE,
  type SaveBackend,
  type SaveSlotInfo,
} from "../persist/saves";
import { BtnLabel } from "./BtnLabel";

export type SaveModalMode = "save" | "load" | "delete";

export function SaveSlotModal({
  open,
  mode,
  onPick,
  onCancel,
}: {
  open: boolean;
  mode: SaveModalMode;
  onPick: (slot: number, info: SaveSlotInfo) => void;
  onCancel: () => void;
}) {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<SaveBackend>("browser");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void Promise.all([listSaveSlots(), detectSaveBackend()])
      .then(([list, where]) => {
        if (cancelled) return;
        setSlots(list);
        setBackend(where);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "无法列出存档");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const titleZh =
    mode === "save"
      ? "选择存档位保存"
      : mode === "load"
        ? "选择存档读取"
        : "选择存档删除";
  const titleEn =
    mode === "save" ? "Save slot" : mode === "load" ? "Load slot" : "Delete slot";
  const pickEn =
    mode === "save" ? "Save here" : mode === "load" ? "Load" : "Delete";
  const notice = SAVE_NOTICE[backend];
  const whereZh =
    backend === "disk" ? "本机文件夹 save/" : "本浏览器本地存储";
  const whereEn =
    backend === "disk" ? "project folder save/" : "this browser only";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card save-slot-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>
          {titleZh}
          <span className="save-title-en"> / {titleEn}</span>
        </h2>
        <p className="modal-hint">
          最多 9 槽 · 当前写入：{whereZh}
          <br />
          9 slots · storing in: {whereEn}
        </p>
        <div className="save-warning" role="note">
          <p>
            <strong>重要 · 存档说明</strong>
          </p>
          <p>{notice.zh}</p>
          <p>
            <strong>Important · Saves</strong>
          </p>
          <p>{notice.en}</p>
        </div>
        {error ? <p className="modal-error">{error}</p> : null}
        <ul className="save-slot-list">
          {slots.map((info) => {
            const disabled =
              (mode === "load" || mode === "delete") && !info.exists;
            return (
              <li key={info.slot}>
                <button
                  type="button"
                  className={`save-slot-btn${info.exists ? " filled" : ""}`}
                  disabled={disabled}
                  onClick={() => onPick(info.slot, info)}
                >
                  <span className="save-slot-num">#{info.slot}</span>
                  <span className="save-slot-meta">
                    {info.exists ? formatSaveMeta(info.meta) : "（空） / Empty"}
                  </span>
                  <span className="save-slot-en">{pickEn}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            <BtnLabel zh="取消" en="Cancel" />
          </button>
        </div>
      </div>
    </div>
  );
}
