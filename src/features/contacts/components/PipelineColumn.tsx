"use client";

import PipelineCard from "./PipelineCard";
import type { PipelineContact, PipelineStageItem } from "@/features/contacts/api/contacts";

interface Props {
  stage: PipelineStageItem;
  contacts: PipelineContact[];
  onCardClick?: (contact: PipelineContact) => void;
}

const TERMINAL_SLUGS = new Set(["won", "lost", "inactive", "inactive_dealer"]);

export default function PipelineColumn({ stage, contacts, onCardClick }: Props) {
  const isTerminal = TERMINAL_SLUGS.has(stage.slug);

  return (
    <div className="flex w-[220px] shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${isTerminal ? "bg-gray-100" : "bg-white border border-gray-200"}`}>
        <span className="text-sm font-semibold text-[#1A1C21] truncate">{stage.label}</span>
        <span className={`ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
          contacts.length > 0
            ? "bg-[#E7F5EE] text-[#0E4D3A]"
            : "bg-gray-100 text-[#9BA3B4]"
        }`}>
          {contacts.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto pb-4">
        {contacts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-[#C4C9D4]">
            No contacts
          </div>
        ) : (
          contacts.map((c) => (
            <PipelineCard key={c.id} contact={c} onClick={() => onCardClick?.(c)} />
          ))
        )}
      </div>
    </div>
  );
}
