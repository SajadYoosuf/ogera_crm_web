/**
 * Quick due-time presets for scheduling and rescheduling follow-ups.
 *
 * Times of day come from Settings → Follow-ups (morning, evening, default time). Dates and times
 * are local ("YYYY-MM-DD", "HH:MM"), the form the date/time inputs use; convert with
 * localDateTimeToIso before sending.
 */

import type { FollowupSettings } from "@/features/settings/api/followupSettings";

export type DueChoice = { date: string; time: string };
export type DuePreset = DueChoice & { key: string; label: string };

const pad = (n: number) => String(n).padStart(2, "0");

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** True when the local date and time are before `now` (a minute of grace for "In 1 hour"-style picks). */
export function isPast(choice: DueChoice, now = new Date(), defaultTime = "09:00"): boolean {
  const at = new Date(`${choice.date}T${choice.time || defaultTime}:00`);
  return at.getTime() < now.getTime() - 60_000;
}

/** In 1 hour, Today evening (if still ahead), Tomorrow morning, Next Monday, In 3 days, In 1 week. */
export function duePresets(settings: Pick<FollowupSettings, "morning_time" | "evening_time" | "default_due_time">, now = new Date()): DuePreset[] {
  const inHour = new Date(now.getTime() + 60 * 60_000);
  inHour.setMinutes(Math.ceil(inHour.getMinutes() / 5) * 5, 0, 0); // round up to 5 minutes
  const today = localDate(now);
  const daysToMonday = ((8 - now.getDay()) % 7) || 7; // always a future Monday
  const presets: DuePreset[] = [
    { key: "hour", label: "In 1 hour", date: localDate(inHour), time: localTime(inHour) },
    { key: "evening", label: "Today evening", date: today, time: settings.evening_time },
    { key: "tomorrow", label: "Tomorrow morning", date: localDate(addDays(now, 1)), time: settings.morning_time },
    { key: "monday", label: "Next Monday", date: localDate(addDays(now, daysToMonday)), time: settings.morning_time },
    { key: "3days", label: "In 3 days", date: localDate(addDays(now, 3)), time: settings.default_due_time },
    { key: "week", label: "In 1 week", date: localDate(addDays(now, 7)), time: settings.default_due_time },
  ];
  return presets.filter((p) => !isPast(p, now));
}

/** The retry date after "No answer" or "Not now": `days` from today at the default time. */
export function retryChoice(days: number, defaultTime: string, now = new Date()): DueChoice {
  return { date: localDate(addDays(now, days)), time: defaultTime };
}
