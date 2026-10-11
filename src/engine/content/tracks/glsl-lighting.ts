// The glsl-lighting track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BLACK, CENTRED, WHITE, sh } from "./shared-glsl.js";

/** The lighting-model lessons' sphere: radius 0.75 seen head-on, a light from
 *  the upper left, the viewer straight in front. `light` sets `col` inside the
 *  sphere from the normal `n`, the light `L`, the viewer `V` and `diff`. */
const litSphere = (light: string): string =>
  "void main() {\n" +
  CENTRED +
  "  float r = 0.75;\n" +
  "  float d = length(p);\n" +
  "  vec3 col = vec3(0.0);  // 背景\n" +
  "  if (d < r) {\n" +
  "    vec3 n = normalize(vec3(p, sqrt(r * r - d * d)));  // 球の面の向き（法線）\n" +
  "    vec3 L = normalize(vec3(-0.6, 0.6, 0.5));          // 左上から差す光の向き\n" +
  "    vec3 V = vec3(0.0, 0.0, 1.0);                      // 目（カメラ）の向き\n" +
  "    float diff = max(dot(n, L), 0.0);                  // ランバートの拡散光\n" +
  light +
  "  }\n" +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The matte (Lambert) orange the specular and rim lessons start from. */
const MATTE = "    col = vec3(1.0, 0.55, 0.25) * (0.1 + 0.9 * diff);\n";

/** The toon lesson's colour from a brightness `level` (diff, or diff in steps). */
const toonColour = (level: string): string => `    col = vec3(1.0, 0.55, 0.25) * (0.15 + 0.85 * ${level});\n`;

/** Outside the sphere stays black. */
const BACKGROUND = { kind: "pixelApprox", x: 0.0625, y: 0.0625, rgb: BLACK } as const;

