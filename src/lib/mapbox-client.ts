/** Browser-side Mapbox lookups using the public (pk.) token.
 *  Used as a fallback when the server has no MAPBOX_ACCESS_TOKEN. */

const BASE = "https://api.mapbox.com";

function publicToken() {
  const token = import.meta.env["VITE_MAPBOX_PUBLIC_TOKEN"] as string | undefined;
  if (!token) throw new Error("Map search is not configured yet.");
  return token;
}

export type GeocodeHit =
  | { found: true; formattedAddress: string; latitude: number; longitude: number }
  | { found: false };

export async function geocodeInBrowser(address: string): Promise<GeocodeHit> {
  const res = await fetch(
    `${BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&language=en&access_token=${publicToken()}`,
  );
  if (!res.ok) throw new Error("Address search failed. Please try again.");
  const json = (await res.json()) as { features?: Array<{ place_name: string; center: [number, number] }> };
  const hit = json.features?.[0];
  if (!hit) return { found: false };
  return { found: true, formattedAddress: hit.place_name, latitude: hit.center[1], longitude: hit.center[0] };
}

export type RouteHit =
  | {
      found: true;
      distanceKm: number;
      durationMinutes: number;
      summary: string;
      path: Array<[number, number]>;
      steps: string[];
    }
  | { found: false };

export async function routeInBrowser(o: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}): Promise<RouteHit> {
  const coords = `${o.originLng},${o.originLat};${o.destLng},${o.destLat}`;
  const res = await fetch(
    `${BASE}/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&overview=full&steps=true&language=en&alternatives=false&access_token=${publicToken()}`,
  );
  if (!res.ok) throw new Error("Directions lookup failed. Please try again.");
  const json = (await res.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: Array<[number, number]> };
      legs?: Array<{ summary?: string; steps?: Array<{ maneuver?: { instruction?: string } }> }>;
    }>;
  };
  const route = json.routes?.[0];
  if (!route) return { found: false };
  const leg = route.legs?.[0];
  return {
    found: true,
    distanceKm: Math.round(((route.distance ?? 0) / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
    summary: leg?.summary || "Best available route",
    path: (route.geometry?.coordinates ?? []) as Array<[number, number]>,
    steps: (leg?.steps ?? [])
      .map((s) => s.maneuver?.instruction)
      .filter((s): s is string => Boolean(s))
      .slice(0, 14),
  };
}
