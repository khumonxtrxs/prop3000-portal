import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { COMPANY } from "@/lib/prop3000";

export type MapPin = {
  lat: number;
  lng: number;
  label?: string | undefined;
  /** Short text shown on the pin itself, e.g. "R890k". */
  text?: string | undefined;
  active?: boolean | undefined;
  kind?: "site" | "office" | "listing" | undefined;
};

type Props = {
  pins: MapPin[];
  path?: Array<[number, number]> | undefined;
  className?: string | undefined;
  zoom?: number | undefined;
  onPinClick?: ((index: number) => void) | undefined;
};

/** Full class strings so Tailwind generates them; colours are design tokens only. */
const PIN_CLASSES = {
  label:
    "font-display cursor-pointer whitespace-nowrap rounded-sm border-2 border-card bg-primary px-2 py-1 text-sm font-bold text-primary-foreground shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  labelActive:
    "font-display cursor-pointer whitespace-nowrap rounded-sm border-2 border-card bg-accent px-2 py-1 text-sm font-bold text-accent-foreground shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  office: "size-4 cursor-pointer rounded-full border-2 border-card bg-primary-deep shadow-panel",
  site: "size-5 cursor-pointer rounded-full border-2 border-card bg-accent shadow-panel",
};

/** Browser-only Mapbox map. Render inside <ClientOnly> or a lazy boundary. */
export default function MapCanvas({ pins, path, className, zoom = 12, onPinClick }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = import.meta.env["VITE_MAPBOX_PUBLIC_TOKEN"] as string | undefined;
    if (!token) {
      setError("Map is not configured yet.");
      return;
    }
    if (!holder.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      mapRef.current = new mapboxgl.Map({
        container: holder.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [pins[0]?.lng ?? COMPANY.baseCoords.lng, pins[0]?.lat ?? COMPANY.baseCoords.lat],
        zoom,
        attributionControl: false,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    } catch {
      setError("Map could not be loaded right now.");
    }
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = pins.map((pin, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", pin.label ?? "Map location");
      if (pin.text) {
        el.className = pin.active ? PIN_CLASSES.labelActive : PIN_CLASSES.label;
        el.textContent = pin.text;
      } else {
        el.className = pin.kind === "office" ? PIN_CLASSES.office : PIN_CLASSES.site;
      }
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onPinClick?.(index);
      });
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]);
      if (pin.label && !onPinClick) marker.setPopup(new mapboxgl.Popup({ offset: 16 }).setText(pin.label));
      marker.addTo(map);
      return marker;
    });
  }, [pins, onPinClick]);

  // Route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const existing = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
      const geojson = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: path ?? [] },
      };
      if (existing) existing.setData(geojson);
      else {
        // Mapbox paints on a canvas and can't read CSS tokens, so the colour comes from --map-route in styles.css.
        const routeColour =
          getComputedStyle(document.documentElement).getPropertyValue("--map-route").trim() || "orange";
        map.addSource("route", { type: "geojson", data: geojson });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": routeColour, "line-width": 5 },
        });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [path]);

  // Fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: Array<[number, number]> = [...pins.map((p) => [p.lng, p.lat] as [number, number]), ...(path ?? [])];
    if (points.length > 1) {
      const bounds = points.reduce(
        (acc, point) => acc.extend(point),
        new mapboxgl.LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, { padding: 60, duration: 700, maxZoom: 15 });
    } else if (points[0]) {
      map.easeTo({ center: points[0], zoom });
    }
    // Refit only when the set of locations changes, not when a pin is highlighted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map((p) => `${p.lat},${p.lng}`).join("|"), path, zoom]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-sm border border-border bg-muted text-sm text-muted-foreground ${className ?? "h-64"}`}
      >
        {error}
      </div>
    );
  }

  return <div ref={holder} className={`overflow-hidden rounded-sm border border-border ${className ?? "h-64"}`} />;
}