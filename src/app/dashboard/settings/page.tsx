"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import AccountTab from "@/components/settings/AccountTab";
import EnumsTab from "@/components/settings/EnumsTab";
import GeneralTab from "@/components/settings/GeneralTab";
import RolesTab from "@/components/settings/RolesTab";
import TeamTab from "@/components/settings/TeamTab";

type Viewer = { id?: number; role?: string; name?: string; email?: string };
type TabKey = "account" | "general" | "lists" | "roles" | "team";

// Everyone signed in sees "My account". Admin and manager also see the team-wide tabs.
const TABS: { key: TabKey; label: string; teamWide: boolean; d: string }[] = [
  { key: "account", label: "My account", teamWide: false, d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { key: "general", label: "General", teamWide: true, d: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" },
  { key: "lists", label: "Lists & Options", teamWide: true, d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  { key: "roles", label: "Roles & Permissions", teamWide: true, d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { key: "team", label: "Team", teamWide: true, d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
];

export default function SettingsPage() {
  // sessionStorage only exists in the browser, so it is read after hydration with an empty server snapshot.
  const stored = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const viewer = useMemo<Viewer | null>(() => {
    try { return stored ? (JSON.parse(stored) as Viewer) : null; } catch { return null; }
  }, [stored]);
  const [tab, setTab] = useState<TabKey>("account");

  const isAdmin = viewer?.role === "admin";
  const isTeamWide = isAdmin || viewer?.role === "manager";
  const tabs = TABS.filter((item) => !item.teamWide || isTeamWide);
  const profile = viewer?.id && viewer.name && viewer.email
    ? { id: viewer.id, name: viewer.name, email: viewer.email, role: viewer.role ?? "" }
    : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white pl-16 pr-4 sm:pr-7 lg:pl-7">
        <h1 className="shrink-0 whitespace-nowrap text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Settings</h1>
      </header>

      <div className="flex-1 p-5 lg:p-6">
      {profile && (
        <div className="grid items-start gap-6 lg:grid-cols-[212px_1fr]">
          <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto rounded-[14px] border border-[#E5E7EA] bg-white px-1 py-2.5 lg:mx-0 lg:w-[212px] lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-2.5">
            {tabs.map((item) => {
              const active = item.key === tab;
              return (
                <button key={item.key} type="button" aria-current={active ? "page" : undefined} onClick={() => setTab(item.key)}
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-left text-sm font-semibold transition-colors ${active ? "bg-[#EAF4EF] text-[#0E4D3A]" : "text-[#4B5060] hover:bg-[#F3F3F5]"}`}>
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active ? "#0E4D3A" : "#6B7080"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d={item.d} />
                  </svg>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {tab === "account" && <AccountTab profile={profile} />}
            {tab === "general" && isTeamWide && <GeneralTab canEdit={isAdmin} />}
            {tab === "lists" && isTeamWide && <EnumsTab />}
            {tab === "roles" && isTeamWide && <RolesTab canEdit={isAdmin} />}
            {tab === "team" && isTeamWide && <TeamTab canEdit={isTeamWide} viewerId={viewer?.id ?? null} isManager={viewer?.role === "manager"} />}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
