/** Activity kinds and their subtypes. Slugs match the backend `ACTIVITY_SUBTYPES`. */
export type ActivityKindMeta = {
  kind: string;
  label: string;
  hint: string;
  dot: string;
  subtypes: { value: string; label: string }[];
};

export const ACTIVITY_KINDS: ActivityKindMeta[] = [
  { kind: "phone_call", label: "Phone call", hint: "Log the outcome after", dot: "bg-blue-500",
    subtypes: [{ value: "check_interest", label: "Check interest" }, { value: "quote_followup", label: "Quote follow-up" }, { value: "payment_chase", label: "Payment chase" }] },
  { kind: "field_visit", label: "Field visit", hint: "GPS-logged, in person", dot: "bg-emerald-500",
    subtypes: [{ value: "consumer_visit", label: "Consumer visit" }, { value: "dealer_meeting", label: "Dealer meeting" }, { value: "partner_intro", label: "Partner intro" }] },
  { kind: "whatsapp", label: "WhatsApp message", hint: "Send and log in one step", dot: "bg-green-500",
    subtypes: [{ value: "send_quote", label: "Send quote" }, { value: "payment_reminder", label: "Payment reminder" }, { value: "festival_offer", label: "Festival offer" }] },
  { kind: "quote", label: "Send quote", hint: "Opens quote builder", dot: "bg-amber-500",
    subtypes: [{ value: "new_quote", label: "New quote" }, { value: "revised_price", label: "Revised price" }] },
  { kind: "demo", label: "Demo / sample", hint: "Product show", dot: "bg-indigo-500",
    subtypes: [{ value: "showroom_demo", label: "Showroom demo" }, { value: "sample_given", label: "Sample given" }] },
  { kind: "internal_note", label: "Internal note", hint: "No contact needed", dot: "bg-gray-400", subtypes: [] },
];

export const kindMeta = (kind: string) => ACTIVITY_KINDS.find((item) => item.kind === kind) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

export const subtypeLabel = (kind: string, subtype: string | null) =>
  kindMeta(kind).subtypes.find((item) => item.value === subtype)?.label ?? null;

/** Task states from the backend: pending = not yet due, due_today floats to the top, overdue alerts. */
export const TASK_STATE: Record<string, { label: string; chip: string }> = {
  pending: { label: "Pending", chip: "bg-gray-100 text-gray-600" },
  due_today: { label: "Due today", chip: "bg-blue-50 text-blue-700" },
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-700" },
  done: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
};
