"use client";

/**
 * TemplatesTab — Settings → WhatsApp Templates.
 *
 * List of the tenant's templates with their Meta status, a Sync button, and the editor.
 * Drafts stay local until "Send to Meta". After that Meta decides the status; it reaches the CRM
 * through Meta's webhook, or when someone presses "Sync from Meta".
 * Viewing needs `integrations` read; everything else needs `integrations` update.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canDo } from "@/lib/shared/roles";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  submitTemplate,
  syncTemplates,
  updateTemplate,
  type TemplateStatus,
  type WhatsAppTemplate,
  type WhatsAppTemplateInput,
} from "@/features/whatsapp/api/templates";
import TemplateEditor from "./TemplateEditor";
import { ErrorBlock, Spinner, Toast, accentButton, errorText, primaryButton, secondaryButton } from "./ui";

const STATUS_STYLE: Record<TemplateStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  PENDING: { label: "In review", className: "bg-amber-50 text-amber-800 border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  REJECTED: { label: "Rejected", className: "bg-rose-50 text-rose-700 border-rose-200" },
  PAUSED: { label: "Paused", className: "bg-orange-50 text-orange-800 border-orange-200" },
  DISABLED: { label: "Disabled", className: "bg-rose-50 text-rose-700 border-rose-200" },
  IN_APPEAL: { label: "In appeal", className: "bg-amber-50 text-amber-800 border-amber-200" },
  PENDING_DELETION: { label: "Being deleted", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PENDING", label: "In review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const QUALITY_DOT: Record<string, string> = { GREEN: "bg-emerald-500", YELLOW: "bg-amber-400", RED: "bg-rose-500" };

export default function TemplatesTab() {
  const { token, user } = useAuth();
  const canEdit = canDo(user, "integrations", "u");

  const [items, setItems] = useState<WhatsAppTemplate[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<WhatsAppTemplate | "new" | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view templates."); return; }
    setLoadError("");
    try { setItems((await listTemplates(token)).items); }
    catch (caught) { setLoadError(errorText(caught, "Templates could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (items ?? []).filter((t) => (!filter || t.status === filter) && (!needle || t.name.includes(needle)));
  }, [items, filter, search]);

  async function save(input: WhatsAppTemplateInput, thenSubmit: boolean) {
    if (!token || !editing) return;
    setBusy(true); setFormError(""); setNotice(null);
    try {
      const saved = editing === "new" ? await createTemplate(token, input) : await updateTemplate(token, editing.id, input);
      if (thenSubmit) await submitTemplate(token, saved.id);
      setEditing(null);
      setNotice({ text: thenSubmit ? "Sent to Meta for review." : editing !== "new" && !editing.can_submit ? "Saved and sent to Meta for a new review." : "Draft saved.", tone: "ok" });
      await load();
    } catch (caught) {
      setFormError(errorText(caught, "The template could not be saved."));
      // a draft that saved but failed to send is already in the list
      if (thenSubmit) await load();
    } finally { setBusy(false); }
  }

  async function act(id: number, run: (t: string) => Promise<unknown>, done: string, fallback: string) {
    if (!token) return;
    setBusy(true); setNotice(null);
    try { await run(token); setNotice({ text: done, tone: "ok" }); await load(); }
    catch (caught) { setNotice({ text: errorText(caught, fallback), tone: "error" }); }
    finally { setBusy(false); setConfirmId(null); }
  }

  async function sync() {
    if (!token) return;
    setBusy(true); setNotice(null);
    try {
      const r = await syncTemplates(token);
      setNotice({ text: `Synced ${r.fetched} template${r.fetched === 1 ? "" : "s"} from Meta (${r.created} new, ${r.updated} updated).`, tone: "ok" });
      await load();
    } catch (caught) { setNotice({ text: errorText(caught, "Sync failed."), tone: "error" }); }
    finally { setBusy(false); }
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!items) return <Spinner />;

  if (editing) {
    return (
      <TemplateEditor
        key={editing === "new" ? "new" : editing.id}
        template={editing === "new" ? null : editing}
        busy={busy}
        error={formError}
        onSave={(input, thenSubmit) => void save(input, thenSubmit)}
        onCancel={() => { setEditing(null); setFormError(""); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      {!canEdit && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view templates but not change them.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search templates" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name"
          className="h-10 w-56 rounded-[8px] border border-[#E1E1E6] px-3 text-sm" />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === f.key ? "border-[#0E4D3A] bg-[#0E4D3A] text-white" : "border-[#E1E1E6] bg-white text-[#3A3E4A] hover:bg-[#F3F3F5]"}`}>
              {f.label}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => void sync()}>{busy ? "Working…" : "Sync from Meta"}</button>
            <button type="button" className={primaryButton} disabled={busy} onClick={() => { setFormError(""); setEditing("new"); }}>New template</button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#DEE1E5] bg-white px-4 py-10 text-center text-sm text-gray-500">
          {items.length === 0 ? "No templates yet. Create one, or sync the ones already in your Meta account." : "No templates match."}
        </p>
      ) : (
        <ul className="divide-y divide-[#F0F0F3] rounded-[14px] border border-[#E5E7EA] bg-white">
          {visible.map((t) => {
            const style = STATUS_STYLE[t.status] ?? STATUS_STYLE.PENDING;
            return (
              <li key={t.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#1A1C21]">
                      <span className="truncate">{t.name}</span>
                      {t.quality_score && <span title={`Quality: ${t.quality_score}`} className={`h-2 w-2 rounded-full ${QUALITY_DOT[t.quality_score] ?? "bg-gray-300"}`} />}
                    </p>
                    <p className="text-xs text-[#8A8F9C]">{t.language} · {t.category.charAt(0) + t.category.slice(1).toLowerCase()}{t.body_variable_count > 0 ? ` · ${t.body_variable_count} variable${t.body_variable_count === 1 ? "" : "s"}` : ""}</p>
                  </div>
                  <span data-testid={`tpl-status-${t.id}`} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.className}`}>{style.label}</span>
                  {canEdit && (
                    confirmId === t.id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-red-700">{t.meta_template_id ? "Delete here and on Meta?" : "Delete this draft?"}</span>
                        <button type="button" disabled={busy} onClick={() => void act(t.id, (tk) => deleteTemplate(tk, t.id), "Template deleted.", "The template could not be deleted.")} className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white">Delete</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="rounded-md border border-gray-200 px-2.5 py-1">Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-3 text-xs font-semibold">
                        {t.can_submit && <button type="button" disabled={busy} className={`${accentButton} !h-8 !px-3 !text-xs`} onClick={() => void act(t.id, (tk) => submitTemplate(tk, t.id), "Sent to Meta for review.", "The template could not be sent to Meta.")}>Send to Meta</button>}
                        {t.can_edit && <button type="button" className="text-[#0E4D3A] hover:underline" aria-label={`Edit ${t.name}`} onClick={() => { setFormError(""); setEditing(t); }}>Edit</button>}
                        <button type="button" className="text-red-600 hover:underline" aria-label={`Delete ${t.name}`} onClick={() => setConfirmId(t.id)}>Delete</button>
                      </span>
                    )
                  )}
                </div>
                {t.rejection_reason && t.status === "REJECTED" && <p className="text-xs text-rose-700">Meta&apos;s reason: {t.rejection_reason}</p>}
                {t.submission_error && <p className="text-xs text-rose-700">Last error from Meta: {t.submission_error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
