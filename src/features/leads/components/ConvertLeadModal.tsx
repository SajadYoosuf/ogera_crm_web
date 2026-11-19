"use client";

/**
 * ConvertLeadModal — confirmation dialog before converting a lead into a Contact.
 *
 * WHAT CONVERSION DOES:
 *   The backend creates a new Contact row using the lead's name, phone, and email,
 *   sets lead.status = "converted", and links lead.contact_id to the new contact.
 *   After conversion the lead is read-only; the full record lives in Contacts.
 */

import type { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";
import { useRouter } from "next/navigation";

type Props = { converter: ReturnType<typeof useLeadConvert> };

export default function ConvertLeadModal({ converter }: Props) {
  const { isOpen, isConverting, convertError, result, closeModal, confirm } = converter;
  const router = useRouter();

  if (!isOpen) return null;

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Lead converted" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <svg className="h-6 w-6 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Lead converted!</h2>
          <p className="mt-1 text-sm text-gray-500">
            {result.created ? "A new contact was created." : "Linked to an existing contact."}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => router.push(`/contacts`)}
              className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              Go to Contacts
            </button>
            <button
              onClick={closeModal}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Stay here
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="convert-modal-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="convert-modal-title" className="text-lg font-semibold text-gray-900">Convert to Contact?</h2>
        <p className="mt-2 text-sm text-gray-500">
          This will create a new Contact from the lead's details and mark this lead as
          Converted. The lead will become read-only.
        </p>
        {convertError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{convertError}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={confirm}
            disabled={isConverting}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {isConverting ? "Converting…" : "Convert"}
          </button>
          <button
            onClick={closeModal}
            disabled={isConverting}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
