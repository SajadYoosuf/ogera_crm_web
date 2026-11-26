"use client";

/**
 * One layout per view. Each is a single column on a phone, in the order the person works: what is due first,
 * then who to act on, then the remaining numbers and charts.
 */

import Link from "next/link";
import type { DashboardSummary, QueueItem } from "../api/dashboard";
import { agoText, percent } from "../format";
import { Card, Empty, Tiles, type Tile } from "./Card";
import { FollowupQueue, LeadList, type LogTarget } from "./Lists";
import {
  ActivityCard, CallsByDayCard, LossReasonsCard, OutcomeCard, PipelineCard, RecentCard, SourcesCard,
  StatusCard, TeamSection, TrendCard, WhatsAppCard, WhatsAppSetupCard,
} from "./Sections";

export type ViewProps = {
  data: DashboardSummary;
  canComplete: (item: QueueItem) => boolean;
  onLog: (target: LogTarget) => void;
  onComplete: (item: QueueItem) => void;
  onPickEmployee: (employeeId: number) => void;
};

const two = "grid gap-4 xl:grid-cols-2";

function followupTiles(data: DashboardSummary): Tile[] {
  return [
    { label: "Overdue follow-ups", value: data.followups.overdue, tone: "danger", href: "#queue", hint: "Past their due time" },
    { label: "Due today", value: data.followups.today, tone: "warning", href: "#queue", hint: "Open, due before midnight" },
  ];
}

const conversionHint = (data: DashboardSummary) =>
  data.leads.new_in_period
    ? `${data.leads.cohort_converted} of ${data.leads.new_in_period} new leads (${percent(data.leads.conversion_rate)})`
    : "No new leads in these dates";

function Queue({ title, showAssignee, ...props }: ViewProps & { title: string; showAssignee: boolean }) {
  const { followups } = props.data;
  return (
    <Card id="queue" title={title} hint="Lead and contact follow-ups, oldest first" action={{ label: "Open tasks", href: "/dashboard/tasks" }}>
      <FollowupQueue items={followups.queue} total={followups.due_total} showAssignee={showAssignee} canComplete={props.canComplete} onLog={props.onLog} onComplete={props.onComplete} />
    </Card>
  );
}

function Uncontacted({ data, onLog }: ViewProps) {
  return (
    <Card id="uncontacted" title="Not contacted yet" hint="Open leads with no logged activity, oldest first">
      <LeadList
        label="Leads not contacted yet" empty="Every open lead has been contacted."
        items={data.leads.uncontacted_items} total={data.leads.uncontacted} onLog={onLog}
        detail={(lead) => `${lead.source_name ?? "Unknown source"} · added ${agoText(lead.created_at)}`}
      />
    </Card>
  );
}

function NewlyAssigned({ data, onLog }: ViewProps) {
  return (
    <Card id="assigned" title="Newly assigned to you" hint="Leads that reached you in the chosen dates">
      <LeadList
        label="Newly assigned leads" empty="No leads were assigned to you in these dates."
        items={data.newly_assigned ?? []} onLog={onLog}
        detail={(lead) => `${lead.source_name ?? "Unknown source"} · ${lead.assigned_at ? agoText(lead.assigned_at) : ""}`}
      />
    </Card>
  );
}

