import { defineConfig } from "vitest/config";

// UI-layer files (DOM only, no WebGL). Their tests run under jsdom via a
// `@vitest-environment jsdom` docblock; the engine tests stay on node.
const UI_FILES = [
  "src/app.ts",
  "src/main.ts",
  "src/ui/**/*.ts",
  "src/sandbox/scene-sandbox.ts",
  "src/sandbox/sample-grid.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Let styles.test.ts read the stylesheet via ?raw (CSS is stubbed empty by default).
    css: { include: [/styles\.css/] },
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts", ...UI_FILES],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        // Keep the pure logic layer (content / validate / color / sample / tokenize / progress)
        // at 100%.
        "src/engine/**/*.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // The DOM layer is exercised with behavioural jsdom tests (measured
        // 99/96/96/99, gated two points below). WebGL (shader-runtime), the
        // Three.js sandbox runner and the cosmic background need a real GPU /
        // iframe and are excluded as the presentation layer.
        "{src/app.ts,src/main.ts,src/ui/**/*.ts,src/sandbox/scene-sandbox.ts,src/sandbox/sample-grid.ts}": {
          statements: 97,
          branches: 94,
          functions: 94,
          lines: 97,
        },
      },
    },
  },
});
