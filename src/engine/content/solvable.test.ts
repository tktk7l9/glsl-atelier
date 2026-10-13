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
// and emissive colours, data textures, points, sprites, plain alpha blending,
// fog, a colour background, per-instance colours), or lit only by ambient and
// hemisphere lights (which depend on the normal alone), are also "rendered"
// by casting a ray through every sample with three's own Raycaster and camera
// maths, at both preview shapes (1:1 and 16:9), so their pixel validators are
// judged here too. Directly lit, shadowed and custom-shader scenes need a real
// GPU and are left to the browser.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { evaluate } from "../validate/run.js";
import type { ValidatorSpec } from "../validate/primitives.js";
import type { RGB, RGBA, Sample, SceneSnapshot, ShaderSnapshot } from "../validate/snapshot.js";
import { collectObjects } from "../../sandbox/scene-graph.js";
import { TRACKS, loadTrack } from "./index.js";
import type { Lesson } from "./types.js";

// Lessons load with their track on demand; load them all once to judge them.
const LESSONS: readonly Lesson[] = (await Promise.all(TRACKS.map((t) => loadTrack(t.id)))).flatMap(
  (t) => t.lessons,
);
const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

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
const WHITE3: RGB = [1, 1, 1];

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

/** The spiral lesson's rays, `wave` giving the cosine's argument from the
 *  angle and the radius. */
function spiral(x: number, y: number, wave: (a: number, r: number) => number): RGB {
  const [px, py] = centred(x, y);
  return grey(step(0, Math.cos(wave(Math.atan2(py, px), length(px, py)))));
}

/** The filter track's picture: a sky gradient, a sun and a hill. */
function picture(ux: number, uy: number): RGB {
  let col = mixRgb([0.15, 0.3, 0.7], [0.6, 0.85, 1], uy);
  col = mixRgb(col, [0.95, 0.9, 0.45], 1 - step(0.16, length(ux - 0.6875, uy - 0.6875)));
  return mixRgb(col, [0.1, 0.4, 0.15], 1 - step(0.3 + 0.1 * Math.sin(ux * 6), uy));
}

/** A filter lesson: `filter` applied to the picture at the pixel. */
const filtered = (x: number, y: number, filter: (c: RGB) => RGB): RGB => filter(picture(x, y));
const weighted = (c: RGB, w: RGB): RGB => grey(c[0] * w[0] + c[1] * w[1] + c[2] * w[2]);
/** The sepia matrix as rows (the GLSL writes the same numbers as columns). */
const SEPIA: readonly RGB[] = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];
const matrix = (m: readonly RGB[], c: RGB): RGB => rgb(m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]));
const transposed = (m: readonly RGB[]): RGB[] => [0, 1, 2].map((i) => rgb(m.map((row) => row[i])));
const levels = (c: RGB, n: number, round = Math.floor): RGB => rgb(c.map((v) => round(v * n) / n));
/** The mosaic lesson: the picture read at the coordinate `coarse` makes of the pixel's. */
const mosaic = (x: number, y: number, coarse: (v: number) => number): RGB => picture(coarse(x), coarse(y));
/** The scanline lesson: the picture darkened by `dim` (0..1) on the rows
 *  `dark` picks out of the pixel row gl_FragCoord.y = y * SIZE. */
const scanned = (x: number, y: number, dark: (row: number) => boolean, dim = 0.5): RGB =>
  rgb(picture(x, y).map((c) => c * (dark(y * SIZE) ? dim : 1)));

/** A convolution-track blur: the weighted average of the picture at the taps
 *  `offsets` gives (in units of `d`), each with its weight. */
function convolve(x: number, y: number, d: number, taps: ReadonlyArray<readonly [number, number, number]>, divisor?: number): RGB {
  const sum = [0, 0, 0];
  let total = 0;
  for (const [i, j, w] of taps) {
    const c = picture(x + i * d, y + j * d);
    sum[0] += c[0] * w;
    sum[1] += c[1] * w;
    sum[2] += c[2] * w;
    total += w;
  }
  const div = divisor ?? total;
  return rgb(sum.map((v) => v / div));
}

/** The (2n + 1)² square of tap offsets, all weighted 1, starting at `from`
 *  (the centred square starts at -n). */
const square = (n: number, from = -n): Array<[number, number, number]> => {
  const taps: Array<[number, number, number]> = [];
  for (let j = from; j <= from + 2 * n; j++) for (let i = from; i <= from + 2 * n; i++) taps.push([i, j, 1]);
  return taps;
};

/** The blur lesson's taps: 5×5 points 0.011 apart (also the sharpen lesson's blur). */
const BLUR_D = 0.011;
const blurred = (x: number, y: number): RGB => convolve(x, y, BLUR_D, square(2));

/** The sharpen lesson: the picture plus `k` times its difference from the blur. */
function sharpened(x: number, y: number, k: number): RGB {
  const c = picture(x, y);
  const b = blurred(x, y);
  return rgb(c.map((v, i) => v + (v - b[i]) * k));
}

/** The edge lesson: luminance differences 0.015 to either side, `combine`
 *  turning (gx, gy) into the edge strength, white where it reaches 0.05. */
const lumAt = (x: number, y: number): number => {
  const c = picture(x, y);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
};
function edges(x: number, y: number, combine: (gx: number, gy: number) => number, threshold = (e: number) => step(0.05, e)): RGB {
  const d = 0.015;
  const gx = lumAt(x + d, y) - lumAt(x - d, y);
  const gy = lumAt(x, y + d) - lumAt(x, y - d);
  return grey(threshold(combine(gx, gy)));
}

/** The lighting-model lessons: a sphere of radius 0.75 seen head-on, the light
 *  from the upper left and the viewer in front; `shade` colours a point of it
 *  from its normal and the Lambert term. */
const LIGHT: V3 = v3norm([-0.6, 0.6, 0.5]);
const VIEW: V3 = [0, 0, 1];
const HALF: V3 = v3norm(v3add(LIGHT, VIEW));
const ORANGE: RGB = [1, 0.55, 0.25];
function litSphere(x: number, y: number, shade: (n: V3, diff: number) => RGB): RGB {
  const [px, py] = centred(x, y);
  const d = length(px, py);
  if (d >= 0.75) return [0, 0, 0];
  const n = v3norm([px, py, Math.sqrt(0.75 * 0.75 - d * d)]);
  return shade(n, Math.max(v3dot(n, LIGHT), 0));
}
const matteOrange = (diff: number): RGB => rgb(ORANGE.map((c) => c * (0.1 + 0.9 * diff)));
/** The matte sphere plus a white specular term `spec(n)`. */
const specular = (x: number, y: number, spec: (n: V3) => number): RGB =>
  litSphere(x, y, (n, diff) => rgb(matteOrange(diff).map((c) => c + spec(n))));
const blinn = (n: V3, shininess: number): number => Math.pow(Math.max(v3dot(n, HALF), 0), shininess);
/** The matte sphere plus a blue (or `tint`) rim light of strength `rim(n)`. */
const rimLit = (x: number, y: number, rim: (n: V3) => number, tint: RGB = [0.3, 0.6, 1]): RGB =>
  litSphere(x, y, (n, diff) => rgb(matteOrange(diff).map((c, i) => c + tint[i] * rim(n))));
const rimOf = (n: V3): number => Math.pow(1 - Math.max(n[2], 0), 3);
/** The toon lesson: brightness `level(diff)` instead of the smooth Lambert term. */
const toon = (x: number, y: number, level: (diff: number) => number): RGB =>
  litSphere(x, y, (_n, diff) => rgb(ORANGE.map((c) => c * (0.15 + 0.85 * level(diff)))));

/** The fractal lessons: z ← step(z, c) until |z|² > 4, at most `steps` times;
 *  the number of steps that stayed inside, or null if it never escaped. */
type ComplexStep = (zx: number, zy: number, cx: number, cy: number) => [number, number];
const SQUARE_PLUS_C: ComplexStep = (zx, zy, cx, cy) => [zx * zx - zy * zy + cx, 2 * zx * zy + cy];
function escapeCount(cx: number, cy: number, zx: number, zy: number, next: ComplexStep = SQUARE_PLUS_C, steps = 64): number | null {
  for (let i = 0; i < steps; i++) {
    [zx, zy] = next(zx, zy, cx, cy);
    if (zx * zx + zy * zy > 4) return i;
  }
  return null;
}
/** The Mandelbrot lessons' c for a pixel: p * 1.5 + (-0.7, 0). */
function mandelbrotC(x: number, y: number): [number, number] {
  const [px, py] = centred(x, y);
  return [px * 1.5 - 0.7, py * 1.5];
}
/** The first lesson: never escaping (inside) black, escaping white. */
function mandelbrot(x: number, y: number, next: ComplexStep = SQUARE_PLUS_C, steps = 64, fromC = false): RGB {
  const [cx, cy] = mandelbrotC(x, y);
  return grey(escapeCount(cx, cy, fromC ? cx : 0, fromC ? cy : 0, next, steps) === null ? 0 : 1);
}
const mandelbrotSteps = (x: number, y: number): number | null => escapeCount(...mandelbrotC(x, y), 0, 0);
/** The Julia lesson: c fixed, z from the pixel (scaled by `scale`). */
const JULIA_C: readonly [number, number] = [-0.12, 0.75];
function juliaSteps(x: number, y: number, c: readonly [number, number] = JULIA_C, scale = 1.5): number | null {
  const [px, py] = centred(x, y);
  return escapeCount(c[0], c[1], px * scale, py * scale);
}
/** The glsl-color track's cosine palette. */
const cosinePalette = (t: number): RGB => rgb([0, 0.33, 0.67].map((d) => 0.5 + 0.5 * Math.cos(6.2831 * (t + d))));
/** Escape-time colour: inside (null) black, else palette(n / 64). */
const escapeColour = (n: number | null): RGB => (n === null ? [0, 0, 0] : cosinePalette(n / 64));
/** Counting before the escape test: one more, and 64 (black) for the last step. */
const countedFirst = (n: number | null): number | null => (n === null || n + 1 >= 64 ? null : n + 1);

/** The HSV lessons' hsv2rgb: each channel a trapezoid wave of the hue (the
 *  offsets `k`), mixed with white by the saturation and scaled by the value. */
function hsv2rgb(h: number, s: number, v: number, k: readonly number[] = [0, 4, 2], minus = 1, times = 6): RGB {
  return rgb(k.map((o) => v * mix(1, clamp(Math.abs(glslMod(h * times + o, 6) - 3) - minus, 0, 1), s)));
}
/** The lessons' rgb2hsv (the largest channel picks the hue's sector). */
function rgb2hsv([r, g, b]: RGB): [number, number, number] {
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d > 0) h = mx === r ? glslMod((g - b) / d, 6) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, mx > 0 ? d / mx : 0, mx];
}
/** The colour wheel: `hue` from the centred point, saturation `sat(r)`,
 *  black outside radius 1 unless `masked` is false. */
