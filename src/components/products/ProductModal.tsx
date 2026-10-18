"use client";

import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import {
  createProduct,
  createProductOption,
  getProduct,
  listProductOptions,
  setProductActive,
  updateProduct,
  type OptionKind,
  type Product,
  type ProductInput,
  type ProductOption,
} from "@/lib/api/products";

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

type Draft = {
  name: string;
  tagline: string;
  brand_id: string;
  category_id: string;
  material_id: string;
  orientation: "vertical" | "horizontal" | "";
  mrp: string;
  sale_price: string;
  special_price_active: boolean;
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

type MeasureKey = "height_cm" | "length_cm" | "width_cm" | "tank_diameter_mm" | "thickness_mm" | "weight_kg" | "inlet_in" | "outlet_in" | "drain_in";

const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: "height_cm", label: "Height (cm)" },
  { key: "length_cm", label: "Length (cm)" },
  { key: "width_cm", label: "Width (cm)" },
  { key: "tank_diameter_mm", label: "Diameter (mm)" },
  { key: "thickness_mm", label: "Thickness (mm)" },
  { key: "weight_kg", label: "Weight (kg)" },
  { key: "inlet_in", label: "Inlet (in)" },
  { key: "outlet_in", label: "Outlet (in)" },
  { key: "drain_in", label: "Drain (in)" },
];

/** The draft field each dropdown writes to. */
const OPTION_FIELD = { brand: "brand_id", category: "category_id", material: "material_id" } as const;
const OPTION_LABEL = { brand: "Brand", category: "Category", material: "Material" } as const;

const fieldClass = "h-10 w-full rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-sm text-[#1A1C21] outline-none focus:border-[#0E4D3A] disabled:bg-[#F7F8F9] disabled:text-[#4B5060]";
const labelClass = "grid gap-1.5 text-xs font-semibold text-[#4B5060]";

const idText = (id: number | null | undefined) => (id ? String(id) : "");
const optionId = (text: string) => (text ? Number(text) : null);
const toNumber = (text: string) => (text.trim() === "" ? null : Number(text));
const isBlankOrNumber = (text: string) => text.trim() === "" || (Number.isFinite(Number(text)) && Number(text) >= 0);
const formatDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** A URL-safe slug for a new product. The random tail keeps two products with the same name from clashing. */
const slugFor = (name: string) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "product";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

const toDraft = (product: Product | null): Draft => ({
  name: product?.name ?? "",
  tagline: product?.tagline ?? "",
  brand_id: idText(product?.brand_id),
  category_id: idText(product?.category_id),
  material_id: idText(product?.material_id),
  orientation: product?.orientation ?? "vertical",
  mrp: product?.mrp ?? "",
  sale_price: product?.sale_price ?? "",
  special_price_active: product?.special_price_active ?? false,
  tax_included: product?.tax_included ?? true,
  height_cm: product?.height_cm ?? "",
  length_cm: product?.length_cm ?? "",
  width_cm: product?.width_cm ?? "",
  tank_diameter_mm: product?.tank_diameter_mm ?? "",
  thickness_mm: product?.thickness_mm ?? "",
  weight_kg: product?.weight_kg ?? "",
  inlet_in: product?.inlet_in ?? "",
  outlet_in: product?.outlet_in ?? "",
  drain_in: product?.drain_in ?? "",
  features: product?.features ?? [],
});

/** The first problem with the draft, or null when it can be saved. */
function problemWith(draft: Draft): string | null {
  if (!draft.name.trim()) return "Enter the product name.";
  if (draft.mrp.trim() === "" || !isBlankOrNumber(draft.mrp)) return "Enter the MRP as a number.";
  if (!isBlankOrNumber(draft.sale_price)) return "Enter the sale price as a number.";
  if (draft.sale_price.trim() !== "" && Number(draft.sale_price) > Number(draft.mrp)) return "The sale price cannot be higher than the MRP.";
  if (draft.special_price_active && draft.sale_price.trim() === "") return "Enter a sale price to turn on special price.";
  const badMeasure = MEASURES.find(({ key }) => !isBlankOrNumber(draft[key]));
  if (badMeasure) return `${badMeasure.label} must be a number.`;
  return null;
}

