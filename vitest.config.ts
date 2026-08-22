import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Expose .env (DATABASE_URL, AUTH_SECRET) to integration tests.
    env: loadEnv(mode ?? "test", process.cwd(), ""),
  },
}));
