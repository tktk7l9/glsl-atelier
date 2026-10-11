// The three-vertices track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The triangle lesson: a square's first triangle, and `second` after it.
 *  The centre column runs through both halves (at 1:1 and at 16:9), clear of
 *  the diagonal between them at the rows the checks read. */
const TRIANGLES_SCENE = (second: string): string =>
  "// 頂点の座標（x, y, z）。3つの頂点ごとに三角形 1枚\n" +
  "const positions = new Float32Array([\n" +
  "  -1.5, -1.5, 0,  // 左下\n" +
  "   1.5, -1.5, 0,  // 右下\n" +
  "   1.5,  1.5, 0,  // 右上\n" +
  second +
  "]);\n\n" +
  "const geo = new THREE.BufferGeometry();\n" +
  "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
  "const square = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 'tomato' }));\n" +
  "scene.add(square);\n";

/** The index lesson: the square's four corners, and `index` after them. */
const INDEX_SCENE = (index: string): string =>
  "// 正方形の 4つの角。番号は並べた順に 0, 1, 2, 3\n" +
  "const positions = new Float32Array([\n" +
  "  -1.5, -1.5, 0,  // 0: 左下\n" +
  "   1.5, -1.5, 0,  // 1: 右下\n" +
  "   1.5,  1.5, 0,  // 2: 右上\n" +
  "  -1.5,  1.5, 0,  // 3: 左上\n" +
  "]);\n\n" +
  "const geo = new THREE.BufferGeometry();\n" +
  "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
  index +
  "\n" +
  "const square = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(square);\n";

/** The vertex-colour lesson: a triangle (apex up), `colors` for its corners
 *  and the mesh made with `material`. */
const RGB_TRIANGLE = (colors: string, material: string): string =>
  "// 三角形の 3つの頂点（上・左下・右下）\n" +
  "const positions = new Float32Array([\n" +
  "   0.0,  1.8, 0,  // 上\n" +
  "  -2.2, -1.6, 0,  // 左下\n" +
  "   2.2, -1.6, 0,  // 右下\n" +
  "]);\n\n" +
  "const geo = new THREE.BufferGeometry();\n" +
  "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
  colors +
  "\n" +
  `const tri = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(${material}));\n` +
  "scene.add(tri);\n";

const TOMATO: [number, number, number] = [1, 0.39, 0.28];

const GOLD: [number, number, number] = [1, 0.84, 0];

