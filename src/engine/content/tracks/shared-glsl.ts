// Helpers shared by two or more GLSL shader tracks (shader heads, common
// GLSL functions and colours). Each track module imports what it uses.

export const HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
`;

export const sh = (body: string): string => `${HEAD}\n${body}\n`;

// The sin-based hash multiplies by 43758.5453, which a real 16-bit mediump
// float cannot hold (mobile GPUs honour mediump), so the noise lessons ask for
// highp — supported by every WebGL device in practice and a no-op on desktop.
export const HEAD_HIGHP = HEAD.replace("precision mediump float;", "precision highp float;");

export const shHigh = (body: string): string => `${HEAD_HIGHP}\n${body}\n`;

/** Aspect-correct centred coordinates: p ∈ [-1, 1] on the short axis. */
export const CENTRED =
  "  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);\n";

export const RANDOM_FN =
  "// 2D の座標から 0〜1 の「でたらめな値」を作る定番のハッシュ\n" +
  "float random(vec2 v) {\n" +
  "  return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453);\n" +
  "}\n\n";

export const WHITE: [number, number, number] = [1, 1, 1];

export const BLACK: [number, number, number] = [0, 0, 0];

/** The filter track's source picture: a sky gradient, a sun and a hill, as a
 *  function of the coordinate so a lesson can read it wherever it likes. */
export const PICTURE_FN =
  "// 元の絵: 空のグラデーション・太陽・丘（座標 uv の色を返す）\n" +
  "vec3 picture(vec2 uv) {\n" +
  "  vec3 col = mix(vec3(0.15, 0.3, 0.7), vec3(0.6, 0.85, 1.0), uv.y);                     // 空\n" +
  "  col = mix(col, vec3(0.95, 0.9, 0.45), 1.0 - step(0.16, distance(uv, vec2(0.6875))));   // 太陽\n" +
  "  col = mix(col, vec3(0.1, 0.4, 0.15), 1.0 - step(0.3 + 0.1 * sin(uv.x * 6.0), uv.y));  // 丘\n" +
  "  return col;\n" +
  "}\n\n";

/** `main()` of the filter lessons: the picture at `st`, then `filter` on `col`. */
export const filterMain = (filter: string): string =>
  "void main() {\n" +
  "  vec2 st = gl_FragCoord.xy / u_resolution;\n" +
  "  vec3 col = picture(st);\n" +
  filter +
  "  gl_FragColor = vec4(col, 1.0);\n}";

/** The picture's flat colours as drawn. */
export const SUN: [number, number, number] = [0.95, 0.9, 0.45];

export const HILL: [number, number, number] = [0.1, 0.4, 0.15];
