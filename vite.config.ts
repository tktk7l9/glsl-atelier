import { defineConfig, type Plugin } from "vite";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
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

/** Lesson content: one module per track, plus the helpers they share. */
const LESSON_MODULE = /\/src\/engine\/content\/tracks\/[^/]+\.ts$/;
const swTemplate = fileURLToPath(new URL("./src/sw.js", import.meta.url));
const PRECACHE_SLOT = "const PRECACHE = [];";
const ASSETS_SLOT = "const ASSETS = [];";

/**
 * Lesson content is split per track: src/engine/content/index.ts loads each
 * track's module with import(), so only the catalogue ships in the initial
 * bundle. This plugin keeps that split honest and makes it work offline:
 * - the build fails if lesson content lands in the initial bundle;
 * - sw.js is emitted from src/sw.js with the chunks to precache filled in (the
 *   lesson runtime and every track, not the Three.js background, which loads
 *   on its own), plus the list of all hashed assets so the worker can drop an
 *   earlier build's. The lists change with each build, which is also what
 *   makes browsers install the new worker.
 */
function lessonChunks(): Plugin {
  return {
    name: "glsl-atelier:lesson-chunks",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((f) => (f.type === "chunk" ? [f] : []));
      const entry = chunks.find((c) => c.isEntry);
      if (!entry) return this.error("no entry chunk");
      const leaked = entry.moduleIds.filter((id) => LESSON_MODULE.test(id));
      if (leaked.length > 0) this.error(`lesson content is in the initial bundle: ${leaked.join(", ")}`);

      const precache = new Set<string>();
      const visit = (fileName: string): void => {
        if (precache.has(fileName)) return;
        precache.add(fileName);
        const chunk = bundle[fileName];
        if (chunk?.type !== "chunk") return;
        chunk.imports.forEach(visit);
        chunk.viteMetadata?.importedCss.forEach((css) => precache.add(css));
      };
      for (const chunk of chunks) {
        const id = chunk.facadeModuleId ?? "";
        if (chunk.isDynamicEntry && (LESSON_MODULE.test(id) || id.endsWith("/src/app.ts"))) visit(chunk.fileName);
      }

      const template = readFileSync(swTemplate, "utf8");
      for (const slot of [PRECACHE_SLOT, ASSETS_SLOT]) {
        if (!template.includes(slot)) this.error(`src/sw.js has no "${slot}" line`);
      }
      const paths = (names: Iterable<string>): string =>
        JSON.stringify([...names].sort().map((f) => `/${f}`), null, 2);
      const assets = Object.keys(bundle).filter((f) => f.startsWith("assets/"));
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replace(PRECACHE_SLOT, `const PRECACHE = ${paths(precache)};`)
          .replace(ASSETS_SLOT, `const ASSETS = ${paths(assets)};`),
      });
    },
  };
}

export default defineConfig({
  plugins: [sandboxPlugin(), lessonChunks()],
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
