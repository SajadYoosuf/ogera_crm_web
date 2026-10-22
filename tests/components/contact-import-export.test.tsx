// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactExportModal from "@/features/contacts/components/ContactExportModal";
import ContactImportModal from "@/features/contacts/components/ContactImportModal";
import { analyzeImport, commitImport, problemRowsCsv } from "@/features/contacts/api/contactsIo";
import { ApiError } from "@/lib/api/auth";

// analyzeImport and commitImport use XMLHttpRequest (for upload progress) — mock them so JSDOM
// does not attempt a real network connection and tests stay synchronous-friendly.
vi.mock("@/features/contacts/api/contactsIo", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual, analyzeImport: vi.fn(), commitImport: vi.fn() };
});

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: new Headers() });
const SOURCES = [{ id: 1, name: "Instagram", slug: "instagram" }, { id: 2, name: "Offline", slug: "offline" }];

// Plain JS object backing for sessionStorage — JSDOM drops writes on an opaque origin (no URL set),
// so we stub the global to guarantee token() returns a value inside the component.
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  length: 0,
  key: (_index: number) => null,
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("sessionStorage", mockSessionStorage);
  sessionStorage.setItem("ogera_access_token", "test-token");
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Head", email: "h@o.com", role: "admin" }));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => {
  cleanup();
  Object.keys(store).forEach((k) => delete store[k]);
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.mocked(analyzeImport).mockReset();
  vi.mocked(commitImport).mockReset();
});

