import { parseApiDate } from "@/lib/date-time";

const IST = "Asia/Kolkata";
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
const key = new Intl.DateTimeFormat("en-CA", { timeZone: IST });

/** "12 Nov" for a YYYY-MM-DD chart date. */
export function shortDay(isoDate: string): string {
  return day.format(new Date(`${isoDate}T00:00:00+05:30`));
}

/** How late a follow-up is, or when today it falls due. */
export function dueText(value: string, now: Date = new Date()): string {
  const due = parseApiDate(value);
  if (!due) return "—";
  const lateMinutes = Math.floor((now.getTime() - due.getTime()) / 60_000);
  if (lateMinutes >= 1) {
    if (lateMinutes < 60) return `${lateMinutes} min late`;
    const hours = Math.floor(lateMinutes / 60);
    if (hours < 24) return `${hours} h late`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} late`;
  }
  return key.format(due) === key.format(now) ? `Today, ${time.format(due)}` : `${day.format(due)}, ${time.format(due)}`;
}

/** "5 min ago", "3 h ago", "12 Nov". */
export function agoText(value: string, now: Date = new Date()): string {
  const when = parseApiDate(value);
  if (!when) return "—";
  const minutes = Math.floor((now.getTime() - when.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} day${days === 1 ? "" : "s"} ago` : day.format(when);
}

export const percent = (value: number | null) => (value === null ? "—" : `${value}%`);

/** wa.me click-to-chat link. Indian 10-digit numbers get the 91 country code. */
export function whatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}
