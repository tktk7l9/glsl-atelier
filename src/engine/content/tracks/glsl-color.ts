// The glsl-color track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

/** The screen lesson: an evening sky and a warm glow, combined by `combine`. */
const screenMain = (combine: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  // 下の絵: 夕方の空（上ほど暗い青）\n" +
  "  vec3 base = mix(vec3(0.2, 0.35, 0.6), vec3(0.08, 0.12, 0.3), st.y);\n" +
  "  // 重ねる絵: (0.35, 0.4) を中心にした、オレンジのやわらかい光\n" +
  "  float glow = 1.0 - smoothstep(0.1, 0.45, distance(st, vec2(0.35, 0.4)));\n" +
  "  vec3 light = vec3(0.85, 0.6, 0.3) * glow;\n" +
  combine +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The overlay lesson: a grey ramp `a` and a colour `b`, multiplied in the
 *  bottom half (the reference) and combined by `top` in the top half. */
const overlayMain = (top: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  float a = st.x;                 // 下の絵: 左が黒・右が白のグレー\n" +
  "  vec3 b = vec3(0.2, 0.8, 0.95);  // 重ねる色（水色）\n" +
  "  // 下半分: 乗算の見本（右へ行っても白くならない）\n" +
  "  vec3 col = a * b;\n" +
  "  if (st.y > 0.5) {\n" +
  top +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

export const track: Track = {
  id: "glsl-color",
  domain: "glsl",
  title: "色と混色",
  summary: "mix で 2色を補間し、cos でパレットをつくり、スクリーンやオーバーレイで 2枚の絵を重ねる。",
  icon: "🌈",
  lessons: [
    {
      id: "glsl-mix",
      title: "2色を補間: mix",
      explanation:
        "<p><code>mix(a, b, t)</code> は t=0 で a、t=1 で b、その間をなめらかに混ぜます。" +
        "<code>t</code> に <code>st.x</code> を渡すと横方向のグラデーションになります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 a = vec3(0.1, 0.2, 0.9);\n  vec3 b = vec3(1.0, 0.6, 0.1);\n  vec3 col = a;\n  gl_FragColor = vec4(col, 1.0);\n}",
        ),
        task: "左で青(a)・右でオレンジ(b)になるよう mix で補間しよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "mix" },
          { kind: "pixelApprox", x: 0.05, y: 0.5, rgb: [0.1, 0.2, 0.9], tol: 0.18 },
          { kind: "pixelApprox", x: 0.95, y: 0.5, rgb: [1, 0.6, 0.1], tol: 0.18 },
          { kind: "gradient", axis: "x", dir: "up", channel: "r" },
        ],
        hints: ["vec3 col = mix(a, b, st.x);", "t は 0〜1 の値（st.x がちょうどいい）"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 a = vec3(0.1, 0.2, 0.9);\n  vec3 b = vec3(1.0, 0.6, 0.1);\n  vec3 col = mix(a, b, st.x);\n  gl_FragColor = vec4(col, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-palette",
      title: "コサイン・パレット",
      explanation:
        "<p><code>0.5 + 0.5 * cos(...)</code> で 0〜1 を往復する波が作れます。RGB に位相をずらして" +
        "渡すと、なめらかな虹色のパレットになります（Inigo Quilez の定番）。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 col = vec3(st.x);\n  gl_FragColor = vec4(col, 1.0);\n}",
        ),
        task: "cos を使って横方向に虹色が変化するパレットを作ろう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "cos" },
          { kind: "notUniform" },
        ],
        hints: [
          "vec3 col = 0.5 + 0.5 * cos(6.2831 * (st.x + vec3(0.0, 0.33, 0.67)));",
          "RGB それぞれに位相をずらすのがコツ",
        ],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec3 col = 0.5 + 0.5 * cos(6.2831 * (st.x + vec3(0.0, 0.33, 0.67)));\n  gl_FragColor = vec4(col, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-screen-blend",
      title: "光を重ねる: スクリーン合成",
      explanation:
        "<p>2枚の絵（レイヤー）の色 <code>a</code>・<code>b</code> の重ね方はいくつもあります。<b>乗算</b> <code>a * b</code> は暗くなる重ね方（影やインク）。" +
        "反対に、2台のプロジェクターで同じスクリーンに映したように明るくなる重ね方が<b>スクリーン</b>で、<code>1.0 - (1.0 - a) * (1.0 - b)</code> と書きます。" +
        "1 から引いて（反転して）掛け、もう一度 1 から引く形です。ただの足し算 <code>a + b</code> は 1.0 を超えた所が白く飛びますが、" +
        "スクリーンは 1.0 を超えないので、光の中心にも色が残ります。</p>",
      challenge: {
        starterCode: sh(screenMain("  // いまは足し算。光の中心が白っぽく飛んでいる\n  vec3 col = base + light;\n")),
        task: "col を base と light のスクリーン合成 1.0 - (1.0 - base) * (1.0 - light) にして、光の中心まで色が残るように重ねよう。",
        validators: [
          { kind: "compiles" },
          // Exact arithmetic, so a tight tolerance: the sum (the starter)
          // and max() both miss each lit pixel by 0.17 or more.
          {
            kind: "pixelApprox",
            x: 0.3542,
            y: 0.3958,
            rgb: [0.88, 0.7, 0.64],
            tol: 0.1,
            message: "光の中心の色が違います。col = 1.0 - (1.0 - base) * (1.0 - light) にしましょう",
          },
          { kind: "pixelApprox", x: 0.4792, y: 0.4792, rgb: [0.83, 0.67, 0.61], tol: 0.1 },
          { kind: "pixelApprox", x: 0.1875, y: 0.2708, rgb: [0.72, 0.62, 0.63], tol: 0.1 },
          // Where the light does not reach, the sky stays as it was.
          { kind: "pixelApprox", x: 0.8958, y: 0.8958, rgb: [0.09, 0.15, 0.33], tol: 0.1 },
        ],
        hints: [
          "vec3 col = 1.0 - (1.0 - base) * (1.0 - light);",
          "1.0 - base のように float から vec3 を引くと、各成分から引かれます",
        ],
        solution: sh(screenMain("  vec3 col = 1.0 - (1.0 - base) * (1.0 - light);  // スクリーン: 反転して掛けて、また反転\n")),
      },
    },
    {
      id: "glsl-overlay-blend",
      title: "コントラストを強める: オーバーレイ",
      explanation:
        "<p><b>オーバーレイ</b>は、下の絵の明るさで乗算とスクリーンを使い分ける重ね方です。下の色 <code>a</code> が 0.5 より暗い所は乗算を 2倍した " +
        "<code>2.0 * a * b</code>、明るい所はスクリーンを 2倍した形の <code>1.0 - 2.0 * (1.0 - a) * (1.0 - b)</code>。暗い所はより暗く、" +
        "明るい所はより明るくなり、ちょうど 0.5 のグレーは重ねた色 <code>b</code> そのものになります。白黒の絵にコントラストを残したまま色をのせる定番です。" +
        "2つの式は <code>mix(暗い側, 明るい側, step(0.5, a))</code> で、if を使わずに切り替えられます。</p>",
      challenge: {
        starterCode: sh(overlayMain("    // 上半分: ここをオーバーレイにしよう（いまは乗算のまま）\n    col = a * b;\n")),
        task: "上半分を、a が 0.5 より暗い所は 2.0 * a * b、明るい所は 1.0 - 2.0 * (1.0 - a) * (1.0 - b) になるオーバーレイにして、黒 → 水色 → 白 のグラデーションにしよう。",
        validators: [
          { kind: "compiles" },
          // The top half: dark side, middle, light side. A smooth mix by a
          // instead of step misses the dark side by 0.15.
          {
            kind: "pixelApprox",
            x: 0.2292,
            y: 0.7292,
            rgb: [0.09, 0.37, 0.44],
            tol: 0.1,
            message: "暗い側（左）の色が違います。a が 0.5 より小さい所は 2.0 * a * b にしましょう",
          },
          { kind: "pixelApprox", x: 0.4792, y: 0.7292, rgb: [0.19, 0.77, 0.91], tol: 0.1 },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.7292, y: 0.7292, rgb: [0.57, 0.89, 0.97], tol: 0.1 },
              { kind: "pixelApprox", x: 0.7708, y: 0.7292, rgb: [0.63, 0.91, 0.98], tol: 0.1 },
            ],
            message: "明るい側（右）が白に近づいていません。a が 0.5 以上の所は 1.0 - 2.0 * (1.0 - a) * (1.0 - b) にしましょう",
          },
        ],
        hints: [
          "vec3 dark = 2.0 * a * b;  vec3 light = 1.0 - 2.0 * (1.0 - a) * (1.0 - b);",
          "col = mix(dark, light, step(0.5, a));  // a が 0.5 以上なら light",
        ],
        solution: sh(
          overlayMain(
            "    vec3 dark = 2.0 * a * b;                         // 暗い所: 乗算の 2倍\n" +
              "    vec3 light = 1.0 - 2.0 * (1.0 - a) * (1.0 - b);  // 明るい所: スクリーンの形\n" +
              "    col = mix(dark, light, step(0.5, a));            // a が 0.5 以上なら light\n",
          ),
        ),
      },
    },
  ],
};
