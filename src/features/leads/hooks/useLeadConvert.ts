"use client";

/**
 * useLeadConvert — 2-step lead → Contact conversion flow.
 *
 * Step 1: collect contact_type, partner_type, and any missing fields (name, phone, address, district).
 * Step 2: show a confirmation screen, then call POST /leads/{id}/convert with the body.
 *
 * Usage:
 *   const converter = useLeadConvert(() => refresh());
 *   converter.openModal(leadId, lead);   // pass the full Lead so we know which fields are missing
 *   <ConvertLeadModal converter={converter} />
 */

import { useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import {
  convertLead,
  type ConvertLeadBody,
  type ConvertLeadResponse,
} from "@/features/leads/api/leads";
import { listPartnerTypes, type PartnerTypeOption } from "@/features/contacts/api/contacts";

export type PartnerTypesStatus = "loading" | "ready" | "error";

type LeadLike = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type ConvertStep = 1 | 2;

export type ConvertForm = {
  contact_type: "consumer" | "partner";
  partner_type: string;
  name: string;
  phone: string;
  address: string;
  district: string;
};

function formFromLead(lead: LeadLike | null): ConvertForm {
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ");
  return {
    contact_type: "consumer",
    partner_type: "",
    name,
    phone: lead?.phone ?? "",
    address: lead?.address ?? "",
    district: "",
  };
}

export function useLeadConvert(onSuccess: () => void) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ConvertStep>(1);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [lead, setLead] = useState<LeadLike | null>(null);
  const [form, setForm] = useState<ConvertForm>(formFromLead(null));
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [result, setResult] = useState<ConvertLeadResponse | null>(null);
  const [partnerTypes, setPartnerTypes] = useState<PartnerTypeOption[]>([]);
  const [partnerTypesStatus, setPartnerTypesStatus] = useState<PartnerTypesStatus>("loading");

  function reloadPartnerTypes() {
    if (!token) { setPartnerTypesStatus("error"); return; }
    setPartnerTypesStatus("loading");
    listPartnerTypes(token)
      .then((options) => { setPartnerTypes(options); setPartnerTypesStatus("ready"); })
      .catch(() => setPartnerTypesStatus("error"));
  }

  function openModal(leadId: number, leadData: LeadLike | null = null) {
    setPendingId(leadId);
    setLead(leadData);
    setForm(formFromLead(leadData));
    setStep(1);
    setConvertError("");
    setResult(null);
    setIsOpen(true);
    reloadPartnerTypes();
  }

  function closeModal() {
    setIsOpen(false);
    setPendingId(null);
    setLead(null);
    setResult(null);
    setConvertError("");
    setStep(1);
  }

  function updateForm(patch: Partial<ConvertForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  /** Call from Step 1 "Next" button — validates and advances to Step 2. */
  function nextStep(): boolean {
    if (!form.name.trim()) {
      setConvertError("Name is required.");
      return false;
    }
    if (!form.phone.trim()) {
      setConvertError("Phone is required.");
      return false;
    }
    if (!form.address.trim()) {
      setConvertError("Address is required.");
      return false;
    }
    if (form.contact_type === "partner" && !form.partner_type.trim()) {
      setConvertError("Partner type is required.");
      return false;
    }
    setConvertError("");
    setStep(2);
    return true;
  }

  /** Call from Step 2 "Convert" button. */
  async function confirm() {
    if (!pendingId) return;
    if (!token) { setConvertError("Not signed in."); return; }

    const body: ConvertLeadBody = {
      contact_type: form.contact_type,
      ...(form.contact_type === "partner" && form.partner_type ? { partner_type: form.partner_type } : {}),
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
      ...(form.district ? { district: form.district } : {}),
    };

    setIsConverting(true);
    setConvertError("");
    try {
      const res = await convertLead(token, pendingId, body);
      setResult(res);
      onSuccess();
    } catch (err) {
      setConvertError(err instanceof ApiError ? err.message : "Conversion failed. Please try again.");
      setStep(1);
    } finally {
      setIsConverting(false);
    }
  }

  function prevStep() {
    setConvertError("");
    setStep(1);
  }

  return {
    isOpen, step, pendingId, lead,
    form, updateForm,
    isConverting, convertError,
    result,
    partnerTypes, partnerTypesStatus, reloadPartnerTypes,
    openModal, closeModal, nextStep, prevStep, confirm,
  };
}
