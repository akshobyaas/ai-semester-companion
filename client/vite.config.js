import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Inside the Docker network, "server" is the backend's hostname (same
    // service-discovery pattern as MONGODB_URI/REDIS_URL in Phase 1/7) —
    // this proxy lets the browser call relative /api/... paths without
    // hardcoding a host, working the same in Docker and on bare localhost
    // dev (where VITE_API_PROXY_TARGET below defaults to localhost:8000).
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://server:8000",
        changeOrigin: true,
      },
    },
  },
});
