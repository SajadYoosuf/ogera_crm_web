"use client";

import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/features/notifications/NotificationBell";

export default function DashboardTopBar() {
  const { user } = useAuth();
  const accountInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-[#E7E7EA] bg-white px-4 sm:px-6">
      {/* Left: mobile menu toggle — dispatches the event the sidebar already listens on */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("toggleMobileMenu"))}
        className="lg:hidden p-2 text-slate-700 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Spacer so the right group stays far right on desktop */}
      <div className="flex-1" />

      {/* Right: notification bell + user info */}
      <div className="flex items-center gap-3">
        <NotificationBell align="right" />

        {/* Avatar + name/email */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0E4D3A] to-[#1E7A5B] text-sm font-bold text-white shadow-[0_4px_12px_rgba(14,77,58,0.25)]">
            {accountInitial}
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="text-[14px] font-semibold leading-tight text-[#1A1C21]">{user?.name || "Ogera user"}</span>
            <span className="text-xs leading-tight text-[#6B7080]">{user?.email || user?.role?.replaceAll("_", " ") || "Staff"}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
