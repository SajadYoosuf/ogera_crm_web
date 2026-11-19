"use client";

/**
 * SaleFormModal — add or edit a single sale record.
 *
 * WHY this is a component, not inline in the page:
 *   The form has its own local state (draft values, saving flag, delete
 *   confirmation). Keeping it here means the page only manages the list.
 *
 * PROPS:
 *   sale          — existing sale to edit, or null to create a new one
 *   productNames  — list of product name strings for the dropdown
 *   employees     — employee list for the "created by" dropdown
 *   currentEmployeeId — pre-fills the created-by field for new sales
 *   onClose       — called when the user cancels or presses Escape
 *   onChanged     — called after a successful save or delete (triggers list reload)
 */

import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import type { Employee } from "@/lib/api/employees";
import { createSale, deleteSale, updateSale, type Sale } from "../api/sales";

type Draft = {
  purchase_date: string; name: string; phone: string; alt_phone: string;
  address: string; purchased_product: string; branch: string; created_by_employee_id: string;
};

const BRANCHES = ["malappuram", "kottakkal", "perinthalmanna"] as const;

const toDraft = (sale: Sale | null, currentEmployeeId: number | null): Draft => ({
  purchase_date: sale?.purchase_date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  name: sale?.name ?? "",
  phone: sale?.phone ?? "",
  alt_phone: sale?.alt_phone ?? "",
  address: sale?.address ?? "",
  purchased_product: sale?.purchased_product ?? "",
  branch: sale?.branch ?? "",
  created_by_employee_id: String(sale?.created_by_employee_id ?? currentEmployeeId ?? ""),
});

const fieldClass = "w-full h-10 px-3 rounded-[8px] border border-[#DEE1E5] bg-white text-sm text-[#1A1C21] outline-none focus:border-[#0E4D3A] disabled:bg-[#F7F8F9] disabled:text-[#4B5060]";
const labelClass = "grid gap-1.5 text-[13px] font-medium text-[#4B5060]";

type Props = {
  sale: Sale | null;
  productNames: string[];
  employees: Employee[];
  currentEmployeeId: number | null;
  employeesLoading: boolean;
  employeesError: string;
  onClose: () => void;
  onChanged: () => void;
};

export default function SaleFormModal({ sale, productNames, employees, currentEmployeeId, employeesLoading, employeesError, onClose, onChanged }: Props) {
  const { token } = useAuth();
  const [draft, setDraft] = useState<Draft>(() => toDraft(sale, currentEmployeeId));
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && !isSaving) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  const set = (key: keyof Draft) => (value: string) => setDraft((c) => ({ ...c, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Enter the buyer name."); return; }
    if (!draft.purchased_product) { setError("Select the purchased product."); return; }
    if (!token) { setError("Your session has expired. Please sign in again."); return; }
    setIsSaving(true); setError("");
    const input = {
      ...draft,
      purchase_date: draft.purchase_date || null,
      branch: draft.branch || null,
      created_by_employee_id: draft.created_by_employee_id ? Number(draft.created_by_employee_id) : null,
    };
    try {
      if (sale) await updateSale(token, sale.id, input); else await createSale(token, input);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the sale. Please try again.");
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!sale || !token) return;
    setIsSaving(true); setError("");
    try {
      await deleteSale(token, sale.id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not delete the sale. Please try again.");
      setIsSaving(false); setConfirmingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A1C21]/40 sm:items-center sm:p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sale-title"
        className="flex max-h-dvh w-full flex-col overflow-y-auto rounded-t-[18px] bg-white p-5 shadow-xl sm:max-w-[520px] sm:rounded-[18px] sm:p-6">
        <h2 id="sale-title" className="text-lg font-bold tracking-[-0.01em] text-[#1A1C21]">{sale ? "Edit sale" : "Add New Sale"}</h2>
        <div className="mt-5 grid gap-4">
          <label className={labelClass}>Buyer name
            <input className={fieldClass} value={draft.name} onChange={(e) => set("name")(e.target.value)} maxLength={150} autoFocus />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Phone
              <input className={fieldClass} type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set("phone")(e.target.value)} />
            </label>
            <label className={labelClass}>Alternate phone
              <input className={fieldClass} type="tel" inputMode="tel" value={draft.alt_phone} onChange={(e) => set("alt_phone")(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Purchase date
              <input className={fieldClass} type="date" value={draft.purchase_date} onChange={(e) => set("purchase_date")(e.target.value)} />
            </label>
            <label className={labelClass}>Product purchased
              <select className={fieldClass} value={draft.purchased_product} onChange={(e) => set("purchased_product")(e.target.value)} required>
                <option value="">Select product</option>
                {productNames.map((name) => <option key={name} value={name}>{name}</option>)}
                {draft.purchased_product && !productNames.includes(draft.purchased_product) && (
                  <option value={draft.purchased_product}>{draft.purchased_product} (legacy)</option>
                )}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Created by
              <select className={fieldClass} value={draft.created_by_employee_id} onChange={(e) => set("created_by_employee_id")(e.target.value)} disabled={employeesLoading}>
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}{emp.branch ? ` · ${emp.branch}` : ""}</option>
                ))}
              </select>
              {employeesError ? <span className="text-xs font-normal text-amber-700">{employeesError} The signed-in employee will be used if no selection is made.</span> : null}
            </label>
            <label className={labelClass}>Branch
              <select className={fieldClass} value={draft.branch} onChange={(e) => set("branch")(e.target.value)}>
                <option value="">Select branch</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
              </select>
            </label>
          </div>
          <label className={labelClass}>Address
            <textarea className="w-full px-3 py-2 rounded-[8px] border border-[#DEE1E5] bg-white text-sm text-[#1A1C21] outline-none focus:border-[#0E4D3A]" rows={3} value={draft.address} onChange={(e) => set("address")(e.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {sale && (confirmingDelete ? (
              <button type="button" onClick={remove} disabled={isSaving} className="h-10 px-4 rounded-[8px] bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Confirm delete</button>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} disabled={isSaving} className="h-10 px-4 rounded-[8px] text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Delete</button>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-10 px-4 rounded-[8px] border border-[#DEE1E5] bg-white text-sm font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="h-10 px-5 rounded-[8px] bg-[#0E4D3A] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {isSaving ? "Saving…" : sale ? "Save changes" : "Add sale"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
