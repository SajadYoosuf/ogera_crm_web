"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import type { ProductListItem } from "@/lib/api/products";
import { createSale, updateSale, type Sale } from "@/lib/api/sales";

type Draft = { purchase_date: string; name: string; phone: string; alt_phone: string; address: string; purchased_product: string };

const toDraft = (sale: Sale | null): Draft => ({
  purchase_date: sale ? sale.purchase_date ?? "" : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  name: sale?.name ?? "", phone: sale?.phone ?? "", alt_phone: sale?.alt_phone ?? "",
  address: sale?.address ?? "", purchased_product: sale?.purchased_product ?? "",
});

/** Add or edit one sale. `sale` null = add. Picking a catalogue product links the sale to it; any other text is kept as typed. */
export default function SaleFormModal({ sale, products, catalogue = [], onClose, onSaved }: { sale: Sale | null; products: string[]; catalogue?: Pick<ProductListItem, "id" | "name" | "capacity_display">[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(sale));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !isSaving) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  const set = (key: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
  // The typed name decides the link: an exact catalogue name links the product, anything else is plain text.
  const linked = catalogue.find((item) => item.name.toLowerCase() === draft.purchased_product.trim().toLowerCase()) ?? null;
  const otherNames = products.filter((name) => !catalogue.some((item) => item.name === name));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Enter the buyer name."); return; }
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Your session has expired. Please sign in again."); return; }
    setIsSaving(true);
    setError("");
    const input = { ...draft, purchase_date: draft.purchase_date || null, product_id: linked?.id ?? null };
    try {
      if (sale) await updateSale(accessToken, sale.id, input); else await createSale(accessToken, input);
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the sale. Please try again.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <form onSubmit={submit} className="w-full sm:max-w-lg max-h-dvh overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sale-title">
        <h2 id="sale-title" className="text-lg font-extrabold text-[#0a192f] tracking-tight">{sale ? "Edit sale" : "Add sale"}</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5"><span className="crm-field-label">Buyer name</span>
            <input className="crm-input" value={draft.name} onChange={(e) => set("name")(e.target.value)} maxLength={150} autoFocus required /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5"><span className="crm-field-label">Phone</span>
              <input className="crm-input" type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="10-digit mobile" /></label>
            <label className="grid gap-1.5"><span className="crm-field-label">Alternate phone</span>
              <input className="crm-input" type="tel" inputMode="tel" value={draft.alt_phone} onChange={(e) => set("alt_phone")(e.target.value)} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5"><span className="crm-field-label">Purchase date</span>
              <input className="crm-input" type="date" value={draft.purchase_date} onChange={(e) => set("purchase_date")(e.target.value)} /></label>
            <label className="grid gap-1.5"><span className="crm-field-label">Purchased product</span>
              <input className="crm-input" list="sale-products" value={draft.purchased_product} onChange={(e) => set("purchased_product")(e.target.value)} maxLength={150} />
              <datalist id="sale-products">
                {catalogue.map((item) => <option key={`p${item.id}`} value={item.name} label={item.capacity_display ?? undefined} />)}
                {otherNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              {draft.purchased_product.trim() && catalogue.length > 0 && (
                <span className={`text-xs ${linked ? "font-semibold text-emerald-700" : "text-gray-500"}`}>{linked ? "From the products catalogue" : "Not in the catalogue; saved as typed"}</span>
              )}</label>
          </div>
          <label className="grid gap-1.5"><span className="crm-field-label">Address</span>
            <textarea className="crm-textarea" rows={3} value={draft.address} onChange={(e) => set("address")(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 disabled:opacity-50 transition-all">
            {isSaving ? "Saving…" : sale ? "Save changes" : "Add sale"}
          </button>
        </div>
      </form>
    </div>
  );
}
