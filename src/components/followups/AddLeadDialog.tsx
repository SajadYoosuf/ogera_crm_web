"use client";

import { FormEvent, useEffect, useState } from "react";
import { errorMessage, ghostButtonClass, inputClass, labelClass, primaryButtonClass, requestJson, selectClass, textareaClass, type Lead, type Stage, type Staff } from "./shared";

interface AddLeadDialogProps {
  stages: Stage[];
  staff: Staff[];
  initialStage: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

interface LeadForm {
  name: string;
  phone: string;
  houseStage: string;
  tankSizeInterest: string;
  stage: string;
  followupAssignedTo: string;
  followupDueDate: string;
  note: string;
}

interface ContactMatch { id: number; name?: string; phone: string }

export default function AddLeadDialog({ stages, staff, initialStage, onClose, onCreated }: AddLeadDialogProps) {
  const [values, setValues] = useState<LeadForm>({
    name: "",
    phone: "",
    houseStage: "",
    tankSizeInterest: "",
    stage: initialStage,
    followupAssignedTo: "",
    followupDueDate: "",
    note: "",
  });
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [linkedContact, setLinkedContact] = useState<ContactMatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const updateForm = <Field extends keyof LeadForm>(field: Field, value: LeadForm[Field]) =>
    setValues((current) => ({ ...current, [field]: value }));

  // An existing contact can be promoted straight onto the board instead of being duplicated.
  useEffect(() => {
    const query = search.trim();
    const isSearchable = !linkedContact && query.length >= 2;
    const timer = window.setTimeout(async () => {
      if (!isSearchable) { setMatches([]); return; }
      setIsSearching(true);
      try {
        const data = await requestJson<{ contacts: ContactMatch[] }>(`/api/contacts?limit=5&query=${encodeURIComponent(query)}`);
        setMatches(data.contacts);
      } catch {
        setMatches([]);
      } finally {
        setIsSearching(false);
      }
    }, isSearchable ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [search, linkedContact]);

  function linkContact(contact: ContactMatch) {
    setLinkedContact(contact);
    setMatches([]);
    setValues((current) => ({ ...current, name: contact.name || "", phone: contact.phone }));
  }

  function unlinkContact() {
    setLinkedContact(null);
    setSearch("");
    setValues((current) => ({ ...current, name: "", phone: "" }));
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError("");
    try {
      let leadId = linkedContact?.id;
      if (!leadId) {
        const created = await requestJson<Lead>("/api/contacts", {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim() || null,
            phone: values.phone.trim(),
            contactType: "lead",
            source: "offline",
            houseStage: values.houseStage.trim() || null,
            tankSizeInterest: values.tankSizeInterest.trim() || null,
            remarks: values.note.trim() || null,
          }),
        });
        leadId = created.id;
      }

      await requestJson("/api/followups", {
        method: "PUT",
        body: JSON.stringify({
          id: leadId,
          stage: values.stage,
          followupAssignedTo: values.followupAssignedTo || null,
          followupDueDate: values.followupDueDate || null,
        }),
      });

      if (values.note.trim()) {
        await requestJson(`/api/followups/${leadId}/remarks`, { method: "POST", body: JSON.stringify({ remark: values.note.trim() }) });
      }

      await onCreated();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <section className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="add-lead-title">
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 id="add-lead-title" className="text-lg font-bold text-[#0a192f]">Add lead to follow-up</h2>
            <p className="text-sm text-gray-500 mt-0.5">Link an existing contact or capture a new one, then assign the follow-up.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <form onSubmit={saveLead} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <section className="crm-section space-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-600">Search existing contact</span>
              {linkedContact ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900 truncate">{linkedContact.name || "Unnamed contact"}</p>
                    <p className="text-xs text-blue-700">{linkedContact.phone}</p>
                  </div>
                  <button type="button" onClick={unlinkContact} aria-label="Unlink contact" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type a name or phone number" className={inputClass} />
                  {(isSearching || matches.length > 0 || search.trim().length >= 2) && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                      {isSearching ? (
                        <p className="px-3 py-2.5 text-sm text-gray-500">Searching…</p>
                      ) : matches.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-gray-500">No contact matches “{search.trim()}”. Fill the form below to create one.</p>
                      ) : (
                        matches.map((contact) => (
                          <button key={contact.id} type="button" onClick={() => linkContact(contact)} className="w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <p className="text-sm font-medium text-gray-900 truncate">{contact.name || "Unnamed contact"}</p>
                            <p className="text-xs text-gray-500">{contact.phone}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={labelClass}>
                Full name
                <input value={values.name} disabled={Boolean(linkedContact)} onChange={(event) => updateForm("name", event.target.value)} placeholder="e.g. John Doe" className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`} />
              </label>
              <label className={labelClass}>
                Phone number <span className="text-rose-600">*</span>
                <input required value={values.phone} disabled={Boolean(linkedContact)} onChange={(event) => updateForm("phone", event.target.value)} placeholder="10-digit phone number" inputMode="tel" className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`} />
              </label>
              <label className={labelClass}>
                House stage
                <input value={values.houseStage} disabled={Boolean(linkedContact)} onChange={(event) => updateForm("houseStage", event.target.value)} placeholder="e.g. Foundation" className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`} />
              </label>
              <label className={labelClass}>
                Tank interest
                <input value={values.tankSizeInterest} disabled={Boolean(linkedContact)} onChange={(event) => updateForm("tankSizeInterest", event.target.value)} placeholder="e.g. 1000" className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`} />
              </label>
            </div>
            </section>

            <section className="crm-section space-y-4">
              <h3 className="crm-section-title">Follow-up assignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>
                  Stage
                  <select value={values.stage} onChange={(event) => updateForm("stage", event.target.value)} className={selectClass}>
                    {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>
                  Assign to
                  <select value={values.followupAssignedTo} onChange={(event) => updateForm("followupAssignedTo", event.target.value)} className={selectClass}>
                    <option value="">Unassigned</option>
                    {staff.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Follow-up due date
                  <input type="date" value={values.followupDueDate} onChange={(event) => updateForm("followupDueDate", event.target.value)} className={inputClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Note for the assignee
                  <textarea rows={3} value={values.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="e.g. Call about a custom tank size" className={`${textareaClass} resize-y`} />
                </label>
              </div>
            </section>

            {formError && <p role="alert" className="px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}
          </div>

          <footer className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end sm:px-6">
            <button type="button" disabled={isSaving} onClick={onClose} className={ghostButtonClass}>Cancel</button>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>{isSaving ? "Saving…" : "Add lead"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
