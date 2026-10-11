// The three-transform track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND, NORMAL_COLOURED } from "./shared-three.js";

/** The per-instance colour lesson: the ladder of the InstancedMesh lesson,
 *  white, with `paint` inside the loop that places the rungs. */
const RAINBOW_LADDER = (paint: string): string =>
  "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
  "const mat = new THREE.MeshBasicMaterial({ color: 'white' });  // コピーの色はこの白に掛けられる\n" +
  "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
  "scene.add(rungs);\n\n" +
  "// 下から順に塗りたい色\n" +
  "const colors = ['tomato', 'gold', 'limegreen', 'deepskyblue', 'mediumpurple'];\n\n" +
  "const m = new THREE.Matrix4();\n" +
  "for (let i = 0; i < 5; i++) {\n" +
  "  m.setPosition(0, i - 2, 0);\n" +
  "  rungs.setMatrixAt(i, m);\n" +
  paint +
  "}\n";

/** The rungs' colours as drawn (sRGB), bottom to top. */
const RAINBOW: ReadonlyArray<[number, number, number]> = [
  [1, 0.39, 0.28],
  [1, 0.84, 0],
  [0.2, 0.8, 0.2],
  [0, 0.75, 1],
  [0.58, 0.44, 0.86],
];

/** The lookAt lesson: a target up high and an arrow whose tip points along
 *  +Z. Both sit 0.25 left of centre, because the read-back column nearest
 *  x = 0.5 lies 0.06 of the width left of it (0.18 world units at 1:1, 0.32
 *  at 16:9), and the arrow's tip is narrow. */
const ARROW_SCENE =
  "// 的（まと）: 上のほうの金色の玉\n" +
  "const target = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.35, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
  ");\n" +
  "target.position.set(-0.25, 2.3, 0);\n" +
  "scene.add(target);\n\n" +
  "// 矢印（円すい）。先端が +Z（手前）を向くように作ってある\n" +
  "const geo = new THREE.ConeGeometry(0.8, 3, 32);\n" +
  "geo.rotateX(Math.PI / 2);\n" +
  "const arrow = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" +
  "arrow.position.x = -0.25;\n" +
  "scene.add(arrow);\n";

