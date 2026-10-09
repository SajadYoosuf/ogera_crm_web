/** Date maths for the Tasks screen. Dates travel as plain YYYY-MM-DD strings so they never drift across a timezone. */
export type TaskView = "day" | "week" | "month";

export function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromISO(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, days: number) {
  const date = fromISO(value);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

/** Monday of the week that holds `value`. */
export function startOfWeek(value: string) {
  return addDays(value, -((fromISO(value).getDay() + 6) % 7));
}

/** Month grid: whole weeks (Monday first) that cover the month of `value`. */
export function monthWeeks(value: string) {
  const first = fromISO(value);
  first.setDate(1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks: string[][] = [];
  let cursor = startOfWeek(toISO(first));
  while (fromISO(cursor) <= last) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** First and last day the view needs from the server. */
export function rangeFor(view: TaskView, value: string) {
  if (view === "day") return { from: value, to: value };
  if (view === "week") { const from = startOfWeek(value); return { from, to: addDays(from, 6) }; }
  const weeks = monthWeeks(value);
  return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
}

/** Move the anchor one day, week or month back (-1) or forward (1). */
export function shift(view: TaskView, value: string, direction: -1 | 1) {
  if (view === "day") return addDays(value, direction);
  if (view === "week") return addDays(value, 7 * direction);
  const date = fromISO(value);
  const target = new Date(date.getFullYear(), date.getMonth() + direction, 1);
  target.setDate(Math.min(date.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
  return toISO(target);
}

const SHORT = { day: "numeric", month: "short" } as const;

/** "Fri, 9 Oct 2026", "5 Oct – 11 Oct 2026" or "October 2026". */
export function titleFor(view: TaskView, value: string) {
  if (view === "day") return fromISO(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (view === "month") return fromISO(value).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const { from, to } = rangeFor("week", value);
  return `${fromISO(from).toLocaleDateString("en-GB", SHORT)} – ${fromISO(to).toLocaleDateString("en-GB", { ...SHORT, year: "numeric" })}`;
}
