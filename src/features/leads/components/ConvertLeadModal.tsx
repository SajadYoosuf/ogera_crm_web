"use client";

/**
 * ConvertLeadModal — 2-step modal to convert a lead into a Contact.
 *
 * Step 1: choose contact type (Consumer / Partner), fill partner_type if Partner,
 *         and fill only the fields the lead does not already have (name, phone, address required;
 *         district optional).
 * Step 2: summary → "Convert" button.
 * Success: redirect prompt.
 */

import { useRouter } from "next/navigation";
import type { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";

const KERALA_DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam",
  "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram",
  "Kozhikode", "Wayanad", "Kannur", "Kasaragod",
];

type Props = { converter: ReturnType<typeof useLeadConvert> };

export default function ConvertLeadModal({ converter }: Props) {
  const {
    isOpen, step, lead, form, updateForm,
    isConverting, convertError, result,
    partnerTypes, partnerTypesStatus, reloadPartnerTypes,
    closeModal, nextStep, prevStep, confirm,
  } = converter;
  const router = useRouter();

  if (!isOpen) return null;

  // ── Success screen ────────────────────────────────────────────────────────
  if (result) {
    return (
      <Overlay>
        <div role="dialog" aria-modal="true" aria-label="Lead converted"
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <CheckIcon />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Lead converted!</h2>
          <p className="mt-1 text-sm text-gray-500">
            {result.created ? "A new contact was created." : "Linked to an existing contact."}
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => router.push("/dashboard/contacts")}
              className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
              Go to Contacts
            </button>
            <button onClick={closeModal}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Stay here
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  // ── Step 2: Confirm ───────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Overlay>
        <div role="dialog" aria-modal="true" aria-labelledby="convert-confirm-title"
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h2 id="convert-confirm-title" className="text-lg font-semibold text-gray-900">
            Confirm conversion
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            This will create a new Contact and mark the lead as Converted.
          </p>

          <dl className="mt-4 space-y-2 rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <Row label="Name" value={form.name || "—"} />
            <Row label="Phone" value={form.phone || "—"} />
            <Row label="Type" value={form.contact_type === "partner" ? "Partner" : "Consumer"} />
            {form.contact_type === "partner" && (
              <Row label="Partner type" value={form.partner_type || "—"} />
            )}
            {form.address && <Row label="Address" value={form.address} />}
            {form.district && <Row label="District" value={form.district} />}
          </dl>

          {convertError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{convertError}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button onClick={confirm} disabled={isConverting}
              className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {isConverting ? "Converting…" : "Convert"}
            </button>
            <button onClick={prevStep} disabled={isConverting}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Back
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  // ── Step 1: Form ──────────────────────────────────────────────────────────
  return (
    <Overlay>
      <div role="dialog" aria-modal="true" aria-labelledby="convert-form-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="convert-form-title" className="text-lg font-semibold text-gray-900">
          Convert to Contact
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Review and fill in the details before converting.
        </p>

        <div className="mt-4 space-y-3">
          {/* Contact type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Contact type</label>
            <div className="flex gap-3">
              {(["consumer", "partner"] as const).map((ct) => (
                <button key={ct}
                  type="button"
                  onClick={() => updateForm({ contact_type: ct })}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    form.contact_type === ct
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {ct === "consumer" ? "Consumer" : "Partner"}
                </button>
              ))}
            </div>
          </div>

          {/* Partner type */}
          {form.contact_type === "partner" && (
            <Field label="Partner type *">
              {partnerTypesStatus === "loading" && (
                <p className="text-sm text-gray-500">Loading partner types…</p>
              )}
              {partnerTypesStatus === "error" && (
                <p className="text-sm text-red-600">
                  Could not load partner types.{" "}
                  <button type="button" onClick={reloadPartnerTypes} className="font-medium underline">Retry</button>
                </p>
              )}
              {partnerTypesStatus === "ready" && partnerTypes.length === 0 && (
                <p className="text-sm text-gray-500">No partner types are set up yet. Ask an admin to add them in Settings.</p>
              )}
              {partnerTypesStatus === "ready" && partnerTypes.length > 0 && (
                <select
                  aria-label="Partner type"
                  value={form.partner_type}
                  onChange={(e) => updateForm({ partner_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— select partner type —</option>
                  {partnerTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {!lead?.first_name && !lead?.last_name && (
            <Field label="Name *">
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}

          {!lead?.phone && (
            <Field label="Phone *">
              <input
                type="tel"
                placeholder="+91XXXXXXXXXX"
                value={form.phone}
                onChange={(e) => updateForm({ phone: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}

          {!lead?.address && (
            <Field label="Address *">
              <input
                type="text"
                placeholder="Street / locality"
                value={form.address}
                onChange={(e) => updateForm({ address: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}

          <Field label="District (optional)">
            <select
              value={form.district}
              onChange={(e) => updateForm({ district: e.target.value })}
              className={inputCls}
            >
              <option value="">— select district —</option>
              {KERALA_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>

        {convertError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{convertError}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={nextStep}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
            Next →
          </button>
          <button onClick={closeModal}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-6 w-6 text-teal-600" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";
