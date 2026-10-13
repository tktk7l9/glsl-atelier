// The three-find track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The name lesson: a robot of named parts (no variables for them, as with
 *  a loaded model); `change` follows. */
const ROBOT = (change: string): string =>
  "// 名前を付けた部品で組み立てたロボット（読み込んだモデルのように、部品の変数はない）\n" +
  "const part = (name, color, w, h, x, y) => {\n" +
  "  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ color }));\n" +
  "  mesh.name = name;\n" +
  "  mesh.position.set(x, y, 0);\n" +
  "  return mesh;\n" +
  "};\n" +
  "const robot = new THREE.Group();\n" +
  "robot.add(\n" +
  "  part('body', 'steelblue', 1.4, 1.6, 0, -0.3),\n" +
  "  part('head', 'lightgray', 1.0, 0.8, 0, 0.95),\n" +
  "  part('leftArm', 'slategray', 0.35, 1.3, -0.95, -0.2),\n" +
  "  part('rightArm', 'slategray', 0.35, 1.3, 0.95, -0.2),\n" +
  ");\n" +
  "scene.add(robot);\n" +
  change;

/** The traverse lesson: three trees, each a trunk and a crown group of two
 *  meshes named 'leaves'; `change` follows. */
const FOREST = (change: string): string =>
  "// 木（幹 trunk と、葉 leaves 2段をまとめた crown）を 3本\n" +
  "const tree = (x) => {\n" +
  "  const t = new THREE.Group();\n" +
  "  t.position.x = x;\n" +
  "  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), new THREE.MeshBasicMaterial({ color: 'sienna' }));\n" +
  "  trunk.name = 'trunk';\n" +
  "  trunk.position.y = -1.1;\n" +
  "  const crown = new THREE.Group();\n" +
  "  const lower = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 24), new THREE.MeshBasicMaterial({ color: 'forestgreen' }));\n" +
  "  lower.name = 'leaves';\n" +
  "  lower.position.y = -0.1;\n" +
  "  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.0, 24), new THREE.MeshBasicMaterial({ color: 'forestgreen' }));\n" +
  "  upper.name = 'leaves';\n" +
  "  upper.position.y = 0.7;\n" +
  "  crown.add(lower, upper);\n" +
  "  t.add(trunk, crown);\n" +
  "  return t;\n" +
  "};\n" +
  "const forest = new THREE.Group();\n" +
  "forest.add(tree(-2.2), tree(0), tree(2.2));\n" +
  "scene.add(forest);\n" +
  change;

/** The shared-material lesson: three named balls on one material; `change` follows. */
const BALLS = (change: string): string =>
  "const shared = new THREE.MeshBasicMaterial({ color: 'skyblue' });  // 3つで 1つのマテリアルを共有している\n" +
  "['top', 'middle', 'bottom'].forEach((name, i) => {\n" +
  "  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), shared);\n" +
  "  ball.name = name;\n" +
  "  ball.position.y = 1.3 - i * 1.3;\n" +
  "  scene.add(ball);\n" +
  "});\n" +
  change;

const TOMATO: [number, number, number] = [1, 0.39, 0.28];
const STEELBLUE: [number, number, number] = [0.27, 0.51, 0.71];
const ORANGE: [number, number, number] = [1, 0.65, 0];
const SIENNA: [number, number, number] = [0.63, 0.32, 0.18];
const SKYBLUE: [number, number, number] = [0.53, 0.81, 0.92];
const HOTPINK: [number, number, number] = [1, 0.41, 0.71];

