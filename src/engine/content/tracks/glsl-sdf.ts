// The glsl-sdf track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

/** The crescent lesson: a moon and the circle to bite out of it, joined by `join`. */
const moonMain = (join: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float moon = length(p) - 0.6;                    // 月（円）\n" +
  "  float bite = length(p - vec2(0.3, 0.15)) - 0.5;  // くり抜きたい円\n" +
  join +
  "  float c = 1.0 - step(0.0, d);\n" +
  "  gl_FragColor = vec4(vec3(1.0, 0.9, 0.55) * c, 1.0);\n}";

const MOON: [number, number, number] = [1, 0.9, 0.55];

export const track: Track = {
  id: "glsl-sdf",
  domain: "glsl",
  title: "距離関数（SDF）",
  summary: "「形までの距離」を返す関数で図形を描き、輪郭にし、溶かし合わせ、くり抜く。",
  icon: "📏",
  lessons: [
    {
      id: "glsl-sdf-box",
      title: "箱の SDF: abs と max",
      explanation:
        "<p><b>符号付き距離関数（SDF）</b>は、点から形までの距離を返す関数です。形の外では正、" +
        "中では負、ふちでちょうど 0 になるので、<code>step(0.0, d)</code> で中と外を塗り分けられます。" +
        "円は <code>length(p) - r</code>。長方形は <code>abs(p)</code> で第1象限に折りたたみ、" +
        "半分の大きさ <code>b</code> を引いて、はみ出した分の長さを取ります（<code>sdBox</code>）。</p>",
      challenge: {
        starterCode: sh(
          "// 中心が原点・半分の大きさが b の長方形までの距離\n" +
            "float sdBox(vec2 p, vec2 b) {\n" +
            "  vec2 q = abs(p) - b;\n" +
            "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
            "}\n\n" +
            "void main() {\n" +
            CENTRED +
            "  float d = length(p) - 0.5;\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "円の距離 d を sdBox に置き換えて、横 0.6・縦 0.3（半分の大きさ）の白い長方形を描こう。",
        validators: [
          { kind: "compiles" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.77, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.23, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.7, rgb: BLACK },
          { kind: "pixelApprox", x: 0.5, y: 0.3, rgb: BLACK },
          { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
        ],
        hints: ["float d = sdBox(p, vec2(0.6, 0.3));", "p は中心が (0, 0) で、短い辺が -1〜1 の座標です"],
        solution: sh(
          "float sdBox(vec2 p, vec2 b) {\n" +
            "  vec2 q = abs(p) - b;\n" +
            "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
            "}\n\n" +
            "void main() {\n" +
            CENTRED +
            "  float d = sdBox(p, vec2(0.6, 0.3));\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-sdf-ring",
      title: "輪郭だけ残す: abs(d)",
      explanation:
        "<p>距離 <code>d</code> の絶対値 <code>abs(d)</code> は「ふちからの距離」です。" +
        "そこから太さ <code>w</code> を引いて 0 以下の部分を塗ると、形の<b>輪郭だけ</b>が太さ 2w の帯として残ります。" +
        "どんな SDF にも同じ手が使えます。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            CENTRED +
            "  float d = length(p) - 0.5;\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "abs を使って、半径 0.5 の円を太さ 0.1（片側）の白いリングにしよう。中は黒に。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "abs" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: BLACK },
          { kind: "pixelApprox", x: 0.74, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.26, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.74, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.26, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.93, rgb: BLACK },
          { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
        ],
        hints: ["float ring = abs(d) - 0.1;", "float c = 1.0 - step(0.0, ring);"],
        solution: sh(
          "void main() {\n" +
            CENTRED +
            "  float d = length(p) - 0.5;\n" +
            "  float ring = abs(d) - 0.1;\n" +
            "  float c = 1.0 - step(0.0, ring);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-sdf-smooth-union",
      title: "溶かしてつなぐ: smooth min",
      explanation:
        "<p>2つの SDF の <code>min()</code> を取ると形の<b>和集合</b>になりますが、つなぎ目は角ばったままです。" +
        "<code>smin(a, b, k)</code> は min をなめらかにしたもので、近づいた形どうしが " +
        "<code>k</code> の範囲で溶け合います（メタボール風）。</p>",
      challenge: {
        starterCode: sh(
          "// なめらかな min（k が大きいほど広く溶け合う）\n" +
            "float smin(float a, float b, float k) {\n" +
            "  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n" +
            "  return mix(b, a, h) - k * h * (1.0 - h);\n" +
            "}\n\n" +
            "void main() {\n" +
            CENTRED +
            "  float d1 = length(p - vec2(-0.38, 0.0)) - 0.3;\n" +
            "  float d2 = length(p - vec2(0.38, 0.0)) - 0.3;\n" +
            "  float d = min(d1, d2);\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "min を smin（k = 0.6）に変えて、離れた2つの円をなめらかにつなごう。",
        validators: [
          { kind: "compiles" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.31, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.69, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.9, rgb: BLACK },
          { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
          { kind: "pixelApprox", x: 0.95, y: 0.95, rgb: BLACK },
        ],
        hints: ["float d = smin(d1, d2, 0.6);", "min(d1, d2) のままだと 2つの円の間は黒いままです"],
        solution: sh(
          "float smin(float a, float b, float k) {\n" +
            "  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n" +
            "  return mix(b, a, h) - k * h * (1.0 - h);\n" +
            "}\n\n" +
            "void main() {\n" +
            CENTRED +
            "  float d1 = length(p - vec2(-0.38, 0.0)) - 0.3;\n" +
            "  float d2 = length(p - vec2(0.38, 0.0)) - 0.3;\n" +
            "  float d = smin(d1, d2, 0.6);\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-sdf-subtract",
      title: "くり抜く: SDF の引き算",
      explanation:
        "<p>2つの SDF <code>a</code>・<code>b</code> は、組み合わせ方で形が変わります。<code>min(a, b)</code> は<b>和</b>" +
        "（どちらかの内側）、<code>max(a, b)</code> は<b>共通部分</b>（両方の内側）。そして <code>-b</code> は b の内と外を" +
        "入れ替えた距離なので、<code>max(a, -b)</code> は「a の内側で、しかも b の外側」、つまり<b>a から b をくり抜いた形</b>" +
        "になります。</p>",
      challenge: {
        starterCode: sh(moonMain("  float d = min(moon, bite);                       // いまは 2つの円の和\n")),
        task: "d を max(moon, -bite) にして、月の円から bite の円をくり抜き、三日月にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "max\\s*\\(" },
          // The crescent stays…
          { kind: "pixelApprox", x: 0.3, y: 0.45, rgb: MOON },
          { kind: "pixelApprox", x: 0.55, y: 0.25, rgb: MOON },
          // …and the bite is empty, inside the moon's circle and outside it.
          { kind: "pixelApprox", x: 0.6, y: 0.55, rgb: BLACK },
          { kind: "pixelApprox", x: 0.85, y: 0.6, rgb: BLACK },
          { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
        ],
        hints: ["float d = max(moon, -bite);", "max(moon, bite) だと、2つの円が重なった部分だけが残ります"],
        solution: sh(moonMain("  float d = max(moon, -bite);\n")),
      },
    },
  ],
};
