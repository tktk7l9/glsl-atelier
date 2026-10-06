// Runs INSIDE the opaque-origin sandbox iframe (sandbox="allow-scripts", no
// allow-same-origin). It receives the learner's Three.js code via postMessage,
// runs it against a fresh scene/camera each time, renders to a VISIBLE canvas
// (so the iframe doubles as the live 3D preview), reads the frame back, and posts
// a serializable SceneSnapshot to the parent. Because the iframe is an opaque
// origin with connect-src 'none', the learner's code cannot reach the parent,
// cookies, localStorage, or the network — it can only build a scene. This whole
// file is bundled inline into sandbox.html by the Vite plugin (see vite.config.ts).

import * as THREE from "three";
import type { SceneSnapshot } from "../engine/validate/snapshot.js";
import { toGridSamples } from "./sample-grid.js";
import { collectObjects } from "./scene-graph.js";

const GRID = 16;

document.documentElement.style.height = "100%";
document.body.style.cssText = "margin:0;height:100%;background:#05060d;overflow:hidden";
const canvas = document.createElement("canvas");
canvas.style.cssText = "display:block;width:100%;height:100%";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

/** The renderer is shared by every run, but learner code may flip its switches
 *  (shadow maps, clear colour); put them back so one run cannot leak into the
 *  next and a lesson is judged on its own code. */
function resetRenderer(): void {
  renderer.setClearColor(0x05060d, 1);
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}
resetRenderer();

function fit(): void {
  renderer.setSize(window.innerWidth || 220, window.innerHeight || 220, false);
}
fit();
window.addEventListener("resize", fit);

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((o) => {
    const any = o as unknown as {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
    };
    any.geometry?.dispose?.();
    const m = any.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
    else m?.dispose?.();
  });
}

function run(code: string): SceneSnapshot {
  const scene = new THREE.Scene();
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  const camera = new THREE.PerspectiveCamera(60, w / h || 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  resetRenderer();

  let error: string | null = null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("THREE", "scene", "camera", "renderer", code);
    fn(THREE, scene, camera, renderer);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const objects = collectObjects(scene);

  let samples;
  try {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    samples = toGridSamples(pixels, w, h, GRID);
  } catch (e) {
    if (!error) error = e instanceof Error ? e.message : String(e);
  }

  disposeScene(scene);

  return {
    kind: "scene",
    error,
    source: code,
    objects,
    camera: {
      type: camera.type,
      position: [camera.position.x, camera.position.y, camera.position.z],
    },
    samples,
  };
}

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
    snapshot = run(data.code);
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
