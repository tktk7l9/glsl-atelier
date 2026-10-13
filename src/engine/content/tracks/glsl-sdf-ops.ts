// The glsl-sdf-ops track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { CENTRED, sh } from "./shared-glsl.js";

const SD_BOX_FN =
  "// 中心が原点・半分の大きさが b の長方形までの距離（「距離関数（SDF）」と同じ）\n" +
  "float sdBox(vec2 p, vec2 b) {\n" +
  "  vec2 q = abs(p) - b;\n" +
  "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
  "}\n\n";

/** main(): `body` sets d (and may move p); the shape is filled in `colour`. */
const fillMain = (body: string, colour: string): string =>
  "void main() {\n" +
  CENTRED +
  body +
  `  vec3 col = mix(vec3(0.05, 0.07, 0.15), ${colour}, 1.0 - step(0.0, d));  // 距離が負（形の中）を塗る\n` +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const roundMain = (line: string): string =>
  fillMain("  vec2 b = vec2(0.7, 0.5);   // 半分の大きさ\n" + "  float r = 0.3;             // 角の丸みの半径\n" + line, "vec3(0.95, 0.55, 0.25)");

const morphMain = (line: string): string =>
  fillMain(
    "  float circle = length(p) - 0.6;      // 円（半径 0.6）\n" + "  float square = sdBox(p, vec2(0.6));  // 正方形（半分の大きさ 0.6）\n" + line,
    "vec3(0.45, 0.85, 0.6)",
  );

const dotsMain = (fold: string): string =>
  fillMain("  float s = 0.3;  // 並べる間隔\n" + fold + "  float d = length(p) - 0.1;  // 半径 0.1 の点\n", "vec3(0.3, 0.9, 1.0)");

const BG: [number, number, number] = [0.05, 0.07, 0.15];
const ROUND: [number, number, number] = [0.95, 0.55, 0.25];
const MORPH: [number, number, number] = [0.45, 0.85, 0.6];
const DOT: [number, number, number] = [0.3, 0.9, 1];

