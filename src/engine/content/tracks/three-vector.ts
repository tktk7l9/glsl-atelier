// The three-vector track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** The field-of-view lesson: a guard on the left looking right, its view
 *  (25° each side) drawn faintly behind four grey balls stacked up the middle. */
const GUARD_SCENE =
  "// 見張り（左）。右を向いていて、視界は上下に 25° ずつ\n" +
  "const guard = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 16), new THREE.MeshBasicMaterial({ color: 'white' }));\n" +
  "guard.position.set(-2.4, 0, 0);\n" +
  "guard.rotation.z = -Math.PI / 2;  // とがった先を右へ\n" +
  "scene.add(guard);\n" +
  "const view = new THREE.Shape();  // 視界を表すうすい三角形（ボールの奥）\n" +
  "view.moveTo(0, 0);\n" +
  "view.lineTo(5, Math.tan(THREE.MathUtils.degToRad(25)) * 5);\n" +
  "view.lineTo(5, -Math.tan(THREE.MathUtils.degToRad(25)) * 5);\n" +
  "const viewMesh = new THREE.Mesh(new THREE.ShapeGeometry(view), new THREE.MeshBasicMaterial({ color: 'white', transparent: true, opacity: 0.08 }));\n" +
  "viewMesh.position.set(-2.4, 0, -0.6);\n" +
  "scene.add(viewMesh);\n\n" +
  "// 真ん中に縦に並んだボール 4つ（それぞれ自分のマテリアルを持つ）\n" +
  "const balls = [-1.5, -0.5, 0.5, 1.5].map((y) => {\n" +
  "  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12), new THREE.MeshBasicMaterial({ color: 'gray' }));\n" +
  "  ball.position.set(0, y, 0);\n" +
  "  scene.add(ball);\n" +
  "  return ball;\n" +
  "});\n\n" +
  "const facing = new THREE.Vector3(1, 0, 0);                 // 見張りが向いている方向（長さ 1）\n" +
  "const limit = Math.cos(THREE.MathUtils.degToRad(25));      // 視界のふち 25° の cos\n";

/** The normal lesson: a panel spanned by the edges a and b, and a marker. */
const PANEL_SCENE =
  "// パネルの真ん中と、2本の辺\n" +
  "const center = new THREE.Vector3(0, -0.6, 0);\n" +
  "const a = new THREE.Vector3(2.4, 0, 0);     // 横の辺\n" +
  "const b = new THREE.Vector3(0, 1.2, -1.6);  // 縦の辺（奥へ倒れている）\n" +
  "const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2), new THREE.MeshBasicMaterial({ color: 'slateblue', side: THREE.DoubleSide }));\n" +
  "panel.position.copy(center);\n" +
  "panel.rotation.x = -Math.atan2(1.6, 1.2);  // a と b の向きに合わせて倒しておく\n" +
  "scene.add(panel);\n\n" +
  "// 旗の玉\n" +
  "const marker = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12), new THREE.MeshBasicMaterial({ color: 'crimson' }));\n" +
  "scene.add(marker);\n";

/** The bounce lesson: a mirror at 45°, where the ball came from, and the ball. */
const MIRROR_SCENE =
  "// 45° に傾いた鏡（原点）。面は右上を向いている\n" +
  "const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 'lightsteelblue' }));\n" +
  "mirror.rotation.z = -Math.PI / 4;\n" +
  "scene.add(mirror);\n" +
  "const normal = new THREE.Vector3(1, 1, 0).normalize();  // 鏡の面の向き（法線、長さ 1）\n\n" +
  "// ボールは右から左へ進んできて、原点で鏡に当たる\n" +
  "const start = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8), new THREE.MeshBasicMaterial({ color: 'dimgray' }));\n" +
  "start.position.set(2, 0, 0);  // 来た所\n" +
  "scene.add(start);\n" +
  "const dir = new THREE.Vector3(-1, 0, 0);  // 進んできた向き（長さ 1）\n" +
  "const hit = new THREE.Vector3(0, 0, 0);   // 鏡に当たった点\n" +
  "const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12), new THREE.MeshBasicMaterial({ color: 'orange' }));\n" +
  "scene.add(ball);\n";

