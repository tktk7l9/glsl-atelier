// Pure colour helpers shared by the pixel/colour validators. Colours are RGB
// triples in 0..1.

import type { RGB } from "./snapshot.js";

/** Euclidean distance between two colours in RGB (0..1) space. */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** True when two colours are within `tol` distance of each other. */
export function colorApprox(a: RGB, b: RGB, tol: number): boolean {
  return colorDistance(a, b) <= tol;
}
