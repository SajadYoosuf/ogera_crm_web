"use client";

import { useEffect } from "react";

const DISMISS_AFTER_MS = 8000;

/** "Schedule the next follow-up?" after an activity is saved or a task is done; dismisses itself after 8 seconds. */
export default function FollowupPrompt({ title, onSchedule, onSkip }: { title: string; onSchedule: () => void; onSkip: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onSkip, DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [onSkip]);

  return (
    <div role="status" className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-green-800">
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        {title}
      </p>
      <p className="mt-1 text-sm text-green-900">Schedule the next follow-up?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSchedule} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700">Yes, schedule</button>
        <button type="button" onClick={onSkip} className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-green-800 hover:bg-green-100">Skip</button>
      </div>
    </div>
  );
}
