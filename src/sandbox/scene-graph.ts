// Turn a Three.js scene graph into the serializable SceneObject[] the pure
// validators consume. Duck-typed on purpose: it needs no Three.js import, so it
// runs both inside the sandbox iframe (bundled with the runner) and in Node
// tests that execute lesson code against the installed `three` package.

import type { SceneObject } from "../engine/validate/snapshot.js";

interface MaterialLike {
  type?: string;
  color?: { getHexString(): string };
}

interface Object3DLike {
  name: string;
  uuid: string;
  type: string;
  visible: boolean;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  geometry?: { type?: string; attributes?: { position?: { count?: number } } };
  material?: MaterialLike | MaterialLike[];
  isInstancedMesh?: boolean;
  count?: number;
  traverse(cb: (o: Object3DLike) => void): void;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Every descendant of `scene` (not the scene itself) as plain data. */
export function collectObjects(scene: Object3DLike): SceneObject[] {
  const objects: SceneObject[] = [];
  scene.traverse((obj) => {
    if (obj === scene) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const colorObj = mat && "color" in mat ? mat.color : undefined;
    const vertices = obj.geometry?.attributes?.position?.count;
    const base: SceneObject = {
      id: obj.name || obj.uuid.slice(0, 8),
      type: obj.type,
      geometry: obj.geometry?.type ?? null,
      material: mat?.type ?? null,
      color: colorObj ? hexToRgb(colorObj.getHexString()) : null,
      position: [obj.position.x, obj.position.y, obj.position.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      visible: obj.visible,
      // The vertex count lets a validator ask for a polyline through every point.
      ...(vertices === undefined ? {} : { vertices }),
    };
    objects.push(obj.isInstancedMesh ? { ...base, instances: obj.count } : base);
  });
  return objects;
}
