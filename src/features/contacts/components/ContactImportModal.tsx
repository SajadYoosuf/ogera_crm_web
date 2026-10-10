"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import type { ApiContactType, LeadSource } from "@/features/contacts/api/contacts";
import { canManageEmployees, listAllEmployees, type Employee } from "@/lib/api/employees";
import { analyzeImport, commitImport, downloadImportTemplate, problemRowsCsv, type ImportOptions, type ImportReport, type ImportResult } from "@/features/contacts/api/contactsIo";

const selectClass = "w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/20";
const STATUS_STYLE = { warning: "bg-amber-50 text-amber-800 border-amber-200", duplicate: "bg-sky-50 text-sky-800 border-sky-200", error: "bg-rose-50 text-rose-700 border-rose-200" } as const;
const STATUS_LABEL = { warning: "Imported with a fix", duplicate: "Already in CRM", error: "Skipped" } as const;
const SHOWN_ROWS = 50;

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
const token = () => sessionStorage.getItem("ogera_access_token");

type Rules = { mapping?: Record<number, string>; defaultType: ApiContactType; sourceId: string; duplicates: "skip" | "update_blank"; assignedTo: string };
const DEFAULT_RULES: Rules = { defaultType: "consumer", sourceId: "", duplicates: "skip", assignedTo: "" };
const toOptions = (rules: Rules): ImportOptions => ({
  mapping: rules.mapping, defaultType: rules.defaultType, defaultSourceId: rules.sourceId ? Number(rules.sourceId) : undefined,
  duplicates: rules.duplicates, assignedTo: rules.assignedTo ? Number(rules.assignedTo) : undefined,
});

