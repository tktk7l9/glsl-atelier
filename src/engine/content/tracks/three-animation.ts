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

const PINK: [number, number, number] = [1, 0.41, 0.71];

/** A ball rising from y = -1.5 to y = 1.5 over a 2-second clip; `action` holds
 *  the played clip, and `after` plays it and moves the time on. */
const riseScene = (after: string): string =>
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'hotpink' }),\n" +
  ");\n" +
  "ball.position.y = -1.5;\n" +
  "scene.add(ball);\n\n" +
  "// 2 秒かけて、下 (y = -1.5) から上 (y = 1.5) へ\n" +
  "const track = new THREE.VectorKeyframeTrack('.position', [0, 2], [0, -1.5, 0, 0, 1.5, 0]);\n" +
  "const clip = new THREE.AnimationClip('rise', 2, [track]);\n" +
  "const mixer = new THREE.AnimationMixer(ball);\n" +
  "const action = mixer.clipAction(clip);\n\n" +
  after;

/** Two clips that each hold the ball still, low and high; `after` plays them. */
const poseScene = (after: string): string =>
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'hotpink' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "// 下で止まるクリップと、上で止まるクリップ\n" +
  "const pose = (name, y) => new THREE.AnimationClip(name, 1, [\n" +
  "  new THREE.VectorKeyframeTrack('.position', [0, 1], [0, y, 0, 0, y, 0]),\n" +
  "]);\n" +
  "const mixer = new THREE.AnimationMixer(ball);\n" +
  "const low = mixer.clipAction(pose('low', -1.5));\n" +
  "const high = mixer.clipAction(pose('high', 1.5));\n\n" +
  after;

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
    {
      id: "three-time-scale",
      title: "速さを変える: timeScale",
      explanation:
        "<p><code>mixer.clipAction(clip)</code> が返す <b>AnimationAction</b> は、クリップの再生ボタンのようなものです。キーフレームを作り直さなくても、" +
        "再生のしかたをここで変えられます。<code>action.timeScale</code> は再生の速さで、初期値は 1 です。2 なら倍速、0.5 なら半分の速さ、" +
        "負の値なら逆再生になります。歩きから走りへ速さだけ上げたいときや、スローモーションに使います。</p>",
      challenge: {
        starterCode: riseScene(
          "// ここで再生の速さを変えよう\n" +
            "action.play();\n" +
            "mixer.update(0.5);  // 0.5 秒進める（いまは 1/4 の所まで）\n",
        ),
        task: "action.timeScale を 2 にして、0.5 秒でクリップの半分（ちょうど真ん中の y = 0）まで進めよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "objectAt",
            position: [0, 0, 0],
            type: "Mesh",
            tol: 0.1,
            message: "0.5 秒の時点で、ボールが真ん中 (0, 0, 0) に来ていません。action.timeScale = 2; で倍速にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: PINK, tol: 0.15 },
        ],
        hints: ["action.timeScale = 2;", "クリップの中の時間は、経った時間の timeScale 倍だけ進みます"],
        solution: riseScene("action.timeScale = 2;  // 倍速\naction.play();\nmixer.update(0.5);\n"),
      },
    },
    {
      id: "three-loop-once",
      title: "1回で止める: LoopOnce と clampWhenFinished",
      explanation:
        "<p>クリップは、何もしないと最後まで行って最初に戻り、くり返します（<code>THREE.LoopRepeat</code>）。ドアが開く動きのように 1回で終わらせるには、" +
        "<code>action.setLoop(THREE.LoopOnce)</code> を指定します。ただし、それだけだと再生が終わった瞬間にクリップの効果が消えて、ボールは元の位置に戻ります。" +
        "<code>action.clampWhenFinished = true</code> を足すと、最後のポーズのまま止まります。</p>",
      challenge: {
        starterCode: riseScene(
          "// ここで 1回で止まるようにしよう\n" +
            "action.play();\n" +
            "mixer.update(1);\n" +
            "mixer.update(2);  // 合わせて 3 秒（いまは 2 周目の途中）\n",
        ),
        task: "action.setLoop(THREE.LoopOnce) と action.clampWhenFinished = true を指定して、3 秒後もボールを上 (0, 1.5, 0) に止めよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "objectAt",
            position: [0, 1.5, 0],
            type: "Mesh",
            tol: 0.1,
            message: "3 秒後のボールが上 (0, 1.5, 0) にありません。action.setLoop(THREE.LoopOnce); に action.clampWhenFinished = true; も足しましょう（無いと元の位置に戻ります）",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.76, rgb: PINK, tol: 0.15 },
        ],
        hints: ["action.setLoop(THREE.LoopOnce);", "action.clampWhenFinished = true;"],
        solution: riseScene(
          "action.setLoop(THREE.LoopOnce);\n" +
            "action.clampWhenFinished = true;  // 最後のポーズで止まる\n" +
            "action.play();\n" +
            "mixer.update(1);\n" +
            "mixer.update(2);\n",
        ),
      },
    },
    {
      id: "three-crossfade",
      title: "なめらかに切り替える: crossFadeTo",
      explanation:
        "<p>立ちから走りへのように、動きをぱっと切り替えると、ポーズが飛んで見えます。AnimationMixer は複数のクリップを同時に再生でき、それぞれの重み（weight）で結果を混ぜます。" +
        "<code>a.crossFadeTo(b, 秒)</code> は、指定した時間で <code>a</code> の重みを 1 から 0 へ、<code>b</code> の重みを 0 から 1 へ変えます。" +
        "混ぜるには両方が再生中でなければならないので、<code>b.play()</code> を忘れずに呼びます。</p>",
      challenge: {
        starterCode: poseScene(
          "low.play();\n" +
            "// ここで high も再生して、1 秒かけて low から high へ切り替えよう\n" +
            "mixer.update(0.5);  // 切り替えの途中まで進める\n",
        ),
        task: "high.play() で両方を再生し、low.crossFadeTo(high, 1) で 1 秒の切り替えを始めて、0.5 秒後にボールを 2つのポーズの中間 (0, 0, 0) にしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "objectAt",
            position: [0, 0, 0],
            type: "Mesh",
            tol: 0.1,
            message: "ボールが中間 (0, 0, 0) にありません。high.play(); のあとに low.crossFadeTo(high, 1); を呼んでから mixer.update を進めましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: PINK, tol: 0.15 },
        ],
        hints: ["high.play();", "low.crossFadeTo(high, 1);", "どちらも mixer.update(0.5) の前に呼びます"],
        solution: poseScene(
          "low.play();\n" +
            "high.play();\n" +
            "low.crossFadeTo(high, 1);  // 1 秒かけて low から high へ\n" +
            "mixer.update(0.5);\n",
        ),
      },
    },
  ],
};
