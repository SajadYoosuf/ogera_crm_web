"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { updateContact, type ApiContact } from "@/features/contacts/api/contacts";
import { listActivities, markFollowupDone, rescheduleFollowup, type ActivityItem } from "@/lib/api/activities";
import { changeStage, getStageHistory, type StageEntry, type StageTypeItem } from "@/lib/api/leads";
import ActivityList from "./ActivityList";
import ActivityLogForm from "./ActivityLogForm";
import FollowupPrompt from "./FollowupPrompt";
import FollowupScheduleForm from "./FollowupScheduleForm";
import { LOSS_REASONS, formatMoment, stageColors, type LeadKind } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");

export default function LeadPanel({ lead, kind = "consumer", stages, userId, owners, initialTargetId, onUnverified, onClose, onChanged }: {
  lead: ApiContact;
  kind?: LeadKind;
  stages: StageTypeItem[];
  userId: number | null;
  owners: { id: number; name: string }[] | null;
  initialTargetId?: number;
  onUnverified: (stageLabel: string, missing: string[]) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const currentSlug = lead.lead_stage?.stage_slug ?? "new_lead";
  const currentId = lead.lead_stage?.stage_id;

  const [target, setTarget] = useState<StageTypeItem | null>(
    initialTargetId ? (stages.find((s) => s.id === initialTargetId) ?? null) : null,
  );
  const [lossReason, setLossReason] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<StageEntry[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [isChangingOwner, setIsChangingOwner] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState("");
  const [activityForm, setActivityForm] = useState<"log" | "schedule" | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<"log" | "followups" | "stages">("log");

  const loadActivities = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setActivityError("Sign in again to continue."); return; }
    try {
      setActivities(await listActivities(accessToken, lead.id));
      setActivityError("");
    } catch (caught) { setActivityError(errorText(caught)); }
  }, [lead.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadActivities(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadActivities]);

  const openActivityForm = (form: "log" | "schedule") => {
    setPrompt(null);
    setActivityForm((cur) => (cur === form ? null : form));
  };

  async function markDone(item: ActivityItem, outcome: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again to continue.");
    await markFollowupDone(accessToken, lead.id, item.id, outcome);
    await loadActivities();
    setActivityForm(null);
    setPrompt("Follow-up marked done");
  }

  async function reschedule(item: ActivityItem, date: string, time: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again to continue.");
    await rescheduleFollowup(accessToken, lead.id, item.id, date, time || undefined);
    await loadActivities();
  }

  const entries = activities?.filter((item) => item.scheduled_date === null) ?? null;
  const tasks = activities?.filter((item) => item.scheduled_date !== null) ?? null;
  const dismissPrompt = useCallback(() => setPrompt(null), []);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    getStageHistory(accessToken, lead.id)
      .then((rows) => { if (!cancelled) { setHistory(rows); setHistoryError(""); } })
      .catch((caught) => { if (!cancelled) setHistoryError(errorText(caught)); });
    return () => { cancelled = true; };
  }, [lead.id, lead.lead_stage?.stage_id, lead.lead_stage?.changed_at]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(stageItem: StageTypeItem, withDetails: boolean) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken || userId === null) { setError("Sign in again to continue."); return; }
    if (stageItem.slug === "lost" && !lossReason) { setError("Choose why this lead was lost."); return; }
    setIsSaving(true); setError("");
    const text = withDetails ? note.trim() : "";
    try {
      await changeStage(accessToken, lead.id, userId, {
        stage_id: stageItem.id,
        ...(stageItem.slug === "lost" ? { loss_reason: lossReason, ...(text ? { loss_notes: text } : {}) } : {}),
        ...(stageItem.slug === "aware" && text ? { awareness_note: text } : {}),
      });
      await onChanged();
      setTarget(null); setLossReason(""); setNote("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.missingFields) onUnverified(stageItem.label, caught.missingFields);
      else setError(errorText(caught));
    } finally { setIsSaving(false); }
  }

  const pick = (stageId: string) => {
    setError("");
    const stage = stages.find((s) => s.id === Number(stageId));
    if (!stage) return;
    if (stage.slug === "lost" || stage.slug === "aware") setTarget(stage);
    else void submit(stage, false);
  };

  async function changeOwner(value: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setOwnerError("Sign in again to continue."); return; }
    setIsChangingOwner(true); setOwnerError("");
    try {
      await updateContact(accessToken, lead.id, { assigned_to: Number(value) });
      await onChanged();
    } catch (caught) { setOwnerError(errorText(caught)); } finally { setIsChangingOwner(false); }
  }

  const ownerOptions = useMemo(() => [
    ...(lead.assigned_to && !owners?.some((o) => o.id === lead.assigned_to.id) ? [{ id: lead.assigned_to.id, name: lead.assigned_to.name }] : []),
    ...(owners ?? []),
  ].map((o) => ({ value: String(o.id), label: o.name })), [lead.assigned_to, owners]);

  const currentColors = stageColors(currentSlug);
  const currentLabel = lead.lead_stage?.stage_name ?? stages.find((s) => s.slug === "new_lead")?.label ?? "New Lead";

  const details: [string, string | null | undefined][] = [
    ["Phone", lead.phone],
    ["District", lead.district],
    ["Address", lead.address],
    ["Source", lead.lead_source?.name],
  ];

  const moveableStages = useMemo(() => {
    const idx = stages.findIndex((s) => s.id === currentId);
    return idx >= 0 ? stages.slice(idx + 1) : stages;
  }, [stages, currentId]);

  const chevronBg = `url("data:image/svg+xml,%3Csvg width='13' height='13' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%236B7080' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-[rgba(17,18,20,0.45)]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Lead ${lead.name ?? lead.phone}`} className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-md">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-[#0a192f]">{lead.name ?? lead.phone}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ background: currentColors.badgeBg, color: currentColors.badgeFg }}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: currentColors.badgeFg }} />
                {currentLabel}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Contact information</h3>
            <dl className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-gray-500">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium text-gray-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Move to stage</h3>
            <select
              value={target ? String(target.id) : ""}
              onChange={(e) => { if (e.target.value) pick(e.target.value); else setTarget(null); }}
              disabled={isSaving}
              className="mt-3 w-full h-11 pl-3 pr-8 border border-gray-200 rounded-xl bg-white text-sm text-[#3A3E4A] focus:outline-none focus:ring-2 focus:ring-[#BFE6D2] appearance-none disabled:opacity-60"
              style={{ backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="">{isSaving ? "Saving…" : "Select stage"}</option>
              {moveableStages.map((stage) => (
                <option key={stage.id} value={String(stage.id)}>{stage.label}</option>
              ))}
            </select>

            {(target?.slug === "lost" || target?.slug === "aware") && (
              <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                {target.slug === "lost" && (
                  <label className="crm-field-label">Why was it lost?
                    <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="crm-select">
                      <option value="">Select a reason</option>
                      {LOSS_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="crm-field-label">
                  {target.slug === "lost" ? "Notes (optional)" : "What do they need to learn? (optional)"}
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="crm-textarea" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={isSaving} onClick={() => void submit(target, true)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0E4D3A] px-4 text-sm font-semibold text-white hover:bg-[#0B3E2F] disabled:opacity-60">
                    {isSaving ? "Saving…" : `Move to ${target.label}`}
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => { setTarget(null); setError(""); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Lead assigned to</h3>
            {owners ? (
              <select
                value={lead.assigned_to ? String(lead.assigned_to.id) : ""}
                onChange={(e) => { if (e.target.value) void changeOwner(e.target.value); }}
                disabled={isChangingOwner}
                className="mt-3 w-full h-11 pl-3 pr-8 border border-gray-200 rounded-xl bg-white text-sm text-[#3A3E4A] focus:outline-none focus:ring-2 focus:ring-[#BFE6D2] appearance-none disabled:opacity-60"
                style={{ backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
              >
                <option value="">Unassigned</option>
                {ownerOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <p className="mt-3 text-sm font-medium text-gray-900">{lead.assigned_to?.name ?? "Unassigned"}</p>
            )}
            <p className="mt-1.5 text-xs text-gray-500">{isChangingOwner ? "Saving…" : "Admins and managers are not listed."}</p>
            {ownerError && <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{ownerError}</p>}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a192f]">Activity</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                { form: "log", label: "+ Log Activity", on: "border-[#0E4D3A] bg-blue-50 text-blue-700", off: "border-blue-200 bg-white text-blue-700 hover:bg-blue-50", icon: <path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /> },
                { form: "schedule", label: "+ Schedule Follow-up", on: "border-violet-600 bg-violet-50 text-violet-700", off: "border-violet-200 bg-white text-violet-700 hover:bg-violet-50", icon: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5ZM8 3v4M16 3v4M3.5 10h17" /> },
              ] as const).map(({ form, label, on, off, icon }) => (
                <button key={form} type="button" aria-expanded={activityForm === form} onClick={() => openActivityForm(form)}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2 text-[13px] font-semibold transition-colors ${activityForm === form ? on : off}`}>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                  {label}
                </button>
              ))}
            </div>

            {activityForm === "log" && (
              <ActivityLogForm contactId={lead.id} onCancel={() => setActivityForm(null)}
                onSaved={async () => { await loadActivities(); setActivityForm(null); setHistoryTab("log"); setPrompt("Activity saved"); }} />
            )}
            {activityForm === "schedule" && (
              <FollowupScheduleForm contactId={lead.id} staff={owners ?? (lead.assigned_to ? [{ id: lead.assigned_to.id, name: lead.assigned_to.name }] : [])}
                defaultAssignee={lead.assigned_to?.id ?? null} onCancel={() => setActivityForm(null)}
                onSaved={async () => { await loadActivities(); setActivityForm(null); setHistoryTab("followups"); }} />
            )}
            {prompt && !activityForm && <FollowupPrompt title={prompt} onSchedule={() => { setPrompt(null); setActivityForm("schedule"); }} onSkip={dismissPrompt} />}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a192f]">History</h3>
            <div role="tablist" aria-label="History" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
              {([
                { id: "log", label: `Activity log${entries?.length ? ` (${entries.length})` : ""}` },
                { id: "followups", label: `Follow-ups${tasks?.length ? ` (${tasks.length})` : ""}` },
                { id: "stages", label: "Stage history" },
              ] as const).map(({ id, label }) => (
                <button key={id} id={`history-tab-${id}`} type="button" role="tab" aria-selected={historyTab === id} aria-controls="history-tabpanel" onClick={() => setHistoryTab(id)}
                  className={`min-h-10 rounded-lg px-1.5 text-xs font-semibold leading-tight transition-colors ${historyTab === id ? "bg-white text-[#0a192f] shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{label}</button>
              ))}
            </div>
            <div id="history-tabpanel" role="tabpanel" aria-labelledby={`history-tab-${historyTab}`}>
              {historyTab === "log" && (
                <ActivityList items={entries} error={activityError} emptyText="No activity logged yet." onRetry={() => void loadActivities()} onMarkDone={markDone} onReschedule={reschedule} />
              )}
              {historyTab === "followups" && (
                <ActivityList items={tasks} error={activityError} emptyText="No follow-ups scheduled yet." onRetry={() => void loadActivities()} onMarkDone={markDone} onReschedule={reschedule} />
              )}
              {historyTab === "stages" && (
                <>
                  {historyError ? (
                    <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{historyError}</p>
                  ) : history === null ? (
                    <p className="mt-4 text-sm text-gray-500">Loading history…</p>
                  ) : history.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">No stage changes recorded yet.</p>
                  ) : (
                    <ol className="mt-4 space-y-3 border-l-2 border-gray-200 pl-4">
                      {history.map((entry) => {
                        const entryColors = stageColors(entry.stage_slug);
                        const detail = [
                          entry.loss_reason ? (LOSS_REASONS.find((r) => r.value === entry.loss_reason)?.label) : undefined,
                          entry.loss_notes,
                          entry.awareness_note,
                        ].filter(Boolean).join(" · ");
                        return (
                          <li key={entry.id} className="relative">
                            <span aria-hidden="true" className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: entryColors.bar }} />
                            <p className="text-sm font-bold text-gray-900">{entry.stage_name}</p>
                            <p className="text-xs text-gray-500">{formatMoment(entry.changed_at)}</p>
                            {detail && <p className="mt-1 text-xs text-gray-600">{detail}</p>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
