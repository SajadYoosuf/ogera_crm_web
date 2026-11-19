/**
 * Shared display-formatting helpers used across multiple features.
 *
 * WHY: formatDate, rupees, and initials were copy-pasted in sales, products,
 * and employees pages. Centralising them makes the UI consistent everywhere.
 */

/** Formats an ISO date string (YYYY-MM-DD) for Indian locale display, e.g. "5 Jan 2025". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

/** Formats a rupee amount with Indian grouping, e.g. "₹1,23,456.00". Null → "—". */
export function formatRupees(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Returns today's date as an ISO string in Asia/Kolkata timezone (YYYY-MM-DD). */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Up to two initials from a full name, e.g. "Sajad Yoosuf" → "SY". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
