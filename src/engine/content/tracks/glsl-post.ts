// The glsl-post track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

/** The lit-sphere body of the gamma lesson (linear colour in `col`). */
const GAMMA_SPHERE =
  "  float r = 0.75;\n" +
  "  float d = length(p);\n" +
  "  vec3 col = vec3(0.0);\n" +
  "  if (d < r) {\n" +
  "    vec3 n = normalize(vec3(p, sqrt(r * r - d * d)));\n" +
  "    vec3 L = normalize(vec3(-0.5, 0.6, 0.6));\n" +
  "    float diff = max(dot(n, L), 0.0);\n" +
  "    // 環境光 0.05 ＋ 拡散光。ここまではリニアな値\n" +
  "    col = vec3(1.0, 0.5, 0.2) * (0.05 + 0.95 * diff);\n" +
  "  }\n";

/** The linear-mix lesson: a red→green ramp, mixed as display values in the
 *  bottom half (the reference) and by `top` in the top half. */
const linearMixMain = (top: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 a = vec3(1.0, 0.1, 0.1);  // 赤（画面の色）\n" +
  "  vec3 b = vec3(0.1, 1.0, 0.1);  // 緑（画面の色）\n" +
  "  // 下半分: 画面の色のまま混ぜた見本（まん中が暗くにごる）\n" +
  "  vec3 col = mix(a, b, st.x);\n" +
  "  if (st.y > 0.5) {\n" +
  top +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const BAYER_FN =
  "// 2×2 マスのしきい値: マスの位置ごとに 0.0・0.5・0.75・0.25\n" +
  "float bayer2(vec2 a) {\n" +
  "  a = mod(floor(a), 2.0);\n" +
  "  return fract(a.x * 0.5 + a.y * 0.75);\n" +
  "}\n\n" +
  "// 4×4 マスのしきい値（ベイヤー行列）: 2×2 を 2段重ねた 16 段階。1/32, 3/32, …, 31/32 のどれか\n" +
  "float bayer4(vec2 a) {\n" +
  "  return bayer2(a * 0.5) * 0.25 + bayer2(a) + 1.0 / 32.0;\n" +
  "}\n\n";

/** The dither lesson's `main()`; `pick` sets `c` from `gray` and the cell.
 *  The ramp is measured at each cell's centre, so a cell is one flat colour
 *  (a per-pixel ramp split the cells it crossed into slivers). With 40 rows the
 *  centre values (2c + 1) / 80 never equal a threshold (2k + 1) / 32. */
const ditherMain = (pick: string): string =>
  "void main() {\n" +
  "  // 画面を正方形のマスに区切る（縦に 40 マス）\n" +
  "  vec2 cell = floor(gl_FragCoord.xy / u_resolution.y * 40.0);  // マスの番号\n" +
  "  vec2 center = (cell + 0.5) * u_resolution.y / 40.0;          // マスの中心（ピクセル）\n" +
  "  float gray = center.x / u_resolution.x;  // 左が暗く、右が明るいグラデーション（マスの中は同じ明るさ）\n" +
  pick +
  "  // 使う色は 2つだけ（レトロな携帯ゲーム機の暗い緑と明るい緑）\n" +
  "  vec3 col = mix(vec3(0.06, 0.22, 0.06), vec3(0.61, 0.74, 0.06), c);\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

const DITHER_DARK: [number, number, number] = [0.06, 0.22, 0.06];

const DITHER_LIGHT: [number, number, number] = [0.61, 0.74, 0.06];

export const track: Track = {
  id: "glsl-post",
  domain: "glsl",
  title: "仕上げのエフェクト",
  summary: "ビネット・色ずれ・トーンマッピング・ガンマ補正・リニアな混色・ディザリング。できた絵に後からかける仕上げの処理。",
  icon: "📷",
  lessons: [
    {
      id: "glsl-vignette",
      title: "周辺を暗く: ビネット",
      explanation:
        "<p><b>ビネット</b>は画面の四隅を暗くして視線を中央に集める定番のエフェクトです。" +
        "中心からの距離 <code>d</code> を <code>smoothstep</code> に通し、1 から引いた値を" +
        "色に掛けます。中央（d が小さい）は 1 のまま、四隅（d が大きい）ほど 0 に近づきます。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec3 col = vec3(1.0, 0.8, 0.4);\n" +
            "  float d = distance(st, vec2(0.5));\n" +
            "  float v = 1.0;\n" +
            "  gl_FragColor = vec4(col * v, 1.0);\n}",
        ),
        task: "d から係数 v を作り、中央は明るいまま・四隅はほぼ黒になるようにしよう（0.3〜0.75 でなめらかに）。",
        validators: [
          { kind: "compiles" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.8, 0.4] },
          { kind: "pixelApprox", x: 0.03, y: 0.03, rgb: BLACK, tol: 0.2 },
          { kind: "pixelApprox", x: 0.97, y: 0.97, rgb: BLACK, tol: 0.2 },
          { kind: "pixelApprox", x: 0.97, y: 0.03, rgb: BLACK, tol: 0.2 },
          { kind: "pixelApprox", x: 0.03, y: 0.97, rgb: BLACK, tol: 0.2 },
          { kind: "smooth", maxStep: 0.2 },
        ],
        hints: [
          "float v = 1.0 - smoothstep(0.3, 0.75, d);",
          "smoothstep の第1引数より小さい d は 0、第2引数より大きい d は 1 になります",
        ],
        solution: sh(
          "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec3 col = vec3(1.0, 0.8, 0.4);\n" +
            "  float d = distance(st, vec2(0.5));\n" +
            "  float v = 1.0 - smoothstep(0.3, 0.75, d);\n" +
            "  gl_FragColor = vec4(col * v, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-chromatic-aberration",
      title: "色ずれ: 色収差",
      explanation:
        "<p>レンズの<b>色収差</b>は、色ごとに像の位置がわずかにずれる現象です。" +
        "シェーダーでは、元の絵を返す関数を R・G・B で<b>少しずつ違う座標</b>から読むだけで再現できます。" +
        "赤は右にずらした座標、青は左にずらした座標から読むと、ふちに赤と青のにじみが出ます。</p>",
      challenge: {
        starterCode: sh(
          "// 元の絵: 中央の白い円（座標 uv の明るさを返す）\n" +
            "float scene(vec2 uv) {\n" +
            "  return 1.0 - step(0.25, distance(uv, vec2(0.5)));\n" +
            "}\n\n" +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 off = vec2(0.08, 0.0);\n" +
            "  float r = scene(st);\n" +
            "  float g = scene(st);\n" +
            "  float b = scene(st);\n" +
            "  gl_FragColor = vec4(r, g, b, 1.0);\n}",
        ),
        task: "赤は st + off、青は st - off の位置から絵を読んで、円の左に赤・右に青のにじみを出そう。",
        validators: [
          { kind: "compiles" },
          { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: WHITE },
          { kind: "pixelApprox", x: 0.21, y: 0.5, rgb: [1, 0, 0] },
          { kind: "pixelApprox", x: 0.79, y: 0.5, rgb: [0, 0, 1] },
          { kind: "pixelApprox", x: 0.05, y: 0.05, rgb: BLACK },
        ],
        hints: ["float r = scene(st + off);", "float b = scene(st - off);  // 緑はそのまま"],
        solution: sh(
          "float scene(vec2 uv) {\n" +
            "  return 1.0 - step(0.25, distance(uv, vec2(0.5)));\n" +
            "}\n\n" +
            "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec2 off = vec2(0.08, 0.0);\n" +
            "  float r = scene(st + off);\n" +
            "  float g = scene(st);\n" +
            "  float b = scene(st - off);\n" +
            "  gl_FragColor = vec4(r, g, b, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-tonemap",
      title: "明るすぎる光を収める: トーンマッピング",
      explanation:
        "<p>現実の光は、画面が出せる 0〜1 をかんたんに超えます（<b>HDR</b>）。1.0 を超えた分をそのまま出すと" +
        "白に張り付いて（クリップして）、色も明るさの差も消えてしまいます。<b>トーンマッピング</b>は、" +
        "0〜∞ の明るさを 0〜1 に押し縮める変換です。いちばん簡単な <b>Reinhard</b> は " +
        "<code>col / (1.0 + col)</code>。暗い所はほぼそのまま、明るい所ほど強く縮むので、白く飛ばずに済みます。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  // 右へ行くほど強くなるオレンジの光。右端では 1.0 の 8倍（HDR）\n" +
            "  vec3 hdr = vec3(1.0, 0.6, 0.3) * st.x * 8.0;\n" +
            "  vec3 col = hdr;\n" +
            "  gl_FragColor = vec4(col, 1.0);\n}",
        ),
        task: "col を Reinhard トーンマッピング（hdr / (1.0 + hdr)）にして、右側が白く飛ばずオレンジの濃淡が残るようにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "pixelApprox", x: 0.23, y: 0.48, rgb: [0.65, 0.53, 0.36] },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.79, 0.7, 0.54] },
          { kind: "pixelApprox", x: 0.77, y: 0.48, rgb: [0.86, 0.79, 0.65] },
        ],
        hints: [
          "vec3 col = hdr / (1.0 + hdr);",
          "1.0 + hdr のように float と vec3 を足すと、各成分に足されます",
        ],
        solution: sh(
          "void main() {\n" +
            "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
            "  vec3 hdr = vec3(1.0, 0.6, 0.3) * st.x * 8.0;\n" +
            "  vec3 col = hdr / (1.0 + hdr);\n" +
            "  gl_FragColor = vec4(col, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-gamma",
      title: "ガンマ補正: リニアから画面の色へ",
      explanation:
        "<p>シェーダーで計算する明るさ（光の足し算や <code>dot(n, L)</code>）は、光の量に比例する<b>リニア</b>な値です。" +
        "ところが画面は、受け取った値をおよそ 2.2 乗して表示するため、中間の明るさが暗く沈みます。" +
        "そこで最後に <code>pow(col, vec3(1.0 / 2.2))</code> で逆向きに持ち上げておくと、計算どおりの明るさに見えます。" +
        "これが<b>ガンマ補正</b>で、陰影のグラデーションがやわらかくなります。</p>",
      challenge: {
        starterCode: sh(
          "void main() {\n" +
            CENTRED +
            GAMMA_SPHERE +
            "  // 画面に出す直前に、ここでガンマ補正しよう\n" +
            "  gl_FragColor = vec4(col, 1.0);\n}",
        ),
        task: "画面に出す直前に col を pow(col, vec3(1.0 / 2.2)) でガンマ補正して、球の暗い側を持ち上げよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "pow" },
          // Lit side, middle and unlit side (ambient only) of the sphere, in
          // three regions so each failure names a different place; the
          // background stays black.
          { kind: "pixelApprox", x: 0.31, y: 0.69, rgb: [1, 0.73, 0.48] },
          { kind: "pixelApprox", x: 0.48, y: 0.48, rgb: [0.81, 0.59, 0.39] },
          { kind: "pixelApprox", x: 0.69, y: 0.31, rgb: [0.26, 0.19, 0.12] },
          { kind: "pixelApprox", x: 0.04, y: 0.04, rgb: BLACK },
        ],
        hints: [
          "col = pow(col, vec3(1.0 / 2.2));",
          "gl_FragColor に入れる直前に 1回だけかけます",
        ],
        solution: sh(
          "void main() {\n" +
            CENTRED +
            GAMMA_SPHERE +
            "  col = pow(col, vec3(1.0 / 2.2));\n" +
            "  gl_FragColor = vec4(col, 1.0);\n}",
        ),
      },
    },
    {
      id: "glsl-linear-mix",
      title: "にごらないグラデーション: リニアで混ぜる",
      explanation:
        "<p>前のレッスンのとおり、画面の色の値は光の量に比例していません。その値のまま <code>mix</code> すると、" +
        "赤と緑のまん中がおよそ <code>(0.55, 0.55, 0.1)</code> になり、光としては暗すぎる、にごった色になります。" +
        "光として正しく混ぜるには、<code>pow(色, vec3(2.2))</code> で<b>リニア</b>な値に直してから <code>mix</code> し、" +
        "最後に <code>pow(…, vec3(1.0 / 2.2))</code> で画面の色に戻します。下半分の見本と比べると、まん中が明るく" +
        "澄んだ黄色になります。</p>",
      challenge: {
        starterCode: sh(linearMixMain("    // 上半分: ここをリニアで混ぜよう\n    col = mix(a, b, st.x);\n")),
        task: "上半分は、a と b を pow(…, vec3(2.2)) でリニアに直してから mix し、pow(…, vec3(1.0 / 2.2)) で画面の色に戻そう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "pow" },
          // The top half mixed as light: the middle is about 0.73 per channel
          // instead of the muddy 0.55 of the bottom half. The endpoints are
          // not pure 0/1, so decoding them matters: gamma-correcting only the
          // mixed result lifts the blue channel to 0.35 and fails.
          { kind: "pixelApprox", x: 0.27, y: 0.73, rgb: [0.87, 0.56, 0.1] },
          { kind: "pixelApprox", x: 0.48, y: 0.73, rgb: [0.74, 0.72, 0.1] },
          { kind: "pixelApprox", x: 0.73, y: 0.73, rgb: [0.56, 0.87, 0.1] },
        ],
        hints: [
          "vec3 la = pow(a, vec3(2.2));  vec3 lb = pow(b, vec3(2.2));  // リニアに直す",
          "col = pow(mix(la, lb, st.x), vec3(1.0 / 2.2));  // リニアで混ぜて、画面の色に戻す",
        ],
        solution: sh(
          linearMixMain(
            "    vec3 la = pow(a, vec3(2.2));  // 画面の色 → リニア\n" +
              "    vec3 lb = pow(b, vec3(2.2));\n" +
              "    col = pow(mix(la, lb, st.x), vec3(1.0 / 2.2));  // リニアで混ぜて、画面の色に戻す\n",
          ),
        ),
      },
    },
    {
      id: "glsl-dither",
      title: "2色で濃淡を出す: ディザリング",
      explanation:
        "<p>色が 2つしか使えなくても、明るい色の点の<b>混み具合</b>で濃淡を表せます（昔の携帯ゲーム機や新聞の写真の手法）。" +
        "マスごとに 0〜1 の<b>しきい値</b>を決めておき、明るさ <code>gray</code> がしきい値以上なら明るい色、未満なら暗い色に" +
        "します。しきい値を規則正しく散らした表が<b>ベイヤー行列</b>（ここでは <code>bayer4</code>）で、明るい所ほど多くの" +
        "マスが明るい色になります。<code>step(edge, x)</code> は <code>x</code> が <code>edge</code> 以上で 1 なので、" +
        "そのまま使えます。</p>",
      challenge: {
        starterCode: sh(
          BAYER_FN +
            ditherMain(
              "  // ここで gray としきい値 bayer4 を比べて、0 か 1 にしよう（いまは中間の値のまま）\n" +
                "  float c = gray;\n",
            ),
        ),
        task: "c を step(bayer4(cell), gray) にして、グラデーションを 2色の点の混み具合で表そう。",
        validators: [
          { kind: "compiles" },
          // bayer4 is declared above main(), so require the call inside it.
          { kind: "sourceMatches", pattern: "main[\\s\\S]*bayer4\\s*\\(" },
          { kind: "gradient", axis: "x", dir: "up" },
          // Neighbouring cells in the middle of the ramp: each is exactly one
          // of the two colours, light or dark as the Bayer threshold decides
          // (|gray − threshold| ≥ 0.018 at every sampled pixel).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.479, y: 0.479, rgb: DITHER_LIGHT },
              { kind: "pixelApprox", x: 0.521, y: 0.479, rgb: DITHER_DARK },
              { kind: "pixelApprox", x: 0.479, y: 0.521, rgb: DITHER_DARK },
              { kind: "pixelApprox", x: 0.521, y: 0.521, rgb: DITHER_LIGHT },
              { kind: "pixelApprox", x: 0.354, y: 0.5625, rgb: DITHER_LIGHT },
              { kind: "pixelApprox", x: 0.396, y: 0.5625, rgb: DITHER_DARK },
            ],
            message:
              "まだ中間の色が残っています。gray と bayer4(cell) を step で比べて、暗い色か明るい色のどちらかにしましょう",
          },
        ],
        hints: [
          "float c = step(bayer4(cell), gray);",
          "gray がしきい値以上のマスだけが 1（明るい色）になります",
        ],
        solution: sh(BAYER_FN + ditherMain("  float c = step(bayer4(cell), gray);  // しきい値以上なら 1、未満なら 0\n")),
      },
    },
  ],
};
