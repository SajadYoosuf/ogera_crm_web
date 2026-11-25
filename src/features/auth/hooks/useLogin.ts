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
 * The API returns both `employee` (the signed-in person) and `company`
 * (the tenant they belong to). Both are saved into the session so any
 * component can read the company name via `useAuth().user.company.name`
 * without an extra round-trip.
 *
 * `role` in the session is mapped from the API's `role_slug` field so
 * existing code that checks `user.role` keeps working unchanged.
 */
export function useLogin() {
  const { setSession } = useAuth();
  const [state, setState] = useState<LoginState>({ status: "idle" });

  const submit = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState({ status: "loading" });
    try {
      const { access_token, employee, company } = await login(email.trim(), password);
      setSession(access_token, {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        // API returns role_slug; we store it as `role` for backward compat.
        role: employee.role_slug,
        phone: employee.phone,
        branch_id: employee.branch_id ?? null,
        company: {
          id: company.id,
          name: company.name,
          logo_url: company.logo_url,
          status: company.status,
        },
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
