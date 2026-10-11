// The three-uv track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** A 2×2 image (rows bottom up: red, green / blue, yellow). Its texels are 0
 *  or 255, so they show as drawn whatever the colour space. */
const RGBY_TEXTURE =
  "// 2×2 ピクセルの画像（下の段: 赤・緑、上の段: 青・黄）\n" +
  "const data = new Uint8Array([\n" +
  "  255, 0, 0, 255,   0, 255, 0, 255,    // 下の段: 赤, 緑\n" +
  "  0, 0, 255, 255,   255, 255, 0, 255,  // 上の段: 青, 黄\n" +
  "]);\n" +
  "const tex = new THREE.DataTexture(data, 2, 2);\n" +
  "tex.needsUpdate = true;\n";

/** The uv lesson: the image, the square's corners, `uvs`, the line(s) `wire`
 *  that pass them on, and the mesh with `material` (after `note`). */
const UV_SQUARE = (uvs: string, wire: string, material: string, note = ""): string =>
  RGBY_TEXTURE +
  "\n// 正方形の 4つの角（0: 左下, 1: 右下, 2: 右上, 3: 左上）\n" +
  "const positions = new Float32Array([\n" +
  "  -1.5, -1.5, 0,   1.5, -1.5, 0,   1.5, 1.5, 0,   -1.5, 1.5, 0,\n" +
  "]);\n" +
  "// 各頂点に、画像のどこが来るか（u: 横 0〜1、v: 縦 0〜1）\n" +
  "const uvs = new Float32Array([\n" +
  uvs +
  "]);\n" +
  "const geo = new THREE.BufferGeometry();\n" +
  "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
  wire +
  "geo.setIndex([0, 1, 2, 0, 2, 3]);\n\n" +
  note +
  `const square = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(${material}));\n` +
  "scene.add(square);\n";

/** An 8×8 sprite sheet: four 4×4 cells, each a 2×2 picture (a bottom and a
 *  top row colour) inside a one-texel margin in the background colour, the
 *  usual sprite-sheet padding. Drawn antialiased, a pixel on the board's edge
 *  is shaded a little outside it, where the uv steps over into the next cell:
 *  the margin keeps that from showing as a line of the neighbour's colour.
 *  Cells: bottom left red / green, bottom right white / orange, top left
 *  blue / cyan, top right magenta / yellow. */
const SHEET_TEXTURE =
  "// 8×8 ピクセルの画像に、4×4 ピクセルのコマが 4つ。どのコマも、内側の 2×2 に絵があり、\n" +
  "// まわり 1ピクセルは背景と同じ色の余白（_）になっている（下の段から 1行ずつ）\n" +
  "const _ = [5, 6, 13], R = [255, 0, 0], G = [0, 255, 0], W = [255, 255, 255], O = [255, 128, 0];\n" +
  "const B = [0, 0, 255], C = [0, 255, 255], M = [255, 0, 255], Y = [255, 255, 0];\n" +
  "const rows = [\n" +
  "  [_, _, _, _, _, _, _, _],\n" +
  "  [_, R, R, _, _, W, W, _],  // 左下のコマ: 赤／緑、右下のコマ: 白／橙\n" +
  "  [_, G, G, _, _, O, O, _],\n" +
  "  [_, _, _, _, _, _, _, _],\n" +
  "  [_, _, _, _, _, _, _, _],\n" +
  "  [_, B, B, _, _, M, M, _],  // 左上のコマ: 青／水色、右上のコマ: 赤紫／黄\n" +
  "  [_, C, C, _, _, Y, Y, _],\n" +
  "  [_, _, _, _, _, _, _, _],\n" +
  "];\n" +
  "const data = new Uint8Array(rows.flat().flatMap((c) => [...c, 255]));\n" +
  "const tex = new THREE.DataTexture(data, 8, 8);\n" +
  "tex.needsUpdate = true;\n";

const TEXTURED_PLANE =
  "const board = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
  ");\n" +
  "scene.add(board);\n";

