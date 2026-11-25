"use client";

/**
 * useFollowupSettings — the tenant's follow-up settings, fetched once and shared by every form.
 *
 * Returns the defaults until the API answers (or if it fails), so forms never wait on it.
 * Call `setFollowupSettingsCache` after saving so open screens pick up the change.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_FOLLOWUP_SETTINGS, getFollowupSettings, type FollowupSettings } from "../api/followupSettings";

const STALE_MS = 5 * 60 * 1000;

// Keyed by the session token, so a different tenant's login never sees the previous tenant's settings.
let cached: { value: FollowupSettings; fetchedAt: number; token: string } | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(token: string) {
  if ((cached && cached.token === token && Date.now() - cached.fetchedAt < STALE_MS) || inflight) return;
  inflight = getFollowupSettings(token)
    .then((value) => { cached = { value, fetchedAt: Date.now(), token }; emit(); })
    .catch(() => { /* keep defaults; the next mount retries */ })
    .finally(() => { inflight = null; });
}

export function setFollowupSettingsCache(token: string, value: FollowupSettings) {
  cached = { value, fetchedAt: Date.now(), token };
  emit();
}

export function useFollowupSettings() {
  const { token } = useAuth();
  const entry = useSyncExternalStore(subscribe, () => cached, () => null);
  useEffect(() => { if (token) load(token); }, [token]);
  const current = entry && entry.token === token ? entry.value : null;
  return { settings: current ?? DEFAULT_FOLLOWUP_SETTINGS, isLoaded: current != null };
}
