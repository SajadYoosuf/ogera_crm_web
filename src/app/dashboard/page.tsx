const icon = (children: React.ReactNode) => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const KPIS = [
  { label: "Total contacts", tone: "bg-blue-50 text-blue-600", glyph: icon(<><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></>) },
  { label: "New leads this week", tone: "bg-sky-50 text-sky-600", glyph: icon(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></>) },
  { label: "Active partners", tone: "bg-indigo-50 text-indigo-600", glyph: icon(<><circle cx="9" cy="8" r="3.25" /><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" /><path d="M16 4.6a3.25 3.25 0 0 1 0 6.3M18 14.3a4 4 0 0 1 3 3.7v1" /></>) },
  { label: "Won this month", tone: "bg-emerald-50 text-emerald-600", glyph: icon(<><path d="M3 17.5 9 11l4 4 7.5-7.5" /><path d="M15 7.5h5.5V13" /></>) },
];

const WIDGETS = [
  { title: "Lead pipeline", text: "Contacts by stage, from new lead to won.", bars: [92, 70, 54, 38, 22] },
  { title: "Leads by source", text: "Where your contacts are coming from.", bars: [80, 62, 48, 30, 18] },
  { title: "Team activity", text: "Follow-ups and conversions per employee.", bars: [66, 88, 44, 72, 36] },
];

function ComingSoon({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 ${className}`}>Coming soon</span>;
}

export default function DashboardHome() {
  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" /> Coming soon
            </p>
            <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Dashboard</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">Your sales overview is being built. Live numbers, pipeline and team activity will appear here.</p>
          </div>
        </div>
      </header>

      <section aria-label="Key numbers" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.tone}`}>{kpi.glyph}</span>
              <ComingSoon />
            </div>
            <p className="mt-4 text-xs font-semibold text-gray-500">{kpi.label}</p>
            <div className="mt-2 h-8 w-24 rounded-lg bg-gray-100 animate-pulse" aria-hidden="true" />
          </div>
        ))}
      </section>

      <section aria-label="Reports" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {WIDGETS.map((widget) => (
          <div key={widget.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#0a192f] tracking-tight">{widget.title}</h2>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{widget.text}</p>
              </div>
              <ComingSoon className="shrink-0" />
            </div>
            <div className="mt-6 space-y-3" aria-hidden="true">
              {widget.bars.map((width, index) => (
                <div key={index} className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-200 to-blue-100" style={{ width: `${width}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
