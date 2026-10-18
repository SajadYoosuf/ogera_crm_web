import { request } from "@/lib/api/auth";

export type RequestCodeResponse = {
  email_masked: string;
  expires_in_seconds: number;
  resend_in_seconds: number;
};

export type VerifyCodeResponse = {
  reset_token: string;
  expires_in_seconds: number;
};

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Emails a new 6-digit code to the account with this email address. */
export function requestResetCode(email: string) {
  return postJson<RequestCodeResponse>("/auth/password-reset/request", { email });
}

/** Checks the code sent to this email. Returns a short-lived token for the reset step. */
export function verifyResetCode(email: string, code: string) {
  return postJson<VerifyCodeResponse>("/auth/password-reset/verify", { email, code });
}

/** Sets the new password. */
export function resetPassword(resetToken: string, newPassword: string) {
  return postJson<{ message: string }>("/auth/password-reset/reset", { reset_token: resetToken, new_password: newPassword });
}
