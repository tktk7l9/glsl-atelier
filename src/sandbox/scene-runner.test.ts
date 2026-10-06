// The sandbox's scene runner, driven with the real `three` and a stand-in for
// WebGLRenderer that records what it was asked to draw. The point under test is
// the preview after a resize: resizing clears the canvas, so the runner must
// draw the last run again (at the new size) instead of leaving it black.

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createSceneRunner, type SceneRenderer } from "./scene-runner.js";

interface Draw {
  readonly meshes: number;
  readonly aspect: number;
  /** The projection the frame was drawn with (elements[5] = 1 / tan(fov / 2)). */
  readonly projection: readonly number[];
  readonly shadows: boolean;
  readonly canvas: readonly [number, number];
}

function fakeRenderer(width = 300, height = 300) {
  const draws: Draw[] = [];
  const disposed: string[] = [];
  let pixelRatio = 1;
  let sizeCalls = 0;
  const domElement = { width, height };
  const renderer = {
    domElement,
    shadowMap: { enabled: false, type: THREE.PCFShadowMap as THREE.ShadowMapType },
    clear: [0, 0] as [number, number],
    setClearColor(color: number, alpha: number) {
      renderer.clear = [color, alpha];
    },
    setPixelRatio(r: number) {
      pixelRatio = r;
    },
    setSize(w: number, h: number) {
      sizeCalls++;
      domElement.width = Math.floor(w * pixelRatio);
      domElement.height = Math.floor(h * pixelRatio);
    },
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      let meshes = 0;
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          meshes++;
          o.geometry.addEventListener("dispose", () => disposed.push(o.name));
        }
      });
      draws.push({
        meshes,
        aspect: camera.aspect,
        projection: [...camera.projectionMatrix.elements],
        shadows: renderer.shadowMap.enabled,
        canvas: [domElement.width, domElement.height],
      });
    },
    getContext() {
      return {
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        // A uniform orange frame.
        readPixels(_x: number, _y: number, w: number, h: number, _f: number, _t: number, out: Uint8Array) {
          for (let i = 0; i < w * h; i++) out.set([255, 128, 0, 255], i * 4);
        },
      };
    },
  };
  return {
    renderer,
    draws,
    disposed,
    sizeCalls: () => sizeCalls,
    runner: createSceneRunner(renderer as unknown as SceneRenderer),
  };
}

const CUBE =
  "const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 'orange' }));\n" +
  "cube.name = 'cube';\n" +
  "scene.add(cube);\n";

describe("createSceneRunner: a run", () => {
  it("renders once with a camera that fits the canvas and reads the frame back", () => {
    const { runner, draws } = fakeRenderer(400, 200);
    const snap = runner.run(CUBE);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ meshes: 1, aspect: 2, canvas: [400, 200] });
    expect(snap).toMatchObject({ kind: "scene", error: null, source: CUBE });
    expect(snap.objects.map((o) => o.type)).toEqual(["Mesh"]);
    expect(snap.camera).toEqual({ type: "PerspectiveCamera", position: [0, 0, 5] });
    expect(snap.samples).toHaveLength(16 * 16);
    expect(snap.samples?.[0].rgba).toEqual([1, 128 / 255, 0, 1]);
  });

  it("reports a thrown error, keeps what was built, and disposes the scene after drawing", () => {
    const { runner, draws, disposed } = fakeRenderer();
    const snap = runner.run(`${CUBE}boom();\n`);
    expect(snap.error).toMatch(/boom/);
    expect(snap.objects).toHaveLength(1);
    expect(draws[0].meshes).toBe(1);
    expect(disposed).toEqual(["cube"]);
  });

  it("reports a renderer failure as the run's error, unless the code already failed", () => {
    const { runner, renderer } = fakeRenderer();
    renderer.render = () => {
      throw new Error("context lost");
    };
    expect(runner.run(CUBE)).toMatchObject({ error: "context lost", samples: undefined });
    expect(runner.run("throw 'own';").error).toBe("own");
  });

  it("disposes every material of a multi-material mesh and skips lights and groups", () => {
    const { runner } = fakeRenderer();
    const freed: string[] = [];
    const scope = globalThis as { __freed?: string[] };
    scope.__freed = freed;
    const snap = runner.run(
      "scene.add(new THREE.Group(), new THREE.AmbientLight());\n" +
        "const mats = [new THREE.MeshBasicMaterial(), new THREE.MeshNormalMaterial()];\n" +
        "mats.forEach((m) => m.addEventListener('dispose', () => globalThis.__freed.push(m.type)));\n" +
        "scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mats));\n",
    );
    delete scope.__freed;
    expect(snap.objects.map((o) => o.type)).toEqual(["Group", "AmbientLight", "Mesh"]);
    expect(freed).toEqual(["MeshBasicMaterial", "MeshNormalMaterial"]);
  });

  it("falls back to a square camera on a canvas that has no size yet", () => {
    const { runner, draws } = fakeRenderer(0, 0);
    runner.run(CUBE);
    expect(draws[0].aspect).toBe(1);
  });

  it("puts back the renderer switches learner code may flip", () => {
    const { runner, renderer, draws } = fakeRenderer();
    runner.run(`${CUBE}renderer.shadowMap.enabled = true;\nrenderer.setClearColor(0xffffff, 1);\n`);
    expect(draws[0].shadows).toBe(true);
    runner.run(CUBE);
    expect(draws[1].shadows).toBe(false);
    expect(renderer.clear).toEqual([0x05060d, 1]);
  });
});

