"use client";

import { FormEvent, useEffect, useState } from "react";
import { MALAPPURAM_PANCHAYATHS } from "@/lib/panchayaths";
import { getGPSLocationAndGeocode } from "@/lib/location";
import { SOURCE_OF_SALE_OPTIONS, type Sale } from "@/lib/saleTypes";

interface Product { id: number; name: string; priceSale?: number }

interface SaleForm {
  buyerName: string;
  buyerPhone: string;
  saleDate: string;
  panchayath: string;
  ward: string;
  address: string;
  tankSize: string;
  quantity: string;
  unitPrice: string;
  waterSource: string;
  sourceOfSale: string;
  houseStage: string;
  remarks: string;
}

interface SaleEditorDrawerProps {
  sale?: Sale;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

const blankForm = (): SaleForm => ({
  buyerName: "", buyerPhone: "", saleDate: today(),
  panchayath: "", ward: "", address: "",
  tankSize: "", quantity: "1", unitPrice: "",
  waterSource: "", sourceOfSale: "", houseStage: "", remarks: "",
});

const toForm = (sale: Sale): SaleForm => ({
  buyerName: sale.buyerName || "",
  buyerPhone: sale.buyerPhone || "",
  saleDate: sale.saleDate ? sale.saleDate.slice(0, 10) : today(),
  panchayath: sale.panchayath || "",
  ward: sale.ward || "",
  address: sale.address || "",
  tankSize: sale.tankSize || "",
  quantity: sale.quantity ? String(sale.quantity) : "1",
  unitPrice: sale.unitPrice ? String(sale.unitPrice) : "",
  waterSource: sale.waterSource || "",
  sourceOfSale: sale.sourceOfSale || "",
  houseStage: sale.houseStage || "",
  remarks: sale.remarks || "",
});

const inputClass = "crm-input";
const selectClass = "crm-select";
const textareaClass = "crm-textarea";
const labelClass = "crm-field-label";

function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-sm font-bold text-[#0a192f]">{title}</h3>
      {children}
    </div>
  );
}

