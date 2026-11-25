/**
 * WhatsApp message templates API (Settings → WhatsApp Templates).
 *
 * A template is a DRAFT until it is submitted. After that Meta decides its status, and the CRM
 * follows through Meta's webhook or the Sync button.
 */

import { apiCall } from "@/lib/api/auth";

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateHeaderType = "text" | "image" | "video" | "document";
export type TemplateStatus =
  | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | "IN_APPEAL" | "PENDING_DELETION";

export type TemplateButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";

export type TemplateButton = {
  type: TemplateButtonType;
  text: string;
  url?: string | null;
  phone_number?: string | null;
  example?: string | null;
};

export type TemplateSampleValues = { body: string[]; header: string[] };

/** What the form sends. */
export type WhatsAppTemplateInput = {
  name: string;
  language: string;
  category: TemplateCategory;
  header_type?: TemplateHeaderType | null;
  header_content?: string | null;
  header_media_url?: string | null;
  header_handle?: string | null;
  body_text: string;
  footer_text?: string | null;
  buttons?: TemplateButton[] | null;
  sample_values?: TemplateSampleValues | null;
};

export type WhatsAppTemplate = WhatsAppTemplateInput & {
  id: number;
  status: TemplateStatus;
  meta_template_id: string | null;
  rejection_reason: string | null;
  quality_score: "GREEN" | "YELLOW" | "RED" | null;
  submission_error: string | null;
  last_submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
  /** How many values a send needs. */
  body_variable_count: number;
  header_variable_count: number;
  /** Meta does not allow edits while a template is under review, disabled or being deleted. */
  can_edit: boolean;
  /** True until the template has been sent to Meta. */
  can_submit: boolean;
};

export type TemplateList = { items: WhatsAppTemplate[]; total: number };
export type TemplateSyncResult = { fetched: number; created: number; updated: number };

/** Meta's limits, so the form can show a live counter and stop typing at the limit. */
export const TEMPLATE_LIMITS = { body: 1024, footer: 60, headerText: 60, buttonText: 25, buttons: 10, urlButtons: 2 } as const;

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "en", label: "English" },
  { code: "ml", label: "Malayalam" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
  { code: "ar", label: "Arabic" },
];

/** GET /whatsapp/templates */
export const listTemplates = (token: string, opts: { status?: string; search?: string } = {}): Promise<TemplateList> => {
  const query = new URLSearchParams();
  if (opts.status) query.set("status", opts.status);
  if (opts.search) query.set("search", opts.search);
  const qs = query.toString();
  return apiCall<TemplateList>(token, "GET", `/whatsapp/templates${qs ? `?${qs}` : ""}`);
};

/** POST /whatsapp/templates — saves a draft; nothing is sent to Meta. */
export const createTemplate = (token: string, input: WhatsAppTemplateInput): Promise<WhatsAppTemplate> =>
  apiCall<WhatsAppTemplate>(token, "POST", "/whatsapp/templates", input);

/** PUT /whatsapp/templates/{id} — a submitted template goes back to Meta for review. */
export const updateTemplate = (token: string, id: number, input: WhatsAppTemplateInput): Promise<WhatsAppTemplate> =>
  apiCall<WhatsAppTemplate>(token, "PUT", `/whatsapp/templates/${id}`, input, 30_000);

/** POST /whatsapp/templates/{id}/submit — sends a draft to Meta for approval. */
export const submitTemplate = (token: string, id: number): Promise<WhatsAppTemplate> =>
  apiCall<WhatsAppTemplate>(token, "POST", `/whatsapp/templates/${id}/submit`, undefined, 30_000);

/** POST /whatsapp/templates/sync — pulls every template and status from Meta. */
export const syncTemplates = (token: string): Promise<TemplateSyncResult> =>
  apiCall<TemplateSyncResult>(token, "POST", "/whatsapp/templates/sync", undefined, 60_000);

/** DELETE /whatsapp/templates/{id} — deletes here and on Meta. */
export const deleteTemplate = (token: string, id: number): Promise<void> =>
  apiCall<void>(token, "DELETE", `/whatsapp/templates/${id}`, undefined, 30_000);

/** Numbers N of every {{N}} in a text, sorted and unique. */
export function variableIndices(text: string | null | undefined): number[] {
  const found = new Set<number>();
  for (const m of (text ?? "").matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (n >= 1) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/** Replaces {{N}} with the Nth sample value (or leaves the placeholder when there is none). */
export function fillSamples(text: string, samples: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (whole, n) => samples[Number(n) - 1]?.trim() || whole);
}
