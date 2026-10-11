"use client";

import { type FormEvent, useMemo, useState } from "react";
import PhoneField from "@/components/PhoneField";
import SearchPicker from "@/components/SearchPicker";
import type { FilterGroup } from "@/components/FilterPanel";
import SelectField from "@/components/SelectField";
import ContactExportModal from "@/features/contacts/components/ContactExportModal";
import ContactImportModal from "@/features/contacts/components/ContactImportModal";
import ContactRowMenu from "@/features/contacts/components/ContactRowMenu";
import VerifiedBadge from "@/features/contacts/components/VerifiedBadge";
import ContactsMoreMenu from "@/features/contacts/components/ContactsMoreMenu";
import ContactsFilterMenu from "@/features/contacts/components/ContactsFilterMenu";
import ContactsSortMenu from "@/features/contacts/components/ContactsSortMenu";
import { canManageEmployees, isMonitoringRole } from "@/lib/api/employees";
import { useContactLookups } from "@/features/contacts/hooks/useContactLookups";
import { useContactsList } from "@/features/contacts/hooks/useContactsList";
import { useContactEditor } from "@/features/contacts/hooks/useContactEditor";
import { type ApiContactType } from "@/features/contacts/api/contacts";
import { KIND_LABELS, PAGE_SIZE, TYPE_TABS, professionLabel, type Contact, type ContactSource } from "@/features/contacts/utils";

const inputClass = "crm-input";
const textareaClass = "crm-textarea";
const labelClass = "crm-field-label";

// Contacts design: purple accent, pastel avatars and a 1px-border table card.
const ACCENT_BUTTON = "bg-[#6E4FF6] text-white transition-colors hover:bg-[#5B3FD6]";
const AVATAR_TONES = ["bg-[#EDE9FE] text-[#5B3FD6]", "bg-[#E0F2FE] text-[#0B6AA8]", "bg-[#DCFCE7] text-[#167A44]", "bg-[#FEF3C7] text-[#9A6200]", "bg-[#FCE7F3] text-[#A8326E]"];
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const initialOf = (contact: Contact) => (contact.name || contact.phone).charAt(0).toUpperCase();
const avatarTone = (contact: Contact) => AVATAR_TONES[contact.id % AVATAR_TONES.length];
const typeTone = (contact: Contact) => (contact.kind === "partner" ? "bg-[#F1EDFF] text-[#5B3FD6]" : "bg-[#EEF4FF] text-[#1D5BBF]");

// Page buttons with ellipses (1 2 3 … 57), so long lists keep a short pager.
function pageItems(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: (number | "…")[] = [1];
  if (page > 3) items.push("…");
  for (let current = Math.max(2, page - 1); current <= Math.min(totalPages - 1, page + 1); current += 1) items.push(current);
  if (page < totalPages - 2) items.push("…");
  items.push(totalPages);
  return items;
}

