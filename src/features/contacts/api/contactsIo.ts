import { API_BASE_URL, ApiError, errorFromResponse, request } from "@/lib/api/auth";
import type { ApiContactType } from "@/features/contacts/api/contacts";

/** Mirrors the import/export section of the parent API.md. */
export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportFilters = {
  contact_type?: ApiContactType; lead_source_id?: number; district?: string; search?: string; assigned_to?: number;
  created_by?: number; verified?: boolean; profession_type?: string; created_from?: string; created_to?: string;
};

export type ImportColumn = { index: number; header: string; field: string | null; sample: string[] };
export type ImportRowStatus = "warning" | "duplicate" | "error";
export type ImportRow = { row: number; status: ImportRowStatus; issues: string[]; raw: string[]; name: string | null; phone: string | null };
export type ImportReport = {
  header_row: number;
  columns: ImportColumn[];
  fields: Record<string, string>;
  missing_required: string[];
  summary: { total: number; ready: number; warning: number; duplicate: number; error: number };
  /** Every row that is not plain "ready". */
  rows: ImportRow[];
};
export type ImportOptions = {
  /** Column index -> field; omit to let the backend detect it. */
  mapping?: Record<number, string>;
  defaultType: ApiContactType;
  defaultSourceId?: number;
  duplicates: "skip" | "update_blank";
  assignedTo?: number;
};
export type ImportResult = { created: number; updated: number; skipped: number };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function friendly(error: unknown): never {
  if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
  if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
  throw error;
}

function importForm(file: File, options: ImportOptions) {
  const form = new FormData();
  form.set("file", file);
  if (options.mapping) form.set("mapping", JSON.stringify(options.mapping));
  form.set("default_type", options.defaultType);
  if (options.defaultSourceId !== undefined) form.set("default_source_id", String(options.defaultSourceId));
  form.set("duplicates", options.duplicates);
  if (options.assignedTo !== undefined) form.set("assigned_to", String(options.assignedTo));
  return form;
}

export type UploadProgress = { loaded: number; total: number };
export type UploadHandlers = { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal };
const UPLOAD_TIMEOUT_MS = 60_000;

/** POST with upload progress. fetch cannot report how much of the body has been sent, so this uses XMLHttpRequest. */
function postForm<T>(path: string, accessToken: string, body: FormData, handlers: UploadHandlers = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      reject(new ApiError("offline", "You're offline. Check your internet connection and try again."));
      return;
    }
    if (handlers.signal?.aborted) { reject(new ApiError("cancelled", "Upload cancelled.")); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) handlers.onProgress?.({ loaded: event.loaded, total: event.total }); };
    xhr.onload = () => {
      let parsed: unknown = null;
      try { parsed = JSON.parse(xhr.responseText); } catch { /* handled by status below */ }
      if (xhr.status >= 200 && xhr.status < 300 && parsed !== null) resolve(parsed as T);
      else reject(errorFromResponse(xhr.status, parsed));
    };
    xhr.onerror = () => reject(new ApiError("network", "Can't reach the server. Check your connection and try again."));
    xhr.ontimeout = () => reject(new ApiError("timeout", "The server took too long to respond. Please try again."));
    xhr.onabort = () => reject(new ApiError("cancelled", "Upload cancelled."));
    handlers.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

/** POST /contacts/import/analyze — checks the sheet and writes nothing. Reports upload progress and can be cancelled. */
export async function analyzeImport(accessToken: string, file: File, options: ImportOptions, handlers: UploadHandlers = {}) {
  try {
    return await postForm<ImportReport>("/contacts/import/analyze", accessToken, importForm(file, options), handlers);
  } catch (error) { return friendly(error); }
}

/** POST /contacts/import/commit — imports every ready and warning row. */
export async function commitImport(accessToken: string, file: File, options: ImportOptions & { mapping: Record<number, string> }) {
  try {
    return await request<ImportResult>("/contacts/import/commit", { method: "POST", headers: auth(accessToken), body: importForm(file, options) });
  } catch (error) { return friendly(error); }
}

/** Downloads a file from the API and hands it to the browser. */
async function downloadFile(path: string, accessToken: string, fallbackName: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ApiError("offline", "You're offline. Check your internet connection and try again.");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: auth(accessToken) });
  } catch {
    throw new ApiError("network", "Can't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    let detail: string | undefined;
    try { const body = await response.json(); if (typeof body?.detail === "string") detail = body.detail; } catch { /* not JSON */ }
    if (response.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (response.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
    throw new ApiError(response.status >= 500 ? "server" : "unknown", detail ?? "The download failed. Please try again.", response.status);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** GET /contacts/export — same filters as the list, in the chosen format. */
export function downloadContactsExport(accessToken: string, format: ExportFormat, filters: ExportFilters) {
  const query = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") query.set(key, String(value));
  return downloadFile(`/contacts/export?${query}`, accessToken, `contacts.${format}`);
}

/** GET /contacts/import/template — blank sheet with the recognised headers. */
export const downloadImportTemplate = (accessToken: string) => downloadFile("/contacts/import/template", accessToken, "contacts_import_template.csv");

/** CSV of the rows that were not imported, with the reason first, so the user can fix and re-upload. */
export function problemRowsCsv(rows: ImportRow[]) {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [["Row", "Problem", "Original cells"], ...rows.filter((row) => row.status !== "warning").map((row) => [String(row.row), row.issues.join("; "), ...row.raw])];
  return new Blob(["﻿", lines.map((line) => line.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
}
