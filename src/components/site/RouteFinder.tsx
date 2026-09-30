import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Navigation, Clock, Route as RouteIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LazyMap } from "@/components/LazyMap";
import type { MapPin } from "@/components/MapCanvas";
import { geocodeAddress, routeToSite } from "@/lib/maps.functions";
import { geocodeInBrowser, routeInBrowser } from "@/lib/mapbox-client";
import { COMPANY } from "@/lib/prop3000";

type RouteResult = {
  distanceKm: number;
  durationMinutes: number;
  summary: string;
  path: Array<[number, number]>;
  steps: string[];
};

/** Address lookup + best driving route from the Prop3000 office to the property. */
export function RouteFinder({ initialAddress = "" }: { initialAddress?: string }) {
  const geocode = useServerFn(geocodeAddress);
  const getRoute = useServerFn(routeToSite);
  const [address, setAddress] = useState(initialAddress);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);

  async function findRoute() {
    const value = address.trim();
    if (value.length < 4) {
      toast.error("Enter a street address, suburb or town.");
      return;
    }
    setBusy(true);
    setRoute(null);
    try {
      // Try the server lookup first, fall back to browser lookups with the public token.
      const hit = await geocode({ data: { address: value } }).catch(() => geocodeInBrowser(value));
      if (!hit.found) {
        toast.error("We couldn't find that address. Try adding the suburb or city.");
        setResolved(null);
        return;
      }
      setResolved({ label: hit.formattedAddress, lat: hit.latitude, lng: hit.longitude });

      const trip = {
        originLat: COMPANY.baseCoords.lat,
        originLng: COMPANY.baseCoords.lng,
        destLat: hit.latitude,
        destLng: hit.longitude,
      };
      const directions = await getRoute({ data: trip }).catch(() => routeInBrowser(trip));
      if (directions.found) setRoute(directions);
      else toast.error("No driving route found to that address.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Route lookup failed.");
    } finally {
      setBusy(false);
    }
  }


  const pins: MapPin[] = [
    { ...COMPANY.baseCoords, label: "Prop3000 office", kind: "office" },
    ...(resolved ? [{ lat: resolved.lat, lng: resolved.lng, label: resolved.label, kind: "site" as const }] : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <h3 className="text-display text-2xl text-foreground">Find the best route</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop in the property address — we'll plot the fastest live-traffic route from our office so the crew arrives
          on time.
        </p>

        <div className="mt-4 flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void findRoute();
            }}
            placeholder="e.g. 12 Main Road, Kuils River"
            maxLength={300}
            aria-label="Property address"
          />
          <Button variant="accent" onClick={() => void findRoute()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Route
          </Button>
        </div>

        {resolved && (
          <p className="mt-3 flex items-start gap-2 text-sm text-foreground">
            <Navigation className="mt-0.5 size-4 shrink-0 text-accent" />
            {resolved.label}
          </p>
        )}

        {route && (
          <div className="animate-fade-up mt-4 rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-2 font-semibold">
                <RouteIcon className="size-4 text-accent" /> {route.distanceKm} km
              </span>
              <span className="flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-accent" /> {route.durationMinutes} min
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Via {route.summary}</p>
            {route.steps.length > 0 && (
              <ol className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1 text-sm text-muted-foreground">
                {route.steps.map((step, index) => (
                  <li key={`${index}-${step}`} className="flex gap-2">
                    <span className="text-accent">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-3">
        <LazyMap pins={pins} path={route?.path} className="h-[22rem] w-full" zoom={11} />
      </div>
    </div>
  );
}
