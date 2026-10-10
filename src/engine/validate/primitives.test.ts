import { describe, expect, it } from "vitest";
import { runSpec, type ValidatorSpec } from "./primitives.js";
import type { Sample, SceneObject, SceneSnapshot, ShaderSnapshot } from "./snapshot.js";

const px = (x: number, y: number, r: number, g: number, b: number): Sample => ({
  x,
  y,
  rgba: [r, g, b, 1],
});

function shader(p: Partial<ShaderSnapshot> = {}): ShaderSnapshot {
  return {
    kind: "shader",
    compiled: true,
    log: "",
    resolution: { w: 10, h: 10 },
    time: 0,
    source: "",
    samples: [],
    ...p,
  };
}

function scene(p: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return { kind: "scene", error: null, source: "", objects: [], camera: null, ...p };
}

function obj(p: Partial<SceneObject> & { type: string }): SceneObject {
  return {
    id: "o",
    geometry: null,
    material: null,
    color: null,
    position: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    ...p,
  };
}

const pass = (s: ValidatorSpec, snap: Parameters<typeof runSpec>[1]) =>
  expect(runSpec(s, snap).pass).toBe(true);
const reject = (s: ValidatorSpec, snap: Parameters<typeof runSpec>[1]) =>
  expect(runSpec(s, snap).pass).toBe(false);

describe("shared validators", () => {
  it("sourceMatches", () => {
    pass({ kind: "sourceMatches", pattern: "void main" }, shader({ source: "void main(){}" }));
    reject({ kind: "sourceMatches", pattern: "nope" }, shader({ source: "abc" }));
    pass({ kind: "sourceMatches", pattern: "VOID", flags: "i" }, shader({ source: "void" }));
  });

  it("noError on shader", () => {
    pass({ kind: "noError" }, shader({ compiled: true }));
    expect(runSpec({ kind: "noError" }, shader({ compiled: false, log: "bad" })).message).toContain(
      "bad",
    );
    expect(runSpec({ kind: "noError" }, shader({ compiled: false, log: "" })).message).toContain(
      "コンパイル",
    );
  });

  it("noError on scene", () => {
    pass({ kind: "noError" }, scene({ error: null }));
    expect(runSpec({ kind: "noError" }, scene({ error: "boom" })).message).toContain("boom");
  });

  it("allOf", () => {
    pass(
      { kind: "allOf", of: [{ kind: "compiles" }, { kind: "noError" }] },
      shader({ compiled: true }),
    );
    reject(
      { kind: "allOf", of: [{ kind: "compiles" }, { kind: "sourceMatches", pattern: "x" }] },
      shader({ compiled: true, source: "" }),
    );
  });

  it("anyOf", () => {
    pass(
      { kind: "anyOf", of: [{ kind: "sourceMatches", pattern: "x" }, { kind: "compiles" }] },
      shader({ compiled: true, source: "" }),
    );
    reject(
      {
        kind: "anyOf",
        of: [{ kind: "sourceMatches", pattern: "x" }, { kind: "sourceMatches", pattern: "y" }],
      },
      shader({ source: "" }),
    );
  });
});

