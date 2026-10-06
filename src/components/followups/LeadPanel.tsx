"use client";

import { useEffect, useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import { updateContact, type ApiContact } from "@/lib/api/contacts";
import { changeStage, getStageHistory, type StageEntry } from "@/lib/api/leads";
import ActivityLog from "./ActivityLog";
import { LOSS_REASONS, STAGES, columnFor, formatMoment, stageClock, stageMeta, type StageSlug } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");

/** Drawer on desktop, full-width sheet on phones: lead details, stage history and the stage change form. */
export default function LeadPanel({ lead, userId, owners, initialTarget, onUnverified, onClose, onChanged }: {
  lead: ApiContact; userId: number | null; owners: { id: number; name: string }[] | null; initialTarget?: StageSlug; onUnverified: (stage: StageSlug, missing: string[]) => void; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const current = columnFor(lead.lead_stage?.stage);
  const [target, setTarget] = useState<StageSlug | null>(initialTarget && initialTarget !== current ? initialTarget : null);
  const [lossReason, setLossReason] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<StageEntry[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [isChangingOwner, setIsChangingOwner] = useState(false);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    getStageHistory(accessToken, lead.id)
      .then((entries) => { if (!cancelled) { setHistory(entries); setHistoryError(""); } })
      .catch((caught) => { if (!cancelled) setHistoryError(errorText(caught)); });
    return () => { cancelled = true; };
  }, [lead.id, lead.lead_stage?.stage, lead.lead_stage?.changed_at]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(slug: StageSlug, withDetails: boolean) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken || userId === null) { setError("Sign in again to continue."); return; }
    if (slug === "lost" && !lossReason) { setError("Choose why this lead was lost."); return; }
    setIsSaving(true); setError("");
    const text = withDetails ? note.trim() : "";
    try {
      await changeStage(accessToken, lead.id, userId, {
        stage: slug,
        ...(slug === "lost" ? { loss_reason: lossReason, ...(text ? { loss_notes: text } : {}) } : {}),
        ...(slug === "aware" && text ? { awareness_note: text } : {}),
      });
      await onChanged();
      setTarget(null); setLossReason(""); setNote("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.missingFields) onUnverified(slug, caught.missingFields);
      else setError(errorText(caught));
    } finally { setIsSaving(false); }
  }

  // Lost needs a reason and Aware takes a note, so those two open the form; the rest move straight away.
  const pick = (slug: StageSlug) => {
    setError("");
    if (slug === "lost" || slug === "aware") setTarget(slug);
    else void submit(slug, false);
  };

  async function changeOwner(value: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setOwnerError("Sign in again to continue."); return; }
    setIsChangingOwner(true); setOwnerError("");
    try {
      await updateContact(accessToken, lead.id, { assigned_to: Number(value) });
      await onChanged();
    } catch (caught) { setOwnerError(errorText(caught)); } finally { setIsChangingOwner(false); }
  }

  // The current owner stays listed even when it is an admin or manager, so the dropdown never looks empty.
  const ownerOptions = [
    ...(lead.assigned_to && !owners?.some((owner) => owner.id === lead.assigned_to.id) ? [{ id: lead.assigned_to.id, name: lead.assigned_to.name }] : []),
    ...(owners ?? []),
  ].map((owner) => ({ value: String(owner.id), label: owner.name }));

  const meta = stageMeta(current);
  const clock = lead.lead_stage ? stageClock(current, lead.lead_stage.changed_at) : null;
  const details: [string, string | null | undefined][] = [
    ["Phone", lead.phone], ["District", lead.district], ["Address", lead.address], ["Source", lead.lead_source?.name],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#0a192f]/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Lead ${lead.name}`} className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-md">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[#0a192f]">{lead.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
              {clock && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${clock.overdue ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{clock.label}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Contact information</h3>
            <dl className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-gray-500">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium text-gray-900">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Move to stage</h3>
            <p className="mt-1 text-xs text-gray-500">{meta.description}</p>
            <FilterSelect label="Move to" value={target ?? ""} onChange={(value) => { if (value) pick(value as StageSlug); else setTarget(null); }} className="mt-3 w-full"
              options={[{ value: "", label: isSaving ? "Saving…" : "Select stage" }, ...STAGES.filter((stage, index) => index > STAGES.findIndex((item) => item.slug === current)).map((stage) => ({ value: stage.slug, label: stage.label, dot: stage.dot }))]}
              icon={<path d="M5 12h14M13 6l6 6-6 6" />} />

            {(target === "lost" || target === "aware") && (
              <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                {target === "lost" && (
                  <label className="crm-field-label">Why was it lost?
                    <select value={lossReason} onChange={(event) => setLossReason(event.target.value)} className="crm-select">
                      <option value="">Select a reason</option>
                      {LOSS_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="crm-field-label">{target === "lost" ? "Notes (optional)" : "What do they need to learn? (optional)"}
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="crm-textarea" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={isSaving} onClick={() => void submit(target, true)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    {isSaving ? "Saving…" : `Move to ${stageMeta(target).label}`}
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => { setTarget(null); setError(""); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Lead assigned to</h3>
            {owners ? (
              <FilterSelect label="Lead assigned to" value={lead.assigned_to ? String(lead.assigned_to.id) : ""} onChange={(value) => { if (value) void changeOwner(value); }} className="mt-3 w-full"
                options={ownerOptions} icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} />
            ) : (
              <p className="mt-3 text-sm font-medium text-gray-900">{lead.assigned_to?.name ?? "Unassigned"}</p>
            )}
            <p className="mt-1.5 text-xs text-gray-500">{isChangingOwner ? "Saving…" : "Admins and managers are not listed; pick a sales executive or other staff."}</p>
            {ownerError && <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{ownerError}</p>}
          </section>

          <ActivityLog contactId={lead.id} />

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Stage history</h3>
            {historyError ? (
              <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{historyError}</p>
            ) : history === null ? (
              <p className="mt-3 text-sm text-gray-500">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No stage changes recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l-2 border-gray-200 pl-4">
                {history.map((entry) => {
                  const entryMeta = stageMeta(columnFor(entry.stage));
                  const reason = LOSS_REASONS.find((item) => item.value === entry.loss_reason)?.label;
                  const detail = [reason, entry.loss_notes, entry.awareness_note].filter(Boolean).join(" · ");
                  return (
                    <li key={entry.id} className="relative">
                      <span className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${entryMeta.dot}`} />
                      <p className="text-sm font-bold text-gray-900">{entryMeta.label}</p>
                      <p className="text-xs text-gray-500">{formatMoment(entry.changed_at)}</p>
                      {detail && <p className="mt-1 text-xs text-gray-600">{detail}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
