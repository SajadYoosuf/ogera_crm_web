"use client";

/**
 * WhatsAppTab — Settings → WhatsApp.
 *
 * Stores the tenant's WhatsApp Business API credentials (GET/PUT /whatsapp/config):
 *   - Status: connected / error / not connected, with what Meta reported, and the Test / Subscribe / Disconnect actions
 *   - Credentials: phone number ID, WABA ID, access token, app secret, app ID, API version
 *   - Webhook: the URL and verify token to paste into the Meta app
 *
 * The access token and app secret are write-only. The API only says whether they are saved, so their
 * inputs start empty and a blank value means "keep the saved one".
 * Viewing needs `integrations` read; saving, testing and disconnecting need `integrations` update.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canDo } from "@/lib/shared/roles";
import {
  disconnectWhatsApp,
  getWhatsAppConfig,
  rotateWhatsAppVerifyToken,
  saveWhatsAppConfig,
  subscribeWhatsApp,
  testWhatsAppConnection,
  type WhatsAppConfig,
  type WhatsAppStatus,
} from "@/features/whatsapp/api/config";
import { ErrorBlock, Panel, Spinner, Toast, accentButton, errorText, secondaryButton } from "./ui";

const DIGITS = /^\d{5,50}$/;
const OPTIONAL_DIGITS = /^\d{0,50}$/;
const API_VERSION = /^v\d{1,2}\.\d{1,2}$/;

const inputClass = "h-10 w-full rounded-[8px] border border-[#E1E1E6] px-3 text-sm disabled:bg-[#F6F6F8] disabled:text-[#8A8F9C]";
const labelClass = "mb-1 block text-xs font-semibold text-[#3A3E4A]";
const hintClass = "mt-1 text-xs text-[#8A8F9C]";
const errorClass = "mt-1 text-xs font-medium text-rose-600";

const STATUS_BADGE: Record<WhatsAppStatus, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  error: { label: "Connection error", className: "bg-rose-50 text-rose-700 border-rose-200" },
  disconnected: { label: "Not connected", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

type Draft = {
  phoneNumberId: string;
  wabaId: string;
  appId: string;
  businessId: string;
  apiVersion: string;
  accessToken: string;
  appSecret: string;
};

const draftFrom = (c: WhatsAppConfig | null): Draft => ({
  phoneNumberId: c?.phone_number_id ?? "",
  wabaId: c?.waba_id ?? "",
  appId: c?.app_id ?? "",
  businessId: c?.business_id ?? "",
  apiVersion: c?.api_version ?? "v21.0",
  accessToken: "",
  appSecret: "",
});

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function WhatsAppTab() {
  const { token, user } = useAuth();
  const canEdit = canDo(user, "integrations", "u");

  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft>(draftFrom(null));
  const [busy, setBusy] = useState<"" | "save" | "test" | "subscribe" | "rotate" | "disconnect">("");
  const [confirm, setConfirm] = useState<"" | "disconnect" | "rotate">("");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view WhatsApp settings."); return; }
    setLoadError("");
    try {
      const loaded = await getWhatsAppConfig(token);
      setConfig(loaded);
      setDraft(draftFrom(loaded));
    } catch (caught) {
      setLoadError(errorText(caught, "WhatsApp settings could not be loaded."));
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(
      () => setNotice({ text: `${what} copied.`, tone: "ok" }),
      () => setNotice({ text: "Copy failed — select the text and copy it by hand.", tone: "error" }),
    );
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!config) return <Spinner />;

  const phoneError = draft.phoneNumberId && !DIGITS.test(draft.phoneNumberId.trim()) ? "Digits only, at least 5." : "";
  const wabaError = draft.wabaId && !DIGITS.test(draft.wabaId.trim()) ? "Digits only, at least 5." : "";
  const appIdError = !OPTIONAL_DIGITS.test(draft.appId.trim()) ? "Digits only." : "";
  const businessIdError = !OPTIONAL_DIGITS.test(draft.businessId.trim()) ? "Digits only." : "";
  const versionError = !API_VERSION.test(draft.apiVersion.trim()) ? "Use the form v21.0." : "";
  const tokenMissing = !config.has_access_token && !draft.accessToken.trim();
  const canSave =
    canEdit && busy === "" &&
    DIGITS.test(draft.phoneNumberId.trim()) && DIGITS.test(draft.wabaId.trim()) &&
    !appIdError && !businessIdError && !versionError && !tokenMissing;

  async function run<T>(kind: NonNullable<typeof busy>, action: (t: string) => Promise<T>, onDone: (result: T) => void, fallback: string) {
    if (!token) return;
    setBusy(kind); setNotice(null);
    try { onDone(await action(token)); }
    catch (caught) { setNotice({ text: errorText(caught, fallback), tone: "error" }); }
    finally { setBusy(""); setConfirm(""); }
  }

  const save = () => run("save", (t) => saveWhatsAppConfig(t, {
    phone_number_id: draft.phoneNumberId.trim(),
    waba_id: draft.wabaId.trim(),
    app_id: draft.appId.trim(),
    business_id: draft.businessId.trim(),
    api_version: draft.apiVersion.trim(),
    ...(draft.accessToken.trim() ? { access_token: draft.accessToken.trim() } : {}),
    ...(draft.appSecret.trim() ? { app_secret: draft.appSecret.trim() } : {}),
  }), (saved) => {
    setConfig(saved);
    setDraft(draftFrom(saved));
    setNotice({ text: "Saved. Use Test connection to check it with Meta.", tone: "ok" });
  }, "The settings could not be saved.");

  const test = () => run("test", testWhatsAppConnection, (result) => {
    setConfig(result.config);
    setNotice({ text: result.ok ? "Connected to WhatsApp." : result.detail, tone: result.ok ? "ok" : "error" });
  }, "The connection could not be tested.");

  const subscribe = () => run("subscribe", subscribeWhatsApp, (result) => {
    setNotice({ text: "Subscribed. Meta will now send messages and template updates to the webhook.", tone: result.ok ? "ok" : "error" });
  }, "Subscribing failed.");

  const rotate = () => run("rotate", rotateWhatsAppVerifyToken, (updated) => {
    setConfig(updated);
    setNotice({ text: "New verify token created. Paste it into the Meta webhook settings.", tone: "ok" });
  }, "The verify token could not be changed.");

  const disconnect = () => run("disconnect", disconnectWhatsApp, () => {
    setConfig({ ...config, configured: false, status: "disconnected", has_access_token: false, has_app_secret: false, access_token_hint: null, verify_token: null, last_error: null });
    setDraft(draftFrom(null));
    setNotice({ text: "WhatsApp disconnected and the saved credentials deleted.", tone: "ok" });
  }, "WhatsApp could not be disconnected.");

  const badge = STATUS_BADGE[config.status] ?? STATUS_BADGE.disconnected;

  return (
    <div className="space-y-5">
      {notice && <Toast message={notice.text} tone={notice.tone} />}
      {!canEdit && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view these settings but not change them.
        </p>
      )}

      <Panel
        title="Connection"
        subtitle="Checked against Meta when you press Test connection."
        status={<span data-testid="wa-status" className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>}
      >
        {config.configured ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-[#8A8F9C]">Number</dt><dd className="font-semibold text-[#1A1C21]">{config.display_phone_number ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#8A8F9C]">Verified name</dt><dd className="font-semibold text-[#1A1C21]">{config.verified_name ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#8A8F9C]">Quality rating</dt><dd className="font-semibold text-[#1A1C21]">{config.quality_rating ?? "—"}</dd></div>
            <div><dt className="text-xs text-[#8A8F9C]">Last checked</dt><dd className="font-semibold text-[#1A1C21]">{formatWhen(config.last_checked_at)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-[#5B5F6B]">Enter your WhatsApp Business details below and save to connect.</p>
        )}
        {config.last_error && config.status === "error" && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{config.last_error}</p>
        )}
        {config.configured && canEdit && (
          <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <button type="button" className={accentButton} disabled={busy !== ""} onClick={() => void test()}>
              {busy === "test" ? "Testing…" : "Test connection"}
            </button>
            <button type="button" className={secondaryButton} disabled={busy !== ""} onClick={() => void subscribe()}>
              {busy === "subscribe" ? "Subscribing…" : "Subscribe to webhook events"}
            </button>
            {confirm === "disconnect" ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-red-700">Delete the saved credentials?</span>
                <button type="button" disabled={busy !== ""} onClick={() => void disconnect()} className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white">Disconnect</button>
                <button type="button" onClick={() => setConfirm("")} className="rounded-md border border-gray-200 px-2.5 py-1">Cancel</button>
              </span>
            ) : (
              <button type="button" disabled={busy !== ""} onClick={() => setConfirm("disconnect")} className="ml-auto text-xs font-semibold text-red-600 hover:underline">Disconnect</button>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Credentials" subtitle="From the Meta developer console and Business Manager. Secrets are stored encrypted and are never shown again.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSave) void save(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wa-phone-id" className={labelClass}>Phone number ID</label>
              <input id="wa-phone-id" className={inputClass} value={draft.phoneNumberId} onChange={set("phoneNumberId")} disabled={!canEdit} inputMode="numeric" autoComplete="off" />
              {phoneError ? <p className={errorClass}>{phoneError}</p> : <p className={hintClass}>WhatsApp → API Setup → Phone number ID</p>}
            </div>
            <div>
              <label htmlFor="wa-waba-id" className={labelClass}>WhatsApp Business Account ID</label>
              <input id="wa-waba-id" className={inputClass} value={draft.wabaId} onChange={set("wabaId")} disabled={!canEdit} inputMode="numeric" autoComplete="off" />
              {wabaError ? <p className={errorClass}>{wabaError}</p> : <p className={hintClass}>WhatsApp → API Setup → WhatsApp Business Account ID</p>}
            </div>
          </div>

          <div>
            <label htmlFor="wa-token" className={labelClass}>Access token</label>
            <input id="wa-token" type="password" className={inputClass} value={draft.accessToken} onChange={set("accessToken")} disabled={!canEdit}
              autoComplete="new-password" placeholder={config.has_access_token ? `Saved (${config.access_token_hint ?? "hidden"}) — type to replace` : "Paste a permanent system-user token"} />
            <p className={hintClass}>Needs whatsapp_business_management and whatsapp_business_messaging.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wa-secret" className={labelClass}>App secret</label>
              <input id="wa-secret" type="password" className={inputClass} value={draft.appSecret} onChange={set("appSecret")} disabled={!canEdit}
                autoComplete="new-password" placeholder={config.has_app_secret ? "Saved — type to replace" : "Optional, checks webhook signatures"} />
              <p className={hintClass}>Strongly recommended: lets the server reject forged webhook calls.</p>
            </div>
            <div>
              <label htmlFor="wa-app-id" className={labelClass}>App ID</label>
              <input id="wa-app-id" className={inputClass} value={draft.appId} onChange={set("appId")} disabled={!canEdit} inputMode="numeric" autoComplete="off" />
              {appIdError ? <p className={errorClass}>{appIdError}</p> : <p className={hintClass}>Needed to upload image, video or document template headers.</p>}
            </div>
            <div>
              <label htmlFor="wa-business-id" className={labelClass}>Business ID (optional)</label>
              <input id="wa-business-id" className={inputClass} value={draft.businessId} onChange={set("businessId")} disabled={!canEdit} inputMode="numeric" autoComplete="off" />
              {businessIdError && <p className={errorClass}>{businessIdError}</p>}
            </div>
            <div>
              <label htmlFor="wa-version" className={labelClass}>API version</label>
              <input id="wa-version" className={inputClass} value={draft.apiVersion} onChange={set("apiVersion")} disabled={!canEdit} autoComplete="off" />
              {versionError && <p className={errorClass}>{versionError}</p>}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-3">
              <button type="submit" className={accentButton} disabled={!canSave}>{busy === "save" ? "Saving…" : "Save"}</button>
              {tokenMissing && <span className="text-xs text-[#8A8F9C]">Enter the access token to save.</span>}
            </div>
          )}
        </form>
      </Panel>

      <Panel title="Webhook" subtitle="In the Meta app: WhatsApp → Configuration → Webhook. Subscribe to messages and message_template_status_update.">
        {config.configured && config.verify_token ? (
          <div className="space-y-3">
            <div>
              <p className={labelClass}>Callback URL</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <code data-testid="wa-webhook-url" className="block min-w-0 flex-1 break-all rounded-lg bg-[#F6F6F8] px-3 py-2 text-xs text-[#1A1C21]">{config.webhook_url}</code>
                <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={() => copy(config.webhook_url ?? "", "Callback URL")}>Copy</button>
              </div>
            </div>
            <div>
              <p className={labelClass}>Verify token</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <code data-testid="wa-verify-token" className="block min-w-0 flex-1 break-all rounded-lg bg-[#F6F6F8] px-3 py-2 text-xs text-[#1A1C21]">{config.verify_token}</code>
                <button type="button" className={`${secondaryButton} w-full sm:w-auto`} onClick={() => copy(config.verify_token ?? "", "Verify token")}>Copy</button>
              </div>
              {canEdit && (confirm === "rotate" ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="basis-full text-amber-800 sm:basis-auto">Meta will reject the webhook until you paste the new token there.</span>
                  <button type="button" disabled={busy !== ""} onClick={() => void rotate()} className="rounded-md bg-[#0E4D3A] px-2.5 py-1 font-semibold text-white">Generate</button>
                  <button type="button" onClick={() => setConfirm("")} className="rounded-md border border-gray-200 px-2.5 py-1">Cancel</button>
                </p>
              ) : (
                <button type="button" onClick={() => setConfirm("rotate")} className="mt-2 text-xs font-semibold text-[#0E4D3A] hover:underline">Generate a new verify token</button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#5B5F6B]">Save your credentials to get the callback URL and verify token.</p>
        )}
      </Panel>
    </div>
  );
}
