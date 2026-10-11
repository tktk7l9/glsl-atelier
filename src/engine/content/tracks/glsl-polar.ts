// The glsl-polar track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import type { ValidatorSpec } from "../../validate/primitives.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

/** The kaleidoscope lesson: polar coordinates, then `fold`, then the motif
 *  (a petal at 15° and a bead at 30°) drawn at the rebuilt position `q`. */
const kaleidoscopeMain = (fold: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float a = atan(p.y, p.x);    // 角度\n" +
  "  float r = length(p);          // 中心からの距離\n" +
  "  float seg = 6.2831853 / 6.0;  // 扇形 1つぶんの角度（60°）\n" +
  fold +
  "  vec2 q = r * vec2(cos(a), sin(a));  // 角度と距離から座標を作り直す\n" +
  "  float petal = length(q - vec2(0.6, 0.16)) - 0.14;  // 花びら（15° の方向）\n" +
  "  float bead = length(q - vec2(0.26, 0.15)) - 0.07;  // 小さな玉（30° の方向）\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  col = mix(col, vec3(1.0, 0.4, 0.7), 1.0 - step(0.0, petal));\n" +
  "  col = mix(col, vec3(0.3, 0.9, 1.0), 1.0 - step(0.0, bead));\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const PETAL: [number, number, number] = [1, 0.4, 0.7];

const BEAD: [number, number, number] = [0.3, 0.9, 1];

/** The spiral lesson: the rays of the polar track, with `wave` setting `c`
 *  from the angle `a` (and the distance `r`). */
const spiralMain = (wave: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float a = atan(p.y, p.x);  // 角度\n" +
  "  float r = length(p);        // 中心からの距離\n" +
  wave +
  "  gl_FragColor = vec4(vec3(c), 1.0);\n}";

/**
 * The spiral checks: three white and three black samples on the arms of
 * cos(3a + 8r), each at least 2 px from an edge and wrong for the untwisted
 * rays, a twist of 2 or 16, an angle multiplied by the radius, and plain
 * rings. Subtracting the radius instead draws the mirror image (the same
 * picture flipped top to bottom), so that is accepted too.
 */
function spiralChecks(): ValidatorSpec {
  const samples: ReadonlyArray<readonly [number, number, [number, number, number]]> = [
    [0.5625, 0.2708, WHITE],
    [0.2708, 0.4792, WHITE],
    [0.6042, 0.6458, WHITE],
    [0.3125, 0.2708, BLACK],
    [0.0625, 0.1042, BLACK],
    [0.8125, 0.3958, BLACK],
  ];
  const arms = (flipped: boolean): ValidatorSpec => ({
    kind: "allOf",
    of: samples.map(([x, y, rgb]) => ({ kind: "pixelApprox", x, y: flipped ? 1 - y : y, rgb })),
  });
  return {
    kind: "anyOf",
    of: [arms(false), arms(true)],
    message: "光条がうずまきになっていません。cos の中を a * 3.0 + r * 8.0 にして、中心から遠いほど角度を進めましょう",
  };
}

export const track: Track = {
  id: "glsl-polar",
  domain: "glsl",
  title: "極座標",
  summary: "角度 atan と半径 length で座標を取り直し、放射模様や花びら、万華鏡を描く。",
  icon: "🌸",
  lessons: [
    {
      id: "glsl-polar-rays",
      title: "放射する光: atan",
      explanation:
        "<p><code>atan(p.y, p.x)</code> は中心から見た<b>角度</b>（-π〜π）を返します。" +
        "角度を <code>cos(a * 6.0)</code> に入れると 1周で 6回波打つので、" +
        "<code>step</code> で白黒にすれば中心から放射する 6本の光条になります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            CENTRED +
            "  float a = 0.0;\n" +
            "  float c = step(0.0, cos(a * 6.0));\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "角度 a を atan(p.y, p.x) で求めて、中心から 6本の光が放射する模様にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "atan" },
          { kind: "notUniform" },
          { kind: "pixelApprox", x: 0.85, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.15, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.5, y: 0.85, rgb: BLACK },
          { kind: "pixelApprox", x: 0.5, y: 0.15, rgb: BLACK },
          { kind: "pixelApprox", x: 0.675, y: 0.803, rgb: WHITE },
          { kind: "pixelApprox", x: 0.803, y: 0.675, rgb: BLACK },
        ],
        hints: ["float a = atan(p.y, p.x);", "引数の順番は atan(y, x)。逆にすると模様が 90度ずれます"],
        solution: sh(
          "void main() {\n" +
            CENTRED +
            "  float a = atan(p.y, p.x);\n" +
            "  float c = step(0.0, cos(a * 6.0));\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-polar-flower",
      title: "花びらを描く: 半径を角度で揺らす",
      explanation:
        "<p>円の半径 <code>r</code> を定数ではなく<b>角度の関数</b>にすると、ふちが波打ちます。" +
        "<code>0.5 + 0.2 * cos(a * 5.0)</code> なら半径が 0.3〜0.7 の間を 1周で 5回ゆれて、" +
        "花びら 5枚の花になります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            CENTRED +
            "  float a = atan(p.y, p.x);\n" +
            "  float r = 0.5;\n" +
            "  float c = 1.0 - step(r, length(p));\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
        task: "半径 r を 0.5 + 0.2 * cos(a * 5.0) にして、花びら 5枚の白い花を描こう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "cos" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.81, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.29, y: 0.5, rgb: BLACK },
          { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
          { kind: "pixelApprox", x: 0.5, y: 0.96, rgb: BLACK },
        ],
        hints: ["float r = 0.5 + 0.2 * cos(a * 5.0);", "5.0 を変えると花びらの枚数が変わります"],
        solution: sh(
          "void main() {\n" +
            CENTRED +
            "  float a = atan(p.y, p.x);\n" +
            "  float r = 0.5 + 0.2 * cos(a * 5.0);\n" +
            "  float c = 1.0 - step(r, length(p));\n" +
            "  gl_FragColor = vec4(vec3(c), 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-spiral",
      title: "うずまき: 角度に距離を足す",
      explanation:
        "<p>放射する光条は <code>cos(a * 3.0)</code> のように<b>角度だけ</b>で決めていました。ここに中心からの距離 <code>r</code> を足して " +
        "<code>cos(a * 3.0 + r * 8.0)</code> とすると、遠くへ行くほど模様の角度が進むので、光条が<b>うずまき</b>にねじれます。" +
        "<code>r</code> の係数が大きいほど強くねじれ、符号を変えると逆向きに巻きます。角度と距離の 2つを組み合わせるのが極座標の面白いところで、" +
        "渦や回転する銀河のような模様の基本です。</p>",
      challenge: {
        starterCode: sh(
          spiralMain(
            "  // ここで、cos の中の角度に r * 8.0 を足して、光条をうずまきにねじろう\n" +
              "  float c = step(0.0, cos(a * 3.0));\n",
          ),
        ),
        task: "cos の中を a * 3.0 + r * 8.0 にして、3本の光条がうずまきにねじれる模様にしよう。",
        validators: [{ kind: "compiles" }, { kind: "notUniform" }, spiralChecks()],
        hints: [
          "float c = step(0.0, cos(a * 3.0 + r * 8.0));",
          "r * 8.0 の 8.0 を変えるとねじれの強さが、符号を変えると巻く向きが変わります",
        ],
        solution: sh(
          spiralMain("  float c = step(0.0, cos(a * 3.0 + r * 8.0));  // 遠いほど角度が進む → うずまき\n"),
        ),
      },
    },
    {
      id: "glsl-kaleidoscope",
      title: "万華鏡: 角度を折りたたむ",
      explanation:
        "<p>万華鏡は、鏡で区切った扇形の中身が、まわりに何度も映ってできる模様です。シェーダーでは<b>角度を折りたたんで</b>" +
        "作れます。角度 <code>a</code> を <code>mod(a, seg)</code> で扇形 1つぶん（<code>seg</code> = 60°）に収め、" +
        "<code>abs(a - seg * 0.5)</code> で扇形のまん中を鏡にして折り返します。折りたたんだ角度と距離 <code>r</code> から" +
        "座標 <code>q</code> を作り直して模様を描けば、1つ描くだけで、まわりにいくつも映ります。</p>",
      challenge: {
        starterCode: sh(kaleidoscopeMain("  // ここで a を折りたたもう\n\n")),
        task: "a を mod(a, seg) で扇形に収め、abs(a - seg * 0.5) で折り返して、花びらと玉をまわりに映した万華鏡にしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "mod\\s*\\(" },
          // Copies of the 15° petal (at 135° and 255°) and of the 30° bead
          // (at 180° and 300°) appear only once the angle is folded.
          { kind: "pixelApprox", x: 0.28, y: 0.72, rgb: PETAL },
          { kind: "pixelApprox", x: 0.42, y: 0.2, rgb: PETAL },
          { kind: "pixelApprox", x: 0.35, y: 0.48, rgb: BEAD },
          { kind: "pixelApprox", x: 0.58, y: 0.37, rgb: BEAD },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: BLACK },
          { kind: "pixelApprox", x: 0.96, y: 0.96, rgb: BLACK },
        ],
        hints: [
          "a = mod(a, seg);",
          "a = abs(a - seg * 0.5);  // 扇形のまん中を鏡に",
        ],
        solution: sh(kaleidoscopeMain("  a = mod(a, seg);           // 扇形 1つぶんに収める\n  a = abs(a - seg * 0.5);  // 扇形のまん中で折り返す\n")),
      },
    },
  ],
};
