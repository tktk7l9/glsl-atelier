// The three-visibility track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

const SPOT = "new THREE.CircleGeometry(1.2, 48)";

const lamps = (red: string, green: string): string =>
  `const red = new THREE.Mesh(${SPOT}, new THREE.MeshBasicMaterial({ ${red} }));\n` +
  "red.position.x = -0.6;\n" +
  "scene.add(red);\n\n" +
  "// 緑の光は、赤より少し奥にある\n" +
  `const green = new THREE.Mesh(${SPOT}, new THREE.MeshBasicMaterial({ ${green} }));\n` +
  "green.position.set(0.6, 0, -0.1);\n" +
  "scene.add(green);\n";

/** The wall hiding the marker, and the label that belongs on top of it. */
const WALL =
  "// 手前の壁\n" +
  "const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 'steelblue' }));\n" +
  "wall.position.z = 1;\n" +
  "scene.add(wall);\n\n";

const marker = (label: string, ring: string, after: string): string =>
  WALL +
  "// 壁の奥にある目印のラベル（白）と、その台座（金色）\n" +
  `const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 'white'${label} }));\n` +
  "label.position.z = -1;\n" +
  "scene.add(label);\n\n" +
  `const base = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshBasicMaterial({ color: 'gold'${ring} }));\n` +
  "base.position.z = -1;\n" +
  "scene.add(base);\n" +
  after;

const SHAPES =
  "// いつも見せる物\n" +
  "const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 'orange' }));\n" +
  "scene.add(ball);\n\n" +
  "// 編集中だけ見せたい補助の枠\n" +
  "const guide = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'lime' }),\n" +
  ");\n" +
  "guide.position.z = -1;\n" +
  "scene.add(guide);\n";

const NEAR_MESH =
  "new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 3), new THREE.MeshBasicMaterial({ color: 'tomato' }))";
const FAR_MESH =
  "new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshBasicMaterial({ color: 'dodgerblue' }))";

