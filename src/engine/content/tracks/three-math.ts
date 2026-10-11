// The three-math track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The lerp lesson: a start (a) and an end (b) marked, and the ball to place. */
const LERP_SCENE =
  "const a = new THREE.Vector3(-0.75, -2, 0);  // 出発点（赤い印）\n" +
  "const b = new THREE.Vector3(2.25, 2, 0);    // 到着点（青い印）\n" +
  "for (const [p, color] of [[a, 'tomato'], [b, 'deepskyblue']]) {\n" +
  "  const mark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 12), new THREE.MeshBasicMaterial({ color }));\n" +
  "  mark.position.copy(p);\n" +
  "  scene.add(mark);\n" +
  "}\n" +
  "const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(ball);\n";

/** The quaternion lesson: three arms in one group, along +X, +Y and +Z. */
const ARMS =
  "// 3本の腕を 1つのグループにまとめる（赤は右 +X、緑は上 +Y、青は手前 +Z へのびる）\n" +
  "const arms = new THREE.Group();\n" +
  "const red = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: 'red' }));\n" +
  "red.position.x = 0.9;\n" +
  "const green = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshBasicMaterial({ color: 'lime' }));\n" +
  "green.position.y = 0.9;\n" +
  "const blue = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.8), new THREE.MeshBasicMaterial({ color: 'blue' }));\n" +
  "blue.position.z = 0.9;\n" +
  "arms.add(red, green, blue);\n" +
  "scene.add(arms);\n";

/** The spherical lesson: a globe of radius 2 (longitude 0° facing the camera) and a marker. */
const GLOBE =
  "// 半径 2 の地球儀（正面が経度 0°、真上が北極）\n" +
  "const globe = new THREE.Mesh(new THREE.SphereGeometry(2, 48, 24), new THREE.MeshNormalMaterial());\n" +
  "scene.add(globe);\n" +
  "const marker = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12), new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(marker);\n";

const GOLD: [number, number, number] = [1, 0.84, 0];

