"use client";

import type { HistoryEvent } from "@/lib/api/leads";
import { ActivityTypeIcon } from "./ActivityIcons";
import { typeLabel } from "./activities";
import { ACTIVITY_TILE, ACTIVITY_TILE_DEFAULT, COLOR, TYPE } from "./designTokens";
import { formatMoment, stageColors } from "./stages";

// Follow-ups store the short channel names older apps used; map them to activity types for labels and icons.
const CHANNEL_TO_TYPE: Record<string, string> = { call: "phone_call", visit: "field_visit" };

const joinDetail = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || undefined;

function describe(event: HistoryEvent): { title: string; detail?: string; icon: string } {
  switch (event.event_type) {
    case "stage":
      return {
        title: event.previous_stage_name ? `${event.previous_stage_name} → ${event.stage_name ?? "Stage"}` : (event.stage_name ?? "Stage set"),
        detail: event.stage_note ?? undefined,
        icon: event.stage_slug ?? "",
      };
    case "activity": {
      const type = event.activity_type ?? "other";
      return {
        title: event.title || typeLabel(type),
        detail: joinDetail([event.outcome, event.notes]),
        icon: type,
      };
    }
    case "followup": {
      const type = event.channel ? (CHANNEL_TO_TYPE[event.channel] ?? event.channel) : "other";
      const state = event.followup_status === "completed" ? "Completed" : "Open";
      return {
        title: `Follow-up: ${event.title || typeLabel(type)}`,
        detail: joinDetail([
          event.due_at ? `Due ${formatMoment(event.due_at)}` : null,
          event.assigned_to_name ? `for ${event.assigned_to_name}` : null,
          state,
        ]),
        icon: type,
      };
    }
    case "followup_rescheduled": {
      const type = event.channel ? (CHANNEL_TO_TYPE[event.channel] ?? event.channel) : "other";
      return {
        title: `Follow-up rescheduled: ${event.title || typeLabel(type)}`,
        detail: joinDetail([
          event.previous_due_at ? `Was ${formatMoment(event.previous_due_at)}` : null,
          event.due_at ? `now ${formatMoment(event.due_at)}` : null,
          "Rescheduled",
        ]),
        icon: type,
      };
    }
    case "assignment":
      return {
        title: `Assigned to ${event.assigned_to_name ?? "someone"}`,
        detail: event.assigned_from_name ? `Moved from ${event.assigned_from_name}` : undefined,
        icon: "",
      };
  }
}

/** Timeline rows for the lead's history: stage moves, follow-ups, logged activities and owner changes. */
export default function HistoryList({ events }: { events: HistoryEvent[] }) {
  return (
    <ul>
      {events.map((event, index) => {
        const { title, detail, icon } = describe(event);
        const badge = event.event_type === "stage"
          ? { bg: stageColors(icon).badgeBg, fg: stageColors(icon).badgeFg }
          : (ACTIVITY_TILE[icon] ?? ACTIVITY_TILE_DEFAULT);
        return (
          <li key={`${event.event_type}-${index}`} className="flex gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: badge.bg, color: badge.fg }}>
              {event.event_type === "stage" || event.event_type === "assignment" ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {event.event_type === "stage" ? <path d="M5 12.5 9.5 17 19 7.5" /> : <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />}
                </svg>
              ) : (
                <ActivityTypeIcon type={icon} className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR.textBody }}>{title}</span>
              {detail && <span style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>{detail}</span>}
              <span style={{ ...TYPE.caption, color: COLOR.textFaint }}>
                {[event.actor_name, formatMoment(event.timestamp)].filter(Boolean).join(" · ")}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
