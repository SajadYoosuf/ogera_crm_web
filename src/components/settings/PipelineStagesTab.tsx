"use client";

/**
 * PipelineStagesTab (admin/manager) — manage pipeline columns for Consumer and Partner contacts.
 *
 * Rules:
 *   - new_lead, won, lost are locked — can be renamed but not deactivated or deleted.
 *   - Stages with usage_count > 0 cannot be deleted (deactivate instead).
 *   - Each pipeline has an independent column order.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listAllPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  type PipelineStageAdmin,
  type PipelineContactType,
} from "@/features/settings/api/pipelineSettings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, accentButton, errorText, iconButton, icons } from "./ui";

const PIPELINE_LABELS: Record<PipelineContactType, { title: string; subtitle: string }> = {
  consumer: { title: "Consumer pipeline", subtitle: "Stages for individual buyer contacts (left → right on the board)" },
  partner: { title: "Partner pipeline", subtitle: "Stages for trade / professional contacts (left → right on the board)" },
  dealer: { title: "Dealer pipeline", subtitle: "Stages for dealer contacts (left → right on the board)" },
};

type StagePanelProps = {
  pipeline: PipelineContactType;
  stages: PipelineStageAdmin[];
  busy: boolean;
  onReload: () => Promise<void>;
  setNotice: (n: { text: string; tone: "ok" | "error" } | null) => void;
  setBusy: (b: boolean) => void;
  token: string;
};

function StagePanel({ pipeline, stages, busy, onReload, setNotice, setBusy, token }: StagePanelProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { title, subtitle } = PIPELINE_LABELS[pipeline];

  async function run<T>(action: () => Promise<T>, done: string): Promise<T | null> {
    setBusy(true); setNotice(null);
    try {
      const result = await action();
      setNotice({ text: done, tone: "ok" });
      await onReload();
      return result;
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });
      return null;
    } finally { setBusy(false); }
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await run(() => createPipelineStage(token, trimmed, pipeline), `"${trimmed}" added.`);
    if (ok) setName("");
  }

  async function move(stage: PipelineStageAdmin, dir: -1 | 1) {
    const active = stages.filter((s) => s.is_active);
    const idx = active.findIndex((s) => s.id === stage.id);
    if (idx < 0) return;
    const other = active[idx + dir];
    if (!other) return;
    const newOrder = active.map((s) => s.id);
    newOrder.splice(idx, 1);
    newOrder.splice(idx + dir, 0, stage.id);
    // include inactive ids at their current positions after active ones
    const inactiveIds = stages.filter((s) => !s.is_active).map((s) => s.id);
    await run(
      () => reorderPipelineStages(token, pipeline, [...newOrder, ...inactiveIds]),
      "Order saved.",
    );
  }

  const activeCount = stages.filter((s) => s.is_active).length;
  const trimmed = name.trim();
  const duplicate = stages.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      status={<span className="text-xs font-semibold text-[#6B7080]">{activeCount} active</span>}
    >
      {/* Add stage */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input aria-label={`New ${pipeline} stage name`} value={name}
          onChange={(e) => setName(e.target.value)} maxLength={60}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder="e.g. Negotiation" className="h-10 flex-1 rounded-[8px] border border-[#E1E1E6] px-3 text-sm" />
        <button type="button" className={accentButton} disabled={busy || !trimmed || duplicate}
          onClick={() => void add()}>
          <Icon>{icons.plus}</Icon> Add stage
        </button>
      </div>
      {duplicate && trimmed && <p className="text-xs text-red-600">A stage with this name already exists.</p>}

      <ul className="divide-y divide-[#F0F0F3] rounded-xl border border-[#E5E7EA]">
        {stages.map((s) => {
          const activeStages = stages.filter((x) => x.is_active);
          const activeIdx = activeStages.findIndex((x) => x.id === s.id);
          return (
            <li key={s.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${s.is_active ? "" : "bg-gray-50"}`}>
              {/* Reorder (active only) */}
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${s.name} left`}
                  className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={busy || !s.is_active || activeIdx <= 0}
                  onClick={() => void move(s, -1)}>
                  <Icon className="h-4 w-4">{icons.up}</Icon>
                </button>
                <button type="button" aria-label={`Move ${s.name} right`}
                  className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={busy || !s.is_active || activeIdx === activeStages.length - 1}
                  onClick={() => void move(s, 1)}>
                  <Icon className="h-4 w-4">{icons.down}</Icon>
                </button>
              </div>

              {/* Name + badges */}
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <div className="flex gap-2">
                    <input aria-label={`Rename ${s.name}`} value={editName}
                      onChange={(e) => setEditName(e.target.value)} maxLength={60}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                      className="h-9 flex-1 rounded-[8px] border border-[#E1E1E6] px-2 text-sm" />
                    <button type="button" disabled={busy || !editName.trim()}
                      className="h-9 rounded-[8px] bg-[#0E4D3A] px-3 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void run(
                        () => updatePipelineStage(token, s.id, { name: editName.trim() }),
                        "Stage renamed.",
                      ).then((ok) => { if (ok) setEditingId(null); })}>
                      Save
                    </button>
                    <button type="button" className="h-9 rounded-[8px] border border-[#E1E1E6] px-3 text-xs"
                      onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1A1C21]">
                    {s.name}
                    {s.locked && (
                      <span title="Built-in stage" className="text-gray-400">
                        <Icon className="h-3.5 w-3.5">{icons.lock}</Icon>
                      </span>
                    )}
                    {!s.is_active && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Hidden</span>
                    )}
                    {s.usage_count > 0 && (
                      <span className="rounded-full bg-[#EDF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#3B6FE0]">
                        {s.usage_count} contact{s.usage_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Actions */}
              {editingId !== s.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={iconButton} aria-label={`Rename ${s.name}`}
                    onClick={() => { setEditingId(s.id); setEditName(s.name); }}>
                    <Icon>{icons.pencil}</Icon>
                  </button>
                  {!s.locked && (
                    <button type="button" disabled={busy}
                      className="h-8 rounded-[8px] border border-[#E1E1E6] px-2.5 text-xs font-semibold text-[#3A3E4A] disabled:opacity-50"
                      onClick={() => void run(
                        () => updatePipelineStage(token, s.id, { is_active: !s.is_active }),
                        s.is_active ? "Stage hidden." : "Stage shown.",
                      )}>
                      {s.is_active ? "Hide" : "Show"}
                    </button>
                  )}
                  {!s.locked && (confirmId === s.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <button type="button" disabled={busy}
                        className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white"
                        onClick={() => void run(
                          () => deletePipelineStage(token, s.id),
                          "Stage deleted.",
                        ).then(() => setConfirmId(null))}>
                        Delete
                      </button>
                      <button type="button" className="rounded-md border border-gray-200 px-2 py-1"
                        onClick={() => setConfirmId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className={iconButton} aria-label={`Delete ${s.name}`}
                      title={s.usage_count > 0 ? "Has contacts — deactivate instead of deleting" : undefined}
                      disabled={s.usage_count > 0}
                      onClick={() => setConfirmId(s.id)}>
                      <Icon>{icons.trash}</Icon>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function PipelineStagesTab() {
  const { token } = useAuth();
  const [stages, setStages] = useState<PipelineStageAdmin[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view pipeline stages."); return; }
    setLoadError("");
    try { setStages(await listAllPipelineStages(token)); }
    catch (caught) { setLoadError(errorText(caught, "Pipeline stages could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!stages) return <Spinner />;

  const sortStages = (list: typeof stages) =>
    list.sort((a, b) => (a.is_active === b.is_active ? a.order - b.order : a.is_active ? -1 : 1));

  const consumerStages = sortStages(stages.filter((s) => s.contact_type === "consumer"));
  const partnerStages = sortStages(stages.filter((s) => s.contact_type === "partner"));
  const dealerStages = sortStages(stages.filter((s) => s.contact_type === "dealer"));

  const sharedProps = { busy, onReload: load, setNotice, setBusy, token: token! };

  return (
    <div className="space-y-5">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      <StagePanel pipeline="consumer" stages={consumerStages} {...sharedProps} />
      <StagePanel pipeline="partner" stages={partnerStages} {...sharedProps} />
      <StagePanel pipeline="dealer" stages={dealerStages} {...sharedProps} />
    </div>
  );
}
