// The glsl-shapes track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, WHITE, sh } from "./shared-glsl.js";

// WebGL 1 has screen-space derivatives (fwidth) only as an extension. The
// runtime enables it on its contexts; a shader still has to ask for it, and
// the directive must come before anything else.
const shDerivatives = (body: string): string =>
  `#extension GL_OES_standard_derivatives : enable\n${sh(body)}`;

/** A neutral grey that is neither the black nor the white of a hard edge. */
const MID_GREY: [number, number, number] = [0.5, 0.5, 0.5];

/** The fwidth lesson: a white disc of radius 0.3; `edge` turns `d` into `c`. */
const discMain = (edge: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  float d = distance(st, vec2(0.5)) - 0.3;  // 円のふちまでの距離（中は負、外は正）\n" +
  edge +
  "  gl_FragColor = vec4(vec3(c), 1.0);\n}";

export const track: Track = {
  id: "glsl-shapes",
  domain: "glsl",
  title: "図形を描く",
  summary: "step / smoothstep と距離関数で白黒のかたちを切り出し、fwidth でふちを 1ピクセルだけぼかす。",
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
    {
      id: "glsl-fwidth",
      title: "ふちを 1ピクセルだけぼかす: fwidth",
      explanation:
        "<p>前のレッスンの <code>smoothstep(0.2, 0.27, d)</code> は、ぼかす幅を座標の値（0.07）で決めていました。これだと大きな画面ではぼけすぎ、" +
        "小さな画面ではギザギザが残ります。ふちを<b>ちょうど 1ピクセルぶん</b>だけぼかすには、「となりのピクセルへ進むと値がどれだけ変わるか」を" +
        "知る必要があります。それを返すのが <code>fwidth(d)</code> です。<code>w = fwidth(d)</code> として <code>smoothstep(-w, w, d)</code> で" +
        "塗り分ければ、どの大きさの画面でも、ふちだけがなめらかになります（<b>アンチエイリアス</b>）。WebGL 1 では <code>fwidth</code> は拡張機能なので、" +
        "シェーダーの 1行目に <code>#extension GL_OES_standard_derivatives : enable</code> が要ります（書いてあります）。</p>",
      challenge: {
        starterCode: shDerivatives(
          discMain(
            "  // ここで、d が 1ピクセルぶん変わる幅 w を求めて、ふちをぼかそう\n" +
              "  float c = 1.0 - step(0.0, d);  // いまはふちがギザギザ\n",
          ),
        ),
        task: "w = fwidth(d) で 1ピクセルぶんの幅を求め、c を 1.0 - smoothstep(-w, w, d) にして、円のふちだけをなめらかにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "fwidth\\s*\\(" },
          // Sampled pixels right on the edge (0.05 px inside, or 0.75 px
          // outside for a one-sided blur) must be neither white nor black…
          {
            kind: "anyOf",
            of: [
              { kind: "pixelApprox", x: 0.6875, y: 0.7292, rgb: MID_GREY, tol: 0.6 },
              { kind: "pixelApprox", x: 0.6458, y: 0.7708, rgb: MID_GREY, tol: 0.6 },
            ],
            message: "円のふちがまだくっきりしています。step を smoothstep(-w, w, d) に替えて、ふちをぼかしましょう",
          },
          // …while 2–3 px away from it the disc and the background are pure.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8125, y: 0.4792, rgb: BLACK },
              { kind: "pixelApprox", x: 0.5625, y: 0.2292, rgb: WHITE },
            ],
            message: "ぼかしの幅が広すぎます。ぼかすのは前後 1ピクセルぶん（w = fwidth(d)）だけにしましょう",
          },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: WHITE },
          { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
        ],
        hints: [
          "float w = fwidth(d);  // となりのピクセルとの d の差",
          "float c = 1.0 - smoothstep(-w, w, d);",
        ],
        solution: shDerivatives(
          discMain(
            "  float w = fwidth(d);                   // となりのピクセルとの d の差（1ピクセルぶん）\n" +
              "  float c = 1.0 - smoothstep(-w, w, d);  // ふちの前後 1ピクセルだけをなめらかに\n",
          ),
        ),
      },
    },
  ],
};
