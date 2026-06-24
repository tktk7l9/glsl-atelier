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

const FULL: [number, number, number, number] = [0, 0, 1, 1];

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
            { kind: "sourceMatches", pattern: "u_time" },
            { kind: "sourceMatches", pattern: "sin" },
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
            { kind: "sourceMatches", pattern: "u_time" },
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
    ],
  },
  {
    id: "glsl-advanced",
    domain: "glsl",
    title: "上級: 光を当てる",
    summary: "法線とライト方向の内積で、平面に球の陰影をつける。",
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
    ],
  },
];
