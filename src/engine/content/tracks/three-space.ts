// The three-space track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The world-position lesson: a tilted arm with a tip (an empty child) and
 *  a flag in the scene; `place` puts the flag. */
const ARM = (place: string): string =>
  "// 斜めに傾けた腕（arm）。先端の目印（tip）は arm の子で、arm から見た位置（ローカル座標）で置いてある\n" +
  "const arm = new THREE.Group();\n" +
  "arm.position.set(-2, -1, 0);\n" +
  "arm.rotation.z = Math.PI / 4;  // 45° 傾ける\n" +
  "scene.add(arm);\n" +
  "const bar = new THREE.Mesh(new THREE.BoxGeometry(2.83, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 'slategray' }));\n" +
  "bar.position.x = 1.415;\n" +
  "arm.add(bar);\n" +
  "const tip = new THREE.Object3D();\n" +
  "tip.position.set(2.83, 0, 0);  // arm から見た先端の位置\n" +
  "arm.add(tip);\n" +
  "// 旗（flag）は scene の子なので、位置はワールド座標で決める\n" +
  "const flag = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12), new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(flag);\n" +
  place;

/** The attach lesson: a shrunk, turned turntable (with a plate to show it)
 *  and a ball in the scene; `move` hands the ball over. */
const TURNTABLE = (move: string): string =>
  "// 回転台（turntable）は右へ 1 ずらし、90° 回して、半分に縮めてある\n" +
  "const turntable = new THREE.Group();\n" +
  "turntable.position.set(1, 0, 0);\n" +
  "turntable.rotation.z = Math.PI / 2;\n" +
  "turntable.scale.setScalar(0.5);\n" +
  "scene.add(turntable);\n" +
  "const plate = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 'slategray' }));\n" +
  "plate.position.z = -1;  // 台の板（台といっしょに縮み、回る）\n" +
  "turntable.add(plate);\n" +
  "// ボールは、いまは scene の子（ワールド座標で (0, -1, 0)、半径 0.45）\n" +
  "const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12), new THREE.MeshBasicMaterial({ color: 'tomato' }));\n" +
  "ball.position.set(0, -1, 0);\n" +
  "scene.add(ball);\n" +
  move;

/** The matrix lesson: a turn and a move as matrices; `compose` sets m. */
const MATRICES = (compose: string): string =>
  "const rotate = new THREE.Matrix4().makeRotationZ(Math.PI / 2);  // 原点のまわりに 90° 回す\n" +
  "const move = new THREE.Matrix4().makeTranslation(2, 0, 0);       // 右へ 2 動かす\n" +
  "const m = new THREE.Matrix4();  // いまは何もしない行列（単位行列）\n" +
  compose +
  "// 原点 (0, 0, 0) を m で変換した位置に、金色の目印を置く\n" +
  "const marker = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12), new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "marker.position.applyMatrix4(m);\n" +
  "scene.add(marker);\n";

const GOLD: [number, number, number] = [1, 0.84, 0];
const TOMATO: [number, number, number] = [1, 0.39, 0.28];

