import type { Domain, Lesson, LessonMeta, Track, TrackMeta } from "./types.js";

/**
 * The catalogue, in catalogue order (WebGL/GLSL tracks first, then Three.js):
 * track titles, summaries and icons, and lesson titles. This is all the first
 * screen needs, so it is the only content in the initial bundle. Each track's
 * lessons (explanations, starters, solutions, validators) load with the track's
 * module on demand (see loadTrack); content.test.ts checks that the two agree.
 */
export const TRACKS: readonly TrackMeta[] = [
  {
    id: "glsl-basics",
    domain: "glsl",
    title: "はじめてのシェーダー",
    summary: "1ピクセルずつ色を決める。gl_FragColor に RGBA を書き込もう。",
    icon: "✨",
    lessons: [
      { id: "glsl-solid-color", title: "画面を塗る: gl_FragColor" },
      { id: "glsl-rgb-mix", title: "色を混ぜる: RGB" },
      { id: "glsl-gray", title: "灰色をつくる: vec3" },
    ],
  },
  {
    id: "glsl-uv",
    domain: "glsl",
    title: "座標と UV",
    summary: "gl_FragCoord と u_resolution でピクセルの位置を 0〜1 に正規化する。",
    icon: "🧭",
    lessons: [
      { id: "glsl-uv-gradient", title: "横グラデーション" },
      { id: "glsl-uv-xy", title: "定番の UV: 赤×緑" },
      { id: "glsl-uv-vertical", title: "縦グラデーション" },
    ],
  },
  {
    id: "glsl-shapes",
    domain: "glsl",
    title: "図形を描く",
    summary: "step / smoothstep と距離関数で白黒のかたちを切り出し、fwidth でふちを 1ピクセルだけぼかす。",
    icon: "🔵",
    lessons: [
      { id: "glsl-step-half", title: "境界をつくる: step" },
      { id: "glsl-circle", title: "円を描く: distance" },
      { id: "glsl-smoothstep-circle", title: "ふちをぼかす: smoothstep" },
      { id: "glsl-fwidth", title: "ふちを 1ピクセルだけぼかす: fwidth" },
    ],
  },
  {
    id: "glsl-plot",
    domain: "glsl",
    title: "グラフで形を作る",
    summary: "y = f(x) のグラフを線で描き、pow で曲げ、smoothstep で S 字にする。値の変わり方を形づくる「シェイピング関数」を目で見る。",
    icon: "✏️",
    lessons: [
      { id: "glsl-plot-line", title: "グラフを描く: y = x の線" },
      { id: "glsl-plot-pow", title: "曲げる: pow で累乗" },
      { id: "glsl-plot-smoothstep", title: "S 字にする: smoothstep" },
    ],
  },
  {
    id: "glsl-color",
    domain: "glsl",
    title: "色と混色",
    summary: "mix で 2色を補間し、cos でパレットをつくり、スクリーンやオーバーレイで 2枚の絵を重ねる。",
    icon: "🌈",
    lessons: [
      { id: "glsl-mix", title: "2色を補間: mix" },
      { id: "glsl-palette", title: "コサイン・パレット" },
      { id: "glsl-screen-blend", title: "光を重ねる: スクリーン合成" },
      { id: "glsl-overlay-blend", title: "コントラストを強める: オーバーレイ" },
    ],
  },
  {
    id: "glsl-motion",
    domain: "glsl",
    title: "時間とアニメーション",
    summary: "u_time と sin/cos で時間とともに変化する絵をつくり、イージングで動きに緩急をつける。",
    icon: "🌀",
    lessons: [
      { id: "glsl-pulse", title: "明滅する: u_time × sin" },
      { id: "glsl-moving-stripe", title: "流れる縞: fract × u_time" },
      { id: "glsl-easing", title: "動きに緩急をつける: イージング" },
    ],
  },
  {
    id: "glsl-patterns",
    domain: "glsl",
    title: "繰り返しとパターン",
    summary: "fract / floor / mod で空間を分割し、タイルや市松模様をつくる。",
    icon: "🔳",
    lessons: [
      { id: "glsl-tiles", title: "タイル化: fract" },
      { id: "glsl-checker", title: "市松模様: floor × mod" },
      { id: "glsl-repeat-dots", title: "水玉を並べる: fract × 図形" },
    ],
  },
  {
    id: "glsl-sdf",
    domain: "glsl",
    title: "距離関数（SDF）",
    summary: "「形までの距離」を返す関数で図形を描き、輪郭にし、溶かし合わせ、くり抜く。",
    icon: "📏",
    lessons: [
      { id: "glsl-sdf-box", title: "箱の SDF: abs と max" },
      { id: "glsl-sdf-ring", title: "輪郭だけ残す: abs(d)" },
      { id: "glsl-sdf-smooth-union", title: "溶かしてつなぐ: smooth min" },
      { id: "glsl-sdf-subtract", title: "くり抜く: SDF の引き算" },
    ],
  },
  {
    id: "glsl-lines",
    domain: "glsl",
    title: "線分と多角形",
    summary: "点と線分の距離で線を描き、線分を min でつないで三角形の輪郭にし、角度を区切って正多角形を塗る。",
    icon: "🔷",
    lessons: [
      { id: "glsl-segment", title: "線分を描く: 線分までの距離" },
      { id: "glsl-triangle-outline", title: "折れ線: 線分を min でつなぐ" },
      { id: "glsl-polygon", title: "正多角形: 角度で区切る" },
    ],
  },
  {
    id: "glsl-transform",
    domain: "glsl",
    title: "座標を変換する",
    summary: "回転行列 mat2 で座標ごと回し、abs で折り返して鏡に映す。回すときは中心を原点に移してから。",
    icon: "🔄",
    lessons: [
      { id: "glsl-rotate", title: "回転させる: mat2" },
      { id: "glsl-rotate-tiles", title: "マスごとに回す: 中心を原点に" },
      { id: "glsl-mirror", title: "鏡に映す: abs で折り返す" },
    ],
  },
  {
    id: "glsl-polar",
    domain: "glsl",
    title: "極座標",
    summary: "角度 atan と半径 length で座標を取り直し、放射模様や花びら、万華鏡を描く。",
    icon: "🌸",
    lessons: [
      { id: "glsl-polar-rays", title: "放射する光: atan" },
      { id: "glsl-polar-flower", title: "花びらを描く: 半径を角度で揺らす" },
      { id: "glsl-spiral", title: "うずまき: 角度に距離を足す" },
      { id: "glsl-kaleidoscope", title: "万華鏡: 角度を折りたたむ" },
    ],
  },
  {
    id: "glsl-hsv",
    domain: "glsl",
    title: "色相・彩度・明度（HSV）",
    summary: "色を色相・彩度・明度で表す HSV。色相から虹色を作り、角度を色相にして色相環を描き、色相を半周まわして補色にする。",
    icon: "🎡",
    lessons: [
      { id: "glsl-hsv-rainbow", title: "色相で虹を作る: HSV から RGB へ" },
      { id: "glsl-color-wheel", title: "色相環: 角度を色相に、距離を彩度に" },
      { id: "glsl-hue-shift", title: "補色にする: 色相を半周まわす" },
    ],
  },
  {
    id: "glsl-noise",
    domain: "glsl",
    title: "乱数とノイズ",
    summary: "GLSL に乱数関数はない。ハッシュで乱数を作り、なめらかなノイズや細胞の模様にする。",
    icon: "🌫️",
    lessons: [
      { id: "glsl-random-cells", title: "乱数をつくる: fract(sin(…))" },
      { id: "glsl-value-noise", title: "なめらかなノイズ: 四隅を補間する" },
      { id: "glsl-voronoi", title: "細胞の模様: セルラーノイズ" },
    ],
  },
  {
    id: "glsl-tiling",
    domain: "glsl",
    title: "タイルを敷きつめる",
    summary: "1段おきにずらしたレンガ、2つの格子を重ねたハチの巣、マスごとに向きを変えるトルシェ。すき間なく平面を埋める模様。",
    icon: "🐝",
    lessons: [
      { id: "glsl-brick", title: "レンガを積む: 1段おきにずらす" },
      { id: "glsl-hex-grid", title: "ハチの巣: 六角形のタイル" },
      { id: "glsl-truchet", title: "トルシェ: マスごとに向きを変える" },
    ],
  },
  {
    id: "glsl-fractal",
    domain: "glsl",
    title: "フラクタル",
    summary: "z = z² + c をくり返すだけで、どこまで拡大しても細かい模様が現れる。マンデルブロ集合を描き、脱出の速さで色を付け、ジュリア集合へ。",
    icon: "❄️",
    lessons: [
      { id: "glsl-mandelbrot", title: "マンデルブロ集合: z = z² + c" },
      { id: "glsl-escape-time", title: "脱出の速さで塗る: くり返しの回数" },
      { id: "glsl-julia", title: "ジュリア集合: c を固定する" },
    ],
  },
  {
    id: "glsl-post",
    domain: "glsl",
    title: "仕上げのエフェクト",
    summary: "ビネット・色ずれ・トーンマッピング・ガンマ補正・リニアな混色・ディザリング。できた絵に後からかける仕上げの処理。",
    icon: "📷",
    lessons: [
      { id: "glsl-vignette", title: "周辺を暗く: ビネット" },
      { id: "glsl-chromatic-aberration", title: "色ずれ: 色収差" },
      { id: "glsl-tonemap", title: "明るすぎる光を収める: トーンマッピング" },
      { id: "glsl-gamma", title: "ガンマ補正: リニアから画面の色へ" },
      { id: "glsl-linear-mix", title: "にごらないグラデーション: リニアで混ぜる" },
      { id: "glsl-dither", title: "2色で濃淡を出す: ディザリング" },
    ],
  },
  {
    id: "glsl-glow",
    domain: "glsl",
    title: "光らせる（グロー）",
    summary: "距離で割って中心ほど強く光らせ、線分の距離でネオン管にし、光を足し合わせてトーンマッピングで白飛びを抑える。",
    icon: "🔆",
    lessons: [
      { id: "glsl-glow", title: "距離で光る: 1 / d のグロー" },
      { id: "glsl-neon", title: "ネオン管: 線分の距離で光らせる" },
      { id: "glsl-glow-add", title: "光を重ねる: 足し算とトーンマッピング" },
    ],
  },
  {
    id: "glsl-filter",
    domain: "glsl",
    title: "フィルタで加工する",
    summary: "白黒・セピア・階調落とし・モザイク・走査線。元の絵を返す関数にひと手間かけて、写真アプリのフィルタのように仕上げる。",
    icon: "🎞️",
    lessons: [
      { id: "glsl-grayscale", title: "白黒にする: 輝度" },
      { id: "glsl-sepia", title: "セピア調: 色の行列" },
      { id: "glsl-posterize", title: "階調を減らす: ポスタリゼーション" },
      { id: "glsl-mosaic", title: "モザイク: 座標を粗くする" },
      { id: "glsl-scanlines", title: "走査線: CRT 風" },
    ],
  },
  {
    id: "glsl-convolution",
    domain: "glsl",
    title: "まわりを見るフィルタ",
    summary: "まわりの点の色を読んで足し合わせる（畳み込み）。平均でぼかし、ぼかしとの差でくっきりさせ、明るさの差から輪郭を取り出す。",
    icon: "🔍",
    lessons: [
      { id: "glsl-blur", title: "ぼかし: まわりの平均" },
      { id: "glsl-sharpen", title: "くっきりさせる: ぼかしとの差" },
      { id: "glsl-edge", title: "輪郭を取り出す: 明るさの差" },
    ],
  },
  {
    id: "glsl-distort",
    domain: "glsl",
    title: "絵をゆがめる",
    summary: "絵を読む座標のほうをずらすと、絵そのものがゆがむ。sin で波打たせ、同心円の波紋を広げ、レンズのようにふくらませる。",
    icon: "💧",
    lessons: [
      { id: "glsl-wave-distort", title: "波打たせる: sin で読む位置をずらす" },
      { id: "glsl-ripple", title: "波紋: 中心から押したり引いたり" },
      { id: "glsl-lens", title: "レンズのゆがみ: 中心をふくらませる" },
    ],
  },
  {
    id: "glsl-advanced",
    domain: "glsl",
    title: "上級: 光を当てる",
    summary: "法線とライト方向の内積で陰影をつけ、レイマーチングで本物の 3D の球を描き、影まで落とす。",
    icon: "🪐",
    lessons: [
      { id: "glsl-shaded-sphere", title: "陰影のある球" },
      { id: "glsl-raymarch-sphere", title: "レイマーチング: 球に向かって進む" },
      { id: "glsl-raymarch-normal", title: "どんな形にも法線を: 距離の勾配" },
      { id: "glsl-raymarch-shadow", title: "影を落とす: 光に向かってもう一度" },
    ],
  },
  {
    id: "glsl-sdf3d",
    domain: "glsl",
    title: "レイマーチングで形を作る",
    summary: "距離関数を 3D にして箱を描き、mod で空間をくり返して無限に並べ、高さに合わせて座標を回して形をねじる。",
    icon: "🧱",
    lessons: [
      { id: "glsl-box3d", title: "3D の箱: 距離関数を 3D に" },
      { id: "glsl-repeat3d", title: "空間をくり返す: mod で無限に並べる" },
      { id: "glsl-twist", title: "ねじる: 高さに合わせて回す" },
    ],
  },
  {
    id: "glsl-lighting",
    domain: "glsl",
    title: "光の質感",
    summary: "ランバートの拡散光に、つやのハイライト（Blinn-Phong）、ふちの光（リムライト）、段々の陰影（トゥーン）を足して、質感を描き分ける。",
    icon: "💎",
    lessons: [
      { id: "glsl-specular", title: "つやを出す: Blinn-Phong のハイライト" },
      { id: "glsl-rim", title: "ふちを光らせる: リムライト" },
      { id: "glsl-toon", title: "アニメ調の陰影: トゥーンシェーディング" },
    ],
  },
  {
    id: "glsl-rm-shading",
    domain: "glsl",
    title: "レイマーチングの仕上げ",
    summary: "影のふちをぼかし（ソフトシャドウ）、物のすき間を暗くし（アンビエントオクルージョン）、床に映り込みを足して（reflect）、レイマーチングの絵を仕上げる。",
    icon: "🌗",
    lessons: [
      { id: "glsl-soft-shadow", title: "やわらかい影: ソフトシャドウ" },
      { id: "glsl-ambient-occlusion", title: "すき間を暗く: アンビエントオクルージョン" },
      { id: "glsl-reflection", title: "床に映す: reflect でもう一度進む" },
    ],
  },
  {
    id: "three-basics",
    domain: "three",
    title: "シーンの基本",
    summary: "ジオメトリ＋マテリアル＝メッシュ。scene に追加して描画する。",
    icon: "🧊",
    lessons: [
      { id: "three-first-mesh", title: "はじめてのメッシュ" },
      { id: "three-color", title: "マテリアルの色" },
      { id: "three-position", title: "位置を動かす" },
      { id: "three-background", title: "背景の色: scene.background" },
    ],
  },
  {
    id: "three-geometry",
    domain: "three",
    title: "ジオメトリ",
    summary: "箱・球・トーラス・平面。形を差し替えて遊ぶ。",
    icon: "📐",
    lessons: [
      { id: "three-sphere", title: "球: SphereGeometry" },
      { id: "three-torus", title: "ドーナツ: TorusGeometry" },
      { id: "three-plane", title: "平面: PlaneGeometry" },
    ],
  },
  {
    id: "three-material",
    domain: "three",
    title: "マテリアル",
    summary: "法線マテリアル・ワイヤーフレーム・半透明・自作シェーダーで見た目を変え、clippingPlanes で断面を見せる。",
    icon: "🎨",
    lessons: [
      { id: "three-normal-material", title: "法線マテリアル" },
      { id: "three-wireframe", title: "ワイヤーフレーム" },
      { id: "three-transparent", title: "半透明: transparent と opacity" },
      { id: "three-shader-material", title: "自作シェーダー: ShaderMaterial" },
      { id: "three-clipping", title: "断面を見せる: clippingPlanes" },
    ],
  },
  {
    id: "three-light",
    domain: "three",
    title: "ライティング",
    summary: "StandardMaterial は光が必要。環境光・平行光源・点光源・スポットライトで照らし、emissive で自ら光らせ、roughness でつやを出す。",
    icon: "💡",
    lessons: [
      { id: "three-ambient", title: "環境光: AmbientLight" },
      { id: "three-hemisphere-light", title: "空と地面の光: HemisphereLight" },
      { id: "three-directional", title: "平行光源: DirectionalLight" },
      { id: "three-point-light", title: "点光源: PointLight" },
      { id: "three-spot-light", title: "スポットライト: angle と penumbra" },
      { id: "three-emissive", title: "自分で光る: emissive" },
      { id: "three-roughness", title: "つやを出す: roughness" },
    ],
  },
  {
    id: "three-transform",
    domain: "three",
    title: "変形とグループ",
    summary: "拡大縮小、Group でまとめる、親子でくっつけて動かす、InstancedMesh で同じ形をたくさん描いて 1つずつ色を変える。",
    icon: "🔧",
    lessons: [
      { id: "three-scale", title: "拡大する: scale" },
      { id: "three-group", title: "まとめる: Group" },
      { id: "three-hierarchy", title: "親子関係: 親を回すと子もついてくる" },
      { id: "three-look-at", title: "的を向く: lookAt" },
      { id: "three-instanced", title: "大量に並べる: InstancedMesh" },
      { id: "three-instance-color", title: "1つずつ色を変える: setColorAt" },
    ],
  },
  {
    id: "three-math",
    domain: "three",
    title: "位置と回転の計算",
    summary: "Vector3 の lerp で 2点のあいだに置き、Quaternion で好きな軸のまわりに回し、球面座標（Spherical）で緯度と経度から位置を決める。",
    icon: "🎯",
    lessons: [
      { id: "three-lerp", title: "2点のあいだに置く: Vector3 の lerp" },
      { id: "three-quaternion", title: "好きな軸で回す: Quaternion" },
      { id: "three-spherical", title: "緯度と経度で置く: 球面座標" },
    ],
  },
  {
    id: "three-space",
    domain: "three",
    title: "ローカル座標とワールド座標",
    summary: "親子にした物の「親から見た位置」と「世界での位置」を行き来する。getWorldPosition、見た目を変えずに親を替える attach、行列を掛ける順番。",
    icon: "🪆",
    lessons: [
      { id: "three-world-position", title: "世界のどこにある？: getWorldPosition" },
      { id: "three-attach", title: "見た目を変えずに親を替える: attach" },
      { id: "three-matrix-order", title: "行列を掛ける順番: 動かしてから回す" },
    ],
  },
  {
    id: "three-camera",
    domain: "three",
    title: "カメラ",
    summary: "カメラの位置・向き・視野角で見え方を変え、カメラから光線を飛ばして指した場所を調べる。",
    icon: "🎥",
    lessons: [
      { id: "three-camera-back", title: "カメラを引く" },
      { id: "three-camera-angle", title: "見下ろす: lookAt" },
      { id: "three-camera-fov", title: "ズーム: fov と updateProjectionMatrix" },
      { id: "three-raycast", title: "指した場所を調べる: Raycaster" },
    ],
  },
  {
    id: "three-box",
    domain: "three",
    title: "大きさと中心を測る（Box3）",
    summary: "モデルを包む箱（Box3）で大きさと中心を測り、高さをそろえ、原点に置き直し、ちょうど画面に収まる距離へカメラを下げる。",
    icon: "📦",
    lessons: [
      { id: "three-box-size", title: "大きさをそろえる: Box3 と getSize" },
      { id: "three-box-center", title: "中心をそろえる: getCenter" },
      { id: "three-fit-camera", title: "カメラに収める: 大きさから距離を決める" },
    ],
  },
  {
    id: "three-find",
    domain: "three",
    title: "シーンの中を探して変える",
    summary: "名前で部品を探し（getObjectByName）、子孫を全部たどって変え（traverse）、共有されたマテリアルを複製して 1つだけ色を変える。",
    icon: "🔎",
    lessons: [
      { id: "three-find-by-name", title: "名前で探す: getObjectByName" },
      { id: "three-traverse", title: "全部たどる: traverse" },
      { id: "three-clone-material", title: "1つだけ色を変える: マテリアルの複製" },
    ],
  },
  {
    id: "three-animation",
    domain: "three",
    title: "アニメーション",
    summary: "回転の考え方と、キーフレームで動きを組み立てる AnimationClip。実アプリでは毎フレーム値を更新する。",
    icon: "🎞️",
    lessons: [
      { id: "three-rotate", title: "回転させる: rotation" },
      { id: "three-keyframes", title: "キーフレームで動かす: AnimationClip" },
    ],
  },
  {
    id: "three-data",
    domain: "three",
    title: "データで描く: 点とテクスチャ",
    summary: "数値の配列や Canvas 2D から、点の集まりやテクスチャを自分で組み立て、くり返して貼る。",
    icon: "🧮",
    lessons: [
      { id: "three-points", title: "点の集まり: Points" },
      { id: "three-data-texture", title: "コードで作る画像: DataTexture" },
      { id: "three-texture-repeat", title: "模様をくり返す: wrapS・wrapT と repeat" },
      { id: "three-canvas-texture", title: "コードで描いて貼る: CanvasTexture" },
    ],
  },
  {
    id: "three-vertices",
    domain: "three",
    title: "頂点から形をつくる",
    summary: "頂点の座標を数値で並べて三角形の面を張り、番号（index）で頂点を使い回し、頂点ごとの色でグラデーションにする。",
    icon: "🔺",
    lessons: [
      { id: "three-triangles", title: "三角形で面を張る: BufferGeometry" },
      { id: "three-index", title: "頂点を使い回す: setIndex" },
      { id: "three-vertex-colors", title: "頂点ごとの色: color 属性" },
    ],
  },
  {
    id: "three-uv",
    domain: "three",
    title: "テクスチャ座標（UV）",
    summary: "頂点ごとの uv で画像の貼り方を決め、repeat と offset で画像の一部（スプライトシートの 1コマ）を取り出し、rotation と center で画像を回す。",
    icon: "🗺️",
    lessons: [
      { id: "three-uv", title: "画像の貼り方を決める: uv 属性" },
      { id: "three-texture-atlas", title: "画像の一部を貼る: repeat と offset" },
      { id: "three-texture-rotation", title: "画像を回す: rotation と center" },
    ],
  },
  {
    id: "three-texture",
    domain: "three",
    title: "テクスチャの設定",
    summary: "拡大したドット絵をくっきりさせ（magFilter）、くり返しの継ぎ目を鏡のように消し（MirroredRepeatWrapping）、透明な所を切り抜く（alphaTest）。",
    icon: "🧩",
    lessons: [
      { id: "three-nearest-filter", title: "ドット絵をくっきり: magFilter" },
      { id: "three-mirrored-repeat", title: "継ぎ目なくくり返す: MirroredRepeatWrapping" },
      { id: "three-alpha-test", title: "透明な所を切り抜く: alphaTest" },
    ],
  },
  {
    id: "three-deform",
    domain: "three",
    title: "頂点を動かして変形する",
    summary: "position 属性を書き換えて板を波打たせ、高さに合わせて頂点の色を塗り、モーフターゲットで別の形へなめらかに変形させる。",
    icon: "🌊",
    lessons: [
      { id: "three-wave", title: "板を波打たせる: position 属性" },
      { id: "three-height-colors", title: "高さで塗り分ける: 頂点の色" },
      { id: "three-morph", title: "形を変形させる: モーフターゲット" },
    ],
  },
  {
    id: "three-curves",
    domain: "three",
    title: "線から形をつくる",
    summary: "断面の輪郭を回して器に、2D の輪郭を押し出して立体に、3D の曲線にそって管にする。",
    icon: "🏺",
    lessons: [
      { id: "three-lathe", title: "回して作る: LatheGeometry" },
      { id: "three-extrude", title: "押し出して厚みをつける: ExtrudeGeometry" },
      { id: "three-tube", title: "曲線にそって: TubeGeometry" },
    ],
  },
  {
    id: "three-shape",
    domain: "three",
    title: "輪郭を描く（Shape と Path）",
    summary: "Shape の輪郭を曲線でふくらませ（quadraticCurveTo）、円弧で扇形を描き（absarc）、Path で穴をあける（holes）。",
    icon: "✂️",
    lessons: [
      { id: "three-shape-curve", title: "曲線でふくらませる: quadraticCurveTo" },
      { id: "three-shape-arc", title: "扇形を描く: absarc" },
      { id: "three-shape-hole", title: "穴をあける: holes" },
    ],
  },
  {
    id: "three-path",
    domain: "three",
    title: "曲線にそって置く",
    summary: "曲線の上の位置を長さで測って取り出し（getPointAt）、等間隔に並べ（getSpacedPoints）、進む向き（getTangentAt）に向ける。",
    icon: "🛤️",
    lessons: [
      { id: "three-curve-point", title: "曲線の上の位置: getPointAt" },
      { id: "three-spaced-points", title: "等間隔に並べる: getSpacedPoints" },
      { id: "three-curve-tangent", title: "進む向きに向ける: getTangentAt" },
    ],
  },
  {
    id: "three-lines-sprites",
    domain: "three",
    title: "線とスプライト",
    summary: "点をつないで折れ線グラフを引き、いつもカメラを向くスプライトで光の玉やラベルを置く。",
    icon: "📈",
    lessons: [
      { id: "three-line", title: "点をつないで線を引く: Line" },
      { id: "three-sprite", title: "いつもカメラを向く: Sprite" },
    ],
  },
  {
    id: "three-atmosphere",
    domain: "three",
    title: "空気感: 霧と影",
    summary: "Fog と FogExp2 で遠くをかすませ、影を落として、シーンに奥行きと接地感を出す。",
    icon: "🌁",
    lessons: [
      { id: "three-fog", title: "遠くをかすませる: Fog" },
      { id: "three-fog-exp2", title: "濃さで決める霧: FogExp2" },
      { id: "three-shadow", title: "影を落とす: castShadow と receiveShadow" },
      { id: "three-shadow-material", title: "影だけを受ける床: ShadowMaterial" },
    ],
  },
];

