// The three-deform track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

/** The wave lesson: a finely divided board, `move` run for every vertex
 *  (with its y in `y`), then `after`, the board tilted to show the waves. */
const WAVE_BOARD = (move: string, after: string): string =>
  "// 縦横 40マスに分けた板（頂点は 41 × 41 = 1681個）\n" +
  "const geo = new THREE.PlaneGeometry(4, 4, 40, 40);\n" +
  "const pos = geo.attributes.position;  // 頂点の位置（x, y, z が頂点の数だけ並ぶ）\n" +
  "for (let i = 0; i < pos.count; i++) {\n" +
  "  const y = pos.getY(i);\n" +
  move +
  "}\n" +
  after +
  "const wave = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());  // 面の向きを色で表すマテリアル\n" +
  "wave.rotation.x = -0.6;  // 上を奥へ傾けて、波が見えるように\n" +
  "scene.add(wave);\n";

/** The height-colour lesson: heights from y, `paint` run per vertex. */
const LAND = (paint: string): string =>
  "const geo = new THREE.PlaneGeometry(4, 4, 40, 40);\n" +
  "const pos = geo.attributes.position;\n" +
  "const colors = new Float32Array(pos.count * 3);  // 頂点ごとの色（r, g, b を頂点の数だけ）\n" +
  "const low = new THREE.Color('navy');   // いちばん低い所の色\n" +
  "const high = new THREE.Color('gold');  // いちばん高い所の色\n" +
  "const c = new THREE.Color();\n" +
  "for (let i = 0; i < pos.count; i++) {\n" +
  "  const h = Math.sin(pos.getY(i) * 1.5);  // この頂点の高さ（-1〜1）\n" +
  "  pos.setZ(i, 0.4 * h);\n" +
  paint +
  "}\n" +
  "geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));\n" +
  "const land = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));\n" +
  "land.rotation.x = -0.6;\n" +
  "scene.add(land);\n";

/** The morph lesson: a circle and its star-shaped morph target positions;
 *  `target` registers them, `influence` sets how much they count. */
const STAR_SCENE = (target: string, influence: string): string =>
  "// 半径 1.5 の円（中心の頂点 0 と、ふちの頂点 1〜11。ふちの頂点 1 が真上）\n" +
  "const geo = new THREE.CircleGeometry(1.5, 10, Math.PI / 2);\n" +
  "const pos = geo.attributes.position;\n" +
  "// 変形後の形: ふちの頂点を 1つおきに半径 0.5 まで引っこめた星形\n" +
  "const star = [];\n" +
  "for (let i = 0; i < pos.count; i++) {\n" +
  "  const v = new THREE.Vector3().fromBufferAttribute(pos, i);\n" +
  "  if (i > 0 && i % 2 === 0) v.setLength(0.5);\n" +
  "  star.push(v.x, v.y, v.z);\n" +
  "}\n" +
  target +
  "const shape = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 'gold' }));\n" +
  "scene.add(shape);\n" +
  influence;

const GOLD: [number, number, number] = [1, 0.84, 0];

