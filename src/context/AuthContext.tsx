"use client";

/**
 * AuthContext — single source of truth for the signed-in user and their token.
 *
 * WHY this exists:
 *   Before this, every page and component called `sessionStorage.getItem("ogera_access_token")`
 *   directly. That means 27+ files each read storage independently, and there is no central
 *   place to hold user data or react to sign-outs. For multi-tenant support we need to know
 *   the user's branch/org in one place, not scattered everywhere.
 *
 * HOW it works:
 *   - `AuthProvider` wraps the whole app (in the root layout).
 *   - On mount it reads the token and user from sessionStorage once.
 *   - `setSession()` is called after login to store both in sessionStorage AND in React state.
 *   - `clearSession()` is called on sign-out.
 *   - Any component calls `useAuth()` to get the current token, user, or trigger sign-out.
 *
 * MIGRATION:
 *   Pages can still read sessionStorage directly for now — the keys are unchanged.
 *   Gradually replace `sessionStorage.getItem("ogera_access_token")` with `useAuth().token`.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { store } from "@/store";
import { resetLookups } from "@/store/lookupsSlice";
import { invalidateEnumOptions } from "@/hooks/useEnumOptions";
import { getOrRequestPushToken } from "@/lib/firebase";
import { registerFcmToken } from "@/features/notifications/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The company (tenant) stored alongside the signed-in employee.
 * Keeping it here means any component can call `useAuth()` to show the
 * company name in a header or sidebar without an extra API call.
 */
export type SessionCompany = {
  id: number;
  /** The tenant's display name, e.g. "Ventino Homes". */
  name: string;
  logo_url: string | null;
  status: string;
};

/**
 * The shape of the user object we keep in memory (and in sessionStorage).
 *
 * `role` holds the string role slug (e.g. "admin") — it comes from
 * `role_slug` in the API response. `company` is the tenant the employee
 * belongs to and is the canonical way to display the organisation name.
 */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  /** The employee's role slug, e.g. "admin" or "manager". */
  role: string;
  phone: string | null;
  /** The tenant/company the employee belongs to. */
  company: SessionCompany;
  /** Role permissions map from the backend, e.g. {"leads":"crud","contacts":"cru"}. */
  permissions?: Record<string, string> | null;
  /** The employee's own branch. New leads default to it, so the lead form shows it. */
  branch_id?: number | null;
};

type AuthState =
  | { status: "loading" }              // reading sessionStorage on first mount
  | { status: "authenticated"; token: string; user: SessionUser }
  | { status: "unauthenticated" };

type AuthContextValue = {
  /** Raw JWT access token, or null if not signed in. */
  token: string | null;
  /** Signed-in user, or null. */
  user: SessionUser | null;
  /** True while reading sessionStorage on the first render. */
  isLoading: boolean;
  /**
   * Call this after a successful login. Saves the token and user to
   * sessionStorage and updates React state so every consumer re-renders.
   */
  setSession: (token: string, user: SessionUser) => void;
  /**
   * Call this to sign out. Clears sessionStorage and resets React state.
   */
  clearSession: () => void;
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY = "ogera_access_token";
const USER_KEY = "ogera_user";

function readStorage(): { token: string; user: SessionUser } | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const raw = sessionStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    const user = JSON.parse(raw) as SessionUser;
    // Guard against old sessions (before company was added) that lack the
    // company field. If the stored object is incomplete, discard it so the
    // user is prompted to log in again and gets a full session written.
    if (!user.company || typeof user.company.name !== "string") return null;
    return { token, user };
  } catch {
    return null;
  }
}

function writeStorage(token: string, user: SessionUser) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage blocked (private window, restricted context) — session won't
    // survive a refresh but the current tab still works.
  }
}

function clearStorage() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const pushRegistered = useRef(false);

  // Read sessionStorage once after the first render (browser-only).
  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      setState({ status: "authenticated", token: stored.token, user: stored.user });
    } else {
      setState({ status: "unauthenticated" });
    }
  }, []);

  // Register push token once per session after login. Failures are silent —
  // in-app notifications work regardless.
  useEffect(() => {
    if (state.status !== "authenticated" || pushRegistered.current) return;
    pushRegistered.current = true;
    const jwt = state.token;
    void (async () => {
      const fcmToken = await getOrRequestPushToken();
      if (fcmToken) await registerFcmToken(jwt, fcmToken).catch(() => undefined);
    })();
  }, [state]);

  const setSession = useCallback((token: string, user: SessionUser) => {
    writeStorage(token, user);
    setState({ status: "authenticated", token, user });
  }, []);

  const clearSession = useCallback(() => {
    clearStorage();
    setState({ status: "unauthenticated" });
    // Wipe tenant-specific cached data so a subsequent login (possibly a different tenant)
    // starts with a clean store rather than the previous user's data.
    store.dispatch(resetLookups());
    invalidateEnumOptions();
  }, []);

  const value: AuthContextValue = {
    token: state.status === "authenticated" ? state.token : null,
    user: state.status === "authenticated" ? state.user : null,
    isLoading: state.status === "loading",
    setSession,
    clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current auth state.
 *
 * Usage:
 *   const { token, user, clearSession } = useAuth();
 *
 * - `token`  — the JWT to pass to API calls, or null if not signed in
 * - `user`   — signed-in employee (id, name, role, branch, …), or null
 * - `isLoading` — true during the first render while sessionStorage is read
 * - `clearSession` — call this to sign out
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>. Wrap your root layout with <AuthProvider>.");
  }
  return ctx;
}