describe("createSceneRunner: resizing the preview", () => {
  it("only fits the canvas while nothing has run yet", () => {
    const { runner, draws, renderer } = fakeRenderer();
    runner.resize(500, 250, 1);
    expect(renderer.domElement).toEqual({ width: 500, height: 250 });
    expect(draws).toHaveLength(0);
  });

  it("redraws the last run at the new size, so the preview does not stay black", () => {
    const { runner, draws } = fakeRenderer();
    runner.resize(300, 300, 1);
    runner.run(CUBE);
    // The preview switches from 1:1 to 16:9 (a narrow window, a rotated phone).
    runner.resize(320, 180, 2);
    expect(draws).toHaveLength(2);
    expect(draws[1]).toMatchObject({ meshes: 1, canvas: [640, 360] });
    expect(draws[1].aspect).toBeCloseTo(16 / 9, 6);
  });

  it("caps the pixel ratio at 2", () => {
    const { runner, renderer } = fakeRenderer();
    runner.resize(100, 50, 3);
    expect(renderer.domElement).toEqual({ width: 200, height: 100 });
  });

  it("leaves a canvas that already fits alone (resizing would clear it)", () => {
    const { runner, draws, sizeCalls } = fakeRenderer();
    runner.resize(300, 300, 1);
    runner.run(CUBE);
    const before = sizeCalls();
    runner.resize(300, 300, 1);
    expect(sizeCalls()).toBe(before);
    expect(draws).toHaveLength(1);
    // A new pixel ratio alone (browser zoom, another screen) does refit.
    runner.resize(300, 300, 2);
    expect(draws).toHaveLength(2);
    expect(draws[1].canvas).toEqual([600, 600]);
  });

  it("draws exactly what a run at that size would: an unapplied lens change stays unapplied", () => {
    // fov is set but updateProjectionMatrix() is never called; the graded frame
    // keeps the 60° lens, and so must the redrawn preview.
    const code = `${CUBE}camera.fov = 30;\n`;
    const { runner, draws } = fakeRenderer();
    runner.resize(300, 300, 1);
    runner.run(code);
    runner.resize(320, 180, 1);
    const reference = fakeRenderer(320, 180);
    reference.runner.run(code);
    expect(draws[1].projection).toEqual(reference.draws[0].projection);
    expect(draws[1].projection[5]).toBeCloseTo(1 / Math.tan(Math.PI / 6), 6);
  });

  it("redraws the scene of the latest run, with the renderer switches that run set", () => {
    const { runner, draws } = fakeRenderer();
    runner.resize(300, 300, 1);
    runner.run(CUBE);
    runner.run(`${CUBE}scene.add(cube.clone());\nrenderer.shadowMap.enabled = true;\n`);
    runner.resize(200, 200, 1);
    expect(draws.at(-1)).toMatchObject({ meshes: 2, shadows: true });
  });

  it("disposes a redrawn scene and survives a renderer failure while redrawing", () => {
    const { runner, renderer, disposed, draws } = fakeRenderer();
    runner.resize(300, 300, 1);
    runner.run(CUBE);
    runner.resize(200, 200, 1);
    expect(disposed).toEqual(["cube", "cube"]);
    renderer.render = () => {
      throw new Error("context lost");
    };
    expect(() => runner.resize(100, 100, 1)).not.toThrow();
    expect(draws).toHaveLength(2);
  });
});
