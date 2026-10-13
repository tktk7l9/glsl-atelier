// The glsl-distort track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { sh } from "./shared-glsl.js";

/** The track's picture: an 8×8 checkerboard, as a function of the coordinate
 *  so a lesson can read it wherever it likes. */
const CHECKER_FN =
  "// 元の絵: 8×8 の市松模様（座標 uv の色を返す）\n" +
  "vec3 picture(vec2 uv) {\n" +
  "  float c = mod(floor(uv.x * 8.0) + floor(uv.y * 8.0), 2.0);\n" +
  "  return mix(vec3(0.1, 0.15, 0.35), vec3(0.95, 0.85, 0.55), c);\n" +
  "}\n\n";

/** main(): `distort` changes uv before the picture is read there. */
const distortMain = (distort: string): string =>
  CHECKER_FN +
  "void main() {\n" +
  "  vec2 uv = gl_FragCoord.xy / u_resolution;\n" +
  distort +
  "  gl_FragColor = vec4(picture(uv), 1.0);  // ずらした位置の色を読む\n}";

const DARK: [number, number, number] = [0.1, 0.15, 0.35];
const LIGHT: [number, number, number] = [0.95, 0.85, 0.55];

export const track: Track = {
  id: "glsl-distort",
  domain: "glsl",
  title: "絵をゆがめる",
  summary: "絵を読む座標のほうをずらすと、絵そのものがゆがむ。sin で波打たせ、同心円の波紋を広げ、レンズのようにふくらませる。",
  icon: "💧",
  lessons: [
    {
      id: "glsl-wave-distort",
      title: "波打たせる: sin で読む位置をずらす",
      explanation:
        "<p>絵を描き換えなくても、<b>絵を読む座標</b>をずらせば、絵はゆがんで見えます。画素ごとに「元の絵のどこを読むか」を決めるのが " +
        "<code>picture(uv)</code> の <code>uv</code> なので、それを少し動かすだけです。高さ <code>uv.y</code> に合わせて <code>uv.x</code> を " +
        "<code>sin</code> で左右にずらすと、縦の線が波打ちます（水面に映った景色や、陽炎のような表現）。<code>0.04</code> がずれの大きさ（振幅）、" +
        "<code>25.0</code> が波の細かさです。ポストエフェクトの多くは、このように「読む位置をずらす」ことで作られています。</p>",
      challenge: {
        starterCode: sh(distortMain("  // ここで、uv.x を 0.04 * sin(uv.y * 25.0) だけずらそう\n")),
        task: "uv.x に 0.04 * sin(uv.y * 25.0) を足してから絵を読み、市松模様の縦の線を波打たせよう。",
        validators: [
          { kind: "compiles" },
          // Three cells whose colour the wave turns over (the plain board
          // reads the other colour there), each in a band where shifting the
          // picture 0.3 px keeps it. The wave on y, sin of x, a tiny
          // amplitude and the opposite sign read the plain board's colour at
          // one of them at least.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1458, y: 0.1875, rgb: LIGHT },
              { kind: "pixelApprox", x: 0.6042, y: 0.5625, rgb: LIGHT },
              { kind: "pixelApprox", x: 0.4792, y: 0.8125, rgb: DARK },
            ],
            message: "縦の線が、高さに合わせて左右に波打っていません。uv.x += 0.04 * sin(uv.y * 25.0); を、picture(uv) で絵を読む前に入れましょう",
          },
        ],
        hints: ["uv.x += 0.04 * sin(uv.y * 25.0);  // 高さ y に合わせて、読む位置を左右にずらす"],
        solution: sh(distortMain("  uv.x += 0.04 * sin(uv.y * 25.0);  // 高さ y に合わせて、読む位置を左右にずらす\n")),
      },
    },
    {
      id: "glsl-ripple",
      title: "波紋: 中心から押したり引いたり",
      explanation:
        "<p>水面に石を落としたような<b>波紋</b>は、中心からの距離に合わせて、読む位置を中心から外向きに押したり引いたりすると作れます。" +
        "<code>dir = uv - 0.5</code> が中心からこの点への向き（と距離）です。<code>sin(length(dir) * 40.0)</code> は距離とともに 1 と -1 の間を" +
        "くり返すので、<code>uv += dir * 0.15 * sin(...)</code> とすると、ある輪では外側を、次の輪では内側を読み、同心円の波が立ちます。" +
        "<code>dir</code> を掛けているので、ずれは中心で 0、外へ行くほど大きくなります。</p>",
      challenge: {
        starterCode: sh(
          distortMain(
            "  vec2 dir = uv - 0.5;  // 中心からこの点への向き（と距離）\n" +
              "  // ここで、uv を dir * 0.15 * sin(length(dir) * 40.0) だけずらそう\n",
          ),
        ),
        task: "uv に dir * 0.15 * sin(length(dir) * 40.0) を足してから絵を読み、市松模様に同心円の波紋を広げよう。",
        validators: [
          { kind: "compiles" },
          // Cells the ripple turns over in three directions from the middle:
          // pushing x alone, slow rings or a fixed direction miss one.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1875, y: 0.2292, rgb: LIGHT },
              { kind: "pixelApprox", x: 0.5208, y: 0.8542, rgb: LIGHT },
              { kind: "pixelApprox", x: 0.4375, y: 0.8542, rgb: DARK },
              { kind: "pixelApprox", x: 0.7708, y: 0.6042, rgb: LIGHT },
            ],
            message:
              "同心円の波紋になっていません。uv += dir * 0.15 * sin(length(dir) * 40.0); で、中心からの向き dir に沿って（x も y も）ずらしましょう",
          },
        ],
        hints: ["sin(length(dir) * 40.0) は、中心からの距離で 1 と -1 の間をくり返す", "uv += dir * 0.15 * sin(length(dir) * 40.0);"],
        solution: sh(
          distortMain(
            "  vec2 dir = uv - 0.5;  // 中心からこの点への向き（と距離）\n" +
              "  uv += dir * 0.15 * sin(length(dir) * 40.0);  // 距離に合わせて、外へ押したり内へ引いたり\n",
          ),
        ),
      },
    },
    {
      id: "glsl-lens",
      title: "レンズのゆがみ: 中心をふくらませる",
      explanation:
        "<p>魚眼レンズで撮った写真は、まん中がふくらみ、まわりの線が外へたわみます（<b>たる型のゆがみ</b>）。中心からのずれ " +
        "<code>p = uv - 0.5</code> に <code>1.0 + 1.5 * dot(p, p)</code> を掛けて読むと、中心から遠い画素ほど、より外側の絵を読むことになり、" +
        "まわりの絵が縮んでまん中がふくらんで見えます。<code>dot(p, p)</code> は距離の 2乗なので、中心付近はほとんどずれず、外へ行くほど急に強く" +
        "ゆがみます。最後に <code>0.5</code> を足して、中心を戻すのを忘れずに。符号を逆（<code>1.0 - ...</code>）にすると、まわりが引き伸ばされる" +
        "糸巻き型になります。</p>",
      challenge: {
        starterCode: sh(
          distortMain(
            "  vec2 p = uv - 0.5;  // 中心からのずれ\n" +
              "  // ここで、uv を 0.5 + p * (1.0 + 1.5 * dot(p, p)) にして、中心をふくらませよう\n",
          ),
        ),
        task: "uv を 0.5 + p * (1.0 + 1.5 * dot(p, p)) にしてから絵を読み、市松模様のまん中をレンズのようにふくらませよう。",
        validators: [
          { kind: "compiles" },
          // Cells turned over towards the edges, all round: the pincushion
          // (1.0 - ...), length(p) instead of dot(p, p) and scaling from the
          // corner miss one at least.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.1458, rgb: DARK },
              { kind: "pixelApprox", x: 0.2708, y: 0.3125, rgb: LIGHT },
              { kind: "pixelApprox", x: 0.7292, y: 0.7708, rgb: DARK },
              { kind: "pixelApprox", x: 0.8542, y: 0.5208, rgb: LIGHT },
            ],
            message:
              "まん中がふくらむゆがみになっていません。uv = 0.5 + p * (1.0 + 1.5 * dot(p, p)); です（1.0 - にすると逆の糸巻き型、0.5 を足さないと中心がずれます）",
          },
        ],
        hints: ["dot(p, p) は中心からの距離の 2乗（外ほど大きい）", "uv = 0.5 + p * (1.0 + 1.5 * dot(p, p));"],
        solution: sh(
          distortMain(
            "  vec2 p = uv - 0.5;  // 中心からのずれ\n" +
              "  uv = 0.5 + p * (1.0 + 1.5 * dot(p, p));  // 中心から遠いほど、より外側を読む\n",
          ),
        ),
      },
    },
  ],
};
