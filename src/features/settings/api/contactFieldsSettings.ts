/**
 * Contact field definition settings API.
 * Admin can update labels, dropdown options, required flag, sort order, and active state.
 */

import { apiCall } from "@/lib/api/auth";

export type FieldType = "text" | "dropdown" | "number" | "boolean";

export type ContactFieldDefinition = {
  id: number;
  entity_type: "consumer" | "partner";
  field_name: string;
  field_label: string | null;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
};

export type ContactFieldUpdate = {
  field_label?: string;
  options?: string[];
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type ContactFieldCreate = {
  entity_type: "consumer" | "partner" | "dealer";
  field_name: string;
  field_label: string;
  field_type: FieldType;
  options?: string[];
  is_required?: boolean;
  show_in_list?: boolean;
};

/** Admin GET — returns all rows including inactive so the settings page can reactivate hidden fields. */
export const listAllContactFields = (token: string): Promise<ContactFieldDefinition[]> =>
  apiCall<ContactFieldDefinition[]>(token, "GET", "/contact-field-definitions/all");

export const listContactFields = (token: string): Promise<ContactFieldDefinition[]> =>
  apiCall<ContactFieldDefinition[]>(token, "GET", "/contact-field-definitions");

export const createContactField = (
  token: string,
  body: ContactFieldCreate,
): Promise<ContactFieldDefinition> =>
  apiCall<ContactFieldDefinition>(token, "POST", "/contact-field-definitions", body);

export const updateContactField = (
  token: string,
  id: number,
  patch: ContactFieldUpdate,
): Promise<ContactFieldDefinition> =>
  apiCall<ContactFieldDefinition>(token, "PATCH", `/contact-field-definitions/by-id/${id}`, patch);