export const track: Track = {
  id: "three-deform",
  domain: "three",
  title: "頂点を動かして変形する",
  summary: "position 属性を書き換えて板を波打たせ、高さに合わせて頂点の色を塗り、モーフターゲットで別の形へなめらかに変形させる。",
  icon: "🌊",
  lessons: [
    {
      id: "three-wave",
      title: "板を波打たせる: position 属性",
      explanation:
        "<p>ジオメトリの形は、頂点の位置を並べた <b>position 属性</b>そのものです。組み込みの形でも、この値を書き換えれば自由に変形できます。" +
        "<code>new THREE.PlaneGeometry(4, 4, 40, 40)</code> のように縦横を細かく分けておくと頂点が増え、なめらかに曲げられます。" +
        "<code>pos.getY(i)</code> で i 番目の頂点の y を読み、<code>pos.setZ(i, 値)</code> で高さを書き込みます。頂点を動かし終わったら、" +
        "<code>geo.computeVertexNormals()</code> で<b>法線</b>（面の向き）を計算し直します。法線が古いままだと、形は波打っても陰影（法線マテリアルの色）は" +
        "平らなままです。描いたあとで頂点を動かすとき（アニメーションなど）は、<code>pos.needsUpdate = true</code> で書き換えを知らせます。</p>",
      challenge: {
        starterCode: WAVE_BOARD(
          "  // ここで、i 番目の頂点の高さ z を 0.3 * Math.sin(y * 3) にしよう\n",
          "// ここで、動かした頂点に合わせて法線（面の向き）を計算し直そう\n",
        ),
        task: "ループの中で pos.setZ(i, 0.3 * Math.sin(y * 3)) として板を波打たせ、ループのあとで geo.computeVertexNormals() を呼んで陰影を付け直そう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "computeVertexNormals",
            message: "頂点を動かし終わったら geo.computeVertexNormals() を呼んで、法線を計算し直しましょう",
          },
          { kind: "geometryOf", geometry: "PlaneGeometry", type: "Mesh" },
          // Up the centre line: a slope facing up (green) and a crest facing
          // the camera (blue). Flat normals colour the whole board alike; a
          // wave along x, a gentler or a steeper wave land elsewhere.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: [0.5, 0.98, 0.64] },
              { kind: "pixelApprox", x: 0.5, y: 0.47, rgb: [0.5, 0.46, 1] },
            ],
            message:
              "板が波打っていません（または陰影が平らなままです）。ループの中で pos.setZ(i, 0.3 * Math.sin(y * 3)) とし、頂点を動かし終わってから geo.computeVertexNormals() を呼びましょう",
          },
        ],
        hints: ["pos.setZ(i, 0.3 * Math.sin(y * 3));  // i 番目の頂点の z（高さ）", "ループのあとで geo.computeVertexNormals();"],
        solution: WAVE_BOARD(
          "  pos.setZ(i, 0.3 * Math.sin(y * 3));  // y に合わせて高さを波打たせる\n",
          "geo.computeVertexNormals();  // 動かしたあとの面の向きを計算し直す\n",
        ),
      },
    },
    {
      id: "three-height-colors",
      title: "高さで塗り分ける: 頂点の色",
      explanation:
        "<p>「頂点ごとの色」で使った <b>color 属性</b>は、計算で作ることもできます。地形の高さに合わせて色を変えれば、低い所は海の紺、高い所は" +
        "山の黄金色といった塗り分けになります。<code>c.lerpColors(low, high, t)</code> は 2色を割合 t で混ぜた色を c に入れます（t = 0 で low、" +
        "1 で high）。高さ h は -1〜1 なので、<code>(h + 1) / 2</code> で 0〜1 に直してから渡します。できた色は <code>c.toArray(colors, i * 3)</code> " +
        "で、i 番目の頂点の r, g, b の位置（3つずつ並んだ i 番目）に書き込みます。</p>",
      challenge: {
        starterCode: LAND("  // ここで、h を 0〜1 に直して low から high へ混ぜた色を c に作り、i 番目の頂点の色にしよう（いまは全部黒）\n"),
        task: "c.lerpColors(low, high, (h + 1) / 2) で高さに合わせた色を作り、c.toArray(colors, i * 3) で i 番目の頂点の色にして、低い所を紺・高い所を黄金色に塗ろう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "toArray|colors\\s*\\[|colors\\.set\\(",
            message: "作った色を、c.toArray(colors, i * 3) で i 番目の頂点の位置に書き込みましょう",
          },
          { kind: "geometryOf", geometry: "PlaneGeometry", type: "Mesh" },
          // Up the centre line: a ridge (h ≈ 1) and a valley (h ≈ -1).
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.66,
            rgb: [0.99, 0.84, 0.05],
            message:
              "高い所が黄金色になっていません。c.lerpColors(low, high, (h + 1) / 2) で色を作り、c.toArray(colors, i * 3) で i 番目の頂点に書き込みましょう",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.28,
            rgb: [0.08, 0.06, 0.5],
            message: "低い所が紺色になっていません。割合を (h + 1) / 2 にして、いちばん低い h = -1 のときに 0（low の色）になるようにしましょう",
          },
        ],
        hints: ["c.lerpColors(low, high, (h + 1) / 2);  // h = -1 で low、1 で high", "c.toArray(colors, i * 3);  // i 番目の頂点の r, g, b の位置へ"],
        solution: LAND(
          "  c.lerpColors(low, high, (h + 1) / 2);  // 高さを 0〜1 に直して 2色を混ぜる\n" +
            "  c.toArray(colors, i * 3);              // i 番目の頂点の r, g, b の位置へ\n",
        ),
      },
    },
    {
      id: "three-morph",
      title: "形を変形させる: モーフターゲット",
      explanation:
        "<p>キャラクターの表情や、形がなめらかに変わるアニメーションでは<b>モーフターゲット</b>を使います。変形後の頂点の位置をもう 1組用意して " +
        "<code>geo.morphAttributes.position</code> に配列で入れておき、メッシュの <code>morphTargetInfluences[0]</code> に 0〜1 の割合を入れると、" +
        "もとの形と変形後の形が頂点ごとに混ざります（0 でもとの形、1 で変形後、0.5 でちょうど中間）。割合を時間で変えれば、形が変わっていく" +
        "アニメーションになります。<code>morphAttributes</code> は Mesh を作る<b>前</b>に設定します（Mesh を作るときに " +
        "<code>morphTargetInfluences</code> が用意されるため。後から設定したときは <code>mesh.updateMorphTargets()</code> を呼びます）。</p>",
      challenge: {
        starterCode: STAR_SCENE(
          "// ここで、star を geo のモーフターゲットにしよう（Mesh を作る前に）\n",
          "// ここで、モーフターゲットを 100% 効かせて、円を星形に変えよう\n",
        ),
        task: "geo.morphAttributes.position に [new THREE.Float32BufferAttribute(star, 3)] を入れてから Mesh を作り、shape.morphTargetInfluences[0] を 1 にして、円を星形に変えよう。",
        validators: [
          { kind: "noError" },
          {
            kind: "sourceMatches",
            pattern: "morphAttributes",
            message: "geo.morphAttributes.position に、変形後の位置を [new THREE.Float32BufferAttribute(star, 3)] として入れましょう",
          },
          {
            kind: "sourceMatches",
            pattern: "morphTargetInfluences",
            message: "shape.morphTargetInfluences[0] で、モーフターゲットをどれだけ効かせるか決めましょう",
          },
          // Below the middle, between the star's two lower points: empty once
          // the star is fully there; the circle and the halfway shape fill it.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.34,
            rgb: BACKGROUND,
            tol: 0.15,
            message: "円のままです（または変形が途中です）。shape.morphTargetInfluences[0] を 1 にして、星形に 100% 変形させましょう（0.5 だと中間の形です）",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.47, rgb: GOLD, tol: 0.15 },
        ],
        hints: [
          "geo.morphAttributes.position = [new THREE.Float32BufferAttribute(star, 3)];  // Mesh を作る前に",
          "shape.morphTargetInfluences[0] = 1;  // 0: 円、1: 星形",
        ],
        solution: STAR_SCENE(
          "geo.morphAttributes.position = [new THREE.Float32BufferAttribute(star, 3)];  // 変形後の位置（1組目）\n",
          "shape.morphTargetInfluences[0] = 1;  // 1組目を 100% 効かせる\n",
        ),
      },
    },
  ],
};
