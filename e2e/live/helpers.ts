import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

/** The seeded backend (tests/e2e_server.py). Override with LIVE_API_URL. */
export const API = process.env.LIVE_API_URL ?? "http://127.0.0.1:8765";
export const PASSWORD = "Passw0rd!";
export const email = (key: string) => `${key}@example.com`;

export type Session = { token: string; id: number; name: string; role: string };

/** Log in through the API as a seeded employee: anu (sales), raj (field), manager, admin. */
export async function apiSession(key: string): Promise<Session> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post("/auth/login", { data: { email: email(key), password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  await api.dispose();
  return { token: body.access_token, id: body.employee.id, name: body.employee.name, role: body.employee.role };
}

export const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A unique 10-digit Indian mobile number per test run, so phone numbers never collide. */
export function freshPhone(): string {
  return `9${String(Date.now() % 1_000_000_000).padStart(9, "0")}`;
}

/** Create a consumer lead assigned to `session`, through the API. Returns its id. */
export async function createLead(api: APIRequestContext, session: Session, name: string): Promise<number> {
  const response = await api.post("/contacts", {
    headers: authed(session.token),
    data: {
      contact_type: "consumer", name, phone: freshPhone(), district: "Calicut", address: "House 1, Beach Road",
      lead_source_id: 1, assigned_to: session.id, consumer_profile: { house_stage: "ready" },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id;
}

export const isoDate = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
