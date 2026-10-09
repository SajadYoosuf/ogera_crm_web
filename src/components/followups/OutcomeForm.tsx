"use client";

import { useState } from "react";

const QUICK_OUTCOMES = ["Spoke to customer", "No answer", "Interested, will confirm", "Call back later"];

/** "What happened?" after a follow-up is finished; the answer is logged as an activity, so it cannot be empty. */
export default function OutcomeForm({ onSave, onCancel }: { onSave: (outcome: string) => Promise<void>; onCancel: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!outcome.trim()) { setError("Write what happened before marking this done."); return; }
    setSaving(true);
    setError("");
    try { await onSave(outcome.trim()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save. Please try again."); setSaving(false); }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-green-50/60 p-3">
      <label className="block text-xs font-bold text-gray-700" htmlFor="task-outcome">What happened?</label>
      <textarea id="task-outcome" autoFocus rows={3} value={outcome} onChange={(event) => { setOutcome(event.target.value); setError(""); }} placeholder="e.g. Spoke to the owner, wants a quote by Friday"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15" />
      <div className="flex flex-wrap gap-2">
        {QUICK_OUTCOMES.map((text) => (
          <button key={text} type="button" onClick={() => { setOutcome((current) => (current.trim() ? current : text)); setError(""); }} className="min-h-9 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50">{text}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving…" : "Save & mark done"}</button>
        <button type="button" disabled={saving} onClick={onCancel} className="min-h-11 px-3 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline">Cancel</button>
      </div>
    </div>
  );
}
