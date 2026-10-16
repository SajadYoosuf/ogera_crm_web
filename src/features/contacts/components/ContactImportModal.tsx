"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import type { ApiContactType, LeadSource } from "@/features/contacts/api/contacts";
import { canManageEmployees, listAllEmployees, type Employee } from "@/lib/api/employees";
import { analyzeImport, commitImport, downloadImportTemplate, problemRowsCsv, type ImportOptions, type ImportReport, type ImportResult, type UploadProgress } from "@/features/contacts/api/contactsIo";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTS = [".csv", ".xlsx", ".xls"];

// Import Contacts design: a three-step dialog in DM Sans, purple accent, 8px radii.
const ACCENT_BUTTON = "bg-[#0E4D3A] text-white transition-colors hover:bg-[#0E4D3A] disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_CLASS = "h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white px-2.5 text-[13px] text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8]";
const SHOWN_ROWS = 50;
// Badge colours for rows that need attention, taken from the design's status palette.
const ROW_STATUS = {
  warning: { label: "Imported with a fix", tone: "bg-[#FFF7E6] text-[#9A5B00]" },
  duplicate: { label: "Already in CRM", tone: "bg-[#EEF4FF] text-[#1D5BBF]" },
  error: { label: "Skipped", tone: "bg-[#FDECEC] text-[#B42323]" },
} as const;
const STEP_LABELS = { 1: "Step 1 of 3 — Choose a file", 2: "Step 2 of 3 — Match your columns", 3: "Step 3 of 3 — Import complete" } as const;

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
const token = () => sessionStorage.getItem("ogera_access_token");
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

type Rules = { mapping?: Record<number, string>; defaultType: ApiContactType; sourceId: string; duplicates: "skip" | "update_blank"; assignedTo: string };
const DEFAULT_RULES: Rules = { defaultType: "consumer", sourceId: "", duplicates: "skip", assignedTo: "" };
const toOptions = (rules: Rules): ImportOptions => ({
  mapping: rules.mapping, defaultType: rules.defaultType, defaultSourceId: rules.sourceId ? Number(rules.sourceId) : undefined,
  duplicates: rules.duplicates, assignedTo: rules.assignedTo ? Number(rules.assignedTo) : undefined,
});