export const track: Track = {
  id: "three-find",
  domain: "three",
  title: "シーンの中を探して変える",
  summary: "名前で部品を探し（getObjectByName）、子孫を全部たどって変え（traverse）、共有されたマテリアルを複製して 1つだけ色を変える。",
  icon: "🔎",
  lessons: [
    {
      id: "three-find-by-name",
      title: "名前で探す: getObjectByName",
      explanation:
        "<p>読み込んだモデルは、部品ごとの変数がありません。代わりに、作った人が部品に付けた<b>名前</b>（<code>name</code>）で探します。" +
        "<code>scene.getObjectByName('head')</code> は、子・孫…と全部の子孫の中から、その名前の物を最初の 1つ見つけて返します" +
        "（見つからなければ <code>undefined</code> なので、名前の書き間違いに注意）。見つけた部品の <code>material.color.set(...)</code> で色を変えれば、" +
        "そのまま画面に反映されます。</p>",
      challenge: {
        starterCode: ROBOT("// ここで、名前が 'head' の部品を探して、色を 'tomato' にしよう\n"),
        task: "scene.getObjectByName('head') でロボットの頭を探し、material.color.set('tomato') で色を変えよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "getObjectByName|getObjectByProperty|traverse",
            message: "scene.getObjectByName('head') で、名前から部品を探しましょう",
          },
          // Up the centre line: the head, then the body below it.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: TOMATO,
            tol: 0.15,
            message: "頭の色が変わっていません。scene.getObjectByName('head') で頭を探し、その material.color.set('tomato') を呼びましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.41,
            rgb: STEELBLUE,
            tol: 0.15,
            message: "頭ではない部品まで色が変わっています。名前 'head' で探しましょう（children[0] は体です）",
          },
        ],
        hints: ["名前で探す: scene.getObjectByName('head')", "scene.getObjectByName('head').material.color.set('tomato');"],
        solution: ROBOT("scene.getObjectByName('head').material.color.set('tomato');  // 名前で探して、見つけた部品の色を変える\n"),
      },
    },
    {
      id: "three-traverse",
      title: "全部たどる: traverse",
      explanation:
        "<p>同じ名前の部品がいくつもあるときは、<code>getObjectByName</code> では最初の 1つしか見つかりません。<code>obj.traverse(fn)</code> は、" +
        "obj 自身と<b>すべての子孫</b>（子の子の…まで）について <code>fn</code> を呼ぶので、条件に合う物を全部まとめて変えられます。" +
        "<code>forest.children</code> は直接の子（3本の木）だけで、葉はその奥（木 → crown → 葉）にあるので、children をたどるだけでは届きません。" +
        "名前を確かめる <code>if (o.name === 'leaves')</code> を忘れると、幹まで変わってしまいます。</p>",
      challenge: {
        starterCode: FOREST("// ここで、forest の中の名前が 'leaves' のメッシュを全部、色 'orange' にして秋にしよう\n"),
        task: "forest.traverse で子孫を全部たどり、名前が 'leaves' のメッシュだけ material.color.set('orange') にして、3本の木を紅葉させよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "traverse", message: "forest.traverse((o) => { ... }) で、子孫を全部たどりましょう" },
          // The middle tree's two layers of leaves turn orange (the first
          // 'leaves' found by name is in the left-hand tree), its trunk stays.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: ORANGE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: ORANGE, tol: 0.15 },
            ],
            message: "葉がすべて紅葉していません。forest.traverse で子孫を全部たどり、名前が 'leaves' のものを全部オレンジにしましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.28,
            rgb: SIENNA,
            tol: 0.15,
            message: "幹の色まで変わっています。if (o.name === 'leaves') で、葉だけを変えましょう",
          },
        ],
        hints: ["forest.traverse((o) => { ... });  // 子孫を全部たどる", "if (o.name === 'leaves') o.material.color.set('orange');"],
        solution: FOREST(
          "forest.traverse((o) => {\n" +
            "  if (o.name === 'leaves') o.material.color.set('orange');  // 名前が leaves のものだけ\n" +
            "});\n",
        ),
      },
    },
    {
      id: "three-clone-material",
      title: "1つだけ色を変える: マテリアルの複製",
      explanation:
        "<p>読み込んだモデルでは、同じ見た目の部品が<b>1つのマテリアルを共有</b>していることがよくあります。共有しているマテリアルの色を変えると、" +
        "それを使っている部品が<b>全部</b>変わってしまいます。1つだけ変えたいときは、先に <code>mesh.material = mesh.material.clone()</code> で" +
        "その部品専用のコピーに差し替えてから、色を変えます（順番が逆だと、共有のほうを変えてから複製することになり、全部変わります）。</p>",
      challenge: {
        starterCode: BALLS("// ここで、名前が 'middle' のボールだけを 'hotpink' にしよう（ほかの 2つは空色のまま）\n"),
        task: "名前が 'middle' のボールを探し、material を clone() したコピーに差し替えてから、色を 'hotpink' にしよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "clone|new THREE\\.MeshBasicMaterial[\\s\\S]*new THREE\\.MeshBasicMaterial",
            message: "middle.material = middle.material.clone() で、専用のマテリアルに差し替えましょう",
          },
          // Up the centre line: the top, middle and bottom balls.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.5,
            rgb: HOTPINK,
            tol: 0.15,
            message: "まん中のボールがピンクになっていません。名前 'middle' で探して、色を 'hotpink' にしましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: SKYBLUE, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: SKYBLUE, tol: 0.15 },
            ],
            message:
              "上と下のボールまで色が変わりました。マテリアルを共有しているからです。色を変える前に middle.material = middle.material.clone() で専用のコピーにしましょう",
          },
        ],
        hints: ["const middle = scene.getObjectByName('middle');", "middle.material = middle.material.clone();  // 先に専用のコピーへ\nmiddle.material.color.set('hotpink');"],
        solution: BALLS(
          "const middle = scene.getObjectByName('middle');\n" +
            "middle.material = middle.material.clone();  // 共有をやめて、このボール専用のコピーにする\n" +
            "middle.material.color.set('hotpink');       // コピーの色だけを変える\n",
        ),
      },
    },
  ],
};
