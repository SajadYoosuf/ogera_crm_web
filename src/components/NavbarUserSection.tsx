"use client";

import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/features/notifications/NotificationBell";

export default function NavbarUserSection() {
  const { user } = useAuth();
  const accountInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <NotificationBell align="right" />
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0E4D3A] to-[#1E7A5B] text-sm font-bold text-white shadow-[0_4px_12px_rgba(14,77,58,0.20)]">
          {accountInitial}
        </span>
        <span className="hidden flex-col sm:flex">
          <span className="text-[13px] font-semibold leading-tight text-[#1A1C21]">{user?.name || "Ogera user"}</span>
          <span className="text-[11px] leading-tight text-[#6B7080]">{user?.email || user?.role?.replaceAll("_", " ") || "Staff"}</span>
        </span>
      </div>
    </div>
  );
}
