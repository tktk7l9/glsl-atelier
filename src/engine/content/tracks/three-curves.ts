// The three-curves track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND, NORMAL_COLOURED } from "./shared-three.js";

/** The lathe lesson's profile: (distance from the axis, height), bottom up. */
const VASE_PROFILE =
  "// つぼの断面（軸からの距離, 高さ）を下から順に\n" +
  "const points = [\n" +
  "  new THREE.Vector2(0.0, -1.5),  // 底の中心\n" +
  "  new THREE.Vector2(0.8, -1.5),  // 底のふち\n" +
  "  new THREE.Vector2(1.2, -0.6),  // いちばんふくらんだ所\n" +
  "  new THREE.Vector2(0.9, 0.4),   // 肩\n" +
  "  new THREE.Vector2(0.45, 1.0),  // 首\n" +
  "  new THREE.Vector2(0.6, 1.5),   // 口\n" +
  "];\n\n";

const VASE_MESH =
  "const vase = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" + "scene.add(vase);\n";

/** The extrude lesson: a camera above the scene and a gem outline. */
const GEM_OUTLINE =
  "// 少し上から見下ろすカメラ\n" +
  "camera.position.set(0, 3, 3);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 宝石の形の輪郭（moveTo で書き始め、lineTo で線を引く）\n" +
  "const shape = new THREE.Shape();\n" +
  "shape.moveTo(-1.2, 1.2);\n" +
  "shape.lineTo(1.2, 1.2);\n" +
  "shape.lineTo(1.8, 0.4);\n" +
  "shape.lineTo(0, -1.6);\n" +
  "shape.lineTo(-1.8, 0.4);\n" +
  "shape.lineTo(-1.2, 1.2);\n\n";

const GEM_MESH =
  "const gem = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" + "scene.add(gem);\n";

/** The tube lesson: a spring's points, the curve through them, and the curve
 *  shown as dots. With the tube on, its coils cover the centre line at 0.10–0.20,
 *  0.46–0.56 and 0.81–0.92 of the height (in front) and 0.35–0.41 and 0.57–0.64
 *  (behind), so the read-back rows 0.16, 0.53, 0.59 and 0.84 land at least 0.02
 *  inside a coil and the rows 0.28 and 0.72 well between them. */
const SPRING_CURVE =
  "// らせん（ばね）を通る点の列\n" +
  "const points = [];\n" +
  "for (let i = 0; i <= 100; i++) {\n" +
  "  const t = (i / 100) * Math.PI * 5;  // 2周半\n" +
  "  points.push(new THREE.Vector3(Math.cos(t) * 1.2, (t - Math.PI * 2.5) * 0.25, Math.sin(t) * 1.2));\n" +
  "}\n" +
  "// 点をなめらかに通る曲線\n" +
  "const curve = new THREE.CatmullRomCurve3(points);\n\n" +
  "// 曲線を点で示す\n" +
  "const dots = new THREE.Points(\n" +
  "  new THREE.BufferGeometry().setFromPoints(curve.getPoints(150)),\n" +
  "  new THREE.PointsMaterial({ color: 'white', size: 0.06 }),\n" +
  ");\n" +
  "scene.add(dots);\n";

