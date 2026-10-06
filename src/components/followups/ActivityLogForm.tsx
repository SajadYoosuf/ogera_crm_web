"use client";

import { useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import { logActivity } from "@/lib/api/activities";
import { ACTIVITY_TYPES } from "./activities";

/** One quick GPS fix for a field visit. It never blocks the save: denied, unavailable or slow all resolve to null. */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60_000 },
    );
  });
}

/** Record something that already happened. The time is the server's, so there is no date field. */
export default function ActivityLogForm({ contactId, onSaved, onCancel }: { contactId: number; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [type, setType] = useState("phone_call");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    if (!notes.trim()) { setNotesError("Write what happened."); return; }
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in again to continue."); return; }
    setIsSaving(true); setError(""); setNotesError("");
    try {
      const coordinates = type === "field_visit" ? await currentPosition() : null;
      await logActivity(accessToken, contactId, { type, notes: notes.trim(), ...(coordinates ? { coordinates } : {}) });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The activity could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-3 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Log activity">
      <FilterSelect label="Type" value={type} onChange={setType} className="w-full" options={ACTIVITY_TYPES}
        icon={<path d="M4 6h16M4 12h16M4 18h10" />} />
      <label className="crm-field-label">Notes
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesError(""); }} rows={3} className="crm-textarea"
          placeholder="What happened? e.g. Called, customer asked about 500L tank price" aria-invalid={Boolean(notesError)} />
        {notesError && <span role="alert" className="text-xs font-semibold text-red-600">{notesError}</span>}
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSaving ? "Saving…" : "Save Activity"}</button>
        <button type="button" disabled={isSaving} onClick={onCancel} className="min-h-11 px-3 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline">Cancel</button>
      </div>
    </form>
  );
}
