"use client";

/**
 * ContactFieldsTab (admin) — configure contact profile field definitions.
 *
 * Shows three panels: Consumer Fields, Partner Fields, Dealer Fields.
 *
 * Per panel admins can:
 *   - Add a new field (label, field_name key, type, required)
 *   - Rename the display label of existing fields
 *   - Add / remove / rename dropdown options
 *   - Toggle required / optional
 *   - Toggle active / inactive (hidden)
 *   - Reorder (up / down)
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listAllContactFields,
  createContactField,
  updateContactField,
  type ContactFieldDefinition,
  type ContactFieldCreate,
  type FieldType,
} from "@/features/settings/api/contactFieldsSettings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, accentButton, errorText, iconButton, icons } from "./ui";

const secondaryButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-xs font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  dropdown: "Dropdown",
};

type EntityType = "consumer" | "partner" | "dealer";

const PANEL_META: Record<EntityType, { title: string; subtitle: string }> = {
  consumer: {
    title: "Consumer fields",
    subtitle: "Fields shown on individual buyer / dealer contact profiles",
  },
  partner: {
    title: "Partner fields",
    subtitle: "Fields shown on trade / professional partner contact profiles",
  },
  dealer: {
    title: "Dealer fields",
    subtitle: "Fields shown on dealer contact profiles",
  },
};

// ── Add-field form ────────────────────────────────────────────────────────────

const SNAKE_RE = /^[a-z_][a-z0-9_]*$/;

function AddFieldForm({
  entityType,
  busy,
  onAdd,
}: {
  entityType: EntityType;
  busy: boolean;
  onAdd: (body: ContactFieldCreate) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);

  if (!open) {
    return (
      <button type="button" className={accentButton} onClick={() => setOpen(true)}>
        <Icon>{icons.plus}</Icon> Add field
      </button>
    );
  }

  const labelTrimmed = label.trim();
  const nameTrimmed = name.trim();
  const nameValid = SNAKE_RE.test(nameTrimmed);
  const canSubmit = labelTrimmed && nameValid && !busy;

  async function submit() {
    if (!canSubmit) return;
    const ok = await onAdd({
      entity_type: entityType,
      field_label: labelTrimmed,
      field_name: nameTrimmed,
      field_type: type,
      is_required: required,
    });
    if (ok) {
      setLabel(""); setName(""); setType("text"); setRequired(false);
      setOpen(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[#E5E7EA] bg-[#FAFAFA] p-4 space-y-3">
      <p className="text-xs font-bold text-[#1A1C21]">New field</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7080]">Display label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100}
            placeholder="e.g. Tank Type"
            className="h-9 rounded-[8px] border border-[#E1E1E6] px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7080]">
            Field key <span className="font-normal text-[#9AA0AC]">(snake_case)</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            maxLength={50} placeholder="e.g. tank_type"
            className={`h-9 rounded-[8px] border px-3 text-sm ${nameTrimmed && !nameValid ? "border-red-400" : "border-[#E1E1E6]"}`} />
          {nameTrimmed && !nameValid && <p className="text-[11px] text-red-600">Must start with a letter, letters/digits/underscores only</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#6B7080]">Field type</label>
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)}
            className="h-9 rounded-[8px] border border-[#E1E1E6] px-3 text-sm bg-white">
            {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3A3E4A]">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-[#E1E1E6] accent-[#0E4D3A]" />
            Required field
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className={accentButton} disabled={!canSubmit} onClick={() => void submit()}>
          Add field
        </button>
        <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ── Field panel ───────────────────────────────────────────────────────────────

type FieldPanelProps = {
  entityType: EntityType;
  fields: ContactFieldDefinition[];
  busy: boolean;
  onSave: (id: number, patch: Parameters<typeof updateContactField>[2]) => Promise<boolean>;
  onAdd: (body: ContactFieldCreate) => Promise<boolean>;
};

function FieldPanel({ entityType, fields, busy, onSave, onAdd }: FieldPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [optionEdit, setOptionEdit] = useState<{ id: number; original: string; draft: string } | null>(null);
  const [newOption, setNewOption] = useState("");
  const { title, subtitle } = PANEL_META[entityType];

  const activeCount = fields.filter((f) => f.is_active).length;

  async function move(field: ContactFieldDefinition, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === field.id);
    const other = fields[idx + dir];
    if (!other) return;
    const a = other.sort_order === field.sort_order ? field.sort_order + dir : other.sort_order;
    await onSave(field.id, { sort_order: a });
    await onSave(other.id, { sort_order: field.sort_order });
  }

  async function saveLabel(field: ContactFieldDefinition) {
    const lbl = editLabel.trim();
    if (!lbl) return;
    const ok = await onSave(field.id, { field_label: lbl });
    if (ok) setEditingId(null);
  }

  async function addOption(field: ContactFieldDefinition) {
    const opt = newOption.trim();
    if (!opt) return;
    const existing = field.options ?? [];
    if (existing.some((o) => o.toLowerCase() === opt.toLowerCase())) return;
    const ok = await onSave(field.id, { options: [...existing, opt] });
    if (ok) setNewOption("");
  }

  async function removeOption(field: ContactFieldDefinition, option: string) {
    await onSave(field.id, { options: (field.options ?? []).filter((o) => o !== option) });
  }

  async function renameOption(field: ContactFieldDefinition) {
    if (!optionEdit) return;
    const { original, draft } = optionEdit;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === original) { setOptionEdit(null); return; }
    const ok = await onSave(field.id, {
      options: (field.options ?? []).map((o) => (o === original ? trimmed : o)),
    });
    if (ok) setOptionEdit(null);
  }

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      status={<span className="text-xs font-semibold text-[#6B7080]">{activeCount} active</span>}
    >
      <AddFieldForm entityType={entityType} busy={busy} onAdd={onAdd} />

      {fields.length === 0 ? (
        <p className="text-sm text-[#9AA0AC]">No fields yet. Add one above.</p>
      ) : (
        <ul className="divide-y divide-[#F0F0F3] rounded-xl border border-[#E5E7EA]">
          {fields.map((field, i) => (
            <li key={field.id} className={`flex flex-col gap-3 px-3 py-3 ${field.is_active ? "" : "bg-gray-50"}`}>
              {/* Row header */}
              <div className="flex flex-wrap items-start gap-3">
                {/* Up/down */}
                <div className="mt-0.5 flex flex-col">
                  <button type="button" aria-label={`Move ${field.field_label ?? field.field_name} up`}
                    className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    disabled={busy || i === 0} onClick={() => void move(field, -1)}>
                    <Icon className="h-4 w-4">{icons.up}</Icon>
                  </button>
                  <button type="button" aria-label={`Move ${field.field_label ?? field.field_name} down`}
                    className="h-5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    disabled={busy || i === fields.length - 1} onClick={() => void move(field, 1)}>
                    <Icon className="h-4 w-4">{icons.down}</Icon>
                  </button>
                </div>

                {/* Label + meta */}
                <div className="min-w-0 flex-1">
                  {editingId === field.id ? (
                    <div className="flex gap-2">
                      <input aria-label={`Label for ${field.field_name}`} value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void saveLabel(field); if (e.key === "Escape") setEditingId(null); }}
                        maxLength={100}
                        className="h-9 flex-1 rounded-[8px] border border-[#E1E1E6] px-2 text-sm" />
                      <button type="button" disabled={busy || !editLabel.trim()}
                        className="h-9 rounded-[8px] bg-[#0E4D3A] px-3 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => void saveLabel(field)}>Save</button>
                      <button type="button" className="h-9 rounded-[8px] border border-[#E1E1E6] px-3 text-xs"
                        onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#1A1C21]">
                        {field.field_label ?? field.field_name}
                      </span>
                      <span className="rounded-full bg-[#EDF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#3B6FE0]">
                        {FIELD_TYPE_LABELS[field.field_type as FieldType] ?? field.field_type}
                      </span>
                      {field.is_required && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Required</span>
                      )}
                      {!field.is_active && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Hidden</span>
                      )}
                      <span className="text-[11px] text-[#9AA0AC]">{field.field_name}</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {editingId !== field.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className={iconButton}
                      aria-label={`Rename ${field.field_label ?? field.field_name}`}
                      onClick={() => { setEditingId(field.id); setEditLabel(field.field_label ?? field.field_name ?? ""); }}>
                      <Icon>{icons.pencil}</Icon>
                    </button>
                    <button type="button" disabled={busy}
                      className="h-9 rounded-[8px] border border-[#E1E1E6] px-2.5 text-xs font-semibold text-[#3A3E4A] disabled:opacity-50"
                      onClick={() => void onSave(field.id, { is_required: !field.is_required })}>
                      {field.is_required ? "Optional" : "Required"}
                    </button>
                    <button type="button" disabled={busy}
                      className="h-9 rounded-[8px] border border-[#E1E1E6] px-2.5 text-xs font-semibold text-[#3A3E4A] disabled:opacity-50"
                      onClick={() => void onSave(field.id, { is_active: !field.is_active })}>
                      {field.is_active ? "Hide" : "Show"}
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown options editor */}
              {field.field_type === "dropdown" && field.is_active && (
                <div className="ml-8 space-y-2 rounded-[10px] border border-[#E5E7EA] bg-[#FAFAFA] p-3">
                  <p className="text-xs font-semibold text-[#6B7080]">Options</p>
                  <ul className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((opt) => (
                      <li key={opt} className="flex items-center gap-1">
                        {optionEdit?.id === field.id && optionEdit.original === opt ? (
                          <>
                            <input value={optionEdit.draft}
                              onChange={(e) => setOptionEdit({ ...optionEdit, draft: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") void renameOption(field); if (e.key === "Escape") setOptionEdit(null); }}
                              className="h-7 rounded-md border border-[#E1E1E6] px-2 text-xs" />
                            <button type="button" disabled={busy}
                              className="h-7 rounded-md bg-[#0E4D3A] px-2 text-xs font-semibold text-white"
                              onClick={() => void renameOption(field)}>✓</button>
                            <button type="button" className="h-7 rounded-md border px-2 text-xs"
                              onClick={() => setOptionEdit(null)}>✕</button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full border border-[#E1E1E6] bg-white px-2.5 py-1 text-xs text-[#3A3E4A]">
                            {opt}
                            <button type="button" aria-label={`Rename option ${opt}`}
                              className="text-gray-400 hover:text-gray-600"
                              onClick={() => setOptionEdit({ id: field.id, original: opt, draft: opt })}>
                              <Icon className="h-3 w-3">{icons.pencil}</Icon>
                            </button>
                            <button type="button" aria-label={`Remove option ${opt}`}
                              className="text-gray-400 hover:text-red-500" disabled={busy}
                              onClick={() => void removeOption(field, opt)}>
                              <Icon className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" /></Icon>
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <input aria-label="New option" value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void addOption(field); }}
                      placeholder="Add option…" maxLength={80}
                      className="h-8 flex-1 rounded-[8px] border border-[#E1E1E6] px-2.5 text-xs" />
                    <button type="button" disabled={busy || !newOption.trim()}
                      className={`${secondaryButton} h-8`}
                      onClick={() => void addOption(field)}>
                      <Icon className="h-3.5 w-3.5">{icons.plus}</Icon> Add
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ContactFieldsTab() {
  const { token } = useAuth();
  const [fields, setFields] = useState<ContactFieldDefinition[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view field definitions."); return; }
    setLoadError("");
    try { setFields(await listAllContactFields(token)); }
    catch (caught) { setLoadError(errorText(caught, "Field definitions could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(id: number, patch: Parameters<typeof updateContactField>[2]): Promise<boolean> {
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return false; }
    setBusy(true); setNotice(null);
    try {
      const updated = await updateContactField(token, id, patch);
      setFields((prev) =>
        prev
          ? prev
              .map((f) => (f.id === updated.id ? updated : f))
              .sort((a, b) =>
                a.entity_type !== b.entity_type
                  ? a.entity_type.localeCompare(b.entity_type)
                  : a.sort_order - b.sort_order,
              )
          : prev,
      );
      setNotice({ text: "Saved.", tone: "ok" });
      return true;
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });
      return false;
    } finally { setBusy(false); }
  }

  async function add(body: ContactFieldCreate): Promise<boolean> {
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return false; }
    setBusy(true); setNotice(null);
    try {
      const created = await createContactField(token, body);
      setFields((prev) =>
        prev
          ? [...prev, created].sort((a, b) =>
              a.entity_type !== b.entity_type
                ? a.entity_type.localeCompare(b.entity_type)
                : a.sort_order - b.sort_order,
            )
          : [created],
      );
      setNotice({ text: `"${created.field_label ?? created.field_name}" added.`, tone: "ok" });
      return true;
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not add field. Please try again."), tone: "error" });
      return false;
    } finally { setBusy(false); }
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!fields) return <Spinner />;

  const sortedFields = (et: EntityType) =>
    fields
      .filter((f) => f.entity_type === et)
      .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-5">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      <FieldPanel entityType="consumer" fields={sortedFields("consumer")} busy={busy} onSave={save} onAdd={add} />
      <FieldPanel entityType="partner" fields={sortedFields("partner")} busy={busy} onSave={save} onAdd={add} />
      <FieldPanel entityType="dealer" fields={sortedFields("dealer")} busy={busy} onSave={save} onAdd={add} />
    </div>
  );
}
