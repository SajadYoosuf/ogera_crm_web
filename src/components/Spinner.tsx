"use client";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizes: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export default function Spinner({
  size = "md",
  className = "",
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-[#0E4D3A]/20 border-t-[#0E4D3A] ${sizes[size]} ${className}`}
    />
  );
}

/** Centred spinner row for panel / modal body areas. */
export function SpinnerRow({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-2 py-6 ${className}`}>
      <Spinner size="sm" />
      <span className="text-sm text-[#8A8F9C]">{label}</span>
    </div>
  );
}

/** Skeleton shimmer lines — for when we know the shape of the content. */
export function SkeletonLines({
  lines = 4,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse space-y-2.5 ${className}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-md bg-[#ECECF0]"
          style={{ width: `${70 + (i % 3) * 10}%` }}
        />
      ))}
    </div>
  );
}
