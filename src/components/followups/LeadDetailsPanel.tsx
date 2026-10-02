"use client";

import { useCallback, useEffect, useState } from "react";
import { getGPSLocationAndGeocode } from "@/lib/location";
import {
  errorMessage,
  formatMoment,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  requestJson,
  toDateInput,
  type Lead,
  type Remark,
  type Stage,
  type Staff,
} from "./shared";

interface LeadDetailsPanelProps {
  lead: Lead;
  stages: Stage[];
  staff: Staff[];
  /** Set when a drag was blocked because the lead still needs qualifying. */
  qualificationPrompt?: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}

interface DetailsForm {
  name: string;
  phone: string;
  address: string;
  district: string;
  panchayath: string;
  ward: string;
  waterSource: string;
  currentTank: string;
  houseStage: string;
  tankSizeInterest: string;
  latitude: string;
  longitude: string;
}

const toDetailsForm = (lead: Lead): DetailsForm => ({
  name: lead.name || "",
  phone: lead.phone,
  address: lead.address || "",
  district: lead.district || "",
  panchayath: lead.panchayath || "",
  ward: lead.ward || "",
  waterSource: lead.waterSource || "",
  currentTank: lead.currentTank || "",
  houseStage: lead.houseStage || "",
  tankSizeInterest: lead.tankSizeInterest || "",
  latitude: lead.latitude || "",
  longitude: lead.longitude || "",
});

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  );
}

