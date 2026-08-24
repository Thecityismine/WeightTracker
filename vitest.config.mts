import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Native replacement for vite-tsconfig-paths — resolves the @/* alias.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
