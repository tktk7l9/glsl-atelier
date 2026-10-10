import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { collectObjects, hexToRgb } from "./scene-graph.js";

describe("hexToRgb", () => {
  it("splits a 6-digit hex string into 0..1 channels", () => {
    expect(hexToRgb("ff0000")).toEqual([1, 0, 0]);
    expect(hexToRgb("00ff80")[2]).toBeCloseTo(128 / 255, 6);
  });
});

describe("collectObjects (against the installed three)", () => {
  it("walks nested objects, skipping the scene itself", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.name = "rig";
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "red" }),
    );
    cube.position.set(1, 2, 3);
    cube.scale.setScalar(2);
    group.add(cube);
    scene.add(group, new THREE.AmbientLight(0xffffff, 1));

    const objs = collectObjects(scene);
    expect(objs.map((o) => o.type)).toEqual(["Group", "Mesh", "AmbientLight"]);
    expect(objs[0].id).toBe("rig");
    expect(objs[0].geometry).toBeNull();
    expect(objs[0].material).toBeNull();
    expect(objs[1]).toMatchObject({
      geometry: "BoxGeometry",
      material: "MeshStandardMaterial",
      color: [1, 0, 0],
      position: [1, 2, 3],
      scale: [2, 2, 2],
      visible: true,
    });
    expect(objs[1].id).toHaveLength(8);
    expect(objs[1].instances).toBeUndefined();
    // Lights have a colour property but no material; the snapshot reports null.
    expect(objs[2].color).toBeNull();
  });

  it("reads the first material of a multi-material mesh", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshBasicMaterial({ color: "blue" }),
      new THREE.MeshNormalMaterial(),
    ]);
    scene.add(mesh);
    const [o] = collectObjects(scene);
    expect(o.material).toBe("MeshBasicMaterial");
    expect(o.color).toEqual([0, 0, 1]);
  });

  it("reports materials without a colour (ShaderMaterial) as colour null", () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(), new THREE.ShaderMaterial()));
    expect(collectObjects(scene)[0]).toMatchObject({ material: "ShaderMaterial", color: null });
  });

  it("reports the instance count of an InstancedMesh (whose type is still 'Mesh')", () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 7));
    expect(collectObjects(scene)[0]).toMatchObject({ type: "Mesh", instances: 7 });
  });

  it("reports the vertex count of a geometry, and none for an object without one", () => {
    const scene = new THREE.Scene();
    const points = [0, 1, 2, 3, 4, 5].map((i) => new THREE.Vector3(i, 0, 0));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial()));
    scene.add(new THREE.Group(), new THREE.Sprite(new THREE.SpriteMaterial()));
    const [line, group, sprite] = collectObjects(scene);
    expect(line).toMatchObject({ type: "Line", geometry: "BufferGeometry", vertices: 6 });
    expect(group.vertices).toBeUndefined();
    // A sprite is drawn from the quad three shares between all sprites.
    expect(sprite).toMatchObject({ type: "Sprite", material: "SpriteMaterial", vertices: 4 });
  });
});
