import { defineConfig, type Plugin } from "vite";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";

// The Three.js "scene sandbox" runs ARBITRARY learner JS, so it must live in an
// opaque-origin iframe (sandbox="allow-scripts", no allow-same-origin). An
// opaque origin can't load external /assets via CSP 'self', so the runner +
// Three.js are bundled into a SINGLE self-contained sandbox.html (inline script,
// permitted only there by a route-scoped relaxed CSP). The main app keeps the
// pristine strict CSP — shader lessons run on the main page (GPU shaders execute
// no JS, so no eval is ever needed there).

const runnerEntry = fileURLToPath(new URL("./src/sandbox/runner.ts", import.meta.url));

function sandboxHtml(js: string): string {
  // Guard against a literal </script> inside the bundle terminating the tag.
  const safe = js.replace(/<\/script>/gi, "<\\/script>");
  return (
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<title>glsl-atelier sandbox</title></head><body><script>${safe}</script></body></html>`
  );
}

async function bundleRunner(): Promise<string> {
  const res = await esbuild({
    entryPoints: [runnerEntry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    write: false,
  });
  return res.outputFiles[0].text;
}

function sandboxPlugin(): Plugin {
  let cache: string | null = null;
  return {
    name: "glsl-atelier-sandbox",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split("?")[0] === "/sandbox.html") {
          // Rebuild each request in dev so runner edits are picked up.
          bundleRunner().then(
            (js) => {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(sandboxHtml(js));
            },
            (err) => next(err),
          );
          return;
        }
        next();
      });
    },
    async generateBundle() {
      const js = cache ?? (cache = await bundleRunner());
      this.emitFile({ type: "asset", fileName: "sandbox.html", source: sandboxHtml(js) });
    },
  };
}

export default defineConfig({
  plugins: [sandboxPlugin()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    // Avoid the inline module-preload polyfill script so the CSP needs no
    // 'unsafe-inline' for scripts (es2022 targets support modulepreload natively).
    modulePreload: { polyfill: false },
  },
});
