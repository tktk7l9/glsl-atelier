// Pure helpers over a grid of read-back pixels (Sample[]). These power the
// shader validators: nearest-pixel lookup, region averages, variance (is the
// image more than a flat colour?), mirror symmetry, and gradient direction.

import { colorDistance } from "./color.js";
import type { RGB, Sample } from "./snapshot.js";

export type Channel = "r" | "g" | "b" | "lum";
export type Rect = readonly [number, number, number, number]; // x0,y0,x1,y1 (0..1)

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

export function rgbOf(s: Sample): RGB {
  return [s.rgba[0], s.rgba[1], s.rgba[2]];
}

export function channelValue(rgb: RGB, ch: Channel): number {
  switch (ch) {
    case "r":
      return rgb[0];
    case "g":
      return rgb[1];
    case "b":
      return rgb[2];
    case "lum":
      return rgb[0] * LUM_R + rgb[1] * LUM_G + rgb[2] * LUM_B;
  }
}

/** The sample nearest to (x,y), or undefined when there are no samples. */
export function nearestSample(
  samples: readonly Sample[],
  x: number,
  y: number,
): Sample | undefined {
  let best: Sample | undefined;
  let bestDist = Infinity;
  for (const s of samples) {
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Average colour of samples inside `rect` (inclusive), or undefined if none. */
export function regionAverage(samples: readonly Sample[], rect: Rect): RGB | undefined {
  const [x0, y0, x1, y1] = rect;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const s of samples) {
    if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) {
      r += s.rgba[0];
      g += s.rgba[1];
      b += s.rgba[2];
      n += 1;
    }
  }
  return n === 0 ? undefined : [r / n, g / n, b / n];
}

/** Variance of luminance across all samples (0 when empty). High = not flat. */
export function luminanceVariance(samples: readonly Sample[]): number {
  if (samples.length === 0) return 0;
  const lums = samples.map((s) => channelValue(rgbOf(s), "lum"));
  const mean = lums.reduce((a, l) => a + l, 0) / lums.length;
  return lums.reduce((a, l) => a + (l - mean) * (l - mean), 0) / lums.length;
}

/** Largest colour difference between any sample and its mirror across `axis`. */
export function symmetryError(samples: readonly Sample[], axis: "x" | "y"): number {
  let maxD = 0;
  for (const s of samples) {
    const mx = axis === "x" ? 1 - s.x : s.x;
    const my = axis === "y" ? 1 - s.y : s.y;
    // `samples` is non-empty inside this loop, so a nearest sample always exists.
    const m = nearestSample(samples, mx, my) as Sample;
    const d = colorDistance(rgbOf(s), rgbOf(m));
    if (d > maxD) maxD = d;
  }
  return maxD;
}

/** Mean(channel) over the high half minus the low half along `axis` (0 if a
 *  half is empty). Positive ⇒ the channel rises with the coordinate. */
export function halfDelta(samples: readonly Sample[], axis: "x" | "y", ch: Channel): number {
  let hi = 0;
  let hiN = 0;
  let lo = 0;
  let loN = 0;
  for (const s of samples) {
    const coord = axis === "x" ? s.x : s.y;
    const v = channelValue(rgbOf(s), ch);
    if (coord > 0.5) {
      hi += v;
      hiN += 1;
    } else {
      lo += v;
      loN += 1;
    }
  }
  if (hiN === 0 || loN === 0) return 0;
  return hi / hiN - lo / loN;
}