describe("shader validators", () => {
  it("compiles", () => {
    pass({ kind: "compiles" }, shader({ compiled: true }));
    reject({ kind: "compiles" }, shader({ compiled: false }));
  });

  it("rejects `compiles` on a scene snapshot", () => {
    expect(runSpec({ kind: "compiles" }, scene()).message).toContain("シェーダー");
  });

  it("judges pixel specs on a rendered scene, and reports a scene that was not rendered", () => {
    const rendered = scene({ samples: [px(0.5, 0.5, 1, 0, 0)] });
    pass({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0, 0] }, rendered);
    reject({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 0, 1] }, rendered);
    pass({ kind: "regionColor", rect: [0, 0, 1, 1], rgb: [1, 0, 0] }, rendered);
    expect(runSpec({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0, 0] }, scene()).message).toContain(
      "描画結果",
    );
  });

  it("smooth", () => {
    const soft = shader({ samples: [px(0.1, 0.5, 0, 0, 0), px(0.5, 0.5, 0.2, 0.2, 0.2), px(0.9, 0.5, 0.4, 0.4, 0.4)] });
    const hard = shader({ samples: [px(0.1, 0.5, 0, 0, 0), px(0.5, 0.5, 1, 1, 1)] });
    pass({ kind: "smooth" }, soft);
    reject({ kind: "smooth" }, hard);
    pass({ kind: "smooth", maxStep: 1 }, hard);
    reject({ kind: "smooth", maxStep: 0.1 }, soft);
    expect(runSpec({ kind: "smooth" }, hard).message).toContain("なめらか");
  });

  it("cellsFlat", () => {
    const mosaic = shader({
      samples: [
        px(0.2, 0.2, 0, 0, 0), px(0.3, 0.3, 0, 0, 0),
        px(0.7, 0.2, 1, 1, 1), px(0.8, 0.3, 1, 1, 1),
        px(0.2, 0.7, 0.5, 0.5, 0.5), px(0.7, 0.7, 0.5, 0.5, 0.5),
      ],
    });
    pass({ kind: "cellsFlat", cells: 2 }, mosaic);
    // One grey everywhere: flat cells, but no variation between them.
    const flat = shader({ samples: [px(0.2, 0.2, 0.5, 0.5, 0.5), px(0.7, 0.7, 0.5, 0.5, 0.5)] });
    expect(runSpec({ kind: "cellsFlat", cells: 2 }, flat).message).toContain("マスごとの明るさ");
    pass({ kind: "cellsFlat", cells: 2, minVariance: 0 }, flat);
    // Per-pixel noise: a cell is not one colour.
    const noisy = shader({ samples: [px(0.2, 0.2, 0, 0, 0), px(0.3, 0.3, 1, 1, 1), px(0.7, 0.7, 0.5, 0.5, 0.5)] });
    expect(runSpec({ kind: "cellsFlat", cells: 2 }, noisy).message).toContain("2×2");
    pass({ kind: "cellsFlat", cells: 2, tol: 1, minVariance: 0 }, noisy);
  });

  it("pixelApprox", () => {
    const snap = shader({ samples: [px(0.5, 0.5, 1, 0, 0)] });
    pass({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0, 0] }, snap);
    reject({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 0, 1] }, snap);
    reject({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0, 0] }, shader({ samples: [] }));
    pass({ kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.9, 0, 0], tol: 0.2 }, snap);
  });

  it("regionColor", () => {
    const snap = shader({ samples: [px(0.1, 0.1, 1, 1, 1), px(0.2, 0.2, 1, 1, 1)] });
    pass({ kind: "regionColor", rect: [0, 0, 0.5, 0.5], rgb: [1, 1, 1] }, snap);
    reject({ kind: "regionColor", rect: [0, 0, 0.5, 0.5], rgb: [0, 0, 0] }, snap);
    reject({ kind: "regionColor", rect: [0.8, 0.8, 1, 1], rgb: [1, 1, 1] }, snap);
  });

  it("notUniform", () => {
    pass({ kind: "notUniform" }, shader({ samples: [px(0, 0, 0, 0, 0), px(1, 1, 1, 1, 1)] }));
    reject(
      { kind: "notUniform" },
      shader({ samples: [px(0, 0, 0.5, 0.5, 0.5), px(1, 1, 0.5, 0.5, 0.5)] }),
    );
    pass({ kind: "notUniform", minVariance: 0 }, shader({ samples: [px(0, 0, 0.5, 0.5, 0.5)] }));
  });

  it("symmetric", () => {
    pass(
      { kind: "symmetric", axis: "x" },
      shader({ samples: [px(0.1, 0.5, 1, 0, 0), px(0.9, 0.5, 1, 0, 0)] }),
    );
    reject(
      { kind: "symmetric", axis: "x" },
      shader({ samples: [px(0.1, 0.5, 1, 0, 0), px(0.9, 0.5, 0, 0, 1)] }),
    );
    pass(
      { kind: "symmetric", axis: "y", tol: 0.5 },
      shader({ samples: [px(0.5, 0.1, 1, 0, 0), px(0.5, 0.9, 1, 0, 0)] }),
    );
    reject(
      { kind: "symmetric", axis: "y" },
      shader({ samples: [px(0.5, 0.1, 1, 0, 0), px(0.5, 0.9, 0, 0, 1)] }),
    );
  });

  it("gradient", () => {
    const rising = shader({ samples: [px(0.1, 0.5, 0, 0, 0), px(0.9, 0.5, 1, 1, 1)] });
    pass({ kind: "gradient", axis: "x", dir: "up" }, rising);
    reject({ kind: "gradient", axis: "x", dir: "down" }, rising);
    pass({ kind: "gradient", axis: "x", dir: "up", channel: "r", min: 0.5 }, rising);
    pass(
      { kind: "gradient", axis: "x", dir: "down" },
      shader({ samples: [px(0.1, 0.5, 1, 1, 1), px(0.9, 0.5, 0, 0, 0)] }),
    );
  });
});

