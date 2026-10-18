"use client";

import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/auth";

// Buttons follow the app's standard (Employees, Sales, Products): 40px high, 8px corners, 1px #E1E1E6 border on secondary.
export const primaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0E4D3A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B3E2F] disabled:opacity-60";
export const secondaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#E1E1E6] bg-white px-4 text-sm font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50";
/** Save and confirm actions: the primary style. The disabled state reads as "nothing to save". */
export const accentButton = "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0E4D3A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B3E2F] disabled:cursor-not-allowed disabled:bg-[#DDE2DE] disabled:text-[#9AA0AC]";
export const iconButton ="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

export function Icon({ children, className = "w-4 h-4" }: { children: ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export const icons = {
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  grip: <><circle cx="8" cy="6" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="8" cy="18" r="1" /><circle cx="16" cy="6" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="16" cy="18" r="1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  lock: <><rect width="16" height="11" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
};

/** What a person sees when a request fails: the API's own sentence, never a stack trace. */
export const errorText = (caught: unknown, fallback = "Something went wrong. Please try again.") => (caught instanceof ApiError ? caught.message : fallback);

export function getToken() {
  return typeof window === "undefined" ? null : sessionStorage.getItem("ogera_access_token");
}

export function Spinner() {
  return <div className="space-y-3 animate-pulse" role="status" aria-label="Loading">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}</div>;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <Icon className="mx-auto h-7 w-7 text-rose-500">{icons.alert}</Icon>
      <p className="mt-3 text-sm font-semibold text-rose-800">{message}</p>
      <button type="button" onClick={onRetry} className={`${secondaryButton} mt-4`}>Try again</button>
    </div>
  );
}

export function Toast({ message, tone = "ok" }: { message: string; tone?: "ok" | "error" }) {
  if (!message) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      <Icon>{tone === "error" ? icons.alert : icons.check}</Icon> {message}
    </p>
  );
}

/** A settings panel in the Settings design: white, hairline border, title row, then content. */
export function Panel({ title, subtitle, status, children }: { title: string; subtitle?: string; status?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[14px] border border-[#E5E7EA] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[#1A1C21]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[#9AA0AC]">{subtitle}</p>}
        </div>
        {status}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-[#0a192f]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
