// The glsl-convolution track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import type { ValidatorSpec } from "../../validate/primitives.js";
import { BLACK, HILL, PICTURE_FN, SUN, WHITE, filterMain, sh } from "./shared-glsl.js";

/** The convolution track's blur, written in its first lesson: the average of
 *  the 5×5 points around `uv`, 0.011 apart. */
const BLUR_FN =
  "// 前のレッスンのぼかし: まわり 5×5 の 25点の平均\n" +
  "vec3 blur(vec2 uv) {\n" +
  "  vec3 sum = vec3(0.0);\n" +
  "  for (int y = -2; y <= 2; y++) {\n" +
  "    for (int x = -2; x <= 2; x++) {\n" +
  "      sum += picture(uv + vec2(float(x), float(y)) * 0.011);\n" +
  "    }\n" +
  "  }\n" +
  "  return sum / 25.0;\n" +
  "}\n\n";

/** The blur lesson's `main()`; `body` sets `col` from the picture around `st`. */
const blurMain = (body: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  float d = 0.011;  // となりの点までの距離\n" +
  body +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const LUM_FN =
  "// 座標 uv の絵の明るさ（輝度）\n" +
  "float lum(vec2 uv) {\n" +
  "  return dot(picture(uv), vec3(0.2126, 0.7152, 0.0722));\n" +
  "}\n\n";

/** The edge lesson's `main()`: the left-right difference `gx` is given, and
 *  `combine` sets `edge` from it (and the up-down difference it adds). */
const edgeMain = (combine: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  float d = 0.015;  // ずらす距離\n" +
  "  float gx = lum(st + vec2(d, 0.0)) - lum(st - vec2(d, 0.0));  // 左右の明るさの差\n" +
  combine +
  "  vec3 col = vec3(step(0.05, edge));  // 変化が 0.05 以上の所だけ白\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The sky at the top-left sample (0.1875, 0.9375), far from any edge. */
const SKY_HIGH: [number, number, number] = [0.57, 0.82, 0.98];

/** Places far from every edge of the picture keep their colour under any of
 *  the convolution track's filters that leave flat areas alone. */
const flatPicture = (message: string): ValidatorSpec => ({
  kind: "allOf",
  of: [
    { kind: "pixelApprox", x: 0.6875, y: 0.6875, rgb: SUN },
    { kind: "pixelApprox", x: 0.1875, y: 0.9375, rgb: SKY_HIGH },
    { kind: "pixelApprox", x: 0.1875, y: 0.1042, rgb: HILL },
  ],
  message,
});

export const track: Track = {
  id: "glsl-convolution",
  domain: "glsl",
  title: "まわりを見るフィルタ",
  summary: "まわりの点の色を読んで足し合わせる（畳み込み）。平均でぼかし、ぼかしとの差でくっきりさせ、明るさの差から輪郭を取り出す。",
  icon: "🔍",
  lessons: [
    {
      id: "glsl-blur",
      title: "ぼかし: まわりの平均",
      explanation:
        "<p>これまでのフィルタは、そのピクセル 1点の色だけを見ていました。<b>ぼかし</b>は、<b>まわりの点</b>の色も読んで混ぜます。座標を少しずつずらして " +
        "<code>picture</code> を何度も読み、全部足して数で割れば<b>平均</b>です。まわり 5×5 の 25点なら、<code>for</code> ループを 2重にして x と y を " +
        "それぞれ -2〜2 で回し、<code>st + vec2(float(x), float(y)) * d</code> の色を足して 25 で割ります（GLSL では int と float をそのまま掛けられないので、" +
        "<code>float(x)</code> で変換します）。色がくっきり変わるふちでは両側の色が混ざり、なだらかになります。このように「まわりの点に重みをつけて足し合わせる」" +
        "処理を<b>畳み込み</b>（コンボリューション）、重みの表を<b>カーネル</b>と呼びます（ここでは 25点とも同じ重み）。実際のアプリでは、" +
        "<code>picture(uv)</code> の代わりに画像のテクスチャを読みます。</p>",
      mdnPath: "/ja/docs/Web/SVG/Reference/Element/feConvolveMatrix",
      challenge: {
        starterCode: sh(
          PICTURE_FN +
            blurMain(
              "  // ここで、まわり 5×5 の 25点の色を足して 25 で割り、col をその平均にしよう（いまはその場所の色だけ）\n" +
                "  vec3 col = picture(st);\n",
            ),
        ),
        task: "for ループを 2重にして x と y を -2〜2 で回し、st + vec2(float(x), float(y)) * d の色を 25点ぶん足して 25 で割り、絵をぼかそう。",
        validators: [
          { kind: "compiles" },
          // Far from the edges the average is the colour itself (dividing by
          // 9 or not at all brightens it)…
          flatPicture("平らな所の色まで変わっています。足し合わせた 25点の色は、25 で割って平均にしましょう"),
          // …while across an edge both colours mix. The targets sit in the
          // middle of what the 5×5 average, a 3×3 kernel twice as far apart,
          // a 7×7 one over the same reach and binomial weights draw, with
          // the picture moved by up to 0.3 px (within 0.085 of each); the
          // sharp picture is 0.22 or more away. The left and right of the
          // sun need the sideways taps…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.6875, rgb: [0.62, 0.75, 0.76], tol: 0.15 },
              { kind: "pixelApprox", x: 0.8542, y: 0.6875, rgb: [0.62, 0.75, 0.76], tol: 0.15 },
            ],
            message:
              "ふちがくっきりしたままです（太陽の左右のふち）。x と y を -2〜2 で回して、まわり 25点の色を足し合わせましょう",
          },
          // …and the top and bottom of the sun and the hill the upward ones.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6875, y: 0.8542, rgb: [0.67, 0.82, 0.79], tol: 0.15 },
              { kind: "pixelApprox", x: 0.6875, y: 0.5208, rgb: [0.57, 0.69, 0.72], tol: 0.15 },
              { kind: "pixelApprox", x: 0.2708, y: 0.3958, rgb: [0.19, 0.45, 0.39], tol: 0.15 },
            ],
            message:
              "太陽の上下や丘のふちがぼけていません。x だけでなく y も -2〜2 で回して、上下にずらした点の色も混ぜましょう",
          },
        ],
        hints: [
          "vec3 sum = vec3(0.0);\nfor (int y = -2; y <= 2; y++) {\n  for (int x = -2; x <= 2; x++) {\n    sum += picture(st + vec2(float(x), float(y)) * d);\n  }\n}",
          "vec3 col = sum / 25.0;  // 25点の平均",
        ],
        solution: sh(
          PICTURE_FN +
            blurMain(
              "  vec3 sum = vec3(0.0);\n" +
                "  for (int y = -2; y <= 2; y++) {\n" +
                "    for (int x = -2; x <= 2; x++) {\n" +
                "      sum += picture(st + vec2(float(x), float(y)) * d);  // ずらした点の色を足す\n" +
                "    }\n" +
                "  }\n" +
                "  vec3 col = sum / 25.0;  // 25点の平均\n",
            ),
        ),
      },
    },
    {
      id: "glsl-sharpen",
      title: "くっきりさせる: ぼかしとの差",
      explanation:
        "<p>ぼかしとは逆に、ふちを<b>くっきり</b>させるときも、ぼかした絵を使います。元の色 <code>col</code> から、ぼかした色 <code>blur(st)</code> を引いた " +
        "<code>col - blur(st)</code> は、平らな所ではほぼ 0 で、ふちの近くでだけ大きくなる<b>細かい部分</b>です。これを強めて元の色に足し戻すと、ふちの明るい側は" +
        "より明るく、暗い側はより暗くなり、絵が引き締まって見えます。写真の加工で<b>アンシャープマスク</b>と呼ばれる定番の方法です。強めすぎると、ふちのまわりに" +
        "光の縁取り（ハロー）が出ます。<code>blur</code> 関数には、前のレッスンのぼかしが入っています。</p>",
      challenge: {
        starterCode: sh(
          PICTURE_FN + BLUR_FN + filterMain("  // ここで、col と blur(st) の差（細かい部分）を 1.5 倍して、col に足そう\n"),
        ),
        task: "col と blur(st) の差 col - blur(st) を 1.5 倍して col に足し、ふちを際立たせよう（アンシャープマスク）。",
        validators: [
          { kind: "compiles" },
          // Flat areas keep their colour (adding the blur itself brightens
          // them, the difference alone darkens them)…
          flatPicture("平らな所の色まで変わっています。足すのは blur(st) そのものではなく、col との差 col - blur(st) です"),
          // …and the edges overshoot: the sky just outside the sun turns
          // darker and bluer and the sun's rim brighter, the hill's rim
          // darker and the sky above it brighter. Amounts from 1.25 to 1.75
          // land within 0.07 of these, with the picture moved by up to
          // 0.3 px; subtracting the difference instead blurs the picture.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5625, y: 0.5625, rgb: [0.21, 0.51, 1] },
              { kind: "pixelApprox", x: 0.6042, y: 0.5625, rgb: [1, 0.99, 0.31] },
              { kind: "pixelApprox", x: 0.2708, y: 0.3958, rgb: [0, 0.33, 0] },
              { kind: "pixelApprox", x: 0.3542, y: 0.3958, rgb: [0.43, 0.57, 1] },
            ],
            message:
              "ふちが際立っていません。col から blur(st) を引いた差を 1.5 倍して col に足しましょう（blur(st) から col を引くと、逆にぼやけます）",
          },
        ],
        hints: [
          "vec3 detail = col - blur(st);  // ふちの近くでだけ大きくなる",
          "col += detail * 1.5;",
        ],
        solution: sh(
          PICTURE_FN +
            BLUR_FN +
            filterMain(
              "  vec3 detail = col - blur(st);  // ふちの近くでだけ大きくなる、細かい部分\n" +
                "  col += detail * 1.5;           // 強めて足し戻す\n",
            ),
        ),
      },
    },
    {
      id: "glsl-edge",
      title: "輪郭を取り出す: 明るさの差",
      explanation:
        "<p>絵の<b>輪郭</b>は、明るさが急に変わる所です。となりどうしの明るさの<b>差</b>を求めれば見つかります。左右に <code>d</code> ずつずらした 2点の明るさの差が " +
        "<code>gx</code>、上下にずらした 2点の差が <code>gy</code> で、平らな所ではどちらもほぼ 0、ふちでは大きくなります（<code>lum</code> は、その座標の絵の明るさを" +
        "返します）。ただし <code>gx</code> だけでは横向きのふちを見逃しますし、差には<b>符号</b>があります（明るくなる向きならプラス、暗くなる向きならマイナス）。" +
        "2つを並べたベクトルの長さ <code>length(vec2(gx, gy))</code> を<b>変化の大きさ</b>にすれば、どの向きのふちも、明るくなる側も暗くなる側も同じように拾えます。" +
        "これを <code>step</code> でしきい値と比べると、線画のような輪郭だけが残ります（斜めの点にも重みをつけて差をとる <b>Sobel フィルタ</b>も、同じ考え方です）。</p>",
      challenge: {
        starterCode: sh(
          PICTURE_FN +
            LUM_FN +
            edgeMain(
              "  // ここで、上下の明るさの差 gy も求めて、gx と合わせた変化の大きさを edge にしよう（いまは左右の差だけ）\n" +
                "  float edge = abs(gx);\n",
            ),
        ),
        task: "上下にずらした 2点の明るさの差 gy を gx と同じ形で求め、edge を length(vec2(gx, gy)) にして、どの向きのふちも白い線で描こう。",
        validators: [
          { kind: "compiles" },
          // Flat areas stay black (a reversed step paints them white)…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6875, y: 0.6875, rgb: BLACK },
              { kind: "pixelApprox", x: 0.1875, y: 0.9375, rgb: BLACK },
              { kind: "pixelApprox", x: 0.1875, y: 0.1042, rgb: BLACK },
            ],
            message: "ふちではない所まで白くなっています。step(0.05, edge) で、明るさの変化が大きい所だけを白にしましょう",
          },
          // …and lines show at samples that keep their colour when moved by
          // half a pixel: the bottom of the sun and the top of the hill,
          // where the brightness rises upwards…
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6875, y: 0.5208, rgb: WHITE },
              { kind: "pixelApprox", x: 0.2708, y: 0.3958, rgb: WHITE },
            ],
            message:
              "横向きのふち（太陽の下や丘の上のふち）が出ていません。上下の明るさの差 gy も求めて、length(vec2(gx, gy)) で gx と合わせましょう",
          },
          // …the left of the sun, where it rises to the right…
          {
            kind: "pixelApprox",
            x: 0.5208,
            y: 0.6875,
            rgb: WHITE,
            message: "縦向きのふち（太陽の左）が消えています。左右の差 gx も合わせて、length(vec2(gx, gy)) にしましょう",
          },
          // …and the right and top of the sun, where it falls: a signed
          // sum or max of the differences loses them.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8542, y: 0.6875, rgb: WHITE },
              { kind: "pixelApprox", x: 0.6875, y: 0.8542, rgb: WHITE },
              { kind: "pixelApprox", x: 0.7708, y: 0.8125, rgb: WHITE },
            ],
            message:
              "明るさが下がる向きのふち（太陽の右や上）が消えています。差には符号があるので、gx + gy や max(gx, gy) ではなく length(vec2(gx, gy)) で大きさにしましょう",
          },
        ],
        hints: [
          "float gy = lum(st + vec2(0.0, d)) - lum(st - vec2(0.0, d));",
          "float edge = length(vec2(gx, gy));  // 向きと符号によらない、変化の大きさ",
        ],
        solution: sh(
          PICTURE_FN +
            LUM_FN +
            edgeMain(
              "  float gy = lum(st + vec2(0.0, d)) - lum(st - vec2(0.0, d));  // 上下の明るさの差\n" +
                "  float edge = length(vec2(gx, gy));  // 変化の大きさ（向きと符号によらない）\n",
            ),
        ),
      },
    },
  ],
};
