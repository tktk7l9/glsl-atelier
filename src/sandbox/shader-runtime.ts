// The impure WebGL shader runtime. Two roles:
//  - createShaderPreview: a live, animated preview on the visible canvas.
//  - createShaderGrader: a persistent offscreen context that compiles + renders
//    the learner's fragment shader at a FIXED size & time and reads back a
//    deterministic pixel grid → ShaderSnapshot (consumed by the pure validators).
// Compiling/rendering a GLSL shader executes no arbitrary JS, so this safely
// runs on the main page under the strict CSP (no eval needed).

import type { ShaderSnapshot } from "../engine/validate/snapshot.js";
import { toGridSamples } from "./sample-grid.js";

const VERT = "attribute vec2 a_pos;\nvoid main() { gl_Position = vec4(a_pos, 0.0, 1.0); }";
// One big triangle that covers the whole clip space.
const TRI = new Float32Array([-1, -1, 3, -1, -1, 3]);

interface Compiled {
  program: WebGLProgram | null;
  log: string;
}

function makeProgram(gl: WebGLRenderingContext, fragSrc: string): Compiled {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return { program: null, log: "シェーダーを作成できません" };
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  gl.shaderSource(fs, fragSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fs) ?? "コンパイルエラー";
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return { program: null, log };
  }
  const program = gl.createProgram();
  if (!program) return { program: null, log: "プログラムを作成できません" };
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "リンクエラー";
    gl.deleteProgram(program);
    return { program: null, log };
  }
  return { program, log: "" };
}

function bindTriangle(gl: WebGLRenderingContext, program: WebGLProgram, buffer: WebGLBuffer): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  w: number,
  h: number,
  time: number,
  mouse: readonly [number, number],
): void {
  const res = gl.getUniformLocation(program, "u_resolution");
  if (res) gl.uniform2f(res, w, h);
  const t = gl.getUniformLocation(program, "u_time");
  if (t) gl.uniform1f(t, time);
  const m = gl.getUniformLocation(program, "u_mouse");
  if (m) gl.uniform2f(m, mouse[0], mouse[1]);
}

export interface ShaderGrader {
  grade(source: string, time?: number): ShaderSnapshot;
  dispose(): void;
}

export function createShaderGrader(size = 128, grid = 24): ShaderGrader {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  const buffer = gl?.createBuffer() ?? null;
  if (gl && buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, TRI, gl.STATIC_DRAW);
  }

  function grade(source: string, time = 1.0): ShaderSnapshot {
    const base = { kind: "shader" as const, resolution: { w: size, h: size }, time, source };
    if (!gl || !buffer) {
      return { ...base, compiled: false, log: "WebGL を初期化できません", samples: [] };
    }
    const { program, log } = makeProgram(gl, source);
    if (!program) return { ...base, compiled: false, log, samples: [] };
    gl.viewport(0, 0, size, size);
    gl.useProgram(program);
    bindTriangle(gl, program, buffer);
    setUniforms(gl, program, size, size, time, [size / 2, size / 2]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.deleteProgram(program);
    return { ...base, compiled: true, log: "", samples: toGridSamples(pixels, size, size, grid) };
  }

  return {
    grade,
    dispose() {
      const ext = gl?.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    },
  };
}

export interface ShaderPreview {
  /** Recompile the user shader; returns the error log ("" on success). */
  setSource(source: string): string;
  resize(): void;
  dispose(): void;
}

export function createShaderPreview(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
): ShaderPreview {
  const gl = canvas.getContext("webgl", { antialias: true });
  const buffer = gl?.createBuffer() ?? null;
  if (gl && buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, TRI, gl.STATIC_DRAW);
  }
  let program: WebGLProgram | null = null;
  let raf = 0;
  const start = performance.now();
  const mouse: [number, number] = [0, 0];

  function dpr(): number {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resize(): void {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr()));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr()));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function frame(): void {
    if (!gl || !buffer || !program) return;
    resize();
    const time = reducedMotion ? 1.0 : (performance.now() - start) / 1000;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    bindTriangle(gl, program, buffer);
    setUniforms(gl, program, canvas.width, canvas.height, time, mouse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reducedMotion) raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse[0] = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse[1] = (1 - (e.clientY - r.top) / r.height) * canvas.height;
  });

  // The non-reduced path re-reads size every RAF; reduced motion needs a nudge.
  window.addEventListener("resize", () => {
    if (reducedMotion) frame();
  });

  function setSource(source: string): string {
    if (!gl || !buffer) return "WebGL を初期化できません";
    const next = makeProgram(gl, source);
    if (!next.program) return next.log;
    if (program) gl.deleteProgram(program);
    program = next.program;
    cancelAnimationFrame(raf);
    frame();
    return "";
  }

  return {
    setSource,
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      if (gl && program) gl.deleteProgram(program);
    },
  };
}
