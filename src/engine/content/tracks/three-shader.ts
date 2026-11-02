// The three-shader track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

const PLAIN_VERTEX =
  "const vertexShader = `\n" +
  "  varying vec2 vUv;\n" +
  "  void main() {\n" +
  "    vUv = uv;\n" +
  "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
  "  }\n" +
  "`;\n";

const BOARD =
  "const board = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  "  new THREE.ShaderMaterial({ vertexShader, fragmentShader }),\n" +
  ");\n" +
  "scene.add(board);\n";

/** The ribbon of the vertex lesson: tall, with many rows of vertices to bend. */
const RIBBON =
  "const fragmentShader = `\n" +
  "  void main() {\n" +
  "    gl_FragColor = vec4(1.0);  // 白\n" +
  "  }\n" +
  "`;\n\n" +
  "// 細長い帯（縦に 64 分割。頂点が多いほど、なめらかに曲がる）\n" +
  "const ribbon = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(1.6, 5, 1, 64),\n" +
  "  new THREE.ShaderMaterial({ vertexShader, fragmentShader }),\n" +
  ");\n" +
  "scene.add(ribbon);\n";

const ribbonVertex = (lines: string): string =>
  "const vertexShader = `\n" +
  "  void main() {\n" +
  "    vec3 p = position;\n" +
  lines +
  "    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);\n" +
  "  }\n" +
  "`;\n\n";

/** The texture lesson: a 2×2 image (row 0 is the bottom), drawn with hard edges. */
const TILES =
  "// 2×2 の画像（下の段: 赤・緑、上の段: 青・白）\n" +
  "const data = new Uint8Array([\n" +
  "  255, 0, 0, 255,    0, 255, 0, 255,\n" +
  "  0, 0, 255, 255,    255, 255, 255, 255,\n" +
  "]);\n" +
  "const tex = new THREE.DataTexture(data, 2, 2);\n" +
  "tex.needsUpdate = true;\n\n";

const textureBoard = (uniforms: string): string =>
  "const board = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  `  new THREE.ShaderMaterial({ ${uniforms}vertexShader, fragmentShader }),\n` +
  ");\n" +
  "scene.add(board);\n";

const textureFragment = (body: string): string =>
  "const fragmentShader = `\n" +
  "  uniform sampler2D uMap;\n" +
  "  varying vec2 vUv;\n" +
  "  void main() {\n" +
  body +
  "  }\n" +
  "`;\n\n";

/** A plane 4 tall seen from 5 away shows v = (y - 0.5) · 1.443 + 0.5, so the
 *  rows at y 0.6875 and 0.3125 show v 0.77 and 0.23. */
const BANDS_V_TOP = 0.75;
const BANDS_V_BOTTOM = 0.25;

