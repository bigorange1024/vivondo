import { useEffect, useState } from "react";
import {
  formatSaveMeta,
  listSaveSlots,
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void listSaveSlots()
      .then((list) => {
        if (!cancelled) setSlots(list);
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

  const title =
    mode === "save"
      ? "选择存档位保存"
      : mode === "load"
        ? "选择存档读取"
        : "选择存档删除";
  const pickEn =
    mode === "save" ? "Save here" : mode === "load" ? "Load" : "Delete";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card save-slot-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p className="modal-hint">最多 9 个存档 · 写入项目 save/ 文件夹</p>
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
                    {info.exists ? formatSaveMeta(info.meta) : "（空）"}
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
