// The three-camera track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The raycasting lesson: a big ball and a marker hidden at its centre. */
const RAYCAST_SCENE =
  "// 大きな球（面の向きで色が変わる）\n" +
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.5, 64, 32),\n" +
  "  new THREE.MeshNormalMaterial(),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "// 目印の金色の玉（いまは球の中心に隠れている）\n" +
  "const marker = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.35, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
  ");\n" +
  "scene.add(marker);\n\n" +
  "// 画面の中心から少し上の点（中心が (0, 0)、端が ±1 の座標）\n" +
  "const pointer = new THREE.Vector2(0, 0.4);\n" +
  "const raycaster = new THREE.Raycaster();\n";

export const track: Track = {
  id: "three-camera",
  domain: "three",
  title: "カメラ",
  summary: "カメラの位置・向き・視野角で見え方を変え、カメラから光線を飛ばして指した場所を調べる。",
  icon: "🎥",
  lessons: [
    {
      id: "three-camera-back",
      title: "カメラを引く",
      explanation:
        "<p>カメラも <code>position</code> を持ちます。<code>z</code> を大きくすると後ろに下がり、" +
        "オブジェクトが小さく見えます。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n\n" +
          "// カメラを後ろに引いて、立方体を小さく見せよう\n",
        task: "カメラを z = 8 まで引こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "camera\\.position" },
          { kind: "cameraPositioned", position: [0, 0, 8] },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["camera.position.z = 8;", "数値が大きいほど遠ざかります"],
        solution:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n" +
          "camera.position.z = 8;\n",
      },
    },
    {
      id: "three-camera-angle",
      title: "見下ろす: lookAt",
      explanation:
        "<p>カメラを斜めに置き、<code>camera.lookAt(0, 0, 0)</code> で原点を向かせると、" +
        "立体を斜め上から見下ろせます。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n\n" +
          "// カメラを斜め上に置き、原点を向かせよう\n",
        task: "カメラを (4, 4, 4) に置き、原点を lookAt しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "lookAt" },
          { kind: "cameraPositioned", position: [4, 4, 4] },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["camera.position.set(4, 4, 4);", "camera.lookAt(0, 0, 0);"],
        solution:
          "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n" +
          "camera.position.set(4, 4, 4);\n" +
          "camera.lookAt(0, 0, 0);\n",
      },
    },
    {
      id: "three-camera-fov",
      title: "ズーム: fov と updateProjectionMatrix",
      explanation:
        "<p><code>PerspectiveCamera</code> の <code>fov</code> は縦方向の<b>視野角</b>（度）です。小さくすると望遠レンズの" +
        "ように狭い範囲が大きく写り、大きくすると広角になります（ここでの <code>camera</code> は最初 60°）。" +
        "ただし <code>fov</code> などのレンズの設定は、変えたあとに <code>camera.updateProjectionMatrix()</code> を" +
        "呼ぶまで描画に反映されません。</p>",
      challenge: {
        starterCode:
          "const ball = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(1, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'tomato' }),\n" +
          ");\n" +
          "scene.add(ball);\n\n" +
          "// 視野角 fov を 60° から 30° に狭めて、球を望遠で大きく写そう\n",
        task: "camera.fov を 30 にして設定を反映させ（updateProjectionMatrix）、球を大きく写そう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "\\.fov\\s*=",
            message: "camera.fov に新しい視野角（30）を代入しましょう",
          },
          {
            kind: "sourceMatches",
            pattern: "updateProjectionMatrix",
            message: "camera.updateProjectionMatrix() を呼んで、fov の変更を反映させましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.39, 0.28], tol: 0.15 },
          // At 60° the ball spans 0.32–0.68 of the height; at 30° it reaches 0.12–0.88.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.22,
            rgb: [1, 0.39, 0.28],
            tol: 0.15,
            message: "球が大きく写っていません。fov を変えたら camera.updateProjectionMatrix() を呼びましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: [1, 0.39, 0.28], tol: 0.15 },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.03,
            rgb: BACKGROUND,
            tol: 0.15,
            message: "寄りすぎて球が画面からはみ出しています。fov は 30 にしましょう",
          },
        ],
        hints: [
          "camera.fov = 30;",
          "camera.updateProjectionMatrix();  // 変更を反映",
        ],
        solution:
          "const ball = new THREE.Mesh(\n" +
          "  new THREE.SphereGeometry(1, 32, 16),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'tomato' }),\n" +
          ");\n" +
          "scene.add(ball);\n" +
          "camera.fov = 30;\n" +
          "camera.updateProjectionMatrix();\n",
      },
    },
    {
      id: "three-raycast",
      title: "指した場所を調べる: Raycaster",
      explanation:
        "<p>画面のどこを指しているかを 3D で調べるには、カメラから画面の 1点に向けて<b>光線（レイ）</b>を飛ばし、何に当たるかを計算します。" +
        "<code>Raycaster</code> の <code>setFromCamera(点, camera)</code> は、画面の点（中心が (0, 0)、端が ±1 の座標）を通るレイを作ります。" +
        "<code>intersectObject(物)</code> は当たった場所を近い順の配列で返し、<code>hits[0].point</code> がいちばん手前の当たった点（<code>Vector3</code>）です。" +
        "実際のアプリでは、マウスの位置をこの -1〜1 の座標に直して渡し、クリックした物を選んだりします。</p>",
      challenge: {
        starterCode:
          RAYCAST_SCENE +
          "\n// ここで、カメラから pointer を通るレイを飛ばし、球に当たった点に marker を置こう\n",
        task: "raycaster.setFromCamera でカメラから pointer を通るレイを作り、intersectObject(ball) で当たった点 hits[0].point に marker を置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "intersectObjects?\\s*\\(" },
          // Where the ray through (0, 0.4) meets the ball (computed with
          // three's own Raycaster in solvable.test.ts).
          {
            kind: "objectAt",
            position: [0, 0.874, 1.217],
            type: "Mesh",
            tol: 0.1,
            message: "marker が、レイが球に当たった点にありません。marker.position.copy(hits[0].point) で置きましょう",
          },
          // The marker shows right where the pointer is: 0.7 of the height.
          { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: [1, 0.84, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "raycaster.setFromCamera(pointer, camera);  const hits = raycaster.intersectObject(ball);",
          "marker.position.copy(hits[0].point);",
        ],
        solution:
          RAYCAST_SCENE +
          "raycaster.setFromCamera(pointer, camera);    // カメラから pointer を通るレイ\n" +
          "const hits = raycaster.intersectObject(ball);  // 当たった場所（近い順）\n" +
          "marker.position.copy(hits[0].point);\n",
      },
    },
  ],
};
