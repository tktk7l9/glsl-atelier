// @vitest-environment jsdom
//
// The live shader preview after a resize. jsdom has no WebGL, so the canvas
// gets a stand-in context that accepts every call and counts the draws; the
// canvas's CSS box is set by hand. Resizing a canvas clears it, and with
// reduced motion there is no animation loop to paint it again, so the preview
// must redraw on its own.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createShaderPreview, type ShaderPreview } from "./shader-runtime.js";

const SHADER = "void main() { gl_FragColor = vec4(1.0); }";

/** A WebGL context that succeeds at everything; constants are numbers. */
function fakeGl(): { gl: WebGLRenderingContext; draws: () => number } {
  let draws = 0;
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (/^[A-Z_0-9]+$/.test(prop)) return 1;
      return (..._args: unknown[]) => {
        if (prop === "drawArrays") draws++;
        if (prop === "getShaderParameter" || prop === "getProgramParameter") return true;
        if (prop.startsWith("create") || prop === "getUniformLocation") return {};
        return 0;
      };
    },
  });
  return { gl: gl as unknown as WebGLRenderingContext, draws: () => draws };
}

const previews: ShaderPreview[] = [];

function setup(width: number, height: number) {
  const canvas = document.createElement("canvas");
  const { gl, draws } = fakeGl();
  canvas.getContext = (() => gl) as unknown as HTMLCanvasElement["getContext"];
  const box = { width, height };
  Object.defineProperty(canvas, "clientWidth", { get: () => box.width });
  Object.defineProperty(canvas, "clientHeight", { get: () => box.height });
  const preview = createShaderPreview(canvas, true);
  previews.push(preview);
  return { canvas, box, draws, preview };
}

afterEach(() => {
  previews.splice(0).forEach((p) => p.dispose());
  vi.unstubAllGlobals();
});

describe("createShaderPreview: resizing", () => {
  it("redraws at once when the window resize changes the canvas size", () => {
    const { canvas, box, draws, preview } = setup(300, 300);
    expect(preview.setSource(SHADER)).toBe("");
    expect(draws()).toBe(1);
    expect([canvas.width, canvas.height]).toEqual([300, 300]);

    // A rotated phone: the preview turns 16:9.
    box.width = 400;
    box.height = 225;
    window.dispatchEvent(new Event("resize"));
    expect([canvas.width, canvas.height]).toEqual([400, 225]);
    expect(draws()).toBe(2);
  });

  it("leaves a canvas that already fits alone (setting its size would clear it)", () => {
    const { canvas, draws, preview } = setup(300, 300);
    preview.setSource(SHADER);
    const before = canvas.width;
    preview.resize();
    window.dispatchEvent(new Event("resize"));
    expect(canvas.width).toBe(before);
    expect(draws()).toBe(1);
  });

  it("only fits the canvas while no shader has compiled", () => {
    const { canvas, box, draws, preview } = setup(300, 300);
    box.width = 200;
    preview.resize();
    expect(canvas.width).toBe(200);
    expect(draws()).toBe(0);
  });

  it("follows the canvas box with a ResizeObserver (layout changes, being shown again)", () => {
    const observed: Array<{ target: Element; callback: () => void; connected: boolean }> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private readonly entry: { target: Element; callback: () => void; connected: boolean };
        constructor(callback: () => void) {
          this.entry = { target: document.body, callback, connected: true };
          observed.push(this.entry);
        }
        observe(target: Element) {
          this.entry.target = target;
        }
        disconnect() {
          this.entry.connected = false;
        }
      },
    );
    const { canvas, box, draws, preview } = setup(300, 300);
    expect(observed.map((o) => o.target)).toEqual([canvas]);
    preview.setSource(SHADER);

    // The preview is shown again after a Three.js lesson hid it.
    box.width = 0;
    box.height = 0;
    observed[0].callback();
    box.width = 320;
    box.height = 180;
    observed[0].callback();
    expect([canvas.width, canvas.height]).toEqual([320, 180]);
    expect(draws()).toBe(3);

    preview.dispose();
    expect(observed[0].connected).toBe(false);
  });

  it("stops listening once disposed", () => {
    const { box, draws, preview } = setup(300, 300);
    preview.setSource(SHADER);
    preview.dispose();
    box.width = 500;
    window.dispatchEvent(new Event("resize"));
    expect(draws()).toBe(1);
  });
});
