// Validators are serializable spec objects (a discriminated union), not opaque
// closures. A challenge composes them as data; `runSpec` interprets them against
// a Snapshot. Being plain data means the content layer can introspect them
// (e.g. content tests cross-check that a lesson's solution matches its own
// `sourceMatches` validators) and they stay trivially testable.
//
// Prefer OUTPUT validators (pixel colours / scene geometry — they accept any
// correct solution) and use `sourceMatches` only when a specific token is the
// lesson (e.g. "use smoothstep", "call new THREE.Mesh").
//
// The pixel validators read the `samples` grid, which both runtimes provide
// (the shader grader always, the scene sandbox after rendering a frame), so a
// Three.js lesson can also be judged by what it actually drew.

import { colorApprox } from "./color.js";
import {
  cellSpread,
  halfDelta,
  luminanceVariance,
  maxNeighbourStep,
  nearestSample,
  regionAverage,
  rgbOf,
  symmetryError,
  type Channel,
  type Rect,
} from "./sample.js";
import type {
  RGB,
  Sample,
  SceneSnapshot,
  Snapshot,
  ValidationResult,
  Vec3,
} from "./snapshot.js";
import { describeDirection, describePoint, describeRect, formatRgb, formatVec3 } from "./describe.js";

export type Axis = "x" | "y";

interface Base {
  /** Tolerance for approximate checks (colour distance or world units). */
  readonly tol?: number;
  /** Optional override shown to the learner when this validator fails. */
  readonly message?: string;
}

export type ValidatorSpec =
  // ---- shared ----
  | (Base & { kind: "sourceMatches"; pattern: string; flags?: string })
  | (Base & { kind: "noError" })
  | (Base & { kind: "allOf"; of: readonly ValidatorSpec[] })
  | (Base & { kind: "anyOf"; of: readonly ValidatorSpec[] })
  // ---- shader only ----
  | (Base & { kind: "compiles" })
  // ---- pixel read-back (shader, or a rendered scene) ----
  | (Base & { kind: "pixelApprox"; x: number; y: number; rgb: RGB })
  | (Base & { kind: "regionColor"; rect: Rect; rgb: RGB })
  | (Base & { kind: "notUniform"; minVariance?: number })
  | (Base & { kind: "symmetric"; axis: Axis })
  | (Base & { kind: "gradient"; axis: Axis; dir: "up" | "down"; channel?: Channel; min?: number })
  /** No hard edges: every neighbouring pair of samples differs by at most `maxStep` luminance. */
  | (Base & { kind: "smooth"; maxStep?: number })
  /** A `cells`×`cells` mosaic: each cell is (nearly) one flat colour, and the cells differ. */
  | (Base & { kind: "cellsFlat"; cells: number; minVariance?: number })
  // ---- scene (scene-graph read-back) ----
  | (Base & { kind: "sceneHas"; type: string; min?: number; max?: number })
  | (Base & { kind: "objectAt"; position: Vec3; type?: string })
  | (Base & { kind: "geometryOf"; geometry: string; type?: string })
  | (Base & { kind: "materialOf"; material: string; type?: string })
  | (Base & { kind: "colorApprox"; rgb: RGB; type?: string })
  | (Base & { kind: "scaleApprox"; scale: Vec3; type?: string })
  | (Base & { kind: "instanced"; min: number })
  /** Some object (of `type`) has a geometry with at least `min` vertices. */
  | (Base & { kind: "verticesAtLeast"; min: number; type?: string })
  | (Base & { kind: "cameraPositioned"; position: Vec3 })
  | (Base & { kind: "rendersNonEmpty"; minVariance?: number });

type PixelSpec = Extract<
  ValidatorSpec,
  {
    kind:
      | "pixelApprox"
      | "regionColor"
      | "notUniform"
      | "symmetric"
      | "gradient"
      | "smooth"
      | "cellsFlat";
  }
