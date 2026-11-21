import type { RouteData } from "@mamsha/shared";
import { useState } from "react";

import type { RouteState } from "../agent/useRoute";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { MapController } from "../map/MapController";
import { type CreateMap, MapView } from "../map/MapView";
import type { FrameClock } from "../walk/walkingCamera";
import { useWalk } from "../walk/useWalk";
import { WalkControls } from "./WalkControls";
import { WalkProgress } from "./WalkProgress";

interface RoutePanelProps {
  state: RouteState;
  onRetry: () => void;
  createMap: CreateMap | undefined;
  /** Tests drive the walk with their own frame clock. */
  clock?: FrameClock | undefined;
}

/** The city side: the route summary and the 3D map. */
export function RoutePanel({ state, onRetry, createMap, clock }: RoutePanelProps) {
  return (
    <section
      className="panel route-panel"
      aria-labelledby="route-heading"
      aria-busy={state.status === "loading"}
    >
      <h2 id="route-heading">The walk</h2>
      {state.status === "loading" && (
        <p role="status" className="muted">
          Loading the route…
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="error">
          <p>We couldn&apos;t load the route. {state.message}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <p className="route-ends">
            From <strong>{state.route.hotel.name}</strong> to{" "}
            <strong>{state.route.gate.name}</strong>
          </p>
          <ol className="stops" aria-label="Stops on the walk">
            {state.route.stops.map((stop) => (
              <li key={stop.id}>{stop.title}</li>
            ))}
          </ol>
          <Walk route={state.route} createMap={createMap} clock={clock} />
        </>
      )}
    </section>
  );
}

interface WalkProps {
  route: RouteData;
  createMap: CreateMap | undefined;
  clock: FrameClock | undefined;
}

/** The 3D city with the walking camera, its progress and its controls. */
function Walk({ route, createMap, clock }: WalkProps) {
  const [map, setMap] = useState<MapController | null>(null);
  const reducedMotion = useReducedMotion();
  const walk = useWalk(map, route, { reducedMotion, clock });

  return (
    <>
      <WalkControls camera={walk?.camera ?? null} progress={walk?.progress ?? null} />
      <MapView createMap={createMap} route={route} onReady={setMap} />
      {walk && <WalkProgress progress={walk.progress} route={route} />}
    </>
  );
}
