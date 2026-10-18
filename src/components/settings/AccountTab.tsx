"use client";

import { FormEvent, useState } from "react";
import { changePassword, updateMe, type MyProfile } from "@/lib/api/settings";
import { Icon, Panel, Toast, accentButton, errorText, getToken, icons } from "./ui";

// Same rule as the server: 6 to 15 characters with at least one letter and one digit.
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{6,15}$/;

type Notice = { text: string; tone: "ok" | "error" };

/** Keeps the name shown in the session in step after a save. A storage failure never blocks the save. */
function rememberProfile(profile: MyProfile) {
  try {
    const raw = sessionStorage.getItem("ogera_user");
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    sessionStorage.setItem("ogera_user", JSON.stringify({ ...current, name: profile.name, email: profile.email }));
  } catch {
    // Private windows can block storage; the server already has the new details.
  }
}

/** 0 to 3, for the strength bar. Length and a mix of character kinds count; the rule above decides validity. */
function strengthOf(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}
const STRENGTH = ["Weak", "Fair", "Good", "Strong"] as const;
const STRENGTH_COLOR = ["#C2410C", "#B45309", "#17703F", "#17703F"] as const;

const labelClass = "text-xs font-semibold text-[#4B5060]";

export default function AccountTab({ profile, onSaved }: { profile: MyProfile; onSaved?: (next: MyProfile) => void }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsNotice, setDetailsNotice] = useState<Notice | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);

  const nameTrim = name.trim();
  const emailTrim = email.trim().toLowerCase();
  const emailChanged = emailTrim !== profile.email.toLowerCase();
  const detailsChanged = nameTrim !== profile.name || emailChanged;
  const detailsValid = nameTrim.length > 0 && (!emailChanged || emailPassword.length > 0);

  const passwordValid = PASSWORD_RULE.test(next);
  const passwordsMatch = next.length > 0 && next === confirm;
  const canUpdatePassword = current.length > 0 && passwordValid && passwordsMatch && !passwordSaving;
  const strength = strengthOf(next);

  function cancelEmailEdit() {
    setEmailEditing(false);
    setEmail(profile.email);
    setEmailPassword("");
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { setDetailsNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setDetailsSaving(true); setDetailsNotice(null);
    try {
      const patch: { name?: string; email?: string; current_password?: string } = {};
      if (nameTrim !== profile.name) patch.name = nameTrim;
      if (emailChanged) { patch.email = emailTrim; patch.current_password = emailPassword; }
      const saved = await updateMe(token, patch);
      rememberProfile(saved);
      onSaved?.(saved);
      setName(saved.name); setEmail(saved.email);
      setEmailEditing(false); setEmailPassword("");
      setDetailsNotice({ text: "Your details are saved.", tone: "ok" });
    } catch (caught) {
      setDetailsNotice({ text: errorText(caught, "Your details could not be saved."), tone: "error" });
    } finally { setDetailsSaving(false); }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!canUpdatePassword) return;
    const token = getToken();
    if (!token) { setPasswordNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setPasswordSaving(true); setPasswordNotice(null);
    try {
      await changePassword(token, { current_password: current, new_password: next });
      setCurrent(""); setNext(""); setConfirm("");
      setPasswordNotice({ text: "Password updated. We emailed you a confirmation.", tone: "ok" });
    } catch (caught) {
      setPasswordNotice({ text: errorText(caught, "Your password could not be changed."), tone: "error" });
    } finally { setPasswordSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Your Details"
        status={
          detailsSaving ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#B45309]" role="status">
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>
              Saving…
            </span>
          ) : detailsNotice?.tone === "ok" ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#17703F]" role="status">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Saved
            </span>
          ) : null
        }
      >
        <form onSubmit={(event) => void saveDetails(event)} className="space-y-4">
          {detailsNotice?.tone === "error" && <Toast message={detailsNotice.text} tone="error" />}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-name" className={labelClass}>Full Name</label>
              <input id="account-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="crm-input" autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-email" className={labelClass}>Email Address</label>
              <div className="relative flex items-center">
                <input id="account-email" type="email" value={email} maxLength={120} disabled={!emailEditing}
                  onChange={(event) => setEmail(event.target.value)} className="crm-input pr-10 disabled:bg-gray-50 disabled:text-gray-500" autoComplete="email" />
                {emailEditing ? (
                  <button type="button" onClick={cancelEmailEdit} className="absolute right-1.5 h-7 rounded-md px-2 text-xs font-semibold text-[#6B7080] hover:bg-gray-100">Cancel</button>
                ) : (
                  <button type="button" onClick={() => setEmailEditing(true)} aria-label="Change email address" title="Change email address"
                    className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md text-[#6B7080] hover:bg-gray-100">
                    <Icon className="h-3.5 w-3.5">{icons.pencil}</Icon>
                  </button>
                )}
              </div>
            </div>
          </div>

          {emailEditing && (
            <div className="flex flex-col gap-2 rounded-[10px] border border-[#F3DFA8] bg-[#FEF9EC] px-3.5 py-3">
              <label htmlFor="account-email-password" className="text-[12.5px] font-semibold text-[#8A6400]">Changing your email needs your current password</label>
              <input id="account-email-password" type="password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)}
                placeholder="Enter your current password" autoComplete="current-password" className="crm-input max-w-[280px]" />
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={!detailsChanged || !detailsValid || detailsSaving} className={accentButton}>
              Save Changes
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Change Password" subtitle="6–15 characters, with at least one letter and one number">
        <form onSubmit={(event) => void savePassword(event)} className="space-y-3">
          {passwordNotice && <Toast message={passwordNotice.text} tone={passwordNotice.tone} />}
          <div className="max-w-[360px] space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-current-password" className={labelClass}>Current Password</label>
            <input id="account-current-password" type="password" value={current} placeholder="••••••••" onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" className="crm-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-new-password" className={labelClass}>New Password</label>
            <input id="account-new-password" type="password" value={next} maxLength={15} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" className="crm-input" />
            {next.length > 0 && (
              <div className="mt-0.5 flex items-center gap-2" aria-live="polite">
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#F0F0F3]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${passwordValid ? ((strength + 1) / 4) * 100 : 15}%`, background: STRENGTH_COLOR[strength] }} />
                </div>
                <span className="whitespace-nowrap text-[11.5px] font-bold" style={{ color: passwordValid ? STRENGTH_COLOR[strength] : "#C2410C" }}>
                  {passwordValid ? STRENGTH[strength] : "Needs a letter and a number"}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-confirm-password" className={labelClass}>Confirm New Password</label>
            <input id="account-confirm-password" type="password" value={confirm} maxLength={15} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className="crm-input" />
            {confirm.length > 0 && (
              <span className={`flex items-center gap-1.5 text-[11.5px] font-semibold ${passwordsMatch ? "text-[#17703F]" : "text-rose-600"}`}>
                {passwordsMatch && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                {passwordsMatch ? "Passwords match" : "Passwords do not match yet"}
              </span>
            )}
          </div>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={!canUpdatePassword} className={accentButton}>{passwordSaving ? "Updating…" : "Update Password"}</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
