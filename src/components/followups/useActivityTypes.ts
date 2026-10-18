"use client";

import { useEffect, useState } from "react";
import { listEnum, type EnumValue } from "@/lib/api/settings";

/** Activity types straight from GET /settings/enums/activity_type, with the error shown instead of hidden. */
export function useActivityTypes() {
  const [types, setTypes] = useState<EnumValue[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) { setError("Sign in again to load activity types."); return; }
    let cancelled = false;
    listEnum(token, "activity_type")
      .then((rows) => { if (!cancelled) setTypes(rows); })
      .catch(() => { if (!cancelled) setError("Could not load activity types."); });
    return () => { cancelled = true; };
  }, []);

  return { types: types ?? [], loaded: types !== null, error };
}
