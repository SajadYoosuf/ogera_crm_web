/**
 * LeadSourceBadge — icon + label showing where a lead came from.
 * Uses source_name (string from lead_sources.name) instead of an enum.
 */

const COLOR: Record<string, string> = {
  "Website":     "text-indigo-600",
  "WhatsApp":    "text-green-600",
  "Meta Ads":    "text-blue-600",
  "Walk-in":     "text-gray-500",
  "Referral":    "text-purple-600",
  "JustDial":    "text-orange-600",
  "GMB":         "text-red-600",
  "Field Visit": "text-teal-600",
};

function SourceIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower === "whatsapp") {
    return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (lower === "website") {
    return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (lower === "meta ads") {
    return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    );
  }
  // walk-in / referral / justdial / gmb / field visit / unknown — pencil icon
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  );
}

export default function LeadSourceBadge({ sourceName }: { sourceName: string | null }) {
  const name = sourceName ?? "Unknown";
  const color = COLOR[name] ?? "text-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <SourceIcon name={name} />
      {name}
    </span>
  );
}
