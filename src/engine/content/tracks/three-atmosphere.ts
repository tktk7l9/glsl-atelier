// The three-atmosphere track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND, SKY_BLUE } from "./shared-three.js";

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

export const track: Track = {
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
          // receiveShadow; opacities 0.3–0.5 stay within the tolerance), and
          // the lit ball above it.
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
            tol: 0.2,
            message: "影の濃さが目標と違います。ShadowMaterial の opacity を 0.4 にして、floor の receiveShadow はそのまま残しましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.66, rgb: [0.9, 0.36, 0.27], tol: 0.15 },
        ],
        hints: [
          "new THREE.ShadowMaterial({ opacity: 0.4 })",
          "receiveShadow = true はそのまま。消すと影も消えます",
        ],
        solution: SKY_SHADOW_SCENE("new THREE.ShadowMaterial({ opacity: 0.4 })"),
      },
    },
  ],
};
