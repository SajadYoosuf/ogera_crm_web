"use client";

import { useMemo, useSyncExternalStore } from "react";
import FollowupBoard from "@/components/followups/FollowupBoard";

export default function FollowupsPage() {
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("ogera_user"),
    () => null,
  );
  const isHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  const canManage = useMemo(() => {
    if (!storedUser) return false;
    try {
      const role = (JSON.parse(storedUser) as { role?: string }).role;
      return role === "admin" || role === "sales_head";
    } catch { return false; }
  }, [storedUser]);

  if (!isHydrated) return null;

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      {canManage ? (
        <FollowupBoard />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="11" x="4" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Restricted area</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Sales follow-up is available to admins and sales heads only.</p>
        </div>
      )}
    </div>
  );
}
