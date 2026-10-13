// The three-box track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The fit-the-height lesson: a snowman of three spheres, 4.5 tall,
 *  standing in for a model of unknown size; `fit` follows. */
const SNOWMAN = (fit: string): string =>
  "// 大きさのわからないモデルのつもりの雪だるま（3つの球のグループ）\n" +
  "const snowman = new THREE.Group();\n" +
  "const white = new THREE.MeshBasicMaterial({ color: 'white' });\n" +
  "const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), white);\n" +
  "body.position.y = -1.25;\n" +
  "const chest = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 16), white);\n" +
  "chest.position.y = 0.5;\n" +
  "const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), white);\n" +
  "head.position.y = 1.75;\n" +
  "snowman.add(body, chest, head);\n" +
  "scene.add(snowman);\n" +
  fit;

/** The centring lesson: a house built away from the origin; `centre` follows. */
const HOUSE = (centre: string): string =>
  "// 原点から離れた所に組み立てた家（壁と屋根のグループ）\n" +
  "const house = new THREE.Group();\n" +
  "const walls = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1), new THREE.MeshBasicMaterial({ color: 'wheat' }));\n" +
  "walls.position.set(2, 1.25, 0);\n" +
  "const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1, 4), new THREE.MeshBasicMaterial({ color: 'firebrick' }));\n" +
  "roof.position.set(2, 2.5, 0);\n" +
  "roof.rotation.y = Math.PI / 4;\n" +
  "house.add(walls, roof);\n" +
  "scene.add(house);\n" +
  centre;

/** The framing lesson: a tower of three panels, 6 tall; `fit` follows. */
const TOWER = (fit: string): string =>
  "// 高さ 6 の塔（3枚の板）。いまのカメラ（z = 5）では上下がはみ出す\n" +
  "const tower = new THREE.Group();\n" +
  "[['royalblue', -2], ['seagreen', 0], ['darkorange', 2]].forEach(([color, y]) => {\n" +
  "  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2), new THREE.MeshBasicMaterial({ color }));\n" +
  "  panel.position.y = y;\n" +
  "  tower.add(panel);\n" +
  "});\n" +
  "scene.add(tower);\n" +
  fit;

const MEASURE_SNOWMAN = "const size = new THREE.Box3().setFromObject(snowman).getSize(new THREE.Vector3());  // いまの幅・高さ・奥行き\n";
const MEASURE_TOWER = "const size = new THREE.Box3().setFromObject(tower).getSize(new THREE.Vector3());\n";

const WHITE: [number, number, number] = [1, 1, 1];
const WHEAT: [number, number, number] = [0.96, 0.87, 0.7];
const FIREBRICK: [number, number, number] = [0.7, 0.13, 0.13];
const ORANGE: [number, number, number] = [1, 0.55, 0];
const BLUE: [number, number, number] = [0.26, 0.41, 0.88];

