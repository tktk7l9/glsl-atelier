// The glsl-rm-shading track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { shHigh } from "./shared-glsl.js";

/** The sphere-on-floor scene of the advanced track. */
const MAP_FN =
  "// 球（半径 1）と床（y = -1）を合わせたシーンまでの距離（「上級: 光を当てる」と同じ）\n" +
  "float map(vec3 p) {\n" +
  "  float sphere = length(p) - 1.0;\n" +
  "  float ground = p.y + 1.0;\n" +
  "  return min(sphere, ground);\n" +
  "}\n\n";

const NORMAL_FN =
  "// 距離の勾配＝面の向き（法線）\n" +
  "vec3 calcNormal(vec3 p) {\n" +
  "  vec2 e = vec2(0.001, 0.0);\n" +
  "  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));\n" +
  "}\n\n";

/** main(): a camera looking down at the sphere from the front; `hit` shades
 *  the hit point `p` with normal `n` (it sets `col`). */
const mainWith = (hit: string): string =>
  "void main() {\n" +
  "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n" +
  "  // 斜め上から球を見下ろすカメラ\n" +
  "  vec3 ro = vec3(0.0, 1.6, 3.4);\n" +
  "  vec3 fw = normalize(vec3(0.0, -0.5, 0.0) - ro);       // 前（見る向き）\n" +
  "  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));  // 右\n" +
  "  vec3 up = cross(rt, fw);                              // 上\n" +
  "  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.6 * fw);\n" +
  "  vec3 col = vec3(0.0, 0.0, 0.05);  // 空\n" +
  "  float t = 0.0;\n" +
  "  for (int i = 0; i < 100; i++) {\n" +
  "    vec3 p = ro + rd * t;\n" +
  "    float d = map(p);\n" +
  "    if (d < 0.001 * t) {\n" +
  "      vec3 n = calcNormal(p);\n" +
  hit +
  "      break;\n" +
  "    }\n" +
  "    t += d;\n" +
  "    if (t > 20.0) break;\n" +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** softShadow() with `line` as the step that reacts to the distance h. */
const softShadowFn = (line: string): string =>
  "// 点 ro から光の方向 rd へ進みながら、光がどれだけ届くかを調べる（1.0 = 日なた 〜 0.0 = 影）\n" +
  "float softShadow(vec3 ro, vec3 rd) {\n" +
  "  float res = 1.0;\n" +
  "  float t = 0.02;\n" +
  "  for (int i = 0; i < 64; i++) {\n" +
  "    float h = map(ro + rd * t);  // いまの点から、いちばん近い物までの距離\n" +
  line +
  "    t += clamp(h, 0.01, 0.2);\n" +
  "    if (t > 10.0) break;\n" +
  "  }\n" +
  "  return clamp(res, 0.0, 1.0);\n" +
  "}\n\n";

const SOFT_HIT =
  "      vec3 L = normalize(vec3(-0.8, 0.5, 0.6));  // 左手前の上から差す光\n" +
  "      float diff = max(dot(n, L), 0.0);\n" +
  "      float sh = softShadow(p + n * 0.01, L);\n" +
  "      col = vec3(0.08 + 0.92 * diff * sh);\n";

/** ambientOcclusion() with `line` as the step that adds up the occlusion. */
const aoFn = (line: string): string =>
  "// 点 p から法線 n の方向へ少しずつ離れながら、まわりの面がどれだけ近いかを調べる（1.0 = 開けている 〜 0.0 = すき間の奥）\n" +
  "float ambientOcclusion(vec3 p, vec3 n) {\n" +
  "  float occ = 0.0;\n" +
  "  float w = 1.0;  // 遠くの点ほど小さく数えるための重み\n" +
  "  for (int i = 1; i <= 5; i++) {\n" +
  "    float h = 0.1 * float(i);  // 法線の方向へ離れた距離\n" +
  "    float d = map(p + n * h);  // そこから、いちばん近い面までの距離\n" +
  line +
  "    w *= 0.7;\n" +
  "  }\n" +
  "  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);\n" +
  "}\n\n";

const AO_HIT =
  "      float sky = 0.5 + 0.5 * n.y;  // 上を向く面ほど、空からの光をたくさん受ける\n" +
  "      float ao = ambientOcclusion(p, n);\n" +
  "      col = vec3(0.9) * sky * ao;\n";

/** The reflection lesson's helpers: which surface was hit, its lit colour,
 *  and a second ray (GLSL ES 1.0 functions cannot call themselves). */
