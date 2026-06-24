// Runs INSIDE the opaque-origin sandbox iframe (sandbox="allow-scripts", no
// allow-same-origin). It receives the learner's Three.js code via postMessage,
// runs it against a fresh scene/camera each time, renders to a VISIBLE canvas
// (so the iframe doubles as the live 3D preview), reads the frame back, and posts
// a serializable SceneSnapshot to the parent. Because the iframe is an opaque
// origin with connect-src 'none', the learner's code cannot reach the parent,
// cookies, localStorage, or the network — it can only build a scene. This whole
// file is bundled inline into sandbox.html by the Vite plugin (see vite.config.ts).

import * as THREE from "three";
import type { SceneObject, SceneSnapshot } from "../engine/validate/snapshot.js";
import { toGridSamples } from "./sample-grid.js";

const GRID = 16;

document.documentElement.style.height = "100%";
document.body.style.cssText = "margin:0;height:100%;background:#05060d;overflow:hidden";
const canvas = document.createElement("canvas");
canvas.style.cssText = "display:block;width:100%;height:100%";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x05060d, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

function fit(): void {
  renderer.setSize(window.innerWidth || 220, window.innerHeight || 220, false);
}
fit();
window.addEventListener("resize", fit);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

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

  let error: string | null = null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("THREE", "scene", "camera", "renderer", code);
    fn(THREE, scene, camera, renderer);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const objects: SceneObject[] = [];
  scene.traverse((obj) => {
    if (obj === scene) return;
    const any = obj as unknown as {
      geometry?: { type?: string };
      material?: { type?: string; color?: { getHexString(): string } } | Array<{ type?: string }>;
    };
    const mat = Array.isArray(any.material) ? any.material[0] : any.material;
    const colorObj =
      mat && !Array.isArray(mat) && "color" in mat
        ? (mat as { color?: { getHexString(): string } }).color
        : undefined;
    objects.push({
      id: obj.name || obj.uuid.slice(0, 8),
      type: obj.type,
      geometry: any.geometry?.type ?? null,
      material: mat?.type ?? null,
      color: colorObj ? hexToRgb(colorObj.getHexString()) : null,
      position: [obj.position.x, obj.position.y, obj.position.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      visible: obj.visible,
    });
  });

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
