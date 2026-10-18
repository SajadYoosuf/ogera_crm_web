"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

interface SessionUser { name: string; email: string; role: string; }

interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  category: "MAIN" | "ADMIN" | "FOOTER";
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    category: "MAIN",
    icon: (
      <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
    ),
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/contacts",
    category: "MAIN",
    icon: (
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
    ),
  },
  {
    id: "followups",
    label: "Lead Pipeline",
    href: "/dashboard/followups",
    category: "MAIN",
    // Support works after-sales from Contacts and Tasks; it has no pipeline access (see the permission matrix).
    roles: ["admin", "manager", "team_lead", "sales_executive", "tele_caller", "field_executive"],
    icon: (
      <path d="M4 4h5v16H4zM15 4h5v10h-5z" />
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/dashboard/tasks",
    category: "MAIN",
    icon: (
      <path d="M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15l2 2 4-4" />
    ),
  },
  {
    id: "sales",
    label: "Sales",
    href: "/dashboard/sales",
    category: "MAIN",
    icon: (
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
    ),
  },
  {
    id: "products",
    label: "Products",
    href: "/dashboard/products",
    category: "MAIN",
    icon: (
      <path d="M7 3h10v4a2 2 0 0 1-1 1.7V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.7A2 2 0 0 1 7 7z" />
    ),
  },
  {
    id: "employees",
    label: "Employees",
    href: "/dashboard/employees",
    category: "ADMIN",
    roles: ["admin", "manager"],
    icon: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    ),
  },
  {
    // No roles: every signed-in user has an account page. Admin and manager see the team-wide tabs too.
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    category: "FOOTER",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  },
];

const categories = [
  { key: "MAIN" as const, label: "Workspace" },
  { key: "ADMIN" as const, label: "Admin" },
];

