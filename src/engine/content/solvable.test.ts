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
// are judged on the resulting objects. Pixel validators need a rendered frame
// and are left to the browser.

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

/** Run learner JS the way the sandbox does, minus the WebGL renderer. */
function runScene(code: string): SceneSnapshot {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap }, setClearColor() {} };
  let error: string | null = null;
  try {
    new Function("THREE", "scene", "camera", "renderer", code)(THREE, scene, camera, renderer);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return {
    kind: "scene",
    error,
    source: code,
    objects: collectObjects(scene),
    camera: { type: camera.type, position: [camera.position.x, camera.position.y, camera.position.z] },
  };
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
