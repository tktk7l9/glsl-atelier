// Proves that each lesson's reference solution passes its validators and that
// its starter code does not — the two properties a lesson must have to be
// solvable and worth solving. (The sourceMatches cross-check lives in
// content.test.ts.)
//
// Shader lessons: the grader renders 128×128 at t = 1 and reads back a 24×24
// grid (see sandbox/shader-runtime.ts). WebGL is not available in Node, so the
// newer shader lessons are modelled here as plain JS functions of the pixel
// centre, evaluated on exactly the grader's sample positions. The model is a
// port of the GLSL, so it guards the validator thresholds, not the GLSL text;
// the real shaders are checked in a browser.
//
// Three.js lessons: the starter and solution really run against the installed
// `three` (so a renamed API would throw here), and the scene-graph validators
// are judged on the resulting objects. Scenes made only of unlit things (basic
// and emissive colours, data textures, points, plain alpha blending) are also
// "rendered" by casting a ray through every sample with three's own Raycaster
// and camera maths, at both preview shapes (1:1 and 16:9), so their pixel
// validators are judged here too. Lit, fogged, shadowed and custom-shader
// scenes need a real GPU and are left to the browser.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { evaluate } from "../validate/run.js";
import type { ValidatorSpec } from "../validate/primitives.js";
import type { RGB, Sample, SceneSnapshot, ShaderSnapshot } from "../validate/snapshot.js";
import { collectObjects } from "../../sandbox/scene-graph.js";
import { LESSONS, lessonById } from "./index.js";

// ---------------------------------------------------------------- shader side

type Shade = (x: number, y: number) => RGB;

const SIZE = 128;
const GRID = 24;

/** Render `shade` at the grader's sample positions (same maths as toGridSamples). */
function renderGrid(shade: Shade): Sample[] {
  const out: Sample[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const nx = (gx + 0.5) / GRID;
      const ny = (gy + 0.5) / GRID;
      // The fragment's st is the centre of the pixel the sample lands on.
      const x = (Math.min(SIZE - 1, Math.floor(nx * SIZE)) + 0.5) / SIZE;
      const y = (Math.min(SIZE - 1, Math.floor(ny * SIZE)) + 0.5) / SIZE;
      const [r, g, b] = shade(x, y).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255) / 255);
      out.push({ x: nx, y: ny, rgba: [r, g, b, 1] });
    }
  }
  return out;
}

function shaderSnapshot(source: string, shade: Shade): ShaderSnapshot {
  return {
    kind: "shader",
    compiled: true,
    log: "",
    resolution: { w: SIZE, h: SIZE },
    time: 1,
    source,
    samples: renderGrid(shade),
  };
}

// GLSL builtins used by the models.
const fract = (v: number): number => v - Math.floor(v);
const step = (edge: number, v: number): number => (v < edge ? 0 : 1);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, v: number): number => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const length = (x: number, y: number): number => Math.hypot(x, y);
const grey = (c: number): RGB => [c, c, c];
/** The aspect-correct centred coordinate used by the SDF/polar lessons (square canvas). */
const centred = (x: number, y: number): [number, number] => [x * 2 - 1, y * 2 - 1];
const random = (x: number, y: number): number =>
  fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);

const sdBox = (px: number, py: number, bx: number, by: number): number => {
  const qx = Math.abs(px) - bx;
  const qy = Math.abs(py) - by;
  return length(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
};
const smin = (a: number, b: number, k: number): number => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
};

const circleScene = (ux: number, uy: number): number => 1 - step(0.25, length(ux - 0.5, uy - 0.5));

function raymarch(x: number, y: number, advance: boolean): RGB {
  const [ux, uy] = centred(x, y);
  const len = Math.hypot(ux, uy, -1.5);
  const rd = [ux / len, uy / len, -1.5 / len];
  let t = 0;
  let col: RGB = [0, 0, 0.05];
  for (let i = 0; i < 48; i++) {
    const p = [rd[0] * t, rd[1] * t, 3 + rd[2] * t];
    const d = Math.hypot(p[0], p[1], p[2]) - 1;
    if (d < 0.001) {
      const n = p.map((v) => v / Math.hypot(p[0], p[1], p[2]));
      const l = Math.hypot(0.6, 0.7, 0.8);
      const diff = Math.max((n[0] * 0.6 + n[1] * 0.7 + n[2] * 0.8) / l, 0);
      col = grey(diff);
      break;
    }
    if (advance) t += d;
  }
  return col;
}

