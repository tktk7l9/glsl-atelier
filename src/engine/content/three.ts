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

/** The clipping lesson, seen from a little above: a shell coloured by its
 *  normals (both faces drawn, so the inside shows once it is cut) around an
 *  orange core. */
const CLIPPING_SCENE =
  "// 少し上から見下ろすカメラ\n" +
  "camera.position.set(0, 2.5, 4);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 殻（面の向きで色が変わるマテリアル。内側の面も描く）と、その中に隠れたオレンジの核\n" +
  "const shell = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.5, 64, 32),\n" +
  "  new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }),\n" +
  ");\n" +
  "scene.add(shell);\n" +
  "const core = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.7, 48, 24),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'orange' }),\n" +
  ");\n" +
  "scene.add(core);\n";

const CLIPPING_TODO =
  "// ① renderer の localClippingEnabled を true にしよう\n" +
  "// ② 殻のマテリアルの clippingPlanes で、殻の上半分（y > 0）を切り取ろう\n";

/** The spot-light lesson: a white wall and a spotlight 4 in front of it. */
const SPOT_SCENE =
  "// 正面の白い壁\n" +
  "const wall = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(14, 14),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
  ");\n" +
  "scene.add(wall);\n\n" +
  "// 壁の 4 手前から原点を照らすスポットライト\n" +
  "const spot = new THREE.SpotLight(0xffffff, 40);\n" +
  "spot.position.set(0, 0, 4);\n" +
  "scene.add(spot);\n";

/** The roughness lesson: a blue capsule lying on its side, lit from above.
 *  A cylinder's highlight is a horizontal stripe, so the read-back samples on
 *  the centre line find it at any preview width; this light puts the stripe
 *  on the sample row at y = 0.59375 (within 0.2 px at 1264 px). */
const ROUGHNESS_SCENE = (material: string): string =>
  "// 横に寝かせた青いカプセル（半径 1、まっすぐな部分の長さ 2）\n" +
  "const pill = new THREE.Mesh(\n" +
  "  new THREE.CapsuleGeometry(1, 2, 16, 64),\n" +
  `  new THREE.MeshStandardMaterial(${material}),\n` +
  ");\n" +
  "pill.rotation.z = Math.PI / 2;  // 横向きに\n" +
  "scene.add(pill);\n\n" +
  "// 手前の斜め上から照らす光\n" +
  "const sun = new THREE.DirectionalLight(0xffffff, 3);\n" +
  "sun.position.set(0, 2.5, 1.5);\n" +
  "scene.add(sun);\n";

/** The keyframe lesson; `keys` defines `times` and `values`. */
const KEYFRAME_SCENE = (keys: string): string =>
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'hotpink' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "// 位置のキーフレーム: times[i] 秒に、values の i 番目の位置 (x, y, z) を通る\n" +
  keys +
  "const track = new THREE.VectorKeyframeTrack('.position', times, values);\n" +
  "const clip = new THREE.AnimationClip('jump', 2, [track]);\n\n" +
  "// クリップを再生して、1 秒進めた瞬間のポーズにする\n" +
  "const mixer = new THREE.AnimationMixer(ball);\n" +
  "mixer.clipAction(clip).play();\n" +
  "mixer.update(1);\n";

/** The texture-repeat lesson's 1×2 stripe texture. */
const STRIPE_TEXTURE =
  "// 縦 2 ピクセルの縞模様（下の段: 白、上の段: 空色）\n" +
  "const data = new Uint8Array([\n" +
  "  255, 255, 255, 255,  // 下の段: 白\n" +
  "  0, 160, 255, 255,    // 上の段: 空色\n" +
  "]);\n" +
  "const tex = new THREE.DataTexture(data, 1, 2);\n" +
  "tex.needsUpdate = true;\n";

const STRIPE_BOARD =
  "const board = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(4, 4),\n" +
  "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
  ");\n" +
  "scene.add(board);\n";

/** The stripe colours as drawn: the NoColorSpace texel 160/255 is linear. */
const STRIPE_WHITE: [number, number, number] = [1, 1, 1];
const STRIPE_SKY: [number, number, number] = [0, 0.81, 1];

/** The CanvasTexture lesson's picture, drawn with Canvas 2D. */
const CANVAS_DRAWING =
  "// 64×64 の canvas に絵を描く（canvas の座標は左上が原点で、y は下向き）\n" +
  "const canvas = document.createElement('canvas');\n" +
  "canvas.width = 64;\n" +
  "canvas.height = 64;\n" +
  "const ctx = canvas.getContext('2d');\n" +
  "ctx.fillStyle = 'skyblue';\n" +
  "ctx.fillRect(0, 0, 64, 32);    // 上半分: 空\n" +
  "ctx.fillStyle = 'seagreen';\n" +
  "ctx.fillRect(0, 32, 64, 32);   // 下半分: 草原\n" +
  "ctx.fillStyle = 'gold';\n" +
  "ctx.fillRect(46, 6, 10, 10);   // 右上: 太陽\n" +
  "ctx.fillStyle = 'tomato';\n" +
  "ctx.fillRect(24, 20, 16, 16);  // まん中: 赤い家\n";

/** The per-instance colour lesson: the ladder of the InstancedMesh lesson,
 *  white, with `paint` inside the loop that places the rungs. */
const RAINBOW_LADDER = (paint: string): string =>
  "const geo = new THREE.BoxGeometry(2, 0.6, 0.6);\n" +
  "const mat = new THREE.MeshBasicMaterial({ color: 'white' });  // コピーの色はこの白に掛けられる\n" +
  "const rungs = new THREE.InstancedMesh(geo, mat, 5);\n" +
  "scene.add(rungs);\n\n" +
  "// 下から順に塗りたい色\n" +
  "const colors = ['tomato', 'gold', 'limegreen', 'deepskyblue', 'mediumpurple'];\n\n" +
  "const m = new THREE.Matrix4();\n" +
  "for (let i = 0; i < 5; i++) {\n" +
  "  m.setPosition(0, i - 2, 0);\n" +
  "  rungs.setMatrixAt(i, m);\n" +
  paint +
  "}\n";

/** The rungs' colours as drawn (sRGB), bottom to top. */
const RAINBOW: ReadonlyArray<[number, number, number]> = [
  [1, 0.39, 0.28],
  [1, 0.84, 0],
  [0.2, 0.8, 0.2],
  [0, 0.75, 1],
  [0.58, 0.44, 0.86],
];

/** The raycasting lesson: a big ball and a marker hidden at its centre. */
const RAYCAST_SCENE =
  "// 大きな球（面の向きで色が変わる）\n" +
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.5, 64, 32),\n" +
  "  new THREE.MeshNormalMaterial(),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  "// 目印の金色の玉（いまは球の中心に隠れている）\n" +
  "const marker = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.35, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
  ");\n" +
  "scene.add(marker);\n\n" +
  "// 画面の中心から少し上の点（中心が (0, 0)、端が ±1 の座標）\n" +
  "const pointer = new THREE.Vector2(0, 0.4);\n" +
  "const raycaster = new THREE.Raycaster();\n";

/** The lathe lesson's profile: (distance from the axis, height), bottom up. */
const VASE_PROFILE =
  "// つぼの断面（軸からの距離, 高さ）を下から順に\n" +
  "const points = [\n" +
  "  new THREE.Vector2(0.0, -1.5),  // 底の中心\n" +
  "  new THREE.Vector2(0.8, -1.5),  // 底のふち\n" +
  "  new THREE.Vector2(1.2, -0.6),  // いちばんふくらんだ所\n" +
  "  new THREE.Vector2(0.9, 0.4),   // 肩\n" +
  "  new THREE.Vector2(0.45, 1.0),  // 首\n" +
  "  new THREE.Vector2(0.6, 1.5),   // 口\n" +
  "];\n\n";

const VASE_MESH =
  "const vase = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" + "scene.add(vase);\n";

/** The extrude lesson: a camera above the scene and a gem outline. */
const GEM_OUTLINE =
  "// 少し上から見下ろすカメラ\n" +
  "camera.position.set(0, 3, 3);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 宝石の形の輪郭（moveTo で書き始め、lineTo で線を引く）\n" +
  "const shape = new THREE.Shape();\n" +
  "shape.moveTo(-1.2, 1.2);\n" +
  "shape.lineTo(1.2, 1.2);\n" +
  "shape.lineTo(1.8, 0.4);\n" +
  "shape.lineTo(0, -1.6);\n" +
  "shape.lineTo(-1.8, 0.4);\n" +
  "shape.lineTo(-1.2, 1.2);\n\n";

