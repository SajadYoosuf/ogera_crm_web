"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { updateContact, type ApiContact } from "@/features/contacts/api/contacts";
import { listActivities, markFollowupDone, rescheduleFollowup, type ActivityItem } from "@/lib/api/activities";
import { changeStage, getLeadHistory, type HistoryEvent, type StageTypeItem } from "@/lib/api/leads";
import ActivityList from "./ActivityList";
import ActivityLogForm from "./ActivityLogForm";
import FollowupPrompt from "./FollowupPrompt";
import HistoryList from "./HistoryList";
import FollowupScheduleForm from "./FollowupScheduleForm";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, COLOR, KIND_PILL, SHADOW, TYPE } from "./designTokens";
import { AVATAR_COLORS, LOSS_REASONS, formatMoment, initials, stageColors, whatsappLink, type LeadKind } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");

const KIND_LABEL: Record<LeadKind, string> = { consumer: "Consumer", partner: "Partner", dealer: "Dealer" };

const TABS = [
  { id: "log", label: "Activity log" },
  { id: "followups", label: "Follow-ups" },
  { id: "stages", label: "History" },
] as const;

const quickButton = (background: string): CSSProperties => ({
  background,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 9,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
});

const CHEVRON = (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0" style={{ color: COLOR.textFaint }}><path d="M6 9l6 6 6-6" /></svg>
);