/** Import dialog: choose a file, review what the backend found (columns and problem rows), then import. Nothing is written until "Import". */
export default function ContactImportModal({ leadSources, role, onClose, onImported }: { leadSources: LeadSource[]; role: string | undefined; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const accessToken = token();
    if (!canManageEmployees(role) || !accessToken) return;
    listAllEmployees(accessToken).then((list) => setEmployees(list.employees.filter((employee) => employee.is_active))).catch(() => setEmployees([]));
  }, [role]);

  const latestCheck = useRef(0);
  // Checks the sheet; only the newest answer is kept, so quick changes never show stale results.
  const check = (nextFile: File, nextRules: Rules) => {
    const accessToken = token();
    if (!accessToken) { setError("Your session has expired. Please sign in again."); return; }
    const id = ++latestCheck.current;
    setIsChecking(true);
    setError("");
    analyzeImport(accessToken, nextFile, toOptions(nextRules))
      .then((next) => { if (id === latestCheck.current) setReport(next); })
      .catch((caught) => { if (id === latestCheck.current) { setReport(null); setError(messageOf(caught)); } })
      .finally(() => { if (id === latestCheck.current) setIsChecking(false); });
  };
  const changeRules = (patch: Partial<Rules>) => {
    const next = { ...rules, ...patch };
    setRules(next);
    if (file) check(file, next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !isImporting) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isImporting, onClose]);

  const mapping = useMemo(() => {
    const out: Record<number, string> = {};
    report?.columns.forEach((column) => { if (column.field) out[column.index] = column.field; });
    return out;
  }, [report]);

  const chooseFile = (next: File | undefined) => {
    setFile(next ?? null);
    setReport(null);
    setError("");
    const fresh = { ...rules, mapping: undefined };
    setRules(fresh);
    if (next) check(next, fresh); else { latestCheck.current++; setIsChecking(false); }
  };
  const mapColumn = (index: number, field: string) => {
    const next = { ...mapping };
    // A field can only come from one column, so picking it here frees it elsewhere.
    for (const key of Object.keys(next)) if (field && next[Number(key)] === field) delete next[Number(key)];
    if (field) next[index] = field; else delete next[index];
    changeRules({ mapping: next });
  };

  const importable = report ? report.summary.ready + report.summary.warning + (rules.duplicates === "update_blank" ? report.summary.duplicate : 0) : 0;
  const canImport = !!report && report.missing_required.length === 0 && importable > 0 && !isChecking && !isImporting;

  const runImport = async () => {
    const accessToken = token();
    if (!file || !report || !accessToken) return;
    setIsImporting(true);
    setError("");
    try {
      setResult(await commitImport(accessToken, file, { ...toOptions(rules), mapping }));
      onImported();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setIsImporting(false);
    }
  };

  const saveProblems = () => {
    if (!report) return;
    const url = URL.createObjectURL(problemRowsCsv(report.rows));
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts_not_imported.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTemplate = async () => {
    const accessToken = token();
    if (!accessToken) return;
    try { await downloadImportTemplate(accessToken); } catch (caught) { setError(messageOf(caught)); }
  };

  const notImported = report ? report.rows.filter((row) => row.status !== "warning").length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <section className="w-full sm:max-w-3xl max-h-dvh sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="p-5 sm:p-6">
          <h2 id="import-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">Import contacts</h2>

          {result ? (
            <div role="status" className="mt-5">
              <p className="text-base font-bold text-emerald-700">Import finished</p>
              <ul className="mt-2 text-sm text-gray-700 space-y-1">
                <li><strong>{result.created}</strong> contact{result.created === 1 ? "" : "s"} added</li>
                {result.updated > 0 && <li><strong>{result.updated}</strong> existing contact{result.updated === 1 ? "" : "s"} updated</li>}
                <li><strong>{result.skipped}</strong> row{result.skipped === 1 ? "" : "s"} skipped</li>
              </ul>
              {result.skipped > 0 && notImported > 0 && <button type="button" onClick={saveProblems} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">Download skipped rows to fix and re-upload</button>}
              <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold">Done</button></div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-500">Upload a .csv or .xlsx file. We find the columns for you and show any problems before anything is saved.</p>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <input ref={inputRef} type="file" accept=".csv,.xlsx" onChange={(event) => chooseFile(event.target.files?.[0])} aria-label="Choose a file to import"
                  className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
                <button type="button" onClick={() => void getTemplate()} className="shrink-0 text-sm font-semibold text-blue-700 hover:underline">Download template</button>
              </div>

              {error && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</p>}
              {isChecking && <p role="status" className="mt-4 text-sm text-gray-500">Checking the file…</p>}

              {report && (
                <div className={`mt-5 ${isChecking ? "opacity-60" : ""}`}>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {([["ready", "Ready", "text-emerald-700"], ["warning", "Fixed on import", "text-amber-700"], ["duplicate", "Already in CRM", "text-sky-700"], ["error", "Will be skipped", "text-rose-700"]] as const).map(([key, label, color]) => (
                      <div key={key} className="rounded-xl border border-gray-200 py-2.5">
                        <dd className={`text-xl font-extrabold ${color}`}>{report.summary[key]}</dd>
                        <dt className="text-[11px] font-semibold text-gray-500">{label}</dt>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mt-5 text-sm font-bold text-[#0a192f]">Columns <span className="font-normal text-gray-500">· headers found on row {report.header_row}</span></h3>
                  {report.missing_required.length > 0 && <p role="alert" className="mt-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">Pick which column holds the {report.missing_required.map((field) => report.fields[field]).join(" and ")}.</p>}
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {report.columns.map((column) => (
                      <li key={column.index} className="rounded-xl border border-gray-200 p-2.5">
                        <label className="block text-xs font-semibold text-gray-600 truncate" htmlFor={`col-${column.index}`}>{column.header || `Column ${column.index + 1}`}{column.sample[0] && <span className="font-normal text-gray-400"> · e.g. {column.sample[0]}</span>}</label>
                        <select id={`col-${column.index}`} value={mapping[column.index] ?? ""} onChange={(event) => mapColumn(column.index, event.target.value)} className={`${selectClass} mt-1`}>
                          <option value="">Ignore this column</option>
                          {Object.entries(report.fields).map(([field, label]) => <option key={field} value={field}>{label}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>

                  <h3 className="mt-5 text-sm font-bold text-[#0a192f]">Rules</h3>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-gray-600">When a row has no type
                      <select value={rules.defaultType} onChange={(event) => changeRules({ defaultType: event.target.value as ApiContactType })} className={`${selectClass} mt-1`}>
                        <option value="consumer">Consumer</option><option value="partner">Partner</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-600">When a row has no known lead source
                      <select value={rules.sourceId} onChange={(event) => changeRules({ sourceId: event.target.value })} className={`${selectClass} mt-1`}>
                        <option value="">Leave blank</option>
                        {leadSources.filter((item) => item.slug !== "offline").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-600">If the phone is already in the CRM
                      <select value={rules.duplicates} onChange={(event) => changeRules({ duplicates: event.target.value as Rules["duplicates"] })} className={`${selectClass} mt-1`}>
                        <option value="skip">Skip the row</option><option value="update_blank">Fill blank fields of the existing contact</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-gray-600">Assign new contacts to
                      <select value={rules.assignedTo} onChange={(event) => changeRules({ assignedTo: event.target.value })} className={`${selectClass} mt-1`}>
                        <option value="">Assign automatically</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                      </select>
                    </label>
                  </div>

                  {report.rows.length > 0 && (
                    <>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-[#0a192f]">Rows that need attention ({report.rows.length})</h3>
                        {notImported > 0 && <button type="button" onClick={saveProblems} className="text-sm font-semibold text-blue-700 hover:underline">Download rows not imported</button>}
                      </div>
                      <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {report.rows.slice(0, SHOWN_ROWS).map((row) => (
                          <li key={row.row} className="p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-800">Row {row.row}</span>
                              <span className="text-gray-500 truncate">{row.name || row.phone || ""}</span>
                              <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-600">{row.issues.join(" · ")}</p>
                          </li>
                        ))}
                      </ul>
                      {report.rows.length > SHOWN_ROWS && <p className="mt-1 text-xs text-gray-500">Showing the first {SHOWN_ROWS}. The download lists all rows not imported.</p>}
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button type="button" onClick={onClose} disabled={isImporting} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">Cancel</button>
                <button type="button" onClick={() => void runImport()} disabled={!canImport}
                  className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {isImporting ? "Importing…" : report ? `Import ${importable} contact${importable === 1 ? "" : "s"}` : "Import"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
