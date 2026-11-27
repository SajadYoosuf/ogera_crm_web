"use client";

/**
 * Guards everything under /dashboard.
 *
 * - Signed-out visitors (no session in this tab) → redirect to sign-in page silently.
 * - Mid-session expiry (token was valid, then a 401 cleared it) → redirect to `/?expired=1`
 *   so the login page can show a "session expired" banner.
 * - Neither case renders the dashboard shell or fires any API call without a valid token.
 *
 * The gate is the single owner of the "where do I go after sign-out" decision.
 * Pages MUST NOT also call router.push("/") on 401 — that races with this gate and
 * bypasses the /?expired=1 hint.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

export default function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  // Track whether this gate ever saw an authenticated session in this render tree.
  // If token transitions from something → null, that is a mid-session expiry (or deliberate logout
  // from the sidebar, which is fine — the user clicked "Log out" so the banner makes no sense there,
  // but we control the "Log out" path separately via clearSession which does not set this flag).
  const wasSignedInRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (token) {
      wasSignedInRef.current = true;
      return;
    }

    // Not signed in. If we were signed in earlier this render tree, the session expired
    // (401 auto-logout) or the user deliberately signed out. The sidebar's logout button
    // navigates to "/" itself after clearSession, so it won't reach here with wasSignedIn=true
    // in a typical flow — but even if it does, a "session expired" banner is harmless vs wrong.
    if (wasSignedInRef.current) {
      router.replace("/?expired=1");
    } else {
      router.replace("/");
    }
  }, [isLoading, token, router]);

  if (isLoading || !token) {
    return (
      <div
        className="flex min-h-dvh w-full flex-1 items-center justify-center bg-[#F4F4FA] text-sm text-[#6B7080]"
        role="status"
        aria-live="polite"
      >
        {/* Keep this message generic — the redirect happens in the effect above. */}
        Checking your session…
      </div>
    );
  }

  return <>{children}</>;
}
