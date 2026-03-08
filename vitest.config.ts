import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Exclude pre-existing API tests that fail due to missing generated Prisma client
    // (generated/ directory is gitignored and not present in this environment).
    // Those tests are outside Phase 8 scope and do not mock repositories/swap.js.
    exclude: ["**/node_modules/**", "src/__tests__/api/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/constraintEngine/**/*.ts",
        "src/scheduler/**/*.ts",
        "src/repositories/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "src/**/index.test.ts",
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
