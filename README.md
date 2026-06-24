# GLSL Atelier

手を動かして学ぶ、インタラクティブな **WebGL / Three.js** 学習サイト。GLSL フラグメントシェーダーと Three.js シーンを **書いて → ライブ描画で確認して → 自動採点でクリア** しながら学べます。雰囲気は「宇宙天文台 / Shader Lab」— 深宇宙の闇に星雲が漂い、bloom で発光します（[css-atelier](https://github.com/tktk7l9/css-atelier) の明るい製図スタジオの真逆）。

▶ **Play**: https://glsl-atelier.vercel.app/

## 特徴

- **2 つのドメイン**
  - **WebGL · GLSL シェーダー**: 座標(UV)・図形(step/smoothstep)・色(mix/cos)・時間(u_time)・パターン(fract/floor/mod)・簡易ライティングまで。
  - **Three.js · 3D シーン**: ジオメトリ・マテリアル・ライティング・変形/グループ・カメラ・回転まで、実際のコードを書いて学ぶ。
- **実行結果で採点（寛容）**: シェーダーは描画ピクセルの読み取り、Three.js はシーングラフの走査で判定。「正しく描けたか」を見るので、書き方は自由。
- **ライブプレビュー**: シェーダーはアニメーション付き、Three.js はその場でレンダリング。
- **ヒント / 解答 / 進捗保存**（localStorage）・**deep link**（URL ハッシュ）・**PWA / オフライン対応**。

## 設計の鍵 — 学習者のコードを安全に実行する

学習者が書いたものを **実際に実行** するのがこのアプリの核心です。実行系を 2 つに分け、メインアプリの **厳格な CSP（`script-src 'self'`・`unsafe-inline`/`unsafe-eval` なし）を完全に維持** します。

1. **GLSL シェーダーはメインページで直接実行。** シェーダーは GPU 上で動く専用言語で、任意の JavaScript は実行しません。だから `eval` は不要で、CSP を緩める必要もありません。固定サイズ・固定時刻でオフスクリーン描画し、`gl.readPixels` でピクセルを読み戻して採点します。
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
    validate/ {snapshot,color,sample,primitives,run}.ts
    content/  {types,index,glsl,three}.ts
    editor/   tokenize.ts          # GLSL / JS シンタックスハイライト
    progress.ts
  sandbox/                         # 実行ランタイム（表示層・対象外）
    shader-runtime.ts              # WebGL コンパイル＋描画＋読み戻し
    scene-sandbox.ts               # iframe コントローラ（親側）
    runner.ts                      # iframe 内 Three.js ランナー（sandbox.html にインライン）
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

## 技術スタック

Vanilla TypeScript · Vite 8 · Three.js 0.184 · Vitest 4。フレームワーク無し・ランタイム依存は Three.js のみ。

## セキュリティ

- メイン全ルート: 厳格 CSP（`unsafe-inline`/`unsafe-eval` なし）＋ HSTS / XFO DENY / nosniff / Referrer-Policy / Permissions-Policy。
- `/sandbox.html`: ルート限定の緩和 CSP（`connect-src 'none'`）。不透明オリジン iframe 内に閉じ込め。
- 依存は最小・`npm audit` 0 件を維持。
