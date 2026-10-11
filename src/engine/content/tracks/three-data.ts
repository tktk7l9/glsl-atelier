// The three-data track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The texture-repeat lesson's 1×2 stripe texture. */
const STRIPE_TEXTURE =
  "// 縦 2 ピクセルの縞模様（下の段: 白、上の段: 空色）\n" +
  "const data = new Uint8Array([\n" +
  "  255, 255, 255, 255,  // 下の段: 白\n" +
  "  0, 160, 255, 255,    // 上の段: 空色\n" +
  "]);\n" +
  "const tex = new THREE.DataTexture(data, 1, 2);\n" +
  "tex.needsUpdate = true;\n";

const STRIPE_BOARD =
  "const board = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
  ");\n" +
  "scene.add(board);\n";

/** The stripe colours as drawn: the NoColorSpace texel 160/255 is linear. */
const STRIPE_WHITE: [number, number, number] = [1, 1, 1];

const STRIPE_SKY: [number, number, number] = [0, 0.81, 1];

/** The CanvasTexture lesson's picture, drawn with Canvas 2D. */
const CANVAS_DRAWING =
  "// 64×64 の canvas に絵を描く（canvas の座標は左上が原点で、y は下向き）\n" +
  "const canvas = document.createElement('canvas');\n" +
  "canvas.width = 64;\n" +
  "canvas.height = 64;\n" +
  "const ctx = canvas.getContext('2d');\n" +
  "ctx.fillStyle = 'skyblue';\n" +
  "ctx.fillRect(0, 0, 64, 32);    // 上半分: 空\n" +
  "ctx.fillStyle = 'seagreen';\n" +
  "ctx.fillRect(0, 32, 64, 32);   // 下半分: 草原\n" +
  "ctx.fillStyle = 'gold';\n" +
  "ctx.fillRect(46, 6, 10, 10);   // 右上: 太陽\n" +
  "ctx.fillStyle = 'tomato';\n" +
  "ctx.fillRect(24, 20, 16, 16);  // まん中: 赤い家\n";

