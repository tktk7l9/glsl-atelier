// The three-shape track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";
import { BACKGROUND } from "./shared-three.js";

const LEAF_START =
  "// 葉っぱの輪郭: 左の先 (-1.6, 0) から書き始める\n" + "const shape = new THREE.Shape();\n" + "shape.moveTo(-1.6, 0);\n";

const LEAF_MESH =
  "const leaf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshBasicMaterial({ color: 'yellowgreen' }));\n" +
  "scene.add(leaf);\n";

const PIE_MESH =
  "const pie = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), new THREE.MeshBasicMaterial({ color: 'orange' }));\n" +
  "scene.add(pie);\n";

const RING_START =
  "// 外側の円（半径 1.6）の板\n" + "const shape = new THREE.Shape();\n" + "shape.absarc(0, 0, 1.6, 0, Math.PI * 2, false);\n";

const RING_MESH =
  "const ring = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), new THREE.MeshBasicMaterial({ color: 'tomato' }));\n" +
  "scene.add(ring);\n";

const YELLOWGREEN: [number, number, number] = [0.6, 0.8, 0.2];
const ORANGE: [number, number, number] = [1, 0.65, 0];
const TOMATO: [number, number, number] = [1, 0.39, 0.28];

export const track: Track = {
  id: "three-shape",
  domain: "three",
  title: "輪郭を描く（Shape と Path）",
  summary: "Shape の輪郭を曲線でふくらませ（quadraticCurveTo）、円弧で扇形を描き（absarc）、Path で穴をあける（holes）。",
  icon: "✂️",
  lessons: [
    {
      id: "three-shape-curve",
      title: "曲線でふくらませる: quadraticCurveTo",
      explanation:
        "<p><code>Shape</code> の輪郭は、<code>lineTo</code> の直線だけでなく曲線でも描けます。<code>quadraticCurveTo(制御点x, 制御点y, 終点x, 終点y)</code> は、" +
        "いまの点から終点まで、<b>制御点のほうへ引っぱられた</b>なめらかな曲線（2次ベジェ曲線）を引きます。曲線は制御点そのものは通らず、" +
        "そちらへふくらむだけです（真ん中で、制御点までの半分の高さ）。上側と下側をそれぞれ曲線にすると、葉っぱの形になります。" +
        "制御点を 2つ使う <code>bezierCurveTo</code> もあります。</p>",
      challenge: {
        starterCode:
          LEAF_START +
          "// いまは直線のひし形。上側と下側を、制御点のほうへふくらむ曲線にしよう\n" +
          "shape.lineTo(0, 0.4);\n" +
          "shape.lineTo(1.6, 0);\n" +
          "shape.lineTo(0, -0.4);\n" +
          "shape.lineTo(-1.6, 0);\n" +
          LEAF_MESH,
        task: "4本の lineTo を quadraticCurveTo(0, 1.6, 1.6, 0) と quadraticCurveTo(0, -1.6, -1.6, 0) の 2本の曲線に替えて、上下にふくらんだ葉っぱの形にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "quadraticCurveTo|bezierCurveTo", message: "quadraticCurveTo で曲線を引きましょう" },
          // Down the middle, the leaf reaches 0.77 above and below the centre
          // line: inside it at 0.54, outside it at 0.90 (the thin diamond
          // only reaches 0.36, straight lines through the control points 1.3).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5938, rgb: YELLOWGREEN },
              { kind: "pixelApprox", x: 0.5, y: 0.4063, rgb: YELLOWGREEN },
            ],
            message: "葉っぱが上下にふくらんでいません。quadraticCurveTo(0, 1.6, 1.6, 0) のように、制御点を先に、終点を後に書きましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.6563, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.3438, rgb: BACKGROUND, tol: 0.15 },
            ],
            message: "ふくらみすぎています。曲線は制御点を通らず、真ん中で制御点までの半分の高さになります（lineTo で制御点を通ると、とがったひし形になります）",
          },
        ],
        hints: ["shape.quadraticCurveTo(0, 1.6, 1.6, 0);  // 制御点 (0, 1.6)、終点 (1.6, 0)", "下側は shape.quadraticCurveTo(0, -1.6, -1.6, 0); で左の先へ戻る"],
        solution:
          LEAF_START +
          "shape.quadraticCurveTo(0, 1.6, 1.6, 0);    // 上側: 制御点 (0, 1.6) のほうへふくらみながら右の先へ\n" +
          "shape.quadraticCurveTo(0, -1.6, -1.6, 0);  // 下側: 制御点 (0, -1.6) のほうへふくらみながら左の先へ戻る\n" +
          LEAF_MESH,
      },
    },
    {
      id: "three-shape-arc",
      title: "扇形を描く: absarc",
      explanation:
        "<p>円や円弧は <code>absarc(中心x, 中心y, 半径, 始まりの角度, 終わりの角度, 時計回りか)</code> で描けます。角度は<b>ラジアン</b>で、右（x の正の向き）が 0、" +
        "そこから<b>反時計回り</b>に増えます（真上が <code>Math.PI / 2</code>）。最後の引数が false なら反時計回りに、true なら時計回りに描きます。" +
        "円弧を描いたあと <code>lineTo(0, 0)</code> で中心へ線を引くと、輪郭を閉じるときに中心から円弧の始まりへ戻るので、<b>扇形</b>になります" +
        "（中心へ線を引かないと、円弧の両端がまっすぐ結ばれます）。ここでは 135°（<code>Math.PI * 0.75</code>）から、ひと回りして 405°" +
        "（<code>Math.PI * 2.25</code>、つまり 45°）まで描いて、真上の 4分の1 が欠けたパイを作ります。</p>",
      challenge: {
        starterCode:
          "const shape = new THREE.Shape();\n" +
          "// いまは四角い板。円弧を描いてから中心へ線を引き、真上の 4分の1 が欠けたパイにしよう\n" +
          "shape.moveTo(-1.6, -1.6);\n" +
          "shape.lineTo(1.6, -1.6);\n" +
          "shape.lineTo(1.6, 1.6);\n" +
          "shape.lineTo(-1.6, 1.6);\n" +
          "shape.lineTo(-1.6, -1.6);\n" +
          PIE_MESH,
        task: "四角の代わりに absarc(0, 0, 1.6, Math.PI * 0.75, Math.PI * 2.25, false) で円弧を描き、lineTo(0, 0) で中心へ線を引いて、真上の 4分の1 が欠けたパイにしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "absarc|absellipse|\\.arc\\(|\\.ellipse\\(", message: "absarc で円弧を描きましょう" },
          // Above the centre lies the missing quarter; below it, the pie.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5938, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.7188, rgb: BACKGROUND, tol: 0.15 },
            ],
            message:
              "真上の 4分の1 が欠けていません。角度はラジアンで、Math.PI * 0.75（135°）から Math.PI * 2.25（405°）まで描きましょう。円弧のあとに lineTo(0, 0) で中心へ線を引かないと、円弧の両端がまっすぐ結ばれて、欠けた所がふさがります",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.4063, rgb: ORANGE },
              { kind: "pixelApprox", x: 0.5, y: 0.2813, rgb: ORANGE },
            ],
            message: "パイの下側がありません。最後の引数を true（時計回り）にすると、欠けるはずの 4分の1 だけが描かれます",
          },
        ],
        hints: [
          "shape.absarc(0, 0, 1.6, Math.PI * 0.75, Math.PI * 2.25, false);  // 中心 (0, 0)、半径 1.6、135° から 405° まで",
          "shape.lineTo(0, 0);  // 中心へ線を引くと、閉じるときに円弧の始まりへ戻って扇形になる",
        ],
        solution:
          "const shape = new THREE.Shape();\n" +
          "shape.absarc(0, 0, 1.6, Math.PI * 0.75, Math.PI * 2.25, false);  // 135° から反時計回りに、405°（= 45°）まで\n" +
          "shape.lineTo(0, 0);  // 中心へ線を引く（閉じるとき、中心から円弧の始まりへ戻る）\n" +
          PIE_MESH,
      },
    },
    {
      id: "three-shape-hole",
      title: "穴をあける: holes",
      explanation:
        "<p><code>Shape</code> には<b>穴</b>をあけられます。穴の輪郭を <code>THREE.Path</code> で描いて、<code>shape.holes.push(穴)</code> で加えるだけです。" +
        "<code>ShapeGeometry</code> や <code>ExtrudeGeometry</code> は穴の内側を面にしないので、ドーナツ型の板、窓のある壁、ナットやワッシャーなどが作れます。" +
        "穴の輪郭を Shape として <code>ShapeGeometry</code> に一緒に渡すと、穴ではなく<b>もう 1枚の板</b>として重なってしまいます。</p>",
      challenge: {
        starterCode: RING_START + "// ここで、半径 0.8 の円の輪郭（THREE.Path）を作り、板の穴として加えて、ドーナツ型にしよう\n" + RING_MESH,
        task: "半径 0.8 の円を THREE.Path の absarc で描いて shape.holes.push で加え、真ん中に穴のあいたドーナツ型の板にしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "holes", message: "shape.holes.push(穴) で、穴を加えましょう" },
          // The hole (radius 0.8) around the centre, the ring (0.8–1.6) beyond it.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5938, rgb: BACKGROUND, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.4063, rgb: BACKGROUND, tol: 0.15 },
            ],
            message:
              "真ん中に穴があいていません。半径 0.8 の円を THREE.Path で描き、shape.holes.push(hole) で加えましょう（穴を Shape として ShapeGeometry に渡すと、もう 1枚の板になります）",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.7188, rgb: TOMATO },
              { kind: "pixelApprox", x: 0.5, y: 0.2813, rgb: TOMATO },
            ],
            message: "ドーナツの板の部分が欠けています。穴の半径は 0.8、外側の円は 1.6 のままにしましょう",
          },
        ],
        hints: ["const hole = new THREE.Path();  hole.absarc(0, 0, 0.8, 0, Math.PI * 2, true);", "shape.holes.push(hole);"],
        solution:
          RING_START +
          "const hole = new THREE.Path();\n" +
          "hole.absarc(0, 0, 0.8, 0, Math.PI * 2, true);  // 内側の円（穴の輪郭）\n" +
          "shape.holes.push(hole);                        // 板に穴として加える\n" +
          RING_MESH,
      },
    },
  ],
};