>;
type SceneSpec = Extract<
  ValidatorSpec,
  {
    kind:
      | "sceneHas"
      | "objectAt"
      | "geometryOf"
      | "materialOf"
      | "colorApprox"
      | "scaleApprox"
      | "instanced"
      | "verticesAtLeast"
      | "cameraPositioned"
      | "rendersNonEmpty";
  }
>;

const ok: ValidationResult = { pass: true, message: "" };
const fail = (message: string): ValidationResult => ({ pass: false, message });

const COLOR_TOL = 0.12;
const POS_TOL = 0.4;

function dist3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pick(objects: SceneSnapshot["objects"], type?: string): SceneSnapshot["objects"] {
  return type ? objects.filter((o) => o.type === type) : objects;
}

function dispatchPixels(spec: PixelSpec, samples: readonly Sample[]): ValidationResult {
  switch (spec.kind) {
    case "pixelApprox": {
      const sample = nearestSample(samples, spec.x, spec.y);
      if (!sample) return fail("ピクセルを読み取れませんでした");
      const got = rgbOf(sample);
      return colorApprox(got, spec.rgb, spec.tol ?? COLOR_TOL)
        ? ok
        : fail(
            `${describePoint(spec.x, spec.y)}の色が目標と違います（目標: ${formatRgb(spec.rgb)} / いま: ${formatRgb(got)}）`,
          );
    }
    case "regionColor": {
      const avg = regionAverage(samples, spec.rect);
      if (!avg) return fail(`${describeRect(spec.rect)}の色を読み取れませんでした`);
      return colorApprox(avg, spec.rgb, spec.tol ?? COLOR_TOL)
        ? ok
        : fail(
            `${describeRect(spec.rect)}の色が目標と違います（目標: ${formatRgb(spec.rgb)} / いま: ${formatRgb(avg)}）`,
          );
    }
    case "notUniform":
      return luminanceVariance(samples) >= (spec.minVariance ?? 0.002)
        ? ok
        : fail("画面が単色になっています。座標で変化をつけましょう");
    case "symmetric":
      return symmetryError(samples, spec.axis) <= (spec.tol ?? 0.1)
        ? ok
        : fail(`${spec.axis === "x" ? "左右" : "上下"}が対称になっていません`);
    case "gradient": {
      const ch = spec.channel ?? "lum";
      const d = halfDelta(samples, spec.axis, ch);
      const min = spec.min ?? 0.1;
      const passed = spec.dir === "up" ? d >= min : d <= -min;
      return passed ? ok : fail(`${describeDirection(spec.axis, spec.dir, ch)}グラデーションになっていません`);
    }
    case "smooth":
      return maxNeighbourStep(samples) <= (spec.maxStep ?? 0.3)
        ? ok
        : fail("明るさが急に変わる場所があります。なめらかに変化させましょう");
    case "cellsFlat": {
      const { within, between } = cellSpread(samples, spec.cells);
      if (within > (spec.tol ?? 0.08)) {
        return fail(`1つのマスの中で色が変わっています。${spec.cells}×${spec.cells} のマスごとに1色で塗りましょう`);
      }
      return between >= (spec.minVariance ?? 0.01)
        ? ok
        : fail("マスごとの明るさが変わっていません。マスの番号を乱数に渡しましょう");
    }
  }
}

