"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import PhoneField, { validatePhone } from "@/components/PhoneField";
import SearchPicker, { type PickerItem } from "@/components/SearchPicker";
import { FilterBar, type FilterGroup } from "@/components/FilterPanel";
import FilterSelect from "@/components/FilterSelect";
import SelectField from "@/components/SelectField";
import { ApiError } from "@/lib/api/auth";
import { trace } from "@/lib/api/devlog";
import { getGPSLocationAndGeocode } from "@/lib/location";
import { useRouter } from "next/navigation";
import { canManageEmployees, listAllEmployees, type Employee } from "@/lib/api/employees";
import { createContact, deleteContact as deleteContactApi, getContact, listContacts, listLeadSources, updateContact, type ApiContact, type ApiContactType, type LeadSource } from "@/lib/api/contacts";

type Filters = { type: string; profession: string; source: string; district: string; assignedTo: string; createdBy: string };
const NO_FILTERS: Filters = { type: "", profession: "", source: "", district: "", assignedTo: "", createdBy: "" };
const PAGE_SIZE = 12;
const KIND_LABELS: Record<string, string> = { consumer: "Consumer", partner: "Partner", dealer: "Dealer" };
const TYPE_TABS = [{ value: "", label: "All" }, { value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }, { value: "dealer", label: "Dealer" }];
const PARTNER_TYPES = ["Contractor", "Engineer", "Plumber", "Other"];
type ContactSource = string;

interface Contact {
  id: number; kind: ApiContactType; profession?: string; name: string; phone: string; stage?: string; source?: string;
  address?: string; district?: string; assignedTo?: string; assignedToId?: number; createdAt: string;
}
interface ContactForm {
  name: string; phone: string; contactType: ApiContactType; source: ContactSource;
  address: string; district: string; houseStage: string; referredByContactId: number | null; assignedTo: string;
}

const blankContact: ContactForm = {
  name: "", phone: "", contactType: "consumer", source: "",
  address: "", district: "", houseStage: "", referredByContactId: null, assignedTo: "",
};
const fromApi = (contact: ApiContact): Contact => ({
  id: contact.id, name: contact.name, phone: contact.phone, kind: contact.contact_type, profession: contact.profession_type || undefined,
  source: contact.lead_source?.name, address: contact.address || undefined, district: contact.district,
  stage: contact.lead_stage?.stage, assignedTo: contact.assigned_to?.name, assignedToId: contact.assigned_to?.id, createdAt: contact.created_at,
});
const displayLocation = (contact: Contact) => contact.address || contact.district || "Location not added";
const toForm = (contact: Contact): ContactForm => ({
  name: contact.name, phone: contact.phone, contactType: contact.kind, source: contact.source ?? "",
  address: contact.address ?? "", district: contact.district ?? "", houseStage: "", referredByContactId: null,
  assignedTo: contact.assignedToId === undefined ? "" : String(contact.assignedToId),
});

const KERALA_DISTRICTS = [
  "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
  "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
];

