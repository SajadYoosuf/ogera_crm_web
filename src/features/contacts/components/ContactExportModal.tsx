"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import SelectField from "@/components/SelectField";
import { ApiError } from "@/lib/api/auth";
import { listContacts, type ApiContactType, type LeadSource } from "@/features/contacts/api/contacts";
import { downloadContactsExport, type ExportFilters, type ExportFormat } from "@/features/contacts/api/contactsIo";

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "csv", label: "CSV", hint: "Plain data" },
  { value: "xlsx", label: "Excel", hint: "Formatted sheet" },
  { value: "pdf", label: "PDF", hint: "Print-ready, up to 2,000" },
];
const TYPES = [{ value: "", label: "All types" }, { value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }];

/** Export dialog. `initial` is the filter set already applied on the contacts page; the user can adjust the date range, type and source here. */
export default function ContactExportModal({ initial, extraFilterCount, leadSources, onClose }: { initial: ExportFilters; extraFilterCount: number; leadSources: LeadSource[]; onClose: () => void }) {
  const [filters, setFilters] = useState<ExportFilters>(initial);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  // The count remembers which filters it was fetched for, so "counting" is derived and never set from an effect.
  const [counted, setCounted] = useState<{ key: string; total: number | null }>({ key: "", total: null });
  const filterKey = JSON.stringify(filters);
  const isCurrent = counted.key === filterKey;
  const count = isCurrent ? counted.total : null;
  const countFailed = isCurrent && counted.total === null;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  // "N contacts will be exported" follows the filters, so nobody downloads a surprise.
  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    listContacts(accessToken, {
      limit: 1, contact_type: filters.contact_type, profession_type: filters.profession_type, search: filters.search, lead_source_id: filters.lead_source_id,
      district: filters.district, assigned_to: filters.assigned_to, created_by: filters.created_by, verified: filters.verified,
      created_from: filters.created_from, created_to: filters.created_to,
    }).then((result) => { if (!cancelled) setCounted({ key: filterKey, total: result.total }); })
      .catch(() => { if (!cancelled) setCounted({ key: filterKey, total: null }); });
    return () => { cancelled = true; };
  }, [filters, filterKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !isDownloading) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDownloading, onClose]);

  const change = (patch: Partial<ExportFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const limit = format === "pdf" ? 2000 : 20000;
  const tooMany = count !== null && count > limit;

  const download = async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Your session has expired. Please sign in again."); return; }
    setIsDownloading(true);
    setError("");
    try {
      await downloadContactsExport(accessToken, format, filters);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[5px]">
      <section className="w-full sm:max-w-lg max-h-dvh overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="p-5 sm:p-6">
          <h2 id="export-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">Export contacts</h2>
          <p className="mt-1 text-sm text-gray-500">Choose what to include. The list on the page is not changed.</p>

          <div className="mt-5 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Created between</span>
              <DateRangePicker bare label="Created between" from={filters.created_from ?? ""} to={filters.created_to ?? ""} className="w-full"
                onChange={(from, to) => change({ created_from: from || undefined, created_to: to || undefined })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Type" value={filters.contact_type ?? ""} options={TYPES}
                onChange={(value) => change({ contact_type: (value || undefined) as ApiContactType | undefined, profession_type: value === "partner" ? filters.profession_type : undefined })} />
              <SelectField label="Lead source" value={filters.lead_source_id ? String(filters.lead_source_id) : ""}
                options={[{ value: "", label: "All sources" }, ...leadSources.map((item) => ({ value: String(item.id), label: item.name }))]}
                onChange={(value) => change({ lead_source_id: value ? Number(value) : undefined })} />
            </div>
            {extraFilterCount > 0 && <p className="text-xs text-gray-500">Also applying {extraFilterCount} filter{extraFilterCount > 1 ? "s" : ""} from the contacts page.</p>}

            <fieldset>
              <legend className="crm-field-label">Format</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {FORMATS.map((item) => (
                  <label key={item.value} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${format === item.value ? "border-[#0E4D3A] bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                    <input type="radio" name="export-format" value={item.value} checked={format === item.value} onChange={() => setFormat(item.value)} className="sr-only" />
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="block text-[11px] text-gray-500 leading-tight">{item.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p role="status" className={`mt-5 text-sm font-semibold ${tooMany || count === 0 ? "text-amber-700" : "text-gray-700"}`}>
            {countFailed ? "Couldn't count the contacts, but you can still export."
              : count === null ? "Counting contacts…"
              : count === 0 ? "No contacts match these filters."
              : tooMany ? `${count.toLocaleString("en-IN")} contacts match. ${format.toUpperCase()} holds at most ${limit.toLocaleString("en-IN")}; narrow the filters.`
              : `${count.toLocaleString("en-IN")} contact${count === 1 ? "" : "s"} will be exported.`}
          </p>
          {error && <p role="alert" className="mt-3 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</p>}

          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isDownloading} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">Cancel</button>
            <button type="button" onClick={() => void download()} disabled={isDownloading || tooMany || count === 0}
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#0E4D3A] to-[#0B3E2F] text-white text-sm font-bold shadow-md shadow-[#0E4D3A]/25 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {isDownloading ? "Preparing file…" : `Download ${FORMATS.find((item) => item.value === format)?.label}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
