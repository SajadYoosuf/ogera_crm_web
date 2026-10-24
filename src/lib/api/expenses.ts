import { ApiError, request } from "./auth";

export type ExpenseCategory = "petrol" | "food" | "maintenance" | "accommodation" | "other";
export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface Expense {
  id: number;
  employee_id: number;
  employee_name: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number | string;
  bill_photo_url: string | null;
  status: ExpenseStatus;
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  pending_count: number;
}

export interface ListExpensesParams {
  status?: ExpenseStatus;
  employee_id?: number;
  /** Inclusive start day, YYYY-MM-DD. */
  date_from?: string;
  /** Inclusive end day, YYYY-MM-DD. */
  date_to?: string;
  skip?: number;
  limit?: number;
}

function mapError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 401) return new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
  if (error.status === 403) return new ApiError("forbidden", "Only managers and admins can manage expenses.", 403);
  if (error.status === 404) return new ApiError("unknown", "That expense claim was not found.", 404);
  if (error.status === 409) return new ApiError("unknown", error.message || "This expense cannot be updated in its current status.", 409);
  return error;
}

async function call<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw mapError(error);
  }
}

/** GET /expenses — list expense claims with optional status and pagination. */
export function listExpenses(accessToken: string, params: ListExpensesParams = {}): Promise<ExpenseListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.employee_id) query.set("employee_id", String(params.employee_id));
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  if (params.skip !== undefined) query.set("skip", String(params.skip));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString();
  return call<ExpenseListResponse>(accessToken, "GET", `/expenses${qs ? `?${qs}` : ""}`);
}

/** GET /expenses/{id} — single claim details. */
export function getExpense(accessToken: string, id: number): Promise<Expense> {
  return call<Expense>(accessToken, "GET", `/expenses/${id}`);
}

/** POST /expenses/{id}/approve — manager/admin approves a pending claim. */
export function approveExpense(accessToken: string, id: number): Promise<Expense> {
  return call<Expense>(accessToken, "POST", `/expenses/${id}/approve`);
}

/** POST /expenses/{id}/reject — manager/admin rejects a pending claim with a reason. */
export function rejectExpense(accessToken: string, id: number, rejectionReason: string): Promise<Expense> {
  return call<Expense>(accessToken, "POST", `/expenses/${id}/reject`, {
    rejection_reason: rejectionReason,
  });
}
