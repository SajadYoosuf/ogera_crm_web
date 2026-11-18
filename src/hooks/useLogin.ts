"use client";

import { useCallback, useState } from "react";
import { ApiError, login } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";

export type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

/**
 * Runs the login request and, on success, stores the session via AuthContext.
 *
 * Previously this wrote directly to sessionStorage. Now it calls
 * `setSession()` from AuthContext, which both writes sessionStorage (so
 * existing pages that still read it directly keep working) and updates
 * React state so any component using `useAuth()` re-renders immediately.
 *
 * Also stores `branch` now — needed for multi-tenant support so the app
 * knows which office/location the signed-in employee belongs to.
 */
export function useLogin() {
  const { setSession } = useAuth();
  const [state, setState] = useState<LoginState>({ status: "idle" });

  const submit = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState({ status: "loading" });
    try {
      const { access_token, employee } = await login(email.trim(), password);
      setSession(access_token, {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        phone: employee.phone,
        branch: employee.branch,
      });
      setState({ status: "success" });
      return true;
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof ApiError ? error : new ApiError("unknown", "Something went wrong. Please try again."),
      });
      return false;
    }
  }, [setSession]);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, submit, reset };
}
