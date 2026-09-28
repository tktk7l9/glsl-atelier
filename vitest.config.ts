import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Let styles.test.ts read the stylesheet via ?raw (CSS is stubbed empty by default).
    css: { include: [/styles\.css/] },
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "json-summary", "html"],
      // Keep the pure logic layer (content / validate / color / sample / tokenize / progress)
      // at 100%. WebGL, iframes, and Three.js are excluded as the presentation/runtime layer.
      thresholds: {
        "src/engine/**/*.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
