import { request } from "./auth";

export type OptionKind = "brand" | "category" | "material";
export type ProductOption = { id: number; kind: OptionKind; name: string; slug: string };
export type OptionRef = { id: number; name: string };

/** Numbers come back from FastAPI as strings (decimals) or numbers; the form keeps them as strings. */
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
};

export type ProductListItem = Pick<
  Product,
  "id" | "name" | "slug" | "brand" | "category" | "capacity_display" | "mrp" | "sale_price" | "is_popular" | "is_active" | "main_image_url"
>;

export type ProductList = { items: ProductListItem[]; total: number; skip: number; limit: number };

type DecimalKey =
  | "mrp" | "sale_price" | "height_cm" | "length_cm" | "width_cm" | "tank_diameter_mm"
  | "inlet_in" | "outlet_in" | "drain_in" | "thickness_mm" | "weight_kg";

/** What the form sends: decimals go out as numbers, blanks as null. */
export type ProductInput = Omit<Product, "id" | "brand" | "category" | "material" | "discount_percent" | "you_save" | DecimalKey>
  & Record<DecimalKey, number | null>;

export type ProductQuery = { q?: string; brandId?: number; categoryId?: number; skip?: number; limit?: number };

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonHeaders = (token: string) => ({ ...authHeaders(token), "Content-Type": "application/json" });

export function listProducts(token: string, query: ProductQuery = {}) {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.brandId !== undefined) params.set("brand_id", String(query.brandId));
  if (query.categoryId !== undefined) params.set("category_id", String(query.categoryId));
  params.set("skip", String(query.skip ?? 0));
  params.set("limit", String(query.limit ?? 20));
  return request<ProductList>(`/products?${params}`, { headers: authHeaders(token) });
}

export const getProduct = (token: string, id: number) =>
  request<Product>(`/products/${id}`, { headers: authHeaders(token) });

export const createProduct = (token: string, input: ProductInput) =>
  request<Product>("/products", { method: "POST", headers: jsonHeaders(token), body: JSON.stringify(input) });

export const updateProduct = (token: string, id: number, input: Partial<ProductInput>) =>
  request<Product>(`/products/${id}`, { method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify(input) });

export const deleteProduct = (token: string, id: number) =>
  request<void>(`/products/${id}`, { method: "DELETE", headers: authHeaders(token) });

export const listProductOptions = (token: string, kind: OptionKind) =>
  request<ProductOption[]>(`/products/options?kind=${kind}`, { headers: authHeaders(token) });

export const createProductOption = (token: string, kind: OptionKind, name: string) =>
  request<ProductOption>("/products/options", {
    method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ kind, name }),
  });
