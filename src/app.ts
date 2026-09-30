// Heavy-ish lesson runtime (lazy-loaded by main.ts). Builds the lesson view once
// and reuses it across lessons via open(id). Wires the editor → live preview →
// grading for both domains:
//  - glsl : an animated WebGL preview on a canvas + an offscreen grader.
//  - three: the opaque-origin sandbox iframe (which both renders the live
//           preview and reads back the scene graph for grading).

import { el } from "./ui/dom.js";
import { createEditor, type Editor } from "./ui/editor.js";
import { evaluate } from "./engine/validate/run.js";
import { describeCompileLog } from "./engine/validate/describe.js";
import { domainOf, lessonById, nextLesson, prevLesson, trackOf } from "./engine/content/index.js";
import type { Lesson } from "./engine/content/types.js";
import { markComplete, type ProgressStore } from "./engine/progress.js";
import { loadDraft, saveDraft } from "./engine/drafts.js";
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

  // ---- explanation panel ----
  // The lesson is split into an explanation panel and a workbench panel so that
  // on narrow screens the preview sits between them, right above the editor
  // (SHIG 30, 66). On wide screens both panels stack in the left column.
  const doc = el("div", { class: "panel lesson__doc" });
  // A landmark so screen-reader users can jump straight to the way out (SHIG 59, 60).
  const nav = el("nav", { class: "lesson__nav", attrs: { "aria-label": "レッスンの移動" } });
  // A plain link to "#" routes back to the catalogue and works without the
  // browser's back button in a standalone PWA (SHIG 60, 82).
  const backLink = el("a", { class: "back-link", text: "← レッスン一覧", attrs: { href: "#" } });
  const position = el("span", { class: "lesson__position" });
  // Previous / next as plain hash links, left = back and right = forward
  // (SHIG 81, 59). They live in the nav, apart from the editing actions (73).
  const steps = el("span", { class: "lesson__steps" });
  const prevLink = el("a", { class: "step-link", text: "← 前のレッスン" });
  const nextLink = el("a", { class: "step-link", text: "次のレッスン →" });
  steps.append(prevLink, nextLink);
  const navRight = el("span", { class: "lesson__nav-right" });
  navRight.append(position, steps);
  nav.append(backLink, navRight);
  // The lesson title is the page's main heading: the catalogue's h1 is gone
  // once a lesson is open, and document.title carries the same text (SHIG 59).
  const title = el("h1", { class: "lesson__title" });
  const explain = el("div", { class: "explain" });
  const task = el("div", { class: "task" });
  const mdn = el("a", { class: "mdn-link", attrs: { target: "_blank", rel: "noopener" } });
  const editor: Editor = createEditor("コードエディタ");
  const errorBar = el("div", { class: "error-bar", attrs: { role: "status", "aria-live": "polite" } });

  const checkBtn = el("button", {
    class: "btn btn--primary",
    text: "チェック",
    attrs: { title: "⌘/Ctrl + Enter でもチェックできます" },
  });
  const resetBtn = el("button", { class: "btn btn--ghost", text: "リセット" });
  const hintBtn = el("button", { class: "btn btn--ghost" });
  const solBtn = el("button", { class: "btn btn--ghost", text: "解答を見る" });
  const actions = el("div", { class: "actions" });
  actions.append(checkBtn, resetBtn, hintBtn, solBtn);
  // The Cmd/Ctrl+Enter shortcut was invisible; say it where the eye already is
  // (SHIG 22, 31). Tab indents inside the editor, so keyboard users must be
  // told how to leave it (WCAG 2.1.2); the editor points at this text via
  // aria-describedby. Hidden on touch-only devices via CSS.
  const shortcut = el("p", {
    class: "shortcut-hint",
    text: "⌘/Ctrl + Enter でチェック · Tab でインデント · Esc でエディタから抜ける",
    attrs: { id: "editor-keys" },
  });
  editor.setDescribedBy("editor-keys");

  // Undo notice for actions that replace the editor contents (SHIG 57, 54):
  // no confirm dialog, just do it and offer a way back next to the buttons.
  const notice = el("div", { class: "notice", attrs: { role: "status", "aria-live": "polite" } });
  const noticeText = el("span");
  const undoBtn = el("button", { class: "btn btn--small", text: "元に戻す", attrs: { type: "button" } });
  notice.append(noticeText, undoBtn);

  const banner = el("div", { class: "banner", attrs: { role: "status", "aria-live": "polite" } });
  // The one call to action after a pass lives in the banner, so there is a
  // single highlighted button and the result leads straight on (SHIG 47, 61, 41).
  const bannerNext = el("button", { class: "btn btn--primary", attrs: { type: "button" } });
  // Hints are appended out of focus; announce them (SHIG 25).
  const hints = el("div", { class: "hints", attrs: { "aria-live": "polite" } });
  doc.append(nav, title, explain, mdn);

  // ---- workbench panel ----
  // The task sits right above the editor so the goal is in view while typing
  // (SHIG 30, 32, 12); the result banner comes right after the buttons (66).
  const work = el("div", { class: "panel lesson__work" });
  work.append(task, editor.root, errorBar, actions, notice, banner, hints, shortcut);

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
  root.append(doc, viz, work);

  // ---- lazily-created runtimes ----
  let shaderPreview: ShaderPreview | null = null;
  let shaderGrader: ShaderGrader | null = null;
  let sceneSandbox: SceneSandbox | null = null;

  let current: Lesson | null = null;
  let domain: "glsl" | "three" = "glsl";
  let hintsShown = 0;
  let undoCode: string | null = null;

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
      bannerNext.textContent = current && nextLesson(current.id) ? "次のレッスン →" : "レッスン一覧へ";
      banner.append(bannerNext);
    } else {
      banner.append(el("div", { text: "もう少し！ 次を確認しましょう:" }));
      const ul = el("ul");
      for (const f of failures) ul.append(el("li", { text: f }));
      banner.append(ul);
    }
    // The result may render below the fold; bring it into view (SHIG 66, 65).
    banner.scrollIntoView({ block: "nearest", behavior: callbacks.reducedMotion ? "auto" : "smooth" });
  }

  function setError(message: string): void {
    // "ERROR: 0:7: …" → "7行目: …" (SHIG 55, 11).
    const lines = describeCompileLog(message);
    errorBar.textContent = lines.join("\n");
    errorBar.classList.toggle("is-show", lines.length > 0);
  }

  /** Say that a (possibly slow) sandbox check is running (SHIG 65, 25). */
  function setChecking(on: boolean): void {
    checkBtn.disabled = on;
    checkBtn.textContent = on ? "チェック中…" : "チェック";
    checkBtn.setAttribute("aria-busy", on ? "true" : "false");
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
    // Cmd/Ctrl+Enter bypasses the disabled button; one sandbox run at a time.
    if (!current || checkBtn.disabled) return;
    const lesson = current;
    const code = editor.getValue();
    let failures: readonly string[];
    if (domain === "glsl") {
      const { grader } = ensureShader();
      failures = evaluate(lesson.challenge.validators, grader.grade(code)).failures;
    } else {
      setChecking(true);
      try {
        const snap = await ensureScene().run(code);
        setError(snap.error ?? "");
        failures = evaluate(lesson.challenge.validators, snap).failures;
      } finally {
        setChecking(false);
      }
      // The lesson changed while the sandbox was busy; its result is stale.
      if (current !== lesson) return;
    }
    const passed = failures.length === 0;
    showBanner(passed, failures);
    if (passed) {
      markComplete(store, lesson.id);
      callbacks.onComplete(lesson.id);
    }
  }

  /** Show how many hints are left instead of silently disabling (SHIG 12, 25). */
  function updateHintButton(): void {
    const left = current ? current.challenge.hints.length - hintsShown : 0;
    hintBtn.disabled = left <= 0;
    hintBtn.textContent = left > 0 ? `ヒント（残り${left}）` : "ヒントはここまで";
  }

  function revealHint(): void {
    if (!current) return;
    if (hintsShown < current.challenge.hints.length) {
      const hint = el("div", { class: "hint" });
      hint.append(el("span", { text: "💡 ", attrs: { "aria-hidden": "true" } }));
      hint.append(document.createTextNode(current.challenge.hints[hintsShown]));
      hints.append(hint);
      hintsShown++;
    }
    updateHintButton();
  }

  function persistDraft(): void {
    if (current) saveDraft(store, current.id, editor.getValue(), current.challenge.starterCode);
  }

  function hideNotice(): void {
    undoCode = null;
    notice.classList.remove("is-show");
  }

  function loadCode(code: string): void {
    editor.setValue(code);
    clearBanner();
    setError("");
    liveUpdate();
  }

  /** Replace the editor contents and offer an undo (SHIG 54, 57, 38). */
  function replaceCode(code: string, message: string): void {
    const previous = editor.getValue();
    if (previous === code) return;
    loadCode(code);
    persistDraft();
    undoCode = previous;
    noticeText.textContent = message;
    notice.classList.add("is-show");
  }

  const saveLater = debounce(persistDraft, 400);
  editor.onInput(() => {
    hideNotice();
    liveUpdate();
    saveLater();
  });
  undoBtn.addEventListener("click", () => {
    if (undoCode === null) return;
    loadCode(undoCode);
    persistDraft();
    hideNotice();
    editor.focus();
  });
  editor.onSubmit(() => void check());
  checkBtn.addEventListener("click", () => void check());
  resetBtn.addEventListener("click", () => {
    if (current) replaceCode(current.challenge.starterCode, "最初のコードに戻しました。");
  });
  hintBtn.addEventListener("click", revealHint);
  // Label the hint button from the start: the view is mounted a tick before
  // open() runs, and an unlabelled enabled button must never be visible.
  updateHintButton();
  solBtn.addEventListener("click", () => {
    if (current) replaceCode(current.challenge.solution, "解答のコードを表示しました。");
  });
  bannerNext.addEventListener("click", () => {
    const n = current ? nextLesson(current.id) : undefined;
    if (n) callbacks.onOpen(n.id);
    else callbacks.onBack();
  });

  async function open(lessonId: string): Promise<void> {
    const lesson = lessonById(lessonId);
    if (!lesson) return;
    // Flush a pending debounced save before the editor is reused.
    persistDraft();
    current = lesson;
    domain = domainOf(lessonId) ?? "glsl";
    hintsShown = 0;
    updateHintButton();
    hideNotice();
    setChecking(false);
    const prev = prevLesson(lessonId);
    const next = nextLesson(lessonId);
    prevLink.hidden = !prev;
    nextLink.hidden = !next;
    if (prev) prevLink.setAttribute("href", `#${prev.id}`);
    if (next) nextLink.setAttribute("href", `#${next.id}`);
    const track = trackOf(lessonId);
    position.textContent = track
      ? `${track.title} · ${track.lessons.findIndex((l) => l.id === lessonId) + 1} / ${track.lessons.length}`
      : "";
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

    loadCode(loadDraft(store, lesson.id) ?? lesson.challenge.starterCode);
    if (showShader) ensureShader().preview.resize();
  }

  function dispose(): void {
    shaderPreview?.dispose();
    shaderGrader?.dispose();
    sceneSandbox?.dispose();
  }

  return { root, open, dispose };
}
