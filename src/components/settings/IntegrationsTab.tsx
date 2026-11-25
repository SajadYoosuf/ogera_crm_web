"use client";

/**
 * IntegrationsTab (admin) — API keys for the inbound lead channels.
 *
 * - List, create and revoke keys (GET/POST/DELETE /api-keys).
 * - A new key's raw value is shown ONCE; only its SHA-256 hash is stored.
 * - Ready-to-paste snippets: a website form (fetch) and a Google Sheet Apps Script,
 *   both posting to /leads/inbound/{website|sheet}/{tenant_slug} with X-Api-Key.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/api/auth";
import { createApiKey, listApiKeys, revealApiKey, revokeApiKey, type TenantApiKey } from "@/features/leads/api/leads";
import { ErrorBlock, Panel, Spinner, Toast, accentButton, errorText, secondaryButton } from "./ui";

/** The tenant slug is the `tenant` claim of the signed-in JWT (e.g. "ventino"). */
export function tenantSlugFromToken(token: string | null): string {
  if (!token) return "";
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const slug = (JSON.parse(json) as { tenant?: unknown }).tenant;
    return typeof slug === "string" ? slug : "";
  } catch {
    return "";
  }
}

export function websiteSnippet(base: string, slug: string, key: string): string {
  return `<script>
// Ogera CRM — send your enquiry form to the Leads inbox
async function sendLeadToOgera(form) {
  await fetch("${base}/leads/inbound/website/${slug}", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": "${key}" },
    body: JSON.stringify({
      first_name: form.name.value,
      phone: form.phone.value,
      address: form.address ? form.address.value : undefined,
      notes: form.notes ? form.notes.value : undefined,
    }),
  });
}
</script>`;
}

export function appsScriptSnippet(base: string, slug: string, key: string): string {
  return `// Google Sheet → Ogera CRM (Extensions → Apps Script). Add an "On form submit" or time trigger.
// Columns: A = first name, B = phone, C = email, D = ad name, E = form name, F = sent flag.
function sendNewRowsToOgera() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var last = sheet.getLastRow();
  for (var row = 2; row <= last; row++) {
    if (sheet.getRange(row, 6).getValue() === "sent") continue;
    var payload = {
      first_name: sheet.getRange(row, 1).getValue(),
      phone: String(sheet.getRange(row, 2).getValue()),
      address: sheet.getRange(row, 3).getValue(),
      ad_name: sheet.getRange(row, 4).getValue(),
      form_name: sheet.getRange(row, 5).getValue(),
    };
    var res = UrlFetchApp.fetch("${base}/leads/inbound/sheet/${slug}", {
      method: "post",
      contentType: "application/json",
      headers: { "X-Api-Key": "${key}" },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() < 300 || res.getResponseCode() === 409) sheet.getRange(row, 6).setValue("sent");
  }
}`;
}

