"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getCompany, updateCompany, type Company } from "@/lib/api/settings";
import { ErrorBlock, Panel, Spinner, Toast, accentButton, errorText } from "./ui";

export default function GeneralTab() {
  const { token } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view settings."); return; }
    setLoadError("");
    try {
      const data = await getCompany(token);
      setCompany(data); setName(data.company_name);
    } catch (caught) { setLoadError(errorText(caught, "Company details could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveName() {
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const data = await updateCompany(token, { company_name: trimmed });
      setCompany(data); setName(data.company_name); setNotice({ text: "Company name saved.", tone: "ok" });
    } catch (caught) { setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" }); }
    finally { setBusy(false); }
  }

  const trimmed = name.trim();
  const dirty = company !== null && trimmed !== company.company_name;

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!company) return <Spinner />;

  return (
    <div className="space-y-4">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      <Panel title="Company Details">
        <form onSubmit={(event) => { event.preventDefault(); if (dirty && trimmed) void saveName(); }} className="space-y-4">
          <div className="flex max-w-[420px] flex-col gap-1.5">
            <label htmlFor="company-name" className="text-xs font-semibold text-[#4B5060]">Company Name</label>
            <input id="company-name" value={name} maxLength={120} disabled={busy} onChange={(event) => setName(event.target.value)} className="crm-input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={busy || !dirty || !trimmed} className={accentButton}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
