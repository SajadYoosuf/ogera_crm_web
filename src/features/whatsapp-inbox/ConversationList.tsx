"use client";

/** ConversationList — the left panel: search box plus one row per WhatsApp conversation. */

import { timeAgo } from "@/features/notifications/NotificationBell";
import type { ConversationSummary } from "./api";
import Spinner from "@/components/Spinner";

function preview(c: ConversationSummary): string {
  const m = c.last_message;
  if (m.content_type === "template") return `Template: ${m.template_name ?? ""}`;
  const body = m.body ?? `[${m.content_type}]`;
  return m.direction === "out" ? `You: ${body}` : body;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  loading,
  error,
  onRetry,
}: {
  conversations: ConversationSummary[];
  selectedId: number | null;
  onSelect: (leadId: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-[#EFEFF2] p-3">
        <input
          type="search"
          aria-label="Search conversations"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or phone"
          className="h-9 w-full rounded-lg border border-[#DEE1E5] px-3 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 p-4">
            <Spinner size="sm" /><span className="text-sm text-gray-500">Loading conversations…</span>
          </div>
        )}
        {error && (
          <div role="alert" className="p-4 text-center text-sm text-red-600">
            {error}
            <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Retry</button>
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">
            {search.trim() ? "No conversations match your search." : "No WhatsApp conversations yet."}
          </p>
        )}
        <ul>
          {conversations.map((c) => {
            const active = c.lead_id === selectedId;
            return (
              <li key={c.lead_id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.lead_id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-3 border-b border-[#F3F3F5] px-3 py-3 text-left transition-colors ${active ? "bg-[#EAF6F0]" : "hover:bg-[#F8F8FA]"}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-sm font-bold text-white">
                    {c.lead_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread_count > 0 ? "font-bold" : "font-semibold"} text-[#1A1C21]`}>{c.lead_name}</span>
                      <span className="shrink-0 text-[11px] text-[#6B7080]">{timeAgo(c.last_message.created_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${c.unread_count > 0 ? "text-[#1A1C21]" : "text-[#6B7080]"}`}>{preview(c)}</span>
                      {c.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-white">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </span>
                    {c.assigned_name && <span className="mt-0.5 block truncate text-[11px] text-[#6B7080]">Assigned: {c.assigned_name}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