export const LESSONS: readonly LessonMeta[] = TRACKS.flatMap((t) => t.lessons);

export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function trackOf(lessonId: string): TrackMeta | undefined {
  return TRACKS.find((t) => t.lessons.some((l) => l.id === lessonId));
}

/** Which runtime executes a lesson ("glsl" shader vs "three" scene). */
export function domainOf(lessonId: string): Domain | undefined {
  return trackOf(lessonId)?.domain;
}

/** The lesson after `id` in catalogue order, or undefined at the end. */
export function nextLesson(id: string): LessonMeta | undefined {
  const idx = LESSONS.findIndex((l) => l.id === id);
  return idx >= 0 ? LESSONS[idx + 1] : undefined;
}

/** The lesson before `id` in catalogue order, or undefined at the start
 *  (the lesson nav's "← 前のレッスン", SHIG 81). */
export function prevLesson(id: string): LessonMeta | undefined {
  const idx = LESSONS.findIndex((l) => l.id === id);
  return idx > 0 ? LESSONS[idx - 1] : undefined;
}

/**
 * Each track's module, imported on demand. Vite emits every import() below as
 * its own chunk, so the initial bundle never carries lesson bodies (the build
 * fails if one leaks in), and the service worker precaches the chunks for
 * offline use (both in vite.config.ts).
 */
