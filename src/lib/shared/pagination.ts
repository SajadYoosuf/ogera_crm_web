/**
 * Builds the page-number list shown in every table's footer.
 *
 * WHY: five pages use the same logic copy-pasted. One function here means
 * one fix fixes every table.
 *
 * Returns numbers and "…" gap markers so the caller can render them.
 * Example for page 6 of 20: [1, "…", 5, 6, 7, "…", 20]
 */
export function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "…", pages];
  if (page >= pages - 3) return [1, "…", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "…", page - 1, page, page + 1, "…", pages];
}