const GEM_MESH =
  "const gem = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" + "scene.add(gem);\n";

/** The tube lesson: a spring's points, the curve through them, and the curve
 *  shown as dots. With the tube on, its coils cover the centre line at 0.10–0.20,
 *  0.46–0.56 and 0.81–0.92 of the height (in front) and 0.35–0.41 and 0.57–0.64
 *  (behind), so the read-back rows 0.16, 0.53, 0.59 and 0.84 land at least 0.02
 *  inside a coil and the rows 0.28 and 0.72 well between them. */
const SPRING_CURVE =
  "// らせん（ばね）を通る点の列\n" +
  "const points = [];\n" +
  "for (let i = 0; i <= 100; i++) {\n" +
  "  const t = (i / 100) * Math.PI * 5;  // 2周半\n" +
  "  points.push(new THREE.Vector3(Math.cos(t) * 1.2, (t - Math.PI * 2.5) * 0.25, Math.sin(t) * 1.2));\n" +
  "}\n" +
  "// 点をなめらかに通る曲線\n" +
  "const curve = new THREE.CatmullRomCurve3(points);\n\n" +
  "// 曲線を点で示す\n" +
  "const dots = new THREE.Points(\n" +
  "  new THREE.BufferGeometry().setFromPoints(curve.getPoints(150)),\n" +
  "  new THREE.PointsMaterial({ color: 'white', size: 0.06 }),\n" +
  ");\n" +
  "scene.add(dots);\n";

/** The FogExp2 lesson: a sky-blue background, a long meadow and rows of trees.
 *  The meadow ends 1 in front of the camera: a vertex on the camera plane
 *  (view depth 0) left SwiftShader fogging the whole plane. */
const MEADOW_SCENE =
  "// 空の色の背景\n" +
  "scene.background = new THREE.Color('lightblue');\n\n" +
  "// 奥へ長くのびる草原\n" +
  "const ground = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(40, 60),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'seagreen' }),\n" +
  ");\n" +
  "ground.rotation.x = -Math.PI / 2;\n" +
  "ground.position.set(0, -1, -26);\n" +
  "scene.add(ground);\n\n" +
  "// 両側に並ぶ木（円すい）\n" +
  "for (let z = 2; z >= -18; z -= 4) {\n" +
  "  for (const x of [-3, 3]) {\n" +
  "    const tree = new THREE.Mesh(\n" +
  "      new THREE.ConeGeometry(0.6, 2, 16),\n" +
  "      new THREE.MeshBasicMaterial({ color: 'darkgreen' }),\n" +
  "    );\n" +
  "    tree.position.set(x, 0, z);\n" +
  "    scene.add(tree);\n" +
  "  }\n" +
  "}\n";

const SKY_BLUE: [number, number, number] = [0.68, 0.85, 0.9];

/** Mid-grey: MeshNormalMaterial writes normal * 0.5 + 0.5 for a unit normal,
 *  so every colour it draws is exactly 0.5 away from this. */
const NORMAL_COLOURED: [number, number, number] = [0.5, 0.5, 0.5];

/** The background lesson: a knot coloured by its normals. */
const KNOT_SCENE =
  "// 面の向きで色が変わる結び目\n" +
  "const knot = new THREE.Mesh(\n" +
  "  new THREE.TorusKnotGeometry(0.9, 0.3, 128, 24),\n" +
  "  new THREE.MeshNormalMaterial(),\n" +
  ");\n" +
  "scene.add(knot);\n";

/** The hemisphere lesson: a big white sphere, lit by `light`. */
const HEMI_SCENE = (light: string): string =>
  "// 白い球（MeshStandardMaterial は光が無いと真っ暗）\n" +
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.8, 64, 32),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  light;

/** The lookAt lesson: a target up high and an arrow whose tip points along
 *  +Z. Both sit 0.25 left of centre, because the read-back column nearest
 *  x = 0.5 lies 0.06 of the width left of it (0.18 world units at 1:1, 0.32
 *  at 16:9), and the arrow's tip is narrow. */
const ARROW_SCENE =
  "// 的（まと）: 上のほうの金色の玉\n" +
  "const target = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(0.35, 32, 16),\n" +
  "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
  ");\n" +
  "target.position.set(-0.25, 2.3, 0);\n" +
  "scene.add(target);\n\n" +
  "// 矢印（円すい）。先端が +Z（手前）を向くように作ってある\n" +
  "const geo = new THREE.ConeGeometry(0.8, 3, 32);\n" +
  "geo.rotateX(Math.PI / 2);\n" +
  "const arrow = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());\n" +
  "arrow.position.x = -0.25;\n" +
  "scene.add(arrow);\n";

/** The line lesson: a chart's values as points, shown as dots. */
const CHART_SCENE =
  "// 6 か月分の売り上げを、左から右へ並べた点にする（x: 月、y: 値）\n" +
  "const values = [2, 3.5, 1.5, 4, 2.5, 3.2];\n" +
  "const points = values.map((v, i) => new THREE.Vector3(i - 2.5, v - 2.5, 0));\n\n" +
  "// 点を打つ\n" +
  "const dots = new THREE.Points(\n" +
  "  new THREE.BufferGeometry().setFromPoints(points),\n" +
  "  new THREE.PointsMaterial({ color: 'gold', size: 0.25 }),\n" +
  ");\n" +
  "scene.add(dots);\n";

/** The sprite lesson: a camera off to the side and three orbs made by `make`. */
const ORBS_SCENE = (make: string): string =>
  "// 横から見るカメラ\n" +
  "camera.position.set(6, 0, 0);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 3つの光の玉\n" +
  "const colors = ['gold', 'deepskyblue', 'hotpink'];\n" +
  "colors.forEach((color, i) => {\n" +
  make +
  "  orb.position.set(0, (i - 1) * 1.6, 0);\n" +
  "  scene.add(orb);\n" +
  "});\n";

/** The shadow-material lesson: a sky, a floating ball and a sun that casts
 *  its shadow onto a floor made of `floorMaterial`. */
