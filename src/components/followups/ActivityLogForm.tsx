"use client";

import { useState } from "react";
import { ActivityTypeIcon } from "./ActivityIcons";
import ModalShell from "./ModalShell";
import { ACTIVITY_TILE, ACTIVITY_TILE_DEFAULT, COLOR, MODAL_CANCEL, MODAL_FIELD_CLASS, MODAL_FIELD_LABEL, MODAL_INPUT, MODAL_SAVE, TYPE } from "./designTokens";
import { ApiError } from "@/lib/api/auth";
import { logActivity } from "@/lib/api/activities";
import { useActivityTypes } from "./useActivityTypes";

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

/**
 * Record something that already happened. The timestamp is always the current server time —
 * there is no date/time override, keeping the history honest.
 */
export default function ActivityLogForm({ contactId, contactName, onSaved, onCancel }: {
  contactId: number; contactName: string; onSaved: () => Promise<void>; onCancel: () => void;
}) {
  const { types: activityTypes, loaded: typesLoaded, error: typesError } = useActivityTypes();
  const [type, setType] = useState("phone_call");
  const [title, setTitle] = useState("");
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
      await logActivity(accessToken, contactId, { activity_type: type, notes: notes.trim(), ...(coordinates ? { coordinates } : {}) });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The activity could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <ModalShell
      title="Log New Activity"
      subtitle={`Record an interaction with ${contactName}`}
      onClose={onCancel}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      footer={
        <>
          <button type="button" disabled={isSaving} onClick={onCancel} style={MODAL_CANCEL} className="disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} style={MODAL_SAVE} className="disabled:opacity-60">{isSaving ? "Saving…" : "Save Activity"}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-2">
          <span style={MODAL_FIELD_LABEL}>Activity type</span>
          {typesError && <p role="alert" className="text-xs font-semibold text-red-600">{typesError}</p>}
          {typesLoaded && !typesError && activityTypes.length === 0 && <p className="text-xs text-gray-500">No activity types are set up in Settings.</p>}
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-2">
            {activityTypes.map((option) => {
              const on = type === option.value;
              const tile = ACTIVITY_TILE[option.value] ?? ACTIVITY_TILE_DEFAULT;
              return (
                <button key={option.value} type="button" role="radio" aria-checked={on} onClick={() => setType(option.value)}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors"
                  style={{
                    ...TYPE.bodyMd,
                    fontWeight: 600,
                    borderColor: on ? COLOR.accent : COLOR.borderStrong,
                    background: on ? COLOR.accentTint06 : COLOR.surfaceWhite,
                    color: on ? COLOR.textHeading : COLOR.textSecondary,
                  }}>
                  <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: tile.bg, color: tile.fg }}>
                    <ActivityTypeIcon type={option.value} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>Title
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Quotation shared" className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
        </label>
        <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>Details
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesError(""); }} rows={3}
            placeholder="What happened? e.g. Called, customer asked about 500L tank price" aria-invalid={Boolean(notesError)}
            style={{ ...MODAL_INPUT, height: "auto", minHeight: 42, padding: "10px 12px", resize: "vertical" }} />
          {notesError && <span role="alert" className="text-xs font-semibold text-red-600">{notesError}</span>}
        </label>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </ModalShell>
  );
}
