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

  it("rejects shader specs on a scene snapshot", () => {
    expect(runSpec({ kind: "compiles" }, scene()).message).toContain("シェーダー");
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