const REFLECT_FNS =
  "// p は床の上か（球より床のほうが近い）\n" +
  "bool isFloor(vec3 p) {\n" +
  "  return p.y + 1.0 < length(p) - 1.0;\n" +
  "}\n\n" +
  "// 光が当たった面の色（球は橙色、床は暗い灰色）\n" +
  "vec3 surface(vec3 p, vec3 n) {\n" +
  "  vec3 L = normalize(vec3(-0.8, 0.5, 0.6));\n" +
  "  float diff = max(dot(n, L), 0.0);\n" +
  "  vec3 base = isFloor(p) ? vec3(0.3, 0.3, 0.32) : vec3(1.0, 0.45, 0.15);\n" +
  "  return base * (0.35 + 0.65 * diff);\n" +
  "}\n\n" +
  "// ro から rd の向きへ進んで、当たった面の色を返す（どこにも当たらなければ空の色）\n" +
  "vec3 trace(vec3 ro, vec3 rd) {\n" +
  "  float t = 0.0;\n" +
  "  for (int i = 0; i < 100; i++) {\n" +
  "    vec3 p = ro + rd * t;\n" +
  "    float d = map(p);\n" +
  "    if (d < 0.001 * t) return surface(p, calcNormal(p));\n" +
  "    t += d;\n" +
  "    if (t > 20.0) break;\n" +
  "  }\n" +
  "  return vec3(0.0, 0.0, 0.05);\n" +
  "}\n\n";

/** The reflection lesson's shading: `mirror` runs on floor points. */
const reflectHit = (mirror: string): string =>
  "      col = surface(p, n);\n" + "      if (isFloor(p)) {\n" + mirror + "      }\n";

const SKY: [number, number, number] = [0, 0, 0.05];

