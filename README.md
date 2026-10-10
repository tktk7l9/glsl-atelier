# GLSL Atelier

手を動かして学ぶ、インタラクティブな **WebGL / Three.js** 学習サイト。GLSL フラグメントシェーダーと Three.js シーンを **書いて → ライブ描画で確認して → 自動採点でクリア** しながら学べます。雰囲気は「宇宙天文台 / Shader Lab」— 深宇宙の闇に星雲が漂い、bloom で発光します（[css-atelier](https://github.com/tktk7l9/css-atelier) の明るい製図スタジオの真逆）。

▶ **Play**: https://glsl-atelier.saitotakuya0719.workers.dev/

## 特徴

- **2 つのドメイン・25 トラック 96 レッスン**
  - **WebGL · GLSL シェーダー**（14 トラック 52 レッスン）: 座標(UV)・図形(step/smoothstep・fwidth でアンチエイリアス)・色(mix/cos・スクリーン/オーバーレイ合成)・時間(u_time・イージング)・パターン(fract/floor/mod)・距離関数(SDF・くり抜き)・座標変換(回転行列 mat2・abs で鏡映)・極座標(うずまき・万華鏡まで)・乱数とノイズ(セルラーノイズまで)・敷きつめ模様(レンガ・六角形・トルシェ)・ポストエフェクト(トーンマッピング・ガンマ補正・リニアな混色・ディザリング)・フィルタ(白黒・セピア・ポスタリゼーション・モザイク・走査線)・ライティングとレイマーチング(勾配による法線・影)まで。
  - **Three.js · 3D シーン**（11 トラック 44 レッスン）: 背景色・ジオメトリ・マテリアル(半透明・ShaderMaterial・clippingPlanes)・ライティング(HemisphereLight・点光源・スポットライト・emissive・roughness)・変形/グループ/親子関係/lookAt/InstancedMesh(コピーごとの色)・カメラ(視野角・Raycaster)・回転とキーフレームアニメーション・点群と DataTexture・テクスチャのくり返しと CanvasTexture・回転体/押し出し/チューブ・折れ線(Line)とスプライト・霧(Fog/FogExp2)と影(ShadowMaterial まで)、実際のコードを書いて学ぶ。
- **実行結果で採点（寛容）**: シェーダーは描画ピクセルの読み取り、Three.js はシーングラフの走査＋描画ピクセルの読み取りで判定。「正しく描けたか」を見るので、書き方は自由。
- **ライブプレビュー**: シェーダーはアニメーション付き、Three.js はその場でレンダリング。
- **ヒント / 解答 / 進捗保存**（localStorage）・**deep link**（URL ハッシュ）・**PWA / オフライン対応**。

## 設計の鍵 — 学習者のコードを安全に実行する

学習者が書いたものを **実際に実行** するのがこのアプリの核心です。実行系を 2 つに分け、メインアプリの **厳格な CSP（`script-src 'self'`・`unsafe-inline`/`unsafe-eval` なし）を完全に維持** します。

1. **GLSL シェーダーはメインページで直接実行。** シェーダーは GPU 上で動く専用言語で、任意の JavaScript は実行しません。だから `eval` は不要で、CSP を緩める必要もありません。固定サイズ・固定時刻でオフスクリーン描画し、`gl.readPixels` でピクセルを読み戻して採点します（`fwidth` 用に WebGL 1 の拡張 `OES_standard_derivatives` を有効にしています）。
2. **Three.js（任意の JS）は隔離されたサンドボックスでのみ実行。**
   - `sandbox="allow-scripts"` の **不透明オリジン** iframe（`allow-same-origin` は付けない）で動かすため、親の DOM・Cookie・localStorage には一切触れません。
   - `/sandbox.html` **だけ** に限定した緩和 CSP（`script-src 'unsafe-inline' 'unsafe-eval'` ＋ **`connect-src 'none'`**）を適用。`connect-src 'none'` で外部送信を遮断するので、情報の持ち出しもできません。緩和は無力な不透明サンドボックス内に閉じ込められ、サイト本体の A+ 姿勢は不変です。
   - 親 ⇄ iframe は `postMessage` のみ。コードを渡し、シーングラフのスナップショットを受け取ります。無限ループはタイムアウトで隔離・再読み込み。

これは css-atelier が「constructable stylesheet で CSS を CSP を緩めずに適用した」のと同じ発想の、グラフィックス版です。

## アーキテクチャ

純粋な **エンジン層**（`src/engine/**`）と、不純な **実行・表示層** を分離。エンジンは直列化可能な `Snapshot`（シェーダー＝ピクセル / シーン＝シーングラフ）を入力に、純粋関数のバリデータで採点します。だから Node 上で決定的にテストでき、**100% カバレッジでゲート** しています。

```
src/
  main.ts app.ts styles.css        # シェル・ルーティング・レッスン実行・テーマ
  engine/                          # 純ロジック（100% カバレッジ）
    validate/ {snapshot,color,sample,primitives,run,describe}.ts
    content/  {types,index,glsl,three}.ts
    editor/   tokenize.ts          # GLSL / JS シンタックスハイライト
    progress.ts
  sandbox/                         # 実行ランタイム（表示層・対象外）
    shader-runtime.ts              # WebGL コンパイル＋描画＋読み戻し
    scene-sandbox.ts               # iframe コントローラ（親側）
    runner.ts                      # iframe 内 Three.js ランナー（sandbox.html にインライン）
    scene-runner.ts                # コード実行・描画・読み戻し・リサイズ後の再描画（Node でもテスト）
    scene-graph.ts                 # シーングラフ → Snapshot（純粋・Node でもテスト）
    sample-grid.ts
  ui/ {dom,editor,catalogue}.ts
  viz/ background.ts               # 星雲＋星＋bloom の宇宙背景（遅延読み込み）
```

## クイックスタート

```bash
npm install
npm run dev        # http://localhost:5173
```

## 開発ワークフロー

```bash
npm run typecheck   # tsc --noEmit（strict）
npm run test        # vitest
npm run coverage    # engine を 100% ゲート
npm run build       # tsc + vite build（sandbox.html も自己完結で生成）
```

`src/engine/content/solvable.test.ts` が「全レッスンの解答は通り、初期コードは通らない」ことを確かめます。シェーダーは JS に移植して採点と同じ 24×24 の位置で評価し、Three.js は実際の `three` でコードを実行してシーングラフを採点します（直接光を使わないシーン — 基本色・法線の色・テクスチャ・点・スプライト・半透明・クリッピング・霧・背景色・コピーごとの色・環境光と半球光 — は three の Raycaster で画素まで再現し、1:1 と 16:9 のプレビューで判定）。新しいレッスンでは、ありがちな間違い（ニアミス）が不合格になること、別の正しい書き方が合格することも確かめます。

## 技術スタック

Vanilla TypeScript · Vite 8 · Three.js 0.186 · Vitest 5。フレームワーク無し・ランタイム依存は Three.js のみ。

## セキュリティ

- メイン全ルート: 厳格 CSP（`unsafe-inline`/`unsafe-eval` なし）＋ HSTS / XFO DENY / nosniff / Referrer-Policy / Permissions-Policy。
- `/sandbox.html`: ルート限定の緩和 CSP（`connect-src 'none'`）。不透明オリジン iframe 内に閉じ込め。
- 依存は最小・`npm audit` 0 件を維持。

## ホスティング

本番は **Cloudflare Workers (static assets)**: https://glsl-atelier.saitotakuya0719.workers.dev

2026-08-11、Vercel 無料枠の超過でアカウントが停止（全プロジェクトが
`402 DEPLOYMENT_DISABLED`）したため移行した。ビルド成果物は純粋な静的
ファイルなので Worker スクリプトは無く、`wrangler.jsonc` の `assets` だけで
配信している。セキュリティヘッダーは `public/_headers`（`vercel.json` の
`headers` を移植したもの）。`npm run deploy` で build + wrangler deploy。
Vercel 側の設定も残置してあるので、復旧すれば両方に出せる。
