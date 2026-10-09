import type { ReactNode } from "react";

/** The dark gradient page header used by Contacts, Lead Followup and Tasks: eyebrow, title, subtitle, optional actions. */
export default function PageHeader({ eyebrow, title, subtitle, children }: {
  eyebrow: string; title: string; subtitle: string; children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
      <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
      <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" /> {eyebrow}
          </p>
          <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">{title}</h1>
          <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">{subtitle}</p>
        </div>
        {children && <div className="grid grid-cols-1 sm:flex gap-3 shrink-0">{children}</div>}
      </div>
    </header>
  );
}
