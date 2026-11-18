import path from "node:path";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(import.meta.dirname, "../..");

// CesiumJS loads its web workers, widget CSS and assets at runtime from CESIUM_BASE_URL,
// so those four folders are served (dev) and copied (build) under /cesium/.
const cesiumBaseUrl = "cesium";
const cesiumBuild = "node_modules/cesium/Build/Cesium";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((dir) => ({
        src: `${cesiumBuild}/${dir}/**/*`,
        dest: cesiumBaseUrl,
        // Drop node_modules/cesium/Build/Cesium so files land at /cesium/<dir>/...
        rename: { stripBase: 4 },
      })),
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
  },
  // One .env at the repo root. Only VITE_* variables are exposed to the browser.
  envDir: repoRoot,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // In dev the browser calls /api/* and Vite forwards it to the FastAPI server.
      "/api": {
        target: "http://127.0.0.1:8000",
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
  },
});
