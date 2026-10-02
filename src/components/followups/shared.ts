export interface Lead {
  id: number;
  name?: string;
  phone: string;
  address?: string;
  district?: string;
  panchayath?: string;
  ward?: string;
  houseStage?: string;
  currentTank?: string;
  waterSource?: string;
  tankSizeInterest?: string;
  remarks?: string;
  latitude?: string;
  longitude?: string;
  stage?: string;
  followupAssignedTo?: string;
  followupDueDate?: string;
  createdAt: string;
}

export interface Stage { id: string; label: string; orderIndex: number }
export interface Remark { id: number; staffId: string; staffName?: string; remark: string; isSystem: boolean; createdAt: string }
export interface Staff { id: string; name: string }

export const inputClass =
  "crm-input";
export const selectClass =
  "crm-select";
export const textareaClass =
  "crm-textarea";
export const labelClass = "crm-field-label";
export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors";
export const ghostButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors";

/** Every follow-up endpoint is bearer-authenticated and answers with the { success, data } envelope. */
export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = sessionStorage.getItem("ogera_access_token");
  if (!accessToken) throw new Error("Sign in again to continue.");
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (init.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new Error("Network problem. Please check your connection and try again.");
  }
  const result = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: { message?: string } } | null;
  if (!response.ok || !result?.success) throw new Error(result?.error?.message || "Something went wrong. Please try again.");
  return result.data as T;
}

export const errorMessage = (caught: unknown) => (caught instanceof Error ? caught.message : "Something went wrong. Please try again.");

/** Dates travel as plain YYYY-MM-DD so they never drift across a timezone. */
export const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : "");

export function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDueDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatMoment(value: string) {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return "";
  return moment.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** A lead only moves past the first stage once these qualification details are filled in. */
export const isQualified = (lead: Lead) =>
  Boolean(lead.panchayath && lead.ward && lead.waterSource && lead.houseStage && lead.tankSizeInterest);
