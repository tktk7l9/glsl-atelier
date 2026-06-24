// Turn a raw RGBA pixel buffer (read back from WebGL, origin bottom-left) into a
// coarse normalized grid of Samples for the pure validators. Shared by the
// shader runtime and the Three.js sandbox runner.

import type { Sample } from "../engine/validate/snapshot.js";

export function toGridSamples(
  pixels: Uint8Array,
  width: number,
  height: number,
  grid: number,
): Sample[] {
  const out: Sample[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const nx = (gx + 0.5) / grid;
      const ny = (gy + 0.5) / grid;
      const px = Math.min(width - 1, Math.floor(nx * width));
      const py = Math.min(height - 1, Math.floor(ny * height));
      const i = (py * width + px) * 4;
      out.push({
        x: nx,
        y: ny,
        rgba: [pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255, pixels[i + 3] / 255],
      });
    }
  }
  return out;
}
