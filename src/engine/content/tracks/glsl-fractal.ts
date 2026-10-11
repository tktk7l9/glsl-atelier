// The glsl-fractal track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, shHigh } from "./shared-glsl.js";

/** The Mandelbrot lessons' view: the pixel's complex number c, z from 0. */
const MANDELBROT_START =
  "  vec2 c = p * 1.5 + vec2(-0.7, 0.0);  // この画素が表す複素数 c（横が実部、縦が虚部）\n" +
  "  vec2 z = vec2(0.0);                   // z は 0 から始める\n";

/** The escape-time loop: `count` runs after every step that stays inside. */
const COUNTING_LOOP = (count: string): string =>
  "  float n = 0.0;  // 外に出るまでに、外に出なかった回数\n" +
  "  for (int i = 0; i < 64; i++) {\n" +
  "    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;  // z² + c\n" +
  "    if (dot(z, z) > 4.0) break;                            // |z| > 2: 外に出た\n" +
  count +
  "  }\n";

const PALETTE_FN =
  "// 「色と混色」のコサイン・パレット（t が 0〜1 で虹色をひとまわり）\n" +
  "vec3 palette(float t) {\n" +
  "  return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));\n" +
  "}\n\n";

const COUNT = "    n += 1.0;  // 外に出なかったら 1 増やす\n";

/** Inside black, the escaped points by their count. */
const ESCAPE_COLOUR =
  "  vec3 col = vec3(0.0);  // 64回たっても外に出なかった点（集合の中）は黒\n" +
  "  if (n < 64.0) col = palette(n / 64.0);  // 外に出た点は、回数で色を変える\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The escape-time picture from a start (`start` sets c and z). */
const escapeTime = (start: string): string => PALETTE_FN + "void main() {\n" + CENTRED + start + COUNTING_LOOP(COUNT) + ESCAPE_COLOUR;

