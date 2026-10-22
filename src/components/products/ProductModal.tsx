"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import {
  createProduct,
  createProductOption,
  getProduct,
  listProductOptions,
  setProductActive,
  updateProduct,
  type Product,
  type ProductInput,
  type ProductOption,
} from "@/lib/api/products";

// SESSION_EXPIRED is the error shown when the JWT token is missing from sessionStorage.
const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

// Draft holds the form's editable values. All fields are strings so inputs stay controlled.
type Draft = {
  name: string;
  tagline: string;
  material_id: string;
  orientation: "vertical" | "horizontal" | "";
  mrp: string;
  sale_price: string;
  tax_included: boolean;
  height_cm: string;
  length_cm: string;
  width_cm: string;
  tank_diameter_mm: string;
  thickness_mm: string;
  weight_kg: string;
  inlet_in: string;
  outlet_in: string;
  drain_in: string;
  features: string[];
};

type MeasureKey =
  | "height_cm" | "length_cm" | "width_cm" | "tank_diameter_mm"
  | "thickness_mm" | "weight_kg" | "inlet_in" | "outlet_in" | "drain_in";

const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: "height_cm",       label: "Height (cm)"   },
  { key: "length_cm",       label: "Length (cm)"   },
  { key: "width_cm",        label: "Width (cm)"    },
  { key: "tank_diameter_mm",label: "Diameter (mm)" },
  { key: "thickness_mm",    label: "Thickness (mm)"},
  { key: "weight_kg",       label: "Weight (kg)"   },
  { key: "inlet_in",        label: "Inlet (in)"    },
  { key: "outlet_in",       label: "Outlet (in)"   },
  { key: "drain_in",        label: "Drain (in)"    },
];

const OPTION_FIELD = { material: "material_id" } as const;
const OPTION_LABEL = { material: "Material"    } as const;

// Helpers that convert between string form values and DB-ready types.
const idText     = (id: number | null | undefined) => (id ? String(id) : "");
const optionId   = (text: string)  => (text ? Number(text) : null);
const toNumber   = (text: string)  => (text.trim() === "" ? null : Number(text));
const isBlankOrNumber = (text: string) =>
  text.trim() === "" || (Number.isFinite(Number(text)) && Number(text) >= 0);
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

// slugFor builds a URL-safe slug. The random suffix prevents collisions when two products share a name.
const slugFor = (name: string) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "product";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

const toDraft = (product: Product | null): Draft => ({
  name:             product?.name             ?? "",
  tagline:          product?.tagline          ?? "",
  material_id:      idText(product?.material_id),
  orientation:      product?.orientation      ?? "vertical",
  mrp:              product?.mrp              ?? "",
  sale_price:       product?.sale_price       ?? "",
  tax_included:     product?.tax_included     ?? true,
  height_cm:        product?.height_cm        ?? "",
  length_cm:        product?.length_cm        ?? "",
  width_cm:         product?.width_cm         ?? "",
  tank_diameter_mm: product?.tank_diameter_mm ?? "",
  thickness_mm:     product?.thickness_mm     ?? "",
  weight_kg:        product?.weight_kg        ?? "",
  inlet_in:         product?.inlet_in         ?? "",
  outlet_in:        product?.outlet_in        ?? "",
  drain_in:         product?.drain_in         ?? "",
  features:         product?.features         ?? [],
});

// problemWith returns the first validation error, or null when the draft is ready to save.
function problemWith(draft: Draft): string | null {
  if (!draft.name.trim()) return "Enter the product name.";
  if (draft.mrp.trim() === "" || !isBlankOrNumber(draft.mrp)) return "Enter the MRP as a number.";
  if (!isBlankOrNumber(draft.sale_price)) return "Enter the sale price as a number.";
  if (draft.sale_price.trim() !== "" && Number(draft.sale_price) > Number(draft.mrp))
    return "The sale price cannot be higher than the MRP.";
  const badMeasure = MEASURES.find(({ key }) => !isBlankOrNumber(draft[key]));
  if (badMeasure) return `${badMeasure.label} must be a number.`;
  return null;
}

