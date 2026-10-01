// @vitest-environment jsdom
//
// The production-only bootstrap paths of main.ts: analytics beacon, service
// worker registration and the requestIdleCallback route for the background.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/dom";

vi.mock("./app.js", () => ({ createApp: vi.fn() }));
const backgroundCalls: unknown[][] = [];
vi.mock("./viz/background.js", () => ({
  createBackground: (...args: unknown[]) => void backgroundCalls.push(args),
}));

const register = vi.fn(async () => undefined);
let idleCallbacks = 0;

beforeAll(async () => {
  vi.stubEnv("PROD", true);
  document.body.innerHTML = '<div id="app"></div>';
  window.matchMedia = () => ({ matches: false }) as MediaQueryList;
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    value: (cb: () => void) => {
      idleCallbacks++;
      cb();
    },
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  // Storage that is switched off (private mode) must not break the shell.
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
  await import("./main.js");
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("production bootstrap", () => {
  it("adds the Cloudflare analytics beacon", () => {
    const beacon = document.head.querySelector<HTMLScriptElement>("script[data-cf-beacon]");
    expect(beacon?.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(beacon?.type).toBe("module");
    expect(beacon?.dataset.cfBeacon).toContain('"token"');
  });

  it("registers the service worker once the page has loaded", () => {
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("starts the background from requestIdleCallback with motion enabled", async () => {
    expect(idleCallbacks).toBe(1);
    await waitFor(() => expect(backgroundCalls).toHaveLength(1));
    expect(backgroundCalls[0]).toEqual([document.querySelector("canvas#bg"), false]);
  });

  it("leaves the bar height to the stylesheet where ResizeObserver is missing", () => {
    expect(typeof ResizeObserver).toBe("undefined");
    expect(document.documentElement.style.getPropertyValue("--topbar-h")).toBe("");
    expect(document.querySelector("header .topbar-back")?.classList.contains("is-show")).toBe(false);
  });

  it("still renders the catalogue when storage throws", () => {
    expect(document.querySelector("main h1")?.textContent).toBe("GLSL Atelier");
    expect(document.querySelector("main .resume__status")?.textContent).toMatch(/クリアしたレッスン 0 \//);
  });
});
