// The glsl-transform track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

const SDBOX_FN =
  "// 中心が原点・半分の大きさが b の長方形までの距離\n" +
  "float sdBox(vec2 p, vec2 b) {\n" +
  "  vec2 q = abs(p) - b;\n" +
  "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);\n" +
  "}\n\n";

const ROTATE_FN =
  "// 角度 a（ラジアン）の 2D 回転行列\n" +
  "mat2 rotate2d(float a) {\n" +
  "  float c = cos(a);\n" +
  "  float s = sin(a);\n" +
  "  return mat2(c, -s, s, c);\n" +
  "}\n\n";

/** The mirror lesson's butterfly, drawn from `p`; `fold` goes right after `p`. */
const butterflyMain = (fold: string): string =>
  "void main() {\n" +
  CENTRED +
  fold +
  "  float body = length(p * vec2(6.0, 1.0)) - 0.5;          // 胴体（細長い楕円）\n" +
  "  float wing = min(length(p - vec2(0.42, 0.22)) - 0.3,   // 上の羽\n" +
  "                   length(p - vec2(0.3, -0.38)) - 0.2);  // 下の羽\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  col = mix(col, vec3(1.0, 0.55, 0.15), 1.0 - step(0.0, wing));\n" +
  "  col = mix(col, vec3(0.95), 1.0 - step(0.0, body));\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const WING: [number, number, number] = [1, 0.55, 0.15];

