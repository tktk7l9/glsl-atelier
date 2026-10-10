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
// and emissive colours, data textures, points, plain alpha blending, fog, a
// colour background, per-instance colours) are also "rendered" by casting a
// ray through every sample with three's own Raycaster and camera maths, at
// both preview shapes (1:1 and 16:9), so their pixel validators are judged
// here too. Lit, shadowed and custom-shader scenes need a real GPU and are
// left to the browser.

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

/** GLSL `mod(x, y)`: the result takes the sign of y (unlike JS `%`). */
const glslMod = (x: number, y: number): number => x - y * Math.floor(x / y);
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const BLACK3: RGB = [0, 0, 0];

/** The mirror lesson's butterfly, drawn after `fold` maps p.x (identity in the
 *  starter, abs in the solution). */
function butterfly(x: number, y: number, fold: (px: number) => number): RGB {
  const [cx, py] = centred(x, y);
  const px = fold(cx);
  const body = length(px * 6, py) - 0.5;
  const wing = Math.min(length(px - 0.42, py - 0.22) - 0.3, length(px - 0.3, py + 0.38) - 0.2);
  const col = mixRgb(BLACK3, [1, 0.55, 0.15], 1 - step(0, wing));
  return mixRgb(col, [0.95, 0.95, 0.95], 1 - step(0, body));
}

/** The kaleidoscope lesson: the motif drawn at the angle `fold` returns (the
 *  angle itself in the starter; folded into the mirrored wedge in the solution). */
const SEG = 6.2831853 / 6;
function kaleidoscope(x: number, y: number, fold: (a: number) => number): RGB {
  const [px, py] = centred(x, y);
  const r = length(px, py);
  const a = fold(Math.atan2(py, px));
  const qx = r * Math.cos(a);
  const qy = r * Math.sin(a);
  const petal = length(qx - 0.6, qy - 0.16) - 0.14;
  const bead = length(qx - 0.26, qy - 0.15) - 0.07;
  const col = mixRgb(BLACK3, [1, 0.4, 0.7], 1 - step(0, petal));
  return mixRgb(col, [0.3, 0.9, 1], 1 - step(0, bead));
}

/** The easing lesson at u_time = 1 (t = 0.5), with `ease` turning t into e. */
function easedBall(x: number, y: number, ease: (t: number) => number): RGB {
  const [px, py] = centred(x, y);
  const e = ease(fract(1 / 2));
  return grey(1 - step(0, length(px - mix(-0.6, 0.6, e), py) - 0.15));
}

/** The crescent lesson: the moon and the bite circle combined by `join`. */
function crescent(x: number, y: number, join: (moon: number, bite: number) => number): RGB {
  const [px, py] = centred(x, y);
  const moon = length(px, py) - 0.6;
  const bite = length(px - 0.3, py - 0.15) - 0.5;
  const c = 1 - step(0, join(moon, bite));
  return [c, 0.9 * c, 0.55 * c];
}

/** The linear-mix lesson: red → green, mixed as display values, or in the top
 *  half "linear" (decode, mix, encode) or "outputOnly" (mix, then encode: the
 *  near miss that skips decoding the endpoints). */
function redToGreen(x: number, y: number, top: "naive" | "linear" | "outputOnly"): RGB {
  const red: RGB = [1, 0.1, 0.1];
  const green: RGB = [0.1, 1, 0.1];
  const toLinear = (c: number): number => Math.pow(c, 2.2);
  const toScreen = (c: number): number => Math.pow(c, 1 / 2.2);
  const naive = mixRgb(red, green, x);
  if (y <= 0.5 || top === "naive") return naive;
  if (top === "outputOnly") return [toScreen(naive[0]), toScreen(naive[1]), toScreen(naive[2])];
  const lin = mixRgb([toLinear(red[0]), toLinear(red[1]), toLinear(red[2])], [toLinear(green[0]), toLinear(green[1]), toLinear(green[2])], x);
  return [toScreen(lin[0]), toScreen(lin[1]), toScreen(lin[2])];
}

/** The dither lesson's Bayer thresholds (bayer2 / bayer4 in the GLSL). */
const bayer2 = (ax: number, ay: number): number =>
  fract(glslMod(Math.floor(ax), 2) * 0.5 + glslMod(Math.floor(ay), 2) * 0.75);
const bayer4 = (ax: number, ay: number): number => bayer2(ax * 0.5, ay * 0.5) * 0.25 + bayer2(ax, ay) + 1 / 32;

/** The dither lesson, with `pick` turning (gray, threshold) into c. On the
 *  square grader canvas, gl_FragCoord / u_resolution.y is st; gray is taken
 *  at the centre of the cell (40 rows). */