export const track: Track = {
  id: "three-box",
  domain: "three",
  title: "大きさと中心を測る（Box3）",
  summary: "モデルを包む箱（Box3）で大きさと中心を測り、高さをそろえ、原点に置き直し、ちょうど画面に収まる距離へカメラを下げる。",
  icon: "📦",
  lessons: [
    {
      id: "three-box-size",
      title: "大きさをそろえる: Box3 と getSize",
      explanation:
        "<p>読み込んだモデルは、作った人によって大きさがばらばらです。そこで、モデル全体をぴったり包む<b>箱</b>（<code>Box3</code>）で大きさを測ります。" +
        "<code>new THREE.Box3().setFromObject(model)</code> は子も含めた全体を包む箱を作り、<code>getSize(v)</code> がその幅・高さ・奥行きを v に入れます。" +
        "高さを 2 にそろえたいなら、倍率は <code>2 / size.y</code> です。<code>scale.setScalar</code> で縦・横・奥行きに同じ倍率を掛ければ、" +
        "形（縦横の比）を保ったまま大きさだけが変わります。</p>",
      challenge: {
        starterCode: SNOWMAN("// ここで、雪だるまの大きさを測り、形を保ったまま高さを 2 にそろえよう\n"),
        task: "Box3 の getSize で雪だるまの大きさを測り、snowman.scale.setScalar(2 / size.y) で、形を保ったまま高さを 2 にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "Box3", message: "new THREE.Box3().setFromObject(snowman) で、雪だるま全体を包む箱を作りましょう" },
          {
            kind: "scaleApprox",
            scale: [0.444, 0.444, 0.444],
            type: "Group",
            tol: 0.05,
            message: "高さ 2 になる倍率で、縦・横・奥行きを同じだけ縮めていません。snowman.scale.setScalar(2 / size.y) にしましょう（size.y / 2 だと逆に大きくなります）",
          },
          // Up the centre line: the body, and the background just below its
          // new bottom (y = -1) and above its new top (y = 1).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: WHITE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BACKGROUND, tol: 0.15 },
            ],
            message: "雪だるまの高さが 2 になっていません。size.y が高さです。2 / size.y を倍率にしましょう",
          },
        ],
        hints: ["const size = new THREE.Box3().setFromObject(snowman).getSize(new THREE.Vector3());", "snowman.scale.setScalar(2 / size.y);  // 高さ 2 になる倍率"],
        solution: SNOWMAN(MEASURE_SNOWMAN + "snowman.scale.setScalar(2 / size.y);  // 高さが 2 になる倍率を、縦横奥行きに同じだけ掛ける\n"),
      },
    },
    {
      id: "three-box-center",
      title: "中心をそろえる: getCenter",
      explanation:
        "<p>モデルの<b>中心</b>が原点にあるとは限りません。原点から離れた所に作られたモデルは、回すと大きく振り回され、カメラの中央にも来ません。" +
        "<code>box.getCenter(v)</code> で箱の中心を求め、その分だけモデルを逆向きに動かす（<code>model.position.sub(center)</code>）と、" +
        "モデルの中心が原点に来ます。中心をそろえておくと、回転も拡大も、モデルのまん中を基準にできます。</p>",
      challenge: {
        starterCode: HOUSE("// ここで、家を包む箱の中心を求め、その中心が原点に来るように家を動かそう\n"),
        task: "Box3 の getCenter で家の中心を求め、house.position.sub(center) で、家の中心を原点（画面のまん中）に動かそう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "Box3", message: "new THREE.Box3().setFromObject(house) で、家全体を包む箱を作りましょう" },
          // The box runs x 0.8..3.2, y 0.5..3.0: centre (2, 1.75, 0).
          {
            kind: "objectAt",
            position: [-2, -1.75, 0],
            type: "Group",
            tol: 0.2,
            message: "家の中心が原点に来ていません。中心の分だけ逆向きに動かします: house.position.sub(center)（copy や add では遠ざかります）",
          },
          // Up the centre line: the walls, the roof above them, and the sky
          // above the roof.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: WHEAT, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: FIREBRICK, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BACKGROUND, tol: 0.15 },
            ],
            message: "家が画面のまん中に来ていません。x だけでなく y もそろえるよう、position.sub(center) で 3つの軸をまとめて動かしましょう",
          },
        ],
        hints: ["const center = new THREE.Box3().setFromObject(house).getCenter(new THREE.Vector3());", "house.position.sub(center);  // 中心の分だけ逆向きに"],
        solution: HOUSE(
          "const center = new THREE.Box3().setFromObject(house).getCenter(new THREE.Vector3());  // 家を包む箱の中心\n" +
            "house.position.sub(center);  // その分だけ逆向きに動かして、中心を原点へ\n",
        ),
      },
    },
    {
      id: "three-fit-camera",
      title: "カメラに収める: 大きさから距離を決める",
      explanation:
        "<p>モデル全体を画面に収めたいとき、カメラをどれだけ離せばよいかは、モデルの高さと<b>視野角</b>（<code>camera.fov</code>、縦方向の度数）から" +
        "計算できます。カメラから見て、高さの半分 <code>size.y / 2</code> がちょうど視野角の半分に収まる距離は " +
        "<code>(size.y / 2) / Math.tan(視野角の半分)</code> です（角度はラジアンに直します）。ぎりぎりだと上下が窮屈なので、" +
        "1.15倍くらい離して余白を残します。モデルを読み込んだあと、まず全体を見せるための定番の計算です。</p>",
      challenge: {
        starterCode: TOWER(
          "// ここで、塔の高さを測り、上下に少し余白を残して全体が収まる距離（1.15倍）へカメラを下げよう\n",
        ),
        task: "Box3 で塔の大きさを測り、camera.position.z を (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) の 1.15倍にして、塔全体を画面に収めよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "Box3", message: "new THREE.Box3().setFromObject(tower) で、塔の大きさを測りましょう" },
          // (6 / 2) / tan(30°) × 1.15 = 5.98.
          {
            kind: "cameraPositioned",
            position: [0, 0, 5.98],
            tol: 0.2,
            message:
              "カメラの距離が違います。(size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15 です（fov は度なのでラジアンに直し、半分にします）",
          },
          // The top and bottom panels end just inside the frame, with a margin.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.91, rgb: ORANGE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.97, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.09, rgb: BLUE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.03, rgb: BACKGROUND, tol: 0.15 },
            ],
            message: "塔の上下に余白がありません（または塔が小さすぎます）。ぎりぎりの距離の 1.15倍に下げましょう",
          },
        ],
        hints: [
          "const size = new THREE.Box3().setFromObject(tower).getSize(new THREE.Vector3());",
          "camera.position.z = (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;",
        ],
        solution: TOWER(
          MEASURE_TOWER +
            "const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);  // 縦の視野角の半分（ラジアン）\n" +
            "camera.position.z = (size.y / 2) / Math.tan(halfFov) * 1.15;  // 高さの半分がちょうど収まる距離の 1.15倍\n",
        ),
      },
    },
  ],
};