export default function LeadDetailsPanel({ lead, stages, staff, qualificationPrompt, onClose, onChanged, onDeleted }: LeadDetailsPanelProps) {
  const [stage, setStage] = useState(lead.stage || stages[0]?.id || "");
  const [assignee, setAssignee] = useState(lead.followupAssignedTo || "");
  const [dueDate, setDueDate] = useState(toDateInput(lead.followupDueDate));

  const [isEditing, setIsEditing] = useState(Boolean(qualificationPrompt));
  const [details, setDetails] = useState<DetailsForm>(() => toDetailsForm(lead));
  const [isLocating, setIsLocating] = useState(false);

  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [isLoadingRemarks, setIsLoadingRemarks] = useState(true);
  const [newRemark, setNewRemark] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [panelError, setPanelError] = useState("");

  const leadId = lead.id;

  const loadRemarks = useCallback(async () => {
    setIsLoadingRemarks(true);
    try {
      const data = await requestJson<{ remarks: Remark[] }>(`/api/followups/${leadId}/remarks`);
      setRemarks(data.remarks);
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setIsLoadingRemarks(false);
    }
  }, [leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRemarks(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRemarks]);

  const updateDetails = <Key extends keyof DetailsForm>(field: Key, value: DetailsForm[Key]) =>
    setDetails((current) => ({ ...current, [field]: value }));

  async function captureLocation() {
    setIsLocating(true);
    setPanelError("");
    try {
      const result = await getGPSLocationAndGeocode();
      setDetails((current) => ({ ...current, address: result.address, latitude: result.latitude, longitude: result.longitude }));
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setIsLocating(false);
    }
  }

  async function saveFollowup() {
    setIsSaving(true);
    setPanelError("");
    try {
      await requestJson("/api/followups", {
        method: "PUT",
        body: JSON.stringify({ id: leadId, stage, followupAssignedTo: assignee || null, followupDueDate: dueDate || null }),
      });
      await Promise.all([onChanged(), loadRemarks()]);
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDetails() {
    setIsSaving(true);
    setPanelError("");
    try {
      await requestJson(`/api/contacts/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: details.name.trim() || null,
          phone: details.phone.trim(),
          address: details.address.trim() || null,
          district: details.district.trim() || null,
          panchayath: details.panchayath.trim() || null,
          ward: details.ward.trim() || null,
          waterSource: details.waterSource.trim() || null,
          currentTank: details.currentTank.trim() || null,
          houseStage: details.houseStage.trim() || null,
          tankSizeInterest: details.tankSizeInterest.trim() || null,
          latitude: details.latitude.trim() || null,
          longitude: details.longitude.trim() || null,
        }),
      });
      setIsEditing(false);
      await onChanged();
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function addRemark() {
    const remark = newRemark.trim();
    if (!remark) return;
    setIsSaving(true);
    setPanelError("");
    try {
      await requestJson(`/api/followups/${leadId}/remarks`, { method: "POST", body: JSON.stringify({ remark }) });
      setNewRemark("");
      await loadRemarks();
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLead() {
    setIsSaving(true);
    setPanelError("");
    try {
      await requestJson(`/api/contacts/${leadId}`, { method: "DELETE" });
      await onDeleted();
    } catch (caught) {
      setPanelError(errorMessage(caught));
      setIsSaving(false);
    }
  }

  const stageLabel = stages.find((item) => item.id === lead.stage)?.label || lead.stage || "No stage";

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <section className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="lead-details-title">
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 id="lead-details-title" className="flex items-center gap-2 text-lg font-bold text-[#0a192f] min-w-0">
            <span className="truncate">Lead details</span>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">{stageLabel}</span>
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete lead" className="p-2 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {qualificationPrompt && (
            <p className="px-6 py-3.5 bg-amber-50 border-b border-amber-100 text-sm font-medium text-amber-800">{qualificationPrompt}</p>
          )}
          {panelError && (
            <p role="alert" className="mx-6 mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{panelError}</p>
          )}

          {/* ── Basic information ─────────────────────────────────────────── */}
          <section className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-[#0a192f]">Basic information</h3>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setIsEditing(false); setDetails(toDetailsForm(lead)); }} className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
                  <button type="button" disabled={isSaving} onClick={() => void saveDetails()} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">{isSaving ? "Saving…" : "Save"}</button>
                </div>
              ) : (
                <button type="button" onClick={() => setIsEditing(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Edit</button>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>Name<input value={details.name} onChange={(event) => updateDetails("name", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Phone<input required value={details.phone} onChange={(event) => updateDetails("phone", event.target.value)} inputMode="tel" className={inputClass} /></label>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Address</span>
                    <button type="button" disabled={isLocating} onClick={() => void captureLocation()} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors">
                      {isLocating ? "Locating…" : "Use current location"}
                    </button>
                  </div>
                  <textarea rows={2} value={details.address} onChange={(event) => updateDetails("address", event.target.value)} placeholder="Full address" className={`${inputClass} h-auto py-2.5 resize-y`} />
                </div>
                <label className={labelClass}>District<input value={details.district} onChange={(event) => updateDetails("district", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Panchayath<input value={details.panchayath} onChange={(event) => updateDetails("panchayath", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Ward<input value={details.ward} onChange={(event) => updateDetails("ward", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Water source<input value={details.waterSource} onChange={(event) => updateDetails("waterSource", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Current tank<input value={details.currentTank} onChange={(event) => updateDetails("currentTank", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>House stage<input value={details.houseStage} onChange={(event) => updateDetails("houseStage", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Tank interest<input value={details.tankSizeInterest} onChange={(event) => updateDetails("tankSizeInterest", event.target.value)} placeholder="e.g. 1000" className={inputClass} /></label>
              </div>
            ) : (
              <>
                <h4 className="text-xl font-extrabold text-[#0a192f]">{lead.name || "Unnamed lead"}</h4>
                <a href={`tel:${lead.phone}`} className="mt-1 inline-block text-sm font-semibold text-blue-600">{lead.phone}</a>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="sm:col-span-2">
                    <Field label="Address" value={[lead.address, lead.district && `(${lead.district})`].filter(Boolean).join(" ") || undefined} />
                    {lead.latitude && lead.longitude && (
                      <a href={`https://maps.google.com/?q=${lead.latitude},${lead.longitude}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                        View on map
                      </a>
                    )}
                  </div>
                  <Field label="Panchayath / Ward" value={[lead.panchayath, lead.ward && `(Ward ${lead.ward})`].filter(Boolean).join(" ") || undefined} />
                  <Field label="Water source" value={lead.waterSource} />
                  <Field label="Current tank" value={lead.currentTank} />
                  <Field label="House stage" value={lead.houseStage} />
                  <Field label="Tank interest" value={lead.tankSizeInterest ? `${lead.tankSizeInterest} litre` : undefined} />
                </div>
              </>
            )}
          </section>

          {/* ── Follow-up management ──────────────────────────────────────── */}
          <section className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-[#0a192f] mb-4">Follow-up management</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`${labelClass} sm:col-span-2`}>
                Stage
                <select value={stage} onChange={(event) => setStage(event.target.value)} className={inputClass}>
                  {stages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Assigned to
                <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {assignee && !staff.some((member) => member.name === assignee) && <option value={assignee}>{assignee}</option>}
                  {staff.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Follow-up due
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
              </label>
            </div>
            <button type="button" disabled={isSaving} onClick={() => void saveFollowup()} className={`${primaryButtonClass} w-full mt-4`}>
              {isSaving ? "Saving…" : "Save follow-up changes"}
            </button>
          </section>

          {/* ── History ───────────────────────────────────────────────────── */}
          <section className="px-6 py-5">
            <h3 className="text-sm font-bold text-[#0a192f] mb-4">Follow-up history</h3>

            <div className="rounded-xl border border-gray-200 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
              <textarea
                rows={3}
                value={newRemark}
                onChange={(event) => setNewRemark(event.target.value)}
                placeholder="Log a call, a visit, or the next step…"
                className="w-full p-3 bg-transparent text-sm text-gray-900 outline-none resize-y placeholder:text-gray-400"
              />
              <div className="flex justify-end px-3 py-2 border-t border-gray-200">
                <button type="button" disabled={isSaving || !newRemark.trim()} onClick={() => void addRemark()} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">Save note</button>
              </div>
            </div>

            <ol className="mt-5 space-y-3">
              {isLoadingRemarks ? (
                <li className="py-4 text-center text-sm text-gray-500">Loading history…</li>
              ) : remarks.length === 0 ? (
                <li className="py-4 text-center text-sm text-gray-500">No notes yet. The first one you save shows up here.</li>
              ) : (
                remarks.map((remark) => (
                  <li key={remark.id} className={`p-3.5 rounded-xl border ${remark.isSystem ? "border-gray-200 bg-gray-50" : "border-blue-100 bg-blue-50/40"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-gray-900 truncate">{remark.staffName || "System"}</span>
                      <time className="text-[11px] text-gray-500 shrink-0">{formatMoment(remark.createdAt)}</time>
                    </div>
                    <p className="mt-1 text-sm text-gray-700 break-words">{remark.remark}</p>
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>
      </section>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-lead-title">
            <div className="px-6 pt-6">
              <h2 id="delete-lead-title" className="text-lg font-bold text-[#0a192f]">Delete this lead?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                This permanently removes <strong className="text-gray-900">{lead.name || lead.phone}</strong> from contacts along with its follow-up history.
              </p>
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isSaving} onClick={() => setShowDeleteConfirm(false)} className={ghostButtonClass}>Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => void deleteLead()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">
                {isSaving ? "Deleting…" : "Delete lead"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
