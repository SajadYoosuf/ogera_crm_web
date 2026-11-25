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
import { canDo } from "@/lib/shared/roles";
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
  /** Admin/manager only, create mode: null = auto-assign on the server. */
  assigned_to: number | null;
};

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
  assigned_to: null,
};

export function useLeadEditor(onSuccess: () => void) {
  const { token, user } = useAuth();
  const canManage = canDo(user, "leads", "u");
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
        assigned_to: lead.assigned_to,
      });
    } else {
      setEditingId(null);
      // New leads start on the employee's own branch, so the form shows the branch name instead of a placeholder.
      setForm({ ...BLANK, branch_id: user?.branch_id ?? null });
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
          ...(canManage && form.assigned_to != null ? { assigned_to: form.assigned_to } : {}),
        });
      } else {
        const body: LeadCreate = {
          first_name: form.first_name,
          phone: form.phone,
          source_id: form.source_id,
        };
        // Only admin/manager may pick the assignee; the server returns 403 if staff send it.
        if (canManage && form.assigned_to != null) body.assigned_to = form.assigned_to;
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

  const clearSaveError = () => setSaveError("");
  return { isOpen, editingId, form, isSaving, saveError, clearSaveError, open, close, setField, submit, canManage };
}
