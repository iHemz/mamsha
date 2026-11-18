import { type LoadRoute, useRoute } from "./agent/useRoute";
import { ChatPanel } from "./components/ChatPanel";
import { RoutePanel } from "./components/RoutePanel";
import type { CreateMap } from "./map/MapView";

interface AppProps {
  loadRoute: LoadRoute;
  /** Undefined when the 3D map cannot run. Tests pass a fake. */
  createMap?: CreateMap | undefined;
}

export function App({ loadRoute, createMap }: AppProps) {
  const { state, retry } = useRoute(loadRoute);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <h1>Mamsha · Hotel to Haram walk</h1>
      </header>
      <main id="main" className="layout" tabIndex={-1}>
        <ChatPanel />
        <RoutePanel state={state} onRetry={retry} createMap={createMap} />
      </main>
    </>
  );
}
