import type { RouteData } from "@niyvaru/shared";
import { useEffect, useRef, useState } from "react";

import type { MapController, MapStatus } from "./MapController";

/** Builds the real map on demand, so the heavy 3D code loads after the rest of the page. */
export type CreateMap = () => Promise<MapController>;

interface MapViewProps {
  /** Undefined when the 3D map cannot run (no Cesium ion token). */
  createMap: CreateMap | undefined;
  route: RouteData;
  /** Called once the controller is mounted, so the walk and dispatcher can drive it. */
  onReady?: (map: MapController) => void;
}

const MISSING_TOKEN: MapStatus = {
  state: "error",
  message: "The 3D city needs a Cesium ion token (VITE_CESIUM_ION_TOKEN).",
};

/** Hosts the 3D city and shows its loading and error states. */
export function MapView({ createMap, route, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>(createMap ? { state: "loading" } : MISSING_TOKEN);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const hotel = route.hotel.position;

  useEffect(() => {
    const container = containerRef.current;
    if (!createMap || !container) return;

    let cancelled = false;
    // Read through a function: TypeScript would otherwise narrow `cancelled` to false.
    const isCancelled = () => cancelled;
    let map: MapController | null = null;
    let unsubscribe: (() => void) | undefined;

    createMap()
      .then(async (created) => {
        if (isCancelled()) return;
        map = created;
        unsubscribe = created.onStatus(setStatus);
        await created.mount(container);
        if (isCancelled()) return;
        // Start above and south of the hotel, looking north across it. Heights are above
        // the ellipsoid, and the ground here is several hundred metres up, so a lower
        // camera ends up inside the coarse first tiles. The camera math replaces this
        // fixed height with one relative to the sampled ground.
        created.setCamera({
          position: { lat: hotel.lat - 0.0045, lng: hotel.lng },
          height: 1500,
          heading: 0,
          pitch: -35,
        });
        onReadyRef.current?.(created);
      })
      .catch((error: unknown) => {
        if (isCancelled()) return;
        setStatus({
          state: "error",
          message: `The 3D city could not start (${error instanceof Error ? error.message : String(error)}).`,
        });
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      map?.destroy();
    };
  }, [createMap, hotel.lat, hotel.lng]);

  return (
    <div className="map-view">
      <div
        ref={containerRef}
        className="map-canvas"
        role="img"
        aria-label={`3D view of the walk from ${route.hotel.name} to ${route.gate.name}`}
      />
      {status.state === "loading" && (
        <p role="status" className="map-overlay">
          Loading the 3D city…
        </p>
      )}
      {status.state === "error" && (
        <p role="alert" className="map-overlay error">
          {status.message} The walk still works from the stop list and the conversation.
        </p>
      )}
    </div>
  );
}
