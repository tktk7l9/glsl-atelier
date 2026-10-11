// The three-light track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

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

/** The hemisphere lesson: a big white sphere, lit by `light`. */
const HEMI_SCENE = (light: string): string =>
  "// 白い球（MeshStandardMaterial は光が無いと真っ暗）\n" +
  "const ball = new THREE.Mesh(\n" +
  "  new THREE.SphereGeometry(1.8, 64, 32),\n" +
  "  new THREE.MeshStandardMaterial({ color: 'white' }),\n" +
  ");\n" +
  "scene.add(ball);\n\n" +
  light;

export const track: Track = {
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
};
