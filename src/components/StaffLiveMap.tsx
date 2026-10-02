"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DatePicker, { istToday } from "@/components/DatePicker";
import { ApiError } from "@/lib/api/auth";
import { getStaffRoute, listLiveStaff, type StaffLocation, type StaffRoute, type StaffState } from "@/lib/api/staff-locations";

type LatLng = [number, number];
type Filter = "all" | "moving" | "stuck" | "location_disabled" | "connection_lost";

const FALLBACK_CENTER: LatLng = [11.2588, 75.7804];
const POLL_MS = 20_000;
const STAFF_COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#ea580c", "#0f766e", "#be123c", "#4f46e5", "#65a30d", "#475569"];

const STATE_LABEL: Record<StaffState, string> = {
  moving: "Moving",
  stuck: "Stuck",
  location_disabled: "Location disabled",
  connection_lost: "Connection lost",
  signed_out: "Signed out",
};

const STATE_CLASS: Record<StaffState, string> = {
  moving: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  stuck: "bg-amber-50 text-amber-700 ring-amber-200",
  location_disabled: "bg-rose-50 text-rose-700 ring-rose-200",
  connection_lost: "bg-slate-100 text-slate-600 ring-slate-200",
  signed_out: "bg-slate-100 text-slate-600 ring-slate-200",
};

const STATE_DOT: Record<StaffState, string> = {
  moving: "bg-emerald-500",
  stuck: "bg-amber-500",
  location_disabled: "bg-rose-500",
  connection_lost: "bg-slate-400",
  signed_out: "bg-slate-400",
};

function staffColor(staff: Pick<StaffLocation, "colorIndex">) {
  return STAFF_COLORS[staff.colorIndex % STAFF_COLORS.length] ?? STAFF_COLORS[0];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
}

function addressLabel(staff: Pick<StaffLocation, "address" | "state">) {
  if (staff.address) return staff.address;
  if (staff.state === "location_disabled") return "Location was disabled before an address was saved.";
  if (staff.state === "connection_lost" || staff.state === "signed_out") return "Last address is unavailable.";
  return "Address is being resolved.";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
}

function formatAgo(value: string | number | null, now: number) {
  if (!value) return "No update yet";
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + " min ago";
  return Math.floor(minutes / 60) + " hr ago";
}

function formatDistance(meters: number) {
  return meters >= 1000 ? (meters / 1000).toFixed(1) + " km" : Math.round(meters) + " m";
}

function formatDwell(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  return hours + " hr" + (minutes % 60 ? " " + (minutes % 60) + " min" : "");
}

function markerIcon(staff: StaffLocation, selected: boolean) {
  const markerClass = "ogera-staff-marker " + (staff.state === "moving" ? "is-moving " : "") + (selected ? "is-selected" : "");
  const html = '<div class="' + markerClass + '" style="--staff-color:' + staffColor(staff) + '"><span class="ogera-staff-marker-ring"></span><span class="ogera-staff-marker-dot">' + initials(staff.name) + "</span></div>";
  return L.divIcon({ className: "ogera-staff-marker-wrap", html, iconSize: [42, 42], iconAnchor: [21, 21] });
}

function endpointIcon(kind: "start" | "end") {
  const html = '<span class="ogera-endpoint is-' + kind + '">' + (kind === "start" ? "A" : "B") + "</span>";
  return L.divIcon({ className: "ogera-staff-marker-wrap", html, iconSize: [26, 26], iconAnchor: [13, 13] });
}

/**
 * Fits the map only when `fitRequest` changes (first load, selecting staff, changing date, recenter).
 * Live polls never touch the viewport, so the admin's own pan/zoom is preserved.
 */
function FitController({ fitRequest, target, panTo }: { fitRequest: number; target: LatLng[]; panTo: LatLng | null }) {
  const map = useMap();
  const targetRef = useRef<LatLng[]>(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    if (fitRequest === 0) return;
    const points = targetRef.current;
    // On wide screens the staff panel / drawer cover part of the map; pad so content stays visible.
    const wide = map.getSize().x >= 640;
    const padding = { paddingTopLeft: [wide ? 400 : 40, 60] as L.PointTuple, paddingBottomRight: [wide ? 420 : 40, wide ? 60 : 260] as L.PointTuple };
    if (points.length > 1) map.fitBounds(points, { ...padding, maxZoom: 16, animate: true });
    else if (points.length === 1) map.flyTo(points[0], 15, { duration: 0.45 });
  }, [fitRequest, map]);

  useEffect(() => {
    if (panTo) map.panTo(panTo, { animate: true, duration: 0.4 });
  }, [map, panTo]);
  return null;
}

