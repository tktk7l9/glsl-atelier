// The glsl-noise track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { RANDOM_FN, shHigh } from "./shared-glsl.js";

const CELL_POINT_FN =
  "// マス i に置く点の位置（マスの中の 0〜1）\n" +
  "vec2 cellPoint(vec2 i) {\n" +
  "  return vec2(random(i), random(i + vec2(57.0, 113.0)));\n" +
  "}\n\n";

const VORONOI_HEAD =
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 pos = st * 5.0;\n" +
  "  vec2 i = floor(pos);\n" +
  "  vec2 f = fract(pos);\n" +
  "  float m = 1.0;  // いちばん近い点までの距離\n";

export const track: Track = {
  id: "glsl-noise",
  domain: "glsl",
  title: "乱数とノイズ",
  summary: "GLSL に乱数関数はない。ハッシュで乱数を作り、なめらかなノイズや細胞の模様にする。",
  icon: "🌫️",
  lessons: [
    {
      id: "glsl-random-cells",
      title: "乱数をつくる: fract(sin(…))",
      explanation:
        "<p>GLSL には乱数関数がありません。代わりに <code>sin</code> に大きな数を掛けて " +
        "<code>fract</code> を取ると、入力がわずかに違うだけで値が飛び回る「ハッシュ」になります。" +
        "同じ入力には必ず同じ値が返るので、<code>floor</code> で求めた<b>マスの番号</b>を渡せば、" +
        "マスごとに決まった明るさが得られます。桁の大きい計算なので、このトラックでは " +
        "<code>precision highp float</code> にしています。</p>",
      challenge: {
        starterCode: shHigh(
          RANDOM_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 cell = st * 8.0;\n" +
            "  float c = random(vec2(0.0));\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "floor でマスの番号を求めて random に渡し、8×8 のマスをでたらめな明るさで塗ろう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "floor" },
          { kind: "cellsFlat", cells: 8 },
        ],
        hints: ["vec2 cell = floor(st * 8.0);", "float c = random(cell);"],
        solution: shHigh(
          RANDOM_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 cell = floor(st * 8.0);\n" +
            "  float c = random(cell);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-value-noise",
      title: "なめらかなノイズ: 四隅を補間する",
      explanation:
        "<p>マスの<b>四隅</b>の乱数 <code>a, b, c, d</code> を、マス内の位置 <code>u</code> で " +
        "<code>mix</code> すると、マスの境目が消えてなめらかにつながります（バリューノイズ）。" +
        "横に 2回、その結果を縦に 1回、合計 3回の mix です。<code>u</code> は " +
        "<code>smoothstep</code> を通した位置なので、つなぎ目の傾きも連続になります。</p>",
      challenge: {
        starterCode: shHigh(
          RANDOM_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 pos = st * 4.0;\n" +
            "  vec2 i = floor(pos);\n" +
            "  vec2 f = fract(pos);\n" +
            "  // マスの四隅の乱数\n" +
            "  float a = random(i);\n" +
            "  float b = random(i + vec2(1.0, 0.0));\n" +
            "  float c = random(i + vec2(0.0, 1.0));\n" +
            "  float d = random(i + vec2(1.0, 1.0));\n" +
            "  // なめらかにした、マス内の位置\n" +
            "  vec2 u = smoothstep(0.0, 1.0, f);\n" +
            "  float n = a;\n" +
            "  gl_FragColor = vec4(vec3(n), 1.0);\n}",
        ),
        task: "四隅の値 a〜d を u で補間して（mix を 3回）、マスの境目が見えないなめらかなノイズにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "mix" },
          { kind: "notUniform" },
          { kind: "smooth", maxStep: 0.35 },
        ],
        hints: [
          "下辺 mix(a, b, u.x) と上辺 mix(c, d, u.x) を、さらに u.y で mix します",
          "float n = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
        ],
        solution: shHigh(
          RANDOM_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 pos = st * 4.0;\n" +
            "  vec2 i = floor(pos);\n" +
            "  vec2 f = fract(pos);\n" +
            "  float a = random(i);\n" +
            "  float b = random(i + vec2(1.0, 0.0));\n" +
            "  float c = random(i + vec2(0.0, 1.0));\n" +
            "  float d = random(i + vec2(1.0, 1.0));\n" +
            "  vec2 u = smoothstep(0.0, 1.0, f);\n" +
            "  float n = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n" +
            "  gl_FragColor = vec4(vec3(n), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-voronoi",
      title: "細胞の模様: セルラーノイズ",
      explanation:
        "<p><b>セルラーノイズ</b>（ボロノイ）は、マスごとに乱数で点を 1つ置き、各ピクセルで" +
        "<b>いちばん近い点までの距離</b>を明るさにする模様です。細胞や石畳のように見えます。" +
        "自分のマスの点だけを調べると、となりのマスの点のほうが近い場所で、マスの境目に段差ができてしまいます。" +
        "<code>for</code> ループで<b>まわり 3×3 マス</b>の点を調べ、<code>min</code> でいちばん近い距離を残しましょう。</p>",
      challenge: {
        starterCode: shHigh(
          RANDOM_FN +
            CELL_POINT_FN +
            VORONOI_HEAD +
            "  // いまは自分のマスの点しか見ていない\n" +
            "  m = min(m, distance(f, cellPoint(i)));\n" +
            "  gl_FragColor = vec4(vec3(m), 1.0);\n}",
        ),
        task: "for ループでまわり 3×3 マスの点までの距離を調べ、いちばん近い距離 m で塗って、マスの境目の段差を消そう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "for\\s*\\(" },
          { kind: "notUniform" },
          // The nearest-point distance changes no faster than the position
          // (≤ 0.24 between neighbouring samples), whatever the hash returns;
          // looking at one cell only leaves jumps at every cell border.
          {
            kind: "smooth",
            maxStep: 0.3,
            message: "マスの境目で明るさが急に変わっています。となりのマスの点も調べましょう",
          },
        ],
        hints: [
          "for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) { … } }",
          "vec2 nb = vec2(float(x), float(y));  // となりのマスへのずれ",
          "m = min(m, distance(f, nb + cellPoint(i + nb)));",
        ],
        solution: shHigh(
          RANDOM_FN +
            CELL_POINT_FN +
            VORONOI_HEAD +
            "  for (int y = -1; y <= 1; y++) {\n" +
            "    for (int x = -1; x <= 1; x++) {\n" +
            "      vec2 nb = vec2(float(x), float(y));\n" +
            "      m = min(m, distance(f, nb + cellPoint(i + nb)));\n" +
            "    }\n" +
            "  }\n" +
            "  gl_FragColor = vec4(vec3(m), 1.0);\n}",
        ),
      },
    },
  ],
};
