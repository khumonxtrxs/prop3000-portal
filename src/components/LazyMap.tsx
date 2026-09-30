import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { MapPin } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

type Props = {
  pins: MapPin[];
  path?: Array<[number, number]> | undefined;
  className?: string | undefined;
  zoom?: number | undefined;
  onPinClick?: ((index: number) => void) | undefined;
};

function Placeholder({ className }: { className?: string | undefined }) {
  return (
    <div className={`animate-pulse rounded-lg border border-border bg-muted ${className ?? "h-64"}`} aria-hidden />
  );
}

export function LazyMap({ pins, path, className, zoom, onPinClick }: Props) {
  return (
    <ClientOnly fallback={<Placeholder className={className} />}>
      <Suspense fallback={<Placeholder className={className} />}>
        <MapCanvas pins={pins} path={path} className={className} zoom={zoom} onPinClick={onPinClick} />
      </Suspense>
    </ClientOnly>
  );
}
