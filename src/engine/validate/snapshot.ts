// The Snapshot is the I/O boundary between the impure runtimes (the WebGL shader
// runtime that reads back pixels, and the Three.js scene sandbox that reads back
// the scene graph) and the pure validators. Everything below is plain,
// serializable data so the validation logic runs deterministically in Node and
// stays 100% testable.

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];
export type Vec3 = readonly [number, number, number];

/** One read-back pixel. x,y are normalized 0..1 (origin bottom-left, GL style);
 *  each rgba channel is 0..1. */
export interface Sample {
  readonly x: number;
  readonly y: number;
  readonly rgba: RGBA;
}

/** Result of compiling + rendering a learner's fragment shader at a fixed time. */
export interface ShaderSnapshot {
  readonly kind: "shader";
  readonly compiled: boolean;
  readonly log: string;
  readonly resolution: { readonly w: number; readonly h: number };
  readonly time: number;
  /** Raw user GLSL (for `sourceMatches` structural checks). */
  readonly source: string;
  /** A fixed grid of read-back pixels. */
  readonly samples: readonly Sample[];
}

/** One object discovered while traversing the learner's Three.js scene. */
export interface SceneObject {
  readonly id: string;
  /** Three's object.type, e.g. "Mesh" | "PointLight" | "Group". */
  readonly type: string;
  /** geometry.type if any, e.g. "BoxGeometry". */
  readonly geometry: string | null;
  /** material.type if any, e.g. "MeshStandardMaterial". */
  readonly material: string | null;
  /** material colour as sRGB 0..1, if the material has one. */
  readonly color: RGB | null;
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly visible: boolean;
}

/** Result of running a learner's Three.js scene code in the sandbox. */
export interface SceneSnapshot {
  readonly kind: "scene";
  /** A runtime error message thrown by the learner's code, else null. */
  readonly error: string | null;
  /** Raw user JS (for `sourceMatches` structural checks). */
  readonly source: string;
  readonly objects: readonly SceneObject[];
  readonly camera: { readonly type: string; readonly position: Vec3 } | null;
  /** Optional read-back pixels of the rendered frame (for `rendersNonEmpty`). */
  readonly samples?: readonly Sample[];
}

export type Snapshot = ShaderSnapshot | SceneSnapshot;

export interface ValidationResult {
  readonly pass: boolean;
  readonly message: string;
}
