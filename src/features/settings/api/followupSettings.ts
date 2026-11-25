/**
 * Follow-up settings — GET / PATCH /settings/followups.
 *
 * Any signed-in user may read them (forms need the preset times and the staff flags).
 * Only admin and manager may save; the backend answers 403 otherwise, and 503 while the
 * settings table has not been created on the database yet.
 */

import { apiCall } from "@/lib/api/auth";

export type ReminderMode = "due_day_only" | "daily_until_done";
export type TaskStatusValue = "todo" | "inprogress" | "completed";
export type StatusColor = "gray" | "blue" | "teal" | "green" | "amber" | "red" | "purple";

export const STATUS_COLORS: StatusColor[] = ["gray", "blue", "teal", "green", "amber", "red", "purple"];

export type FollowupSettings = {
  /** "HH:MM" (IST wall-clock, the browser's local time for staff in India). */
  default_due_time: string;
  morning_time: string;
  afternoon_time: string;
  evening_time: string;
  reminders_enabled: boolean;
  reminder_mode: ReminderMode;
  /** Days of daily reminders after the due day; 0 = until done. */
  reminder_max_days: number;
  /** IST hour (0–23) when the daily reminder goes out. */
  due_today_reminder_hour: number;
  due_now_reminder_enabled: boolean;
  due_now_window_minutes: number;
  overdue_reminder_after_hours: number;
  retry_followup_days: number;
  auto_followup_hours: number;
  allow_staff_reschedule: boolean;
  allow_staff_create_followup: boolean;
  status_colors: Record<TaskStatusValue, StatusColor>;
  updated_by: number | null;
  updated_at: string | null;
  /** False while the values are built-in defaults (the settings table is not set up yet). */
  stored: boolean;
};

export type FollowupSettingsPatch = Partial<Omit<FollowupSettings, "updated_by" | "updated_at" | "stored">>;

/** The backend's defaults, used until GET /settings/followups answers or if it fails. */
export const DEFAULT_FOLLOWUP_SETTINGS: FollowupSettings = {
  default_due_time: "09:00",
  morning_time: "10:00",
  afternoon_time: "14:00",
  evening_time: "17:00",
  reminders_enabled: true,
  reminder_mode: "due_day_only",
  reminder_max_days: 7,
  due_today_reminder_hour: 9,
  due_now_reminder_enabled: true,
  due_now_window_minutes: 10,
  overdue_reminder_after_hours: 24,
  retry_followup_days: 3,
  auto_followup_hours: 48,
  allow_staff_reschedule: true,
  allow_staff_create_followup: true,
  status_colors: { todo: "gray", inprogress: "blue", completed: "teal" },
  updated_by: null,
  updated_at: null,
  stored: false,
};

export const getFollowupSettings = (token: string) => apiCall<FollowupSettings>(token, "GET", "/settings/followups");

export const updateFollowupSettings = (token: string, patch: FollowupSettingsPatch) =>
  apiCall<FollowupSettings>(token, "PATCH", "/settings/followups", patch);