describe("scene validators", () => {
  it("rejects scene specs on a shader snapshot", () => {
    expect(runSpec({ kind: "sceneHas", type: "Mesh" }, shader()).message).toContain("Three.js");
  });

  it("sceneHas", () => {
    const snap = scene({ objects: [obj({ type: "Mesh" }), obj({ type: "Mesh" })] });
    pass({ kind: "sceneHas", type: "Mesh" }, snap);
    reject({ kind: "sceneHas", type: "PointLight" }, snap);
    reject({ kind: "sceneHas", type: "Mesh", max: 1 }, snap);
    pass({ kind: "sceneHas", type: "Mesh", min: 2, max: 3 }, snap);
  });

  it("objectAt", () => {
    const snap = scene({ objects: [obj({ type: "Mesh", position: [2, 0, 0] })] });
    pass({ kind: "objectAt", position: [2, 0, 0] }, snap);
    reject({ kind: "objectAt", position: [9, 9, 9] }, snap);
    pass({ kind: "objectAt", position: [2, 0, 0], type: "Mesh" }, snap);
    reject({ kind: "objectAt", position: [2, 0, 0], type: "PointLight" }, snap);
    pass({ kind: "objectAt", position: [2.3, 0, 0], tol: 0.5 }, snap);
  });

  it("geometryOf / materialOf", () => {
    const snap = scene({
      objects: [obj({ type: "Mesh", geometry: "BoxGeometry", material: "MeshStandardMaterial" })],
    });
    pass({ kind: "geometryOf", geometry: "BoxGeometry" }, snap);
    reject({ kind: "geometryOf", geometry: "SphereGeometry" }, snap);
    pass({ kind: "materialOf", material: "MeshStandardMaterial", type: "Mesh" }, snap);
    reject({ kind: "materialOf", material: "MeshBasicMaterial" }, snap);
  });

  it("colorApprox", () => {
    const snap = scene({
      objects: [obj({ type: "Mesh", color: null }), obj({ type: "Mesh", color: [1, 0, 0] })],
    });
    pass({ kind: "colorApprox", rgb: [1, 0, 0] }, snap);
    reject({ kind: "colorApprox", rgb: [0, 0, 1] }, snap);
    reject({ kind: "colorApprox", rgb: [1, 0, 0] }, scene({ objects: [obj({ type: "Mesh" })] }));
    pass({ kind: "colorApprox", rgb: [0.9, 0, 0], type: "Mesh", tol: 0.2 }, snap);
  });

  it("scaleApprox", () => {
    const snap = scene({ objects: [obj({ type: "Mesh", scale: [2, 2, 2] }), obj({ type: "PointLight" })] });
    pass({ kind: "scaleApprox", scale: [2, 2, 2] }, snap);
    pass({ kind: "scaleApprox", scale: [2.1, 2, 2], type: "Mesh" }, snap);
    reject({ kind: "scaleApprox", scale: [1, 1, 1], type: "Mesh" }, snap);
    reject({ kind: "scaleApprox", scale: [2, 2, 2], type: "PointLight" }, snap);
    expect(runSpec({ kind: "scaleApprox", scale: [3, 3, 3] }, snap).message).toContain("(3, 3, 3)");
  });

  it("instanced", () => {
    const snap = scene({ objects: [obj({ type: "Mesh" }), obj({ type: "Mesh", instances: 5 })] });
    pass({ kind: "instanced", min: 5 }, snap);
    reject({ kind: "instanced", min: 6 }, snap);
    expect(runSpec({ kind: "instanced", min: 1 }, scene({ objects: [obj({ type: "Mesh" })] })).message).toContain(
      "現在 0 個",
    );
  });

  it("verticesAtLeast", () => {
    const snap = scene({
      objects: [obj({ type: "Points", vertices: 6 }), obj({ type: "Line", vertices: 2 }), obj({ type: "Group" })],
    });
    pass({ kind: "verticesAtLeast", min: 6 }, snap);
    reject({ kind: "verticesAtLeast", min: 7 }, snap);
    pass({ kind: "verticesAtLeast", min: 2, type: "Line" }, snap);
    reject({ kind: "verticesAtLeast", min: 6, type: "Line" }, snap);
    expect(runSpec({ kind: "verticesAtLeast", min: 6, type: "Line" }, snap).message).toContain("Line が必要です（現在 2 個）");
    expect(runSpec({ kind: "verticesAtLeast", min: 1, type: "Group" }, snap).message).toContain("現在 0 個");
    expect(runSpec({ kind: "verticesAtLeast", min: 9 }, snap).message).toContain("オブジェクト");
  });

  it("cameraPositioned", () => {
    reject({ kind: "cameraPositioned", position: [0, 0, 0] }, scene({ camera: null }));
    const snap = scene({ camera: { type: "PerspectiveCamera", position: [0, 5, 10] } });
    pass({ kind: "cameraPositioned", position: [0, 5, 10] }, snap);
    reject({ kind: "cameraPositioned", position: [0, 0, 0] }, snap);
    pass({ kind: "cameraPositioned", position: [0, 5, 10.4], tol: 0.5 }, snap);
  });

  it("rendersNonEmpty", () => {
    reject({ kind: "rendersNonEmpty" }, scene({ samples: undefined }));
    pass({ kind: "rendersNonEmpty" }, scene({ samples: [px(0, 0, 0, 0, 0), px(1, 1, 1, 1, 1)] }));
    reject(
      { kind: "rendersNonEmpty" },
      scene({ samples: [px(0, 0, 0, 0, 0), px(1, 1, 0, 0, 0)] }),
    );
    pass(
      { kind: "rendersNonEmpty", minVariance: 0 },
      scene({ samples: [px(0, 0, 0, 0, 0)] }),
    );
  });
});

