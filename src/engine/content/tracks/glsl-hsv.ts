// The glsl-hsv track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, PICTURE_FN, filterMain, sh } from "./shared-glsl.js";

/** The hue → pure colour line of hsv2rgb (three trapezoid waves). */
const PURE_HUE = "  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);  // 色相の純色\n";

/** hsv2rgb with `hue` as the line that sets `rgb` from c.x. */
const hsv2rgbFn = (hue: string): string =>
  "// 色相 h（0〜1 で赤→黄→緑→水色→青→赤紫→赤）・彩度 s・明度 v から RGB を作る\n" +
  "vec3 hsv2rgb(vec3 c) {\n" +
  hue +
  "  return c.z * mix(vec3(1.0), rgb, c.y);  // 彩度で白と混ぜ、明度を掛ける\n" +
  "}\n\n";

const HSV2RGB_FN = hsv2rgbFn(PURE_HUE);

const RGB2HSV_FN =
  "// RGB から HSV へ（いちばん大きい成分で、色相のどの区間かを決める）\n" +
  "vec3 rgb2hsv(vec3 c) {\n" +
  "  float mx = max(c.r, max(c.g, c.b));\n" +
  "  float mn = min(c.r, min(c.g, c.b));\n" +
  "  float d = mx - mn;\n" +
  "  float h = 0.0;\n" +
  "  if (d > 0.0) {\n" +
  "    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);\n" +
  "    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;\n" +
  "    else h = (c.r - c.g) / d + 4.0;\n" +
  "  }\n" +
  "  return vec3(h / 6.0, mx > 0.0 ? d / mx : 0.0, mx);\n" +
  "}\n\n";

const RAINBOW_MAIN =
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 col = hsv2rgb(vec3(st.x, 1.0, 1.0));  // 横に色相をひとまわり（彩度・明度は 1）\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The colour wheel's main(): `wheel` sets col from p and r. */
const wheelMain = (wheel: string): string =>
  "void main() {\n" + CENTRED + "  float r = length(p);  // 中心からの距離\n" + wheel + "  gl_FragColor = vec4(col, 1.0);\n}";

