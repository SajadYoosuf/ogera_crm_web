"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import OtpInput from "@/components/auth/OtpInput";
import { ApiError } from "@/lib/api/auth";
import { requestResetCode, resetPassword, verifyResetCode } from "@/lib/api/password-reset";
import { dmSans, notoMalayalam, sora } from "@/lib/auth-fonts";
import { validateNewPassword } from "@/lib/password-rules";

type Step = "email" | "sending" | "send_failed" | "otp" | "reset" | "done";

const CODE_LENGTH = 6;
const emptyDigits = () => Array.from({ length: CODE_LENGTH }, () => "");

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [resetToken, setResetToken] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Count down the resend cooldown one second at a time.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    setBusy(true);
    setMessage("");
    try {
      const sent = await requestResetCode(email);
      setMaskedEmail(sent.email_masked);
      setResendIn(sent.resend_in_seconds);
      setDigits(emptyDigits());
      setNeedsNewCode(false);
      setStep("otp");
    } catch (error) {
      if (step === "otp") {
        setMessage(errorText(error));
      } else {
        setStep("send_failed");
        setMessage(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function startSending() {
    setStep("sending");
    setMessage("");
    await sendCode();
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    await startSending();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const verified = await verifyResetCode(email, code);
      setResetToken(verified.reset_token);
      setPassword("");
      setConfirm("");
      setStep("reset");
    } catch (error) {
      const text = errorText(error);
      setMessage(text);
      // A wrong code clears the boxes so the user can retype. An expired or locked code needs a new one.
      setDigits(emptyDigits());
      setNeedsNewCode(/expired|Too many|No active code/.test(text));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const errors = validateNewPassword(password, confirm);
    if (!confirm && !errors.password) errors.confirm = "Re-enter your new password.";
    if (errors.password || errors.confirm) return;

    setBusy(true);
    setMessage("");
    try {
      await resetPassword(resetToken, password);
      setPassword("");
      setConfirm("");
      setStep("done");
    } catch (error) {
      setMessage(errorText(error));
      // An expired or already used link cannot be retried; the user has to start again.
      setNeedsNewCode(/expired or was already used/.test(errorText(error)));
    } finally {
      setBusy(false);
    }
  }

  const rules = validateNewPassword(password, confirm);
  const passwordError = (submitted || password.length > 0) ? rules.password : undefined;
  const confirmError = (submitted || confirm.length > 0) ? (rules.confirm ?? (submitted && !confirm ? "Re-enter your new password." : undefined)) : undefined;
  const codeComplete = digits.every(Boolean);

  return (
    <main className={`login-page ${sora.variable} ${dmSans.variable} ${notoMalayalam.variable}`} aria-labelledby="reset-title">
      <section className="login-brand">
        <svg className="login-art" aria-hidden="true" viewBox="0 0 800 900" preserveAspectRatio="xMinYMid slice" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="1.2">
          <path d="M-120 900 C 40 520, 220 260, 330 80" />
          <path d="M-80 900 C 90 540, 290 300, 400 120" />
          <path d="M-40 900 C 140 560, 360 340, 470 160" />
          <path d="M0 900 C 190 580, 430 380, 540 200" />
          <path d="M40 900 C 240 600, 500 420, 610 240" />
          <path d="M80 900 C 290 620, 570 460, 680 280" />
        </svg>

        <div className="login-brand-inner">
          <div className="login-logo-chip">
            <Image src="/images/ogera-login-logo.png" alt="Ogera logo" width={108} height={82} priority />
          </div>

          <div className="login-headline-block">
            <h1 className="login-headline">Let&rsquo;s get you back in.</h1>
            <p lang="ml" className="login-malayalam">പാസ്‌വേഡ് മാറ്റാം, സുരക്ഷിതമായി.</p>
            <p className="login-lede">Your customers and leads are safe — just verify it&rsquo;s you and set a new password.</p>
          </div>
        </div>

        <p className="login-copyright">© 2026 Ogera Ventures Pvt. Ltd. · Made in Kerala</p>
      </section>

      <section className="login-side">
        <div className="login-card">
          <div className="login-topbar">
            <div className="login-brandname">Ogera CRM</div>
          </div>

          {step === "email" && (
            <form className="login-form" onSubmit={handleEmailSubmit} noValidate>
              <div className="login-form-stack">
                <h2 id="reset-title" className="login-form-title">Reset your password</h2>
                <p className="login-note">Enter your account email and we&rsquo;ll send you a 6-digit verification code.</p>
              </div>

              <div className="login-field">
                <label htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@ogera.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
              </div>

              <button className="login-submit" type="submit" disabled={busy || !email.trim()}>
                Send code
              </button>

              <div className="login-links"><Link href="/">← Back to Login</Link></div>
            </form>
          )}

          {step === "sending" && (
            <div className="login-sending">
              <Link href="/" className="login-back">← Back to Login</Link>

              <div className="login-sending-body">
                <div className="login-ring" aria-hidden="true">
                  <span className="login-ping login-ping-1" />
                  <span className="login-ping login-ping-2" />
                  <svg className="login-ring-spin" viewBox="0 0 108 108" fill="none">
                    <circle cx="54" cy="54" r="47" stroke="#E3E6E9" strokeWidth="5" />
                    <circle cx="54" cy="54" r="47" stroke="#7EE2A8" strokeWidth="5" strokeLinecap="round" strokeDasharray="84 300" />
                  </svg>
                  <span className="login-ring-core">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0E4D3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7l9 6 9-6" />
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                    </svg>
                  </span>
                </div>

                <div className="login-form-stack">
                  <h2 id="reset-title" className="login-form-title">Sending your code…</h2>
                  <p className="login-note">
                    We&rsquo;re sending a 6-digit verification code to <strong>{maskedEmail || "the admin email"}</strong>. This usually takes just a few seconds.
                  </p>
                </div>

                <div className="login-secure-pill">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0E4D3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <span>Your account stays secure the whole time</span>
                </div>
              </div>
            </div>
          )}

          {step === "send_failed" && (
            <div className="login-form">
              <h2 id="reset-title" className="login-form-title">Check your email</h2>
              <p className="login-message" role="alert">{message}</p>
              <button className="login-submit" type="button" onClick={() => void startSending()} disabled={busy}>
                {busy ? "Sending..." : "Try again"}
              </button>
              <div className="login-links"><Link href="/">Back to Login</Link></div>
            </div>
          )}

          {step === "otp" && (
            <form className="login-form" onSubmit={handleVerify} noValidate>
              <Link href="/" className="login-back">← Back to Login</Link>
              <div className="login-form-stack">
                <h2 id="reset-title" className="login-form-title">Check your email</h2>
                <p className="login-note">
                  We&rsquo;ve sent a 6-digit code to <strong>{maskedEmail}</strong>. Enter it below to continue.
                </p>
              </div>

              <div className="login-field">
                <span className="login-field-title">Verification code</span>
                <OtpInput digits={digits} onChange={setDigits} disabled={busy} />
              </div>

              {message && <p className="login-message" role="alert">{message}</p>}

              <button className="login-submit" type="submit" disabled={busy || !codeComplete}>
                {busy ? "Verifying..." : "Verify Code"}
              </button>

              <p className="login-links-line">
                Didn&rsquo;t get it?{" "}
                {resendIn > 0 ? (
                  <span>Resend in {resendIn}s</span>
                ) : (
                  <button type="button" className="login-text-button" onClick={() => void sendCode()} disabled={busy}>
                    Resend code
                  </button>
                )}
                {needsNewCode && resendIn <= 0 && <span> (request a new code)</span>}
              </p>
            </form>
          )}

          {step === "reset" && (
            <form className="login-form" onSubmit={handleReset} noValidate>
              <Link href="/" className="login-back">← Back to Login</Link>
              <div className="login-form-stack">
                <h2 id="reset-title" className="login-form-title">Create a new password</h2>
                <p className="login-note">Use 6 to 10 characters. You&rsquo;ll use this to log in next time.</p>
              </div>

              <div className="login-field">
                <label htmlFor="new-password">New password</label>
                <div className="login-input-row">
                  <input
                    id="new-password"
                    className="login-input has-toggle"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={passwordError ? "new-password-error" : undefined}
                  />
                  <button className="login-eye" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    <EyeIcon />
                  </button>
                </div>
                {passwordError && <p id="new-password-error" className="login-field-error">{passwordError}</p>}
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <div className="login-input-row">
                  <input
                    id="confirm-password"
                    className="login-input has-toggle"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    aria-invalid={confirmError ? true : undefined}
                    aria-describedby={confirmError ? "confirm-password-error" : undefined}
                  />
                  <button className="login-eye" type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                    <EyeIcon />
                  </button>
                </div>
                {confirmError && <p id="confirm-password-error" className="login-field-error">{confirmError}</p>}
              </div>

              {message && <p className="login-message" role="alert">{message}</p>}

              <button className="login-submit" type="submit" disabled={busy}>
                {busy ? "Resetting..." : "Reset Password"}
              </button>

              {needsNewCode && (
                <p className="login-links-line">
                  <button type="button" className="login-text-button" onClick={() => { setNeedsNewCode(false); void startSending(); }}>
                    Start again
                  </button>
                </p>
              )}
            </form>
          )}

          {step === "done" && (
            <div className="login-form login-success">
              <span className="login-success-icon" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#17703F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <div className="login-form-stack">
                <h2 id="reset-title" className="login-form-title">Password updated</h2>
                <p className="login-note">You can now log in with your new password.</p>
              </div>
              <Link href="/" className="login-submit login-submit-link">Back to Login</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
