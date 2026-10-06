import { describe, expect, it } from "vitest";
import {
  cellSpread,
  channelValue,
  halfDelta,
  luminanceVariance,
  maxNeighbourStep,
  nearestSample,
  regionAverage,
  rgbOf,
  symmetryError,
} from "./sample.js";
import type { Sample } from "./snapshot.js";

const px = (x: number, y: number, r: number, g: number, b: number): Sample => ({
  x,
  y,
  rgba: [r, g, b, 1],
});

describe("rgbOf / channelValue", () => {
  it("drops alpha", () => {
    expect(rgbOf(px(0, 0, 0.1, 0.2, 0.3))).toEqual([0.1, 0.2, 0.3]);
  });
  it("reads each channel", () => {
    expect(channelValue([0.1, 0.2, 0.3], "r")).toBe(0.1);
    expect(channelValue([0.1, 0.2, 0.3], "g")).toBe(0.2);
    expect(channelValue([0.1, 0.2, 0.3], "b")).toBe(0.3);
  });
  it("computes luminance", () => {
    expect(channelValue([1, 1, 1], "lum")).toBeCloseTo(1, 6);
    expect(channelValue([0, 0, 0], "lum")).toBe(0);
  });
});

describe("nearestSample", () => {
  it("returns undefined when empty", () => {
    expect(nearestSample([], 0.5, 0.5)).toBeUndefined();
  });
  it("returns the closest sample (and skips farther ones)", () => {
    const a = px(0.1, 0.1, 1, 0, 0);
    const b = px(0.9, 0.9, 0, 1, 0);
    expect(nearestSample([a, b], 0.0, 0.0)).toBe(a);
    expect(nearestSample([a, b], 1.0, 1.0)).toBe(b);
  });
});

describe("regionAverage", () => {
  it("returns undefined when no sample is inside the rect", () => {
    expect(regionAverage([px(0.9, 0.9, 1, 1, 1)], [0, 0, 0.5, 0.5])).toBeUndefined();
  });
  it("averages samples inside the rect", () => {
    const avg = regionAverage(
      [px(0.1, 0.1, 1, 0, 0), px(0.2, 0.2, 0, 0, 0), px(0.9, 0.9, 0, 0, 1)],
      [0, 0, 0.5, 0.5],
    );
    expect(avg).toEqual([0.5, 0, 0]);
  });
});

describe("luminanceVariance", () => {
  it("is zero for empty input", () => {
    expect(luminanceVariance([])).toBe(0);
  });
  it("is zero for a flat image", () => {
    expect(luminanceVariance([px(0, 0, 0.5, 0.5, 0.5), px(1, 1, 0.5, 0.5, 0.5)])).toBeCloseTo(0, 9);
  });
  it("is positive for a varied image", () => {
    expect(luminanceVariance([px(0, 0, 0, 0, 0), px(1, 1, 1, 1, 1)])).toBeGreaterThan(0.1);
  });
});

describe("symmetryError", () => {
  it("is zero for empty input", () => {
    expect(symmetryError([], "x")).toBe(0);
  });
  it("is ~0 for a left-right symmetric image", () => {
    const s = [px(0.1, 0.5, 1, 0, 0), px(0.9, 0.5, 1, 0, 0)];
    expect(symmetryError(s, "x")).toBeCloseTo(0, 6);
  });
  it("is large for an asymmetric image", () => {
    const s = [px(0.1, 0.5, 1, 0, 0), px(0.9, 0.5, 0, 0, 1)];
    expect(symmetryError(s, "x")).toBeGreaterThan(0.5);
  });
  it("handles the y axis", () => {
    const s = [px(0.5, 0.1, 1, 1, 1), px(0.5, 0.9, 1, 1, 1)];
    expect(symmetryError(s, "y")).toBeCloseTo(0, 6);
  });
});

