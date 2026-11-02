// The three-render-target track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The monitor lesson: a small world to film, and its camera. */
const STUDIO =
  "// 画面に映す小さな世界と、そのカメラ\n" +
  "const studio = new THREE.Scene();\n" +
  "studio.background = new THREE.Color('gold');\n" +
  "studio.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 'magenta' })));\n" +
  "const studioCam = new THREE.PerspectiveCamera(50, 1, 0.1, 20);\n" +
  "studioCam.position.z = 3;\n\n" +
  "// 描き込み先（256×256 の見えない画面）\n" +
  "const rt = new THREE.WebGLRenderTarget(256, 256);\n\n";

const monitor = (material: string): string =>
  "// モニターの板\n" +
  `const screen = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ ${material} }));\n` +
  "scene.add(screen);\n";

/** The post-processing lessons' world, drawn into `rt` first. */
const WORLD =
  "// いったんテクスチャに描く世界\n" +
  "const world = new THREE.Scene();\n" +
  "world.background = new THREE.Color('white');\n" +
  "world.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16), new THREE.MeshBasicMaterial({ color: 'tomato' })));\n\n" +
  "const { width, height } = renderer.domElement;\n" +
  "const rt = new THREE.WebGLRenderTarget(width, height);\n" +
  "renderer.setRenderTarget(rt);\n" +
  "renderer.render(world, camera);\n" +
  "renderer.setRenderTarget(null);\n\n";

/** A plane that fills the screen whatever the camera: the vertex shader writes
 *  clip coordinates directly, so the plane must not be culled. */
const QUAD_VERTEX =
  "const vertexShader = `\n" +
  "  varying vec2 vUv;\n" +
  "  void main() {\n" +
  "    vUv = uv;\n" +
  "    gl_Position = vec4(position.xy, 0.0, 1.0);  // カメラを通さず、画面いっぱいに\n" +
  "  }\n" +
  "`;\n";

const quad = (uniforms: string): string =>
  "const quad = new THREE.Mesh(\n" +
  "  new THREE.PlaneGeometry(2, 2),\n" +
  `  new THREE.ShaderMaterial({ uniforms: { ${uniforms} }, vertexShader, fragmentShader, depthTest: false }),\n` +
  ");\n" +
  "quad.frustumCulled = false;  // カメラの視野の判定で消されないように\n" +
  "scene.add(quad);\n";

const postFragment = (body: string): string =>
  "const fragmentShader = `\n" +
  "  uniform sampler2D uScene;\n" +
  "  varying vec2 vUv;\n" +
  "  void main() {\n" +
  "    vec3 c = texture2D(uScene, vUv).rgb;\n" +
  body +
  "  }\n" +
  "`;\n\n";

/** The depth lesson: a ball 5 from the camera, a wall 8 away, and a target
 *  that keeps the depth in a texture. */
const DEPTH_WORLD =
  "// 奥行きを測る near と far（カメラは z = 5）\n" +
  "camera.near = 1;\n" +
  "camera.far = 9;\n" +
  "camera.updateProjectionMatrix();\n\n" +
  "const world = new THREE.Scene();\n" +
  "const gray = new THREE.MeshBasicMaterial({ color: 'gray' });\n" +
  "world.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), gray));  // カメラから 4〜5 の距離\n" +
  "const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), gray);\n" +
  "wall.position.z = -3;  // カメラから 8 の距離\n" +
  "world.add(wall);\n\n" +
  "const { width, height } = renderer.domElement;\n" +
  "// 色といっしょに、深度もテクスチャに残す\n" +
  "const rt = new THREE.WebGLRenderTarget(width, height, {\n" +
  "  depthTexture: new THREE.DepthTexture(width, height),\n" +
  "});\n" +
  "renderer.setRenderTarget(rt);\n" +
  "renderer.render(world, camera);\n" +
  "renderer.setRenderTarget(null);\n\n";

const depthFragment = (body: string): string =>
  "const fragmentShader = `\n" +
  "  #include <packing>\n" +
  "  uniform sampler2D uDepth;\n" +
  "  uniform float uNear;\n" +
  "  uniform float uFar;\n" +
  "  varying vec2 vUv;\n" +
  "  void main() {\n" +
  "    float d = texture2D(uDepth, vUv).x;  // 深度バッファの値（0〜1）\n" +
  body +
  "  }\n" +
  "`;\n\n";

const DEPTH_UNIFORMS = "uDepth: { value: rt.depthTexture }, uNear: { value: camera.near }, uFar: { value: camera.far }";