export const track: Track = {
  id: "glsl-sdf-ops",
  domain: "glsl",
  title: "距離関数を使いこなす",
  summary: "距離から半径を引いて角を丸め、2つの形の距離を混ぜて中間の形を作り、点の番号を clamp で区切って数を決めて並べる。",
  icon: "🔘",
  lessons: [
    {
      id: "glsl-round-box",
      title: "角を丸める: 距離から半径を引く",
      explanation:
        "<p>距離関数は、出てきた距離から数を引くだけで形を<b>太らせ</b>られます。<code>d - r</code> は、ふちから r だけ外側までを形の中に入れるので、" +
        "まわりが r だけふくらみ、とがった角は半径 r の丸みになります。そこで、先に箱を r だけ小さくしておき（<code>sdBox(p, b - r)</code>）、" +
        "それから r を引くと、外の大きさは変わらずに<b>角だけが丸い</b>長方形になります。ボタンやカードの角丸と同じ形です。</p>",
      challenge: {
        starterCode: sh(
          SD_BOX_FN +
            roundMain(
              "  // ここで、半径 r の分だけ小さい箱の距離から r を引いて、外の大きさはそのままで角を丸めよう\n" +
                "  float d = sdBox(p, b);  // いまは角がとがっている\n",
            ),
        ),
        task: "d を sdBox(p, b - r) - r にして、外の大きさはそのままで、角が半径 0.3 の丸みになった長方形にしよう。",
        validators: [
          { kind: "compiles" },
          // The corners are cut away, the outside stays where the sharp box ended…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1875, y: 0.2708, rgb: BG },
              { kind: "pixelApprox", x: 0.8125, y: 0.7292, rgb: BG },
              { kind: "pixelApprox", x: 0.8958, y: 0.4792, rgb: BG },
            ],
            message:
              "角が丸くなっていないか、形が大きすぎます。先に r だけ小さい箱 sdBox(p, b - r) にしてから r を引きましょう（sdBox(p, b) - r だと、まわりが r だけふくらみます）",
          },
          // …and the sides still reach as far as they did.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8125, y: 0.4792, rgb: ROUND },
              { kind: "pixelApprox", x: 0.2708, y: 0.2708, rgb: ROUND },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: ROUND },
            ],
            message: "形が小さすぎます。小さくした箱 sdBox(p, b - r) から、さらに r を引いて（- r）外へふくらませましょう",
          },
        ],
        hints: ["float d = sdBox(p, b - r) - r;", "- r は形を r だけ太らせる。先に箱を r だけ小さくしておけば、外の大きさは元のまま"],
        solution: sh(
          SD_BOX_FN +
            roundMain("  float d = sdBox(p, b - r) - r;  // r だけ小さい箱を、r だけ外へふくらませる（角が丸くなる）\n"),
        ),
      },
    },
    {
      id: "glsl-sdf-morph",
      title: "中間の形: 2つの距離を混ぜる",
      explanation:
        "<p>2つの距離関数を <code>mix(d1, d2, t)</code> で混ぜると、2つの形の<b>中間の形</b>が作れます。t が 0 なら d1 の形、1 なら d2 の形、" +
        "0.5 ならちょうど間です。<code>min</code>（合体）や <code>max</code>（重なった所だけ）とは違い、どちらとも違う新しい形になります。" +
        "t を <code>sin(u_time) * 0.5 + 0.5</code> のように時間で動かせば、形がなめらかに変わり続けるアニメーションになります（ここでは 0.5 で止めて調べます）。</p>",
      challenge: {
        starterCode: sh(
          SD_BOX_FN +
            morphMain(
              "  // ここで、円と正方形の距離を mix で半分ずつ混ぜて、その中間の形にしよう\n" + "  float d = circle;  // いまは円だけ\n",
            ),
        ),
        task: "d を mix(circle, square, 0.5) にして、円と正方形のちょうど中間の形にしよう。",
        validators: [
          { kind: "compiles" },
          // On the diagonals the mixed shape reaches past the circle (0.42)
          // but stops short of the square's corner (0.60), at 0.50.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2708, y: 0.2708, rgb: MORPH },
              { kind: "pixelApprox", x: 0.7292, y: 0.7292, rgb: MORPH },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: MORPH },
            ],
            message: "円に近すぎます。mix(circle, square, 0.5) で、円と正方形を半分ずつ混ぜましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2292, y: 0.2292, rgb: BG },
              { kind: "pixelApprox", x: 0.7708, y: 0.7708, rgb: BG },
            ],
            message: "正方形に近すぎます。min（合体）ではなく mix(circle, square, 0.5) で、ちょうど中間にしましょう",
          },
        ],
        hints: ["float d = mix(circle, square, 0.5);", "mix(a, b, 0.5) は (a + b) / 2 と同じ。距離を平均すると、形も中間になります"],
        solution: sh(SD_BOX_FN + morphMain("  float d = mix(circle, square, 0.5);  // 円と正方形の、ちょうど中間の形\n")),
      },
    },
    {
      id: "glsl-sdf-repeat-count",
      title: "数を決めて並べる: 番号を clamp で区切る",
      explanation:
        "<p><code>mod</code> で座標をくり返すと、形はどこまでも並びます。<b>数を決めて</b>並べたいときは、いちばん近い点の<b>番号</b>を求め、" +
        "その番号を <code>clamp</code> で区切ります。番号は <code>floor(p / s + 0.5)</code> で求まり（四捨五入。WebGL の GLSL には round がありません）、" +
        "間隔 s 倍して p から引けば、その点が原点に来ます。番号を横 -2〜2、縦 -1〜1 に区切ると、はみ出した所は端の点からの距離になるので、" +
        "点は 5 × 3 個だけになります。</p>",
      challenge: {
        starterCode: sh(
          dotsMain(
            "  // ここで、いちばん近い点の番号 floor(p / s + 0.5) を、横は -2〜2・縦は -1〜1 に clamp で区切り、s 倍して p から引こう\n" +
              "  p = mod(p + s * 0.5, s) - s * 0.5;  // いまは、どこまでもくり返している\n",
          ),
        ),
        task: "mod の代わりに、番号 clamp(floor(p / s + 0.5), vec2(-2.0, -1.0), vec2(2.0, 1.0)) を求めて s 倍を p から引き、点を横 5個・縦 3個だけ並べよう。",
        validators: [
          { kind: "compiles" },
          // Dots in the middle, at a corner of the block and at its ends…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: DOT },
              { kind: "pixelApprox", x: 0.6458, y: 0.6458, rgb: DOT },
              { kind: "pixelApprox", x: 0.1875, y: 0.3542, rgb: DOT },
              { kind: "pixelApprox", x: 0.8125, y: 0.5208, rgb: DOT },
            ],
            message:
              "点が欠けているか、ずれています。番号は floor(p / s + 0.5)（四捨五入）で求め、clamp で横 -2〜2・縦 -1〜1 に区切りましょう",
          },
          // …none beyond it…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.8125, rgb: BG },
              { kind: "pixelApprox", x: 0.9375, y: 0.5208, rgb: BG },
              { kind: "pixelApprox", x: 0.0625, y: 0.1875, rgb: BG },
            ],
            message: "点が 5 × 3 個より多く並んでいます。番号を clamp(…, vec2(-2.0, -1.0), vec2(2.0, 1.0)) で区切りましょう",
          },
          // …and gaps between them.
          {
            kind: "pixelApprox",
            x: 0.7292,
            y: 0.5625,
            rgb: BG,
            message: "点どうしがつながっています。clamp の前に floor で番号を整数にしましょう",
          },
        ],
        hints: [
          "vec2 id = clamp(floor(p / s + 0.5), vec2(-2.0, -1.0), vec2(2.0, 1.0));",
          "p -= s * id;  // いちばん近い点が原点に来る",
        ],
        solution: sh(
          dotsMain(
            "  vec2 id = clamp(floor(p / s + 0.5), vec2(-2.0, -1.0), vec2(2.0, 1.0));  // いちばん近い点の番号（横 -2〜2、縦 -1〜1 で止める）\n" +
              "  p -= s * id;                                                              // その点が原点に来るようにずらす\n",
          ),
        ),
      },
    },
  ],
};
