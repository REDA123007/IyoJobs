import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In development the browser talks to one origin (this dev server). Requests to /api/* are
// forwarded to the Python API, with the /api prefix removed. In staging/production the same
// /api/* contract must be provided by the platform router (see docs/CLOUDFLARE-DECISION.ar.md).
const apiTarget = process.env.IYOJOBS_API ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: { sourcemap: false, target: "es2022" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
