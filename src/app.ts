// Heavy-ish lesson runtime (lazy-loaded by main.ts). Builds the lesson view once
// and reuses it across lessons via open(id). Wires the editor → live preview →
// grading for both domains:
//  - glsl : an animated WebGL preview on a canvas + an offscreen grader.
//  - three: the opaque-origin sandbox iframe (which both renders the live
//           preview and reads back the scene graph for grading).

import { el } from "./ui/dom.js";
import { createEditor, type Editor } from "./ui/editor.js";
import { evaluate } from "./engine/validate/run.js";
import { domainOf, lessonById, nextLesson } from "./engine/content/index.js";
import type { Lesson } from "./engine/content/types.js";
import { markComplete, type ProgressStore } from "./engine/progress.js";
import {
  createShaderGrader,
  createShaderPreview,
  type ShaderGrader,
  type ShaderPreview,
} from "./sandbox/shader-runtime.js";
import { createSceneSandbox, type SceneSandbox } from "./sandbox/scene-sandbox.js";

const store: ProgressStore = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage disabled */
    }
  },
};

export interface AppCallbacks {
  onComplete(lessonId: string): void;
  onBack(): void;
  onOpen(lessonId: string): void;
  reducedMotion: boolean;
}

export interface AppController {
  readonly root: HTMLElement;
  open(lessonId: string): Promise<void>;
  dispose(): void;
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function createApp(callbacks: AppCallbacks): AppController {
  const root = el("div", { class: "lesson" });

  // ---- left: doc + editor + actions ----
  const doc = el("div", { class: "panel lesson__doc" });
  const title = el("h2");
  const explain = el("div", { class: "explain" });
  const task = el("div", { class: "task" });
  const mdn = el("a", { class: "mdn-link", attrs: { target: "_blank", rel: "noopener" } });
  const editor: Editor = createEditor("editor");
  const errorBar = el("div", { class: "error-bar", attrs: { role: "status", "aria-live": "polite" } });

  const checkBtn = el("button", { class: "btn btn--primary", text: "チェック" });
  const resetBtn = el("button", { class: "btn btn--ghost", text: "リセット" });
  const hintBtn = el("button", { class: "btn btn--ghost", text: "ヒント" });
  const solBtn = el("button", { class: "btn btn--ghost", text: "解答を見る" });
  const nextBtn = el("button", { class: "btn", text: "次のレッスン →" });
  const actions = el("div", { class: "actions" });
  actions.append(checkBtn, resetBtn, hintBtn, solBtn, nextBtn);

  const banner = el("div", { class: "banner", attrs: { role: "status", "aria-live": "polite" } });
  const hints = el("div", { class: "hints" });
  doc.append(title, explain, task, mdn, editor.root, errorBar, actions, banner, hints);

  // ---- right: live preview ----
  const viz = el("div", { class: "viz" });
  const vizHead = el("div", { class: "viz__head" });
  const vizTitle = el("span", { text: "プレビュー" });
  const badge = el("span", { class: "viz__badge" });
  vizHead.append(vizTitle, badge);
  const vizBody = el("div", { class: "viz__body" });
  const shaderCanvas = el("canvas", {
    class: "preview-canvas",
    attrs: { "aria-hidden": "true" },
  }) as HTMLCanvasElement;
  const sceneFrame = el("iframe", {
    class: "preview-frame",
    attrs: { sandbox: "allow-scripts", title: "3D プレビュー", "aria-label": "3D プレビュー" },
  }) as HTMLIFrameElement;
  vizBody.append(shaderCanvas, sceneFrame);
  viz.append(vizHead, vizBody);
  root.append(doc, viz);

  // ---- lazily-created runtimes ----
  let shaderPreview: ShaderPreview | null = null;
  let shaderGrader: ShaderGrader | null = null;
  let sceneSandbox: SceneSandbox | null = null;

  let current: Lesson | null = null;
  let domain: "glsl" | "three" = "glsl";
  let hintsShown = 0;

  function ensureShader(): { preview: ShaderPreview; grader: ShaderGrader } {
    if (!shaderPreview) shaderPreview = createShaderPreview(shaderCanvas, callbacks.reducedMotion);
    if (!shaderGrader) shaderGrader = createShaderGrader();
    return { preview: shaderPreview, grader: shaderGrader };
  }

  function ensureScene(): SceneSandbox {
    if (!sceneSandbox) {
      sceneFrame.src = "/sandbox.html";
      sceneSandbox = createSceneSandbox(sceneFrame);
    }
    return sceneSandbox;
  }

  function clearBanner(): void {
    banner.className = "banner";
    banner.textContent = "";
  }

  function showBanner(pass: boolean, failures: readonly string[]): void {
    banner.className = `banner banner--show ${pass ? "banner--pass" : "banner--fail"}`;
    banner.textContent = "";
    if (pass) {
      banner.append(el("div", { text: "✓ クリア！ よくできました。" }));
    } else {
      banner.append(el("div", { text: "もう少し！ 次を確認しましょう:" }));
      const ul = el("ul");
      for (const f of failures) ul.append(el("li", { text: f }));
      banner.append(ul);
    }
  }

  function setError(message: string): void {
    errorBar.textContent = message;
    errorBar.classList.toggle("is-show", message !== "");
  }

  const liveUpdate = debounce(() => {
    const code = editor.getValue();
    if (domain === "glsl") {
      const { preview } = ensureShader();
      setError(preview.setSource(code));
    } else {
      void ensureScene()
        .run(code)
        .then((snap) => setError(snap.error ?? ""));
    }
  }, 200);

  async function check(): Promise<void> {
    if (!current) return;
    const lesson = current;
    const code = editor.getValue();
    let failures: readonly string[];
    if (domain === "glsl") {
      const { grader } = ensureShader();
      failures = evaluate(lesson.challenge.validators, grader.grade(code)).failures;
    } else {
      const snap = await ensureScene().run(code);
      setError(snap.error ?? "");
      failures = evaluate(lesson.challenge.validators, snap).failures;
    }
    const passed = failures.length === 0;
    showBanner(passed, failures);
    if (passed) {
      markComplete(store, lesson.id);
      callbacks.onComplete(lesson.id);
      nextBtn.classList.add("btn--primary");
    }
  }

  function revealHint(): void {
    if (!current) return;
    if (hintsShown < current.challenge.hints.length) {
      hints.append(el("div", { class: "hint", text: `💡 ${current.challenge.hints[hintsShown]}` }));
      hintsShown++;
    }
    if (hintsShown >= current.challenge.hints.length) hintBtn.disabled = true;
  }

  function loadCode(code: string): void {
    editor.setValue(code);
    clearBanner();
    setError("");
    liveUpdate();
  }

  editor.onInput(liveUpdate);
  editor.onSubmit(() => void check());
  checkBtn.addEventListener("click", () => void check());
  resetBtn.addEventListener("click", () => {
    if (current) loadCode(current.challenge.starterCode);
  });
  hintBtn.addEventListener("click", revealHint);
  solBtn.addEventListener("click", () => {
    if (current) loadCode(current.challenge.solution);
  });
  nextBtn.addEventListener("click", () => {
    const n = current ? nextLesson(current.id) : undefined;
    if (n) callbacks.onOpen(n.id);
    else callbacks.onBack();
  });

  async function open(lessonId: string): Promise<void> {
    const lesson = lessonById(lessonId);
    if (!lesson) return;
    current = lesson;
    domain = domainOf(lessonId) ?? "glsl";
    hintsShown = 0;
    hintBtn.disabled = false;
    nextBtn.classList.remove("btn--primary");
    clearBanner();
    setError("");
    hints.textContent = "";

    title.textContent = lesson.title;
    explain.innerHTML = lesson.explanation; // trusted, authored content
    task.innerHTML = `<span class="task__label">課題</span>${lesson.challenge.task}`;
    if (lesson.mdnPath) {
      mdn.textContent = "MDN でもっと学ぶ →";
      mdn.setAttribute("href", `https://developer.mozilla.org${lesson.mdnPath}`);
      mdn.classList.remove("hidden");
    } else {
      mdn.classList.add("hidden");
    }

    editor.setLang(domain === "glsl" ? "glsl" : "js");
    badge.textContent = domain === "glsl" ? "GLSL" : "Three.js";

    const showShader = domain === "glsl";
    shaderCanvas.classList.toggle("hidden", !showShader);
    sceneFrame.classList.toggle("hidden", showShader);

    title.tabIndex = -1;
    title.focus({ preventScroll: true });

    loadCode(lesson.challenge.starterCode);
    if (showShader) ensureShader().preview.resize();
  }

  function dispose(): void {
    shaderPreview?.dispose();
    shaderGrader?.dispose();
    sceneSandbox?.dispose();
  }

  return { root, open, dispose };
}