const RED: [number, number, number] = [1, 0, 0];
const BLUE: [number, number, number] = [0, 0, 1];
const MAGENTA: [number, number, number] = [1, 0, 1];
const YELLOW: [number, number, number] = [1, 1, 0];

export const track: Track = {
  id: "three-uv",
  domain: "three",
  title: "テクスチャ座標（UV）",
  summary: "頂点ごとの uv で画像の貼り方を決め、repeat と offset で画像の一部（スプライトシートの 1コマ）を取り出し、rotation と center で画像を回す。",
  icon: "🗺️",
  lessons: [
    {
      id: "three-uv",
      title: "画像の貼り方を決める: uv 属性",
      explanation:
        "<p>テクスチャ（画像）を形に貼るとき、各頂点に<b>画像のどこが来るか</b>を決めるのが <b>uv 座標</b>です。<code>u</code> が画像の横（左 0〜右 1）、" +
        "<code>v</code> が縦（下 0〜上 1）で、頂点ごとに <code>u, v</code> の 2つの数を position と同じ順番で並べ、" +
        "<code>geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))</code> で渡します（2つの数で 1頂点）。三角形の内側の uv は、頂点の色と同じように" +
        "補間されます。PlaneGeometry などの組み込みの形には最初から uv が入っていますが、自分で頂点を並べた形では自分で決めます。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL",
      challenge: {
        starterCode: UV_SQUARE(
          "  0, 0,  // 0: 左下 → 画像の左下\n" +
            "  1, 0,  // 1: 右下 → 画像の右下\n" +
            "  1, 0,  // 2: 右上 → いまは画像の右下のまま\n" +
            "  0, 0,  // 3: 左上 → いまは画像の左下のまま\n",
          "// ここで、右上と左上の v を直してから、uvs を 'uv' 属性として渡そう\n",
          "{ color: 'white' }",
          "// ここで、マテリアルの map に tex を設定しよう（いまは白い板）\n",
        ),
        task: "右上の頂点の uv を (1, 1)、左上を (0, 1) にし、uvs を 'uv' 属性として渡して、マテリアルの map に tex を設定し、画像全体を正方形に貼ろう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "setAttribute\\(\\s*['\"]uv['\"]",
            message: "geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)) で、uv を頂点に渡しましょう",
          },
          { kind: "geometryOf", geometry: "BufferGeometry", type: "Mesh" },
          // Up the centre line (the left half of the image): red below, blue above.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.34,
            rgb: RED,
            tol: 0.15,
            message: "正方形の下半分に、画像の下の段（赤）が貼られていません。uv の v は、下の頂点で 0、上の頂点で 1 です",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: BLUE,
            tol: 0.15,
            message: "正方形の上半分に、画像の上の段（青）が貼られていません。右上の uv を (1, 1)、左上を (0, 1) にして、map に tex を設定しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "右上は 1, 1、左上は 0, 1 にします",
          "geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));  と  new THREE.MeshBasicMaterial({ map: tex })",
        ],
        solution: UV_SQUARE(
          "  0, 0,  // 0: 左下 → 画像の左下\n" +
            "  1, 0,  // 1: 右下 → 画像の右下\n" +
            "  1, 1,  // 2: 右上 → 画像の右上\n" +
            "  0, 1,  // 3: 左上 → 画像の左上\n",
          "geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));  // 2つの数で 1頂点\n",
          "{ map: tex }",
        ),
      },
    },
    {
      id: "three-texture-atlas",
      title: "画像の一部を貼る: repeat と offset",
      explanation:
        "<p>小さな絵を何枚も 1枚の画像に並べたものを<b>スプライトシート</b>（テクスチャアトラス）と呼びます。画像を 1枚にまとめると、読み込みも切り替えも速くなるので、" +
        "ゲームのキャラクターのコマやアイコンでよく使われます。そこから 1コマだけを貼るには、テクスチャの <code>repeat</code> で<b>画像の何分の1を貼るか</b>、" +
        "<code>offset</code> で<b>どこから貼るか</b>を決めます。2×2 に並んだコマなら、<code>repeat.set(0.5, 0.5)</code> で縦横半分、<code>offset.set(0.5, 0.5)</code> で" +
        "右上のコマです（offset も uv と同じく、左下が 0、右上が 1）。スプライトシートでは、コマのまわりに余白を空けておくのが定番です。" +
        "ふちのピクセルを描くとき、となりのコマの色がほんの少しにじむのを防ぐためで、この画像も、どのコマもまわり 1ピクセルが背景と同じ色の余白です。</p>",
      challenge: {
        starterCode:
          SHEET_TEXTURE + "\n// ここで、右上のコマ（下が赤紫・上が黄）だけが貼られるように、貼る範囲と位置を変えよう\n\n" + TEXTURED_PLANE,
        task: "tex.repeat を (0.5, 0.5)、tex.offset を (0.5, 0.5) にして、スプライトシートの右上のコマ（下が赤紫・上が黄）だけを板に貼ろう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "offset", message: "tex.offset で、貼り始める位置を決めましょう" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // Up the centre line: the cell's bottom row (magenta) just below the
          // middle of the board, its top row (yellow) just above; the margin
          // round the cell is further out. Repeat alone shows the bottom-left
          // cell, offset alone the cell's own margin here, offset (0, 0.5) the
          // top-left cell.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.41,
            rgb: MAGENTA,
            tol: 0.15,
            message: "右上のコマが貼られていません。repeat を (0.5, 0.5) にして画像の 4分の1 を貼り、offset を (0.5, 0.5) にして右上へ移しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.59,
            rgb: YELLOW,
            tol: 0.15,
            message: "コマの上半分（黄）が貼られていません。repeat も offset も (0.5, 0.5) にしましょう",
          },
        ],
        hints: ["tex.repeat.set(0.5, 0.5);  // 縦横とも半分だけ貼る", "tex.offset.set(0.5, 0.5);  // 右上のコマから"],
        solution:
          SHEET_TEXTURE +
          "tex.repeat.set(0.5, 0.5);  // 画像の縦横半分だけを貼る\n" +
          "tex.offset.set(0.5, 0.5);  // 右上のコマから\n" +
          TEXTURED_PLANE,
      },
    },
    {
      id: "three-texture-rotation",
      title: "画像を回す: rotation と center",
      explanation:
        "<p>テクスチャは、形を回さずに<b>画像だけを回す</b>こともできます。<code>tex.rotation</code> に角度（ラジアン）を入れると、正の値で反時計回りに回ります。" +
        "ただし回転の中心は、初期値では画像の左下（<code>center</code> が (0, 0)）なので、そのままだと画像が角を軸にずれて回ります。" +
        "<code>tex.center.set(0.5, 0.5)</code> で中心を画像のまん中にしてから回すと、その場でくるりと回ります。90° は <code>Math.PI / 2</code> です" +
        "（<code>90</code> と書くと 90 ラジアンになってしまいます）。</p>",
      challenge: {
        starterCode: RGBY_TEXTURE + "\n// ここで、画像のまん中を中心にして、画像を反時計回りに 90° 回そう\n\n" + TEXTURED_PLANE,
        task: "tex.center を (0.5, 0.5) にし、tex.rotation を Math.PI / 2 にして、画像をまん中を中心に反時計回りに 90° 回そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "rotation", message: "tex.rotation で、画像を回す角度を決めましょう" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // Turned a quarter anticlockwise about its middle, the image's left
          // column is blue (below) and yellow (above).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: BLUE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: YELLOW, tol: 0.15 },
            ],
            message:
              "画像が、まん中を中心に反時計回りに 90° 回っていません。center を (0.5, 0.5) にしてから、rotation を Math.PI / 2（ラジアン）にしましょう",
          },
        ],
        hints: ["tex.center.set(0.5, 0.5);  // 回転の中心を画像のまん中に", "tex.rotation = Math.PI / 2;  // 反時計回りに 90°"],
        solution:
          RGBY_TEXTURE +
          "tex.center.set(0.5, 0.5);    // 回転の中心を画像のまん中に\n" +
          "tex.rotation = Math.PI / 2;  // 反時計回りに 90°（ラジアン）\n" +
          TEXTURED_PLANE,
      },
    },
  ],
};
