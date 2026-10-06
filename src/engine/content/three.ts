// Three.js scene tracks. The learner writes JS with `THREE`, `scene`, `camera`
// and `renderer` in scope. The sandbox runs it in an isolated iframe, traverses
// the resulting scene graph, renders one frame, and reads it back for the
// validators. The default camera sits at (0, 0, 5) looking at the origin with a
// 60° vertical field of view; the preview can be any aspect ratio, so pixel
// checks on rendered scenes stay on the vertical centre line (x = 0.5), where
// the position depends only on the (fixed) vertical field of view.

import type { Track } from "./types.js";

/** The sandbox clear colour (#05060d) as the validators see it. */
const BACKGROUND: [number, number, number] = [0.02, 0.024, 0.051];

export const threeTracks: readonly Track[] = [
  {
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
    ],
  },
  {
    id: "three-geometry",
    domain: "three",
    title: "ジオメトリ",
    summary: "箱・球・トーラス・平面。形を差し替えて遊ぶ。",
    icon: "📐",
    lessons: [
      {
        id: "three-sphere",
        title: "球: SphereGeometry",
        explanation:
          "<p>形はジオメトリを差し替えるだけで変わります。<code>SphereGeometry(半径, 経度分割, 緯度分割)</code> で球になります。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "BoxGeometry を SphereGeometry に変えよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "SphereGeometry" },
            { kind: "geometryOf", geometry: "SphereGeometry" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const geo = new THREE.SphereGeometry(1, 32, 16);", "分割数を増やすと滑らかに"],
          solution:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
      {
        id: "three-torus",
        title: "ドーナツ: TorusGeometry",
        explanation: "<p><code>TorusGeometry(半径, 太さ, ...)</code> でドーナツ形（トーラス）になります。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "ジオメトリを TorusGeometry に変えよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "TorusGeometry" },
            { kind: "geometryOf", geometry: "TorusGeometry" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 80);", "第2引数が管の太さ"],
          solution:
            "const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 80);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
      {
        id: "three-plane",
        title: "平面: PlaneGeometry",
        explanation: "<p><code>PlaneGeometry(幅, 高さ)</code> は平らな板です。床や壁、背景に使います。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "ジオメトリを 2×2 の PlaneGeometry に変えよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "PlaneGeometry" },
            { kind: "geometryOf", geometry: "PlaneGeometry" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const geo = new THREE.PlaneGeometry(2, 2);", "カメラの方を向いた板になります"],
          solution:
            "const geo = new THREE.PlaneGeometry(2, 2);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
    ],
  },
  {
    id: "three-material",
    domain: "three",
    title: "マテリアル",
    summary: "法線マテリアルやワイヤーフレームで質感を変える。",
    icon: "🎨",
    lessons: [
      {
        id: "three-normal-material",
        title: "法線マテリアル",
        explanation:
          "<p><code>MeshNormalMaterial</code> は面の向き（法線）を RGB に変換して色付けします。" +
          "ライト不要で立体感が分かるデバッグの定番です。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'white' });\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "マテリアルを MeshNormalMaterial に変えよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "MeshNormalMaterial" },
            { kind: "materialOf", material: "MeshNormalMaterial" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const mat = new THREE.MeshNormalMaterial();", "引数は無しでOK"],
          solution:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
      {
        id: "three-wireframe",
        title: "ワイヤーフレーム",
        explanation: "<p>マテリアルに <code>wireframe: true</code> を指定すると、面ではなく線で描画されます。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 16, 12);\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'cyan' });\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "マテリアルをワイヤーフレーム表示にしよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "wireframe" },
            { kind: "materialOf", material: "MeshBasicMaterial" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["{ color: 'cyan', wireframe: true }", "true を渡すだけ"],
          solution:
            "const geo = new THREE.SphereGeometry(1, 16, 12);\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'cyan', wireframe: true });\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
      {
        id: "three-transparent",
        title: "半透明: transparent と opacity",
        explanation:
          "<p><code>opacity</code> は 0（透明）〜1（不透明）の不透明度です。ただし <b><code>transparent: true</code> も" +
          "いっしょに指定しないと無視されます</b>。半透明のオブジェクトは、不透明なものを描き終えたあとに" +
          "奥から順に描かれ、奥の色と混ざります。</p>",
        challenge: {
          starterCode:
            "// 奥の赤い板\n" +
            "const back = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'red' }),\n" +
            ");\n" +
            "back.position.z = -1;\n" +
            "scene.add(back);\n\n" +
            "// 手前の青い板（いまは不透明で、奥の板を隠している）\n" +
            "const front = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(2, 2),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'blue' }),\n" +
            ");\n" +
            "scene.add(front);\n",
          task: "手前の青い板を不透明度 0.5 の半透明にして、奥の赤い板が透けて見えるようにしよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "transparent" },
            { kind: "sourceMatches", pattern: "opacity" },
            { kind: "sceneHas", type: "Mesh", min: 2 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.5, 0, 0.5], tol: 0.2 },
          ],
          hints: [
            "new THREE.MeshBasicMaterial({ color: 'blue', transparent: true, opacity: 0.5 })",
            "opacity だけ変えても透けません。transparent: true を忘れずに",
          ],
          solution:
            "const back = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'red' }),\n" +
            ");\n" +
            "back.position.z = -1;\n" +
            "scene.add(back);\n" +
            "const front = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(2, 2),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'blue', transparent: true, opacity: 0.5 }),\n" +
            ");\n" +
            "scene.add(front);\n",
        },
      },
      {
        id: "three-shader-material",
        title: "自作シェーダー: ShaderMaterial",
        explanation:
          "<p><code>ShaderMaterial</code> を使うと、GLSL トラックで書いたようなシェーダーをメッシュに貼れます。" +
          "頂点シェーダーでは Three.js が用意する <code>projectionMatrix</code>・<code>modelViewMatrix</code>・" +
          "<code>position</code> が使えます。JS 側の値は <code>uniforms: { 名前: { value } }</code> で渡し、" +
          "GLSL 側で <code>uniform</code> として受け取ります。</p>",
        challenge: {
          starterCode:
            "const vertexShader = `\n" +
            "  void main() {\n" +
            "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
            "  }\n" +
            "`;\n" +
            "const fragmentShader = `\n" +
            "  uniform vec3 uColor;\n" +
            "  void main() {\n" +
            "    gl_FragColor = vec4(uColor, 1.0);\n" +
            "  }\n" +
            "`;\n\n" +
            "const geo = new THREE.SphereGeometry(1.5, 32, 16);\n" +
            "// ここを ShaderMaterial に変えよう\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'white' });\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
          task: "マテリアルを上の 2つのシェーダーを使う ShaderMaterial に変え、uniforms で uColor にシアン (0, 1, 1) を渡そう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "ShaderMaterial" },
            { kind: "sourceMatches", pattern: "uniforms" },
            { kind: "materialOf", material: "ShaderMaterial" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 1, 1], tol: 0.15 },
          ],
          hints: [
            "new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0, 1, 1) } }, vertexShader, fragmentShader })",
            "uniforms を渡し忘れると uColor は (0, 0, 0) ＝ 黒になります",
          ],
          solution:
            "const vertexShader = `\n" +
            "  void main() {\n" +
            "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
            "  }\n" +
            "`;\n" +
            "const fragmentShader = `\n" +
            "  uniform vec3 uColor;\n" +
            "  void main() {\n" +
            "    gl_FragColor = vec4(uColor, 1.0);\n" +
            "  }\n" +
            "`;\n" +
            "const geo = new THREE.SphereGeometry(1.5, 32, 16);\n" +
            "const mat = new THREE.ShaderMaterial({\n" +
            "  uniforms: { uColor: { value: new THREE.Color(0, 1, 1) } },\n" +
            "  vertexShader,\n" +
            "  fragmentShader,\n" +
            "});\n" +
            "const mesh = new THREE.Mesh(geo, mat);\n" +
            "scene.add(mesh);\n",
        },
      },
    ],
  },
  {
    id: "three-light",
    domain: "three",
    title: "ライティング",
    summary: "StandardMaterial は光が必要。ライトを足して照らす。",
    icon: "💡",
    lessons: [
      {
        id: "three-ambient",
        title: "環境光: AmbientLight",
        explanation:
          "<p><code>MeshStandardMaterial</code> は物理ベースで、<b>光が無いと真っ暗</b>です。" +
          "<code>AmbientLight</code> は全体を一様に照らす環境光です。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshStandardMaterial({ color: 'white' });\n" +
            "const ball = new THREE.Mesh(geo, mat);\n" +
            "scene.add(ball);\n\n" +
            "// 真っ暗なので、ライトを足して照らそう\n",
          task: "AmbientLight を追加して球を照らそう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "AmbientLight" },
            { kind: "sceneHas", type: "AmbientLight" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const light = new THREE.AmbientLight(0xffffff, 1.0);", "scene.add(light);"],
          solution:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshStandardMaterial({ color: 'white' });\n" +
            "const ball = new THREE.Mesh(geo, mat);\n" +
            "scene.add(ball);\n" +
            "const light = new THREE.AmbientLight(0xffffff, 1.0);\n" +
            "scene.add(light);\n",
        },
      },
      {
        id: "three-directional",
        title: "平行光源: DirectionalLight",
        explanation:
          "<p><code>DirectionalLight</code> は太陽のような一方向からの光。" +
          "<code>position</code> で向きが決まり、当たった面が明るくなって立体感が出ます。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshStandardMaterial({ color: 'white' });\n" +
            "const ball = new THREE.Mesh(geo, mat);\n" +
            "scene.add(ball);\n\n" +
            "// 平行光源を足して、陰影をつけよう\n",
          task: "DirectionalLight を追加して位置を設定しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "DirectionalLight" },
            { kind: "sceneHas", type: "DirectionalLight" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["const dir = new THREE.DirectionalLight(0xffffff, 1.2);", "dir.position.set(2, 3, 4);"],
          solution:
            "const geo = new THREE.SphereGeometry(1, 32, 16);\n" +
            "const mat = new THREE.MeshStandardMaterial({ color: 'white' });\n" +
            "const ball = new THREE.Mesh(geo, mat);\n" +
            "scene.add(ball);\n" +
            "const dir = new THREE.DirectionalLight(0xffffff, 1.2);\n" +
            "dir.position.set(2, 3, 4);\n" +
            "scene.add(dir);\n",
        },
      },
    ],
  },
  {
    id: "three-transform",
    domain: "three",
    title: "変形とグループ",
    summary: "拡大縮小、Group でまとめる、InstancedMesh で同じ形をたくさん描く。",
    icon: "🔧",
    lessons: [
      {
        id: "three-scale",
        title: "拡大する: scale",
        explanation: "<p><code>scale</code> は各軸の倍率。<code>mesh.scale.set(2, 2, 2)</code> で2倍の大きさになります。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n\n" +
            "// 立方体を2倍に大きくしよう\n",
          task: "立方体を全方向に2倍へ拡大しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "scale" },
            { kind: "sceneHas", type: "Mesh" },
            { kind: "scaleApprox", scale: [2, 2, 2], type: "Mesh" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["cube.scale.set(2, 2, 2);", "1.0 が等倍、2.0 で2倍"],
          solution:
            "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n" +
            "cube.scale.set(2, 2, 2);\n",
        },
      },
      {
        id: "three-group",
        title: "まとめる: Group",
        explanation:
          "<p><code>Group</code> は複数オブジェクトの入れ物。Group を動かすと中身がまとめて動きます。</p>",
        challenge: {
          starterCode:
            "// Group を作り、2つの立方体を入れて scene に追加しよう\n" +
            "const group = new THREE.Group();\n\n",
          task: "Group の中に Mesh を2つ入れて scene に追加しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "Group" },
            { kind: "sceneHas", type: "Group" },
            { kind: "sceneHas", type: "Mesh", min: 2 },
            { kind: "rendersNonEmpty" },
          ],
          hints: [
            "const a = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshNormalMaterial());",
            "group.add(a, b); scene.add(group);",
          ],
          solution:
            "const group = new THREE.Group();\n" +
            "const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());\n" +
            "const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());\n" +
            "a.position.x = -1;\n" +
            "b.position.x = 1;\n" +
            "group.add(a, b);\n" +
            "scene.add(group);\n",
        },
      },
      {
        id: "three-instanced",
        title: "大量に並べる: InstancedMesh",
        explanation:
          "<p>同じ形を何百個も置くなら、Mesh を増やすより <code>InstancedMesh(geo, mat, 個数)</code> が" +
          "軽くて速い（1回の描画命令でまとめて描く）。各コピーの位置・回転・大きさは " +
          "<code>Matrix4</code> で表し、<code>setMatrixAt(番号, 行列)</code> で渡します。" +
          "<code>m.setPosition(x, y, z)</code> で行列の位置だけを書き換えられます。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n\n" +
            "// 同じ板を 5枚まとめて描く InstancedMesh（いまは 5枚とも原点に重なっている）\n" +
            "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
            "scene.add(rungs);\n\n" +
            "const m = new THREE.Matrix4();\n" +
            "for (let i = 0; i < 5; i++) {\n" +
            "  // i 番目の板を y = i - 2 の高さに置こう\n" +
            "}\n",
          task: "ループの中で i 番目の板を y = i - 2 の高さに置いて、はしごのように 5枚並べよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "setMatrixAt" },
            { kind: "instanced", min: 5 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.65, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.66, rgb: [1, 0.65, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: [1, 0.65, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [1, 0.65, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: [1, 0.65, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: BACKGROUND, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: ["m.setPosition(0, i - 2, 0);", "rungs.setMatrixAt(i, m);"],
          solution:
            "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
            "const mat = new THREE.MeshBasicMaterial({ color: 'orange' });\n" +
            "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
            "scene.add(rungs);\n" +
            "const m = new THREE.Matrix4();\n" +
            "for (let i = 0; i < 5; i++) {\n" +
            "  m.setPosition(0, i - 2, 0);\n" +
            "  rungs.setMatrixAt(i, m);\n" +
            "}\n",
        },
      },
    ],
  },
  {
    id: "three-camera",
    domain: "three",
    title: "カメラ",
    summary: "カメラの位置と向きで、シーンの見え方を変える。",
    icon: "🎥",
    lessons: [
      {
        id: "three-camera-back",
        title: "カメラを引く",
        explanation:
          "<p>カメラも <code>position</code> を持ちます。<code>z</code> を大きくすると後ろに下がり、" +
          "オブジェクトが小さく見えます。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n\n" +
            "// カメラを後ろに引いて、立方体を小さく見せよう\n",
          task: "カメラを z = 8 まで引こう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "camera\\.position" },
            { kind: "cameraPositioned", position: [0, 0, 8] },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["camera.position.z = 8;", "数値が大きいほど遠ざかります"],
          solution:
            "const geo = new THREE.BoxGeometry(1, 1, 1);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n" +
            "camera.position.z = 8;\n",
        },
      },
      {
        id: "three-camera-angle",
        title: "見下ろす: lookAt",
        explanation:
          "<p>カメラを斜めに置き、<code>camera.lookAt(0, 0, 0)</code> で原点を向かせると、" +
          "立体を斜め上から見下ろせます。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n\n" +
            "// カメラを斜め上に置き、原点を向かせよう\n",
          task: "カメラを (4, 4, 4) に置き、原点を lookAt しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "lookAt" },
            { kind: "cameraPositioned", position: [4, 4, 4] },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["camera.position.set(4, 4, 4);", "camera.lookAt(0, 0, 0);"],
          solution:
            "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n" +
            "camera.position.set(4, 4, 4);\n" +
            "camera.lookAt(0, 0, 0);\n",
        },
      },
    ],
  },
  {
    id: "three-animation",
    domain: "three",
    title: "アニメーション",
    summary: "回転の考え方。実アプリでは毎フレーム値を更新する。",
    icon: "🎞️",
    lessons: [
      {
        id: "three-rotate",
        title: "回転させる: rotation",
        explanation:
          "<p><code>rotation</code> は各軸の回転角（ラジアン）。実際のアプリでは描画ループで毎フレーム " +
          "<code>mesh.rotation.y += 0.01</code> のように増やします。ここでは静的に角度をつけて確認しましょう。</p>",
        challenge: {
          starterCode:
            "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n\n" +
            "// Y軸まわりに少し回してみよう\n",
          task: "立方体を Y軸まわりに回転させよう（rotation.y）。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "rotation" },
            { kind: "sceneHas", type: "Mesh" },
            { kind: "rendersNonEmpty" },
          ],
          hints: ["cube.rotation.y = 0.6;", "ラジアンなので 0.6 ≒ 34度"],
          solution:
            "const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);\n" +
            "const mat = new THREE.MeshNormalMaterial();\n" +
            "const cube = new THREE.Mesh(geo, mat);\n" +
            "scene.add(cube);\n" +
            "cube.rotation.y = 0.6;\n",
        },
      },
    ],
  },
  {
    id: "three-atmosphere",
    domain: "three",
    title: "空気感: 霧と影",
    summary: "Fog で遠くをかすませ、影を落として、シーンに奥行きと接地感を出す。",
    icon: "🌁",
    lessons: [
      {
        id: "three-fog",
        title: "遠くをかすませる: Fog",
        explanation:
          "<p><code>scene.fog = new THREE.Fog(色, near, far)</code> で、カメラから <code>near</code> より遠いものが" +
          "だんだん霧の色に溶け、<code>far</code> で完全に霧の色になります。霧の色を背景色と同じにすると、" +
          "遠くのものが闇に消えていくように見えます。</p>",
        challenge: {
          starterCode:
            "// 奥へ長くのびる白い床\n" +
            "const floor = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(20, 34),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'white' }),\n" +
            ");\n" +
            "floor.rotation.x = -Math.PI / 2;\n" +
            "floor.position.set(0, -1, -13);\n" +
            "scene.add(floor);\n\n" +
            "// ここで scene.fog を設定して、床の奥を闇に溶かそう\n",
          task: "scene.fog に THREE.Fog（色 0x05060d・near 3・far 8）を設定して、床の奥が背景の闇に溶けるようにしよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "THREE\\.Fog" },
            { kind: "sceneHas", type: "Mesh" },
            { kind: "pixelApprox", x: 0.5, y: 0.03, rgb: [1, 1, 1], tol: 0.2 },
            { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: ["scene.fog = new THREE.Fog(0x05060d, 3, 8);", "0x05060d はこのプレビューの背景色です"],
          solution:
            "const floor = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(20, 34),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'white' }),\n" +
            ");\n" +
            "floor.rotation.x = -Math.PI / 2;\n" +
            "floor.position.set(0, -1, -13);\n" +
            "scene.add(floor);\n" +
            "scene.fog = new THREE.Fog(0x05060d, 3, 8);\n",
        },
      },
      {
        id: "three-shadow",
        title: "影を落とす: castShadow と receiveShadow",
        explanation:
          "<p>Three.js の影は、何もしないと出ません。スイッチが 4つあります: " +
          "<code>renderer.shadowMap.enabled = true</code>（影の計算を有効に）、" +
          "ライトの <code>castShadow</code>（このライトが影を作る）、" +
          "影を落とす側の <code>castShadow</code>、影を受ける側の <code>receiveShadow</code>。" +
          "影を作れるのは DirectionalLight・SpotLight・PointLight です。</p>",
        challenge: {
          starterCode:
            "camera.position.set(0, 6, 7);\n" +
            "camera.lookAt(0, 0, 0);\n\n" +
            "const floor = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(14, 14),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
            ");\n" +
            "floor.rotation.x = -Math.PI / 2;\n" +
            "floor.position.y = -1;\n" +
            "scene.add(floor);\n\n" +
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1, 32, 16),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'tomato' }),\n" +
            ");\n" +
            "ball.position.y = 1.5;\n" +
            "scene.add(ball);\n\n" +
            "const sun = new THREE.DirectionalLight(0xffffff, 3);\n" +
            "sun.position.set(0, 8, 3);\n" +
            "scene.add(sun);\n\n" +
            "// 4つのスイッチを入れて、床に球の影を落とそう\n",
          task: "renderer の shadowMap を有効にし、sun と ball を castShadow、floor を receiveShadow にして影を落とそう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "shadowMap" },
            { kind: "sourceMatches", pattern: "castShadow" },
            { kind: "sourceMatches", pattern: "receiveShadow" },
            { kind: "sceneHas", type: "DirectionalLight" },
            { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: [1, 1, 1], tol: 0.25 },
            { kind: "pixelApprox", x: 0.5, y: 0.47, rgb: [0, 0, 0], tol: 0.25 },
          ],
          hints: [
            "renderer.shadowMap.enabled = true;",
            "sun.castShadow = true; ball.castShadow = true; floor.receiveShadow = true;",
          ],
          solution:
            "camera.position.set(0, 6, 7);\n" +
            "camera.lookAt(0, 0, 0);\n" +
            "const floor = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(14, 14),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
            ");\n" +
            "floor.rotation.x = -Math.PI / 2;\n" +
            "floor.position.y = -1;\n" +
            "scene.add(floor);\n" +
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1, 32, 16),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'tomato' }),\n" +
            ");\n" +
            "ball.position.y = 1.5;\n" +
            "scene.add(ball);\n" +
            "const sun = new THREE.DirectionalLight(0xffffff, 3);\n" +
            "sun.position.set(0, 8, 3);\n" +
            "scene.add(sun);\n" +
            "renderer.shadowMap.enabled = true;\n" +
            "sun.castShadow = true;\n" +
            "ball.castShadow = true;\n" +
            "floor.receiveShadow = true;\n",
        },
      },
    ],
  },
];