const GOLD: [number, number, number] = [1, 0.84, 0];
const GRAY: [number, number, number] = [0.5, 0.5, 0.5];
const CRIMSON: [number, number, number] = [0.86, 0.08, 0.24];
const ORANGE: [number, number, number] = [1, 0.65, 0];

export const track: Track = {
  id: "three-vector",
  domain: "three",
  title: "ベクトルで判断する（内積・外積・反射）",
  summary: "内積で視界に入っているかを調べ、外積で面に垂直な向きを作り、reflect で跳ね返る向きを求める。",
  icon: "🔦",
  lessons: [
    {
      id: "three-dot-view",
      title: "視界に入っているか: 内積",
      explanation:
        "<p>2つのベクトルの<b>内積</b> <code>a.dot(b)</code> は、どちらも長さ 1 なら、間の角度の cos になります。同じ向きなら 1、直角なら 0、" +
        "反対向きなら -1 です。見張りの<b>視界</b>（向いている方向から 25° 以内）に物が入っているかは、見張りから物への向きを " +
        "<code>normalize()</code> で長さ 1 にして向いている方向との内積を取り、<b>cos 25°</b> より大きいかで調べられます（角度が小さいほど cos は大きい）。" +
        "角度そのものを求めなくてよいので、ゲームの敵の視界やスポットライトの判定によく使われます。</p>",
      challenge: {
        starterCode:
          GUARD_SCENE +
          "\nballs.forEach((ball) => {\n" +
          "  // ここで、見張りからボールへの向き（長さ 1）と facing の内積が limit より大きければ、ボールを金色（'gold'）にしよう\n" +
          "});\n",
        task: "見張りからボールへの向きを normalize() し、facing.dot(その向き) が limit より大きいボールを金色にして、視界の中のボールだけを光らせよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "\\.dot\\(|angleTo", message: "facing.dot(向き) で内積を求めましょう" },
          // The two middle balls lie 12° from where the guard looks, the
          // outer two 32°: only the middle two turn gold.
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5938, rgb: GOLD, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.4063, rgb: GOLD, tol: 0.15 },
            ],
            message: "視界の中のボールが金色になっていません。向きを normalize() してから内積を取り、limit（cos 25°）より大きいかくらべましょう",
          },
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.7813, rgb: GRAY, tol: 0.15 },
              { kind: "pixelApprox", x: 0.5, y: 0.2188, rgb: GRAY, tol: 0.15 },
            ],
            message: "視界の外のボールまで金色です。内積は角度ではなく cos なので、くらべる相手は limit（cos 25°）です。向きの長さを 1 にするのも忘れずに",
          },
        ],
        hints: [
          "const toBall = ball.position.clone().sub(guard.position).normalize();  // 見張りからボールへの向き（長さ 1）",
          "if (facing.dot(toBall) > limit) ball.material.color.set('gold');",
        ],
        solution:
          GUARD_SCENE +
          "\nballs.forEach((ball) => {\n" +
          "  const toBall = ball.position.clone().sub(guard.position).normalize();  // 見張りからボールへの向き（長さ 1）\n" +
          "  if (facing.dot(toBall) > limit) ball.material.color.set('gold');      // 角度が 25° より小さい = cos が limit より大きい\n" +
          "});\n",
      },
    },
    {
      id: "three-cross-normal",
      title: "面に垂直な向き: 外積",
      explanation:
        "<p>2つのベクトルの<b>外積</b> <code>new THREE.Vector3().crossVectors(a, b)</code> は、a と b の<b>両方に垂直な</b>ベクトルです。" +
        "面の 2本の辺から外積を取れば、面の向き（法線）が分かります。向きは<b>右手の法則</b>で決まり、a と b を入れ替えると反対を向きます。" +
        "長さは a と b の長さで変わるので、向きだけ使うときは <code>normalize()</code> で長さ 1 にします。" +
        "ここでは、倒れたパネルの真ん中から、パネルに垂直に 1.6 離れた所へ旗の玉を立てます。</p>",
      challenge: {
        starterCode:
          PANEL_SCENE +
          "\n// ここで、a と b の両方に垂直な向き（長さ 1）を求めて、玉をパネルの真ん中から垂直に 1.6 離そう\n" +
          "marker.position.copy(center);  // いまはパネルの真ん中\n",
        task: "crossVectors(a, b) で a と b の両方に垂直な向きを求めて normalize() し、marker をパネルの真ん中 center から、その向きへ 1.6 離れた所に置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "cross", message: "crossVectors(a, b)（外積）で、a と b の両方に垂直な向きを求めましょう" },
          {
            kind: "objectAt",
            position: [0, 0.68, 0.96],
            type: "Mesh",
            tol: 0.15,
            message:
              "玉がパネルに垂直な所にありません。crossVectors(a, b) を normalize() してから 1.6 倍しましょう（b, a の順だと裏側を向きます）",
          },
          // The marker floats in front of the panel, up the middle.
          { kind: "pixelApprox", x: 0.5, y: 0.6563, rgb: CRIMSON, tol: 0.15 },
        ],
        hints: [
          "const n = new THREE.Vector3().crossVectors(a, b).normalize();  // a と b に垂直な向き（長さ 1）",
          "marker.position.copy(center).addScaledVector(n, 1.6);",
        ],
        solution:
          PANEL_SCENE +
          "const n = new THREE.Vector3().crossVectors(a, b).normalize();  // a と b の両方に垂直な向き（長さ 1）\n" +
          "marker.position.copy(center).addScaledVector(n, 1.6);           // 真ん中から、その向きへ 1.6\n",
      },
    },
    {
      id: "three-reflect",
      title: "跳ね返る向き: reflect",
      explanation:
        "<p>ボールが壁や鏡で跳ね返る向きは、<code>dir.clone().reflect(法線)</code> で求まります。進む向きのうち、面に<b>垂直な成分だけを逆向き</b>にしたもので、" +
        "式で書くと <code>dir - 2 (dir・n) n</code> です。法線 n は<b>長さ 1</b> にしておきます（長さが違うと、跳ね返る向きが狂います）。" +
        "<code>reflect</code> は自分自身を書きかえるので、元の向きを残したいときは <code>clone()</code> してから使います。" +
        "ここでは、右から飛んできたボールが 45° の鏡で真上へ跳ね返ります。</p>",
      challenge: {
        starterCode:
          MIRROR_SCENE +
          "\n// ここで、鏡で跳ね返った向きを求めて、ボールを当たった点からその向きへ 1.6 進めよう\n" +
          "ball.position.copy(hit).addScaledVector(dir, 1.6);  // いまは跳ね返らずに、鏡を通り抜けている\n",
        task: "dir.clone().reflect(normal) で跳ね返った向きを求め、ボールを当たった点 hit から、その向きへ 1.6 進めた所に置こう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "reflect", message: "dir.clone().reflect(normal) で、跳ね返った向きを求めましょう" },
          {
            kind: "objectAt",
            position: [0, 1.6, 0],
            type: "Mesh",
            tol: 0.15,
            message: "ボールが跳ね返った所にありません。dir.clone().reflect(normal) の向きへ進めましょう（法線は長さ 1 の normal を使います）",
          },
          // Off a 45° mirror, a ball coming in from the right goes straight up.
          { kind: "pixelApprox", x: 0.5, y: 0.7813, rgb: ORANGE, tol: 0.15 },
        ],
        hints: ["const bounce = dir.clone().reflect(normal);  // 跳ね返った向き", "ball.position.copy(hit).addScaledVector(bounce, 1.6);"],
        solution:
          MIRROR_SCENE +
          "const bounce = dir.clone().reflect(normal);            // 鏡で跳ね返った向き\n" +
          "ball.position.copy(hit).addScaledVector(bounce, 1.6);  // 当たった点から、その向きへ 1.6\n",
      },
    },
  ],
};
