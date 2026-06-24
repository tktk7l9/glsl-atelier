import { describe, expect, it } from "vitest";
import { evaluate } from "./run.js";
import type { ShaderSnapshot } from "./snapshot.js";

const snap: ShaderSnapshot = {
  kind: "shader",
  compiled: true,
  log: "",
  resolution: { w: 10, h: 10 },
  time: 0,
  source: "void main(){}",
  samples: [{ x: 0.5, y: 0.5, rgba: [1, 0, 0, 1] }],
};

describe("evaluate", () => {
  it("passes when every spec passes", () => {
    const res = evaluate(
      [{ kind: "compiles" }, { kind: "sourceMatches", pattern: "main" }],
      snap,
    );
    expect(res.passed).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.results).toHaveLength(2);
  });

  it("collects failure messages", () => {
    const res = evaluate(
      [{ kind: "compiles" }, { kind: "sourceMatches", pattern: "nope" }],
      snap,
    );
    expect(res.passed).toBe(false);
    expect(res.failures).toHaveLength(1);
  });
});
