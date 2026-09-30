import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAPBOX_API = "https://api.mapbox.com";

/** Server-side Mapbox token (secret sk. or public pk.). Never sent to the browser. */
function accessToken() {
  const token = process.env["MAPBOX_ACCESS_TOKEN"];
  if (!token) throw new Error("Map service is not configured");
  return token;
}

function mapsFailed(status: number, body: string) {
  console.error(`Mapbox request failed [${status}]: ${body}`);
  if (status === 401 || status === 403) return new Error("Map access was denied. Check the Mapbox token.");
  return new Error("Could not reach the map service. Please try again.");
}

/** Mapbox forward geocoding, biased to South Africa. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ address: z.string().trim().min(4).max(300) }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${MAPBOX_API}/geocoding/v5/mapbox.places/${encodeURIComponent(data.address)}.json?limit=1&country=za&language=en&access_token=${accessToken()}`,
    );
    if (!res.ok) throw mapsFailed(res.status, await res.text());
    const json = (await res.json()) as {
      features?: Array<{ place_name: string; center: [number, number] }>;
    };
    const hit = json.features?.[0];
    if (!hit) return { found: false as const };
    return {
      found: true as const,
      formattedAddress: hit.place_name,
      latitude: hit.center[1],
      longitude: hit.center[0],
    };
  });

/** Best driving route (live traffic) between two points via Mapbox Directions. */
export const routeToSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        originLat: z.number(),
        originLng: z.number(),
        destLat: z.number(),
        destLng: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const coords = `${data.originLng},${data.originLat};${data.destLng},${data.destLat}`;
    const res = await fetch(
      `${MAPBOX_API}/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&overview=full&steps=true&language=en&alternatives=false&access_token=${accessToken()}`,
    );
    if (!res.ok) throw mapsFailed(res.status, await res.text());
    const json = (await res.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
        legs?: Array<{
          summary?: string;
          steps?: Array<{ maneuver?: { instruction?: string } }>;
        }>;
      }>;
    };
    const route = json.routes?.[0];
    if (!route) return { found: false as const };
    const leg = route.legs?.[0];
    return {
      found: true as const,
      distanceKm: Math.round(((route.distance ?? 0) / 1000) * 10) / 10,
      durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
      summary: leg?.summary || "Best available route",
      path: (route.geometry?.coordinates ?? []) as Array<[number, number]>,
      steps: (leg?.steps ?? [])
        .map((s) => s.maneuver?.instruction)
        .filter((s): s is string => Boolean(s))
        .slice(0, 14),
    };
  });
