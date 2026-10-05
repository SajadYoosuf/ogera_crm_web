/** The consumer lead pipeline. Slugs match the backend `StageEnum`; order is the board's column order. */
export type StageSlug = "new_lead" | "aware" | "interested" | "quoted" | "negotiating" | "won" | "lost" | "repeat_customer";

export type StageMeta = { slug: StageSlug; label: string; description: string; dot: string; badge: string };

export const STAGES: StageMeta[] = [
  { slug: "new_lead", label: "New Lead", description: "Just entered. Not yet contacted. 24h clock ticking.", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700" },
  { slug: "aware", label: "Aware", description: "Contacted. Needs education before they're ready to hear a price.", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700" },
  { slug: "interested", label: "Interested", description: "Understands the product. Ready for demo or detailed info.", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  { slug: "quoted", label: "Quoted", description: "Quote sent. Now the 3-day follow-up clock starts.", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  { slug: "negotiating", label: "Negotiating", description: "Active discussion on price, timing, or terms.", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700" },
  { slug: "won", label: "Won", description: "Deal closed. Order being created. Payment tracking begins.", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  { slug: "lost", label: "Lost", description: "Did not buy. Reason captured. Re-engage in 60 days.", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
  { slug: "repeat_customer", label: "Repeat Customer", description: "Bought again or came back for another purchase.", dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700" },
];

export const LOSS_REASONS = [
  { value: "price", label: "Price" },
  { value: "competitor", label: "Went with a competitor" },
  { value: "timing", label: "Timing" },
  { value: "not_interested", label: "Not interested" },
  { value: "other", label: "Other" },
];

export const stageMeta = (slug: StageSlug) => STAGES.find((stage) => stage.slug === slug) ?? STAGES[0];

/** Rows saved before this pipeline (first_call, referral) or with no stage still land in a column. */
export function columnFor(stage: string | null | undefined): StageSlug {
  if (stage && STAGES.some((item) => item.slug === stage)) return stage as StageSlug;
  if (stage === "first_call") return "aware";
  if (stage === "referral") return "repeat_customer";
  return "new_lead";
}

const HOUR = 3_600_000;
const CLOCKS: Partial<Record<StageSlug, { afterMs: number; waiting: string; overdue: string }>> = {
  new_lead: { afterMs: 24 * HOUR, waiting: "First contact due", overdue: "Not contacted" },
  quoted: { afterMs: 3 * 24 * HOUR, waiting: "Follow-up due", overdue: "Follow-up overdue" },
  lost: { afterMs: 60 * 24 * HOUR, waiting: "Re-engage", overdue: "Re-engage now" },
};

const span = (ms: number) => {
  const hours = Math.max(1, Math.round(ms / HOUR));
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

/** The follow-up clock for a lead's current stage, or null for stages without one. */
export function stageClock(slug: StageSlug, changedAt: string, now = Date.now()): { label: string; overdue: boolean } | null {
  const clock = CLOCKS[slug];
  const since = new Date(changedAt).getTime();
  if (!clock || Number.isNaN(since)) return null;
  const left = since + clock.afterMs - now;
  if (left > 0) return { label: `${clock.waiting} in ${span(left)}`, overdue: false };
  return { label: slug === "lost" ? clock.overdue : `${clock.overdue} ${span(-left)}`, overdue: true };
}

export function formatMoment(value: string) {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return "";
  return moment.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The one-click "next step" on a card; Won, Lost and Repeat Customer are where a lead stops. */
export const NEXT_STAGE: Partial<Record<StageSlug, StageSlug>> = {
  new_lead: "interested", aware: "interested", interested: "quoted", quoted: "negotiating", negotiating: "won",
};

/** Accent colour of each column's top bar. */
export const STAGE_BAR: Record<StageSlug, string> = {
  new_lead: "bg-blue-500", aware: "bg-sky-500", interested: "bg-indigo-500", quoted: "bg-amber-500",
  negotiating: "bg-orange-500", won: "bg-emerald-500", lost: "bg-rose-500", repeat_customer: "bg-teal-500",
};

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

/** wa.me wants digits only; bare 10-digit numbers are Indian mobiles. */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}
