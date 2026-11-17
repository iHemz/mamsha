import type { RouteState } from "../agent/useRoute";

interface RoutePanelProps {
  state: RouteState;
  onRetry: () => void;
}

/** The city side. Shows the route summary until the 3D map takes over this space. */
export function RoutePanel({ state, onRetry }: RoutePanelProps) {
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
          <div className="map-placeholder" aria-hidden="true">
            3D map
          </div>
        </>
      )}
    </section>
  );
}
