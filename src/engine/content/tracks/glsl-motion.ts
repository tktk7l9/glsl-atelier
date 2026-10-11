// The glsl-motion track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

/** The easing lesson: a ball that crosses the screen every 2 s; `ease` sets `e`. */
const easingMain = (ease: string): string =>
  "void main() {\n" +
  CENTRED +
  "  // 2 秒ごとに 0 → 1 をくり返す進み具合\n" +
  "  float t = fract(u_time / 2.0);\n" +
  ease +
  "  float x = mix(-0.6, 0.6, e);  // 左から右へ\n" +
  "  float d = length(p - vec2(x, 0.0)) - 0.15;\n" +
  "  float c = 1.0 - step(0.0, d);\n" +
  "  gl_FragColor = vec4(vec3(c), 1.0);\n}";

export const track: Track = {
  id: "glsl-motion",
  domain: "glsl",
  title: "時間とアニメーション",
  summary: "u_time と sin/cos で時間とともに変化する絵をつくり、イージングで動きに緩急をつける。",
  icon: "🌀",
  lessons: [
    {
      id: "glsl-pulse",
      title: "明滅する: u_time × sin",
      explanation:
        "<p><code>u_time</code> は経過秒数。<code>sin(u_time)</code> は -1〜1 を往復するので、" +
        "<code>abs()</code> で 0〜1 にすると画面全体が明滅します。プレビューで動きを確認しましょう。</p>",
      challenge: {
        starterCode: sh("void main() {\n  float b = 1.0;\n  gl_FragColor = vec4(vec3(b), 1.0);\n}"),
        task: "u_time と sin を使って、画面全体を明滅させよう。",
        validators: [
          { kind: "compiles" },
          // The header declares u_time, so require it inside main().
          { kind: "sourceMatches", pattern: "main[\\s\\S]*u_time" },
          { kind: "sourceMatches", pattern: "main[\\s\\S]*sin\\s*\\(" },
        ],
        hints: ["float b = abs(sin(u_time));", "プレビューが点滅すれば成功"],
        solution: sh(
          "void main() {\n  float b = abs(sin(u_time));\n  gl_FragColor = vec4(vec3(b), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-moving-stripe",
      title: "流れる縞: fract × u_time",
      explanation:
        "<p>座標から <code>u_time</code> を引いて <code>fract()</code>（小数部）を取ると、" +
        "模様が時間とともに流れて見えます。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float x = st.x;\n  float c = step(0.5, fract(x));\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "縞模様が横に流れるよう、x に u_time を取り入れよう。",
        validators: [
          { kind: "compiles" },
          // The header declares u_time, so require it inside main().
          { kind: "sourceMatches", pattern: "main[\\s\\S]*u_time" },
          { kind: "sourceMatches", pattern: "fract" },
          { kind: "notUniform" },
        ],
        hints: ["float x = st.x - u_time * 0.2;", "fract で 0〜1 が繰り返されます"],
        solution: sh(
          "void main() {\n  vec2 st = gl_FragCoord.xy / u_resolution;\n  float x = st.x - u_time * 0.2;\n  float c = step(0.5, fract(x));\n  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-easing",
      title: "動きに緩急をつける: イージング",
      explanation:
        "<p>一定の速さで進む動き（リニア）は、機械的に見えます。進み具合 <code>t</code>（0〜1）を<b>イージング関数</b>に" +
        "通すと、動きに緩急がつきます。たとえば ease-out の <code>1.0 - (1.0 - t) * (1.0 - t)</code> は、出だしが速く、" +
        "最後はゆっくり止まります。同じ <code>t = 0.5</code> の瞬間でも、リニアならまだ道のりの半分、ease-out なら " +
        "4分の3 まで進んでいます。チェックは <code>u_time = 1.0</code>（このコードでは <code>t = 0.5</code>）の瞬間の絵で行います。</p>",
      challenge: {
        starterCode: sh(easingMain("  // ここで t をイージングしよう（いまはリニアのまま）\n  float e = t;\n")),
        task: "e を ease-out（1.0 - (1.0 - t) * (1.0 - t)）にして、ボールが勢いよく動き出し、ゆっくり止まるようにしよう。",
        validators: [
          { kind: "compiles" },
          // At u_time = 1 (t = 0.5) ease-out has covered 3/4 of the way: the
          // ball is centred at x = 0.3, while the linear ball is still at 0.
          {
            kind: "pixelApprox",
            x: 0.65,
            y: 0.48,
            rgb: WHITE,
            message: "t = 0.5 の瞬間、ボールは道のりの 4分の3（x = 0.3）まで進んでいるはずです。e を ease-out にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.48, rgb: BLACK },
          {
            kind: "pixelApprox",
            x: 0.85,
            y: 0.48,
            rgb: BLACK,
            message: "ボールが進みすぎています。e = 1.0 - (1.0 - t) * (1.0 - t) にしましょう",
          },
        ],
        hints: [
          "float e = 1.0 - (1.0 - t) * (1.0 - t);",
          "t = 0.5 のとき e = 0.75。プレビューでは、ボールが勢いよく飛び出してから減速します",
        ],
        solution: sh(easingMain("  float e = 1.0 - (1.0 - t) * (1.0 - t);\n")),
      },
    },
  ],
};
