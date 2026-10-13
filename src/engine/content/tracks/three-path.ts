// The three-path track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The road: a CatmullRom curve through four points, drawn as a thin tube. */
const ROAD =
  "// 道（4つの点をなめらかにつなぐ曲線）。見えるように細い管で描いておく\n" +
  "const curve = new THREE.CatmullRomCurve3([\n" +
  "  new THREE.Vector3(-2.2, -1.3, 0),\n" +
  "  new THREE.Vector3(-0.2, 1.4, 0),\n" +
  "  new THREE.Vector3(1.5, -1.2, 0),\n" +
  "  new THREE.Vector3(2.2, -1.0, 0),\n" +
  "]);\n" +
  "const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.06, 8), new THREE.MeshBasicMaterial({ color: 'slategray' }));\n" +
  "scene.add(road);\n";

const MARKER =
  "const marker = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12), new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(marker);\n";

const BEAD_PARTS =
  "const beadGeo = new THREE.SphereGeometry(0.4, 24, 12);\n" +
  "const beadMat = new THREE.MeshBasicMaterial({ color: 'gold' });\n";

/** The tangent lesson's car: a blue back and a red front along its +Z. */
const CAR =
  "// 車（後ろ半分が青、前半分が赤。前は +Z 向き）\n" +
  "const car = new THREE.Group();\n" +
  "const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: 'royalblue' }));\n" +
  "back.position.z = -0.4;\n" +
  "const front = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: 'crimson' }));\n" +
  "front.position.z = 0.4;\n" +
  "car.add(back, front);\n" +
  "scene.add(car);\n" +
  "const point = curve.getPointAt(0.5);  // 道のちょうど半分（長さで測って）\n" +
  "car.position.copy(point);\n";

const GOLD: [number, number, number] = [1, 0.84, 0];
const BLUE: [number, number, number] = [0.26, 0.41, 0.88];

