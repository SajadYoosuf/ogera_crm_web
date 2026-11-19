"use client";

/**
 * useLeadConvert — handles the lead → Contact conversion flow.
 *
 * Shows a confirmation modal, then calls POST /leads/{id}/convert.
 * On success, optionally navigates to the new contact.
 */

import { useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { convertLead, type ConvertLeadResponse } from "@/lib/api/leads-module";

export function useLeadConvert(onSuccess: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [result, setResult] = useState<ConvertLeadResponse | null>(null);

  function openModal(leadId: number) {
    setPendingId(leadId);
    setConvertError("");
    setResult(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setPendingId(null);
    setResult(null);
    setConvertError("");
  }

  async function confirm() {
    if (!pendingId) return;
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) { setConvertError("Not signed in."); return; }

    setIsConverting(true);
    setConvertError("");
    try {
      const res = await convertLead(token, pendingId);
      setResult(res);
      onSuccess();
    } catch (err) {
      setConvertError(err instanceof ApiError ? err.message : "Conversion failed. Please try again.");
    } finally {
      setIsConverting(false);
    }
  }

  return { isOpen, pendingId, isConverting, convertError, result, openModal, closeModal, confirm };
}
