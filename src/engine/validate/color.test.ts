import { describe, expect, it } from "vitest";
import { colorApprox, colorDistance } from "./color.js";

describe("colorDistance", () => {
  it("is zero for identical colours", () => {
    expect(colorDistance([0.2, 0.4, 0.6], [0.2, 0.4, 0.6])).toBe(0);
  });

  it("computes euclidean distance", () => {
    expect(colorDistance([1, 0, 0], [0, 0, 0])).toBeCloseTo(1, 6);
    expect(colorDistance([1, 1, 0], [0, 0, 0])).toBeCloseTo(Math.SQRT2, 6);
  });
});

describe("colorApprox", () => {
  it("is true within tolerance", () => {
    expect(colorApprox([0.5, 0.5, 0.5], [0.55, 0.5, 0.5], 0.1)).toBe(true);
  });
  it("is false outside tolerance", () => {
    expect(colorApprox([0, 0, 0], [1, 1, 1], 0.1)).toBe(false);
  });
});
