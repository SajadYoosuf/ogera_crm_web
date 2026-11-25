/**
 * Lead settings APIs: lead statuses (admin CRUD) and the WhatsApp inbox on a lead.
 */

import { apiCall } from "@/lib/api/auth";

// ── Lead statuses ─────────────────────────────────────────────────────────────

export type LeadStatusRow = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  /** `new` and `converted` cannot be deleted or deactivated. */
  locked: boolean;
  created_at: string;
};

/** The backend refuses a 21st active status. */
export const MAX_ACTIVE_STATUSES = 20;

export const listLeadStatusRows = (token: string): Promise<LeadStatusRow[]> =>
  apiCall<LeadStatusRow[]>(token, "GET", "/settings/lead-statuses");

export const createLeadStatus = (token: string, name: string, sortOrder: number): Promise<LeadStatusRow> =>
  apiCall<LeadStatusRow>(token, "POST", "/settings/lead-statuses", { name, sort_order: sortOrder });

export const updateLeadStatus = (
  token: string,
  id: number,
  patch: Partial<{ name: string; sort_order: number; is_active: boolean }>,
): Promise<LeadStatusRow> => apiCall<LeadStatusRow>(token, "PATCH", `/settings/lead-statuses/${id}`, patch);

/** 409 when leads still use the status. */
export const deleteLeadStatus = (token: string, id: number): Promise<void> =>
  apiCall<void>(token, "DELETE", `/settings/lead-statuses/${id}`);

// ── WhatsApp inbox ────────────────────────────────────────────────────────────

export type WhatsAppMessage = {
  id: number;
  lead_id: number;
  direction: "in" | "out";
  wamid: string | null;
  content_type: string;
  body: string | null;
  template_name: string | null;
  sent_by: number | null;
  status: string;
  is_read: boolean;
  created_at: string;
};

export type WhatsAppReply =
  | { message: string }
  | { template_name: string; template_params?: string[] };

export const listWhatsAppMessages = (token: string, leadId: number): Promise<WhatsAppMessage[]> =>
  apiCall<WhatsAppMessage[]>(token, "GET", `/leads/${leadId}/whatsapp-messages`);

export const sendWhatsAppReply = (token: string, leadId: number, body: WhatsAppReply): Promise<WhatsAppMessage> =>
  apiCall<WhatsAppMessage>(token, "POST", `/leads/${leadId}/whatsapp-reply`, body);
