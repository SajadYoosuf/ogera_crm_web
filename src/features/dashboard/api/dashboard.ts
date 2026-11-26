/**
 * Dashboard API — GET /dashboard/summary.
 *
 * The server picks the view and the scope from the signed-in role: admin and manager see everyone (or one
 * employee with `assignedTo`), every other role sees only their own work. The web only renders what it gets.
 */

import { apiCall } from "@/lib/api/auth";
import type { Interaction } from "@/lib/api/interactions";

export type DashboardView = "head" | "sales" | "telecaller" | "staff";
export type DashboardPeriodKey = "today" | "7d" | "30d" | "custom";
export type ContactKind = "consumer" | "partner" | "dealer";

/** An open follow-up that is overdue or due today, on a lead or a contact. */
export type QueueItem = Interaction & { name: string; phone: string | null; overdue: boolean; due_at: string };

export type LeadItem = {
  id: number;
  name: string;
  phone: string | null;
  status: string;
  source_name: string | null;
  assigned_to_name: string | null;
  created_at: string;
  assigned_at?: string;
};

export type CountedLeads = { count: number; items: LeadItem[] };

export type TeamRow = {
  employee_id: number;
  name: string;
  role: string;
  role_name: string;
  open_leads: number;
  activities: number;
  calls: number;
  followups_completed: number;
  overdue: number;
  converted: number;
};

export type Pipeline = {
  type: ContactKind;
  total: number;
  /** Null when the numbers cover one employee. */
  unassigned: number | null;
  no_stage: number;
  stages: { id: number; name: string; count: number }[];
};

export type RecentUpdate = {
  id: number;
  entity_type: "lead" | "contact";
  entity_id: number;
  name: string;
  label: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
};

export type DashboardSummary = {
  view: DashboardView;
  period: { key: DashboardPeriodKey; date_from: string; date_to: string };
  employee_id: number | null;
  followups: {
    overdue: number;
    today: number;
    upcoming: number;
    completed_in_period: number;
    /** Follow-ups that are overdue or due today; `queue` holds the oldest of them. */
    due_total: number;
    queue: QueueItem[];
  };
  leads: {
    open: number;
    new_in_period: number;
    converted_in_period: number;
    cohort_converted: number;
    conversion_rate: number | null;
    by_status: { slug: string; name: string; count: number }[];
    by_source: { source_id: number | null; name: string; count: number; converted: number }[];
    trend: { date: string; created: number; converted: number }[];
    trend_days_per_point: number;
    uncontacted: number;
    uncontacted_items: LeadItem[];
  };
  activity: {
    total: number;
    calls: number;
    calls_with_outcome: number;
    calls_answered: number;
    connect_rate: number | null;
    by_type: { type: string; label: string; count: number }[];
    by_outcome: { done: number; not_now: number; no_answer: number; none: number };
    by_day: { date: string; total: number; calls: number }[];
  };
  contacts: {
    total: number;
    pipelines: Pipeline[];
    needs_action: number;
    needs_action_items: { id: number; name: string; phone: string | null; type: ContactKind; stage: string | null }[];
    loss_reasons: { reason: string; label: string; count: number }[];
  };
  recent: RecentUpdate[];
  unassigned_leads: CountedLeads | null;
  qualified_with_telecaller: CountedLeads | null;
  newly_assigned: LeadItem[] | null;
  team: TeamRow[] | null;
  employees: { id: number; name: string; role: string }[] | null;
  /** Null when the company has no WhatsApp tables yet. */
  whatsapp: {
    unread_conversations: number;
    unread_items: { lead_id: number; name: string; unread: number; last_at: string }[];
    sent_in_period: number;
  } | null;
  /** Admin only. */
  whatsapp_setup: { status: string; templates: Record<string, number> } | null;
};

export type DashboardQuery = {
  period: DashboardPeriodKey;
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: number | null;
};

export function getDashboardSummary(token: string, query: DashboardQuery): Promise<DashboardSummary> {
  const params = new URLSearchParams({ period: query.period });
  if (query.period === "custom") {
    params.set("date_from", query.dateFrom ?? "");
    params.set("date_to", query.dateTo ?? "");
  }
  if (query.assignedTo) params.set("assigned_to", String(query.assignedTo));
  return apiCall<DashboardSummary>(token, "GET", `/dashboard/summary?${params.toString()}`);
}
