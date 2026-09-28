import { describe, expect, it } from "vitest";
import { describeDirection, describePoint, describeRect, formatRgb, formatVec3 } from "./describe.js";

describe("formatRgb", () => {
  it("names each channel with two decimals", () => {
    expect(formatRgb([1, 0, 0.5])).toBe("赤 1.00・緑 0.00・青 0.50");
  });
  it("clamps tiny float noise to 0.00", () => {
    expect(formatRgb([0.001, 0.999, 0])).toBe("赤 0.00・緑 1.00・青 0.00");
  });
});

describe("formatVec3", () => {
  it("formats a position compactly", () => {
    expect(formatVec3([0, 1.5, -2])).toBe("(0, 1.5, -2)");
    expect(formatVec3([0.123, 0, 0])).toBe("(0.12, 0, 0)");
  });
});

describe("describePoint", () => {
  it("names the nine regions of the canvas (origin bottom-left)", () => {
    expect(describePoint(0.5, 0.5)).toBe("中央");
    expect(describePoint(0.05, 0.5)).toBe("左端の中ほど");
    expect(describePoint(0.95, 0.5)).toBe("右端の中ほど");
    expect(describePoint(0.5, 0.05)).toBe("下端の中ほど");
    expect(describePoint(0.5, 0.95)).toBe("上端の中ほど");
    expect(describePoint(0.05, 0.05)).toBe("左下の角");
    expect(describePoint(0.95, 0.95)).toBe("右上の角");
    expect(describePoint(0.05, 0.95)).toBe("左上の角");
    expect(describePoint(0.95, 0.05)).toBe("右下の角");
  });
});

describe("describeRect", () => {
  it("calls a full-canvas rect the whole screen", () => {
    expect(describeRect([0, 0, 1, 1])).toBe("画面全体");
  });
  it("describes a partial rect by its centre", () => {
    expect(describeRect([0, 0, 0.12, 0.12])).toBe("左下の角");
  });
});

describe("describeDirection", () => {
  it("uses left/right and bottom/top words", () => {
    expect(describeDirection("x", "up", "lum")).toBe("左 → 右 に向かって明るくなる");
    expect(describeDirection("x", "down", "lum")).toBe("右 → 左 に向かって明るくなる");
    expect(describeDirection("y", "up", "g")).toBe("下 → 上 に向かって緑が強くなる");
    expect(describeDirection("y", "down", "r")).toBe("上 → 下 に向かって赤が強くなる");
    expect(describeDirection("x", "up", "b")).toBe("左 → 右 に向かって青が強くなる");
  });
});
