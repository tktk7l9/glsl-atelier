// GLSL fragment-shader tracks. The learner writes a full GLSL ES 1.00 shader;
// the WebGL runtime supplies `u_resolution`, `u_time`, `u_mouse`, renders it on
// a full-screen quad, and reads back a grid of pixels for the validators.

import type { Track } from "./types.js";

const HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
`;

const sh = (body: string): string => `${HEAD}\n${body}\n`;

// The sin-based hash multiplies by 43758.5453, which a real 16-bit mediump
// float cannot hold (mobile GPUs honour mediump), so the noise lessons ask for
// highp — supported by every WebGL device in practice and a no-op on desktop.
const HEAD_HIGHP = HEAD.replace("precision mediump float;", "precision highp float;");
const shHigh = (body: string): string => `${HEAD_HIGHP}\n${body}\n`;

const FULL: [number, number, number, number] = [0, 0, 1, 1];

/** Aspect-correct centred coordinates: p ∈ [-1, 1] on the short axis. */
const CENTRED =
  "  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n";

const RANDOM_FN =
  "// 2D の座標から 0〜1 の「でたらめな値」を作る定番のハッシュ\n" +
  "float random(vec2 v) {\n" +
  "  return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453);\n" +
  "}\n\n";

const WHITE: [number, number, number] = [1, 1, 1];
const BLACK: [number, number, number] = [0, 0, 0];

export const glslTracks: readonly Track[] = [
  {
    id: "glsl-basics",
    domain: "glsl",
    title: "はじめてのシェーダー",
    summary: "1ピクセルずつ色を決める。gl_FragColor に RGBA を書き込もう。",
    icon: "✨",
    lessons: [
      {
        id: "glsl-solid-color",
        title: "画面を塗る: gl_FragColor",
        explanation:
          "<p>フラグメントシェーダーは画面の<b>すべてのピクセル</b>について呼ばれ、" +
          "<code>gl_FragColor</code> にそのピクセルの色を書き込みます。色は <code>vec4(r, g, b, a)</code>、" +
          "各成分は 0.0〜1.0 です。</p>",
        mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context",
        challenge: {
          starterCode: sh("void main() {\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}"),
          task: "画面全体をマゼンタ（赤＋青）に塗ろう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "gl_FragColor" },
            { kind: "regionColor", rect: FULL, rgb: [1, 0, 1] },
          ],
          hints: ["マゼンタは 赤=1.0・緑=0.0・青=1.0", "gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);"],
          solution: sh("void main() {\n  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n}"),
        },
      },
      {
        id: "glsl-rgb-mix",
        title: "色を混ぜる: RGB",
        explanation:
          "<p>赤・緑・青を足し合わせると別の色になります。緑と青を最大にすると<b>シアン</b>になります。</p>",
        challenge: {
          starterCode: sh("void main() {\n  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n}"),
          task: "シアン（緑＋青）で塗ろう。",
          validators: [
            { kind: "compiles" },
            { kind: "regionColor", rect: FULL, rgb: [0, 1, 1] },
          ],
          hints: ["シアンは 赤=0.0・緑=1.0・青=1.0", "gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);"],
          solution: sh("void main() {\n  gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);\n}"),
        },
      },
      {
        id: "glsl-gray",
        title: "灰色をつくる: vec3",
        explanation:
          "<p><code>vec3(0.5)</code> は <code>vec3(0.5, 0.5, 0.5)</code> の省略形。" +
          "RGB を同じ値にすると無彩色（グレー）になります。</p>",
        challenge: {
          starterCode: sh("void main() {\n  gl_FragColor = vec4(vec3(1.0), 1.0);\n}"),
          task: "50% グレー（vec3(0.5)）で塗ろう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "vec3" },
            { kind: "regionColor", rect: FULL, rgb: [0.5, 0.5, 0.5] },
          ],
          hints: ["3成分すべて 0.5 にします", "gl_FragColor = vec4(vec3(0.5), 1.0);"],
          solution: sh("void main() {\n  gl_FragColor = vec4(vec3(0.5), 1.0);\n}"),
        },
      },
    ],
  },
  {
    id: "glsl-uv",
    domain: "glsl",
    title: "座標と UV",
    summary: "gl_FragCoord と u_resolution でピクセルの位置を 0〜1 に正規化する。",
    icon: "🧭",
    lessons: [
      {
        id: "glsl-uv-gradient",
        title: "横グラデーション",
        explanation:
          "<p><code>gl_FragCoord.xy</code> はピクセル座標（左下が原点）。" +
          "<code>u_resolution</code> で割ると 0〜1 の座標 <code>st</code> が得られます。" +
          "<code>st.x</code> をそのまま明るさに使うと横方向のグラデーションになります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(0.0), 1.0);\n}",
          ),
          task: "左が黒・右が白の横グラデーションにしよう（st.x を明るさに）。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "gl_FragCoord" },
            { kind: "sourceMatches", pattern: "u_resolution" },
            { kind: "gradient", axis: "x", dir: "up" },
            { kind: "pixelApprox", x: 0.05, y: 0.5, rgb: [0, 0, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.95, y: 0.5, rgb: [1, 1, 1], tol: 0.15 },
          ],
          hints: ["vec3(st.x) で 左0→右1 のグレーになります", "gl_FragColor = vec4(vec3(st.x), 1.0);"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.x), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-uv-xy",
        title: "定番の UV: 赤×緑",
        explanation:
          "<p>赤に <code>st.x</code>、緑に <code>st.y</code> を入れると、シェーダー入門の定番である" +
          "「右へ赤・上へ緑」のグラデーションになります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}",
          ),
          task: "右へ進むほど赤、上へ進むほど緑にしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "gl_FragCoord" },
            { kind: "gradient", axis: "x", dir: "up", channel: "r" },
            { kind: "gradient", axis: "y", dir: "up", channel: "g" },
            { kind: "pixelApprox", x: 0.95, y: 0.05, rgb: [1, 0, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.05, y: 0.95, rgb: [0, 1, 0], tol: 0.15 },
          ],
          hints: ["vec4(st.x, st.y, 0.0, 1.0)", "赤=横方向, 緑=縦方向"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(st.x, st.y, 0.0, 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-uv-vertical",
        title: "縦グラデーション",
        explanation: "<p>今度は <code>st.y</code> を使って、下が黒・上が白の縦グラデーションを作ります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.x), 1.0);\n}",
          ),
          task: "下が黒・上が白の縦グラデーションにしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "gradient", axis: "y", dir: "up" },
            { kind: "notUniform" },
            { kind: "pixelApprox", x: 0.5, y: 0.05, rgb: [0, 0, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.95, rgb: [1, 1, 1], tol: 0.15 },
          ],
          hints: ["st.x を st.y に変えるだけ", "gl_FragColor = vec4(vec3(st.y), 1.0);"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.y), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-shapes",
    domain: "glsl",
    title: "図形を描く",
    summary: "step / smoothstep と距離関数で、白黒のかたちを切り出す。",
    icon: "🔵",
    lessons: [
      {
        id: "glsl-step-half",
        title: "境界をつくる: step",
        explanation:
          "<p><code>step(edge, x)</code> は <code>x &lt; edge</code> なら 0、そうでなければ 1 を返します。" +
          "<code>st.x</code> に使うと、画面を左右でくっきり分けられます。</p>",
        mdnPath: "/ja/docs/Web/API/WebGL_API",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.x), 1.0);\n}",
          ),
          task: "左半分を黒、右半分を白にしよう（step を使う）。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "step" },
            { kind: "pixelApprox", x: 0.25, y: 0.5, rgb: [0, 0, 0] },
            { kind: "pixelApprox", x: 0.75, y: 0.5, rgb: [1, 1, 1] },
          ],
          hints: ["float c = step(0.5, st.x);", "gl_FragColor = vec4(vec3(c), 1.0);"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float c = step(0.5, st.x);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-circle",
        title: "円を描く: distance",
        explanation:
          "<p>中心 <code>vec2(0.5)</code> からの距離 <code>distance(st, vec2(0.5))</code> がしきい値より" +
          "小さい部分だけ白くすると円になります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float d = distance(st, vec2(0.5));\n  gl_FragColor = vec4(vec3(0.0), 1.0);\n}",
          ),
          task: "中央に白い円を描こう（半径 0.25 くらい）。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "distance" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 1, 1] },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: [0, 0, 0] },
            { kind: "symmetric", axis: "x" },
            { kind: "symmetric", axis: "y" },
          ],
          hints: ["float c = 1.0 - step(0.25, d);", "中心は距離が小さいので白、外側は黒"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float d = distance(st, vec2(0.5));\n  float c = 1.0 - step(0.25, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-smoothstep-circle",
        title: "ふちをぼかす: smoothstep",
        explanation:
          "<p><code>smoothstep(a, b, x)</code> は a〜b の間をなめらかに 0→1 に変化させます。" +
          "円のふちをアンチエイリアスのように柔らかくできます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float d = distance(st, vec2(0.5));\n  float c = 1.0 - step(0.25, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "step を smoothstep に変えて、円のふちをぼかそう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "smoothstep" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 1, 1] },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: [0, 0, 0] },
            { kind: "notUniform" },
          ],
          hints: ["float c = 1.0 - smoothstep(0.2, 0.27, d);", "2つのしきい値の幅がぼけ幅になります"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float d = distance(st, vec2(0.5));\n  float c = 1.0 - smoothstep(0.2, 0.27, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-color",
    domain: "glsl",
    title: "色と混色",
    summary: "mix で 2色を補間し、cos でカラフルなパレットをつくる。",
    icon: "🌈",
    lessons: [
      {
        id: "glsl-mix",
        title: "2色を補間: mix",
        explanation:
          "<p><code>mix(a, b, t)</code> は t=0 で a、t=1 で b、その間をなめらかに混ぜます。" +
          "<code>t</code> に <code>st.x</code> を渡すと横方向のグラデーションになります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 a = vec3(0.1, 0.2, 0.9);\n  vec3 b = vec3(1.0, 0.6, 0.1);\n  vec3 col = a;\n  gl_FragColor = vec4(col, 1.0);\n}",
          ),
          task: "左で青(a)・右でオレンジ(b)になるよう mix で補間しよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "mix" },
            { kind: "pixelApprox", x: 0.05, y: 0.5, rgb: [0.1, 0.2, 0.9], tol: 0.18 },
            { kind: "pixelApprox", x: 0.95, y: 0.5, rgb: [1, 0.6, 0.1], tol: 0.18 },
            { kind: "gradient", axis: "x", dir: "up", channel: "r" },
          ],
          hints: ["vec3 col = mix(a, b, st.x);", "t は 0〜1 の値（st.x がちょうどいい）"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 a = vec3(0.1, 0.2, 0.9);\n  vec3 b = vec3(1.0, 0.6, 0.1);\n  vec3 col = mix(a, b, st.x);\n  gl_FragColor = vec4(col, 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-palette",
        title: "コサイン・パレット",
        explanation:
          "<p><code>0.5 + 0.5 * cos(...)</code> で 0〜1 を往復する波が作れます。RGB に位相をずらして" +
          "渡すと、なめらかな虹色のパレットになります（Inigo Quilez の定番）。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 col = vec3(st.x);\n  gl_FragColor = vec4(col, 1.0);\n}",
          ),
          task: "cos を使って横方向に虹色が変化するパレットを作ろう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "cos" },
            { kind: "notUniform" },
          ],
          hints: [
            "vec3 col = 0.5 + 0.5 * cos(6.2831 * (st.x + vec3(0.0, 0.33, 0.67)));",
            "RGB それぞれに位相をずらすのがコツ",
          ],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 col = 0.5 + 0.5 * cos(6.2831 * (st.x + vec3(0.0, 0.33, 0.67)));\n  gl_FragColor = vec4(col, 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-motion",
    domain: "glsl",
    title: "時間とアニメーション",
    summary: "u_time と sin/cos で、時間とともに変化する絵をつくる。",
    icon: "🌀",
    lessons: [
      {
        id: "glsl-pulse",
        title: "明滅する: u_time × sin",
        explanation:
          "<p><code>u_time</code> は経過秒数。<code>sin(u_time)</code> は -1〜1 を往復するので、" +
          "<code>abs()</code> で 0〜1 にすると画面全体が明滅します。プレビューで動きを確認しましょう。</p>",
        challenge: {
          starterCode: sh("void main() {\n  float b = 1.0;\n  gl_FragColor = vec4(vec3(b), 1.0);\n}"),
          task: "u_time と sin を使って、画面全体を明滅させよう。",
          validators: [
            { kind: "compiles" },
            // The header declares u_time, so require it inside main().
            { kind: "sourceMatches", pattern: "main[\\s\\S]*u_time" },
            { kind: "sourceMatches", pattern: "main[\\s\\S]*sin\\s*\\(" },
          ],
          hints: ["float b = abs(sin(u_time));", "プレビューが点滅すれば成功"],
          solution: sh(
            "void main() {\n  float b = abs(sin(u_time));\n  gl_FragColor = vec4(vec3(b), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-moving-stripe",
        title: "流れる縞: fract × u_time",
        explanation:
          "<p>座標から <code>u_time</code> を引いて <code>fract()</code>（小数部）を取ると、" +
          "模様が時間とともに流れて見えます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float x = st.x;\n  float c = step(0.5, fract(x));\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "縞模様が横に流れるよう、x に u_time を取り入れよう。",
          validators: [
            { kind: "compiles" },
            // The header declares u_time, so require it inside main().
            { kind: "sourceMatches", pattern: "main[\\s\\S]*u_time" },
            { kind: "sourceMatches", pattern: "fract" },
            { kind: "notUniform" },
          ],
          hints: ["float x = st.x - u_time * 0.2;", "fract で 0〜1 が繰り返されます"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float x = st.x - u_time * 0.2;\n  float c = step(0.5, fract(x));\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-patterns",
    domain: "glsl",
    title: "繰り返しとパターン",
    summary: "fract / floor / mod で空間を分割し、タイルや市松模様をつくる。",
    icon: "🔳",
    lessons: [
      {
        id: "glsl-tiles",
        title: "タイル化: fract",
        explanation:
          "<p>座標を定数倍して <code>fract()</code> を取ると、0〜1 が何度も繰り返され、" +
          "空間をタイル状に分割できます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = st;\n  float c = step(0.5, g.x);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "st を 4倍して fract を取り、縦縞を4本に増やそう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "fract" },
            { kind: "notUniform" },
          ],
          hints: ["vec2 g = fract(st * 4.0);", "倍率を上げるほど縞が細かくなります"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = fract(st * 4.0);\n  float c = step(0.5, g.x);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-checker",
        title: "市松模様: floor × mod",
        explanation:
          "<p>マスのインデックスを <code>floor()</code> で求め、行＋列の合計を <code>mod(.., 2.0)</code> すると" +
          "0と1が交互に並んで市松模様になります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 cell = st * 4.0;\n  float c = 0.0;\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "floor と mod を使って 4×4 の市松模様を描こう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "floor" },
            { kind: "sourceMatches", pattern: "mod" },
            { kind: "notUniform" },
          ],
          hints: ["vec2 cell = floor(st * 4.0);", "float c = mod(cell.x + cell.y, 2.0);"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 cell = floor(st * 4.0);\n  float c = mod(cell.x + cell.y, 2.0);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-repeat-dots",
        title: "水玉を並べる: fract × 図形",
        explanation:
          "<p><code>fract()</code> で分割した各マスの座標は、どのマスでも 0〜1 です。" +
          "その座標で図形を 1つ描けば、同じ図形が<b>マスの数だけ</b>並びます。" +
          "「空間を繰り返してから描く」のは、シェーダーで模様を作る基本の型です。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = st;\n  float d = distance(g, vec2(0.5));\n  float c = 1.0 - step(0.3, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "st を 3倍して fract を取り、白い円を 3×3 に並べよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "fract" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.15, y: 0.15, rgb: WHITE },
            { kind: "pixelApprox", x: 0.85, y: 0.15, rgb: WHITE },
            { kind: "pixelApprox", x: 0.15, y: 0.85, rgb: WHITE },
            { kind: "pixelApprox", x: 0.85, y: 0.85, rgb: WHITE },
            { kind: "pixelApprox", x: 0.35, y: 0.35, rgb: BLACK },
            { kind: "pixelApprox", x: 0.65, y: 0.65, rgb: BLACK },
            { kind: "pixelApprox", x: 0.02, y: 0.02, rgb: BLACK },
          ],
          hints: ["vec2 g = fract(st * 3.0);", "g はマスごとに 0〜1 なので、中心 vec2(0.5) からの距離がそのまま使えます"],
          solution: sh(
            "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = fract(st * 3.0);\n  float d = distance(g, vec2(0.5));\n  float c = 1.0 - step(0.3, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-sdf",
    domain: "glsl",
    title: "距離関数（SDF）",
    summary: "「形までの距離」を返す関数で図形を描き、輪郭にし、溶かし合わせる。",
    icon: "📏",
    lessons: [
      {
        id: "glsl-sdf-box",
        title: "箱の SDF: abs と max",
        explanation:
          "<p><b>符号付き距離関数（SDF）</b>は、点から形までの距離を返す関数です。形の外では正、" +
          "中では負、ふちでちょうど 0 になるので、<code>step(0.0, d)</code> で中と外を塗り分けられます。" +
          "円は <code>length(p) - r</code>。長方形は <code>abs(p)</code> で第1象限に折りたたみ、" +
          "半分の大きさ <code>b</code> を引いて、はみ出した分の長さを取ります（<code>sdBox</code>）。</p>",
        challenge: {
          starterCode: sh(
            "// 中心が原点・半分の大きさが b の長方形までの距離\n" +
              "float sdBox(vec2 p, vec2 b) {\n" +
              "  vec2 q = abs(p) - b;\n" +
              "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
              "}\n\n" +
              "void main() {\n" +
              CENTRED +
              "  float d = length(p) - 0.5;\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "円の距離 d を sdBox に置き換えて、横 0.6・縦 0.3（半分の大きさ）の白い長方形を描こう。",
          validators: [
            { kind: "compiles" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.77, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.23, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.7, rgb: BLACK },
            { kind: "pixelApprox", x: 0.5, y: 0.3, rgb: BLACK },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
          ],
          hints: ["float d = sdBox(p, vec2(0.6, 0.3));", "p は中心が (0, 0) で、短い辺が -1〜1 の座標です"],
          solution: sh(
            "float sdBox(vec2 p, vec2 b) {\n" +
              "  vec2 q = abs(p) - b;\n" +
              "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
              "}\n\n" +
              "void main() {\n" +
              CENTRED +
              "  float d = sdBox(p, vec2(0.6, 0.3));\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-sdf-ring",
        title: "輪郭だけ残す: abs(d)",
        explanation:
          "<p>距離 <code>d</code> の絶対値 <code>abs(d)</code> は「ふちからの距離」です。" +
          "そこから太さ <code>w</code> を引いて 0 以下の部分を塗ると、形の<b>輪郭だけ</b>が太さ 2w の帯として残ります。" +
          "どんな SDF にも同じ手が使えます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              CENTRED +
              "  float d = length(p) - 0.5;\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "abs を使って、半径 0.5 の円を太さ 0.1（片側）の白いリングにしよう。中は黒に。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "abs" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: BLACK },
            { kind: "pixelApprox", x: 0.74, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.26, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.74, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.26, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.93, rgb: BLACK },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
          ],
          hints: ["float ring = abs(d) - 0.1;", "float c = 1.0 - step(0.0, ring);"],
          solution: sh(
            "void main() {\n" +
              CENTRED +
              "  float d = length(p) - 0.5;\n" +
              "  float ring = abs(d) - 0.1;\n" +
              "  float c = 1.0 - step(0.0, ring);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-sdf-smooth-union",
        title: "溶かしてつなぐ: smooth min",
        explanation:
          "<p>2つの SDF の <code>min()</code> を取ると形の<b>和集合</b>になりますが、つなぎ目は角ばったままです。" +
          "<code>smin(a, b, k)</code> は min をなめらかにしたもので、近づいた形どうしが " +
          "<code>k</code> の範囲で溶け合います（メタボール風）。</p>",
        challenge: {
          starterCode: sh(
            "// なめらかな min（k が大きいほど広く溶け合う）\n" +
              "float smin(float a, float b, float k) {\n" +
              "  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n" +
              "  return mix(b, a, h) - k * h * (1.0 - h);\n" +
              "}\n\n" +
              "void main() {\n" +
              CENTRED +
              "  float d1 = length(p - vec2(-0.38, 0.0)) - 0.3;\n" +
              "  float d2 = length(p - vec2(0.38, 0.0)) - 0.3;\n" +
              "  float d = min(d1, d2);\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "min を smin（k = 0.6）に変えて、離れた2つの円をなめらかにつなごう。",
          validators: [
            { kind: "compiles" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.31, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.69, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.9, rgb: BLACK },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
            { kind: "pixelApprox", x: 0.95, y: 0.95, rgb: BLACK },
          ],
          hints: ["float d = smin(d1, d2, 0.6);", "min(d1, d2) のままだと 2つの円の間は黒いままです"],
          solution: sh(
            "float smin(float a, float b, float k) {\n" +
              "  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n" +
              "  return mix(b, a, h) - k * h * (1.0 - h);\n" +
              "}\n\n" +
              "void main() {\n" +
              CENTRED +
              "  float d1 = length(p - vec2(-0.38, 0.0)) - 0.3;\n" +
              "  float d2 = length(p - vec2(0.38, 0.0)) - 0.3;\n" +
              "  float d = smin(d1, d2, 0.6);\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-polar",
    domain: "glsl",
    title: "極座標",
    summary: "角度 atan と半径 length で座標を取り直し、放射模様や花びらを描く。",
    icon: "🌸",
    lessons: [
      {
        id: "glsl-polar-rays",
        title: "放射する光: atan",
        explanation:
          "<p><code>atan(p.y, p.x)</code> は中心から見た<b>角度</b>（-π〜π）を返します。" +
          "角度を <code>cos(a * 6.0)</code> に入れると 1周で 6回波打つので、" +
          "<code>step</code> で白黒にすれば中心から放射する 6本の光条になります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              CENTRED +
              "  float a = 0.0;\n" +
              "  float c = step(0.0, cos(a * 6.0));\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "角度 a を atan(p.y, p.x) で求めて、中心から 6本の光が放射する模様にしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "atan" },
            { kind: "notUniform" },
            { kind: "pixelApprox", x: 0.85, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.15, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.5, y: 0.85, rgb: BLACK },
            { kind: "pixelApprox", x: 0.5, y: 0.15, rgb: BLACK },
            { kind: "pixelApprox", x: 0.675, y: 0.803, rgb: WHITE },
            { kind: "pixelApprox", x: 0.803, y: 0.675, rgb: BLACK },
          ],
          hints: ["float a = atan(p.y, p.x);", "引数の順番は atan(y, x)。逆にすると模様が 90度ずれます"],
          solution: sh(
            "void main() {\n" +
              CENTRED +
              "  float a = atan(p.y, p.x);\n" +
              "  float c = step(0.0, cos(a * 6.0));\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-polar-flower",
        title: "花びらを描く: 半径を角度で揺らす",
        explanation:
          "<p>円の半径 <code>r</code> を定数ではなく<b>角度の関数</b>にすると、ふちが波打ちます。" +
          "<code>0.5 + 0.2 * cos(a * 5.0)</code> なら半径が 0.3〜0.7 の間を 1周で 5回ゆれて、" +
          "花びら 5枚の花になります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              CENTRED +
              "  float a = atan(p.y, p.x);\n" +
              "  float r = 0.5;\n" +
              "  float c = 1.0 - step(r, length(p));\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "半径 r を 0.5 + 0.2 * cos(a * 5.0) にして、花びら 5枚の白い花を描こう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "cos" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.81, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.29, y: 0.5, rgb: BLACK },
            { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
            { kind: "pixelApprox", x: 0.5, y: 0.96, rgb: BLACK },
          ],
          hints: ["float r = 0.5 + 0.2 * cos(a * 5.0);", "5.0 を変えると花びらの枚数が変わります"],
          solution: sh(
            "void main() {\n" +
              CENTRED +
              "  float a = atan(p.y, p.x);\n" +
              "  float r = 0.5 + 0.2 * cos(a * 5.0);\n" +
              "  float c = 1.0 - step(r, length(p));\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-noise",
    domain: "glsl",
    title: "乱数とノイズ",
    summary: "GLSL に乱数関数はない。ハッシュで乱数を作り、補間してなめらかなノイズにする。",
    icon: "🌫️",
    lessons: [
      {
        id: "glsl-random-cells",
        title: "乱数をつくる: fract(sin(…))",
        explanation:
          "<p>GLSL には乱数関数がありません。代わりに <code>sin</code> に大きな数を掛けて " +
          "<code>fract</code> を取ると、入力がわずかに違うだけで値が飛び回る「ハッシュ」になります。" +
          "同じ入力には必ず同じ値が返るので、<code>floor</code> で求めた<b>マスの番号</b>を渡せば、" +
          "マスごとに決まった明るさが得られます。桁の大きい計算なので、このトラックでは " +
          "<code>precision highp float</code> にしています。</p>",
        challenge: {
          starterCode: shHigh(
            RANDOM_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 cell = st * 8.0;\n" +
              "  float c = random(vec2(0.0));\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "floor でマスの番号を求めて random に渡し、8×8 のマスをでたらめな明るさで塗ろう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "floor" },
            { kind: "cellsFlat", cells: 8 },
          ],
          hints: ["vec2 cell = floor(st * 8.0);", "float c = random(cell);"],
          solution: shHigh(
            RANDOM_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 cell = floor(st * 8.0);\n" +
              "  float c = random(cell);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-value-noise",
        title: "なめらかなノイズ: 四隅を補間する",
        explanation:
          "<p>マスの<b>四隅</b>の乱数 <code>a, b, c, d</code> を、マス内の位置 <code>u</code> で " +
          "<code>mix</code> すると、マスの境目が消えてなめらかにつながります（バリューノイズ）。" +
          "横に 2回、その結果を縦に 1回、合計 3回の mix です。<code>u</code> は " +
          "<code>smoothstep</code> を通した位置なので、つなぎ目の傾きも連続になります。</p>",
        challenge: {
          starterCode: shHigh(
            RANDOM_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 pos = st * 4.0;\n" +
              "  vec2 i = floor(pos);\n" +
              "  vec2 f = fract(pos);\n" +
              "  // マスの四隅の乱数\n" +
              "  float a = random(i);\n" +
              "  float b = random(i + vec2(1.0, 0.0));\n" +
              "  float c = random(i + vec2(0.0, 1.0));\n" +
              "  float d = random(i + vec2(1.0, 1.0));\n" +
              "  // なめらかにした、マス内の位置\n" +
              "  vec2 u = smoothstep(0.0, 1.0, f);\n" +
              "  float n = a;\n" +
              "  gl_FragColor = vec4(vec3(n), 1.0);\n}",
          ),
          task: "四隅の値 a〜d を u で補間して（mix を 3回）、マスの境目が見えないなめらかなノイズにしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "mix" },
            { kind: "notUniform" },
            { kind: "smooth", maxStep: 0.35 },
          ],
          hints: [
            "下辺 mix(a, b, u.x) と上辺 mix(c, d, u.x) を、さらに u.y で mix します",
            "float n = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
          ],
          solution: shHigh(
            RANDOM_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 pos = st * 4.0;\n" +
              "  vec2 i = floor(pos);\n" +
              "  vec2 f = fract(pos);\n" +
              "  float a = random(i);\n" +
              "  float b = random(i + vec2(1.0, 0.0));\n" +
              "  float c = random(i + vec2(0.0, 1.0));\n" +
              "  float d = random(i + vec2(1.0, 1.0));\n" +
              "  vec2 u = smoothstep(0.0, 1.0, f);\n" +
              "  float n = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n" +
              "  gl_FragColor = vec4(vec3(n), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-post",
    domain: "glsl",
    title: "仕上げのエフェクト",
    summary: "ビネットや色ずれなど、できた絵に後からかける「ポストエフェクト」の考え方。",
    icon: "📷",
    lessons: [
      {
        id: "glsl-vignette",
        title: "周辺を暗く: ビネット",
        explanation:
          "<p><b>ビネット</b>は画面の四隅を暗くして視線を中央に集める定番のエフェクトです。" +
          "中心からの距離 <code>d</code> を <code>smoothstep</code> に通し、1 から引いた値を" +
          "色に掛けます。中央（d が小さい）は 1 のまま、四隅（d が大きい）ほど 0 に近づきます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec3 col = vec3(1.0, 0.8, 0.4);\n" +
              "  float d = distance(st, vec2(0.5));\n" +
              "  float v = 1.0;\n" +
              "  gl_FragColor = vec4(col * v, 1.0);\n}",
          ),
          task: "d から係数 v を作り、中央は明るいまま・四隅はほぼ黒になるようにしよう（0.3〜0.75 でなめらかに）。",
          validators: [
            { kind: "compiles" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.8, 0.4] },
            { kind: "pixelApprox", x: 0.03, y: 0.03, rgb: BLACK, tol: 0.2 },
            { kind: "pixelApprox", x: 0.97, y: 0.97, rgb: BLACK, tol: 0.2 },
            { kind: "pixelApprox", x: 0.97, y: 0.03, rgb: BLACK, tol: 0.2 },
            { kind: "pixelApprox", x: 0.03, y: 0.97, rgb: BLACK, tol: 0.2 },
            { kind: "smooth", maxStep: 0.2 },
          ],
          hints: [
            "float v = 1.0 - smoothstep(0.3, 0.75, d);",
            "smoothstep の第1引数より小さい d は 0、第2引数より大きい d は 1 になります",
          ],
          solution: sh(
            "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec3 col = vec3(1.0, 0.8, 0.4);\n" +
              "  float d = distance(st, vec2(0.5));\n" +
              "  float v = 1.0 - smoothstep(0.3, 0.75, d);\n" +
              "  gl_FragColor = vec4(col * v, 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-chromatic-aberration",
        title: "色ずれ: 色収差",
        explanation:
          "<p>レンズの<b>色収差</b>は、色ごとに像の位置がわずかにずれる現象です。" +
          "シェーダーでは、元の絵を返す関数を R・G・B で<b>少しずつ違う座標</b>から読むだけで再現できます。" +
          "赤は右にずらした座標、青は左にずらした座標から読むと、ふちに赤と青のにじみが出ます。</p>",
        challenge: {
          starterCode: sh(
            "// 元の絵: 中央の白い円（座標 uv の明るさを返す）\n" +
              "float scene(vec2 uv) {\n" +
              "  return 1.0 - step(0.25, distance(uv, vec2(0.5)));\n" +
              "}\n\n" +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 off = vec2(0.08, 0.0);\n" +
              "  float r = scene(st);\n" +
              "  float g = scene(st);\n" +
              "  float b = scene(st);\n" +
              "  gl_FragColor = vec4(r, g, b, 1.0);\n}",
          ),
          task: "赤は st + off、青は st - off の位置から絵を読んで、円の左に赤・右に青のにじみを出そう。",
          validators: [
            { kind: "compiles" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
            { kind: "pixelApprox", x: 0.21, y: 0.5, rgb: [1, 0, 0] },
            { kind: "pixelApprox", x: 0.79, y: 0.5, rgb: [0, 0, 1] },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
          ],
          hints: ["float r = scene(st + off);", "float b = scene(st - off);  // 緑はそのまま"],
          solution: sh(
            "float scene(vec2 uv) {\n" +
              "  return 1.0 - step(0.25, distance(uv, vec2(0.5)));\n" +
              "}\n\n" +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 off = vec2(0.08, 0.0);\n" +
              "  float r = scene(st + off);\n" +
              "  float g = scene(st);\n" +
              "  float b = scene(st - off);\n" +
              "  gl_FragColor = vec4(r, g, b, 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-advanced",
    domain: "glsl",
    title: "上級: 光を当てる",
    summary: "法線とライト方向の内積で陰影をつけ、レイマーチングで本物の 3D の球を描く。",
    icon: "🪐",
    lessons: [
      {
        id: "glsl-shaded-sphere",
        title: "陰影のある球",
        explanation:
          "<p>円の各点に擬似的な法線 <code>n</code> を与え、ライト方向 <code>L</code> との内積 " +
          "<code>dot(n, L)</code> を明るさにすると、平面の絵に立体的な陰影がつきます（ランバート反射）。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              "  vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
              "  float r = 0.6;\n" +
              "  float d = length(st);\n" +
              "  if (d > r) { gl_FragColor = vec4(0.0, 0.0, 0.05, 1.0); return; }\n" +
              "  float z = sqrt(r * r - d * d);\n" +
              "  vec3 n = normalize(vec3(st, z));\n" +
              "  vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
              "  float diff = 0.0;\n" +
              "  gl_FragColor = vec4(vec3(diff), 1.0);\n}",
          ),
          task: "拡散光 diff を dot(n, L) で求めて、球に陰影をつけよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "normalize" },
            { kind: "sourceMatches", pattern: "dot" },
            { kind: "notUniform" },
            { kind: "regionColor", rect: [0, 0, 0.12, 0.12], rgb: [0, 0, 0.05], tol: 0.12 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.65, 0.65, 0.65], tol: 0.28 },
          ],
          hints: ["float diff = max(dot(n, L), 0.0);", "内積は2つのベクトルの向きの近さ＝明るさ"],
          solution: sh(
            "void main() {\n" +
              "  vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
              "  float r = 0.6;\n" +
              "  float d = length(st);\n" +
              "  if (d > r) { gl_FragColor = vec4(0.0, 0.0, 0.05, 1.0); return; }\n" +
              "  float z = sqrt(r * r - d * d);\n" +
              "  vec3 n = normalize(vec3(st, z));\n" +
              "  vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
              "  float diff = max(dot(n, L), 0.0);\n" +
              "  gl_FragColor = vec4(vec3(diff), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-raymarch-sphere",
        title: "レイマーチング: 球に向かって進む",
        explanation:
          "<p><b>レイマーチング</b>は、ピクセルごとにカメラからレイを飛ばし、3D の SDF <code>map(p)</code> が" +
          "返す「いちばん近い面までの距離」のぶんだけレイを進める、を繰り返す描画法です。" +
          "距離がほぼ 0 になったら面に当たったと判定し、そこで陰影を計算します。" +
          "球の法線は中心からの向き <code>normalize(p)</code> です。</p>",
        challenge: {
          starterCode: sh(
            "// 原点にある半径 1.0 の球までの距離（3D の SDF）\n" +
              "float map(vec3 p) {\n" +
              "  return length(p) - 1.0;\n" +
              "}\n\n" +
              "void main() {\n" +
              "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
              "  vec3 ro = vec3(0.0, 0.0, 3.0);          // カメラの位置\n" +
              "  vec3 rd = normalize(vec3(uv, -1.5));    // このピクセルのレイの向き\n" +
              "  float t = 0.0;                          // レイが進んだ距離\n" +
              "  vec3 col = vec3(0.0, 0.0, 0.05);        // 背景色\n" +
              "  for (int i = 0; i < 48; i++) {\n" +
              "    vec3 p = ro + rd * t;\n" +
              "    float d = map(p);\n" +
              "    if (d < 0.001) {\n" +
              "      vec3 n = normalize(p);\n" +
              "      vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
              "      col = vec3(max(dot(n, L), 0.0));\n" +
              "      break;\n" +
              "    }\n" +
              "    // ここで、距離 d のぶんだけレイを進めよう\n" +
              "  }\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
          task: "ループの最後で t を d だけ進めて、レイが球に当たるようにしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "notUniform" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.65, 0.65, 0.65], tol: 0.28 },
            { kind: "regionColor", rect: [0, 0, 0.12, 0.12], rgb: [0, 0, 0.05], tol: 0.12 },
            { kind: "regionColor", rect: [0.88, 0.88, 1, 1], rgb: [0, 0, 0.05], tol: 0.12 },
          ],
          hints: ["t += d;", "進んだ先の p = ro + rd * t でまた map を見る、の繰り返しです"],
          solution: sh(
            "float map(vec3 p) {\n" +
              "  return length(p) - 1.0;\n" +
              "}\n\n" +
              "void main() {\n" +
              "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
              "  vec3 ro = vec3(0.0, 0.0, 3.0);\n" +
              "  vec3 rd = normalize(vec3(uv, -1.5));\n" +
              "  float t = 0.0;\n" +
              "  vec3 col = vec3(0.0, 0.0, 0.05);\n" +
              "  for (int i = 0; i < 48; i++) {\n" +
              "    vec3 p = ro + rd * t;\n" +
              "    float d = map(p);\n" +
              "    if (d < 0.001) {\n" +
              "      vec3 n = normalize(p);\n" +
              "      vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
              "      col = vec3(max(dot(n, L), 0.0));\n" +
              "      break;\n" +
              "    }\n" +
              "    t += d;\n" +
              "  }\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
        },
      },
    ],
  },
];
