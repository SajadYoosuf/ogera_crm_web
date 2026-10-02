"use client";

import { FormEvent, useState } from "react";
import { errorMessage, ghostButtonClass, inputClass, primaryButtonClass, requestJson, type Stage } from "./shared";

interface ManageStagesDialogProps {
  stages: Stage[];
  onClose: () => void;
  onStagesChanged: () => Promise<void> | void;
}

export default function ManageStagesDialog({ stages, onClose, onStagesChanged }: ManageStagesDialogProps) {
  const [newStageName, setNewStageName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setIsSaving(true);
    setFormError("");
    try {
      await action();
      await onStagesChanged();
      return true;
    } catch (caught) {
      setFormError(errorMessage(caught));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newStageName.trim();
    if (!label) return;
    const done = await run(() => requestJson("/api/followups/stages", { method: "POST", body: JSON.stringify({ label }) }));
    if (done) setNewStageName("");
  }

  async function renameStage(id: string) {
    const label = editingLabel.trim();
    if (!label) return;
    const done = await run(() => requestJson("/api/followups/stages", { method: "PUT", body: JSON.stringify({ id, label }) }));
    if (done) setEditingId(null);
  }

  /** Reordering swaps the two neighbouring order indexes, so the board stays gap-free. */
  async function moveStage(index: number, direction: -1 | 1) {
    const current = stages[index];
    const target = stages[index + direction];
    if (!current || !target) return;
    await run(async () => {
      await requestJson("/api/followups/stages", { method: "PUT", body: JSON.stringify({ id: current.id, orderIndex: target.orderIndex }) });
      await requestJson("/api/followups/stages", { method: "PUT", body: JSON.stringify({ id: target.id, orderIndex: current.orderIndex }) });
    });
  }

  async function deleteStage() {
    if (!deleteTarget) return;
    const done = await run(() => requestJson(`/api/followups/stages?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" }));
    if (done) setDeleteTarget(null);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
      <section className="w-full max-w-lg bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="stages-title">
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div>
            <h2 id="stages-title" className="text-lg font-bold text-[#0a192f]">Manage follow-up stages</h2>
            <p className="text-sm text-gray-500 mt-0.5">Rename, reorder, or remove the columns on the follow-up board.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <form onSubmit={addStage} className="flex gap-2.5">
            <input
              value={newStageName}
              onChange={(event) => setNewStageName(event.target.value)}
              placeholder="New stage name"
              disabled={isSaving}
              className={inputClass}
            />
            <button type="submit" disabled={isSaving || !newStageName.trim()} className={`${primaryButtonClass} shrink-0`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add
            </button>
          </form>

          {formError && <p role="alert" className="px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{formError}</p>}

          <ul className="space-y-2">
            {stages.map((stage, index) => (
              <li key={stage.id} className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                {editingId === stage.id ? (
                  <>
                    <input value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} autoFocus className={`${inputClass} h-9`} />
                    <button type="button" disabled={isSaving || !editingLabel.trim()} onClick={() => void renameStage(stage.id)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-900">{stage.label}</span>
                    <button type="button" disabled={index === 0 || isSaving} onClick={() => void moveStage(index, -1)} aria-label={`Move ${stage.label} earlier`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-30 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
                    </button>
                    <button type="button" disabled={index === stages.length - 1 || isSaving} onClick={() => void moveStage(index, 1)} aria-label={`Move ${stage.label} later`} className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-30 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></svg>
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => { setEditingId(stage.id); setEditingLabel(stage.label); }} aria-label={`Rename ${stage.label}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => { setFormError(""); setDeleteTarget(stage); }} aria-label={`Delete ${stage.label}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </>
                )}
              </li>
            ))}
            {stages.length === 0 && <li className="py-6 text-center text-sm text-gray-500">No stages yet. Add the first one above.</li>}
          </ul>
        </div>

        <footer className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className={ghostButtonClass}>Done</button>
        </footer>
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-stage-title">
            <div className="px-6 pt-6">
              <h2 id="delete-stage-title" className="text-lg font-bold text-[#0a192f]">Delete this stage?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Leads sitting in <strong className="text-gray-900">{deleteTarget.label}</strong> move to the first remaining stage. This cannot be undone.
              </p>
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isSaving} onClick={() => setDeleteTarget(null)} className={ghostButtonClass}>Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => void deleteStage()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">
                {isSaving ? "Deleting…" : "Delete stage"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
