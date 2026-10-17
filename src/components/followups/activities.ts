import { cachedLabel } from "@/hooks/useEnumOptions";

/** Label from Settings -> Activity types (the API). Until it loads, the raw slug is shown; no label is hardcoded here. */
export const typeLabel = (type: string) => cachedLabel("activity_type", type) ?? type.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

/** True when `date` is today and `time` (HH:MM) has already passed. No time means the whole day, so it is never past. */
export function isPastTimeToday(date: string, time?: string) {
  if (!time || date !== isoDate()) return false;
  const now = new Date();
  return time < `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Local calendar date as YYYY-MM-DD, `offsetDays` from today. Dates travel as plain strings so they never drift across a timezone. */
export function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Mon 29 Sep" for a YYYY-MM-DD date. */
export function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "10:30am" for an HH:MM[:SS] time. */
export function formatClock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

/** "Today 10:22am", "Yesterday 4:05pm" or "29 Sep 10:22am" for a server timestamp. */
export function formatWhen(value: string, now = new Date()) {
  // API returns UTC without Z; append it so Date() interprets the string as UTC.
  const moment = new Date(value.endsWith("Z") ? value : value + "Z");
  if (Number.isNaN(moment.getTime())) return "";
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const clock = formatClock(`${moment.getHours()}:${moment.getMinutes()}`);
  if (sameDay(moment, now)) return `Today ${clock}`;
  if (sameDay(moment, yesterday)) return `Yesterday ${clock}`;
  return `${moment.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${clock}`;
}
