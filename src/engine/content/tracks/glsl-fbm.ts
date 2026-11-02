// The glsl-fbm track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { shHigh } from "./shared-glsl.js";

/** The smooth noise of the noise track, as a function. Its hash is
 *  interleaved gradient noise rather than RANDOM_FN: fract(sin(…) * 43758.5453)
 *  depends on the GPU's float rounding, and these lessons judge exact
 *  brightness, so the picture has to be the same on every device. */
const NOISE_FN =
  "// sin を使わない乱数（どの GPU でも同じ値になる）\n" +
  "float random(vec2 v) {\n" +
  "  return fract(52.9829189 * fract(dot(v, vec2(0.06711056, 0.00583715))));\n" +
  "}\n\n" +
  "// 前のトラックのなめらかなノイズ（0〜1）\n" +
  "float noise(vec2 p) {\n" +
  "  vec2 i = floor(p);\n" +
  "  vec2 f = fract(p);\n" +
  "  vec2 u = smoothstep(0.0, 1.0, f);\n" +
  "  float a = random(i);\n" +
  "  float b = random(i + vec2(1.0, 0.0));\n" +
  "  float c = random(i + vec2(0.0, 1.0));\n" +
  "  float d = random(i + vec2(1.0, 1.0));\n" +
  "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n" +
  "}\n\n";

const FBM_FN =
  "// 大きなうねりに、細かいノイズを小さく足していく\n" +
  "float fbm(vec2 p) {\n" +
  "  float v = 0.0;\n" +
  "  float a = 0.5;\n" +
  "  for (int i = 0; i < 5; i++) {\n" +
  "    v += a * noise(p);\n" +
  "    p *= 2.0;\n" +
  "    a *= 0.5;\n" +
  "  }\n" +
  "  return v;\n" +
  "}\n\n";

