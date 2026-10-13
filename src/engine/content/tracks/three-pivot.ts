// The three-pivot track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The hinge lesson: a bar to hang a sign from, and the sign. */
const SIGN_SCENE =
  "// 看板をつるす棒（蝶番）\n" +
  "const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 'dimgray' }));\n" +
  "bar.position.y = 1.2;\n" +
  "scene.add(bar);\n\n" +
  "// 看板（幅 2.4・高さ 1.6）\n" +
  "const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.08), new THREE.MeshBasicMaterial({ color: 'steelblue' }));\n";

/** The windmill lesson: the pole behind, and the blade's shape. */
const WINDMILL =
  "// 風車の柱（羽根の奥）\n" +
  "const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.2), new THREE.MeshBasicMaterial({ color: 'sienna' }));\n" +
  "pole.position.set(0, -1.5, -0.4);\n" +
  "scene.add(pole);\n\n" +
  "// 羽根の形（幅 0.9・長さ 2.0）。いまは形の真ん中が原点にある\n" +
  "const bladeGeo = new THREE.BoxGeometry(0.9, 2.0, 0.08);\n";

const BLADES =
  "\n// 羽根 4枚を、軸 (0, -0.2) のまわりに 90° ずつ回して並べる\n" +
  "for (let i = 0; i < 4; i++) {\n" +
  "  const blade = new THREE.Mesh(bladeGeo, new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 'tomato' : 'white' }));\n" +
  "  blade.position.set(0, -0.2, i * 0.02);  // 重なる所がちらつかないよう、奥行きを少しずつずらす\n" +
  "  blade.rotation.z = (i * Math.PI) / 2;\n" +
  "  scene.add(blade);\n" +
  "}\n" +
  "const hub = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), new THREE.MeshBasicMaterial({ color: 'gold' }));  // 軸の頭\n" +
  "hub.position.set(0, -0.2, 0.2);\n" +
  "scene.add(hub);\n";

/** The centring lesson: an arrow pointing right, drawn with its lower left
 *  corner at the origin, and the mesh turned to point up. */
const ARROW_SHAPE =
  "// 右向きの矢印。点は (0, 0)〜(2.4, 2) の範囲にあり、左下の角が原点にある\n" +
  "const shape = new THREE.Shape();\n" +
  "shape.moveTo(0, 0.5);\n" +
  "shape.lineTo(1.4, 0.5);\n" +
  "shape.lineTo(1.4, 0);\n" +
  "shape.lineTo(2.4, 1);\n" +
  "shape.lineTo(1.4, 2);\n" +
  "shape.lineTo(1.4, 1.5);\n" +
  "shape.lineTo(0, 1.5);\n" +
  "const geo = new THREE.ShapeGeometry(shape);\n";

const ARROW_MESH =
  "\nconst arrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 'limegreen' }));\n" +
  "arrow.rotation.z = Math.PI / 2;  // 90° 回して上へ向ける\n" +
  "scene.add(arrow);\n";

const STEELBLUE: [number, number, number] = [0.27, 0.51, 0.71];
const TOMATO: [number, number, number] = [1, 0.39, 0.28];
const LIMEGREEN: [number, number, number] = [0.2, 0.8, 0.2];