function NeedsAction({ data, onLog }: ViewProps) {
  const { needs_action: total, needs_action_items: items } = data.contacts;
  return (
    <Card id="needs-action" title="Contacts needing action" hint="No stage, or no activity for 7 days" action={{ label: "Open contacts", href: "/dashboard/contacts" }}>
      {items.length === 0 ? <Empty>Every contact has a stage and recent activity.</Empty> : (
        <ul aria-label="Contacts needing action">
          {items.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between gap-3 border-t border-[#EFEFF2] py-2 first:border-t-0">
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-[#1A1C21]">{contact.name}</p>
                <p className="truncate text-xs capitalize text-[#6B7080]">{contact.type} · {contact.stage ?? "No stage"}</p>
              </div>
              <button type="button" onClick={() => onLog({ entityType: "contact", entityId: contact.id, name: contact.name })}
                className="h-11 shrink-0 rounded-lg border border-[#DEE1E5] px-3 !text-xs !font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] sm:h-9" aria-label={`Log activity for ${contact.name}`}>
                Log
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && <p className="mt-3 text-xs text-[#6B7080]">Showing the oldest {items.length} of {total}.</p>}
    </Card>
  );
}

export function HeadView(props: ViewProps) {
  const { data } = props;
  const { unassigned_leads: unassigned, qualified_with_telecaller: waiting } = data;
  return (
    <>
      <Tiles label="Key numbers" items={[
        { label: "New leads", value: data.leads.new_in_period, href: "/dashboard/leads", hint: "Created in these dates" },
        unassigned
          ? { label: "Unassigned leads", value: unassigned.count, tone: "warning", href: "#unassigned", hint: "Open, with nobody on them" }
          : { label: "Open leads", value: data.leads.open, href: "/dashboard/leads", hint: "As of now" },
        { label: "Not contacted", value: data.leads.uncontacted, tone: "warning", href: "#uncontacted", hint: "Open, no activity logged" },
        ...followupTiles(data),
        { label: "Converted", value: data.leads.converted_in_period, hint: conversionHint(data) },
      ]} />
      <div className={two}>
        <Queue {...props} title="Follow-ups needing attention" showAssignee />
        <div className="flex min-w-0 flex-col gap-4">
          {unassigned && (
            <Card id="unassigned" title="Unassigned leads" hint="Open the lead to assign it">
              <LeadList label="Unassigned leads" empty="Every open lead is assigned." items={unassigned.items} total={unassigned.count}
                detail={(lead) => `${lead.source_name ?? "Unknown source"} · added ${agoText(lead.created_at)}`} />
            </Card>
          )}
          {waiting && waiting.count > 0 && (
            <Card title="Qualified, still with a telecaller" hint={`${waiting.count} ready to hand to sales`}>
              <LeadList label="Qualified leads with a telecaller" empty="" items={waiting.items} total={waiting.count}
                detail={(lead) => `With ${lead.assigned_to_name ?? "an employee"}`} />
            </Card>
          )}
        </div>
      </div>
      <div className={two}><TrendCard data={data} /><StatusCard data={data} /></div>
      <div className={two}><SourcesCard data={data} /><WhatsAppCard data={data} /></div>
      <TeamSection team={data.team ?? []} onPick={props.onPickEmployee} />
      <div className={two}><PipelineCard data={data} title="Contact pipelines" /><LossReasonsCard data={data} /></div>
      <div className={two}><Uncontacted {...props} /><NeedsAction {...props} /></div>
      <div className={two}><ActivityCard data={data} /><OutcomeCard data={data} /></div>
      <div className={two}><RecentCard data={data} title="Recent activity" /><WhatsAppSetupCard data={data} /></div>
    </>
  );
}

export function TelecallerView(props: ViewProps) {
  const { data } = props;
  const qualified = data.leads.by_status.find((s) => s.slug === "pre_qualified")?.count ?? 0;
  const { calls, calls_answered: answered, calls_with_outcome: counted } = data.activity;
  return (
    <>
      <Tiles label="To do" items={[
        ...followupTiles(data),
        { label: "Not contacted", value: data.leads.uncontacted, tone: "warning", href: "#uncontacted", hint: "Call these next" },
      ]} />
      <div className={two}><Queue {...props} title="Call queue" showAssignee={false} /><Uncontacted {...props} /></div>
      <Tiles label="My results" items={[
        { label: "Calls logged", value: calls, hint: "In these dates" },
        { label: "Connect rate", value: percent(data.activity.connect_rate), hint: counted ? `${answered} answered of ${counted} calls with an outcome` : "No call has an outcome yet" },
        { label: "Pre-qualified", value: qualified, hint: "My leads, as of now" },
        { label: "Converted", value: data.leads.converted_in_period, hint: "Converted by me" },
      ]} />
      <div className={two}><OutcomeCard data={data} /><CallsByDayCard data={data} /></div>
      <div className={two}><StatusCard data={data} title="My leads by status" /><SourcesCard data={data} /></div>
      <div className={two}><NewlyAssigned {...props} /><WhatsAppCard data={data} /></div>
      <RecentCard data={data} />
    </>
  );
}

export function SalesView(props: ViewProps) {
  const { data } = props;
  return (
    <>
      <Tiles label="To do" items={[
        ...followupTiles(data),
        { label: "Contacts needing action", value: data.contacts.needs_action, tone: "warning", href: "#needs-action", hint: "No stage or quiet for 7 days" },
      ]} />
      <div className={two}><Queue {...props} title="Today's agenda" showAssignee={false} /><NewlyAssigned {...props} /></div>
      <Tiles label="My results" items={[
        { label: "Open leads", value: data.leads.open, href: "/dashboard/leads", hint: "As of now" },
        { label: "Converted", value: data.leads.converted_in_period, hint: "Converted by me" },
        { label: "My contacts", value: data.contacts.total, href: "/dashboard/contacts", hint: "Assigned to me" },
        { label: "Follow-ups done", value: data.followups.completed_in_period, href: "/dashboard/tasks?tab=completed", hint: "In these dates" },
      ]} />
      <div className={two}><PipelineCard data={data} title="My pipeline" /><NeedsAction {...props} /></div>
      <div className={two}><Uncontacted {...props} /><StatusCard data={data} title="My leads by status" /></div>
      <div className={two}><TrendCard data={data} /><LossReasonsCard data={data} /></div>
      <div className={two}><ActivityCard data={data} /><OutcomeCard data={data} /></div>
      <div className={two}><WhatsAppCard data={data} /><RecentCard data={data} /></div>
    </>
  );
}

/** Every other role: what is due and what changed. */
export function StaffView(props: ViewProps) {
  const { data } = props;
  return (
    <>
      <Tiles label="To do" items={[
        ...followupTiles(data),
        { label: "Upcoming", value: data.followups.upcoming, href: "/dashboard/tasks?tab=upcoming", hint: "Due after today" },
        { label: "Open leads", value: data.leads.open, href: "/dashboard/leads", hint: "Assigned to me" },
      ]} />
      <div className={two}><Queue {...props} title="My follow-ups" showAssignee={false} /><StatusCard data={data} title="My leads by status" /></div>
      <RecentCard data={data} />
      <p className="text-center text-xs text-[#8A8F9C]">
        <Link href="/dashboard/tasks" className="font-semibold text-[#0E7A4F] hover:underline">See all my tasks</Link>
      </p>
    </>
  );
}
