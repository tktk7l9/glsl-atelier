// The glsl-uv track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

export const track: Track = {
  id: "glsl-uv",
  domain: "glsl",
  title: "座標と UV",
  summary: "gl_FragCoord と u_resolution でピクセルの位置を 0〜1 に正規化する。",
  icon: "🧭",
  lessons: [
    {
      id: "glsl-uv-gradient",
      title: "横グラデーション",
      explanation:
        "<p><code>gl_FragCoord.xy</code> はピクセル座標（左下が原点）。" +
        "<code>u_resolution</code> で割ると 0〜1 の座標 <code>st</code> が得られます。" +
        "<code>st.x</code> をそのまま明るさに使うと横方向のグラデーションになります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(0.0), 1.0);\n}",
        ),
        task: "左が黒・右が白の横グラデーションにしよう（st.x を明るさに）。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "gl_FragCoord" },
          { kind: "sourceMatches", pattern: "u_resolution" },
          { kind: "gradient", axis: "x", dir: "up" },
          { kind: "pixelApprox", x: 0.05, y: 0.5, rgb: [0, 0, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.95, y: 0.5, rgb: [1, 1, 1], tol: 0.15 },
        ],
        hints: ["vec3(st.x) で 左0→右1 のグレーになります", "gl_FragColor = vec4(vec3(st.x), 1.0);"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.x), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-uv-xy",
      title: "定番の UV: 赤×緑",
      explanation:
        "<p>赤に <code>st.x</code>、緑に <code>st.y</code> を入れると、シェーダー入門の定番である" +
        "「右へ赤・上へ緑」のグラデーションになります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}",
        ),
        task: "右へ進むほど赤、上へ進むほど緑にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "gl_FragCoord" },
          { kind: "gradient", axis: "x", dir: "up", channel: "r" },
          { kind: "gradient", axis: "y", dir: "up", channel: "g" },
          { kind: "pixelApprox", x: 0.95, y: 0.05, rgb: [1, 0, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.05, y: 0.95, rgb: [0, 1, 0], tol: 0.15 },
        ],
        hints: ["vec4(st.x, st.y, 0.0, 1.0)", "赤=横方向, 緑=縦方向"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(st.x, st.y, 0.0, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-uv-vertical",
      title: "縦グラデーション",
      explanation: "<p>今度は <code>st.y</code> を使って、下が黒・上が白の縦グラデーションを作ります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.x), 1.0);\n}",
        ),
        task: "下が黒・上が白の縦グラデーションにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "gradient", axis: "y", dir: "up" },
          { kind: "notUniform" },
          { kind: "pixelApprox", x: 0.5, y: 0.05, rgb: [0, 0, 0], tol: 0.15 },
          { kind: "pixelApprox", x: 0.5, y: 0.95, rgb: [1, 1, 1], tol: 0.15 },
        ],
        hints: ["st.x を st.y に変えるだけ", "gl_FragColor = vec4(vec3(st.y), 1.0);"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(vec3(st.y), 1.0);\n}",
        ),
      },
    },
  ],
};
