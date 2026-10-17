"use client";

import { useState } from "react";
import ModalShell from "./ModalShell";
import { ApiError } from "@/lib/api/auth";
import { NOT_SCHEDULABLE, scheduleFollowup } from "@/lib/api/activities";
import { useActivityTypes } from "./useActivityTypes";
import { isoDate, isPastTimeToday } from "./activities";
import { ActivityTypeIcon } from "./ActivityIcons";
import { ACTIVITY_TILE, ACTIVITY_TILE_DEFAULT, BUTTON_PRIMARY, BUTTON_SECONDARY, COLOR, MODAL_FIELD_CLASS, MODAL_FIELD_LABEL, MODAL_INPUT, TYPE } from "./designTokens";

type Errors = { date?: string; time?: string; assignee?: string };

/** Set a future task for a staff member. Every active activity type except internal notes can be scheduled. */
export default function FollowupScheduleForm({ contactId, contactName, staff, defaultAssignee, onSaved, onCancel }: {
  contactId: number; contactName: string; staff: { id: number; name: string }[]; defaultAssignee: number | null;
  onSaved: () => Promise<void>; onCancel: () => void;
}) {
  const { types: activityTypes, loaded: typesLoaded, error: typesError } = useActivityTypes();
  const schedulable = activityTypes.filter((item) => !(NOT_SCHEDULABLE as readonly string[]).includes(item.value));
  const [title, setTitle] = useState("");
  const [type, setType] = useState("phone_call");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState(() => String(staff.find((member) => member.id === defaultAssignee)?.id ?? staff[0]?.id ?? ""));
  const [today] = useState(() => isoDate());
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    const found: Errors = {};
    if (!date) found.date = "Pick a due date.";
    else if (date < today) found.date = "The due date cannot be in the past.";
    else if (isPastTimeToday(date, time)) found.time = "That time has already passed today. Pick a later time.";
    if (!assignee) found.assignee = "Choose who this is assigned to.";
    setErrors(found);
    if (found.date || found.time || found.assignee) return;

    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in again to continue."); return; }
    setIsSaving(true); setError("");
    try {
      await scheduleFollowup(accessToken, contactId, {
        title: title.trim() || undefined, type, scheduled_date: date, assigned_to: Number(assignee),
        ...(time ? { scheduled_time: time } : {}), ...(note.trim() ? { notes: note.trim() } : {}),
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The follow-up could not be scheduled. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <ModalShell
      title="Schedule Followup"
      subtitle={`Set a reminder to follow up with ${contactName}`}
      onClose={onCancel}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      footer={
        <>
          <button type="button" disabled={isSaving} onClick={onCancel} style={BUTTON_SECONDARY} className="disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} style={BUTTON_PRIMARY} className="disabled:opacity-60">{isSaving ? "Saving…" : "Schedule Followup"}</button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>Task name (optional)
          <input type="text" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Send quotation" className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
        </label>

        <div>
          <p className="text-[13px] font-semibold text-[#3A3F46]">Activity type</p>
          {typesError && <p role="alert" className="text-xs font-semibold text-red-600">{typesError}</p>}
          {typesLoaded && !typesError && activityTypes.length === 0 && <p className="text-xs text-gray-500">No activity types are set up in Settings.</p>}
          <div role="radiogroup" aria-label="Activity type" className="mt-2 grid grid-cols-3 gap-2">
            {schedulable.map((option) => {
              const on = type === option.value;
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
                  <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: (ACTIVITY_TILE[option.value] ?? ACTIVITY_TILE_DEFAULT).bg, color: (ACTIVITY_TILE[option.value] ?? ACTIVITY_TILE_DEFAULT).fg }}>
                    <ActivityTypeIcon type={option.value} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>Due Date
              <input type="date" min={today} value={date} aria-invalid={Boolean(errors.date)}
                onChange={(event) => { setDate(event.target.value); setErrors((current) => ({ ...current, date: undefined })); }} className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
            </label>
            <label className="flex flex-col gap-1.5" style={MODAL_FIELD_LABEL}>Due Time
              <input type="time" value={time} aria-invalid={Boolean(errors.time)} onChange={(event) => { setTime(event.target.value); setErrors((current) => ({ ...current, time: undefined })); }} className={MODAL_FIELD_CLASS} style={MODAL_INPUT} />
            </label>
          </div>
          {errors.date && <p role="alert" className="text-xs font-semibold text-red-600">{errors.date}</p>}
          {errors.time && <p role="alert" className="text-xs font-semibold text-red-600">{errors.time}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label style={MODAL_FIELD_LABEL} htmlFor="sf-assigned">Assigned To</label>
          <select id="sf-assigned" value={assignee} onChange={(event) => { setAssignee(event.target.value); setErrors((current) => ({ ...current, assignee: undefined })); }} className={MODAL_FIELD_CLASS} style={MODAL_INPUT}>
            {staff.map((member) => <option key={member.id} value={String(member.id)}>{member.name}</option>)}
          </select>
          {errors.assignee && <p role="alert" className="text-xs font-semibold text-red-600">{errors.assignee}</p>}
        </div>

        <label className="crm-field-label">Notes (optional)
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="crm-textarea"
            placeholder="Any context for the follow-up…" />
        </label>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </ModalShell>
  );
}
