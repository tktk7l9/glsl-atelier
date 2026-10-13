// The glsl-sdf3d track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { shHigh } from "./shared-glsl.js";

const ROT_FN =
  "// 2D の回転行列（a ラジアン）\n" +
  "mat2 rot(float a) {\n" +
  "  float c = cos(a);\n" +
  "  float s = sin(a);\n" +
  "  return mat2(c, -s, s, c);\n" +
  "}\n\n";

/** sdBox() with `body` as its lines. */
const sdBoxFn = (body: string): string =>
  "// 中心が原点で、半分の大きさが b の箱までの距離\n" + "float sdBox(vec3 p, vec3 b) {\n" + body + "}\n\n";

const SD_BOX_BODY =
  "  vec3 q = abs(p) - b;  // 箱の面からのはみ出し（8つの角を 1つにまとめて考える）\n" +
  "  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);  // 外側の距離 + 内側の距離\n";

const SD_BOX_FN = sdBoxFn(SD_BOX_BODY);

/** The scene's map() with `body` as its lines. */
const mapFn = (body: string): string => "// シーン全体までの距離\n" + "float map(vec3 p) {\n" + body + "}\n\n";

/** The ray marcher (camera at z = 4, orange surfaces lit from the upper right). */
const MARCHER =
  "// 距離の勾配＝面の向き（法線）\n" +
  "vec3 calcNormal(vec3 p) {\n" +
  "  vec2 e = vec2(0.001, 0.0);\n" +
  "  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));\n" +
  "}\n\n" +
  "void main() {\n" +
  "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
  "  vec3 ro = vec3(0.0, 0.0, 4.0);        // カメラの位置\n" +
  "  vec3 rd = normalize(vec3(uv, -1.8));  // この画素へ向かう光線の向き\n" +
  "  vec3 col = vec3(0.02, 0.03, 0.08);    // 背景\n" +
  "  float t = 0.0;\n" +
  "  for (int i = 0; i < 100; i++) {\n" +
  "    vec3 p = ro + rd * t;\n" +
  "    float d = map(p);\n" +
  "    if (d < 0.001) {\n" +
  "      float diff = max(dot(calcNormal(p), normalize(vec3(0.6, 0.8, 0.5))), 0.0);\n" +
  "      col = vec3(0.95, 0.6, 0.3) * (0.15 + 0.85 * diff);  // 光の当たり方で明るさが変わる橙色の面\n" +
  "      break;\n" +
  "    }\n" +
  "    t += d;\n" +
  "    if (t > 30.0) break;\n" +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const BOX_MAP = mapFn(
  "  p.xz = rot(0.6) * p.xz;  // 斜めから見えるように、箱を回しておく\n" +
    "  p.yz = rot(0.5) * p.yz;\n" +
    "  return sdBox(p, vec3(0.8, 0.5, 0.6));\n",
);

const REPEAT_LINE = "  p.xy = mod(p.xy + 0.8, 1.6) - 0.8;  // 1.6 ごとに、同じマスの中の座標へ折りたたむ\n";
const repeatMap = (fold: string): string => mapFn(fold + "  return length(p) - 0.4;  // 半径 0.4 の球\n");

const TWIST_LINE = "  p.xz = rot(p.y * 1.2) * p.xz;  // 高さ y に合わせて水平に回す（上へ行くほど大きく回る）\n";
const twistMap = (twist: string): string =>
  mapFn(twist + "  return sdBox(p, vec3(0.45, 1.3, 0.45)) * 0.7;  // ねじると距離が少し狂うので、0.7倍して控えめに進む\n");

const SKY: [number, number, number] = [0.02, 0.03, 0.08];