export default function IntegrationsTab() {
  const { token } = useAuth();
  const slug = tenantSlugFromToken(token);
  const [keys, setKeys] = useState<TenantApiKey[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view integrations."); return; }
    setLoadError("");
    try { setKeys(await listApiKeys(token)); }
    catch (caught) { setLoadError(errorText(caught, "API keys could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create() {
    if (!token || !label.trim()) return;
    setBusy(true); setNotice(null);
    try {
      const created = await createApiKey(token, label.trim());
      setNewKey(created.raw_key);
      setLabel("");
      await load();
    } catch (caught) { setNotice({ text: errorText(caught, "The key could not be created."), tone: "error" }); }
    finally { setBusy(false); }
  }

  async function revoke(id: number) {
    if (!token) return;
    setBusy(true); setNotice(null);
    try {
      await revokeApiKey(token, id);
      setConfirmId(null);
      setNotice({ text: "Key revoked. Scripts using it will stop working.", tone: "ok" });
      await load();
    } catch (caught) { setNotice({ text: errorText(caught, "The key could not be revoked."), tone: "error" }); }
    finally { setBusy(false); }
  }

  /** Fetches a stored key from the server and copies its raw value. */
  async function copyStoredKey(id: number) {
    if (!token) return;
    setBusy(true); setNotice(null);
    try {
      const { raw_key } = await revealApiKey(token, id);
      await navigator.clipboard.writeText(raw_key);
      setNotice({ text: "API key copied to clipboard.", tone: "ok" });
    } catch (caught) {
      setNotice({ text: errorText(caught, "The key could not be copied."), tone: "error" });
    } finally { setBusy(false); }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => setNotice({ text: "Copied to clipboard.", tone: "ok" }),
      () => setNotice({ text: "Copy failed — select the text and copy it by hand.", tone: "error" }),
    );
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!keys) return <Spinner />;

  const shownKey = newKey ?? "YOUR_API_KEY";
  const active = keys.filter((k) => k.is_active);

  return (
    <div className="space-y-5">
      {notice && <Toast message={notice.text} tone={notice.tone} />}

      <Panel title="API keys" subtitle="Website forms and Google Sheets use a key to send leads into Ogera CRM.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Key label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60}
            placeholder="Label, e.g. Website form" className="h-10 flex-1 rounded-[8px] border border-[#E1E1E6] px-3 text-sm" />
          <button type="button" className={accentButton} disabled={busy || !label.trim()} onClick={() => void create()}>
            Generate key
          </button>
        </div>

        {newKey && (
          <div role="status" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Copy this key now — it will not be shown again.</p>
            <code data-testid="new-api-key" className="block break-all rounded-lg bg-white px-3 py-2 text-xs text-[#1A1C21]">{newKey}</code>
            <div className="flex gap-2">
              <button type="button" className={secondaryButton} onClick={() => copy(newKey)}>Copy key</button>
              <button type="button" className={secondaryButton} onClick={() => setNewKey(null)}>I&apos;ve saved it</button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#DEE1E5] px-4 py-6 text-center text-sm text-gray-500">No API keys yet.</p>
        ) : (
          <ul className="divide-y divide-[#F0F0F3] rounded-xl border border-[#E5E7EA]">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1A1C21]">{k.label}</p>
                  <p className="text-xs text-[#8A8F9C]">Created {new Date(k.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                  {k.is_active && k.can_reveal && (
                    <button type="button" disabled={busy} onClick={() => void copyStoredKey(k.id)} className={secondaryButton}>
                      Copy key
                    </button>
                  )}
                  {k.is_active && !k.can_reveal && (
                    <span className="text-xs text-gray-500">Created before copying was enabled — generate a new key to copy it.</span>
                  )}
                  {!k.is_active ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">Revoked</span>
                  ) : confirmId === k.id ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-red-700">Revoke this key?</span>
                      <button type="button" disabled={busy} onClick={() => void revoke(k.id)} className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white">Revoke</button>
                      <button type="button" onClick={() => setConfirmId(null)} className="rounded-md border border-gray-200 px-2.5 py-1">Cancel</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(k.id)} className="text-xs font-semibold text-red-600 hover:underline">Revoke</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Website form" subtitle={`Posts to /leads/inbound/website/${slug || "<tenant>"}`}>
        {active.length === 0 && !newKey && <p className="text-xs text-amber-700">Generate a key first, then paste it where the snippet says YOUR_API_KEY.</p>}
        <pre className="max-h-64 overflow-auto rounded-xl bg-[#0F172A] p-4 text-xs leading-relaxed text-[#E2E8F0]">{websiteSnippet(API_BASE_URL, slug, shownKey)}</pre>
        <button type="button" className={secondaryButton} onClick={() => copy(websiteSnippet(API_BASE_URL, slug, shownKey))}>Copy snippet</button>
      </Panel>

      <Panel title="Google Sheet (Apps Script)" subtitle={`Posts to /leads/inbound/sheet/${slug || "<tenant>"} — for Meta Ads leads exported to a sheet`}>
        <pre className="max-h-64 overflow-auto rounded-xl bg-[#0F172A] p-4 text-xs leading-relaxed text-[#E2E8F0]">{appsScriptSnippet(API_BASE_URL, slug, shownKey)}</pre>
        <button type="button" className={secondaryButton} onClick={() => copy(appsScriptSnippet(API_BASE_URL, slug, shownKey))}>Copy script</button>
      </Panel>
    </div>
  );
}
