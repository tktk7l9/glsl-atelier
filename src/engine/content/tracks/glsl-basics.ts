// The glsl-basics track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

const FULL: [number, number, number, number] = [0, 0, 1, 1];

export const track: Track = {
  id: "glsl-basics",
  domain: "glsl",
  title: "はじめてのシェーダー",
  summary: "1ピクセルずつ色を決める。gl_FragColor に RGBA を書き込もう。",
  icon: "✨",
  lessons: [
    {
      id: "glsl-solid-color",
      title: "画面を塗る: gl_FragColor",
      explanation:
        "<p>フラグメントシェーダーは画面の<b>すべてのピクセル</b>について呼ばれ、" +
        "<code>gl_FragColor</code> にそのピクセルの色を書き込みます。色は <code>vec4(r, g, b, a)</code>、" +
        "各成分は 0.0〜1.0 です。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context",
      challenge: {
        starterCode: sh("void main() {\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}"),
        task: "画面全体をマゼンタ（赤＋青）に塗ろう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "gl_FragColor" },
          { kind: "regionColor", rect: FULL, rgb: [1, 0, 1] },
        ],
        hints: ["マゼンタは 赤=1.0・緑=0.0・青=1.0", "gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);"],
        solution: sh("void main() {\n  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n}"),
      },
    },
    {
      id: "glsl-rgb-mix",
      title: "色を混ぜる: RGB",
      explanation:
        "<p>赤・緑・青を足し合わせると別の色になります。緑と青を最大にすると<b>シアン</b>になります。</p>",
      challenge: {
        starterCode: sh("void main() {\n  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n}"),
        task: "シアン（緑＋青）で塗ろう。",
        validators: [
          { kind: "compiles" },
          { kind: "regionColor", rect: FULL, rgb: [0, 1, 1] },
        ],
        hints: ["シアンは 赤=0.0・緑=1.0・青=1.0", "gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);"],
        solution: sh("void main() {\n  gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);\n}"),
      },
    },
    {
      id: "glsl-gray",
      title: "灰色をつくる: vec3",
      explanation:
        "<p><code>vec3(0.5)</code> は <code>vec3(0.5, 0.5, 0.5)</code> の省略形。" +
        "RGB を同じ値にすると無彩色（グレー）になります。</p>",
      challenge: {
        starterCode: sh("void main() {\n  gl_FragColor = vec4(vec3(1.0), 1.0);\n}"),
        task: "50% グレー（vec3(0.5)）で塗ろう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "vec3" },
          { kind: "regionColor", rect: FULL, rgb: [0.5, 0.5, 0.5] },
        ],
        hints: ["3成分すべて 0.5 にします", "gl_FragColor = vec4(vec3(0.5), 1.0);"],
        solution: sh("void main() {\n  gl_FragColor = vec4(vec3(0.5), 1.0);\n}"),
      },
    },
  ],
};