export const track: Track = {
  id: "glsl-hsv",
  domain: "glsl",
  title: "色相・彩度・明度（HSV）",
  summary: "色を色相・彩度・明度で表す HSV。色相から虹色を作り、角度を色相にして色相環を描き、色相を半周まわして補色にする。",
  icon: "🎡",
  lessons: [
    {
      id: "glsl-hsv-rainbow",
      title: "色相で虹を作る: HSV から RGB へ",
      explanation:
        "<p>RGB は光の 3原色の量で色を表しますが、「鮮やかさはそのままで色みだけ変えたい」といった調整には向きません。<b>HSV</b> は色を" +
        "<b>色相</b>（H: 赤→黄→緑→水色→青→赤紫とひとまわりする色み、0〜1）・<b>彩度</b>（S: 0 で灰色、1 で鮮やか）・<b>明度</b>" +
        "（V: 0 で黒）の 3つで表します。色相から純色を作るには、R・G・B をそれぞれ色相に沿った台形の波にします。R は色相 0 のあたりで 1、" +
        "0.5 のあたりで 0 になり、G と B は同じ波を 1/3 ずつずらしたものです。<code>abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0</code> " +
        "を <code>clamp</code> で 0〜1 に収めると、この 3つの波がまとめて作れます。あとは彩度で白と混ぜ（<code>mix(vec3(1.0), rgb, s)</code>）、" +
        "明度を掛ければ完成です。</p>",
      challenge: {
        starterCode: sh(hsv2rgbFn("  // ここで、色相 c.x から純色 rgb を作ろう（いまは白）\n  vec3 rgb = vec3(1.0);\n") + RAINBOW_MAIN),
        task: "hsv2rgb の rgb を clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0) にして、横に虹色をひとまわりさせよう。",
        validators: [
          { kind: "compiles" },
          // Hues 0.10 (orange), 0.44 (spring green) and 0.77 (violet): the
          // offsets turned round run the hues backwards, without "- 1.0" the
          // colours turn pale, and without "* 6.0" the hue barely moves.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.1042, y: 0.5208, rgb: [1, 0.63, 0] },
              { kind: "pixelApprox", x: 0.4375, y: 0.5208, rgb: [0, 1, 0.65] },
              { kind: "pixelApprox", x: 0.7708, y: 0.5208, rgb: [0.62, 0, 1] },
            ],
            message:
              "虹の色の並びになっていません。rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0) です（4.0 と 2.0 を入れ替えると、色が逆回りになります）",
          },
        ],
        hints: [
          "R・G・B の波を 0、4、2 ずらす: mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0)",
          "vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);",
        ],
        solution: sh(HSV2RGB_FN + RAINBOW_MAIN),
      },
    },
    {
      id: "glsl-color-wheel",
      title: "色相環: 角度を色相に、距離を彩度に",
      explanation:
        "<p>色相はひとまわりするともとに戻るので、円の角度と相性が抜群です。「極座標」と同じく <code>atan(p.y, p.x)</code> で角度（-π〜π）を求め、" +
        "<code>6.2832</code>（2π）で割ると -0.5〜0.5 になります。負の色相も <code>hsv2rgb</code> の <code>mod</code> がひとまわりさせてくれるので、" +
        "そのまま色相に使えます（右が赤で、反時計回りに黄・緑・水色・青・赤紫）。中心からの距離 <code>r</code> を彩度にすると、中心は白、" +
        "ふちほど鮮やかな<b>色相環</b>になります。カラーピッカーでおなじみの円です。</p>",
      challenge: {
        starterCode: sh(
          HSV2RGB_FN +
            wheelMain(
              "  // ここで、角度 atan(p.y, p.x) を 0〜1 の色相に、r を彩度にして色相環を描こう（半径 1 の外は黒）\n" +
                "  vec3 col = vec3(0.0);\n",
            ),
        ),
        task: "色相を atan(p.y, p.x) / 6.2832、彩度を中心からの距離 r、明度を 1.0 にして hsv2rgb で色を作り、半径 1 の外を黒にして色相環を描こう。",
        validators: [
          { kind: "compiles" },
          // Right red, top yellow-green, left cyan, bottom violet, each at
          // radius 0.63: pale by the saturation r. atan(p.x, p.y) turns the
          // wheel round, + 0.5 puts red on the left, the angle in radians
          // wraps the hues round six times.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8125, y: 0.5208, rgb: [1, 0.4, 0.36] },
              { kind: "pixelApprox", x: 0.5208, y: 0.8125, rgb: [0.72, 1, 0.36] },
              { kind: "pixelApprox", x: 0.1875, y: 0.5208, rgb: [0.38, 1, 0.96] },
              { kind: "pixelApprox", x: 0.4792, y: 0.1875, rgb: [0.65, 0.38, 1] },
            ],
            message: "色相環の色の並びが違います。色相は atan(p.y, p.x) / 6.2832 です（右が赤で、反時計回りに黄・緑・水色・青・赤紫）",
          },
          {
            kind: "pixelApprox",
            x: 0.5208,
            y: 0.5208,
            rgb: [1, 0.98, 0.95],
            message: "中心が白くなっていません。彩度には中心からの距離 r を使いましょう（中心で 0 = 白、ふちで 1 = 鮮やか）",
          },
          {
            kind: "pixelApprox",
            x: 0.0625,
            y: 0.0625,
            rgb: BLACK,
            message: "円の外が黒くなっていません。col *= step(r, 1.0); で、半径 1 の外を黒にしましょう",
          },
        ],
        hints: ["float hue = atan(p.y, p.x) / 6.2832;  // -0.5〜0.5（右が 0 = 赤）", "vec3 col = hsv2rgb(vec3(hue, r, 1.0));\ncol *= step(r, 1.0);"],
        solution: sh(
          HSV2RGB_FN +
            wheelMain(
              "  float hue = atan(p.y, p.x) / 6.2832;    // -0.5〜0.5（右が 0 = 赤、反時計回り）\n" +
                "  vec3 col = hsv2rgb(vec3(hue, r, 1.0));  // 中心からの距離を彩度に\n" +
                "  col *= step(r, 1.0);                    // 半径 1 の外は黒\n",
            ),
        ),
      },
    },
    {
      id: "glsl-hue-shift",
      title: "補色にする: 色相を半周まわす",
      explanation:
        "<p>色相環で正反対にある色どうしを<b>補色</b>と呼びます（黄と青紫、緑と赤紫など）。RGB のままでは補色を求めにくいですが、HSV に直せば" +
        "<b>色相に 0.5 を足すだけ</b>です。彩度と明度はそのままなので、明るさや鮮やかさを保ったまま色みだけが反対になります。" +
        "<code>rgb2hsv</code> で HSV に直し、<code>hsv.x</code> に 0.5 を足して（1 を超えた分は <code>fract</code> で戻す）、<code>hsv2rgb</code> で " +
        "RGB に戻します。<code>1.0 - col</code>（ネガ）も色みは反対になりますが、明るさまで反転してしまう点が違います。</p>",
      challenge: {
        starterCode: sh(
          PICTURE_FN +
            RGB2HSV_FN +
            HSV2RGB_FN +
            filterMain("  // ここで、col を HSV に直し、色相を半周（0.5）まわしてから RGB に戻して、補色にしよう\n"),
        ),
        task: "rgb2hsv で col を HSV に直し、hsv.x = fract(hsv.x + 0.5) で色相を半周まわして、hsv2rgb で RGB に戻し、絵を補色にしよう。",
        validators: [
          { kind: "compiles" },
          // The sun, the hill and the sky, away from their edges: complements
          // keep each colour's saturation and brightness (max + min - col),
          // which the negative 1.0 - col, a quarter turn and a shifted
          // saturation do not.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.6875, y: 0.6875, rgb: [0.45, 0.5, 0.95] },
              { kind: "pixelApprox", x: 0.1042, y: 0.1458, rgb: [0.4, 0.1, 0.35] },
              { kind: "pixelApprox", x: 0.2708, y: 0.8542, rgb: [0.96, 0.72, 0.53] },
            ],
            message:
              "補色になっていません。rgb2hsv で HSV に直し、hsv.x に 0.5 を足して（fract で 0〜1 に戻して）、hsv2rgb で RGB に戻しましょう（1.0 - col は明るさまで反転します）",
          },
        ],
        hints: ["vec3 hsv = rgb2hsv(col);", "hsv.x = fract(hsv.x + 0.5);  // 色相を半周\ncol = hsv2rgb(hsv);"],
        solution: sh(
          PICTURE_FN +
            RGB2HSV_FN +
            HSV2RGB_FN +
            filterMain(
              "  vec3 hsv = rgb2hsv(col);\n" +
                "  hsv.x = fract(hsv.x + 0.5);  // 色相を半周まわす（彩度と明度はそのまま）\n" +
                "  col = hsv2rgb(hsv);\n",
            ),
        ),
      },
    },
  ],
};