export const track: Track = {
  id: "glsl-fractal",
  domain: "glsl",
  title: "フラクタル",
  summary: "z = z² + c をくり返すだけで、どこまで拡大しても細かい模様が現れる。マンデルブロ集合を描き、脱出の速さで色を付け、ジュリア集合へ。",
  icon: "❄️",
  lessons: [
    {
      id: "glsl-mandelbrot",
      title: "マンデルブロ集合: z = z² + c",
      explanation:
        "<p>複素数 <code>z</code> を 0 から始めて、<code>z = z² + c</code> を何度もくり返します。<code>c</code> は画素ごとに決まる複素数" +
        "（横が実部、縦が虚部）です。くり返しても <code>z</code> が遠くへ飛んでいかない <code>c</code> の集まりが<b>マンデルブロ集合</b>で、" +
        "ふちをどこまで拡大しても細かい模様が現れます（<b>フラクタル</b>）。GLSL に複素数はないので <code>vec2</code> で表し、2乗は " +
        "<code>vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y)</code> と書きます（<code>z * z</code> は成分ごとの掛け算で、複素数の 2乗には" +
        "なりません）。<code>|z|</code> が一度 2 を超えると、あとは大きくなる一方なので、そこで「外」と決めてループを抜けます。比べるのは " +
        "<code>dot(z, z) &gt; 4.0</code>（|z|² &gt; 4）で十分です。同じ計算を何十回も重ねるので、このトラックは " +
        "<code>precision highp float</code> にしています。</p>",
      challenge: {
        starterCode: shHigh(
          "void main() {\n" +
            CENTRED +
            MANDELBROT_START +
            "  float inside = 1.0;                   // 1.0: 集合の中（黒）、0.0: 外（白）\n" +
            "  for (int i = 0; i < 64; i++) {\n" +
            "    // ここで z を z² + c に更新し、|z| が 2 を超えたら（dot(z, z) > 4.0）inside = 0.0 にしてループを抜けよう\n" +
            "  }\n" +
            "  gl_FragColor = vec4(vec3(1.0 - inside), 1.0);\n}",
        ),
        task: "ループの中で z を z² + c（vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c）に更新し、dot(z, z) > 4.0 になったら inside = 0.0 にしてループを抜け、マンデルブロ集合を黒く描こう。",
        validators: [
          { kind: "compiles" },
          // Well inside the big cardioid and the disc on its left: black at
          // every shift of ±0.3 px, in float32 as in float64. z * z
          // (component-wise) and the conjugate (-2xy) leave the cardioid white.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6042, y: 0.6042, rgb: BLACK },
              { kind: "pixelApprox", x: 0.3958, y: 0.5208, rgb: BLACK },
            ],
            message:
              "集合の中（黒）になるはずの所が白くなっています。複素数の 2乗は vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) です（z * z は成分ごとの掛け算で、2乗になりません）",
          },
          // Left of the disc, outside: x² + y² and a missing + c draw black here.
          {
            kind: "pixelApprox",
            x: 0.2292,
            y: 0.5208,
            rgb: WHITE,
            message: "集合の外まで黒くなっています。毎回 c を足しているか、2乗の x 成分が z.x * z.x - z.y * z.y（引き算）になっているか確かめましょう",
          },
          // Just outside the edge (escapes after 9 to 30 steps): 8 steps keep it black.
          {
            kind: "pixelApprox",
            x: 0.3542,
            y: 0.6042,
            rgb: WHITE,
            message: "ふちのすぐ外が黒く残っています。くり返しは 64回のままにして、外に出るまで続けましょう",
          },
        ],
        hints: ["z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;", "if (dot(z, z) > 4.0) {\n  inside = 0.0;\n  break;\n}"],
        solution: shHigh(
          "void main() {\n" +
            CENTRED +
            MANDELBROT_START +
            "  float inside = 1.0;                   // 1.0: 集合の中（黒）、0.0: 外（白）\n" +
            "  for (int i = 0; i < 64; i++) {\n" +
            "    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;  // z² + c（複素数の 2乗）\n" +
            "    if (dot(z, z) > 4.0) {  // |z| > 2 になったら、もう戻ってこない\n" +
            "      inside = 0.0;\n" +
            "      break;\n" +
            "    }\n" +
            "  }\n" +
            "  gl_FragColor = vec4(vec3(1.0 - inside), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-escape-time",
      title: "脱出の速さで塗る: くり返しの回数",
      explanation:
        "<p>白黒だと、集合の外はのっぺりしています。そこで、外に出るまでに<b>何回くり返したか</b>（脱出の速さ）を数えて色にします。" +
        "集合から遠い点はすぐに飛び出し、ふちに近い点ほど長く迷ってから飛び出すので、回数を色にすると集合のまわりに等高線のような縞が現れます。" +
        "回数 <code>n</code> は 0〜63 なので、64 で割って 0〜1 にしてから、「色と混色」のコサイン・パレットに渡します。最後まで外に出なかった点" +
        "（<code>n</code> が 64 のまま）は集合の中なので、黒のままにします。</p>",
      challenge: {
        starterCode: shHigh(
          PALETTE_FN +
            "void main() {\n" +
            CENTRED +
            MANDELBROT_START +
            COUNTING_LOOP("    // ここで n を 1 増やそう（ここに来るのは、まだ外に出ていないとき）\n") +
            "  vec3 col = vec3(0.0);  // 64回たっても外に出なかった点（集合の中）は黒\n" +
            "  // ここで、外に出た点（n < 64.0）を palette(n / 64.0) の色で塗ろう\n" +
            "  gl_FragColor = vec4(col, 1.0);\n}",
        ),
        task: "外に出なかった回数だけ n を 1 ずつ増やし、外に出た点（n < 64.0）を palette(n / 64.0) で塗って、脱出の速さを色にしよう。",
        validators: [
          { kind: "compiles" },
          {
            kind: "pixelApprox",
            x: 0.6042,
            y: 0.5208,
            rgb: BLACK,
            message: "集合の中まで色が付いています。64回たっても外に出なかった点（n が 64.0 のまま）は黒のままにしましょう",
          },
          // Three points that escape after 5, 7 and 9 steps at every shift of
          // ±0.3 px and in both precisions. The targets sit between counting
          // after the test (n) and before it (n + 1); both pass.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1875, y: 0.5208, rgb: [0.93, 0.07, 0.52] },
              { kind: "pixelApprox", x: 0.5208, y: 0.6875, rgb: [0.87, 0.03, 0.62] },
              { kind: "pixelApprox", x: 0.4792, y: 0.6042, rgb: [0.8, 0, 0.71] },
            ],
            message:
              "外の色が、外に出るまでの回数で変わっていません。外に出なかったときだけ n を 1 増やし、palette(n / 64.0) で塗りましょう（64 で割らないと、色がいつも同じになります）",
          },
        ],
        hints: ["n += 1.0;  // break の後ろ（外に出なかったとき）に置く", "if (n < 64.0) col = palette(n / 64.0);"],
        solution: shHigh(escapeTime(MANDELBROT_START)),
      },
    },
    {
      id: "glsl-julia",
      title: "ジュリア集合: c を固定する",
      explanation:
        "<p>同じ <code>z = z² + c</code> でも、役割を入れ替えると別の図形になります。<b>ジュリア集合</b>では、<code>c</code> をすべての画素で" +
        "同じ値に固定し、<code>z</code> の出発点を画素の位置にします。<code>c</code> の値ごとに形がまったく変わり、<code>c = (-0.12, 0.75)</code> " +
        "では、耳の生えたうさぎのような形（ドゥアディのうさぎ）になります。<code>c</code> がマンデルブロ集合の中にあるとジュリア集合は" +
        "ひとつながりの形になり、外にあると粉々のちりのようになります。</p>",
      challenge: {
        starterCode: shHigh(
          escapeTime(
            "  // ここで役割を入れ替えよう: z を画素の位置 p * 1.5 から始め、c を vec2(-0.12, 0.75) に固定する\n" + MANDELBROT_START,
          ),
        ),
        task: "z を画素の位置 p * 1.5 から始め、c を vec2(-0.12, 0.75) に固定して、ジュリア集合（うさぎの形）を描こう。",
        validators: [
          { kind: "compiles" },
          // The rabbit's body and its upper-left ear stay black. The Mandelbrot
          // set has no ear there; c conjugated mirrors the rabbit upside down.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: BLACK },
              { kind: "pixelApprox", x: 0.2292, y: 0.7292, rgb: BLACK },
            ],
            message:
              "うさぎの体と左上の耳が黒くなっていません。z を画素の位置 p * 1.5 から始め、c を vec2(-0.12, 0.75) に固定しましょう（c の符号を変えると、上下が反転した形になります）",
          },
          // Below-left, where the mirrored rabbit has its ear, and lower right:
          // outside, escaping after 1 and 3 steps. z from 0 leaves every pixel black.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2292, y: 0.2708, rgb: [0.99, 0.2, 0.33] },
              { kind: "pixelApprox", x: 0.6875, y: 0.1875, rgb: [0.97, 0.13, 0.42] },
            ],
            message: "集合の外まで黒くなっています（または形がずれています）。z は 0 ではなく、この画素の位置 p * 1.5 から始めましょう",
          },
        ],
        hints: ["vec2 z = p * 1.5;  // 出発点を、画素ごとの位置にする", "vec2 c = vec2(-0.12, 0.75);  // c はすべての画素で同じ"],
        solution: shHigh(
          escapeTime(
            "  vec2 z = p * 1.5;            // z を、この画素の位置から始める\n" +
              "  vec2 c = vec2(-0.12, 0.75);  // c はすべての画素で同じ値に固定する\n",
          ),
        ),
      },
    },
  ],
};
