"use client";

/**
 * BulkAssignModal — distribute unassigned leads by source across staff.
 *
 * HOW IT WORKS:
 *   1. Manager opens the modal; it loads GET /leads/stats for unassigned counts
 *      and GET /employees for the staff list.
 *   2. Manager picks a source (or "Any source") and enters how many leads
 *      to assign to each employee.
 *   3. Live counter shows "Allocated X / Y" and blocks confirm if over-allocated.
 *   4. Manager can switch source to add more rules — a pending queue accumulates.
 *   5. On confirm, one POST /leads/bulk-assign is sent with all queued rules.
 *
 * PROPS:
 *   isOpen    — whether the modal is visible
 *   onClose   — called when the modal should close (cancel or after success)
 *   onDone    — called after a successful assign (parent should refresh the list)
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getLeadStats, bulkAssignLeads, type BulkAssignRule } from "@/features/leads/api/leads";
import { listEmployees, type Employee } from "@/lib/api/employees";
import type { LeadSource } from "@/features/contacts/api/contacts";

// ── Pending rule — accumulates before the final submit ───────────────────────

type PendingRule = {
  source_id: number | null;
  assigned_to: number;
  employeeName: string;
  count: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  /** From GET /lead-sources — the same endpoint and data the Contacts source picker uses. */
  leadSources: LeadSource[];
  onClose: () => void;
  onDone: () => void;
};

