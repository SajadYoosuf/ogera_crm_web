"use client";

import { type FormEvent, type ReactNode, useEffect, useId } from "react";
import { COLOR, SHADOW } from "./designTokens";

/** Centred dialog for the activity and follow-up forms. Escape and a backdrop click close it. */
export default function ModalShell({ title, subtitle, onClose, onSubmit, footer, children }: {
  title: string; subtitle: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; footer: ReactNode; children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ background: COLOR.overlay }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form
        noValidate // each form checks its own fields, so the person always sees our message, not the browser's
        onSubmit={onSubmit}
        className="flex max-h-[min(860px,92dvh)] w-full max-w-[520px] flex-col bg-white"
        style={{ borderRadius: 16, boxShadow: SHADOW.modal }}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", color: "#1A1C21" }}>{title}</h2>
            <p style={{ fontSize: 13, color: "#6B7080" }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-gray-100" style={{ color: "#6B7080" }}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-2.5 px-6 py-4" style={{ borderTop: `1px solid ${COLOR.borderDefault}` }}>{footer}</div>
      </form>
    </div>
  );
}
