"use client";

/**
 * LeadTaskActions — the action row under a follow-up card (lead detail and Tasks page).
 *
 *   Start / Complete / Reschedule — the task's assignee, or admin/manager
 *   Reassign / Delete             — admin/manager only
 *
 * Complete asks how it went and how it was actually done ("Done via", pre-selected with the
 * planned type); the backend records that as an activity linked to the task. Then it offers
 * "Schedule next follow-up?" — after No answer / Not now the date is pre-filled with the retry
 * gap from Settings.
 *
 * Reschedule takes a quick preset or a date and time, plus an optional reason. Staff see it
 * only when Settings → Follow-ups allows staff to reschedule.
 *
 * The backend enforces the same rules; buttons the user may not use are hidden.
 */

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import {
  ACTIVITY_TYPE_FALLBACK,
  deleteLeadInteraction,
  localDateTimeToIso,
  reassignLeadTask,
  rescheduleLeadTask,
  updateInteraction,
  type Interaction,
  type InteractionOutcome,
} from "@/lib/api/interactions";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import { isLeadHead } from "@/lib/shared/roles";
import { useFollowupSettings } from "@/features/settings/hooks/useFollowupSettings";
import { duePresets, isPast, localDate, retryChoice } from "@/features/leads/followupPresets";
import LeadFollowupModal, { type FollowupInitial } from "./LeadFollowupModal";

export type TaskActionMode = "idle" | "complete" | "next" | "reschedule" | "reassign" | "delete";

const OUTCOMES: { value: InteractionOutcome; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "not_now", label: "Not now" },
  { value: "no_answer", label: "No answer" },
];

const FALLBACK_TYPES = staticOptions(ACTIVITY_TYPE_FALLBACK);
// Internal notes are not a way of contacting the client.
const NOT_A_CHANNEL = new Set(["internal_note", "note"]);

const btn = "h-8 rounded-md border border-[#DEE1E5] bg-white px-2.5 text-xs font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:opacity-50";
const primary = "h-8 rounded-md bg-[#0E4D3A] px-2.5 text-xs font-semibold text-white hover:bg-[#0B3E2F] disabled:opacity-50";
const input = "h-8 rounded-md border border-[#DEE1E5] px-2 text-xs text-[#1A1C21]";
const chip = (on: boolean) =>
  `h-8 rounded-md border px-2 text-xs font-semibold ${on ? "border-teal-600 bg-teal-50 text-teal-700" : "border-[#DEE1E5] text-[#4B5060] hover:bg-[#F7F7F9]"}`;

