"use client";

import { useCallback, useState } from "react";
import { ApiError, login } from "@/lib/api/auth";

export type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

/**
 * Runs the login request and, on success, stores the session under the same
 * sessionStorage keys the dashboard already reads.
 */
export function useLogin() {
  const [state, setState] = useState<LoginState>({ status: "idle" });

  const submit = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState({ status: "loading" });
    try {
      const { access_token, employee } = await login(email.trim(), password);
      sessionStorage.setItem("ogera_access_token", access_token);
      sessionStorage.setItem(
        "ogera_user",
        JSON.stringify({ id: employee.id, name: employee.name, email: employee.email, role: employee.role, phone: employee.phone }),
      );
      setState({ status: "success" });
      return true;
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof ApiError ? error : new ApiError("unknown", "Something went wrong. Please try again."),
      });
      return false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, submit, reset };
}
