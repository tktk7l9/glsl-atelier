// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneSnapshot } from "../engine/validate/snapshot.js";
import { createSceneSandbox, type SceneSandbox } from "./scene-sandbox.js";

let iframe: HTMLIFrameElement;
let posted: Array<{ type: string; id: number; code: string }>;
let sandbox: SceneSandbox;

const snapshot = (source: string): SceneSnapshot => ({
  kind: "scene",
  error: null,
  source,
  objects: [],
  camera: null,
});

/** Simulate a message posted by the runner inside the iframe. */
function fromRunner(data: unknown, source: Window | null = iframe.contentWindow): void {
  window.dispatchEvent(new MessageEvent("message", { data, source }));
}

/** Record what the parent posts into the (current) iframe window. */
function spyOnPost(): void {
  vi.spyOn(iframe.contentWindow as Window, "postMessage").mockImplementation(
    ((msg: { type: string; id: number; code: string }) => void posted.push(msg)) as never,
  );
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = "";
  iframe = document.createElement("iframe");
  document.body.append(iframe);
  posted = [];
  spyOnPost();
  sandbox = createSceneSandbox(iframe);
});

afterEach(() => {
  sandbox.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createSceneSandbox", () => {
  it("holds a run until the iframe says it is ready, then ships the code", async () => {
    const result = sandbox.run("scene.add(cube)");
    await flush();
    expect(posted).toHaveLength(0);

    fromRunner({ type: "ready" });
    await flush();
    expect(posted).toEqual([{ type: "run", id: 1, code: "scene.add(cube)" }]);

    fromRunner({ type: "result", id: 1, snapshot: snapshot("scene.add(cube)") });
    await expect(result).resolves.toEqual(snapshot("scene.add(cube)"));
  });

  it("ignores messages that do not come from its own iframe", async () => {
    const result = sandbox.run("a");
    fromRunner({ type: "ready" }, null);
    await flush();
    expect(posted).toHaveLength(0);

    fromRunner({ type: "ready" });
    await flush();
    fromRunner({ type: "result", id: 1, snapshot: snapshot("stranger") }, null);
    fromRunner({ type: "result", id: 1, snapshot: snapshot("a") });
    await expect(result).resolves.toEqual(snapshot("a"));
  });

  it("ignores results for unknown ids and malformed results", async () => {
    fromRunner({ type: "ready" });
    const result = sandbox.run("a");
    await flush();
    fromRunner({ type: "result", id: 99, snapshot: snapshot("x") });
    fromRunner({ type: "result", id: "1", snapshot: snapshot("x") });
    fromRunner({ type: "result", id: 1 });
    fromRunner({ type: "noise" });
    let settled = false;
    void result.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);

    fromRunner({ type: "result", id: 1, snapshot: snapshot("a") });
    await expect(result).resolves.toEqual(snapshot("a"));
  });

  it("runs one request at a time so live preview and check never race", async () => {
    fromRunner({ type: "ready" });
    const first = sandbox.run("one");
    const second = sandbox.run("two");
    await flush();
    expect(posted.map((p) => p.code)).toEqual(["one"]);

    fromRunner({ type: "result", id: 1, snapshot: snapshot("one") });
    await first;
    await flush();
    expect(posted.map((p) => p.code)).toEqual(["one", "two"]);
    expect(posted[1].id).toBe(2);

    fromRunner({ type: "result", id: 2, snapshot: snapshot("two") });
    await expect(second).resolves.toEqual(snapshot("two"));
  });

  it("times out a hung run with a learner-facing message and reloads the iframe", async () => {
    vi.useFakeTimers();
    fromRunner({ type: "ready" });
    const result = sandbox.run("while(true){}");
    await vi.advanceTimersByTimeAsync(0);
    expect(posted).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(4999);
    expect(iframe.getAttribute("src")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    const snap = await result;
    expect(snap.error).toBe("実行がタイムアウトしました（無限ループの可能性）");
    expect(snap.source).toBe("while(true){}");
    expect(snap.objects).toEqual([]);
    expect(iframe.getAttribute("src")).toBe("/sandbox.html");

    // A late result for the timed-out id must not resolve anything twice or throw.
    fromRunner({ type: "result", id: 1, snapshot: snapshot("late") });

    // After the reload the sandbox waits for a fresh "ready" before the next run.
    // (Setting src gives the iframe a new window, as in a browser.)
    spyOnPost();
    const next = sandbox.run("ok");
    await vi.advanceTimersByTimeAsync(0);
    expect(posted).toHaveLength(1);
    fromRunner({ type: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    expect(posted).toHaveLength(2);
    fromRunner({ type: "result", id: 2, snapshot: snapshot("ok") });
    await expect(next).resolves.toEqual(snapshot("ok"));
  });

  it("stops listening and cancels pending timers on dispose", async () => {
    vi.useFakeTimers();
    fromRunner({ type: "ready" });
    const result = sandbox.run("a");
    await vi.advanceTimersByTimeAsync(0);
    sandbox.dispose();
    expect(vi.getTimerCount()).toBe(0);

    fromRunner({ type: "result", id: 1, snapshot: snapshot("a") });
    let settled = false;
    void result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(false);
    expect(iframe.getAttribute("src")).toBeNull();
  });
});