function toInput(draft: Draft, product: Product | null): ProductInput {
  return {
    name: draft.name.trim(),
    slug: product?.slug ?? slugFor(draft.name),
    brand_id: optionId(draft.brand_id),
    category_id: optionId(draft.category_id),
    material_id: optionId(draft.material_id),
    tagline: draft.tagline.trim() || null,
    short_description: product?.short_description ?? null,
    is_popular: product?.is_popular ?? false,
    is_active: product?.is_active ?? true,
    model_number: product?.model_number ?? null,
    sku: product?.sku ?? null,
    capacity_litres: product?.capacity_litres ?? null,
    capacity_display: product?.capacity_display ?? null,
    orientation: draft.orientation || null,
    features: draft.features,
    mrp: toNumber(draft.mrp),
    sale_price: toNumber(draft.sale_price),
    currency: product?.currency ?? "INR",
    special_price_active: draft.special_price_active,
    tax_included: draft.tax_included,
    height_cm: toNumber(draft.height_cm),
    length_cm: toNumber(draft.length_cm),
    width_cm: toNumber(draft.width_cm),
    tank_diameter_mm: toNumber(draft.tank_diameter_mm),
    thickness_mm: toNumber(draft.thickness_mm),
    weight_kg: toNumber(draft.weight_kg),
    inlet_in: toNumber(draft.inlet_in),
    outlet_in: toNumber(draft.outlet_in),
    drain_in: toNumber(draft.drain_in),
    main_image_url: product?.main_image_url ?? null,
  };
}