export default function BulkAssignModal({ isOpen, leadSources, onClose, onDone }: Props) {
  const { token } = useAuth();
  const sourceOptions: { value: number | null; label: string }[] = [
    { value: null, label: "Any source" },
    ...leadSources.map((s) => ({ value: s.id, label: s.name })),
  ];
  const sourceLabel = (id: number | null): string => sourceOptions.find((s) => s.value === id)?.label ?? "Unknown";

  // ── Data loading ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [unassignedBySource, setUnassignedBySource] = useState<Record<string, number>>({});
  const [totalUnassigned, setTotalUnassigned] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // ── Current source being configured ─────────────────────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  // Per-employee count inputs for the selected source: employeeId → count string
  const [countInputs, setCountInputs] = useState<Record<number, string>>({});

  // ── Accumulated pending rules (can be from multiple sources) ─────────────────
  const [pendingRules, setPendingRules] = useState<PendingRule[]>([]);

  // ── Submit state ─────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Load data when modal opens ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const [stats, empList] = await Promise.all([
        getLeadStats(token),
        listEmployees(token, { is_active: true, limit: 100 }),
      ]);
      setUnassignedBySource(stats.unassigned_by_source ?? {});
      const total = Object.values(stats.unassigned_by_source ?? {}).reduce((a, b) => a + b, 0);
      setTotalUnassigned(total);
      setEmployees(empList.items);
    } catch {
      setLoadError("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
      setSelectedSourceId(null);
      setCountInputs({});
      setPendingRules([]);
      setSubmitError("");
    }
  }, [isOpen, loadData]);

  // ── Derived: unassigned count for the currently selected source ───────────────
  function unassignedForSelected(): number {
    if (selectedSourceId === null) return totalUnassigned;
    const name = sourceOptions.find((s) => s.value === selectedSourceId)?.label ?? "";
    return unassignedBySource[name] ?? 0;
  }

  // ── Derived: total allocated for current source in countInputs ────────────────
  function allocatedForCurrent(): number {
    return Object.values(countInputs).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  }

  // ── Add current inputs as pending rules ───────────────────────────────────────
  function addCurrentToPending() {
    const newRules: PendingRule[] = [];
    for (const emp of employees) {
      const c = parseInt(countInputs[emp.id] ?? "") || 0;
      if (c > 0) {
        newRules.push({
          source_id: selectedSourceId,
          assigned_to: emp.id,
          employeeName: emp.name,
          count: c,
        });
      }
    }
    if (newRules.length === 0) return;
    // Replace any existing rules for this source from same employees
    setPendingRules((prev) => {
      const filtered = prev.filter(
        (r) => !(r.source_id === selectedSourceId && newRules.some((nr) => nr.assigned_to === r.assigned_to))
      );
      return [...filtered, ...newRules];
    });
    setCountInputs({});
  }

  // ── Remove a pending rule chip ────────────────────────────────────────────────
  function removePendingRule(idx: number) {
    setPendingRules((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Final submit ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const allRules = [...pendingRules];
    // Also include current unsaved inputs
    for (const emp of employees) {
      const c = parseInt(countInputs[emp.id] ?? "") || 0;
      if (c > 0) {
        allRules.push({ source_id: selectedSourceId, assigned_to: emp.id, employeeName: emp.name, count: c });
      }
    }
    if (allRules.length === 0) return;
    if (!token) return;

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const apiRules: BulkAssignRule[] = allRules.map(({ source_id, assigned_to, count }) => ({
        source_id,
        assigned_to,
        count,
      }));
      await bulkAssignLeads(token, apiRules);
      onDone();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Assignment failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Total pending lead count ──────────────────────────────────────────────────
  function totalPendingCount(): number {
    const pending = pendingRules.reduce((s, r) => s + r.count, 0);
    const current = allocatedForCurrent();
    return pending + current;
  }

  if (!isOpen) return null;

  const available = unassignedForSelected();
  const allocated = allocatedForCurrent();
  const isOver = allocated > available;
  const hasAnything = pendingRules.length > 0 || allocated > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0a192f]">Bulk Assign Leads</h2>
            {!isLoading && (
              <p className="mt-0.5 text-sm text-gray-500">{totalUnassigned} unassigned lead{totalUnassigned !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : loadError ? (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{loadError}</div>
          ) : (
            <>
              {/* Unassigned source chips */}
              {Object.keys(unassignedBySource).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Unassigned by source</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(unassignedBySource).map(([name, cnt]) => {
                      const srcOpt = sourceOptions.find((s) => s.label === name);
                      return (
                        <button
                          key={name}
                          onClick={() => { setSelectedSourceId(srcOpt?.value ?? null); setCountInputs({}); }}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            selectedSourceId === (srcOpt?.value ?? null)
                              ? "border-teal-500 bg-teal-50 text-teal-700"
                              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-teal-300"
                          }`}
                        >
                          {name} <span className="ml-1 font-semibold">{cnt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Source selector */}
              <div>
                <label htmlFor="bulk-source" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Assign from source
                </label>
                <div className="flex items-center gap-3">
                  <select
                    id="bulk-source"
                    value={selectedSourceId ?? "null"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedSourceId(v === "null" ? null : Number(v));
                      setCountInputs({});
                    }}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {sourceOptions.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-500 whitespace-nowrap">{available} available</span>
                </div>
              </div>

              {/* Staff rows */}
              {employees.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Assign leads to staff</p>
                  <div className="space-y-2">
                    {employees.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#09152b] text-xs font-semibold text-white shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{emp.role}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={available}
                            value={countInputs[emp.id] ?? ""}
                            onChange={(e) => setCountInputs((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                            placeholder="0"
                            className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          />
                          <span className="text-xs text-gray-400">leads</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Allocation counter */}
                  {allocated > 0 && (
                    <div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium ${
                      isOver ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                    }`}>
                      <span>Allocated: {allocated} / {available}</span>
                      {isOver ? (
                        <span className="text-xs">⚠ Exceeds available ({available})</span>
                      ) : (
                        <span className="text-xs">✓ OK</span>
                      )}
                    </div>
                  )}

                  {/* Add to queue button (for multi-source workflows) */}
                  {allocated > 0 && !isOver && (
                    <button
                      onClick={addCurrentToPending}
                      className="mt-2 w-full rounded-xl border border-dashed border-teal-300 bg-teal-50/50 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors"
                    >
                      + Add to queue &amp; configure another source
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No active employees found.</p>
              )}

              {/* Pending rules queue */}
              {pendingRules.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Pending assignments</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingRules.map((rule, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                      >
                        {sourceLabel(rule.source_id)} → {rule.count} to {rule.employeeName}
                        <button
                          onClick={() => removePendingRule(idx)}
                          className="ml-1 text-slate-400 hover:text-slate-700"
                          aria-label="Remove"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {submitError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !hasAnything || isOver}
            className="rounded-xl bg-[#0E4D3A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0a3a2b] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Assigning…" : `Assign ${totalPendingCount()} lead${totalPendingCount() !== 1 ? "s" : ""} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
