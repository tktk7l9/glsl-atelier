// The glsl-tiling track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import type { ValidatorSpec } from "../../validate/primitives.js";
import { RANDOM_FN, sh, shHigh } from "./shared-glsl.js";

/** The brick lesson; `shift` goes where the odd rows are moved along. */
const brickMain = (shift: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 pos = st * vec2(3.0, 6.0);  // 横に 3 個・縦に 6 段（1 個は横長）\n" +
  shift +
  "  vec2 f = fract(pos);             // レンガの中の位置（0〜1）\n" +
  "  // レンガの左と下のふちを目地（すき間）にする\n" +
  "  float brick = step(0.1, f.x) * step(0.2, f.y);\n" +
  "  vec3 col = mix(vec3(0.85, 0.82, 0.75), vec3(0.72, 0.3, 0.2), brick);\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const BRICK: [number, number, number] = [0.72, 0.3, 0.2];

const MORTAR: [number, number, number] = [0.85, 0.82, 0.75];

const HEX_DIST_FN =
  "// 六角形のふちまでの近さ（中心で 0、ふちで 0.5）\n" +
  "float hexDist(vec2 p) {\n" +
  "  p = abs(p);\n" +
  "  return max(dot(p, vec2(0.5, 0.8660254)), p.x);\n" +
  "}\n\n";

/** The hexagon lesson; `pick` sets `g` from the offsets `a` (and `b`). */
const hexMain = (pick: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 p = st * 5.0;\n" +
  "  vec2 s = vec2(1.0, 1.7320508);  // 格子のマスの大きさ（横 1・縦 √3）\n" +
  "  vec2 a = mod(p, s) - s * 0.5;   // 格子 A: いちばん近い中心からのずれ\n" +
  pick +
  "  float h = hexDist(g);\n" +
  "  // ふちの近く（0.42 以上）は濃い茶色、内側ははちみつ色\n" +
  "  vec3 col = mix(vec3(1.0, 0.75, 0.2), vec3(0.3, 0.15, 0.02), step(0.42, h));\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const HONEY: [number, number, number] = [1, 0.75, 0.2];

const WAX: [number, number, number] = [0.3, 0.15, 0.02];

/** The truchet lesson (6×6 tiles); `flip` may mirror the tile's `f`. */
const truchetMain = (flip: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec2 pos = st * 6.0;\n" +
  "  vec2 i = floor(pos);  // マスの番号\n" +
  "  vec2 f = fract(pos);  // マスの中の位置（0〜1）\n" +
  flip +
  "  // 左下の角と右上の角を中心にした、半径 0.5 の 4分の1円を 2本\n" +
  "  float d = min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5));\n" +
  "  float c = 1.0 - step(0.13, d);\n" +
  "  vec3 col = mix(vec3(0.05, 0.08, 0.2), vec3(0.95, 0.85, 0.6), c);\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const TRUCHET_BG: [number, number, number] = [0.05, 0.08, 0.2];

const TRUCHET_LINE: [number, number, number] = [0.95, 0.85, 0.6];

/**
 * The truchet checks. The grader's 24×24 samples fall 4 to a tile; in every
 * tile, sample (1, 1) lies on the arc of the unflipped tile and sample (2, 1)
 * on the arc of the flipped one, each at least 1.5 px inside its line and
 * outside the other. Which tiles the hash flips depends on the GPU's sin, so
 * the checks ask only that every tile is drawn whole in one of the two
 * orientations, and that both orientations occur somewhere.
 */
function truchetChecks(): ValidatorSpec[] {
  const at = (gx: number, gy: number, rgb: [number, number, number]): ValidatorSpec => ({
    kind: "pixelApprox",
    x: (gx + 0.5) / 24,
    y: (gy + 0.5) / 24,
    rgb,
  });
  const whole: ValidatorSpec[] = [];
  const flipped: ValidatorSpec[] = [];
  const unflipped: ValidatorSpec[] = [];
  for (let ty = 0; ty < 6; ty++) {
    for (let tx = 0; tx < 6; tx++) {
      const [ax, bx, y] = [tx * 4 + 1, tx * 4 + 2, ty * 4 + 1];
      whole.push({
        kind: "anyOf",
        of: [
          { kind: "allOf", of: [at(ax, y, TRUCHET_LINE), at(bx, y, TRUCHET_BG)] },
          { kind: "allOf", of: [at(ax, y, TRUCHET_BG), at(bx, y, TRUCHET_LINE)] },
        ],
      });
      unflipped.push(at(ax, y, TRUCHET_LINE));
      flipped.push(at(bx, y, TRUCHET_LINE));
    }
  }
  return [
    {
      kind: "allOf",
      of: whole,
      message: "1つのマスの中で、曲線の向きがばらばらです。乱数はピクセルの位置ではなく、マスの番号 i で決めましょう",
    },
    {
      kind: "anyOf",
      of: flipped,
      message: "どのマスも同じ向きのままです。random(i) が 0.5 より大きいマスだけ、f.x を 1.0 - f.x にしましょう",
    },
    {
      kind: "anyOf",
      of: unflipped,
      message: "すべてのマスが反転しています。反転するのは random(i) が 0.5 より大きいマスだけです",
    },
  ];
}

export const track: Track = {
  id: "glsl-tiling",
  domain: "glsl",
  title: "タイルを敷きつめる",
  summary: "1段おきにずらしたレンガ、2つの格子を重ねたハチの巣、マスごとに向きを変えるトルシェ。すき間なく平面を埋める模様。",
  icon: "🐝",
  lessons: [
    {
      id: "glsl-brick",
      title: "レンガを積む: 1段おきにずらす",
      explanation:
        "<p>市松模様と同じように <code>floor</code> で<b>段の番号</b>を求めると、段ごとに違う処理ができます。<code>mod(floor(pos.y), 2.0)</code> は" +
        "偶数の段で 0、奇数の段で 1 なので、これに 0.5 を掛けて <code>pos.x</code> に足せば、奇数の段だけがレンガ半分ずれます。" +
        "ずらしてから <code>fract</code> を取るのがポイントで、目地（すき間）も一緒にずれて、本物のレンガ積みになります。</p>",
      challenge: {
        starterCode: sh(
          brickMain("  // ここで、段の番号 floor(pos.y)（下から 0, 1, 2, …）が奇数の段だけ pos.x を 0.5 ずらそう\n"),
        ),
        task: "段の番号 floor(pos.y) が奇数の段だけ pos.x に 0.5 を足して、1段おきに半分ずれたレンガ積みにしよう。",
        validators: [
          { kind: "compiles" },
          // Samples 1.1 px or more inside a joint or a brick: in the odd rows
          // the vertical joints move by half a brick…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1875, y: 0.2708, rgb: MORTAR },
              { kind: "pixelApprox", x: 0.3542, y: 0.2708, rgb: BRICK },
              { kind: "pixelApprox", x: 0.5208, y: 0.6042, rgb: MORTAR },
              { kind: "pixelApprox", x: 0.6875, y: 0.6042, rgb: BRICK },
              { kind: "pixelApprox", x: 0.8542, y: 0.6042, rgb: MORTAR },
            ],
            message: "奇数の段の目地（すき間）がずれていません。floor(pos.y) が奇数の段だけ、pos.x に 0.5 を足しましょう",
          },
          // …and the even rows stay put.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3542, y: 0.4375, rgb: MORTAR },
              { kind: "pixelApprox", x: 0.1875, y: 0.4375, rgb: BRICK },
            ],
            message: "偶数の段までずれています。ずらすのは、段の番号が奇数の段だけです",
          },
        ],
        hints: [
          "mod(floor(pos.y), 2.0) は偶数の段で 0.0、奇数の段で 1.0",
          "pos.x += mod(floor(pos.y), 2.0) * 0.5;",
        ],
        solution: sh(brickMain("  pos.x += mod(floor(pos.y), 2.0) * 0.5;  // 奇数の段だけ半分ずらす\n")),
      },
    },
    {
      id: "glsl-hex-grid",
      title: "ハチの巣: 六角形のタイル",
      explanation:
        "<p>六角形のタイルは、長方形の格子 2つから作れます。横 1・縦 √3 のマスの格子 A と、それを縦横に半マスずらした格子 B を用意し、" +
        "各ピクセルで<b>近いほうの中心</b>を選ぶと、そのピクセルが入る六角形が決まります。選んだ中心からのずれ <code>g</code> を " +
        "<code>hexDist</code> に渡すと、六角形のふちまでの近さ（中心で 0、ふちで 0.5）が分かります。どちらが近いかは、ずれの長さの 2乗 " +
        "<code>dot(a, a)</code> を比べれば十分です（平方根を取らなくても大小は同じ）。</p>",
      challenge: {
        starterCode: sh(
          HEX_DIST_FN +
            hexMain(
              "  // ここで、半マスずらした格子 B のずれ b を作り、a と b の近いほうを g にしよう\n" +
                "  vec2 g = a;\n",
            ),
        ),
        task: "半マスずらした格子 B のずれ b = mod(p - s * 0.5, s) - s * 0.5 を作り、a と b のうち中心に近いほうを g にして、すき間なく並ぶ六角形にしよう。",
        validators: [
          { kind: "compiles" },
          // Hexagon centres from lattice B (the starter's cell corners)…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3958, y: 0.3542, rgb: HONEY },
              { kind: "pixelApprox", x: 0.6042, y: 0.6875, rgb: HONEY },
              { kind: "pixelApprox", x: 0.1875, y: 0.6875, rgb: HONEY },
            ],
            message: "格子 B の中心が六角形になっていません。半マスずらした b も作り、a と b のうち中心に近いほうを g にしましょう",
          },
          // …and from lattice A, which choosing the farther centre loses…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.4792, y: 0.5208, rgb: HONEY },
              { kind: "pixelApprox", x: 0.3125, y: 0.1875, rgb: HONEY },
            ],
            message: "格子 A の中心が六角形になっていません。a と b のうち、ずれの短い（dot の小さい）ほうを選びましょう",
          },
          // …and walls where an A and a B hexagon meet (0.06 inside the wall).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.3958, y: 0.2292, rgb: WAX },
              { kind: "pixelApprox", x: 0.3542, y: 0.6042, rgb: WAX },
            ],
            message: "六角形のふちの位置が違います。格子 B は、マスの大きさ s の半分（s * 0.5）だけずらしましょう",
          },
        ],
        hints: [
          "vec2 b = mod(p - s * 0.5, s) - s * 0.5;",
          "vec2 g = dot(a, a) < dot(b, b) ? a : b;  // 条件 ? 真のとき : 偽のとき",
        ],
        solution: sh(
          HEX_DIST_FN +
            hexMain(
              "  vec2 b = mod(p - s * 0.5, s) - s * 0.5;  // 格子 B: 半マスずらした格子\n" +
                "  vec2 g = dot(a, a) < dot(b, b) ? a : b;  // 近いほうの中心を選ぶ\n",
            ),
        ),
      },
    },
    {
      id: "glsl-truchet",
      title: "トルシェ: マスごとに向きを変える",
      explanation:
        "<p>マスに 4分の1 の円を 2本描き、マスごとに向きを<b>でたらめに</b>変えると、曲線が迷路のようにつながる模様になります（<b>トルシェ・タイル</b>）。" +
        "どちらの向きでも曲線はマスの辺のまん中を通るので、となりのマスとかならずつながります。向きを変えるには、マスの中の座標を " +
        "<code>f.x = 1.0 - f.x;</code> と左右に反転するだけ。どのマスを反転するかは、マスの番号 <code>i</code> を「乱数とノイズ」で作った " +
        "<code>random</code> に渡して決めます。</p>",
      challenge: {
        starterCode: shHigh(
          RANDOM_FN + truchetMain("  // ここで、random(i) が 0.5 より大きいマスだけ f.x を左右に反転しよう\n"),
        ),
        task: "random(i) が 0.5 より大きいマスだけ f.x を 1.0 - f.x にして、曲線が迷路のようにつながるトルシェ模様にしよう。",
        validators: [
          { kind: "compiles" },
          // random() is declared above main(), so require the call inside it.
          {
            kind: "sourceMatches",
            pattern: "main[\\s\\S]*random\\s*\\(",
            message: "マスの番号 i を random に渡して、反転するマスを決めましょう",
          },
          ...truchetChecks(),
        ],
        hints: [
          "if (random(i) > 0.5) f.x = 1.0 - f.x;",
          "反転は、円までの距離 d を計算するより前に行います",
        ],
        solution: shHigh(
          RANDOM_FN + truchetMain("  if (random(i) > 0.5) f.x = 1.0 - f.x;  // マスごとに、でたらめに左右反転\n"),
        ),
      },
    },
  ],
};