export default function SaleEditorDrawer({ sale, onClose, onSaved }: SaleEditorDrawerProps) {
  const [values, setValues] = useState<SaleForm>(() => (sale ? toForm(sale) : blankForm()));
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState("");
  const [locationNote, setLocationNote] = useState("");

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    void fetch("/api/sales/products", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((response) => response.json() as Promise<{ success: boolean; data?: Product[] }>)
      .then((result) => { if (result.success && result.data) setProducts(result.data); })
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const update = <Field extends keyof SaleForm>(field: Field, value: SaleForm[Field]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const selectProduct = (name: string) => {
    const product = products.find((item) => item.name === name);
    setValues((current) => ({
      ...current,
      tankSize: name,
      unitPrice: product?.priceSale ? String(product.priceSale) : current.unitPrice,
    }));
  };

  const totalPrice = (Number.parseFloat(values.quantity) || 0) * (Number.parseFloat(values.unitPrice) || 0);

  async function fillLocation() {
    setIsLocating(true); setFormError(""); setLocationNote("");
    try {
      const result = await getGPSLocationAndGeocode();
      const matched = MALAPPURAM_PANCHAYATHS.find((name) => result.address.toLowerCase().includes(name.toLowerCase()));
      setValues((current) => ({ ...current, address: result.address, panchayath: matched || current.panchayath }));
      setLocationNote(matched ? `Panchayath matched: ${matched} (editable)` : "Address filled from GPS — pick the panchayath manually.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to get location. Please enable GPS.");
    } finally {
      setIsLocating(false);
    }
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setFormError("Sign in again before saving this sale."); return; }
    if (values.buyerPhone.replace(/\D/g, "").length < 6) { setFormError("Enter a valid buyer phone number."); return; }

    setIsSaving(true); setFormError("");
    const optional = (value: string) => value.trim() || null;
    const body = {
      saleDate: values.saleDate || today(),
      buyerName: values.buyerName.trim(),
      buyerPhone: values.buyerPhone.trim(),
      address: optional(values.address),
      panchayath: optional(values.panchayath),
      ward: optional(values.ward),
      tankSize: optional(values.tankSize),
      quantity: values.quantity ? Number.parseInt(values.quantity, 10) : null,
      unitPrice: values.unitPrice ? Number.parseFloat(values.unitPrice) : null,
      waterSource: optional(values.waterSource),
      sourceOfSale: optional(values.sourceOfSale),
      houseStage: optional(values.houseStage),
      remarks: optional(values.remarks),
    };

    try {
      const response = await fetch(sale ? `/api/sales/${sale.id}` : "/api/sales", {
        method: sale ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) { setFormError(result.error?.message || "Sale could not be saved. Please try again."); return; }
      onSaved();
    } catch {
      setFormError("Sale could not be saved. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <section
        className="relative bg-white w-full sm:w-[520px] h-full flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-form-title"
      >
        <header className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            </span>
            <div>
              <h2 id="sale-form-title" className="text-lg font-bold text-[#0a192f] leading-tight">{sale ? "Edit sales entry" : "Add sales entry"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{sale ? "Modify this transaction record." : "Record a new tank sale in the ledger."}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <form onSubmit={saveSale} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div>
              <SectionHeading title="Customer information" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`${labelClass} sm:col-span-2`}>
                  Buyer name <span className="text-rose-500">*</span>
                  <input required value={values.buyerName} onChange={(event) => update("buyerName", event.target.value)} placeholder="Enter customer name" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Phone number <span className="text-rose-500">*</span>
                  <input required inputMode="tel" value={values.buyerPhone} onChange={(event) => update("buyerPhone", event.target.value)} placeholder="10-digit phone number" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Sale date
                  <input type="date" value={values.saleDate} onChange={(event) => update("saleDate", event.target.value)} className={inputClass} />
                </label>
              </div>
            </div>

            <div>
              <SectionHeading title="Location details">
                <button type="button" onClick={() => void fillLocation()} disabled={isLocating} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors">
                  {isLocating ? (
                    <><span className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" /> Locating…</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2Z" /></svg> Fill location</>
                  )}
                </button>
              </SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>
                  Panchayath
                  <input value={values.panchayath} onChange={(event) => update("panchayath", event.target.value)} placeholder="Search or type" list="sale-panchayath-options" className={inputClass} />
                  <datalist id="sale-panchayath-options">{MALAPPURAM_PANCHAYATHS.map((name) => <option key={name} value={name} />)}</datalist>
                </label>
                <label className={labelClass}>
                  Ward
                  <input value={values.ward} onChange={(event) => update("ward", event.target.value)} placeholder="e.g. Ward 4" className={inputClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Address
                  <input value={values.address} onChange={(event) => update("address", event.target.value)} placeholder="House name, landmark, post" className={inputClass} />
                </label>
                {locationNote && <p className="sm:col-span-2 text-[11px] font-medium text-blue-600">{locationNote}</p>}
              </div>
            </div>

            <div>
              <SectionHeading title="Sale specifics" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={labelClass}>
                  Source of sale
                  <select value={values.sourceOfSale} onChange={(event) => update("sourceOfSale", event.target.value)} className={selectClass}>
                    <option value="">Select channel</option>
                    {SOURCE_OF_SALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>
                  House stage
                  <select value={values.houseStage} onChange={(event) => update("houseStage", event.target.value)} className={selectClass}>
                    <option value="">Select stage</option>
                    <option value="under_construction">Under construction</option>
                    <option value="built">Built</option>
                    <option value="renovation">Renovation</option>
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Product / tank name
                  {products.length > 0 ? (
                    <select value={values.tankSize} onChange={(event) => selectProduct(event.target.value)} className={selectClass}>
                      <option value="">Select product…</option>
                      {values.tankSize && !products.some((product) => product.name === values.tankSize) && (
                        <option value={values.tankSize}>{values.tankSize}</option>
                      )}
                      {products.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}
                    </select>
                  ) : (
                    <input value={values.tankSize} onChange={(event) => update("tankSize", event.target.value)} placeholder="e.g. 1000L SS tank" className={inputClass} />
                  )}
                </label>
                <label className={labelClass}>
                  Quantity
                  <input type="number" min="1" value={values.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="1" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Unit price (₹)
                  <input type="number" min="0" step="0.01" value={values.unitPrice} onChange={(event) => update("unitPrice", event.target.value)} placeholder="0.00" className={inputClass} />
                </label>
                {totalPrice > 0 && (
                  <div className="sm:col-span-2 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-sm font-semibold text-[#0a192f]">Total value</span>
                    <span className="text-lg font-extrabold text-blue-600">₹{totalPrice.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionHeading title="Water source & notes" />
              <div className="grid grid-cols-1 gap-4">
                <label className={labelClass}>
                  Water source
                  <input value={values.waterSource} onChange={(event) => update("waterSource", event.target.value)} placeholder="e.g. Borewell, KWA connection" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Remarks
                  <textarea rows={3} value={values.remarks} onChange={(event) => update("remarks", event.target.value)} placeholder="Any additional notes..." className={`${textareaClass} resize-none`} />
                </label>
              </div>
            </div>

            {formError && <p role="alert" className="px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}
          </div>

          <footer className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-white shrink-0 sm:flex sm:justify-end sm:px-6">
            <button type="button" disabled={isSaving} onClick={onClose} className="min-h-11 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="min-h-11 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">{isSaving ? "Saving…" : sale ? "Save changes" : "Save sale"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
