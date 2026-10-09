"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import PageHeader from "@/components/products/PageHeader";
import {
  createProduct, createProductOption, deleteProduct, getProduct, listProductOptions, updateProduct,
  type OptionKind, type Product, type ProductInput, type ProductOption,
} from "@/lib/api/products";

type FormState = {
  name: string; slug: string; brand_id: string; category_id: string; material_id: string;
  tagline: string; short_description: string; is_popular: boolean; is_active: boolean;
  model_number: string; sku: string; capacity_litres: string; capacity_display: string; orientation: string;
  features: string[];
  mrp: string; sale_price: string; currency: string; special_price_active: boolean; tax_included: boolean;
  height_cm: string; length_cm: string; width_cm: string; tank_diameter_mm: string;
  inlet_in: string; outlet_in: string; drain_in: string; thickness_mm: string; weight_kg: string;
  main_image_url: string;
};

const blank: FormState = {
  name: "", slug: "", brand_id: "", category_id: "", material_id: "",
  tagline: "", short_description: "", is_popular: false, is_active: true,
  model_number: "", sku: "", capacity_litres: "", capacity_display: "", orientation: "",
  features: [],
  mrp: "", sale_price: "", currency: "INR", special_price_active: false, tax_included: true,
  height_cm: "", length_cm: "", width_cm: "", tank_diameter_mm: "",
  inlet_in: "", outlet_in: "", drain_in: "", thickness_mm: "", weight_kg: "",
  main_image_url: "",
};

const SPEC_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "height_cm", label: "Total Height (cm)" },
  { key: "length_cm", label: "Total Length (cm)" },
  { key: "width_cm", label: "Total Width (cm)" },
  { key: "tank_diameter_mm", label: "Tank Diameter (mm)" },
  { key: "inlet_in", label: "Inlet Diameter (inches)" },
  { key: "outlet_in", label: "Outlet Diameter (inches)" },
  { key: "drain_in", label: "Drain Diameter (inches)" },
  { key: "thickness_mm", label: "Thickness (mm)" },
  { key: "weight_kg", label: "Weight (kg)" },
];

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: string) => (value.trim() === "" ? null : Number(value));
const id = (value: string) => (value ? Number(value) : null);
const trimmed = (value: string) => value.trim() || null;

function fromProduct(p: Product): FormState {
  return {
    name: p.name, slug: p.slug, brand_id: text(p.brand_id), category_id: text(p.category_id), material_id: text(p.material_id),
    tagline: text(p.tagline), short_description: text(p.short_description), is_popular: p.is_popular, is_active: p.is_active,
    model_number: text(p.model_number), sku: text(p.sku), capacity_litres: text(p.capacity_litres),
    capacity_display: text(p.capacity_display), orientation: text(p.orientation),
    features: p.features ?? [],
    mrp: text(p.mrp), sale_price: text(p.sale_price), currency: p.currency,
    special_price_active: p.special_price_active, tax_included: p.tax_included,
    height_cm: text(p.height_cm), length_cm: text(p.length_cm), width_cm: text(p.width_cm), tank_diameter_mm: text(p.tank_diameter_mm),
    inlet_in: text(p.inlet_in), outlet_in: text(p.outlet_in), drain_in: text(p.drain_in),
    thickness_mm: text(p.thickness_mm), weight_kg: text(p.weight_kg),
    main_image_url: text(p.main_image_url),
  };
}

