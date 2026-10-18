"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { listEnum, type EnumCategory, type EnumValue } from "@/lib/api/settings";

const STALE_MS = 5 * 60 * 1000;

type Entry = { items: EnumValue[]; fetchedAt: number };
const cache = new Map<EnumCategory, Entry>();
const inflight = new Map<EnumCategory, Promise<void>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function load(category: EnumCategory, token: string) {
  const entry = cache.get(category);
  if ((entry && Date.now() - entry.fetchedAt < STALE_MS) || inflight.has(category)) return;
  const request = listEnum(token, category)
    .then((items) => { cache.set(category, { items, fetchedAt: Date.now() }); emit(); })
    .catch(() => { /* keep the last list (or the caller's fallback); the next mount retries */ })
    .finally(() => inflight.delete(category));
  inflight.set(category, request);
}

/** Label from the cache without subscribing; callers that render it also call `useEnumOptions` so they update once loaded. */
export const cachedLabel = (category: EnumCategory, value: string) => cache.get(category)?.items.find((item) => item.value === value)?.label;

/** Forget cached options so the next form open refetches (called after Settings changes them). */
export function invalidateEnumOptions(category?: EnumCategory) {
  if (category) cache.delete(category); else cache.clear();
  emit();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/**
 * Active options for a dropdown, fetched once and reused for 5 minutes across every form.
 * `fallback` shows until the first answer (or if the request fails), so a form is never empty.
 */
export function useEnumOptions(category: EnumCategory, fallback: EnumValue[] = []) {
  const entry = useSyncExternalStore(subscribe, () => cache.get(category), () => undefined);

  useEffect(() => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (token) load(category, token);
  }, [category]);

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
