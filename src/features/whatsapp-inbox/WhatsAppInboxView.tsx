"use client";

/**
 * WhatsAppInboxView — the sidebar WhatsApp page.
 *
 * Three panels: conversation list | message thread | lead info. On phones only one
 * panel shows at a time (list, then thread, with a Back button).
 * Polls the list every 30 s while the tab is visible. ?lead={id} pre-selects a
 * conversation (used by the notification bell).
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import {
  INBOX_UNREAD_EVENT,
  listInboxConversations,
  type ConversationSummary,
} from "./api";
import ConversationList from "./ConversationList";
import LeadInfoPanel from "./LeadInfoPanel";
import MessageThread from "./MessageThread";

const POLL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 300;

export default function WhatsAppInboxView() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const linked = Number(searchParams.get("lead"));

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(Number.isInteger(linked) && linked > 0 ? linked : null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const page = await listInboxConversations(token, query);
      setConversations(page.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    const first = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  // A message was read or sent: refresh the list and tell the sidebar badge.
  const refreshAll = useCallback(() => {
    void load();
    window.dispatchEvent(new Event(INBOX_UNREAD_EVENT));
  }, [load]);

  function select(leadId: number) {
    setSelectedId(leadId);
    setConversations((cur) => cur.map((c) => (c.lead_id === leadId ? { ...c, unread_count: 0 } : c)));
  }

  const selected = conversations.find((c) => c.lead_id === selectedId) ?? null;

  return (
    <div className="flex h-dvh min-h-0 flex-col pt-16 lg:pt-0">
      <header className="flex shrink-0 items-center gap-3 border-b border-[#EFEFF2] bg-white px-4 py-3">
        {selectedId !== null && (
          <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to conversations"
            className="rounded-lg border border-[#DEE1E5] px-2.5 py-1 text-sm font-semibold text-[#4B5060] lg:hidden">
            ← Back
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-[#1A1C21]">
            {selectedId !== null ? (selected?.lead_name ?? "Conversation") : "WhatsApp"}
          </h1>
          {selected?.phone && <p className="truncate text-xs text-[#6B7080]">{selected.phone}</p>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className={`${selectedId !== null ? "hidden lg:flex" : "flex"} w-full min-h-0 flex-col border-r border-[#EFEFF2] lg:w-[320px] lg:shrink-0`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={select}
            search={search}
            onSearchChange={setSearch}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        </section>

        <section className={`${selectedId === null ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-1 flex-col`}>
          {selectedId === null ? (
            <div className="flex flex-1 items-center justify-center bg-[#EFEAE2] p-6">
              <p className="max-w-[260px] rounded-lg bg-white/80 px-4 py-3 text-center text-sm text-gray-600">
                Select a conversation to read and reply.
              </p>
            </div>
          ) : (
            <MessageThread key={selectedId} leadId={selectedId} hasPhone={selected ? !!selected.phone : true} onRead={refreshAll} onSent={refreshAll} />
          )}
        </section>

        {selectedId !== null && (
          <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-[#EFEFF2] bg-white xl:block">
            <LeadInfoPanel key={selectedId} leadId={selectedId} onAssigned={refreshAll} />
          </aside>
        )}
      </div>
    </div>
  );
}
