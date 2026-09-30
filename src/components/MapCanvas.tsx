import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { COMPANY } from "@/lib/prop3000";

export type MapPin = {
  lat: number;
  lng: number;
  label?: string | undefined;
  kind?: "site" | "office" | "listing" | undefined;
};

type Props = {
  pins: MapPin[];
  path?: Array<[number, number]> | undefined;
  className?: string | undefined;
  zoom?: number | undefined;
  onPinClick?: ((index: number) => void) | undefined;
};

const COLORS: Record<string, string> = {
  office: "#1b3a7a",
  site: "#f2a127",
  listing: "#b4472e",
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
      el.style.cssText = `width:${pin.kind === "office" ? 16 : 20}px;height:${
        pin.kind === "office" ? 16 : 20
      }px;border-radius:9999px;border:2px solid #fff;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35);background:${
        COLORS[pin.kind ?? "site"] ?? COLORS["site"]
      }`;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onPinClick?.(index);
      });
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]);
      if (pin.label) marker.setPopup(new mapboxgl.Popup({ offset: 16 }).setText(pin.label));
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
        map.addSource("route", { type: "geojson", data: geojson });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f2a127", "line-width": 5 },
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
  }, [pins, path, zoom]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground ${className ?? "h-64"}`}
      >
        {error}
      </div>
    );
  }

  return <div ref={holder} className={`overflow-hidden rounded-lg border border-border ${className ?? "h-64"}`} />;
}