export const track: Track = {
  id: "glsl-sdf3d",
  domain: "glsl",
  title: "レイマーチングで形を作る",
  summary: "距離関数を 3D にして箱を描き、mod で空間をくり返して無限に並べ、高さに合わせて座標を回して形をねじる。",
  icon: "🧱",
  lessons: [
    {
      id: "glsl-box3d",
      title: "3D の箱: 距離関数を 3D に",
      explanation:
        "<p>レイマーチングでは、どんな形も「その点から形までの距離」（距離関数）さえ書ければ描けます。箱の距離は 2D の箱とほぼ同じで、" +
        "<code>q = abs(p) - b</code> で箱の面からのはみ出しを求めます（<code>abs</code> で 8つの角を 1つにまとめて考えられます）。外側の距離は " +
        "<code>length(max(q, 0.0))</code>、内側（すべての q が負）では <code>max(q.x, max(q.y, q.z))</code> が面までの距離（負の値）で、" +
        "<code>min(..., 0.0)</code> で内側のときだけ足します。シーンの <code>map</code> は箱を回してから測っているので、斜めから見た 3つの面が" +
        "光の当たり方で塗り分けられます。</p>",
      challenge: {
        starterCode: shHigh(
          ROT_FN +
            sdBoxFn("  // ここで、箱までの距離を返そう（いまは半径 b.x の球までの距離）\n  return length(p) - b.x;\n") +
            BOX_MAP +
            MARCHER,
        ),
        task: "sdBox で q = abs(p) - b を求め、length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) を返して、球を箱にしよう。",
        validators: [
          { kind: "compiles" },
          // The dark front face (left), the lit right face, the top face, and
          // the sky where the starter's sphere would bulge out.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2708, y: 0.5208, rgb: [0.14, 0.09, 0.04] },
              { kind: "pixelApprox", x: 0.6875, y: 0.5208, rgb: [0.71, 0.44, 0.22] },
              { kind: "pixelApprox", x: 0.5208, y: 0.5625, rgb: [0.67, 0.43, 0.21] },
              { kind: "pixelApprox", x: 0.3958, y: 0.6458, rgb: SKY },
            ],
            message:
              "箱になっていません。q = abs(p) - b; を求めて length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) を返しましょう（abs がないと、箱の 1つの角しか作れません）",
          },
        ],
        hints: ["vec3 q = abs(p) - b;  // 箱の面からのはみ出し", "return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);"],
        solution: shHigh(ROT_FN + SD_BOX_FN + BOX_MAP + MARCHER),
      },
    },
    {
      id: "glsl-repeat3d",
      title: "空間をくり返す: mod で無限に並べる",
      explanation:
        "<p>距離関数の入力 <code>p</code> を <code>mod</code> で折りたためば、<b>1つの形を書くだけで、無限にくり返せます</b>。" +
        "<code>mod(p.xy + 0.8, 1.6) - 0.8</code> は、どこにいても「1.6 四方のマスの中で、マスの中心から見た位置」（-0.8〜0.8）を返すので、" +
        "どのマスにも同じ球があるように測れます。計算はたった 1行なのに、描ける球はいくつでも増えます。<code>+ 0.8</code> を忘れると、" +
        "マスの境目に球の中心が来てしまい、並びが半マスずれます。</p>",
      challenge: {
        starterCode: shHigh(repeatMap("  // ここで、p.xy を mod で 1.6 ごとにくり返そう（いまは原点の球 1つ）\n") + MARCHER),
        task: "map の最初で p.xy = mod(p.xy + 0.8, 1.6) - 0.8 として、球を縦横に 1.6 ごとに無限に並べよう。",
        validators: [
          { kind: "compiles" },
          // Spheres in a corner cell, a side cell and the middle; the gaps
          // between them stay empty.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1042, y: 0.8958, rgb: [0.49, 0.31, 0.16] },
              { kind: "pixelApprox", x: 0.8958, y: 0.5208, rgb: [0.59, 0.37, 0.18] },
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [0.69, 0.44, 0.22] },
              { kind: "pixelApprox", x: 0.1458, y: 0.1458, rgb: [0.83, 0.53, 0.26] },
            ],
            message: "球が縦横に並んでいません。p.xy = mod(p.xy + 0.8, 1.6) - 0.8; で、x も y も 1.6 ごとにくり返しましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3125, y: 0.5208, rgb: SKY },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: SKY },
            ],
            message: "球の並びがずれています。mod の前に 0.8 を足し、後で 0.8 を引くと、マスの中心に球が来ます",
          },
        ],
        hints: ["mod(x + 0.8, 1.6) - 0.8 は、-0.8〜0.8 をくり返す", "p.xy = mod(p.xy + 0.8, 1.6) - 0.8;"],
        solution: shHigh(repeatMap(REPEAT_LINE) + MARCHER),
      },
    },
    {
      id: "glsl-twist",
      title: "ねじる: 高さに合わせて回す",
      explanation:
        "<p>距離を測る前に座標を変形すると、形そのものを変形できます。<code>p.xz</code> を、高さ <code>p.y</code> に比例した角度で回すと、" +
        "高い所ほど大きく回る＝<b>ねじれた</b>柱になります（回転の角度が場所ごとに違うのがポイントで、同じ角度で回すだけなら、ただ向きが変わるだけです）。" +
        "ねじると距離関数が正確な距離ではなくなり、少し大きめの値を返して形を通り越すことがあるので、0.7倍して控えめに進ませています。</p>",
      challenge: {
        starterCode: shHigh(ROT_FN + SD_BOX_FN + twistMap("  // ここで、p.xz を高さ p.y * 1.2 の角度で回して、柱をねじろう\n") + MARCHER),
        task: "map の最初で p.xz = rot(p.y * 1.2) * p.xz として、高さに合わせて回し、四角い柱をねじろう。",
        validators: [
          { kind: "compiles" },
          // Up the pillar the faces turn towards and away from the light, so
          // the shade changes with height (one fixed turn keeps each face's
          // shade all the way up).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.6042, rgb: [0.15, 0.09, 0.05] },
              { kind: "pixelApprox", x: 0.4375, y: 0.4375, rgb: [0.8, 0.5, 0.25] },
              { kind: "pixelApprox", x: 0.5208, y: 0.7708, rgb: [0.65, 0.41, 0.2] },
              { kind: "pixelApprox", x: 0.4792, y: 0.2292, rgb: [0.32, 0.2, 0.1] },
              { kind: "pixelApprox", x: 0.2708, y: 0.5208, rgb: SKY },
            ],
            message:
              "柱が高さに合わせてねじれていません。p.xz = rot(p.y * 1.2) * p.xz; で、角度を高さ p.y に比例させましょう（決まった角度で回すと、向きが変わるだけです）",
          },
        ],
        hints: ["角度を p.y に比例させる: rot(p.y * 1.2)", "p.xz = rot(p.y * 1.2) * p.xz;"],
        solution: shHigh(ROT_FN + SD_BOX_FN + twistMap(TWIST_LINE) + MARCHER),
      },
    },
  ],
};
