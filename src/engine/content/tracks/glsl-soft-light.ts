// The glsl-soft-light track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { CENTRED, sh } from "./shared-glsl.js";

/** The sphere of the lighting lessons (radius 0.75, seen head-on); `light`
 *  sets `col` inside it from the surface point `P` and the normal `n`. */
const sphereMain = (light: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float r = 0.75;\n" +
  "  float d = length(p);\n" +
  "  vec3 col = vec3(0.0);  // 背景\n" +
  "  if (d < r) {\n" +
  "    vec3 P = vec3(p, sqrt(r * r - d * d));  // 球の面の点\n" +
  "    vec3 n = normalize(P);                  // 球の面の向き（法線）\n" +
  light +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const SKY_GROUND =
  "    vec3 sky = vec3(0.45, 0.65, 1.0);     // 空の色（上から届く光）\n" +
  "    vec3 ground = vec3(0.45, 0.3, 0.15);  // 地面の照り返し（下から届く光）\n";

const HALF_LAMBERT_START =
  "    vec3 L = normalize(vec3(-0.6, 0.6, 0.5));  // 左上から差す光\n" +
  "    float ndl = dot(n, L);                      // 光の向きとの内積（-1〜1）\n";

const HALF_LAMBERT_END = "    col = vec3(1.0, 0.55, 0.25) * diff;\n";

const BULB =
  "    vec3 lightPos = vec3(-0.9, 0.7, 0.9);  // 球の左上手前にある電球\n" +
  "    vec3 toLight = lightPos - P;\n" +
  "    float dist = length(toLight);          // 電球までの距離\n" +
  "    float diff = max(dot(n, normalize(toLight)), 0.0);\n";

const BULB_END = "    col = vec3(1.0, 0.85, 0.6) * diff * atten * 2.0;\n";

export const track: Track = {
  id: "glsl-soft-light",
  domain: "glsl",
  title: "光の当て方を工夫する",
  summary: "上と下で色が変わる空と地面の光（半球ライト）、裏まで回り込む光（ハーフランバート）、離れるほど弱まる電球の光（減衰）で、陰影を描き分ける。",
  icon: "🌤️",
  lessons: [
    {
      id: "glsl-hemisphere",
      title: "空と地面の光: 半球ライト",
      explanation:
        "<p>外にある物は、上からは空の青い光、下からは地面の照り返しを受けます。これを手軽にまねるのが<b>半球ライト</b>です。" +
        "法線の上向きの成分 <code>n.y</code>（-1〜1）を <code>n.y * 0.5 + 0.5</code> で 0〜1 に直し、<code>mix(地面の色, 空の色, その値)</code> で混ぜると、" +
        "上を向く面ほど空の色、下を向く面ほど地面の色になります。影になった所にも色がつくので、屋外の場面がぐっと自然に見えます。</p>",
      challenge: {
        starterCode: sh(
          sphereMain(
            SKY_GROUND +
              "    // ここで、n.y を 0〜1 に直して、地面の色と空の色を mix で混ぜよう（いまはどこも同じ明るさ）\n" +
              "    col = sky * 0.7;\n",
          ),
        ),
        task: "col を mix(ground, sky, n.y * 0.5 + 0.5) にして、上を向く面ほど空の色、下を向く面ほど地面の色にしよう。",
        validators: [
          { kind: "compiles" },
          // Top, bottom and lower left: from the sky's blue to the ground's brown.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.7292, rgb: [0.45, 0.58, 0.84] },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: [0.45, 0.39, 0.37] },
              { kind: "pixelApprox", x: 0.4375, y: 0.2292, rgb: [0.45, 0.35, 0.27] },
            ],
            message:
              "上と下で色が変わっていません。mix(ground, sky, n.y * 0.5 + 0.5) で、上を向くほど空の色、下を向くほど地面の色にしましょう（mix の 3つ目は 0〜1 です）",
          },
          {
            kind: "pixelApprox",
            x: 0.5208,
            y: 0.5208,
            rgb: [0.45, 0.48, 0.6],
            message: "正面を向いた所が、空と地面のちょうど中間の色になっていません。n.y は -1〜1 なので、n.y * 0.5 + 0.5 で 0〜1 に直しましょう",
          },
        ],
        hints: ["col = mix(ground, sky, n.y * 0.5 + 0.5);", "真上を向くと n.y = 1（空の色）、真下を向くと n.y = -1（地面の色）"],
        solution: sh(sphereMain(SKY_GROUND + "    col = mix(ground, sky, n.y * 0.5 + 0.5);  // 上を向くほど空の色、下を向くほど地面の色\n")),
      },
    },
    {
      id: "glsl-half-lambert",
      title: "裏まで回り込む光: ハーフランバート",
      explanation:
        "<p>ランバートの <code>max(dot(n, L), 0.0)</code> では、光と反対を向いた側はまっ黒になり、明るい所との境目がくっきりします。" +
        "<b>ハーフランバート</b>は、<code>dot(n, L)</code>（-1〜1）を <code>* 0.5 + 0.5</code> で 0〜1 に直してから 2乗します。" +
        "裏側にも光が少し回り込み、境目がなめらかになるので、キャラクターや柔らかい物の陰影によく使われます。" +
        "2乗するのは、0〜1 に直しただけでは全体が明るくなりすぎるからです。</p>",
      challenge: {
        starterCode: sh(
          sphereMain(
            HALF_LAMBERT_START +
              "    // ここで、ndl を 0〜1 に直してから 2乗して、ハーフランバートにしよう（いまはランバートで、裏側がまっ黒）\n" +
              "    float diff = max(ndl, 0.0);\n" +
              HALF_LAMBERT_END,
          ),
        ),
        task: "diff を pow(ndl * 0.5 + 0.5, 2.0) にして、光の裏側にも少し回り込む、やわらかい陰影にしよう。",
        validators: [
          { kind: "compiles" },
          // Around the terminator and on the far side: dim but not black.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6042, y: 0.3542, rgb: [0.27, 0.15, 0.07] },
              { kind: "pixelApprox", x: 0.6875, y: 0.3125, rgb: [0.14, 0.08, 0.04] },
              { kind: "pixelApprox", x: 0.5625, y: 0.4375, rgb: [0.42, 0.23, 0.11] },
            ],
            message:
              "光が裏側へ回り込む具合が違います。ndl * 0.5 + 0.5 で -1〜1 を 0〜1 に直してから、pow(…, 2.0) で 2乗しましょう（2乗しないと、裏側が明るくなりすぎます）",
          },
          {
            kind: "pixelApprox",
            x: 0.3125,
            y: 0.6458,
            rgb: [0.93, 0.51, 0.23],
            message: "光の当たる側が明るすぎます。0〜1 に直した値（ndl * 0.5 + 0.5）を 2乗しましょう",
          },
        ],
        hints: ["float diff = pow(ndl * 0.5 + 0.5, 2.0);", "ndl * 0.5 + 0.5 は、真裏で 0、真横で 0.5、正面で 1"],
        solution: sh(
          sphereMain(HALF_LAMBERT_START + "    float diff = pow(ndl * 0.5 + 0.5, 2.0);  // -1〜1 を 0〜1 に直してから 2乗する\n" + HALF_LAMBERT_END),
        ),
      },
    },
    {
      id: "glsl-light-falloff",
      title: "離れるほど弱く: 点光源の減衰",
      explanation:
        "<p>電球のような<b>点光源</b>の光は、離れるほど弱まります。光は四方へ広がるので、明るさは距離の 2乗に反比例します（<code>1.0 / (dist * dist)</code>）。" +
        "ただしこのままでは電球のすぐ近くで明るさが限りなく大きくなるので、<code>1.0 / (1.0 + k * dist * dist)</code> のように 1.0 を足して上限をつけるのが定番です。" +
        "この減衰（atten）を拡散光にかけると、電球に近い所ほど明るく、離れるにつれて暗くなります。</p>",
      challenge: {
        starterCode: sh(
          sphereMain(
            BULB +
              "    // ここで、距離の 2乗で弱まる atten にしよう（1.0 + … で、近くても明るくなりすぎないように）\n" +
              "    float atten = 1.0;  // いまは離れても弱まらない\n" +
              BULB_END,
          ),
        ),
        task: "atten を 1.0 / (1.0 + 2.0 * dist * dist) にして、電球に近い所ほど明るく、離れるほど暗くしよう。",
        validators: [
          { kind: "compiles" },
          // Next to the bulb, a little further and further still.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2708, y: 0.6875, rgb: [1, 0.85, 0.6] },
              { kind: "pixelApprox", x: 0.3542, y: 0.6042, rgb: [0.61, 0.52, 0.36] },
              { kind: "pixelApprox", x: 0.4375, y: 0.5208, rgb: [0.19, 0.16, 0.11] },
            ],
            message:
              "電球から離れるにつれての暗くなり方が違います。atten = 1.0 / (1.0 + 2.0 * dist * dist); と、距離の 2乗で弱めましょう（1.0 + を忘れると、電球の近くが白く飛びます）",
          },
        ],
        hints: ["float atten = 1.0 / (1.0 + 2.0 * dist * dist);", "距離が 2倍になると、明るさはおよそ 4分の1"],
        solution: sh(sphereMain(BULB + "    float atten = 1.0 / (1.0 + 2.0 * dist * dist);  // 距離の 2乗で弱まる\n" + BULB_END)),
      },
    },
  ],
};