const LOADERS: Readonly<Record<string, () => Promise<{ readonly track: Track }>>> = {
  "glsl-basics": () => import("./tracks/glsl-basics.js"),
  "glsl-uv": () => import("./tracks/glsl-uv.js"),
  "glsl-shapes": () => import("./tracks/glsl-shapes.js"),
  "glsl-plot": () => import("./tracks/glsl-plot.js"),
  "glsl-color": () => import("./tracks/glsl-color.js"),
  "glsl-motion": () => import("./tracks/glsl-motion.js"),
  "glsl-patterns": () => import("./tracks/glsl-patterns.js"),
  "glsl-sdf": () => import("./tracks/glsl-sdf.js"),
  "glsl-lines": () => import("./tracks/glsl-lines.js"),
  "glsl-transform": () => import("./tracks/glsl-transform.js"),
  "glsl-polar": () => import("./tracks/glsl-polar.js"),
  "glsl-hsv": () => import("./tracks/glsl-hsv.js"),
  "glsl-noise": () => import("./tracks/glsl-noise.js"),
  "glsl-tiling": () => import("./tracks/glsl-tiling.js"),
  "glsl-fractal": () => import("./tracks/glsl-fractal.js"),
  "glsl-post": () => import("./tracks/glsl-post.js"),
  "glsl-glow": () => import("./tracks/glsl-glow.js"),
  "glsl-filter": () => import("./tracks/glsl-filter.js"),
  "glsl-convolution": () => import("./tracks/glsl-convolution.js"),
  "glsl-distort": () => import("./tracks/glsl-distort.js"),
  "glsl-advanced": () => import("./tracks/glsl-advanced.js"),
  "glsl-sdf3d": () => import("./tracks/glsl-sdf3d.js"),
  "glsl-lighting": () => import("./tracks/glsl-lighting.js"),
  "glsl-rm-shading": () => import("./tracks/glsl-rm-shading.js"),
  "three-basics": () => import("./tracks/three-basics.js"),
  "three-geometry": () => import("./tracks/three-geometry.js"),
  "three-material": () => import("./tracks/three-material.js"),
  "three-light": () => import("./tracks/three-light.js"),
  "three-transform": () => import("./tracks/three-transform.js"),
  "three-math": () => import("./tracks/three-math.js"),
  "three-space": () => import("./tracks/three-space.js"),
  "three-camera": () => import("./tracks/three-camera.js"),
  "three-box": () => import("./tracks/three-box.js"),
  "three-find": () => import("./tracks/three-find.js"),
  "three-animation": () => import("./tracks/three-animation.js"),
  "three-data": () => import("./tracks/three-data.js"),
  "three-vertices": () => import("./tracks/three-vertices.js"),
  "three-uv": () => import("./tracks/three-uv.js"),
  "three-texture": () => import("./tracks/three-texture.js"),
  "three-deform": () => import("./tracks/three-deform.js"),
  "three-curves": () => import("./tracks/three-curves.js"),
  "three-shape": () => import("./tracks/three-shape.js"),
  "three-path": () => import("./tracks/three-path.js"),
  "three-lines-sprites": () => import("./tracks/three-lines-sprites.js"),
  "three-atmosphere": () => import("./tracks/three-atmosphere.js"),
};

/** A track with its lessons. Rejects for an id not in the catalogue. */
export async function loadTrack(id: string): Promise<Track> {
  const load = LOADERS[id];
  if (!load) throw new Error(`unknown track: ${id}`);
  return (await load()).track;
}

/** The full lesson with its challenge. Rejects for an id not in the catalogue. */
export async function loadLesson(id: string): Promise<Lesson> {
  const track = trackOf(id);
  const lesson = track && (await loadTrack(track.id)).lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`unknown lesson: ${id}`);
  return lesson;
}
