import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { fetchRoute } from "./agent/apiClient";
import type { LoadRoute } from "./agent/useRoute";
import { App } from "./App";
import { env } from "./config";
import type { CreateMap } from "./map/MapView";
import "./styles.css";

const loadRoute: LoadRoute = (signal) => fetchRoute(env.apiBaseUrl, { signal });

// Loaded on demand so the conversation panel renders before CesiumJS downloads.
const ionToken = env.cesiumIonToken;
const createMap: CreateMap | undefined = ionToken
  ? async () => {
      const { CesiumMapController } = await import("./map/CesiumMapController");
      return new CesiumMapController(ionToken);
    }
  : undefined;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App loadRoute={loadRoute} createMap={createMap} />
  </StrictMode>,
);
