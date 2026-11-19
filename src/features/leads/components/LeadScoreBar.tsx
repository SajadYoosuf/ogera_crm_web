/**
 * LeadScoreBar — compact visual indicator of lead quality (0–100).
 *
 * HOW SCORE WORKS:
 *   The backend computes a 0–100 integer based on source, presence of
 *   contact info (phone, email), and whether a WhatsApp reply was sent.
 *   Higher = more likely to convert.
 *
 *   0–39  → red (cold lead)
 *   40–69 → yellow (warm)
 *   70+   → green (hot)
 */

type Props = { score: number; showNumber?: boolean };

function barColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

export default function LeadScoreBar({ score, showNumber = true }: Props) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="relative h-1.5 w-14 overflow-hidden rounded-full bg-gray-200"
        title={`Lead score: ${clamped}/100`}
        aria-label={`Lead score ${clamped} out of 100`}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${barColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </span>
      {showNumber && (
        <span className="text-xs tabular-nums text-gray-500">{clamped}</span>
      )}
    </span>
  );
}
