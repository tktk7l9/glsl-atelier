// Parent-side controller for the Three.js scene sandbox. Owns the opaque-origin
// iframe (created by the caller with sandbox="allow-scripts"), ships learner code
// in via postMessage, and resolves with the SceneSnapshot the runner posts back.
// A timeout guards against infinite loops in learner code: the hung iframe is
// isolated and simply reloaded for the next run.
//
// The lesson view is re-mounted on every navigation, and re-inserting the
// iframe gives it a fresh window whose sandbox is still loading. Readiness
// therefore belongs to the window that said "ready", and a run that was posted
// to a window that has since been replaced is sent again to the new one;
// otherwise it would be lost and time out as an "infinite loop".

import type { SceneSnapshot } from "../engine/validate/snapshot.js";

const TIMEOUT_MS = 5000;

export interface SceneSandbox {
  run(code: string): Promise<SceneSnapshot>;
  dispose(): void;
}

interface Pending {
  resolve(snap: SceneSnapshot): void;
  timer?: ReturnType<typeof setTimeout>;
  code: string;
  /** The iframe window the run was last posted to. */
  target: MessageEventSource | null;
}

export function createSceneSandbox(iframe: HTMLIFrameElement): SceneSandbox {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  /** The iframe window whose sandbox last said "ready". */
  let readyWindow: MessageEventSource | null = null;
  let readyResolvers: Array<() => void> = [];

  function whenReady(): Promise<void> {
    if (readyWindow !== null && readyWindow === iframe.contentWindow) return Promise.resolve();
    return new Promise((r) => readyResolvers.push(r));
  }

  function reload(): void {
    // A reload keeps the same window in a browser, so forget its readiness.
    readyWindow = null;
    // Re-pointing src reloads the iframe, which re-posts "ready".
    iframe.src = "/sandbox.html";
  }

  /** Post run `id` to the iframe's current window, (re)starting its timeout. */
  function send(id: number, p: Pending): void {
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
      pending.delete(id);
      reload();
      p.resolve({
        kind: "scene",
        error: "実行がタイムアウトしました（無限ループの可能性）",
        source: p.code,
        objects: [],
        camera: null,
      });
    }, TIMEOUT_MS);
    p.target = iframe.contentWindow;
    iframe.contentWindow?.postMessage({ type: "run", id, code: p.code }, "*");
  }

  function onMessage(e: MessageEvent): void {
    if (e.source !== iframe.contentWindow) return;
    const data = e.data as { type?: string; id?: number; snapshot?: SceneSnapshot };
    if (data.type === "ready") {
      readyWindow = e.source;
      // A run posted to a window that has since been replaced will never be
      // answered; hand it to the new one.
      pending.forEach((p, id) => {
        if (p.target !== e.source) send(id, p);
      });
      readyResolvers.forEach((r) => r());
      readyResolvers = [];
      return;
    }
    if (data.type === "result" && typeof data.id === "number" && data.snapshot) {
      const p = pending.get(data.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(data.id);
        p.resolve(data.snapshot);
      }
    }
  }

  window.addEventListener("message", onMessage);

  async function exec(code: string): Promise<SceneSnapshot> {
    await whenReady();
    const id = nextId++;
    return new Promise<SceneSnapshot>((resolve) => {
      const p: Pending = { resolve, code, target: null };
      pending.set(id, p);
      send(id, p);
    });
  }

  // Serialize runs so live-update + check never have two outstanding requests
  // racing in the single-threaded iframe.
  let chain: Promise<unknown> = Promise.resolve();
  function run(code: string): Promise<SceneSnapshot> {
    const next = chain.then(() => exec(code));
    chain = next.catch(() => undefined);
    return next;
  }

  return {
    run,
    dispose() {
      window.removeEventListener("message", onMessage);
      pending.forEach((p) => clearTimeout(p.timer));
      pending.clear();
    },
  };
}
