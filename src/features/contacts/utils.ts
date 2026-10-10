import type { ApiContact, ApiContactType, ProfessionOption } from "@/features/contacts/api/contacts";

export type Filters = { type: string; profession: string; source: string; district: string; assignedTo: string; createdBy: string; verified: string };
export const NO_FILTERS: Filters = { type: "", profession: "", source: "", district: "", assignedTo: "", createdBy: "", verified: "" };
export const PAGE_SIZE = 12;
export const KIND_LABELS: Record<string, string> = { consumer: "Consumer", partner: "Partner" };
export const TYPE_TABS = [{ value: "", label: "All" }, { value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }];
export const professionLabel = (value: string) => value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
// Fallback until GET /contacts/profession-types answers; the backend enum is the source of truth.
export const DEFAULT_PARTNER_TYPES: ProfessionOption[] = ["plumber", "engineer", "interior_designer", "architect", "contractor", "electrician"]
  .map((value) => ({ value, label: professionLabel(value) }));
export type ContactSource = string;

export interface Contact {
  id: number; kind: ApiContactType; profession?: string; name: string; phone: string; stage?: string; source?: string;
  address?: string; district?: string; assignedTo?: string; assignedToId?: number; createdAt: string;
  isVerified: boolean; missingFields: string[];
}
export interface ContactForm {
  name: string; phone: string; contactType: ApiContactType; source: ContactSource;
  address: string; district: string; houseStage: string; professionType: string; referredByContactId: number | null; assignedTo: string;
}

export const blankContact: ContactForm = {
  name: "", phone: "", contactType: "consumer", source: "",
  address: "", district: "", houseStage: "", professionType: "", referredByContactId: null, assignedTo: "",
};
export const fromApi = (contact: ApiContact): Contact => ({
  id: contact.id, name: contact.name, phone: contact.phone, kind: contact.contact_type, profession: contact.profession_type || undefined,
  source: contact.lead_source?.name, address: contact.address || undefined, district: contact.district,
  stage: contact.lead_stage?.stage, assignedTo: contact.assigned_to?.name, assignedToId: contact.assigned_to?.id, createdAt: contact.created_at,
  isVerified: contact.is_verified, missingFields: contact.missing_fields ?? [],
});
export const FIELD_LABELS: Record<string, string> = {
  name: "Name", phone: "Phone number", district: "District", address: "Address", lead_source: "Lead source",
  location: "GPS location", created_by: "Added by", house_stage: "House stage", work_area: "Work area",
};
export const displayLocation = (contact: Contact) => contact.address || contact.district || "Location not added";
export const toForm = (contact: Contact): ContactForm => ({
  name: contact.name, phone: contact.phone, contactType: contact.kind, source: contact.source ?? "",
  address: contact.address ?? "", district: contact.district ?? "", houseStage: "", professionType: contact.profession ?? "", referredByContactId: null,
  assignedTo: contact.assignedToId === undefined ? "" : String(contact.assignedToId),
});

export const KERALA_DISTRICTS = [
  "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
  "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
];
