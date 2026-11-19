/**
 * HTTP calls for the Sales resource.
 *
 * WHY this file exists:
 *   All API calls for one resource live together so the page and components
 *   never call fetch() directly. The request() helper (lib/api/auth.ts) adds
 *   timeout, base-URL config, and consistent ApiError throwing.
 *
 * INPUTS / OUTPUTS:
 *   Each exported function takes an accessToken (JWT from useAuth()) plus
 *   parameters, and returns typed data or throws ApiError on failure.
 */

import { ApiError, request } from "@/lib/api/auth";

/** A single sale record as returned by the API. */
export type Sale = {
  id: number;
  purchase_date: string | null;
  name: string;
  phone: string | null;
  alt_phone: string | null;
  address: string | null;
  purchased_product: string | null;
  branch: string | null;
  created_at: string;
  created_by_employee_id: number | null;
  created_by: { id: number; name: string; branch: string | null } | null;
};

export type SaleList = { items: Sale[]; total: number; skip: number; limit: number };

export type SaleInput = {
  purchase_date?: string | null;
  name?: string;
  phone?: string | null;
  alt_phone?: string | null;
  address?: string | null;
  purchased_product?: string | null;
  branch?: string | null;
  created_by_employee_id?: number | null;
};

async function authed<T>(method: string, path: string, accessToken: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
    throw error;
  }
}

/** GET /sales — one page, newest purchase first. */
export function listSales(accessToken: string, params: { search?: string; skip?: number; limit?: number; employee_id?: number } = {}) {
  const query = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 20) });
  if (params.search) query.set("search", params.search);
  if (params.employee_id != null) query.set("employee_id", String(params.employee_id));
  return authed<SaleList>("GET", `/sales?${query}`, accessToken);
}

/** GET /sales/products — distinct product names, for the form's suggestions. */
export const listSaleProducts = (accessToken: string) => authed<string[]>("GET", "/sales/products", accessToken);

export const createSale = (accessToken: string, input: SaleInput) => authed<Sale>("POST", "/sales", accessToken, input);
export const updateSale = (accessToken: string, id: number, input: SaleInput) => authed<Sale>("PUT", `/sales/${id}`, accessToken, input);
export const deleteSale = (accessToken: string, id: number) => authed<void>("DELETE", `/sales/${id}`, accessToken);
