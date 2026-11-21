import type { RouteData } from "@mamsha/shared";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import type { MapController } from "../map/MapController";
import { WalkingCamera, type WalkingCameraOptions, type WalkProgress } from "./walkingCamera";

const noSubscribe = () => () => undefined;
const noProgress = () => null;

export interface Walk {
  camera: WalkingCamera;
  progress: WalkProgress;
}

/**
 * The walking camera for `map` and `route`, or null until the map is ready. A new map,
 * route or motion preference replaces the camera (and disposes the old one).
 */
export function useWalk(
  map: MapController | null,
  route: RouteData,
  options: Pick<WalkingCameraOptions, "reducedMotion" | "onArrive" | "clock"> = {},
): Walk | null {
  const { reducedMotion, onArrive, clock } = options;
  // Building the camera has no side effects (it only measures the route), so it can be
  // made during render. It only touches the map once a control is used.
  const camera = useMemo(
    () => (map ? new WalkingCamera(map, route, { reducedMotion, onArrive, clock }) : null),
    [map, route, reducedMotion, onArrive, clock],
  );
  useEffect(() => () => camera?.dispose(), [camera]);

  const progress = useSyncExternalStore(
    camera ? camera.subscribe : noSubscribe,
    camera ? camera.getProgress : noProgress,
  );
  return camera && progress ? { camera, progress } : null;
}
