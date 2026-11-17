import { type LoadRoute, useRoute } from "./agent/useRoute";
import { ChatPanel } from "./components/ChatPanel";
import { RoutePanel } from "./components/RoutePanel";

interface AppProps {
  loadRoute: LoadRoute;
}

export function App({ loadRoute }: AppProps) {
  const { state, retry } = useRoute(loadRoute);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <h1>Niyvaru · Hotel to Haram walk</h1>
      </header>
      <main id="main" className="layout" tabIndex={-1}>
        <ChatPanel />
        <RoutePanel state={state} onRetry={retry} />
      </main>
    </>
  );
}