export const track: Track = {
  id: "three-visibility",
  domain: "three",
  title: "重なりと見え方を決める",
  summary: "光を足し算で重ね、描く順番で手前に出し、レイヤーでカメラごとに隠し、距離に合わせて形を替える。",
  icon: "🧿",
  lessons: [
    {
      id: "three-additive",
      title: "光を足す: AdditiveBlending",
      explanation:
        "<p>マテリアルの <code>blending</code> は、奥にある色と混ぜる方法です。<code>THREE.AdditiveBlending</code> にすると、奥の色に<b>足し算</b>で重なるので、" +
        "赤と緑の光が重なった所は黄色に光ります。炎や火花、光の粒によく使います。" +
        "光どうしを重ねるときは、<code>depthWrite: false</code> も指定します。深度を書くと、奥の光が「隠れている」と見なされて描かれない所が出るためです。" +
        "<code>transparent: true</code> を付けると、不透明な物のあとに奥から順に描かれます。</p>",
      challenge: {
        starterCode: lamps("color: 'red'", "color: 'lime'"),
        task: "2つのマテリアルに blending: THREE.AdditiveBlending と transparent: true、depthWrite: false を指定して、重なった所を黄色に光らせよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "AdditiveBlending" },
          { kind: "sceneHas", type: "Mesh", min: 2 },
          // The overlap adds up to yellow; each lamp keeps its colour on its own
          // side; the column at 0.354 and 0.646 stays outside the other lamp at
          // both preview shapes.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [1, 1, 0], tol: 0.2 },
              { kind: "pixelApprox", x: 0.3542, y: 0.5208, rgb: [1, 0, 0], tol: 0.2 },
              { kind: "pixelApprox", x: 0.6458, y: 0.5208, rgb: [0, 1, 0], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.8542, rgb: BACKGROUND, tol: 0.2 },
            ],
            message: "重なった所が黄色になっていません。2つのマテリアルの両方に blending: THREE.AdditiveBlending を指定し、transparent: true と depthWrite: false も足しましょう",
          },
        ],
        hints: [
          "new THREE.MeshBasicMaterial({ color: 'red', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })",
          "赤 (1, 0, 0) と緑 (0, 1, 0) を足すと、黄色 (1, 1, 0) です",
        ],
        solution: lamps(
          "color: 'red', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false",
          "color: 'lime', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false",
        ),
      },
    },
    {
      id: "three-render-order",
      title: "壁の向こうを見せる: depthTest と renderOrder",
      explanation:
        "<p>奥の物が手前の物に隠れるのは、ピクセルごとに奥行きを比べる<b>深度テスト</b>のおかげです。マテリアルを <code>depthTest: false</code> にすると、" +
        "この比較をせずに上から塗るので、壁の向こうの目印やゲームの敵の輪郭のように、隠れていても見せられます。" +
        "深度テストが無いと、あとに描いた物が上に来ます。この順番を決めるのが <code>mesh.renderOrder</code> です（初期値 0）。" +
        "小さい値から順に描かれるので、上に出したい物ほど大きい値にします。ただし、不透明な物と半透明な物は別々に並べられます。</p>",
      challenge: {
        starterCode: marker("", "", ""),
        task: "label と base のマテリアルを depthTest: false にして壁の手前に見せ、base.renderOrder = 1、label.renderOrder = 2 で白いラベルを金色の台座の上に出そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "depthTest\\s*:\\s*false|depthTest\\s*=\\s*false" },
          { kind: "sourceMatches", pattern: "renderOrder" },
          // The label on top, the base around it, the wall beyond the base.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [1, 1, 1], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.6458, rgb: [1, 0.84, 0], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.8542, rgb: [0.27, 0.51, 0.71], tol: 0.2 },
            ],
            message: "重なり方が目標と違います。label と base を depthTest: false にして、base.renderOrder = 1、label.renderOrder = 2 にしましょう（中心が白、そのまわりが金色、外は壁の色です）",
          },
        ],
        hints: [
          "new THREE.MeshBasicMaterial({ color: 'white', depthTest: false })",
          "base.renderOrder = 1;\nlabel.renderOrder = 2;",
          "renderOrder が小さいほうが先に描かれ、あとから描いた物が上に重なります",
        ],
        solution: marker(", depthTest: false", ", depthTest: false", "\nbase.renderOrder = 1;\nlabel.renderOrder = 2;  // 大きいほどあとに描かれ、上に重なる\n"),
      },
    },
    {
      id: "three-layers",
      title: "カメラごとに隠す: layers",
      explanation:
        "<p><code>visible = false</code> は、どのカメラからも隠します。カメラごとに見せる物を変えたいときは <b>layers</b> を使います。" +
        "物もカメラも 0〜31 番のレイヤーに所属していて、初期値はどちらも 0 番です。共通のレイヤーが 1つも無い物は、そのカメラには描かれません。" +
        "<code>guide.layers.set(1)</code> で 1番だけに移すと、0番のカメラからは消えますが、シーンには残っています。" +
        "編集用のカメラだけ <code>camera.layers.enable(1)</code> で 1番も見るようにすれば、補助の表示をそのカメラだけに出せます。ライトも同じ判定を受けます。</p>",
      challenge: {
        starterCode: SHAPES,
        task: "guide を scene に入れたまま、guide.layers.set(1) で 1番のレイヤーへ移して、このカメラから隠そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "layers\\s*\\.\\s*(set|enable|toggle)" },
          { kind: "sceneHas", type: "Mesh", min: 2 },
          // The ball stays; the lime frame behind it is gone from this camera.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [1, 0.65, 0], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.7708, rgb: BACKGROUND, tol: 0.2 },
            ],
            message: "緑の枠がまだ見えています。guide.layers.set(1); で 1番のレイヤーへ移しましょう（scene.remove や visible では、シーンに残す練習になりません）",
          },
        ],
        hints: ["guide.layers.set(1);", "カメラは 0番のレイヤーだけを見ています"],
        solution: SHAPES + "\nguide.layers.set(1);  // 1番へ移す（0番のカメラには映らない）\n",
      },
    },
    {
      id: "three-lod",
      title: "遠くは軽く: LOD",
      explanation:
        "<p>遠くの物は画面に小さくしか映らないので、細かい形を使っても頂点の計算がむだになります。<code>THREE.LOD</code>（Level of Detail）は、" +
        "カメラからの距離に応じて、描く形を自動で切り替える入れ物です。<code>lod.addLevel(物, 距離)</code> で「この距離から先はこの形」と登録し、" +
        "<code>scene.add(lod)</code> します。切り替えは描画のたびに自動で行われます。" +
        "ここでは見分けやすいように色も変えていますが、実際には同じ見た目で頂点の数だけを減らします。</p>",
      challenge: {
        starterCode:
          "// 近くの球と遠くの球。いまは、どちらも細かい形のまま\n" +
          "function place(y, z) {\n" +
          `  const detailed = ${NEAR_MESH};\n` +
          "  detailed.position.set(0, y, z);\n" +
          "  scene.add(detailed);\n" +
          "}\n\n" +
          "place(0.8, 2);    // カメラから 3\n" +
          "place(-3, -6);    // カメラから 11\n",
        task: "place の中で THREE.LOD を作り、detailed を距離 0、粗い形 rough を距離 8 に登録して、遠くの球だけ青い粗い形に切り替えよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "addLevel" },
          { kind: "sceneHas", type: "LOD", min: 2 },
          // Near: the detailed red ball. Far: the coarse blue one.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.7292, rgb: [1, 0.39, 0.28], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.2708, rgb: [0.12, 0.56, 1], tol: 0.2 },
            ],
            message: "距離で形が切り替わっていません。lod.addLevel(detailed, 0); と lod.addLevel(rough, 8); を登録し、lod.position を決めて scene.add(lod) しましょう（物ではなく lod のほうを置きます）",
          },
        ],
        hints: [
          "const lod = new THREE.LOD();\nlod.addLevel(detailed, 0);\nlod.addLevel(rough, 8);",
          `const rough = ${FAR_MESH};`,
          "lod.position.set(0, y, z);\nscene.add(lod);",
        ],
        solution:
          "function place(y, z) {\n" +
          `  const detailed = ${NEAR_MESH};\n` +
          `  const rough = ${FAR_MESH};\n` +
          "  const lod = new THREE.LOD();\n" +
          "  lod.addLevel(detailed, 0);  // 距離 0 から\n" +
          "  lod.addLevel(rough, 8);     // 距離 8 から先\n" +
          "  lod.position.set(0, y, z);\n" +
          "  scene.add(lod);\n" +
          "}\n\n" +
          "place(0.8, 2);    // カメラから 3\n" +
          "place(-3, -6);    // カメラから 11\n",
      },
    },
  ],
};
