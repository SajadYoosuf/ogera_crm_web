"use client";

import Link from "next/link";
import { useState } from "react";
import { agoText, dueText, whatsAppUrl } from "../format";
import type { LeadItem, QueueItem, RecentUpdate } from "../api/dashboard";
import { Empty } from "./Card";

/** Who an activity is being logged against. */
export type LogTarget = { entityType: "lead" | "contact"; entityId: number; name: string };

/**
 * At least 44px high so they can be tapped on a phone, and sharing the row's width there. The type size is
 * marked important because globals.css gives every button the surrounding font.
 */
const shape = "inline-flex h-11 flex-1 items-center justify-center rounded-lg px-1 !text-xs !font-semibold sm:h-9 sm:flex-none sm:px-3";
const action = `${shape} border border-[#DEE1E5] bg-white text-[#3A3E4A] hover:bg-[#F3F3F5]`;
const primary = `${shape} bg-[#0E7A4F] text-white hover:bg-[#0E4D3A]`;
/** How many follow-ups show before "Show more". */
const QUEUE_PREVIEW = 8;

export const recordHref = (entityType: "lead" | "contact", id: number) =>
  entityType === "lead" ? `/dashboard/leads?lead=${id}` : "/dashboard/contacts";

function RowActions({ name, phone, onLog, onComplete }: { name: string; phone: string | null; onLog: () => void; onComplete?: () => void }) {
  return (
    <div className="flex w-full gap-1.5 sm:w-auto sm:shrink-0">
      {onComplete && <button type="button" className={primary} onClick={onComplete} aria-label={`Complete follow-up for ${name}`}>Complete</button>}
      {phone && <a className={action} href={`tel:${phone}`} aria-label={`Call ${name}`}>Call</a>}
      {phone && <a className={action} href={whatsAppUrl(phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`}>WhatsApp</a>}
      <button type="button" className={action} onClick={onLog} aria-label={`Log activity for ${name}`}>Log</button>
    </div>
  );
}

const row = "flex flex-col gap-2 border-t border-[#EFEFF2] py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between";

function Name({ href, children }: { href: string; children: string }) {
  return <Link href={href} className="font-semibold text-[#1A1C21] hover:text-[#0E7A4F] hover:underline">{children}</Link>;
}

/** Overdue and today's follow-ups, oldest first. */
export function FollowupQueue({ items, total, showAssignee, canComplete, onLog, onComplete }: {
  items: QueueItem[]; total: number; showAssignee: boolean;
  canComplete: (item: QueueItem) => boolean; onLog: (target: LogTarget) => void; onComplete: (item: QueueItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <Empty>No follow-ups are overdue or due today.</Empty>;
  const shown = expanded ? items : items.slice(0, QUEUE_PREVIEW);
  return (
    <>
      <ul aria-label="Follow-ups to do">
        {shown.map((item) => (
          <li key={item.id} className={row}>
            <div className="min-w-0 text-sm sm:flex-1">
              <p className="truncate"><Name href={recordHref(item.entity_type, item.entity_id)}>{item.name}</Name></p>
              <p className="truncate text-xs text-[#6B7080]">
                {item.title ?? "Follow-up"} · {item.entity_type === "lead" ? "Lead" : "Contact"}
                {showAssignee && ` · ${item.assigned_to_name ?? "Unassigned"}`}
              </p>
              <p className={`text-xs font-semibold ${item.overdue ? "text-[#B42323]" : "text-[#9A5B00]"}`}>{dueText(item.due_at)}</p>
            </div>
            <RowActions
              name={item.name}
              phone={item.phone}
              onLog={() => onLog({ entityType: item.entity_type, entityId: item.entity_id, name: item.name })}
              onComplete={canComplete(item) ? () => onComplete(item) : undefined}
            />
          </li>
        ))}
      </ul>
      {items.length > QUEUE_PREVIEW && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
          className="mt-3 h-11 w-full rounded-lg border border-[#DEE1E5] !text-xs !font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] sm:h-9">
          {expanded ? "Show fewer" : `Show ${items.length - QUEUE_PREVIEW} more`}
        </button>
      )}
      {total > items.length && <p className="mt-3 text-xs text-[#6B7080]">The oldest {items.length} of {total} are listed here.</p>}
    </>
  );
}

/** A short list of leads. With `onLog` each row can be called, messaged and logged; without it, only opened. */
export function LeadList({ items, total, empty, label, detail, onLog }: {
  items: LeadItem[]; total?: number; empty: string; label: string;
  detail: (lead: LeadItem) => string; onLog?: (target: LogTarget) => void;
}) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      <ul aria-label={label}>
        {items.map((lead) => (
          <li key={lead.id} className={row}>
            <div className="min-w-0 text-sm sm:flex-1">
              <p className="truncate"><Name href={recordHref("lead", lead.id)}>{lead.name}</Name></p>
              <p className="truncate text-xs text-[#6B7080]">{detail(lead)}</p>
            </div>
            {onLog
              ? <RowActions name={lead.name} phone={lead.phone} onLog={() => onLog({ entityType: "lead", entityId: lead.id, name: lead.name })} />
              // The wrapper keeps flex-1 sharing the width; straight in the stacked row it would squash the height.
              : <div className="flex w-full sm:w-auto sm:shrink-0"><Link href={recordHref("lead", lead.id)} className={action} aria-label={`Open ${lead.name}`}>Open</Link></div>}
          </li>
        ))}
      </ul>
      {total !== undefined && total > items.length && <p className="mt-3 text-xs text-[#6B7080]">Showing the oldest {items.length} of {total}.</p>}
    </>
  );
}

export function RecentList({ items }: { items: RecentUpdate[] }) {
  if (items.length === 0) return <Empty>No changes yet.</Empty>;
  return (
    <ul aria-label="Recent updates">
      {items.map((update) => (
        <li key={update.id} className="flex items-start justify-between gap-3 border-t border-[#EFEFF2] py-2.5 text-sm first:border-t-0 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate"><Name href={recordHref(update.entity_type, update.entity_id)}>{update.name}</Name></p>
            <p className="truncate text-xs text-[#6B7080]">
              {update.label}{update.detail ? `: ${update.detail}` : ""} · {update.actor_name ?? "Automatic"}
            </p>
          </div>
          <span className="shrink-0 text-[11.5px] text-[#8A8F9C]">{agoText(update.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
