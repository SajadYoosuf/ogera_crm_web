"use client";

/**
 * LeadStatusesTab (admin) — add, rename, reorder, hide and delete lead statuses.
 *
 * Rules mirrored from the backend:
 *   - `new` and `converted` are locked (no delete, no hide).
 *   - At most 20 active statuses.
 *   - Names are unique, ignoring case.
 *   - Names are at most 30 characters (the backend stores a slug of the name in a 30-character column).
 *   - Deleting a status that leads still use returns 409 (shown as the API's message).
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LEAD_STATUS_NAME_MAX,
  MAX_ACTIVE_STATUSES,
  createLeadStatus,
  deleteLeadStatus,
  listLeadStatusRows,
  updateLeadStatus,
  type LeadStatusRow,
} from "@/features/leads/api/leadSettings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, accentButton, errorText, iconButton, icons } from "./ui";

export default function LeadStatusesTab() {
  const { token } = useAuth();
  const [rows, setRows] = useState<LeadStatusRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view lead statuses."); return; }
    setLoadError("");
    try { setRows(await listLeadStatusRows(token)); }
    catch (caught) { setLoadError(errorText(caught, "Lead statuses could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: (t: string) => Promise<unknown>, done: string) {
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      await action(token);
      setNotice({ text: done, tone: "ok" });
      await load();
      return true;
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });
      return false;
    } finally { setBusy(false); }
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!rows) return <Spinner />;

  const activeCount = rows.filter((r) => r.is_active).length;
  const atLimit = activeCount >= MAX_ACTIVE_STATUSES;
  const trimmed = name.trim();
  const duplicate = rows.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());
  const tooLong = trimmed.length > LEAD_STATUS_NAME_MAX;
  const nextOrder = rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;

  async function add() {
    if (!trimmed || duplicate || atLimit || tooLong) return;
    const ok = await run((t) => createLeadStatus(t, trimmed, nextOrder), `“${trimmed}” added.`);
    if (ok) setName("");
  }

  async function move(row: LeadStatusRow, direction: -1 | 1) {
    const index = rows!.findIndex((r) => r.id === row.id);
    const other = rows![index + direction];
    if (!other) return;
    // Swap sort_order; when equal, nudge so the order actually changes.
    const a = other.sort_order === row.sort_order ? row.sort_order + direction : other.sort_order;
    await run(async (t) => {
      await updateLeadStatus(t, row.id, { sort_order: a });
      await updateLeadStatus(t, other.id, { sort_order: row.sort_order });
    }, "Order saved.");
  }

  return (
    <div className="space-y-5">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      <Panel
        title="Lead statuses"
        subtitle="The stages a lead moves through. New and Converted are built in."
        status={<span className="text-xs font-semibold text-[#6B7080]">{activeCount} / {MAX_ACTIVE_STATUSES} active</span>}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="New status name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LEAD_STATUS_NAME_MAX}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
            placeholder="e.g. Site visit done" className="h-10 flex-1 rounded-[8px] border border-[#E1E1E6] px-3 text-sm" />
          <button type="button" className={accentButton} disabled={busy || !trimmed || duplicate || atLimit || tooLong} onClick={() => void add()}>
            <Icon>{icons.plus}</Icon> Add status
          </button>
        </div>
        <p className={`text-xs ${tooLong ? "text-red-600" : "text-[#6B7080]"}`}>
          {tooLong
            ? `Status name must be ${LEAD_STATUS_NAME_MAX} characters or fewer. This one is ${trimmed.length}.`
            : `Up to ${LEAD_STATUS_NAME_MAX} characters (${trimmed.length}/${LEAD_STATUS_NAME_MAX}). Use a short label, e.g. “Site visit done”.`}
        </p>
        {duplicate && trimmed && <p className="text-xs text-red-600">A status with this name already exists.</p>}
        {atLimit && <p className="text-xs text-amber-700">You have {MAX_ACTIVE_STATUSES} active statuses — hide or delete one to add another.</p>}

        <ul className="divide-y divide-[#F0F0F3] rounded-xl border border-[#E5E7EA]">
          {rows.map((r, i) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${r.is_active ? "" : "bg-gray-50"}`}>
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${r.name} up`} className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={busy || i === 0} onClick={() => void move(r, -1)}>
                  <Icon className="h-4 w-4">{icons.up}</Icon>
                </button>
                <button type="button" aria-label={`Move ${r.name} down`} className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={busy || i === rows.length - 1} onClick={() => void move(r, 1)}>
                  <Icon className="h-4 w-4">{icons.down}</Icon>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === r.id ? (
                  <div className="flex gap-2">
                    <input aria-label={`Rename ${r.name}`} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={LEAD_STATUS_NAME_MAX}
                      className="h-9 flex-1 rounded-[8px] border border-[#E1E1E6] px-2 text-sm" />
                    <button type="button" className="h-9 rounded-[8px] bg-[#0E4D3A] px-3 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={busy || !editName.trim() || editName.trim().length > LEAD_STATUS_NAME_MAX}
                      onClick={() => void run((t) => updateLeadStatus(t, r.id, { name: editName.trim() }), "Status renamed.").then((ok) => { if (ok) setEditingId(null); })}>
                      Save
                    </button>
                    <button type="button" className="h-9 rounded-[8px] border border-[#E1E1E6] px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#1A1C21]">
                    {r.name}
                    {r.locked && <span title="Built in" className="text-gray-400"><Icon className="h-3.5 w-3.5">{icons.lock}</Icon></span>}
                    {!r.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Hidden</span>}
                  </p>
                )}
              </div>

              {editingId !== r.id && (
                <div className="flex items-center gap-1">
                  <button type="button" className={iconButton} aria-label={`Rename ${r.name}`} onClick={() => { setEditingId(r.id); setEditName(r.name); }}>
                    <Icon>{icons.pencil}</Icon>
                  </button>
                  {!r.locked && (
                    <button type="button" className="h-8 rounded-[8px] border border-[#E1E1E6] px-2.5 text-xs font-semibold text-[#3A3E4A] disabled:opacity-50"
                      disabled={busy || (!r.is_active && atLimit)}
                      onClick={() => void run((t) => updateLeadStatus(t, r.id, { is_active: !r.is_active }), r.is_active ? "Status hidden." : "Status shown.")}>
                      {r.is_active ? "Hide" : "Show"}
                    </button>
                  )}
                  {!r.locked && (confirmId === r.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <button type="button" disabled={busy} className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white"
                        onClick={() => void run((t) => deleteLeadStatus(t, r.id), "Status deleted.").then(() => setConfirmId(null))}>
                        Delete
                      </button>
                      <button type="button" className="rounded-md border border-gray-200 px-2 py-1" onClick={() => setConfirmId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className={iconButton} aria-label={`Delete ${r.name}`} onClick={() => setConfirmId(r.id)}>
                      <Icon>{icons.trash}</Icon>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