const SKY_SHADOW_SCENE = (floorMaterial: string): string =>
  "// 空の色の背景と、上から見下ろすカメラ\n" +
  "scene.background = new THREE.Color('lightblue');\n" +
  "camera.position.set(0, 6, 7);\n" +
  "camera.lookAt(0, 0, 0);\n\n" +
  "// 宙に浮いた球と、影を作る太陽\n" +
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1, 32, 16),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'tomato' }),\n" +
  ");\n" +
  "ball.position.y = 1.5;\n" +
  "ball.castShadow = true;\n" +
  "scene.add(ball);\n" +
  "const sun = new THREE.DirectionalLight(0xffffff, 3);\n" +
  "sun.position.set(0, 8, 3);\n" +
  "sun.castShadow = true;\n" +
  "scene.add(sun);\n" +
  "renderer.shadowMap.enabled = true;\n\n" +
  "// 床。いまは白い板が見えている\n" +
  "const floor = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(14, 14),\n" +
  `  ${floorMaterial},\n` +
  ");\n" +
  "floor.rotation.x = -Math.PI / 2;\n" +
  "floor.position.y = -1;\n" +
  "floor.receiveShadow = true;\n" +
  "scene.add(floor);\n";

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
    summary: "法線マテリアル・ワイヤーフレーム・半透明・自作シェーダーで見た目を変え、clippingPlanes で断面を見せる。",
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
      {
        id: "three-clipping",
        title: "断面を見せる: clippingPlanes",
        explanation:
          "<p>マテリアルの <code>clippingPlanes</code> に平面（<code>THREE.Plane</code>）を渡すと、平面の<b>裏側</b>にある部分が" +
          "描かれなくなり、隠れていた中身が見えます。<code>new THREE.Plane(法線, 距離)</code> は、法線が向いている側を残す平面です。" +
          "この機能はふだんは止めてあるので、<code>renderer.localClippingEnabled = true</code> にしないと効きません。" +
          "<code>side: THREE.DoubleSide</code> にしておくと、切り口から内側の面も見えます。</p>",
        challenge: {
          starterCode: CLIPPING_SCENE + "\n" + CLIPPING_TODO,
          task:
            "renderer.localClippingEnabled を true にし、殻のマテリアルの clippingPlanes に法線 (0, -1, 0)・距離 0 の平面を渡して、" +
            "殻の上半分を切り取ろう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "clippingPlanes\\s*[:=]" },
            { kind: "sceneHas", type: "Mesh", min: 2 },
            // Up the centre line (measured in headless Chrome at 1:1 and 16:9,
            // and drawn the same by the ray-cast model in solvable.test.ts): the
            // outside of the bowl that is left, the inside of the shell seen
            // over its cut rim, the core, and nothing where the top half was.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.5,
              rgb: [1, 0.65, 0],
              tol: 0.15,
              message:
                "中の核が見えていません。renderer.localClippingEnabled = true にして、平面の法線を (0, -1, 0)（下向き）にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.34,
              rgb: [0.6, 0.85, 0.84],
              tol: 0.15,
              message: "切り口から殻の内側が見えていません。殻ごと消さずに、上半分だけを clippingPlanes で切り取りましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.44, 0.2, 0.9], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "renderer.localClippingEnabled = true;",
            "shell.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];",
          ],
          solution:
            CLIPPING_SCENE +
            "renderer.localClippingEnabled = true;\n" +
            "shell.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];\n",
        },
      },
    ],
  },
  {
    id: "three-light",
    domain: "three",
    title: "ライティング",
    summary: "StandardMaterial は光が必要。環境光・平行光源・点光源・スポットライトで照らし、emissive で自ら光らせ、roughness でつやを出す。",
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
        id: "three-hemisphere-light",
        title: "空と地面の光: HemisphereLight",
        explanation:
          "<p>屋外の光は、上から青い空の光、下から地面の照り返しが来ています。<code>HemisphereLight(空の色, 地面の色, 強さ)</code> は" +
          "それを 1つで表すライトで、面が<b>上を向くほど空の色</b>、<b>下を向くほど地面の色</b>で照らされます。<code>AmbientLight</code> と同じく" +
          "全体を照らしますが、上下で色が変わるので、のっぺりしません。強さは 3 くらいにすると、白い物がほぼ元の明るさで見えます。</p>",
        challenge: {
          starterCode: HEMI_SCENE(
            "// いまは環境光だけ。上も下も同じ明るさで、のっぺりしている\n" +
              "const light = new THREE.AmbientLight(0xffffff, 2);\n" +
              "scene.add(light);\n",
          ),
          task: "AmbientLight を、空の色 'skyblue'・地面の色 'darkorange'・強さ 3 の HemisphereLight に替えて、球の上を空色、下をオレンジに照らそう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "HemisphereLight" },
            { kind: "sceneHas", type: "HemisphereLight" },
            // Up the centre line (drawn the same by the ray-cast model in
            // solvable.test.ts and by headless Chrome, to 0.01): the mix in
            // the middle, the sky colour on top, the ground colour below.
            // The ambient light kept as well washes everything out to white,
            // intensity 1 leaves the ball at half the brightness, and the
            // colours the wrong way round swap top and bottom.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.5,
              rgb: [0.81, 0.67, 0.64],
              tol: 0.12,
              message: "明るさが目標と違います。強さを 3 にして、AmbientLight は外しましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.78,
              rgb: [0.63, 0.76, 0.83],
              tol: 0.12,
              message: "球の上が空の色になっていません。1つ目の色（空）を 'skyblue' にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.22,
              rgb: [0.92, 0.59, 0.4],
              tol: 0.12,
              message: "球の下が地面の色になっていません。2つ目の色（地面）を 'darkorange' にしましょう",
            },
          ],
          hints: [
            "const light = new THREE.HemisphereLight('skyblue', 'darkorange', 3);",
            "AmbientLight の行は消して、HemisphereLight だけにします",
          ],
          solution: HEMI_SCENE(
            "const light = new THREE.HemisphereLight('skyblue', 'darkorange', 3);  // 空の色・地面の色・強さ\n" +
              "scene.add(light);\n",
          ),
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
      {
        id: "three-point-light",
        title: "点光源: PointLight",
        explanation:
          "<p><code>PointLight</code> は電球のように<b>1点から全方向へ</b>光を出し、離れるほど暗くなります" +
          "（距離の 2乗に反比例）。<code>new THREE.PointLight(色, 強さ)</code> で作り、<code>position</code> で" +
          "置き場所を決めます。光源に近い面だけが明るく照らされ、光のたまりができます。</p>",
        challenge: {
          starterCode:
            "// 正面の白い壁（ライトが無いので真っ暗）\n" +
            "const wall = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(14, 14),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
            ");\n" +
            "scene.add(wall);\n\n" +
            "// ここで点光源を作り、壁の上のほう・少し手前に置こう\n",
          task: "強さ 3 の PointLight を (0, 1.5, 1) に置いて、壁の上のほうに光のたまりを作ろう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "PointLight" },
            { kind: "sceneHas", type: "PointLight" },
            // Bright right in front of the bulb, fading with distance (measured
            // 0.89–0.94 / 0.38 / 0.11 at 1:1 and 16:9). A bulb placed lower,
            // farther, dimmer or much brighter misses at least one of these.
            { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: [0.92, 0.92, 0.92], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.38, 0.38, 0.38], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.03, rgb: [0.11, 0.11, 0.11], tol: 0.15 },
          ],
          hints: [
            "const bulb = new THREE.PointLight(0xffffff, 3);",
            "bulb.position.set(0, 1.5, 1); scene.add(bulb);",
          ],
          solution:
            "const wall = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(14, 14),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
            ");\n" +
            "scene.add(wall);\n" +
            "const bulb = new THREE.PointLight(0xffffff, 3);\n" +
            "bulb.position.set(0, 1.5, 1);\n" +
            "scene.add(bulb);\n",
        },
      },
      {
        id: "three-spot-light",
        title: "スポットライト: angle と penumbra",
        explanation:
          "<p><code>SpotLight</code> は舞台の照明のように、光を<b>円錐の形</b>に出します。<code>angle</code> は円錐の広がり" +
          "（中心からふちまでの角度、ラジアン）で、小さいほど光の輪がしぼられます。<code>penumbra</code>（0〜1）は輪のふちの" +
          "ぼかしで、0 だとくっきり、大きいほど内側からなめらかに暗くなります。光は <code>target</code>（初期値は原点）に向かいます。</p>",
        challenge: {
          starterCode:
            SPOT_SCENE +
            "\n// いまは円錐が広すぎて、壁全体が明るい。ここで spot.angle と spot.penumbra を設定しよう\n",
          task: "spot.angle を Math.PI / 12（15°）にして光の輪をしぼり、spot.penumbra を 0.4 にして輪のふちをぼかそう。",
          validators: [
            { kind: "noError" },
            { kind: "sceneHas", type: "SpotLight" },
            {
              kind: "sourceMatches",
              pattern: "\\.angle\\s*=",
              message: "spot.angle に円錐の広がり（Math.PI / 12）を代入しましょう",
            },
            {
              kind: "sourceMatches",
              pattern: "\\.penumbra\\s*=",
              message: "spot.penumbra にふちのぼかし（0.4）を代入しましょう",
            },
            // Measured in headless Chrome at 1:1 and 16:9: the pool is 0.89 in
            // the middle and 0.88 at y = 0.6, the soft edge reads 0.38–0.54 at
            // y = 0.66, and the wall is black outside the cone. A hard edge
            // (penumbra 0) stays 0.86 at the edge; penumbra 1 dims the inside to
            // 0.74–0.80; angles of PI / 10 or PI / 15 miss the edge value.
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.89, 0.89, 0.89], tol: 0.1 },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.6,
              rgb: [0.88, 0.88, 0.88],
              tol: 0.1,
              message: "光の輪の内側まで暗くなっています。penumbra は 0.4 にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.66,
              rgb: [0.46, 0.46, 0.46],
              tol: 0.2,
              message: "光の輪のふちが目標どおりにぼけていません。angle は Math.PI / 12、penumbra は 0.4 にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.2,
              rgb: [0, 0, 0],
              tol: 0.15,
              message: "光の輪が広すぎます。angle を Math.PI / 12 にしてしぼりましょう",
            },
          ],
          hints: ["spot.angle = Math.PI / 12;", "spot.penumbra = 0.4;"],
          solution: SPOT_SCENE + "spot.angle = Math.PI / 12;\nspot.penumbra = 0.4;\n",
        },
      },
      {
        id: "three-emissive",
        title: "自分で光る: emissive",
        explanation:
          "<p><code>emissive</code> はマテリアルが<b>自分で出す光の色</b>です。ライトが 1つも無くても、その色で光って" +
          "見えます。画面やネオン、星など、光るものそのものの表現に使い、強さは <code>emissiveIntensity</code> で" +
          "変えられます。ただし、まわりのものを照らすわけではありません（照らしたいときはライトを足します）。</p>",
        challenge: {
          starterCode:
            "// ライトの無いシーン。MeshStandardMaterial は光が当たらないと真っ黒…\n" +
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1.2, 32, 16),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
            ");\n" +
            "scene.add(ball);\n",
          task: "ライトは足さずに、マテリアルの emissive を 'orange' にして、球をオレンジに光らせよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "emissive" },
            { kind: "sceneHas", type: "Mesh" },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.65, 0], tol: 0.15 },
          ],
          hints: [
            "new THREE.MeshStandardMaterial({ color: 'white', emissive: 'orange' })",
            "emissive は光が当たらなくても出る色。ライトを足すと白が混ざってしまいます",
          ],
          solution:
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1.2, 32, 16),\n" +
            "  new THREE.MeshStandardMaterial({ color: 'white', emissive: 'orange' }),\n" +
            ");\n" +
            "scene.add(ball);\n",
        },
      },
      {
        id: "three-roughness",
        title: "つやを出す: roughness",
        explanation:
          "<p><code>MeshStandardMaterial</code> の <code>roughness</code>（0〜1）は表面の<b>粗さ</b>です。初期値の 1 はざらざらで、" +
          "当たった光は全方向へ散らばり、つやがありません。値を小さくするほど表面がなめらかになり、光源の映り込み" +
          "（<b>ハイライト</b>）が小さく鋭く光ります。もう 1つの <code>metalness</code>（0〜1）を上げると金属になり、" +
          "映り込みが物の色に染まります。</p>",
        challenge: {
          starterCode:
            ROUGHNESS_SCENE("{ color: 'royalblue' }") +
            "\n// いまは roughness が初期値の 1（つや消し）。マテリアルの roughness を小さくして、つやを出そう\n",
          task: "マテリアルの roughness を 0.2 にして、青いカプセルに細く鋭いハイライトを光らせよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "roughness\\s*[:=]" },
            { kind: "materialOf", material: "MeshStandardMaterial" },
            // Measured in headless Chrome at 1:1 and 16:9 on the stripe row: the
            // sharp highlight of roughness 0.2 is pure white, while the light
            // spread out by roughness 1 (0.25, 0.38, 0.79) or 0.5 (0.5, 0.56,
            // 0.88) stays blue. Just below, the body keeps its diffuse blue
            // (a metal, which has none, turns dark there).
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.59,
              rgb: [1, 1, 1],
              tol: 0.1,
              message: "ハイライトが細く鋭く光っていません。roughness を 0.2 にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.66,
              rgb: [0.25, 0.4, 0.85],
              tol: 0.12,
              message: "カプセルの青が暗く沈んでいます。metalness はそのままにして、roughness だけを小さくしましょう",
            },
          ],
          hints: [
            "new THREE.MeshStandardMaterial({ color: 'royalblue', roughness: 0.2 })",
            "あとから pill.material.roughness = 0.2; と変えても同じです",
          ],
          solution: ROUGHNESS_SCENE("{ color: 'royalblue', roughness: 0.2 }"),
        },
      },
    ],
  },
  {
    id: "three-transform",
    domain: "three",
    title: "変形とグループ",
    summary: "拡大縮小、Group でまとめる、親子でくっつけて動かす、InstancedMesh で同じ形をたくさん描いて 1つずつ色を変える。",
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
        id: "three-hierarchy",
        title: "親子関係: 親を回すと子もついてくる",
        explanation:
          "<p><code>parent.add(child)</code> で、オブジェクトを別のオブジェクトの<b>子</b>にできます。子の " +
          "<code>position</code> は親から見た位置（ローカル座標）になり、親を動かす・回す・拡大すると、子もいっしょに" +
          "動きます。惑星の公転や腕と手のように、何かに<b>くっついて動く</b>ものを作るときの基本です。</p>",
        challenge: {
          starterCode:
            "// 中心の太陽\n" +
            "const sun = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(0.6, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
            ");\n" +
            "scene.add(sun);\n\n" +
            "// 惑星（太陽から見て右へ 2）\n" +
            "const planet = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'deepskyblue' }),\n" +
            ");\n" +
            "planet.position.x = 2;\n" +
            "scene.add(planet);\n\n" +
            "// 太陽を z 軸まわりに 90° 回す（いまは惑星がついてこない）\n" +
            "sun.rotation.z = Math.PI / 2;\n",
          task: "planet を scene ではなく sun に add して太陽の子にし、太陽の回転で惑星を真上へ運ぼう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "sun\\.add\\s*\\(" },
            { kind: "sceneHas", type: "Mesh", min: 2 },
            // The sun stays in the middle; the planet now sits right above it.
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.84, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [0, 0.75, 1], tol: 0.15 },
          ],
          hints: [
            "sun.add(planet);  // scene.add(planet) の代わりに",
            "子の position (2, 0, 0) は太陽から見た位置。太陽が 90° 回ると、真上の (0, 2, 0) に来ます",
          ],
          solution:
            "const sun = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(0.6, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'gold' }),\n" +
            ");\n" +
            "scene.add(sun);\n" +
            "const planet = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(0.5, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'deepskyblue' }),\n" +
            ");\n" +
            "planet.position.x = 2;\n" +
            "sun.add(planet);\n" +
            "sun.rotation.z = Math.PI / 2;\n",
        },
      },
      {
        id: "three-look-at",
        title: "的を向く: lookAt",
        explanation:
          "<p>カメラだけでなく、どのオブジェクトも <code>lookAt(x, y, z)</code>（または <code>lookAt(Vector3)</code>）で<b>その点のほうを向かせる</b>" +
          "ことができます。回転の角度を自分で計算しなくても、向きたい位置を渡すだけです。向くのはオブジェクトの <b>+Z 軸</b>なので、" +
          "矢印や目のような「先」のある形は、先端が +Z を向くように作っておきます（この円すいは <code>geo.rotateX</code> でそうしてあります）。" +
          "渡すのは<b>位置</b>（<code>target.position</code>）で、オブジェクトそのものではありません。</p>",
        challenge: {
          starterCode: ARROW_SCENE + "\n// ここで、矢印の先端を的のほうへ向けよう\n",
          task: "arrow.lookAt に的の位置 target.position を渡して、矢印の先端を的に向けよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "lookAt" },
            { kind: "sceneHas", type: "Mesh", min: 2 },
            // With the tip pointing up, the arrow's body crosses the centre
            // line at 0.66 of the height (normal-coloured: 0.5 from mid-grey,
            // while the background is 0.83 away); pointing at the camera it
            // shows only its base, which ends at 0.6, and pointing down it is
            // below the middle. lookAt(target) with the object itself leaves
            // the matrix NaN and nothing is drawn.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.66,
              rgb: NORMAL_COLOURED,
              tol: 0.55,
              message: "矢印が的のほうを向いていません。arrow.lookAt(target.position) で、的の位置（オブジェクトではなく position）を渡しましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.91, rgb: [1, 0.84, 0], tol: 0.15 },
          ],
          hints: [
            "arrow.lookAt(target.position);",
            "lookAt(target) とオブジェクトを渡すと、位置が読めずに矢印が消えてしまいます",
          ],
          solution: ARROW_SCENE + "arrow.lookAt(target.position);  // 先端（+Z）を的の位置に向ける\n",
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
      {
        id: "three-instance-color",
        title: "1つずつ色を変える: setColorAt",
        explanation:
          "<p><code>InstancedMesh</code> のコピーはみな同じマテリアルで描かれますが、<b>色だけはコピーごとに</b>変えられます。" +
          "<code>setColorAt(番号, 色)</code> に <code>THREE.Color</code> を渡すと、その番号のコピーは、マテリアルの色にその色を掛けた色で描かれます" +
          "（だからマテリアルは白にしておきます）。パーティクルやグラフの棒を色分けするときの定番です。" +
          "なお、一度描いたあとで色を変えたときは <code>instanceColor.needsUpdate = true</code> で知らせます。</p>",
        challenge: {
          starterCode: RAINBOW_LADDER("  // ここで、i 番目の板の色を colors[i] にしよう\n"),
          task: "ループの中で setColorAt を使い、i 番目の板を colors[i] の色にして、はしごを下から虹色に塗り分けよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "setColorAt" },
            { kind: "instanced", min: 5 },
            // Every rung in its own colour, bottom to top, up the centre line.
            {
              kind: "allOf",
              of: [0.16, 0.34, 0.5, 0.66, 0.84].map((y, i) => ({
                kind: "pixelApprox" as const,
                x: 0.5,
                y,
                rgb: RAINBOW[i],
                tol: 0.15,
              })),
              message: "板の色が colors の順になっていません。ループの中で rungs.setColorAt(i, new THREE.Color(colors[i])) としましょう",
            },
          ],
          hints: [
            "rungs.setColorAt(i, new THREE.Color(colors[i]));",
            "material.color を変えると、5枚とも同じ色になってしまいます",
          ],
          solution: RAINBOW_LADDER("  rungs.setColorAt(i, new THREE.Color(colors[i]));  // i 番目のコピーの色\n"),
        },
      },
    ],
  },
  {
    id: "three-camera",
    domain: "three",
    title: "カメラ",
    summary: "カメラの位置・向き・視野角で見え方を変え、カメラから光線を飛ばして指した場所を調べる。",
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
      {
        id: "three-camera-fov",
        title: "ズーム: fov と updateProjectionMatrix",
        explanation:
          "<p><code>PerspectiveCamera</code> の <code>fov</code> は縦方向の<b>視野角</b>（度）です。小さくすると望遠レンズの" +
          "ように狭い範囲が大きく写り、大きくすると広角になります（ここでの <code>camera</code> は最初 60°）。" +
          "ただし <code>fov</code> などのレンズの設定は、変えたあとに <code>camera.updateProjectionMatrix()</code> を" +
          "呼ぶまで描画に反映されません。</p>",
        challenge: {
          starterCode:
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'tomato' }),\n" +
            ");\n" +
            "scene.add(ball);\n\n" +
            "// 視野角 fov を 60° から 30° に狭めて、球を望遠で大きく写そう\n",
          task: "camera.fov を 30 にして設定を反映させ（updateProjectionMatrix）、球を大きく写そう。",
          validators: [
            { kind: "noError" },
            {
              kind: "sourceMatches",
              pattern: "\\.fov\\s*=",
              message: "camera.fov に新しい視野角（30）を代入しましょう",
            },
            {
              kind: "sourceMatches",
              pattern: "updateProjectionMatrix",
              message: "camera.updateProjectionMatrix() を呼んで、fov の変更を反映させましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [1, 0.39, 0.28], tol: 0.15 },
            // At 60° the ball spans 0.32–0.68 of the height; at 30° it reaches 0.12–0.88.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.22,
              rgb: [1, 0.39, 0.28],
              tol: 0.15,
              message: "球が大きく写っていません。fov を変えたら camera.updateProjectionMatrix() を呼びましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: [1, 0.39, 0.28], tol: 0.15 },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.03,
              rgb: BACKGROUND,
              tol: 0.15,
              message: "寄りすぎて球が画面からはみ出しています。fov は 30 にしましょう",
            },
          ],
          hints: [
            "camera.fov = 30;",
            "camera.updateProjectionMatrix();  // 変更を反映",
          ],
          solution:
            "const ball = new THREE.Mesh(\n" +
            "  new THREE.SphereGeometry(1, 32, 16),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'tomato' }),\n" +
            ");\n" +
            "scene.add(ball);\n" +
            "camera.fov = 30;\n" +
            "camera.updateProjectionMatrix();\n",
        },
      },
      {
        id: "three-raycast",
        title: "指した場所を調べる: Raycaster",
        explanation:
          "<p>画面のどこを指しているかを 3D で調べるには、カメラから画面の 1点に向けて<b>光線（レイ）</b>を飛ばし、何に当たるかを計算します。" +
          "<code>Raycaster</code> の <code>setFromCamera(点, camera)</code> は、画面の点（中心が (0, 0)、端が ±1 の座標）を通るレイを作ります。" +
          "<code>intersectObject(物)</code> は当たった場所を近い順の配列で返し、<code>hits[0].point</code> がいちばん手前の当たった点（<code>Vector3</code>）です。" +
          "実際のアプリでは、マウスの位置をこの -1〜1 の座標に直して渡し、クリックした物を選んだりします。</p>",
        challenge: {
          starterCode:
            RAYCAST_SCENE +
            "\n// ここで、カメラから pointer を通るレイを飛ばし、球に当たった点に marker を置こう\n",
          task: "raycaster.setFromCamera でカメラから pointer を通るレイを作り、intersectObject(ball) で当たった点 hits[0].point に marker を置こう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "intersectObjects?\\s*\\(" },
            // Where the ray through (0, 0.4) meets the ball (computed with
            // three's own Raycaster in solvable.test.ts).
            {
              kind: "objectAt",
              position: [0, 0.874, 1.217],
              type: "Mesh",
              tol: 0.1,
              message: "marker が、レイが球に当たった点にありません。marker.position.copy(hits[0].point) で置きましょう",
            },
            // The marker shows right where the pointer is: 0.7 of the height.
            { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: [1, 0.84, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "raycaster.setFromCamera(pointer, camera);  const hits = raycaster.intersectObject(ball);",
            "marker.position.copy(hits[0].point);",
          ],
          solution:
            RAYCAST_SCENE +
            "raycaster.setFromCamera(pointer, camera);    // カメラから pointer を通るレイ\n" +
            "const hits = raycaster.intersectObject(ball);  // 当たった場所（近い順）\n" +
            "marker.position.copy(hits[0].point);\n",
        },
      },
    ],
  },
  {
    id: "three-animation",
    domain: "three",
    title: "アニメーション",
    summary: "回転の考え方と、キーフレームで動きを組み立てる AnimationClip。実アプリでは毎フレーム値を更新する。",
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
      {
        id: "three-keyframes",
        title: "キーフレームで動かす: AnimationClip",
        explanation:
          "<p>決まった動きは、<b>キーフレーム</b>（ある時刻にどこにいるか）を並べて作れます。<code>VectorKeyframeTrack</code> に" +
          "プロパティ名（<code>'.position'</code>）・時刻の配列・値の配列（x, y, z, x, y, z, …）を渡すと、キーフレームの間は" +
          "なめらかにつながります。トラックを <code>AnimationClip</code> にまとめ、<code>AnimationMixer</code> で再生して、" +
          "<code>mixer.update(秒)</code> で時間を進めます。実際のアプリでは毎フレーム呼びますが、ここでは 1秒進めた瞬間を" +
          "確かめます。</p>",
        challenge: {
          starterCode: KEYFRAME_SCENE(
            "const times = [0, 2];\n" +
              "const values = [\n" +
              "  0, -1.5, 0,  // 0 秒: 下\n" +
              "  0, -1.5, 0,  // 2 秒: 下\n" +
              "];\n",
          ),
          task: "キーフレームを 3つにして、0 秒で下 (0, -1.5, 0)、1 秒で上 (0, 1.5, 0)、2 秒でまた下を通る、跳ねるボールにしよう。",
          validators: [
            { kind: "noError" },
            {
              kind: "objectAt",
              position: [0, 1.5, 0],
              type: "Mesh",
              tol: 0.2,
              message: "1 秒の時点で、ボールが上 (0, 1.5, 0) に来ていません。times を [0, 1, 2] にして、1 秒の位置を足しましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.76, rgb: [1, 0.41, 0.71], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.24, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "const times = [0, 1, 2];",
            "values は 0, -1.5, 0,   0, 1.5, 0,   0, -1.5, 0（3つの位置を順に）",
          ],
          solution: KEYFRAME_SCENE(
            "const times = [0, 1, 2];\n" +
              "const values = [\n" +
              "  0, -1.5, 0,  // 0 秒: 下\n" +
              "  0, 1.5, 0,   // 1 秒: 上\n" +
              "  0, -1.5, 0,  // 2 秒: 下\n" +
              "];\n",
          ),
        },
      },
    ],
  },
  {
    id: "three-data",
    domain: "three",
    title: "データで描く: 点とテクスチャ",
    summary: "数値の配列や Canvas 2D から、点の集まりやテクスチャを自分で組み立て、くり返して貼る。",
    icon: "🧮",
    lessons: [
      {
        id: "three-points",
        title: "点の集まり: Points",
        explanation:
          "<p>星やパーティクルのような<b>たくさんの点</b>は <code>Points</code> で描きます。座標は " +
          "<code>Float32Array</code> に <code>x, y, z, x, y, z, …</code> と並べ、" +
          "<code>new THREE.BufferAttribute(配列, 3)</code>（3つの数で 1点）にして " +
          "<code>geometry.setAttribute('position', …)</code> で渡します。見た目は <code>PointsMaterial</code> で決め、" +
          "<code>size</code> が点の大きさです（点は画面に正対する正方形として描かれます）。</p>",
        challenge: {
          starterCode:
            "// 半径 2 の円周上に 12 個の点を並べた座標（x, y, z, x, y, z, …）\n" +
            "const count = 12;\n" +
            "const positions = new Float32Array(count * 3);\n" +
            "for (let i = 0; i < count; i++) {\n" +
            "  const a = (i / count) * Math.PI * 2;\n" +
            "  positions[i * 3] = Math.cos(a) * 2;\n" +
            "  positions[i * 3 + 1] = Math.sin(a) * 2;\n" +
            "  positions[i * 3 + 2] = 0;\n" +
            "}\n\n" +
            "const geo = new THREE.BufferGeometry();\n" +
            "// ① positions を 'position' 属性として geo に渡そう\n\n" +
            "const mat = new THREE.PointsMaterial({ color: 'gold', size: 1.5 });\n" +
            "// ② geo と mat から Points を作って scene に追加しよう\n",
          task: "positions を BufferAttribute にして geo の 'position' に設定し、Points を作って scene に追加しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "setAttribute" },
            { kind: "sceneHas", type: "Points" },
            { kind: "materialOf", material: "PointsMaterial", type: "Points" },
            // The ring's top and bottom points sit on the centre line; its middle is empty.
            { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: [1, 0.84, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.16, rgb: [1, 0.84, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));",
            "const stars = new THREE.Points(geo, mat); scene.add(stars);",
          ],
          solution:
            "const count = 12;\n" +
            "const positions = new Float32Array(count * 3);\n" +
            "for (let i = 0; i < count; i++) {\n" +
            "  const a = (i / count) * Math.PI * 2;\n" +
            "  positions[i * 3] = Math.cos(a) * 2;\n" +
            "  positions[i * 3 + 1] = Math.sin(a) * 2;\n" +
            "  positions[i * 3 + 2] = 0;\n" +
            "}\n" +
            "const geo = new THREE.BufferGeometry();\n" +
            "geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n" +
            "const mat = new THREE.PointsMaterial({ color: 'gold', size: 1.5 });\n" +
            "const stars = new THREE.Points(geo, mat);\n" +
            "scene.add(stars);\n",
        },
      },
      {
        id: "three-data-texture",
        title: "コードで作る画像: DataTexture",
        explanation:
          "<p>画像ファイルが無くても、ピクセルの色を数値で並べればテクスチャになります。<code>Uint8Array</code> に" +
          "1ピクセルあたり <code>R, G, B, A</code>（0〜255）を、<b>下の段から</b>左→右の順に並べ、" +
          "<code>new THREE.DataTexture(配列, 幅, 高さ)</code> にします。中身を用意したら " +
          "<code>texture.needsUpdate = true</code> で「GPU に送って」と知らせるのを忘れずに。" +
          "忘れると、テクスチャは真っ黒のままです。</p>",
        challenge: {
          starterCode:
            "// 2×2 ピクセルの画像。1ピクセル = R, G, B, A（0〜255）、下の段から左→右の順\n" +
            "const data = new Uint8Array([\n" +
            "  255, 0, 0, 255,   0, 255, 0, 255,   // 下の段: 赤, 緑\n" +
            "  0, 0, 0, 255,     0, 0, 0, 255,     // 上の段: まだ黒\n" +
            "]);\n" +
            "const tex = new THREE.DataTexture(data, 2, 2);\n\n" +
            "const board = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
            ");\n" +
            "scene.add(board);\n",
          task: "上の段を左から青・白にし、tex の needsUpdate を true にしてテクスチャを GPU に送り、4色のタイルを表示しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "needsUpdate" },
            { kind: "materialOf", material: "MeshBasicMaterial" },
            // The centre line runs through the left column: red below, blue above.
            { kind: "pixelApprox", x: 0.5, y: 0.3, rgb: [1, 0, 0], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.7, rgb: [0, 0, 1], tol: 0.15 },
          ],
          hints: [
            "上の段は 0, 0, 255, 255,   255, 255, 255, 255,",
            "tex.needsUpdate = true;",
          ],
          solution:
            "const data = new Uint8Array([\n" +
            "  255, 0, 0, 255,   0, 255, 0, 255,\n" +
            "  0, 0, 255, 255,   255, 255, 255, 255,\n" +
            "]);\n" +
            "const tex = new THREE.DataTexture(data, 2, 2);\n" +
            "tex.needsUpdate = true;\n" +
            "const board = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
            ");\n" +
            "scene.add(board);\n",
        },
      },
      {
        id: "three-texture-repeat",
        title: "模様をくり返す: wrapS・wrapT と repeat",
        explanation:
          "<p>床のタイルや壁紙のように、小さな模様を<b>くり返して</b>貼るときは、テクスチャの <code>repeat</code> で回数を" +
          "決めます。ただし、はみ出した部分の扱いを決める <code>wrapS</code>（横）・<code>wrapT</code>（縦）は、初期値が" +
          "「端の色を引き伸ばす」（<code>ClampToEdgeWrapping</code>）です。<code>THREE.RepeatWrapping</code> に変えないと、" +
          "<code>repeat</code> を設定しても模様はくり返されません。</p>",
        challenge: {
          starterCode: STRIPE_TEXTURE + "\n// ここで、縞模様が縦に 4回くり返されるようにしよう\n\n" + STRIPE_BOARD,
          task: "tex の wrapS と wrapT を THREE.RepeatWrapping にし、repeat を (1, 4) にして、縞模様を縦に 4回くり返そう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "RepeatWrapping" },
            { kind: "materialOf", material: "MeshBasicMaterial" },
            // Eight stripes up the centre line, white at the bottom (checked
            // well inside stripes 0, 1, 3, 4, 6 and 7).
            { kind: "pixelApprox", x: 0.5, y: 0.22, rgb: STRIPE_WHITE, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: STRIPE_SKY, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.47, rgb: STRIPE_SKY, tol: 0.15 },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.53,
              rgb: STRIPE_WHITE,
              tol: 0.15,
              message: "縞模様がくり返されていません。repeat だけでなく、wrapS と wrapT も THREE.RepeatWrapping にしましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: STRIPE_WHITE, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: STRIPE_SKY, tol: 0.15 },
          ],
          hints: [
            "tex.wrapS = THREE.RepeatWrapping;  tex.wrapT = THREE.RepeatWrapping;",
            "tex.repeat.set(1, 4);  // 横 1回・縦 4回",
          ],
          solution:
            STRIPE_TEXTURE +
            "tex.wrapS = THREE.RepeatWrapping;\n" +
            "tex.wrapT = THREE.RepeatWrapping;\n" +
            "tex.repeat.set(1, 4);\n" +
            STRIPE_BOARD,
        },
      },
      {
        id: "three-canvas-texture",
        title: "コードで描いて貼る: CanvasTexture",
        explanation:
          "<p>画像ファイルが無くても、<code>canvas</code> 要素に Canvas 2D で描いた絵を、そのままテクスチャにできます。" +
          "<code>new THREE.CanvasTexture(canvas)</code> で作り、マテリアルの <code>map</code> に設定します。canvas の色は" +
          "画面の色（sRGB）なので、<code>colorSpace</code> を <code>THREE.SRGBColorSpace</code> にしておくと、描いたとおりの色で" +
          "表示されます（指定しないと白っぽく浮きます）。文字やグラフ、ラベルを 3D に貼るときの定番の方法です。</p>",
        challenge: {
          starterCode:
            CANVAS_DRAWING +
            "\n// ここで canvas から CanvasTexture を作り、板のマテリアルの map に設定しよう\n" +
            "const board = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ color: 'white' }),\n" +
            ");\n" +
            "scene.add(board);\n",
          task: "canvas から CanvasTexture を作って colorSpace を THREE.SRGBColorSpace にし、板のマテリアルの map に設定しよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "new THREE\\.CanvasTexture" },
            { kind: "materialOf", material: "MeshBasicMaterial" },
            // The picture up the centre line, in the colours it was drawn in.
            { kind: "pixelApprox", x: 0.5, y: 0.78, rgb: [0.53, 0.81, 0.92], tol: 0.15 },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.53,
              rgb: [1, 0.39, 0.28],
              tol: 0.15,
              message:
                "canvas の絵が、描いたとおりの色で貼られていません。map に CanvasTexture を設定し、colorSpace を THREE.SRGBColorSpace にしましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.18, 0.55, 0.34], tol: 0.15 },
          ],
          hints: [
            "const tex = new THREE.CanvasTexture(canvas);  tex.colorSpace = THREE.SRGBColorSpace;",
            "new THREE.MeshBasicMaterial({ map: tex })",
          ],
          solution:
            CANVAS_DRAWING +
            "const tex = new THREE.CanvasTexture(canvas);\n" +
            "tex.colorSpace = THREE.SRGBColorSpace;  // canvas の色は画面の色（sRGB）\n" +
            "const board = new THREE.Mesh(\n" +
            "  new THREE.PlaneGeometry(4, 4),\n" +
            "  new THREE.MeshBasicMaterial({ map: tex }),\n" +
            ");\n" +
            "scene.add(board);\n",
        },
      },
    ],
  },
  {
    id: "three-curves",
    domain: "three",
    title: "線から形をつくる",
    summary: "断面の輪郭を回して器に、2D の輪郭を押し出して立体に、3D の曲線にそって管にする。",
    icon: "🏺",
    lessons: [
      {
        id: "three-lathe",
        title: "回して作る: LatheGeometry",
        explanation:
          "<p>ろくろで器を作るように、<b>断面の輪郭</b>を縦の軸（y 軸）のまわりに 1周回すと、つぼやグラスのような形ができます。" +
          "<code>LatheGeometry(点の配列, 分割数)</code> の点は <code>Vector2(軸からの距離, 高さ)</code> で、下から順に並べます。" +
          "x が半径、y が高さです（逆にすると、まったく違う形になります）。分割数を増やすほど、まわりがなめらかになります。</p>",
        challenge: {
          starterCode:
            VASE_PROFILE +
            "// いまはただの円柱。points を y 軸のまわりに回した形にしよう\n" +
            "const geo = new THREE.CylinderGeometry(1, 1, 3, 48);\n" +
            VASE_MESH,
          task: "円柱の代わりに LatheGeometry(points, 48) を使って、断面 points を回したつぼを作ろう。",
          validators: [
            { kind: "noError" },
            { kind: "geometryOf", geometry: "LatheGeometry" },
            // Up the centre line, MeshNormalMaterial shows which way the surface
            // faces: down at the bulging body, up at the narrowing shoulder (a
            // cylinder faces straight ahead everywhere).
            {
              kind: "allOf",
              of: [
                { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.41, 0.28, 0.94], tol: 0.12 },
                { kind: "pixelApprox", x: 0.5, y: 0.59, rgb: [0.39, 0.71, 0.94], tol: 0.12 },
              ],
              message: "つぼのふくらみと肩の形が見えません。円柱の代わりに LatheGeometry(points, 48) を使いましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.9, rgb: BACKGROUND, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.1, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "const geo = new THREE.LatheGeometry(points, 48);",
            "Vector2 の x が軸からの距離（半径）、y が高さです",
          ],
          solution: VASE_PROFILE + "const geo = new THREE.LatheGeometry(points, 48);  // 断面を y 軸のまわりに回す\n" + VASE_MESH,
        },
      },
      {
        id: "three-extrude",
        title: "押し出して厚みをつける: ExtrudeGeometry",
        explanation:
          "<p>2D の輪郭は <code>THREE.Shape</code> で描けます。<code>moveTo(x, y)</code> で書き始めの点へ移り、<code>lineTo(x, y)</code> で線を引いていきます。" +
          "それを <code>ShapeGeometry</code> にすると厚みのない板ですが、<code>ExtrudeGeometry(shape, { depth: 厚み, bevelEnabled: false })</code> にすると、" +
          "輪郭を z の方向へ押し出した立体になります（クッキーの型抜きのイメージ）。<code>bevelEnabled</code> を true（初期値）のままにすると、" +
          "角が斜めに削られます。ロゴや文字を立体にするときの基本です。</p>",
        challenge: {
          starterCode:
            GEM_OUTLINE +
            "// いまは厚みのない板。輪郭を押し出して、厚み 0.8 の立体にしよう\n" +
            "const geo = new THREE.ShapeGeometry(shape);\n" +
            GEM_MESH,
          task: "ShapeGeometry を ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false }) に替えて、宝石の輪郭を厚み 0.8 の立体にしよう。",
          validators: [
            { kind: "noError" },
            { kind: "geometryOf", geometry: "ExtrudeGeometry" },
            // Seen from above, the extruded top wall shows as a band above the
            // face (normal colour: facing up), and the face, pushed towards the
            // camera, reaches lower than the flat outline.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.66,
              rgb: [0.5, 0.85, 0.85],
              tol: 0.15,
              message: "上から見たときの厚みの面が見えません。ShapeGeometry を ExtrudeGeometry にして、depth を 0.8 にしましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.5, 0.15, 0.85], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: [0.5, 0.15, 0.85], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.84, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });",
            "depth が押し出す長さ（厚み）です",
          ],
          solution:
            GEM_OUTLINE +
            "const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });  // z の方向へ 0.8 押し出す\n" +
            GEM_MESH,
        },
      },
      {
        id: "three-tube",
        title: "曲線にそって: TubeGeometry",
        explanation:
          "<p>3D の点の列を <code>CatmullRomCurve3</code> に渡すと、点をなめらかに通る曲線になります。その曲線にそって太さのある管を作るのが " +
          "<code>TubeGeometry(曲線, 長さ方向の分割数, 半径, 断面の分割数)</code> です。ケーブルやパイプ、ジェットコースターのレール、ばねなど、" +
          "曲がりくねった形に使えます。長さ方向の分割数が少ないと、なめらかな曲線がカクカクの折れ線になります。</p>",
        challenge: {
          starterCode:
            SPRING_CURVE +
            "\n// ここで、curve にそって半径 0.22 の管（TubeGeometry）を作り、MeshNormalMaterial で scene に追加しよう\n",
          task: "curve にそって TubeGeometry(curve, 300, 0.22, 16) の管を作り、MeshNormalMaterial で scene に追加して、ばねにしよう。",
          validators: [
            { kind: "noError" },
            { kind: "geometryOf", geometry: "TubeGeometry" },
            // The coils cross the centre line in front (bottom, middle, top)
            // and behind (upper); between them the background shows through.
            // Which way the tube faces changes across its width, but every
            // MeshNormalMaterial colour lies 0.5 from mid-grey, while the
            // background and the white dots are 0.8 or more away from it.
            {
              kind: "allOf",
              of: [0.16, 0.53, 0.59, 0.84].map((y) => ({
                kind: "pixelApprox" as const,
                x: 0.5,
                y,
                rgb: NORMAL_COLOURED,
                tol: 0.55,
              })),
              message: "ばねの管が、曲線の通る所に見えません。TubeGeometry(curve, 300, 0.22, 16) の Mesh を scene に追加しましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: BACKGROUND, tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: BACKGROUND, tol: 0.15 },
          ],
          hints: [
            "const geo = new THREE.TubeGeometry(curve, 300, 0.22, 16);",
            "const spring = new THREE.Mesh(geo, new THREE.MeshNormalMaterial()); scene.add(spring);",
          ],
          solution:
            SPRING_CURVE +
            "const spring = new THREE.Mesh(\n" +
            "  new THREE.TubeGeometry(curve, 300, 0.22, 16),  // 曲線, 長さ方向の分割, 半径, 断面の分割\n" +
            "  new THREE.MeshNormalMaterial(),\n" +
            ");\n" +
            "scene.add(spring);\n",
        },
      },
    ],
  },
  {
    id: "three-lines-sprites",
    domain: "three",
    title: "線とスプライト",
    summary: "点をつないで折れ線グラフを引き、いつもカメラを向くスプライトで光の玉やラベルを置く。",
    icon: "📈",
    lessons: [
      {
        id: "three-line",
        title: "点をつないで線を引く: Line",
        explanation:
          "<p>折れ線グラフや軌跡のような<b>線</b>は <code>Line</code> で描きます。<code>new THREE.BufferGeometry().setFromPoints(点の配列)</code> で" +
          "点をジオメトリにし、<code>LineBasicMaterial</code> と組み合わせると、点が順番に 1本の線でつながります。線の太さは WebGL ではほぼ必ず " +
          "1 ピクセルなので、太い線が欲しいときは別の方法（細長い形など）を使います。最初と最後もつなぎたいときは <code>LineLoop</code>、" +
          "2点ずつ別々の線にしたいときは <code>LineSegments</code> です。</p>",
        challenge: {
          starterCode: CHART_SCENE + "\n// ここで、points を順につなぐ水色の Line を作って scene に追加しよう\n",
          task: "points から BufferGeometry を作り、LineBasicMaterial（色 'cyan'）の Line にして scene に追加し、点を折れ線でつなごう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "LineBasicMaterial" },
            {
              kind: "anyOf",
              of: [
                { kind: "sceneHas", type: "Line" },
                { kind: "sceneHas", type: "LineLoop" },
              ],
              message: "Line（または LineLoop）が scene にありません。new THREE.Line(ジオメトリ, マテリアル) を作って scene.add しましょう",
            },
            { kind: "materialOf", material: "LineBasicMaterial" },
            // A 1 px line cannot be read back reliably, so the polyline is
            // judged on its geometry: every one of the six points.
            {
              kind: "anyOf",
              of: [
                { kind: "verticesAtLeast", min: 6, type: "Line" },
                { kind: "verticesAtLeast", min: 6, type: "LineLoop" },
              ],
              message: "線が 6個の点すべてを通っていません。new THREE.BufferGeometry().setFromPoints(points) で全部の点を渡しましょう",
            },
            { kind: "colorApprox", rgb: [0, 1, 1], tol: 0.15 },
            { kind: "rendersNonEmpty" },
          ],
          hints: [
            "const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 'cyan' }));",
            "scene.add(line);",
          ],
          solution:
            CHART_SCENE +
            "const line = new THREE.Line(\n" +
            "  new THREE.BufferGeometry().setFromPoints(points),  // 点を順につなぐ\n" +
            "  new THREE.LineBasicMaterial({ color: 'cyan' }),\n" +
            ");\n" +
            "scene.add(line);\n",
        },
      },
      {
        id: "three-sprite",
        title: "いつもカメラを向く: Sprite",
        explanation:
          "<p><code>Sprite</code> は、<b>どこから見てもカメラのほうを向く</b>平らな絵です。光の玉やラベル、遠くの木など、立体にしなくてよいものに使います。" +
          "<code>new THREE.Sprite(new THREE.SpriteMaterial({ color }))</code> で作り、位置は普通のオブジェクトと同じく <code>position</code> で決めます。" +
          "大きさは <code>scale</code> で、初期値は 1×1 です。普通の板（<code>PlaneGeometry</code>）は向きが固定なので、横から見ると薄い線になって" +
          "消えますが、Sprite は消えません。</p>",
        challenge: {
          starterCode: ORBS_SCENE(
            "  // いまは正面（+Z）を向いた板。横から見ているので、薄い線になって見えない\n" +
              "  const orb = new THREE.Mesh(\n" +
              "    new THREE.PlaneGeometry(1, 1),\n" +
              "    new THREE.MeshBasicMaterial({ color }),\n" +
              "  );\n",
          ),
          task: "板の Mesh を、SpriteMaterial を使った Sprite に替えて、横から見ても 3つの玉が見えるようにしよう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "SpriteMaterial" },
            {
              kind: "sceneHas",
              type: "Sprite",
              min: 3,
              message: "Sprite が 3つありません。new THREE.Sprite(new THREE.SpriteMaterial({ color })) にしましょう",
            },
            // The three orbs up the centre line, seen from the side (the
            // planes are edge-on there and draw nothing).
            { kind: "pixelApprox", x: 0.5, y: 0.75, rgb: [1, 0.41, 0.71], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0, 0.75, 1], tol: 0.15 },
            { kind: "pixelApprox", x: 0.5, y: 0.25, rgb: [1, 0.84, 0], tol: 0.15 },
          ],
          hints: [
            "const orb = new THREE.Sprite(new THREE.SpriteMaterial({ color }));",
            "Sprite にジオメトリは要りません。向きはいつもカメラのほうです",
          ],
          solution: ORBS_SCENE("  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ color }));  // いつもカメラを向く\n"),
        },
      },
    ],
  },
  {
    id: "three-atmosphere",
    domain: "three",
    title: "空気感: 霧と影",
    summary: "Fog と FogExp2 で遠くをかすませ、影を落として、シーンに奥行きと接地感を出す。",
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
        id: "three-fog-exp2",
        title: "濃さで決める霧: FogExp2",
        explanation:
          "<p><code>THREE.FogExp2(色, 濃さ)</code> は、距離の範囲ではなく<b>濃さ（density）</b>だけで決まる霧です。近くはほとんど透けていて、" +
          "遠くへ行くほど急に濃くなるので、<code>Fog</code> のような「ここから先は霧」という境目ができず、本物のもやに近く見えます。" +
          "霧の色は背景色 <code>scene.background</code> とそろえるのがコツで、遠くの物が空に溶けこんでいきます。濃さは 0.1 前後から試すと扱いやすい値です。</p>",
        challenge: {
          starterCode: MEADOW_SCENE + "\n// ここで scene.fog を設定して、遠くの草原と木を空の色に溶かそう\n",
          task: "scene.fog に THREE.FogExp2（色は背景と同じ 'lightblue'・濃さ 0.12）を設定して、遠くの草原と木を空の色に溶かそう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "FogExp2" },
            // The meadow up the centre line: nearly clear at the bottom, half
            // gone further back, and the sky's own colour at the horizon.
            { kind: "pixelApprox", x: 0.5, y: 0.03, rgb: [0.2, 0.56, 0.37], tol: 0.1 },
            {
              kind: "allOf",
              of: [
                { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: [0.36, 0.65, 0.54], tol: 0.1 },
                { kind: "pixelApprox", x: 0.5, y: 0.41, rgb: [0.54, 0.76, 0.74], tol: 0.1 },
              ],
              message: "草原のかすみ方が目標と違います。FogExp2 の濃さを 0.12 にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.47,
              rgb: SKY_BLUE,
              tol: 0.1,
              message: "草原の奥が空の色に溶けていません。霧の色を背景と同じ 'lightblue' にしましょう",
            },
          ],
          hints: [
            "scene.fog = new THREE.FogExp2('lightblue', 0.12);",
            "霧の色と背景色が同じだと、遠くの物が空に溶けて見えます",
          ],
          solution: MEADOW_SCENE + "scene.fog = new THREE.FogExp2('lightblue', 0.12);  // 背景と同じ色の霧\n",
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
      {
        id: "three-shadow-material",
        title: "影だけを受ける床: ShadowMaterial",
        explanation:
          "<p><code>ShadowMaterial</code> は、<b>影の部分だけ</b>が描かれ、それ以外は透明になるマテリアルです。床を見せずに影だけを落としたいとき" +
          "（空に浮かぶ物、AR のように背景の上に置く物）に使います。影を受けるには普通の床と同じく <code>receiveShadow</code> が要ります。" +
          "<code>opacity</code> が影の濃さで、1 だと真っ黒、0.4 くらいが自然です。</p>",
        challenge: {
          starterCode:
            SKY_SHADOW_SCENE("new THREE.MeshStandardMaterial({ color: 'white' })") +
            "\n// 床のマテリアルを替えて、白い床を消し、影だけを空の上に残そう\n",
          task: "床のマテリアルを opacity 0.4 の ShadowMaterial に替えて、白い床を消し、球の影だけを空の上に残そう。",
          validators: [
            { kind: "noError" },
            { kind: "sourceMatches", pattern: "ShadowMaterial" },
            { kind: "materialOf", material: "ShadowMaterial" },
            { kind: "sceneHas", type: "DirectionalLight" },
            // Measured in headless Chrome at 1:1 and 16:9: the sky where the
            // floor was, the shadow at 0.6 of the sky's brightness right below
            // the ball (black with the default opacity, the plain sky without
            // receiveShadow), and the lit ball above it.
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.16,
              rgb: SKY_BLUE,
              tol: 0.1,
              message: "床がまだ見えています。床のマテリアルを ShadowMaterial にして、影以外を透明にしましょう",
            },
            {
              kind: "pixelApprox",
              x: 0.5,
              y: 0.47,
              rgb: [0.41, 0.51, 0.54],
              tol: 0.15,
              message: "影の濃さが目標と違います。ShadowMaterial の opacity を 0.4 にして、floor の receiveShadow はそのまま残しましょう",
            },
            { kind: "pixelApprox", x: 0.5, y: 0.66, rgb: [0.9, 0.36, 0.27], tol: 0.15 },
          ],
          hints: [
            "new THREE.ShadowMaterial({ opacity: 0.4 })",
            "receiveShadow = true はそのまま。消すと影も消えます",
          ],
          solution: SKY_SHADOW_SCENE("new THREE.ShadowMaterial({ opacity: 0.4 })  // 影の部分だけ描く"),
        },
      },
    ],
  },
];
