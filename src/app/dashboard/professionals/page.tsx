"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

// Must stay in step with the `professionals.type` enum and the API's own list.
const PROFESSIONAL_TYPES = ["Engineer", "Plumber", "Contractor", "Interior Designer", "Electrician", "Other"] as const;
type ProfessionalType = (typeof PROFESSIONAL_TYPES)[number];

interface Professional { id: number; name?: string; phone: string; type: ProfessionalType; place?: string; address?: string; district?: string; panchayath?: string; latitude?: string; longitude?: string; createdAt: string; }
interface ProfessionalForm { name: string; phone: string; type: ProfessionalType; place: string; address: string; district: string; panchayath: string; latitude: string; longitude: string; }
interface ProfessionalsResponse { success: boolean; data?: { professionals: Professional[]; total: number }; error?: { message?: string }; }

const blankProfessional = (type: ProfessionalType): ProfessionalForm => ({ name: "", phone: "", type, place: "", address: "", district: "", panchayath: "", latitude: "", longitude: "" });
const toForm = (professional: Professional): ProfessionalForm => ({
  name: professional.name || "", phone: professional.phone, type: professional.type, place: professional.place || "",
  address: professional.address || "", district: professional.district || "", panchayath: professional.panchayath || "",
  latitude: professional.latitude || "", longitude: professional.longitude || "",
});

const inputClass = "crm-input";
const selectClass = "crm-select";
const labelClass = "crm-field-label";

const typeStyles: Record<ProfessionalType, string> = {
  Engineer: "bg-blue-50 text-blue-600",
  Plumber: "bg-cyan-50 text-cyan-600",
  Contractor: "bg-amber-50 text-amber-600",
  "Interior Designer": "bg-violet-50 text-violet-600",
  Electrician: "bg-yellow-50 text-yellow-600",
  Other: "bg-slate-100 text-slate-600",
};

function TypeIcon({ type }: { type: ProfessionalType }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type === "Engineer" ? (
        <><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2Z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><path d="M14 6a6 6 0 0 1 6 6v3" /></>
      ) : type === "Plumber" ? (
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      ) : type === "Interior Designer" ? (
        <><path d="M6 19v-3h12v3" /><path d="M5 16V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>
      ) : type === "Electrician" ? (
        <path d="M13 2 4.5 13.5a.6.6 0 0 0 .5 1H11l-1 7.5 8.5-11.5a.6.6 0 0 0-.5-1H12l1-7.5Z" />
      ) : type === "Other" ? (
        <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.15-.7.6-.7 1.1v.4" /><path d="M12 17h.01" /></>
      ) : (
        <><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>
      )}
    </svg>
  );
}

