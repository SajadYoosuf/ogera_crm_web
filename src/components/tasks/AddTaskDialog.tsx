"use client";

// Beginner note: a task is always attached to a lead (a contact), so "Add New" works in two steps.
// Step 1 ("pick"): search leads and choose one. Step 2 ("schedule"): the existing FollowupScheduleForm
// creates the task for that lead. Both steps reuse existing API helpers; nothing is written here directly.

import { useEffect, useState } from "react";
import ModalShell from "@/components/followups/ModalShell";
import FollowupScheduleForm from "@/components/followups/FollowupScheduleForm";
import { BUTTON_SECONDARY } from "@/components/followups/designTokens";
import { listContacts, type ApiContact } from "@/features/contacts/api/contacts";

type Props = {
  staff: { id: number; name: string }[];
  onCancel: () => void;
  onSaved: (leadName: string) => Promise<void>;
};

export default function AddTaskDialog({ staff, onCancel, onSaved }: Props) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // the debounced search sent to the server
  const [results, setResults] = useState<ApiContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<ApiContact | null>(null);

  // Wait a short pause after typing before searching, so we don't send a request on every key press.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Load leads whenever the debounced search changes. A stale response is ignored.
  useEffect(() => {
    if (picked) return;
    let active = true;
    // Deferred like the Tasks board does, so the state updates run after the effect body.
    const timer = window.setTimeout(async () => {
      const accessToken = sessionStorage.getItem("ogera_access_token");
      if (!accessToken) { if (active) setError("Sign in again to continue."); return; }
      if (active) { setIsSearching(true); setError(""); }
      try {
        const res = await listContacts(accessToken, { search: query || undefined, limit: 20 });
        if (active) setResults(res.items);
      } catch {
        if (active) setError("Leads could not be loaded. Please try again.");
      } finally {
        if (active) setIsSearching(false);
      }
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, picked]);

  if (picked) {
    return (
      <FollowupScheduleForm
        contactId={picked.id}
        contactName={picked.name}
        staff={staff}
        defaultAssignee={picked.assigned_to?.id ?? null}
        onCancel={onCancel}
        onSaved={() => onSaved(picked.name)}
      />
    );
  }

  return (
    <ModalShell
      title="Add Task"
      subtitle="Choose the lead this task is for"
      onClose={onCancel}
      onSubmit={(event) => event.preventDefault()}
      footer={<button type="button" onClick={onCancel} style={BUTTON_SECONDARY}>Cancel</button>}
    >
      <div className="space-y-3 px-6 py-5">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, phone or district"
          aria-label="Search leads"
          className="h-10 w-full rounded-lg border border-[#DEE1E5] px-3 text-sm focus:border-[#0E7A4F] focus:outline-none"
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {isSearching && <p className="text-sm text-gray-500">Loading leads…</p>}
        {!isSearching && !error && results.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">No leads found.</p>
        )}
        <ul className="max-h-[360px] divide-y divide-[#EFEFF2] overflow-y-auto">
          {results.map((lead) => (
            <li key={lead.id}>
              <button type="button" onClick={() => setPicked(lead)} className="flex w-full flex-col items-start px-2 py-2.5 text-left hover:bg-[#F3F3F5]">
                <span className="text-sm font-semibold text-[#1A1C21]">{lead.name}</span>
                <span className="text-xs text-gray-500">{lead.phone} · {lead.district}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
}