// toInput converts the Draft strings into the ProductInput the API expects.
function toInput(draft: Draft, product: Product | null): ProductInput {
  return {
    name:             draft.name.trim(),
    slug:             product?.slug ?? slugFor(draft.name),
    material_id:      optionId(draft.material_id),
    tagline:          draft.tagline.trim() || null,
    short_description:product?.short_description ?? null,
    is_popular:       product?.is_popular ?? false,
    is_active:        product?.is_active  ?? true,
    model_number:     product?.model_number ?? null,
    sku:              product?.sku          ?? null,
    capacity_litres:  product?.capacity_litres  ?? null,
    capacity_display: product?.capacity_display ?? null,
    orientation:      draft.orientation || null,
    features:         draft.features,
    mrp:              toNumber(draft.mrp),
    sale_price:       toNumber(draft.sale_price),
    tax_included:     draft.tax_included,
    height_cm:        toNumber(draft.height_cm),
    length_cm:        toNumber(draft.length_cm),
    width_cm:         toNumber(draft.width_cm),
    tank_diameter_mm: toNumber(draft.tank_diameter_mm),
    thickness_mm:     toNumber(draft.thickness_mm),
    weight_kg:        toNumber(draft.weight_kg),
    inlet_in:         toNumber(draft.inlet_in),
    outlet_in:        toNumber(draft.outlet_in),
    drain_in:         toNumber(draft.drain_in),
  };
}