function MapControls({ onRecenter }: { onRecenter: () => void }) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  const btn = "grid h-10 w-10 place-items-center text-gray-700 transition hover:bg-gray-50 active:bg-gray-100";
  return (
    <div ref={ref} className="leaflet-top leaflet-right !pointer-events-none">
      <div className="leaflet-control !pointer-events-auto !m-3 !border-0 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        <button type="button" className={btn} onClick={() => map.zoomIn()} aria-label="Zoom in">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" className={btn + " border-t border-gray-100"} onClick={() => map.zoomOut()} aria-label="Zoom out">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <button type="button" className={btn + " border-t border-gray-100 text-blue-600"} onClick={onRecenter} aria-label="Recenter map">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></svg>
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: StaffState }) {
  return (
    <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset " + STATE_CLASS[state]}>
      <span className={"h-1.5 w-1.5 rounded-full " + STATE_DOT[state]} />
      {STATE_LABEL[state]}
    </span>
  );
}

function Avatar({ staff, size = "h-11 w-11" }: { staff: StaffLocation; size?: string }) {
  return <span className={"grid shrink-0 place-items-center rounded-2xl text-[12px] font-extrabold text-white shadow-md ring-2 ring-white " + size} style={{ backgroundColor: staffColor(staff) }}>{initials(staff.name)}</span>;
}

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg className={"h-4 w-4 " + (spinning ? "animate-spin" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5M20 20v-4h-4" />
  </svg>
);

export default function StaffLiveMap() {
  const [staff, setStaff] = useState<StaffLocation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [route, setRoute] = useState<StaffRoute | null>(null);
  const [date, setDate] = useState(istToday);
  const [isLoading, setIsLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeRefreshing, setRouteRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);
  const [routeUpdatedAt, setRouteUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fitRequest, setFitRequest] = useState(0);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const selected = useMemo(() => staff.find((row) => row.userId === selectedId) ?? null, [selectedId, staff]);
  const selectedRef = useRef<number | null>(null);
  const dateRef = useRef(date);
  const routeRequestId = useRef(0);
  const pendingFit = useRef(false);
  useEffect(() => {
    selectedRef.current = selectedId;
    dateRef.current = date;
  }, [selectedId, date]);
  const firstFit = useRef(true);


  const loadLive = useCallback(async (initial = false) => {
    try {
      const token = sessionStorage.getItem("ogera_access_token");
      if (!token) throw new ApiError("invalid_credentials", "Sign in to see live staff locations.", 401);
      setStaff(await listLiveStaff(token));
      setLiveUpdatedAt(Date.now());
      setError(null);
      setApiMissing(false);
      if (firstFit.current) {
        firstFit.current = false;
        setFitRequest((n) => n + 1);
      }
    } catch (caught) {
      // A 404 means this backend does not have the staff-location routes yet.
      if (caught instanceof ApiError && caught.status === 404) setApiMissing(true);
      if (initial) setError(caught instanceof Error ? caught.message : "Unable to load staff locations.");
    } finally {
      setLiveRefreshing(false);
      if (initial) setIsLoading(false);
    }
  }, []);

  /** Latest request wins: a slow response for a previous staff/date can never overwrite a newer one. */
  const loadRoute = useCallback(async (userId: number, routeDate: string, mode: "full" | "silent" = "full") => {
    const id = ++routeRequestId.current;
    if (mode === "full") setRouteLoading(true);
    else setRouteRefreshing(true);
    try {
      const token = sessionStorage.getItem("ogera_access_token");
      if (!token) throw new ApiError("invalid_credentials", "Sign in to see route history.", 401);
      const result = await getStaffRoute(token, userId, routeDate);
      if (id !== routeRequestId.current) return;
      setRoute(result);
      setRouteUpdatedAt(Date.now());
      setRouteError(null);
      if (pendingFit.current) {
        pendingFit.current = false;
        setFitRequest((n) => n + 1);
      }
    } catch (caught) {
      if (id !== routeRequestId.current) return;
      setRouteError(caught instanceof Error ? caught.message : "Unable to load route history.");
      if (mode === "full") setRoute(null);
    } finally {
      if (id === routeRequestId.current) {
        setRouteLoading(false);
        setRouteRefreshing(false);
      }
    }
  }, []);

  // Live positions poll; while viewing today's route it is refreshed on the same tick.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; loadLive() owns the loading state
    void loadLive(true);
    const interval = window.setInterval(() => {
      void loadLive();
      if (selectedRef.current !== null && dateRef.current === istToday()) void loadRoute(selectedRef.current, dateRef.current, "silent");
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadLive, loadRoute]);

  // Route history refreshes every time the selected staff member or date changes.
  useEffect(() => {
    if (selectedId === null) return;
    pendingFit.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-selection/date change; loadRoute() owns the loading state
    void loadRoute(selectedId, date, "full");
  }, [date, loadRoute, selectedId]);

  // Keeps "updated x ago" labels honest between polls.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(tick);
  }, []);

  function selectStaff(userId: number) {
    if (userId !== selectedId) {
      setRoute(null);
      setRouteError(null);
      setFocusIndex(null);
      setSelectedId(userId);
    } else {
      void loadRoute(userId, date, "full");
    }
  }

  function closeRoute() {
    routeRequestId.current++;
    setSelectedId(null);
    setRoute(null);
    setRouteError(null);
    setFocusIndex(null);
    setRouteLoading(false);
    setRouteRefreshing(false);
    setDate(istToday());
    setFitRequest((n) => n + 1);
  }

  function refreshAll() {
    setLiveRefreshing(true);
    void loadLive(true);
    if (selectedId !== null) void loadRoute(selectedId, date, "silent");
  }

  const points = useMemo(() => route?.points ?? [], [route]);
  const routeLine = useMemo(() => points.map((point) => [point.latitude, point.longitude] as LatLng), [points]);

  const located = useMemo(() => staff.filter((row) => row.latitude !== null && row.longitude !== null), [staff]);
  const fitTarget = useMemo(() => (selected && routeLine.length > 0 ? routeLine : located.map((row) => [row.latitude!, row.longitude!] as LatLng)), [located, routeLine, selected]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: staff.length, moving: 0, stuck: 0, location_disabled: 0, connection_lost: 0 };
    for (const row of staff) if (row.state in base) base[row.state as Filter]++;
    return base;
  }, [staff]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((row) => (filter === "all" || row.state === filter) && (!needle || row.name.toLowerCase().includes(needle) || (row.address ?? "").toLowerCase().includes(needle)));
  }, [filter, query, staff]);

  const focusPoint = focusIndex !== null && points[focusIndex] ? ([points[focusIndex].latitude, points[focusIndex].longitude] as LatLng) : null;
  const isToday = date === istToday();
  const color = selected ? staffColor(selected) : STAFF_COLORS[0];
  const stopByArrival = useMemo(() => new Map((route?.stops ?? []).map((stop) => [stop.arrivedAt, stop])), [route]);

  const comingSoon = !isLoading && apiMissing;
  const KPI_TILES: { id: Filter; label: string; hint: string; dot: string }[] = [
    { id: "all", label: "All staff", hint: "On the roster today", dot: "bg-blue-500" },
    { id: "moving", label: "Moving", hint: "On the road now", dot: "bg-emerald-500" },
    { id: "stuck", label: "Stationary", hint: "Not moving for a while", dot: "bg-amber-500" },
    { id: "location_disabled", label: "Location off", hint: "Phone GPS or permission turned off", dot: "bg-rose-500" },
    { id: "connection_lost", label: "Offline", hint: "App stopped sending updates", dot: "bg-slate-400" },
  ];

  return (
    <div className="flex h-full min-h-[720px] flex-col gap-4 p-5 pt-20 lg:p-6 lg:pt-6">
      <header className="relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="pointer-events-none absolute -top-24 -left-16 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 p-5 sm:p-7 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" /></span>
              {comingSoon ? "Coming soon" : "Live tracking"}
            </p>
            <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px]">Field Map</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65 sm:text-[15px]">See where every field executive is right now, how they moved today, and who needs a call.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-semibold text-white/60">{comingSoon ? "Live tracking launches soon" : liveUpdatedAt ? "Updated " + formatAgo(liveUpdatedAt, now) + " · every 20s" : "Connecting…"}</span>
            <button type="button" onClick={refreshAll} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0a192f] shadow-lg shadow-black/20 transition-all hover:bg-sky-50 active:scale-[.98]">
              <RefreshIcon spinning={liveRefreshing} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Staff status summary" className="shrink-0 grid grid-cols-2 gap-3 md:grid-cols-5">
        {KPI_TILES.map((tile) => {
          const active = filter === tile.id;
          return (
            <button key={tile.id} type="button" aria-pressed={active} onClick={() => setFilter(tile.id)}
              className={"group rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md " + (active ? "border-blue-600 ring-2 ring-blue-600/15" : "border-gray-200 hover:border-blue-300")}>
              <span className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">{tile.label}</span>
                <span className={"h-2.5 w-2.5 rounded-full " + tile.dot} />
              </span>
              <span className="mt-2 block text-[28px] font-extrabold leading-none tracking-tight text-[#0a192f]">{isLoading || error ? "–" : counts[tile.id]}</span>
              <span className="mt-1.5 block truncate text-[11px] text-gray-400">{tile.hint}</span>
            </button>
          );
        })}
      </section>

      <section className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:min-h-[520px] sm:flex-1" aria-label="Staff live locations">
        <div className="relative isolate h-[340px] shrink-0 bg-slate-100 sm:absolute sm:inset-0 sm:h-full">
        <MapContainer center={FALLBACK_CENTER} zoom={11} className="h-full w-full" zoomControl={false}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FitController fitRequest={fitRequest} target={fitTarget} panTo={focusPoint} />
          <MapControls onRecenter={() => setFitRequest((n) => n + 1)} />

          {selected && routeLine.length > 1 && (
            <>
              <Polyline positions={routeLine} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
              <Polyline positions={routeLine} pathOptions={{ color, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
            </>
          )}
          {selected && routeLine.length > 0 && <Marker position={routeLine[0]} icon={endpointIcon("start")} interactive={false} />}
          {selected && routeLine.length > 1 && <Marker position={routeLine[routeLine.length - 1]} icon={endpointIcon("end")} interactive={false} />}
          {selected && (route?.stops ?? []).map((stop) => (
            <CircleMarker key={stop.arrivedAt} center={[stop.latitude, stop.longitude]} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#f59e0b", fillOpacity: 1 }} />
          ))}
          {focusPoint && <CircleMarker center={focusPoint} radius={11} pathOptions={{ color, weight: 3, fillColor: "#ffffff", fillOpacity: 1 }} />}

          {located.map((row) => (
            <Marker key={row.userId} position={[row.latitude!, row.longitude!]} icon={markerIcon(row, row.userId === selectedId)} zIndexOffset={row.userId === selectedId ? 1000 : 0} eventHandlers={{ click: () => selectStaff(row.userId) }} />
          ))}
        </MapContainer>
        </div>

        {/* ── Staff list ──────────────────────────────────────────────────── */}
        <aside className={"relative z-[500] flex-col overflow-hidden border-t border-gray-200 bg-white sm:absolute sm:bottom-4 sm:left-4 sm:top-4 sm:flex sm:w-[21rem] sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-slate-900/10 " + (selected ? "hidden sm:flex" : "flex")} aria-label="Staff status list">
          <div className="space-y-3 border-b border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-[#0a192f]">Field staff map</h2>
                {comingSoon && <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Coming soon</span>}
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">{visible.length} of {staff.length}</span>
            </div>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or place" aria-label="Search staff" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15" />
            </div>
            {filter !== "all" && (
              <button type="button" onClick={() => setFilter("all")} className="text-xs font-bold text-blue-600 hover:text-blue-700">Showing {STATE_LABEL[filter as StaffState].toLowerCase()} only · Show everyone</button>
            )}
          </div>

          <div className="max-h-[420px] min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-gray-50/60 p-2.5 sm:max-h-none">
            {isLoading && [0, 1, 2, 3].map((n) => (
              <div key={n} className="flex animate-pulse gap-3 rounded-xl bg-white p-3"><span className="h-11 w-11 rounded-2xl bg-gray-200" /><span className="flex-1 space-y-2"><span className="block h-3 w-1/2 rounded bg-gray-200" /><span className="block h-3 w-full rounded bg-gray-100" /></span></div>
            ))}
            {comingSoon && (
              <div role="status" className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-5 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                </span>
                <span className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Coming soon</span>
                <h3 className="mt-3 text-base font-extrabold tracking-tight text-[#0a192f]">Live staff tracking</h3>
                <p className="mt-1.5 text-xs leading-5 text-gray-500">Your field team will appear on the map here, with their routes and status, as soon as tracking goes live.</p>
              </div>
            )}
            {!isLoading && error && !comingSoon && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-bold text-rose-800">Live locations could not load</p>
                <p className="mt-1 text-xs leading-5 text-rose-700">{error}</p>
                <button type="button" onClick={refreshAll} className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-50">Try again</button>
              </div>
            )}
            {!isLoading && !error && staff.length === 0 && <p className="px-3 py-10 text-center text-sm text-gray-500">No staff location has been reported yet.</p>}
            {!isLoading && !error && staff.length > 0 && visible.length === 0 && <p className="px-3 py-10 text-center text-sm text-gray-500">No staff match this view.</p>}
            {visible.map((row) => (
              <button key={row.userId} type="button" onClick={() => selectStaff(row.userId)} aria-pressed={row.userId === selectedId}
                className={"w-full rounded-xl border bg-white p-3 text-left shadow-xs transition-all " + (row.userId === selectedId ? "border-blue-600 ring-2 ring-blue-600/15" : "border-gray-200 hover:border-blue-300 hover:shadow-md")}>
                <div className="flex items-start gap-3">
                  <Avatar staff={row} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-[#0a192f]">{row.name}</span><StatusBadge state={row.state} /></span>
                    <span className="mt-1 block line-clamp-1 text-xs text-gray-500">{addressLabel(row)}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-400">
                      <span>{formatAgo(row.recordedAt, now)}</span>
                      {typeof row.batteryLevel === "number" && <span className={row.batteryLevel < 20 ? "text-rose-500" : ""}>{Math.round(row.batteryLevel)}% battery</span>}
                      {row.state === "moving" && typeof row.speed === "number" && row.speed > 0.5 && <span>{Math.round(row.speed * 3.6)} km/h</span>}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Route detail ────────────────────────────────────────────────── */}
        {selected && (
          <section role="dialog" aria-label={selected.name + " route history"} className="relative z-[600] flex flex-col overflow-hidden border-t border-gray-200 bg-white sm:absolute sm:bottom-4 sm:right-4 sm:top-4 sm:w-[24rem] sm:rounded-2xl sm:border sm:shadow-2xl">
            <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] px-4 pb-4 pt-4 text-white">
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <Avatar staff={selected} size="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-extrabold tracking-tight">{selected.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2"><StatusBadge state={selected.state} /><span className="text-[11px] font-semibold text-white/60">{formatAgo(selected.recordedAt, now)}</span></div>
                </div>
                <button type="button" onClick={closeRoute} aria-label="Close route history" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <p className="relative mt-3 line-clamp-2 text-xs leading-5 text-white/70">{addressLabel(selected)}</p>
              {selected.phone && (
                <a href={"tel:" + selected.phone} className="relative mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/20">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
                  Call {selected.phone}
                </a>
              )}
            </header>

            <div className="shrink-0 space-y-2 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><DatePicker value={date} onChange={(value) => { setFocusIndex(null); setDate(value); }} max={istToday()} /></div>
                <button type="button" onClick={() => void loadRoute(selected.userId, date, "silent")} aria-label="Refresh route history" title="Refresh route" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-blue-600"><RefreshIcon spinning={routeRefreshing || routeLoading} /></button>
              </div>
              <p className="text-[11px] text-gray-400">{routeUpdatedAt ? "Route updated " + formatAgo(routeUpdatedAt, now) : "Loading route…"}{isToday ? " · refreshes every 20s" : ""}</p>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 px-4 py-3">
              {[
                { label: "Distance", value: route ? formatDistance(route.distanceMeters) : "--" },
                { label: "Updates", value: route ? String(points.length) : "--" },
                { label: "Active", value: route && points.length ? formatTime(route.firstSeen ?? points[0].recordedAt) + " – " + formatTime(route.lastSeen ?? points[points.length - 1].recordedAt) : "--" },
              ].map((tile) => (
                <div key={tile.label} className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">{tile.label}</p>
                  <p className="mt-0.5 truncate text-[13px] font-extrabold text-[#0a192f]" title={tile.value}>{tile.value}</p>
                </div>
              ))}
            </div>

            <div className="max-h-[380px] min-h-0 flex-1 overflow-y-auto border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:max-h-none">
              {routeError && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</p>}
              {routeLoading && [0, 1, 2, 3].map((n) => <div key={n} className="mb-3 flex animate-pulse gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-gray-200" /><span className="flex-1 space-y-2"><span className="block h-3 w-2/3 rounded bg-gray-200" /><span className="block h-3 w-1/3 rounded bg-gray-100" /></span></div>)}
              {!routeLoading && !routeError && points.length === 0 && (
                <div className="py-10 text-center"><p className="text-sm font-bold text-[#0a192f]">No route recorded</p><p className="mt-1 text-xs text-gray-500">There are no location updates for this date.</p></div>
              )}
              {!routeLoading && points.length > 0 && (
                <ol className="relative">
                  {points.map((point, index) => ({ point, index })).reverse().map(({ point, index }) => {
                    const stop = stopByArrival.get(point.recordedAt);
                    const active = focusIndex === index;
                    const isStart = index === 0;
                    const isEnd = index === points.length - 1 && points.length > 1;
                    return (
                      <li key={point.recordedAt + "-" + index} className="relative pl-6">
                        <span className="absolute bottom-0 left-[5px] top-0 w-px bg-gray-200" aria-hidden="true" />
                        <span className={"absolute left-0 top-4 h-[11px] w-[11px] rounded-full border-2 border-white ring-2 " + (active ? "scale-125" : "")} style={{ backgroundColor: color, ["--tw-ring-color" as string]: active ? color : "#e5e7eb" }} aria-hidden="true" />
                        <button type="button" onClick={() => setFocusIndex(active ? null : index)} className={"mb-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-left transition " + (active ? "border-blue-600 ring-2 ring-blue-600/15" : "border-gray-200 hover:border-blue-300")}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-bold text-[#0a192f]">{point.address ?? "Address unavailable"}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-gray-400">{formatTime(point.recordedAt)}</span>
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusBadge state={point.state} />
                            {stop && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">Stayed {formatDwell(stop.dwellMs)}</span>}
                            {isStart && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">Start</span>}
                            {isEnd && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">Latest</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        )}
        <style>{STAFF_MAP_STYLES}</style>
      </section>
    </div>
  );
}

const STAFF_MAP_STYLES = [
  ".ogera-staff-marker-wrap { background: transparent !important; border: 0 !important; }",
  ".ogera-staff-marker { position: relative; display: grid; width: 42px; height: 42px; place-items: center; }",
  ".ogera-staff-marker-ring { position: absolute; width: 30px; height: 30px; border-radius: 999px; background: var(--staff-color); opacity: .18; }",
  ".ogera-staff-marker.is-moving .ogera-staff-marker-ring { animation: staff-location-pulse 2s ease-out infinite; }",
  ".ogera-staff-marker-dot { position: relative; display: grid; width: 30px; height: 30px; place-items: center; border: 2.5px solid white; border-radius: 999px; background: var(--staff-color); box-shadow: 0 4px 12px rgb(15 23 42 / .28); color: white; font-size: 10px; font-weight: 700; transition: transform .15s ease; }",
  ".ogera-staff-marker:hover .ogera-staff-marker-dot { transform: scale(1.1); }",
  ".ogera-staff-marker.is-selected .ogera-staff-marker-dot { box-shadow: 0 0 0 3px white, 0 0 0 5px var(--staff-color), 0 6px 16px rgb(15 23 42 / .3); }",
  ".ogera-endpoint { display: grid; width: 26px; height: 26px; place-items: center; border: 2.5px solid white; border-radius: 999px; color: white; font-size: 11px; font-weight: 800; box-shadow: 0 3px 10px rgb(15 23 42 / .3); }",
  ".ogera-endpoint.is-start { background: #16a34a; }",
  ".ogera-endpoint.is-end { background: #e11d48; }",
  "@keyframes staff-location-pulse { 0% { transform: scale(1); opacity: .32; } 100% { transform: scale(2.1); opacity: 0; } }",
  ".leaflet-container { font-family: inherit; background: #eef1f5; }",
  ".leaflet-control-attribution { font-size: 9px; border-radius: 8px 0 0 0; }",
].join("\n");
