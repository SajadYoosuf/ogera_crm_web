/**
 * WhatsApp inbox API — the cross-lead conversation list behind the sidebar page.
 * Messages of one conversation use the per-lead calls in features/leads/api/leadSettings.
 */

import { apiCall } from "@/lib/api/auth";

export type ConversationSummary = {
  lead_id: number;
  lead_name: string;
  phone: string | null;
  status: string;
  last_message: {
    body: string | null;
    direction: "in" | "out";
    content_type: string;
    template_name: string | null;
    created_at: string;
  };
  unread_count: number;
  assigned_to: number | null;
  assigned_name: string | null;
};

export type ConversationPage = { items: ConversationSummary[]; total: number; page: number; page_size: number };

export const listInboxConversations = (token: string, search = "", page = 1): Promise<ConversationPage> => {
  const query = new URLSearchParams({ page: String(page) });
  if (search.trim()) query.set("search", search.trim());
  return apiCall<ConversationPage>(token, "GET", `/whatsapp-inbox/conversations?${query.toString()}`);
};

export const getInboxUnreadCount = (token: string): Promise<{ count: number }> =>
  apiCall<{ count: number }>(token, "GET", "/whatsapp-inbox/unread-count");

export const markConversationRead = (token: string, leadId: number): Promise<{ ok: boolean }> =>
  apiCall<{ ok: boolean }>(token, "POST", `/whatsapp-inbox/conversations/${leadId}/mark-read`);

/** Admin/manager only. */
export const assignConversation = (token: string, leadId: number, employeeId: number): Promise<{ ok: boolean }> =>
  apiCall<{ ok: boolean }>(token, "POST", `/whatsapp-inbox/conversations/${leadId}/assign`, { employee_id: employeeId });

/** Fired after the user reads a conversation so the sidebar badge refreshes at once. */
export const INBOX_UNREAD_EVENT = "ogera-wa-unread-change";
