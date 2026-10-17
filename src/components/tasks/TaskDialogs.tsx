"use client";

import { useState } from "react";
import ModalShell from "@/components/followups/ModalShell";
import { isoDate, isPastTimeToday, typeLabel } from "@/components/followups/activities";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, MODAL_FIELD_CLASS, MODAL_FIELD_LABEL, MODAL_INPUT } from "@/components/followups/designTokens";
import type { TaskItem } from "@/lib/api/tasks";
import { fromISO } from "./calendar";
import { timeText } from "./TaskCard";

const failure = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message ? caught.message : fallback);

/** A task's own values, shown at the top of the dialogs so the person knows which follow-up they are changing. */
function TaskSummary({ task }: { task: TaskItem }) {
  const due = task.scheduled_date ? fromISO(task.scheduled_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "No date";
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[#F7F8F9] p-3.5 text-sm">
      <dt className="text-[#6B7080]">Task</dt><dd className="font-semibold text-[#1A1C21]">{task.title || task.notes?.split("\n")[0] || typeLabel(task.type)}</dd>
      <dt className="text-[#6B7080]">Lead</dt><dd className="text-[#1A1C21]">{task.contact_name}</dd>
      <dt className="text-[#6B7080]">Type</dt><dd className="text-[#1A1C21]">{typeLabel(task.type)}</dd>
      <dt className="text-[#6B7080]">Assigned to</dt><dd className="text-[#1A1C21]">{task.assigned_to_name ?? "Unassigned"}</dd>
      <dt className="text-[#6B7080]">Due</dt><dd className="text-[#1A1C21]">{due} · {timeText(task)}</dd>
    </dl>
  );
}

/** Step 1 of Mark done: log what happened. The note is saved as the activity, then the task is completed. */
export function CompleteTaskDialog({ task, onSave, onCancel }: { task: TaskItem; onSave: (notes: string) => Promise<void>; onCancel: () => void }) {
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!notes.trim()) { setNotesError("Write what happened before marking this done."); return; }
    setSaving(true); setError("");
    try { await onSave(notes.trim()); }
    catch (caught) { setError(failure(caught, "Could not save. Please try again.")); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell
      title="Log Activity"
      subtitle={`Record what happened with ${task.contact_name} before marking this done`}
      onClose={onCancel}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      footer={
        <>
          <button type="button" disabled={saving} onClick={onCancel} style={BUTTON_SECONDARY} className="disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving} style={BUTTON_PRIMARY} className="disabled:opacity-60">{saving ? "Saving…" : "Save & mark done"}</button>
        </>
      }
    >
      <div className="space-y-4 px-6 py-5">
        <TaskSummary task={task} />
        <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>What happened?
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesError(""); }} rows={4} aria-invalid={Boolean(notesError)}
            placeholder="e.g. Called, customer will confirm the quote on Friday" style={{ ...MODAL_INPUT, height: "auto", minHeight: 96, padding: "10px 12px", resize: "vertical" }} />
        </label>
        {notesError && <p role="alert" className="-mt-2 text-xs font-semibold text-red-600">{notesError}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </ModalShell>
  );
}

/** Step 2 of Mark done: ask whether another follow-up is needed. */
export function NextFollowupDialog({ task, onSchedule, onDone }: { task: TaskItem; onSchedule: () => void; onDone: () => void }) {
  return (
    <ModalShell
      title="Schedule a follow-up?"
      subtitle={`The task is done. Does ${task.contact_name} need another follow-up?`}
      onClose={onDone}
      onSubmit={(event) => { event.preventDefault(); onSchedule(); }}
      footer={
        <>
          <button type="button" onClick={onDone} style={BUTTON_SECONDARY}>No, that&apos;s all</button>
          <button type="submit" style={BUTTON_PRIMARY}>Yes, schedule</button>
        </>
      }
    >
      <div className="px-6 py-5">
        <p className="text-sm text-[#4B5060]">The activity is logged. You can set the next follow-up now or leave it here.</p>
      </div>
    </ModalShell>
  );
}

/** Reschedule a task: its values are shown, and only the due date and time change. */
export function RescheduleTaskDialog({ task, onSave, onCancel }: { task: TaskItem; onSave: (date: string, time: string) => Promise<void>; onCancel: () => void }) {
  const [today] = useState(() => isoDate());
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date) { setDateError("Pick the new due date."); return; }
    if (date < today) { setDateError("The due date cannot be in the past."); return; }
    if (isPastTimeToday(date, time)) { setTimeError("That time has already passed today. Pick a later time."); return; }
    setSaving(true); setError("");
    try { await onSave(date, time); }
    catch (caught) { setError(failure(caught, "Could not reschedule. Please try again.")); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell
      title="Reschedule Follow-up"
      subtitle={`Move the follow-up for ${task.contact_name} to a new date`}
      onClose={onCancel}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      footer={
        <>
          <button type="button" disabled={saving} onClick={onCancel} style={BUTTON_SECONDARY} className="disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving} style={BUTTON_PRIMARY} className="disabled:opacity-60">{saving ? "Saving…" : "Save new date"}</button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <TaskSummary task={task} />
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>New due date
              <input type="date" min={today} value={date} aria-invalid={Boolean(dateError)}
                onChange={(event) => { setDate(event.target.value); setDateError(""); }} className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
            </label>
            <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>New time (optional)
              <input type="time" value={time} aria-invalid={Boolean(timeError)} onChange={(event) => { setTime(event.target.value); setTimeError(""); }} className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
            </label>
          </div>
          {dateError && <p role="alert" className="text-xs font-semibold text-red-600">{dateError}</p>}
          {timeError && <p role="alert" className="text-xs font-semibold text-red-600">{timeError}</p>}
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </ModalShell>
  );
}
