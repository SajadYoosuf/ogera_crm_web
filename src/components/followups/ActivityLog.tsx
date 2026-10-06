"use client";

import { useCallback, useEffect, useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import { completeActivity, createActivity, listActivities, type ActivityEntry, type ActivityInput } from "@/lib/api/leads";
import { getGPSLocationAndGeocode } from "@/lib/location";
import { ACTIVITY_KINDS, TASK_STATE, kindMeta, subtypeLabel } from "./activities";
import { formatMoment } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
const kindIcon = <path d="M4 6h16M4 12h16M4 18h10" />;

type Draft = { kind: string; notes: string; schedule: boolean; dueAt: string };
const blankDraft = (overrides: Partial<Draft> = {}): Draft => ({ kind: "phone_call", notes: "", schedule: false, dueAt: "", ...overrides });

/** Activity log for one lead: log what was done, schedule the next task, and close tasks with an outcome. */
export default function ActivityLog({ contactId }: { contactId: number }) {
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [promptNext, setPromptNext] = useState(false);

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setLoadError("Sign in again to continue."); return; }
    try {
      setItems(await listActivities(accessToken, contactId));
      setLoadError("");
    } catch (caught) { setLoadError(errorText(caught)); }
  }, [contactId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setKind = (kind: string) => setDraft((current) => current && { ...current, kind });

  async function save() {
    if (!draft) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again to continue."); return; }
    if (draft.kind === "internal_note" && !draft.notes.trim()) { setFormError("Write the note first."); return; }
    if (draft.schedule && !draft.dueAt) { setFormError("Pick when the task is due."); return; }
    setIsSaving(true); setFormError("");
    try {
      const input: ActivityInput = { kind: draft.kind, ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) };
      if (draft.schedule) input.due_at = `${draft.dueAt}:00`;
      // A field visit is logged where it happened; skip the position when the browser will not share it.
      if (draft.kind === "field_visit" && !draft.schedule) {
        const position = await getGPSLocationAndGeocode().catch(() => null);
        if (position) { input.latitude = Number(position.latitude); input.longitude = Number(position.longitude); }
      }
      await createActivity(accessToken, contactId, input);
      setDraft(null); setPromptNext(false);
      await load();
    } catch (caught) { setFormError(errorText(caught)); } finally { setIsSaving(false); }
  }

  async function markDone(activity: ActivityEntry) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setLoadError("Sign in again to continue."); return; }
    setIsSaving(true);
    try {
      await completeActivity(accessToken, contactId, activity.id);
      setPromptNext(true);
      await load();
    } catch (caught) { setLoadError(errorText(caught)); } finally { setIsSaving(false); }
  }

  const openForm = (overrides: Partial<Draft> = {}) => { setFormError(""); setPromptNext(false); setDraft(blankDraft(overrides)); };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Activity</h3>
        {!draft && (
          <button type="button" onClick={() => openForm()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add activity
          </button>
        )}
      </div>

      {draft && (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <FilterSelect label="Type" value={draft.kind} onChange={setKind} className="w-full" icon={kindIcon}
            options={ACTIVITY_KINDS.map((item) => ({ value: item.kind, label: item.label, dot: item.dot }))} />
          <label className="crm-field-label">{draft.kind === "internal_note" ? "Note" : "Notes (optional)"}
            <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} className="crm-textarea" />
          </label>
          {draft.kind !== "internal_note" && (
            <div className="space-y-2">
              <div role="radiogroup" aria-label="When" className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                {[{ schedule: false, label: "Done now" }, { schedule: true, label: "Schedule task" }].map((option) => (
                  <button key={option.label} type="button" role="radio" aria-checked={draft.schedule === option.schedule} onClick={() => setDraft({ ...draft, schedule: option.schedule })}
                    className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${draft.schedule === option.schedule ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{option.label}</button>
                ))}
              </div>
              {draft.schedule && (
                <label className="crm-field-label">Due
                  <input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} className="crm-input" />
                </label>
              )}
            </div>
          )}
          {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={isSaving} onClick={() => void save()} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {isSaving ? "Saving…" : draft.schedule ? "Schedule task" : "Log activity"}
            </button>
            <button type="button" disabled={isSaving} onClick={() => setDraft(null)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {promptNext && !draft && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span className="font-semibold">Logged. Schedule the next follow-up?</span>
          <button type="button" onClick={() => openForm({ schedule: true })} className="shrink-0 min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">Schedule</button>
        </div>
      )}

      {loadError ? (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 min-h-9 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold hover:bg-rose-100">Retry</button>
        </div>
      ) : items === null ? (
        <p className="mt-3 text-sm text-gray-500">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">No calls, visits or notes logged yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => {
            const kind = kindMeta(item.kind);
            const state = TASK_STATE[item.task_state] ?? TASK_STATE.pending;
            const purpose = subtypeLabel(item.kind, item.subtype);
            const open = item.status === "pending";
            return (
              <li key={item.id} className={`rounded-xl border bg-white p-3.5 ${item.task_state === "overdue" ? "border-rose-300" : item.task_state === "due_today" ? "border-blue-300" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${kind.dot}`} />
                      <span className="truncate">{kind.label}{purpose ? ` · ${purpose}` : ""}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {open && item.due_at ? `Due ${formatMoment(item.due_at)}` : formatMoment(item.done_at ?? item.created_at)}
                      {item.created_by_name ? ` · ${item.created_by_name}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${state.chip}`}>{state.label}</span>
                </div>
                {item.notes && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{item.notes}</p>}
                {item.latitude !== null && item.longitude !== null && (
                  <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">View visit location</a>
                )}
                {open && (
                  <button type="button" disabled={isSaving} onClick={() => void markDone(item)} className="mt-3 min-h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{isSaving ? "Saving…" : "Mark done"}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
