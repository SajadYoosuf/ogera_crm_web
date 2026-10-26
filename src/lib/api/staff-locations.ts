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
};

export type RoutePoint = { latitude: number; longitude: number; address: string | null; recordedAt: string; state: string };
export type StaffRoute = { points: RoutePoint[]; stops?: { address: string | null; arrivedAt: string; leftAt: string }[]; distanceMeters: number; firstSeen?: string | null; lastSeen?: string | null };

function authed<T>(path: string, accessToken: string) {
  return request<T>(path, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
}

export async function listLiveStaff(accessToken: string) {
  try {
    const result = await authed<StaffLocation[] | { staff: StaffLocation[] }>("/staff/locations/live", accessToken);
    return Array.isArray(result) ? result : result.staff ?? [];
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "Only admins and managers can view the field map.", 403);
    throw error;
  }
}

export async function getStaffRoute(accessToken: string, userId: number, date: string) {
  return authed<StaffRoute>(`/staff/locations/history?userId=${userId}&date=${encodeURIComponent(date)}`, accessToken);
}
