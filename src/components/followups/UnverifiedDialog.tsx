"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FIELD_LABELS } from "./stages";

/** Popup shown when the backend refuses a stage move because the lead's details are incomplete. */
export default function UnverifiedDialog({ leadName, stageLabel, missing, onClose }: {
  leadName: string; stageLabel: string; missing: string[]; onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0a192f]/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="unverified-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
        </span>
        <h2 id="unverified-title" className="mt-4 text-lg font-extrabold tracking-tight text-[#0a192f]">Complete the details first</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          <span className="font-semibold text-gray-700">{leadName}</span> can&apos;t move to {stageLabel} until these are filled in:
        </p>
        <ul className="mt-3 space-y-1.5 rounded-xl bg-gray-50 p-4 text-sm font-medium text-gray-800">
          {missing.map((field) => (
            <li key={field} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{FIELD_LABELS[field] ?? field.replaceAll("_", " ")}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50">Close</button>
          <Link href="/contacts" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Edit in Contacts</Link>
        </div>
      </div>
    </div>
  );
}
