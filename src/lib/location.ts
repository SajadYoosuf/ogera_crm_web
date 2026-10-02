export interface GeolocationResult {
  latitude: string;
  longitude: string;
  address: string;
  isOffline: boolean;
}

function fallbackResult(latitude: number, longitude: number): GeolocationResult {
  return {
    latitude: String(latitude),
    longitude: String(longitude),
    address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (GPS captured, address pending)`,
    isOffline: true,
  };
}

/**
 * Gets GPS coordinates from the browser and reverse-geocodes them into a
 * human-readable address via OpenStreetMap Nominatim. Falls back to raw
 * coordinates if the device is offline or the geocoding request fails.
 */
export async function getGPSLocationAndGeocode(): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          resolve(fallbackResult(latitude, longitude));
          return;
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } },
          );
          if (!response.ok) throw new Error("Geocoding service unavailable");
          const data = await response.json() as { display_name?: string; address?: Record<string, string> };
          const addr = data.address || {};
          const parts = [addr.road, addr.suburb || addr.village || addr.town || addr.city, addr.state_district || addr.district || addr.county, addr.state, addr.postcode].filter(Boolean);
          const address = data.display_name || parts.join(", ") || `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
          resolve({ latitude: String(latitude), longitude: String(longitude), address, isOffline: false });
        } catch {
          resolve(fallbackResult(latitude, longitude));
        }
      },
      (error) => {
        let message = "Failed to get GPS location";
        if (error.code === error.PERMISSION_DENIED) message = "Location permission denied. Please allow location access in your browser.";
        else if (error.code === error.POSITION_UNAVAILABLE) message = "Location position unavailable. Please check your GPS signal.";
        else if (error.code === error.TIMEOUT) message = "Location request timed out. Please try again.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