type V3 = readonly [number, number, number];
const v3add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const v3scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const v3dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3norm = (a: V3): V3 => v3scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
const lambert = (n: V3, light: V3): number => Math.max(v3dot(n, v3norm(light)), 0);

/** GLSL `mat2(c, -s, s, c) * v` (column-major); a shape drawn in the rotated
 *  coordinates turns by +a. */
const rotate2d = (a: number, x: number, y: number): [number, number] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * x + s * y, -s * x + c * y];
};

/** The cellular-noise lesson: distance to the nearest jittered point, looking
 *  at the own cell only (starter) or at the 3×3 cells around it (solution). */
function cellular(x: number, y: number, reach: 0 | 1): RGB {
  const px = x * 5;
  const py = y * 5;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let m = 1;
  for (let oy = -reach; oy <= reach; oy++) {
    for (let ox = -reach; ox <= reach; ox++) {
      // cellPoint(i) = vec2(random(i), random(i + vec2(57, 113)))
      const cx = ox + random(ix + ox, iy + oy);
      const cy = oy + random(ix + ox + 57, iy + oy + 113);
      m = Math.min(m, length(px - ix - cx, py - iy - cy));
    }
  }
  return grey(m);
}

const rgb = (c: readonly number[]): RGB => [c[0], c[1], c[2]];

/** The tone-mapping lesson's HDR ramp after Reinhard, `hdr / (1 + hdr)`. */
const reinhard = (x: number): RGB => rgb([1, 0.6, 0.3].map((c) => (c * x * 8) / (1 + c * x * 8)));

/** The gamma lesson's lit sphere, before or after `pow(col, 1 / 2.2)`. */
function gammaSphere(x: number, y: number, corrected: boolean): RGB {
  const [px, py] = centred(x, y);
  const r = 0.75;
  const d = length(px, py);
  if (d >= r) return [0, 0, 0];
  const diff = lambert(v3norm([px, py, Math.sqrt(r * r - d * d)]), [-0.5, 0.6, 0.6]);
  const linear = [1, 0.5, 0.2].map((c) => c * (0.05 + 0.95 * diff));
  return rgb(corrected ? linear.map((c) => Math.pow(c, 1 / 2.2)) : linear);
}

/** The sphere-on-floor scene of the ray-marching normal and shadow lessons. */
const floorScene = (p: V3): number => Math.min(Math.hypot(p[0], p[1], p[2]) - 1, p[1] + 1);
const SKY: RGB = [0, 0, 0.05];

/** The gradient of the distance field (calcNormal). */
function gradientNormal(p: V3): V3 {
  const e = 0.001;
  const axis = (i: number): number => {
    const o: [number, number, number] = [0, 0, 0];
    o[i] = e;
    return floorScene(v3add(p, o)) - floorScene(v3add(p, v3scale(o, -1)));
  };
  return v3norm([axis(0), axis(1), axis(2)]);
}

/** Ray-march the floor scene from (0, 0, 3) and shade the hit point (the
 *  hit tolerance grows with distance, as in the lessons). */
function marchFloor(x: number, y: number, shade: (p: V3) => RGB): RGB {
  const [ux, uy] = centred(x, y);
  const rd = v3norm([ux, uy, -1.5]);
  let t = 0;
  for (let i = 0; i < 100; i++) {
    const p: V3 = v3add([0, 0, 3], v3scale(rd, t));
    const d = floorScene(p);
    if (d < 0.001 * t) return shade(p);
    t += d;
    if (t > 20) break;
  }
  return SKY;
}

/** The shadow lesson's shadow ray: 0 when the light is blocked (once `blocks`). */
function shadowRay(ro: V3, rd: V3, blocks: boolean): number {
  let t = 0.02;
  for (let i = 0; i < 48; i++) {
    const h = floorScene(v3add(ro, v3scale(rd, t)));
    if (blocks && h < 0.001) return 0;
    t += h;
    if (t > 10) break;
  }
  return 1;
}