export default function LeadTaskActions({ task, leadId, leadName, employees = [], onChanged, initialMode = "idle", onCancel }: {
  task: Interaction;
  leadId: number;
  /** Shown in the "Schedule next follow-up" form. */
  leadName?: string;
  employees?: { id: number; name: string }[];
  onChanged: () => void;
  /** Opens straight into one action (e.g. from the Tasks page menu). */
  initialMode?: TaskActionMode;
  /** Replaces the default cancel, which returns to the button row. */
  onCancel?: () => void;
}) {
  const { token, user } = useAuth();
  const { settings } = useFollowupSettings();
  const { options: activityTypes } = useEnumOptions("activity_type", FALLBACK_TYPES);
  const head = isLeadHead(user);
  const isAssignee = user != null && task.assigned_to === user.id;
  const canWork = head || isAssignee;
  const canReschedule = head || (isAssignee && settings.allow_staff_reschedule);
  const canCreate = head || settings.allow_staff_create_followup;

  const [mode, setMode] = useState<TaskActionMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<InteractionOutcome>("done");
  const [doneVia, setDoneVia] = useState(task.activity_type);
  const [doneViaLabel, setDoneViaLabel] = useState(task.activity_type === "other" ? task.custom_label ?? "" : "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(task.assigned_to != null ? String(task.assigned_to) : "");
  const [nextInitial, setNextInitial] = useState<FollowupInitial | null>(null);

  // The "Schedule next follow-up?" step stays visible even though the task is now completed.
  if (mode !== "next" && !nextInitial) {
    if (task.status === "completed" && !head) return null;
    if (!canWork) return null;
  }

  async function run(action: (t: string) => Promise<unknown>, after: () => void = () => { setMode("idle"); onChanged(); }) {
    if (!token) { setError("Sign in again to continue."); return; }
    setBusy(true); setError("");
    try {
      await action(token);
      after();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function complete() {
    if (!note.trim()) { setError("Add a short note about what happened."); return; }
    if (doneVia === "other" && !doneViaLabel.trim()) { setError("Name how you contacted them."); return; }
    void run(
      (t) => updateInteraction(t, task.id, {
        status: "completed",
        outcome,
        notes: note.trim(),
        actual_activity_type: doneVia,
        ...(doneVia === "other" ? { custom_label: doneViaLabel.trim() } : {}),
      }),
      // Keep the card until the user answers "Schedule next follow-up?"; refresh after.
      () => {
        if (canCreate) { setMode("next"); return; }
        setMode("idle");
        onChanged();
      },
    );
  }

  function scheduleNext() {
    const retry = outcome === "no_answer" || outcome === "not_now"
      ? retryChoice(settings.retry_followup_days, settings.default_due_time)
      : null;
    setNextInitial({
      activityType: task.activity_type,
      customLabel: task.custom_label ?? undefined,
      ...(retry ? { date: retry.date, time: retry.time } : {}),
    });
  }

  function finishNext() {
    setNextInitial(null);
    setMode("idle");
    onChanged();
  }

  function saveReschedule() {
    if (!date) { setError("Choose a date or a quick pick."); return; }
    if (isPast({ date, time }, new Date(), settings.default_due_time)) {
      setError("The new time is in the past. Choose a later time.");
      return;
    }
    void run((t) => rescheduleLeadTask(t, leadId, task.id, localDateTimeToIso(date, time, settings.default_due_time), reason));
  }

  function cancel() {
    if (onCancel) { onCancel(); return; }
    setMode("idle");
    setError("");
  }

  const open = task.status !== "completed";
  const channelTypes = activityTypes.filter((o) => !NOT_A_CHANNEL.has(o.value));
  const presets = duePresets(settings);
  const retryHint = outcome === "no_answer" || outcome === "not_now";

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {mode === "idle" && (
        <div className="flex flex-wrap gap-1.5">
          {open && task.status === "todo" && (
            <button type="button" className={btn} disabled={busy}
              onClick={() => void run((t) => updateInteraction(t, task.id, { status: "inprogress" }))}>
              Start
            </button>
          )}
          {open && <button type="button" className={primary} onClick={() => setMode("complete")}>Complete</button>}
          {open && canReschedule && <button type="button" className={btn} onClick={() => setMode("reschedule")}>Reschedule</button>}
          {head && open && employees.length > 0 && <button type="button" className={btn} onClick={() => setMode("reassign")}>Reassign</button>}
          {head && <button type="button" className={`${btn} text-red-600`} onClick={() => setMode("delete")}>Delete</button>}
        </div>
      )}

      {mode === "complete" && (
        <div className="space-y-3 rounded-lg border border-[#E5E7EA] bg-white p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#3A3E4A]">Done via</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Done via">
              {channelTypes.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={doneVia === o.value}
                  onClick={() => setDoneVia(o.value)} className={chip(doneVia === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
            {doneVia === "other" && (
              <input aria-label="How did you contact them" className={`${input} mt-1.5 w-full`} placeholder="e.g. Site visit"
                value={doneViaLabel} onChange={(e) => setDoneViaLabel(e.target.value)} />
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#3A3E4A]">How did it go?</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Outcome">
              {OUTCOMES.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
                  onClick={() => setOutcome(o.value)} className={`flex-1 ${chip(outcome === o.value)}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <textarea aria-label="Completion note" rows={2} className={`${input} h-auto w-full resize-none py-1.5`}
            placeholder="What happened? (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-1.5">
            <button type="button" className={primary} disabled={busy} onClick={complete}>
              {busy ? "Saving…" : "Mark complete"}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "next" && !nextInitial && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 p-3">
          <span className="mr-1 text-xs font-semibold text-teal-800">
            Completed. Schedule next follow-up?
            {retryHint && ` Suggested: in ${settings.retry_followup_days} day${settings.retry_followup_days === 1 ? "" : "s"}.`}
          </span>
          <button type="button" className={primary} onClick={scheduleNext}>Schedule</button>
          <button type="button" className={btn} onClick={finishNext}>Skip</button>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-2 rounded-lg border border-[#E5E7EA] bg-white p-3">
          <div className="flex flex-wrap gap-1.5" aria-label="Quick picks">
            {presets.map((p) => (
              <button key={p.key} type="button" aria-pressed={date === p.date && time === p.time}
                className={chip(date === p.date && time === p.time)}
                onClick={() => { setDate(p.date); setTime(p.time); setError(""); }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input type="date" aria-label="New due date" className={input} min={localDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" aria-label="New due time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <input aria-label="Reason" className={`${input} w-full`} maxLength={255} placeholder="Reason (optional), e.g. client travelling"
            value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-1.5">
            <button type="button" className={primary} disabled={busy || !date} onClick={saveReschedule}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "reassign" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#E5E7EA] bg-white p-3">
          <select aria-label="New assignee" className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
          </select>
          <button type="button" className={primary} disabled={busy || !assignee || Number(assignee) === task.assigned_to}
            onClick={() => void run((t) => reassignLeadTask(t, leadId, task.id, Number(assignee)))}>
            Reassign
          </button>
          <button type="button" className={btn} disabled={busy} onClick={cancel}>Cancel</button>
        </div>
      )}

      {mode === "delete" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
          <span className="text-xs font-semibold text-red-700">Delete this follow-up?</span>
          <button type="button" className="h-8 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50" disabled={busy}
            onClick={() => void run((t) => deleteLeadInteraction(t, leadId, task.id))}>
            Yes, delete
          </button>
          <button type="button" className={btn} disabled={busy} onClick={cancel}>Cancel</button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {nextInitial && (
        <LeadFollowupModal
          leadId={leadId}
          leadName={leadName ?? `Lead #${leadId}`}
          initial={nextInitial}
          onSaved={finishNext}
          onCancel={finishNext}
        />
      )}
    </div>
  );
}
