"use client";

/**
 * useDashboard — the summary for the chosen period and employee.
 *
 * The previous numbers stay on screen while new ones load. A request overtaken by a newer one is ignored.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getDashboardSummary, type DashboardQuery, type DashboardSummary } from "../api/dashboard";

export function useDashboard({ period, dateFrom, dateTo, assignedTo }: DashboardQuery) {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);
  // A custom range is only asked for once both ends are chosen.
  const ready = period !== "custom" || Boolean(dateFrom && dateTo);

  const reload = useCallback(async () => {
    if (!token || !ready) return;
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const summary = await getDashboardSummary(token, { period, dateFrom, dateTo, assignedTo });
      if (id === requestId.current) setData(summary);
    } catch (caught) {
      if (id === requestId.current) setError(caught instanceof Error ? caught : new Error("Could not load the dashboard."));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [token, ready, period, dateFrom, dateTo, assignedTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { data, isLoading, error, reload };
}
