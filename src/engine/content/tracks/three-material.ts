// The three-material track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

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

export const track: Track = {
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
};
