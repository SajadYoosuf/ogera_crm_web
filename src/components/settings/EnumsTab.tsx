"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invalidateEnumOptions } from "@/hooks/useEnumOptions";
import { ENUM_CATEGORIES, createEnum, deleteEnum, listAllEnums, reorderEnum, updateEnum, type EnumCategory, type EnumValue } from "@/lib/api/settings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, accentButton, errorText, getToken, icons, iconButton, secondaryButton } from "./ui";

type Grouped = Record<EnumCategory, EnumValue[]>;
type Confirm = { row: EnumValue; mode: "deactivate" | "remove" };

const HINTS: Partial<Record<EnumCategory, string>> = {
  lead_stage: "The pipeline is fixed: rename, reorder or hide stages. Hidden stages stay visible while leads are still in them.",
  activity_type: "Options marked with a lock are used by the app itself, so they can be renamed but not turned off.",
  professional_type: "Partner types are offered when adding a partner. A hidden type stays on partners who already have it. Other is always available for imports.",
};

const STAGE_TYPES = [
  { key: "consumer", label: "Consumer" },
  { key: "partner", label: "Partner" },
  { key: "dealer", label: "Dealer" },
] as const;

export default function EnumsTab() {
  const [category, setCategory] = useState<EnumCategory>("lead_source");
  const [stageType, setStageType] = useState<string>("consumer");
  const [data, setData] = useState<Grouped | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; label: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [grab, setGrab] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  /** Set when Escape cancels a rename, so the blur that follows does not save it. */
  const skipSave = useRef(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoadError("Sign in again to view settings."); return; }
    setLoadError("");
    try { setData(await listAllEnums(token)); } catch (caught) { setLoadError(errorText(caught, "Options could not be loaded.")); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const meta = ENUM_CATEGORIES.find((item) => item.key === category)!;
  /** Lead stages are one pipeline per contact type, so only the chosen type's stages are listed. */
  const inScope = (row: EnumValue) => category !== "lead_stage" || row.group === stageType;
  const rows = useMemo(() => (data?.[category] ?? []).filter((row) => category !== "lead_stage" || row.group === stageType), [data, category, stageType]);

  const replaceRow = (row: EnumValue) => setData((current) => current && { ...current, [category]: current[category].map((item) => (item.id === row.id ? row : item)) });
  const fail = (caught: unknown) => setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });

  /** Runs one change against the API, keeps the list in sync, and clears the dropdown cache. */
  async function mutate(id: number | null, action: (token: string) => Promise<void>, done?: string) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return false; }
    setBusyId(id); setNotice(null);
    try { await action(token); invalidateEnumOptions(category); if (done) setNotice({ text: done, tone: "ok" }); return true; }
    catch (caught) { fail(caught); return false; }
    finally { setBusyId(null); }
  }

  const rename = async () => {
    if (!editing) return;
    const row = rows.find((item) => item.id === editing.id);
    const label = editing.label.trim();
    setEditing(null);
    if (!row || !label || label === row.label) return;
    await mutate(row.id, async (token) => replaceRow(await updateEnum(token, category, row.id, { label })), "Saved.");
  };

  const toggle = (row: EnumValue) => {
    if (row.is_active && (row.usage_count ?? 0) > 0) { setConfirm({ row, mode: "deactivate" }); return; }
    void mutate(row.id, async (token) => replaceRow(await updateEnum(token, category, row.id, { is_active: !row.is_active })));
  };

  /** Moves one option to a new place in its list (by drag or arrow keys) and saves the new order. */
  const reorder = async (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= rows.length || from === to) return;
    const shown = [...rows];
    const [moved] = shown.splice(from, 1);
    shown.splice(to, 0, moved);
    const before = data;
    // Put the reordered rows back in the full list; other pipelines keep their places.
    let k = 0;
    setData((current) => current && { ...current, [category]: current[category].map((item) => (inScope(item) ? shown[k++] : item)) });
    const ok = await mutate(null, async (token) => { await reorderEnum(token, category, shown.map((item) => item.id)); });
    if (!ok) setData(before);
  };

  const add = async () => {
    const label = (adding ?? "").trim();
    if (!label) return;
    await mutate(null, async (token) => {
      const row = await createEnum(token, category, label, category === "lead_stage" ? stageType : undefined);
      setData((current) => current && { ...current, [category]: [...current[category].filter((item) => item.id !== row.id), row] });
      setAdding(null);
    }, `${label} added.`);
  };

  const confirmed = async () => {
    if (!confirm) return;
    const { row, mode } = confirm;
    setConfirm(null);
    await mutate(row.id, async (token) => {
      replaceRow(mode === "remove" ? await deleteEnum(token, category, row.id) : await updateEnum(token, category, row.id, { is_active: false }));
    }, mode === "remove" ? `${row.label} removed.` : `${row.label} is now hidden from dropdowns.`);
  };

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!data) return <Spinner />;

  return (
    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
      <nav role="tablist" aria-label="Option category"
        className="-mx-1 flex gap-1 overflow-x-auto rounded-[14px] border border-[#E5E7EA] bg-white px-1 py-2 lg:mx-0 lg:w-[180px] lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-2">
        {ENUM_CATEGORIES.map((item) => {
          const active = item.key === category;
          return (
            <button key={item.key} type="button" role="tab" aria-selected={active}
              onClick={() => { setCategory(item.key); setEditing(null); setAdding(null); setNotice(null); }}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-[10px] px-3 text-left text-[13px] font-semibold transition-colors ${active ? "bg-[#EAF4EF] text-[#0E4D3A]" : "text-[#4B5060] hover:bg-[#F3F3F5]"}`}>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        <Panel title={meta.label} subtitle={undefined}>
          <Toast message={notice?.text ?? ""} tone={notice?.tone} />
          <p className="rounded-lg bg-[#F3F6F4] px-3 py-2 text-[12.5px] text-[#6B7080]">
            {HINTS[category] ?? "Drag the handle or use the arrow keys to reorder. Hidden options leave dropdowns but stay on existing records."}
          </p>

          {category === "lead_stage" && (
            <div role="group" aria-label="Contact type" className="flex flex-wrap gap-1.5">
              {STAGE_TYPES.map((type) => {
                const active = type.key === stageType;
                return (
                  <button key={type.key} type="button" aria-pressed={active} onClick={() => { setStageType(type.key); setEditing(null); }}
                    className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${active ? "border-[#CFE7DB] bg-[#EAF4EF] text-[#0E4D3A]" : "border-[#E5E7EA] bg-white text-[#4B5060] hover:bg-[#F3F3F5]"}`}>
                    {type.label}
                  </button>
                );
              })}
            </div>
          )}

          {rows.length === 0 && adding === null ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <p className="text-[13.5px] font-bold text-[#1A1C21]">No {meta.label.toLowerCase()} yet</p>
              <p className="text-[12.5px] text-[#6B7080]">Add the first one below to get started.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row, index) => {
                const busy = busyId === row.id;
                return (
                  <li key={row.id}
                    draggable={grab === row.id}
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(row.id)); setDragging(row.id); }}
                    onDragOver={(event) => { if (dragging !== null) event.preventDefault(); }}
                    onDrop={(event) => { event.preventDefault(); const from = rows.findIndex((item) => item.id === dragging); setDragging(null); setGrab(null); void reorder(from, index); }}
                    onDragEnd={() => { setDragging(null); setGrab(null); }}
                    className={`flex flex-wrap items-center gap-2.5 rounded-[10px] border border-[#EFEFF2] px-2.5 py-2 ${row.is_active ? "bg-white" : "bg-[#FAFAFB]"} ${dragging === row.id ? "opacity-50" : ""}`}>
                    {category !== "lead_source" && (
                      <button type="button" aria-label={`Reorder ${row.label}, drag or use the arrow keys`} title="Drag to reorder" disabled={busyId !== null}
                        onMouseDown={() => setGrab(row.id)} onMouseUp={() => setGrab(null)}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                          event.preventDefault();
                          void reorder(index, index + (event.key === "ArrowUp" ? -1 : 1));
                        }}
                        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[#C3C7CC] hover:text-[#6B7080] disabled:cursor-default disabled:opacity-30">
                        <Icon className="h-3.5 w-3.5">{icons.grip}</Icon>
                      </button>
                    )}

                    {row.locked && <Icon className="h-3.5 w-3.5 shrink-0 text-[#9AA0AC]">{icons.lock}</Icon>}

                    <input type="text" value={editing?.id === row.id ? editing.label : row.label} maxLength={100} aria-label={`Rename ${row.label}`} title="Click to rename"
                      onFocus={() => setEditing({ id: row.id, label: row.label })}
                      onChange={(event) => setEditing({ id: row.id, label: event.target.value })}
                      onBlur={() => { if (skipSave.current) { skipSave.current = false; setEditing(null); } else void rename(); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") { skipSave.current = true; event.currentTarget.blur(); }
                      }}
                      className={`h-[34px] min-w-0 flex-1 basis-40 rounded-md border border-transparent bg-transparent px-1 text-[13.5px] font-semibold outline-none hover:border-[#E5E7EA] focus:border-[#0E4D3A] focus:bg-white ${row.is_active ? "text-[#1A1C21]" : "text-[#9AA0AC] line-through"}`} />

                    <span className="shrink-0 rounded-full bg-[#F0F0F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#6B7080]">{row.usage_count ? `${row.usage_count} in use` : "Unused"}</span>

                    <button type="button" role="switch" aria-checked={row.is_active} aria-label={`${row.label} active`}
                      disabled={busy || (row.locked && row.is_active)} onClick={() => toggle(row)}
                      title={row.locked && row.is_active ? "The app relies on this option" : row.is_active ? "Shown in dropdowns" : "Hidden from dropdowns"}
                      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${row.is_active ? "bg-[#0E4D3A]" : "bg-[#D5D9DE]"}`}>
                      <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${row.is_active ? "left-[18px]" : "left-[2px]"}`} />
                    </button>

                    <button type="button" aria-label={`Remove ${row.label}`} disabled={busy || row.locked || !row.is_active}
                      title={row.locked ? "The app relies on this option" : !row.is_active ? "Already hidden" : "Remove"}
                      onClick={() => setConfirm({ row, mode: (row.usage_count ?? 0) > 0 ? "deactivate" : "remove" })} className={`${iconButton} h-9 w-9 hover:!text-rose-600`}>
                      <Icon className="h-4 w-4">{icons.trash}</Icon>
                    </button>
                  </li>
                );
              })}

              {adding !== null && (
                <li className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#F7FAF8] px-2.5 py-2">
                  <input autoFocus value={adding} maxLength={100} placeholder={`New ${meta.noun}`} aria-label={`New ${meta.noun} name`} onChange={(event) => setAdding(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void add(); if (event.key === "Escape") setAdding(null); }} className="crm-input min-w-0 flex-1 basis-48" />
                  <button type="button" onClick={() => void add()} disabled={!adding.trim() || busyId !== null} className={accentButton}>Add</button>
                  <button type="button" onClick={() => setAdding(null)} className={secondaryButton}>Cancel</button>
                </li>
              )}
            </ul>
          )}

          {adding === null && (
            <button type="button" onClick={() => setAdding("")}
              className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#DEE1E5] text-[13px] font-semibold text-[#6B7080] hover:bg-gray-50">
              <Icon className="h-3.5 w-3.5">{icons.plus}</Icon> Add option
            </button>
          )}
        </Panel>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[1100] grid place-items-center bg-[rgba(17,18,20,0.45)] p-4 backdrop-blur-[5px]" role="dialog" aria-modal="true" aria-labelledby="enum-confirm-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="enum-confirm-title" className="text-lg font-extrabold text-[#0a192f]">{confirm.mode === "remove" ? `Remove “${confirm.row.label}”?` : `Hide “${confirm.row.label}”?`}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {confirm.mode === "remove"
                ? "Nothing uses it, so it will simply disappear from dropdowns. You can add it again later."
                : `${confirm.row.usage_count} record${confirm.row.usage_count === 1 ? " uses" : "s use"} this value. Hide it instead: it leaves dropdowns, but existing records keep showing it.`}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
              <button type="button" onClick={() => setConfirm(null)} className={secondaryButton}>Cancel</button>
              <button type="button" onClick={() => void confirmed()} className={accentButton}>{confirm.mode === "remove" ? "Remove" : "Hide instead"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
