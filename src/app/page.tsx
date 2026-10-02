"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useLogin } from "@/hooks/useLogin";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function Home() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { state, submit, reset } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const isSubmitting = state.status === "loading" || state.status === "success";
  const apiError = state.status === "error" ? state.error : null;
  const message = validationMessage || apiError?.message || "";

  function clearErrors() {
    setValidationMessage("");
    if (state.status === "error") reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!email.trim() || !password) {
      setValidationMessage("Enter your email and password to continue.");
      return;
    }
    setValidationMessage("");
    if (await submit(email, password)) router.push("/dashboard");
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <aside className="login-brand">
        {/* decorative background elements */}
        <span className="brand-glow-1" aria-hidden="true" />
        <span className="brand-glow-2" aria-hidden="true" />

        <div className="brand-content">
          <div className="brand-top">
            <div className="brand-logo">
              <Image src="/images/ogera-logo.png" alt="Ogera CRM" width={120} height={35} priority />
            </div>
            <span className="brand-byline">by Ogera Ventures</span>
          </div>

          <div className="brand-body">
            <h1 className="brand-headline">
              Your salesperson&rsquo;s<br />notebook, upgraded.
            </h1>
            <p className="brand-sub">
              Built for field sales teams across Kerala and South India. Manage every lead, follow-up, and deal — from your phone.
            </p>

            <ul className="brand-features">
              <li>
                <span className="feat-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5h4.5v5H4v-5ZM8.5 4.5H13v11H8.5v-11ZM13 7.5h3v8h-3v-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                </span>
                <div>
                  <strong>3 contact types in one place</strong>
                  <span>Consumers, partners, and dealers — each with their own journey.</span>
                </div>
              </li>
              <li>
                <span className="feat-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6.5v4l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </span>
                <div>
                  <strong>Auto follow-up reminders</strong>
                  <span>No lead falls through the cracks.</span>
                </div>
              </li>
            </ul>
          </div>

          {/* decorative CRM stats */}
          <div className="brand-stats" aria-hidden="true">
            <div className="stat-card">
              <svg viewBox="0 0 20 20" fill="none"><path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 14a6 6 0 0 1 12 0v2H4v-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <div>
                <span className="stat-val">124</span>
                <span className="stat-lbl">Active Leads</span>
              </div>
            </div>
            <div className="stat-card">
              <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6.5v4l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div>
                <span className="stat-val">38</span>
                <span className="stat-lbl">Follow-ups</span>
              </div>
            </div>
            <div className="stat-card">
              <svg viewBox="0 0 20 20" fill="none"><path d="M3 10h14M3 6h14M3 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div>
                <span className="stat-val">₹2.4L</span>
                <span className="stat-lbl">This Month</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="login-side">
        <div className="login-inner">
          <div className="login-heading">
            <p className="eyebrow">Ogera CRM</p>
            <h2 id="login-title">Sign in to your workspace</h2>
            <p>Use your work email and password to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="field-line">
              <label htmlFor="email">Email address</label>
              <div className="field-row">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v12.5A1.75 1.75 0 0 1 18.25 20H5.75A1.75 1.75 0 0 1 4 18.25V5.75Z" /><path d="m4.5 6 7.5 6 7.5-6" /></svg>
                <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => { setEmail(event.target.value); clearErrors(); }} aria-describedby={message ? "login-message" : undefined} />
              </div>
            </div>

            <div className="field-line">
              <label htmlFor="password">Password</label>
              <div className="field-row">
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); clearErrors(); }} aria-describedby={message ? "login-message" : undefined} />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  <svg aria-hidden="true" viewBox="0 0 24 24">{showPassword ? <><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.75" /></> : <><path d="M3 3 21 21" /><path d="M10.6 6.6A10.4 10.4 0 0 1 12 6.5c6.2 0 9.5 5.5 9.5 5.5a18.5 18.5 0 0 1-3 3.55M6.25 6.25A18.6 18.6 0 0 0 2.5 12S5.8 17.5 12 17.5c1.26 0 2.37-.23 3.34-.6" /><path d="M9.75 9.75a3.1 3.1 0 0 0 4.5 4.5" /></>}</svg>
                </button>
              </div>
            </div>

            {!isOnline && (
              <p className="form-message form-message-warn" role="status">
                You&rsquo;re offline. Reconnect to sign in.
              </p>
            )}

            {message && <p id="login-message" className="form-message" role="alert">{message}</p>}

            <button className="login-button" type="submit" disabled={isSubmitting || !isOnline} aria-busy={state.status === "loading"}>
              {state.status === "loading" ? "Signing in..." : state.status === "success" ? "Redirecting..." : apiError?.retryable ? "Try again" : "Sign in"}
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M14 7l5 5-5 5" /></svg>
            </button>
          </form>

          <p className="login-footer-note">Ogera CRM &mdash; built for Kerala&rsquo;s field sales teams.</p>
        </div>
      </section>
    </main>
  );
}
