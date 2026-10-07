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

const SDBOX_FN =
  "// 中心が原点・半分の大きさが b の長方形までの距離\n" +
  "float sdBox(vec2 p, vec2 b) {\n" +
  "  vec2 q = abs(p) - b;\n" +
  "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
  "}\n\n";

const ROTATE_FN =
  "// 角度 a（ラジアン）の 2D 回転行列\n" +
  "mat2 rotate2d(float a) {\n" +
  "  float c = cos(a);\n" +
  "  float s = sin(a);\n" +
  "  return mat2(c, -s, s, c);\n" +
  "}\n\n";

/** The ray-marching background colour (deep navy). */
const SKY: [number, number, number] = [0, 0, 0.05];

/** The ray-marched scene shared by the normal and shadow lessons: a unit
 *  sphere resting on the floor y = -1. */
const RM_MAP_FN =
  "// 球（半径 1）と床（y = -1）を合わせたシーンまでの距離\n" +
  "float map(vec3 p) {\n" +
  "  float sphere = length(p) - 1.0;\n" +
  "  float ground = p.y + 1.0;\n" +
  "  return min(sphere, ground);\n" +
  "}\n\n";

const RM_NORMAL_FN =
  "// 距離 map の勾配＝面の向き（法線）\n" +
  "vec3 calcNormal(vec3 p) {\n" +
  "  vec2 e = vec2(0.001, 0.0);\n" +
  "  float dx = map(p + e.xyy) - map(p - e.xyy);\n" +
  "  float dy = map(p + e.yxy) - map(p - e.yxy);\n" +
  "  float dz = map(p + e.yyx) - map(p - e.yyx);\n" +
  "  return normalize(vec3(dx, dy, dz));\n" +
  "}\n\n";

/** `main()` of the sphere-on-floor ray marcher; `hit` shades the surface point
 *  `p` (it must assign `col`). */
const rmMain = (hit: string): string =>
  "void main() {\n" +
  "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
  "  vec3 ro = vec3(0.0, 0.0, 3.0);\n" +
  "  vec3 rd = normalize(vec3(uv, -1.5));\n" +
  "  float t = 0.0;\n" +
  "  vec3 col = vec3(0.0, 0.0, 0.05);\n" +
  "  for (int i = 0; i < 100; i++) {\n" +
  "    vec3 p = ro + rd * t;\n" +
  "    float d = map(p);\n" +
  "    if (d < 0.001 * t) {  // 遠くほどゆるく判定して、地平線の近くまでとらえる\n" +
  hit +
  "      break;\n" +
  "    }\n" +
  "    t += d;\n" +
  "    if (t > 20.0) break;\n" +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The shadow-ray function of the shadow lesson; `onHit` is the line that
 *  reacts to a blocked ray. */
const rmShadowFn = (onHit: string): string =>
  "// 点 ro から光の方向 rd へ進み、途中で何かに当たれば 0.0（影）、当たらなければ 1.0\n" +
  "float shadow(vec3 ro, vec3 rd) {\n" +
  "  float t = 0.02;\n" +
  "  for (int i = 0; i < 48; i++) {\n" +
  "    float h = map(ro + rd * t);\n" +
  onHit +
  "    t += h;\n" +
  "    if (t > 10.0) break;\n" +
  "  }\n" +
  "  return 1.0;\n" +
  "}\n\n";

const RM_SHADOW_HIT =
  "      vec3 n = calcNormal(p);\n" +
  "      vec3 L = normalize(vec3(-0.8, 0.6, 0.3));  // 左から低めに差す光\n" +
  "      float diff = max(dot(n, L), 0.0);\n" +
  "      float sh = shadow(p + n * 0.01, L);\n" +
  "      col = vec3(0.08 + 0.92 * diff * sh);\n";

/** The lit-sphere body of the gamma lesson (linear colour in `col`). */
const GAMMA_SPHERE =
  "  float r = 0.75;\n" +
  "  float d = length(p);\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  if (d < r) {\n" +
  "    vec3 n = normalize(vec3(p, sqrt(r * r - d * d)));\n" +
  "    vec3 L = normalize(vec3(-0.5, 0.6, 0.6));\n" +
  "    float diff = max(dot(n, L), 0.0);\n" +
  "    // 環境光 0.05 ＋ 拡散光。ここまではリニアな値\n" +
  "    col = vec3(1.0, 0.5, 0.2) * (0.05 + 0.95 * diff);\n" +
  "  }\n";

const CELL_POINT_FN =
  "// マス i に置く点の位置（マスの中の 0〜1）\n" +
  "vec2 cellPoint(vec2 i) {\n" +
  "  return vec2(random(i), random(i + vec2(57.0, 113.0)));\n" +
  "}\n\n";

const VORONOI_HEAD =
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 pos = st * 5.0;\n" +
  "  vec2 i = floor(pos);\n" +
  "  vec2 f = fract(pos);\n" +
  "  float m = 1.0;  // いちばん近い点までの距離\n";

