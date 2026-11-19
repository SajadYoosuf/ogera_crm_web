/**
 * CSV export helpers shared across features (sales, expenses, contacts).
 *
 * WHY: each page that needs a CSV download was copy-pasting the same
 * cell-escaping logic. One place means one fix if the format ever changes.
 */

/** Wraps a value in double-quotes and escapes any double-quotes inside it. */
export function toCsvCell(value: string | null | undefined): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV string from a header row and data rows, then triggers a
 * browser download.
 *
 * @param filename - e.g. "sales-2025-01-01.csv"
 * @param header   - column labels
 * @param rows     - each row is an array of values in header order
 */
export function downloadCsv(filename: string, header: string[], rows: (string | null | undefined)[][]): void {
  const csv = [header, ...rows]
    .map((line) => line.map(toCsvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