export const track: Track = {
  id: "glsl-lighting",
  domain: "glsl",
  title: "光の質感",
  summary: "ランバートの拡散光に、つやのハイライト（Blinn-Phong）、ふちの光（リムライト）、段々の陰影（トゥーン）を足して、質感を描き分ける。",
  icon: "💎",
  lessons: [
    {
      id: "glsl-specular",
      title: "つやを出す: Blinn-Phong のハイライト",
      explanation:
        "<p>ランバートの拡散光だけだと、表面はつや消しのゴムのように見えます。つるつるした表面では、光が鏡のように目へ跳ね返る所に、小さく明るい<b>ハイライト</b>" +
        "（鏡面反射）が出ます。<b>Blinn-Phong</b> では、光の向き <code>L</code> と目の向き <code>V</code> のちょうど中間の向き（<b>ハーフベクトル</b>）" +
        "<code>h = normalize(L + V)</code> を作り、法線 <code>n</code> が <code>h</code> に近いほど明るくします。<code>pow(max(dot(n, h), 0.0), 32.0)</code> の " +
        "32 は<b>つやの鋭さ</b>で、大きいほどハイライトが小さく鋭くなります。拡散光の色に白いハイライトを足すと、プラスチックのような光沢が出ます。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API/Tutorial/Lighting_in_WebGL",
      challenge: {
        starterCode: sh(
          litSphere(MATTE + "    // ここで、ハーフベクトル h から鏡面反射の強さ spec を求めて、col に白として足そう\n"),
        ),
        task: "ハーフベクトル h = normalize(L + V) を作り、spec = pow(max(dot(n, h), 0.0), 32.0) を col に白として足して、球につやのハイライトを出そう。",
        validators: [
          { kind: "compiles" },
          // The highlight sits where n points along h: at (0.35, 0.65). Where n
          // points at the light itself, or straight at the viewer, the sphere
          // stays matte, so a highlight made from L or V alone lands there.
          // Shininess 16 to 64 and Phong's reflect(-L, n) · V draw the same
          // peak; the samples keep their colour with the picture moved 0.3 px.
          {
            kind: "pixelApprox",
            x: 0.2292,
            y: 0.7292,
            rgb: [0.98, 0.54, 0.25],
            message: "ハイライトが、光の来る向きそのものに出ています。光の向き L だけでなく、L と目の向き V の中間 h = normalize(L + V) を使いましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5625,
            y: 0.4792,
            rgb: [0.43, 0.24, 0.11],
            message: "ハイライトが球のまん中寄りに出ています。目の向き V だけでなく、光の向き L との中間 h = normalize(L + V) を使いましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.3542,
            y: 0.6458,
            rgb: WHITE,
            message: "左上に白いハイライトが出ていません。spec = pow(max(dot(n, h), 0.0), 32.0) を求めて、col に vec3(spec) として足しましょう",
          },
          BACKGROUND,
        ],
        hints: ["vec3 h = normalize(L + V);  // 光と目の中間の向き", "float spec = pow(max(dot(n, h), 0.0), 32.0);\ncol += vec3(spec);"],
        solution: sh(
          litSphere(
            MATTE +
              "    vec3 h = normalize(L + V);                    // 光と目の中間の向き\n" +
              "    float spec = pow(max(dot(n, h), 0.0), 32.0);  // h に近いほど鋭く明るい\n" +
              "    col += vec3(spec);                            // 白いハイライトを足す\n",
          ),
        ),
      },
    },
    {
      id: "glsl-rim",
      title: "ふちを光らせる: リムライト",
      explanation:
        "<p>逆光の中の人物や、ゲームのキャラクターの<b>輪郭が細く光る</b>表現を<b>リムライト</b>と呼びます。球のふちでは面が目に対して横を向くので、法線 <code>n</code> と" +
        "目の向き <code>V</code> の内積 <code>dot(n, V)</code> が 0 に近くなります（正面では 1）。そこで <code>1.0 - dot(n, V)</code> を使えば、ふちほど 1 に" +
        "近い値になります。これを 3乗してふちのごく近くだけに絞り、青い光として足します。光源の向きとは関係なく、<b>見る向きだけ</b>で決まるのがポイントです" +
        "（見る角度で反射の強さが変わる<b>フレネル効果</b>の手軽な近似としてもよく使われます）。</p>",
      challenge: {
        starterCode: sh(
          litSphere(MATTE + "    // ここで、ふちほど 1 に近づく rim を dot(n, V) から求めて、青い光として col に足そう\n"),
        ),
        task: "rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) を求め、vec3(0.3, 0.6, 1.0) * rim を col に足して、球のふちを青く光らせよう。",
        validators: [
          { kind: "compiles" },
          // The middle faces the viewer and gets no rim light…
          {
            kind: "pixelApprox",
            x: 0.4792,
            y: 0.4792,
            rgb: [0.56, 0.31, 0.14],
            message: "球のまん中まで光っています。ふちだけが光るよう、dot(n, V) ではなく 1.0 - dot(n, V) を使いましょう",
          },
          // …while the edge glows blue all round, on the dark side as on the
          // lit one (samples 0.04–0.08 inside the edge, where moving the
          // picture 0.3 px changes the colour by 0.035 at most).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.8542, y: 0.4792, rgb: [0.2, 0.25, 0.35] },
              { kind: "pixelApprox", x: 0.4792, y: 0.1458, rgb: [0.2, 0.25, 0.35] },
              { kind: "pixelApprox", x: 0.1458, y: 0.4792, rgb: [0.83, 0.6, 0.51] },
            ],
            message:
              "球のふちが青く光っていません。rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) を求めて、vec3(0.3, 0.6, 1.0) * rim を col に足しましょう",
          },
          BACKGROUND,
        ],
        hints: ["float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);  // ふちほど 1 に近い", "col += vec3(0.3, 0.6, 1.0) * rim;"],
        solution: sh(
          litSphere(
            MATTE +
              "    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);  // 正面で 0、ふちほど 1 に近い\n" +
              "    col += vec3(0.3, 0.6, 1.0) * rim;                 // 青いふちの光を足す\n",
          ),
        ),
      },
    },
    {
      id: "glsl-toon",
      title: "アニメ調の陰影: トゥーンシェーディング",
      explanation:
        "<p>アニメやイラストのような陰影は、明るさをなめらかに変えずに<b>数段階のべた塗り</b>で描きます（<b>トゥーンシェーディング</b>、セルシェーディング）。" +
        "拡散光 <code>diff</code>（0〜1）を、「フィルタで加工する」のポスタリゼーションと同じく <code>floor(diff * 3.0) / 3.0</code> で 0・1/3・2/3 の 3段階に" +
        "切り捨て、それを明るさに使います。段階の境目がくっきりした線になり、セル画のような球になります。</p>",
      challenge: {
        starterCode: sh(
          litSphere(
            "    // ここで、diff を 3段階に切り捨てた level を作り、下の diff の代わりに使おう\n" + toonColour("diff"),
          ),
        ),
        task: "level = floor(diff * 3.0) / 3.0 で拡散光を 3段階に切り捨て、色の計算の diff を level に替えて、アニメ調の段々の陰影にしよう。",
        validators: [
          { kind: "compiles" },
          // One sample in each band, away from its edges (so moving the
          // picture 0.3 px keeps them in it), where the smooth shading is 0.15
          // or more away: round or ceil shift the bands, 2 levels miss the
          // middle band and 4 levels the dark one.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.2292, y: 0.6458, rgb: [0.72, 0.4, 0.18] },
              { kind: "pixelApprox", x: 0.3125, y: 0.4375, rgb: [0.43, 0.24, 0.11] },
              { kind: "pixelApprox", x: 0.2708, y: 0.3542, rgb: [0.43, 0.24, 0.11] },
              { kind: "pixelApprox", x: 0.4375, y: 0.3542, rgb: [0.15, 0.08, 0.04] },
            ],
            message:
              "陰影が 3段階（0・1/3・2/3）のべた塗りになっていません。diff を floor(diff * 3.0) / 3.0 で切り捨ててから、明るさに使いましょう（round や ceil、段階の数が違うと境目がずれます）",
          },
          BACKGROUND,
        ],
        hints: ["float level = floor(diff * 3.0) / 3.0;  // 0, 1/3, 2/3 の 3段階", "col = vec3(1.0, 0.55, 0.25) * (0.15 + 0.85 * level);"],
        solution: sh(
          litSphere(
            "    float level = floor(diff * 3.0) / 3.0;  // 0, 1/3, 2/3 の 3段階に切り捨てる\n" + toonColour("level"),
          ),
        ),
      },
    },
  ],
};
