// The glsl-glow track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

const SEGMENT_FN =
  "// 点 p から、a と b を結ぶ線分までの距離（「線分と多角形」と同じ）\n" +
  "float segment(vec2 p, vec2 a, vec2 b) {\n" +
  "  vec2 pa = p - a;\n" +
  "  vec2 ba = b - a;\n" +
  "  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);\n" +
  "  return length(pa - ba * h);\n" +
  "}\n\n";

/** The point-glow lesson's main(): `glow` sets the glow strength from d. */
const pointGlowMain = (glow: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  float d = distance(st, vec2(0.5));      // 光の中心からの距離\n" +
  glow +
  "  vec3 col = vec3(1.0, 0.55, 0.2) * glow;  // 橙色の光（1 を超えた分は白く飛ぶ）\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The neon lesson's main(): `distance` sets d. */
const neonMain = (distance: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 a = vec2(0.2, 0.5);  // ネオン管の両端\n" +
  "  vec2 b = vec2(0.8, 0.5);\n" +
  distance +
  "  vec3 col = vec3(0.3, 0.8, 1.0) * (0.015 / d);  // 近いほど強く光る水色\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The two-lights lesson's main(): `combine` sets col from the lights a and b. */
const twoLightsMain = (combine: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 a = vec3(0.2, 0.8, 1.0) * (0.04 / distance(st, vec2(0.35, 0.5)));  // 左の水色の光\n" +
  "  vec3 b = vec3(1.0, 0.2, 0.8) * (0.04 / distance(st, vec2(0.65, 0.5)));  // 右の赤紫の光\n" +
  combine +
  "  gl_FragColor = vec4(col, 1.0);\n}";

export const track: Track = {
  id: "glsl-glow",
  domain: "glsl",
  title: "光らせる（グロー）",
  summary: "距離で割って中心ほど強く光らせ、線分の距離でネオン管にし、光を足し合わせてトーンマッピングで白飛びを抑える。",
  icon: "🔆",
  lessons: [
    {
      id: "glsl-glow",
      title: "距離で光る: 1 / d のグロー",
      explanation:
        "<p>光の玉のまわりの<b>ぼんやりした輝き</b>（グロー）は、中心からの距離 <code>d</code> で割るだけで作れます。<code>0.03 / d</code> は、" +
        "中心に近づくほど急に大きくなり、遠くではゆっくり 0 に近づくので、本物の光のように中心が明るく、まわりへ柔らかく広がります。" +
        "分子の <code>0.03</code> が光の強さです。<code>1.0 - d</code> のようなまっすぐな減り方ではのっぺりし、<code>0.03 / (d * d)</code> では" +
        "まわりが急に暗くなりすぎます。値が 1 を超える中心付近は、画面では白く飛びます。</p>",
      challenge: {
        starterCode: sh(pointGlowMain("  // ここで、中心に近いほど強く光る glow を 0.03 / d で求めよう（いまは光っていない）\n  float glow = 0.0;\n")),
        task: "glow を 0.03 / d にして、中心ほど強く、まわりへ柔らかく広がる橙色の光の玉を描こう。",
        validators: [
          { kind: "compiles" },
          // Points 0.10, 0.19, 0.30 and 0.43 away from the middle.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6042, y: 0.5208, rgb: [0.28, 0.15, 0.05] },
              { kind: "pixelApprox", x: 0.4792, y: 0.6875, rgb: [0.16, 0.09, 0.03] },
              { kind: "pixelApprox", x: 0.7292, y: 0.3125, rgb: [0.1, 0.05, 0.02] },
              { kind: "pixelApprox", x: 0.1875, y: 0.8125, rgb: [0.07, 0.04, 0.01] },
            ],
            message: "光の広がり方が違います。glow = 0.03 / d; と、距離で割りましょう（1.0 - d や d * d で割るのとは、明るさの落ち方が違います）",
          },
        ],
        hints: ["距離で割ると、近いほど大きくなる", "float glow = 0.03 / d;"],
        solution: sh(pointGlowMain("  float glow = 0.03 / d;  // 中心に近いほど急に強くなる光\n")),
      },
    },
    {
      id: "glsl-neon",
      title: "ネオン管: 線分の距離で光らせる",
      explanation:
        "<p>グローは「何までの距離か」を変えるだけで、どんな形でも光らせられます。点までの距離の代わりに<b>線分までの距離</b>を使えば、" +
        "線のまわりがぼんやり光る<b>ネオン管</b>になります。「線分と多角形」で作った <code>segment(st, a, b)</code> がそのまま使えます。" +
        "線分の両端の先では、端の点からの距離になるので、光は丸く収まります。</p>",
      challenge: {
        starterCode: sh(
          SEGMENT_FN +
            neonMain("  // ここで、d を線分 a-b までの距離にして、線をネオン管にしよう（いまは真ん中の点までの距離）\n  float d = distance(st, vec2(0.5));\n"),
        ),
        task: "d を segment(st, a, b) にして、a から b への線分のまわりを水色のネオン管のように光らせよう。",
        validators: [
          { kind: "compiles" },
          // Near the tube on both halves, past its ends, and away from it.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2708, y: 0.5625, rgb: [0.07, 0.18, 0.23] },
              { kind: "pixelApprox", x: 0.7292, y: 0.4375, rgb: [0.08, 0.2, 0.25] },
              { kind: "pixelApprox", x: 0.8958, y: 0.4792, rgb: [0.05, 0.13, 0.16] },
              { kind: "pixelApprox", x: 0.1042, y: 0.5208, rgb: [0.05, 0.13, 0.16] },
              { kind: "pixelApprox", x: 0.4792, y: 0.7292, rgb: [0.02, 0.05, 0.07] },
            ],
            message: "線分のまわりが光っていません。d = segment(st, a, b); と、線分までの距離にしましょう（線分の先までは延びません）",
          },
        ],
        hints: ["点までの距離を、線分までの距離に替える", "float d = segment(st, a, b);"],
        solution: sh(SEGMENT_FN + neonMain("  float d = segment(st, a, b);  // 線分までの距離\n")),
      },
    },
    {
      id: "glsl-glow-add",
      title: "光を重ねる: 足し算とトーンマッピング",
      explanation:
        "<p>光は<b>足し算</b>で重なります。2つのグローを <code>a + b</code> で足すと、重なる所はより明るくなり、色も混ざります（<code>max</code> では" +
        "明るいほうしか残らず、重なっても明るくなりません）。ただし足すと 1 を超えやすく、そのままでは画面で白く飛んで色が失われます。" +
        "そこで「仕上げのエフェクト」のトーンマッピング <code>1.0 - exp(-col)</code> をかけると、どんなに大きな値も 0〜1 になめらかに収まり、" +
        "明るい所の色も残ります。</p>",
      challenge: {
        starterCode: sh(
          twoLightsMain(
            "  // ここで、2つの光を足し算で重ね、1.0 - exp(-col) でなめらかに 0〜1 へ収めよう（いまは明るいほうだけ）\n" +
              "  vec3 col = max(a, b);\n",
          ),
        ),
        task: "col を a + b にして 2つの光を足し合わせ、col = 1.0 - exp(-col) でトーンマッピングして、白飛びさせずに重ねよう。",
        validators: [
          { kind: "compiles" },
          // Between the lights (both add up), close to each light (where the
          // sum passes 1 and only the tone mapping keeps the colour), and a
          // corner.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [0.29, 0.22, 0.38] },
              { kind: "pixelApprox", x: 0.3125, y: 0.5625, rgb: [0.2, 0.36, 0.47] },
              { kind: "pixelApprox", x: 0.6875, y: 0.4792, rgb: [0.59, 0.24, 0.56] },
              { kind: "pixelApprox", x: 0.1458, y: 0.1458, rgb: [0.08, 0.09, 0.14] },
            ],
            message:
              "光の重なり方が違います。vec3 col = a + b; と足し算で重ねてから、col = 1.0 - exp(-col); で 0〜1 に収めましょう（足しただけだと白く飛びます）",
          },
        ],
        hints: ["光は足し算: vec3 col = a + b;", "col = 1.0 - exp(-col);  // 大きな値もなめらかに 0〜1 へ"],
        solution: sh(
          twoLightsMain(
            "  vec3 col = a + b;         // 光は足し算で重なる\n" + "  col = 1.0 - exp(-col);    // 1 を超えた分も、なめらかに 0〜1 へ収める\n",
          ),
        ),
      },
    },
  ],
};
