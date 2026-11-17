import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  plugins: [react()],
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
