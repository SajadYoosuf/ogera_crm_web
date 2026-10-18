import { ApiError, request } from "./auth";

/** Mirrors the Products section of the backend API. Admins and managers edit; everyone signed in reads. */
export type OptionKind = "brand" | "category" | "material";
export type ProductOption = { id: number; kind: OptionKind; name: string; slug: string };
export type OptionRef = { id: number; name: string };

/** Decimals come back from FastAPI as strings; the form keeps them as strings too. */
export type Product = {
  id: number;
  name: string;
  slug: string;
  brand: OptionRef | null;
  category: OptionRef | null;
  material: OptionRef | null;
  brand_id: number | null;
  category_id: number | null;
  material_id: number | null;
  tagline: string | null;
  short_description: string | null;
  is_popular: boolean;
  is_active: boolean;
  model_number: string | null;
  sku: string | null;
  capacity_litres: number | null;
  capacity_display: string | null;
  orientation: "vertical" | "horizontal" | null;
  features: string[];
  mrp: string | null;
  sale_price: string | null;
  currency: string;
  special_price_active: boolean;
  tax_included: boolean;
  discount_percent: string;
  you_save: string;
  height_cm: string | null;
  length_cm: string | null;
  width_cm: string | null;
  tank_diameter_mm: string | null;
  inlet_in: string | null;
  outlet_in: string | null;
  drain_in: string | null;
  thickness_mm: string | null;
  weight_kg: string | null;
  main_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductListItem = Pick<
  Product,
  | "id" | "name" | "slug" | "tagline" | "brand" | "category" | "capacity_display" | "orientation"
  | "mrp" | "sale_price" | "special_price_active" | "is_popular" | "is_active" | "main_image_url"
>;

export type ProductList = { items: ProductListItem[]; total: number; skip: number; limit: number };

type DecimalKey =
  | "mrp" | "sale_price" | "height_cm" | "length_cm" | "width_cm" | "tank_diameter_mm"
  | "inlet_in" | "outlet_in" | "drain_in" | "thickness_mm" | "weight_kg";

/** What the form sends: decimals go out as numbers, blanks as null. */
export type ProductInput = Omit<Product, "id" | "brand" | "category" | "material" | "discount_percent" | "you_save" | "created_at" | "updated_at" | DecimalKey>
  & Record<DecimalKey, number | null>;

export type ProductQuery = {
  q?: string;
  isActive?: boolean;
  brandId?: number;
  categoryId?: number;
  materialId?: number;
  skip?: number;
  limit?: number;
};

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonHeaders = (token: string) => ({ ...authHeaders(token), "Content-Type": "application/json" });

/** Maps the backend's 401/403 into the wording the other screens use. */
async function authed<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
    throw error;
  }
}

/** Only admins and managers may add, edit or archive products (the backend enforces it too). */
export const canEditProducts = (role: string | undefined) => role === "admin" || role === "manager";

export function listProducts(token: string, query: ProductQuery = {}) {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.isActive !== undefined) params.set("is_active", String(query.isActive));
  if (query.brandId !== undefined) params.set("brand_id", String(query.brandId));
  if (query.categoryId !== undefined) params.set("category_id", String(query.categoryId));
  if (query.materialId !== undefined) params.set("material_id", String(query.materialId));
  params.set("skip", String(query.skip ?? 0));
  params.set("limit", String(query.limit ?? 8));
  return authed<ProductList>(`/products?${params}`, { headers: authHeaders(token) });
}

export const getProduct = (token: string, id: number) =>
  authed<Product>(`/products/${id}`, { headers: authHeaders(token) });

export const createProduct = (token: string, input: ProductInput) =>
  authed<Product>("/products", { method: "POST", headers: jsonHeaders(token), body: JSON.stringify(input) });

export const updateProduct = (token: string, id: number, input: Partial<ProductInput>) =>
  authed<Product>(`/products/${id}`, { method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify(input) });

/** Archive (`is_active: false`) and restore (`is_active: true`) both go through PATCH. */
export const setProductActive = (token: string, id: number, isActive: boolean) =>
  updateProduct(token, id, { is_active: isActive });

export const listProductOptions = (token: string, kind: OptionKind) =>
  authed<ProductOption[]>(`/products/options?kind=${kind}`, { headers: authHeaders(token) });

export const createProductOption = (token: string, kind: OptionKind, name: string) =>
  authed<ProductOption>("/products/options", { method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ kind, name }) });