describe("ContactExportModal", () => {
  it("shows how many contacts match, then downloads the chosen format with the filters", async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/contacts/export")) return { ok: true, status: 200, blob: async () => new Blob(["x"]), headers: new Headers({ "Content-Disposition": 'attachment; filename="contacts_20261008.pdf"' }) };
      return json({ items: [], total: 42, skip: 0, limit: 1 });
    });
    const onClose = vi.fn();
    render(<ContactExportModal initial={{ contact_type: "partner", created_from: "2026-10-01", created_to: "2026-10-08" }} extraFilterCount={0} leadSources={SOURCES} onClose={onClose} />);

    expect(await screen.findByText("42 contacts will be exported.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/PDF/));
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const exportCall = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes("/contacts/export"))!;
    const query = new URL(exportCall).searchParams;
    expect(query.get("format")).toBe("pdf");
    expect(query.get("contact_type")).toBe("partner");
    expect(query.get("created_from")).toBe("2026-10-01");
    expect(query.get("created_to")).toBe("2026-10-08");
  });

  it("blocks the download when there are more contacts than the format holds", async () => {
    fetchMock.mockResolvedValue(json({ items: [], total: 5000, skip: 0, limit: 1 }));
    render(<ContactExportModal initial={{}} extraFilterCount={0} leadSources={SOURCES} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText(/PDF/));
    expect(await screen.findByText(/PDF holds at most 2,000/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the server's message when the download fails", async () => {
    fetchMock.mockImplementation(async (input: string) =>
      input.includes("/contacts/export") ? json({ detail: "Narrow the filters." }, 400) : json({ items: [], total: 3, skip: 0, limit: 1 }));
    render(<ContactExportModal initial={{}} extraFilterCount={0} leadSources={SOURCES} onClose={vi.fn()} />);
    await screen.findByText("3 contacts will be exported.");
    fireEvent.click(screen.getByRole("button", { name: "Download Excel" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Narrow the filters.");
  });
});

describe("ContactImportModal", () => {
  const report = {
    header_row: 2,
    columns: [{ index: 0, header: "Customer Name", field: "name", sample: ["Asha"] }, { index: 1, header: "Mobile", field: "phone", sample: ["9876543210"] }],
    fields: { name: "Name", phone: "Phone", district: "District" },
    missing_required: [] as string[],
    summary: { total: 3, ready: 1, warning: 0, duplicate: 1, error: 1 },
    rows: [
      { row: 4, status: "error" as const, issues: ["Phone '123' is not a valid number"], raw: ["Ravi", "123"], name: "Ravi", phone: null },
      { row: 5, status: "duplicate" as const, issues: ["Phone already in the CRM"], raw: ["Joy", "9447000111"], name: "Joy", phone: "+919447000111" },
    ],
  };

  // The component fetches the employee list on mount for the "Assign to" dropdown.
  const mockEmployeeFetch = () =>
    fetchMock.mockImplementation(async (input: unknown) =>
      String(input).includes("/employees") ? json({ items: [], total: 0, skip: 0, limit: 100 }) : json({}, 404));

  it("analyzes the file, advances to step 2, imports and reports the result", async () => {
    vi.mocked(analyzeImport).mockResolvedValue(report);
    vi.mocked(commitImport).mockResolvedValue({ created: 1, updated: 0, skipped: 2 });
    mockEmployeeFetch();
    const onImported = vi.fn();
    render(<ContactImportModal leadSources={SOURCES} onClose={vi.fn()} onImported={onImported} />);

    const file = new File(["Customer Name,Mobile\nAsha,9876543210"], "leads.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose a file to import"), { target: { files: [file] } });

    // analyzeImport resolves → Continue button becomes enabled
    await waitFor(() => expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 2: problem rows listed
    expect(await screen.findByText("Phone '123' is not a valid number")).toBeTruthy();
    // ready(1) + warning(0) = 1 importable row with default "skip" duplicate rule
    fireEvent.click(screen.getByRole("button", { name: "Import 1 contact" }));

    // Step 3: success message
    expect(await screen.findByText("1 contact added")).toBeTruthy();
    expect(onImported).toHaveBeenCalled();
    expect(vi.mocked(commitImport)).toHaveBeenCalledWith(
      "test-token",
      expect.any(File),
      expect.objectContaining({ duplicates: "skip" }),
    );
  });

  it("asks which column holds the phone when it could not be found and keeps Import disabled", async () => {
    vi.mocked(analyzeImport).mockResolvedValue({
      ...report,
      missing_required: ["phone"],
      columns: [report.columns[0]],
      summary: { total: 1, ready: 0, warning: 0, duplicate: 0, error: 1 },
    });
    mockEmployeeFetch();
    render(<ContactImportModal leadSources={SOURCES} onClose={vi.fn()} onImported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Choose a file to import"), { target: { files: [new File(["x"], "a.csv")] } });

    await waitFor(() => expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Alert in step 2 names the missing field
    expect((await screen.findByRole("alert")).textContent).toContain("Pick which column holds the Phone");
    // Import button exists in step 2 but stays disabled (missing_required not satisfied)
    expect((screen.getByRole("button", { name: /^Import/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the server's message when the analyze call fails", async () => {
    // Must use .csv — .pdf is rejected client-side before calling the API
    vi.mocked(analyzeImport).mockRejectedValue(new ApiError("unknown" as never, "Upload a .csv or .xlsx file"));
    mockEmployeeFetch();
    render(<ContactImportModal leadSources={SOURCES} onClose={vi.fn()} onImported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Choose a file to import"), { target: { files: [new File(["x"], "a.csv")] } });

    expect((await screen.findByRole("alert")).textContent).toContain("Upload a .csv or .xlsx file");
  });
});

describe("problemRowsCsv", () => {
  it("lists the reason first and leaves out rows that were imported with a fix", async () => {
    const blob = problemRowsCsv([
      { row: 4, status: "error", issues: ["Phone is missing", "District is missing"], raw: ["Ravi", ""], name: "Ravi", phone: null },
      { row: 6, status: "warning", issues: ["District is missing"], raw: ["Joy", "9447000111"], name: "Joy", phone: "+919447000111" },
    ]);
    const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(text).toContain('"4","Phone is missing; District is missing","Ravi",""');
    expect(text).not.toContain("Joy");
  });
});
