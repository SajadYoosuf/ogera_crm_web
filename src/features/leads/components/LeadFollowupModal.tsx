"use client";

/**
 * LeadFollowupModal — schedule a future task on a lead.
 *
 * Fields: Type (tile selector), custom_label (when type='other'), Title (auto-fills from type),
 * Priority (high/medium/low), Due Date, Due Time (optional), Assigned To, Notes (optional).
 *
 * Staff list is fetched internally. Non-admin/manager users only see themselves.
 * Uses POST /leads/{id}/interactions/task.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { scheduleLeadTask } from "@/lib/api/interactions";
import { useEnumOptions } from "@/hooks/useEnumOptions";
import { listAllEmployees } from "@/lib/api/employees";

type StaffMember = { id: number; name: string };

type Props = {
  leadId: number;
  leadName: string;
  onSaved: () => void;
  onCancel: () => void;
};

/** Today's date in YYYY-MM-DD format, computed once per render. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LeadFollowupModal({ leadId, leadName, onSaved, onCancel }: Props) {
  const { token, user } = useAuth();
  const { options: activityTypes, isLoaded: typesLoaded } = useEnumOptions("activity_type");

  // Staff list — admins/managers see everyone; others only see themselves.
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    const isElevated = user.role === "admin" || user.role === "manager";
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
  const [activityType, setActivityType] = useState("phone_call");
  const [customLabel, setCustomLabel] = useState("");
  const [title, setTitle] = useState("Phone Call");
  const [titleEdited, setTitleEdited] = useState(false);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const today = todayIso();

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
    if (date < today) { setError("Due date cannot be in the past."); return; }
    if (activityType === "other" && !customLabel.trim()) {
      setError("Please name this custom activity type.");
      return;
    }
    if (!assigneeId) { setError("Choose who this task is assigned to."); return; }
    if (!token) { setError("Sign in again to continue."); return; }

    // Combine date + optional time into an ISO 8601 datetime string.
    // If no time is chosen, default to 09:00 so the backend has a full datetime.
    const dueAt = `${date}T${time || "09:00"}:00`;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
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
              <p className="text-xs text-gray-400">Loading…</p>
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
              <input type="time" value={time}
                onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Assigned To</label>
            {!staffLoaded ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
                {staff.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

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
