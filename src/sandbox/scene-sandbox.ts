// Parent-side controller for the Three.js scene sandbox. Owns the opaque-origin
// iframe (created by the caller with sandbox="allow-scripts"), ships learner code
// in via postMessage, and resolves with the SceneSnapshot the runner posts back.
// A timeout guards against infinite loops in learner code: the hung iframe is
// isolated and simply reloaded for the next run.

import type { SceneSnapshot } from "../engine/validate/snapshot.js";

const TIMEOUT_MS = 5000;

export interface SceneSandbox {
  run(code: string): Promise<SceneSnapshot>;
  dispose(): void;
}

interface Pending {
  resolve(snap: SceneSnapshot): void;
  timer: ReturnType<typeof setTimeout>;
  code: string;
}

export function createSceneSandbox(iframe: HTMLIFrameElement): SceneSandbox {
  let nextId = 1;
  const pending = new Map<number, Pending>();
  let ready = false;
  let readyResolvers: Array<() => void> = [];

  function whenReady(): Promise<void> {
    if (ready) return Promise.resolve();
    return new Promise((r) => readyResolvers.push(r));
  }

  function onMessage(e: MessageEvent): void {
    if (e.source !== iframe.contentWindow) return;
    const data = e.data as { type?: string; id?: number; snapshot?: SceneSnapshot };
    if (data.type === "ready") {
      ready = true;
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

  function reload(): void {
    ready = false;
    // Re-pointing src reloads the iframe, which re-posts "ready".
    iframe.src = "/sandbox.html";
  }

  async function exec(code: string): Promise<SceneSnapshot> {
    await whenReady();
    const id = nextId++;
    return new Promise<SceneSnapshot>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reload();
        resolve({
          kind: "scene",
          error: "実行がタイムアウトしました（無限ループの可能性）",
          source: code,
          objects: [],
          camera: null,
        });
      }, TIMEOUT_MS);
      pending.set(id, { resolve, timer, code });
      iframe.contentWindow?.postMessage({ type: "run", id, code }, "*");
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
