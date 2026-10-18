import type { ReactNode } from "react";

/** Page header used by Contacts, Lead Followup and Tasks: eyebrow, title, subtitle, optional actions. Dark gradient by default; `light` gives a white header. */
export default function PageHeader({ eyebrow, title, subtitle, light = false, children }: {
  eyebrow?: string; title: string; subtitle: string; light?: boolean; children?: ReactNode;
}) {
  return (
    <header className={light
      ? "relative overflow-hidden rounded-2xl bg-white border border-gray-200 text-slate-900 shadow-sm"
      : "relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10"}>
      {!light && <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />}
      {!light && <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />}
      <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="max-w-xl">
          {eyebrow && (
            <p className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] ${light ? "text-[#0E4D3A]" : "text-sky-300"}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${light ? "bg-blue-500" : "bg-sky-300"}`} /> {eyebrow}
            </p>
          )}
          <h1 className={`mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight ${light ? "text-[#0a192f]" : ""}`}>{title}</h1>
          <p className={`mt-2 text-sm sm:text-[15px] leading-relaxed ${light ? "text-gray-500" : "text-white/65"}`}>{subtitle}</p>
        </div>
        {children && <div className="grid grid-cols-1 sm:flex gap-3 shrink-0">{children}</div>}
      </div>
    </header>
  );
}
