import type { DashboardKpi, DashboardRange } from "@/lib/api/dashboard";

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const WON = "#12A56A";
const LOST = "#E5484D";
const NO_STAGE = "#9AA0AC";
const PALETTE = ["#0E4D3A", "#2F6FEB", "#7C3AED", "#D97706", "#0891B2", "#DB2777", "#65A30D", "#6B7080"];

/** Colour for a pipeline stage. Won and lost are fixed; the others take a stable colour from their slug. */
export function stageColor(slug: string | null): string {
  if (slug === "won") return WON;
  if (slug === "lost") return LOST;
  if (!slug || slug === "no_stage") return NO_STAGE;
  const hash = [...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export type Tone = "up" | "down" | "muted";

/** The line under a KPI that compares with the previous period. "All time" has nothing to compare with. */
export function changeLine(kpi: DashboardKpi): { text: string; tone: Tone } {
  if (kpi.change === null) return { text: "All time", tone: "muted" };
  if (kpi.change > 0) return { text: `+${kpi.change} vs previous period`, tone: "up" };
  if (kpi.change < 0) return { text: `−${Math.abs(kpi.change)} vs previous period`, tone: "down" };
  return { text: "No change vs previous period", tone: "muted" };
}

export function leadTypeLabel(contactType: string | null): string {
  switch (contactType) {
    case "consumer": return "Consumer";
    case "partner": return "Partner";
    case "dealer": return "Dealer";
    default: return "Lead";
  }
}

/** A lead with no name is shown by its phone number, the same as the Contacts screen. */
export function leadDisplayName(name: string | null, phone: string | null): string {
  return name?.trim() || phone?.trim() || "Unnamed lead";
}

export function initialOf(label: string): string {
  const first = label.trim().charAt(0);
  return first ? first.toUpperCase() : "#";
}

/** Due time of a follow-up as HH:MM. Due times are stored as IST wall-clock text, so the text is read as-is. */
export function dueTimeLabel(dueAt: string): string {
  const match = /T(\d{2}:\d{2})/.exec(dueAt);
  return match ? match[1] : "";
}

export function overdueLabel(days: number): string {
  if (days <= 0) return "";
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

/** "17 Oct". Created times are stored as naive text, so the calendar day is read straight from the text. */
export function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const formatCount = (value: number) => value.toLocaleString("en-IN");
