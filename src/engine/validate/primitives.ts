// Validators are serializable spec objects (a discriminated union), not opaque
// closures. A challenge composes them as data; `runSpec` interprets them against
// a Snapshot. Being plain data means the content layer can introspect them
// (e.g. content tests cross-check that a lesson's solution matches its own
// `sourceMatches` validators) and they stay trivially testable.
//
// Prefer OUTPUT validators (pixel colours / scene geometry — they accept any
// correct solution) and use `sourceMatches` only when a specific token is the
// lesson (e.g. "use smoothstep", "call new THREE.Mesh").

import { colorApprox } from "./color.js";
import {
  halfDelta,
  luminanceVariance,
  nearestSample,
  regionAverage,
  rgbOf,
  symmetryError,
  type Channel,
  type Rect,
} from "./sample.js";
import type {
  RGB,
  SceneSnapshot,
  ShaderSnapshot,
  Snapshot,
  ValidationResult,
  Vec3,
} from "./snapshot.js";

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
  // ---- shader (pixel read-back) ----
  | (Base & { kind: "compiles" })
  | (Base & { kind: "pixelApprox"; x: number; y: number; rgb: RGB })
  | (Base & { kind: "regionColor"; rect: Rect; rgb: RGB })
  | (Base & { kind: "notUniform"; minVariance?: number })
  | (Base & { kind: "symmetric"; axis: Axis })
  | (Base & { kind: "gradient"; axis: Axis; dir: "up" | "down"; channel?: Channel; min?: number })
  // ---- scene (scene-graph read-back) ----
  | (Base & { kind: "sceneHas"; type: string; min?: number; max?: number })
  | (Base & { kind: "objectAt"; position: Vec3; type?: string })
  | (Base & { kind: "geometryOf"; geometry: string; type?: string })
  | (Base & { kind: "materialOf"; material: string; type?: string })
  | (Base & { kind: "colorApprox"; rgb: RGB; type?: string })
  | (Base & { kind: "cameraPositioned"; position: Vec3 })
  | (Base & { kind: "rendersNonEmpty"; minVariance?: number });

type ShaderSpec = Extract<
  ValidatorSpec,
  { kind: "compiles" | "pixelApprox" | "regionColor" | "notUniform" | "symmetric" | "gradient" }
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

function dispatchShader(spec: ShaderSpec, s: ShaderSnapshot): ValidationResult {
  switch (spec.kind) {
    case "compiles":
      return s.compiled ? ok : fail(`シェーダーをコンパイルできません: ${s.log || "不明なエラー"}`);
    case "pixelApprox": {
      const sample = nearestSample(s.samples, spec.x, spec.y);
      if (!sample) return fail("ピクセルを読み取れませんでした");
      return colorApprox(rgbOf(sample), spec.rgb, spec.tol ?? COLOR_TOL)
        ? ok
        : fail(`座標 (${spec.x}, ${spec.y}) の色が想定と違います`);
    }
    case "regionColor": {
      const avg = regionAverage(s.samples, spec.rect);
      if (!avg) return fail("指定領域にピクセルがありません");
      return colorApprox(avg, spec.rgb, spec.tol ?? COLOR_TOL)
        ? ok
        : fail("指定領域の平均色が想定と違います");
    }
    case "notUniform":
      return luminanceVariance(s.samples) >= (spec.minVariance ?? 0.002)
        ? ok
        : fail("画面が単色になっています。座標で変化をつけましょう");
    case "symmetric":
      return symmetryError(s.samples, spec.axis) <= (spec.tol ?? 0.1)
        ? ok
        : fail(`${spec.axis === "x" ? "左右" : "上下"}が対称になっていません`);
    case "gradient": {
      const d = halfDelta(s.samples, spec.axis, spec.channel ?? "lum");
      const min = spec.min ?? 0.1;
      const passed = spec.dir === "up" ? d >= min : d <= -min;
      return passed ? ok : fail(`${spec.axis} 方向のグラデーションになっていません`);
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
        : fail("想定した色のオブジェクトが見つかりません");
    case "cameraPositioned": {
      if (!s.camera) return fail("カメラが見つかりません");
      return dist3(s.camera.position, spec.position) <= (spec.tol ?? 0.5)
        ? ok
        : fail("カメラの位置が想定と違います");
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
    case "pixelApprox":
    case "regionColor":
    case "notUniform":
    case "symmetric":
    case "gradient":
      return s.kind === "shader" ? dispatchShader(spec, s) : fail("このチェックはシェーダー課題用です");
    default:
      return s.kind === "scene" ? dispatchScene(spec, s) : fail("このチェックは Three.js 課題用です");
  }
}

export function runSpec(spec: ValidatorSpec, s: Snapshot): ValidationResult {
  const res = dispatch(spec, s);
  if (!res.pass && spec.message) return fail(spec.message);
  return res;
}
