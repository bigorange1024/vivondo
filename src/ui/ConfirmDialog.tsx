import { useEffect, useId, useRef } from "react";
import { BtnLabel } from "./BtnLabel";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  confirmEn = "Confirm",
  cancelLabel = "取消",
  cancelEn = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmEn?: string;
  cancelLabel?: string;
  cancelEn?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            <BtnLabel zh={cancelLabel} en={cancelEn} />
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? "danger" : undefined}
            onClick={onConfirm}
          >
            <BtnLabel zh={confirmLabel} en={confirmEn} />
          </button>
        </div>
      </div>
    </div>
  );
}
