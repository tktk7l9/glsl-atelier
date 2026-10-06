// The Three.js sandbox's scene runner without its DOM glue. It runs the
// learner's code against a fresh scene and camera sized to the canvas, renders
// one frame through the shared renderer, and reads it back for grading.
//
// Resizing a canvas clears it. The preview shows one rendered frame, not an
// animation loop, so after a window resize or a device rotation it would stay
// black until the next run. `resize` therefore redraws the last run: it builds
// the same code again at the new size, exactly as a run at that size would
// (so a lens change the learner never applied with updateProjectionMatrix()
// stays unapplied in the preview too), and renders it without a read-back.
//
// runner.ts wires this to the iframe's canvas, messages and resize events;
// scene-runner.test.ts drives it with the real `three` and a stand-in renderer.

import * as THREE from "three";
import type { SceneSnapshot } from "../engine/validate/snapshot.js";
import { toGridSamples } from "./sample-grid.js";
import { collectObjects } from "./scene-graph.js";

/** The part of THREE.WebGLRenderer the runner uses (and learner code may touch). */
export type SceneRenderer = Pick<
  THREE.WebGLRenderer,
  "domElement" | "shadowMap" | "setClearColor" | "setPixelRatio" | "setSize" | "render" | "getContext"
>;

export interface SceneRunner {
  /** Run learner code, render it, and read the frame back for the validators. */
  run(code: string): SceneSnapshot;
  /** Fit the canvas to `width`×`height` CSS pixels at `pixelRatio` (capped at
   *  2) and redraw the last run, which the resize would otherwise leave blank. */
  resize(width: number, height: number, pixelRatio: number): void;
}

/** The read-back grid sent to the validators (GRID×GRID samples). */
const GRID = 16;
const MAX_PIXEL_RATIO = 2;

interface Built {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly error: string | null;
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((o) => {
    const any = o as unknown as {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
    };
    any.geometry?.dispose?.();
    const m = any.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
    else m?.dispose?.();
  });
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function createSceneRunner(renderer: SceneRenderer): SceneRunner {
  /** The code of the last completed run: what the preview is showing. */
  let lastCode: string | null = null;
  let fitted = { width: 0, height: 0, ratio: 0 };

  /** The renderer is shared by every run, but learner code may flip its
   *  switches (shadow maps, clear colour); put them back so one run cannot
   *  leak into the next and a lesson is judged on its own code. */
  function resetRenderer(): void {
    renderer.setClearColor(0x05060d, 1);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  resetRenderer();

  /** Build the learner's scene with a fresh camera that fits the canvas. */
  function build(code: string): Built {
    const { width, height } = renderer.domElement;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height || 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    resetRenderer();
    let error: string | null = null;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("THREE", "scene", "camera", "renderer", code);
      fn(THREE, scene, camera, renderer);
    } catch (e) {
      error = errorText(e);
    }
    return { scene, camera, error };
  }

  function run(code: string): SceneSnapshot {
    const { scene, camera, error: thrown } = build(code);
    let error = thrown;
    const objects = collectObjects(scene);
    const { width, height } = renderer.domElement;
    let samples;
    try {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      samples = toGridSamples(pixels, width, height, GRID);
    } catch (e) {
      if (!error) error = errorText(e);
    }
    disposeScene(scene);
    lastCode = code;
    return {
      kind: "scene",
      error,
      source: code,
      objects,
      camera: {
        type: camera.type,
        position: [camera.position.x, camera.position.y, camera.position.z],
      },
      samples,
    };
  }

  /** Draw the last run again at the canvas's current size (no read-back). */
  function redraw(code: string): void {
    const { scene, camera } = build(code);
    try {
      renderer.render(scene, camera);
    } catch {
      // The run itself reported this error; a redraw has no one to tell.
    }
    disposeScene(scene);
  }

  function resize(width: number, height: number, pixelRatio: number): void {
    const ratio = Math.min(pixelRatio, MAX_PIXEL_RATIO);
    // Setting a canvas's size clears it even when the size is unchanged, so
    // leave an already fitted canvas alone.
    if (width === fitted.width && height === fitted.height && ratio === fitted.ratio) return;
    fitted = { width, height, ratio };
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    if (lastCode !== null) redraw(lastCode);
  }

  return { run, resize };
}
