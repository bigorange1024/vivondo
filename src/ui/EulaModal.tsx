import { useEffect, useId, useState } from "react";
import { BtnLabel } from "./BtnLabel";
import { EULA_SECTIONS, EULA_TITLE, type EulaLang } from "./eulaContent";

export function EulaModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [lang, setLang] = useState<EulaLang>("zh");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card eula-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rules-manual-head">
          <h2 id={titleId}>{EULA_TITLE[lang]}</h2>
          <div className="rules-manual-tools">
            <div className="rules-lang" role="group" aria-label="Language">
              <button
                type="button"
                className={lang === "zh" ? "on" : undefined}
                onClick={() => setLang("zh")}
              >
                中文
              </button>
              <button
                type="button"
                className={lang === "en" ? "on" : undefined}
                onClick={() => setLang("en")}
              >
                EN
              </button>
            </div>
            <button type="button" className="secondary rules-close" onClick={onClose}>
              <BtnLabel zh="关闭" en="Close" />
            </button>
          </div>
        </header>
        <div className="eula-body">
          {EULA_SECTIONS.map((s) => (
            <section key={s.heading.zh} className="eula-section">
              <h3>{s.heading[lang]}</h3>
              {s.body[lang].map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