export const track: Track = {
  id: "three-math",
  domain: "three",
  title: "位置と回転の計算",
  summary: "Vector3 の lerp で 2点のあいだに置き、Quaternion で好きな軸のまわりに回し、球面座標（Spherical）で緯度と経度から位置を決める。",
  icon: "🎯",
  lessons: [
    {
      id: "three-lerp",
      title: "2点のあいだに置く: Vector3 の lerp",
      explanation:
        "<p>2つの点 a と b のあいだの位置は、<code>a + (b - a) × t</code> で求まります。t が 0 なら a、1 なら b、0.5 ならちょうど真ん中です。" +
        "このように 2つの値を割合で混ぜることを<b>線形補間（lerp）</b>と呼びます（GLSL の <code>mix</code> と同じ考え方です）。" +
        "<code>Vector3</code> には、<code>v.lerpVectors(a, b, t)</code>（v を a と b のあいだに置く）と、<code>v.lerp(b, t)</code>" +
        "（v のいまの位置から b へ t だけ近づける）があります。<code>lerp</code> は v のいまの値から動くので、出発点が a のときは先に " +
        "<code>v.copy(a)</code> しておきます。動きの途中の位置を求めたり、カメラになめらかに追いかけさせたりするときによく使います。</p>",
      challenge: {
        starterCode: LERP_SCENE + "\n// ここで、ball を a から b へ 4分の1 進んだ位置に置こう（いまは原点）\n",
        task: "ball.position.lerpVectors(a, b, 0.25) で、金色の玉を a（赤い印）から b（青い印）へ 4分の1 進んだ位置に置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "lerp", message: "Vector3 の lerpVectors（または lerp）で、2点のあいだの位置を求めましょう" },
          {
            kind: "objectAt",
            position: [0, -1, 0],
            type: "Mesh",
            tol: 0.2,
            message:
              "玉が、a から b へ 4分の1 進んだ位置にありません。ball.position.lerpVectors(a, b, 0.25) にしましょう（lerp(b, 0.25) だけだと、いまの位置＝原点から進んでしまいます）",
          },
          // The ball (radius 0.5) at (0, -1) covers this sample at 1:1 and 16:9.
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: GOLD, tol: 0.15 },
        ],
        hints: [
          "ball.position.lerpVectors(a, b, 0.25);  // a から b へ 0.25 の位置",
          "lerp を使うなら、先に出発点へ: ball.position.copy(a).lerp(b, 0.25);",
        ],
        solution: LERP_SCENE + "ball.position.lerpVectors(a, b, 0.25);  // a から b へ 4分の1（t = 0.25）の位置\n",
      },
    },
    {
      id: "three-quaternion",
      title: "好きな軸で回す: Quaternion",
      explanation:
        "<p><code>rotation.x</code>・<code>rotation.y</code>・<code>rotation.z</code>（オイラー角）は、決まった順番で軸ごとに回すので、" +
        "斜めの軸のまわりの回転を表すのは苦手です。好きな軸のまわりに回すときは<b>クォータニオン</b>（Quaternion）を使います。" +
        "<code>obj.quaternion.setFromAxisAngle(axis, angle)</code> に、回転の軸と角度（ラジアン）を渡すだけです。軸は " +
        "<code>new THREE.Vector3(1, 1, 1).normalize()</code> のように、<code>normalize()</code> で<b>長さを 1</b> にしてから渡します" +
        "（長さが 1 でないと、形がゆがんでしまいます）。軸 (1, 1, 1) のまわりに 120° 回すと、右・上・手前の 3つの向きが 1つずつずれて入れ替わります。</p>",
      challenge: {
        starterCode: ARMS + "\n// ここで、arms を軸 (1, 1, 1) のまわりに 120° 回そう\n",
        task: "長さ 1 にした軸 (1, 1, 1) と角度 Math.PI * 2 / 3（120°）を arms.quaternion.setFromAxisAngle に渡して、赤が上・緑が手前・青が右を向くように回そう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "AxisAngle|rotateOn(World)?Axis|Quaternion",
            message: "軸と角度で回す setFromAxisAngle（または rotateOnAxis）を使いましょう",
          },
          // After a third of a turn about (1, 1, 1): red up, green towards the
          // camera (the square in the middle), blue to the right. The samples
          // lie on the arms at 1:1 and at 16:9.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.69, rgb: [1, 0, 0] },
              { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 1, 0] },
              { kind: "pixelApprox", x: 0.66, y: 0.47, rgb: [0, 0, 1] },
            ],
            message:
              "赤が上・緑が手前・青が右を向いていません。軸は new THREE.Vector3(1, 1, 1).normalize() で長さ 1 にし、角度は 120° = Math.PI * 2 / 3（ラジアン）にしましょう（マイナスにすると逆回りです）",
          },
          // Nothing points left or down.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3, y: 0.47, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.22, rgb: BACKGROUND, tol: 0.15 },
            ],
            message: "左や下にも腕がはみ出しています。軸を normalize() で長さ 1 にしてから回しましょう（長さが 1 でないと形がゆがみます）",
          },
        ],
        hints: [
          "const axis = new THREE.Vector3(1, 1, 1).normalize();  // 長さ 1 の軸",
          "arms.quaternion.setFromAxisAngle(axis, Math.PI * 2 / 3);  // 120°",
        ],
        solution:
          ARMS +
          "const axis = new THREE.Vector3(1, 1, 1).normalize();     // 回転の軸（長さ 1 にする）\n" +
          "arms.quaternion.setFromAxisAngle(axis, Math.PI * 2 / 3);  // そのまわりに 120°（ラジアン）\n",
      },
    },
    {
      id: "three-spherical",
      title: "緯度と経度で置く: 球面座標",
      explanation:
        "<p>地球儀の上の点は、中心からの距離（半径）と 2つの角度で表せます。これを<b>球面座標</b>と呼び、" +
        "<code>v.setFromSphericalCoords(radius, phi, theta)</code> で xyz の位置に変換できます。<code>phi</code> は<b>真上（+Y）から測った角度</b>で、" +
        "北極が 0、赤道が 90° です。<code>theta</code> は<b>正面（+Z）から右（+X）へ回る角度</b>です。緯度は赤道から測るので、" +
        "phi = 90° − 緯度 になります。角度はどちらもラジアンで、30° は <code>Math.PI / 6</code>、60° は <code>Math.PI / 3</code> です" +
        "（<code>THREE.MathUtils.degToRad(60)</code> でも変換できます）。カメラを対象のまわりに回すときにも使います。</p>",
      challenge: {
        starterCode: GLOBE + "\n// ここで、marker を北緯 30°・東経 30° の地表（半径 2）に置こう（いまは地球儀の中に隠れている）\n",
        task: "marker.position.setFromSphericalCoords に半径 2・phi（90° − 緯度 30° = 60°）・theta（経度 30°）をラジアンで渡して、北緯 30°・東経 30° に金色の印を置こう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "Spherical|Math\\.(sin|cos)",
            message: "setFromSphericalCoords（球面座標）で、角度から位置を求めましょう",
          },
          {
            kind: "objectAt",
            position: [0.866, 1, 1.5],
            type: "Mesh",
            tol: 0.2,
            message:
              "印が北緯 30°・東経 30° の地表にありません。phi は真上からの角度（90° − 30° = 60° = Math.PI / 3）、theta は正面から右への角度（30° = Math.PI / 6）、半径は 2 です",
          },
          // The marker (radius 0.4) covers this sample at 1:1 and 16:9.
          { kind: "pixelApprox", x: 0.66, y: 0.78, rgb: GOLD, tol: 0.15 },
        ],
        hints: [
          "phi = 90° − 30° = 60° → Math.PI / 3、theta = 30° → Math.PI / 6",
          "marker.position.setFromSphericalCoords(2, Math.PI / 3, Math.PI / 6);",
        ],
        solution:
          GLOBE +
          "// phi: 真上（北極）からの角度 = 90° − 緯度、theta: 正面から右（東）への角度 = 経度\n" +
          "marker.position.setFromSphericalCoords(2, Math.PI / 3, Math.PI / 6);  // 半径 2・phi 60°・theta 30°\n",
      },
    },
  ],
};
