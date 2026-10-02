"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type StaffRow = { id: number; name: string; leads: number; awareness: number; total: number };
type Report = {
  range: { startDate: string; endDate: string };
  totals: { leads: number; awareness: number };
  unattributed: { leads: number; awareness: number };
  staff: StaffRow[];
};
type Selected = { id: number | "unattributed"; name: string };
type Preset = "all" | "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

function ymd(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function presetRange(preset: Exclude<Preset, "custom">) {
  const end = new Date();
  const start = new Date();
  if (preset === "all") start.setFullYear(2000, 0, 1);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return { start: ymd(start), end: ymd(end) };
}

export default function PerformancePage() {
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("ogera_user"),
    () => null,
  );
  const isHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  const canView = useMemo(() => {
    if (!storedUser) return false;
    try {
      const role = (JSON.parse(storedUser) as { role?: string }).role;
      return role === "admin" || role === "sales_head";
    } catch {
      return false;
    }
  }, [storedUser]);

  const [preset, setPreset] = useState<Preset>("all");
  const [range, setRange] = useState(() => presetRange("all"));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  const load = useCallback(async (start: string, end: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("ogera_access_token");
      const response = await fetch(`/api/performance?startDate=${start}&endDate=${end}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load performance");
      setReport(body.data as Report);
    } catch (caught) {
      if ((caught as Error).name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Unable to load performance");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView || !range.start || !range.end || range.start > range.end) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-range-change; load() owns the loading state
    void load(range.start, range.end, controller.signal);
    return () => controller.abort();
  }, [canView, range, load]);

  if (!isHydrated) return null;

  if (!canView) {
    return (
      <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <h2 className="text-base font-bold text-[#0a192f]">Restricted area</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Performance is available to admins and sales heads only.</p>
        </div>
      </div>
    );
  }

  const staff = report?.staff ?? [];
  const max = Math.max(1, ...staff.map((member) => member.total));
  const rangeInvalid = range.start > range.end;

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <div>
        <h1 className="text-xl font-bold text-[#0a192f]">Performance</h1>
        <p className="mt-1 text-sm text-gray-500">Leads and awareness records added by each staff member.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setPreset(item.key);
              if (item.key !== "custom") {
                const next = presetRange(item.key);
                setRange(next);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              preset === item.key ? "bg-[#0a192f] text-white border-[#0a192f]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={range.start}
              max={range.end}
              onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {rangeInvalid && <p className="text-sm text-red-600">Start date must not be after end date.</p>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading && !report ? (
        <LoadingBlock text="Loading performance…" />
      ) : (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Leads added" value={report?.totals.leads} loading={loading && !report} />
        <SummaryCard label="Awareness added" value={report?.totals.awareness} loading={loading && !report} />
        <SummaryCard label="Staff" value={report ? staff.length : undefined} loading={loading && !report} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Awareness</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 min-w-[180px]">Share</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60" : ""}>
              {staff.map((member, index) => (
                <tr
                  key={member.id}
                  onClick={() => setSelected({ id: member.id, name: member.name })}
                  className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-[#0a192f]">{member.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{member.leads}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{member.awareness}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{member.total}</td>
                  <td className="px-4 py-3">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="bg-[#0a192f]" style={{ width: `${(member.leads / max) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(member.awareness / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {report && (report.unattributed.leads > 0 || report.unattributed.awareness > 0) && (
                <tr
                  onClick={() => setSelected({ id: "unattributed", name: "Unattributed" })}
                  className="border-t border-gray-100 bg-gray-50/60 text-gray-500 cursor-pointer hover:bg-gray-100"
                >
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 italic">Unattributed (older records with no creator)</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.unattributed.leads}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.unattributed.awareness}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.unattributed.leads + report.unattributed.awareness}</td>
                  <td className="px-4 py-3" />
                </tr>
              )}
              {!loading && report && staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No staff activity in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0a192f]" /> Leads</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Awareness</span>
        </div>
      </div>
        </>
      )}
      {selected && (
        <StaffContactsDrawer key={String(selected.id)} selected={selected} range={range} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

type ContactItem = {
  id: number;
  name?: string;
  phone: string;
  contactType: "lead" | "awareness";
  source?: string;
  district?: string;
  panchayath?: string;
  createdAt: string;
};
type TypeFilter = "all" | "lead" | "awareness";
const PAGE_SIZE = 20;

function StaffContactsDrawer({ selected, range, onClose }: { selected: Selected; range: { start: string; end: string }; onClose: () => void }) {
  const [type, setType] = useState<TypeFilter>("all");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem("ogera_access_token");
    const params = new URLSearchParams({
      addedBy: String(selected.id),
      startDate: range.start,
      endDate: range.end,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (type !== "all") params.set("type", type);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter/page change
    setLoading(true);
    fetch(`/api/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load contacts");
        setContacts((current) => (page === 1 ? body.data.contacts : [...current, ...body.data.contacts]));
        setTotalPages(body.data.totalPages);
        setTotal(body.data.total);
        setError(null);
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Unable to load contacts");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected.id, range.start, range.end, type, page]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changeType = (next: TypeFilter) => {
    setType(next);
    setPage(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-base font-bold text-[#0a192f]">{selected.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{loading && page === 1 ? "Loading…" : `${total} contact${total === 1 ? "" : "s"} added`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex gap-2 border-b border-gray-100 px-5 py-3">
          {(["all", "lead", "awareness"] as TypeFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeType(item)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                type === item ? "bg-[#0a192f] text-white border-[#0a192f]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {item === "all" ? "All" : item === "lead" ? "Leads" : "Awareness"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && page === 1 && <LoadingBlock text="Loading contacts…" />}
          {error && <p className="m-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!loading && !error && contacts.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No contacts in this range.</p>}
          <ul className={`divide-y divide-gray-100 ${loading && page === 1 ? "hidden" : ""}`}>
            {contacts.map((contact) => (
              <li key={contact.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-[#0a192f]">{contact.name || contact.phone}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${contact.contactType === "lead" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                    {contact.contactType === "lead" ? "Lead" : "Awareness"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[contact.name ? contact.phone : null, [contact.panchayath, contact.district].filter(Boolean).join(", ") || null, contact.source].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">{new Date(contact.createdAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
          {page < totalPages && (
            <div className="p-4 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#0a192f]" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0a192f] tabular-nums">{loading ? "…" : (value ?? 0)}</p>
    </div>
  );
}