const main = (body: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 pos = st * 4.0;\n" +
  body +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const grey = (expr: string): string => `  vec3 col = vec3(${expr});\n`;

export const track: Track = {
  id: "glsl-fbm",
  domain: "glsl",
  title: "ノイズを重ねる",
  summary: "大きさを変えたノイズを重ねて雲にし（fBm）、折り返して山の稜線にし、座標をノイズでずらして流れる模様にする。",
  icon: "☁️",
  lessons: [
    {
      id: "glsl-fbm",
      title: "雲をつくる: fBm",
      explanation:
        "<p>1枚のノイズは、のっぺりしたまだら模様です。自然の形には、大きなうねりの上に小さなでこぼこが乗っています。そこで、" +
        "周波数を 2倍、振幅を半分にしながらノイズを何枚か足します。これを <b>fBm</b>（非整数ブラウン運動）と呼び、足す 1枚ずつを<b>オクターブ</b>と呼びます。" +
        "大きな形は最初の 1枚で決まり、あとの枚数が細かさを足していきます。オクターブの振幅の合計は 1 未満なので、値は 0〜1 に収まります。" +
        "このトラックの乱数は sin を使わない式です。<code>fract(sin(…) * 43758.5453)</code> は GPU の丸め方で値が変わるので、どの端末でも同じ絵になるように替えてあります。</p>",
      challenge: {
        starterCode: shHigh(
          NOISE_FN +
            "float fbm(vec2 p) {\n" +
            "  float v = 0.0;\n" +
            "  float a = 0.5;\n" +
            "  // ここを 5回くり返そう: v に a * noise(p) を足し、p を 2倍、a を半分に\n" +
            "  v += a * noise(p);\n" +
            "  return v;\n" +
            "}\n\n" +
            main(grey("fbm(pos)")),
        ),
        task: "fbm の中を for で 5回くり返し、v に a * noise(p) を足すたびに p を 2倍、a を半分にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "for\\s*\\(" },
          { kind: "notUniform" },
          // fBm's value at four spots chosen to tell it from too few octaves and
          // from amplitudes or frequencies that change by the wrong factor.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3958, y: 0.1458, rgb: [0.61, 0.61, 0.61], tol: 0.12 },
              { kind: "pixelApprox", x: 0.4375, y: 0.8125, rgb: [0.372, 0.372, 0.372], tol: 0.12 },
              { kind: "pixelApprox", x: 0.2292, y: 0.6875, rgb: [0.542, 0.542, 0.542], tol: 0.12 },
              { kind: "pixelApprox", x: 0.9375, y: 0.9375, rgb: [0.578, 0.578, 0.578], tol: 0.12 },
            ],
            message: "雲の明るさが目標と違います。for で 5回くり返し、v += a * noise(p); のあとに p *= 2.0; と a *= 0.5; を書きましょう",
          },
        ],
        hints: [
          "for (int i = 0; i < 5; i++) { … }",
          "v += a * noise(p);\np *= 2.0;\na *= 0.5;",
        ],
        solution: shHigh(NOISE_FN + FBM_FN + main(grey("fbm(pos)"))),
      },
    },
    {
      id: "glsl-ridged",
      title: "山の稜線: ノイズを折り返す",
      explanation:
        "<p>ノイズの中央（0.5）を境に値を折り返すと、なめらかだった谷が尖った線に変わります。<code>abs(n * 2.0 - 1.0)</code> は 0.5 の所で 0 になる V 字の形です。" +
        "これを <code>1.0 -</code> で裏返すと、0.5 の所が細く明るい筋になります。fBm の 1枚ずつに使うと、山の尾根や稲妻のような" +
        "<b>リッジノイズ</b>になります。同じ折り返しでも、裏返さずに足すと、もくもくした煙のような模様（タービュランス）になります。</p>",
      challenge: {
        starterCode: shHigh(
          NOISE_FN +
            "float ridge(vec2 p) {\n" +
            "  float n = noise(p);\n" +
            "  // ここで n を 0.5 で折り返して裏返そう\n" +
            "  return n;\n" +
            "}\n\n" +
            "float fbm(vec2 p) {\n" +
            "  float v = 0.0;\n" +
            "  float a = 0.5;\n" +
            "  for (int i = 0; i < 5; i++) {\n" +
            "    v += a * ridge(p);\n" +
            "    p *= 2.0;\n" +
            "    a *= 0.5;\n" +
            "  }\n" +
            "  return v;\n" +
            "}\n\n" +
            main(grey("fbm(pos)")),
        ),
        task: "ridge の返す値を 1.0 - abs(n * 2.0 - 1.0) にして、細く明るい稜線の模様にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "abs\\s*\\(" },
          { kind: "notUniform" },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3542, y: 0.3958, rgb: [0.873, 0.873, 0.873], tol: 0.12 },
              { kind: "pixelApprox", x: 0.6875, y: 0.6875, rgb: [0.891, 0.891, 0.891], tol: 0.12 },
              { kind: "pixelApprox", x: 0.4792, y: 0.7708, rgb: [0.277, 0.277, 0.277], tol: 0.12 },
              { kind: "pixelApprox", x: 0.7708, y: 0.2292, rgb: [0.204, 0.204, 0.204], tol: 0.12 },
            ],
            message: "稜線の明るさが目標と違います。ridge の中で return 1.0 - abs(n * 2.0 - 1.0); にしましょう（1.0 - を忘れると明暗が逆になります）",
          },
        ],
        hints: ["return 1.0 - abs(n * 2.0 - 1.0);", "n が 0.5 のとき abs(…) は 0、裏返すと 1（いちばん明るい）です"],
        solution: shHigh(
          NOISE_FN +
            "float ridge(vec2 p) {\n" +
            "  float n = noise(p);\n" +
            "  return 1.0 - abs(n * 2.0 - 1.0);  // 0.5 の所が明るい筋になる\n" +
            "}\n\n" +
            "float fbm(vec2 p) {\n" +
            "  float v = 0.0;\n" +
            "  float a = 0.5;\n" +
            "  for (int i = 0; i < 5; i++) {\n" +
            "    v += a * ridge(p);\n" +
            "    p *= 2.0;\n" +
            "    a *= 0.5;\n" +
            "  }\n" +
            "  return v;\n" +
            "}\n\n" +
            main(grey("fbm(pos)")),
        ),
      },
    },
    {
      id: "glsl-domain-warp",
      title: "流れる模様: 座標をノイズでずらす",
      explanation:
        "<p>絵の色ではなく<b>読む位置</b>をノイズでずらすと、模様が液体のように流れます。これを<b>ドメインワープ</b>と呼びます。" +
        "「絵をゆがめる」のレッスンでは sin で読む位置をずらしましたが、それをノイズにしたものです。" +
        "x 用と y 用に別の場所のノイズを読んで <code>q</code> とし、<code>fbm(pos + q * 2.0)</code> のように足します。" +
        "<code>q</code> は 0〜1 の値なので、掛ける数が大きいほど、強くねじれます。大理石や煙、油の膜のような模様の土台になります。</p>",
      challenge: {
        starterCode: shHigh(
          NOISE_FN +
            FBM_FN +
            main(
              "  // x 用と y 用のノイズ（0〜1）\n" +
                "  vec2 q = vec2(fbm(pos), fbm(pos + vec2(5.2, 1.3)));\n" +
                "  // ここで、読む位置 pos を q でずらそう\n" +
                grey("fbm(pos)"),
            ),
        ),
        task: "col を読む位置を pos + q * 2.0 に替えて、模様を流れるようにゆがめよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "\\bq\\b[^\\n]*\\*|\\*[^\\n]*\\bq\\b" },
          { kind: "notUniform" },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.0625, y: 0.0625, rgb: [0.731, 0.731, 0.731], tol: 0.12 },
              { kind: "pixelApprox", x: 0.4792, y: 0.2708, rgb: [0.376, 0.376, 0.376], tol: 0.12 },
              { kind: "pixelApprox", x: 0.5625, y: 0.0625, rgb: [0.835, 0.835, 0.835], tol: 0.12 },
              { kind: "pixelApprox", x: 0.3125, y: 0.5208, rgb: [0.145, 0.145, 0.145], tol: 0.12 },
            ],
            message: "模様が目標と違います。col を読む位置を pos から pos + q * 2.0 に替えましょう",
          },
        ],
        hints: ["vec3 col = vec3(fbm(pos + q * 2.0));", "q は上の行で作ってあります。読む位置に足すだけです"],
        solution: shHigh(
          NOISE_FN +
            FBM_FN +
            main(
              "  vec2 q = vec2(fbm(pos), fbm(pos + vec2(5.2, 1.3)));\n" +
                "  vec3 col = vec3(fbm(pos + q * 2.0));  // 読む位置をノイズでずらす\n",
            ),
        ),
      },
    },
  ],
};
