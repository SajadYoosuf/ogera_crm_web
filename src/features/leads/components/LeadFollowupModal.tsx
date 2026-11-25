"use client";

/**
 * LeadFollowupModal — schedule a future task on a lead.
 *
 * Fields: Type (tile selector), custom_label (when type='other'), Title (auto-fills from type),
 * Priority (high/medium/low), Due Date, Due Time (optional), Assigned To, Notes (optional).
 *
 * Quick presets (In 1 hour, Tomorrow morning, Next Monday…) fill the date and time from the
 * times set in Settings → Follow-ups; a date without a time uses the default due time from there.
 * `initial` pre-fills the form (used by "Schedule next follow-up?" after completing one).
 *
 * Staff list is fetched internally. Non-head users only see themselves, so the "Assigned To"
 * dropdown is shown only to head roles (it is hidden for everyone else).
 * Uses POST /leads/{id}/interactions/task.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { ACTIVITY_TYPE_FALLBACK, localDateTimeToIso, scheduleLeadTask } from "@/lib/api/interactions";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import { listAllEmployees } from "@/lib/api/employees";
import { isLeadHead } from "@/lib/shared/roles";
import { useFollowupSettings } from "@/features/settings/hooks/useFollowupSettings";
import { duePresets, isPast, localDate } from "@/features/leads/followupPresets";
import Spinner from "@/components/Spinner";

const FALLBACK_TYPES = staticOptions(ACTIVITY_TYPE_FALLBACK);

type StaffMember = { id: number; name: string };

export type FollowupInitial = {
  activityType?: string;
  customLabel?: string;
  date?: string;
  time?: string;
  notes?: string;
};

type Props = {
  leadId: number;
  leadName: string;
  initial?: FollowupInitial;
  onSaved: () => void;
  onCancel: () => void;
};

export default function LeadFollowupModal({ leadId, leadName, initial, onSaved, onCancel }: Props) {
  const { token, user } = useAuth();
  const { options: activityTypes } = useEnumOptions("activity_type", FALLBACK_TYPES);
  const { settings } = useFollowupSettings();
  const typesLoaded = true;

  // Staff list — admins/managers see everyone; others only see themselves.
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    // Staff schedule follow-ups for themselves only (the backend refuses anyone else).
    const isElevated = isLeadHead(user);
    if (!isElevated) {
      setStaff([{ id: user.id, name: user.name }]);
      setStaffLoaded(true);
      return;
    }
    let cancelled = false;
    listAllEmployees(token)
      .then(({ employees }) => {
        if (cancelled) return;
        setStaff(employees.map((e) => ({ id: e.id, name: e.name })));
      })
      .catch(() => {
        if (!cancelled) setStaff(user ? [{ id: user.id, name: user.name }] : []);
      })
      .finally(() => { if (!cancelled) setStaffLoaded(true); });
    return () => { cancelled = true; };
  }, [token, user]);

  // Form state
  const initialType = initial?.activityType ?? "phone_call";
  const [activityType, setActivityType] = useState(initialType);
  const [customLabel, setCustomLabel] = useState(initial?.customLabel ?? "");
  const [title, setTitle] = useState(() =>
    initialType === "other" && initial?.customLabel
      ? initial.customLabel
      : FALLBACK_TYPES.find((t) => t.value === initialType)?.label ?? initialType.replace(/_/g, " "));
  const [titleEdited, setTitleEdited] = useState(false);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Local date (toISOString would give the UTC date, a day behind before 05:30 IST).
  const today = localDate(new Date());
  const presets = duePresets(settings);

  // Default assignee to current user once staff loads
  useEffect(() => {
    if (staffLoaded && staff.length > 0 && !assigneeId) {
      const self = user ? staff.find((s) => s.id === user.id) : null;
      setAssigneeId(String(self?.id ?? staff[0].id));
    }
  }, [staffLoaded, staff, user, assigneeId]);

  function pickType(value: string) {
    setActivityType(value);
    if (!titleEdited) {
      const label = activityTypes.find((t) => t.value === value)?.label ?? value;
      setTitle(label);
    }
  }

  async function save() {
    // Validate
    if (!date) { setError("Choose a due date."); return; }
    if (date < today || isPast({ date, time }, new Date(), settings.default_due_time)) {
      setError("The due time is in the past. Choose a later time.");
      return;
    }
    if (activityType === "other" && !customLabel.trim()) {
      setError("Please name this custom activity type.");
      return;
    }
    if (!assigneeId) { setError("Choose who this task is assigned to."); return; }
    if (!token) { setError("Sign in again to continue."); return; }

    // Local date + optional time (default from Settings) as a UTC ISO string. Sending the
    // naive "YYYY-MM-DDTHH:MM" would be read as UTC by the server — 5h30 late in IST.
    const dueAt = localDateTimeToIso(date, time, settings.default_due_time);

    setIsSaving(true);
    setError("");
    try {
      await scheduleLeadTask(token, leadId, {
        activity_type: activityType,
        ...(activityType === "other" ? { custom_label: customLabel.trim() } : {}),
        title: title.trim() || undefined,
        priority,
        due_at: dueAt,
        assigned_to: Number(assigneeId),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="followup-title"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="followup-title" className="text-base font-semibold text-gray-900">Schedule Follow-up</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Set a reminder for <span className="font-medium">{leadName}</span>
        </p>

        <div className="mt-4 space-y-4">
          {/* Activity type tiles */}
          <div>
            <span className="mb-2 block text-xs font-medium text-gray-600">Activity type</span>
            {!typesLoaded ? (
              <div className="flex items-center gap-1.5 py-1"><Spinner size="xs" /><span className="text-xs text-gray-400">Loading types…</span></div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {activityTypes.map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => pickType(opt.value)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      activityType === opt.value
                        ? "border-teal-600 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom label for "other" */}
          {activityType === "other" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                What type? <span className="text-red-500">*</span>
              </label>
              <input type="text" placeholder="e.g. Site visit, Demo"
                value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
                className={inputCls} />
            </div>
          )}

          {/* Title — auto-fills from type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Task title</label>
            <input type="text" placeholder="Short description (optional)"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
              className={inputCls} />
          </div>

          {/* Priority */}
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Priority</span>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as const).map((p) => {
                const styles = {
                  high: "border-red-400 bg-red-50 text-red-700",
                  medium: "border-amber-400 bg-amber-50 text-amber-700",
                  low: "border-green-500 bg-green-50 text-green-700",
                };
                const on = priority === p;
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                      on ? styles[p] : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <span className="mb-2 block text-xs font-medium text-gray-600">Quick pick</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const on = date === p.date && time === p.time;
                return (
                  <button key={p.key} type="button" aria-pressed={on}
                    onClick={() => { setDate(p.date); setTime(p.time); }}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? "border-teal-600 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input type="date" min={today} value={date}
                onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Due Time</label>
              <input type="time" value={time} placeholder={settings.default_due_time}
                title={`Leave empty for ${settings.default_due_time}`}
                onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Assigned To — only head roles can pick another staff member; everyone else is assigned to themselves. */}
          {isLeadHead(user) && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Assigned To</label>
              {!staffLoaded ? (
                <div className="flex items-center gap-1.5 py-1"><Spinner size="xs" /><span className="text-xs text-gray-400">Loading staff…</span></div>
              ) : (
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
                  {staff.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea rows={2} placeholder="Any context for this task…"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} resize-none`} />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={() => void save()} disabled={isSaving}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {isSaving ? "Saving…" : "Schedule Follow-up"}
          </button>
          <button onClick={onCancel} disabled={isSaving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";