describe("halfDelta", () => {
  it("is zero when a half is empty", () => {
    expect(halfDelta([px(0.1, 0.1, 1, 1, 1)], "x", "lum")).toBe(0); // only low half
    expect(halfDelta([px(0.9, 0.9, 1, 1, 1)], "y", "lum")).toBe(0); // only high half
  });
  it("is positive for a rising gradient", () => {
    const s = [px(0.1, 0.5, 0, 0, 0), px(0.9, 0.5, 1, 1, 1)];
    expect(halfDelta(s, "x", "lum")).toBeGreaterThan(0.5);
  });
  it("is negative for a falling gradient", () => {
    const s = [px(0.1, 0.5, 1, 1, 1), px(0.9, 0.5, 0, 0, 0)];
    expect(halfDelta(s, "x", "lum")).toBeLessThan(-0.5);
  });
});

describe("maxNeighbourStep", () => {
  it("is zero for empty, single or flat input", () => {
    expect(maxNeighbourStep([])).toBe(0);
    expect(maxNeighbourStep([px(0.5, 0.5, 1, 1, 1)])).toBe(0);
    expect(maxNeighbourStep([px(0.1, 0.5, 0.5, 0.5, 0.5), px(0.9, 0.5, 0.5, 0.5, 0.5)])).toBe(0);
  });
  it("finds the largest jump along a row and along a column", () => {
    const row = [px(0.1, 0.5, 0, 0, 0), px(0.5, 0.5, 0.2, 0.2, 0.2), px(0.9, 0.5, 1, 1, 1)];
    expect(maxNeighbourStep(row)).toBeCloseTo(0.8, 6);
    const col = [px(0.5, 0.1, 1, 1, 1), px(0.5, 0.9, 0.4, 0.4, 0.4)];
    expect(maxNeighbourStep(col)).toBeCloseTo(0.6, 6);
  });
  it("compares only samples on the same line, not diagonal ones", () => {
    const diag = [px(0.1, 0.1, 0, 0, 0), px(0.9, 0.9, 1, 1, 1)];
    expect(maxNeighbourStep(diag)).toBe(0);
  });
  it("does not let a jump between rows count as a step", () => {
    // Last sample of row 1 is bright, first of row 2 is dark; they are not neighbours.
    const s = [px(0.3, 0.3, 1, 1, 1), px(0.7, 0.3, 1, 1, 1), px(0.3, 0.7, 0, 0, 0), px(0.7, 0.7, 0, 0, 0)];
    expect(maxNeighbourStep(s)).toBeCloseTo(1, 6); // the vertical neighbours differ by 1
    const t = [px(0.3, 0.3, 1, 1, 1), px(0.7, 0.3, 1, 1, 1), px(0.3, 0.7, 1, 1, 1), px(0.7, 0.7, 1, 1, 1)];
    expect(maxNeighbourStep(t)).toBe(0);
  });
});

describe("cellSpread", () => {
  it("is all zero for empty input", () => {
    expect(cellSpread([], 2)).toEqual({ within: 0, between: 0 });
  });
  it("reports flat cells that differ from one another", () => {
    const s = [
      px(0.2, 0.2, 0, 0, 0), px(0.3, 0.3, 0, 0, 0),
      px(0.7, 0.2, 1, 1, 1), px(0.8, 0.3, 1, 1, 1),
      px(0.2, 0.7, 0.5, 0.5, 0.5), px(0.7, 0.7, 0.5, 0.5, 0.5),
    ];
    const r = cellSpread(s, 2);
    expect(r.within).toBeCloseTo(0, 6);
    expect(r.between).toBeGreaterThan(0.1);
  });
  it("reports variation inside a cell", () => {
    const s = [px(0.2, 0.2, 0, 0, 0), px(0.3, 0.3, 1, 1, 1)];
    expect(cellSpread(s, 2).within).toBeCloseTo(1, 6);
  });
  it("clamps samples on the far edge into the last cell", () => {
    const s = [px(1, 1, 1, 1, 1), px(0.9, 0.9, 1, 1, 1)];
    expect(cellSpread(s, 2)).toEqual({ within: 0, between: 0 });
  });
});
