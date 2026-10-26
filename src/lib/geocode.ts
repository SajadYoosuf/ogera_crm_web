// Shared Nominatim geocoding for the map tabs. Results are cached in
// localStorage because Nominatim asks for <=1 request/second, so a cold
// resolve of a few hundred records is slow enough to be worth persisting.

const CACHE_KEY = "ogera_map_geocode_cache_v1";
const REVERSE_CACHE_KEY = "ogera_map_reverse_geocode_cache_v1";

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

type ReverseGeocodeCache = Record<string, string>;

function coordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function readReverseGeocodeCache(): ReverseGeocodeCache {
  try {
    const raw = localStorage.getItem(REVERSE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ReverseGeocodeCache) : {};
  } catch {
    return {};
  }
}

function writeReverseGeocodeCache(cache: ReverseGeocodeCache) {
  try {
    localStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded or storage disabled — losing the cache only costs speed.
  }
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<string | null> {
  const key = coordinateKey(latitude, longitude);
  const cache = readReverseGeocodeCache();
  if (cache[key]) return cache[key];

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json() as { display_name?: string };
    const address = data.display_name?.trim() || null;
    if (address) {
      writeReverseGeocodeCache({ ...cache, [key]: address });
    }
    return address;
  } catch {
    return null;
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
