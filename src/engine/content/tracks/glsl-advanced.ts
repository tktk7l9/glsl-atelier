// The glsl-advanced track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh, shHigh } from "./shared-glsl.js";

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

export const track: Track = {
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
};
