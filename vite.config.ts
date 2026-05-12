import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * This config is understood by both Vite (for dev/build) and Vitest
 * because `defineConfig` from `vitest/config` extends Vite’s config type
 * with the extra `test` property.
 */
export default defineConfig({
  plugins: [react()],

  // ---------- Vite options ----------

  // ---------- Vitest options ----------
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