const sortByName = (items: ProductOption[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// Switch is a small toggle that mirrors the employee-modal style.
function Switch({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-semibold text-gray-700 disabled:opacity-70"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#0E4D3A]" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2)] transition-all ${
            checked ? "left-[16px]" : "left-[2px]"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
type Props = {
  /** null = create a new product; a number = edit that product. */
  productId: number | null;
  onClose: () => void;
  /** Called after a successful save or archive so the list reloads. */
  onChanged: () => void;
};

export default function ProductModal({ productId, onClose, onChanged }: Props) {
  const isNew = productId === null;

  const [product,      setProduct     ] = useState<Product | null>(null);
  const [draft,        setDraft       ] = useState<Draft>(() => toDraft(null));
  const [options,      setOptions     ] = useState<ProductOption[]>([]);
  const [isLoading,    setIsLoading   ] = useState(!isNew);
  const [isSaving,     setIsSaving    ] = useState(false);
  const [error,        setError       ] = useState("");
  const [featureText,  setFeatureText ] = useState("");
  const [addingOption, setAddingOption] = useState<"material" | null>(null);
  const [newOptionName,setNewOptionName] = useState("");

  // token() reads the JWT from sessionStorage and sets an error when it is missing.
  const token = () => {
    const t = sessionStorage.getItem("ogera_access_token");
    if (!t) setError(SESSION_EXPIRED);
    return t;
  };

  // Close on Escape key.
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !isSaving) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSaving, onClose]);

  // Load the existing product when editing.
  useEffect(() => {
    if (productId === null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const t = sessionStorage.getItem("ogera_access_token");
      if (!t) { setError(SESSION_EXPIRED); setIsLoading(false); return; }
      getProduct(t, productId)
        .then((p)  => { if (!cancelled) { setProduct(p); setDraft(toDraft(p)); } })
        .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load this product."); })
        .finally(()=> { if (!cancelled) setIsLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [productId]);

  // Load the material options once on mount.
  useEffect(() => {
    const t = sessionStorage.getItem("ogera_access_token");
    if (!t) return;
    listProductOptions(t, "material")
      .then(setOptions)
      .catch(() => setError("Could not load the material list."));
  }, []);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const readOnly = isLoading;

  // submit validates the draft and calls create or update.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving || isLoading) return;
    const problem = problemWith(draft);
    if (problem) { setError(problem); return; }
    const t = token();
    if (!t) return;
    setIsSaving(true);
    setError("");
    const input = toInput(draft, product);
    try {
      if (product) await updateProduct(t, product.id, input);
      else         await createProduct(t, input);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the product. Please try again.");
      setIsSaving(false);
    }
  };

  // toggleArchive flips is_active between true (visible) and false (hidden/archived).
  const toggleArchive = async () => {
    if (!product) return;
    const t = token();
    if (!t) return;
    setIsSaving(true);
    setError("");
    try {
      await setProductActive(t, product.id, !product.is_active);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not change the product status. Please try again.");
      setIsSaving(false);
    }
  };

  const addFeature = () => {
    const f = featureText.trim();
    setFeatureText("");
    if (!f || draft.features.includes(f)) return;
    if (f.length > 200) { setError("A feature can be up to 200 characters."); return; }
    set("features")([...draft.features, f]);
  };

  const onFeatureKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addFeature(); }
  };

  const createOption = async (kind: "material") => {
    const name = newOptionName.trim();
    if (!name) return;
    const t = token();
    if (!t) return;
    setError("");
    try {
      const option = await createProductOption(t, kind, name);
      setOptions((cur) => sortByName([...cur.filter((o) => o.id !== option.id), option]));
      set(OPTION_FIELD[kind])(String(option.id));
      setAddingOption(null);
      setNewOptionName("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Could not add the ${OPTION_LABEL[kind].toLowerCase()}.`);
    }
  };

  const dateLine = product
    ? `Added ${formatDate(product.created_at)} · Updated ${formatDate(product.updated_at)}`
    : "Fill in the details, then save.";

  // ── Render ───────────────────────────────────────────────────────────────
  // On mobile the modal fills the whole screen (bg-white, full height).
  // On sm+ it becomes a centered overlay dialog (max-w-2xl, rounded, shadow).
  return (
    <div
      className="fixed inset-0 z-[1100] bg-white overflow-y-auto sm:grid sm:place-items-center sm:p-4 sm:bg-[rgba(17,18,20,0.45)] sm:backdrop-blur-[5px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="flex h-dvh w-full flex-col bg-gray-50 sm:h-auto sm:min-h-0 sm:max-h-[90vh] sm:max-w-2xl sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 bg-white shrink-0">
          <div>
            <p id="product-modal-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">
              {isNew ? "New Product" : "Edit Product"}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{dateLine}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          {/*
            The body is a CSS grid. On mobile: 1 column. On sm+: 2 columns.
            Each section label and wide field gets sm:col-span-2.
          */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">

            {isLoading ? (
              // Skeleton mirrors the exact form layout so the modal doesn't jump when data loads.
              <>
                {/* Basic Info */}
                <div className="sm:col-span-2 h-2.5 w-16 rounded bg-gray-200 animate-pulse mt-1" />
                <div className="crm-field-label sm:col-span-2">
                  <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                </div>
                <div className="crm-field-label sm:col-span-2">
                  <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
                  <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                </div>

                {/* Material + Orientation */}
                <div className="crm-field-label">
                  <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
                  <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                </div>
                <div className="crm-field-label">
                  <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-11 rounded-lg bg-gray-200 animate-pulse" />
                    <div className="h-11 rounded-lg bg-gray-200 animate-pulse" />
                  </div>
                </div>

                {/* Pricing */}
                <div className="sm:col-span-2 h-2.5 w-12 rounded bg-gray-200 animate-pulse mt-1" />
                <div className="crm-field-label">
                  <div className="h-3 w-14 rounded bg-gray-200 animate-pulse" />
                  <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                </div>
                <div className="crm-field-label">
                  <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                  <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <div className="h-5 w-[34px] rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                </div>

                {/* Dimensions */}
                <div className="sm:col-span-2 h-2.5 w-28 rounded bg-gray-200 animate-pulse mt-1" />
                <div className="sm:col-span-2 h-3 w-3/4 rounded bg-gray-200 animate-pulse -mt-2" />
                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="crm-field-label">
                      <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
                      <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="sm:col-span-2 h-2.5 w-16 rounded bg-gray-200 animate-pulse mt-1" />
                <div className="sm:col-span-2 flex gap-2">
                  <div className="h-7 w-28 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-7 w-20 rounded-full bg-gray-200 animate-pulse" />
                </div>
                <div className="sm:col-span-2 h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
              </>
            ) : (
              <>
                {/* Inline error — first thing the user sees when something goes wrong */}
                {error && (
                  <p role="alert" className="sm:col-span-2 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
                    {error}
                  </p>
                )}

                {/* ── Basic Info ────────────────────────────────────────── */}
                <p className="sm:col-span-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                  Basic Info
                </p>

                <label className="crm-field-label sm:col-span-2" htmlFor="pm-name">
                  Product Name
                  <input
                    id="pm-name"
                    className="crm-input"
                    value={draft.name}
                    disabled={readOnly}
                    onChange={(e) => set("name")(e.target.value)}
                    maxLength={200}
                  />
                </label>

                <label className="crm-field-label sm:col-span-2" htmlFor="pm-tagline">
                  Tagline{" "}
                  <span className="font-normal text-gray-400">(shown on the product card)</span>
                  <input
                    id="pm-tagline"
                    className="crm-input"
                    value={draft.tagline}
                    disabled={readOnly}
                    onChange={(e) => set("tagline")(e.target.value)}
                    maxLength={200}
                  />
                </label>

                {/* ── Material & Orientation (side by side on desktop) ── */}
                <div className="crm-field-label">
                  <div className="flex items-center justify-between">
                    <label htmlFor="pm-material">Material</label>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingOption(addingOption === "material" ? null : "material");
                        setNewOptionName("");
                      }}
                      className="text-[11px] font-semibold text-[#0E4D3A] hover:underline"
                    >
                      + Add new
                    </button>
                  </div>
                  <select
                    id="pm-material"
                    className="crm-select"
                    value={draft.material_id}
                    disabled={readOnly}
                    onChange={(e) => set("material_id")(e.target.value)}
                  >
                    <option value="">None</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  {addingOption === "material" && (
                    <div className="flex gap-2 mt-1">
                      <input
                        className="crm-input flex-1"
                        aria-label="New material name"
                        placeholder="New material name"
                        value={newOptionName}
                        onChange={(e) => setNewOptionName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createOption("material"); } }}
                        maxLength={80}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => createOption("material")}
                        className="inline-flex h-11 items-center justify-center rounded-[8px] px-3 text-sm font-semibold bg-[#0E4D3A] text-white hover:bg-[#0B3E2F]"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="crm-field-label">
                  <span>Orientation</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["vertical", "horizontal"] as const).map((o) => {
                      const selected = draft.orientation === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={selected}
                          disabled={readOnly}
                          onClick={() => set("orientation")(o)}
                          className={`flex h-11 items-center justify-center rounded-lg border text-sm capitalize transition-colors disabled:opacity-70 ${
                            selected
                              ? "border-[#0E4D3A] bg-[rgba(14,77,58,0.06)] font-semibold text-[#0E4D3A]"
                              : "border-gray-200 bg-white font-medium text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Pricing ───────────────────────────────────────────── */}
                <p className="sm:col-span-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                  Pricing
                </p>

                <label className="crm-field-label" htmlFor="pm-mrp">
                  MRP (₹)
                  <input
                    id="pm-mrp"
                    inputMode="decimal"
                    className="crm-input"
                    value={draft.mrp}
                    disabled={readOnly}
                    onChange={(e) => set("mrp")(e.target.value)}
                  />
                </label>

                <label className="crm-field-label" htmlFor="pm-sale">
                  Sale Price (₹){" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                  <input
                    id="pm-sale"
                    inputMode="decimal"
                    className="crm-input"
                    value={draft.sale_price}
                    disabled={readOnly}
                    onChange={(e) => set("sale_price")(e.target.value)}
                  />
                </label>

                <div className="sm:col-span-2">
                  <Switch
                    label="Tax included"
                    checked={draft.tax_included}
                    disabled={readOnly}
                    onChange={set("tax_included")}
                  />
                </div>

                {/* ── Dimensions ───────────────────────────────────────── */}
                <p className="sm:col-span-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                  Dimensions &amp; Specs
                </p>
                <p className="sm:col-span-2 -mt-2 text-xs text-gray-400">
                  Fill only what applies — height + diameter for vertical tanks, length + width + height for horizontal ones.
                </p>

                {/* 9 dimension inputs in a nested 3-column grid */}
                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MEASURES.map(({ key, label }) => (
                    <label key={key} className="crm-field-label" htmlFor={`pm-${key}`}>
                      {label}
                      <input
                        id={`pm-${key}`}
                        inputMode="decimal"
                        className="crm-input"
                        value={draft[key]}
                        disabled={readOnly}
                        onChange={(e) => set(key)(e.target.value)}
                      />
                    </label>
                  ))}
                </div>

                {/* ── Features ─────────────────────────────────────────── */}
                <p className="sm:col-span-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                  Features
                </p>

                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  {draft.features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#0E4D3A]/20 bg-[rgba(14,77,58,0.06)] py-1 pl-3 pr-1.5 text-[12.5px] font-semibold text-[#0E4D3A]"
                    >
                      {f}
                      {!readOnly && (
                        <button
                          type="button"
                          aria-label={`Remove ${f}`}
                          onClick={() => set("features")(draft.features.filter((x) => x !== f))}
                          className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#0E4D3A]/10"
                        >
                          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                  {draft.features.length === 0 && readOnly && (
                    <span className="text-sm text-gray-400">No features added.</span>
                  )}
                </div>

                <div className="sm:col-span-2 flex gap-2">
                  <input
                    className="crm-input flex-1"
                    aria-label="Add a feature"
                    placeholder="Type a feature and press Enter, e.g. SS304 food grade"
                    value={featureText}
                    onChange={(e) => setFeatureText(e.target.value)}
                    onKeyDown={onFeatureKey}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="inline-flex h-11 items-center justify-center rounded-[8px] border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          {/*
            On mobile: wrap with gap so archive, cancel, and save stack naturally.
            On sm+: flex row — archive sits on the left (mr-auto), cancel+save on the right.
          */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              {product && (
                <button
                  type="button"
                  onClick={toggleArchive}
                  disabled={isSaving || isLoading}
                  className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] px-3 text-sm font-semibold disabled:opacity-50 sm:mr-auto ${
                    product.is_active
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-[#0E4D3A] hover:bg-[rgba(14,77,58,0.06)]"
                  }`}
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  {product.is_active ? "Archive" : "Restore"}
                </button>
              )}

              <div className={`flex gap-3 ${!product ? "ml-auto" : ""}`}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#E1E1E6] bg-white px-4 text-sm font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold disabled:opacity-60 bg-[#0E4D3A] text-white transition-colors hover:bg-[#0B3E2F]"
                >
                  {isSaving ? "Saving…" : isNew ? "Add Product" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
