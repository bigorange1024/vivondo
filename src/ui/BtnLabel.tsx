import type { ReactNode } from "react";

/** Chinese on top, English below — no locale switch yet. */
export function BtnLabel({ zh, en }: { zh: ReactNode; en: string }) {
  return (
    <span className="btn-label">
      <span className="btn-zh">{zh}</span>
      <span className="btn-en">{en}</span>
    </span>
  );
}
