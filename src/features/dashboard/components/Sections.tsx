"use client";

/** Cards shared by the dashboard views. Each takes the summary and shows one part of it. */

import Link from "next/link";
import { useState } from "react";
import type { ContactKind, DashboardSummary, TeamRow } from "../api/dashboard";
import { agoText, shortDay } from "../format";
import { Card, Empty } from "./Card";
import { BarList, ColumnChart, SERIES_GREEN, SERIES_VIOLET } from "./Charts";
import { RecentList } from "./Lists";

const KIND_LABELS: Record<ContactKind, string> = { consumer: "Consumers", partner: "Partners", dealer: "Dealers" };
const rangeText = (data: DashboardSummary) =>
  data.period.date_from === data.period.date_to ? shortDay(data.period.date_from) : `${shortDay(data.period.date_from)} – ${shortDay(data.period.date_to)}`;

export function TrendCard({ data }: { data: DashboardSummary }) {
  const weekly = data.leads.trend_days_per_point > 1;
  return (
    <Card title="Leads created and converted" hint={weekly ? "By week, starting on the date shown" : "By day"}>
      <ColumnChart
        title="Leads created and converted"
        empty="No leads were created or converted in these dates."
        series={[{ key: "created", label: "Created", color: SERIES_GREEN }, { key: "converted", label: "Converted", color: SERIES_VIOLET }]}
        points={data.leads.trend.map((p) => ({ label: shortDay(p.date), values: { created: p.created, converted: p.converted } }))}
      />
    </Card>
  );
}

export function StatusCard({ data, title = "Leads by status" }: { data: DashboardSummary; title?: string }) {
  return (
    <Card title={title} hint="All leads as they stand now" action={{ label: "Open leads", href: "/dashboard/leads" }}>
      <BarList empty="No leads yet." items={data.leads.by_status.map((s) => ({ key: s.slug, label: s.name, count: s.count }))} />
    </Card>
  );
}

