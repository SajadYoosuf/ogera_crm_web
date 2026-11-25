"use client";

/**
 * FollowupsSettingsTab (admin and manager) — Settings → Follow-ups.
 *
 *   Times           default due time and the Morning / Afternoon / Evening preset times
 *   Reminders       on/off, only on the due day or every day until done (max days), the hour the
 *                   daily reminder goes out, the "due now" alert and the overdue alert threshold
 *   Retry           days before a retry follow-up after No answer / Not now; auto follow-up window
 *   Staff           whether staff may reschedule and create follow-ups
 *   Task statuses   rename and recolour To do / In progress / Completed (values never change)
 *   Activity types  rename, hide and add the types used by activities and follow-ups
 *
 * Renaming statuses and editing activity types use the dropdown-option API, which needs
 * "lead_statuses" update permission; without it those two panels are read-only.
 *
 * Saving sends only the changed fields (PATCH /settings/followups); the button stays disabled
 * until something changes. Status and activity type names save on their own, row by row.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createEnum, listEnum, updateEnum, type EnumValue } from "@/lib/api/settings";
import { invalidateEnumOptions } from "@/hooks/useEnumOptions";
import { ErrorBlock, Panel, Spinner, Toast, accentButton, errorText, secondaryButton } from "@/components/settings/ui";
import { COLOR_BADGE } from "@/features/leads/components/FollowupCard";
import {
  STATUS_COLORS,
  getFollowupSettings,
  updateFollowupSettings,
  type FollowupSettings,
  type FollowupSettingsPatch,
  type StatusColor,
  type TaskStatusValue,
} from "../api/followupSettings";
import { setFollowupSettingsCache } from "../hooks/useFollowupSettings";
import { canDo } from "@/lib/shared/roles";

type Notice = { text: string; tone: "ok" | "error" } | null;
type Form = Omit<FollowupSettings, "updated_by" | "updated_at" | "stored">;

const FORM_KEYS: (keyof Form)[] = [
  "default_due_time", "morning_time", "afternoon_time", "evening_time",
  "reminders_enabled", "reminder_mode", "reminder_max_days", "due_today_reminder_hour",
  "due_now_reminder_enabled", "due_now_window_minutes", "overdue_reminder_after_hours",
  "retry_followup_days", "auto_followup_hours",
  "allow_staff_reschedule", "allow_staff_create_followup", "status_colors",
];

const STATUS_VALUES: TaskStatusValue[] = ["todo", "inprogress", "completed"];
const STATUS_DEFAULT_LABEL: Record<TaskStatusValue, string> = { todo: "To do", inprogress: "In progress", completed: "Completed" };

const field = "h-10 w-full rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-sm text-[#1A1C21] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-[#F7F7F9]";
const labelCls = "mb-1 block text-xs font-semibold text-[#4B5060]";
const hintCls = "mt-1 text-xs text-[#9AA0AC]";

function toForm(s: FollowupSettings): Form {
  return Object.fromEntries(FORM_KEYS.map((k) => [k, s[k]])) as Form;
}

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  return `${((h + 11) % 12) + 1}:00 ${suffix}`;
}

export default function FollowupsSettingsTab() {
  const { token } = useAuth();
  const [saved, setSaved] = useState<FollowupSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view follow-up settings."); return; }
    setLoadError("");
    try {
      const value = await getFollowupSettings(token);
      setSaved(value);
      setForm(toForm(value));
    } catch (caught) {
      setLoadError(errorText(caught, "Follow-up settings could not be loaded."));
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changes = useMemo<FollowupSettingsPatch>(() => {
    if (!saved || !form) return {};
    const out: Record<string, unknown> = {};
    for (const k of FORM_KEYS) {
      if (JSON.stringify(form[k]) !== JSON.stringify(saved[k])) out[k] = form[k];
    }
    return out as FollowupSettingsPatch;
  }, [saved, form]);
  const dirty = Object.keys(changes).length > 0;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setNotice(null);
  }

  async function save() {
    if (!token || !dirty) return;
    setBusy(true); setNotice(null);
    try {
      const value = await updateFollowupSettings(token, changes);
      setSaved(value);
      setForm(toForm(value));
      setFollowupSettingsCache(token, value);
      setNotice({ text: "Follow-up settings saved.", tone: "ok" });
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!form || !saved) return <Spinner />;

  const num = (key: keyof Form, min: number, max: number) => ({
    type: "number" as const,
    min, max,
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      if (e.target.value === "" || Number.isNaN(n)) return;
      set(key, Math.min(max, Math.max(min, Math.round(n))) as Form[typeof key]);
    },
    className: field,
  });

  return (
    <div className="space-y-5 pb-24">
      {!saved.stored && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          These are the built-in defaults. Saving needs the follow-up settings table, which your administrator sets up once.
        </p>
      )}

      <Panel title="Times" subtitle="Used by the quick picks when scheduling or rescheduling a follow-up">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ["default_due_time", "Default time", "When no time is chosen"],
            ["morning_time", "Morning", "Tomorrow morning, Next Monday"],
            ["afternoon_time", "Afternoon", "Afternoon pick"],
            ["evening_time", "Evening", "Today evening"],
          ] as const).map(([key, label, hint]) => (
            <label key={key}>
              <span className={labelCls}>{label}</span>
              <input type="time" required value={form[key]} onChange={(e) => e.target.value && set(key, e.target.value)} className={field} />
              <span className={hintCls}>{hint}</span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Reminders" subtitle="In-app notifications to the person a follow-up is assigned to">
        <Toggle label="Send follow-up reminders" checked={form.reminders_enabled} onChange={(v) => set("reminders_enabled", v)} />
        <fieldset disabled={!form.reminders_enabled} className="space-y-4 disabled:opacity-60">
          <div role="radiogroup" aria-label="Reminder frequency" className="grid gap-2 sm:grid-cols-2">
            {([
              ["due_day_only", "Only on the due day", "One reminder on the day it is due."],
              ["daily_until_done", "Every day until done", "A daily summary of due and overdue follow-ups."],
            ] as const).map(([value, title, text]) => {
              const on = form.reminder_mode === value;
              return (
                <button key={value} type="button" role="radio" aria-checked={on} onClick={() => set("reminder_mode", value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${on ? "border-[#0E4D3A] bg-[#F0F9F4]" : "border-[#E1E1E6] hover:bg-[#F7F7F9]"}`}>
                  <span className="block text-sm font-semibold text-[#1A1C21]">{title}</span>
                  <span className="mt-0.5 block text-xs text-[#6B7080]">{text}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className={labelCls}>Daily reminder at</span>
              <select value={form.due_today_reminder_hour} onChange={(e) => set("due_today_reminder_hour", Number(e.target.value))} className={field}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <span className={hintCls}>India time</span>
            </label>
            {form.reminder_mode === "daily_until_done" && (
              <label>
                <span className={labelCls}>Keep reminding for (days after due)</span>
                <input aria-label="Maximum reminder days" {...num("reminder_max_days", 0, 90)} />
                <span className={hintCls}>0 = until it is done</span>
              </label>
            )}
            <label>
              <span className={labelCls}>Overdue alert after (hours)</span>
              <input aria-label="Overdue alert after hours" {...num("overdue_reminder_after_hours", 1, 720)} />
              <span className={hintCls}>Sent once per lead</span>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Toggle label="“Due now” alert at the due time" checked={form.due_now_reminder_enabled} onChange={(v) => set("due_now_reminder_enabled", v)} />
            {form.due_now_reminder_enabled && (
              <label className="w-40">
                <span className={labelCls}>Window (minutes)</span>
                <input aria-label="Due now window minutes" {...num("due_now_window_minutes", 5, 120)} />
              </label>
            )}
          </div>
        </fieldset>
      </Panel>

      <Panel title="Retry and auto follow-up">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Retry after No answer / Not now (days)</span>
            <input aria-label="Retry follow-up days" {...num("retry_followup_days", 1, 60)} />
            <span className={hintCls}>Suggested date for the next follow-up</span>
          </label>
          <label>
            <span className={labelCls}>Auto follow-up window (hours)</span>
            <input aria-label="Auto follow-up hours" {...num("auto_followup_hours", 1, 720)} />
          </label>
        </div>
      </Panel>

      <Panel title="Staff permissions" subtitle="Admins and managers can always do both">
        <div className="space-y-3">
          <Toggle label="Staff can reschedule their follow-ups" checked={form.allow_staff_reschedule} onChange={(v) => set("allow_staff_reschedule", v)} />
          <Toggle label="Staff can create follow-ups (for themselves)" checked={form.allow_staff_create_followup} onChange={(v) => set("allow_staff_create_followup", v)} />
        </div>
      </Panel>

      <TaskStatusesPanel colors={form.status_colors} onColor={(status, color) => set("status_colors", { ...form.status_colors, [status]: color })} />

      <ActivityTypesPanel />

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#E5E7EA] bg-white/95 px-3 py-3 shadow-[0_-4px_16px_rgba(16,24,40,0.06)] backdrop-blur sm:px-4">
        {notice && <div className="w-full sm:mr-auto sm:w-auto"><Toast message={notice.text} tone={notice.tone} /></div>}
        {dirty && (
          <button type="button" className={`${secondaryButton} flex-1 sm:flex-none`} disabled={busy} onClick={() => { setForm(toForm(saved)); setNotice(null); }}>
            Discard
          </button>
        )}
        <button type="button" className={`${accentButton} flex-1 sm:flex-none`} disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0 transition-colors ${checked ? "bg-[#0E4D3A]" : "bg-[#D5D8DE]"}`}>
        <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
      <span className="text-sm text-[#1A1C21]">{label}</span>
    </label>
  );
}

/** Enum rows of one category, with a reload. Empty when the category has not been seeded yet. */
function useEnumRows(category: "task_status" | "activity_type") {
  const { token } = useAuth();
  const [rows, setRows] = useState<EnumValue[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try { setRows(await listEnum(token, category)); }
    catch (caught) { setError(errorText(caught, "Could not load the list.")); setRows([]); }
  }, [token, category]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return { rows, error, reload: load };
}

