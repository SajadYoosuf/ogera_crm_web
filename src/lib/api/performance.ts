import { request } from "./auth";

/** Mirrors API.md (GET /performance/summary, /team, /pipeline, /lead-sources). */
export type PerformanceSummary = {
  scope: "team" | "self";
  period: { start: string; end: string };
  total_new_contacts: number;
  total_activities: number;
  deals_won: number;
  deals_lost: number;
  overdue_followups: number;
};

export type TeamRow = {
  user_id: number;
  name: string;
  contacts_assigned: number;
  contacts_added_period: number;
  activities_period: number;
  followups_pending: number;
  followups_overdue: number;
  deals_won_period: number;
};

export type PipelineRow = { stage: string; label: string; count: number };
export type LeadSourceRow = { source: string; count: number; converted: number };

export type DateRange = { start: string; end: string };

const authed = (accessToken: string) => ({ headers: { Authorization: `Bearer ${accessToken}` } });
const rangeQuery = ({ start, end }: DateRange) => new URLSearchParams({ start_date: start, end_date: end });

export const getSummary = (accessToken: string, range: DateRange) =>
  request<PerformanceSummary>(`/performance/summary?${rangeQuery(range)}`, authed(accessToken));

export const getTeam = (accessToken: string, range: DateRange) =>
  request<TeamRow[]>(`/performance/team?${rangeQuery(range)}`, authed(accessToken));

export const getPipeline = (accessToken: string) => request<PipelineRow[]>("/performance/pipeline", authed(accessToken));

export const getLeadSources = (accessToken: string, range: DateRange) =>
  request<LeadSourceRow[]>(`/performance/lead-sources?${rangeQuery(range)}`, authed(accessToken));
