"use client";

import { useCallback, useEffect, useState } from "react";
import { listStageTypes, type StageTypeItem, type LeadKind } from "@/lib/api/leads";

export type { StageTypeItem };

/** Fetches and caches the stage types for one pipeline from the API. */
export function useStageTypes(kind: LeadKind) {
  const [stages, setStages] = useState<StageTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setIsLoading(false); return; }
    setIsLoading(true); setError("");
    try {
      setStages(await listStageTypes(accessToken, kind));
    } catch {
      setError("Could not load pipeline stages.");
    } finally {
      setIsLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return { stages, isLoading, error, reload: load };
}
