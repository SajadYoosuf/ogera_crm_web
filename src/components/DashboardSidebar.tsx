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
  category: "CORE";
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    category: "CORE",
    icon: (
      <>
        <rect width="7" height="9" x="3" y="3" rx="1.5" />
        <rect width="7" height="5" x="14" y="3" rx="1.5" />
        <rect width="7" height="9" x="14" y="12" rx="1.5" />
        <rect width="7" height="5" x="3" y="16" rx="1.5" />
      </>
    ),
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/contacts",
    category: "CORE",
    icon: (
      <>
        <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
        <circle cx="10" cy="8" r="3.25" />
        <path d="M17.5 11.5h3M19 10v3" />
      </>
    ),
  },
  {
    id: "field-map",
    label: "Field Map",
    href: "/dashboard/map",
    category: "CORE",
    icon: (
      <>
        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  {
    id: "followups",
    label: "Lead Followup",
    href: "/dashboard/followups",
    category: "CORE",
    roles: ["admin", "sales_head"],
    icon: (
      <>
        <rect width="6" height="16" x="3" y="4" rx="1.5" />
        <rect width="6" height="10" x="15" y="4" rx="1.5" />
      </>
    ),
  },
  {
    id: "sales",
    label: "Sales Ledger",
    href: "/dashboard/sales",
    category: "CORE",
    icon: (
      <>
        <path d="M3 17.5 9 11l4 4 7.5-7.5" />
        <path d="M15 7.5h5.5V13" />
        <path d="M3 21h18" />
      </>
    ),
  },
  {
    id: "performance",
    label: "Performance",
    href: "/dashboard/performance",
    category: "CORE",
    roles: ["admin", "sales_head"],
    icon: (
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    ),
  },
  {
    id: "employees",
    label: "Employees",
    href: "/dashboard/employees",
    category: "CORE",
    roles: ["admin", "manager"],
    icon: (
      <>
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
        <path d="M16 4.6a3.25 3.25 0 0 1 0 6.3" />
        <path d="M18 14.3a4 4 0 0 1 3 3.7v1" />
      </>
    ),
  },
];

const categories = [{ key: "CORE" as const, label: "CORE CRM" }];

export default function DashboardSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        className={`fixed top-0 left-0 h-screen w-64 bg-[#09152b] text-slate-200 z-[1001] flex flex-col border-r border-slate-800/80 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Branding */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 rounded-lg bg-white px-2 py-1 flex items-center">
              <Image src="/images/ogera-logo.png" alt="Ogera" width={140} height={40} priority className="w-[86px] h-auto" />
            </span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-400/30 px-1.5 py-0.5 rounded font-extrabold shrink-0">
              CRM
            </span>
          </Link>

          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2.5 text-slate-400 bg-slate-700/40 border border-slate-600/50 rounded-xl hover:bg-slate-600/60 hover:text-white transition-all active:scale-95" aria-label="Close menu">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {categories.map((cat) => {
            const items = visibleMenuItems.filter((item) => item.category === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key} className="space-y-1">
                <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{cat.label}</div>
                {items.map((item) => {
                  const isActive = isActiveItem(item.href);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 font-medium text-xs group ${isActive ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-950/50" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}
                    >
                      <span className="flex items-center gap-3">
                        <svg
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                          {item.icon}
                        </svg>
                        <span>{item.label}</span>
                      </span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="w-7 h-7 rounded-full bg-blue-600/80 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </span>
            <span className="truncate">
              <p className="text-xs font-bold text-slate-200 truncate">{user?.name || "Ogera user"}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">{user?.role?.replaceAll("_", " ") || "Staff"}</p>
            </span>
          </div>

          <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0" title="Log Out" aria-label="Log out">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17v1.5A1.5 1.5 0 0 1 13.5 20h-7A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V7" />
              <path d="M10 12h10m0 0-3-3m3 3-3 3" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Desktop offset spacer */}
      <div className="hidden lg:block w-64 shrink-0" />
    </>
  );
}