export const track: Track = {
  id: "three-data",
  domain: "three",
  title: "データで描く: 点とテクスチャ",
  summary: "数値の配列や Canvas 2D から、点の集まりやテクスチャを自分で組み立て、くり返して貼る。",
  icon: "🧮",
  lessons: [
    {
      id: "three-points",
      title: "点の集まり: Points",
      explanation:
        "<p>星やパーティクルのような<b>たくさんの点</b>は <code>Points</code> で描きます。座標は " +
        "<code>Float32Array</code> に <code>x, y, z, x, y, z, …</code> と並べ、" +
        "<code>new THREE.BufferAttribute(配列, 3)</code>（3つの数で 1点）にして " +
        "<code>geometry.setAttribute('position', …)</code> で渡します。見た目は <code>PointsMaterial</code> で決め、" +
        "<code>size</code> が点の大きさです（点は画面に正対する正方形として描かれます）。</p>",
      challenge: {
        starterCode:
          "// 半径 2 の円周上に 12 個の点を並べた座標（x, y, z, x, y, z, …）\n" +
          "const count = 12;\n" +
          "const positions = new Float32Array(count * 3);\n" +
          "for (let i = 0; i < count; i++) {\n" +
          "  const a = (i / count) * Math.PI * 2;\n" +
          "  positions[i * 3] = Math.cos(a) * 2;\n" +
          "  positions[i * 3 + 1] = Math.sin(a) * 2;\n" +
          "  positions[i * 3 + 2] = 0;\n" +
          "}\n\n" +
          "const geo = new THREE.BufferGeometry();\n" +
          "// ① positions を 'position' 属性として geo に渡そう\n\n" +
          "const mat = new THREE.PointsMaterial({ color: 'gold', size: 1.5 });\n" +
          "// ② geo と mat から Points を作って scene に追加しよう\n",
        task: "positions を BufferAttribute にして geo の 'position' に設定し、Points を作って scene に追加しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "setAttribute" },
          { kind: "sceneHas", type: "Points" },
          { kind: "materialOf", material: "PointsMaterial", type: "Points" },
          // The ring's top and bottom points sit on the centre line; its middle is empty.
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [1, 0.84, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: [1, 0.84, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));",
          "const stars = new THREE.Points(geo, mat); scene.add(stars);",
        ],
        solution:
          "const count = 12;\n" +
          "const positions = new Float32Array(count * 3);\n" +
          "for (let i = 0; i < count; i++) {\n" +
          "  const a = (i / count) * Math.PI * 2;\n" +
          "  positions[i * 3] = Math.cos(a) * 2;\n" +
          "  positions[i * 3 + 1] = Math.sin(a) * 2;\n" +
          "  positions[i * 3 + 2] = 0;\n" +
          "}\n" +
          "const geo = new THREE.BufferGeometry();\n" +
          "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
          "const mat = new THREE.PointsMaterial({ color: 'gold', size: 1.5 });\n" +
          "const stars = new THREE.Points(geo, mat);\n" +
          "scene.add(stars);\n",
      },
    },
    {
      id: "three-data-texture",
      title: "コードで作る画像: DataTexture",
      explanation:
        "<p>画像ファイルが無くても、ピクセルの色を数値で並べればテクスチャになります。<code>Uint8Array</code> に" +
        "1ピクセルあたり <code>R, G, B, A</code>（0〜255）を、<b>下の段から</b>左→右の順に並べ、" +
        "<code>new THREE.DataTexture(配列, 幅, 高さ)</code> にします。中身を用意したら " +
        "<code>texture.needsUpdate = true</code> で「GPU に送って」と知らせるのを忘れずに。" +
        "忘れると、テクスチャは真っ黒のままです。</p>",
      challenge: {
        starterCode:
          "// 2×2 ピクセルの画像。1ピクセル = R, G, B, A（0〜255）、下の段から左→右の順\n" +
          "const data = new Uint8Array([\n" +
          "  255, 0, 0, 255,   0, 255, 0, 255,   // 下の段: 赤, 緑\n" +
          "  0, 0, 0, 255,     0, 0, 0, 255,     // 上の段: まだ黒\n" +
          "]);\n" +
          "const tex = new THREE.DataTexture(data, 2, 2);\n\n" +
          "const board = new THREE.Mesh(\n" +
          "  new THREE.PlaneGeometry(4, 4),\n" +
          "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
          ");\n" +
          "scene.add(board);\n",
        task: "上の段を左から青・白にし、tex の needsUpdate を true にしてテクスチャを GPU に送り、4色のタイルを表示しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "needsUpdate" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // The centre line runs through the left column: red below, blue above.
          { kind: "pixelApprox", x: 0.5, y: 0.3, rgb: [1, 0, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.7, rgb: [0, 0, 1], tol: 0.15 },
        ],
        hints: [
          "上の段は 0, 0, 255, 255,   255, 255, 255, 255,",
          "tex.needsUpdate = true;",
        ],
        solution:
          "const data = new Uint8Array([\n" +
          "  255, 0, 0, 255,   0, 255, 0, 255,\n" +
          "  0, 0, 255, 255,   255, 255, 255, 255,\n" +
          "]);\n" +
          "const tex = new THREE.DataTexture(data, 2, 2);\n" +
          "tex.needsUpdate = true;\n" +
          "const board = new THREE.Mesh(\n" +
          "  new THREE.PlaneGeometry(4, 4),\n" +
          "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
          ");\n" +
          "scene.add(board);\n",
      },
    },
    {
      id: "three-texture-repeat",
      title: "模様をくり返す: wrapS・wrapT と repeat",
      explanation:
        "<p>床のタイルや壁紙のように、小さな模様を<b>くり返して</b>貼るときは、テクスチャの <code>repeat</code> で回数を" +
        "決めます。ただし、はみ出した部分の扱いを決める <code>wrapS</code>（横）・<code>wrapT</code>（縦）は、初期値が" +
        "「端の色を引き伸ばす」（<code>ClampToEdgeWrapping</code>）です。<code>THREE.RepeatWrapping</code> に変えないと、" +
        "<code>repeat</code> を設定しても模様はくり返されません。</p>",
      challenge: {
        starterCode: STRIPE_TEXTURE + "\n// ここで、縞模様が縦に 4回くり返されるようにしよう\n\n" + STRIPE_BOARD,
        task: "tex の wrapS と wrapT を THREE.RepeatWrapping にし、repeat を (1, 4) にして、縞模様を縦に 4回くり返そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "RepeatWrapping" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // Eight stripes up the centre line, white at the bottom (checked
          // well inside stripes 0, 1, 3, 4, 6 and 7).
          { kind: "pixelApprox", x: 0.5, y: 0.22, rgb: STRIPE_WHITE, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: STRIPE_SKY, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.47, rgb: STRIPE_SKY, tol: 0.15 },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.53,
            rgb: STRIPE_WHITE,
            tol: 0.15,
            message: "縞模様がくり返されていません。repeat だけでなく、wrapS と wrapT も THREE.RepeatWrapping にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: STRIPE_WHITE, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: STRIPE_SKY, tol: 0.15 },
        ],
        hints: [
          "tex.wrapS = THREE.RepeatWrapping;  tex.wrapT = THREE.RepeatWrapping;",
          "tex.repeat.set(1, 4);  // 横 1回・縦 4回",
        ],
        solution:
          STRIPE_TEXTURE +
          "tex.wrapS = THREE.RepeatWrapping;\n" +
          "tex.wrapT = THREE.RepeatWrapping;\n" +
          "tex.repeat.set(1, 4);\n" +
          STRIPE_BOARD,
      },
    },
    {
      id: "three-canvas-texture",
      title: "コードで描いて貼る: CanvasTexture",
      explanation:
        "<p>画像ファイルが無くても、<code>canvas</code> 要素に Canvas 2D で描いた絵を、そのままテクスチャにできます。" +
        "<code>new THREE.CanvasTexture(canvas)</code> で作り、マテリアルの <code>map</code> に設定します。canvas の色は" +
        "画面の色（sRGB）なので、<code>colorSpace</code> を <code>THREE.SRGBColorSpace</code> にしておくと、描いたとおりの色で" +
        "表示されます（指定しないと白っぽく浮きます）。文字やグラフ、ラベルを 3D に貼るときの定番の方法です。</p>",
      challenge: {
        starterCode:
          CANVAS_DRAWING +
          "\n// ここで canvas から CanvasTexture を作り、板のマテリアルの map に設定しよう\n" +
          "const board = new THREE.Mesh(\n" +
          "  new THREE.PlaneGeometry(4, 4),\n" +
          "  new THREE.MeshBasicMaterial({ color: 'white' }),\n" +
          ");\n" +
          "scene.add(board);\n",
        task: "canvas から CanvasTexture を作って colorSpace を THREE.SRGBColorSpace にし、板のマテリアルの map に設定しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "new THREE\\.CanvasTexture" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // The picture up the centre line, in the colours it was drawn in.
          { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: [0.53, 0.81, 0.92], tol: 0.15 },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.53,
            rgb: [1, 0.39, 0.28],
            tol: 0.15,
            message:
              "canvas の絵が、描いたとおりの色で貼られていません。map に CanvasTexture を設定し、colorSpace を THREE.SRGBColorSpace にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.18, 0.55, 0.34], tol: 0.15 },
        ],
        hints: [
          "const tex = new THREE.CanvasTexture(canvas);  tex.colorSpace = THREE.SRGBColorSpace;",
          "new THREE.MeshBasicMaterial({ map: tex })",
        ],
        solution:
          CANVAS_DRAWING +
          "const tex = new THREE.CanvasTexture(canvas);\n" +
          "tex.colorSpace = THREE.SRGBColorSpace;  // canvas の色は画面の色（sRGB）\n" +
          "const board = new THREE.Mesh(\n" +
          "  new THREE.PlaneGeometry(4, 4),\n" +
          "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
          ");\n" +
          "scene.add(board);\n",
      },
    },
  ],
};
