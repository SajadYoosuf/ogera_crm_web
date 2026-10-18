"use client";

/* eslint-disable @next/next/no-img-element -- the logo comes from the API server, not the Next image optimiser */
import { useCallback, useEffect, useRef, useState } from "react";
import { getCompany, logoSrc, updateCompany, uploadLogo, type Company } from "@/lib/api/settings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, accentButton, errorText, getToken, icons, secondaryButton } from "./ui";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function GeneralTab({ canEdit }: { canEdit: boolean }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoadError("Sign in again to view settings."); return; }
    setLoadError("");
    try {
      const data = await getCompany(token);
      setCompany(data); setName(data.company_name);
    } catch (caught) { setLoadError(errorText(caught, "Company details could not be loaded.")); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: (token: string) => Promise<Company>, done: string) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setBusy(true); setNotice(null);
    try {
      const data = await action(token);
      setCompany(data); setName(data.company_name); setNotice({ text: done, tone: "ok" });
    } catch (caught) { setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" }); }
    finally { setBusy(false); }
  }

  const trimmed = name.trim();
  const dirty = company !== null && trimmed !== company.company_name;

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setNotice({ text: "Logo must be a PNG or JPEG image.", tone: "error" }); return; }
    if (file.size > MAX_LOGO_BYTES) { setNotice({ text: "Logo must be 2 MB or smaller.", tone: "error" }); return; }
    void run((token) => uploadLogo(token, file), "Logo updated.");
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!company) return <Spinner />;
  const logo = logoSrc(company.company_logo_url);

  return (
    <div className="space-y-4">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      <Panel title="Company Details" subtitle={canEdit ? undefined : "Only an admin can change these."}>
        <form onSubmit={(event) => { event.preventDefault(); if (dirty && trimmed) void run((token) => updateCompany(token, { company_name: trimmed }), "Company name saved."); }} className="space-y-4">
          <div className="flex max-w-[420px] flex-col gap-1.5">
            <label htmlFor="company-name" className="text-xs font-semibold text-[#4B5060]">Company Name</label>
            <input id="company-name" value={name} maxLength={120} disabled={!canEdit || busy} onChange={(event) => setName(event.target.value)} className="crm-input" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#4B5060]">Company Logo</span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#0E4D3A] p-2">
                {logo ? <img src={logo} alt={`${company.company_name} logo`} className="max-h-full max-w-full object-contain" /> : <Icon className="h-6 w-6 text-white/60">{icons.upload}</Icon>}
              </span>
              <div className="flex flex-col gap-1.5">
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Upload logo" onChange={(event) => { pickLogo(event.target.files?.[0]); event.target.value = ""; }} />
                    <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}
                      className={secondaryButton}>
                      Upload new logo
                    </button>
                    {logo && (
                      <button type="button" disabled={busy} onClick={() => void run((token) => updateCompany(token, { company_logo_url: "" }), "Logo removed.")}
                        className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                        Remove
                      </button>
                    )}
                  </div>
                )}
                <span className="text-[11.5px] text-[#9AA0AC]">PNG or JPG, up to 2MB. Square images look best.</span>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button type="submit" disabled={busy || !dirty || !trimmed} className={accentButton}>{busy ? "Saving…" : "Save Changes"}</button>
            </div>
          )}
        </form>
      </Panel>
    </div>
  );
}
