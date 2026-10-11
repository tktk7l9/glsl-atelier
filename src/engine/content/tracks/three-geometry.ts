// The three-geometry track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

export const track: Track = {
  id: "three-geometry",
  domain: "three",
  title: "ジオメトリ",
  summary: "箱・球・トーラス・平面。形を差し替えて遊ぶ。",
  icon: "📐",
  lessons: [
    {
      id: "three-sphere",
      title: "球: SphereGeometry",
      explanation:
        "<p>形はジオメトリを差し替えるだけで変わります。<code>SphereGeometry(半径, 経度分割, 緯度分割)</code> で球になります。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
        task: "BoxGeometry を SphereGeometry に変えよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "SphereGeometry" },
          { kind: "geometryOf", geometry: "SphereGeometry" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["const geo = new THREE.SphereGeometry(1, 32, 16);", "分割数を増やすと滑らかに"],
        solution:
          "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
      },
    },
    {
      id: "three-torus",
      title: "ドーナツ: TorusGeometry",
      explanation: "<p><code>TorusGeometry(半径, 太さ, ...)</code> でドーナツ形（トーラス）になります。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
        task: "ジオメトリを TorusGeometry に変えよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "TorusGeometry" },
          { kind: "geometryOf", geometry: "TorusGeometry" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 80);", "第2引数が管の太さ"],
        solution:
          "const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 80);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
      },
    },
    {
      id: "three-plane",
      title: "平面: PlaneGeometry",
      explanation: "<p><code>PlaneGeometry(幅, 高さ)</code> は平らな板です。床や壁、背景に使います。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
        task: "ジオメトリを 2×2 の PlaneGeometry に変えよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "PlaneGeometry" },
          { kind: "geometryOf", geometry: "PlaneGeometry" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["const geo = new THREE.PlaneGeometry(2, 2);", "カメラの方を向いた板になります"],
        solution:
          "const geo = new THREE.PlaneGeometry(2, 2);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const mesh = new THREE.Mesh(geo, mat);\n" +
          "scene.add(mesh);\n",
      },
    },
  ],
};
