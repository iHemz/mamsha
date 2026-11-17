import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { fetchRoute } from "./agent/apiClient";
import type { LoadRoute } from "./agent/useRoute";
import { App } from "./App";
import { env } from "./config";
import "./styles.css";

const loadRoute: LoadRoute = (signal) => fetchRoute(env.apiBaseUrl, { signal });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App loadRoute={loadRoute} />
  </StrictMode>,
);
