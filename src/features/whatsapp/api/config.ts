/**
 * WhatsApp connection settings API (Settings → WhatsApp).
 *
 * The API never returns the access token or app secret: only whether they are saved
 * (`has_*`) and a masked hint. To change a secret, send a new value; leave it out to keep the saved one.
 */

import { apiCall } from "@/lib/api/auth";

export type WhatsAppStatus = "connected" | "disconnected" | "error";

export type WhatsAppConfig = {
  configured: boolean;
  phone_number_id: string | null;
  waba_id: string | null;
  app_id: string | null;
  business_id: string | null;
  api_version: string;
  has_access_token: boolean;
  /** e.g. "EAAG…x7Qz" */
  access_token_hint: string | null;
  has_app_secret: boolean;
  verify_token: string | null;
  webhook_url: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  status: WhatsAppStatus;
  connected_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

export type WhatsAppConfigInput = {
  phone_number_id: string;
  waba_id: string;
  app_id?: string;
  business_id?: string;
  api_version: string;
  access_token?: string;
  app_secret?: string;
};

export type WhatsAppTestResult = {
  ok: boolean;
  status: WhatsAppStatus;
  detail: string;
  config: WhatsAppConfig;
};

/** GET /whatsapp/config */
export const getWhatsAppConfig = (token: string): Promise<WhatsAppConfig> =>
  apiCall<WhatsAppConfig>(token, "GET", "/whatsapp/config");

/** PUT /whatsapp/config */
export const saveWhatsAppConfig = (token: string, input: WhatsAppConfigInput): Promise<WhatsAppConfig> =>
  apiCall<WhatsAppConfig>(token, "PUT", "/whatsapp/config", input);

/** POST /whatsapp/config/test — asks Meta whether the saved credentials work. */
export const testWhatsAppConnection = (token: string): Promise<WhatsAppTestResult> =>
  apiCall<WhatsAppTestResult>(token, "POST", "/whatsapp/config/test", undefined, 30_000);

/** POST /whatsapp/config/subscribe — subscribes the Meta app to this WABA's webhook events. */
export const subscribeWhatsApp = (token: string): Promise<{ ok: boolean; detail: string }> =>
  apiCall<{ ok: boolean; detail: string }>(token, "POST", "/whatsapp/config/subscribe", undefined, 30_000);

/** POST /whatsapp/config/rotate-verify-token */
export const rotateWhatsAppVerifyToken = (token: string): Promise<WhatsAppConfig> =>
  apiCall<WhatsAppConfig>(token, "POST", "/whatsapp/config/rotate-verify-token");

/** DELETE /whatsapp/config — disconnects and deletes the stored credentials. */
export const disconnectWhatsApp = (token: string): Promise<void> =>
  apiCall<void>(token, "DELETE", "/whatsapp/config");