export const track: Track = {
  id: "glsl-rm-shading",
  domain: "glsl",
  title: "レイマーチングの仕上げ",
  summary: "影のふちをぼかし（ソフトシャドウ）、物のすき間を暗くし（アンビエントオクルージョン）、床に映り込みを足して（reflect）、レイマーチングの絵を仕上げる。",
  icon: "🌗",
  lessons: [
    {
      id: "glsl-soft-shadow",
      title: "やわらかい影: ソフトシャドウ",
      explanation:
        "<p>「影を落とす」の影は、光へ進めたレイが物に<b>当たったかどうか</b>だけで決めたので、ふちがくっきりしていました。本物の光源には大きさがあるので、" +
        "影のふちはぼけます。レイマーチングでは、光へ進む途中で物を<b>どれだけかすめたか</b>でこれをまねできます。いちばん近い物までの距離 h を、" +
        "そこまで進んだ距離 t で割った <code>h / t</code> は、物をかすめた角度のようなもので、小さいほど光がさえぎられています。その最小値を " +
        "<code>res = min(res, 4.0 * h / t)</code> で覚えておくと、物の近くを通った光ほど暗く、ふちがなめらかにぼけた<b>ソフトシャドウ</b>になります。" +
        "4.0 を大きくすると影はくっきりし、小さくするとぼやけて、日なたまで暗くなります。</p>",
      challenge: {
        starterCode: shHigh(
          MAP_FN +
            NORMAL_FN +
            softShadowFn(
              "    // ここで、res = min(res, 4.0 * h / t) で res を小さくしていこう（いまは当たったかどうかだけの、くっきりした影）\n" +
                "    if (h < 0.001) return 0.0;\n",
            ) +
            mainWith(SOFT_HIT),
        ),
        task: "softShadow のループで、if (h < 0.001) return 0.0; の代わりに res = min(res, 4.0 * h / t); として、ふちがやわらかくぼける影にしよう。",
        validators: [
          { kind: "compiles" },
          // Two points of the penumbra, where the shadow fades out to the
          // right and at its far edge (a hard shadow is black or lit there).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8958, y: 0.6458, rgb: [0.19, 0.19, 0.19] },
              { kind: "pixelApprox", x: 0.9375, y: 0.4375, rgb: [0.3, 0.3, 0.3] },
            ],
            message:
              "影のふちがやわらかくぼけていません。res = min(res, 4.0 * h / t); と、近さ h を進んだ距離 t で割って 4.0 倍し、いちばん小さい値を残しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.6875,
            y: 0.4375,
            rgb: [0.08, 0.08, 0.08],
            message: "球のすぐ後ろの影が消えています。res = min(res, …) で、それまでで一番小さい値を残しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1875,
            y: 0.1042,
            rgb: [0.49, 0.49, 0.49],
            message: "日なたの床まで暗くなっています。h / t を 4.0 倍しましょう",
          },
          { kind: "pixelApprox", x: 0.3542, y: 0.6458, rgb: [0.97, 0.97, 0.97] },
        ],
        hints: ["res = min(res, 4.0 * h / t);", "h / t が小さいほど、光が物をかすめた（さえぎられかけた）ということ"],
        solution: shHigh(
          MAP_FN +
            NORMAL_FN +
            softShadowFn("    res = min(res, 4.0 * h / t);  // かすめた近さ h ÷ 進んだ距離 t。かすめるほど暗い\n") +
            mainWith(SOFT_HIT),
        ),
      },
    },
    {
      id: "glsl-ambient-occlusion",
      title: "すき間を暗く: アンビエントオクルージョン",
      explanation:
        "<p>部屋の隅や、物が床に接する所は、まわりの物にさえぎられて空からの光が届きにくく、少し暗くなります。これを<b>アンビエントオクルージョン</b>" +
        "（環境光のさえぎり）と言います。距離関数があれば簡単に見積もれます。面から法線の方向へ h だけ離れた点で map を測ると、まわりが開けていれば" +
        "距離 d は h と同じですが、近くに別の面があると d は h より小さくなります。その差 <code>h - d</code> を、離れるほど小さくなる重み w をかけて足し合わせれば、" +
        "すき間の奥ほど大きな値になります。1 から引いて明るさにかけると、球が床に接する所に、やわらかな陰ができます。</p>",
      challenge: {
        starterCode: shHigh(
          MAP_FN +
            NORMAL_FN +
            aoFn("    // ここで、h と d の差に重み w をかけて occ に足そう（まわりが開けていれば d は h と同じで、差は 0）\n") +
            mainWith(AO_HIT),
        ),
        task: "ambientOcclusion のループで occ += (h - d) * w; として、球が床に接する所を暗くしよう。",
        validators: [
          { kind: "compiles" },
          // Under the sphere, where it meets the floor, and the floor in
          // front of it: darker the closer they are.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.2708, rgb: [0.68, 0.68, 0.68] },
              { kind: "pixelApprox", x: 0.3125, y: 0.3958, rgb: [0.57, 0.57, 0.57] },
              { kind: "pixelApprox", x: 0.4792, y: 0.3542, rgb: [0, 0, 0] },
            ],
            message:
              "球が床に接する所の暗さが違います。occ += (h - d) * w; と、離れた距離 h と面までの距離 d の差に、重み w をかけて足しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1458,
            y: 0.1458,
            rgb: [0.9, 0.9, 0.9],
            message: "開けた床まで暗くなっています。足すのは d ではなく、h と d の差です",
          },
          { kind: "pixelApprox", x: 0.4792, y: 0.7292, rgb: [0.82, 0.82, 0.82] },
        ],
        hints: ["occ += (h - d) * w;", "まわりに何もなければ d は h と同じ。近くに面があるほど d が小さくなります"],
        solution: shHigh(
          MAP_FN +
            NORMAL_FN +
            aoFn("    occ += (h - d) * w;  // 近くに別の面があるほど d が h より小さく、差が大きくなる\n") +
            mainWith(AO_HIT),
        ),
      },
    },
    {
      id: "glsl-reflection",
      title: "床に映す: reflect でもう一度進む",
      explanation:
        "<p>磨いた床には、まわりの物が映ります。レイマーチングでは、床に当たった光線を<b>鏡のように跳ね返して、もう一度進める</b>だけで映り込みが作れます。" +
        "跳ね返った向きは GLSL の <code>reflect(入ってきた向き, 法線)</code> で求まります。その向きへ <code>trace</code> で進めて当たった物の色が、床に映る色です。" +
        "自分の床にすぐ当たらないよう、出発点は法線の向きに少し浮かせます（<code>p + n * 0.01</code>）。映った色を <code>mix(col, 映った色, 0.5)</code> で" +
        "半分まぜると、つやのある床になります。WebGL の GLSL では関数が自分自身を呼べないので、2本目の光線は別の関数 <code>trace</code> で進めます。</p>",
      challenge: {
        starterCode: shHigh(
          MAP_FN +
            NORMAL_FN +
            REFLECT_FNS +
            mainWith(reflectHit("        // ここで、跳ね返った向き reflect(rd, n) へ trace して、映った色を col に半分まぜよう\n")),
        ),
        task: "床に当たったら、reflect(rd, n) で跳ね返った向きを求め、trace(p + n * 0.01, その向き) の色を mix で半分まぜて、床に球を映そう。",
        validators: [
          { kind: "compiles" },
          // The sphere's mirror image in the floor below it…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4375, y: 0.1875, rgb: [0.45, 0.25, 0.16] },
              { kind: "pixelApprox", x: 0.3542, y: 0.2708, rgb: [0.47, 0.27, 0.16] },
            ],
            message:
              "床に球が映っていません。vec3 r = reflect(rd, n); で跳ね返った向きを求め、col = mix(col, trace(p + n * 0.01, r), 0.5); とまぜましょう（reflect は入ってきた向き rd が先です）",
          },
          // …the dark sky in the floor further away, the sphere itself and the sky.
          {
            kind: "pixelApprox",
            x: 0.1458,
            y: 0.6042,
            rgb: [0.1, 0.1, 0.13],
            message: "遠くの床に空が映っていません。床に当たったら、跳ね返った向きへ trace しましょう",
          },
          { kind: "pixelApprox", x: 0.3542, y: 0.6458, rgb: [0.98, 0.44, 0.15] },
          { kind: "pixelApprox", x: 0.5208, y: 0.9375, rgb: SKY },
        ],
        hints: ["vec3 r = reflect(rd, n);", "col = mix(col, trace(p + n * 0.01, r), 0.5);"],
        solution: shHigh(
          MAP_FN +
            NORMAL_FN +
            REFLECT_FNS +
            mainWith(
              reflectHit(
                "        vec3 r = reflect(rd, n);                      // 床で跳ね返った向き\n" +
                  "        col = mix(col, trace(p + n * 0.01, r), 0.5);  // 少し浮かせた所から進めて、映った色を半分まぜる\n",
              ),
            ),
        ),
      },
    },
  ],
};