function shadowLesson(x: number, y: number, blocks: boolean): RGB {
  return marchFloor(x, y, (p) => {
    const n = gradientNormal(p);
    const light: V3 = [-0.8, 0.6, 0.3];
    const sh = shadowRay(v3add(p, v3scale(n, 0.01)), v3norm(light), blocks);
    return grey(0.08 + 0.92 * lambert(n, light) * sh);
  });
}

/** JS ports of (starter, solution) for the shader lessons added in 2026-10. */
const SHADER_MODELS: Record<string, { starter: Shade; solution: Shade }> = {
  "glsl-repeat-dots": {
    starter: (x, y) => grey(1 - step(0.3, length(x - 0.5, y - 0.5))),
    solution: (x, y) => grey(1 - step(0.3, length(fract(x * 3) - 0.5, fract(y * 3) - 0.5))),
  },
  "glsl-sdf-box": {
    starter: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, length(px, py) - 0.5));
    },
    solution: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, sdBox(px, py, 0.6, 0.3)));
    },
  },
  "glsl-sdf-ring": {
    starter: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, length(px, py) - 0.5));
    },
    solution: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, Math.abs(length(px, py) - 0.5) - 0.1));
    },
  },
  "glsl-sdf-smooth-union": {
    starter: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, Math.min(length(px + 0.38, py) - 0.3, length(px - 0.38, py) - 0.3)));
    },
    solution: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, smin(length(px + 0.38, py) - 0.3, length(px - 0.38, py) - 0.3, 0.6)));
    },
  },
  "glsl-polar-rays": {
    starter: () => grey(step(0, Math.cos(0))),
    solution: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(step(0, Math.cos(Math.atan2(py, px) * 6)));
    },
  },
  "glsl-polar-flower": {
    starter: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0.5, length(px, py)));
    },
    solution: (x, y) => {
      const [px, py] = centred(x, y);
      const r = 0.5 + 0.2 * Math.cos(Math.atan2(py, px) * 5);
      return grey(1 - step(r, length(px, py)));
    },
  },
  "glsl-random-cells": {
    starter: () => grey(random(0, 0)),
    solution: (x, y) => grey(random(Math.floor(x * 8), Math.floor(y * 8))),
  },
  "glsl-value-noise": {
    starter: (x, y) => grey(random(Math.floor(x * 4), Math.floor(y * 4))),
    solution: (x, y) => {
      const ix = Math.floor(x * 4);
      const iy = Math.floor(y * 4);
      const ux = smoothstep(0, 1, fract(x * 4));
      const uy = smoothstep(0, 1, fract(y * 4));
      const a = random(ix, iy);
      const b = random(ix + 1, iy);
      const c = random(ix, iy + 1);
      const d = random(ix + 1, iy + 1);
      return grey(mix(mix(a, b, ux), mix(c, d, ux), uy));
    },
  },
  "glsl-vignette": {
    starter: () => [1, 0.8, 0.4],
    solution: (x, y) => {
      const v = 1 - smoothstep(0.3, 0.75, length(x - 0.5, y - 0.5));
      return [v, 0.8 * v, 0.4 * v];
    },
  },
  "glsl-chromatic-aberration": {
    starter: (x, y) => grey(circleScene(x, y)),
    solution: (x, y) => [circleScene(x + 0.08, y), circleScene(x, y), circleScene(x - 0.08, y)],
  },
  "glsl-raymarch-sphere": {
    starter: (x, y) => raymarch(x, y, false),
    solution: (x, y) => raymarch(x, y, true),
  },
  "glsl-rotate": {
    starter: (x, y) => {
      const [px, py] = centred(x, y);
      return grey(1 - step(0, sdBox(px, py, 0.4, 0.4)));
    },
    solution: (x, y) => {
      const [qx, qy] = rotate2d(0.785, ...centred(x, y));
      return grey(1 - step(0, sdBox(qx, qy, 0.4, 0.4)));
    },
  },
  "glsl-rotate-tiles": {
    starter: (x, y) => {
      const [qx, qy] = rotate2d(0.785, fract(x * 3), fract(y * 3));
      return grey(1 - step(0, sdBox(qx, qy, 0.2, 0.2)));
    },
    solution: (x, y) => {
      const [qx, qy] = rotate2d(0.785, fract(x * 3) - 0.5, fract(y * 3) - 0.5);
      return grey(1 - step(0, sdBox(qx, qy, 0.2, 0.2)));
    },
  },
  "glsl-voronoi": {
    starter: (x, y) => cellular(x, y, 0),
    solution: (x, y) => cellular(x, y, 1),
  },
  "glsl-tonemap": {
    starter: (x) => [8 * x, 4.8 * x, 2.4 * x],
    solution: (x) => reinhard(x),
  },
  "glsl-gamma": {
    starter: (x, y) => gammaSphere(x, y, false),
    solution: (x, y) => gammaSphere(x, y, true),
  },
  "glsl-raymarch-normal": {
    starter: (x, y) => marchFloor(x, y, (p) => grey(lambert(v3norm(p), [0.6, 0.7, 0.8]))),
    solution: (x, y) => marchFloor(x, y, (p) => grey(lambert(gradientNormal(p), [0.6, 0.7, 0.8]))),
  },
  "glsl-raymarch-shadow": {
    starter: (x, y) => shadowLesson(x, y, false),
    solution: (x, y) => shadowLesson(x, y, true),
  },
};