function toInput(f: FormState): ProductInput {
  return {
    name: f.name.trim(), slug: f.slug.trim(),
    brand_id: id(f.brand_id), category_id: id(f.category_id), material_id: id(f.material_id),
    tagline: trimmed(f.tagline), short_description: trimmed(f.short_description),
    is_popular: f.is_popular, is_active: f.is_active,
    model_number: trimmed(f.model_number), sku: trimmed(f.sku),
    capacity_litres: num(f.capacity_litres), capacity_display: trimmed(f.capacity_display),
    orientation: (f.orientation || null) as ProductInput["orientation"],
    features: f.features,
    mrp: num(f.mrp), sale_price: num(f.sale_price),
    currency: f.currency.trim().toUpperCase() || "INR",
    special_price_active: f.special_price_active, tax_included: f.tax_included,
    height_cm: num(f.height_cm), length_cm: num(f.length_cm),
    width_cm: num(f.width_cm), tank_diameter_mm: num(f.tank_diameter_mm),
    inlet_in: num(f.inlet_in), outlet_in: num(f.outlet_in),
    drain_in: num(f.drain_in), thickness_mm: num(f.thickness_mm),
    weight_kg: num(f.weight_kg),
    main_image_url: f.main_image_url.trim() || null,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-extrabold tracking-tight text-[#0a192f]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`crm-field-label ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium text-gray-800">
      <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** A dropdown of options with an inline "add new" so an admin never has to leave the form. */
function OptionField({ kind, label, value, options, onChange, onAdd }: {
  kind: OptionKind; label: string; value: string; options: ProductOption[];
  onChange: (value: string) => void; onAdd: (kind: OptionKind, name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try { await onAdd(kind, name.trim()); setName(""); setAdding(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not add"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SelectField
        label={label} value={value} onChange={onChange} placeholder={`Select ${label.toLowerCase()}`}
        options={[{ value: "", label: "None" }, ...options.map((o) => ({ value: String(o.id), label: o.name }))]}
      />
      {adding ? (
        <div className="flex gap-2">
          <input
            className="crm-input" value={name} placeholder={`New ${label.toLowerCase()}`} autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          />
          <button type="button" onClick={() => void add()} disabled={busy} className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-60">Add</button>
          <button type="button" onClick={() => { setAdding(false); setError(""); }} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-gray-600">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="self-start text-xs font-semibold text-blue-600 hover:underline">+ Add new {label.toLowerCase()}</button>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export default function ProductForm({ productId }: { productId?: number }) {
  const router = useRouter();
  const isEdit = productId !== undefined;
  const [form, setForm] = useState<FormState>(blank);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [options, setOptions] = useState<Record<OptionKind, ProductOption[]>>({ brand: [], category: [], material: [] });
  const [featureDraft, setFeatureDraft] = useState("");
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const token = () => sessionStorage.getItem("ogera_access_token");

  const load = useCallback(async () => {
    const accessToken = token();
    if (!accessToken) { setLoadError("Sign in to manage products."); setIsLoading(false); return; }
    setIsLoading(true); setLoadError("");
    try {
      const [brand, category, material, product] = await Promise.all([
        listProductOptions(accessToken, "brand"),
        listProductOptions(accessToken, "category"),
        listProductOptions(accessToken, "material"),
        productId !== undefined ? getProduct(accessToken, productId) : Promise.resolve(null),
      ]);
      setOptions({ brand, category, material });
      if (product) setForm(fromProduct(product));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the product.");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addOption(kind: OptionKind, name: string) {
    const accessToken = token();
    if (!accessToken) throw new Error("Sign in again to continue.");
    const created = await createProductOption(accessToken, kind, name);
    setOptions((current) => ({ ...current, [kind]: current[kind].some((o) => o.id === created.id) ? current[kind] : [...current[kind], created].sort((a, b) => a.name.localeCompare(b.name)) }));
    set(`${kind}_id` as "brand_id", String(created.id));
  }

  function addFeature() {
    const value = featureDraft.trim();
    if (value && !form.features.includes(value)) set("features", [...form.features, value]);
    setFeatureDraft("");
  }

  function onFeatureKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); addFeature(); }
  }

  // Discount and You Save are read-only: the server computes the same values, this is the live preview.
  const { discount, saving, priceError } = useMemo(() => {
    const mrp = Number(form.mrp), sale = Number(form.sale_price);
    if (!form.mrp || !form.sale_price || !(mrp > 0)) return { discount: 0, saving: 0, priceError: "" };
    if (sale > mrp) return { discount: 0, saving: 0, priceError: "Sale price cannot be higher than MRP" };
    return { discount: Math.round(((mrp - sale) * 10000) / mrp) / 100, saving: mrp - sale, priceError: "" };
  }, [form.mrp, form.sale_price]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = token();
    if (!accessToken) { setSaveError("Sign in again to continue."); return; }
    if (!form.name.trim() || !form.slug.trim()) { setSaveError("Product name and slug are required."); return; }
    if (!form.main_image_url.trim()) { setSaveError("A main image is required."); return; }
    if (priceError) { setSaveError(priceError); return; }
    setIsSaving(true); setSaveError("");
    try {
      const input = toInput(form);
      if (isEdit) await updateProduct(accessToken, productId, input);
      else await createProduct(accessToken, input);
      router.push("/dashboard/products");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the product.");
      setIsSaving(false);
    }
  }

  async function remove() {
    const accessToken = token();
    if (!accessToken || productId === undefined) return;
    setIsSaving(true); setSaveError("");
    try { await deleteProduct(accessToken, productId); router.push("/dashboard/products"); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "Could not delete the product."); setIsSaving(false); setConfirmDelete(false); }
  }

  if (isLoading) return <div className="p-5 pt-20 lg:p-6 lg:pt-6"><div aria-busy="true" aria-label="Loading product" className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" /></div>;
  if (loadError) {
    return (
      <div className="p-5 pt-20 lg:p-6 lg:pt-6">
        <div role="alert" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">!</span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">Unable to load product</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-6 inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <PageHeader
        eyebrow="Product catalogue"
        title={isEdit ? "Edit Product" : "Add Product"}
        subtitle={isEdit ? "Update product details and specifications." : "Add a product with its details and specifications."}
      >
        <Link href="/dashboard/products" className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-white/25 bg-white/10 text-white text-sm font-bold hover:bg-white/20 active:scale-[.98] transition-all">Back to products</Link>
      </PageHeader>

      <Section title="Basic Information">
        <Field label="Product Name *">
          <input
            className="crm-input" value={form.name} required
            onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }}
          />
        </Field>
        <Field label="Slug (URL-friendly) *">
          <input className="crm-input" value={form.slug} required onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
        </Field>
        <OptionField kind="brand" label="Brand" value={form.brand_id} options={options.brand} onChange={(v) => set("brand_id", v)} onAdd={addOption} />
        <OptionField kind="category" label="Category" value={form.category_id} options={options.category} onChange={(v) => set("category_id", v)} onAdd={addOption} />
        <OptionField kind="material" label="Material" value={form.material_id} options={options.material} onChange={(v) => set("material_id", v)} onAdd={addOption} />
        <Field label="Short Tagline">
          <input className="crm-input" value={form.tagline} placeholder="e.g., Optimal Capacity with Vertical Efficiency" maxLength={200} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Short Description" wide>
          <textarea className="crm-textarea" rows={3} value={form.short_description} placeholder="Brief description of the product..." onChange={(e) => set("short_description", e.target.value)} />
        </Field>
        <Toggle label="Mark as Popular Choice" checked={form.is_popular} onChange={(v) => set("is_popular", v)} />
        <Toggle label="Active (visible to staff)" checked={form.is_active} onChange={(v) => set("is_active", v)} />
      </Section>

      <Section title="Model & Capacity">
        <Field label="Model Number"><input className="crm-input" value={form.model_number} placeholder="e.g., VNTN304/1000/0103/25" maxLength={80} onChange={(e) => set("model_number", e.target.value)} /></Field>
        <Field label="SKU"><input className="crm-input" value={form.sku} placeholder="Internal SKU code" maxLength={80} onChange={(e) => set("sku", e.target.value)} /></Field>
        <Field label="Capacity (LTR)"><input className="crm-input" type="number" min="0" inputMode="numeric" value={form.capacity_litres} onChange={(e) => set("capacity_litres", e.target.value)} /></Field>
        <Field label="Capacity Display"><input className="crm-input" value={form.capacity_display} placeholder="e.g., 200 Ltr" maxLength={40} onChange={(e) => set("capacity_display", e.target.value)} /></Field>
        <SelectField
          label="Orientation" value={form.orientation} onChange={(v) => set("orientation", v)} placeholder="Select orientation"
          options={[{ value: "", label: "None" }, { value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }]}
        />
      </Section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold tracking-tight text-[#0a192f]">Features</h2>
        <label className="crm-field-label">Product Features
          <input
            className="crm-input" value={featureDraft} maxLength={200} placeholder="Type a feature and press Enter..."
            onChange={(e) => setFeatureDraft(e.target.value)} onKeyDown={onFeatureKey} onBlur={addFeature}
          />
        </label>
        <p className="mt-1.5 text-xs text-gray-500">Press Enter to add a feature key point.</p>
        {form.features.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {form.features.map((feature) => (
              <li key={feature} className="flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-800">
                {feature}
                <button type="button" aria-label={`Remove ${feature}`} onClick={() => set("features", form.features.filter((f) => f !== feature))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-blue-100">×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section title="Pricing">
        <Field label="MRP (₹)"><input className="crm-input" type="number" min="0" step="0.01" inputMode="decimal" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} /></Field>
        <Field label="Sale Price (₹)"><input className="crm-input" type="number" min="0" step="0.01" inputMode="decimal" value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)} /></Field>
        <Field label="Discount (%)"><input className="crm-input" value={discount} readOnly disabled /></Field>
        <Field label="You Save (₹)"><input className="crm-input" value={saving} readOnly disabled /></Field>
        <Field label="Currency"><input className="crm-input" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value)} /></Field>
        <div>
          <Toggle label="Special Price Active" checked={form.special_price_active} onChange={(v) => set("special_price_active", v)} />
          <Toggle label="Tax Included" checked={form.tax_included} onChange={(v) => set("tax_included", v)} />
        </div>
        {priceError && <p className="text-xs font-semibold text-rose-600 sm:col-span-2">{priceError}</p>}
      </Section>

      <Section title="Technical Specifications">
        {SPEC_FIELDS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <input className="crm-input" type="number" min="0" step="any" inputMode="decimal" value={form[key] as string} onChange={(e) => set(key, e.target.value as never)} />
          </Field>
        ))}
      </Section>

      <Section title="Media">
        <Field label="Main Image *" wide>
          <input className="crm-input" type="url" value={form.main_image_url} placeholder="https://…/tank.jpg" maxLength={500} onChange={(e) => set("main_image_url", e.target.value)} />
        </Field>
        {form.main_image_url.trim() && (
          // eslint-disable-next-line @next/next/no-img-element -- an admin-pasted URL can be any host, so next/image can't be configured for it
          <img src={form.main_image_url.trim()} alt="Main product preview" className="max-h-56 rounded-lg border border-gray-200 object-contain sm:col-span-2" />
        )}
      </Section>

      {saveError && <p role="alert" className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">{saveError}</p>}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 active:scale-[.98] disabled:opacity-60 transition-all">
          {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
        </button>
        <Link href="/dashboard/products" className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
        {isEdit && (confirmDelete ? (
          <span className="ml-auto flex items-center gap-2 text-sm">
            Delete this product?
            <button type="button" onClick={() => void remove()} disabled={isSaving} className="min-h-11 rounded-lg bg-rose-600 px-3 font-semibold text-white">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 px-2 font-semibold text-gray-600">No</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto min-h-11 px-3 text-sm font-semibold text-rose-600">Delete</button>
        ))}
      </div>
    </form>
  );
}
