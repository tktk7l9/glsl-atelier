// The glsl-patterns track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, WHITE, sh } from "./shared-glsl.js";

export const track: Track = {
  id: "glsl-patterns",
  domain: "glsl",
  title: "繰り返しとパターン",
  summary: "fract / floor / mod で空間を分割し、タイルや市松模様をつくる。",
  icon: "🔳",
  lessons: [
    {
      id: "glsl-tiles",
      title: "タイル化: fract",
      explanation:
        "<p>座標を定数倍して <code>fract()</code> を取ると、0〜1 が何度も繰り返され、" +
        "空間をタイル状に分割できます。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = st;\n  float c = step(0.5, g.x);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "st を 4倍して fract を取り、縦縞を4本に増やそう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "fract" },
          { kind: "notUniform" },
        ],
        hints: ["vec2 g = fract(st * 4.0);", "倍率を上げるほど縞が細かくなります"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = fract(st * 4.0);\n  float c = step(0.5, g.x);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-checker",
      title: "市松模様: floor × mod",
      explanation:
        "<p>マスのインデックスを <code>floor()</code> で求め、行＋列の合計を <code>mod(.., 2.0)</code> すると" +
        "0と1が交互に並んで市松模様になります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 cell = st * 4.0;\n  float c = 0.0;\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "floor と mod を使って 4×4 の市松模様を描こう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "floor" },
          { kind: "sourceMatches", pattern: "mod" },
          { kind: "notUniform" },
        ],
        hints: ["vec2 cell = floor(st * 4.0);", "float c = mod(cell.x + cell.y, 2.0);"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 cell = floor(st * 4.0);\n  float c = mod(cell.x + cell.y, 2.0);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-repeat-dots",
      title: "水玉を並べる: fract × 図形",
      explanation:
        "<p><code>fract()</code> で分割した各マスの座標は、どのマスでも 0〜1 です。" +
        "その座標で図形を 1つ描けば、同じ図形が<b>マスの数だけ</b>並びます。" +
        "「空間を繰り返してから描く」のは、シェーダーで模様を作る基本の型です。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = st;\n  float d = distance(g, vec2(0.5));\n  float c = 1.0 - step(0.3, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "st を 3倍して fract を取り、白い円を 3×3 に並べよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "fract" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.15, y: 0.15, rgb: WHITE },
          { kind: "pixelApprox", x: 0.85, y: 0.15, rgb: WHITE },
          { kind: "pixelApprox", x: 0.15, y: 0.85, rgb: WHITE },
          { kind: "pixelApprox", x: 0.85, y: 0.85, rgb: WHITE },
          { kind: "pixelApprox", x: 0.35, y: 0.35, rgb: BLACK },
          { kind: "pixelApprox", x: 0.65, y: 0.65, rgb: BLACK },
          { kind: "pixelApprox", x: 0.02, y: 0.02, rgb: BLACK },
        ],
        hints: ["vec2 g = fract(st * 3.0);", "g はマスごとに 0〜1 なので、中心 vec2(0.5) からの距離がそのまま使えます"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  vec2 g = fract(st * 3.0);\n  float d = distance(g, vec2(0.5));\n  float c = 1.0 - step(0.3, d);\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
  ],
};
