import type { RouteData } from "@mamsha/shared";

import type { WalkProgress as Progress } from "./walkingCamera";

function stopLabel(progress: Progress): string {
  return `Stop ${progress.stopIndex + 1} of ${progress.stopCount}`;
}

/** The line under the map, for example "Stop 2 of 5 · 280 m to go". */
export function describeProgress(progress: Progress, route: RouteData): string {
  const toGo = `${progress.remaining} m to go`;
  const ahead =
    progress.stopIndex < progress.stopCount ? stopLabel(progress) : `${route.gate.name} ahead`;
  switch (progress.phase) {
    case "idle":
      return `${progress.stopCount} stops · ${progress.length} m to ${route.gate.name}`;
    case "overview":
      return `Overview of the route · ${progress.length} m`;
    case "walking":
      return `${ahead} · ${toGo}`;
    case "at_stop": {
      const title = route.stops[progress.stopIndex]?.title;
      return `At ${stopLabel(progress).toLowerCase()}${title ? `: ${title}` : ""} · ${toGo}`;
    }
    case "paused":
      return `Paused · ${ahead} · ${toGo}`;
    case "done":
      return `Arrived at ${route.gate.name}`;
  }
}

/**
 * What a screen reader hears: only phase and stop changes, never the metres ticking
 * down, so the live region doesn't chatter.
 */
export function announceProgress(progress: Progress, route: RouteData): string {
  switch (progress.phase) {
    case "idle":
      return "";
    case "overview":
      return "Walk started. Overview of the route.";
    case "walking":
      return progress.stopIndex < progress.stopCount
        ? `Walking to ${stopLabel(progress).toLowerCase()}.`
        : `Walking to ${route.gate.name}.`;
    case "at_stop":
      return `Arrived at ${stopLabel(progress).toLowerCase()}: ${route.stops[progress.stopIndex]?.title ?? ""}.`;
    case "paused":
      return "Walk paused.";
    case "done":
      return `Arrived at ${route.gate.name}.`;
  }
}
