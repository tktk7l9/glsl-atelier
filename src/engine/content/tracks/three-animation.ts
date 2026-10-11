// The three-animation track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The keyframe lesson; `keys` defines `times` and `values`. */
const KEYFRAME_SCENE = (keys: string): string =>
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'hotpink' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "// 位置のキーフレーム: times[i] 秒に、values の i 番目の位置 (x, y, z) を通る\n" +
  keys +
  "const track = new THREE.VectorKeyframeTrack('.position', times, values);\n" +
  "const clip = new THREE.AnimationClip('jump', 2, [track]);\n\n" +
  "// クリップを再生して、1 秒進めた瞬間のポーズにする\n" +
  "const mixer = new THREE.AnimationMixer(ball);\n" +
  "mixer.clipAction(clip).play();\n" +
  "mixer.update(1);\n";

export const track: Track = {
  id: "three-animation",
  domain: "three",
  title: "アニメーション",
  summary: "回転の考え方と、キーフレームで動きを組み立てる AnimationClip。実アプリでは毎フレーム値を更新する。",
  icon: "🎞️",
  lessons: [
    {
      id: "three-rotate",
      title: "回転させる: rotation",
      explanation:
        "<p><code>rotation</code> は各軸の回転角（ラジアン）。実際のアプリでは描画ループで毎フレーム " +
        "<code>mesh.rotation.y += 0.01</code> のように増やします。ここでは静的に角度をつけて確認しましょう。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n\n" +
          "// Y軸まわりに少し回してみよう\n",
        task: "立方体を Y軸まわりに回転させよう（rotation.y）。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "rotation" },
          { kind: "sceneHas", type: "Mesh" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["cube.rotation.y = 0.6;", "ラジアンなので 0.6 ≒ 34度"],
        solution:
          "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
          "const mat = new THREE.MeshNormalMaterial();\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n" +
          "cube.rotation.y = 0.6;\n",
      },
    },
    {
      id: "three-keyframes",
      title: "キーフレームで動かす: AnimationClip",
      explanation:
        "<p>決まった動きは、<b>キーフレーム</b>（ある時刻にどこにいるか）を並べて作れます。<code>VectorKeyframeTrack</code> に" +
        "プロパティ名（<code>'.position'</code>）・時刻の配列・値の配列（x, y, z, x, y, z, …）を渡すと、キーフレームの間は" +
        "なめらかにつながります。トラックを <code>AnimationClip</code> にまとめ、<code>AnimationMixer</code> で再生して、" +
        "<code>mixer.update(秒)</code> で時間を進めます。実際のアプリでは毎フレーム呼びますが、ここでは 1秒進めた瞬間を" +
        "確かめます。</p>",
      challenge: {
        starterCode: KEYFRAME_SCENE(
          "const times = [0, 2];\n" +
            "const values = [\n" +
            "  0, -1.5, 0,  // 0 秒: 下\n" +
            "  0, -1.5, 0,  // 2 秒: 下\n" +
            "];\n",
        ),
        task: "キーフレームを 3つにして、0 秒で下 (0, -1.5, 0)、1 秒で上 (0, 1.5, 0)、2 秒でまた下を通る、跳ねるボールにしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "objectAt",
            position: [0, 1.5, 0],
            type: "Mesh",
            tol: 0.2,
            message: "1 秒の時点で、ボールが上 (0, 1.5, 0) に来ていません。times を [0, 1, 2] にして、1 秒の位置を足しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.76, rgb: [1, 0.41, 0.71], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.24, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "const times = [0, 1, 2];",
          "values は 0, -1.5, 0,   0, 1.5, 0,   0, -1.5, 0（3つの位置を順に）",
        ],
        solution: KEYFRAME_SCENE(
          "const times = [0, 1, 2];\n" +
            "const values = [\n" +
            "  0, -1.5, 0,  // 0 秒: 下\n" +
            "  0, 1.5, 0,   // 1 秒: 上\n" +
            "  0, -1.5, 0,  // 2 秒: 下\n" +
            "];\n",
        ),
      },
    },
  ],
};