/** A dropdown in the panel's selector row: a trigger button and a list that closes on outside click. */
function PanelMenu({ trigger, options, onPick, disabled = false }: {
  trigger: ReactNode; options: { value: string; label: string; selected: boolean }[]; onPick: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}
        className="flex h-[38px] w-full min-w-0 items-center gap-2 bg-white px-2.5 transition-colors hover:bg-[#F7F8F9] disabled:opacity-60"
        style={{ ...TYPE.buttonLabel, fontWeight: 700, color: COLOR.textBody, border: `1px solid ${COLOR.borderStrong}`, borderRadius: 8 }}>
        {trigger}
        {CHEVRON}
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-[44px] z-[5] flex max-h-[220px] flex-col gap-px overflow-y-auto bg-white p-1.5"
          style={{ border: `1px solid ${COLOR.borderStrong}`, borderRadius: 10, boxShadow: SHADOW.dropdown }}>
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.selected}>
              <button type="button" onClick={() => { setOpen(false); onPick(option.value); }}
                className="flex w-full rounded-md px-2.5 py-2 text-left transition-colors"
                style={{ ...TYPE.bodyMd, fontWeight: option.selected ? 700 : 500, background: option.selected ? COLOR.accentTint08 : "transparent", color: option.selected ? COLOR.textHeading : COLOR.textBody }}>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const kindPill = KIND_PILL[kind];
  const displayName = lead.name || lead.phone;

  const [target, setTarget] = useState<StageTypeItem | null>(
    initialTargetId ? (stages.find((s) => s.id === initialTargetId) ?? null) : null,
  );
  const [lossReason, setLossReason] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
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
  const closeForm = useCallback(() => setActivityForm(null), []);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    getLeadHistory(accessToken, lead.id)
      .then((rows) => { if (!cancelled) { setHistory(rows); setHistoryError(""); } })
      .catch((caught) => { if (!cancelled) setHistoryError(errorText(caught)); });
    return () => { cancelled = true; };
  }, [lead.id, lead.lead_stage?.stage_id, lead.lead_stage?.changed_at, activities]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && activityForm === null) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, activityForm]);

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
  const assigneeName = lead.assigned_to?.name ?? "Unassigned";
  const assigneeAvatar = AVATAR_COLORS[(lead.assigned_to?.id ?? 0) % AVATAR_COLORS.length];

  const fields: [string, string | null | undefined][] = [
    ["Phone", lead.phone],
    ["District", lead.district],
    ["Address", lead.address],
    ["Source", lead.lead_source?.name],
    ["Created", formatMoment(lead.created_at)],
  ];

  const moveableStages = useMemo(() => {
    const idx = stages.findIndex((s) => s.id === currentId);
    return idx >= 0 ? stages.slice(idx + 1) : stages;
  }, [stages, currentId]);

  const listItems = historyTab === "log" ? entries : historyTab === "followups" ? tasks : null;
  const showAddButton = listItems !== null && !activityError;
  const showEmpty = listItems !== null && listItems.length === 0 && !activityError;
  const addLabel = historyTab === "log" ? "Log New Activity" : "Schedule Followup";
  const emptyCopy = historyTab === "log"
    ? { title: "No activity logged yet", hint: "Log a call, visit or quote to start the history." }
    : { title: "No follow-ups scheduled yet", hint: "Schedule a reminder so this lead doesn't go cold." };

  const openForm = (form: "log" | "schedule") => { setPrompt(null); setActivityForm(form); };

  return (
    <>
      <div className="fixed inset-0 z-[1100] flex justify-end" style={{ background: COLOR.overlay }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <aside role="dialog" aria-modal="true" aria-labelledby="lp-title" className="flex h-full w-full flex-col bg-white sm:max-w-[480px]" style={{ boxShadow: SHADOW.drawer }}>
          <header className="flex shrink-0 items-start justify-between gap-3 px-[22px] py-5" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full" style={{ background: kindPill.bg, color: kindPill.fg, ...TYPE.h3PanelTitle }}>
                {initials(displayName).charAt(0)}
              </span>
              <div className="min-w-0">
                <h2 id="lp-title" className="truncate" style={{ ...TYPE.h3PanelTitle, color: COLOR.textHeading }}>{displayName}</h2>
                {lead.district && <p className="mt-0.5" style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>{lead.district}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2.5 py-0.5" style={{ ...TYPE.caption, fontWeight: 700, background: kindPill.bg, color: kindPill.fg }}>{KIND_LABEL[kind]}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ ...TYPE.caption, fontWeight: 700, background: currentColors.badgeBg, color: currentColors.badgeFg }}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: currentColors.badgeFg }} />
                    {currentLabel}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg hover:bg-gray-100" style={{ color: COLOR.textMuted }}>
              <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <div className="flex shrink-0 gap-2 px-[22px] py-3.5" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" className="flex h-[38px] flex-1 items-center justify-center gap-1.5" style={quickButton("#25D366")}>
              <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L4 20l1-4.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
              WhatsApp
            </a>
            <a href={`tel:${lead.phone}`} className="flex h-[38px] flex-1 items-center justify-center gap-1.5" style={quickButton("#1565D8")}>
              <svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" /></svg>
              Call
            </a>
            <a href={`sms:${lead.phone}`} className="flex h-[38px] flex-1 items-center justify-center gap-1.5" style={quickButton("#4B5060")}>
              <svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Message
            </a>
          </div>

          <div className="shrink-0 px-[22px] py-3" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            <div className="flex gap-2">
              <PanelMenu
                disabled={isSaving}
                onPick={pick}
                options={moveableStages.map((stage) => ({ value: String(stage.id), label: stage.label, selected: false }))}
                trigger={<>
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR.accent }} />
                  <span className="truncate">{isSaving ? "Saving…" : `Stage: ${currentLabel}`}</span>
                </>}
              />
              <PanelMenu
                disabled={!owners || isChangingOwner}
                onPick={(value) => void changeOwner(value)}
                options={ownerOptions.map((opt) => ({ ...opt, selected: opt.value === String(lead.assigned_to?.id) }))}
                trigger={<>
                  <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full" style={{ ...TYPE.caption, fontWeight: 700, background: assigneeAvatar.bg, color: assigneeAvatar.fg }}>
                    {initials(assigneeName).charAt(0)}
                  </span>
                  <span className="truncate">{isChangingOwner ? "Saving…" : assigneeName}</span>
                </>}
              />
            </div>

            {(target?.slug === "lost" || target?.slug === "aware") && (
              <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
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
                  <button type="button" disabled={isSaving} onClick={() => void submit(target, true)} style={BUTTON_PRIMARY} className="flex-1 disabled:opacity-60">
                    {isSaving ? "Saving…" : `Move to ${target.label}`}
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => { setTarget(null); setError(""); }} style={BUTTON_SECONDARY} className="disabled:opacity-60">Cancel</button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg px-4 py-3" style={{ ...TYPE.bodySm, background: COLOR.dangerBg, color: COLOR.danger }}>{error}</p>}
            {ownerError && <p role="alert" className="mt-3 rounded-lg px-4 py-3" style={{ ...TYPE.bodySm, background: COLOR.dangerBg, color: COLOR.danger }}>{ownerError}</p>}
          </div>

          <div className="shrink-0 px-[22px] py-4" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            <dl className="grid grid-cols-2 gap-x-3.5 gap-y-3">
              {fields.map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col gap-0.5">
                  <dt style={{ ...TYPE.label, fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase", color: COLOR.textMuted }}>{label}</dt>
                  <dd className="truncate" style={{ ...TYPE.bodyMd, color: COLOR.textBody }}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div role="tablist" aria-label="Lead detail tabs" className="flex shrink-0 gap-1 px-[22px]" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            {TABS.map(({ id, label }) => {
              const on = historyTab === id;
              const count = id === "log" && entries?.length ? ` (${entries.length})` : id === "followups" && tasks?.length ? ` (${tasks.length})` : "";
              return (
                <button key={id} id={`history-tab-${id}`} type="button" role="tab" aria-selected={on} aria-controls="history-tabpanel" onClick={() => setHistoryTab(id)}
                  className="-mb-px border-b-2 px-2.5 py-2.5 transition-colors"
                  style={{ ...TYPE.buttonLabel, borderColor: on ? COLOR.accent : "transparent", color: on ? COLOR.textHeading : COLOR.textMuted, fontWeight: on ? 700 : 600 }}>
                  {label}{count}
                </button>
              );
            })}
          </div>

          <div id="history-tabpanel" role="tabpanel" aria-labelledby={`history-tab-${historyTab}`} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] py-4">
            {prompt && !activityForm && <FollowupPrompt title={prompt} onSchedule={() => { setPrompt(null); setActivityForm("schedule"); }} onSkip={dismissPrompt} />}

            {historyTab !== "stages" && (
              <>
                {showAddButton && (
                  <button type="button" onClick={() => openForm(historyTab === "log" ? "log" : "schedule")} style={BUTTON_PRIMARY} className="mb-3 flex h-10 w-full shrink-0 items-center justify-center">
                    {addLabel}
                  </button>
                )}
                {showEmpty ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <span aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center rounded-[14px]" style={{ background: COLOR.surfaceMuted, color: COLOR.textFaint }}>
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h4" /></svg>
                    </span>
                    <p className="mt-3" style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR.textBody }}>{emptyCopy.title}</p>
                    <p className="mt-1" style={{ ...TYPE.bodySm, color: COLOR.textMuted, maxWidth: 250 }}>{emptyCopy.hint}</p>
                  </div>
                ) : (
                  <ActivityList items={listItems} error={activityError} emptyText={emptyCopy.title} onRetry={() => void loadActivities()} onMarkDone={markDone} onReschedule={reschedule} />
                )}
              </>
            )}

            {historyTab === "stages" && (
              <>
                {historyError ? (
                  <p role="alert" className="rounded-lg px-4 py-3" style={{ ...TYPE.bodySm, background: COLOR.dangerBg, color: COLOR.danger }}>{historyError}</p>
                ) : history === null ? (
                  <p style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>Loading history…</p>
                ) : history.length === 0 ? (
                  <p style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>No history recorded yet.</p>
                ) : (
                  <HistoryList events={history} />
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {activityForm === "log" && (
        <ActivityLogForm contactId={lead.id} contactName={displayName} onCancel={closeForm}
          onSaved={async () => { await loadActivities(); setActivityForm(null); setHistoryTab("log"); setPrompt("Activity saved"); }} />
      )}
      {activityForm === "schedule" && (
        <FollowupScheduleForm contactId={lead.id} contactName={displayName}
          staff={owners ?? (lead.assigned_to ? [{ id: lead.assigned_to.id, name: lead.assigned_to.name }] : [])}
          defaultAssignee={lead.assigned_to?.id ?? null} onCancel={closeForm}
          onSaved={async () => { await loadActivities(); setActivityForm(null); setHistoryTab("followups"); }} />
      )}
    </>
  );
}