function colourWheel(x: number, y: number, hue = (px: number, py: number) => Math.atan2(py, px) / 6.2832, sat = (r: number) => r, masked = true): RGB {
  const [px, py] = centred(x, y);
  const r = length(px, py);
  return rgb(hsv2rgb(hue(px, py), sat(r), 1).map((c) => (masked ? c * step(r, 1) : c)));
}
/** The picture with its HSV changed by `change`, converted back. */
const hueShifted = (x: number, y: number, change: (hsv: [number, number, number]) => [number, number, number]): RGB => {
  const [h, s, v] = change(rgb2hsv(picture(x, y)));
  return hsv2rgb(h, s, v);
};

/** The distortion lessons' picture: an 8×8 checkerboard of two colours. */
const CHECKER_DARK: RGB = [0.1, 0.15, 0.35];
const CHECKER_LIGHT: RGB = [0.95, 0.85, 0.55];
const checker = (u: number, v: number): RGB => (glslMod(Math.floor(u * 8) + Math.floor(v * 8), 2) ? CHECKER_LIGHT : CHECKER_DARK);
/** The checkerboard read where `warp` moves the pixel's coordinate. */
const warped = (x: number, y: number, warp: (u: number, v: number) => [number, number]): RGB => checker(...warp(x, y));
/** The ripple: pushed along the direction from the middle by `amount(d)` of it. */
const ripple = (x: number, y: number, amount = (d: number) => 0.15 * Math.sin(d * 40), along = (dx: number, dy: number): [number, number] => [dx, dy]): RGB => {
  const [ax, ay] = along(x - 0.5, y - 0.5);
  const k = amount(length(x - 0.5, y - 0.5));
  return checker(x + ax * k, y + ay * k);
};
/** The lens: read at 0.5 + p * scale(p), or from the corner when `fromCorner`. */
const lens = (x: number, y: number, scale = (px: number, py: number) => 1 + 1.5 * (px * px + py * py), fromCorner = false): RGB => {
  const [px, py] = [x - 0.5, y - 0.5];
  const k = scale(px, py);
  return fromCorner ? checker(x * k, y * k) : checker(0.5 + px * k, 0.5 + py * k);
};

/** The graph lessons: plot()'s line density for a graph at height `fy`
 *  (`line` from the distance, by default a line 0.04 thick). */
const GRAPH_BG: RGB = [0.05, 0.07, 0.15];
const GRAPH_LINE: RGB = [0.3, 1, 0.5];
const lineAt = (d: number): number => 1 - smoothstep(0, 0.04, d);
/** The y = x lesson: the line over the dark background, its density from
 *  the signed distance st.y - x. */
