// The three-texture track's lessons, loaded on demand (see ../index.ts).

import type { Track } from "../types.js";

/** An 8×8 pixel-art invader drawn on a canvas (one character per pixel, `#`
 *  lime on a dark ground), as an sRGB CanvasTexture; `settings` follow it. */
const PIXEL_ART = (settings: string): string =>
  "// 8×8 ピクセルのドット絵（1文字が 1ピクセル。# が緑）\n" +
  "const art = [\n" +
  "  '..#..#..',\n" +
  "  '...##...',\n" +
  "  '..####..',\n" +
  "  '.#.##.#.',\n" +
  "  '########',\n" +
  "  '#.####.#',\n" +
  "  '#.#..#.#',\n" +
  "  '...##...',\n" +
  "];\n" +
  "const canvas = document.createElement('canvas');\n" +
  "canvas.width = 8;\n" +
  "canvas.height = 8;\n" +
  "const ctx = canvas.getContext('2d');\n" +
  "ctx.fillStyle = '#101828';  // 背景\n" +
  "ctx.fillRect(0, 0, 8, 8);\n" +
  "ctx.fillStyle = 'lime';\n" +
  "art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); }));\n" +
  "const tex = new THREE.CanvasTexture(canvas);\n" +
  "tex.colorSpace = THREE.SRGBColorSpace;\n" +
  settings +
  "// 8×8 の絵を 4×4 の板いっぱいに拡大して貼る\n" +
  "const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: tex }));\n" +
  "scene.add(board);\n";

/** A 4-texel gradient (dark blue to pale) repeated three times across a
 *  long strip; `wrap` sets how the copies continue. */
const GRADIENT_STRIP = (wrap: string): string =>
  "// 横 4ピクセルのグラデーション（暗い青 → 明るい水色）\n" +
  "const data = new Uint8Array([\n" +
  "  20, 40, 90, 255,   40, 90, 170, 255,   90, 160, 230, 255,   200, 235, 255, 255,\n" +
  "]);\n" +
  "const tex = new THREE.DataTexture(data, 4, 1);\n" +
  "tex.needsUpdate = true;\n" +
  "tex.colorSpace = THREE.SRGBColorSpace;\n" +
  wrap +
  "tex.repeat.set(3, 1);  // 横に 3回くり返す\n" +
  "const strip = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ map: tex }));\n" +
  "scene.add(strip);\n";

const REPEAT = "tex.wrapS = THREE.RepeatWrapping;          // 右端まで来たら、左端からくり返す\n";

/** An 8×8 heart on a transparent canvas, in front of a sky-blue wall;
 *  `material` is the heart's material parameters. */
const HEART = (material: string): string =>
  "// 8×8 の canvas にハートを描く（# 以外は何も描かず、透明のまま）\n" +
  "const art = [\n" +
  "  '.##..##.',\n" +
  "  '########',\n" +
  "  '########',\n" +
  "  '########',\n" +
  "  '.######.',\n" +
  "  '..####..',\n" +
  "  '...##...',\n" +
  "  '........',\n" +
  "];\n" +
  "const canvas = document.createElement('canvas');\n" +
  "canvas.width = 8;\n" +
  "canvas.height = 8;\n" +
  "const ctx = canvas.getContext('2d');\n" +
  "ctx.fillStyle = 'crimson';\n" +
  "art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); }));\n" +
  "const tex = new THREE.CanvasTexture(canvas);\n" +
  "tex.colorSpace = THREE.SRGBColorSpace;\n" +
  "tex.magFilter = THREE.NearestFilter;\n" +
  "// うしろの空色の壁\n" +
  "const sky = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 'skyblue' }));\n" +
  "sky.position.z = -2;\n" +
  "scene.add(sky);\n" +
  `const heart = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial(${material}));\n` +
  "scene.add(heart);\n";

