"use client";

/**
 * Expense claims review page (manager and admin).
 *
 * WHAT IT SHOWS:
 *   One table of field-staff expense claims (petrol, food and so on), with three filters:
 *   - status tabs at the top: All / Pending / Approved / Rejected
 *   - an employee dropdown
 *   - a "from" and "to" date range
 *
 * HOW THE DATA FLOWS:
 *   Every filter and page change calls GET /expenses with query parameters.
 *   The server does the filtering and paging, so this page only holds one page of rows.
 *
 * ACTIONS:
 *   - Approve: saves the decision and updates the list. No extra confirmation.
 *   - Reject: opens a modal. A rejection note is required, and the server saves it and
 *     sends the employee a push notification with that note.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type Employee } from "@/lib/api/auth";
import { listAllEmployees } from "@/lib/api/employees";
import {
  approveExpense,
  listExpenses,
  rejectExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@/lib/api/expenses";
import { dmSans, sora } from "@/lib/auth-fonts";

const PAGE_SIZE = 10;

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  petrol: "Petrol / Fuel",
  food: "Food / Meals",
  maintenance: "Maintenance",
  accommodation: "Accommodation",
  other: "Other",
};

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const STATUS_TABS: { value: ExpenseStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** Money in Indian rupees, e.g. ₹850.00. The API sends amounts as strings or numbers. */
function formatInr(amount: number | string): string {
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

/** Short date for a row, shown in IST so it matches the staff's day. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

/** Reads the login token saved when the user signed in. Returns "" when it is missing. */
function readToken(): string {
  return sessionStorage.getItem("ogera_access_token") || "";
}

export default function ExpensesPage() {
  // Filters. Each change goes back to page 1.
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Data for the table.
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped after an approve or reject so the list fetches the new state.
  const [reloadKey, setReloadKey] = useState<number>(0);
  const latestRequest = useRef<number>(0);

  // Approve and reject state.
  const [actingId, setActingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectNote, setRejectNote] = useState<string>("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Fetch one page whenever a filter, the page number or the reload counter changes.
  // A request number guards against an old, slower response overwriting a newer one.
  const load = useCallback(() => {
    const token = readToken();
    if (!token) {
      setLoadError("Sign in to see expense claims.");
      setIsLoading(false);
      return;
    }
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setLoadError(null);
    listExpenses(token, {
      status: statusFilter === "all" ? undefined : statusFilter,
      employee_id: employeeId ? Number(employeeId) : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (requestId !== latestRequest.current) return;
        setExpenses(result.items);
        setTotal(result.total);
      })
      .catch((caught: unknown) => {
        if (requestId !== latestRequest.current) return;
        setExpenses([]);
        setTotal(0);
        setLoadError(caught instanceof ApiError ? caught.message : "Could not load expense claims. Please try again.");
      })
      .finally(() => {
        if (requestId === latestRequest.current) setIsLoading(false);
      });
  }, [statusFilter, employeeId, dateFrom, dateTo, page]);

  useEffect(() => {
    // The timer moves the fetch out of the effect body, the same way the sales page does.
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  // The employee dropdown is filled once. The team is small, so all employees fit in one list.
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    listAllEmployees(token)
      .then((result) => setEmployees(result.employees))
      .catch(() => setEmployees([]));
  }, []);

  // Escape closes the reject modal, unless a reject request is already running.
  useEffect(() => {
    if (!rejectTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRejecting) setRejectTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rejectTarget, isRejecting]);

  /** Approve saves the decision right away. The row is refreshed, and no notification is sent. */
  async function handleApprove(expense: Expense) {
    setActingId(expense.id);
    setActionError(null);
    try {
      await approveExpense(readToken(), expense.id);
      setReloadKey((key) => key + 1);
    } catch (caught: unknown) {
      setActionError(caught instanceof ApiError ? caught.message : "Could not approve this claim. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  function openReject(expense: Expense) {
    setRejectTarget(expense);
    setRejectNote("");
    setRejectError(null);
  }

  /** Reject needs a note. The server saves it and the employee gets it as a push notification. */
  async function handleConfirmReject() {
    if (!rejectTarget) return;
    const note = rejectNote.trim();
    if (!note) {
      setRejectError("Write a reason so the employee knows what to fix.");
      return;
    }
    setIsRejecting(true);
    setRejectError(null);
    try {
      await rejectExpense(readToken(), rejectTarget.id, note);
      setRejectTarget(null);
      setReloadKey((key) => key + 1);
    } catch (caught: unknown) {
      setRejectError(caught instanceof ApiError ? caught.message : "Could not reject this claim. Please try again.");
    } finally {
      setIsRejecting(false);
    }
  }

  function clearFilters() {
    setStatusFilter("all");
    setEmployeeId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = statusFilter !== "all" || employeeId !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <header className="flex h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white px-7">
        <h1 className="whitespace-nowrap font-[family-name:var(--font-sora)] text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Expense Claims</h1>
      </header>

      <div className="flex flex-col gap-3.5 px-7 pb-6 pt-[22px]">
        <p className="text-[13.5px] leading-normal text-[#6B7080]">
          Fuel and other expenses submitted by field staff. Approve a claim, or reject it with a note the employee will receive.
        </p>

        <section aria-label="Expense claims" className="flex flex-col overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {/* Top filter: status tabs */}
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2 border-b border-[#EFEFF2] p-4">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                  className={`h-9 rounded-[8px] px-3.5 text-[13px] font-medium ${active ? "bg-[#0E4D3A] text-white" : "border border-[#DEE1E5] bg-white text-[#4B5060] hover:bg-[#F7F8F9]"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Employee and date filters */}
          <div className="flex flex-wrap items-end gap-3 border-b border-[#EFEFF2] p-4">
            <label className="flex min-w-[180px] flex-col gap-1 text-[12.5px] font-medium text-[#4B5060]">
              Employee
              <select
                value={employeeId}
                onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }}
                className="h-[38px] rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] px-2.5 text-[13.5px] text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-[#4B5060]">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
                className="h-[38px] rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] px-2.5 text-[13.5px] text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium text-[#4B5060]">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
                className="h-[38px] rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] px-2.5 text-[13.5px] text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
              />
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-[38px] rounded-[8px] px-3 text-[13px] font-medium text-[#0E4D3A] hover:bg-[#F1F2F4]"
              >
                Clear filters
              </button>
            )}
          </div>

          {actionError && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{actionError}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[13px] text-[#4B5060]">
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-3 py-3 font-medium">Category</th>
                  <th scope="col" className="px-3 py-3 font-medium">Price</th>
                  <th scope="col" className="px-3 py-3 font-medium">Submitted</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const isPending = expense.status === "pending";
                  const isActing = actingId === expense.id;
                  return (
                    <tr key={expense.id} className="border-t border-[#EFEFF2]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A1C21]">{expense.employee_name ?? "Unknown employee"}</div>
                        <div className="max-w-[240px] truncate text-xs text-[#8A8F9C]" title={expense.title}>{expense.title}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#3A3E4A]">{CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-[#1A1C21]">{formatInr(expense.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#6B7080]">{formatDate(expense.created_at)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[expense.status]}`}>
                          {expense.status}
                        </span>
                        {expense.status === "rejected" && expense.rejection_reason && (
                          <p className="mt-1 max-w-[260px] truncate text-xs text-rose-700" title={expense.rejection_reason}>
                            Note: {expense.rejection_reason}
                          </p>
                        )}
                        {!isPending && expense.reviewed_by_name && (
                          <p className="mt-0.5 text-xs text-[#8A8F9C]">by {expense.reviewed_by_name}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {isPending ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApprove(expense)}
                              disabled={isActing}
                              className="h-9 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {isActing ? "Saving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openReject(expense)}
                              disabled={isActing}
                              className="h-9 rounded-[8px] border border-rose-200 bg-white px-3.5 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#8A8F9C]">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLoading && expenses.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#6B7080]">Loading expense claims…</p>
            )}
            {!isLoading && expenses.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#6B7080]">
                {loadError || (hasFilters ? "No expense claims match these filters." : "No expense claims yet.")}
              </p>
            )}
            {loadError && expenses.length > 0 && <p role="alert" className="px-4 py-3 text-center text-sm text-rose-700">{loadError}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-4 py-3.5">
            <p className="text-sm text-[#3A3E4A]">Showing {from} to {to} of {total} claims</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-9 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-[13px] text-[#4B5060]">Page {page} of {pages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="h-9 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Reject modal: the note is required and is sent to the employee. */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { if (!isRejecting) setRejectTarget(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reject-title" className="font-[family-name:var(--font-sora)] text-lg font-bold text-[#1A1C21]">Reject claim</h2>
            <p className="mt-1 text-sm text-[#6B7080]">
              {rejectTarget.title} · {formatInr(rejectTarget.amount)} · {rejectTarget.employee_name ?? "Employee"}
            </p>

            <label htmlFor="reject-note" className="mt-4 block text-[13px] font-medium text-[#4B5060]">
              Rejection note <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="reject-note"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              maxLength={500}
              rows={4}
              autoFocus
              placeholder="For example: bill photo is unreadable, or the claim is over the daily limit."
              className="mt-1.5 w-full rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] p-2.5 text-sm text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
            />
            <p className="mt-1 text-right text-xs text-[#8A8F9C]">{rejectNote.length}/500</p>

            {rejectError && <p role="alert" className="mt-2 text-sm text-rose-700">{rejectError}</p>}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={isRejecting}
                className="h-10 rounded-[8px] border border-[#DEE1E5] bg-white px-4 text-sm font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReject()}
                disabled={isRejecting}
                className="h-10 rounded-[8px] bg-rose-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isRejecting ? "Rejecting…" : "Reject claim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
