import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The client always calls relative /api URLs. For hot-reload development, set
// VITE_DEV_API_TARGET in frontend/.env to wherever your API is running.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_DEV_API_TARGET;
  return {
    plugins: [react()],
    build: { outDir: "../backend/static", emptyOutDir: true },
    server: target ? { proxy: { "/api": { target, changeOrigin: true } } } : {},
  };
});