const LIME: [number, number, number] = [0, 1, 0];
const ART_GROUND: [number, number, number] = [0.06, 0.09, 0.16];
const SKY: [number, number, number] = [0.53, 0.81, 0.92];
const CRIMSON: [number, number, number] = [0.86, 0.08, 0.24];

export const track: Track = {
  id: "three-texture",
  domain: "three",
  title: "テクスチャの設定",
  summary: "拡大したドット絵をくっきりさせ（magFilter）、くり返しの継ぎ目を鏡のように消し（MirroredRepeatWrapping）、透明な所を切り抜く（alphaTest）。",
  icon: "🧩",
  lessons: [
    {
      id: "three-nearest-filter",
      title: "ドット絵をくっきり: magFilter",
      explanation:
        "<p>小さな画像を大きく拡大して貼ると、画面の 1ピクセルが画像の 1ピクセルの<b>どこか途中</b>に当たります。そこで何色を出すかを決めるのが" +
        "<b>拡大フィルタ</b> <code>magFilter</code> です。初期値の <code>THREE.LinearFilter</code> は、近くの 4ピクセルをなめらかに混ぜるので、" +
        "写真はきれいに見えますが、ドット絵はふちがぼやけてしまいます。<code>tex.magFilter = THREE.NearestFilter</code> にすると、" +
        "いちばん近いピクセルの色をそのまま使うので、ドットがくっきりした四角のまま拡大されます。縮小するときは別の " +
        "<code>minFilter</code> が使われるので、拡大のぼやけには効きません。</p>",
      challenge: {
        starterCode: PIXEL_ART("// ここで、拡大してもドットがぼやけないようにしよう（いまは近くのピクセルを混ぜて拡大している）\n"),
        task: "tex.magFilter を THREE.NearestFilter にして、拡大したドット絵のふちをくっきりさせよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "NearestFilter", message: "tex.magFilter = THREE.NearestFilter で、いちばん近いピクセルの色を使いましょう" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // Up the centre line, a quarter of a dot from the edge between a
          // lime dot and the dark ground: crisp, each side keeps its own
          // colour; blended (LinearFilter, also with only minFilter changed),
          // the ground turns green and the lime dulls.
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.78,
            rgb: ART_GROUND,
            message: "ドットのふちがぼやけています（となりの緑がにじんでいます）。拡大に使われるのは magFilter です。tex.magFilter = THREE.NearestFilter にしましょう",
          },
          { kind: "pixelApprox", x: 0.5, y: 0.34, rgb: LIME, tol: 0.06, message: "緑のドットのふちが、まわりの色と混ざっています。tex.magFilter = THREE.NearestFilter にしましょう" },
        ],
        hints: ["拡大のときに使われるのは magFilter（縮小は minFilter）", "tex.magFilter = THREE.NearestFilter;"],
        solution: PIXEL_ART("tex.magFilter = THREE.NearestFilter;  // 拡大するとき、いちばん近いピクセルの色をそのまま使う\n"),
      },
    },
    {
      id: "three-mirrored-repeat",
      title: "継ぎ目なくくり返す: MirroredRepeatWrapping",
      explanation:
        "<p>グラデーションのように端と端の色が違う画像を <code>RepeatWrapping</code> でくり返すと、明るい右端のすぐ隣に暗い左端が来て、" +
        "くっきりした<b>継ぎ目</b>ができます。<code>THREE.MirroredRepeatWrapping</code> にすると、1つおきに<b>左右を反転</b>してくり返すので、" +
        "いつも同じ色どうしが隣り合い、継ぎ目が消えます（暗→明→暗→明…と折り返す）。床や壁のように、継ぎ目を目立たせたくない模様でよく使います。" +
        "横（u）のくり返しは <code>wrapS</code>、縦（v）は <code>wrapT</code> で決めます。</p>",
      challenge: {
        starterCode: GRADIENT_STRIP(REPEAT + "// ここで、継ぎ目（明るい → 暗い の段差）が出ないように、1つおきに左右を反転してくり返そう\n"),
        task: "tex.wrapS を THREE.MirroredRepeatWrapping にして、まん中のくり返しを左右反転させ、グラデーションの継ぎ目を消そう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "MirroredRepeatWrapping", message: "tex.wrapS = THREE.MirroredRepeatWrapping で、1つおきに反転してくり返しましょう" },
          { kind: "materialOf", material: "MeshBasicMaterial" },
          // The middle copy runs backwards: brighter just left of the centre
          // than just right of it (repeated, the other way round).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.5, rgb: [0.35, 0.63, 0.9] },
              { kind: "pixelApprox", x: 0.53, y: 0.5, rgb: [0.16, 0.35, 0.67] },
            ],
            message:
              "まん中のくり返しが左右反転していません。横のくり返しは wrapS です。tex.wrapS = THREE.MirroredRepeatWrapping にしましょう（wrapT は縦のくり返しです）",
          },
        ],
        hints: ["横（u）のくり返し方は wrapS で決める", "tex.wrapS = THREE.MirroredRepeatWrapping;"],
        solution: GRADIENT_STRIP("tex.wrapS = THREE.MirroredRepeatWrapping;  // 1つおきに左右を反転してくり返す\n"),
      },
    },
    {
      id: "three-alpha-test",
      title: "透明な所を切り抜く: alphaTest",
      explanation:
        "<p>何も描いていない canvas は<b>透明</b>（アルファ値 0）ですが、マテリアルが透明を扱わない設定のままだと、その部分は黒く塗られます。" +
        "葉っぱやフェンスのように、絵の形に<b>くり抜きたい</b>ときは、マテリアルに <code>alphaTest: 0.5</code> を指定します。アルファ値が " +
        "0.5 より小さいピクセルは描かれずに捨てられ、うしろの物がそのまま見えます。<code>transparent: true</code> でも透けますが、" +
        "こちらは色を混ぜる半透明の処理で、描く順番の影響を受けます。くっきり切り抜くだけなら alphaTest が手軽です。</p>",
      challenge: {
        starterCode: HEART("{ map: tex }") + "\n// ここで、ハートのまわりの透明な所を切り抜いて、うしろの空色が見えるようにしよう（いまは黒い）\n",
        task: "ハートのマテリアルに alphaTest: 0.5 を加えて、絵の透明な所を切り抜き、うしろの空色が見えるようにしよう。",
        validators: [
          { kind: "noError" },
          { kind: "sourceMatches", pattern: "alphaTest|transparent", message: "マテリアルに alphaTest: 0.5 を加えて、透明な所を切り抜きましょう" },
          // Up the centre line: the notch at the top of the heart and the
          // empty bottom row show the wall behind; the heart itself stays
          // crimson (a half-transparent heart lets the wall through).
          {
            kind: "allOf",
            of: [
              { kind: "pixelApprox", x: 0.5, y: 0.72, rgb: SKY },
              { kind: "pixelApprox", x: 0.5, y: 0.28, rgb: SKY },
            ],
            message: "ハートのまわりが黒いままです。マテリアルに alphaTest: 0.5 を加えて、透明な所を描かないようにしましょう（テクスチャではなくマテリアルの設定です）",
          },
          {
            kind: "pixelApprox",
            x: 0.5,
            y: 0.53,
            rgb: CRIMSON,
            message: "ハートそのものまで透けたり消えたりしています。opacity は 1 のまま、alphaTest は 0〜1 の 0.5 にしましょう",
          },
        ],
        hints: ["alphaTest は、アルファ値がその値より小さいピクセルを描かない設定", "new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 })"],
        solution: HEART("{ map: tex, alphaTest: 0.5 }") + "// alphaTest: 0.5 で、アルファ値が 0.5 未満のピクセルは描かない\n",
      },
    },
  ],
};