export const track: Track = {
  id: "glsl-transform",
  domain: "glsl",
  title: "座標を変換する",
  summary: "回転行列 mat2 で座標ごと回し、abs で折り返して鏡に映す。回すときは中心を原点に移してから。",
  icon: "🔄",
  lessons: [
    {
      id: "glsl-rotate",
      title: "回転させる: mat2",
      explanation:
        "<p>図形そのものを回す関数はありません。代わりに<b>座標を回します</b>。2D の回転行列 " +
        "<code>mat2(c, -s, s, c)</code>（<code>c = cos(a)</code>、<code>s = sin(a)</code>）を座標 <code>p</code> に" +
        "掛けた <code>q</code> で図形を描くと、図形が角度 <code>a</code> だけ反時計回りに回って見えます。" +
        "角度はラジアンで、45° は <code>π / 4 ≈ 0.785</code>。<code>a</code> に <code>u_time</code> を入れれば回り続けます。</p>",
      challenge: {
        starterCode: sh(
          SDBOX_FN +
            ROTATE_FN +
            "void main() {\n" +
            CENTRED +
            "  vec2 q = p;\n" +
            "  float d = sdBox(q, vec2(0.4));\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "q を rotate2d(0.785) * p にして、正方形を 45° 回したひし形にしよう。",
        validators: [
          { kind: "compiles" },
          // The helper is declared above main(), so require the call inside it.
          { kind: "sourceMatches", pattern: "main[\\s\\S]*rotate2d\\s*\\(" },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: WHITE },
          // The diamond's tips reach past the square's sides…
          { kind: "pixelApprox", x: 0.73, y: 0.48, rgb: WHITE },
          { kind: "pixelApprox", x: 0.27, y: 0.48, rgb: WHITE },
          { kind: "pixelApprox", x: 0.48, y: 0.73, rgb: WHITE },
          { kind: "pixelApprox", x: 0.48, y: 0.27, rgb: WHITE },
          // …while the square's corners are cut away.
          { kind: "pixelApprox", x: 0.69, y: 0.69, rgb: BLACK },
          { kind: "pixelApprox", x: 0.31, y: 0.31, rgb: BLACK },
          { kind: "pixelApprox", x: 0.69, y: 0.31, rgb: BLACK },
          { kind: "pixelApprox", x: 0.31, y: 0.69, rgb: BLACK },
        ],
        hints: [
          "vec2 q = rotate2d(0.785) * p;",
          "行列 × ベクトルの順に掛けます。0.785 を u_time にすると回り続けます",
        ],
        solution: sh(
          SDBOX_FN +
            ROTATE_FN +
            "void main() {\n" +
            CENTRED +
            "  vec2 q = rotate2d(0.785) * p;\n" +
            "  float d = sdBox(q, vec2(0.4));\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-rotate-tiles",
      title: "マスごとに回す: 中心を原点に",
      explanation:
        "<p>回転行列は<b>原点 (0, 0) を中心に</b>回します。<code>fract(st * 3.0)</code> で作ったマスの座標 " +
        "<code>g</code> は左下の角が原点なので、そのまま回すと図形はマスの<b>角を中心に</b>回ってしまいます。" +
        "先に <code>g - 0.5</code> でマスの中心を原点に移してから回すのがコツです（「移動してから回転」の順番）。</p>",
      challenge: {
        starterCode: sh(
          SDBOX_FN +
            ROTATE_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 g = fract(st * 3.0);           // マスごとの 0〜1 の座標\n" +
            "  vec2 q = rotate2d(0.785) * g;       // いまはマスの左下の角を中心に回っている\n" +
            "  float d = sdBox(q, vec2(0.2));\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "回す前にマスの中心を原点に移して（g - 0.5）、3×3 のマスそれぞれの真ん中にひし形を並べよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "main[\\s\\S]*rotate2d\\s*\\(" },
          // A diamond in the middle of every tile…
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: WHITE },
          { kind: "pixelApprox", x: 0.15, y: 0.15, rgb: WHITE },
          { kind: "pixelApprox", x: 0.85, y: 0.85, rgb: WHITE },
          { kind: "pixelApprox", x: 0.15, y: 0.85, rgb: WHITE },
          { kind: "pixelApprox", x: 0.85, y: 0.15, rgb: WHITE },
          // …and nothing at the tile corners or between the tiles.
          { kind: "pixelApprox", x: 0.31, y: 0.31, rgb: BLACK },
          { kind: "pixelApprox", x: 0.69, y: 0.48, rgb: BLACK },
        ],
        hints: [
          "vec2 q = rotate2d(0.785) * (g - 0.5);",
          "g - 0.5 でマスの中心が (0, 0) になり、そこを中心に回ります",
        ],
        solution: sh(
          SDBOX_FN +
            ROTATE_FN +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 g = fract(st * 3.0);\n" +
            "  vec2 q = rotate2d(0.785) * (g - 0.5);\n" +
            "  float d = sdBox(q, vec2(0.2));\n" +
            "  float c = 1.0 - step(0.0, d);\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-mirror",
      title: "鏡に映す: abs で折り返す",
      explanation:
        "<p>左右対称の絵は、半分だけ描けば足ります。座標の x を <code>p.x = abs(p.x);</code> と<b>絶対値</b>にすると、" +
        "左側のピクセルも右側と同じ座標を受け取るので、右に描いたものが x = 0 の線を鏡にして左にも映ります。" +
        "チョウや顔、雪の結晶など、対称な形を少ないコードで描く定番の手です。</p>",
      challenge: {
        starterCode: sh(butterflyMain("  // ここで p.x を折り返そう\n")),
        task: "羽を描く前に p.x を abs で折り返して、右の羽を左にも映し、左右対称のチョウにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "abs\\s*\\(" },
          // Both wings on the right, and their reflections on the left. (Not
          // `symmetric`: a third of the grader's mirrored sample pairs land
          // one pixel apart, so a wing edge between them reads as asymmetric.)
          { kind: "pixelApprox", x: 0.71, y: 0.61, rgb: WING },
          { kind: "pixelApprox", x: 0.65, y: 0.31, rgb: WING },
          { kind: "pixelApprox", x: 0.29, y: 0.61, rgb: WING },
          { kind: "pixelApprox", x: 0.35, y: 0.31, rgb: WING },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.95, 0.95, 0.95] },
          { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
        ],
        hints: ["p.x = abs(p.x);", "羽や胴体の距離を計算するより前（p を作った直後）で折り返します"],
        solution: sh(butterflyMain("  p.x = abs(p.x);  // 左半分も右半分と同じ座標に\n")),
      },
    },
  ],
};