/** The mirror lesson's butterfly, drawn from `p`; `fold` goes right after `p`. */
const butterflyMain = (fold: string): string =>
  "void main() {\n" +
  CENTRED +
  fold +
  "  float body = length(p * vec2(6.0, 1.0)) - 0.5;          // 胴体（細長い楕円）\n" +
  "  float wing = min(length(p - vec2(0.42, 0.22)) - 0.3,   // 上の羽\n" +
  "                   length(p - vec2(0.3, -0.38)) - 0.2);  // 下の羽\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  col = mix(col, vec3(1.0, 0.55, 0.15), 1.0 - step(0.0, wing));\n" +
  "  col = mix(col, vec3(0.95), 1.0 - step(0.0, body));\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const WING: [number, number, number] = [1, 0.55, 0.15];

/** The kaleidoscope lesson: polar coordinates, then `fold`, then the motif
 *  (a petal at 15° and a bead at 30°) drawn at the rebuilt position `q`. */
const kaleidoscopeMain = (fold: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float a = atan(p.y, p.x);    // 角度\n" +
  "  float r = length(p);          // 中心からの距離\n" +
  "  float seg = 6.2831853 / 6.0;  // 扇形 1つぶんの角度（60°）\n" +
  fold +
  "  vec2 q = r * vec2(cos(a), sin(a));  // 角度と距離から座標を作り直す\n" +
  "  float petal = length(q - vec2(0.6, 0.16)) - 0.14;  // 花びら（15° の方向）\n" +
  "  float bead = length(q - vec2(0.26, 0.15)) - 0.07;  // 小さな玉（30° の方向）\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  col = mix(col, vec3(1.0, 0.4, 0.7), 1.0 - step(0.0, petal));\n" +
  "  col = mix(col, vec3(0.3, 0.9, 1.0), 1.0 - step(0.0, bead));\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const PETAL: [number, number, number] = [1, 0.4, 0.7];
const BEAD: [number, number, number] = [0.3, 0.9, 1];

/** The easing lesson: a ball that crosses the screen every 2 s; `ease` sets `e`. */
const easingMain = (ease: string): string =>
  "void main() {\n" +
  CENTRED +
  "  // 2 秒ごとに 0 → 1 をくり返す進み具合\n" +
  "  float t = fract(u_time / 2.0);\n" +
  ease +
  "  float x = mix(-0.6, 0.6, e);  // 左から右へ\n" +
  "  float d = length(p - vec2(x, 0.0)) - 0.15;\n" +
  "  float c = 1.0 - step(0.0, d);\n" +
  "  gl_FragColor = vec4(vec3(c), 1.0);\n}";

/** The crescent lesson: a moon and the circle to bite out of it, joined by `join`. */
const moonMain = (join: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float moon = length(p) - 0.6;                    // 月（円）\n" +
  "  float bite = length(p - vec2(0.3, 0.15)) - 0.5;  // くり抜きたい円\n" +
  join +
  "  float c = 1.0 - step(0.0, d);\n" +
  "  gl_FragColor = vec4(vec3(1.0, 0.9, 0.55) * c, 1.0);\n}";

const MOON: [number, number, number] = [1, 0.9, 0.55];

/** The linear-mix lesson: a red→green ramp, mixed as display values in the
 *  bottom half (the reference) and by `top` in the top half. */
const linearMixMain = (top: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 a = vec3(1.0, 0.1, 0.1);  // 赤（画面の色）\n" +
  "  vec3 b = vec3(0.1, 1.0, 0.1);  // 緑（画面の色）\n" +
  "  // 下半分: 画面の色のまま混ぜた見本（まん中が暗くにごる）\n" +
  "  vec3 col = mix(a, b, st.x);\n" +
  "  if (st.y > 0.5) {\n" +
  top +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const BAYER_FN =
  "// 2×2 マスのしきい値: マスの位置ごとに 0.0・0.5・0.75・0.25\n" +
  "float bayer2(vec2 a) {\n" +
  "  a = mod(floor(a), 2.0);\n" +
  "  return fract(a.x * 0.5 + a.y * 0.75);\n" +
  "}\n\n" +
  "// 4×4 マスのしきい値（ベイヤー行列）: 2×2 を 2段重ねた 16 段階。1/32, 3/32, …, 31/32 のどれか\n" +
  "float bayer4(vec2 a) {\n" +
  "  return bayer2(a * 0.5) * 0.25 + bayer2(a) + 1.0 / 32.0;\n" +
  "}\n\n";

/** The dither lesson's `main()`; `pick` sets `c` from `gray` and the cell.
 *  The ramp is measured at each cell's centre, so a cell is one flat colour
 *  (a per-pixel ramp split the cells it crossed into slivers). With 40 rows the
 *  centre values (2c + 1) / 80 never equal a threshold (2k + 1) / 32. */
const ditherMain = (pick: string): string =>
  "void main() {\n" +
  "  // 画面を正方形のマスに区切る（縦に 40 マス）\n" +
  "  vec2 cell = floor(gl_FragCoord.xy / u_resolution.y * 40.0);  // マスの番号\n" +
  "  vec2 center = (cell + 0.5) * u_resolution.y / 40.0;          // マスの中心（ピクセル）\n" +
  "  float gray = center.x / u_resolution.x;  // 左が暗く、右が明るいグラデーション（マスの中は同じ明るさ）\n" +
  pick +
  "  // 使う色は 2つだけ（レトロな携帯ゲーム機の暗い緑と明るい緑）\n" +
  "  vec3 col = mix(vec3(0.06, 0.22, 0.06), vec3(0.61, 0.74, 0.06), c);\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const DITHER_DARK: [number, number, number] = [0.06, 0.22, 0.06];
const DITHER_LIGHT: [number, number, number] = [0.61, 0.74, 0.06];

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
    summary: "u_time と sin/cos で時間とともに変化する絵をつくり、イージングで動きに緩急をつける。",
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
      {
        id: "glsl-easing",
        title: "動きに緩急をつける: イージング",
        explanation:
          "<p>一定の速さで進む動き（リニア）は、機械的に見えます。進み具合 <code>t</code>（0〜1）を<b>イージング関数</b>に" +
          "通すと、動きに緩急がつきます。たとえば ease-out の <code>1.0 - (1.0 - t) * (1.0 - t)</code> は、出だしが速く、" +
          "最後はゆっくり止まります。同じ <code>t = 0.5</code> の瞬間でも、リニアならまだ道のりの半分、ease-out なら " +
          "4分の3 まで進んでいます。チェックは <code>u_time = 1.0</code>（このコードでは <code>t = 0.5</code>）の瞬間の絵で行います。</p>",
        challenge: {
          starterCode: sh(easingMain("  // ここで t をイージングしよう（いまはリニアのまま）\n  float e = t;\n")),
          task: "e を ease-out（1.0 - (1.0 - t) * (1.0 - t)）にして、ボールが勢いよく動き出し、ゆっくり止まるようにしよう。",
          validators: [
            { kind: "compiles" },
            // At u_time = 1 (t = 0.5) ease-out has covered 3/4 of the way: the
            // ball is centred at x = 0.3, while the linear ball is still at 0.
            {
              kind: "pixelApprox",
              x: 0.65,
              y: 0.48,
              rgb: WHITE,
              message: "t = 0.5 の瞬間、ボールは道のりの 4分の3（x = 0.3）まで進んでいるはずです。e を ease-out にしましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.48, rgb: BLACK },
            {
              kind: "pixelApprox",
              x: 0.85,
              y: 0.48,
              rgb: BLACK,
              message: "ボールが進みすぎています。e = 1.0 - (1.0 - t) * (1.0 - t) にしましょう",
            },
          ],
          hints: [
            "float e = 1.0 - (1.0 - t) * (1.0 - t);",
            "t = 0.5 のとき e = 0.75。プレビューでは、ボールが勢いよく飛び出してから減速します",
          ],
          solution: sh(easingMain("  float e = 1.0 - (1.0 - t) * (1.0 - t);\n")),
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
    summary: "「形までの距離」を返す関数で図形を描き、輪郭にし、溶かし合わせ、くり抜く。",
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
      {
        id: "glsl-sdf-subtract",
        title: "くり抜く: SDF の引き算",
        explanation:
          "<p>2つの SDF <code>a</code>・<code>b</code> は、組み合わせ方で形が変わります。<code>min(a, b)</code> は<b>和</b>" +
          "（どちらかの内側）、<code>max(a, b)</code> は<b>共通部分</b>（両方の内側）。そして <code>-b</code> は b の内と外を" +
          "入れ替えた距離なので、<code>max(a, -b)</code> は「a の内側で、しかも b の外側」、つまり<b>a から b をくり抜いた形</b>" +
          "になります。</p>",
        challenge: {
          starterCode: sh(moonMain("  float d = min(moon, bite);                       // いまは 2つの円の和\n")),
          task: "d を max(moon, -bite) にして、月の円から bite の円をくり抜き、三日月にしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "max\\s*\\(" },
            // The crescent stays…
            { kind: "pixelApprox", x: 0.3, y: 0.45, rgb: MOON },
            { kind: "pixelApprox", x: 0.55, y: 0.25, rgb: MOON },
            // …and the bite is empty, inside the moon's circle and outside it.
            { kind: "pixelApprox", x: 0.6, y: 0.55, rgb: BLACK },
            { kind: "pixelApprox", x: 0.85, y: 0.6, rgb: BLACK },
            { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
          ],
          hints: ["float d = max(moon, -bite);", "max(moon, bite) だと、2つの円が重なった部分だけが残ります"],
          solution: sh(moonMain("  float d = max(moon, -bite);\n")),
        },
      },
    ],
  },
  {
    id: "glsl-transform",
    domain: "glsl",
    title: "座標を変換する",
    summary: "回転行列 mat2 で座標ごと回し、abs で折り返して鏡に映す。回すときは中心を原点に移してから。",
    icon: "🔄",
    lessons: [
      {
        id: "glsl-rotate",
        title: "回転させる: mat2",
        explanation:
          "<p>図形そのものを回す関数はありません。代わりに<b>座標を回します</b>。2D の回転行列 " +
          "<code>mat2(c, -s, s, c)</code>（<code>c = cos(a)</code>、<code>s = sin(a)</code>）を座標 <code>p</code> に" +
          "掛けた <code>q</code> で図形を描くと、図形が角度 <code>a</code> だけ反時計回りに回って見えます。" +
          "角度はラジアンで、45° は <code>π / 4 ≈ 0.785</code>。<code>a</code> に <code>u_time</code> を入れれば回り続けます。</p>",
        challenge: {
          starterCode: sh(
            SDBOX_FN +
              ROTATE_FN +
              "void main() {\n" +
              CENTRED +
              "  vec2 q = p;\n" +
              "  float d = sdBox(q, vec2(0.4));\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "q を rotate2d(0.785) * p にして、正方形を 45° 回したひし形にしよう。",
          validators: [
            { kind: "compiles" },
            // The helper is declared above main(), so require the call inside it.
            { kind: "sourceMatches", pattern: "main[\\s\\S]*rotate2d\\s*\\(" },
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: WHITE },
            // The diamond's tips reach past the square's sides…
            { kind: "pixelApprox", x: 0.73, y: 0.48, rgb: WHITE },
            { kind: "pixelApprox", x: 0.27, y: 0.48, rgb: WHITE },
            { kind: "pixelApprox", x: 0.48, y: 0.73, rgb: WHITE },
            { kind: "pixelApprox", x: 0.48, y: 0.27, rgb: WHITE },
            // …while the square's corners are cut away.
            { kind: "pixelApprox", x: 0.69, y: 0.69, rgb: BLACK },
            { kind: "pixelApprox", x: 0.31, y: 0.31, rgb: BLACK },
            { kind: "pixelApprox", x: 0.69, y: 0.31, rgb: BLACK },
            { kind: "pixelApprox", x: 0.31, y: 0.69, rgb: BLACK },
          ],
          hints: [
            "vec2 q = rotate2d(0.785) * p;",
            "行列 × ベクトルの順に掛けます。0.785 を u_time にすると回り続けます",
          ],
          solution: sh(
            SDBOX_FN +
              ROTATE_FN +
              "void main() {\n" +
              CENTRED +
              "  vec2 q = rotate2d(0.785) * p;\n" +
              "  float d = sdBox(q, vec2(0.4));\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-rotate-tiles",
        title: "マスごとに回す: 中心を原点に",
        explanation:
          "<p>回転行列は<b>原点 (0, 0) を中心に</b>回します。<code>fract(st * 3.0)</code> で作ったマスの座標 " +
          "<code>g</code> は左下の角が原点なので、そのまま回すと図形はマスの<b>角を中心に</b>回ってしまいます。" +
          "先に <code>g - 0.5</code> でマスの中心を原点に移してから回すのがコツです（「移動してから回転」の順番）。</p>",
        challenge: {
          starterCode: sh(
            SDBOX_FN +
              ROTATE_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 g = fract(st * 3.0);           // マスごとの 0〜1 の座標\n" +
              "  vec2 q = rotate2d(0.785) * g;       // いまはマスの左下の角を中心に回っている\n" +
              "  float d = sdBox(q, vec2(0.2));\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
          task: "回す前にマスの中心を原点に移して（g - 0.5）、3×3 のマスそれぞれの真ん中にひし形を並べよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "main[\\s\\S]*rotate2d\\s*\\(" },
            // A diamond in the middle of every tile…
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: WHITE },
            { kind: "pixelApprox", x: 0.15, y: 0.15, rgb: WHITE },
            { kind: "pixelApprox", x: 0.85, y: 0.85, rgb: WHITE },
            { kind: "pixelApprox", x: 0.15, y: 0.85, rgb: WHITE },
            { kind: "pixelApprox", x: 0.85, y: 0.15, rgb: WHITE },
            // …and nothing at the tile corners or between the tiles.
            { kind: "pixelApprox", x: 0.31, y: 0.31, rgb: BLACK },
            { kind: "pixelApprox", x: 0.69, y: 0.48, rgb: BLACK },
          ],
          hints: [
            "vec2 q = rotate2d(0.785) * (g - 0.5);",
            "g - 0.5 でマスの中心が (0, 0) になり、そこを中心に回ります",
          ],
          solution: sh(
            SDBOX_FN +
              ROTATE_FN +
              "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec2 g = fract(st * 3.0);\n" +
              "  vec2 q = rotate2d(0.785) * (g - 0.5);\n" +
              "  float d = sdBox(q, vec2(0.2));\n" +
              "  float c = 1.0 - step(0.0, d);\n" +
              "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-mirror",
        title: "鏡に映す: abs で折り返す",
        explanation:
          "<p>左右対称の絵は、半分だけ描けば足ります。座標の x を <code>p.x = abs(p.x);</code> と<b>絶対値</b>にすると、" +
          "左側のピクセルも右側と同じ座標を受け取るので、右に描いたものが x = 0 の線を鏡にして左にも映ります。" +
          "チョウや顔、雪の結晶など、対称な形を少ないコードで描く定番の手です。</p>",
        challenge: {
          starterCode: sh(butterflyMain("  // ここで p.x を折り返そう\n")),
          task: "羽を描く前に p.x を abs で折り返して、右の羽を左にも映し、左右対称のチョウにしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "abs\\s*\\(" },
            // Both wings on the right, and their reflections on the left. (Not
            // `symmetric`: a third of the grader's mirrored sample pairs land
            // one pixel apart, so a wing edge between them reads as asymmetric.)
            { kind: "pixelApprox", x: 0.71, y: 0.61, rgb: WING },
            { kind: "pixelApprox", x: 0.65, y: 0.31, rgb: WING },
            { kind: "pixelApprox", x: 0.29, y: 0.61, rgb: WING },
            { kind: "pixelApprox", x: 0.35, y: 0.31, rgb: WING },
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.95, 0.95, 0.95] },
            { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
          ],
          hints: ["p.x = abs(p.x);", "羽や胴体の距離を計算するより前（p を作った直後）で折り返します"],
          solution: sh(butterflyMain("  p.x = abs(p.x);  // 左半分も右半分と同じ座標に\n")),
        },
      },
    ],
  },
  {
    id: "glsl-polar",
    domain: "glsl",
    title: "極座標",
    summary: "角度 atan と半径 length で座標を取り直し、放射模様や花びら、万華鏡を描く。",
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
      {
        id: "glsl-kaleidoscope",
        title: "万華鏡: 角度を折りたたむ",
        explanation:
          "<p>万華鏡は、鏡で区切った扇形の中身が、まわりに何度も映ってできる模様です。シェーダーでは<b>角度を折りたたんで</b>" +
          "作れます。角度 <code>a</code> を <code>mod(a, seg)</code> で扇形 1つぶん（<code>seg</code> = 60°）に収め、" +
          "<code>abs(a - seg * 0.5)</code> で扇形のまん中を鏡にして折り返します。折りたたんだ角度と距離 <code>r</code> から" +
          "座標 <code>q</code> を作り直して模様を描けば、1つ描くだけで、まわりにいくつも映ります。</p>",
        challenge: {
          starterCode: sh(kaleidoscopeMain("  // ここで a を折りたたもう\n\n")),
          task: "a を mod(a, seg) で扇形に収め、abs(a - seg * 0.5) で折り返して、花びらと玉をまわりに映した万華鏡にしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "mod\\s*\\(" },
            // Copies of the 15° petal (at 135° and 255°) and of the 30° bead
            // (at 180° and 300°) appear only once the angle is folded.
            { kind: "pixelApprox", x: 0.28, y: 0.72, rgb: PETAL },
            { kind: "pixelApprox", x: 0.42, y: 0.2, rgb: PETAL },
            { kind: "pixelApprox", x: 0.35, y: 0.48, rgb: BEAD },
            { kind: "pixelApprox", x: 0.58, y: 0.37, rgb: BEAD },
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: BLACK },
            { kind: "pixelApprox", x: 0.96, y: 0.96, rgb: BLACK },
          ],
          hints: [
            "a = mod(a, seg);",
            "a = abs(a - seg * 0.5);  // 扇形のまん中を鏡に",
          ],
          solution: sh(kaleidoscopeMain("  a = mod(a, seg);           // 扇形 1つぶんに収める\n  a = abs(a - seg * 0.5);  // 扇形のまん中で折り返す\n")),
        },
      },
    ],
  },
  {
    id: "glsl-noise",
    domain: "glsl",
    title: "乱数とノイズ",
    summary: "GLSL に乱数関数はない。ハッシュで乱数を作り、なめらかなノイズや細胞の模様にする。",
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
      {
        id: "glsl-voronoi",
        title: "細胞の模様: セルラーノイズ",
        explanation:
          "<p><b>セルラーノイズ</b>（ボロノイ）は、マスごとに乱数で点を 1つ置き、各ピクセルで" +
          "<b>いちばん近い点までの距離</b>を明るさにする模様です。細胞や石畳のように見えます。" +
          "自分のマスの点だけを調べると、となりのマスの点のほうが近い場所で、マスの境目に段差ができてしまいます。" +
          "<code>for</code> ループで<b>まわり 3×3 マス</b>の点を調べ、<code>min</code> でいちばん近い距離を残しましょう。</p>",
        challenge: {
          starterCode: shHigh(
            RANDOM_FN +
              CELL_POINT_FN +
              VORONOI_HEAD +
              "  // いまは自分のマスの点しか見ていない\n" +
              "  m = min(m, distance(f, cellPoint(i)));\n" +
              "  gl_FragColor = vec4(vec3(m), 1.0);\n}",
          ),
          task: "for ループでまわり 3×3 マスの点までの距離を調べ、いちばん近い距離 m で塗って、マスの境目の段差を消そう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "for\\s*\\(" },
            { kind: "notUniform" },
            // The nearest-point distance changes no faster than the position
            // (≤ 0.24 between neighbouring samples), whatever the hash returns;
            // looking at one cell only leaves jumps at every cell border.
            {
              kind: "smooth",
              maxStep: 0.3,
              message: "マスの境目で明るさが急に変わっています。となりのマスの点も調べましょう",
            },
          ],
          hints: [
            "for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) { … } }",
            "vec2 nb = vec2(float(x), float(y));  // となりのマスへのずれ",
            "m = min(m, distance(f, nb + cellPoint(i + nb)));",
          ],
          solution: shHigh(
            RANDOM_FN +
              CELL_POINT_FN +
              VORONOI_HEAD +
              "  for (int y = -1; y <= 1; y++) {\n" +
              "    for (int x = -1; x <= 1; x++) {\n" +
              "      vec2 nb = vec2(float(x), float(y));\n" +
              "      m = min(m, distance(f, nb + cellPoint(i + nb)));\n" +
              "    }\n" +
              "  }\n" +
              "  gl_FragColor = vec4(vec3(m), 1.0);\n}",
          ),
        },
      },
    ],
  },
  {
    id: "glsl-post",
    domain: "glsl",
    title: "仕上げのエフェクト",
    summary: "ビネット・色ずれ・トーンマッピング・ガンマ補正・リニアな混色・ディザリング。できた絵に後からかける仕上げの処理。",
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
      {
        id: "glsl-tonemap",
        title: "明るすぎる光を収める: トーンマッピング",
        explanation:
          "<p>現実の光は、画面が出せる 0〜1 をかんたんに超えます（<b>HDR</b>）。1.0 を超えた分をそのまま出すと" +
          "白に張り付いて（クリップして）、色も明るさの差も消えてしまいます。<b>トーンマッピング</b>は、" +
          "0〜∞ の明るさを 0〜1 に押し縮める変換です。いちばん簡単な <b>Reinhard</b> は " +
          "<code>col / (1.0 + col)</code>。暗い所はほぼそのまま、明るい所ほど強く縮むので、白く飛ばずに済みます。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  // 右へ行くほど強くなるオレンジの光。右端では 1.0 の 8倍（HDR）\n" +
              "  vec3 hdr = vec3(1.0, 0.6, 0.3) * st.x * 8.0;\n" +
              "  vec3 col = hdr;\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
          task: "col を Reinhard トーンマッピング（hdr / (1.0 + hdr)）にして、右側が白く飛ばずオレンジの濃淡が残るようにしよう。",
          validators: [
            { kind: "compiles" },
            { kind: "pixelApprox", x: 0.23, y: 0.48, rgb: [0.65, 0.53, 0.36] },
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.79, 0.7, 0.54] },
            { kind: "pixelApprox", x: 0.77, y: 0.48, rgb: [0.86, 0.79, 0.65] },
          ],
          hints: [
            "vec3 col = hdr / (1.0 + hdr);",
            "1.0 + hdr のように float と vec3 を足すと、各成分に足されます",
          ],
          solution: sh(
            "void main() {\n" +
              "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
              "  vec3 hdr = vec3(1.0, 0.6, 0.3) * st.x * 8.0;\n" +
              "  vec3 col = hdr / (1.0 + hdr);\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-gamma",
        title: "ガンマ補正: リニアから画面の色へ",
        explanation:
          "<p>シェーダーで計算する明るさ（光の足し算や <code>dot(n, L)</code>）は、光の量に比例する<b>リニア</b>な値です。" +
          "ところが画面は、受け取った値をおよそ 2.2 乗して表示するため、中間の明るさが暗く沈みます。" +
          "そこで最後に <code>pow(col, vec3(1.0 / 2.2))</code> で逆向きに持ち上げておくと、計算どおりの明るさに見えます。" +
          "これが<b>ガンマ補正</b>で、陰影のグラデーションがやわらかくなります。</p>",
        challenge: {
          starterCode: sh(
            "void main() {\n" +
              CENTRED +
              GAMMA_SPHERE +
              "  // 画面に出す直前に、ここでガンマ補正しよう\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
          task: "画面に出す直前に col を pow(col, vec3(1.0 / 2.2)) でガンマ補正して、球の暗い側を持ち上げよう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "pow" },
            // Lit side, middle and unlit side (ambient only) of the sphere, in
            // three regions so each failure names a different place; the
            // background stays black.
            { kind: "pixelApprox", x: 0.31, y: 0.69, rgb: [1, 0.73, 0.48] },
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.81, 0.59, 0.39] },
            { kind: "pixelApprox", x: 0.69, y: 0.31, rgb: [0.26, 0.19, 0.12] },
            { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
          ],
          hints: [
            "col = pow(col, vec3(1.0 / 2.2));",
            "gl_FragColor に入れる直前に 1回だけかけます",
          ],
          solution: sh(
            "void main() {\n" +
              CENTRED +
              GAMMA_SPHERE +
              "  col = pow(col, vec3(1.0 / 2.2));\n" +
              "  gl_FragColor = vec4(col, 1.0);\n}",
          ),
        },
      },
      {
        id: "glsl-linear-mix",
        title: "にごらないグラデーション: リニアで混ぜる",
        explanation:
          "<p>前のレッスンのとおり、画面の色の値は光の量に比例していません。その値のまま <code>mix</code> すると、" +
          "赤と緑のまん中がおよそ <code>(0.55, 0.55, 0.1)</code> になり、光としては暗すぎる、にごった色になります。" +
          "光として正しく混ぜるには、<code>pow(色, vec3(2.2))</code> で<b>リニア</b>な値に直してから <code>mix</code> し、" +
          "最後に <code>pow(…, vec3(1.0 / 2.2))</code> で画面の色に戻します。下半分の見本と比べると、まん中が明るく" +
          "澄んだ黄色になります。</p>",
        challenge: {
          starterCode: sh(linearMixMain("    // 上半分: ここをリニアで混ぜよう\n    col = mix(a, b, st.x);\n")),
          task: "上半分は、a と b を pow(…, vec3(2.2)) でリニアに直してから mix し、pow(…, vec3(1.0 / 2.2)) で画面の色に戻そう。",
          validators: [
            { kind: "compiles" },
            { kind: "sourceMatches", pattern: "pow" },
            // The top half mixed as light: the middle is about 0.73 per channel
            // instead of the muddy 0.55 of the bottom half. The endpoints are
            // not pure 0/1, so decoding them matters: gamma-correcting only the
            // mixed result lifts the blue channel to 0.35 and fails.
            { kind: "pixelApprox", x: 0.27, y: 0.73, rgb: [0.87, 0.56, 0.1] },
            { kind: "pixelApprox", x: 0.48, y: 0.73, rgb: [0.74, 0.72, 0.1] },
            { kind: "pixelApprox", x: 0.73, y: 0.73, rgb: [0.56, 0.87, 0.1] },
          ],
          hints: [
            "vec3 la = pow(a, vec3(2.2));  vec3 lb = pow(b, vec3(2.2));  // リニアに直す",
            "col = pow(mix(la, lb, st.x), vec3(1.0 / 2.2));  // リニアで混ぜて、画面の色に戻す",
          ],
          solution: sh(
            linearMixMain(
              "    vec3 la = pow(a, vec3(2.2));  // 画面の色 → リニア\n" +
                "    vec3 lb = pow(b, vec3(2.2));\n" +
                "    col = pow(mix(la, lb, st.x), vec3(1.0 / 2.2));  // リニアで混ぜて、画面の色に戻す\n",
            ),
          ),
        },
      },
      {
        id: "glsl-dither",
        title: "2色で濃淡を出す: ディザリング",
        explanation:
          "<p>色が 2つしか使えなくても、明るい色の点の<b>混み具合</b>で濃淡を表せます（昔の携帯ゲーム機や新聞の写真の手法）。" +
          "マスごとに 0〜1 の<b>しきい値</b>を決めておき、明るさ <code>gray</code> がしきい値以上なら明るい色、未満なら暗い色に" +
          "します。しきい値を規則正しく散らした表が<b>ベイヤー行列</b>（ここでは <code>bayer4</code>）で、明るい所ほど多くの" +
          "マスが明るい色になります。<code>step(edge, x)</code> は <code>x</code> が <code>edge</code> 以上で 1 なので、" +
          "そのまま使えます。</p>",
        challenge: {
          starterCode: sh(
            BAYER_FN +
              ditherMain(
                "  // ここで gray としきい値 bayer4 を比べて、0 か 1 にしよう（いまは中間の値のまま）\n" +
                  "  float c = gray;\n",
              ),
          ),
          task: "c を step(bayer4(cell), gray) にして、グラデーションを 2色の点の混み具合で表そう。",
          validators: [
            { kind: "compiles" },
            // bayer4 is declared above main(), so require the call inside it.
            { kind: "sourceMatches", pattern: "main[\\s\\S]*bayer4\\s*\\(" },
            { kind: "gradient", axis: "x", dir: "up" },
            // Neighbouring cells in the middle of the ramp: each is exactly one
            // of the two colours, light or dark as the Bayer threshold decides
            // (|gray − threshold| ≥ 0.018 at every sampled pixel).
            {
              kind: "allOf",
              of: [
                { kind: "pixelApprox", x: 0.479, y: 0.479, rgb: DITHER_LIGHT },
                { kind: "pixelApprox", x: 0.521, y: 0.479, rgb: DITHER_DARK },
                { kind: "pixelApprox", x: 0.479, y: 0.521, rgb: DITHER_DARK },
                { kind: "pixelApprox", x: 0.521, y: 0.521, rgb: DITHER_LIGHT },
                { kind: "pixelApprox", x: 0.354, y: 0.5625, rgb: DITHER_LIGHT },
                { kind: "pixelApprox", x: 0.396, y: 0.5625, rgb: DITHER_DARK },
              ],
              message:
                "まだ中間の色が残っています。gray と bayer4(cell) を step で比べて、暗い色か明るい色のどちらかにしましょう",
            },
          ],
          hints: [
            "float c = step(bayer4(cell), gray);",
            "gray がしきい値以上のマスだけが 1（明るい色）になります",
          ],
          solution: sh(BAYER_FN + ditherMain("  float c = step(bayer4(cell), gray);  // しきい値以上なら 1、未満なら 0\n")),
        },
      },
    ],
  },
  {
    id: "glsl-advanced",
    domain: "glsl",
    title: "上級: 光を当てる",
    summary: "法線とライト方向の内積で陰影をつけ、レイマーチングで本物の 3D の球を描き、影まで落とす。",
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
      {
        id: "glsl-raymarch-normal",
        title: "どんな形にも法線を: 距離の勾配",
        explanation:
          "<p>前のレッスンの法線 <code>normalize(p)</code> は「原点にある球」専用です。床を足すと、床まで球の向きで" +
          "照らされて陰影が壊れます。どんな SDF にも使える法線は、距離 <code>map</code> の<b>勾配</b>" +
          "（距離がいちばん増える向き）です。点を x・y・z 方向に少しだけ（<code>e</code>）前後にずらして " +
          "<code>map</code> の差をとり、3つ並べて正規化します。<code>e.xyy</code> は " +
          "<code>vec3(e.x, e.y, e.y)</code>、つまり x 方向だけのずれを表す書き方です。</p>",
        challenge: {
          starterCode: shHigh(
            RM_MAP_FN +
              "// 距離 map の勾配＝面の向き（法線）。各軸に e だけ前後にずらした差を並べる\n" +
              "vec3 calcNormal(vec3 p) {\n" +
              "  vec2 e = vec2(0.001, 0.0);\n" +
              "  float dx = map(p + e.xyy) - map(p - e.xyy);\n" +
              "  float dy = 0.0;  // y 方向にずらした差\n" +
              "  float dz = 0.0;  // z 方向にずらした差\n" +
              "  return normalize(vec3(dx, dy, dz));\n" +
              "}\n\n" +
              rmMain(
                "      vec3 n = normalize(p);  // 球専用の法線。床では向きがおかしい\n" +
                  "      vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
                  "      col = vec3(max(dot(n, L), 0.0));\n",
              ),
          ),
          task: "calcNormal の dy・dz を dx と同じ形で埋め、当たった点の法線 n を calcNormal(p) に替えて、床にも正しい陰影をつけよう。",
          validators: [
            { kind: "compiles" },
            // calcNormal is declared above main(), so require the call inside it.
            { kind: "sourceMatches", pattern: "main[\\s\\S]*calcNormal\\s*\\(" },
            // The floor faces straight up, so it is evenly lit everywhere…
            { kind: "pixelApprox", x: 0.1, y: 0.06, rgb: [0.57, 0.57, 0.57] },
            { kind: "pixelApprox", x: 0.48, y: 0.02, rgb: [0.57, 0.57, 0.57] },
            { kind: "pixelApprox", x: 0.9, y: 0.06, rgb: [0.57, 0.57, 0.57] },
            // …and the sphere keeps its shading.
            { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.6, 0.6, 0.6] },
            { kind: "pixelApprox", x: 0.65, y: 0.65, rgb: [0.98, 0.98, 0.98] },
            { kind: "regionColor", rect: [0, 0.88, 0.12, 1], rgb: SKY },
            { kind: "regionColor", rect: [0.88, 0.88, 1, 1], rgb: SKY },
          ],
          hints: [
            "float dy = map(p + e.yxy) - map(p - e.yxy);  // dz は e.yyx で",
            "vec3 n = calcNormal(p);",
          ],
          solution: shHigh(
            RM_MAP_FN +
              RM_NORMAL_FN +
              rmMain(
                "      vec3 n = calcNormal(p);\n" +
                  "      vec3 L = normalize(vec3(0.6, 0.7, 0.8));\n" +
                  "      col = vec3(max(dot(n, L), 0.0));\n",
              ),
          ),
        },
      },
      {
        id: "glsl-raymarch-shadow",
        title: "影を落とす: 光に向かってもう一度",
        explanation:
          "<p>レイマーチングでは影も同じ方法で作れます。面に当たった点から<b>光の方向へもう一度レイを進め</b>、" +
          "途中で何か（距離がほぼ 0 の所）にぶつかったら、そこは光が遮られた<b>影</b>です。" +
          "自分の面にすぐぶつからないよう、出発点は法線の向きに少し浮かせ（<code>p + n * 0.01</code>）、" +
          "少し進んだ所から調べ始めます。ぶつかりそうになった近さを <code>min(res, 8.0 * h / t)</code> のように" +
          "濃さへ反映すると、ふちのぼけた<b>ソフトシャドウ</b>にもできます。</p>",
        challenge: {
          starterCode: shHigh(
            RM_MAP_FN +
              RM_NORMAL_FN +
              rmShadowFn("    // ここで、h がとても小さければ（何かに当たった）0.0 を返そう\n") +
              rmMain(RM_SHADOW_HIT),
          ),
          task: "shadow 関数のループの中で、h が 0.001 より小さくなったら 0.0 を返して、床に球の影を落とそう。",
          validators: [
            { kind: "compiles" },
            // The shadow stretches across the floor to the right of the sphere
            // (deep in it for hard and soft shadows alike)…
            {
              kind: "pixelApprox",
              x: 0.85,
              y: 0.31,
              rgb: [0.08, 0.08, 0.08],
              message: "球の右側の床に影が落ちていません。光へ進めたレイが球に当たったら 0.0 を返しましょう",
            },
            // …while the rest of the floor and the sphere stay lit.
            { kind: "pixelApprox", x: 0.15, y: 0.31, rgb: [0.61, 0.61, 0.61] },
            { kind: "pixelApprox", x: 0.48, y: 0.06, rgb: [0.61, 0.61, 0.61] },
            { kind: "pixelApprox", x: 0.9, y: 0.06, rgb: [0.61, 0.61, 0.61] },
            { kind: "pixelApprox", x: 0.35, y: 0.65, rgb: [0.82, 0.82, 0.82] },
            { kind: "regionColor", rect: [0.88, 0.88, 1, 1], rgb: SKY },
          ],
          hints: [
            "if (h < 0.001) return 0.0;",
            "return でその場で関数を抜けます。最後まで何にも当たらなければ、下の return 1.0 まで進みます",
          ],
          solution: shHigh(
            RM_MAP_FN +
              RM_NORMAL_FN +
              rmShadowFn("    if (h < 0.001) return 0.0;\n") +
              rmMain(RM_SHADOW_HIT),
          ),
        },
      },
    ],
  },
];
