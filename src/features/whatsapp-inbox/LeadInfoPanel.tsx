"use client";

/**
 * LeadInfoPanel — the right panel: who the customer is and who owns the conversation.
 * Admin/manager can reassign; everyone else sees the assignee read-only.
 * Mount it with key={leadId}.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { getLead, type Lead } from "@/features/leads/api/leads";
import { isHeadRole } from "@/lib/shared/roles";
import { fetchEmployees, selectEmployees, selectEmployeesStatus } from "@/store/lookupsSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import Spinner from "@/components/Spinner";
import { assignConversation } from "./api";

export default function LeadInfoPanel({
  leadId,
  onAssigned,
}: {
  leadId: number;
  onAssigned: () => void;
}) {
  const { token, user } = useAuth();
  const dispatch = useAppDispatch();
  const employees = useAppSelector(selectEmployees);
  const employeesStatus = useAppSelector(selectEmployeesStatus);
  const head = isHeadRole(user?.role);

  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const row = await getLead(token, leadId);
      setLead(row);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load lead details.");
    }
  }, [token, leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (head && token && employeesStatus === "idle") void dispatch(fetchEmployees(token));
  }, [head, token, employeesStatus, dispatch]);

  async function assign(employeeId: number) {
    if (!token) return;
    setAssigning(true); setAssignError("");
    try {
      await assignConversation(token, leadId, employeeId);
      await load();
      onAssigned();
    } catch (caught) {
      setAssignError(caught instanceof ApiError ? caught.message : "Could not assign. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  if (error) {
    return (
      <div role="alert" className="p-4 text-sm text-red-600">
        {error}
        <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button>
      </div>
    );
  }
  if (!lead) return (
    <div className="flex items-center justify-center gap-2 p-4">
      <Spinner size="sm" /><span className="text-sm text-gray-500">Loading…</span>
    </div>
  );

  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone || "Unknown";
  const assignable = employees.filter((e) => e.is_active && !e.deleted_at && !isHeadRole(e.role));

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-base font-bold text-[#1A1C21]">{name}</p>
        {lead.phone && <a href={`tel:${lead.phone}`} className="text-sm text-[#0E4D3A] hover:underline">{lead.phone}</a>}
        {lead.email && <p className="truncate text-sm text-[#6B7080]">{lead.email}</p>}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-[#6B7080]">Status</dt><dd className="font-medium capitalize text-[#1A1C21]">{lead.status.replaceAll("_", " ")}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-[#6B7080]">Source</dt><dd className="font-medium text-[#1A1C21]">{lead.source_name ?? "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-[#6B7080]">Branch</dt><dd className="font-medium text-[#1A1C21]">{lead.branch_name ?? "—"}</dd></div>
        {!head && (
          <div className="flex justify-between gap-2"><dt className="text-[#6B7080]">Assigned to</dt><dd className="font-medium text-[#1A1C21]">{lead.assigned_name ?? "Unassigned"}</dd></div>
        )}
      </dl>
      {head && (
        <div>
          <label htmlFor="wa-assign" className="mb-1 block text-xs font-semibold text-[#6B7080]">Assigned to</label>
          <select
            id="wa-assign"
            value={lead.assigned_to ?? ""}
            disabled={assigning || employeesStatus === "loading"}
            onChange={(e) => { if (e.target.value) void assign(Number(e.target.value)); }}
            className="h-9 w-full rounded-lg border border-[#DEE1E5] bg-white px-2 text-sm disabled:opacity-60"
          >
            <option value="">Unassigned</option>
            {assignable.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            {lead.assigned_to && !assignable.some((e) => e.id === lead.assigned_to) && (
              <option value={lead.assigned_to}>{lead.assigned_name ?? `Employee ${lead.assigned_to}`}</option>
            )}
          </select>
          {assignError && <p role="alert" className="mt-1 text-xs text-red-600">{assignError}</p>}
        </div>
      )}
      <Link href={`/dashboard/leads?lead=${lead.id}`} className="inline-flex h-9 items-center rounded-lg border border-[#DEE1E5] px-3 text-sm font-semibold text-[#1A1C21] hover:bg-[#F3F3F5]">
        Open lead
      </Link>
    </div>
  );
}