const sortByName = (items: ProductOption[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

function Field({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className={labelClass}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[13px] font-semibold text-[#3A3E4A] disabled:opacity-70"
    >
      <span aria-hidden="true" className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#0E4D3A]" : "bg-[#C9CDD4]"}`}>
        <span className={`absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2)] transition-all ${checked ? "left-[16px]" : "left-[2px]"}`} />
      </span>
      {label}
    </button>
  );
}

type Props = {
  /** null = add a new product. */
  productId: number | null;
  /** Admins and managers can change products; everyone else sees the details read-only. */
  canEdit: boolean;
  onClose: () => void;
  /** Called after a save or archive so the list reloads and the modal closes. */
  onChanged: () => void;
};

export default function ProductModal({ productId, canEdit, onClose, onChanged }: Props) {
  const isNew = productId === null;
  const [product, setProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(null));
  const [options, setOptions] = useState<Record<OptionKind, ProductOption[]>>({ brand: [], category: [], material: [] });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [featureText, setFeatureText] = useState("");
  const [addingOption, setAddingOption] = useState<OptionKind | null>(null);
  const [newOptionName, setNewOptionName] = useState("");

  const token = () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) setError(SESSION_EXPIRED);
    return accessToken;
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape" && !isSaving) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  // Load the full product (specs and features) when the modal opens on an existing one.
  useEffect(() => {
    if (productId === null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const accessToken = sessionStorage.getItem("ogera_access_token");
      if (!accessToken) { setError(SESSION_EXPIRED); setIsLoading(false); return; }
      getProduct(accessToken, productId)
        .then((loaded) => { if (!cancelled) { setProduct(loaded); setDraft(toDraft(loaded)); } })
        .catch((caught) => { if (!cancelled) setError(caught instanceof ApiError ? caught.message : "Could not load this product."); })
        .finally(() => { if (!cancelled) setIsLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [productId]);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    Promise.all([
      listProductOptions(accessToken, "brand"),
      listProductOptions(accessToken, "category"),
      listProductOptions(accessToken, "material"),
    ])
      .then(([brand, category, material]) => setOptions({ brand, category, material }))
      .catch(() => setError("Could not load the brand, category and material lists."));
  }, []);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const readOnly = !canEdit || isLoading;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || isSaving || isLoading) return;
    const problem = problemWith(draft);
    if (problem) { setError(problem); return; }
    const accessToken = token();
    if (!accessToken) return;
    setIsSaving(true);
    setError("");
    const input = toInput(draft, product);
    try {
      if (product) await updateProduct(accessToken, product.id, input);
      else await createProduct(accessToken, input);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the product. Please try again.");
      setIsSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!product) return;
    const accessToken = token();
    if (!accessToken) return;
    setIsSaving(true);
    setError("");
    try {
      await setProductActive(accessToken, product.id, !product.is_active);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not change the product status. Please try again.");
      setIsSaving(false);
    }
  };

  const addFeature = () => {
    const feature = featureText.trim();
    setFeatureText("");
    if (!feature || draft.features.includes(feature)) return;
    if (feature.length > 200) { setError("A feature can be up to 200 characters."); return; }
    set("features")([...draft.features, feature]);
  };

  const onFeatureKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); addFeature(); }
  };

  const createOption = async (kind: OptionKind) => {
    const name = newOptionName.trim();
    if (!name) return;
    const accessToken = token();
    if (!accessToken) return;
    setError("");
    try {
      const option = await createProductOption(accessToken, kind, name);
      setOptions((current) => ({ ...current, [kind]: sortByName([...current[kind].filter((item) => item.id !== option.id), option]) }));
      set(OPTION_FIELD[kind])(String(option.id));
      setAddingOption(null);
      setNewOptionName("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Could not add the ${OPTION_LABEL[kind].toLowerCase()}. Please try again.`);
    }
  };

  const dateLine = product
    ? `Added ${formatDate(product.created_at)} · Updated ${formatDate(product.updated_at)}`
    : "Fill in the details, then save to add it to the catalogue.";

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[5px]" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="flex max-h-[min(912px,calc(100dvh-32px))] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(16,24,40,0.28)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EFEFF2] px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#EAF2FE]">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1565D8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a2 2 0 0 1-1 1.7V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.7A2 2 0 0 1 7 7z" /></svg>
            </span>
            <div className="min-w-0">
              <p id="product-modal-title" className="m-0 text-[16.5px] font-bold text-[#1A1C21]">{isNew ? "New Product" : "Product Details"}</p>
              <p className="mt-0.5 text-[12.5px] text-[#6B7080]">{dateLine}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[#6B7080] hover:bg-[#F7F8F9]">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-[#6B7080]">Loading product…</p>
            ) : (
              <>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">Basic Info</span>
                <Field label="Product Name" htmlFor="pm-name">
                  <input id="pm-name" className={fieldClass} value={draft.name} disabled={readOnly} onChange={(e) => set("name")(e.target.value)} maxLength={200} />
                </Field>
                <Field label={<>Tagline <span className="font-medium text-[#9AA0AC]">(shown on the product card)</span></>} htmlFor="pm-tagline">
                  <input id="pm-tagline" className={fieldClass} value={draft.tagline} disabled={readOnly} onChange={(e) => set("tagline")(e.target.value)} maxLength={200} />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(["category", "brand", "material"] as const).map((kind) => (
                    <div key={kind} className={labelClass}>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`pm-${kind}`}>{OPTION_LABEL[kind]}</label>
                        {canEdit && (
                          <button type="button" onClick={() => { setAddingOption(addingOption === kind ? null : kind); setNewOptionName(""); }} className="text-[11.5px] font-semibold text-[#0E4D3A] hover:underline">
                            + Add new
                          </button>
                        )}
                      </div>
                      <select id={`pm-${kind}`} className={fieldClass} value={draft[OPTION_FIELD[kind]]} disabled={readOnly} onChange={(e) => set(OPTION_FIELD[kind])(e.target.value)}>
                        <option value="">None</option>
                        {options[kind].map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                      </select>
                      {addingOption === kind && (
                        <div className="flex gap-2">
                          <input
                            className={fieldClass}
                            aria-label={`New ${OPTION_LABEL[kind].toLowerCase()} name`}
                            placeholder={`New ${OPTION_LABEL[kind].toLowerCase()}`}
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createOption(kind); } }}
                            maxLength={80}
                            autoFocus
                          />
                          <button type="button" onClick={() => createOption(kind)} className="h-10 shrink-0 rounded-[8px] bg-[#0E4D3A] px-3 text-sm font-semibold text-white">Add</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className={labelClass}>
                  <span>Orientation</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["vertical", "horizontal"] as const).map((orientation) => {
                      const selected = draft.orientation === orientation;
                      return (
                        <button
                          key={orientation}
                          type="button"
                          aria-pressed={selected}
                          disabled={readOnly}
                          onClick={() => set("orientation")(orientation)}
                          className={`flex h-10 items-center justify-center gap-2 rounded-[8px] border text-[13px] capitalize disabled:opacity-70 ${selected ? "border-[1.5px] border-[#0E4D3A] bg-[rgba(14,122,79,0.06)] font-semibold text-[#0E4D3A]" : "border-[#DEE1E5] bg-white font-medium text-[#4B5060]"}`}
                        >
                          {orientation}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">Pricing</span>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="MRP (₹)" htmlFor="pm-mrp">
                    <input id="pm-mrp" inputMode="decimal" className={fieldClass} value={draft.mrp} disabled={readOnly} onChange={(e) => set("mrp")(e.target.value)} />
                  </Field>
                  <Field label={<>Sale Price (₹) <span className="font-medium text-[#9AA0AC]">(optional)</span></>} htmlFor="pm-sale">
                    <input id="pm-sale" inputMode="decimal" className={fieldClass} value={draft.sale_price} disabled={readOnly} onChange={(e) => set("sale_price")(e.target.value)} />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-5">
                  <Switch label="Special price active" checked={draft.special_price_active} disabled={readOnly} onChange={set("special_price_active")} />
                  <Switch label="Tax included" checked={draft.tax_included} disabled={readOnly} onChange={set("tax_included")} />
                </div>

                <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">Dimensions &amp; Specs</span>
                <p className="-mt-2 text-[11.5px] text-[#9AA0AC]">Fill only what applies — height + diameter for vertical tanks, length + width + height for horizontal/rectangular ones.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {MEASURES.map(({ key, label }) => (
                    <Field key={key} label={label} htmlFor={`pm-${key}`}>
                      <input id={`pm-${key}`} inputMode="decimal" className={fieldClass} value={draft[key]} disabled={readOnly} onChange={(e) => set(key)(e.target.value)} />
                    </Field>
                  ))}
                </div>

                <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">Features</span>
                <div className="flex flex-wrap gap-2">
                  {draft.features.map((feature) => (
                    <span key={feature} className="inline-flex items-center gap-1.5 rounded-full border border-[#0E4D3A]/20 bg-[rgba(14,122,79,0.06)] py-1 pl-3 pr-1.5 text-[12.5px] font-semibold text-[#0E4D3A]">
                      {feature}
                      {!readOnly && (
                        <button type="button" aria-label={`Remove ${feature}`} onClick={() => set("features")(draft.features.filter((item) => item !== feature))} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#0E4D3A]/10">
                          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </span>
                  ))}
                  {draft.features.length === 0 && readOnly && <span className="text-[13px] text-[#9AA0AC]">No features added.</span>}
                </div>
                {canEdit && !isLoading && (
                  <div className="flex gap-2">
                    <input
                      className={fieldClass}
                      aria-label="Add a feature"
                      placeholder="Type a feature and press Enter, e.g. SS304 food grade"
                      value={featureText}
                      onChange={(e) => setFeatureText(e.target.value)}
                      onKeyDown={onFeatureKey}
                      maxLength={200}
                    />
                    <button type="button" onClick={addFeature} className="h-10 shrink-0 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-sm font-semibold text-[#3A3E4A] hover:bg-[#F7F8F9]">Add</button>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p role="alert" className="shrink-0 border-t border-[#FECDCA] bg-[#FEF3F2] px-6 py-2.5 text-[13px] text-[#B42318]">{error}</p>}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-[#EFEFF2] px-6 py-4">
            {canEdit && product ? (
              <button type="button" onClick={toggleArchive} disabled={isSaving || isLoading} className={`flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold disabled:opacity-50 ${product.is_active ? "text-[#B42323] hover:bg-[#FEF3F2]" : "text-[#0E4D3A] hover:bg-[#E7F5EE]"}`}>
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></svg>
                {product.is_active ? "Archive Product" : "Restore Product"}
              </button>
            ) : <span />}
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-[#DEE1E5] bg-white px-4 text-[13.5px] font-semibold text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-50">
                {canEdit ? "Cancel" : "Close"}
              </button>
              {canEdit && (
                <button type="submit" disabled={isSaving || isLoading} className="h-10 rounded-lg bg-[#0E4D3A] px-4 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {isSaving ? "Saving…" : isNew ? "Add Product" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