describe("shader lessons modelled on the grader's sample grid", () => {
  for (const [id, model] of Object.entries(SHADER_MODELS)) {
    const lesson = lessonById(id);
    it(`${id}: the solution passes and the starter does not`, () => {
      expect(lesson, `lesson ${id} exists`).toBeDefined();
      const { validators, starterCode, solution } = lesson!.challenge;
      expect(evaluate(validators, shaderSnapshot(solution, model.solution)).failures).toEqual([]);
      expect(evaluate(validators, shaderSnapshot(starterCode, model.starter)).passed).toBe(false);
    });
  }
});

// ----------------------------------------------------------------- scene side

const PIXEL_KINDS: ReadonlySet<ValidatorSpec["kind"]> = new Set([
  "pixelApprox",
  "regionColor",
  "notUniform",
  "symmetric",
  "gradient",
  "smooth",
  "cellsFlat",
  "rendersNonEmpty",
]);

interface SceneRun {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly snapshot: SceneSnapshot;
}

/** Run learner JS the way the sandbox does, minus the WebGL renderer. */
function execScene(code: string, aspect = 1): SceneRun {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap }, setClearColor() {} };
  let error: string | null = null;
  try {
    new Function("THREE", "scene", "camera", "renderer", code)(THREE, scene, camera, renderer);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const snapshot: SceneSnapshot = {
    kind: "scene",
    error,
    source: code,
    objects: collectObjects(scene),
    camera: { type: camera.type, position: [camera.position.x, camera.position.y, camera.position.z] },
  };
  return { scene, camera, snapshot };
}

const runScene = (code: string): SceneSnapshot => execScene(code).snapshot;