describe("message override", () => {
  it("replaces the failure message", () => {
    expect(runSpec({ kind: "compiles", message: "自作メッセージ" }, shader({ compiled: false })).message).toBe(
      "自作メッセージ",
    );
  });
  it("does not affect a passing result", () => {
    const r = runSpec({ kind: "compiles", message: "x" }, shader({ compiled: true }));
    expect(r.pass).toBe(true);
    expect(r.message).toBe("");
  });
});

describe("constructive failure messages (SHIG 55, 11)", () => {
  const msg = (s: ValidatorSpec, snap: Parameters<typeof runSpec>[1]) => runSpec(s, snap).message;

  it("regionColor names the area and shows target vs current colour", () => {
    const m = msg(
      { kind: "regionColor", rect: [0, 0, 1, 1], rgb: [1, 0, 1] },
      shader({ samples: [px(0.5, 0.5, 0, 0, 0)] }),
    );
    expect(m).toContain("画面全体");
    expect(m).toContain("目標: 赤 1.00・緑 0.00・青 1.00");
    expect(m).toContain("いま: 赤 0.00・緑 0.00・青 0.00");
    expect(m).not.toContain("指定領域");
  });

  it("pixelApprox names the place and shows target vs current colour", () => {
    const m = msg(
      { kind: "pixelApprox", x: 0.05, y: 0.5, rgb: [0, 0, 0] },
      shader({ samples: [px(0.05, 0.5, 1, 1, 1)] }),
    );
    expect(m).toContain("左端の中ほど");
    expect(m).toContain("目標: 赤 0.00・緑 0.00・青 0.00");
    expect(m).toContain("いま: 赤 1.00・緑 1.00・青 1.00");
  });

  it("gradient describes the direction in words", () => {
    const m = msg({ kind: "gradient", axis: "x", dir: "up", channel: "r" }, shader({ samples: [] }));
    expect(m).toContain("左 → 右 に向かって赤が強くなる");
    expect(m).not.toMatch(/x 方向/);
  });

  it("scene colorApprox shows the target colour", () => {
    const m = msg(
      { kind: "colorApprox", rgb: [1, 0, 0] },
      scene({ objects: [obj({ type: "Mesh", color: [0, 0, 1] })] }),
    );
    expect(m).toContain("目標: 赤 1.00・緑 0.00・青 0.00");
  });

  it("cameraPositioned shows target and current position", () => {
    const m = msg(
      { kind: "cameraPositioned", position: [0, 0, 8] },
      scene({ camera: { type: "PerspectiveCamera", position: [0, 0, 5] } }),
    );
    expect(m).toContain("目標: (0, 0, 8)");
    expect(m).toContain("いま: (0, 0, 5)");
  });
});