export function SourcesCard({ data }: { data: DashboardSummary }) {
  const rows = data.leads.by_source;
  return (
    <Card title="Lead sources" hint={`Leads created ${rangeText(data)}, and how many of them converted`}>
      {rows.length === 0 ? <Empty>No leads were created in these dates.</Empty> : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-left text-xs text-[#8A8F9C]">
              <th scope="col" className="w-[40%] pb-2 font-medium">Source</th>
              <th scope="col" className="w-[17%] pb-2 text-right font-medium">Leads</th>
              <th scope="col" className="w-[27%] pb-2 text-right font-medium">Converted</th>
              <th scope="col" className="w-[16%] pb-2 text-right font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.source_id ?? s.name} className="border-t border-[#EFEFF2] tabular-nums">
                <th scope="row" className="truncate py-2 text-left font-medium text-[#1A1C21]">{s.name}</th>
                <td className="py-2 text-right">{s.count}</td>
                <td className="py-2 text-right">{s.converted}</td>
                <td className="py-2 text-right">{Math.round((s.converted / s.count) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function ActivityCard({ data }: { data: DashboardSummary }) {
  return (
    <Card title="Activities by type" hint={`Logged ${rangeText(data)}`}>
      <BarList empty="No activities were logged in these dates." items={data.activity.by_type.map((t) => ({ key: t.type, label: t.label, count: t.count }))} />
    </Card>
  );
}

export function OutcomeCard({ data }: { data: DashboardSummary }) {
  const o = data.activity.by_outcome;
  return (
    <Card title="Activity outcomes" hint={`All activities logged ${rangeText(data)}`}>
      <BarList
        empty="No activities were logged in these dates."
        items={[
          { key: "done", label: "Done", count: o.done },
          { key: "not_now", label: "Not now", count: o.not_now },
          { key: "no_answer", label: "No answer", count: o.no_answer },
          { key: "none", label: "No outcome given", count: o.none },
        ]}
      />
    </Card>
  );
}

export function CallsByDayCard({ data }: { data: DashboardSummary }) {
  return (
    <Card title="Calls logged" hint={data.leads.trend_days_per_point > 1 ? "By week" : "By day"}>
      <ColumnChart
        title="Calls logged"
        empty="No calls were logged in these dates."
        series={[{ key: "calls", label: "Calls", color: SERIES_GREEN }]}
        points={data.activity.by_day.map((p) => ({ label: shortDay(p.date), values: { calls: p.calls } }))}
      />
    </Card>
  );
}

export function PipelineCard({ data, title }: { data: DashboardSummary; title: string }) {
  const pipelines = data.contacts.pipelines;
  const [kind, setKind] = useState<ContactKind>(() => pipelines.find((p) => p.total > 0)?.type ?? "consumer");
  const current = pipelines.find((p) => p.type === kind) ?? pipelines[0];
  return (
    <Card title={title} hint="Where each contact is now" action={{ label: "Open pipeline", href: "/dashboard/pipeline" }}>
      <div role="group" aria-label="Contact type" className="mb-3 grid grid-cols-3 gap-1.5">
        {pipelines.map((p) => (
          <button
            key={p.type}
            type="button"
            aria-pressed={p.type === current.type}
            onClick={() => setKind(p.type)}
            className={`h-11 rounded-lg border px-1 !text-xs !font-semibold sm:h-9 ${p.type === current.type ? "border-[#0E7A4F] bg-[#0E7A4F]/[0.08] text-[#0E4D3A]" : "border-[#DEE1E5] text-[#4B5060] hover:bg-[#F7F7F9]"}`}
          >
            {KIND_LABELS[p.type]} ({p.total})
          </button>
        ))}
      </div>
      <BarList
        empty={`No ${KIND_LABELS[current.type].toLowerCase()} yet.`}
        items={[
          ...(current.no_stage ? [{ key: "none", label: "No stage", count: current.no_stage }] : []),
          ...current.stages.map((s) => ({ key: String(s.id), label: s.name, count: s.count })),
        ]}
      />
      {current.unassigned !== null && current.unassigned > 0 && (
        <p className="mt-3 text-xs font-semibold text-[#9A5B00]">{current.unassigned} not assigned to anyone</p>
      )}
    </Card>
  );
}

export function LossReasonsCard({ data }: { data: DashboardSummary }) {
  return (
    <Card title="Lost or inactive contacts" hint={`By reason, moved ${rangeText(data)}`}>
      <BarList empty="No contacts were lost in these dates." items={data.contacts.loss_reasons.map((r) => ({ key: r.reason, label: r.label, count: r.count }))} />
    </Card>
  );
}

export function WhatsAppCard({ data }: { data: DashboardSummary }) {
  if (!data.whatsapp) return null;
  const { unread_conversations: unread, unread_items: items, sent_in_period: sent } = data.whatsapp;
  return (
    <Card title="WhatsApp" hint={`${unread} unread conversation${unread === 1 ? "" : "s"} · ${sent} sent ${rangeText(data)}`} action={{ label: "Open inbox", href: "/dashboard/whatsapp-inbox" }}>
      {items.length === 0 ? <Empty>No unread messages.</Empty> : (
        <ul aria-label="Unread conversations">
          {items.map((c) => (
            <li key={c.lead_id} className="border-t border-[#EFEFF2] first:border-t-0">
              <Link href={`/dashboard/whatsapp-inbox?lead=${c.lead_id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-[#0E7A4F]">
                <span className="truncate font-semibold">{c.name}</span>
                <span className="shrink-0 text-xs text-[#6B7080]">{c.unread} unread · {agoText(c.last_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const SETUP_STATUS: Record<string, string> = { connected: "Connected", disconnected: "Not connected", not_configured: "Not set up" };

export function WhatsAppSetupCard({ data }: { data: DashboardSummary }) {
  if (!data.whatsapp_setup) return null;
  const { status, templates } = data.whatsapp_setup;
  const entries = Object.entries(templates);
  const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replaceAll("_", " ");
  return (
    <Card title="WhatsApp setup" hint="Visible to admins" action={{ label: "Open settings", href: "/dashboard/settings" }}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7080]">Connection</dt>
          <dd className={`font-semibold ${status === "connected" ? "text-[#17703F]" : "text-[#9A5B00]"}`}>{SETUP_STATUS[status] ?? sentence(status)}</dd>
        </div>
        {entries.length === 0 ? (
          <div className="flex justify-between gap-3"><dt className="text-[#6B7080]">Message templates</dt><dd className="font-semibold">None</dd></div>
        ) : entries.map(([key, count]) => (
          <div key={key} className="flex justify-between gap-3"><dt className="text-[#6B7080]">Templates: {sentence(key)}</dt><dd className="font-semibold">{count}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

export function RecentCard({ data, title = "Recent updates" }: { data: DashboardSummary; title?: string }) {
  return <Card title={title}><RecentList items={data.recent} /></Card>;
}

const TEAM_COLUMNS: { key: keyof TeamRow; label: string }[] = [
  { key: "open_leads", label: "Open leads" },
  { key: "calls", label: "Calls" },
  { key: "activities", label: "Activities" },
  { key: "followups_completed", label: "Follow-ups done" },
  { key: "overdue", label: "Overdue" },
  { key: "converted", label: "Converted" },
];

/** One group of staff: a table on wide screens, cards on phones, so nothing scrolls sideways. */
function TeamGroup({ title, rows, onPick }: { title: string; rows: TeamRow[]; onPick: (employeeId: number) => void }) {
  const nameButton = (member: TeamRow) => (
    <button type="button" onClick={() => onPick(member.employee_id)} className="min-h-11 text-left !font-semibold text-[#1A1C21] hover:text-[#0E7A4F] hover:underline lg:min-h-0" aria-label={`Show only ${member.name}`}>
      {member.name}
    </button>
  );
  const value = (member: TeamRow, key: keyof TeamRow) => (
    <span className={key === "overdue" && member.overdue > 0 ? "font-bold text-[#B42323]" : ""}>{member[key]}</span>
  );
  return (
    <Card title={title} hint="Open leads and overdue are as of now; the rest cover the chosen dates">
      <table className="hidden w-full text-sm lg:table">
        <thead>
          <tr className="text-xs text-[#8A8F9C]">
            <th scope="col" className="pb-2 text-left font-medium">Employee</th>
            {TEAM_COLUMNS.map((c) => <th key={c.key} scope="col" className="pb-2 text-right font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr key={member.employee_id} className="border-t border-[#EFEFF2] tabular-nums">
              <th scope="row" className="py-2 text-left font-normal">{nameButton(member)}</th>
              {TEAM_COLUMNS.map((c) => <td key={c.key} className="py-2 text-right">{value(member, c.key)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-2 lg:hidden">
        {rows.map((member) => (
          <li key={member.employee_id} className="rounded-lg border border-[#EFEFF2] p-3">
            <p className="text-sm">{nameButton(member)} <span className="text-xs text-[#8A8F9C]">{member.role_name}</span></p>
            <dl className="mt-1 grid grid-cols-3 gap-2 text-xs">
              {TEAM_COLUMNS.map((c) => (
                <div key={c.key}><dt className="text-[#8A8F9C]">{c.label}</dt><dd className="text-sm font-semibold tabular-nums">{value(member, c.key)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TeamSection({ team, onPick }: { team: TeamRow[]; onPick: (employeeId: number) => void }) {
  if (team.length === 0) return <Card title="Team"><Empty>No staff accounts yet.</Empty></Card>;
  const groups = [
    { title: "Telecallers", rows: team.filter((m) => m.role === "tele_caller") },
    { title: "Sales executives", rows: team.filter((m) => m.role === "sales_executive") },
    { title: "Other staff", rows: team.filter((m) => m.role !== "tele_caller" && m.role !== "sales_executive") },
  ].filter((g) => g.rows.length > 0);
  return <>{groups.map((g) => <TeamGroup key={g.title} title={g.title} rows={g.rows} onPick={onPick} />)}</>;
}
