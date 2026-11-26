"use client";

export type PipelineTab = "consumer" | "partner" | "dealer";

interface Props {
  active: PipelineTab;
  onChange: (tab: PipelineTab) => void;
}

const TABS: { value: PipelineTab; label: string }[] = [
  { value: "consumer", label: "Consumer" },
  { value: "partner", label: "Partner" },
  { value: "dealer", label: "Dealer" },
];

export default function PipelineTabBar({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? "bg-white text-[#0E4D3A] shadow-sm"
                : "text-[#6B7080] hover:text-[#1A1C21]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
