import { request } from "./auth";

/** GET /dashboard/summary. Mirrors ogera_crm_backend/routes/dashboard.py. */
export type DashboardRange = "today" | "7d" | "30d" | "month" | "all";

export type DashboardKpi = { value: number; previous: number | null; change: number | null };

export type DashboardSummary = {
  range: DashboardRange;
  range_label: string;
  today: string; // IST calendar day, YYYY-MM-DD
  start: string | null;
  end: string | null;
  previous_start: string | null;
  previous_end: string | null;
  kpis: {
    total_contacts: number;
    new_leads: DashboardKpi;
    open_followups: { value: number; overdue: number };
    won: DashboardKpi;
  };
  stages: { slug: string; name: string; count: number }[];
  followups: DashboardFollowup[];
  followups_total: number;
  recent_leads: DashboardLead[];
};

export type DashboardFollowup = {
  id: number;
  title: string | null;
  due_at: string;
  overdue_days: number;
  contact_id: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_type: string | null;
  assigned_to_name: string | null;
};

export type DashboardLead = {
  id: number;
  name: string | null;
  phone: string;
  contact_type: string;
  stage_slug: string | null;
  stage_name: string | null;
  owner_name: string | null;
  created_at: string;
};

export function getDashboardSummary(accessToken: string, range: DashboardRange) {
  const params = new URLSearchParams({ range });
  return request<DashboardSummary>(`/dashboard/summary?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}
