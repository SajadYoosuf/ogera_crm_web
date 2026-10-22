import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit and component tests. The database is always mocked here; tests that talk
// to the real database live in tests/integration (see vitest.integration.config.ts).
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // `server-only` throws outside a Next.js server build.
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
      // `next/font/google` requires the Next.js compiler pipeline.
      "next/font/google": path.resolve(root, "tests/stubs/next-font-google.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/integration/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
