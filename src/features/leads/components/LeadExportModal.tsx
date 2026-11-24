"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DateRangePicker from "@/components/DateRangePicker";
import SelectField from "@/components/SelectField";
import { ApiError } from "@/lib/api/auth";
import { listLeads, type LeadStatusOption } from "@/features/leads/api/leads";
import { downloadLeadsExport, type LeadExportFilters, type LeadExportFormat } from "@/features/leads/api/leadsIo";

const FORMATS: { value: LeadExportFormat; label: string; hint: string }[] = [
  { value: "xlsx", label: "Excel", hint: "Formatted sheet" },
  { value: "csv", label: "CSV", hint: "Plain data" },
];

/** Export dialog. `initial` is the filter set already applied on the Leads page; staff can adjust the date range, status and source here. */
export default function LeadExportModal({ initial, extraFilterCount, statuses, sources, onClose }: {
  initial: LeadExportFilters; extraFilterCount: number; statuses: LeadStatusOption[]; sources: { id: number; name: string }[]; onClose: () => void;
}) {
  const { token } = useAuth();
  const [filters, setFilters] = useState<LeadExportFilters>(initial);
  const [format, setFormat] = useState<LeadExportFormat>("xlsx");
  // The count remembers which filters it was fetched for, so "counting" is derived and never set from an effect.
  const [counted, setCounted] = useState<{ key: string; total: number | null }>({ key: "", total: null });
  const filterKey = JSON.stringify(filters);
  const isCurrent = counted.key === filterKey;
  const count = isCurrent ? counted.total : null;
  const countFailed = isCurrent && counted.total === null;
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  // "N leads will be exported" follows the filters, so nobody downloads a surprise.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listLeads(token, {
      limit: 1, status: filters.status, source_id: filters.source_id, assigned_to: filters.assigned_to,
      search: filters.search, date_from: filters.date_from, date_to: filters.date_to,
    }).then((result) => { if (!cancelled) setCounted({ key: filterKey, total: result.total }); })
      .catch(() => { if (!cancelled) setCounted({ key: filterKey, total: null }); });
    return () => { cancelled = true; };
  }, [filters, filterKey, token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !isDownloading) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDownloading, onClose]);

  const change = (patch: Partial<LeadExportFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const limit = 20000;
  const tooMany = count !== null && count > limit;

  const download = async () => {
    if (!token) { setError("Your session has expired. Please sign in again."); return; }
    setIsDownloading(true);
    setError("");
    try {
      await downloadLeadsExport(token, format, filters);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[5px]">
      <section className="w-full sm:max-w-lg max-h-dvh overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="lead-export-title">
        <div className="p-5 sm:p-6">
          <h2 id="lead-export-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">Export leads</h2>
          <p className="mt-1 text-sm text-gray-500">Choose what to include. The list on the page is not changed.</p>

          <div className="mt-5 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-700">Created between</span>
              <DateRangePicker bare label="Created between" from={filters.date_from ?? ""} to={filters.date_to ?? ""} className="w-full"
                onChange={(from, to) => change({ date_from: from || undefined, date_to: to || undefined })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Status" value={filters.status ?? ""}
                options={[{ value: "", label: "All statuses" }, ...statuses.map((s) => ({ value: s.value, label: s.label })), { value: "converted", label: "Converted" }]}
                onChange={(value) => change({ status: value || undefined })} />
              <SelectField label="Source" value={filters.source_id ? String(filters.source_id) : ""}
                options={[{ value: "", label: "All sources" }, ...sources.map((item) => ({ value: String(item.id), label: item.name }))]}
                onChange={(value) => change({ source_id: value ? Number(value) : undefined })} />
            </div>
            {extraFilterCount > 0 && <p className="text-xs text-gray-500">Also applying {extraFilterCount} filter{extraFilterCount > 1 ? "s" : ""} from the Leads page.</p>}

            <fieldset>
              <legend className="text-xs font-semibold text-gray-700">Format</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {FORMATS.map((item) => (
                  <label key={item.value} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${format === item.value ? "border-[#0E4D3A] bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                    <input type="radio" name="lead-export-format" value={item.value} checked={format === item.value} onChange={() => setFormat(item.value)} className="sr-only" />
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="block text-[11px] text-gray-500 leading-tight">{item.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p role="status" className={`mt-5 text-sm font-semibold ${tooMany || count === 0 ? "text-amber-700" : "text-gray-700"}`}>
            {countFailed ? "Couldn't count the leads, but you can still export."
              : count === null ? "Counting leads…"
              : count === 0 ? "No leads match these filters."
              : tooMany ? `${count.toLocaleString("en-IN")} leads match. ${format.toUpperCase()} holds at most ${limit.toLocaleString("en-IN")}; narrow the filters.`
              : `${count.toLocaleString("en-IN")} lead${count === 1 ? "" : "s"} will be exported.`}
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