function dither(x: number, y: number, pick: (gray: number, threshold: number) => number): RGB {
  const cx = Math.floor(x * 40);
  const cy = Math.floor(y * 40);
  const c = pick((cx + 0.5) / 40, bayer4(cx, cy));
  return mixRgb([0.06, 0.22, 0.06], [0.61, 0.74, 0.06], c);
}

/** The pixel (column or row) whose centre is at `v` (0..1) on the grader canvas. */
const pixelOf = (v: number): number => Math.round(v * SIZE - 0.5);

/** GLSL fwidth(f) at the pixel whose centre is (x, y): |dFdx| + |dFdy|, each
 *  the difference across the pixel's 2×2 quad, as GPUs take derivatives. */
function fwidth(f: (x: number, y: number) => number, x: number, y: number): number {
  const qx = pixelOf(x) - (pixelOf(x) % 2);
  const qy = pixelOf(y) - (pixelOf(y) % 2);
  const at = (px: number, py: number): number => f((px + 0.5) / SIZE, (py + 0.5) / SIZE);
  return Math.abs(at(qx + 1, qy) - at(qx, qy)) + Math.abs(at(qx, qy + 1) - at(qx, qy));
}

/** The fwidth lesson's disc: distance to its edge, and `edge` turning it into c. */
const discDistance = (x: number, y: number): number => length(x - 0.5, y - 0.5) - 0.3;
const disc = (x: number, y: number, edge: (d: number, w: number) => number): RGB =>
  grey(edge(discDistance(x, y), fwidth(discDistance, x, y)));

/** The screen lesson: the evening sky and the glow, combined channel by channel. */
function skyAndGlow(x: number, y: number, combine: (base: number, light: number) => number): RGB {
  const glow = 1 - smoothstep(0.1, 0.45, length(x - 0.35, y - 0.4));
  const base = [mix(0.2, 0.08, y), mix(0.35, 0.12, y), mix(0.6, 0.3, y)];
  const light = [0.85, 0.6, 0.3].map((c) => c * glow);
  return [combine(base[0], light[0]), combine(base[1], light[1]), combine(base[2], light[2])];
}

/** The overlay lesson: the grey ramp a = x under the colour b, multiplied in
 *  the bottom half and combined by `top` in the top half. */
const OVERLAY_B = [0.2, 0.8, 0.95] as const;
function rampUnder(x: number, y: number, top: (a: number, b: number) => number): RGB {
  const pick = y > 0.5 ? top : (a: number, b: number) => a * b;
  return [pick(x, OVERLAY_B[0]), pick(x, OVERLAY_B[1]), pick(x, OVERLAY_B[2])];
}
const overlay = (a: number, b: number): number => mix(2 * a * b, 1 - 2 * (1 - a) * (1 - b), step(0.5, a));

/** The brick lesson: 3×6 bricks, `shift` moving each row along by a fraction. */
function bricks(x: number, y: number, shift: (row: number) => number): RGB {
  const row = Math.floor(y * 6);
  const brick = step(0.1, fract(x * 3 + shift(row))) * step(0.2, fract(y * 6));
  return mixRgb([0.85, 0.82, 0.75], [0.72, 0.3, 0.2], brick);
}

/** The hexagon lesson: offsets from lattice A and from lattice B (shifted by
 *  `bShift`), with `pick` choosing the offset that is drawn. */
type V2 = readonly [number, number];
const HEX_S: V2 = [1, 1.7320508];
const hexDist = (gx: number, gy: number): number =>
  Math.max(Math.abs(gx) * 0.5 + Math.abs(gy) * 0.8660254, Math.abs(gx));
function honeycomb(x: number, y: number, pick: (a: V2, b: V2) => V2, bShift: V2 = [0.5, 0.8660254]): RGB {
  const [px, py] = [x * 5, y * 5];
  const a: V2 = [glslMod(px, HEX_S[0]) - 0.5, glslMod(py, HEX_S[1]) - HEX_S[1] / 2];
  const b: V2 = [glslMod(px - bShift[0], HEX_S[0]) - 0.5, glslMod(py - bShift[1], HEX_S[1]) - HEX_S[1] / 2];
  const g = pick(a, b);
  return mixRgb([1, 0.75, 0.2], [0.3, 0.15, 0.02], step(0.42, hexDist(g[0], g[1])));
}
const nearer = (a: V2, b: V2): V2 => (a[0] ** 2 + a[1] ** 2 < b[0] ** 2 + b[1] ** 2 ? a : b);

/** The truchet lesson (6×6 tiles); `flips` decides per pixel whether the
 *  tile's f.x is mirrored. */