function RenameRow({ row, category, onSaved }: { row: EnumValue; category: "task_status" | "activity_type"; onSaved: () => void }) {
  const { token } = useAuth();
  const [label, setLabel] = useState(row.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = label.trim() !== row.label && label.trim().length > 0;

  async function save(patch: { label?: string; is_active?: boolean }) {
    if (!token) return;
    setBusy(true); setError("");
    try {
      await updateEnum(token, category, row.id, patch);
      invalidateEnumOptions(category);
      onSaved();
    } catch (caught) {
      setError(errorText(caught, "Could not save."));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label={`Name for ${row.value}`} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} className={`${field} h-9 flex-1 min-w-40`} />
      <button type="button" className={`${secondaryButton} h-9`} disabled={!changed || busy} onClick={() => void save({ label: label.trim() })}>
        {busy ? "Saving…" : "Rename"}
      </button>
      {category === "activity_type" && !row.locked && (
        <button type="button" className={`${secondaryButton} h-9 text-rose-600`} disabled={busy} onClick={() => void save({ is_active: false })}>Hide</button>
      )}
      {error && <p role="alert" className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/** Editing dropdown options (statuses, activity types) needs the same permission as Settings → enums. */
function useCanEditOptions() {
  const { user } = useAuth();
  return canDo(user, "lead_statuses", "u");
}

function TaskStatusesPanel({ colors, onColor }: { colors: Record<TaskStatusValue, StatusColor>; onColor: (s: TaskStatusValue, c: StatusColor) => void }) {
  const { rows, error, reload } = useEnumRows("task_status");
  const canEdit = useCanEditOptions();
  return (
    <Panel title="Task statuses" subtitle="Rename and recolour. The three statuses themselves are fixed.">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {rows === null ? <Spinner /> : (
        <ul className="space-y-3">
          {STATUS_VALUES.map((status) => {
            const row = rows.find((r) => r.value === status);
            return (
              <li key={status} className="space-y-2 rounded-xl border border-[#EFEFF2] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_BADGE[colors[status]]}`}>{row?.label ?? STATUS_DEFAULT_LABEL[status]}</span>
                  <code className="text-[11px] text-[#9AA0AC]">{status}</code>
                </div>
                {!canEdit ? null : row ? <RenameRow row={row} category="task_status" onSaved={() => void reload()} /> : (
                  <p className={hintCls}>Renaming is available once your administrator has set up task statuses.</p>
                )}
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Colour for ${row?.label ?? STATUS_DEFAULT_LABEL[status]}`}>
                  {STATUS_COLORS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={colors[status] === c} aria-label={c}
                      onClick={() => onColor(status, c)}
                      className={`h-7 rounded-full px-2.5 text-[11px] font-semibold capitalize ${COLOR_BADGE[c]} ${colors[status] === c ? "ring-2 ring-[#0E4D3A] ring-offset-1" : ""}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={hintCls}>
        {canEdit ? "Colour changes save with “Save changes” below; names save on their own." : "Colour changes save with “Save changes” below. Renaming needs permission to edit lead statuses."}
      </p>
    </Panel>
  );
}

function ActivityTypesPanel() {
  const { token } = useAuth();
  const { rows, error, reload } = useEnumRows("activity_type");
  const canEdit = useCanEditOptions();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState("");

  async function add() {
    if (!token || !name.trim()) return;
    setBusy(true); setAddError("");
    try {
      await createEnum(token, "activity_type", name.trim());
      invalidateEnumOptions("activity_type");
      setName("");
      await reload();
    } catch (caught) {
      setAddError(errorText(caught, "Could not add the activity type."));
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Activity types" subtitle="Used for activities, follow-ups and “Done via”. Locked types can be renamed but not hidden.">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {rows === null ? <Spinner /> : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              {canEdit ? <RenameRow row={row} category="activity_type" onSaved={() => void reload()} /> : <span className="text-sm text-[#1A1C21]">{row.label}</span>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input aria-label="New activity type" placeholder="New activity type" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={`${field} h-9 flex-1 min-w-40`} />
        <button type="submit" className={`${accentButton} h-9`} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add"}</button>
        {addError && <p role="alert" className="w-full text-xs text-rose-600">{addError}</p>}
      </form>}
    </Panel>
  );
}
