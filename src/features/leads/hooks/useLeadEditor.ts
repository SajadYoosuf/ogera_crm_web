"use client";

/**
 * useLeadEditor — manages create and update form state for a single lead.
 *
 * Usage:
 *   const editor = useLeadEditor(onSuccess);
 *   editor.open()          — opens blank create form
 *   editor.open(lead)      — opens edit form pre-filled with lead data
 *   editor.submit()        — calls create or update depending on mode
 */

import { useState } from "react";
import { validatePhone } from "@/components/PhoneField";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import {
  createLead,
  updateLead,
  type Lead,
  type LeadCreate,
  type LeadStatus,
} from "@/features/leads/api/leads";

export type LeadFormState = {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  source_id: number;
  branch_id: number | null;
  status: LeadStatus;
  notes: string;
  tags: string;
  /** YYYY-MM-DD string for the HTML date input — maps to created_at on new leads */
  lead_date: string;
};

/** Today's calendar date in India, as YYYY-MM-DD. toISOString() would give the UTC date, which is a day behind before 05:30 IST. */
export function todayDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

const BLANK: LeadFormState = {
  first_name: "",
  last_name: "",
  phone: "",
  address: "",
  source_id: 1,  // Walk-in default
  branch_id: null,  // blank -> backend defaults to the creating employee's own branch
  status: "new",
  notes: "",
  tags: "",
  lead_date: todayDate(),
};

export function useLeadEditor(onSuccess: () => void) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LeadFormState>(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function open(lead?: Lead) {
    if (lead) {
      setEditingId(lead.id);
      setForm({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        phone: lead.phone ?? "",
        address: lead.address ?? "",
        source_id: lead.source_id ?? 1,
        branch_id: lead.branch_id,
        status: lead.status,
        notes: lead.notes ?? "",
        tags: lead.tags?.join(", ") ?? "",
        // Show the lead's original creation date (without timezone shift)
        lead_date: lead.created_at
          ? (lead.created_at.endsWith("Z") || lead.created_at.includes("+")
              ? lead.created_at
              : lead.created_at + "Z"
            ).slice(0, 10)
          : todayDate(),
      });
    } else {
      setEditingId(null);
      setForm(BLANK);
    }
    setSaveError("");
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setSaveError("");
  }

  function setField<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!token) { setSaveError("Not signed in."); return; }

    const phoneCheck = validatePhone(form.phone);
    if (!phoneCheck.valid) { setSaveError(phoneCheck.message || "Enter a valid phone number."); return; }

    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSaving(true);
    setSaveError("");
    try {
      if (editingId) {
        await updateLead(token, editingId, {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          phone: form.phone || undefined,
          status: form.status,
          branch_id: form.branch_id,
          notes: form.notes || undefined,
          tags: tags.length ? tags : undefined,
        });
      } else {
        const body: LeadCreate = {
          first_name: form.first_name,
          phone: form.phone,
          source_id: form.source_id,
          // Always send created_at so the date the user entered is used,
          // not the moment the API call lands on the server.
          created_at: form.lead_date + "T00:00:00Z",
        };
        if (form.last_name) body.last_name = form.last_name;
        if (form.address) body.address = form.address;
        if (form.notes) body.notes = form.notes;
        if (form.branch_id != null) body.branch_id = form.branch_id;
        if (tags.length) body.tags = tags;
        await createLead(token, body);
      }
      close();
      onSuccess();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return { isOpen, editingId, form, isSaving, saveError, open, close, setField, submit };
}
