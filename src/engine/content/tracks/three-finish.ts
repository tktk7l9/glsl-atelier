// The three-finish track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The tone-mapping lesson: a ball under a light far too strong for the screen. */
const BRIGHT_BALL =
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.6, 64, 32),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'orange' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "const sun = new THREE.DirectionalLight(0xffffff, 12);  // 画面に収まらないほど強い光\n" +
  "sun.position.set(0, 0, 5);\n" +
  "scene.add(sun);\n";

/** The environment lesson: a picture of the surroundings, ground on the lower
 *  half and sky on the upper (row 0 is the bottom), and a mirror-like ball.
 *  It is 64×32 because three r186's environment shader fails to compile for a
 *  picture only a few pixels tall. */
const SURROUNDINGS =
  "// まわりの景色の画像（下半分: 土の色、上半分: 空の色）\n" +
  "const data = new Uint8Array(64 * 32 * 4);\n" +
  "for (let i = 0; i < 64 * 32; i++) {\n" +
  "  const sky = i >= 64 * 16;\n" +
  "  data.set(sky ? [90, 170, 255, 255] : [120, 70, 30, 255], i * 4);\n" +
  "}\n" +
  "const tex = new THREE.DataTexture(data, 64, 32);\n" +
  "tex.needsUpdate = true;\n";

const METAL_BALL =
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.6, 64, 32),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'white', metalness: 1, roughness: 0.2 }),\n" +
  ");\n" +
  "scene.add(ball);\n";

/** The clear-coat lesson: a matte red ball and a small, strong light in front. */
const coatedBall = (material: string): string =>
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.6, 64, 32),\n" +
  `  new THREE.${material},\n` +
  ");\n" +
  "scene.add(ball);\n\n" +
  "const lamp = new THREE.DirectionalLight(0xffffff, 8);\n" +
  "lamp.position.set(0, 2, 5);\n" +
  "scene.add(lamp);\n" +
  "scene.add(new THREE.AmbientLight(0xffffff, 0.3));\n";