/** The runner's clear colour #05060d as read back. */
const CLEAR: RGB = [5 / 255, 6 / 255, 13 / 255];
/** The runner's read-back grid (sandbox/runner.ts). */
const SCENE_GRID = 16;

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
/** A linear-space colour as written to the canvas (sRGB). */
const encode = (r: number, g: number, b: number): RGB => [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
/** How opaque a material draws: three ignores `opacity` unless `transparent`. */
const alphaOf = (m: THREE.Material): number => (m.transparent ? m.opacity : 1);

/** Can the flat model shade `m` without lighting maths? Basic colours (plain
 *  or a DataTexture), and standard materials in a scene with no light, which
 *  then show nothing but their emission. */
function flatShadable(m: THREE.Material, lit: boolean): boolean {
  if (m instanceof THREE.MeshBasicMaterial) {
    return !m.wireframe && (m.map === null || m.map instanceof THREE.DataTexture);
  }
  if (m instanceof THREE.MeshStandardMaterial) return !lit && !m.map && !m.emissiveMap;
  if (m instanceof THREE.PointsMaterial) return !m.map && !m.vertexColors && m.sizeAttenuation;
  return false;
}

/** The colour (as written to the canvas) of a flat-shadable surface at `uv`. */
function flatColor(m: THREE.Material, uv: THREE.Vector2 | undefined): RGB {
  if (m instanceof THREE.MeshStandardMaterial) {
    const e = m.emissive;
    const k = m.emissiveIntensity;
    return encode(e.r * k, e.g * k, e.b * k);
  }
  const { color, map } = m as THREE.MeshBasicMaterial;
  if (!(map instanceof THREE.DataTexture)) return encode(color.r, color.g, color.b);
  // Never flagged with needsUpdate ⇒ WebGL samples three's empty (black) texture.
  if (map.version === 0 || !uv) return [0, 0, 0];
  const { data, width, height } = map.image as { data: Uint8Array; width: number; height: number };
  // NearestFilter, flipY = false: texel row 0 is the bottom (v = 0).
  const i = (Math.min(height - 1, Math.floor(uv.y * height)) * width + Math.min(width - 1, Math.floor(uv.x * width))) * 4;
  // A NoColorSpace texel is linear, multiplied by the (linear) material colour.
  return encode((color.r * data[i]) / 255, (color.g * data[i + 1]) / 255, (color.b * data[i + 2]) / 255);
}

/** The read-back grid of an unlit scene, found by ray casting the pixels the
 *  runner samples (preview `aspect`, 360 px tall), or null when the scene holds
 *  anything this model cannot shade (lights on lit materials, fog, normal or
 *  shader materials, lines…). */
function flatRender({ scene, camera }: SceneRun, aspect: number): Sample[] | null {
  if (scene.fog) return null;
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const lit = scene.getObjectsByProperty("isLight", true).length > 0;
  const points: THREE.Points[] = [];
  let shadable = true;
  scene.traverse((o) => {
    if (o === scene || o instanceof THREE.Group || o instanceof THREE.Light) return;
    const material = (o as THREE.Mesh).material;
    if ((o instanceof THREE.Mesh || o instanceof THREE.Points) && !Array.isArray(material)) {
      shadable &&= flatShadable(material, lit);
      if (o instanceof THREE.Points) points.push(o);
    } else {
      shadable = false;
    }
  });
  if (!shadable) return null;

  const H = 360;
  const W = Math.round(H * aspect);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const out: Sample[] = [];
  for (let gy = 0; gy < SCENE_GRID; gy++) {
    for (let gx = 0; gx < SCENE_GRID; gx++) {
      const nx = (gx + 0.5) / SCENE_GRID;
      const ny = (gy + 0.5) / SCENE_GRID;
      // The centre of the pixel the runner reads for this sample, in NDC.
      ndc.set(((Math.floor(nx * W) + 0.5) / W) * 2 - 1, ((Math.floor(ny * H) + 0.5) / H) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      // Every surface on this pixel: [distance, colour, alpha].
      const layers: Array<[number, RGB, number]> = [];
      const seen = new Set<string>();
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        if (hit.object instanceof THREE.Points) continue; // squares, handled below
        // A ray through a shared edge hits both triangles; the GPU fills the
        // pixel once, so count the nearest hit per object (and instance).
        const key = `${hit.object.uuid}:${hit.instanceId ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = (hit.object as THREE.Mesh).material as THREE.Material;
        layers.push([hit.distance, flatColor(m, hit.uv), alphaOf(m)]);
      }
      // A point is a screen-aligned square, size / (2 · depth) NDC high on
      // each side of its centre (gl_PointSize = size · scale / depth).
      for (const p of points) {
        const m = p.material as THREE.PointsMaterial;
        const pos = p.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const world = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(p.matrixWorld);
          const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
          if (depth <= camera.near) continue;
          const at = world.clone().project(camera);
          const half = m.size / (2 * depth);
          if (Math.abs(at.x - ndc.x) <= half / aspect && Math.abs(at.y - ndc.y) <= half) {
            layers.push([world.distanceTo(camera.position), flatColor(m, undefined), alphaOf(m)]);
          }
        }
      }
      // Back to front over the clear colour: opaque surfaces cover what is
      // behind them, transparent ones blend in canvas space like WebGL does.
      layers.sort((a, b) => b[0] - a[0]);
      let rgb: RGB = CLEAR;
      for (const [, colour, a] of layers) {
        rgb = [colour[0] * a + rgb[0] * (1 - a), colour[1] * a + rgb[1] * (1 - a), colour[2] * a + rgb[2] * (1 - a)];
      }
      const [r, g, b] = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255) / 255);
      out.push({ x: nx, y: ny, rgba: [r, g, b, 1] });
    }
  }
  return out;
}

describe("Three.js lessons run against the installed three", () => {
  for (const lesson of LESSONS.filter((l) => l.id.startsWith("three-"))) {
    const { validators, starterCode, solution } = lesson.challenge;
    const judged = validators.filter((v) => !PIXEL_KINDS.has(v.kind));

    it(`${lesson.id}: the solution runs without error and passes every scene-graph check`, () => {
      const snap = runScene(solution);
      expect(snap.error).toBeNull();
      expect(evaluate(judged, snap).failures).toEqual([]);
    });

    it(`${lesson.id}: the starter runs without error but fails a scene-graph check`, () => {
      const snap = runScene(starterCode);
      expect(snap.error).toBeNull();
      expect(evaluate(judged, snap).passed).toBe(false);
    });
  }
});

/** The lessons whose scenes are unlit, so the flat model can draw them. */
const FLAT_LESSONS = [
  "three-first-mesh",
  "three-color",
  "three-position",
  "three-transparent",
  "three-emissive",
  "three-hierarchy",
  "three-instanced",
  "three-camera-fov",
  "three-points",
  "three-data-texture",
];

describe("unlit Three.js lessons judged on a ray-cast frame, pixels included", () => {
  const threeLessons = LESSONS.filter((l) => l.id.startsWith("three-"));

  it("draws exactly the unlit lessons (the rest need a GPU)", () => {
    const drawn = threeLessons.filter((l) => flatRender(execScene(l.challenge.solution), 1) !== null);
    expect(drawn.map((l) => l.id)).toEqual(FLAT_LESSONS);
  });

  for (const id of FLAT_LESSONS) {
    const { validators, starterCode, solution } = lessonById(id)!.challenge;
    // The preview is square on wide screens and 16:9 when pinned on narrow ones.
    for (const [shape, aspect] of [
      ["1:1", 1],
      ["16:9", 16 / 9],
    ] as const) {
      it(`${id} (${shape}): the solution passes and the starter does not`, () => {
        const solved = execScene(solution, aspect);
        const solvedFrame = flatRender(solved, aspect);
        expect(solvedFrame).not.toBeNull();
        expect(evaluate(validators, { ...solved.snapshot, samples: solvedFrame! }).failures).toEqual([]);

        const started = execScene(starterCode, aspect);
        const startedFrame = flatRender(started, aspect);
        expect(startedFrame).not.toBeNull();
        expect(evaluate(validators, { ...started.snapshot, samples: startedFrame! }).passed).toBe(false);
      });
    }
  }
});

describe("the flat model itself", () => {
  const frameOf = (code: string, aspect = 1): Sample[] | null => flatRender(execScene(code), aspect);
  const at = (frame: Sample[], x: number, y: number): RGB => {
    const s = frame.reduce((best, c) =>
      (c.x - x) ** 2 + (c.y - y) ** 2 < (best.x - x) ** 2 + (best.y - y) ** 2 ? c : best,
    );
    return [s.rgba[0], s.rgba[1], s.rgba[2]];
  };

  it("shows the clear colour where nothing is drawn", () => {
    expect(at(frameOf("")!, 0.5, 0.5)).toEqual(CLEAR.map((c) => Math.round(c * 255) / 255));
  });

  it("refuses scenes that need lighting, fog or other materials", () => {
    const ball = "new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), MAT)";
    const lit = "scene.add(new THREE.AmbientLight(0xffffff, 1));\n";
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshNormalMaterial()")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshStandardMaterial()")});${lit}`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshBasicMaterial({ wireframe: true })")});`)).toBeNull();
    expect(frameOf("scene.fog = new THREE.Fog(0x000000, 1, 2);")).toBeNull();
    expect(frameOf("scene.add(new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()));")).toBeNull();
    expect(
      frameOf("scene.add(new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ sizeAttenuation: false })));"),
    ).toBeNull();
  });

  it("keeps a basic colour unlit, even next to a light", () => {
    const frame = frameOf(
      "scene.add(new THREE.PointLight(0xffffff, 1));\n" +
        `scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 'red' })));`,
    );
    expect(at(frame!, 0.5, 0.5)).toEqual([1, 0, 0]);
  });
});
