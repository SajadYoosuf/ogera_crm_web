"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { listEnum, type EnumCategory, type EnumValue } from "@/lib/api/settings";
import { useAuth } from "@/context/AuthContext";

const STALE_MS = 5 * 60 * 1000;

type Entry = { items: EnumValue[]; fetchedAt: number; token: string };
// Keyed by `${token}:${category}` so a re-login as a different tenant never shows stale labels.
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function cacheKey(token: string, category: EnumCategory) { return `${token}:${category}`; }

function load(category: EnumCategory, token: string) {
  const key = cacheKey(token, category);
  const entry = cache.get(key);
  if ((entry && Date.now() - entry.fetchedAt < STALE_MS) || inflight.has(key)) return;
  const request = listEnum(token, category)
    .then((items) => { cache.set(key, { items, fetchedAt: Date.now(), token }); emit(); })
    .catch(() => { /* keep the last list (or the caller's fallback); the next mount retries */ })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
}

/** Label from the cache without subscribing; callers that render it also call `useEnumOptions` so they update once loaded. */
export const cachedLabel = (category: EnumCategory, value: string, token?: string) => {
  if (token) return cache.get(cacheKey(token, category))?.items.find((item) => item.value === value)?.label;
  // Fallback: scan all entries for this category (used by callers that don't have token handy).
  for (const [key, entry] of cache) {
    if (key.endsWith(`:${category}`)) {
      const found = entry.items.find((item) => item.value === value)?.label;
      if (found) return found;
    }
  }
  return undefined;
};

/** Forget cached options so the next form open refetches (called after Settings changes them or on logout). */
export function invalidateEnumOptions(category?: EnumCategory) {
  if (category) {
    for (const key of cache.keys()) { if (key.endsWith(`:${category}`)) cache.delete(key); }
    for (const key of inflight.keys()) { if (key.endsWith(`:${category}`)) inflight.delete(key); }
  } else {
    cache.clear();
    inflight.clear();
  }
  emit();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/**
 * Active options for a dropdown, fetched once and reused for 5 minutes across every form.
 * `fallback` shows until the first answer (or if the request fails), so a form is never empty.
 */
export function useEnumOptions(category: EnumCategory, fallback: EnumValue[] = []) {
  const { token } = useAuth();
  const entry = useSyncExternalStore(
    subscribe,
    () => (token ? cache.get(cacheKey(token, category)) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (token) load(category, token);
  }, [category, token]);

  // An empty answer (every option hidden, or a bad response) keeps the fallback so a dropdown is never blank.
  const items = entry && entry.items.length > 0 ? entry.items : fallback;
  const labelOf = useCallback((value: string | null | undefined) => {
    if (!value) return "";
    return items.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
  }, [items]);
  return { options: items, labelOf, isLoaded: Boolean(entry) };
}

/** Builds fallback rows from a static list so existing screens keep working before the API answers. */
export const staticOptions = (rows: { value: string; label: string }[]): EnumValue[] =>
  rows.map((row, index) => ({ id: -index - 1, value: row.value, label: row.label, sort_order: index, is_active: true, locked: false, usage_count: null }));