export const track: Track = {
  id: "three-vertices",
  domain: "three",
  title: "頂点から形をつくる",
  summary: "頂点の座標を数値で並べて三角形の面を張り、番号（index）で頂点を使い回し、頂点ごとの色でグラデーションにする。",
  icon: "🔺",
  lessons: [
    {
      id: "three-triangles",
      title: "三角形で面を張る: BufferGeometry",
      explanation:
        "<p>3D の形は、どれも小さな<b>三角形</b>の集まりです。<code>BufferGeometry</code> の <code>position</code> 属性に頂点の座標を <code>x, y, z</code> の順に並べると、" +
        "<b>3つの頂点ごとに 1枚</b>の三角形が張られます（「データで描く」の Points と同じ渡し方です）。四角形は三角形 2枚で作ります。このとき頂点の<b>順番</b>が大切で、" +
        "正面から見て<b>反時計回り</b>に並んだ面が「表」です。マテリアルは初期設定（<code>side: THREE.FrontSide</code>）では表だけを描くので、時計回りに並べた三角形は" +
        "裏を向いていると見なされ、見えません。</p>",
      mdnPath: "/en-US/docs/Web/API/WebGLRenderingContext/frontFace",
      challenge: {
        starterCode: TRIANGLES_SCENE("  // ここに 2枚目の三角形の頂点を 3つ足して、正方形にしよう\n"),
        task: "2枚目の三角形の頂点を、左下 → 右上 → 左上 の順（正面から見て反時計回り）に 3つ足して、正方形にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sceneHas", type: "Mesh" },
          { kind: "geometryOf", geometry: "BufferGeometry", type: "Mesh" },
          {
            kind: "verticesAtLeast",
            min: 6,
            type: "Mesh",
            message: "三角形 2枚ぶん、6つの頂点が必要です。2枚目の三角形の頂点を 3つ足しましょう",
          },
          // Up the centre line: the upper-left half (the second triangle),
          // the lower-right half (the first) and the sky above the square.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: TOMATO,
            tol: 0.15,
            message: "正方形の左上の半分が見えません。2枚目の三角形は、正面から見て反時計回り（左下 → 右上 → 左上）の順に並べましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: TOMATO, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "左下 (-1.5, -1.5, 0)、右上 (1.5, 1.5, 0)、左上 (-1.5, 1.5, 0) の順に足します",
          "時計回りに並べると裏向きになり、表だけを描くマテリアルでは見えません",
        ],
        solution: TRIANGLES_SCENE(
          "  -1.5, -1.5, 0,  // 左下\n" +
            "   1.5,  1.5, 0,  // 右上\n" +
            "  -1.5,  1.5, 0,  // 左上（左下 → 右上 → 左上 で反時計回り）\n",
        ),
      },
    },
    {
      id: "three-index",
      title: "頂点を使い回す: setIndex",
      explanation:
        "<p>前のレッスンの正方形は、角が 4つしかないのに頂点を 6つ書きました（左下と右上が 2回ずつ）。形が複雑になるほど、このむだは大きくなります。そこで、角の座標は" +
        "<b>1回ずつ</b>だけ並べ、三角形は<b>頂点の番号</b>で指定します。それが <code>geo.setIndex([…])</code> で、番号 3つで三角形 1枚です。番号は position に並べた順に " +
        "0, 1, 2, … と数えます。番号が無いときは、頂点が先頭から 3つずつ使われます。ここでも、番号の並びは正面から見て<b>反時計回り</b>にします。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Creating_3D_objects_using_WebGL",
      challenge: {
        starterCode: INDEX_SCENE(
          "// ここで、頂点の番号で三角形 2枚（0 → 1 → 2 と 0 → 2 → 3）を指定しよう\n" +
            "// （いまは番号が無いので頂点が先頭から 3つずつ使われ、4つ目は余っている）\n",
        ),
        task: "geo.setIndex([0, 1, 2, 0, 2, 3]) で、4つの頂点を使い回す三角形 2枚を指定して、金色の正方形にしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "setIndex\\s*\\(",
            message: "geo.setIndex([…]) で、頂点の番号から三角形を指定しましょう",
          },
          { kind: "geometryOf", geometry: "BufferGeometry", type: "Mesh" },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: GOLD,
            tol: 0.15,
            message: "正方形の左上の半分が見えません。2枚目の三角形を、反時計回りの番号（0 → 2 → 3）で指定しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: GOLD, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "geo.setIndex([0, 1, 2, 0, 2, 3]);",
          "0 → 2 → 3 は 左下 → 右上 → 左上 なので、反時計回りです",
        ],
        solution: INDEX_SCENE(
          "geo.setIndex([\n" +
            "  0, 1, 2,  // 右下の三角形\n" +
            "  0, 2, 3,  // 左上の三角形（どちらも反時計回り）\n" +
            "]);\n",
        ),
      },
    },
    {
      id: "three-vertex-colors",
      title: "頂点ごとの色: color 属性",
      explanation:
        "<p>頂点には座標のほかに<b>色</b>も持たせられます。<code>color</code> 属性に頂点ごとの <code>R, G, B</code> を <b>position と同じ順番</b>で並べ、マテリアルに " +
        "<code>vertexColors: true</code> を指定します。値は DataTexture の 0〜255 とは違い、<code>Float32Array</code> に 0〜1 で書きます。三角形の内側の色は、3つの頂点の色から" +
        "近さに応じて<b>なめらかに補間</b>されます。WebGL が三角形を塗るときの基本のしくみで、赤・緑・青の頂点を持つ三角形は、グラフィックス入門の「Hello Triangle」として" +
        "おなじみです。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Using_shaders_to_apply_color_in_WebGL",
      challenge: {
        starterCode: RGB_TRIANGLE(
          "// ここで、頂点ごとの色（上: 赤、左下: 緑、右下: 青）を 'color' 属性にしよう\n" +
            "// そのあと、マテリアルが頂点の色を使うように設定しよう\n",
          "{ color: 'white' }",
        ),
        task: "color 属性に頂点ごとの色（上: 赤、左下: 緑、右下: 青）を position と同じ順番で 0〜1 で並べ、マテリアルに vertexColors: true を指定しよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "vertexColors",
            message: "マテリアルに vertexColors: true を指定して、頂点の色を使いましょう",
          },
          { kind: "geometryOf", geometry: "BufferGeometry", type: "Mesh" },
          // Down the centre line the colours blend from the red apex to the
          // green and blue base. The column sits a little left of centre, by
          // a different amount at 1:1 and 16:9; the targets lie between the
          // two, within 0.04 of each.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: [0.87, 0.47, 0.3],
            message:
              "上の頂点のまわりが赤くなっていません。色は position と同じ順番（上: 赤、左下: 緑、右下: 青）に 0〜1 で並べ、マテリアルに vertexColors: true を指定しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.53, rgb: [0.75, 0.58, 0.46] },
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: [0.49, 0.7, 0.62] },
          { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: BACKGROUND, tol: 0.15 },
        ],
        hints: [
          "const colors = new Float32Array([1, 0, 0,  0, 1, 0,  0, 0, 1]);\ngeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));",
          "new THREE.MeshBasicMaterial({ vertexColors: true })",
        ],
        solution: RGB_TRIANGLE(
          "// 頂点ごとの色 R, G, B（0〜1）を、position と同じ順番で\n" +
            "const colors = new Float32Array([\n" +
            "  1, 0, 0,  // 上: 赤\n" +
            "  0, 1, 0,  // 左下: 緑\n" +
            "  0, 0, 1,  // 右下: 青\n" +
            "]);\n" +
            "geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));\n",
          "{ vertexColors: true }",
        ),
      },
    },
  ],
};
