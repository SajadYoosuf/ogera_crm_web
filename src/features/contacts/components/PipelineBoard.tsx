"use client";

import PipelineColumn from "./PipelineColumn";
import type { PipelineContact, PipelineStageItem } from "@/features/contacts/api/contacts";

interface Props {
  stages: PipelineStageItem[];
  contacts: PipelineContact[];
  onCardClick?: (contact: PipelineContact) => void;
}

export default function PipelineBoard({ stages, contacts, onCardClick }: Props) {
  const byStage = new Map<number, PipelineContact[]>();
  for (const stage of stages) byStage.set(stage.id, []);

  // Contacts with no stage land in a virtual "Unassigned" bucket (stage_id absent/null).
  const unassigned: PipelineContact[] = [];
  for (const c of contacts) {
    const stageId = c.lead_stage?.stage_id;
    if (stageId !== undefined && stageId !== null && byStage.has(stageId)) {
      byStage.get(stageId)!.push(c);
    } else {
      unassigned.push(c);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
      {unassigned.length > 0 && (
        <PipelineColumn
          stage={{ id: 0, slug: "_unassigned", label: "No Stage", order_index: -1, contact_type: "" }}
          contacts={unassigned}
          onCardClick={onCardClick}
        />
      )}
      {stages.map((stage) => (
        <PipelineColumn
          key={stage.id}
          stage={stage}
          contacts={byStage.get(stage.id) ?? []}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
