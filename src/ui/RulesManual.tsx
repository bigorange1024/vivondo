import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { BtnLabel } from "./BtnLabel";
import {
  RULES_MANUAL_TITLE,
  RULES_SECTIONS,
  RULES_TOC_LABEL,
  type RulesLang,
} from "./rulesContent";

export function RulesManual({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<RulesLang>("zh");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo(0, 0);
  }, [open]);

  if (!open) return null;

  const jumpTo = (id: string) => {
    const el = bodyRef.current?.querySelector(`#rules-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card rules-manual"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rules-manual-head">
          <h2 id={titleId}>{RULES_MANUAL_TITLE[lang]}</h2>
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

        <div className="rules-manual-layout">
          <nav className="rules-toc" aria-label={RULES_TOC_LABEL[lang]}>
            <div className="rules-toc-label">{RULES_TOC_LABEL[lang]}</div>
            <ol>
              {RULES_SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => jumpTo(s.id)}>
                    <span className="rules-toc-num">{i + 1}</span>
                    {s.title[lang]}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="rules-body" ref={bodyRef}>
            {RULES_SECTIONS.map((s) => (
              <section key={s.id} id={`rules-${s.id}`} className="rules-section">
                <h3>{s.title[lang]}</h3>
                {s.body[lang].map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact board-corner / setup opener */
export function RulesOpenButton({
  onClick,
  className,
  style,
}: {
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={className ?? "rules-fab"}
      style={style}
      onClick={onClick}
      aria-label="Game rules"
    >
      <BtnLabel zh="规则" en="Rules" />
    </button>
  );
}
