export type LeadKind = "consumer" | "partner" | "dealer";

/** Stage colors from the design — indexed by slug. */
type StageColors = { bar: string; badgeBg: string; badgeFg: string };

const STAGE_COLORS: Record<string, StageColors> = {
  new_lead:             { bar: "#64748B", badgeBg: "#F1F3F5", badgeFg: "#64748B" },
  first_call:           { bar: "#3B82F6", badgeBg: "#EAF2FE", badgeFg: "#3B82F6" },
  connected:            { bar: "#0EA5E9", badgeBg: "#E8F6FD", badgeFg: "#0EA5E9" },
  aware:                { bar: "#8B5CF6", badgeBg: "#F1EDFF", badgeFg: "#8B5CF6" },
  interested:           { bar: "#A855F7", badgeBg: "#F6EEFE", badgeFg: "#A855F7" },
  quotation:            { bar: "#D97706", badgeBg: "#FEF3DF", badgeFg: "#D97706" },
  won:                  { bar: "#0E7A4F", badgeBg: "#EAF8EF", badgeFg: "#0E7A4F" },
  lost:                 { bar: "#E5484D", badgeBg: "#FDECEC", badgeFg: "#E5484D" },
  after_sales_referring:{ bar: "#0E4D3A", badgeBg: "#E6EFEA", badgeFg: "#0E4D3A" },
  demo_introduction:    { bar: "#8B5CF6", badgeBg: "#F1EDFF", badgeFg: "#8B5CF6" },
  active:               { bar: "#0E7A4F", badgeBg: "#EAF8EF", badgeFg: "#0E7A4F" },
  referral:             { bar: "#0E4D3A", badgeBg: "#E6EFEA", badgeFg: "#0E4D3A" },
  inactive:             { bar: "#8A8F9C", badgeBg: "#F0F0F3", badgeFg: "#8A8F9C" },
  meeting_done:         { bar: "#8B5CF6", badgeBg: "#F1EDFF", badgeFg: "#8B5CF6" },
  terms_agreed:         { bar: "#A855F7", badgeBg: "#F6EEFE", badgeFg: "#A855F7" },
  sample_sent:          { bar: "#D97706", badgeBg: "#FEF3DF", badgeFg: "#D97706" },
  first_order:          { bar: "#F59E0B", badgeBg: "#FEF2DE", badgeFg: "#F59E0B" },
  placed:               { bar: "#CA8A04", badgeBg: "#FBF0CF", badgeFg: "#CA8A04" },
  active_dealer:        { bar: "#0E7A4F", badgeBg: "#EAF8EF", badgeFg: "#0E7A4F" },
  inactive_dealer:      { bar: "#8A8F9C", badgeBg: "#F0F0F3", badgeFg: "#8A8F9C" },
};

const DEFAULT_COLORS: StageColors = { bar: "#64748B", badgeBg: "#F1F3F5", badgeFg: "#64748B" };

export const stageColors = (slug: string): StageColors => STAGE_COLORS[slug] ?? DEFAULT_COLORS;

/** Short descriptions for each stage column — shown below the stage name on the board. */
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  new_lead:             "Just entered. Not yet contacted.",
  first_call:           "First call attempted, waiting to reach.",
  connected:            "Spoke to them, needs qualifying.",
  aware:                "Understands the product, still deciding.",
  interested:           "Wants to move forward, needs pricing.",
  quotation:            "Price sent, awaiting their decision.",
  won:                  "Converted to a paying customer.",
  lost:                 "Not interested, or went with someone else.",
  after_sales_referring:"Happy customer, asking for referrals.",
  demo_introduction:    "Product demo or intro meeting set.",
  active:               "Onboarded and actively referring.",
  referral:             "Bringing in new leads regularly.",
  inactive:             "No activity in a while.",
  meeting_done:         "In-person or call meeting completed.",
  terms_agreed:         "Pricing and terms finalised.",
  sample_sent:          "Product sample dispatched.",
  first_order:          "First trial order being placed.",
  placed:               "First order confirmed and billed.",
  active_dealer:        "Ordering regularly, in good standing.",
  inactive_dealer:      "No orders in a while.",
};

/** Five avatar colours that cycle across cards. */
export const AVATAR_COLORS = [
  { bg: "#EDE9FE", fg: "#5B3FD6" },
  { bg: "#E0F2FE", fg: "#0B6AA8" },
  { bg: "#DCFCE7", fg: "#167A44" },
  { bg: "#FEF3C7", fg: "#9A6200" },
  { bg: "#FCE7F3", fg: "#A8326E" },
];

export const LOSS_REASONS = [
  { value: "price", label: "Price" },
  { value: "competitor", label: "Went with a competitor" },
  { value: "timing", label: "Timing" },
  { value: "not_interested", label: "Not interested" },
  { value: "other", label: "Other" },
];

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

/** wa.me wants digits only; bare 10-digit numbers are Indian mobiles. */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

export const FIELD_LABELS: Record<string, string> = {
  name: "Name", phone: "Phone number", district: "District", address: "Address", lead_source: "Lead source",
  location: "GPS location", created_by: "Added by", house_stage: "House stage", work_area: "Work area",
};

/** Parse a UTC ISO string from the API (no Z suffix) as UTC. */
function utcDate(iso: string) { return new Date(iso.endsWith("Z") ? iso : iso + "Z"); }

/** Format a date string as "Fri, 16 Oct" for card display. */
export function formatCardDate(iso: string) {
  const d = utcDate(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Format a datetime string as "16 Dec · 14:30" for history display. */
export function formatMoment(value: string) {
  const d = utcDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