const diagonal = (x: number, y: number, density = (signed: number) => lineAt(Math.abs(signed))): RGB => mixRgb(GRAPH_BG, GRAPH_LINE, density(y - x));
/** The curve lessons: brightness f(x), the graph of f drawn over it. */
const graphOf = (x: number, y: number, f: (x: number) => number): RGB => {
  const fy = f(x);
  return mixRgb(grey(clamp(fy, 0, 1)), GRAPH_LINE, lineAt(Math.abs(y - fy)));
};

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
  "glsl-spiral": {
    starter: (x, y) => spiral(x, y, (a) => a * 3),
    solution: (x, y) => spiral(x, y, (a, r) => a * 3 + r * 8),
  },
  "glsl-grayscale": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => filtered(x, y, (c) => weighted(c, [0.2126, 0.7152, 0.0722])),
  },
  "glsl-sepia": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => filtered(x, y, (c) => matrix(SEPIA, c)),
  },
  "glsl-posterize": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => filtered(x, y, (c) => levels(c, 4)),
  },
  "glsl-mosaic": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => mosaic(x, y, (v) => Math.floor(v * 8) / 8),
  },
  "glsl-scanlines": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => scanned(x, y, (row) => glslMod(row, 4) < 2),
  },
  // 2026-10, sixth batch.
  "glsl-blur": {
    starter: (x, y) => picture(x, y),
    solution: blurred,
  },
  "glsl-sharpen": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => sharpened(x, y, 1.5),
  },
  "glsl-edge": {
    starter: (x, y) => edges(x, y, (gx) => Math.abs(gx)),
    solution: (x, y) => edges(x, y, Math.hypot),
  },
  // 2026-10, seventh batch.
  "glsl-specular": {
    starter: (x, y) => specular(x, y, () => 0),
    solution: (x, y) => specular(x, y, (n) => blinn(n, 32)),
  },
  "glsl-rim": {
    starter: (x, y) => rimLit(x, y, () => 0),
    solution: (x, y) => rimLit(x, y, rimOf),
  },
  "glsl-toon": {
    starter: (x, y) => toon(x, y, (d) => d),
    solution: (x, y) => toon(x, y, (d) => Math.floor(d * 3) / 3),
  },
  // 2026-10, eighth batch.
  "glsl-mandelbrot": {
    starter: () => grey(0),
    solution: (x, y) => mandelbrot(x, y),
  },
  "glsl-escape-time": {
    starter: () => grey(0),
    solution: (x, y) => escapeColour(mandelbrotSteps(x, y)),
  },
  "glsl-julia": {
    starter: (x, y) => escapeColour(mandelbrotSteps(x, y)),
    solution: (x, y) => escapeColour(juliaSteps(x, y)),
  },
  // 2026-10, ninth batch.
  "glsl-hsv-rainbow": {
    starter: () => grey(1),
    solution: (x) => hsv2rgb(x, 1, 1),
  },
  "glsl-color-wheel": {
    starter: () => grey(0),
    solution: (x, y) => colourWheel(x, y),
  },
  "glsl-hue-shift": {
    starter: (x, y) => picture(x, y),
    solution: (x, y) => hueShifted(x, y, ([h, s, v]) => [fract(h + 0.5), s, v]),
  },
  // 2026-10, tenth batch.
  "glsl-wave-distort": {
    starter: (x, y) => checker(x, y),
    solution: (x, y) => warped(x, y, (u, v) => [u + 0.04 * Math.sin(v * 25), v]),
  },
  "glsl-ripple": {
    starter: (x, y) => checker(x, y),
    solution: (x, y) => ripple(x, y),
  },
  "glsl-lens": {
    starter: (x, y) => checker(x, y),
    solution: (x, y) => lens(x, y),
  },
  // 2026-10, eleventh batch.
  "glsl-plot-line": {
    starter: () => GRAPH_BG,
    solution: (x, y) => diagonal(x, y),
  },
  "glsl-plot-pow": {
    starter: (x, y) => graphOf(x, y, (v) => v),
    solution: (x, y) => graphOf(x, y, (v) => Math.pow(v, 5)),
  },
  "glsl-plot-smoothstep": {
    starter: (x, y) => graphOf(x, y, (v) => v),
    solution: (x, y) => graphOf(x, y, (v) => smoothstep(0.2, 0.8, v)),
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

/** Plausible wrong answers to the 2026-10 (third to sixth batch) shader
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
  // 2026-10, fifth batch.
  "glsl-spiral": [
    ["too little twist (r * 2)", (x, y) => spiral(x, y, (a, r) => a * 3 + r * 2)],
    ["too much twist (r * 16)", (x, y) => spiral(x, y, (a, r) => a * 3 + r * 16)],
    ["the angle multiplied by the radius", (x, y) => spiral(x, y, (a, r) => a * 3 * r * 8)],
    ["rings (the radius alone)", (x, y) => spiral(x, y, (_a, r) => r * 8)],
    ["all white", () => WHITE3],
  ],
  "glsl-grayscale": [
    ["the plain average (r + g + b) / 3", (x, y) => filtered(x, y, (c) => weighted(c, [1 / 3, 1 / 3, 1 / 3]))],
    ["the green channel alone", (x, y) => filtered(x, y, (c) => weighted(c, [0, 1, 0]))],
    ["the red channel alone", (x, y) => filtered(x, y, (c) => weighted(c, [1, 0, 0]))],
    ["weights that add up to more than 1 (0.3, 0.8, 0.1)", (x, y) => filtered(x, y, (c) => weighted(c, [0.3, 0.8, 0.1]))],
  ],
  "glsl-sepia": [
    ["the matrix written row by row (transposed)", (x, y) => filtered(x, y, (c) => matrix(transposed(SEPIA), c))],
    ["grey tinted brown", (x, y) => filtered(x, y, (c) => rgb(weighted(c, [0.2126, 0.7152, 0.0722]).map((v, i) => v * [1, 0.85, 0.6][i])))],
    ["grey", (x, y) => filtered(x, y, (c) => weighted(c, [0.2126, 0.7152, 0.0722]))],
  ],
  "glsl-posterize": [
    ["8 levels", (x, y) => filtered(x, y, (c) => levels(c, 8))],
    ["2 levels", (x, y) => filtered(x, y, (c) => levels(c, 2))],
    ["round instead of floor", (x, y) => filtered(x, y, (c) => levels(c, 4, Math.round))],
    ["ceil instead of floor", (x, y) => filtered(x, y, (c) => levels(c, 4, Math.ceil))],
    ["levels on the luminance only", (x, y) => filtered(x, y, (c) => levels(weighted(c, [0.2126, 0.7152, 0.0722]), 4))],
  ],
  "glsl-mosaic": [
    ["6 cells (the cells straddle the 1/8 grid)", (x, y) => mosaic(x, y, (v) => Math.floor(v * 6) / 6)],
    ["round (half a cell off)", (x, y) => mosaic(x, y, (v) => Math.round(v * 8) / 8)],
    ["fract instead of floor", (x, y) => mosaic(x, y, (v) => fract(v * 8))],
    ["floor without dividing back", (x, y) => mosaic(x, y, (v) => Math.floor(v * 8))],
    ["coarse along x only", (x, y) => picture(Math.floor(x * 8) / 8, y)],
  ],
  "glsl-scanlines": [
    ["a 2 px period (odd rows dark)", (x, y) => scanned(x, y, (row) => glslMod(row, 2) >= 1)],
    ["a 2 px period (even rows dark)", (x, y) => scanned(x, y, (row) => glslMod(row, 2) < 1)],
    ["an 8 px period", (x, y) => scanned(x, y, (row) => glslMod(row, 8) < 4)],
    ["everything darkened", (x, y) => scanned(x, y, () => true)],
    ["vertical lines", (x, y) => rgb(picture(x, y).map((c) => c * (glslMod(x * SIZE, 4) < 2 ? 0.5 : 1)))],
    ["lines too dark (0.3)", (x, y) => scanned(x, y, (row) => glslMod(row, 4) < 2, 0.3)],
  ],
  // 2026-10, sixth batch.
  "glsl-blur": [
    ["divided by 9 instead of 25 (too bright)", (x, y) => convolve(x, y, BLUR_D, square(2), 9)],
    ["the sum, not divided", (x, y) => convolve(x, y, BLUR_D, square(2), 1)],
    ["sideways only (y kept at 0)", (x, y) => convolve(x, y, BLUR_D, square(2).filter(([, j]) => j === 0))],
    ["up and down only (x kept at 0)", (x, y) => convolve(x, y, BLUR_D, square(2).filter(([i]) => i === 0))],
    ["the loops from 0 to 4 (not centred)", (x, y) => convolve(x, y, BLUR_D, square(2, 0))],
    ["the offsets not multiplied by d", (x, y) => convolve(x, y, 1, square(2))],
  ],
  "glsl-sharpen": [
    ["the difference the other way round (blur(st) - col: blurrier)", (x, y) => sharpened(x, y, -1.5)],
    ["adding the blur itself", (x, y) => rgb(picture(x, y).map((v, i) => v + blurred(x, y)[i]))],
    ["the difference alone (col = detail * 1.5)", (x, y) => rgb(picture(x, y).map((v, i) => (v - blurred(x, y)[i]) * 1.5))],
    ["the blur alone", blurred],
  ],
  "glsl-edge": [
    ["the up-down difference only", (x, y) => edges(x, y, (_gx, gy) => Math.abs(gy))],
    ["the signed sum gx + gy", (x, y) => edges(x, y, (gx, gy) => gx + gy)],
    ["the signed max(gx, gy)", (x, y) => edges(x, y, Math.max)],
    [
      "gy from one side only (lum(st + d) - lum(st))",
      (x, y) => {
        const d = 0.015;
        const gx = lumAt(x + d, y) - lumAt(x - d, y);
        return grey(step(0.05, Math.hypot(gx, lumAt(x, y + d) - lumAt(x, y))));
      },
    ],
    ["the step turned round (black lines on white)", (x, y) => edges(x, y, Math.hypot, (e) => step(e, 0.05))],
    ["the strength without step (dim grey lines)", (x, y) => edges(x, y, Math.hypot, (e) => e)],
  ],
  // 2026-10, seventh batch.
  "glsl-specular": [
    ["dot(n, L)^32 (the highlight where n points at the light)", (x, y) => specular(x, y, (n) => Math.pow(Math.max(v3dot(n, LIGHT), 0), 32))],
    ["dot(n, V)^32 (the highlight in the middle)", (x, y) => specular(x, y, (n) => Math.pow(Math.max(n[2], 0), 32))],
    ["h = normalize(L - V)", (x, y) => specular(x, y, (n) => Math.pow(Math.max(v3dot(n, v3norm(v3add(LIGHT, v3scale(VIEW, -1)))), 0), 32))],
    [
      "an orange highlight (spec times the base colour)",
      (x, y) => litSphere(x, y, (n, diff) => rgb(matteOrange(diff).map((c, i) => c + ORANGE[i] * blinn(n, 32)))),
    ],
  ],
  "glsl-rim": [
    ["dot(n, V)^3 (the middle glows)", (x, y) => rimLit(x, y, (n) => Math.pow(Math.max(n[2], 0), 3))],
    ["1 - dot(n, L) (the light's direction instead of the eye's)", (x, y) => rimLit(x, y, (n) => Math.pow(1 - Math.max(v3dot(n, LIGHT), 0), 3))],
    ["without pow (1 - dot(n, V))", (x, y) => rimLit(x, y, (n) => 1 - Math.max(n[2], 0))],
    ["a white rim", (x, y) => rimLit(x, y, rimOf, [1, 1, 1])],
  ],
  "glsl-toon": [
    ["round instead of floor", (x, y) => toon(x, y, (d) => Math.round(d * 3) / 3)],
    ["ceil instead of floor", (x, y) => toon(x, y, (d) => Math.ceil(d * 3) / 3)],
    ["2 levels", (x, y) => toon(x, y, (d) => Math.floor(d * 2) / 2)],
    ["4 levels", (x, y) => toon(x, y, (d) => Math.floor(d * 4) / 4)],
    [
      "the colour rounded after lighting",
      (x, y) => litSphere(x, y, (_n, diff) => rgb(ORANGE.map((c) => Math.floor(c * (0.15 + 0.85 * diff) * 3) / 3))),
    ],
  ],
  // 2026-10, eighth batch.
  "glsl-mandelbrot": [
    ["z * z (component-wise, not the complex square)", (x, y) => mandelbrot(x, y, (zx, zy, cx, cy) => [zx * zx + cx, zy * zy + cy])],
    ["x² + y² instead of x² − y²", (x, y) => mandelbrot(x, y, (zx, zy, cx, cy) => [zx * zx + zy * zy + cx, 2 * zx * zy + cy])],
    ["the conjugate (−2xy, the tricorn)", (x, y) => mandelbrot(x, y, (zx, zy, cx, cy) => [zx * zx - zy * zy + cx, -2 * zx * zy + cy])],
    ["c never added", (x, y) => mandelbrot(x, y, (zx, zy) => [zx * zx - zy * zy, 2 * zx * zy])],
    ["8 steps instead of 64", (x, y) => mandelbrot(x, y, SQUARE_PLUS_C, 8)],
  ],
  "glsl-escape-time": [
    ["n never counted (every pixel as n = 0)", () => cosinePalette(0)],
    ["the inside coloured too", (x, y) => cosinePalette((mandelbrotSteps(x, y) ?? 64) / 64)],
    [
      "palette(n) without dividing by 64",
      (x, y) => {
        const n = mandelbrotSteps(x, y);
        return n === null ? [0, 0, 0] : cosinePalette(n);
      },
    ],
  ],
  "glsl-julia": [
    ["c conjugated (−0.12, −0.75): the rabbit upside down", (x, y) => escapeColour(juliaSteps(x, y, [-0.12, -0.75]))],
    ["z from 0 with c fixed", () => escapeColour(escapeCount(JULIA_C[0], JULIA_C[1], 0, 0))],
    ["z = p (without * 1.5)", (x, y) => escapeColour(juliaSteps(x, y, JULIA_C, 1))],
  ],
  // 2026-10, ninth batch.
  "glsl-hsv-rainbow": [
    ["the offsets (0, 2, 4): the hues the other way round", (x) => hsv2rgb(x, 1, 1, [0, 2, 4])],
    ["without - 1.0 (pale)", (x) => hsv2rgb(x, 1, 1, [0, 4, 2], 0)],
    ["the hue not times 6", (x) => hsv2rgb(x, 1, 1, [0, 4, 2], 1, 1)],
  ],
  "glsl-color-wheel": [
    ["atan(p.x, p.y): from the top, the other way round", (x, y) => colourWheel(x, y, (px, py) => Math.atan2(px, py) / 6.2832)],
    ["the angle in radians (not / 6.2832)", (x, y) => colourWheel(x, y, (px, py) => Math.atan2(py, px))],
    ["saturation 1 - r (a white rim)", (x, y) => colourWheel(x, y, undefined, (r) => 1 - r)],
    ["+ 0.5 (red on the left)", (x, y) => colourWheel(x, y, (px, py) => Math.atan2(py, px) / 6.2832 + 0.5)],
    ["no black outside the circle", (x, y) => colourWheel(x, y, undefined, undefined, false)],
  ],
  "glsl-hue-shift": [
    ["1.0 - col (the negative)", (x, y) => rgb(picture(x, y).map((c) => 1 - c))],
    ["a quarter turn (+ 0.25)", (x, y) => hueShifted(x, y, ([h, s, v]) => [fract(h + 0.25), s, v])],
    ["the saturation shifted instead", (x, y) => hueShifted(x, y, ([h, s, v]) => [h, fract(s + 0.5), v])],
    [
      "the HSV shown without converting back",
      (x, y) => {
        const [h, s, v] = rgb2hsv(picture(x, y));
        return [fract(h + 0.5), s, v];
      },
    ],
  ],
  // 2026-10, tenth batch.
  "glsl-wave-distort": [
    ["the wave on y (the rows wave instead)", (x, y) => warped(x, y, (u, v) => [u, v + 0.04 * Math.sin(u * 25)])],
    ["sin of x (the columns squeezed, not waved)", (x, y) => warped(x, y, (u, v) => [u + 0.04 * Math.sin(u * 25), v])],
    ["an amplitude of 0.004", (x, y) => warped(x, y, (u, v) => [u + 0.004 * Math.sin(v * 25), v])],
    ["the wave the other way (- 0.04)", (x, y) => warped(x, y, (u, v) => [u - 0.04 * Math.sin(v * 25), v])],
  ],
  "glsl-ripple": [
    ["only x pushed (dir.x)", (x, y) => ripple(x, y, undefined, (dx) => [dx, 0])],
    ["rings of frequency 4 (not 40)", (x, y) => ripple(x, y, (d) => 0.15 * Math.sin(d * 4))],
    ["pushed along a fixed (0.3, 0.3)", (x, y) => ripple(x, y, undefined, () => [0.3, 0.3])],
  ],
  "glsl-lens": [
    ["1.0 - 1.5 * dot(p, p) (the pincushion)", (x, y) => lens(x, y, (px, py) => 1 - 1.5 * (px * px + py * py))],
    ["length(p) instead of dot(p, p)", (x, y) => lens(x, y, (px, py) => 1 + 1.5 * length(px, py))],
    ["scaled from the corner (0.5 not added back)", (x, y) => lens(x, y, undefined, true)],
  ],
  // 2026-10, eleventh batch.
  "glsl-plot-line": [
    ["without abs (everything below the line green)", (x, y) => diagonal(x, y, (signed) => lineAt(signed))],
    ["the smoothstep edges turned round (all but the line)", (x, y) => diagonal(x, y, (signed) => 1 - lineAt(Math.abs(signed)))],
    ["a line 0.1 thick", (x, y) => diagonal(x, y, (signed) => 1 - smoothstep(0, 0.1, Math.abs(signed)))],
    ["plot(st, st.y): every pixel on the graph", () => GRAPH_LINE],
  ],
  "glsl-plot-pow": [
    ["pow(st.x, 2.0)", (x, y) => graphOf(x, y, (v) => v * v)],
    ["pow(5.0, st.x): the arguments the other way round", (x, y) => graphOf(x, y, (v) => Math.pow(5, v))],
    ["pow(st.x, 0.2)", (x, y) => graphOf(x, y, (v) => Math.pow(v, 0.2))],
    ["5.0 * st.x", (x, y) => graphOf(x, y, (v) => 5 * v)],
  ],
  "glsl-plot-smoothstep": [
    ["a straight ramp clamp((x - 0.2) / 0.6, 0.0, 1.0)", (x, y) => graphOf(x, y, (v) => clamp((v - 0.2) / 0.6, 0, 1))],
    ["step(0.5, st.x)", (x, y) => graphOf(x, y, (v) => step(0.5, v))],
    ["smoothstep(0.8, 0.2, st.x): falling", (x, y) => graphOf(x, y, (v) => smoothstep(0.8, 0.2, v))],
    ["smoothstep(0.0, 1.0, st.x)", (x, y) => graphOf(x, y, (v) => smoothstep(0, 1, v))],
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

/** Other correct ways to write the fifth- and sixth-batch shader lessons; each
 *  must pass (lenient input, SHIG 50). */
const SHADER_VARIANTS: Record<string, ReadonlyArray<readonly [string, Shade]>> = {
  "glsl-spiral": [["the mirror image (a * 3.0 - r * 8.0)", (x, y) => spiral(x, y, (a, r) => a * 3 - r * 8)]],
  "glsl-grayscale": [["the Rec.601 weights (0.299, 0.587, 0.114)", (x, y) => filtered(x, y, (c) => weighted(c, [0.299, 0.587, 0.114]))]],
  "glsl-posterize": [["floor(col * 4.0) * 0.25", (x, y) => filtered(x, y, (c) => rgb(c.map((v) => Math.floor(v * 4) * 0.25)))]],
  "glsl-mosaic": [["the cell centres, (floor + 0.5) / 8", (x, y) => mosaic(x, y, (v) => (Math.floor(v * 8) + 0.5) / 8)]],
  "glsl-scanlines": [
    ["the opposite phase (the upper two rows dark)", (x, y) => scanned(x, y, (row) => glslMod(row, 4) >= 2)],
    ["fract(st.y * 32.0) < 0.5", (x, y) => scanned(x, y, (row) => fract((row + 0.5) / 4) < 0.5)],
    ["lines at 0.4", (x, y) => scanned(x, y, (row) => glslMod(row, 4) < 2, 0.4)],
    ["lines at 0.6", (x, y) => scanned(x, y, (row) => glslMod(row, 4) < 2, 0.6)],
  ],
  // 2026-10, sixth batch.
  "glsl-blur": [
    ["a 3×3 kernel twice as far apart (the same reach)", (x, y) => convolve(x, y, BLUR_D * 2, square(1))],
    ["a 7×7 kernel over the same reach", (x, y) => convolve(x, y, (BLUR_D * 2) / 3, square(3))],
    [
      "binomial weights (1, 4, 6, 4, 1) instead of equal ones",
      (x, y) => {
        const w = [1, 4, 6, 4, 1];
        return convolve(x, y, BLUR_D, square(2).map(([i, j]) => [i, j, w[i + 2] * w[j + 2]] as [number, number, number]));
      },
    ],
  ],
  "glsl-sharpen": [
    ["an amount of 1.25", (x, y) => sharpened(x, y, 1.25)],
    ["an amount of 1.75", (x, y) => sharpened(x, y, 1.75)],
  ],
  "glsl-edge": [
    ["abs(gx) + abs(gy)", (x, y) => edges(x, y, (gx, gy) => Math.abs(gx) + Math.abs(gy))],
    ["max(abs(gx), abs(gy))", (x, y) => edges(x, y, (gx, gy) => Math.max(Math.abs(gx), Math.abs(gy)))],
  ],
  // 2026-10, seventh batch.
  "glsl-specular": [
    ["shininess 16", (x, y) => specular(x, y, (n) => blinn(n, 16))],
    ["shininess 64", (x, y) => specular(x, y, (n) => blinn(n, 64))],
    [
      "Phong: reflect(-L, n) · V, shininess 32",
      (x, y) =>
        specular(x, y, (n) => {
          const r = v3add(v3scale(n, 2 * v3dot(n, LIGHT)), v3scale(LIGHT, -1));
          return Math.pow(Math.max(v3dot(r, VIEW), 0), 32);
        }),
    ],
  ],
  "glsl-rim": [["(1 - dot(n, V)) multiplied three times", (x, y) => rimLit(x, y, (n) => (1 - Math.max(n[2], 0)) ** 3)]],
  "glsl-toon": [["step thresholds at 1/3 and 2/3", (x, y) => toon(x, y, (d) => step(1 / 3, d) / 3 + step(2 / 3, d) / 3 + step(1, d) / 3)]],
  // 2026-10, eighth batch.
  "glsl-mandelbrot": [
    ["length(z) > 2.0", (x, y) => mandelbrot(x, y)],
    ["128 steps", (x, y) => mandelbrot(x, y, SQUARE_PLUS_C, 128)],
    ["z starting at c", (x, y) => mandelbrot(x, y, SQUARE_PLUS_C, 64, true)],
  ],
  "glsl-escape-time": [
    ["n counted before the escape test", (x, y) => escapeColour(countedFirst(mandelbrotSteps(x, y)))],
    ["n = float(i) at the break", (x, y) => escapeColour(mandelbrotSteps(x, y))],
  ],
  "glsl-julia": [
    ["n counted before the escape test", (x, y) => escapeColour(countedFirst(juliaSteps(x, y)))],
    ["c declared const", (x, y) => escapeColour(juliaSteps(x, y))],
  ],
  // 2026-10, ninth batch.
  "glsl-hsv-rainbow": [["the fract form: abs(fract(h + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0)", (x) => hsv2rgb(x, 1, 1)]],
  "glsl-color-wheel": [["fract(atan(p.y, p.x) / 6.2832)", (x, y) => colourWheel(x, y, (px, py) => fract(Math.atan2(py, px) / 6.2832))]],
  "glsl-hue-shift": [
    ["+ 0.5 without fract", (x, y) => hueShifted(x, y, ([h, s, v]) => [h + 0.5, s, v])],
    ["- 0.5", (x, y) => hueShifted(x, y, ([h, s, v]) => [h - 0.5, s, v])],
    [
      "max + min - col (the same in RGB)",
      (x, y) => {
        const c = picture(x, y);
        const sum = Math.max(...c) + Math.min(...c);
        return rgb(c.map((v) => sum - v));
      },
    ],
  ],
  // 2026-10, tenth batch.
  "glsl-wave-distort": [["uv = vec2(uv.x + 0.04 * sin(uv.y * 25.0), uv.y)", (x, y) => warped(x, y, (u, v) => [u + 0.04 * Math.sin(v * 25), v])]],
  "glsl-ripple": [["uv = 0.5 + dir * (1.0 + 0.15 * sin(length(dir) * 40.0))", (x, y) => ripple(x, y)]],
  "glsl-lens": [["uv = 0.5 + p + p * 1.5 * dot(p, p)", (x, y) => lens(x, y)]],
  // 2026-10, eleventh batch.
  "glsl-plot-line": [
    ["step(abs(st.y - y), 0.04): a hard edge", (x, y) => diagonal(x, y, (signed) => step(Math.abs(signed), 0.04))],
    ["smoothstep(0.04, 0.0, abs(st.y - y))", (x, y) => diagonal(x, y)],
  ],
  "glsl-plot-pow": [["st.x * st.x * st.x * st.x * st.x", (x, y) => graphOf(x, y, (v) => v * v * v * v * v)]],
  "glsl-plot-smoothstep": [
    [
      "t * t * (3.0 - 2.0 * t) written out",
      (x, y) =>
        graphOf(x, y, (v) => {
          const t = clamp((v - 0.2) / 0.6, 0, 1);
          return t * t * (3 - 2 * t);
        }),
    ],
  ],
};

describe("shader variants are accepted", () => {
  for (const [id, variants] of Object.entries(SHADER_VARIANTS)) {
    for (const [label, shade] of variants) {
      it(`${id}: ${label}`, () => {
        const { validators, solution } = lessonById(id)!.challenge;
        expect(evaluate(validators, shaderSnapshot(solution, shade)).failures).toEqual([]);
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
  /** What the frame is cleared to when the scene has no Color background. */
  clearColor: THREE.Color;
  setClearColor(color: THREE.ColorRepresentation): void;
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
    clearColor: new THREE.Color(0x05060d),
    setClearColor(color) {
      this.clearColor.set(color);
    },
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

/** Can the flat model shade `m` without a real GPU? Basic colours (plain or
 *  textured), normal colours, sprites, and standard materials in a scene with
 *  no directional light, which then show their emission plus the ambient and
 *  hemisphere light that falls on their normal. */
function flatShadable(m: THREE.Material, directLit: boolean): boolean {
  if (m instanceof THREE.MeshBasicMaterial) return !m.wireframe && (m.map === null || sampleable(m.map));
  if (m instanceof THREE.MeshNormalMaterial) return !m.wireframe && !m.flatShading && !m.normalMap && !m.bumpMap;
  if (m instanceof THREE.MeshStandardMaterial) return !directLit && !m.map && !m.emissiveMap && !m.wireframe;
  if (m instanceof THREE.PointsMaterial) return !m.map && !m.vertexColors && m.sizeAttenuation;
  if (m instanceof THREE.SpriteMaterial) return !m.map && m.sizeAttenuation;
  return false;
}

/** Lights the model can apply: those that depend on the normal alone. */
const soft = (l: THREE.Object3D): boolean => l instanceof THREE.AmbientLight || l instanceof THREE.HemisphereLight;

/** The irradiance at a world normal `n` from the scene's ambient and
 *  hemisphere lights, as three's shaders sum it: each light's colour times
 *  its intensity, a hemisphere light blending ground to sky by
 *  0.5 + 0.5 · (n · direction), the direction being its position. */
function softIrradiance(lights: readonly THREE.Light[], n: THREE.Vector3): THREE.Color {
  const e = new THREE.Color(0, 0, 0);
  for (const l of lights) {
    if (l instanceof THREE.HemisphereLight) {
      const dir = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).normalize();
      e.add(l.groundColor.clone().lerp(l.color, 0.5 + 0.5 * n.dot(dir)).multiplyScalar(l.intensity));
    } else {
      e.add(l.color.clone().multiplyScalar(l.intensity));
    }
  }
  return e;
}

/** A texel index wrapped the way the GPU wraps the coordinate. */
function wrapIndex(i: number, n: number, mode: THREE.Wrapping): number {
  if (mode === THREE.RepeatWrapping) return ((i % n) + n) % n;
  if (mode === THREE.MirroredRepeatWrapping) {
    const k = ((i % (2 * n)) + 2 * n) % (2 * n);
    return k < n ? k : 2 * n - 1 - k; // every other copy runs backwards
  }
  return Math.min(n - 1, Math.max(0, i)); // ClampToEdge
}

/** The texture under `uv` as a linear colour and its alpha. The lessons'
 *  textures are always magnified, so the magnification filter decides:
 *  the nearest texel, or (LinearFilter) the four nearest blended by
 *  distance, after an sRGB texture's texels are decoded, as the GPU does. */
function texel(map: THREE.Texture, uv: THREE.Vector2): RGBA {
  // repeat / offset / rotation, as the renderer's uvTransform applies them.
  map.updateMatrix();
  const at = uv.clone().applyMatrix3(map.matrix);
  const { data, width, height } =
    map.image instanceof FakeCanvas
      ? { data: map.image.pixels, width: map.image.width, height: map.image.height }
      : (map.image as { data: Uint8Array; width: number; height: number });
  const read = (cx: number, cy: number): RGBA => {
    const column = wrapIndex(cx, width, map.wrapS);
    const fromBottom = wrapIndex(cy, height, map.wrapT);
    // A DataTexture's first row is the bottom (flipY = false); a canvas's
    // first row is its top, flipped up to v = 1 on upload (flipY = true).
    const row = map.flipY ? height - 1 - fromBottom : fromBottom;
    const i = (row * width + column) * 4;
    const raw = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    // A NoColorSpace texel is used as linear; an sRGB one is decoded first.
    const [r, g, b] = map.colorSpace === THREE.SRGBColorSpace ? raw.map(srgbToLinear) : raw;
    return [r, g, b, data[i + 3] / 255];
  };
  if (map.magFilter !== THREE.LinearFilter) return read(Math.floor(at.x * width), Math.floor(at.y * height));
  const tx = at.x * width - 0.5;
  const ty = at.y * height - 0.5;
  const x0 = Math.floor(tx);
  const y0 = Math.floor(ty);
  const [c00, c10, c01, c11] = [read(x0, y0), read(x0 + 1, y0), read(x0, y0 + 1), read(x0 + 1, y0 + 1)];
  const blend = (k: number): number => mix(mix(c00[k], c10[k], tx - x0), mix(c01[k], c11[k], tx - x0), ty - y0);
  return [blend(0), blend(1), blend(2), blend(3)];
}

/** How opaque a material draws where `hit` lands: its opacity when
 *  transparent (times the texture's alpha), else fully; null when alphaTest
 *  discards the fragment there, so the ray goes on to what lies behind. */
function coverage(m: THREE.Material, hit: THREE.Intersection): number | null {
  const { map } = m as THREE.MeshBasicMaterial;
  const a = map && map.version > 0 && hit.uv ? texel(map, hit.uv)[3] : 1;
  if (m.alphaTest > 0 && a < m.alphaTest) return null;
  return m.transparent ? m.opacity * a : 1;
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

/** The linear vertex colour a material with `vertexColors` gets where `hit`
 *  lands: the hit triangle's three colours blended by its barycentric
 *  coordinates, multiplying the material colour; white otherwise. */
function vertexTint(m: THREE.Material, hit: THREE.Intersection | undefined): RGB {
  if (!m.vertexColors || !hit?.face || !hit.barycoord) return [1, 1, 1];
  const colors = (hit.object as THREE.Mesh).geometry.getAttribute("color") as THREE.BufferAttribute;
  const { a, b, c } = hit.face;
  const v = THREE.Triangle.getInterpolatedAttribute(colors, a, b, c, hit.barycoord, new THREE.Vector3());
  return [v.x, v.y, v.z];
}

/** Without a `color` attribute, vertexColors reads whatever the GPU's default
 *  attribute value for that slot happens to be, so the model will not guess. */
const vertexColoursKnown = (o: THREE.Object3D, m: THREE.Material): boolean =>
  !m.vertexColors || (o instanceof THREE.Mesh && o.geometry.getAttribute("color") !== undefined);

/** The colour (as written to the canvas) of a flat-shadable surface where
 *  `hit` lands (undefined for a point of a Points object), under the scene's
 *  ambient and hemisphere `lights`. */
function flatColor(m: THREE.Material, hit: THREE.Intersection | undefined, lights: readonly THREE.Light[] = []): RGB {
  if (m instanceof THREE.MeshStandardMaterial) {
    const e = m.emissive;
    const k = m.emissiveIntensity;
    const out = [e.r * k, e.g * k, e.b * k];
    if (lights.length > 0 && hit) {
      // Lambert: the diffuse colour (less its metalness) over π, times the irradiance.
      const n = (hit.normal as THREE.Vector3).clone().transformDirection(hit.object.matrixWorld);
      const irradiance = softIrradiance(lights, n);
      const diffuse = (1 - m.metalness) / Math.PI;
      out[0] += m.color.r * diffuse * irradiance.r;
      out[1] += m.color.g * diffuse * irradiance.g;
      out[2] += m.color.b * diffuse * irradiance.b;
    }
    return encode(out[0], out[1], out[2]);
  }
  const { color, map } = m as THREE.MeshBasicMaterial;
  const [ir, ig, ib] = instanceTint(hit);
  const [vr, vg, vb] = vertexTint(m, hit);
  const [tr, tg, tb] = [ir * vr, ig * vg, ib * vb];
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

/** The read-back grid of an unlit (or softly lit) scene, found by ray casting
 *  the pixels the runner samples (preview `aspect`, 360 px tall), or null when
 *  the scene holds anything this model cannot shade (directional lights on lit
 *  materials, shader materials, lines, a textured background…). */
function flatRender({ scene, camera, renderer }: SceneRun, aspect: number): Sample[] | null {
  const background = scene.background;
  if (background instanceof THREE.Texture) return null;
  // A Color background is the clear colour, as written (sRGB); anything else
  // (a colour name left as a string) three ignores, and the renderer's own
  // clear colour shows.
  const clear = srgbOf(background instanceof THREE.Color ? background : renderer.clearColor);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const lights = (scene.getObjectsByProperty("isLight", true) as THREE.Light[]).filter(drawn);
  const directLit = lights.some((l) => !soft(l));
  const softLights = lights.filter(soft);
  const points: THREE.Points[] = [];
  let shadable = true;
  scene.traverse((o) => {
    // Groups, lights and plain Object3Ds (empty markers) draw nothing themselves.
    if (o === scene || o instanceof THREE.Group || o instanceof THREE.Light || o.constructor === THREE.Object3D) return;
    const material = (o as THREE.Mesh).material;
    if ((o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) && !Array.isArray(material)) {
      shadable &&= flatShadable(material, directLit) && vertexColoursKnown(o, material);
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
        // WebGL draws whole triangles only: a vertex (or index) left over at
        // the end of the buffer is ignored, but the Raycaster builds a
        // triangle from it and the missing entries after it, and reports a
        // hit at NaN distance.
        if (Number.isNaN(hit.distance)) continue;
        const m = (hit.object as THREE.Mesh).material as THREE.Material;
        // A clipped fragment is discarded, so the ray goes on to what is behind.
        if (clipped(renderer, m, hit.point)) continue;
        // A ray through a shared edge hits both triangles; the GPU fills the
        // pixel once, so count the nearest hit per object (and instance).
        const key = `${hit.object.uuid}:${hit.instanceId ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // A fragment alphaTest discards lets the ray go on, like a clipped one.
        const alpha = coverage(m, hit);
        if (alpha === null) continue;
        const colour = m instanceof THREE.MeshNormalMaterial ? normalColor(hit, camera) : flatColor(m, hit, softLights);
        layers.push([hit.distance, fogged(scene, camera, m, hit.point, colour), alpha]);
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

/** Wrong answers to the polyline lesson, judged on the scene graph alone (a
 *  line is never pixel-judged); each must fail, and a LineLoop must pass. */
describe("the polyline lesson is judged on its geometry", () => {
  const { validators, solution } = lessonById("three-line")!.challenge;
  const judged = validators.filter((v) => !readsPixels(v));
  const cases: ReadonlyArray<readonly [string, string, boolean]> = [
    ["only the first two points", solution.replace("setFromPoints(points),  // 点を順につなぐ", "setFromPoints(points.slice(0, 2)),"), false],
    ["LineSegments (every other gap missing)", solution.replace("new THREE.Line(", "new THREE.LineSegments("), false],
    ["a MeshBasicMaterial on the line", solution.replace("new THREE.LineBasicMaterial({ color: 'cyan' })", "new THREE.MeshBasicMaterial({ color: 'cyan' }) // LineBasicMaterial"), false],
    ["the dots alone (the starter)", solution.replace(/const line[\s\S]*$/, "// LineBasicMaterial\n"), false],
    ["a LineLoop through every point", solution.replace("new THREE.Line(", "new THREE.LineLoop("), true],
  ];
  for (const [label, code, passes] of cases) {
    it(`${label}: ${passes ? "accepted" : "rejected"}`, () => {
      expect(code).not.toBe(solution);
      const snap = runScene(code);
      expect(snap.error).toBeNull();
      expect(evaluate(judged, snap).passed).toBe(passes);
    });
  }
});

/** The lessons whose scenes are unlit or softly lit, so the flat model can draw them. */
const FLAT_LESSONS = [
  "three-first-mesh",
  "three-color",
  "three-position",
  "three-background",
  "three-sphere",
  "three-torus",
  "three-plane",
  "three-normal-material",
  "three-transparent",
  "three-clipping",
  "three-ambient",
  "three-hemisphere-light",
  "three-emissive",
  "three-scale",
  "three-group",
  "three-hierarchy",
  "three-look-at",
  "three-instanced",
  "three-instance-color",
  "three-lerp",
  "three-quaternion",
  "three-spherical",
  "three-world-position",
  "three-attach",
  "three-matrix-order",
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
  "three-triangles",
  "three-index",
  "three-vertex-colors",
  "three-uv",
  "three-texture-atlas",
  "three-texture-rotation",
  "three-nearest-filter",
  "three-mirrored-repeat",
  "three-alpha-test",
  "three-wave",
  "three-height-colors",
  "three-morph",
  "three-lathe",
  "three-extrude",
  "three-tube",
  "three-sprite",
  "three-fog",
  "three-fog-exp2",
];

describe("unlit Three.js lessons judged on a ray-cast frame, pixels included", () => {
  const threeLessons = LESSONS.filter((l) => l.id.startsWith("three-"));

  // Exactly the unlit and softly lit lessons are drawn (the rest need a GPU):
  // one test per lesson, since rendering all of them in one test ran past
  // the 5 s limit on the CI runner.
  it("lists the drawable lessons in catalogue order", () => {
    expect(FLAT_LESSONS).toEqual(threeLessons.map((l) => l.id).filter((id) => FLAT_LESSONS.includes(id)));
  });

  for (const lesson of threeLessons) {
    const drawable = FLAT_LESSONS.includes(lesson.id);
    it(`${lesson.id}: ${drawable ? "drawn by the model" : "needs a GPU"}`, () => {
      expect(flatRender(execScene(lesson.challenge.solution), 1) !== null).toBe(drawable);
    });
  }

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

/** The second triangle of the triangle lesson's solution, after its first corner. */
const SECOND_TRIANGLE_TAIL = "   1.5,  1.5, 0,  // 右上\n  -1.5,  1.5, 0,  // 左上（左下 → 右上 → 左上 で反時計回り）\n";
/** The vertex-colour lesson's colours, as written in its solution. */
const RGB_COLOURS = "  1, 0, 0,  // 上: 赤\n  0, 1, 0,  // 左下: 緑\n  0, 0, 1,  // 右下: 青\n";
/** Lines of the UV lessons' solutions that the edits below change. */
const UV_BOTTOM = "  0, 0,  // 0: 左下 → 画像の左下\n  1, 0,  // 1: 右下 → 画像の右下\n";
const UV_TOP = "  1, 1,  // 2: 右上 → 画像の右上\n  0, 1,  // 3: 左上 → 画像の左上\n";
const ATLAS_REPEAT = "tex.repeat.set(0.5, 0.5);  // 画像の縦横半分だけを貼る\n";
const ATLAS_OFFSET = "tex.offset.set(0.5, 0.5);  // 右上のコマから\n";
const ROTATION_CENTER = "tex.center.set(0.5, 0.5);    // 回転の中心を画像のまん中に\n";
const ROTATION_ANGLE = "tex.rotation = Math.PI / 2;  // 反時計回りに 90°（ラジアン）\n";
/** Lines of the eighth-batch scene solutions that the edits below change. */
const LERP_LINE = "ball.position.lerpVectors(a, b, 0.25);";
const QUATERNION_LINE = "arms.quaternion.setFromAxisAngle(axis, Math.PI * 2 / 3);";
const SPHERICAL_LINE = "marker.position.setFromSphericalCoords(2, Math.PI / 3, Math.PI / 6);";
/** Lines of the ninth-batch scene solutions that the edits below change. */
const WAVE_LINE = "pos.setZ(i, 0.3 * Math.sin(y * 3));";
const NORMALS_LINE = "geo.computeVertexNormals();  // 動かしたあとの面の向きを計算し直す\n";
const MIX_LINE = "c.lerpColors(low, high, (h + 1) / 2);";
const WRITE_LINE = "c.toArray(colors, i * 3);";
const MORPH_TARGET_LINE = "geo.morphAttributes.position = [new THREE.Float32BufferAttribute(star, 3)];";
const INFLUENCE_LINE = "shape.morphTargetInfluences[0] = 1;";
/** Lines of the tenth-batch scene solutions that the edits below change. */
const NEAREST_LINE = "tex.magFilter = THREE.NearestFilter;  // 拡大するとき、いちばん近いピクセルの色をそのまま使う\n";
const MIRRORED_LINE = "tex.wrapS = THREE.MirroredRepeatWrapping;  // 1つおきに左右を反転してくり返す\n";
const HEART_MATERIAL = "{ map: tex, alphaTest: 0.5 }";
/** Lines of the eleventh-batch scene solutions that the edits below change. */
const WORLD_LINE = "tip.getWorldPosition(flag.position);";
const ATTACH_LINE = "turntable.attach(ball);";
const ORDER_LINE = "m.multiplyMatrices(rotate, move);";

/** Plausible wrong answers to the 2026-10 (third to sixth batch) unlit scene
 *  lessons, as edits of the solution; each must be rejected at both preview
 *  shapes. */
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
  // 2026-10, fifth batch.
  "three-background": [
    ["the colour name left as a string (three ignores it)", (s) => s.replace("new THREE.Color('lightblue')", "'lightblue'")],
    ["a dark colour", (s) => s.replace("'lightblue'", "'navy'")],
  ],
  "three-hemisphere-light": [
    ["the sky and ground colours the wrong way round", (s) => s.replace("'skyblue', 'darkorange'", "'darkorange', 'skyblue'")],
    ["the ambient light kept as well (washed out)", (s) => s.replace("scene.add(light);", "scene.add(light, new THREE.AmbientLight(0xffffff, 2));")],
    ["intensity 1 (half as bright)", (s) => s.replace("'darkorange', 3)", "'darkorange', 1)")],
    ["intensity 6 (blown out)", (s) => s.replace("'darkorange', 3)", "'darkorange', 6)")],
  ],
  "three-look-at": [
    ["lookAt(target) with the object instead of its position (NaN, nothing drawn)", (s) => s.replace("lookAt(target.position)", "lookAt(target)")],
    ["the target made to look at the arrow", (s) => s.replace("arrow.lookAt(target.position)", "target.lookAt(arrow.position)")],
    ["the arrow looking at the origin (its own place, so it keeps facing the camera)", (s) => s.replace("lookAt(target.position)", "lookAt(0, 0, 0)")],
  ],
  "three-sprite": [
    [
      "the planes turned to the camera by hand",
      (s) =>
        s.replace(
          "new THREE.Sprite(new THREE.SpriteMaterial({ color }))",
          "new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color }));\n  orb.lookAt(camera.position); // SpriteMaterial",
        ),
    ],
  ],
  // 2026-10, sixth batch.
  "three-triangles": [
    ["the second triangle clockwise (seen from behind, so not drawn)", (s) => s.replace(SECOND_TRIANGLE_TAIL, "  -1.5,  1.5, 0,  // 左上\n   1.5,  1.5, 0,  // 右上\n")],
    ["only two more vertices (a leftover vertex draws nothing)", (s) => s.replace("  -1.5,  1.5, 0,  // 左上（左下 → 右上 → 左上 で反時計回り）\n", "")],
    ["the first triangle again", (s) => s.replace(SECOND_TRIANGLE_TAIL, "   1.5, -1.5, 0,  // 右下\n   1.5,  1.5, 0,  // 右上\n")],
  ],
  "three-index": [
    ["the second triangle clockwise (0, 3, 2)", (s) => s.replace("0, 2, 3,", "0, 3, 2,")],
    ["four indices (one triangle and a leftover)", (s) => s.replace("  0, 2, 3,  // 左上の三角形（どちらも反時計回り）\n", "  3,\n")],
  ],
  "three-vertex-colors": [
    ["the colours without vertexColors (all white)", (s) => s.replace("{ vertexColors: true }", "{ color: 'white' } // vertexColors")],
    [
      "the colours in the wrong order (blue at the top, red bottom right)",
      (s) => s.replace("  1, 0, 0,  // 上: 赤\n", "  0, 0, 1,  // 上: 青\n").replace("  0, 0, 1,  // 右下: 青\n", "  1, 0, 0,  // 右下: 赤\n"),
    ],
    ["the colours written as 0–255", (s) => s.replace(RGB_COLOURS, "  255, 0, 0,\n  0, 255, 0,\n  0, 0, 255,\n")],
  ],
  // 2026-10, seventh batch.
  "three-uv": [
    ["the top corners' v left at 0 (the bottom row stretched)", (s) => s.replace(UV_TOP, "  1, 0,  // 2: 右上\n  0, 0,  // 3: 左上\n")],
    ["upside down (v = 1 at the bottom)", (s) => s.replace(UV_BOTTOM + UV_TOP, "  0, 1,\n  1, 1,\n  1, 0,\n  0, 0,\n")],
    ["the uv passed on but no map (a white board)", (s) => s.replace("{ map: tex }", "{ color: 'white' }")],
  ],
  "three-texture-atlas": [
    ["repeat only (the bottom-left cell)", (s) => s.replace(ATLAS_OFFSET, "// offset\n")],
    ["offset only (the cell and what lies past it)", (s) => s.replace(ATLAS_REPEAT, "")],
    ["the top-left cell (offset 0, 0.5)", (s) => s.replace("tex.offset.set(0.5, 0.5)", "tex.offset.set(0, 0.5)")],
  ],
  "three-texture-rotation": [
    ["no center (turned about the corner)", (s) => s.replace(ROTATION_CENTER, "")],
    ["90 (radians, not degrees)", (s) => s.replace("tex.rotation = Math.PI / 2;", "tex.rotation = 90;")],
    ["clockwise (-Math.PI / 2)", (s) => s.replace("tex.rotation = Math.PI / 2;", "tex.rotation = -Math.PI / 2;")],
  ],
  // 2026-10, eighth batch.
  "three-lerp": [
    ["from b towards a", (s) => s.replace(LERP_LINE, "ball.position.lerpVectors(b, a, 0.25);")],
    ["lerp from where the ball is (the origin)", (s) => s.replace(LERP_LINE, "ball.position.lerp(b, 0.25);")],
    ["halfway (t = 0.5)", (s) => s.replace(LERP_LINE, "ball.position.lerpVectors(a, b, 0.5);")],
    ["t as a percentage (25)", (s) => s.replace(LERP_LINE, "ball.position.lerpVectors(a, b, 25);")],
  ],
  "three-quaternion": [
    ["the axis not normalized", (s) => s.replace("new THREE.Vector3(1, 1, 1).normalize();", "new THREE.Vector3(1, 1, 1);")],
    ["120 (degrees, not radians)", (s) => s.replace(QUATERNION_LINE, "arms.quaternion.setFromAxisAngle(axis, 120);")],
    ["the other way round (−120°)", (s) => s.replace(QUATERNION_LINE, "arms.quaternion.setFromAxisAngle(axis, -Math.PI * 2 / 3);")],
    [
      "120° about x, y and z in turn (Euler angles)",
      (s) => s.replace(QUATERNION_LINE, "arms.rotation.set(Math.PI * 2 / 3, Math.PI * 2 / 3, Math.PI * 2 / 3); // Quaternion"),
    ],
  ],
  "three-spherical": [
    ["the latitude (30°) as phi", (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSphericalCoords(2, Math.PI / 6, Math.PI / 6);")],
    ["phi and theta swapped", (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSphericalCoords(2, Math.PI / 6, Math.PI / 3);")],
    ["degrees (60, 30)", (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSphericalCoords(2, 60, 30);")],
    ["radius 1 (inside the globe)", (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSphericalCoords(1, Math.PI / 3, Math.PI / 6);")],
    [
      "theta from +X (x with cos, z with sin)",
      (s) =>
        s.replace(
          SPHERICAL_LINE,
          "marker.position.set(2 * Math.sin(Math.PI / 3) * Math.cos(Math.PI / 6), 2 * Math.cos(Math.PI / 3), 2 * Math.sin(Math.PI / 3) * Math.sin(Math.PI / 6));",
        ),
    ],
  ],
  // 2026-10, ninth batch.
  "three-wave": [
    ["the normals never recomputed", (s) => s.replace(NORMALS_LINE, "// computeVertexNormals\n")],
    ["the normals computed before the vertices move", (s) => s.replace(NORMALS_LINE, "").replace("const pos = geo.attributes.position;", "geo.computeVertexNormals();\nconst pos = geo.attributes.position;")],
    ["the wave along x", (s) => s.replace(WAVE_LINE, "pos.setZ(i, 0.3 * Math.sin(pos.getX(i) * 3));")],
    ["setY instead of setZ (moved within the board)", (s) => s.replace(WAVE_LINE, "pos.setY(i, y + 0.3 * Math.sin(y * 3));")],
    ["an amplitude of 3", (s) => s.replace(WAVE_LINE, "pos.setZ(i, 3 * Math.sin(y * 3));")],
  ],
  "three-height-colors": [
    ["h itself as the ratio (not 0 to 1)", (s) => s.replace(MIX_LINE, "c.lerpColors(low, high, h);")],
    ["low and high the other way round", (s) => s.replace(MIX_LINE, "c.lerpColors(high, low, (h + 1) / 2);")],
    ["written at i, not i * 3", (s) => s.replace(WRITE_LINE, "c.toArray(colors, i);")],
    ["without vertexColors", (s) => s.replace("{ vertexColors: true }", "{ color: 'white' } /* vertexColors */")],
  ],
  "three-morph": [
    ["an influence of 0.5 (halfway)", (s) => s.replace(INFLUENCE_LINE, "shape.morphTargetInfluences[0] = 0.5;")],
    [
      "the morph target set after the mesh, without updateMorphTargets",
      (s) => s.replace(MORPH_TARGET_LINE, "").replace("scene.add(shape);", "scene.add(shape);\n" + MORPH_TARGET_LINE),
    ],
  ],
  // 2026-10, tenth batch.
  "three-nearest-filter": [
    ["minFilter instead of magFilter", (s) => s.replace(NEAREST_LINE, "tex.minFilter = THREE.NearestFilter;\n")],
    ["magFilter = LinearFilter", (s) => s.replace(NEAREST_LINE, "tex.magFilter = THREE.LinearFilter;  // NearestFilter\n")],
    ["set on the material, not the texture", (s) => s.replace(NEAREST_LINE, "").replace("scene.add(board);", "scene.add(board);\nboard.material.magFilter = THREE.NearestFilter;")],
  ],
  "three-mirrored-repeat": [
    ["wrapT instead of wrapS", (s) => s.replace(MIRRORED_LINE, "tex.wrapT = THREE.MirroredRepeatWrapping;\n")],
    ["clamped (ClampToEdgeWrapping)", (s) => s.replace(MIRRORED_LINE, "tex.wrapS = THREE.ClampToEdgeWrapping;  // MirroredRepeatWrapping\n")],
    ["mirrored, but repeated once", (s) => s.replace("tex.repeat.set(3, 1);", "tex.repeat.set(1, 1);")],
  ],
  "three-alpha-test": [
    ["transparent with opacity 0.5", (s) => s.replace(HEART_MATERIAL, "{ map: tex, transparent: true, opacity: 0.5 }")],
    ["alphaTest on the texture", (s) => s.replace(HEART_MATERIAL, "{ map: tex }").replace("scene.add(heart);", "scene.add(heart);\ntex.alphaTest = 0.5;")],
    ["alphaTest 1.5 (every pixel discarded)", (s) => s.replace(HEART_MATERIAL, "{ map: tex, alphaTest: 1.5 }")],
  ],
  // 2026-10, eleventh batch.
  "three-world-position": [
    ["the tip's local position", (s) => s.replace(WORLD_LINE, "flag.position.copy(tip.position);  // getWorldPosition")],
    ["the local position plus the arm's (its turn left out)", (s) => s.replace(WORLD_LINE, "flag.position.copy(tip.position).add(arm.position);  // getWorldPosition")],
    ["the arm's world position (its base)", (s) => s.replace(WORLD_LINE, "arm.getWorldPosition(flag.position);")],
    ["computed but not used", (s) => s.replace(WORLD_LINE, "tip.getWorldPosition(new THREE.Vector3());")],
  ],
  "three-attach": [
    ["add (the ball jumps)", (s) => s.replace(ATTACH_LINE, "turntable.add(ball);  // attach")],
    ["worldToLocal and add (the position kept, the size halved)", (s) => s.replace(ATTACH_LINE, "turntable.worldToLocal(ball.position);\nturntable.add(ball);")],
  ],
  "three-matrix-order": [
    ["move × rotate (turned first, then moved)", (s) => s.replace(ORDER_LINE, "m.multiplyMatrices(move, rotate);")],
    ["copy(move).multiply(rotate)", (s) => s.replace(ORDER_LINE, "m.copy(move).multiply(rotate);")],
    ["copy(rotate).premultiply(move)", (s) => s.replace(ORDER_LINE, "m.copy(rotate).premultiply(move);")],
  ],
};

/** Other correct ways to write the fifth- and sixth-batch unlit scene lessons;
 *  each must pass at both preview shapes (lenient input, SHIG 50). */
const SCENE_VARIANTS: Record<string, ReadonlyArray<readonly [string, (solution: string) => string]>> = {
  "three-background": [
    ["renderer.setClearColor instead", (s) => s.replace("scene.background = new THREE.Color('lightblue');", "renderer.setClearColor('lightblue'); // scene.background")],
    ["the colour as a hex number", (s) => s.replace("'lightblue'", "0xadd8e6")],
  ],
  "three-hemisphere-light": [["hex colours", (s) => s.replace("'skyblue', 'darkorange'", "0x87ceeb, 0xff8c00")]],
  "three-look-at": [["lookAt(x, y, z)", (s) => s.replace("lookAt(target.position)", "lookAt(-0.25, 2.3, 0)")]],
  "three-sprite": [["scaled to 1.2", (s) => s.replace("orb.position.set", "orb.scale.set(1.2, 1.2, 1);\n  orb.position.set")]],
  // 2026-10, sixth batch.
  "three-triangles": [
    [
      "clockwise, drawn with side: THREE.DoubleSide",
      (s) =>
        s
          .replace(SECOND_TRIANGLE_TAIL, "  -1.5,  1.5, 0,  // 左上\n   1.5,  1.5, 0,  // 右上\n")
          .replace("{ color: 'tomato' }", "{ color: 'tomato', side: THREE.DoubleSide }"),
    ],
    [
      "the second triangle starting from its top-left corner",
      (s) => s.replace("  -1.5, -1.5, 0,  // 左下\n" + SECOND_TRIANGLE_TAIL, "  -1.5,  1.5, 0,  // 左上\n  -1.5, -1.5, 0,  // 左下\n   1.5,  1.5, 0,  // 右上\n"),
    ],
  ],
  "three-index": [
    [
      "the two triangles the other way round",
      (s) => s.replace("  0, 1, 2,  // 右下の三角形\n  0, 2, 3,", "  0, 2, 3,  // 左上の三角形\n  0, 1, 2,"),
    ],
    [
      "a Uint16Array index in a BufferAttribute",
      (s) => s.replace(/geo\.setIndex\(\[([\s\S]*?)\]\);/, "geo.setIndex(new THREE.BufferAttribute(new Uint16Array([$1]), 1));"),
    ],
  ],
  "three-vertex-colors": [
    [
      "a Float32BufferAttribute and a white material colour",
      (s) =>
        s
          .replace("new THREE.BufferAttribute(colors, 3)", "new THREE.Float32BufferAttribute(colors, 3)")
          .replace("{ vertexColors: true }", "{ color: 'white', vertexColors: true }"),
    ],
    [
      "colours from THREE.Color ('red', 'lime', 'blue')",
      (s) =>
        s.replace(
          "const colors = new Float32Array([\n" + RGB_COLOURS + "]);\n",
          "const colors = new Float32Array(9);\n['red', 'lime', 'blue'].forEach((name, i) => new THREE.Color(name).toArray(colors, i * 3));\n",
        ),
    ],
  ],
  // 2026-10, seventh batch.
  "three-uv": [["a Float32BufferAttribute", (s) => s.replace("new THREE.BufferAttribute(uvs, 2)", "new THREE.Float32BufferAttribute(uvs, 2)")]],
  "three-texture-atlas": [
    ["repeat.x and repeat.y one by one", (s) => s.replace("tex.repeat.set(0.5, 0.5);", "tex.repeat.x = 0.5;\ntex.repeat.y = 0.5;")],
    ["the offset set before the repeat", (s) => s.replace(ATLAS_REPEAT + ATLAS_OFFSET, ATLAS_OFFSET + ATLAS_REPEAT)],
  ],
  "three-texture-rotation": [
    ["Math.PI * 0.5", (s) => s.replace("Math.PI / 2;", "Math.PI * 0.5;")],
    ["the rotation set before the center", (s) => s.replace(ROTATION_CENTER + ROTATION_ANGLE, ROTATION_ANGLE + ROTATION_CENTER)],
  ],
  // 2026-10, eighth batch.
  "three-lerp": [
    ["copy(a), then lerp(b, 0.25)", (s) => s.replace(LERP_LINE, "ball.position.copy(a).lerp(b, 0.25);")],
    ["a.clone().lerp(b, 0.25), copied in", (s) => s.replace(LERP_LINE, "ball.position.copy(a.clone().lerp(b, 0.25));")],
  ],
  "three-quaternion": [
    ["setRotationFromAxisAngle", (s) => s.replace(QUATERNION_LINE, "arms.setRotationFromAxisAngle(axis, Math.PI * 2 / 3);")],
    ["rotateOnAxis", (s) => s.replace(QUATERNION_LINE, "arms.rotateOnAxis(axis, Math.PI * 2 / 3);")],
    [
      "a Quaternion copied in, the angle from degrees",
      (s) => s.replace(QUATERNION_LINE, "const q = new THREE.Quaternion().setFromAxisAngle(axis, (120 * Math.PI) / 180);\narms.quaternion.copy(q);"),
    ],
  ],
  "three-spherical": [
    ["a Spherical", (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSpherical(new THREE.Spherical(2, Math.PI / 3, Math.PI / 6));")],
    [
      "angles through degToRad",
      (s) => s.replace(SPHERICAL_LINE, "marker.position.setFromSphericalCoords(2, THREE.MathUtils.degToRad(90 - 30), THREE.MathUtils.degToRad(30));"),
    ],
    [
      "sin and cos written out",
      (s) =>
        s.replace(
          SPHERICAL_LINE,
          "marker.position.set(2 * Math.sin(Math.PI / 3) * Math.sin(Math.PI / 6), 2 * Math.cos(Math.PI / 3), 2 * Math.sin(Math.PI / 3) * Math.cos(Math.PI / 6));",
        ),
    ],
    ["the marker a child of the globe", (s) => s.replace("scene.add(marker);", "globe.add(marker);")],
  ],
  // 2026-10, ninth batch.
  "three-wave": [
    ["setXYZ", (s) => s.replace(WAVE_LINE, "pos.setXYZ(i, pos.getX(i), y, 0.3 * Math.sin(y * 3));")],
    ["the array written directly", (s) => s.replace(WAVE_LINE, "pos.array[i * 3 + 2] = 0.3 * Math.sin(y * 3);")],
  ],
  "three-height-colors": [
    ["copy(low).lerp(high, t)", (s) => s.replace(MIX_LINE, "c.copy(low).lerp(high, (h + 1) / 2);")],
    ["colors.set([c.r, c.g, c.b], i * 3)", (s) => s.replace(WRITE_LINE, "colors.set([c.r, c.g, c.b], i * 3);")],
    ["MathUtils.mapLinear for the ratio", (s) => s.replace(MIX_LINE, "c.lerpColors(low, high, THREE.MathUtils.mapLinear(h, -1, 1, 0, 1));")],
  ],
  "three-morph": [
    ["fill(1)", (s) => s.replace(INFLUENCE_LINE, "shape.morphTargetInfluences.fill(1);")],
    [
      "the morph target set after the mesh, then updateMorphTargets()",
      (s) => s.replace(MORPH_TARGET_LINE, "").replace("scene.add(shape);", "scene.add(shape);\n" + MORPH_TARGET_LINE + "\nshape.updateMorphTargets();"),
    ],
    ["a BufferAttribute over a Float32Array", (s) => s.replace("new THREE.Float32BufferAttribute(star, 3)", "new THREE.BufferAttribute(new Float32Array(star), 3)")],
  ],
  // 2026-10, tenth batch.
  "three-nearest-filter": [
    ["both filters Nearest", (s) => s.replace(NEAREST_LINE, "tex.magFilter = tex.minFilter = THREE.NearestFilter;\n")],
    [
      "the filter given to the constructor",
      (s) => s.replace(NEAREST_LINE, "").replace("new THREE.CanvasTexture(canvas)", "new THREE.CanvasTexture(canvas, undefined, undefined, undefined, THREE.NearestFilter)"),
    ],
  ],
  "three-mirrored-repeat": [
    ["wrapS and wrapT both mirrored", (s) => s.replace(MIRRORED_LINE, "tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;\n")],
    ["the Repeat line kept, Mirrored set after it", (s) => s.replace(MIRRORED_LINE, "tex.wrapS = THREE.RepeatWrapping;\n" + MIRRORED_LINE)],
  ],
  "three-alpha-test": [
    ["transparent: true", (s) => s.replace(HEART_MATERIAL, "{ map: tex, transparent: true }")],
    ["alphaTest 0.1", (s) => s.replace(HEART_MATERIAL, "{ map: tex, alphaTest: 0.1 }")],
    ["alphaTest set on the material afterwards", (s) => s.replace(HEART_MATERIAL, "{ map: tex }").replace("scene.add(heart);", "scene.add(heart);\nheart.material.alphaTest = 0.5;")],
  ],
  // 2026-10, eleventh batch.
  "three-world-position": [
    ["copy of getWorldPosition(new Vector3())", (s) => s.replace(WORLD_LINE, "flag.position.copy(tip.getWorldPosition(new THREE.Vector3()));")],
    ["localToWorld of the tip's origin", (s) => s.replace(WORLD_LINE, "flag.position.set(0, 0, 0);\ntip.localToWorld(flag.position);")],
    ["the arm's localToWorld of the tip's position", (s) => s.replace(WORLD_LINE, "arm.localToWorld(flag.position.copy(tip.position));")],
    ["updateMatrixWorld, then setFromMatrixPosition", (s) => s.replace(WORLD_LINE, "arm.updateMatrixWorld();\nflag.position.setFromMatrixPosition(tip.matrixWorld);")],
  ],
  "three-attach": [
    [
      "the inverse world matrix applied, then add",
      (s) =>
        s.replace(ATTACH_LINE, "turntable.updateMatrixWorld();\nball.applyMatrix4(turntable.matrixWorld.clone().invert());\nturntable.add(ball);"),
    ],
  ],
  "three-matrix-order": [
    ["copy(rotate).multiply(move)", (s) => s.replace(ORDER_LINE, "m.copy(rotate).multiply(move);")],
    ["copy(move).premultiply(rotate)", (s) => s.replace(ORDER_LINE, "m.copy(move).premultiply(rotate);")],
    ["multiply(rotate).multiply(move) on the identity", (s) => s.replace(ORDER_LINE, "m.multiply(rotate).multiply(move);")],
  ],
};

describe("unlit scene variants are accepted", () => {
  for (const [id, variants] of Object.entries(SCENE_VARIANTS)) {
    const { validators, solution } = lessonById(id)!.challenge;
    for (const [label, edit] of variants) {
      it(`${id}: ${label}`, () => {
        const code = edit(solution);
        expect(code).not.toBe(solution);
        for (const aspect of [1, 16 / 9]) {
          const run = execScene(code, aspect);
          const frame = flatRender(run, aspect);
          expect(frame).not.toBeNull();
          expect(evaluate(validators, { ...run.snapshot, samples: frame! }).failures).toEqual([]);
        }
      });
    }
  }
});

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

  it("refuses scenes that need directional lighting, other materials or a textured background", () => {
    const ball = "new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), MAT)";
    const lit = "scene.add(new THREE.DirectionalLight(0xffffff, 1));\n";
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.ShaderMaterial()")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshNormalMaterial({ flatShading: true })")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshStandardMaterial()")});${lit}`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshStandardMaterial({ wireframe: true })")});`)).toBeNull();
    expect(frameOf(`scene.add(${ball.replace("MAT", "new THREE.MeshBasicMaterial({ wireframe: true })")});`)).toBeNull();
    expect(frameOf("scene.background = new THREE.Texture();")).toBeNull();
    expect(frameOf("scene.add(new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()));")).toBeNull();
    expect(
      frameOf("scene.add(new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ sizeAttenuation: false })));"),
    ).toBeNull();
    expect(frameOf("scene.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.Texture() })));")).toBeNull();
  });

  it("lights a standard material by ambient and hemisphere light alone, over π (as three does)", () => {
    const white = wall("MeshStandardMaterial({ color: 'white' })");
    // Ambient 1 on white: 1 / π = 0.318 linear → 0.60 on screen.
    expect(at(frameOf(white + "scene.add(new THREE.AmbientLight(0xffffff, 1));")!, 0.5, 0.5)[0]).toBeCloseTo(0.6, 1);
    // A hemisphere light with its direction straight up on a wall facing the
    // camera (normal · up = 0) gives the average of sky and ground; a wall
    // facing up gets the sky colour alone.
    const hemi = "scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, Math.PI));";
    expect(at(frameOf(white + hemi)!, 0.5, 0.5)[0]).toBeCloseTo(linearToSrgb(0.5), 2);
    const up = "const w = scene.children[0]; w.rotation.x = -Math.PI / 2; w.position.y = -1; camera.position.set(0, 3, 0.01); camera.lookAt(0, -1, 0);";
    expect(at(frameOf(white + hemi + up)!, 0.5, 0.5)[0]).toBe(1);
    // A metal reflects no diffuse light; the emission is still added.
    const metal = wall("MeshStandardMaterial({ color: 'white', metalness: 1, emissive: 0x404040 })");
    expect(at(frameOf(metal + hemi)!, 0.5, 0.5)[0]).toBeCloseTo(64 / 255, 2);
    // A hidden light does not count.
    expect(at(frameOf(white + "const l = new THREE.AmbientLight(0xffffff, 1); l.visible = false; scene.add(l);")!, 0.5, 0.5)[0]).toBe(0);
  });

  it("draws sprites facing the camera in their material colour, with its opacity", () => {
    const sprite = (extra: string) =>
      `const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 'red'${extra} })); s.position.set(0, 1.5, 0); scene.add(s);`;
    expect(at(frameOf(sprite(""))!, 0.5, 0.72)).toEqual([1, 0, 0]);
    // Seen from the side, the sprite still faces the camera.
    expect(at(frameOf(sprite("") + "camera.position.set(5, 0, 0); camera.lookAt(0, 0, 0);")!, 0.5, 0.72)).toEqual([1, 0, 0]);
    expect(at(frameOf(sprite("")!)!, 0.5, 0.5)).toEqual(CLEAR.map((c) => Math.round(c * 255) / 255));
    // SpriteMaterial is transparent by default, so its opacity blends.
    const [r, g] = at(frameOf(sprite(", opacity: 0.5"))!, 0.5, 0.72);
    expect(r).toBeCloseTo(0.5 + CLEAR[0] * 0.5, 2);
    expect(g).toBeCloseTo(CLEAR[1] * 0.5, 2);
  });

  it("clears to renderer.setClearColor, and to a Color background over it; a string background is ignored", () => {
    const corner = (code: string) => at(frameOf(code)!, 0.03, 0.03).map((c) => Math.round(c * 255));
    expect(corner("renderer.setClearColor('lightblue');")).toEqual([173, 216, 230]);
    expect(corner("renderer.setClearColor('lightblue'); scene.background = new THREE.Color('navy');")).toEqual([0, 0, 128]);
    expect(corner("scene.background = 'lightblue';")).toEqual([5, 6, 13]);
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

  // A triangle covering the middle of the view: red at the top, green bottom
  // left, blue bottom right.
  const rgbTriangle = (colors: string, material = "{ vertexColors: true }") =>
    "const geo = new THREE.BufferGeometry();\n" +
    "geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 4, 0, -4, -2, 0, 4, -2, 0]), 3));\n" +
    colors +
    `scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial(${material})));\n`;
  const colorAttribute = "geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3));\n";

  it("blends vertex colours by the hit's barycentric coordinates, in linear light", () => {
    const frame = frameOf(rgbTriangle(colorAttribute), 1)!;
    // The sample nearest the centre lies 0.184 left of and below the origin:
    // barycentric (0.303, 0.372, 0.326) of red, green and blue.
    const [r, g, b] = at(frame, 0.5, 0.5);
    expect(r).toBeCloseTo(linearToSrgb(0.3026), 2);
    expect(g).toBeCloseTo(linearToSrgb(0.3718), 2);
    expect(b).toBeCloseTo(linearToSrgb(0.3257), 2);
    // Without vertexColors the attribute is ignored.
    expect(at(frameOf(rgbTriangle(colorAttribute, "{ color: 'white' }"))!, 0.5, 0.5)).toEqual([1, 1, 1]);
  });

  it("refuses vertexColors without a color attribute (the GPU's value is undefined there)", () => {
    expect(frameOf(rgbTriangle(""))).toBeNull();
  });

  it("draws whole triangles only: a vertex left over at the end of the buffer adds nothing", () => {
    // Four vertices without an index: the triangle (0, 1, 2) and a leftover.
    const quad =
      "const geo = new THREE.BufferGeometry();\n" +
      "geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0]), 3));\n" +
      "scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 'white' })));\n";
    const frame = frameOf(quad)!;
    expect(at(frame, 0.5, 0.34)).toEqual([1, 1, 1]); // below the diagonal: drawn
    expect(at(frame, 0.5, 0.66)).toEqual(CLEAR.map((c) => Math.round(c * 255) / 255)); // above it: empty
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
