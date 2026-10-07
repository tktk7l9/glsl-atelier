// Runs INSIDE the opaque-origin sandbox iframe (sandbox="allow-scripts", no
// allow-same-origin). It receives the learner's Three.js code via postMessage,
// runs it against a fresh scene/camera each time, renders to a VISIBLE canvas
// (so the iframe doubles as the live 3D preview), reads the frame back, and posts
// a serializable SceneSnapshot to the parent. Because the iframe is an opaque
// origin with connect-src 'none', the learner's code cannot reach the parent,
// cookies, localStorage, or the network — it can only build a scene. This whole
// file is bundled inline into sandbox.html by the Vite plugin (see vite.config.ts).
// The running, rendering and redrawing live in scene-runner.ts; this file is
// the DOM glue around it.

import * as THREE from "three";
import type { SceneSnapshot } from "../engine/validate/snapshot.js";
import { createSceneRunner } from "./scene-runner.js";

document.documentElement.style.height = "100%";
document.body.style.cssText = "margin:0;height:100%;background:#05060d;overflow:hidden";
const canvas = document.createElement("canvas");
canvas.style.cssText = "display:block;width:100%;height:100%";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const runner = createSceneRunner(renderer);

/** The iframe is the preview, so its window size is the canvas size. A resize
 *  (window resize, device rotation, the preview switching between 1:1 and
 *  16:9) clears the canvas; the runner redraws the last scene at once. */
function fit(): void {
  runner.resize(window.innerWidth || 220, window.innerHeight || 220, window.devicePixelRatio || 1);
}
fit();
window.addEventListener("resize", fit);

interface RunMessage {
  type: "run";
  id: number;
  code: string;
}

window.addEventListener("message", (e: MessageEvent) => {
  // Only the embedding page may submit code. Our origin is opaque, so the
  // sender's origin cannot be compared; check the window reference instead, and
  // refuse to run at all when opened top-level (no embedding parent).
  if (window.parent === window || e.source !== window.parent) return;
  const data = e.data as RunMessage | undefined;
  if (!data || data.type !== "run") return;
  let snapshot: SceneSnapshot;
  try {
    snapshot = runner.run(data.code);
  } catch (err) {
    snapshot = {
      kind: "scene",
      error: err instanceof Error ? err.message : String(err),
      source: data.code,
      objects: [],
      camera: null,
    };
  }
  window.parent.postMessage({ type: "result", id: data.id, snapshot }, "*");
});

window.parent.postMessage({ type: "ready" }, "*");
