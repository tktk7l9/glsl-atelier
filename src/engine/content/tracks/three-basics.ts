// The three-basics track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { SKY_BLUE } from "./shared-three.js";

/** The background lesson: a knot coloured by its normals. */
const KNOT_SCENE =
  "// 面の向きで色が変わる結び目\n" +
  "const knot = new THREE.Mesh(\n" +
  "  new THREE.TorusKnotGeometry(0.9, 0.3, 128, 24),\n" +
  "  new THREE.MeshNormalMaterial(),\n" +
  ");\n" +
  "scene.add(knot);\n";

export const track: Track = {
  id: "three-basics",
  domain: "three",
  title: "シーンの基本",
  summary: "ジオメトリ＋マテリアル＝メッシュ。scene に追加して描画する。",
  icon: "🧊",
  lessons: [
    {
      id: "three-first-mesh",
      title: "はじめてのメッシュ",
      explanation:
        "<p>Three.js では <b>ジオメトリ</b>（形）と <b>マテリアル</b>（見た目）を組み合わせて " +
        "<code>Mesh</code> を作り、<code>scene.add()</code> でシーンに追加します。" +
        "<code>MeshBasicMaterial</code> は光がなくても見えるマテリアルです。</p>",
      mdnPath: "/ja/docs/Web/API/WebGL_API",
      challenge: {
        starterCode:
          "// 立方体のジオメトリと基本マテリアルを用意しました\n" +
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n\n" +
          "// ここで Mesh を作り、scene に追加しよう\n",
        task: "geo と mat から Mesh を作って scene に追加しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "new THREE\\.Mesh" },
          { kind: "sourceMatches", pattern: "scene\\.add" },
          { kind: "sceneHas", type: "Mesh" },
          { kind: "rendersNonEmpty" },
        ],
        hints: ["const cube = new THREE.Mesh(geo, mat);", "scene.add(cube);"],
        solution:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n",
      },
    },
    {
      id: "three-color",
      title: "マテリアルの色",
      explanation:
        "<p>マテリアルの <code>color</code> で見た目の色を決めます。CSS と同じ色名や 16進数が使えます。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'white' });\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n",
        task: "立方体の色を赤(red)にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sceneHas", type: "Mesh" },
          { kind: "colorApprox", rgb: [1, 0, 0] },
        ],
        hints: ["color: 'red' に変えます", "MeshBasicMaterial({ color: 'red' })"],
        solution:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'red' });\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n",
      },
    },
    {
      id: "three-position",
      title: "位置を動かす",
      explanation:
        "<p>オブジェクトの <code>position</code> は <code>x, y, z</code> を持つベクトルです。" +
        "<code>mesh.position.x = 2</code> のように動かせます。</p>",
      challenge: {
        starterCode:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'red' });\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n\n" +
          "// 立方体を右へ動かそう\n",
        task: "立方体を x = 2 へ動かそう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "position" },
          { kind: "objectAt", position: [2, 0, 0] },
        ],
        hints: ["cube.position.x = 2;", "x がプラスで右へ動きます"],
        solution:
          "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
          "const mat = new THREE.MeshBasicMaterial({ color: 'red' });\n" +
          "const cube = new THREE.Mesh(geo, mat);\n" +
          "scene.add(cube);\n" +
          "cube.position.x = 2;\n",
      },
    },
    {
      id: "three-background",
      title: "背景の色: scene.background",
      explanation:
        "<p>何も描かれていない場所の色は <code>scene.background</code> で決めます。<code>new THREE.Color('lightblue')</code> のように " +
        "<b>Color</b> を入れるのがポイントで、色の文字列をそのまま入れても無視されます（画像のテクスチャを入れて背景にすることもできます）。" +
        "<code>renderer.setClearColor(色)</code> で描画前の塗りつぶしの色を変えても同じように見えますが、シーンごとに背景を持たせるなら " +
        "<code>scene.background</code> です。</p>",
      challenge: {
        starterCode: KNOT_SCENE + "\n// ここで、背景を空の色 'lightblue' にしよう\n",
        task: "scene.background を THREE.Color の 'lightblue' にして、結び目の後ろを空の色にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "scene\\.background|setClearColor" },
          { kind: "sceneHas", type: "Mesh" },
          // The sky above and below the knot (a string left in
          // scene.background changes nothing, so the dark clear colour stays).
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.03,
            rgb: SKY_BLUE,
            tol: 0.1,
            message: "背景がまだ暗いままです。scene.background に new THREE.Color('lightblue') を入れましょう（文字列のままでは効きません）",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.97, rgb: SKY_BLUE, tol: 0.1 },
          { kind: "rendersNonEmpty" },
        ],
        hints: [
          "scene.background = new THREE.Color('lightblue');",
          "文字列 'lightblue' をそのまま入れても変わりません。THREE.Color にしましょう",
        ],
        solution: KNOT_SCENE + "scene.background = new THREE.Color('lightblue');\n",
      },
    },
  ],
};