function truchet(x: number, y: number, flips: (ix: number, iy: number, x: number, y: number) => boolean): RGB {
  const [ix, iy] = [Math.floor(x * 6), Math.floor(y * 6)];
  const fy = fract(y * 6);
  const fx = flips(ix, iy, x, y) ? 1 - fract(x * 6) : fract(x * 6);
  const d = Math.min(Math.abs(length(fx, fy) - 0.5), Math.abs(length(fx - 1, fy - 1) - 0.5));
  return mixRgb([0.05, 0.08, 0.2], [0.95, 0.85, 0.6], 1 - step(0.13, d));
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
  "glsl-easing": {
    starter: (x, y) => easedBall(x, y, (t) => t),
    solution: (x, y) => easedBall(x, y, (t) => 1 - (1 - t) * (1 - t)),
  },
  "glsl-sdf-subtract": {
    starter: (x, y) => crescent(x, y, Math.min),
    solution: (x, y) => crescent(x, y, (moon, bite) => Math.max(moon, -bite)),
  },
  "glsl-mirror": {
    starter: (x, y) => butterfly(x, y, (px) => px),
    solution: (x, y) => butterfly(x, y, Math.abs),
  },
  "glsl-kaleidoscope": {
    starter: (x, y) => kaleidoscope(x, y, (a) => a),
    solution: (x, y) => kaleidoscope(x, y, (a) => Math.abs(glslMod(a, SEG) - SEG * 0.5)),
  },
  "glsl-linear-mix": {
    starter: (x, y) => redToGreen(x, y, "naive"),
    solution: (x, y) => redToGreen(x, y, "linear"),
  },
  "glsl-dither": {
    starter: (x, y) => dither(x, y, (gray) => gray),
    solution: (x, y) => dither(x, y, (gray, threshold) => step(threshold, gray)),
  },
  "glsl-fwidth": {
    starter: (x, y) => disc(x, y, (d) => 1 - step(0, d)),
    solution: (x, y) => disc(x, y, (d, w) => 1 - smoothstep(-w, w, d)),
  },
  "glsl-screen-blend": {
    starter: (x, y) => skyAndGlow(x, y, (a, b) => a + b),
    solution: (x, y) => skyAndGlow(x, y, (a, b) => 1 - (1 - a) * (1 - b)),
  },
  "glsl-overlay-blend": {
    starter: (x, y) => rampUnder(x, y, (a, b) => a * b),
    solution: (x, y) => rampUnder(x, y, overlay),
  },
  "glsl-brick": {
    starter: (x, y) => bricks(x, y, () => 0),
    solution: (x, y) => bricks(x, y, (row) => glslMod(row, 2) * 0.5),
  },
  "glsl-hex-grid": {
    starter: (x, y) => honeycomb(x, y, (a) => a),
    solution: (x, y) => honeycomb(x, y, nearer),
  },
  "glsl-truchet": {
    starter: (x, y) => truchet(x, y, () => false),
    solution: (x, y) => truchet(x, y, (ix, iy) => random(ix, iy) > 0.5),
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

/** Plausible wrong answers to the 2026-10 (third and fourth batch) shader
 *  lessons; each must be rejected. The source is the solution's, so only the
 *  drawing decides. */
const SHADER_NEAR_MISSES: Record<string, ReadonlyArray<readonly [string, Shade]>> = {
  "glsl-easing": [
    ["ease-in-out (smoothstep) is still halfway at t = 0.5", (x, y) => easedBall(x, y, (t) => smoothstep(0, 1, t))],
    ["ease-in (t * t) lags behind", (x, y) => easedBall(x, y, (t) => t * t)],
    ["jumping straight to the end", (x, y) => easedBall(x, y, () => 1)],
  ],
  "glsl-sdf-subtract": [
    ["the intersection max(moon, bite)", (x, y) => crescent(x, y, Math.max)],
    ["the bite minus the moon", (x, y) => crescent(x, y, (moon, bite) => Math.max(bite, -moon))],
  ],
  "glsl-mirror": [["flipping p.x instead of folding it", (x, y) => butterfly(x, y, (px) => -px)]],
  "glsl-kaleidoscope": [
    ["repeating the wedge without mirroring it", (x, y) => kaleidoscope(x, y, (a) => glslMod(a, SEG))],
    ["mirroring without repeating", (x, y) => kaleidoscope(x, y, Math.abs)],
  ],
  "glsl-linear-mix": [
    ["gamma-correcting only the mixed result", (x, y) => redToGreen(x, y, "outputOnly")],
  ],
  "glsl-dither": [
    ["the comparison turned round", (x, y) => dither(x, y, (gray, threshold) => step(gray, threshold))],
    ["one threshold for every cell", (x, y) => dither(x, y, (gray) => step(0.5, gray))],
  ],
  // 2026-10, fourth batch.
  "glsl-fwidth": [
    ["a fixed blur six pixels wide (smoothstep(-0.05, 0.05, d))", (x, y) => disc(x, y, (d) => 1 - smoothstep(-0.05, 0.05, d))],
    ["the blur only inside, over five pixels", (x, y) => disc(x, y, (d, w) => 1 - smoothstep(-5 * w, 0, d))],
  ],
  "glsl-screen-blend": [
    ["max(base, light)", (x, y) => skyAndGlow(x, y, Math.max)],
    ["multiply", (x, y) => skyAndGlow(x, y, (a, b) => a * b)],
    ["the average mix(base, light, 0.5)", (x, y) => skyAndGlow(x, y, (a, b) => mix(a, b, 0.5))],
    ["without the inner inversion: 1 - base * light", (x, y) => skyAndGlow(x, y, (a, b) => 1 - a * b)],
    ["without the outer inversion: (1 - base) * (1 - light)", (x, y) => skyAndGlow(x, y, (a, b) => (1 - a) * (1 - b))],
  ],
  "glsl-overlay-blend": [
    ["screen everywhere", (x, y) => rampUnder(x, y, (a, b) => 1 - (1 - a) * (1 - b))],
    ["only the dark formula 2ab", (x, y) => rampUnder(x, y, (a, b) => 2 * a * b)],
    ["only the light formula", (x, y) => rampUnder(x, y, (a, b) => 1 - 2 * (1 - a) * (1 - b))],
    ["switching on the colour b (hard light)", (x, y) => rampUnder(x, y, (a, b) => overlay(b, a))],
    ["the two formulas the wrong way round", (x, y) => rampUnder(x, y, (a, b) => mix(1 - 2 * (1 - a) * (1 - b), 2 * a * b, step(0.5, a)))],
    ["mixing by a instead of step(0.5, a)", (x, y) => rampUnder(x, y, (a, b) => mix(2 * a * b, 1 - 2 * (1 - a) * (1 - b), a))],
  ],
  "glsl-brick": [
    ["every row shifted", (x, y) => bricks(x, y, () => 0.5)],
    ["the even rows shifted instead", (x, y) => bricks(x, y, (row) => (1 - glslMod(row, 2)) * 0.5)],
    ["a quarter brick instead of a half", (x, y) => bricks(x, y, (row) => glslMod(row, 2) * 0.25)],
  ],
  "glsl-hex-grid": [
    ["picking the farther centre", (x, y) => honeycomb(x, y, (a, b) => (nearer(a, b) === a ? b : a))],
    ["lattice B only", (x, y) => honeycomb(x, y, (_a, b) => b)],
    ["lattice B shifted by (0.5, 0.5) instead of s * 0.5", (x, y) => honeycomb(x, y, nearer, [0.5, 0.5])],
  ],
  "glsl-truchet": [
    ["every tile flipped", (x, y) => truchet(x, y, () => true)],
    ["a random flip per pixel, not per tile", (x, y) => truchet(x, y, (_ix, _iy, px, py) => random(px * 6, py * 6) > 0.5)],
  ],
};

describe("shader near misses are rejected", () => {
  for (const [id, misses] of Object.entries(SHADER_NEAR_MISSES)) {
    for (const [label, shade] of misses) {
      it(`${id}: ${label}`, () => {
        const { validators, solution } = lessonById(id)!.challenge;
        expect(evaluate(validators, shaderSnapshot(solution, shade)).passed).toBe(false);
      });
    }
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

/** Does `spec` read the rendered pixels? A group (allOf / anyOf) does when
 *  everything in it does. */
const readsPixels = (spec: ValidatorSpec): boolean =>
  spec.kind === "allOf" || spec.kind === "anyOf" ? spec.of.every(readsPixels) : PIXEL_KINDS.has(spec.kind);

/** The renderer switches lesson code may flip (reset by the runner before each run). */
interface RendererState {
  shadowMap: { enabled: boolean; type: THREE.ShadowMapType };
  localClippingEnabled: boolean;
  clippingPlanes: THREE.Plane[];
  setClearColor(): void;
}

interface SceneRun {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: RendererState;
  readonly snapshot: SceneSnapshot;
}

/** A Canvas 2D stand-in for Node: opaque fillRect in CSS colours, kept as
 *  RGBA bytes with row 0 at the top, like a real canvas. */
class FakeCanvas {
  width = 300;
  height = 150;
  pixels = new Uint8Array(0);
  getContext(kind: string) {
    if (kind !== "2d") return null;
    this.pixels = new Uint8Array(this.width * this.height * 4);
    let fill = [0, 0, 0, 255];
    const canvas = this;
    return {
      set fillStyle(style: string) {
        const hex = new THREE.Color().setStyle(style).getHex(); // back in sRGB, as a canvas stores it
        fill = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255];
      },
      fillRect(x: number, y: number, w: number, h: number) {
        for (let py = Math.max(0, y); py < Math.min(canvas.height, y + h); py++) {
          for (let px = Math.max(0, x); px < Math.min(canvas.width, x + w); px++) {
            canvas.pixels.set(fill, (py * canvas.width + px) * 4);
          }
        }
      },
    };
  }
}

/** Run learner JS the way the sandbox does, minus the WebGL renderer. */
function execScene(code: string, aspect = 1): SceneRun {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const renderer: RendererState = {
    shadowMap: { enabled: false, type: THREE.PCFShadowMap },
    localClippingEnabled: false,
    clippingPlanes: [],
    setClearColor() {},
  };
  let error: string | null = null;
  // Lesson code may draw on a canvas (CanvasTexture); Node has no DOM.
  const global = globalThis as { document?: unknown };
  global.document = { createElement: (tag: string) => (tag === "canvas" ? new FakeCanvas() : null) };
  try {
    new Function("THREE", "scene", "camera", "renderer", code)(THREE, scene, camera, renderer);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    delete global.document;
  }
  const snapshot: SceneSnapshot = {
    kind: "scene",
    error,
    source: code,
    objects: collectObjects(scene),
    camera: { type: camera.type, position: [camera.position.x, camera.position.y, camera.position.z] },
  };
  return { scene, camera, renderer, snapshot };
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

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** Textures the model can sample: a DataTexture or a canvas drawn in Node. */
const sampleable = (map: THREE.Texture): boolean =>
  map instanceof THREE.DataTexture || (map instanceof THREE.CanvasTexture && map.image instanceof FakeCanvas);

/** Can the flat model shade `m` without lighting maths? Basic colours (plain
 *  or textured), normal colours, and standard materials in a scene with no
 *  light, which then show nothing but their emission. */
function flatShadable(m: THREE.Material, lit: boolean): boolean {
  if (m instanceof THREE.MeshBasicMaterial) return !m.wireframe && (m.map === null || sampleable(m.map));
  if (m instanceof THREE.MeshNormalMaterial) return !m.wireframe && !m.flatShading && !m.normalMap && !m.bumpMap;
  if (m instanceof THREE.MeshStandardMaterial) return !lit && !m.map && !m.emissiveMap;
  if (m instanceof THREE.PointsMaterial) return !m.map && !m.vertexColors && m.sizeAttenuation;
  return false;
}

/** The texel under `uv` as a linear colour. The lessons sample well inside
 *  texels, so nearest sampling stands in for every filter. */
function texel(map: THREE.Texture, uv: THREE.Vector2): RGB {
  // repeat / offset / rotation, as the renderer's uvTransform applies them.
  map.updateMatrix();
  const at = uv.clone().applyMatrix3(map.matrix);
  const wrap = (v: number, mode: THREE.Wrapping): number =>
    mode === THREE.RepeatWrapping ? fract(v) : Math.min(1, Math.max(0, v)); // else ClampToEdge
  const u = wrap(at.x, map.wrapS);
  const v = wrap(at.y, map.wrapT);
  const { data, width, height } =
    map.image instanceof FakeCanvas
      ? { data: map.image.pixels, width: map.image.width, height: map.image.height }
      : (map.image as { data: Uint8Array; width: number; height: number });
  const column = Math.min(width - 1, Math.floor(u * width));
  const fromBottom = Math.min(height - 1, Math.floor(v * height));
  // A DataTexture's first row is the bottom (flipY = false); a canvas's first
  // row is its top, flipped up to v = 1 on upload (flipY = true).
  const row = map.flipY ? height - 1 - fromBottom : fromBottom;
  const i = (row * width + column) * 4;
  const raw: RGB = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
  // A NoColorSpace texel is used as linear; an sRGB one is decoded first.
  return map.colorSpace === THREE.SRGBColorSpace ? [srgbToLinear(raw[0]), srgbToLinear(raw[1]), srgbToLinear(raw[2])] : raw;
}

/** The colour MeshNormalMaterial writes for a ray hit: the interpolated vertex
 *  normal turned towards the viewer (as the shader flips back faces), in view
 *  space, as normal * 0.5 + 0.5, with no colour-space encoding. */
function normalColor(hit: THREE.Intersection, camera: THREE.Camera): RGB {
  const n = (hit.normal as THREE.Vector3).clone().transformDirection(hit.object.matrixWorld);
  n.transformDirection(camera.matrixWorldInverse);
  return [n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5];
}

/** The linear colour an InstancedMesh gives the instance `hit` landed on
 *  (setColorAt), which multiplies the material colour; white otherwise. */
function instanceTint(hit: THREE.Intersection | undefined): RGB {
  const o = hit?.object;
  if (!(o instanceof THREE.InstancedMesh) || !o.instanceColor || hit?.instanceId === undefined) return [1, 1, 1];
  const i = hit.instanceId * 3;
  const c = o.instanceColor.array;
  return [c[i], c[i + 1], c[i + 2]];
}

/** The colour (as written to the canvas) of a flat-shadable surface where
 *  `hit` lands (undefined for a point of a Points object). */
function flatColor(m: THREE.Material, hit: THREE.Intersection | undefined): RGB {
  if (m instanceof THREE.MeshStandardMaterial) {
    const e = m.emissive;
    const k = m.emissiveIntensity;
    return encode(e.r * k, e.g * k, e.b * k);
  }
  const { color, map } = m as THREE.MeshBasicMaterial;
  const [tr, tg, tb] = instanceTint(hit);
  if (!map) return encode(color.r * tr, color.g * tg, color.b * tb);
  // Never flagged with needsUpdate ⇒ WebGL samples three's empty (black) texture.
  if (map.version === 0 || !hit?.uv) return [0, 0, 0];
  // The texel is multiplied by the (linear) material colour.
  const [r, g, b] = texel(map, hit.uv);
  return encode(color.r * r * tr, color.g * g * tg, color.b * b * tb);
}

/** A linear colour as the canvas holds it (sRGB), e.g. a background colour. */
const srgbOf = (c: THREE.Color): RGB => encode(c.r, c.g, c.b);

/** Fog as three's shaders apply it: after the output encoding, mixing towards
 *  the fog colour (in sRGB) by the point's view depth — smoothstep(near, far,
 *  depth) for Fog, 1 − exp(−(density · depth)²) for FogExp2. Materials that
 *  ignore fog (MeshNormalMaterial) keep their colour. */
function fogged(scene: THREE.Scene, camera: THREE.Camera, m: THREE.Material, point: THREE.Vector3, colour: RGB): RGB {
  const fog = scene.fog;
  if (!fog || !(m as { fog?: boolean }).fog) return colour;
  const depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const amount = fog instanceof THREE.FogExp2 ? 1 - Math.exp(-((fog.density * depth) ** 2)) : smoothstep(fog.near, fog.far, depth);
  const target = srgbOf(fog.color);
  return [mix(colour[0], target[0], amount), mix(colour[1], target[1], amount), mix(colour[2], target[2], amount)];
}

/** Does the renderer draw `o`? Not when it or an ancestor is hidden. */
function drawn(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Is `point` on `material` cut away by a clipping plane? Global planes always
 *  apply; a material's own only with renderer.localClippingEnabled. A point is
 *  clipped on the negative side of any plane (clipIntersection = false). */
function clipped(renderer: RendererState, material: THREE.Material, point: THREE.Vector3): boolean {
  const planes = [...renderer.clippingPlanes, ...(renderer.localClippingEnabled ? (material.clippingPlanes ?? []) : [])];
  return planes.some((plane) => plane.distanceToPoint(point) < 0);
}

/** The read-back grid of an unlit scene, found by ray casting the pixels the
 *  runner samples (preview `aspect`, 360 px tall), or null when the scene holds
 *  anything this model cannot shade (lights on lit materials, shader
 *  materials, lines, a textured background…). */
function flatRender({ scene, camera, renderer }: SceneRun, aspect: number): Sample[] | null {
  const background = scene.background;
  if (background !== null && !(background instanceof THREE.Color)) return null;
  // A Color background is the clear colour, as written (sRGB).
  const clear = background ? srgbOf(background) : CLEAR;
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
        // The Raycaster ignores `visible`; the renderer skips hidden subtrees.
        if (!drawn(hit.object)) continue;
        const m = (hit.object as THREE.Mesh).material as THREE.Material;
        // A clipped fragment is discarded, so the ray goes on to what is behind.
        if (clipped(renderer, m, hit.point)) continue;
        // A ray through a shared edge hits both triangles; the GPU fills the
        // pixel once, so count the nearest hit per object (and instance).
        const key = `${hit.object.uuid}:${hit.instanceId ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const colour = m instanceof THREE.MeshNormalMaterial ? normalColor(hit, camera) : flatColor(m, hit);
        layers.push([hit.distance, fogged(scene, camera, m, hit.point, colour), alphaOf(m)]);
      }
      // A point is a screen-aligned square, size / (2 · depth) NDC high on
      // each side of its centre (gl_PointSize = size · scale / depth).
      for (const p of points) {
        if (!drawn(p)) continue;
        const m = p.material as THREE.PointsMaterial;
        const pos = p.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const world = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(p.matrixWorld);
          const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
          if (depth <= camera.near) continue;
          const at = world.clone().project(camera);
          const half = m.size / (2 * depth);
          if (Math.abs(at.x - ndc.x) <= half / aspect && Math.abs(at.y - ndc.y) <= half) {
            const colour = fogged(scene, camera, m, world, flatColor(m, undefined));
            layers.push([world.distanceTo(camera.position), colour, alphaOf(m)]);
          }
        }
      }
      // Back to front over the clear colour: opaque surfaces cover what is
      // behind them, transparent ones blend in canvas space like WebGL does.
      layers.sort((a, b) => b[0] - a[0]);
      let rgb: RGB = clear;
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
    const judged = validators.filter((v) => !readsPixels(v));

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
  "three-sphere",
  "three-torus",
  "three-plane",
  "three-normal-material",
  "three-transparent",
  "three-clipping",
  "three-emissive",
  "three-scale",
  "three-group",
  "three-hierarchy",
  "three-instanced",
  "three-instance-color",
  "three-camera-back",
  "three-camera-angle",
  "three-camera-fov",
  "three-raycast",
  "three-rotate",
  "three-keyframes",
  "three-points",
  "three-data-texture",
  "three-texture-repeat",
  "three-canvas-texture",
  "three-lathe",
  "three-extrude",
  "three-tube",
  "three-fog",
  "three-fog-exp2",
];

describe("unlit Three.js lessons judged on a ray-cast frame, pixels included", () => {
  const threeLessons = LESSONS.filter((l) => l.id.startsWith("three-"));

  it("draws exactly the unlit lessons (the rest need a GPU)", () => {
    const rendered = threeLessons.filter((l) => flatRender(execScene(l.challenge.solution), 1) !== null);
    expect(rendered.map((l) => l.id)).toEqual(FLAT_LESSONS);
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

/** Plausible wrong answers to the 2026-10 (third batch) unlit scene lessons,
 *  as edits of the solution; each must be rejected at both preview shapes. */
const SCENE_NEAR_MISSES: Record<string, ReadonlyArray<readonly [string, (solution: string) => string]>> = {
  "three-clipping": [
    ["planes without renderer.localClippingEnabled", (s) => s.replace("renderer.localClippingEnabled = true;\n", "")],
    ["the plane facing up (keeps the top half)", (s) => s.replace("Vector3(0, -1, 0)", "Vector3(0, 1, 0)")],
    ["hiding the shell instead of cutting it", (s) => `${s}shell.visible = false;\n`],
  ],
  "three-keyframes": [
    ["three keys but the middle one still down", (s) => s.replace("0, 1.5, 0,   // 1 秒: 上", "0, -1.5, 0,  // 1 秒: 下")],
    ["the top key at 2 s (halfway up at 1 s)", (s) => s.replace("[0, 1, 2]", "[0, 2, 4]")],
  ],
  "three-texture-repeat": [
    ["repeat without RepeatWrapping (the edge texel is stretched)", (s) => s.replace(/tex\.wrap[ST] = THREE\.RepeatWrapping;\n/g, "")],
    ["three repeats instead of four", (s) => s.replace("repeat.set(1, 4)", "repeat.set(1, 3)")],
  ],
  "three-canvas-texture": [
    ["no colorSpace (the canvas colours come out washed out)", (s) => s.replace(/tex\.colorSpace = [^\n]*\n/, "")],
  ],
  // 2026-10, fourth batch.
  "three-instance-color": [
    [
      "setting material.color in the loop (every rung ends up the last colour)",
      (s) => s.replace(/rungs\.setColorAt\(i, [^\n]*\n/, "rungs.material.color.set(colors[i]);  // setColorAt\n"),
    ],
    ["the colours in reverse order", (s) => s.replace("colors[i]))", "colors[4 - i]))")],
  ],
  "three-raycast": [
    ["intersecting without setFromCamera (the ray starts inside the ball)", (s) => s.replace(/raycaster\.setFromCamera\([^\n]*\n/, "")],
    ["the face normal instead of the hit point", (s) => s.replace("hits[0].point", "hits[0].face.normal")],
    ["the pointer on the lower half (0, -0.4)", (s) => s.replace("Vector2(0, 0.4)", "Vector2(0, -0.4)")],
  ],
  "three-lathe": [
    [
      "x and y swapped in the profile (height, radius)",
      (s) => s.replace(/Vector2\((-?[\d.]+), (-?[\d.]+)\)/g, "Vector2($2, $1)"),
    ],
    ["half a turn (phiLength Math.PI)", (s) => s.replace("LatheGeometry(points, 48)", "LatheGeometry(points, 48, 0, Math.PI)")],
  ],
  "three-extrude": [["a depth of 0.2 (too thin to see from above)", (s) => s.replace("depth: 0.8", "depth: 0.2")]],
  "three-tube": [
    ["a thin wire (radius 0.03)", (s) => s.replace("TubeGeometry(curve, 300, 0.22, 16)", "TubeGeometry(curve, 300, 0.03, 16)")],
  ],
  "three-fog-exp2": [
    ["density 0.05 (too thin)", (s) => s.replace("'lightblue', 0.12", "'lightblue', 0.05")],
    ["density 0.3 (too thick)", (s) => s.replace("'lightblue', 0.12", "'lightblue', 0.3")],
    ["a white fog against the blue sky", (s) => s.replace("FogExp2('lightblue'", "FogExp2('white'")],
  ],
};

describe("unlit scene near misses are rejected", () => {
  for (const [id, misses] of Object.entries(SCENE_NEAR_MISSES)) {
    const { validators, solution } = lessonById(id)!.challenge;
    for (const [label, edit] of misses) {
      it(`${id}: ${label}`, () => {
        const code = edit(solution);
        expect(code).not.toBe(solution);
        for (const aspect of [1, 16 / 9]) {
          const run = execScene(code, aspect);
          const frame = flatRender(run, aspect);
          expect(frame).not.toBeNull();
          expect(evaluate(validators, { ...run.snapshot, samples: frame! }).passed).toBe(false);
        }
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

  it("refuses scenes that need lighting, other materials or a textured background", () => {
    const ball = "new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), MAT)";
    const lit = "scene.add(new THREE.AmbientLight(0xffffff, 1));\n";
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.ShaderMaterial()")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshNormalMaterial({ flatShading: true })")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshStandardMaterial()")});${lit}`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshBasicMaterial({ wireframe: true })")});`)).toBeNull();
    expect(frameOf("scene.background = new THREE.Texture();")).toBeNull();
    expect(frameOf("scene.add(new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()));")).toBeNull();
    expect(
      frameOf("scene.add(new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ sizeAttenuation: false })));"),
    ).toBeNull();
  });

  it("draws normal colours: the middle of a sphere faces the camera, its top faces up", () => {
    const frame = frameOf("scene.add(new THREE.Mesh(new THREE.SphereGeometry(2, 64, 32), new THREE.MeshNormalMaterial()));")!;
    const [r, g, b] = at(frame, 0.5, 0.5);
    expect([r, g]).toEqual([expect.closeTo(0.5, 1), expect.closeTo(0.5, 1)]);
    expect(b).toBeGreaterThan(0.95);
    expect(at(frame, 0.5, 0.78)[1]).toBeGreaterThan(0.7);
  });

  it("keeps a basic colour unlit, even next to a light", () => {
    const frame = frameOf(
      "scene.add(new THREE.PointLight(0xffffff, 1));\n" +
        `scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 'red' })));`,
    );
    expect(at(frame!, 0.5, 0.5)).toEqual([1, 0, 0]);
  });

  // A white wall facing the camera 5 away, then a black fog over it.
  const wall = (material: string) =>
    `scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.${material}));\n`;

  it("fades into Fog by smoothstep(near, far) of the view depth, and into FogExp2 by its density", () => {
    const basic = wall("MeshBasicMaterial({ color: 'white' })");
    // smoothstep(3, 8, 5) = 0.352: white loses 35% towards the black fog.
    expect(at(frameOf(basic + "scene.fog = new THREE.Fog(0x000000, 3, 8);")!, 0.5, 0.5)[0]).toBeCloseTo(0.648, 2);
    // 1 − exp(−(0.1 · 5)²) = 0.221.
    expect(at(frameOf(basic + "scene.fog = new THREE.FogExp2(0x000000, 0.1);")!, 0.5, 0.5)[0]).toBeCloseTo(0.779, 2);
    // Points are fogged too; MeshNormalMaterial ignores fog.
    const dot =
      "scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), new THREE.PointsMaterial({ color: 'white', size: 2 })));\n";
    expect(at(frameOf(dot + "scene.fog = new THREE.FogExp2(0x000000, 0.1);")!, 0.5, 0.5)[0]).toBeCloseTo(0.779, 2);
    const normal = at(frameOf(wall("MeshNormalMaterial()") + "scene.fog = new THREE.Fog(0x000000, 3, 8);")!, 0.5, 0.5);
    expect(normal[2]).toBe(1);
  });

  it("clears to a Color background, as written (sRGB)", () => {
    const frame = frameOf("scene.background = new THREE.Color('lightblue');")!;
    expect(at(frame, 0.5, 0.5).map((c) => Math.round(c * 255))).toEqual([173, 216, 230]);
  });

  it("multiplies each instance's setColorAt colour into the material colour", () => {
    const frame = frameOf(
      "const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 1, 1), new THREE.MeshBasicMaterial({ color: 'white' }), 2);\n" +
        "bars.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -1, 0));\n" +
        "bars.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 1, 0));\n" +
        "bars.setColorAt(0, new THREE.Color('red'));\n" +
        "scene.add(bars);\n",
    )!;
    expect(at(frame, 0.5, 0.34)).toEqual([1, 0, 0]);
    // An instance never given a colour keeps the default white.
    expect(at(frame, 0.5, 0.66)).toEqual([1, 1, 1]);
  });
});