const SIDEBAR_STORAGE_KEY = "ogera-sidebar-collapsed";
const SIDEBAR_EVENT = "ogera-sidebar-change";

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
}

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(value: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage can be blocked; the collapse still applies for this page view.
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export default function DashboardSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Desktop only: collapsed shows an icon rail. Mobile always uses the full drawer.
  const collapsed = useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleToggleMobileMenu = () => {
      setIsMobileMenuOpen((prev) => !prev);
    };
    window.addEventListener("toggleMobileMenu", handleToggleMobileMenu);
    return () => window.removeEventListener("toggleMobileMenu", handleToggleMobileMenu);
  }, []);

  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("ogera_user"),
    () => null,
  );
  const user = useMemo<SessionUser | null>(() => {
    if (!storedUser) return null;
    try { return JSON.parse(storedUser) as SessionUser; } catch { return null; }
  }, [storedUser]);

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false)),
    [user],
  );

  function logout() {
    sessionStorage.clear();
    localStorage.removeItem("ogera_access_token");
    router.push("/");
  }

  const isActiveItem = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  // Design: the active item is a bordered white card on the white rail; the rest are plain rows.
  const renderLink = (item: MenuItem) => {
    const isActive = isActiveItem(item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={`flex h-10 items-center gap-2.5 rounded-[8px] px-2.5 text-sm transition-colors duration-150 ${collapsed ? "lg:justify-center lg:px-0" : ""} ${
          isActive
            ? "border border-[#9ED8B8] bg-white/85 font-semibold text-[#1A1C21] shadow-[0_4px_16px_rgba(31,38,135,0.08)]"
            : "text-[#4B5060] hover:bg-white/60 hover:text-[#1A1C21]"
        }`}
      >
        <svg className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[#0E4D3A]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {item.icon}
        </svg>
        <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
      </Link>
    );
  };

  const accountInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <>
      {/* Mobile toggle - top left */}
      {!isMobileMenuOpen && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2.5 text-slate-700 bg-white rounded-xl shadow-md border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[999]" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-[248px] ${collapsed ? "lg:w-[72px]" : "lg:w-[248px]"} bg-white/55 text-[#4B5060] backdrop-blur-2xl backdrop-saturate-150 z-[1001] flex flex-col border-r border-white/70 shadow-[0_8px_32px_rgba(31,38,135,0.10)] lg:shadow-[6px_0_32px_rgba(31,38,135,0.06)] transition-[transform,width] duration-300 lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand row: Ogera logo with the CRM label, centred. The mobile close button sits in the corner. */}
        <div className={`relative flex shrink-0 items-center px-4 pb-2.5 pt-5 ${collapsed ? "lg:px-2" : ""}`}>
          <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-2.5 px-1.5 py-0.5 ${collapsed ? "lg:hidden" : ""}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#0E4D3A]">
              <Image src="/images/ogera-login-logo.png" alt="Ogera logo" width={22} height={17} className="block h-[17px] w-[22px] object-contain" />
            </span>
            <span className="text-base font-bold tracking-[-0.01em] text-[#1A1C21]" style={{ fontFamily: "'Sora', 'DM Sans', sans-serif" }}>Ogera CRM</span>
          </Link>
          <button onClick={() => setIsMobileMenuOpen(false)} className="absolute right-3 top-3.5 lg:hidden p-2 text-slate-500 rounded-lg hover:bg-white/60 hover:text-slate-800 transition-all active:scale-95" aria-label="Close menu">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Admin account: avatar, name and email. */}
        <div className={`flex shrink-0 items-center gap-2 px-3.5 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
          <div className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-1.5 pb-1.5 pt-0 ${collapsed ? "lg:flex-none lg:p-0" : ""}`} title={user?.name || "Ogera user"}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0E4D3A] to-[#1E7A5B] text-sm font-bold text-white shadow-[0_4px_12px_rgba(14,77,58,0.25)]">{accountInitial}</span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-[15px] font-bold leading-tight text-[#1A1C21]">{user?.name || "Ogera user"}</span>
              <span className="mt-px block truncate text-xs leading-tight text-[#6B7080]">{user?.email || user?.role?.replaceAll("_", " ") || "Staff"}</span>
            </span>
          </div>
        </div>

        {/* Menu */}
        <nav className={`flex-1 space-y-[22px] overflow-y-auto overflow-x-hidden px-3.5 pt-[22px] pb-4 ${collapsed ? "lg:px-2" : ""}`}>
          {categories.map((cat) => {
            const items = visibleMenuItems.filter((item) => item.category === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key} className="space-y-1">
                <div className={`px-2 pb-1.5 text-xs text-[#6B7080] ${collapsed ? "lg:hidden" : ""}`}>{cat.label}</div>
                {collapsed && <div className="hidden lg:block h-px bg-gray-200 mx-2 mb-2" aria-hidden="true" />}
                {items.map(renderLink)}
              </div>
            );
          })}
        </nav>

        {/* Desktop collapse handle: a small round button centred on the right edge, half inside and half outside */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-[13px] -right-[19px] z-10 items-center justify-center w-[38px] h-[38px] rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-[#0E4D3A] hover:border-blue-200 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
          </svg>
        </button>

        {/* Footer: Settings (everyone; team tabs for admin and manager) and Log out */}
        <div className="shrink-0 space-y-1 px-3.5 pb-4">
          {visibleMenuItems.filter((item) => item.category === "FOOTER").map(renderLink)}
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Log out" : undefined}
            aria-label={collapsed ? "Log out" : undefined}
            className={`flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 17v1.5A1.5 1.5 0 0 1 13.5 20h-7A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V7" />
              <path d="M10 12h10m0 0-3-3m3 3-3 3" />
            </svg>
            <span className={collapsed ? "lg:hidden" : ""}>Log out</span>
          </button>
        </div>
      </aside>

      {/* Desktop offset spacer: follows the sidebar width */}
      <div className={`hidden lg:block shrink-0 transition-[width] duration-300 ${collapsed ? "lg:w-[72px]" : "lg:w-[248px]"}`} />
    </>
  );
}
