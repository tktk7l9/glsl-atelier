// The glsl-filter track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import type { ValidatorSpec } from "../../validate/primitives.js";
import { HILL, PICTURE_FN, SUN, filterMain, sh } from "./shared-glsl.js";

/** The mosaic lesson reads the picture at a coordinate `coarse` derives from `st`. */
const mosaicMain = (coarse: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  coarse +
  "  vec3 col = picture(uv);\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The sun at half brightness: a dark scanline across it. */
const SUN_DARK: [number, number, number] = [0.475, 0.45, 0.225];

/**
 * The scanline checks, in the sun (x = 0.6875, where it spans the sample
 * rows 13–19). The sampled pixel rows 72, 82, 88 and 98 are 0, 2, 0 and 2
 * modulo 4, so with dark lines on the lower two rows of each four, rows 82
 * and 98 keep the sun's colour and rows 72 and 88 are half as bright; the
 * opposite phase is the same picture shifted by two pixels and is accepted
 * as well. A 2 px period, an 8 px period, vertical lines or darkening
 * everything make all four rows the same.
 */
function scanlineChecks(): ValidatorSpec {
  const at = (y: number, rgb: [number, number, number], tol: number): ValidatorSpec => ({
    kind: "pixelApprox",
    x: 0.6875,
    y,
    rgb,
    tol,
  });
  const phase = (bright: readonly number[], dark: readonly number[]): ValidatorSpec => ({
    kind: "allOf",
    of: [...bright.map((y) => at(y, SUN, 0.12)), ...dark.map((y) => at(y, SUN_DARK, 0.2))],
  });
  return {
    kind: "anyOf",
    of: [phase([0.6458, 0.7708], [0.5625, 0.6875]), phase([0.5625, 0.6875], [0.6458, 0.7708])],
    message:
      "走査線が 4 ピクセルごとの 2行ずつになっていません。mod(gl_FragCoord.y, 4.0) を step(2.0, …) で 0 と 1 に分け、0 の行だけ半分の明るさにしましょう",
  };
}

export const track: Track = {
  id: "glsl-filter",
  domain: "glsl",
  title: "フィルタで加工する",
  summary: "白黒・セピア・階調落とし・モザイク・走査線。元の絵を返す関数にひと手間かけて、写真アプリのフィルタのように仕上げる。",
  icon: "🎞️",
  lessons: [
    {
      id: "glsl-grayscale",
      title: "白黒にする: 輝度",
      explanation:
        "<p>白黒写真のように色を消すには、R・G・B を 1つの<b>明るさ</b>にまとめて、3つの成分すべてにその値を入れます。ただし 3つの平均ではありません。" +
        "人の目は緑をいちばん明るく、青をいちばん暗く感じるので、<b>輝度</b>（luminance）は " +
        "<code>dot(col, vec3(0.2126, 0.7152, 0.0722))</code> のように重みをつけて足します（重みの合計は 1）。" +
        "<code>dot</code> は成分ごとの掛け算の合計を返すので、重みつきの足し算がひと息で書けます。</p>",
      challenge: {
        starterCode: sh(PICTURE_FN + filterMain("  // ここで、col の輝度 lum を求めて、col を vec3(lum) にしよう\n")),
        task: "col の輝度 lum を dot(col, vec3(0.2126, 0.7152, 0.0722)) で求め、col = vec3(lum) にして絵を白黒にしよう。",
        validators: [
          { kind: "compiles" },
          // The sun, the hill and the sky at their weighted luminance (tol 0.1):
          // the plain average misses the sun by 0.19, a single channel misses
          // the hill, and heavier weights overshoot the sky. Rec.601 weights
          // (0.299, 0.587, 0.114) land within 0.06 everywhere and pass.
          {
            kind: "pixelApprox",
            x: 0.6875,
            y: 0.6875,
            rgb: [0.88, 0.88, 0.88],
            tol: 0.1,
            message: "太陽の明るさが目標と違います。3つの平均ではなく、緑を重く・青を軽く（0.2126, 0.7152, 0.0722）足しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1042,
            y: 0.1042,
            rgb: [0.32, 0.32, 0.32],
            tol: 0.1,
            message: "丘の明るさが目標と違います。R・G・B の 3つすべてを重みつきで足し、3つの成分に同じ値を入れましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1875,
            y: 0.9375,
            rgb: [0.78, 0.78, 0.78],
            tol: 0.1,
            message: "空の明るさが目標と違います。重みの合計が 1 になる係数（0.2126, 0.7152, 0.0722）を使いましょう",
          },
        ],
        hints: ["float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));", "col = vec3(lum);  // 3つの成分に同じ値"],
        solution: sh(
          PICTURE_FN +
            filterMain(
              "  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));  // 輝度: 緑を重く、青を軽く\n" +
                "  col = vec3(lum);\n",
            ),
        ),
      },
    },
    {
      id: "glsl-sepia",
      title: "セピア調: 色の行列",
      explanation:
        "<p>古い写真のような<b>セピア調</b>は、R・G・B のそれぞれを「元の 3色の重みつきの和」で作り直します。出力の R は " +
        "<code>0.393 R + 0.769 G + 0.189 B</code>、G は <code>0.349 R + 0.686 G + 0.168 B</code>、B は " +
        "<code>0.272 R + 0.534 G + 0.131 B</code>。こういう「3つの入力から 3つの出力を作る重みの表」が <b>3×3 の行列</b>（<code>mat3</code>）で、" +
        "<code>m * col</code> と掛けるだけで 3本の式が一度に計算できます。GLSL の <code>mat3(…)</code> は数字を<b>列ごと</b>（縦に）読むので、" +
        "1列目には R の係数 <code>0.393, 0.349, 0.272</code> を並べます。</p>",
      challenge: {
        starterCode: sh(PICTURE_FN + filterMain("  // ここで、セピアの行列 m を作って col に掛けよう\n")),
        task: "セピアの係数を mat3 に列ごとに並べ、col = m * col で絵をセピア調にしよう。",
        validators: [
          { kind: "compiles" },
          // The sun, the hill and the sky in sepia (tol 0.1). A transposed
          // matrix misses the hill by 0.24; a tinted or plain grey misses the
          // sun and the sky by 0.19 or more.
          {
            kind: "pixelApprox",
            x: 0.6875,
            y: 0.6875,
            rgb: [1, 1, 0.8],
            tol: 0.1,
            message: "太陽の色が目標と違います。R・G・B のそれぞれを、元の 3色の重みつきの和で作り直しましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1042,
            y: 0.1042,
            rgb: [0.38, 0.33, 0.26],
            tol: 0.1,
            message: "丘の色が目標と違います。mat3 は数字を列ごとに読むので、1列目に R の係数 0.393, 0.349, 0.272 を並べましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1875,
            y: 0.8542,
            rgb: [0.98, 0.88, 0.68],
            tol: 0.1,
            message: "空の色が目標と違います。係数は表のとおり（出力の R は 0.393 R + 0.769 G + 0.189 B …）にしましょう",
          },
        ],
        hints: [
          "mat3 m = mat3(0.393, 0.349, 0.272,  0.769, 0.686, 0.534,  0.189, 0.168, 0.131);  // 列ごと",
          "col = m * col;",
        ],
        solution: sh(
          PICTURE_FN +
            filterMain(
              "  // 列ごと: 1列目が R の係数、2列目が G の係数、3列目が B の係数\n" +
                "  mat3 m = mat3(\n" +
                "    0.393, 0.349, 0.272,\n" +
                "    0.769, 0.686, 0.534,\n" +
                "    0.189, 0.168, 0.131\n" +
                "  );\n" +
                "  col = m * col;\n",
            ),
        ),
      },
    },
    {
      id: "glsl-posterize",
      title: "階調を減らす: ポスタリゼーション",
      explanation:
        "<p>色の値を<b>決まった段階</b>に丸めると、版画やポスターのようなべた塗りの絵になります（<b>ポスタリゼーション</b>）。" +
        "0〜1 の値を 4倍して <code>floor</code> で切り捨て、4 で割り戻すと、<code>0, 0.25, 0.5, 0.75</code> の 4段階だけになります。" +
        "<code>floor(col * 4.0) / 4.0</code> と vec3 のまま書けば R・G・B のそれぞれが 4段階になり、色の組み合わせは 4×4×4 = 64色です。</p>",
      challenge: {
        starterCode: sh(PICTURE_FN + filterMain("  // ここで、col を 4段階に丸めよう\n")),
        task: "col を floor(col * 4.0) / 4.0 にして、R・G・B をそれぞれ 4段階に減らそう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "floor" },
          // The sun, the hill and the sky at their 4-level values (tol 0.1):
          // 8 levels miss the sun by 0.22, round / ceil / 2 levels by 0.43,
          // and levels on the luminance alone miss the sky by 0.35.
          {
            kind: "pixelApprox",
            x: 0.6875,
            y: 0.6875,
            rgb: [0.75, 0.75, 0.25],
            tol: 0.1,
            message: "太陽の色が 4段階に丸まっていません。floor で切り捨ててから 4 で割り戻し、0・0.25・0.5・0.75 のどれかにしましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1042,
            y: 0.1042,
            rgb: [0, 0.25, 0],
            tol: 0.1,
            message: "丘の色が目標と違います。round や ceil ではなく、floor で切り捨てましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.1875,
            y: 0.5,
            rgb: [0.25, 0.5, 0.75],
            tol: 0.1,
            message: "空の色が目標と違います。輝度ではなく、R・G・B のそれぞれを 4段階にしましょう",
          },
        ],
        hints: ["col = floor(col * 4.0) / 4.0;", "4.0 を変えると段階の数が変わります（2.0 なら 2段階）"],
        solution: sh(PICTURE_FN + filterMain("  col = floor(col * 4.0) / 4.0;  // 0, 0.25, 0.5, 0.75 の 4段階に\n")),
      },
    },
    {
      id: "glsl-mosaic",
      title: "モザイク: 座標を粗くする",
      explanation:
        "<p><b>モザイク</b>は、画面をマスに区切って、マスの中を 1色で塗りつぶすエフェクトです。絵を読む<b>座標のほうを粗くする</b>と作れます。" +
        "<code>floor(st * 8.0) / 8.0</code> は、座標を 8倍して整数に切り捨て、8 で割って 0〜1 に戻すので、同じマスの中のピクセルはみな、" +
        "マスの左下の同じ座標になります。その座標で <code>picture</code> を読めば、マスごとに 1色です。マスの中心の色にしたければ、" +
        "切り捨てたあとに 0.5 を足してから 8 で割ります。</p>",
      challenge: {
        starterCode: sh(
          PICTURE_FN +
            mosaicMain("  // ここで、st を 8×8 のマスごとに同じ座標 uv にまとめよう\n  vec2 uv = st;\n"),
        ),
        task: "座標 uv を floor(st * 8.0) / 8.0 にして、絵を 8×8 のマスのモザイクにしよう。",
        validators: [
          { kind: "compiles" },
          { kind: "sourceMatches", pattern: "floor" },
          // Every 1/8 cell one flat colour (6 cells, round, fract or a mosaic
          // along x alone leave cells that straddle two colours)…
          {
            kind: "cellsFlat",
            cells: 8,
            message: "マスの中で色が変わっています。floor(st * 8.0) / 8.0 で、同じマスのピクセルが同じ座標から絵を読むようにしましょう",
          },
          // …and still the picture: a hill cell, a sun cell and a sky cell,
          // read at the cell's corner (or its centre, 0.05 away in the sky).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.0625, y: 0.3542, rgb: HILL, tol: 0.12 },
              { kind: "pixelApprox", x: 0.6458, y: 0.8542, rgb: SUN, tol: 0.12 },
              { kind: "pixelApprox", x: 0.3125, y: 0.5625, rgb: [0.38, 0.58, 0.85], tol: 0.12 },
            ],
            message: "絵が変わってしまっています。粗くした座標を 8 で割って 0〜1 に戻してから picture に渡しましょう",
          },
        ],
        hints: ["vec2 uv = floor(st * 8.0) / 8.0;", "8.0 を大きくするとマスが細かくなります"],
        solution: sh(
          PICTURE_FN + mosaicMain("  vec2 uv = floor(st * 8.0) / 8.0;  // マスの左下の座標（マスの中はみな同じ）\n"),
        ),
      },
    },
    {
      id: "glsl-scanlines",
      title: "走査線: CRT 風",
      explanation:
        "<p>昔のブラウン管テレビ（CRT）は画面を横の<b>走査線</b>で描いていたので、細い横じまが見えました。それを再現するには、ピクセルの座標 " +
        "<code>gl_FragCoord.y</code> をそのまま使います。<code>mod(gl_FragCoord.y, 4.0)</code> は 0, 1, 2, 3 をくり返すので、" +
        "<code>step(2.0, …)</code> で下の 2行を 0、上の 2行を 1 にできます。0 の行だけ色を半分に暗くすれば、4 ピクセルごとの横じまです。" +
        "0〜1 の <code>st</code> ではなくピクセル座標を使うのは、画面の大きさに関係なく、じまをつねに 2 ピクセル幅にするためです。</p>",
      challenge: {
        starterCode: sh(
          PICTURE_FN + filterMain("  // ここで、gl_FragCoord.y から 4行ごとに 0 と 1 がくり返す line を作り、0 の行の col を暗くしよう\n"),
        ),
        task: "mod(gl_FragCoord.y, 4.0) から 4行ごとに 0 と 1 がくり返す line を作り、0 の行の col を半分に暗くして、CRT 風の走査線を入れよう。",
        validators: [{ kind: "compiles" }, scanlineChecks()],
        hints: [
          "float line = step(2.0, mod(gl_FragCoord.y, 4.0));",
          "col *= mix(0.5, 1.0, line);  // line が 0 の行だけ半分に",
        ],
        solution: sh(
          PICTURE_FN +
            filterMain(
              "  float line = step(2.0, mod(gl_FragCoord.y, 4.0));  // 4 行ごとに、下の 2 行で 0・上の 2 行で 1\n" +
                "  col *= mix(0.5, 1.0, line);                        // 0 の行を半分の明るさに\n",
            ),
        ),
      },
    },
  ],
};
