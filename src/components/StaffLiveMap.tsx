"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { ApiError } from "@/lib/api/auth";
import { getStaffRoute, listLiveStaff, type StaffLocation, type StaffRoute } from "@/lib/api/staff-locations";
import { parseApiDate } from "@/lib/date-time";

const colors = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777"];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const formatTime = (value: string | null) => {
  const parsed = parseApiDate(value);
  return parsed ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(parsed) : "—";
};
const formatDateTime = (value: string) => {
  const parsed = parseApiDate(value);
  return parsed ? new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(parsed) : "—";
};
const formatDistance = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;

function FitMap({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (points.length === 1) map.setView(points[0], 13); else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] }); }, [map, points]);
  return null;
}

export default function StaffLiveMap() {
  const [staff, setStaff] = useState<StaffLocation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [route, setRoute] = useState<StaffRoute | null>(null);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const loadLive = useCallback(async (silent = false) => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) { setError("Your session has expired. Please sign in again."); setLoading(false); return; }
    silent ? setRefreshing(true) : setLoading(true);
    try { setStaff(await listLiveStaff(token)); setError(null); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Unable to load staff locations."); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadRoute = useCallback(async (userId: number, routeDate: string) => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setRouteLoading(true); setRouteError(null); setSelectedPointIndex(null);
    try { setRoute(await getStaffRoute(token, userId, routeDate)); } catch (caught) { setRoute(null); setRouteError(caught instanceof ApiError ? caught.message : "Unable to load route history."); } finally { setRouteLoading(false); }
  }, []);

  useEffect(() => { void loadLive(); const timer = window.setInterval(() => void loadLive(true), 20_000); return () => window.clearInterval(timer); }, [loadLive]);
  useEffect(() => { if (selectedId !== null) void loadRoute(selectedId, date); else setRoute(null); }, [date, loadRoute, selectedId]);

  const selected = staff.find((member) => member.userId === selectedId) ?? null;
  const routePoints = useMemo(() => (route?.points ?? []).map((point) => [point.latitude, point.longitude] as [number, number]), [route]);
  const mapPoints = useMemo(() => selected && routePoints.length ? routePoints : staff.flatMap((member) => member.latitude !== null && member.longitude !== null ? [[member.latitude, member.longitude] as [number, number]] : []), [routePoints, selected, staff]);

  return <main className="min-h-full bg-[#F3F6F4] text-[#1A1C21]">
    <header className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white pl-16 pr-4 sm:pr-7 lg:pl-7">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Field Map</h1>
        <p className="mt-0.5 text-[12.5px] font-medium text-[#6B7080]">Live field staff positions and route history</p>
      </div>
      <button type="button" onClick={() => void loadLive(true)} disabled={refreshing} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[8px] border border-[#DEE1E5] bg-white px-4 text-[13.5px] font-semibold text-[#3A3E4A] transition-colors hover:border-[#0E7A4F] hover:bg-[#F0F8F3] hover:text-[#0E4D3A] disabled:opacity-60">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></svg>
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </header>
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5 sm:px-6 lg:px-7">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <section className="grid min-h-[620px] overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="order-2 overflow-y-auto border-t border-[#EFEFF2] bg-white p-4 lg:order-1 lg:border-r lg:border-t-0">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-[family-name:var(--font-sora)] text-[14.5px] font-bold text-[#1A1C21]">Team locations</h2><span className="text-[11.5px] font-medium text-[#8A8F9C]">{staff.length} staff</span></div>
          {loading && <p className="p-3 text-sm text-gray-500">Loading locations…</p>}
          {!loading && staff.length === 0 && <p className="p-3 text-sm text-gray-500">No staff location has been reported yet.</p>}
          <div className="space-y-2">{staff.map((member) => { const color = colors[member.colorIndex % colors.length]; const active = member.userId === selectedId; return <button key={member.userId} type="button" onClick={() => setSelectedId(member.userId)} className={`flex w-full items-center gap-3 rounded-[10px] border p-3 text-left transition ${active ? "border-[#BFE5D2] bg-[#EAF4EF]" : "border-[#EFEFF2] hover:border-[#BFE5D2] hover:bg-[#F7FBF8]"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold text-[#1A1C21]">{member.name}</span><span className="block text-[11.5px] font-medium capitalize text-[#6B7080]">{member.state.replaceAll("_", " ")} · {formatTime(member.recordedAt)}</span></span></button>; })}</div>
        </aside>
        <div className="relative order-1 min-h-[430px] lg:order-2"><MapContainer center={[11.2588, 75.7804]} zoom={9} className="h-full min-h-[430px] w-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitMap points={mapPoints} />{staff.filter((member) => member.latitude !== null && member.longitude !== null).map((member) => <CircleMarker key={member.userId} center={[member.latitude!, member.longitude!]} radius={member.userId === selectedId ? 11 : 8} pathOptions={{ color: colors[member.colorIndex % colors.length], fillColor: colors[member.colorIndex % colors.length], fillOpacity: 0.85, weight: member.userId === selectedId ? 4 : 2 }} eventHandlers={{ click: () => setSelectedId(member.userId) }} />)}{selected && routePoints.length > 1 && <Polyline positions={routePoints} pathOptions={{ color: colors[selected.colorIndex % colors.length], weight: 5 }} />}{selected && route?.points.map((point, index) => <CircleMarker key={`${point.recordedAt}-${index}`} center={routePoints[index]} radius={selectedPointIndex === index ? 8 : 4} pathOptions={{ color: colors[selected.colorIndex % colors.length], fillColor: "#ffffff", fillOpacity: 1, weight: selectedPointIndex === index ? 3 : 1.5 }} eventHandlers={{ click: () => setSelectedPointIndex(index) }} />)}</MapContainer>
          {selected && <section className="absolute bottom-4 left-4 right-4 z-[500] flex max-h-[500px] flex-col overflow-hidden rounded-[14px] border border-[#DEE1E5] bg-white/95 shadow-xl backdrop-blur sm:left-auto sm:w-[370px]"><div className="shrink-0 border-b border-[#EFEFF2] p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-[family-name:var(--font-sora)] text-[15px] font-bold text-[#1A1C21]">{selected.name}</h2><p className="mt-0.5 text-[11.5px] text-[#6B7080]">{selected.address ?? "Address unavailable"}</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-[8px] px-2 py-1 text-lg leading-none text-[#8A8F9C] hover:bg-[#F3F6F4] hover:text-[#1A1C21]" aria-label="Close route panel">×</button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="text-[11.5px] font-semibold text-[#6B7080]" htmlFor="route-date">Daily history</label><input id="route-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 rounded-[8px] border border-[#DEE1E5] bg-white px-2 text-xs text-[#3A3E4A] outline-none focus:border-[#0E4D3A]" /></div>{!routeLoading && !routeError && <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-[8px] bg-[#F3F6F4] p-2"><span className="block text-[#6B7080]">Distance</span><strong className="text-[#0E4D3A]">{formatDistance(route?.distanceMeters ?? 0)}</strong></div><div className="rounded-[8px] bg-[#F3F6F4] p-2"><span className="block text-[#6B7080]">Location updates</span><strong className="text-[#0E4D3A]">{route?.points.length ?? 0}</strong></div></div>}</div>{routeLoading && <p className="p-4 text-xs text-[#6B7080]">Loading daily history…</p>}{routeError && <p className="p-4 text-xs text-rose-600">{routeError}</p>}{!routeLoading && !routeError && <div className="min-h-0 overflow-y-auto p-3"><div className="space-y-1.5">{(route?.points ?? []).slice().reverse().map((point, reverseIndex) => { const index = (route?.points.length ?? 0) - reverseIndex - 1; const active = selectedPointIndex === index; return <button key={`${point.recordedAt}-${index}`} type="button" onClick={() => setSelectedPointIndex(index)} className={`flex w-full gap-3 rounded-[9px] border p-2.5 text-left transition ${active ? "border-[#9ED8B8] bg-[#EAF4EF]" : "border-[#EFEFF2] hover:border-[#BFE5D2] hover:bg-[#F7FBF8]"}`}><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0E7A4F]" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-semibold text-[#1A1C21]">{formatDateTime(point.recordedAt)}</span><span className="text-[10.5px] font-medium capitalize text-[#6B7080]">{point.state}</span></span><span className="mt-0.5 block truncate text-[11.5px] text-[#6B7080]">{point.address ?? "Location update"}</span></span></button>; })}</div>{route?.points.length === 0 && <p className="py-5 text-center text-xs text-[#6B7080]">No location history for this day.</p>}</div>}</section>}
        </div>
      </section>
    </div>
  </main>;
}