/** Tomato's Rec. 709 luminance: 0.307 in linear light, 0.59 once encoded. */
const TOMATO_GREY: [number, number, number] = [0.59, 0.59, 0.59];

export const track: Track = {
  id: "three-render-target",
  domain: "three",
  title: "絵をテクスチャに描く",
  summary: "WebGLRenderTarget にシーンを描いて板に貼り、画面全体のポストエフェクトをかけ、深度テクスチャから距離を読み取る。",
  icon: "🎞️",
  lessons: [
    {
      id: "three-rt-monitor",
      title: "画面の中の画面: WebGLRenderTarget",
      explanation:
        "<p><code>renderer.render</code> の描き先は、画面だけではありません。<code>WebGLRenderTarget</code> は見えない画面で、ここに描いた絵は " +
        "<code>rt.texture</code> というテクスチャになります。手順は 3つです。<code>renderer.setRenderTarget(rt)</code> で描き先を替え、" +
        "<code>renderer.render(シーン, カメラ)</code> で描き、<code>renderer.setRenderTarget(null)</code> で画面に戻します。" +
        "あとは <code>rt.texture</code> を <code>map</code> に渡せば、ゲームの中のモニターや、鏡、監視カメラの絵になります。" +
        "画面に戻し忘れると、そのあとの描画も見えない画面へ行ってしまうので、プレビューが空になります。</p>",
      challenge: {
        starterCode:
          STUDIO +
          "// ここで、描き先を rt に替えて studio を描き、画面に戻そう\n\n" +
          monitor("color: 'gray'"),
        task: "studio を studioCam で rt に描いてから描き先を null に戻し、板のマテリアルの map に rt.texture を設定しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "setRenderTarget" },
          { kind: "sourceMatches", pattern: "\\.texture\\b" },
          // The filmed picture: the magenta box in the middle of the gold
          // background, at the same colours as the names say.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: [1, 0, 1], tol: 0.15 },
              { kind: "pixelApprox", x: 0.5208, y: 0.7708, rgb: [1, 0.84, 0], tol: 0.15 },
              { kind: "pixelApprox", x: 0.5208, y: 0.2292, rgb: [1, 0.84, 0], tol: 0.15 },
            ],
            message: "板にモニターの絵が映っていません。setRenderTarget(rt) → render(studio, studioCam) → setRenderTarget(null) の順に呼び、板の map を rt.texture にしましょう",
          },
        ],
        hints: [
          "renderer.setRenderTarget(rt);\nrenderer.render(studio, studioCam);\nrenderer.setRenderTarget(null);",
          "new THREE.MeshBasicMaterial({ map: rt.texture })",
          "プレビューが空のときは、setRenderTarget(null) を忘れていないか確かめましょう",
        ],
        solution:
          STUDIO +
          "renderer.setRenderTarget(rt);\n" +
          "renderer.render(studio, studioCam);\n" +
          "renderer.setRenderTarget(null);  // 描き先を画面に戻す\n\n" +
          monitor("map: rt.texture"),
      },
    },
    {
      id: "three-rt-post",
      title: "画面全体にかける: ポストエフェクト",
      explanation:
        "<p>GLSL トラックのフィルタは、1枚の絵を読んで色を作り直すものでした。3D シーンにかけるときも同じです。シーンをいったん render target に描き、" +
        "画面いっぱいの板に貼って、その板の <code>ShaderMaterial</code> で色を計算します。板を画面いっぱいにするには、頂点シェーダーでカメラの計算を通さず、" +
        "<code>gl_Position = vec4(position.xy, 0.0, 1.0)</code> と書きます。</p>" +
        "<p>注意が 1つあります。render target の中身は<b>リニア</b>な値です。普通のマテリアルは最後に画面の色（sRGB）へ直しますが、" +
        "<code>ShaderMaterial</code> は自動では直しません。<code>gl_FragColor</code> に書いたあとで <code>#include &lt;colorspace_fragment&gt;</code> と書くと、" +
        "Three.js の変換が入ります。これが無いと、中間の明るさが暗く沈みます。</p>",
      challenge: {
        starterCode:
          WORLD +
          QUAD_VERTEX +
          postFragment(
            "    // ここで c を輝度の白黒にし、最後に画面の色へ直そう（いまは暗く沈んでいる）\n" +
              "    gl_FragColor = vec4(c, 1.0);\n",
          ) +
          quad("uScene: { value: rt.texture }"),
        task: "c を輝度 dot(c, vec3(0.2126, 0.7152, 0.0722)) の白黒にして gl_FragColor に書き、続けて #include <colorspace_fragment> を足そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "dot\\s*\\(" },
          { kind: "sourceMatches", pattern: "#include\\s*<colorspace_fragment>" },
          { kind: "materialOf", material: "ShaderMaterial" },
          // The ball's grey in screen colour (0.31 without the conversion, 0.66
          // for a plain average), and the white background.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5208, y: 0.5208, rgb: TOMATO_GREY, tol: 0.08 },
              { kind: "pixelApprox", x: 0.5208, y: 0.9375, rgb: [1, 1, 1], tol: 0.08 },
            ],
            message: "球の明るさが目標と違います。輝度を dot(c, vec3(0.2126, 0.7152, 0.0722)) で求めて白黒にし、gl_FragColor のあとに #include <colorspace_fragment> を足しましょう",
          },
        ],
        hints: [
          "float g = dot(c, vec3(0.2126, 0.7152, 0.0722));",
          "gl_FragColor = vec4(vec3(g), 1.0);",
          "#include <colorspace_fragment> は、gl_FragColor を書いた次の行に、1行だけで書きます",
        ],
        solution:
          WORLD +
          QUAD_VERTEX +
          postFragment(
            "    float g = dot(c, vec3(0.2126, 0.7152, 0.0722));  // 輝度\n" +
              "    gl_FragColor = vec4(vec3(g), 1.0);\n" +
              "    #include <colorspace_fragment>\n",
          ) +
          quad("uScene: { value: rt.texture }"),
      },
    },
    {
      id: "three-rt-depth",
      title: "距離を読む: 深度テクスチャ",
      explanation:
        "<p>render target に <code>depthTexture</code> を付けると、色だけでなく<b>深度</b>（カメラからの奥行き）もテクスチャとして読めます。" +
        "霧、被写界深度、ふちの抽出など、多くのポストエフェクトの材料です。ただし深度の値は距離に比例しません。透視カメラの深度は手前に精度を割くため、" +
        "遠くの物はみな 1 に近い値になります。Three.js の <code>#include &lt;packing&gt;</code> には変換の関数があり、" +
        "<code>perspectiveDepthToViewZ(d, near, far)</code> でカメラ空間の z に直し、<code>viewZToOrthographicDepth(z, near, far)</code> で " +
        "near が 0、far が 1 の比例した値に直せます。</p>",
      challenge: {
        starterCode:
          DEPTH_WORLD +
          QUAD_VERTEX +
          depthFragment(
            "    // ここで d を、距離に比例した値に直そう（いまは全体が白っぽい）\n" +
              "    gl_FragColor = vec4(vec3(d), 1.0);\n",
          ) +
          quad(DEPTH_UNIFORMS),
        task: "d を perspectiveDepthToViewZ と viewZToOrthographicDepth で比例した値 l に直し、手前ほど白くなるよう vec3(1.0 - l) で表示しよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "perspectiveDepthToViewZ" },
          { kind: "sourceMatches", pattern: "viewZToOrthographicDepth" },
          // The front of the ball is 4 away: (4 - 1) / 8 = 0.375, shown 0.625.
          // The wall is 8 away: 0.875, shown 0.125. The raw depth is above 0.85
          // at both.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.625, 0.625, 0.625], tol: 0.1 },
              { kind: "pixelApprox", x: 0.5208, y: 0.9375, rgb: [0.125, 0.125, 0.125], tol: 0.1 },
            ],
            message: "奥行きの明るさが目標と違います。perspectiveDepthToViewZ(d, uNear, uFar) の結果を viewZToOrthographicDepth に通して l とし、vec3(1.0 - l) で表示しましょう",
          },
        ],
        hints: [
          "float z = perspectiveDepthToViewZ(d, uNear, uFar);",
          "float l = viewZToOrthographicDepth(z, uNear, uFar);",
          "gl_FragColor = vec4(vec3(1.0 - l), 1.0);  // 手前ほど白く",
        ],
        solution:
          DEPTH_WORLD +
          QUAD_VERTEX +
          depthFragment(
            "    float z = perspectiveDepthToViewZ(d, uNear, uFar);    // カメラ空間の z\n" +
              "    float l = viewZToOrthographicDepth(z, uNear, uFar);  // near で 0、far で 1\n" +
              "    gl_FragColor = vec4(vec3(1.0 - l), 1.0);             // 手前ほど白く\n",
          ) +
          quad(DEPTH_UNIFORMS),
      },
    },
  ],
};
