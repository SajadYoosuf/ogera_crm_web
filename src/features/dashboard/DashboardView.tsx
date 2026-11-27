"use client";

/**
 * DashboardView — /dashboard. The server decides which of the four views the person gets and whose numbers
 * it holds; this page picks the dates (and, for admin and manager, one employee) and opens the activity and
 * follow-up forms the other pages already use.
 */

import { useEffect, useState, type ReactNode } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { istToday, shiftDate } from "@/components/DatePicker";
import NavbarUserSection from "@/components/NavbarUserSection";
import { SkeletonLines } from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import ContactActivityLogModal from "@/features/contacts/components/ContactActivityLogModal";
import LeadActivityLogModal from "@/features/leads/components/LeadActivityLogModal";
import { TASKS_CHANGED_EVENT } from "@/features/tasks/hooks/useLeadTasks";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ApiError } from "@/lib/api/auth";
import { isLeadHead } from "@/lib/shared/roles";
import type { DashboardPeriodKey, DashboardView as ViewKey, QueueItem } from "./api/dashboard";
import CompleteDialog from "./components/CompleteDialog";
import type { LogTarget } from "./components/Lists";
import { HeadView, SalesView, StaffView, TelecallerView, type ViewProps } from "./components/Views";
import { useDashboard } from "./hooks/useDashboard";

const TITLES: Record<ViewKey, string> = {
  head: "Team overview",
  sales: "Your sales today",
  telecaller: "Your calls today",
  staff: "Your work today",
};
const VIEWS: Record<ViewKey, (props: ViewProps) => ReactNode> = {
  head: HeadView, sales: SalesView, telecaller: TelecallerView, staff: StaffView,
};
const select = "!min-h-11 !w-auto min-w-0 flex-1 sm:!min-h-[38px] sm:flex-none";

export default function DashboardView() {
  const { user } = useAuth();
  const head = isLeadHead(user);
  const [period, setPeriod] = useState<DashboardPeriodKey>("30d");
  const [range, setRange] = useState({ from: "", to: "" });
  const [employee, setEmployee] = useState<number | null>(null);
  const [logging, setLogging] = useState<LogTarget | null>(null);
  const [completing, setCompleting] = useState<QueueItem | null>(null);

  const { data, isLoading, error, reload } = useDashboard({
    period, dateFrom: range.from, dateTo: range.to, assignedTo: head ? employee : null,
  });

  const online = useOnlineStatus();
  // 401 → SESSION_EXPIRED_EVENT → AuthProvider.clearSession → DashboardAuthGate redirects to /?expired=1.
  // No manual clearSession + router.push here — that races with the gate and skips the banner.
  const canRetry = !(error instanceof ApiError) || error.retryable;

  useEffect(() => {
    const refresh = () => { void reload(); };
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [reload]);

  const today = istToday();
  const View = data ? VIEWS[data.view] : null;

  function saved() {
    setLogging(null);
    setCompleting(null);
    window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
    void reload();
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F4FBF7]">
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#E7E7EA] bg-white pl-16 pr-3 sm:gap-4 sm:pr-7 lg:pl-7">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">Dashboard</h1>
          <p className="truncate text-xs text-[#8A8F9C]">{data ? TITLES[data.view] : "Loading"}</p>
        </div>
        <NavbarUserSection />
      </header>

      <div className="min-w-0 space-y-4 p-4 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <select aria-label="Dates" className={select} value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriodKey)}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom dates</option>
          </select>
          {period === "custom" && (
            <DateRangePicker
              label="Range" from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })}
              className="w-full sm:w-72" clearable={false} defaultOpen={!range.from} emptyLabel="Choose dates"
              presets={[
                { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
                { label: "Last 90 days", from: shiftDate(today, -89), to: today },
              ]}
            />
          )}
          {head && (
            <select aria-label="Employee" className={select} value={employee ?? ""} onChange={(e) => setEmployee(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All employees</option>
              {data?.employees?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => void reload()} disabled={isLoading}
            className="h-11 rounded-lg border border-[#DEE1E5] bg-white px-3 !text-sm !font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:opacity-60 sm:h-[38px]">
            {isLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {!online && (
          <p role="status" className="rounded-[14px] border border-[#F4D9A6] bg-[#FFF7E6] px-4 py-3 text-sm text-[#9A5B00]">
            You&apos;re offline. The dashboard will refresh when the connection returns.
          </p>
        )}

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-red-200 bg-[#FDECEC] px-4 py-3 text-sm text-[#B42323]">
            <span>{error.message}{data ? " The numbers below are from the last successful load." : ""}</span>
            {canRetry && <button type="button" onClick={() => void reload()} className="min-h-11 px-2 !font-semibold underline sm:min-h-0">Try again</button>}
          </div>
        )}

        {!data && !error && (
          <div className="rounded-[14px] border border-[#E7E7EA] bg-white p-5"><SkeletonLines lines={8} /></div>
        )}

        {data && View && (
          <div aria-busy={isLoading} className={`space-y-4 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            <View
              data={data}
              // The Tasks page's rule: the assignee, or admin and manager. Contact follow-ups are completed on the contact.
              canComplete={(item) => item.entity_type === "lead" && (head || item.assigned_to === user?.id)}
              onLog={setLogging}
              onComplete={setCompleting}
              onPickEmployee={(id) => { setEmployee(id); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </div>
        )}
      </div>

      {logging?.entityType === "lead" && (
        <LeadActivityLogModal leadId={logging.entityId} leadName={logging.name} onSaved={saved} onCancel={() => setLogging(null)} />
      )}
      {logging?.entityType === "contact" && (
        <ContactActivityLogModal contactId={logging.entityId} contactName={logging.name} onSaved={saved} onCancel={() => setLogging(null)} />
      )}

      {completing && <CompleteDialog item={completing} onClose={saved} onChanged={saved} onCancel={() => setCompleting(null)} />}
    </div>
  );
}
