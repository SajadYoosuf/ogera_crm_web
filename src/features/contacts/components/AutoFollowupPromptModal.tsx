"use client";

/**
 * AutoFollowupPromptModal — shown after admin/manager creates a contact.
 *
 * WHY THIS EXISTS:
 *   Admin and manager don't carry leads themselves (rule 1 in rule.md). When they create a
 *   contact, the backend does NOT auto-schedule a follow-up — instead it sets `auto_followup_needed`
 *   to true in the response, and the web shows this prompt so they can assign the first call to a
 *   staff member right away.
 *
 * INPUTS:
 *   contactId   — the newly created contact's id, used for POST /contacts/{id}/followups
 *   staff       — list of staff employees (non-monitoring) to offer in the Assigned To dropdown
 *   onDone      — called whether the user schedules or skips; the caller refreshes the list
 *
 * WHAT IT DOES:
 *   Shows a small modal with: Assigned To (select), Due Date (pre-filled +48h), Channel (default phone_call).
 *   "Skip" closes without scheduling. "Schedule" calls POST /contacts/{contactId}/followups.
 */

import { useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { request } from "@/lib/api/auth";
import { COLOR, MODAL_FIELD_CLASS, MODAL_FIELD_LABEL, MODAL_INPUT } from "@/components/followups/designTokens";

/** ISO date string for today + n days (used to pre-fill the due date field). */
function isoDatePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AutoFollowupPromptModal({
  contactId,
  staff,
  onDone,
}: {
  contactId: number;
  staff: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [assignedTo, setAssignedTo] = useState(() => String(staff[0]?.id ?? ""));
  const [dueDate, setDueDate] = useState(() => isoDatePlus(2)); // +48h
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const today = isoDatePlus(0);

  async function schedule() {
    if (!assignedTo) { setError("Choose who to assign this follow-up to."); return; }
    if (!dueDate || dueDate < today) { setError("Pick a valid due date."); return; }
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in again to continue."); return; }
    setIsSaving(true); setError("");
    try {
      await request(`/contacts/${contactId}/followups`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "First Contact",
          channel: "phone_call",
          priority: "high",
          due_at: `${dueDate}T23:59:00`,
          assigned_to: Number(assignedTo),
        }),
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not schedule follow-up. Try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-fu-title"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(17,18,20,0.45)", backdropFilter: "blur(2px)" }}
        onClick={onDone}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        style={{
          position: "relative", zIndex: 1,
          background: "#fff", borderRadius: 14, padding: "28px 24px 24px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 24px 64px rgba(16,24,40,0.28)",
        }}
      >
        <h2
          id="auto-fu-title"
          style={{ margin: "0 0 6px", fontFamily: "'Sora',system-ui,sans-serif", fontSize: 16, fontWeight: 700, color: COLOR.textHeading }}
        >
          Schedule First Follow-up?
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: COLOR.textSecondary, lineHeight: "19px" }}>
          Assign the first call to a staff member. You can skip this and schedule it later from the contact&apos;s panel.
        </p>

        {/* Assigned To */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="fu-assignee" style={{ ...MODAL_FIELD_LABEL, display: "block", marginBottom: 5 }}>Assigned To</label>
          <select
            id="fu-assignee"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            style={{ ...MODAL_INPUT, height: 42 }}
            className={MODAL_FIELD_CLASS}
          >
            {staff.length === 0 && <option value="">No staff available</option>}
            {staff.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>

        {/* Due Date */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="fu-due-date" style={{ ...MODAL_FIELD_LABEL, display: "block", marginBottom: 5 }}>Due Date</label>
          <input
            id="fu-due-date"
            type="date"
            value={dueDate}
            min={today}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ ...MODAL_INPUT, height: 42 }}
            className={MODAL_FIELD_CLASS}
          />
        </div>

        {error && (
          <p style={{ marginBottom: 12, fontSize: 12.5, color: COLOR.danger, background: COLOR.dangerBg, borderRadius: 6, padding: "7px 10px" }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onDone}
            disabled={isSaving}
            style={{
              height: 38, padding: "0 16px",
              border: `1px solid ${COLOR.borderStrong}`, background: "#fff",
              borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: COLOR.textBody,
              cursor: "pointer", opacity: isSaving ? 0.6 : 1,
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void schedule()}
            disabled={isSaving || !assignedTo || !dueDate}
            style={{
              height: 38, padding: "0 18px",
              border: "none", background: isSaving ? "#6DB89A" : COLOR.accent,
              borderRadius: 8, fontSize: 13.5, fontWeight: 700, color: "#fff",
              cursor: isSaving || !assignedTo || !dueDate ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
