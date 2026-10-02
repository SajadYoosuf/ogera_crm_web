export interface Sale {
  id: number;
  saleDate: string;
  buyerName: string;
  buyerPhone: string;
  address?: string;
  panchayath?: string;
  ward?: string;
  tankSize?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  houseStage?: string;
  currentTank?: string;
  waterSource?: string;
  sourceOfSale?: string;
  remarks?: string;
  createdAt?: string;
}

export interface SalesResponse {
  success: boolean;
  data?: {
    sales: Sale[];
    total: number;
    page: number;
    totalPages: number;
    totalSales: number;
    totalRevenue: number;
    totalTanks: number;
    activePanchayaths: number;
  };
  error?: { message?: string };
}

// These three lists mirror the ENUM columns on the sales table. venting-next also
// offers "offline" and "showroom" as sources, which source_of_sale cannot store.
export const SOURCES_OF_SALE = ["direct_call", "walk_in", "referral", "facebook", "google", "other"] as const;
export const HOUSE_STAGES = ["under_construction", "built", "renovation"] as const;
export const CURRENT_TANKS = ["plastic", "other_ss", "none"] as const;

export const SOURCE_OF_SALE_OPTIONS = [
  { value: "direct_call", label: "Direct Call" },
  { value: "walk_in", label: "Walk-in" },
  { value: "referral", label: "Referral" },
  { value: "facebook", label: "Facebook Ads" },
  { value: "google", label: "Google" },
  { value: "other", label: "Other" },
] as const;

export const SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  SOURCE_OF_SALE_OPTIONS.map((option) => [option.value, option.label]),
);

export const WATER_LABEL: Record<string, string> = {
  borewell: "Borewell",
  corporation: "Corporation",
  well: "Open Well",
  other: "Other",
};

export function formatSaleDate(value: string, style: "short" | "long" = "long") {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", style === "short"
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCurrency(value?: number) {
  return typeof value === "number" && !Number.isNaN(value) ? `₹${value.toLocaleString("en-IN")}` : "—";
}