function dispatchScene(spec: SceneSpec, s: SceneSnapshot): ValidationResult {
  switch (spec.kind) {
    case "sceneHas": {
      const count = s.objects.filter((o) => o.type === spec.type).length;
      const min = spec.min ?? 1;
      if (count < min) return fail(`${spec.type} が ${min} 個以上必要です（現在 ${count}）`);
      if (spec.max !== undefined && count > spec.max) {
        return fail(`${spec.type} が多すぎます（最大 ${spec.max}、現在 ${count}）`);
      }
      return ok;
    }
    case "objectAt": {
      const hit = pick(s.objects, spec.type).some(
        (o) => dist3(o.position, spec.position) <= (spec.tol ?? POS_TOL),
      );
      return hit
        ? ok
        : fail(`(${spec.position.join(", ")}) 付近にオブジェクトを置きましょう`);
    }
    case "geometryOf":
      return pick(s.objects, spec.type).some((o) => o.geometry === spec.geometry)
        ? ok
        : fail(`${spec.geometry} のオブジェクトが見つかりません`);
    case "materialOf":
      return pick(s.objects, spec.type).some((o) => o.material === spec.material)
        ? ok
        : fail(`${spec.material} を使ったオブジェクトが見つかりません`);
    case "colorApprox":
      return pick(s.objects, spec.type).some(
        (o) => o.color !== null && colorApprox(o.color, spec.rgb, spec.tol ?? 0.15),
      )
        ? ok
        : fail(`目標の色のオブジェクトが見つかりません（目標: ${formatRgb(spec.rgb)}）`);
    case "scaleApprox":
      return pick(s.objects, spec.type).some((o) => dist3(o.scale, spec.scale) <= (spec.tol ?? 0.2))
        ? ok
        : fail(`大きさが ${formatVec3(spec.scale)} 倍のオブジェクトが見つかりません`);
    case "instanced": {
      const best = s.objects.reduce((m, o) => Math.max(m, o.instances ?? 0), 0);
      return best >= spec.min
        ? ok
        : fail(`${spec.min} 個以上を描く InstancedMesh が必要です（現在 ${best} 個）`);
    }
    case "verticesAtLeast": {
      const best = pick(s.objects, spec.type).reduce((m, o) => Math.max(m, o.vertices ?? 0), 0);
      return best >= spec.min
        ? ok
        : fail(`${spec.min} 個以上の点を持つ ${spec.type ?? "オブジェクト"} が必要です（現在 ${best} 個）`);
    }
    case "cameraPositioned": {
      if (!s.camera) return fail("カメラが見つかりません");
      return dist3(s.camera.position, spec.position) <= (spec.tol ?? 0.5)
        ? ok
        : fail(
            `カメラの位置が目標と違います（目標: ${formatVec3(spec.position)} / いま: ${formatVec3(s.camera.position)}）`,
          );
    }
    case "rendersNonEmpty": {
      if (!s.samples) return fail("描画結果が取得できていません");
      return luminanceVariance(s.samples) >= (spec.minVariance ?? 0.0005)
        ? ok
        : fail("画面に何も描画されていません");
    }
  }
}

function dispatch(spec: ValidatorSpec, s: Snapshot): ValidationResult {
  switch (spec.kind) {
    case "sourceMatches":
      return new RegExp(spec.pattern, spec.flags).test(s.source)
        ? ok
        : fail("コードに必要な記述が見つかりません");
    case "noError":
      return s.kind === "shader"
        ? s.compiled
          ? ok
          : fail(`エラー: ${s.log || "コンパイルに失敗しました"}`)
        : s.error === null
          ? ok
          : fail(`エラー: ${s.error}`);
    case "allOf": {
      for (const child of spec.of) {
        const res = runSpec(child, s);
        if (!res.pass) return res;
      }
      return ok;
    }
    case "anyOf": {
      for (const child of spec.of) {
        if (runSpec(child, s).pass) return ok;
      }
      return fail("条件のいずれも満たしていません");
    }
    case "compiles":
      if (s.kind !== "shader") return fail("このチェックはシェーダー課題用です");
      return s.compiled ? ok : fail(`シェーダーをコンパイルできません: ${s.log || "不明なエラー"}`);
    case "pixelApprox":
    case "regionColor":
    case "notUniform":
    case "symmetric":
    case "gradient":
    case "smooth":
    case "cellsFlat":
      return s.samples ? dispatchPixels(spec, s.samples) : fail("描画結果が取得できていません");
    default:
      return s.kind === "scene" ? dispatchScene(spec, s) : fail("このチェックは Three.js 課題用です");
  }
}

export function runSpec(spec: ValidatorSpec, s: Snapshot): ValidationResult {
  const res = dispatch(spec, s);
  if (!res.pass && spec.message) return fail(spec.message);
  return res;
}