export const track: Track = {
  id: "three-finish",
  domain: "three",
  title: "映りと仕上げ",
  summary: "明るすぎる光をトーンマッピングで画面に収め、scene.environment でまわりの景色を映しこみ、クリアコートで塗装のつやを足す。",
  icon: "🪩",
  lessons: [
    {
      id: "three-tone-mapping",
      title: "光を画面に収める: toneMapping",
      explanation:
        "<p>GLSL の「トーンマッピング」のレッスンで自分で書いた変換は、Three.js ではレンダラーの設定 1つで使えます。" +
        "<code>renderer.toneMapping</code> に <code>THREE.ACESFilmicToneMapping</code> のような方式を入れると、1.0 を超えた光も白く飛ばずに画面へ収まります。" +
        "<code>renderer.toneMappingExposure</code> は全体の露出で、初期値は 1 です。方式はほかに <code>AgXToneMapping</code>、" +
        "<code>NeutralToneMapping</code> などがあり、初期値の <code>NoToneMapping</code> では何も変換しません。" +
        "この変換は画面に描くときだけかかり、render target に描くときはかかりません。</p>",
      challenge: {
        starterCode: "// いまは強い光で、球の真ん中が同じ色に張りついている\n" + BRIGHT_BALL,
        task: "renderer.toneMapping を THREE.ACESFilmicToneMapping にして、renderer.toneMappingExposure を 0.5 にし、球の中心が飛ばないようにしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "ACESFilmicToneMapping" },
          { kind: "sourceMatches", pattern: "toneMappingExposure" },
          { kind: "materialOf", material: "MeshStandardMaterial" },
          {
            kind: "pixelApprox",
            x: 0.5208,
            y: 0.5208,
            rgb: [0.97, 0.85, 0.42],
            tol: 0.1,
            message: "球の中心の明るさが目標と違います。renderer.toneMapping = THREE.ACESFilmicToneMapping; と renderer.toneMappingExposure = 0.5; を書きましょう",
          },
        ],
        hints: [
          "renderer.toneMapping = THREE.ACESFilmicToneMapping;",
          "renderer.toneMappingExposure = 0.5;",
        ],
        solution:
          BRIGHT_BALL + "\nrenderer.toneMapping = THREE.ACESFilmicToneMapping;\nrenderer.toneMappingExposure = 0.5;\n",
      },
    },
    {
      id: "three-environment",
      title: "まわりを映す: scene.environment",
      explanation:
        "<p>金属は、光を自分の色で散らさず、まわりの景色を映します。だから <code>metalness: 1</code> の球は、普通のライトだけでは黒く見えます。" +
        "<code>scene.environment</code> に景色の画像を入れると、シーンじゅうの <code>MeshStandardMaterial</code> と <code>MeshPhysicalMaterial</code> が" +
        "それを光として受け取り、映りこみが生まれます。" +
        "画像は 360° を 1枚に広げた形（正距円筒図法）として扱うので、<code>tex.mapping = THREE.EquirectangularReflectionMapping</code> を指定します。" +
        "ふだんは HDR の写真を読みこみますが、ここではコードで作った上下 2色の画像で空と地面を表します。<code>roughness</code> が小さいほど、映りこみがくっきりします。</p>",
      challenge: {
        starterCode:
          SURROUNDINGS +
          "tex.magFilter = THREE.LinearFilter;\n\n" +
          "// ここで tex を 360° の景色として指定し、scene.environment に入れよう\n\n" +
          METAL_BALL,
        task: "tex.mapping を THREE.EquirectangularReflectionMapping にして、scene.environment に tex を入れ、金属の球に空と地面を映そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "EquirectangularReflectionMapping" },
          { kind: "sourceMatches", pattern: "scene\\.environment" },
          { kind: "materialOf", material: "MeshStandardMaterial" },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.6875, rgb: [0.63, 0.84, 1], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: [0.71, 0.56, 0.38], tol: 0.2 },
            ],
            message: "球に景色が映っていません。tex.mapping = THREE.EquirectangularReflectionMapping; と scene.environment = tex; を書きましょう（上が空の色、下が地面の色になります）",
          },
        ],
        hints: ["tex.mapping = THREE.EquirectangularReflectionMapping;", "scene.environment = tex;"],
        solution:
          SURROUNDINGS +
          "tex.magFilter = THREE.LinearFilter;\n" +
          "tex.mapping = THREE.EquirectangularReflectionMapping;  // 360° の景色として扱う\n" +
          "scene.environment = tex;\n\n" +
          METAL_BALL,
      },
    },
    {
      id: "three-clearcoat",
      title: "塗装のつや: clearcoat",
      explanation:
        "<p><code>MeshPhysicalMaterial</code> は <code>MeshStandardMaterial</code> の上位版で、現実の素材に近い層を足せます。" +
        "<code>clearcoat</code>（0〜1）は、車の塗装やニスのように、表面にかぶせた透明な層の強さです。下の素材がざらざらでも、" +
        "透明な層は <code>clearcoatRoughness</code> の値でつやを持つので、下の色の上につやのあるハイライトが乗ります。" +
        "ほかにも、光を透かす <code>transmission</code>、布のような光沢の <code>sheen</code> などがあります。計算が増えるので、必要な物にだけ使います。</p>",
      challenge: {
        starterCode: "// ざらざらの赤い球（つやが無い）\n" + coatedBall("MeshStandardMaterial({ color: 'darkred', roughness: 0.9 })"),
        task: "マテリアルを MeshPhysicalMaterial に変え、clearcoat: 1 と clearcoatRoughness: 0.3 を足して、球につやのあるハイライトを乗せよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "clearcoat\\s*:" },
          { kind: "materialOf", material: "MeshPhysicalMaterial" },
          // The highlight, averaged over a sample cell, lifts the red towards
          // white; below it the base colour stays as it was.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5625, rgb: [0.93, 0.52, 0.52], tol: 0.2 },
              { kind: "pixelApprox", x: 0.5208, y: 0.3125, rgb: [0.64, 0.17, 0.17], tol: 0.1 },
            ],
            message: "ハイライトが目標と違います。MeshPhysicalMaterial に clearcoat: 1, clearcoatRoughness: 0.3 を指定しましょう（下の赤い色はそのままで、光の当たる所だけ白っぽく光ります）",
          },
        ],
        hints: [
          "new THREE.MeshPhysicalMaterial({ color: 'darkred', roughness: 0.9, clearcoat: 1, clearcoatRoughness: 0.3 })",
          "clearcoatRoughness を大きくすると、ハイライトがぼやけます",
        ],
        solution: coatedBall(
          "MeshPhysicalMaterial({ color: 'darkred', roughness: 0.9, clearcoat: 1, clearcoatRoughness: 0.3 })",
        ),
      },
    },
  ],
};
