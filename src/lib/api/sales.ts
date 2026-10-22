import { ApiError, request } from "./auth";

/** Mirrors the Sales section of the backend API. Sales are not linked to contacts or products. */
export type Sale = {
  id: number;
  purchase_date: string | null;
  name: string;
  phone: string | null;
  alt_phone: string | null;
  address: string | null;
  purchased_product: string | null;
  created_at: string;
};

export type SaleList = { items: Sale[]; total: number; skip: number; limit: number };

export type SaleInput = {
  purchase_date?: string | null;
  name?: string;
  phone?: string | null;
  alt_phone?: string | null;
  address?: string | null;
  purchased_product?: string | null;
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
export function listSales(accessToken: string, params: { search?: string; skip?: number; limit?: number } = {}) {
  const query = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 20) });
  if (params.search) query.set("search", params.search);
  return authed<SaleList>("GET", `/sales?${query}`, accessToken);
}

/** GET /sales/products — distinct product names, for the form's suggestions. */
export const listSaleProducts = (accessToken: string) => authed<string[]>("GET", "/sales/products", accessToken);

export const createSale = (accessToken: string, input: SaleInput) => authed<Sale>("POST", "/sales", accessToken, input);

export const updateSale = (accessToken: string, id: number, input: SaleInput) => authed<Sale>("PUT", `/sales/${id}`, accessToken, input);

export const deleteSale = (accessToken: string, id: number) => authed<void>("DELETE", `/sales/${id}`, accessToken);