export const track: Track = {
  id: "three-curves",
  domain: "three",
  title: "線から形をつくる",
  summary: "断面の輪郭を回して器に、2D の輪郭を押し出して立体に、3D の曲線にそって管にする。",
  icon: "🏺",
  lessons: [
    {
      id: "three-lathe",
      title: "回して作る: LatheGeometry",
      explanation:
        "<p>ろくろで器を作るように、<b>断面の輪郭</b>を縦の軸（y 軸）のまわりに 1周回すと、つぼやグラスのような形ができます。" +
        "<code>LatheGeometry(点の配列, 分割数)</code> の点は <code>Vector2(軸からの距離, 高さ)</code> で、下から順に並べます。" +
        "x が半径、y が高さです（逆にすると、まったく違う形になります）。分割数を増やすほど、まわりがなめらかになります。</p>",
      challenge: {
        starterCode:
          VASE_PROFILE +
          "// いまはただの円柱。points を y 軸のまわりに回した形にしよう\n" +
          "const geo = new THREE.CylinderGeometry(1, 1, 3, 48);\n" +
          VASE_MESH,
        task: "円柱の代わりに LatheGeometry(points, 48) を使って、断面 points を回したつぼを作ろう。",
        validators: [
          { kind: "noError" },
          { kind: "geometryOf", geometry: "LatheGeometry" },
          // Up the centre line, MeshNormalMaterial shows which way the surface
          // faces: down at the bulging body, up at the narrowing shoulder (a
          // cylinder faces straight ahead everywhere).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.41, 0.28, 0.94], tol: 0.12 },
              { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: [0.39, 0.71, 0.94], tol: 0.12 },
            ],
            message: "つぼのふくらみと肩の形が見えません。円柱の代わりに LatheGeometry(points, 48) を使いましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.9, rgb: BACKGROUND, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.1, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "const geo = new THREE.LatheGeometry(points, 48);",
          "Vector2 の x が軸からの距離（半径）、y が高さです",
        ],
        solution: VASE_PROFILE + "const geo = new THREE.LatheGeometry(points, 48);  // 断面を y 軸のまわりに回す\n" + VASE_MESH,
      },
    },
    {
      id: "three-extrude",
      title: "押し出して厚みをつける: ExtrudeGeometry",
      explanation:
        "<p>2D の輪郭は <code>THREE.Shape</code> で描けます。<code>moveTo(x, y)</code> で書き始めの点へ移り、<code>lineTo(x, y)</code> で線を引いていきます。" +
        "それを <code>ShapeGeometry</code> にすると厚みのない板ですが、<code>ExtrudeGeometry(shape, { depth: 厚み, bevelEnabled: false })</code> にすると、" +
        "輪郭を z の方向へ押し出した立体になります（クッキーの型抜きのイメージ）。<code>bevelEnabled</code> を true（初期値）のままにすると、" +
        "角が斜めに削られます。ロゴや文字を立体にするときの基本です。</p>",
      challenge: {
        starterCode:
          GEM_OUTLINE +
          "// いまは厚みのない板。輪郭を押し出して、厚み 0.8 の立体にしよう\n" +
          "const geo = new THREE.ShapeGeometry(shape);\n" +
          GEM_MESH,
        task: "ShapeGeometry を ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false }) に替えて、宝石の輪郭を厚み 0.8 の立体にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "geometryOf", geometry: "ExtrudeGeometry" },
          // Seen from above, the extruded top wall shows as a band above the
          // face (normal colour: facing up), and the face, pushed towards the
          // camera, reaches lower than the flat outline.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: [0.5, 0.85, 0.85],
            tol: 0.15,
            message: "上から見たときの厚みの面が見えません。ShapeGeometry を ExtrudeGeometry にして、depth を 0.8 にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.5, 0.15, 0.85], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.5, 0.15, 0.85], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });",
          "depth が押し出す長さ（厚み）です",
        ],
        solution:
          GEM_OUTLINE +
          "const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });  // z の方向へ 0.8 押し出す\n" +
          GEM_MESH,
      },
    },
    {
      id: "three-tube",
      title: "曲線にそって: TubeGeometry",
      explanation:
        "<p>3D の点の列を <code>CatmullRomCurve3</code> に渡すと、点をなめらかに通る曲線になります。その曲線にそって太さのある管を作るのが " +
        "<code>TubeGeometry(曲線, 長さ方向の分割数, 半径, 断面の分割数)</code> です。ケーブルやパイプ、ジェットコースターのレール、ばねなど、" +
        "曲がりくねった形に使えます。長さ方向の分割数が少ないと、なめらかな曲線がカクカクの折れ線になります。</p>",
      challenge: {
        starterCode:
          SPRING_CURVE +
          "\n// ここで、curve にそって半径 0.22 の管（TubeGeometry）を作り、MeshNormalMaterial で scene に追加しよう\n",
        task: "curve にそって TubeGeometry(curve, 300, 0.22, 16) の管を作り、MeshNormalMaterial で scene に追加して、ばねにしよう。",
        validators: [
          { kind: "noError" },
          { kind: "geometryOf", geometry: "TubeGeometry" },
          // The coils cross the centre line in front (bottom, middle, top)
          // and behind (upper); between them the background shows through.
          // Which way the tube faces changes across its width, but every
          // MeshNormalMaterial colour lies 0.5 from mid-grey, while the
          // background and the white dots are 0.8 or more away from it.
          {
            kind: "allOf",
            of: [0.16, 0.53, 0.59, 0.84].map((y) => ({
              kind: "pixelApprox" as const,
              x: 0.5,
              y,
              rgb: NORMAL_COLOURED,
              tol: 0.55,
            })),
            message: "ばねの管が、曲線の通る所に見えません。TubeGeometry(curve, 300, 0.22, 16) の Mesh を scene に追加しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: BACKGROUND, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "const geo = new THREE.TubeGeometry(curve, 300, 0.22, 16);",
          "const spring = new THREE.Mesh(geo, new THREE.MeshNormalMaterial()); scene.add(spring);",
        ],
        solution:
          SPRING_CURVE +
          "const spring = new THREE.Mesh(\n" +
          "  new THREE.TubeGeometry(curve, 300, 0.22, 16),  // 曲線, 長さ方向の分割, 半径, 断面の分割\n" +
          "  new THREE.MeshNormalMaterial(),\n" +
          ");\n" +
          "scene.add(spring);\n",
      },
    },
  ],
};
