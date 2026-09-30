import { describe, expect, it } from "vitest";
import { toGridSamples } from "./sample-grid.js";

/** A width×height RGBA buffer painted by `paint(x, y)` (origin bottom-left). */
function buffer(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      px.set(paint(x, y), (y * width + x) * 4);
    }
  }
  return px;
}

describe("toGridSamples", () => {
  it("returns grid×grid samples centred in each cell, normalised to 0..1", () => {
    const samples = toGridSamples(buffer(4, 4, () => [255, 0, 128, 255]), 4, 4, 2);
    expect(samples).toHaveLength(4);
    expect(samples.map((s) => [s.x, s.y])).toEqual([
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ]);
    expect(samples[0].rgba[0]).toBe(1);
    expect(samples[0].rgba[1]).toBe(0);
    expect(samples[0].rgba[2]).toBeCloseTo(128 / 255);
    expect(samples[0].rgba[3]).toBe(1);
  });

  it("reads the pixel under each cell centre with a bottom-left origin", () => {
    // Left half red, right half blue; bottom row half-bright.
    const px = buffer(8, 8, (x, y) => (x < 4 ? [255, 0, 0, 255] : [0, 0, 255, y === 0 ? 128 : 255]));
    const samples = toGridSamples(px, 8, 8, 4);
    const at = (x: number, y: number) => samples.find((s) => s.x === x && s.y === y)?.rgba;
    expect(at(0.125, 0.125)).toEqual([1, 0, 0, 1]);
    expect(at(0.875, 0.875)).toEqual([0, 0, 1, 1]);
    // The bottom-row cell centre is at pixel row 1, not row 0.
    expect(at(0.875, 0.125)).toEqual([0, 0, 1, 1]);
  });

  it("clamps to the last pixel when the grid is finer than the image", () => {
    const px = buffer(2, 2, (x, y) => [x * 255, y * 255, 0, 255]);
    const samples = toGridSamples(px, 2, 2, 5);
    expect(samples).toHaveLength(25);
    const last = samples[samples.length - 1];
    expect(last.rgba).toEqual([1, 1, 0, 1]);
    expect(samples.every((s) => Number.isFinite(s.rgba[0]))).toBe(true);
  });
});
