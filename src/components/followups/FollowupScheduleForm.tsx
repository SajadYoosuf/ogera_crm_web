"use client";

import { useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import { scheduleFollowup } from "@/lib/api/activities";
import { DatePickerField, TimePickerField } from "@/components/SchedulePickers";
import { DATE_CHIPS, SCHEDULABLE_TYPES, isoDate } from "./activities";

type Errors = { date?: string; assignee?: string };

/** Set a future task for a staff member. An internal note cannot be scheduled, so it is not offered. */
export default function FollowupScheduleForm({ contactId, staff, defaultAssignee, onSaved, onCancel }: {
  contactId: number; staff: { id: number; name: string }[]; defaultAssignee: number | null; onSaved: () => Promise<void>; onCancel: () => void;
}) {
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
    if (!assignee) found.assignee = "Choose who this is assigned to.";
    setErrors(found);
    if (found.date || found.assignee) return;

    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in again to continue."); return; }
    setIsSaving(true); setError("");
    try {
      await scheduleFollowup(accessToken, contactId, {
        type, scheduled_date: date, assigned_to: Number(assignee),
        ...(time ? { scheduled_time: time } : {}), ...(note.trim() ? { notes: note.trim() } : {}),
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The follow-up could not be scheduled. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-3 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm" aria-label="Schedule follow-up">
      <div className="flex items-center gap-2 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17M12 14v3l2 1" /></svg>
        Plan the next follow-up
      </div>
      <div className="space-y-5 p-4">
        <section className="space-y-2">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700">What</h4>
          <FilterSelect label="Type" value={type} onChange={setType} className="w-full" options={SCHEDULABLE_TYPES} icon={<path d="M4 6h16M4 12h16M4 18h10" />} />
          <label className="crm-field-label">Note (optional)
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="crm-textarea"
              placeholder="Context for this follow-up e.g. confirm final price, ask about 200L" />
          </label>
        </section>

        <section className="space-y-2">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700">When</h4>
          <div className="flex flex-wrap gap-1.5">
            {DATE_CHIPS.map((chip) => {
              const value = isoDate(chip.days);
              return (
                <button key={chip.label} type="button" onClick={() => { setDate(value); setErrors((current) => ({ ...current, date: undefined })); }}
                  className={`min-h-9 rounded-full px-3 text-xs font-semibold transition-colors ${date === value ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{chip.label}</button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="crm-field-label"><span>Due date</span>
              <DatePickerField label="Due date" value={date} min={today} invalid={Boolean(errors.date)} onChange={(value) => { setDate(value); setErrors((current) => ({ ...current, date: undefined })); }} />
            </div>
            <div className="crm-field-label"><span>Due time (optional)</span>
              <TimePickerField label="Due time" value={time} onChange={setTime} />
            </div>
          </div>
          {errors.date && <p role="alert" className="text-xs font-semibold text-red-600">{errors.date}</p>}
        </section>

        <section className="space-y-2">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700">Who</h4>
          <FilterSelect label="Assign to" value={assignee} onChange={(value) => { setAssignee(value); setErrors((current) => ({ ...current, assignee: undefined })); }} className="w-full"
            options={staff.map((member) => ({ value: String(member.id), label: member.name }))}
            icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} />
          {errors.assignee && <p role="alert" className="text-xs font-semibold text-red-600">{errors.assignee}</p>}
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{isSaving ? "Saving…" : "Schedule"}</button>
          <button type="button" disabled={isSaving} onClick={onCancel} className="min-h-11 px-3 text-sm font-semibold text-violet-700 underline-offset-2 hover:underline">Cancel</button>
        </div>
      </div>
    </form>
  );
}
