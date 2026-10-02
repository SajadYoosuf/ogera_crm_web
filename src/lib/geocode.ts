// Shared Nominatim geocoding for the map tabs. Results are cached in
// localStorage because Nominatim asks for <=1 request/second, so a cold
// resolve of a few hundred records is slow enough to be worth persisting.

const CACHE_KEY = "ogera_map_geocode_cache_v1";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GeocodeCache = Record<string, GeoPoint>;

export function readGeocodeCache(): GeocodeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GeocodeCache) : {};
  } catch {
    return {};
  }
}

export function writeGeocodeCache(cache: GeocodeCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded or storage disabled — losing the cache only costs speed.
  }
}

export async function geocodeLocation(query: string): Promise<GeoPoint | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${query}, Kerala, India`)}&limit=1&countrycodes=in`;
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseCoordinate(latitude?: string | null, longitude?: string | null): GeoPoint | null {
  if (!latitude || !longitude) return null;
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

export const GEOCODE_INTERVAL_MS = 1100;
