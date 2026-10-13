// The glsl-lines track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { CENTRED, sh } from "./shared-glsl.js";

/** segment() with `body` computing the distance from p to the segment a-b. */
const segmentFn = (body: string): string =>
  "// 点 p から、a と b を結ぶ線分までの距離\n" +
  "float segment(vec2 p, vec2 a, vec2 b) {\n" +
  "  vec2 pa = p - a;\n" +
  "  vec2 ba = b - a;\n" +
  body +
  "}\n\n";

const SEGMENT_BODY =
  "  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);  // 線分の上で p にいちばん近い点（a で 0、b で 1）\n" +
  "  return length(pa - ba * h);                              // その点までの距離\n";

const SEGMENT_FN = segmentFn(SEGMENT_BODY);

const BG = "vec3(0.05, 0.07, 0.15)";
const INK = "vec3(0.3, 0.9, 1.0)";

/** main(): `distance` sets d (the distance to what is drawn); a line 0.02 thick
 *  each side, with a soft edge. */
const lineMain = (distance: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  distance +
  `  vec3 col = mix(${BG}, ${INK}, 1.0 - smoothstep(0.02, 0.03, d));  // 距離 0.02 までを線にする\n` +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const SEGMENT_ENDS =
  "  vec2 a = vec2(0.1458, 0.3125);  // 線分の始点\n" +
  "  vec2 b = vec2(0.8958, 0.6875);  // 線分の終点\n" +
  "  float d = segment(st, a, b);\n";

const TRIANGLE_CORNERS =
  "  vec2 a = vec2(0.1458, 0.2292);  // 三角形の 3つの角\n" +
  "  vec2 b = vec2(0.8125, 0.2292);\n" +
  "  vec2 c = vec2(0.4792, 0.8958);\n";

/** The polygon lesson's main(): `measure` sets d, the distance used for the fill. */
const polygonMain = (measure: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float n = 6.0;               // 辺の数\n" +
  "  float r = 6.2832 / n;        // 1つの辺が受け持つ角度\n" +
  "  float a = atan(p.y, p.x);    // この点の角度\n" +
  measure +
  `  vec3 col = mix(${BG}, vec3(1.0, 0.75, 0.3), 1.0 - step(0.6, d));  // d が 0.6 より小さい所を塗る\n` +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const LINE: [number, number, number] = [0.3, 0.9, 1];
const EMPTY: [number, number, number] = [0.05, 0.07, 0.15];
const FILL: [number, number, number] = [1, 0.75, 0.3];

export const track: Track = {
  id: "glsl-lines",
  domain: "glsl",
  title: "線分と多角形",
  summary: "点と線分の距離で線を描き、線分を min でつないで三角形の輪郭にし、角度を区切って正多角形を塗る。",
  icon: "🔷",
  lessons: [
    {
      id: "glsl-segment",
      title: "線分を描く: 線分までの距離",
      explanation:
        "<p>線を描くには、各画素から<b>線分までの距離</b>を求めて、距離が小さい画素を塗ります。点 p から線分 a-b への距離は、" +
        "まず線分の上で p にいちばん近い点を探します。<code>dot(pa, ba) / dot(ba, ba)</code> は、p を線分の向きへ投影したときの位置で、" +
        "a で 0、b で 1 になります。これを <code>clamp</code> で 0〜1 に収めるのが要点で、収めないと線分の先まで延びた<b>直線</b>になってしまいます。" +
        "最後に、その点 <code>a + ba * h</code> と p の距離 <code>length(pa - ba * h)</code> を返します。</p>",
      challenge: {
        starterCode: sh(
          segmentFn("  // ここで、線分の上で p にいちばん近い点の位置 h（0〜1）を求め、そこまでの距離を返そう（いまは a までの距離）\n  return length(pa);\n") +
            lineMain(SEGMENT_ENDS),
        ),
        task: "segment で h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0) を求め、length(pa - ba * h) を返して、a から b への線分を描こう。",
        validators: [
          { kind: "compiles" },
          // Three points on the segment (it passes through these samples), two
          // on the line beyond its ends, and one far from it.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3125, y: 0.3958, rgb: LINE },
              { kind: "pixelApprox", x: 0.5625, y: 0.5208, rgb: LINE },
              { kind: "pixelApprox", x: 0.8125, y: 0.6458, rgb: LINE },
            ],
            message: "a から b への線が描けていません。h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); を求めて、length(pa - ba * h) を返しましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.0625, y: 0.2708, rgb: EMPTY },
              { kind: "pixelApprox", x: 0.9792, y: 0.7292, rgb: EMPTY },
              { kind: "pixelApprox", x: 0.5208, y: 0.8542, rgb: EMPTY },
            ],
            message: "線が a や b の先まで延びています。h を clamp で 0〜1 に収めると、線分の両端で止まります",
          },
        ],
        hints: ["h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);  // 線分の上の位置（0〜1）", "return length(pa - ba * h);"],
        solution: sh(SEGMENT_FN + lineMain(SEGMENT_ENDS)),
      },
    },
    {
      id: "glsl-triangle-outline",
      title: "折れ線: 線分を min でつなぐ",
      explanation:
        "<p>いくつもの線分を描くときは、それぞれの線分までの距離を求めて、<b>いちばん小さいもの</b>を <code>min</code> で選びます。" +
        "「どれかの線分に近ければ塗る」という意味になり、線分がつながった折れ線になります（SDF の和集合と同じ考え方です）。" +
        "三角形の 3つの辺 a-b、b-c、c-a の距離の <code>min</code> を取れば、三角形の輪郭が描けます。<code>max</code> にすると「すべての辺に近い所」" +
        "になり、ほとんど何も描かれません。</p>",
      challenge: {
        starterCode: sh(
          SEGMENT_FN +
            lineMain(TRIANGLE_CORNERS + "  // ここで、辺 b-c と c-a の距離も求め、min でいちばん近い辺までの距離にしよう（いまは辺 a-b だけ）\n  float d = segment(st, a, b);\n"),
        ),
        task: "d を 3つの辺 segment(st, a, b)・segment(st, b, c)・segment(st, c, a) の min にして、三角形の輪郭を描こう。",
        validators: [
          { kind: "compiles" },
          // A point on each side, the middle of the triangle (outline only)
          // and a point outside.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.2292, rgb: LINE },
              { kind: "pixelApprox", x: 0.2708, y: 0.4792, rgb: LINE },
              { kind: "pixelApprox", x: 0.6875, y: 0.4792, rgb: LINE },
            ],
            message: "三角形の 3つの辺がそろっていません。d = min(segment(st, a, b), min(segment(st, b, c), segment(st, c, a))); にしましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.4375, rgb: EMPTY },
              { kind: "pixelApprox", x: 0.1042, y: 0.7708, rgb: EMPTY },
            ],
            message: "輪郭ではない所まで塗られています。3つの距離は min でまとめましょう（足し算や max ではなく）",
          },
        ],
        hints: ["min(x, y) は小さいほう: いちばん近い辺までの距離になる", "float d = min(segment(st, a, b), min(segment(st, b, c), segment(st, c, a)));"],
        solution: sh(
          SEGMENT_FN +
            lineMain(
              TRIANGLE_CORNERS +
                "  float d = min(segment(st, a, b), min(segment(st, b, c), segment(st, c, a)));  // いちばん近い辺までの距離\n",
            ),
        ),
      },
    },
    {
      id: "glsl-polygon",
      title: "正多角形: 角度で区切る",
      explanation:
        "<p>円は「中心からの距離が一定」ですが、正多角形は「<b>いちばん近い辺に垂直に測った距離</b>が一定」の形です。角度 <code>a</code> を、" +
        "1つの辺が受け持つ角度 <code>r = 2π / n</code> ずつに区切ると、<code>floor(0.5 + a / r) * r</code> がこの点の属する辺の向き" +
        "（辺に垂直な向き）になります。その向きとのずれの <code>cos</code> を中心からの距離に掛けると、辺に垂直に測った距離になります。" +
        "あとは円と同じように、その値が 0.6 より小さい所を塗れば正 n 角形です。<code>n</code> を変えるだけで三角形にも八角形にもなります。</p>",
      challenge: {
        starterCode: sh(
          polygonMain("  // ここで、d を辺に垂直に測った距離にして、円を正六角形にしよう（いまは中心からの距離 = 円）\n  float d = length(p);\n"),
        ),
        task: "d を cos(floor(0.5 + a / r) * r - a) * length(p) にして、円を正六角形にしよう。",
        validators: [
          { kind: "compiles" },
          // Inside the hexagon but outside a circle of radius 0.6: towards the
          // corners (top, lower left, upper right) and the middle.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.8125, rgb: FILL },
              { kind: "pixelApprox", x: 0.2292, y: 0.3542, rgb: FILL },
              { kind: "pixelApprox", x: 0.7708, y: 0.6458, rgb: FILL },
              { kind: "pixelApprox", x: 0.4792, y: 0.4792, rgb: FILL },
            ],
            message: "正六角形になっていません。d = cos(floor(0.5 + a / r) * r - a) * length(p); で、いちばん近い辺に垂直に測った距離にしましょう",
          },
          // Just past the flat left and right sides, and a corner of the
          // canvas: a pentagon or a turned hexagon reaches one of them.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1875, y: 0.4792, rgb: EMPTY },
              { kind: "pixelApprox", x: 0.8125, y: 0.4792, rgb: EMPTY },
              { kind: "pixelApprox", x: 0.1042, y: 0.8542, rgb: EMPTY },
            ],
            message: "六角形の左右の辺の外まで塗られています。n は 6.0 のまま、floor の中の 0.5 も忘れずに（辺の向きが半分ずれます）",
          },
        ],
        hints: ["floor(0.5 + a / r) * r は、この点がいる辺の向き", "float d = cos(floor(0.5 + a / r) * r - a) * length(p);"],
        solution: sh(polygonMain("  float d = cos(floor(0.5 + a / r) * r - a) * length(p);  // いちばん近い辺に垂直に測った距離\n")),
      },
    },
  ],
};
