import type { ApiContact, ApiContactType, ProfessionOption } from "@/features/contacts/api/contacts";

export type Filters = { type: string; partnerType: string; source: string; district: string; assignedTo: string; createdBy: string; verified: string };
export const NO_FILTERS: Filters = { type: "", partnerType: "", source: "", district: "", assignedTo: "", createdBy: "", verified: "" };
export const PAGE_SIZE = 10;
export const KIND_LABELS: Record<string, string> = { consumer: "Consumer", partner: "Partner", dealer: "Dealer" };
export const TYPE_TABS = [{ value: "", label: "All Contacts" }, { value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }, { value: "dealer", label: "Dealer" }];
export const professionLabel = (value: string) => value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
// Fallback until GET /contacts/profession-types answers; the backend enum is the source of truth.
export const DEFAULT_PARTNER_TYPES: ProfessionOption[] = ["plumber", "engineer", "interior_designer", "architect", "contractor", "electrician"]
  .map((value) => ({ value, label: professionLabel(value) }));
// House stages come from Settings > Lists & Options; this list shows until they load (the backend's defaults).
export const DEFAULT_HOUSE_STAGES = [
  { value: "ready", label: "Ready" },
  { value: "under_construction", label: "Under construction" },
  { value: "renovation", label: "Renovation" },
];
// Tank types from Settings > Lists & Options; these are the backend's seed defaults.
export const DEFAULT_TANK_TYPES = [
  { value: "plastic", label: "Plastic" },
  { value: "concrete", label: "Concrete" },
  { value: "steel", label: "Steel" },
  { value: "other", label: "Other" },
];
export type ContactSource = string;

export interface Contact {
  id: number; kind: ApiContactType; profession?: string; name: string; phone: string; stage?: string; source?: string;
  address?: string; district?: string; assignedTo?: string; assignedToId?: number; createdAt: string;
  isVerified: boolean; missingFields: string[];
}
export interface ContactForm {
  name: string; phone: string; contactType: ApiContactType; source: ContactSource;
  address: string; district: string; houseStage: string; tankType: string; tankCapacity: string; tankAge: string;
  partnerType: string; workArea: string; referredByContactId: number | null; assignedTo: string;
  dealerOwnerName: string; dealerEmail: string;
  /** Products this contact is interested in, as {id, name} objects for display. */
  interestedProducts: { id: number; name: string }[];
}

export const blankContact: ContactForm = {
  name: "", phone: "", contactType: "consumer", source: "",
  address: "", district: "", houseStage: "", tankType: "", tankCapacity: "", tankAge: "",
  partnerType: "", workArea: "", referredByContactId: null, assignedTo: "",
  dealerOwnerName: "", dealerEmail: "",
  interestedProducts: [],
};
export const fromApi = (contact: ApiContact): Contact => ({
  id: contact.id, name: contact.name, phone: contact.phone, kind: contact.contact_type, profession: contact.profession_type || undefined,
  source: contact.lead_source?.name, address: contact.address || undefined, district: contact.district,
  stage: contact.lead_stage?.stage_slug,
  assignedTo: contact.assigned_to?.name ?? undefined,
  assignedToId: contact.assigned_to?.id ?? undefined,
  createdAt: contact.created_at,
  isVerified: contact.is_verified, missingFields: contact.missing_fields ?? [],
});
export const FIELD_LABELS: Record<string, string> = {
  name: "Name", phone: "Phone number", district: "District", address: "Address", lead_source: "Lead source",
  location: "GPS location", created_by: "Added by", house_stage: "House stage", work_area: "Work area",
};
export const displayLocation = (contact: Contact) => contact.address || contact.district || "Location not added";
export const toForm = (contact: Contact): ContactForm => ({
  name: contact.name, phone: contact.phone, contactType: contact.kind, source: contact.source ?? "",
  address: contact.address ?? "", district: contact.district ?? "", houseStage: "", tankType: "", tankCapacity: "", tankAge: "",
  partnerType: contact.profession ?? "", workArea: "",
  referredByContactId: null,
  assignedTo: contact.assignedToId === undefined ? "" : String(contact.assignedToId),
  dealerOwnerName: "", dealerEmail: "",
  interestedProducts: [],  // filled from detail load in useContactEditor
});

export const KERALA_DISTRICTS = [
  "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
  "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
];