/** Contacts screen: layout and derived options. State and API calls live in the contacts hooks. */
export default function ContactsView() {
  const { leadSources, partnerTypes, districtNames, employees, viewerRole, canAssign } = useContactLookups();
  const {
    contacts, total, totalPages, typeCounts, page, setPage, search, setSearch, submittedSearch, filters, hasFilters, sort,
    isLoading, error, loadContacts, changeFilter, changeType, changeSort, clearFilters, clearSearchAndFilters,
  } = useContactsList();
  const {
    editor, openEditor, closeEditor, updateForm, saveContact, searchReferral, sourceValue,
    deleteTarget, setDeleteTarget, deleteContact, isSaving, formError, setFormError, selectedReferral, setSelectedReferral,
  } = useContactEditor({ leadSources, onSaved: loadContacts });
  const [ioDialog, setIoDialog] = useState<"import" | "export" | null>(null);
  // Row selection is kept for the page; there are no bulk actions yet, so it is cleared when the page changes.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());

  const submitSearch = (event: FormEvent<HTMLFormElement>) => event.preventDefault();
  const goToPage = (next: number) => { setSelectedIds(new Set()); setPage(next); };
  const toggleSelected = (id: number) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOnPageSelected = contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));
  const toggleAllOnPage = () => setSelectedIds(allOnPageSelected ? new Set() : new Set(contacts.map((contact) => contact.id)));

  const assigneeOptions = useMemo(() => {
    // Rule 1 (rule.md): admins and managers monitor and never carry a lead, so they are not offered as an assignee.
    const options = employees.filter((employee) => employee.is_active && !isMonitoringRole(employee.role)).map((employee) => ({ value: String(employee.id), label: `${employee.name} · ${employee.role.replaceAll("_", " ")}` }));
    const currentId = editor?.contact?.assignedToId;
    if (currentId !== undefined && !options.some((option) => option.value === String(currentId))) options.unshift({ value: String(currentId), label: editor?.contact?.assignedTo ?? `Employee #${currentId}` });
    return editor?.contact ? options : [{ value: "", label: "Assign automatically" }, ...options];
  }, [employees, editor?.contact]);

  const employeeFilterOptions = useMemo(() => employees.map((employee) => ({ value: String(employee.id), label: employee.name })), [employees]);
  const filterGroups: FilterGroup[] = [
    { key: "verified", label: "Status", value: filters.verified, options: [{ value: "verified", label: "Verified" }, { value: "unverified", label: "Unverified" }] },
    { key: "source", label: "Lead source", value: filters.source, options: leadSources.map((item) => ({ value: String(item.id), label: item.name })) },
    { key: "district", label: "District", value: filters.district, options: districtNames.map((name) => ({ value: name, label: name })) },
    // Only admins and managers can read the employee list, so only they get the people filters.
    ...(canAssign ? [
      { key: "assignedTo", label: "Assigned to", value: filters.assignedTo, options: employeeFilterOptions },
      { key: "createdBy", label: "Created by", value: filters.createdBy, options: employeeFilterOptions },
    ] : []),
  ];

  // Type is a tab, so the panel holds the rest; partner type only appears for partners.
  const allFilterGroups: FilterGroup[] = [
    ...filterGroups,
    ...(filters.type === "partner" ? [{ key: "profession", label: "Partner type", value: filters.profession, options: partnerTypes }] : []),
  ];
  const activeChips = allFilterGroups
    .filter((group) => group.value)
    .map((group) => ({ key: group.key, label: group.label, value: group.options.find((option) => option.value === group.value)?.label ?? group.value }));

  // Older records may hold a district outside the list (e.g. "Calicut"); keep it selectable so it is not lost on edit.
  const currentDistrict = editor?.values.district ?? "";
  const districtOptions = useMemo(() => {
    const names = districtNames.includes(currentDistrict) || !currentDistrict.trim() ? districtNames : [currentDistrict, ...districtNames];
    return names.map((name) => ({ value: name, label: name }));
  }, [currentDistrict, districtNames]);
  const sourceOptions = useMemo(() => {
    // Offline (field visit) contacts come from the mobile app, which records the GPS location, so the web cannot create them.
    const names = leadSources.filter((item) => editor?.contact || item.slug !== "offline").map((item) => item.name);
    return sourceValue && !names.includes(sourceValue) ? [sourceValue, ...names] : names;
  }, [leadSources, sourceValue, editor?.contact]);

  const tableColumns = ["Contact", "Contact Type", "Contact Number", "Location", "Source", "Stage", ...(canAssign ? ["Assigned to"] : []), "Status"];
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-b border-[#E7E7EA] bg-white py-3 pl-16 pr-5 sm:px-7 lg:h-[72px] lg:py-0 lg:pl-7">
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-[#1A1C21]">Contacts</h1>
        <div className="flex items-center gap-2.5">
          <ContactsMoreMenu canImport={canManageEmployees(viewerRole)} onImport={() => setIoDialog("import")} onExport={() => setIoDialog("export")} />
          <button type="button" onClick={() => openEditor()} className={`inline-flex h-10 items-center gap-2 rounded-[8px] px-4 text-sm font-semibold ${ACCENT_BUTTON}`}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add Contact
          </button>
        </div>
      </header>

      <div className="space-y-4 p-5 sm:px-7 sm:py-6">
        <section aria-label="Contact list" className="flex flex-col overflow-hidden rounded-[14px] border border-[#E7E7EA] bg-white">
          {/* Toolbar: type tabs, search and filters */}
          <div className="flex flex-col gap-3 border-b border-[#EFEFF2] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div role="tablist" aria-label="Contact type" className="inline-flex w-fit gap-0.5 rounded-[9px] bg-[#F3F3F5] p-[3px]">
                {TYPE_TABS.map((tab) => {
                  const active = filters.type === tab.value;
                  return (
                    <button
                      key={tab.value || "all"}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => changeType(tab.value)}
                      className={`inline-flex h-[34px] items-center gap-1.5 rounded-[7px] px-3.5 text-sm leading-none transition-colors ${active ? "bg-white font-semibold text-[#1A1C21] shadow-sm" : "font-medium text-[#5F6473] hover:text-[#1A1C21]"}`}
                    >
                      {tab.label}
                      <span className={`text-xs font-medium leading-none tabular-nums ${active ? "text-[#6E4FF6]" : "text-[#8A8F9C]"}`}>{(typeCounts[tab.value] ?? 0).toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={submitSearch} className="relative flex">
                <label className="sr-only" htmlFor="contact-search">Search contacts</label>
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
                <input
                  id="contact-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or phone…"
                  className={`h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white pl-9 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#C9C0FF] sm:w-[260px] ${search ? "pr-9" : "pr-3"}`}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A8F9C] hover:text-[#1A1C21]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </form>
            </div>

            <div className="flex items-center gap-2">
              <ContactsSortMenu value={sort} onChange={changeSort} />
              <ContactsFilterMenu groups={allFilterGroups} onChange={changeFilter} onClear={clearFilters} />
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#EFEFF2] px-4 py-3">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => changeFilter(chip.key, "")}
                  aria-label={`Remove ${chip.label} filter: ${chip.value}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#F1EDFF] pl-3 pr-2 text-xs font-semibold text-[#5B3FD6] transition-colors hover:bg-[#E6DEFF]"
                >
                  <span className="font-medium text-[#8B73F9]">{chip.label}</span>
                  {chip.value}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="px-2 text-xs font-semibold text-[#6B7080] transition-colors hover:text-[#1A1C21]">Clear all</button>
            </div>
          )}

          {error ? (
            <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">Unable to load contacts</h2>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">{error}</p>
              <button type="button" onClick={() => void loadContacts()} className="mt-5 inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]">Try again</button>
            </div>
          ) : isLoading ? (
            <div aria-busy="true" aria-label="Loading contacts" className="animate-pulse divide-y divide-[#EFEFF2]">
              {Array.from({ length: PAGE_SIZE }, (_, row) => (
                <div key={row} className="flex items-center gap-4 px-4 py-4">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-[#ECECF0]" />
                  <span className="h-3.5 w-32 rounded bg-[#ECECF0]" />
                  <span className="hidden h-3.5 w-20 rounded bg-[#F3F3F5] md:block" />
                  <span className="hidden h-3.5 w-28 rounded bg-[#F3F3F5] lg:block" />
                  <span className="ml-auto h-5 w-20 rounded-full bg-[#F3F3F5]" />
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1EDFF] text-[#6E4FF6]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></svg>
              </span>
              <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">{submittedSearch || hasFilters ? "No matches found" : "No contacts yet"}</h2>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">{submittedSearch || hasFilters ? "Try a different search term or adjust your filters." : "Add your first contact to start building the pipeline."}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {!submittedSearch && !hasFilters
                  ? <button type="button" onClick={() => openEditor()} className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold ${ACCENT_BUTTON}`}>Add your first contact</button>
                  : <button type="button" onClick={clearSearchAndFilters} className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]">Clear filters</button>}
              </div>
            </div>
          ) : (
            <>
              {/* Wide desktop: the monitoring table. Phones and tablets use the cards below. */}
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[1040px] border-collapse text-sm">
                  <thead className="bg-[#F7F7F9] text-left text-[13px] font-medium text-[#4B5060]">
                    <tr>
                      <th scope="col" className="w-11 py-3 pl-4 pr-0">
                        <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all contacts on this page" className="h-4 w-4 accent-[#6E4FF6]" />
                      </th>
                      {tableColumns.map((column) => (
                        <th key={column} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{column}</th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => {
                      const label = contact.name || contact.phone;
                      return (
                        <tr key={contact.id} onClick={() => openEditor(contact)} className="cursor-pointer border-t border-[#EFEFF2] transition-colors hover:bg-[#FAFAFB]">
                          <td className="h-14 py-0 pl-4 pr-0" onClick={(event) => event.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelected(contact.id)} aria-label={`Select ${label}`} className="h-4 w-4 accent-[#6E4FF6]" />
                          </td>
                          <td className="px-3">
                            <div className="flex items-center gap-2.5">
                              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${avatarTone(contact)}`}>{initialOf(contact)}</span>
                              <span className={`whitespace-nowrap font-semibold ${contact.name ? "text-[#1A1C21]" : "italic text-[#6B7080]"}`}>{contact.name || "Unnamed contact"}</span>
                            </div>
                          </td>
                          <td className="px-3">
                            <span className={`inline-block rounded-[6px] px-2.5 py-[3px] text-xs font-semibold ${typeTone(contact)}`}>{KIND_LABELS[contact.kind] ?? contact.kind}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 tabular-nums text-[#1A1C21]">{contact.phone}</td>
                          <td className="px-3 text-[#6B7080]">
                            <span className="block max-w-[10rem] truncate">{contact.district || <span className="text-[#B4B8C2]">—</span>}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 text-[#6B7080]">{contact.source || <span className="text-[#B4B8C2]">—</span>}</td>
                          <td className="whitespace-nowrap px-3 text-[#1A1C21] capitalize">{contact.stage ? contact.stage.replaceAll("_", " ") : <span className="text-[#B4B8C2]">—</span>}</td>
                          {canAssign && (
                            <td className="whitespace-nowrap px-3 text-[#3A3E4A]">
                              {contact.assignedTo || <span className="text-[#8A8F9C]">Unassigned</span>}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3"><VerifiedBadge contact={contact} /></td>
                          <td className="px-4 text-center" onClick={(event) => event.stopPropagation()}>
                            <ContactRowMenu label={label} onEdit={() => openEditor(contact)} onDelete={() => { setFormError(""); setDeleteTarget(contact); }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:hidden">
                {contacts.map((contact) => (
                  <article key={contact.id} className="relative rounded-xl border border-[#E7E7EA] bg-white transition-colors hover:border-[#C9C0FF]">
                    <button type="button" onClick={() => openEditor(contact)} className="block w-full rounded-xl p-4 text-left focus-visible:outline-2 focus-visible:outline-[#6E4FF6]">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarTone(contact)}`}>{initialOf(contact)}</span>
                        <div className="min-w-0 flex-1 pr-14">
                          <h3 className={`truncate text-[14px] font-semibold leading-snug ${contact.name ? "text-[#1A1C21]" : "italic text-[#6B7080]"}`}>{contact.name || "Unnamed contact"}</h3>
                          <p className="mt-0.5 text-[12px] font-medium text-[#6B7080]">{contact.phone}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeTone(contact)}`}>{KIND_LABELS[contact.kind] ?? contact.kind}</span>
                        <VerifiedBadge contact={contact} />
                      </div>
                      <div className="mt-3 space-y-1.5 text-[12px] text-[#6B7080]">
                        <p className="truncate">{contact.district || "Location not added"}</p>
                        {contact.source && <p className="truncate">{contact.source}</p>}
                        {canAssign && <p className="truncate">Assigned to {contact.assignedTo || "nobody"}</p>}
                      </div>
                      <div className="mt-3 border-t border-[#EFEFF2] pt-2.5 text-[11px] font-medium text-[#8A8F9C]">
                        {DATE_FORMAT.format(new Date(contact.createdAt))}
                      </div>
                    </button>
                    <div className="absolute right-3 top-3.5 flex gap-1">
                      <button type="button" onClick={() => openEditor(contact)} aria-label={`Edit ${contact.name || contact.phone}`} title="Edit" className="rounded-md p-1.5 text-[#8A8F9C] transition-colors hover:bg-[#F1EDFF] hover:text-[#5B3FD6]">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button type="button" onClick={() => { setFormError(""); setDeleteTarget(contact); }} aria-label={`Delete ${contact.name || contact.phone}`} title="Delete" className="rounded-md p-1.5 text-[#8A8F9C] transition-colors hover:bg-rose-50 hover:text-rose-600">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {!error && !isLoading && total > 0 && (
            <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-4 py-3.5" aria-label="Contacts pagination">
              <p className="text-sm text-[#3A3E4A]">Showing {rangeStart} to {rangeEnd} of {total.toLocaleString()} contacts</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => goToPage(page - 1)} disabled={page === 1} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:cursor-not-allowed disabled:opacity-40">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                  Previous
                </button>
                {pageItems(page, totalPages).map((item, index) => item === "…"
                  ? <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-[#8A8F9C]">…</span>
                  : (
                    <button key={item} type="button" onClick={() => goToPage(item)} aria-current={item === page ? "page" : undefined}
                      className={`flex h-9 w-9 items-center justify-center rounded-[8px] text-[13px] transition-colors ${item === page ? `${ACCENT_BUTTON} font-semibold` : "text-[#4B5060] hover:bg-[#F3F3F5]"}`}>
                      {item}
                    </button>
                  ))}
                <button type="button" onClick={() => goToPage(page + 1)} disabled={page === totalPages} className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${ACCENT_BUTTON}`}>
                  Next
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-white overflow-hidden md:bg-slate-900/50 md:backdrop-blur-xs md:flex md:items-center md:justify-center md:overflow-visible md:p-4">
          <section className="w-full h-dvh md:w-full md:h-auto md:max-w-xl md:max-h-[90vh] bg-white md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="contact-form-title">
            <header className="relative overflow-hidden bg-white border-b border-gray-200 px-5 py-5 text-slate-900 shrink-0">
              <button type="button" onClick={closeEditor} aria-label="Close" className="absolute top-4 right-4 z-10 p-2 rounded-lg text-gray-400 hover:text-slate-700 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
              <h2 id="contact-form-title" className="relative pr-10 text-xl font-extrabold tracking-tight text-[#0a192f]">{editor.contact ? "Edit contact" : "Add contact"}</h2>
            </header>

            <form onSubmit={saveContact} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={labelClass}>
                    Name
                    <input value={editor.values.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Full name" className={inputClass} />
                  </label>
                  <SelectField label="Type" value={editor.values.contactType} onChange={(value) => updateForm("contactType", value as ApiContactType)} options={[{ value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }]} />

                  <div className="sm:col-span-2">
                    <PhoneField key={editor.contact?.id ?? "new"} value={editor.values.phone} onChange={(value) => updateForm("phone", value)} />
                  </div>

                  <SelectField label="Source" value={sourceValue} onChange={(value) => updateForm("source", value as ContactSource)} placeholder="Not recorded" options={[{ value: "", label: "Not recorded" }, ...sourceOptions.map((name) => ({ value: name, label: name }))]} />
                  {editor.values.contactType === "partner" && (
                    <SelectField label="Partner type" value={editor.values.professionType} onChange={(value) => updateForm("professionType", value)} placeholder="Select partner type"
                      options={[...(editor.values.professionType && !partnerTypes.some((item) => item.value === editor.values.professionType) ? [{ value: editor.values.professionType, label: professionLabel(editor.values.professionType) }] : []), ...partnerTypes]} />
                  )}
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
                    <div className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3">
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
                <button type="button" disabled={isSaving} onClick={closeEditor} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
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
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-white rounded-b-2xl">
              <button type="button" disabled={isSaving} onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => void deleteContact()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">{isSaving ? "Deleting…" : "Delete contact"}</button>
            </footer>
          </section>
        </div>
      )}

      {ioDialog === "export" && (
        <ContactExportModal leadSources={leadSources} onClose={() => setIoDialog(null)}
          initial={{
            contact_type: (filters.type || undefined) as ApiContactType | undefined,
            profession_type: filters.type === "partner" ? filters.profession || undefined : undefined,
            lead_source_id: filters.source ? Number(filters.source) : undefined,
            district: filters.district || undefined,
            assigned_to: filters.assignedTo ? Number(filters.assignedTo) : undefined,
            created_by: filters.createdBy ? Number(filters.createdBy) : undefined,
            verified: filters.verified ? filters.verified === "verified" : undefined,
            search: submittedSearch || undefined,
          }}
          extraFilterCount={[filters.profession && filters.type === "partner", filters.district, filters.assignedTo, filters.createdBy, filters.verified, submittedSearch].filter(Boolean).length} />
      )}
      {ioDialog === "import" && <ContactImportModal leadSources={leadSources} role={viewerRole} onClose={() => setIoDialog(null)} onImported={() => { setPage(1); void loadContacts(); }} />}
    </div>
  );
}
