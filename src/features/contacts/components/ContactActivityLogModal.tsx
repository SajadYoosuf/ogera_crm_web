"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { ACTIVITY_TYPE_FALLBACK, logContactActivity, type InteractionOutcome } from "@/lib/api/interactions";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import Spinner from "@/components/Spinner";

const FALLBACK_TYPES = staticOptions(ACTIVITY_TYPE_FALLBACK);
const OUTCOMES: { value: InteractionOutcome; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "not_now", label: "Not now" },
  { value: "no_answer", label: "No answer" },
];

type Props = {
  contactId: number;
  contactName: string;
  onSaved: () => void;
  onCancel: () => void;
};

export default function ContactActivityLogModal({ contactId, contactName, onSaved, onCancel }: Props) {
  const { token } = useAuth();
  const { options: activityTypes } = useEnumOptions("activity_type", FALLBACK_TYPES);
  const [outcome, setOutcome] = useState<InteractionOutcome | "">("");
  const [activityType, setActivityType] = useState("phone_call");
  const [customLabel, setCustomLabel] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    if (!notes.trim()) { setError("Notes are required — write what happened."); return; }
    if (activityType === "other" && !customLabel.trim()) {
      setError("Please name this custom activity type.");
      return;
    }
    if (!token) { setError("Sign in again to continue."); return; }
    setIsSaving(true);
    setError("");
    try {
      await logContactActivity(token, contactId, {
        activity_type: activityType,
        ...(activityType === "other" ? { custom_label: customLabel.trim() } : {}),
        title: title.trim() || undefined,
        notes: notes.trim(),
        ...(outcome ? { outcome } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="contact-log-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="contact-log-title" className="text-base font-semibold text-gray-900">Log Activity</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Record an interaction with <span className="font-medium">{contactName}</span>
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <span className="mb-2 block text-xs font-medium text-gray-600">Activity type</span>
            <div className="grid grid-cols-3 gap-2">
              {activityTypes.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setActivityType(opt.value)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    activityType === opt.value
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {activityType === "other" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                What type? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Site measurement, Demo visit"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
            <input
              type="text"
              placeholder="Short summary (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Outcome</span>
            <div className="flex gap-2">
              {OUTCOMES.map((o) => (
                <button key={o.value} type="button" aria-pressed={outcome === o.value}
                  onClick={() => setOutcome(outcome === o.value ? "" : o.value)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    outcome === o.value ? "border-teal-600 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="What happened? Be specific."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={() => void save()} disabled={isSaving}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {isSaving ? "Saving…" : "Save Activity"}
          </button>
          <button onClick={onCancel} disabled={isSaving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";
