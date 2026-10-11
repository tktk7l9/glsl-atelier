// The three-lines-sprites track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The line lesson: a chart's values as points, shown as dots. */
const CHART_SCENE =
  "// 6 か月分の売り上げを、左から右へ並べた点にする（x: 月、y: 値）\n" +
  "const values = [2, 3.5, 1.5, 4, 2.5, 3.2];\n" +
  "const points = values.map((v, i) => new THREE.Vector3(i - 2.5, v - 2.5, 0));\n\n" +
  "// 点を打つ\n" +
  "const dots = new THREE.Points(\n" +
  "  new THREE.BufferGeometry().setFromPoints(points),\n" +
  "  new THREE.PointsMaterial({ color: 'gold', size: 0.25 }),\n" +
  ");\n" +
  "scene.add(dots);\n";

/** The sprite lesson: a camera off to the side and three orbs made by `make`. */
const ORBS_SCENE = (make: string): string =>
  "// 横から見るカメラ\n" +
  "camera.position.set(6, 0, 0);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 3つの光の玉\n" +
  "const colors = ['gold', 'deepskyblue', 'hotpink'];\n" +
  "colors.forEach((color, i) => {\n" +
  make +
  "  orb.position.set(0, (i - 1) * 1.6, 0);\n" +
  "  scene.add(orb);\n" +
  "});\n";

export const track: Track = {
  id: "three-lines-sprites",
  domain: "three",
  title: "線とスプライト",
  summary: "点をつないで折れ線グラフを引き、いつもカメラを向くスプライトで光の玉やラベルを置く。",
  icon: "📈",
  lessons: [
    {
      id: "three-line",
      title: "点をつないで線を引く: Line",
      explanation:
        "<p>折れ線グラフや軌跡のような<b>線</b>は <code>Line</code> で描きます。<code>new THREE.BufferGeometry().setFromPoints(点の配列)</code> で" +
        "点をジオメトリにし、<code>LineBasicMaterial</code> と組み合わせると、点が順番に 1本の線でつながります。線の太さは WebGL ではほぼ必ず " +
        "1 ピクセルなので、太い線が欲しいときは別の方法（細長い形など）を使います。最初と最後もつなぎたいときは <code>LineLoop</code>、" +
        "2点ずつ別々の線にしたいときは <code>LineSegments</code> です。</p>",
      challenge: {
        starterCode: CHART_SCENE + "\n// ここで、points を順につなぐ水色の Line を作って scene に追加しよう\n",
        task: "points から BufferGeometry を作り、LineBasicMaterial（色 'cyan'）の Line にして scene に追加し、点を折れ線でつなごう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "LineBasicMaterial" },
          {
            kind: "anyOf",
            of: [
              { kind: "sceneHas", type: "Line" },
              { kind: "sceneHas", type: "LineLoop" },
            ],
            message: "Line（または LineLoop）が scene にありません。new THREE.Line(ジオメトリ, マテリアル) を作って scene.add しましょう",
          },
          { kind: "materialOf", material: "LineBasicMaterial" },
          // A 1 px line cannot be read back reliably, so the polyline is
          // judged on its geometry: every one of the six points.
          {
            kind: "anyOf",
            of: [
              { kind: "verticesAtLeast", min: 6, type: "Line" },
              { kind: "verticesAtLeast", min: 6, type: "LineLoop" },
            ],
            message: "線が 6個の点すべてを通っていません。new THREE.BufferGeometry().setFromPoints(points) で全部の点を渡しましょう",
          },
          // No pixel check: a 1 px line and the small dots can miss every
          // sample of the smallest preview (measured at 341×192).
          { kind: "colorApprox", rgb: [0, 1, 1], tol: 0.15 },
        ],
        hints: [
          "const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 'cyan' }));",
          "scene.add(line);",
        ],
        solution:
          CHART_SCENE +
          "const line = new THREE.Line(\n" +
          "  new THREE.BufferGeometry().setFromPoints(points),  // 点を順につなぐ\n" +
          "  new THREE.LineBasicMaterial({ color: 'cyan' }),\n" +
          ");\n" +
          "scene.add(line);\n",
      },
    },
    {
      id: "three-sprite",
      title: "いつもカメラを向く: Sprite",
      explanation:
        "<p><code>Sprite</code> は、<b>どこから見てもカメラのほうを向く</b>平らな絵です。光の玉やラベル、遠くの木など、立体にしなくてよいものに使います。" +
        "<code>new THREE.Sprite(new THREE.SpriteMaterial({ color }))</code> で作り、位置は普通のオブジェクトと同じく <code>position</code> で決めます。" +
        "大きさは <code>scale</code> で、初期値は 1×1 です。普通の板（<code>PlaneGeometry</code>）は向きが固定なので、横から見ると薄い線になって" +
        "消えますが、Sprite は消えません。</p>",
      challenge: {
        starterCode: ORBS_SCENE(
          "  // いまは正面（+Z）を向いた板。横から見ているので、薄い線になって見えない\n" +
            "  const orb = new THREE.Mesh(\n" +
            "    new THREE.PlaneGeometry(1, 1),\n" +
            "    new THREE.MeshBasicMaterial({ color }),\n" +
            "  );\n",
        ),
        task: "板の Mesh を、SpriteMaterial を使った Sprite に替えて、横から見ても 3つの玉が見えるようにしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "SpriteMaterial" },
          {
            kind: "sceneHas",
            type: "Sprite",
            min: 3,
            message: "Sprite が 3つありません。new THREE.Sprite(new THREE.SpriteMaterial({ color })) にしましょう",
          },
          // The three orbs up the centre line, seen from the side (the
          // planes are edge-on there and draw nothing).
          { kind: "pixelApprox", x: 0.5, y: 0.75, rgb: [1, 0.41, 0.71], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 0.75, 1], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.25, rgb: [1, 0.84, 0], tol: 0.15 },
        ],
        hints: [
          "const orb = new THREE.Sprite(new THREE.SpriteMaterial({ color }));",
          "Sprite にジオメトリは要りません。向きはいつもカメラのほうです",
        ],
        solution: ORBS_SCENE("  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ color }));  // いつもカメラを向く\n"),
      },
    },
  ],
};