export const track: Track = {
  id: "three-pivot",
  domain: "three",
  title: "回転の中心を決める",
  summary: "親（Group）を蝶番の位置に置いて開き、ジオメトリをずらして根元で回し、geometry.center() で形の真ん中で回す。",
  icon: "🚪",
  lessons: [
    {
      id: "three-pivot-hinge",
      title: "蝶番で開く: 親を回転の中心に置く",
      explanation:
        "<p>オブジェクトは、いつも<b>自分の原点</b>（position の点）を中心に回ります。箱の原点は真ん中なので、そのまま回すと看板は真ん中で回り、" +
        "上のふちが棒から離れてしまいます。ドアや看板のように<b>端を軸に</b>回したいときは、軸の位置に空の親（<code>THREE.Group</code>）を置き、" +
        "子を「親から見て」軸から離れた位置に置いてから、<b>親のほうを</b>回します。親の原点が回転の中心になり、子はそのまわりをいっしょに回ります。</p>",
      challenge: {
        starterCode:
          SIGN_SCENE +
          "board.position.y = 0.4;  // 上のふちが棒の高さ（1.2）に来る位置\n" +
          "scene.add(board);\n\n" +
          "// 上のふちを軸に、手前へ 60° 開きたい。いまは板の真ん中で回るので、上のふちが棒から離れてしまう\n" +
          "board.rotation.x = -Math.PI / 3;\n",
        task: "棒の高さ (y = 1.2) に THREE.Group を置き、看板をその子にして y = -0.8 に置いてから、親を rotation.x = -Math.PI / 3 で回して、看板を上のふちを軸に開こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "Group|Object3D|\\.translate\\(", message: "回転の中心にする親（new THREE.Group()）を作りましょう" },
          // Opened on its top edge, the sign reaches down from the bar to
          // 0.55 (in front of the camera, perspective included); turned
          // about its middle it would hang from 0.70 down to 0.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.6563, rgb: STEELBLUE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.5313, rgb: BACKGROUND, tol: 0.15 },
            ],
            message:
              "看板が上のふちを軸に開いていません。y = 1.2 に置いた親（Group）に看板を add して y = -0.8 に置き、看板ではなく親を回しましょう",
          },
        ],
        hints: [
          "const hinge = new THREE.Group();  hinge.position.y = 1.2;  scene.add(hinge);",
          "board.position.y = -0.8;  hinge.add(board);  hinge.rotation.x = -Math.PI / 3;",
        ],
        solution:
          SIGN_SCENE +
          "const hinge = new THREE.Group();  // 回転の中心（蝶番）\n" +
          "hinge.position.y = 1.2;           // 棒の高さに置く\n" +
          "scene.add(hinge);\n" +
          "board.position.y = -0.8;          // 蝶番から見て、看板の真ん中は高さの半分だけ下\n" +
          "hinge.add(board);\n" +
          "hinge.rotation.x = -Math.PI / 3;  // 蝶番ごと回すと、上のふちを軸に開く\n",
      },
    },
    {
      id: "three-pivot-root",
      title: "根元で回す: geometry.translate",
      explanation:
        "<p>同じ形をたくさん並べるときは、親を 1つずつ作る代わりに、<b>形（ジオメトリ）そのものをずらす</b>方法もあります。" +
        "<code>geometry.translate(x, y, z)</code> は形の点を全部ずらすので、オブジェクトの原点（回転の中心）に対する形の位置が変わります。" +
        "羽根の形を長さの半分だけ上へずらして、根元を原点に合わせれば、どの羽根も根元を中心に回ります。" +
        "メッシュの <code>position</code> を動かしても、回転の中心はいっしょに動くだけなので、根元では回りません。</p>",
      challenge: {
        starterCode:
          WINDMILL +
          "// ここで、羽根の形を上へずらして、根元（下の端）を原点に合わせよう（いまは羽根の真ん中が軸に重なっている）\n" +
          BLADES,
        task: "bladeGeo.translate(0, 1.0, 0) で羽根の形を長さの半分だけ上へずらし、4枚の羽根が軸から外へ伸びる風車にしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "\\.translate\\(|Group|Object3D|applyMatrix4",
            message: "bladeGeo.translate(0, 1.0, 0) で、羽根の形を上へずらしましょう",
          },
          // The upper and lower blades reach 2.0 from the axle (y = -0.2), so
          // the column is red at y = 1.26 and y = -1.62 (and at 0.54, next
          // to the axle); blades turned about their middles stop at 0.8.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.7188, rgb: TOMATO, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.2188, rgb: TOMATO, tol: 0.15 },
            ],
            message: "羽根が軸から外へ伸びていません。形を長さの半分（1.0）だけ上へずらして、根元を原点に合わせましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.5938,
            rgb: TOMATO,
            tol: 0.15,
            message: "羽根が軸から離れています。ずらすのは長さの半分（1.0）です",
          },
        ],
        hints: ["bladeGeo.translate(0, 1.0, 0);  // 形を上へ 1.0（長さの半分）ずらす", "形がずれると、メッシュの原点（回転の中心）が羽根の根元に来ます"],
        solution: WINDMILL + "bladeGeo.translate(0, 1.0, 0);  // 形を長さの半分だけ上へずらし、根元を原点に\n" + BLADES,
      },
    },
    {
      id: "three-pivot-center",
      title: "形の真ん中で回す: geometry.center()",
      explanation:
        "<p>点を自分で並べた形や、読み込んだモデル、文字の形などは、原点が形の真ん中にあるとは限りません。原点が角にあると、回したときに角を中心に大きく振れてしまいます。" +
        "<code>geometry.center()</code> は、形を囲む箱の真ん中が原点に来るように、形の点を全部ずらします。これで、どんな形も<b>真ん中を中心に</b>回せます。" +
        "前のレッスンの <code>translate</code> で、ずらす量を自分で計算しても同じことができます。</p>",
      challenge: {
        starterCode:
          ARROW_SHAPE +
          "// ここで、形の真ん中が原点に来るようにしよう（いまは左下の角を中心に回るので、矢印が横へずれてしまう）\n" +
          ARROW_MESH,
        task: "geo.center() で矢印の形の真ん中を原点に移し、画面の真ん中で上を向く矢印にしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "center\\(|\\.translate\\(|Group|Object3D",
            message: "geo.center() で、形の真ん中を原点に移しましょう",
          },
          // Centred and turned to point up: the head, the shaft, and nothing above the tip.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5938, rgb: LIMEGREEN, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.3438, rgb: LIMEGREEN, tol: 0.15 },
            ],
            message:
              "矢印が真ん中にありません。メッシュを動かすのではなく、geo.center() で形そのものを動かして、真ん中を回転の中心にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.7188, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: ["geo.center();  // 形を囲む箱の真ん中が原点へ", "メッシュの position を動かしても、回転の中心（形の角）はいっしょに動くだけです"],
        solution: ARROW_SHAPE + "geo.center();  // 形の真ん中（形を囲む箱の中心）を原点へ移す\n" + ARROW_MESH,
      },
    },
  ],
};