export const track: Track = {
  id: "three-transform",
  domain: "three",
  title: "変形とグループ",
  summary: "拡大縮小、Group でまとめる、親子でくっつけて動かす、InstancedMesh で同じ形をたくさん描いて 1つずつ色を変える。",
  icon: "🔧",
  lessons: [
    {
      id: "three-scale",
      title: "拡大する: scale",
      explanation: "<p><code>scale</code> は各軸の倍率。<code>mesh.scale.set(2, 2, 2)</code> で2倍の大きさになります。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n\n" +
          "// 立方体を2倍に大きくしよう\n",
        task: "立方体を全方向に2倍へ拡大しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "scale" },
          { kind: "sceneHas", type: "Mesh" },
          { kind: "scaleApprox", scale: [2, 2, 2], type: "Mesh" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["cube.scale.set(2, 2, 2);", "1.0 が等倍、2.0 で2倍"],
        solution:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n" +
          "cube.scale.set(2, 2, 2);\n",
      },
    },
    {
      id: "three-group",
      title: "まとめる: Group",
      explanation:
        "<p><code>Group</code> は複数オブジェクトの入れ物。Group を動かすと中身がまとめて動きます。</p>",
      challenge: {
        starterCode:
          "// Group を作り、2つの立方体を入れて scene に追加しよう\n" +
          "const group = new THREE.Group();\n\n",
        task: "Group の中に Mesh を2つ入れて scene に追加しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "Group" },
          { kind: "sceneHas", type: "Group" },
          { kind: "sceneHas", type: "Mesh", min: 2 },
          { kind: "rendersNonEmpty" },
        ],
        hints: [
          "const a = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshNormalMaterial());",
          "group.add(a, b); scene.add(group);",
        ],
        solution:
          "const group = new THREE.Group();\n" +
          "const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());\n" +
          "const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());\n" +
          "a.position.x = -1;\n" +
          "b.position.x = 1;\n" +
          "group.add(a, b);\n" +
          "scene.add(group);\n",
      },
    },
    {
      id: "three-hierarchy",
      title: "親子関係: 親を回すと子もついてくる",
      explanation:
        "<p><code>parent.add(child)</code> で、オブジェクトを別のオブジェクトの<b>子</b>にできます。子の " +
        "<code>position</code> は親から見た位置（ローカル座標）になり、親を動かす・回す・拡大すると、子もいっしょに" +
        "動きます。惑星の公転や腕と手のように、何かに<b>くっついて動く</b>ものを作るときの基本です。</p>",
      challenge: {
        starterCode:
          "// 中心の太陽\n" +
          "const sun = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(0.6, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
          ");\n" +
          "scene.add(sun);\n\n" +
          "// 惑星（太陽から見て右へ 2）\n" +
          "const planet = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'deepskyblue' }),\n" +
          ");\n" +
          "planet.position.x = 2;\n" +
          "scene.add(planet);\n\n" +
          "// 太陽を z 軸まわりに 90° 回す（いまは惑星がついてこない）\n" +
          "sun.rotation.z = Math.PI / 2;\n",
        task: "planet を scene ではなく sun に add して太陽の子にし、太陽の回転で惑星を真上へ運ぼう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "sun\\.add\\s*\\(" },
          { kind: "sceneHas", type: "Mesh", min: 2 },
          // The sun stays in the middle; the planet now sits right above it.
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.84, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [0, 0.75, 1], tol: 0.15 },
        ],
        hints: [
          "sun.add(planet);  // scene.add(planet) の代わりに",
          "子の position (2, 0, 0) は太陽から見た位置。太陽が 90° 回ると、真上の (0, 2, 0) に来ます",
        ],
        solution:
          "const sun = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(0.6, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
          ");\n" +
          "scene.add(sun);\n" +
          "const planet = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'deepskyblue' }),\n" +
          ");\n" +
          "planet.position.x = 2;\n" +
          "sun.add(planet);\n" +
          "sun.rotation.z = Math.PI / 2;\n",
      },
    },
    {
      id: "three-look-at",
      title: "的を向く: lookAt",
      explanation:
        "<p>カメラだけでなく、どのオブジェクトも <code>lookAt(x, y, z)</code>（または <code>lookAt(Vector3)</code>）で<b>その点のほうを向かせる</b>" +
        "ことができます。回転の角度を自分で計算しなくても、向きたい位置を渡すだけです。向くのはオブジェクトの <b>+Z 軸</b>なので、" +
        "矢印や目のような「先」のある形は、先端が +Z を向くように作っておきます（この円すいは <code>geo.rotateX</code> でそうしてあります）。" +
        "渡すのは<b>位置</b>（<code>target.position</code>）で、オブジェクトそのものではありません。</p>",
      challenge: {
        starterCode: ARROW_SCENE + "\n// ここで、矢印の先端を的のほうへ向けよう\n",
        task: "arrow.lookAt に的の位置 target.position を渡して、矢印の先端を的に向けよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "lookAt" },
          { kind: "sceneHas", type: "Mesh", min: 2 },
          // With the tip pointing up, the arrow's body crosses the centre
          // line at 0.66 of the height (normal-coloured: 0.5 from mid-grey,
          // while the background is 0.83 away); pointing at the camera it
          // shows only its base, which ends at 0.6, and pointing down it is
          // below the middle. lookAt(target) with the object itself leaves
          // the matrix NaN and nothing is drawn.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: NORMAL_COLOURED,
            tol: 0.55,
            message: "矢印が的のほうを向いていません。arrow.lookAt(target.position) で、的の位置（オブジェクトではなく position）を渡しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.91, rgb: [1, 0.84, 0], tol: 0.15 },
        ],
        hints: [
          "arrow.lookAt(target.position);",
          "lookAt(target) とオブジェクトを渡すと、位置が読めずに矢印が消えてしまいます",
        ],
        solution: ARROW_SCENE + "arrow.lookAt(target.position);  // 先端（+Z）を的の位置に向ける\n",
      },
    },
    {
      id: "three-instanced",
      title: "大量に並べる: InstancedMesh",
      explanation:
        "<p>同じ形を何百個も置くなら、Mesh を増やすより <code>InstancedMesh(geo, mat, 個数)</code> が" +
        "軽くて速い（1回の描画命令でまとめて描く）。各コピーの位置・回転・大きさは " +
        "<code>Matrix4</code> で表し、<code>setMatrixAt(番号, 行列)</code> で渡します。" +
        "<code>m.setPosition(x, y, z)</code> で行列の位置だけを書き換えられます。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n\n" +
          "// 同じ板を 5枚まとめて描く InstancedMesh（いまは 5枚とも原点に重なっている）\n" +
          "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
          "scene.add(rungs);\n\n" +
          "const m = new THREE.Matrix4();\n" +
          "for (let i = 0; i < 5; i++) {\n" +
          "  // i 番目の板を y = i - 2 の高さに置こう\n" +
          "}\n",
        task: "ループの中で i 番目の板を y = i - 2 の高さに置いて、はしごのように 5枚並べよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "setMatrixAt" },
          { kind: "instanced", min: 5 },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.65, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.66, rgb: [1, 0.65, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: [1, 0.65, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [1, 0.65, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: [1, 0.65, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: BACKGROUND, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: ["m.setPosition(0, i - 2, 0);", "rungs.setMatrixAt(i, m);"],
        solution:
          "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n" +
          "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
          "scene.add(rungs);\n" +
          "const m = new THREE.Matrix4();\n" +
          "for (let i = 0; i < 5; i++) {\n" +
          "  m.setPosition(0, i - 2, 0);\n" +
          "  rungs.setMatrixAt(i, m);\n" +
          "}\n",
      },
    },
    {
      id: "three-instance-color",
      title: "1つずつ色を変える: setColorAt",
      explanation:
        "<p><code>InstancedMesh</code> のコピーはみな同じマテリアルで描かれますが、<b>色だけはコピーごとに</b>変えられます。" +
        "<code>setColorAt(番号, 色)</code> に <code>THREE.Color</code> を渡すと、その番号のコピーは、マテリアルの色にその色を掛けた色で描かれます" +
        "（だからマテリアルは白にしておきます）。パーティクルやグラフの棒を色分けするときの定番です。" +
        "なお、一度描いたあとで色を変えたときは <code>instanceColor.needsUpdate = true</code> で知らせます。</p>",
      challenge: {
        starterCode: RAINBOW_LADDER("  // ここで、i 番目の板の色を colors[i] にしよう\n"),
        task: "ループの中で setColorAt を使い、i 番目の板を colors[i] の色にして、はしごを下から虹色に塗り分けよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "setColorAt" },
          { kind: "instanced", min: 5 },
          // Every rung in its own colour, bottom to top, up the centre line.
          {
            kind: "allOf",
            of: [0.16, 0.34, 0.5, 0.66, 0.84].map((y, i) => ({
              kind: "pixelApprox" as const,
              x: 0.5,
              y,
              rgb: RAINBOW[i],
              tol: 0.15,
            })),
            message: "板の色が colors の順になっていません。ループの中で rungs.setColorAt(i, new THREE.Color(colors[i])) としましょう",
          },
        ],
        hints: [
          "rungs.setColorAt(i, new THREE.Color(colors[i]));",
          "material.color を変えると、5枚とも同じ色になってしまいます",
        ],
        solution: RAINBOW_LADDER("  rungs.setColorAt(i, new THREE.Color(colors[i]));  // i 番目のコピーの色\n"),
      },
    },
  ],
};