const inputClass = "crm-input";
const textareaClass = "crm-textarea";
const labelClass = "crm-field-label";

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const hasFilters = Object.values(filters).some(Boolean);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ contact?: Contact; values: ContactForm; loading?: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [selectedReferral, setSelectedReferral] = useState<PickerItem | null>(null);

  const loadContacts = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    trace("log", "[contacts page] load triggered", { page, filters, search: submittedSearch, hasToken: !!accessToken });
    if (!accessToken) { setContacts([]); setTotal(0); setError("Sign in to load your contacts."); setIsLoading(false); return; }
    setIsLoading(true); setError("");
    try {
      const result = await listContacts(accessToken, { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, contact_type: (filters.type || undefined) as ApiContactType | undefined,
        profession_type: filters.type === "partner" ? filters.profession || undefined : undefined,
        lead_source_id: filters.source ? Number(filters.source) : undefined,
        district: filters.district || undefined,
        assigned_to: filters.assignedTo ? Number(filters.assignedTo) : undefined,
        created_by: filters.createdBy ? Number(filters.createdBy) : undefined,
        search: submittedSearch || undefined,
      });
      setContacts(result.items.map(fromApi)); setTotal(result.total);
    } catch (caught) {
      setContacts([]); setTotal(0);
      setError(caught instanceof ApiError ? caught.message : "Contacts could not be loaded. Please try again.");
    } finally { setIsLoading(false); }
  }, [page, filters, submittedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Sources are loaded once on page open; both the filters and the form use them.
  useEffect(() => {
    if (leadSources.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listLeadSources(accessToken).then(setLeadSources).catch(() => { /* the dropdown falls back to the current value only */ });
  }, [leadSources.length]);

  // Only admins and managers may read the employee list, so only they can change the owner.
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  // sessionStorage is browser-only, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const viewerRole = useMemo(() => { try { return (JSON.parse(storedUser ?? "null") as { role?: string } | null)?.role; } catch { return undefined; } }, [storedUser]);
  const canAssign = canManageEmployees(viewerRole) && !employeesFailed;
  useEffect(() => {
    if (!canAssign || employees.length > 0) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listAllEmployees(accessToken).then((result) => setEmployees(result.employees)).catch(() => setEmployeesFailed(true));
  }, [canAssign, employees.length]);
  const assigneeOptions = useMemo(() => {
    const options = employees.filter((employee) => employee.is_active).map((employee) => ({ value: String(employee.id), label: `${employee.name} · ${employee.role.replaceAll("_", " ")}` }));
    const currentId = editor?.contact?.assignedToId;
    if (currentId !== undefined && !options.some((option) => option.value === String(currentId))) options.unshift({ value: String(currentId), label: editor?.contact?.assignedTo ?? `Employee #${currentId}` });
    return editor?.contact ? options : [{ value: "", label: "Assign automatically" }, ...options];
  }, [employees, editor?.contact]);

  const employeeFilterOptions = useMemo(() => employees.map((employee) => ({ value: String(employee.id), label: employee.name })), [employees]);
  const filterGroups: FilterGroup[] = [
    { key: "source", label: "Lead source", value: filters.source, options: leadSources.map((item) => ({ value: String(item.id), label: item.name })) },
    { key: "district", label: "District", value: filters.district, options: KERALA_DISTRICTS.map((name) => ({ value: name, label: name })) },
    // Only admins and managers can read the employee list, so only they get the people filters.
    ...(canAssign ? [
      { key: "assignedTo", label: "Assigned to", value: filters.assignedTo, options: employeeFilterOptions },
      { key: "createdBy", label: "Created by", value: filters.createdBy, options: employeeFilterOptions },
    ] : []),
  ];
  const changeFilter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  // Partner type only applies to partners, so switching the contact type resets it.
  const changeType = (value: string) => { setFilters((current) => ({ ...current, type: value, profession: "" })); setPage(1); };
  const clearFilters = () => { setFilters(NO_FILTERS); setPage(1); };

  // Older records store "showroom" / "Meta" etc.; match them to a real source by name or slug, and keep unknown values selectable.
  const currentSource = editor?.values.source ?? "";
  const matchedSource = leadSources.find((item) => item.name.toLowerCase() === currentSource.toLowerCase() || item.slug === currentSource.toLowerCase());
  const sourceValue = matchedSource?.name ?? currentSource;
  // Older records may hold a district outside the list (e.g. "Calicut"); keep it selectable so it is not lost on edit.
  const currentDistrict = editor?.values.district ?? "";
  const districtOptions = useMemo(() => {
    const names = KERALA_DISTRICTS.includes(currentDistrict) || !currentDistrict.trim() ? KERALA_DISTRICTS : [currentDistrict, ...KERALA_DISTRICTS];
    return names.map((name) => ({ value: name, label: name }));
  }, [currentDistrict]);
  const sourceOptions = useMemo(() => {
    const names = leadSources.map((item) => item.name);
    return sourceValue && !names.includes(sourceValue) ? [sourceValue, ...names] : names;
  }, [leadSources, sourceValue]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadContacts(); }, 0); return () => window.clearTimeout(timer); }, [loadContacts]);

  // Search as you type: wait for a short pause, then query the API from the first page.
  useEffect(() => {
    const term = search.trim();
    const timer = window.setTimeout(() => { setSubmittedSearch(term); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => event.preventDefault();
  const updateForm = <Field extends keyof ContactForm>(field: Field, value: ContactForm[Field]) =>
    setEditor((current) => current ? { ...current, values: { ...current.values, [field]: value } } : current);

  const openEditor = (contact?: Contact) => {
    setFormError("");
    setSelectedReferral(null);
    setEditor(contact ? { contact, values: toForm(contact), loading: true } : { values: blankContact });
    if (!contact) return;
    // List rows lack the referrer and house stage, so load the full record.
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setEditor((current) => current ? { ...current, loading: false } : current); return; }
    getContact(accessToken, contact.id)
      .then((detail) => {
        if (detail.referred_by) setSelectedReferral({ id: detail.referred_by.id, primary: detail.referred_by.name, secondary: detail.referred_by.phone ?? undefined });
        setEditor((current) => current?.contact?.id === contact.id ? {
          ...current, loading: false,
          values: { ...current.values, district: detail.district, address: detail.address ?? "", houseStage: detail.consumer_profile?.house_stage ?? "", referredByContactId: detail.referred_by_id },
        } : current);
      })
      .catch((caught) => {
        setEditor((current) => current?.contact?.id === contact.id ? { ...current, loading: false } : current);
        setFormError(caught instanceof ApiError ? caught.message : "Contact details could not be loaded.");
      });
  };

  const searchReferral = useCallback(async (query: string): Promise<PickerItem[]> => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return [];
    const result = await listContacts(accessToken, { limit: 10, search: query });
    return result.items
      .filter((item) => item.id !== editor?.contact?.id)
      .map((item) => ({ id: item.id, primary: item.name || "Unnamed contact", secondary: item.phone }));
  }, [editor?.contact?.id]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before saving this contact."); return; }
    const values = editor.values;
    const phoneValidation = validatePhone(values.phone);
    if (!phoneValidation.valid) { setFormError(phoneValidation.message || "Invalid phone number"); return; }
    if (!values.name.trim()) { setFormError("Name is required."); return; }
    if (!values.district.trim()) { setFormError("District is required."); return; }
    if (!values.address.trim()) { setFormError("Address is required."); return; }

    const source = leadSources.find((item) => item.name === sourceValue);
    const houseStage = values.houseStage.trim();
    const body = {
      contact_type: values.contactType,
      name: values.name.trim(),
      phone: values.phone,
      district: values.district.trim(),
      address: values.address.trim(),
      referred_by_id: values.referredByContactId,
      lead_source_id: source?.id ?? null,
      // Send the owner only when it was chosen (create) or changed (edit); otherwise the backend keeps or auto-picks it.
      ...(values.assignedTo && values.assignedTo !== String(editor.contact?.assignedToId ?? "") ? { assigned_to: Number(values.assignedTo) } : {}),
      ...(values.contactType === "consumer" && (houseStage || editor.contact) ? { consumer_profile: { house_stage: houseStage || null } } : {}),
    };
    setIsSaving(true); setFormError("");
    try {
      if (editor.contact) {
        await updateContact(accessToken, editor.contact.id, body);
      } else {
        // Offline (field visit) leads must carry the GPS position of the visit.
        const coordinates = source?.slug === "offline" ? await getGPSLocationAndGeocode().catch(() => null) : null;
        if (source?.slug === "offline" && !coordinates) { setFormError("Allow location access to save an Offline contact."); return; }
        await createContact(accessToken, { ...body, ...(coordinates ? { latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude) } : {}) });
      }
      setEditor(null); await loadContacts();
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setFormError(caught instanceof ApiError ? caught.message : "Contact could not be saved. Please try again.");
    } finally { setIsSaving(false); }
  }

  async function deleteContact() {
    if (!deleteTarget) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before deleting this contact."); return; }
    setIsSaving(true); setFormError("");
    try {
      await deleteContactApi(accessToken, deleteTarget.id);
      setDeleteTarget(null); await loadContacts();
    } catch (caught) {
      if (caught instanceof ApiError && caught.kind === "invalid_credentials") { router.push("/"); return; }
      setFormError(caught instanceof ApiError ? caught.message : "Contact could not be deleted. Please try again.");
    } finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" /> Customer directory
            </p>
            <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Contacts</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">Find, add and manage everyone in your Ogera CRM pipeline.</p>
          </div>
          <div className="grid grid-cols-1 sm:flex gap-3 shrink-0">
            <button type="button" onClick={() => openEditor()} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-white text-[#0a192f] text-sm font-bold shadow-lg shadow-black/20 hover:bg-sky-50 active:scale-[.98] transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add contact
            </button>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={submitSearch} className="flex items-center h-11 w-full lg:max-w-md rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
            <label className="sr-only" htmlFor="contact-search">Search contacts</label>
            <svg className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
            <input id="contact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or phone" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-2 mr-1 text-gray-400 hover:text-gray-700"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
          </form>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
            {filters.type === "partner" && (
              <FilterSelect label="Partner type" value={filters.profession} onChange={(value) => changeFilter("profession", value)}
                options={[{ value: "", label: "All" }, ...PARTNER_TYPES.map((name) => ({ value: name, label: name }))]}
                icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} className="w-full sm:w-60" />
            )}
            <FilterSelect label="Type" value={filters.type} onChange={changeType}
              options={TYPE_TABS.map((tab) => ({ value: tab.value, label: tab.value ? tab.label : "All" }))}
              icon={<><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></>} className="w-full sm:w-52" />
          </div>
        </div>

        <FilterBar groups={filterGroups} onChange={changeFilter} onClear={clearFilters} />
      </section>

      {total > 0 && !error && !isLoading && (
        <div className="flex justify-between px-1 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{total} contact{total === 1 ? "" : "s"}</span>
          <span>Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)}</span>
        </div>
      )}

      {error ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">!</span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">Unable to load contacts</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{error}</p>
          <button type="button" onClick={() => void loadContacts()} className="mt-6 inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading contacts">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-2xl bg-gray-200" />
                <div className="flex-1 space-y-2.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /><div className="h-3 w-1/3 rounded bg-gray-100" /></div>
              </div>
              <div className="mt-5 space-y-2"><div className="h-3 w-3/4 rounded bg-gray-100" /><div className="h-3 w-1/2 rounded bg-gray-100" /></div>
            </div>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></svg>
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">{submittedSearch || hasFilters ? "No matches found" : "No contacts yet"}</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{submittedSearch || hasFilters ? "Try a different search term or filter." : "Add your first contact to start building the pipeline."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!submittedSearch && !hasFilters
              ? <button type="button" onClick={() => openEditor()} className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 transition-all">Add your first contact</button>
              : <button type="button" onClick={() => { setSearch(""); setSubmittedSearch(""); clearFilters(); }} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Clear filters</button>}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-[11px] font-extrabold tracking-wider uppercase border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Contact</th>
                    <th scope="col" className="px-4 py-3.5">Type</th>
                    <th scope="col" className="px-4 py-3.5">Location</th>
                    <th scope="col" className="px-4 py-3.5">Source</th>
                    <th scope="col" className="px-4 py-3.5">Stage</th>
                    <th scope="col" className="px-4 py-3.5">Added</th>
                    <th scope="col" className="px-4 py-3.5 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map((contact) => (
                    <tr key={contact.id} onClick={() => openEditor(contact)} className="group cursor-pointer hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${contact.kind === "partner" ? "from-slate-400 to-slate-600" : "from-blue-500 to-blue-700"} text-white text-sm font-extrabold flex items-center justify-center shadow-sm`}>
                            {(contact.name || contact.phone).charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex flex-col">
                            <span className="font-bold text-[#0a192f] truncate group-hover:text-blue-700 transition-colors">{contact.name || "Unnamed contact"}</span>
                            <span className="text-xs text-gray-500">{contact.phone}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${contact.kind === "partner" ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{contact.kind === "partner" && contact.profession ? contact.profession : KIND_LABELS[contact.kind] ?? contact.kind}</span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 max-w-[16rem] truncate">{displayLocation(contact)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{contact.source || "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 capitalize">{contact.stage ? contact.stage.replaceAll("_", " ") : "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-500">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(contact.createdAt))}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <button type="button" onClick={(event) => { event.stopPropagation(); openEditor(contact); }} aria-label={`Edit ${contact.name || contact.phone}`} title="Edit" className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); setFormError(""); setDeleteTarget(contact); }} aria-label={`Delete ${contact.name || contact.phone}`} title="Delete" className="p-2 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phones get cards — a table would scroll sideways. */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {contacts.map((contact) => (
            <article key={contact.id} className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-0.5 transition-all">
              <button type="button" onClick={() => openEditor(contact)} className="block w-full text-left p-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-blue-600">
                <div className="flex items-start gap-4">
                  <span className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${contact.kind === "partner" ? "from-slate-400 to-slate-600" : "from-blue-500 to-blue-700"} text-white text-sm font-extrabold flex items-center justify-center shadow-md shadow-slate-900/10 ring-2 ring-white`}>
                    {(contact.name || contact.phone).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 pr-[4.5rem]">
                    <h3 className="font-bold text-[#0a192f] truncate group-hover:text-blue-700 transition-colors">{contact.name || "Unnamed contact"}</h3>
                    <span className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${contact.kind === "partner" ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{contact.kind === "partner" && contact.profession ? contact.profession : KIND_LABELS[contact.kind] ?? contact.kind}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-gray-500">
                  <p className="flex items-center gap-2 truncate"><svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg><span className="truncate">{contact.phone}</span></p>
                  <p className="flex items-center gap-2 truncate"><svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg><span className="truncate">{displayLocation(contact)}</span></p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-400">
                  <span>Added {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(contact.createdAt))}</span>
                  <span className="capitalize">{contact.source || "Source not recorded"}</span>
                </div>
              </button>
              <div className="absolute top-4 right-4 flex gap-1">
                <button type="button" onClick={() => openEditor(contact)} aria-label={`Edit ${contact.name || contact.phone}`} title="Edit" className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button type="button" onClick={() => { setFormError(""); setDeleteTarget(contact); }} aria-label={`Delete ${contact.name || contact.phone}`} title="Delete" className="p-2 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            </article>
          ))}
        </div>
        </>
      )}

      {!error && !isLoading && total > 0 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Contacts pagination">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 1} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </nav>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 bg-white overflow-hidden md:bg-slate-900/50 md:backdrop-blur-xs md:flex md:items-center md:justify-center md:overflow-visible md:p-4">
          <section className="w-full h-dvh md:w-full md:h-auto md:max-w-xl md:max-h-[90vh] bg-gray-50 md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="contact-form-title">
            <header className="relative overflow-hidden bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] px-5 py-5 text-white shrink-0">
              <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
              <button type="button" onClick={() => setEditor(null)} aria-label="Close" className="absolute top-4 right-4 z-10 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
              <h2 id="contact-form-title" className="relative pr-10 text-xl font-extrabold tracking-tight">{editor.contact ? "Edit contact" : "Add contact"}</h2>
            </header>

            <form onSubmit={saveContact} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={labelClass}>
                    Name
                    <input value={editor.values.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Full name" className={inputClass} />
                  </label>
                  <SelectField label="Type" value={editor.values.contactType} onChange={(value) => updateForm("contactType", value as ApiContactType)} options={[{ value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }, { value: "dealer", label: "Dealer" }]} />

                  <div className="sm:col-span-2">
                    <PhoneField key={editor.contact?.id ?? "new"} value={editor.values.phone} onChange={(value) => updateForm("phone", value)} />
                  </div>

                  <SelectField label="Source" value={sourceValue} onChange={(value) => updateForm("source", value as ContactSource)} placeholder="Not recorded" options={[{ value: "", label: "Not recorded" }, ...sourceOptions.map((name) => ({ value: name, label: name }))]} />
                  {editor.values.contactType === "consumer" && (
                    <>
                  <SelectField
                    label="House stage"
                    value={editor.values.houseStage.startsWith("Under Construction") ? "Under Construction" : editor.values.houseStage}
                    onChange={(value) => updateForm("houseStage", value === "Under Construction" ? "Under Construction - Structure" : value)}
                    placeholder="Not recorded"
                    options={[{ value: "", label: "Not recorded" }, { value: "Under Construction", label: "Under construction" }, { value: "Ready", label: "Ready" }, { value: "Renovation", label: "Renovation" }]}
                  />
                  {editor.values.houseStage.startsWith("Under Construction") && (
                    <div className="sm:col-span-2">
                      <SelectField
                        label="Construction phase"
                        value={editor.values.houseStage.includes(" - ") ? editor.values.houseStage.split(" - ")[1] : "Structure"}
                        onChange={(value) => updateForm("houseStage", `Under Construction - ${value}`)}
                        options={[{ value: "Structure", label: "Structure" }, { value: "Plastering", label: "Plastering" }, { value: "Finishing", label: "Finishing" }]}
                      />
                    </div>
                  )}
                    </>
                  )}

                  <SelectField label="District" value={editor.values.district} onChange={(value) => updateForm("district", value)} placeholder="Select district" options={districtOptions} />

                  <label className={`${labelClass} sm:col-span-2`}>
                    Address
                    <textarea value={editor.values.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Street, area or landmark" rows={2} className={textareaClass} />
                  </label>

                  {canAssign && assigneeOptions.length > 0 ? (
                    <div className="sm:col-span-2">
                      <SelectField label="Assigned to" value={editor.values.assignedTo} onChange={(value) => updateForm("assignedTo", value)} placeholder="Select employee" options={assigneeOptions} />
                    </div>
                  ) : (
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-gray-700">Assigned to</span>
                    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3">
                      {editor.contact?.assignedTo ? (
                        <>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-extrabold text-white">
                            {editor.contact.assignedTo.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                          </span>
                          <span className="truncate text-sm font-semibold text-gray-900">{editor.contact.assignedTo}</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">{editor.contact ? "Not assigned" : "Assigned automatically when you save"}</span>
                      )}
                    </div>
                  </div>
                  )}

                  <div className="sm:col-span-2">
                    <SearchPicker
                      label="Referred by"
                      placeholder="Search by name or phone"
                      selected={selectedReferral}
                      search={searchReferral}
                      onSelect={(item) => {
                        setSelectedReferral(item);
                        updateForm("referredByContactId", item ? item.id : null);
                      }}
                    />
                  </div>
                </div>

                {formError && (
                  <div role="alert" className="mt-4 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700 flex items-start gap-3">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              <footer className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end sm:px-5">
                <button type="button" disabled={isSaving} onClick={() => setEditor(null)} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving || editor.loading} className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 active:scale-[.98] disabled:opacity-60 transition-all">
                  {isSaving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {isSaving ? "Saving…" : editor.contact ? "Save changes" : "Add contact"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="px-6 pt-6">
              <h2 id="delete-title" className="text-lg font-bold text-[#0a192f]">Delete contact?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">This permanently removes <strong className="text-gray-900">{deleteTarget.name || deleteTarget.phone}</strong> and cannot be undone.</p>
              {formError && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isSaving} onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => void deleteContact()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">{isSaving ? "Deleting…" : "Delete contact"}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