export const track: Track = {
  id: "three-shader",
  domain: "three",
  title: "シェーダーを使いこなす",
  summary: "varying で頂点から色へ値を渡し、頂点シェーダーで形を曲げ、sampler2D で画像を読み、GLSL ES 3.00 に書きかえる。",
  icon: "🧪",
  lessons: [
    {
      id: "three-varying",
      title: "頂点から色へ渡す: varying",
      explanation:
        "<p>シェーダーは 2つで 1組です。<b>頂点シェーダー</b>は頂点ごとに 1回、<b>フラグメントシェーダー</b>はピクセルごとに 1回動きます。" +
        "頂点のもつ値を色の計算で使うには、両方に同じ名前の <code>varying</code> を書き、頂点シェーダーで値を入れます。" +
        "すると 3つの頂点の値が三角形の内側で補間されて、ピクセルごとに届きます。Three.js の <code>ShaderMaterial</code> では、" +
        "ジオメトリの <code>uv</code> 属性が <code>position</code> と同じく宣言なしで使えるので、<code>vUv = uv;</code> と書くだけで渡せます。</p>",
      challenge: {
        starterCode:
          "const vertexShader = `\n" +
          "  void main() {\n" +
          "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
          "  }\n" +
          "`;\n" +
          "const fragmentShader = `\n" +
          "  void main() {\n" +
          "    gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0);  // いまはどこも同じ灰色\n" +
          "  }\n" +
          "`;\n\n" +
          BOARD,
        task: "varying vec2 vUv を両方のシェーダーに宣言し、頂点シェーダーで vUv = uv; を入れて、色を vec4(vUv, 0.0, 1.0) にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "varying\\s+vec2" },
          { kind: "materialOf", material: "ShaderMaterial" },
          // Up the centre line: red stays at u = 0.5 while green follows v.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.8125, rgb: [0.56, 0.91, 0], tol: 0.12 },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [0.56, 0.55, 0], tol: 0.12 },
              { kind: "pixelApprox", x: 0.5208, y: 0.1875, rgb: [0.56, 0, 0], tol: 0.12 },
            ],
            message: "板の色が目標と違います。頂点シェーダーで vUv = uv; を入れ、色を vec4(vUv, 0.0, 1.0) にしましょう（上に行くほど緑が強くなります）",
          },
        ],
        hints: [
          "varying vec2 vUv; を、頂点シェーダーとフラグメントシェーダーの両方の先頭に書きます",
          "頂点シェーダーの main に vUv = uv; を足します",
          "gl_FragColor = vec4(vUv, 0.0, 1.0);",
        ],
        solution:
          PLAIN_VERTEX +
          "const fragmentShader = `\n" +
          "  varying vec2 vUv;\n" +
          "  void main() {\n" +
          "    gl_FragColor = vec4(vUv, 0.0, 1.0);\n" +
          "  }\n" +
          "`;\n\n" +
          BOARD,
      },
    },
    {
      id: "three-vertex-wave",
      title: "頂点シェーダーで曲げる: position をずらす",
      explanation:
        "<p>「頂点を動かす変形」のレッスンでは、JS で <code>position</code> 属性を書き換えました。同じことは<b>頂点シェーダー</b>でもできます。" +
        "属性 <code>position</code> は読み取り専用なので、<code>vec3 p = position;</code> と写してからずらし、<code>gl_Position</code> の計算に " +
        "<code>p</code> を使います。計算は GPU が頂点ごとに行うので、頂点が何万あっても JS の書き換えより軽く動かせます。" +
        "時間の uniform を足せば、毎フレーム <code>uniforms.uTime.value</code> を更新するだけで波が流れます。</p>",
      challenge: {
        starterCode:
          ribbonVertex("    // ここで p.x を、高さ position.y に応じて左右にずらそう\n") + RIBBON,
        task: "頂点シェーダーで p.x += sin(position.y * 1.5) * 1.5; を足して、帯を S 字に曲げよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "sin\\s*\\(" },
          { kind: "materialOf", material: "ShaderMaterial" },
          // The band sits 1.5 to the right at y = 1.05 and 1.5 to the left at
          // y = -1.05, and is back in the middle at y = 0. The columns at 0.3542
          // and 0.6458 are inside the band there at both preview shapes, and it
          // has left the centre line, which a small bend would not.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6458, y: 0.6875, rgb: [1, 1, 1], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.6875, rgb: BACKGROUND, tol: 0.2 },
              { kind: "pixelApprox", x: 0.3542, y: 0.6875, rgb: BACKGROUND, tol: 0.2 },
              { kind: "pixelApprox", x: 0.3542, y: 0.3125, rgb: [1, 1, 1], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: BACKGROUND, tol: 0.2 },
              { kind: "pixelApprox", x: 0.6458, y: 0.3125, rgb: BACKGROUND, tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [1, 1, 1], tol: 0.2 },
            ],
            message: "帯が S 字に曲がっていません。p.x に sin(position.y * 1.5) * 1.5 を足し、gl_Position の計算で p を使いましょう（上は右へ、下は左へふくらみます）",
          },
        ],
        hints: [
          "p.x += sin(position.y * 1.5) * 1.5;",
          "position は書き換えられません。写した p のほうをずらします",
          "gl_Position の中身が position のままだと、ずらした分が使われません",
        ],
        solution: ribbonVertex("    p.x += sin(position.y * 1.5) * 1.5;  // 高さに応じて左右へ\n") + RIBBON,
      },
    },
    {
      id: "three-shader-texture",
      title: "シェーダーで画像を読む: sampler2D",
      explanation:
        "<p>テクスチャも uniform で渡します。JS 側は <code>uniforms: { uMap: { value: tex } }</code>、GLSL 側は " +
        "<code>uniform sampler2D uMap;</code> です。フラグメントシェーダーで <code>texture2D(uMap, vUv)</code> と書くと、" +
        "その位置の色が <code>vec4</code> で返ります。読んだ色は普通の値なので、計算し放題です。" +
        "<code>1.0 - c.rgb</code> なら色が反転し、GLSL トラックのフィルタがそのまま画像に使えます。</p>",
      challenge: {
        starterCode:
          TILES +
          PLAIN_VERTEX +
          textureFragment("    // ここで uMap から色を読み、反転して出そう\n    gl_FragColor = vec4(vUv, 0.0, 1.0);\n") +
          textureBoard(""),
        task: "uniforms で uMap に tex を渡し、texture2D(uMap, vUv) で読んだ色の rgb を 1.0 から引いて反転しよう（alpha は 1.0）。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "uMap\\s*:" },
          { kind: "sourceMatches", pattern: "texture2D|texture\\s*\\(" },
          { kind: "materialOf", material: "ShaderMaterial" },
          // The four tiles, turned into their complements: the filtered image
          // keeps its flat colours near the corners of the plane.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3958, y: 0.2292, rgb: [0, 1, 1], tol: 0.25 },
              { kind: "pixelApprox", x: 0.6042, y: 0.2292, rgb: [1, 0, 1], tol: 0.25 },
              { kind: "pixelApprox", x: 0.3958, y: 0.7708, rgb: [1, 1, 0], tol: 0.25 },
              { kind: "pixelApprox", x: 0.6042, y: 0.7708, rgb: [0, 0, 0], tol: 0.25 },
            ],
            message: "4色のタイルが反転していません。uMap から読んだ色 c の rgb を 1.0 - c.rgb にしましょう（赤はシアン、白は黒になります）",
          },
        ],
        hints: [
          "new THREE.ShaderMaterial({ uniforms: { uMap: { value: tex } }, vertexShader, fragmentShader })",
          "vec4 c = texture2D(uMap, vUv);",
          "gl_FragColor = vec4(1.0 - c.rgb, 1.0);",
        ],
        solution:
          TILES +
          PLAIN_VERTEX +
          textureFragment("    vec4 c = texture2D(uMap, vUv);\n    gl_FragColor = vec4(1.0 - c.rgb, 1.0);  // 色を反転\n") +
          textureBoard("uniforms: { uMap: { value: tex } }, "),
      },
    },
    {
      id: "three-glsl3",
      title: "新しい書き方へ: GLSL ES 3.00",
      explanation:
        "<p>Three.js の描画は WebGL 2 で動いているので、シェーダーは新しい <b>GLSL ES 3.00</b> でも書けます。" +
        "マテリアルに <code>glslVersion: THREE.GLSL3</code> を指定すると、次のように書き方が変わります。" +
        "<code>varying</code> は、送る頂点側が <code>out</code>、受ける色側が <code>in</code> に分かれます。" +
        "<code>gl_FragColor</code> の代わりに、自分で <code>out vec4 fragColor;</code> を宣言して、そこへ書き込みます。" +
        "<code>texture2D</code> は <code>texture</code> になり、WebGL 1 の GLSL に無かった <code>round</code> のような関数も使えます。" +
        "先頭の <code>#version 300 es</code> は Three.js が付けるので、書きません。</p>",
      challenge: {
        starterCode:
          "const vertexShader = `\n" +
          "  varying vec2 vUv;\n" +
          "  void main() {\n" +
          "    vUv = uv;\n" +
          "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
          "  }\n" +
          "`;\n" +
          "const fragmentShader = `\n" +
          "  varying vec2 vUv;\n" +
          "  void main() {\n" +
          "    float v = vUv.y;  // いまはなめらかなグラデーション\n" +
          "    gl_FragColor = vec4(vec3(v), 1.0);\n" +
          "  }\n" +
          "`;\n\n" +
          BOARD,
        task: "glslVersion: THREE.GLSL3 を指定して in / out の書き方に直し、v を round(vUv.y * 4.0) / 4.0 にして、5段の帯にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "glslVersion\\s*:\\s*THREE\\.GLSL3" },
          { kind: "sourceMatches", pattern: "\\bround\\s*\\(" },
          { kind: "materialOf", material: "ShaderMaterial" },
          // v rounds to the nearest quarter: flat bands, not a gradient. A
          // shader that fails to compile draws nothing at all.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.6875, rgb: [BANDS_V_TOP, BANDS_V_TOP, BANDS_V_TOP], tol: 0.05 },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [0.5, 0.5, 0.5], tol: 0.05 },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: [BANDS_V_BOTTOM, BANDS_V_BOTTOM, BANDS_V_BOTTOM], tol: 0.05 },
            ],
            message: "帯の明るさが目標と違います。シェーダーのエラーが出ていないか確かめて、v = round(vUv.y * 4.0) / 4.0 にしましょう（GLSL3 では varying を in / out に、gl_FragColor を自分の out 変数に直します）",
          },
        ],
        hints: [
          "new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader })",
          "頂点シェーダーは out vec2 vUv;、フラグメントシェーダーは in vec2 vUv; です",
          "フラグメントシェーダーの先頭に out vec4 fragColor; を宣言し、fragColor に書き込みます",
        ],
        solution:
          "const vertexShader = `\n" +
          "  out vec2 vUv;\n" +
          "  void main() {\n" +
          "    vUv = uv;\n" +
          "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
          "  }\n" +
          "`;\n" +
          "const fragmentShader = `\n" +
          "  in vec2 vUv;\n" +
          "  out vec4 fragColor;\n" +
          "  void main() {\n" +
          "    float v = round(vUv.y * 4.0) / 4.0;\n" +
          "    fragColor = vec4(vec3(v), 1.0);\n" +
          "  }\n" +
          "`;\n\n" +
          "const board = new THREE.Mesh(\n" +
          "  new THREE.PlaneGeometry(4, 4),\n" +
          "  new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader, fragmentShader }),\n" +
          ");\n" +
          "scene.add(board);\n",
      },
    },
  ],
};
