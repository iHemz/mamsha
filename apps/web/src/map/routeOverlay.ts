import type { RouteData } from "@niyvaru/shared";

import type { MapController, MapMarker } from "./MapController";

/** The hotel, each numbered stop, then the gate, in walking order. */
export function routeMarkers(route: RouteData): MapMarker[] {
  return [
    { id: route.hotel.id, kind: "hotel", label: route.hotel.name, position: route.hotel.position },
    ...route.stops.map((stop, index): MapMarker => ({
      id: stop.id,
      kind: "stop",
      label: `${index + 1}. ${stop.title}`,
      position: stop.position,
    })),
    { id: route.gate.id, kind: "gate", label: route.gate.name, position: route.gate.position },
  ];
}

/** Draw the walking line and the markers for `route`. */
export function drawRoute(map: MapController, route: RouteData): void {
  map.showRoute(route.path);
  map.setMarkers(routeMarkers(route));
}
