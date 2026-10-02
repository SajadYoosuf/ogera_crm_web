import { ApiError, request } from "./auth";

export type StaffState = "moving" | "stuck" | "location_disabled" | "connection_lost" | "signed_out";

export type StaffLocation = {
  userId: number;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  recordedAt: string | null;
  state: StaffState;
  colorIndex: number;
  batteryLevel?: number | null;
  speed?: number | null;
};

export type RoutePoint = { latitude: number; longitude: number; address: string | null; recordedAt: string; state: "moving" | "stuck" };
export type RouteStop = { latitude: number; longitude: number; arrivedAt: string; leftAt: string; dwellMs: number; address: string | null };
export type StaffRoute = { points: RoutePoint[]; stops?: RouteStop[]; distanceMeters: number; firstSeen?: string | null; lastSeen?: string | null };

/** Admin and manager routes: a 401 means the session expired, a 403 means the role may not view the map. */
async function authed<T>(path: string, accessToken: string): Promise<T> {
  try {
    return await request<T>(path, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "Only admins and managers can view the field map.", 403);
    throw error;
  }
}

/** GET /staff/locations/live — newest position and status of every reporting staff member. */
export async function listLiveStaff(accessToken: string): Promise<StaffLocation[]> {
  const result = await authed<{ staff: StaffLocation[] }>("/staff/locations/live", accessToken);
  return Array.isArray(result.staff) ? result.staff : [];
}

/** GET /staff/locations/history — one staff member's route for one day (India time, YYYY-MM-DD). */
export const getStaffRoute = (accessToken: string, userId: number, date: string) =>
  authed<StaffRoute>(`/staff/locations/history?userId=${userId}&date=${date}`, accessToken);