export default function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState<ProfessionalType>("Engineer");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ professional?: Professional; values: ProfessionalForm } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Professional | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState("");
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("ogera_user"),
    () => null,
  );
  const isHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const canManage = useMemo(() => {
    if (!storedUser) return false;
    try {
      const role = (JSON.parse(storedUser) as { role?: string }).role;
      return role === "admin" || role === "sales_head";
    } catch { return false; }
  }, [storedUser]);

  const loadProfessionals = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setProfessionals([]); setTotal(0); setError("Sign in to load professionals."); setIsLoading(false); return; }
    setIsLoading(true); setError("");
    const parameters = new URLSearchParams({ type });
    if (submittedSearch) parameters.set("query", submittedSearch);
    try {
      const response = await fetch(`/api/professionals?${parameters}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json() as ProfessionalsResponse;
      if (!response.ok || !result.success || !result.data) { setProfessionals([]); setTotal(0); setError(result.error?.message || "Professionals could not be loaded. Please try again."); return; }
      setProfessionals(result.data.professionals); setTotal(result.data.total);
    } catch { setProfessionals([]); setTotal(0); setError("Professionals could not be loaded. Please check your connection and try again."); }
    finally { setIsLoading(false); }
  }, [type, submittedSearch]);

  useEffect(() => {
    if (!canManage) return;
    const timer = window.setTimeout(() => { void loadProfessionals(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canManage, loadProfessionals]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmittedSearch(search.trim()); };
  const updateForm = (field: keyof ProfessionalForm, value: string) => setEditor((current) => current ? { ...current, values: { ...current.values, [field]: value } } : current);

  async function saveProfessional(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before saving this professional."); return; }
    setIsSaving(true); setFormError("");
    const body = {
      ...editor.values,
      name: editor.values.name || null,
      place: editor.values.place || null,
      address: editor.values.address || null,
      district: editor.values.district || null,
      panchayath: editor.values.panchayath || null,
      latitude: editor.values.latitude || null,
      longitude: editor.values.longitude || null,
    };
    try {
      const response = await fetch(editor.professional ? `/api/professionals/${editor.professional.id}` : "/api/professionals", {
        method: editor.professional ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) { setFormError(result.error?.message || "Professional could not be saved. Please try again."); return; }
      setEditor(null); await loadProfessionals();
    } catch { setFormError("Professional could not be saved. Please check your connection and try again."); }
    finally { setIsSaving(false); }
  }

  async function deleteProfessional() {
    if (!deleteTarget) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before deleting this professional."); return; }
    setIsSaving(true); setFormError("");
    try {
      const response = await fetch(`/api/professionals/${deleteTarget.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) { setFormError(result.error?.message || "Professional could not be deleted. Please try again."); return; }
      setDeleteTarget(null); await loadProfessionals();
    } catch { setFormError("Professional could not be deleted. Please check your connection and try again."); }
    finally { setIsSaving(false); }
  }

  if (isHydrated && !canManage) {
    return (
      <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="11" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Restricted area</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">The professionals network is available to admins and sales heads only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <header className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-extrabold text-[#0a192f] tracking-tight leading-tight">Professionals Network</h1>
          <p className="text-sm text-gray-500 mt-1">Manage engineers, plumbers, and contractors connected to your sales and projects.</p>
        </div>
        <button
          type="button"
          onClick={() => { setFormError(""); setEditor({ values: blankProfessional(type) }); }}
          className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[.98] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add professional
        </button>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={submitSearch} className="flex items-center h-10 w-full sm:max-w-sm rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="professional-search">Search professionals</label>
          <svg className="w-4 h-4 ml-3 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="professional-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, or place" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          <button type="submit" className="h-full px-4 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Search</button>
        </form>

        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200" role="group" aria-label="Professional type">
          {PROFESSIONAL_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${type === item ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
            >
              {item}s
            </button>
          ))}
        </div>
      </section>

      <div className="px-1 text-xs text-gray-500">
        <span>{total > 0 ? `${total} ${type.toLowerCase()}${total === 1 ? "" : "s"}` : ""}</span>
      </div>

      {error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">!</span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Unable to load professionals</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{error}</p>
          <button type="button" onClick={() => void loadProfessionals()} className="mt-5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Loading professionals</h2>
          <p className="mt-2 text-sm text-gray-500">Fetching the latest records from your workspace.</p>
        </div>
      ) : professionals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeStyles[type]}`}><TypeIcon type={type} /></span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">{submittedSearch ? "No matches found" : `No ${type.toLowerCase()}s yet`}</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{submittedSearch ? `We could not find anyone matching "${submittedSearch}".` : `Add your first ${type.toLowerCase()} to start building the network.`}</p>
          {!submittedSearch && (
            <button type="button" onClick={() => { setFormError(""); setEditor({ values: blankProfessional(type) }); }} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">Add your first {type.toLowerCase()}</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {professionals.map((professional) => (
            <article key={professional.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors">
              <span className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${typeStyles[professional.type]}`}><TypeIcon type={professional.type} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 truncate">{professional.name || "Unnamed professional"}</h3>
                <a href={`tel:${professional.phone}`} className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                  <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
                  {professional.phone}
                </a>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className="truncate">{professional.place || "Place not added"}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => { setFormError(""); setEditor({ professional, values: toForm(professional) }); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors" aria-label={`Edit ${professional.name || professional.phone}`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button type="button" onClick={() => { setFormError(""); setDeleteTarget(professional); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors" aria-label={`Delete ${professional.name || professional.phone}`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-slate-900/50 sm:backdrop-blur-xs">
          <section className="flex min-h-dvh w-full flex-col bg-gray-50 sm:min-h-0 sm:max-h-[88vh] sm:max-w-lg sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="professional-form-title">
            <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 bg-white shrink-0">
              <div>
                <h2 id="professional-form-title" className="text-lg font-bold text-[#0a192f]">{editor.professional ? "Edit professional" : "Add professional"}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Capture the details needed to reach this professional.</p>
              </div>
              <button type="button" onClick={() => setEditor(null)} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </header>

            <form onSubmit={saveProfessional} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>Name<input value={editor.values.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="e.g. John Doe" className={inputClass} /></label>
                <label className={labelClass}>Phone number<input required value={editor.values.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="10-digit phone number" inputMode="tel" className={inputClass} /></label>
                <label className={labelClass}>Type<select value={editor.values.type} onChange={(event) => updateForm("type", event.target.value)} className={selectClass}>{PROFESSIONAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className={labelClass}>Place / Panchayath<input value={editor.values.place} onChange={(event) => updateForm("place", event.target.value)} placeholder="e.g. Vettathur" className={inputClass} /></label>

                <div className="sm:col-span-2 pt-1 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Location — used by the Field Map</p>
                </div>

                <label className={`${labelClass} sm:col-span-2`}>Address<input value={editor.values.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="House / street / landmark" className={inputClass} /></label>
                <label className={labelClass}>Panchayath<input value={editor.values.panchayath} onChange={(event) => updateForm("panchayath", event.target.value)} placeholder="e.g. Othukkungal" className={inputClass} /></label>
                <label className={labelClass}>District<input value={editor.values.district} onChange={(event) => updateForm("district", event.target.value)} placeholder="e.g. Malappuram" className={inputClass} /></label>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <label className={`${labelClass} flex-1`}>Latitude<input value={editor.values.latitude} onChange={(event) => updateForm("latitude", event.target.value)} placeholder="Optional" inputMode="decimal" className={inputClass} /></label>
                  <label className={`${labelClass} flex-1`}>Longitude<input value={editor.values.longitude} onChange={(event) => updateForm("longitude", event.target.value)} placeholder="Optional" inputMode="decimal" className={inputClass} /></label>
                  <button
                    type="button"
                    disabled={isLocating}
                    onClick={() => {
                      if (!navigator.geolocation) { setFormError("This browser cannot share a location."); return; }
                      setIsLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          updateForm("latitude", position.coords.latitude.toFixed(7));
                          updateForm("longitude", position.coords.longitude.toFixed(7));
                          setIsLocating(false);
                        },
                        () => { setFormError("Could not read your location. Enter the coordinates manually."); setIsLocating(false); },
                        { enableHighAccuracy: true, timeout: 10000 },
                      );
                    }}
                    className="min-h-11 px-3 shrink-0 rounded-lg border border-gray-200 bg-white text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    {isLocating ? "Locating…" : "Use GPS"}
                  </button>
                </div>

                {formError && <p role="alert" className="sm:col-span-2 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}
              </div>

              <footer className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end sm:px-6 sm:rounded-b-2xl">
                <button type="button" disabled={isSaving} onClick={() => setEditor(null)} className="min-h-11 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="min-h-11 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">{isSaving ? "Saving…" : editor.professional ? "Save changes" : "Add professional"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-professional-title">
            <div className="px-6 pt-6">
              <h2 id="delete-professional-title" className="text-lg font-bold text-[#0a192f]">Delete professional?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">This permanently removes <strong className="text-gray-900">{deleteTarget.name || deleteTarget.phone}</strong> and cannot be undone.</p>
              {formError && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isSaving} onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => void deleteProfessional()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">{isSaving ? "Deleting…" : "Delete professional"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
