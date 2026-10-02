export interface ExportableSale {
  id: number;
  saleDate?: string;
  buyerName?: string;
  buyerPhone?: string;
  sourceOfSale?: string;
  tankSize?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  panchayath?: string;
  ward?: string;
  waterSource?: string;
  address?: string;
  remarks?: string;
  createdAt?: string | Date;
}

export type ExportFormatMode = "normal" | "whatsapp";

const NORMAL_HEADERS = [
  "Sale Date", "Buyer Name", "Buyer Phone", "Source Of Sale", "Tank Size", "Quantity",
  "Unit Price", "Total Price", "Panchayath", "Ward", "Water Source", "Address", "Remarks", "Created At",
];

const WHATSAPP_HEADERS = ["Name", "Mobile Number", "Source", "Tags"];

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export function exportHeaders(mode: ExportFormatMode) {
  return mode === "whatsapp" ? WHATSAPP_HEADERS : NORMAL_HEADERS;
}

export function exportRows(sales: ExportableSale[], mode: ExportFormatMode): string[][] {
  if (mode === "whatsapp") {
    return sales.map((sale) => [text(sale.buyerName), text(sale.buyerPhone), "ORGANIC", ""]);
  }
  return sales.map((sale) => [
    text(sale.saleDate), text(sale.buyerName), text(sale.buyerPhone), text(sale.sourceOfSale),
    text(sale.tankSize), text(sale.quantity), text(sale.unitPrice), text(sale.totalPrice),
    text(sale.panchayath), text(sale.ward), text(sale.waterSource), text(sale.address), text(sale.remarks),
    sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("en-IN") : "",
  ]);
}

export function exportFileName(mode: ExportFormatMode, extension: string) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `sales${mode === "whatsapp" ? "_whatsapp" : ""}_export_${stamp}.${extension}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function downloadSalesCsv(sales: ExportableSale[], mode: ExportFormatMode) {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [exportHeaders(mode), ...exportRows(sales, mode)].map((row) => row.map(quote).join(","));
  // The BOM keeps Excel from mangling non-ASCII buyer names.
  download(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), exportFileName(mode, "csv"));
}

/** Writes a spreadsheet as an HTML table Excel opens natively, so no export library is needed. */
export function downloadSalesExcel(sales: ExportableSale[], mode: ExportFormatMode) {
  const head = exportHeaders(mode).map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = exportRows(sales, mode)
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />
    <style>table{border-collapse:collapse}th,td{border:1px solid #d0d5dd;padding:4px 8px;mso-number-format:"\\@"}th{background:#eef2ff;font-weight:bold}</style>
    </head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8;" }), exportFileName(mode, "xls"));
}

/**
 * Opens a print-ready ledger in a new tab; the browser print dialog saves it as PDF.
 * Returns false when the popup was blocked so the caller can surface a message.
 */
export function printSalesPdf(sales: ExportableSale[], mode: ExportFormatMode) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const title = mode === "whatsapp" ? "Sales Export (WhatsApp Automation)" : "Sales Ledger Export";
  const head = exportHeaders(mode).map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = exportRows(sales, mode)
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell) || "-"}</td>`).join("")}</tr>`)
    .join("");

  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      @page { size: ${mode === "whatsapp" ? "portrait" : "landscape"}; margin: 12mm; }
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0a192f; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { font-size: 11px; color: #64748b; margin: 0 0 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 10px; }
      th, td { border: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; }
      thead th { background: #0a0a4a; color: #fff; }
      tbody tr:nth-child(even) { background: #eef2ff; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p>Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${sales.length} sales</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