/** Import dialog: choose a file, match its columns and review problem rows, then import. Nothing is written until the last import step. */
export default function ContactImportModal({ leadSources, role, onClose, onImported }: { leadSources: LeadSource[]; role: string | undefined; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  // Upload progress while the file is sent; null once the server has answered.
  const [upload, setUpload] = useState<UploadProgress | null>(null);
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
  const checkController = useRef<AbortController | null>(null);
  // Checks the sheet; only the newest answer is kept, so quick changes never show stale results.
  const check = (nextFile: File, nextRules: Rules) => {
    const accessToken = token();
    if (!accessToken) { setError("Your session has expired. Please sign in again."); return; }
    checkController.current?.abort();
    const controller = new AbortController();
    checkController.current = controller;
    const id = ++latestCheck.current;
    setIsChecking(true);
    setError("");
    setUpload({ loaded: 0, total: nextFile.size });
    analyzeImport(accessToken, nextFile, toOptions(nextRules), {
      signal: controller.signal,
      onProgress: (progress) => { if (id === latestCheck.current) setUpload(progress); },
    })
      .then((next) => { if (id === latestCheck.current) setReport(next); })
      .catch((caught) => { if (id === latestCheck.current) { setReport(null); setError(messageOf(caught)); } })
      .finally(() => { if (id === latestCheck.current) { setIsChecking(false); setUpload(null); } });
  };
  // Cancel stops the upload or the check and clears the file, as the design's "Cancel upload" does.
  const cancelCheck = () => {
    latestCheck.current++;
    checkController.current?.abort();
    checkController.current = null;
    setIsChecking(false);
    setUpload(null);
    setFile(null);
    setReport(null);
    setError("");
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
    if (next) {
      const ext = next.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
      if (!ACCEPTED_EXTS.includes(ext)) {
        setError(`"${next.name}" is not supported. Please upload a .csv, .xlsx or .xls file.`);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (next.size > MAX_FILE_BYTES) {
        setError(`"${next.name}" is ${formatSize(next.size)} — the limit is 10 MB. Please split the file or reduce its size.`);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    setFile(next ?? null);
    setReport(null);
    setError("");
    setStep(1);
    const fresh = { ...rules, mapping: undefined };
    setRules(fresh);
    if (next) check(next, fresh); else cancelCheck();
  };
  const mapColumn = (index: number, field: string) => {
    const next = { ...mapping };
    // A field can only come from one column, so picking it here frees it elsewhere.
    for (const key of Object.keys(next)) if (field && next[Number(key)] === field) delete next[Number(key)];
    if (field) next[index] = field; else delete next[index];
    changeRules({ mapping: next });
  };

  const total = report?.summary.total ?? 0;
  const importable = report ? report.summary.ready + report.summary.warning + (rules.duplicates === "update_blank" ? report.summary.duplicate : 0) : 0;
  const canContinue = !!report && !isChecking && !isImporting;
  const canImport = canContinue && report.missing_required.length === 0 && importable > 0;

  const runImport = async () => {
    const accessToken = token();
    if (!file || !report || !accessToken) return;
    setIsImporting(true);
    setError("");
    try {
      setResult(await commitImport(accessToken, file, { ...toOptions(rules), mapping }));
      setStep(3);
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
  const skipReasons = report ? [
    ...(report.summary.duplicate > 0 && rules.duplicates === "skip" ? [{ reason: "Already in your contacts (duplicate number)", count: report.summary.duplicate }] : []),
    ...(report.summary.error > 0 ? [{ reason: "Row was incomplete or invalid", count: report.summary.error }] : []),
  ] : [];
  const skippedTotal = skipReasons.reduce((sum, item) => sum + item.count, 0);

  const dotClass = (on: boolean) => `h-1 w-[22px] rounded-full ${on ? "bg-[#0E4D3A]" : "bg-[#E7E7EA]"}`;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(17,18,20,0.45)] p-4 backdrop-blur-[5px]">
      <section role="dialog" aria-modal="true" aria-labelledby="import-title"
        className="flex max-h-[min(820px,calc(100dvh-2rem))] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(16,24,40,0.28)]">

        <header className="flex items-center justify-between gap-4 border-b border-[#EFEFF2] px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <h2 id="import-title" className="text-[19px] font-bold tracking-[-0.01em] text-[#1A1C21]">Import Contacts</h2>
            <p className="text-[13px] text-[#6B7080]">{STEP_LABELS[step]}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isImporting} aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors hover:bg-[#F0F0F3] disabled:opacity-50">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex gap-1.5 px-6 pt-3.5" aria-hidden="true">
          <span className={dotClass(true)} />
          <span className={dotClass(step >= 2)} />
          <span className={dotClass(step === 3)} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <label htmlFor="import-file"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]); }}
                className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-[#C9DDD3] bg-[#F5FBF8] px-5 py-9 text-center transition-colors hover:border-[#9FD9B9] hover:bg-[#F3FBF7]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#E7F5EE]" aria-hidden="true">
                  <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
                </span>
                <span className="text-sm font-semibold text-[#1A1C21]">Drop your file here or <span className="text-[#0E4D3A] underline">browse</span></span>
                <span className="text-xs text-[#8A8F9C]">.xlsx, .xls or .csv — up to 10 MB</span>
                <input ref={inputRef} id="import-file" type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
              </label>

              {file && (
                <div className="flex items-center gap-3 rounded-[10px] border border-[#EFEFF2] px-3.5 py-3">
                  <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold ${file.name.toLowerCase().endsWith(".csv") ? "bg-[#E7F5EE] text-[#0E4D3A]" : "bg-[#EAF8EF] text-[#17703F]"}`}>
                    {file.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLS"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[#1A1C21]">{file.name}</span>
                      <span className="whitespace-nowrap text-xs text-[#8A8F9C]">
                        {isChecking && upload && upload.loaded < upload.total
                          ? `${formatSize(upload.loaded)} of ${formatSize(upload.total)}`
                          : isChecking ? "Checking the file…" : `${formatSize(file.size)} · ${total} row${total === 1 ? "" : "s"} found`}
                      </span>
                    </span>
                    {isChecking && (
                      <span className="block h-1 overflow-hidden rounded-full bg-[#EFEFF2]" role="progressbar" aria-label="Uploading file"
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload && upload.loaded < upload.total ? Math.round((upload.loaded / upload.total) * 100) : undefined}>
                        {upload && upload.loaded < upload.total
                          ? <span className="block h-full rounded-full bg-[#0E4D3A] transition-[width] duration-200" style={{ width: `${upload.total > 0 ? Math.round((upload.loaded / upload.total) * 100) : 0}%` }} />
                          : <span className="block h-full w-full animate-pulse rounded-full bg-[#0E4D3A]/60" />}
                      </span>
                    )}
                  </span>
                  <button type="button" onClick={isChecking ? cancelCheck : () => chooseFile(undefined)} aria-label={isChecking ? "Cancel upload" : "Remove file"} disabled={isImporting}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#8A8F9C] transition-colors hover:bg-[#F0F0F3] disabled:opacity-50">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      {isChecking ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />}
                    </svg>
                  </button>
                </div>
              )}

              {error && <p role="alert" className="rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
            </div>
          )}

          {step === 2 && report && (
            <div className="flex flex-col gap-3.5">
              <p className="rounded-[8px] bg-[#F3FAF6] px-3 py-2.5 text-[13px] leading-[1.6] text-[#4B5060]">We matched your file&apos;s columns to Ogera CRM fields automatically. Check each one and fix any that look wrong before importing.</p>

              {report.missing_required.length > 0 && (
                <p role="alert" className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">Pick which column holds the {report.missing_required.map((field) => report.fields[field]).join(" and ")}.</p>
              )}

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_28px_1fr_84px] gap-2.5 px-0.5 text-xs font-semibold uppercase tracking-[0.02em] text-[#8A8F9C]">
                  <span>Your column</span><span /><span>Ogera CRM field</span><span />
                </div>
                {report.columns.map((column) => {
                  const matched = !!mapping[column.index];
                  return (
                    <div key={column.index} className="grid grid-cols-[1fr_28px_1fr_84px] items-center gap-2.5 rounded-[10px] border border-[#EFEFF2] p-2.5">
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className="truncate text-sm font-semibold text-[#1A1C21]">{column.header || `Column ${column.index + 1}`}</span>
                        <span className="truncate text-xs text-[#8A8F9C]">{column.sample[0] ? `e.g. "${column.sample[0]}"` : "No sample value"}</span>
                      </span>
                      <svg className="h-4 w-4 text-[#C7CAD1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <select aria-label={`${column.header || `Column ${column.index + 1}`} maps to`} value={mapping[column.index] ?? ""} onChange={(event) => mapColumn(column.index, event.target.value)} className={SELECT_CLASS}>
                        <option value="">Don&apos;t import</option>
                        {Object.entries(report.fields).map(([field, label]) => <option key={field} value={field}>{label}</option>)}
                      </select>
                      <span className={`justify-self-end whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold ${matched ? "bg-[#EAF8EF] text-[#17703F]" : "bg-[#FFF7E6] text-[#9A5B00]"}`}>
                        {matched ? "Matched" : "Check this"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 border-t border-[#EFEFF2] pt-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#3A3E4A]">When a row has no type
                  <select value={rules.defaultType} onChange={(event) => changeRules({ defaultType: event.target.value as ApiContactType })} className={SELECT_CLASS}>
                    <option value="consumer">Consumer</option><option value="partner">Partner</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#3A3E4A]">When a row has no known lead source
                  <select value={rules.sourceId} onChange={(event) => changeRules({ sourceId: event.target.value })} className={SELECT_CLASS}>
                    <option value="">Leave blank</option>
                    {leadSources.filter((item) => item.slug !== "offline").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#3A3E4A]">If the phone is already in the CRM
                  <select value={rules.duplicates} onChange={(event) => changeRules({ duplicates: event.target.value as Rules["duplicates"] })} className={SELECT_CLASS}>
                    <option value="skip">Skip the row</option><option value="update_blank">Fill blank fields of the existing contact</option>
                  </select>
                  {rules.duplicates === "update_blank" && report.summary.duplicate > 0 && (
                    <span className="mt-0.5 rounded-[7px] bg-[#EEF4FF] px-2.5 py-2 text-[12px] font-normal leading-relaxed text-[#1D5BBF]">
                      {report.summary.duplicate} duplicate{report.summary.duplicate === 1 ? "" : "s"} found — only <strong>blank fields</strong> on those contacts will be filled in. Anything already saved stays untouched.
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#3A3E4A]">Assign new contacts to
                  <select value={rules.assignedTo} onChange={(event) => changeRules({ assignedTo: event.target.value })} className={SELECT_CLASS}>
                    <option value="">Assign automatically</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </select>
                </label>
              </div>

              {report.rows.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-[#EFEFF2] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-[#3A3E4A]">Rows that need attention ({report.rows.length})</h3>
                    {notImported > 0 && <button type="button" onClick={saveProblems} className="text-[13px] font-semibold text-[#0E4D3A] hover:underline">Download rows not imported</button>}
                  </div>
                  <ul className="max-h-60 divide-y divide-[#EFEFF2] overflow-y-auto rounded-[10px] border border-[#EFEFF2]">
                    {report.rows.slice(0, SHOWN_ROWS).map((row) => (
                      <li key={row.row} className="px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#1A1C21]">Row {row.row}</span>
                          <span className="truncate text-[#6B7080]">{row.name || row.phone || ""}</span>
                          <span className={`ml-auto rounded-full px-2 py-[3px] text-[11px] font-semibold ${ROW_STATUS[row.status].tone}`}>{ROW_STATUS[row.status].label}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#6B7080]">{row.issues.join(" · ")}</p>
                      </li>
                    ))}
                  </ul>
                  {report.rows.length > SHOWN_ROWS && <p className="text-xs text-[#8A8F9C]">Showing the first {SHOWN_ROWS}. The download lists all rows not imported.</p>}
                </div>
              )}
            </div>
          )}

          {step === 3 && result && (
            <div className="flex flex-col gap-7 px-1 pb-1 pt-2" role="status">
              <div className="flex flex-col items-center gap-3.5 px-2 pt-4 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF8EF]" aria-hidden="true">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#17703F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold text-[#1A1C21]">{result.created} contact{result.created === 1 ? "" : "s"} added</h3>
                  <p className="text-sm text-[#6B7080]">From {file?.name ?? "your file"} — now showing in your Contacts list.</p>
                  {result.updated > 0 && <p className="text-sm text-[#6B7080]">{result.updated} existing contact{result.updated === 1 ? "" : "s"} updated.</p>}
                </div>
              </div>

              {result.skipped > 0 && (
                <div className="flex flex-col gap-2.5 border-t border-[#EFEFF2] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.02em] text-[#8A8F9C]">{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped</p>
                  <div className="flex flex-col gap-1.5">
                    {skipReasons.map((item) => (
                      <div key={item.reason} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#FAFAFB] px-3 py-2.5">
                        <span className="flex items-center gap-2 text-[13px] text-[#4B5060]">
                          <svg className="h-3.5 w-3.5 text-[#B9BDC6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                          {item.reason}
                        </span>
                        <span className="whitespace-nowrap text-[13px] font-bold text-[#1A1C21]">{item.count}</span>
                      </div>
                    ))}
                    {skippedTotal === 0 && <p className="text-[13px] text-[#6B7080]">{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped.</p>}
                  </div>
                  {notImported > 0 && <button type="button" onClick={saveProblems} className="self-start text-[13px] font-semibold text-[#1A1C21] underline-offset-2 hover:underline">Review skipped rows</button>}
                </div>
              )}
            </div>
          )}

          {error && step !== 1 && <p role="alert" className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#EFEFF2] px-6 py-4">
          {step === 1 && (
            <button type="button" onClick={() => void getTemplate()} className="text-[13px] font-semibold text-[#0E4D3A] hover:underline">Download template</button>
          )}
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} disabled={isImporting} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] px-4 text-sm font-semibold text-[#4B5060] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              Back
            </button>
          )}
          {step === 3 ? <span /> : null}

          <div className="flex gap-2.5">
            {step === 1 && (
              <>
                <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#E1E1E6] bg-white px-4 text-sm font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]">Cancel</button>
                <button type="button" onClick={() => setStep(2)} disabled={!canContinue} className={`h-10 rounded-[8px] px-5 text-sm font-bold ${ACCENT_BUTTON}`}>Continue</button>
              </>
            )}
            {step === 2 && (
              <>
                <button type="button" onClick={onClose} disabled={isImporting} className="h-10 rounded-[8px] border border-[#E1E1E6] bg-white px-4 text-sm font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-60">Cancel</button>
                <button type="button" onClick={() => void runImport()} disabled={!canImport} className={`h-10 rounded-[8px] px-5 text-sm font-bold ${ACCENT_BUTTON}`}>
                  {isImporting ? "Importing…" : `Import ${importable} contact${importable === 1 ? "" : "s"}`}
                </button>
              </>
            )}
            {step === 3 && (
              <button type="button" onClick={onClose} className={`h-10 rounded-[8px] px-5 text-sm font-bold ${ACCENT_BUTTON}`}>Done</button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
