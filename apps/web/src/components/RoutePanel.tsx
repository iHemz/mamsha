import type { RouteState } from "../agent/useRoute";
import { type CreateMap, MapView } from "../map/MapView";

interface RoutePanelProps {
  state: RouteState;
  onRetry: () => void;
  createMap: CreateMap | undefined;
}

/** The city side: the route summary and the 3D map. */
export function RoutePanel({ state, onRetry, createMap }: RoutePanelProps) {
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
          <MapView createMap={createMap} route={state.route} />
        </>
      )}
    </section>
  );
}
