"use client";

/**
 * useLeadTasks — one bucket of GET /lead-tasks with paging, plus the summary counts for all tabs.
 *
 * Refetches when the bucket, assignee filter or (debounced) search changes. `loadMore` appends the
 * next page; `reload` starts over (after an action changes a task). A request that is overtaken by a
 * newer one is ignored, so fast tab switching never shows the wrong list.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { listLeadTasks, type LeadTask, type LeadTaskBucket } from "@/lib/api/interactions";

export const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export type TaskSummary = Record<LeadTaskBucket, number>;
const EMPTY_SUMMARY: TaskSummary = { today: 0, overdue: 0, upcoming: 0, completed: 0 };

/** Fired after any task change so other listeners (the sidebar's overdue badge) refresh. */
export const TASKS_CHANGED_EVENT = "ogera-tasks-changed";

export function useLeadTasks(bucket: LeadTaskBucket, assignedTo: number | null, search: string) {
  const { token } = useAuth();
  const [items, setItems] = useState<LeadTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [query, setQuery] = useState(search);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (skip: number) => {
    if (!token) return;
    const id = ++requestId.current;
    if (skip === 0) setIsLoading(true); else setIsLoadingMore(true);
    setError(null);
    try {
      const page = await listLeadTasks(token, { bucket, assignedTo, q: query, skip, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems((prev) => (skip === 0 ? page.items : [...prev, ...page.items]));
      setSummary(page.summary);
      setTotal(page.total);
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(caught instanceof Error ? caught : new Error("Could not load tasks."));
    } finally {
      if (id === requestId.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [token, bucket, assignedTo, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPage(0); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPage]);

  const reload = useCallback(() => {
    void fetchPage(0);
    window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
  }, [fetchPage]);

  const loadMore = useCallback(() => { void fetchPage(items.length); }, [fetchPage, items.length]);

  return { items, summary, total, isLoading, isLoadingMore, error, reload, loadMore, hasMore: items.length < total };
}
