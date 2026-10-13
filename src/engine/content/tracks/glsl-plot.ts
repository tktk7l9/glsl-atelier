// The glsl-plot track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

/** plot() with `body` as its line(s). */
const plotFn = (body: string): string =>
  "// 点 st が、グラフ（高さ y）の線の上なら 1、線から離れるほど 0（線の太さ 0.04）\n" +
  "float plot(vec2 st, float y) {\n" +
  body +
  "}\n\n";

const PLOT_FN = plotFn("  return 1.0 - smoothstep(0.0, 0.04, abs(st.y - y));  // 線からの距離が 0 なら 1、0.04 以上なら 0\n");

const GREEN = "vec3(0.3, 1.0, 0.5)";

const LINE_MAIN =
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 col = vec3(0.05, 0.07, 0.15);                    // 背景\n" +
  `  col = mix(col, ${GREEN}, plot(st, st.x));  // y = x のグラフを緑の線で\n` +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** main() of the curve lessons: `curve` sets y from st.x; the background
 *  shows y as brightness, the graph is drawn over it. */
const curveMain = (curve: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  curve +
  "  vec3 col = vec3(y);                          // y の値をそのまま明るさに（0 で黒、1 で白）\n" +
  `  col = mix(col, ${GREEN}, plot(st, y));  // y のグラフを緑の線で\n` +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const BG: [number, number, number] = [0.05, 0.07, 0.15];
const LINE: [number, number, number] = [0.3, 1, 0.5];
const grey = (v: number): [number, number, number] => [v, v, v];

export const track: Track = {
  id: "glsl-plot",
  domain: "glsl",
  title: "グラフで形を作る",
  summary: "y = f(x) のグラフを線で描き、pow で曲げ、smoothstep で S 字にする。値の変わり方を形づくる「シェイピング関数」を目で見る。",
  icon: "✏️",
  lessons: [
    {
      id: "glsl-plot-line",
      title: "グラフを描く: y = x の線",
      explanation:
        "<p>シェーダーでは、値の変わり方を関数で作る場面がたくさんあります（明るさの落ち方、動きの緩急、色の混ぜ方など）。その形を目で確かめるには、" +
        "<b>グラフ</b>を描くのがいちばんです。画素の高さ <code>st.y</code> と、グラフの高さ <code>y</code> との差 <code>abs(st.y - y)</code> が" +
        "小さい画素だけを光らせれば、それが線になります。<code>1.0 - smoothstep(0.0, 0.04, 差)</code> は、差が 0 なら 1、0.04 以上なら 0 で、" +
        "その間はなめらかにつながる（ふちがギザギザしない）線の濃さです。まずは <code>y = x</code>、左下から右上へまっすぐ伸びる線を描きます。</p>",
      challenge: {
        starterCode: sh(plotFn("  // ここで、st.y と y の差の大きさから、線の濃さ（線の上で 1、離れると 0）を返そう\n  return 0.0;\n") + LINE_MAIN),
        task: "plot が 1.0 - smoothstep(0.0, 0.04, abs(st.y - y)) を返すようにして、y = x のグラフを緑の線で描こう。",
        validators: [
          { kind: "compiles" },
          // Three points on the diagonal stay on the line however the picture
          // shifts by 0.3 px; one 6 px above it is off a line 0.04 thick (a
          // thicker line reaches it), and two far points are background
          // (without abs, everything below the line turns green).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2708, y: 0.2708, rgb: LINE },
              { kind: "pixelApprox", x: 0.6042, y: 0.6042, rgb: LINE },
              { kind: "pixelApprox", x: 0.8542, y: 0.8542, rgb: LINE },
            ],
            message: "y = x の線が描けていません。plot は 1.0 - smoothstep(0.0, 0.04, abs(st.y - y)) を返しましょう（線の上で 1、離れると 0）",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5625, rgb: BG },
              { kind: "pixelApprox", x: 0.7708, y: 0.3125, rgb: BG },
              { kind: "pixelApprox", x: 0.2708, y: 0.6042, rgb: BG },
            ],
            message: "線ではない所まで緑になっています。差は abs で大きさにし、太さは 0.04 にしましょう（abs がないと、線の下側がすべて塗られます）",
          },
        ],
        hints: ["差の大きさ: abs(st.y - y)", "return 1.0 - smoothstep(0.0, 0.04, abs(st.y - y));"],
        solution: sh(PLOT_FN + LINE_MAIN),
      },
    },
    {
      id: "glsl-plot-pow",
      title: "曲げる: pow で累乗",
      explanation:
        "<p><code>pow(x, n)</code> は x の n 乗です。x が 0〜1 のとき、n を大きくするほど、はじめはなかなか増えずに最後で一気に 1 へ駆け上がる" +
        "カーブになります（n が 1 より小さいと逆に、はじめに急に増えます）。背景の明るさを <code>y</code> そのものにしておくと、グラフの形と" +
        "明るさの変わり方が一緒に見えます。<code>pow(st.x, 5.0)</code> では、左半分はほとんど黒のまま、右端に近づいてから急に明るくなります。" +
        "光が遠くでは届かず近くで急に強まる、といった変化を作るときの基本の形です。</p>",
      challenge: {
        starterCode: sh(PLOT_FN + curveMain("  float y = st.x;  // ここで、y を st.x の 5乗（pow）にしよう\n")),
        task: "y を pow(st.x, 5.0) にして、右端で急に立ち上がるカーブを描き、背景の明るさも同じ形にしよう。",
        validators: [
          { kind: "compiles" },
          // The background is y itself: x⁵ is 0.08 at x = 0.6, 0.46 at 0.85
          // and 0.74 at 0.94 (x² is 0.36 / 0.73 / 0.88, 5^x and 5x clip to white).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6042, y: 0.8542, rgb: grey(0.08) },
              { kind: "pixelApprox", x: 0.8542, y: 0.1458, rgb: grey(0.46) },
              { kind: "pixelApprox", x: 0.9375, y: 0.2708, rgb: grey(0.74) },
              { kind: "pixelApprox", x: 0.2708, y: 0.6042, rgb: grey(0) },
            ],
            message: "明るさの変わり方が x の 5乗になっていません。y = pow(st.x, 5.0); です（pow(5.0, st.x) と逆にすると、5 の x 乗になります）",
          },
        ],
        hints: ["pow(底, 指数): pow(st.x, 5.0) は st.x の 5乗", "float y = pow(st.x, 5.0);"],
        solution: sh(PLOT_FN + curveMain("  float y = pow(st.x, 5.0);  // x の 5乗: はじめはゆっくり、最後に急に 1 へ\n")),
      },
    },
    {
      id: "glsl-plot-smoothstep",
      title: "S 字にする: smoothstep",
      explanation:
        "<p><code>smoothstep(a, b, x)</code> は、x が a 以下で 0、b 以上で 1、その間を<b>S 字</b>のカーブでなめらかにつなぎます。図形のふちを" +
        "ぼかすときに使ってきた関数ですが、グラフにすると形がよくわかります。まっすぐな坂（<code>clamp((x - a) / (b - a), 0.0, 1.0)</code>）と比べると、" +
        "両端で傾きが 0 になり、ゆっくり動き出してゆっくり止まるので、切りかえの境目が目立ちません。中身は <code>t * t * (3.0 - 2.0 * t)</code> " +
        "という 3次式です（t がまっすぐな坂）。<code>smoothstep(0.2, 0.8, st.x)</code> で、0.2 から 0.8 の間だけで 0 から 1 へ変わるグラフを描きます。</p>",
      challenge: {
        starterCode: sh(PLOT_FN + curveMain("  float y = st.x;  // ここで、y を smoothstep で 0.2〜0.8 の間だけ S 字に上がるカーブにしよう\n")),
        task: "y を smoothstep(0.2, 0.8, st.x) にして、0.2 から 0.8 の間で S 字に上がるカーブを描こう。",
        validators: [
          { kind: "compiles" },
          // Where the S-curve and a straight ramp differ most (0.09 vs 0.19 at
          // x = 0.31, 0.91 vs 0.81 at 0.69): the close tolerance tells them
          // apart; the samples keep their value within 0.01 under shifts.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3125, y: 0.8542, rgb: grey(0.1), tol: 0.05 },
              { kind: "pixelApprox", x: 0.6875, y: 0.1458, rgb: grey(0.91), tol: 0.05 },
              { kind: "pixelApprox", x: 0.5208, y: 0.8542, rgb: grey(0.55), tol: 0.05 },
            ],
            message:
              "S 字のカーブになっていません。y = smoothstep(0.2, 0.8, st.x); です（まっすぐな坂や step とは、0.2〜0.8 の間の上がり方が違います）",
          },
        ],
        hints: ["smoothstep(a, b, x): a 以下で 0、b 以上で 1、その間は S 字", "float y = smoothstep(0.2, 0.8, st.x);"],
        solution: sh(PLOT_FN + curveMain("  float y = smoothstep(0.2, 0.8, st.x);  // 0.2〜0.8 の間を S 字で 0 → 1\n")),
      },
    },
  ],
};
