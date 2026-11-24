"use client";

/**
 * WhatsAppButton — manually triggers the WhatsApp welcome template for a lead.
 *
 * Shows a green button. On click, calls POST /leads/{id}/send-whatsapp.
 * Disables itself after a successful send (the lead already has a message).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import { sendLeadWhatsApp } from "@/features/leads/api/leads";

type Props = {
  leadId: number;
  alreadySent: boolean;
  onSent?: () => void;
};

export default function WhatsAppButton({ leadId, alreadySent, onSent }: Props) {
  const { token } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(alreadySent);
  const [error, setError] = useState("");

  async function handle() {
    if (!token) return;
    setSending(true);
    setError("");
    try {
      await sendLeadWhatsApp(token, leadId);
      setSent(true);
      onSent?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handle}
        disabled={sent || sending}
        title={sent ? "WhatsApp already sent" : "Send WhatsApp welcome message"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          sent
            ? "bg-green-50 text-green-600 cursor-default"
            : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        }`}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {sent
            ? <path d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            : <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
        </svg>
        {sending ? "Sending…" : sent ? "Sent" : "WhatsApp"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