export const track: Track = {
  id: "three-space",
  domain: "three",
  title: "ローカル座標とワールド座標",
  summary: "親子にした物の「親から見た位置」と「世界での位置」を行き来する。getWorldPosition、見た目を変えずに親を替える attach、行列を掛ける順番。",
  icon: "🪆",
  lessons: [
    {
      id: "three-world-position",
      title: "世界のどこにある？: getWorldPosition",
      explanation:
        "<p>子の <code>position</code> は<b>親から見た位置</b>（ローカル座標）です。親が動いたり回ったりしていると、子が<b>世界のどこにあるか</b>" +
        "（ワールド座標）は、親の動きを全部たどらないとわかりません。<code>child.getWorldPosition(v)</code> は、それを計算して v に書き込んでくれます" +
        "（<code>flag.position</code> を渡せば、そのまま旗の位置になります）。腕の先に当たり判定を置く、子の場所へカメラを向けるといった場面で使います。" +
        "<code>tip.position</code> をそのまま使うと、親の傾きと位置が抜け落ちます。</p>",
      challenge: {
        starterCode: ARM("// ここで、旗（flag）を tip のある場所（ワールド座標）に置こう\n"),
        task: "tip.getWorldPosition(flag.position) で、腕の先端（tip）の世界での位置に金色の旗を置こう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "getWorldPosition|localToWorld|matrixWorld",
            message: "tip.getWorldPosition(flag.position) で、tip のワールド座標を求めましょう",
          },
          {
            kind: "objectAt",
            position: [0, 1, 0],
            type: "Mesh",
            tol: 0.2,
            message:
              "旗が腕の先端にありません。tip.position は arm から見た位置なので、tip.getWorldPosition(flag.position) で世界での位置を求めましょう",
          },
          // The flag (radius 0.45) at (0, 1, 0) covers this sample at 1:1 and 16:9.
          { kind: "pixelApprox", x: 0.5, y: 0.66, rgb: GOLD, tol: 0.15 },
        ],
        hints: ["getWorldPosition(v) は、ワールド座標を v に書き込む", "tip.getWorldPosition(flag.position);"],
        solution: ARM("tip.getWorldPosition(flag.position);  // tip のワールド座標を、そのまま旗の位置に書き込む\n"),
      },
    },
    {
      id: "three-attach",
      title: "見た目を変えずに親を替える: attach",
      explanation:
        "<p><code>parent.add(child)</code> で親子にすると、子の <code>position</code>・<code>rotation</code>・<code>scale</code> は<b>そのまま新しい親から" +
        "見た値</b>として使われます。親が動いたり回ったり縮んだりしていると、子は画面の上で飛んでしまいます。<code>parent.attach(child)</code> は、" +
        "<b>いまの見た目（世界での位置・向き・大きさ）を保ったまま</b>親を替え、そのぶん子のローカルの値を計算し直します。この回転台は半分に縮めてあるので、" +
        "ボールのローカルの大きさは 2倍に、位置も台から見た座標に変わります。物を手に持たせる、台に乗せるといった場面で使います。</p>",
      challenge: {
        starterCode: TURNTABLE("// ここで、ボールを回転台（turntable）の子にしよう。ただし、画面の上での位置と大きさは変えずに\n"),
        task: "turntable.attach(ball) で、ボールの見た目（位置と大きさ）を変えずに、回転台の子にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "attach|invert|worldToLocal", message: "turntable.attach(ball) で、ボールを回転台の子にしましょう" },
          // Seen from the turntable (moved, turned 90°, halved) the ball sits
          // at (-2, 2, 0) at scale 2; left in the scene it would still be at
          // (0, -1, 0).
          {
            kind: "objectAt",
            position: [-2, 2, 0],
            type: "Mesh",
            tol: 0.2,
            message: "ボールが回転台の子になっていません。turntable.attach(ball) で、見た目を保ったまま親を替えましょう",
          },
          {
            kind: "scaleApprox",
            scale: [2, 2, 2],
            type: "Mesh",
            message: "ボールの大きさが変わっています。turntable.add ではなく turntable.attach を使うと、縮めた台の子になっても大きさが保たれます",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.34,
            rgb: TOMATO,
            tol: 0.15,
            message: "ボールが画面の上で動いてしまいました。turntable.add(ball) ではなく turntable.attach(ball) にしましょう",
          },
        ],
        hints: ["add は値をそのまま使い、attach は見た目を保つ", "turntable.attach(ball);"],
        solution: TURNTABLE("turntable.attach(ball);  // 世界での位置・向き・大きさを保ったまま、親を turntable に替える\n"),
      },
    },
    {
      id: "three-matrix-order",
      title: "行列を掛ける順番: 動かしてから回す",
      explanation:
        "<p>移動・回転・拡大は、どれも 4×4 の<b>行列</b>（<code>Matrix4</code>）で表せて、掛け合わせると 1つの変換にまとまります。ただし" +
        "<b>順番</b>で結果が変わります。「右へ 2 動かしてから、原点のまわりに 90° 回す」と、点は (2, 0, 0) を経て上の (0, 2, 0) へ行きますが、" +
        "「回してから動かす」と、原点は回っても原点のままなので (2, 0, 0) に止まります。行列は<b>右に書いたものから先に</b>効くので、" +
        "「move してから rotate」は <code>rotate × move</code>、three.js では <code>m.multiplyMatrices(rotate, move)</code> です。</p>",
      challenge: {
        starterCode: MATRICES("// ここで、m を「先に右へ 2 動かし、そのあと原点のまわりに 90° 回す」変換にしよう（右に書いた行列から先に効く）\n"),
        task: "m.multiplyMatrices(rotate, move) で「動かしてから回す」行列を作り、目印を (0, 2, 0) へ運ぼう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "multiply|premultiply", message: "m.multiplyMatrices(rotate, move) で、2つの行列を掛け合わせましょう" },
          {
            kind: "objectAt",
            position: [0, 2, 0],
            type: "Mesh",
            tol: 0.2,
            message:
              "目印が (0, 2, 0) にありません。行列は右に書いたものから先に効きます。「move してから rotate」は m.multiplyMatrices(rotate, move) です",
          },
          // The marker (radius 0.45) at (0, 2, 0) covers this sample at 1:1
          // and 16:9; the origin, where the starter leaves it, is empty.
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: GOLD, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: ["rotate × move は「move してから rotate」（右から先に効く）", "m.multiplyMatrices(rotate, move);"],
        solution: MATRICES("m.multiplyMatrices(rotate, move);  // rotate × move: 右の move が先、そのあと rotate\n"),
      },
    },
  ],
};
