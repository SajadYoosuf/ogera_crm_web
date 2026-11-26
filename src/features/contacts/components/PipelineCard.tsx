"use client";

import type { PipelineContact } from "@/features/contacts/api/contacts";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

const AVATAR_TONES = [
  "bg-[#E7F5EE] text-[#0E4D3A]",
  "bg-[#E0F2FE] text-[#0B6AA8]",
  "bg-[#DCFCE7] text-[#167A44]",
  "bg-[#FEF3C7] text-[#9A6200]",
  "bg-[#FCE7F3] text-[#A8326E]",
];

interface Props {
  contact: PipelineContact;
  onClick?: () => void;
}

export default function PipelineCard({ contact, onClick }: Props) {
  const initial = (contact.name || contact.phone).charAt(0).toUpperCase();
  const tone = AVATAR_TONES[contact.id % AVATAR_TONES.length];
  const addedDate = DATE_FORMAT.format(new Date(contact.created_at));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-[#9ED8B8] hover:shadow-md transition-all duration-150"
    >
      <div className="flex items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tone}`}>
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1A1C21] leading-tight">{contact.name}</p>
          <p className="text-xs text-[#6B7080]">{contact.phone}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-[#9BA3B4]">{contact.district || "—"}</span>
        {contact.assigned_to && (
          <span className="text-xs text-[#6B7080] truncate max-w-[90px]" title={contact.assigned_to.name}>
            {contact.assigned_to.name.split(" ")[0]}
          </span>
        )}
      </div>

      <div className="mt-1.5 text-[11px] text-[#C4C9D4]">{addedDate}</div>
    </div>
  );
}