export const track: Track = {
  id: "three-path",
  domain: "three",
  title: "曲線にそって置く",
  summary: "曲線の上の位置を長さで測って取り出し（getPointAt）、等間隔に並べ（getSpacedPoints）、進む向き（getTangentAt）に向ける。",
  icon: "🛤️",
  lessons: [
    {
      id: "three-curve-point",
      title: "曲線の上の位置: getPointAt",
      explanation:
        "<p>曲線（<code>Curve</code>）からは、途中の位置をいつでも取り出せます。<code>curve.getPointAt(u)</code> は、曲線の<b>長さ</b>で測って " +
        "u（0〜1）の割合の位置を返します。0.5 なら、道のりのちょうど半分です。似た名前の <code>getPoint(t)</code> は長さではなく曲線の" +
        "<b>内部の目盛り</b> t で測るので、点の間隔が不ぞろいな曲線では、t = 0.5 が道のりの半分になりません。物を一定の速さで動かすときは、" +
        "長さで測る <code>getPointAt</code> を使います。</p>",
      challenge: {
        starterCode: ROAD + MARKER + "\n// ここで、marker を道のちょうど半分（長さで測って 0.5）の位置に置こう\n",
        task: "curve.getPointAt(0.5) で道のりのちょうど半分の位置を求め、marker をそこに置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "getPointAt|getSpacedPoints", message: "curve.getPointAt(0.5) で、長さで測って半分の位置を求めましょう" },
          // Half-way by length lies at (0.02, 1.30); half-way by the curve's
          // own parameter (getPoint) at (0.69, 0.17).
          {
            kind: "objectAt",
            position: [0.02, 1.3, 0],
            type: "Mesh",
            tol: 0.1,
            message: "marker が道のりの半分の位置にありません。getPoint ではなく、長さで測る getPointAt(0.5) を使いましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: GOLD, tol: 0.15 },
        ],
        hints: ["getPointAt(u) は長さで測った位置（0〜1）", "marker.position.copy(curve.getPointAt(0.5));"],
        solution: ROAD + MARKER + "marker.position.copy(curve.getPointAt(0.5));  // 長さで測って、道のりのちょうど半分\n",
      },
    },
    {
      id: "three-spaced-points",
      title: "等間隔に並べる: getSpacedPoints",
      explanation:
        "<p>道に沿って街灯やビーズを<b>同じ間隔で</b>並べたいときは、<code>curve.getSpacedPoints(n)</code> が便利です。曲線を長さで n 等分した " +
        "n + 1 個の点（両端を含む）を配列で返すので、それぞれの位置に物を置くだけです。<code>getPoints(n)</code> は内部の目盛りで等分するので、" +
        "曲がり方によって間隔が詰まったり開いたりします。</p>",
      challenge: {
        starterCode: ROAD + BEAD_PARTS + "\n// ここで、道を長さで 4等分した 5つの点に、ビーズ（beadGeo と beadMat のメッシュ）を 1つずつ置こう\n",
        task: "curve.getSpacedPoints(4) で道を長さで 4等分した 5つの点を求め、それぞれにビーズを置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "getSpacedPoints|getPointAt", message: "curve.getSpacedPoints(4) で、長さで等分した点を求めましょう" },
          { kind: "sceneHas", type: "Mesh", min: 6, max: 6, message: "ビーズは 5つです（getSpacedPoints(4) は両端を含めて 5つの点を返します）" },
          // The quarter points by length; the middle bead sits on the centre line.
          {
            kind: "allOf",
            of: [
              { kind: "objectAt", position: [-1.26, 0.28, 0], type: "Mesh", tol: 0.2 },
              { kind: "objectAt", position: [0.9, -0.31, 0], type: "Mesh", tol: 0.2 },
            ],
            message: "ビーズが道のりの 4分の1 ごとに並んでいません。getPoints ではなく、長さで等分する getSpacedPoints(4) を使いましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: GOLD, tol: 0.15 },
        ],
        hints: [
          "curve.getSpacedPoints(4) は、長さで 4等分した 5つの点",
          "curve.getSpacedPoints(4).forEach((p) => { const bead = new THREE.Mesh(beadGeo, beadMat); bead.position.copy(p); scene.add(bead); });",
        ],
        solution:
          ROAD +
          BEAD_PARTS +
          "curve.getSpacedPoints(4).forEach((p) => {  // 長さで 4等分した 5つの点\n" +
          "  const bead = new THREE.Mesh(beadGeo, beadMat);\n" +
          "  bead.position.copy(p);\n" +
          "  scene.add(bead);\n" +
          "});\n",
      },
    },
    {
      id: "three-curve-tangent",
      title: "進む向きに向ける: getTangentAt",
      explanation:
        "<p>道を走る車は、道の<b>進む向き</b>を向いていてほしいものです。<code>curve.getTangentAt(u)</code> は、長さで測って u の位置での" +
        "進む向き（接線、長さ 1 のベクトル）を返します。<code>lookAt</code> は「この<b>点</b>を向け」なので、向きそのものではなく、" +
        "いまの位置に向きを足した点 <code>point.clone().add(tangent)</code> を渡します（向きのベクトルをそのまま渡すと、原点の近くの点を向いてしまいます）。" +
        "この車は前（赤）が +Z を向くように作ってあり、lookAt で +Z が進む向きにそろいます。</p>",
      challenge: {
        starterCode: ROAD + CAR + "\n// ここで、車の前（赤）を道の進む向きに向けよう（いまは前がこちらを向いている）\n",
        task: "curve.getTangentAt(0.5) で進む向きを求め、car.lookAt(point.clone().add(tangent)) で車の前（赤）を道の進む向きに向けよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "getTangent", message: "curve.getTangentAt(0.5) で、道の進む向きを求めましょう" },
          { kind: "objectAt", position: [0.02, 1.3, 0], type: "Group", tol: 0.2 },
          // The road goes down to the right there, so the blue back half lies
          // on the centre line (turned the other way it would be the red front).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BLUE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: BLUE, tol: 0.15 },
            ],
            message:
              "車が道の進む向きを向いていません。lookAt には向きではなく点を渡します: car.lookAt(point.clone().add(curve.getTangentAt(0.5)))（sub だと逆向きです）",
          },
        ],
        hints: ["const tangent = curve.getTangentAt(0.5);  // 進む向き（長さ 1）", "car.lookAt(point.clone().add(tangent));  // いまの位置 + 向き = 向く先の点"],
        solution: ROAD + CAR + "car.lookAt(point.clone().add(curve.getTangentAt(0.5)));  // 位置 + 進む向き の点を向く\n",
      },
    },
  ],
};
