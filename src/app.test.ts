// @vitest-environment jsdom
//
// Behavioural tests for the lesson view. The two GPU/iframe runtimes are
// replaced by small fakes that turn learner code into a Snapshot, so the real
// validators, drafts, progress and DOM wiring are all exercised.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getByLabelText, getByRole, getByText, queryByRole, queryByText } from "@testing-library/dom";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { LESSONS, lessonById } from "./engine/content/index.js";
import { evaluate } from "./engine/validate/run.js";
import type { ValidatorSpec } from "./engine/validate/primitives.js";
import type { SceneSnapshot, ShaderSnapshot } from "./engine/validate/snapshot.js";
import { toGridSamples } from "./sandbox/sample-grid.js";

// ---- fake shader runtime ----
const preview = { setSource: vi.fn<(s: string) => string>(), resize: vi.fn(), dispose: vi.fn() };
const grader = { grade: vi.fn<(s: string) => ShaderSnapshot>(), dispose: vi.fn() };

/** Compile = has a main(); the whole screen takes the literal vec4 written to gl_FragColor. */
function fakeShaderSnapshot(source: string): ShaderSnapshot {
  const base = { kind: "shader" as const, resolution: { w: 16, h: 16 }, time: 1, source };
  if (!/void\s+main/.test(source)) {
    return { ...base, compiled: false, log: "ERROR: 0:1: 'main' : function not found", samples: [] };
  }
  const m = /gl_FragColor\s*=\s*vec4\(([^)]*)\)/.exec(source);
  const nums = m ? m[1].split(",").map((n) => Number(n.trim())) : [0, 0, 0, 1];
  const rgba = (nums.length === 2 ? [...Array(3).fill(nums[0]), nums[1]] : nums).map((n) =>
    Math.round(Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0)) * 255),
  );
  const px = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) px.set(rgba, i * 4);
  return { ...base, compiled: true, log: "", samples: toGridSamples(px, 16, 16, 8) };
}

vi.mock("./sandbox/shader-runtime.js", () => ({
  createShaderPreview: vi.fn(() => preview),
  createShaderGrader: vi.fn(() => grader),
}));

// ---- fake scene sandbox ----
const sandbox = { run: vi.fn<(code: string) => Promise<SceneSnapshot>>(), dispose: vi.fn() };

/** A thrown error when the code says `throw`; a visible Mesh when it builds and adds one. */
function fakeSceneSnapshot(code: string): SceneSnapshot {
  const hasMesh = /new THREE\.Mesh/.test(code) && /scene\.add/.test(code);
  const px = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lit = hasMesh && x > 4 && x < 12 && y > 4 && y < 12;
      px.set(lit ? [255, 160, 0, 255] : [0, 0, 0, 255], (y * 16 + x) * 4);
    }
  }
  return {
    kind: "scene",
    error: /throw/.test(code) ? "ReferenceError: boom is not defined" : null,
    source: code,
    objects: hasMesh
      ? [
          {
            id: "m1",
            type: "Mesh",
            geometry: "BoxGeometry",
            material: "MeshBasicMaterial",
            color: [1, 0.65, 0],
            position: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
          },
        ]
      : [],
    camera: { type: "PerspectiveCamera", position: [0, 0, 5] },
    samples: toGridSamples(px, 16, 16, 8),
  };
}

vi.mock("./sandbox/scene-sandbox.js", () => ({
  createSceneSandbox: vi.fn(() => sandbox),
}));

import { createApp, type AppCallbacks, type AppController } from "./app.js";
import { createSceneSandbox } from "./sandbox/scene-sandbox.js";

const PROGRESS_KEY = "glsl-atelier:progress:v1";
const DRAFTS_KEY = "glsl-atelier:drafts:v1";
const SOLID = lessonById("glsl-solid-color")!;
const MESH = lessonById("three-first-mesh")!;
const LAST = LESSONS[LESSONS.length - 1];

let callbacks: { [K in keyof AppCallbacks]: AppCallbacks[K] extends boolean ? boolean : ReturnType<typeof vi.fn> };
let app: AppController;
let user: UserEvent;

const $editor = (): HTMLTextAreaElement => getByLabelText<HTMLTextAreaElement>(app.root, /^コードエディタ/);
const $errorBar = (): HTMLElement => app.root.querySelector(".error-bar") as HTMLElement;
const $banner = (): HTMLElement => app.root.querySelector(".banner") as HTMLElement;
const $notice = (): HTMLElement => app.root.querySelector(".notice") as HTMLElement;
const $btn = (name: string | RegExp): HTMLButtonElement => getByRole(app.root, "button", { name });
const $nav = (): HTMLElement => getByRole(app.root, "navigation", { name: "レッスンの移動" });
const $step = (name: string): HTMLElement | null => queryByRole($nav(), "link", { name });
// jsdom has no layout, so it does not implement scrollIntoView.
const scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
const progress = (): string[] => JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "[]") as string[];
const drafts = (): Record<string, string> =>
  JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}") as Record<string, string>;
/** Let the live-update (200ms) and draft (400ms) debounces fire. */
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(500);
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = "";
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  preview.setSource.mockReset().mockImplementation((s) => fakeShaderSnapshot(s).log);
  preview.resize.mockReset();
  preview.dispose.mockReset();
  grader.grade.mockReset().mockImplementation(fakeShaderSnapshot);
  grader.dispose.mockReset();
  sandbox.run.mockReset().mockImplementation(async (code) => fakeSceneSnapshot(code));
  sandbox.dispose.mockReset();
  vi.mocked(createSceneSandbox).mockClear();
  callbacks = { onComplete: vi.fn(), onBack: vi.fn(), onOpen: vi.fn(), reducedMotion: false };
  app = createApp(callbacks as unknown as AppCallbacks);
  document.body.append(app.root);
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});

afterEach(() => {
  app.dispose();
  vi.useRealTimers();
});

describe("opening a GLSL lesson", () => {
  it("shows the lesson text, position, MDN link and the starter code", async () => {
    await app.open(SOLID.id);
    // The lesson title is the page's h1 (SHIG 59).
    expect(getByRole(app.root, "heading", { level: 1 }).textContent).toBe(SOLID.title);
    expect(getByText(app.root, "はじめてのシェーダー · 1 / 3")).toBeTruthy();
    // The way back sits in a named nav landmark (SHIG 59, 60).
    const lessonNav = getByRole(app.root, "navigation", { name: "レッスンの移動" });
    expect(getByRole(lessonNav, "link", { name: "← レッスン一覧" }).getAttribute("href")).toBe("#");
    expect(app.root.querySelector(".explain")?.textContent).toContain("gl_FragColor");
    expect(getByText(app.root, "課題")).toBeTruthy();
    expect(app.root.querySelector(".task")?.textContent).toContain(SOLID.challenge.task);
    const mdn = getByRole(app.root, "link", { name: "MDN でもっと学ぶ →" });
    expect(mdn.getAttribute("href")).toBe(`https://developer.mozilla.org${SOLID.mdnPath}`);
    expect(mdn.classList.contains("hidden")).toBe(false);
    expect(getByText(app.root, "GLSL")).toBeTruthy();
    expect(getByText(app.root, "コードエディタ (GLSL フラグメントシェーダー)")).toBeTruthy();
    expect($editor().value).toBe(SOLID.challenge.starterCode);
    expect($btn("ヒント（残り2）").disabled).toBe(false);
    // Forward is a plain hash link in the nav; the first lesson has no way back (SHIG 81, 59).
    expect($step("次のレッスン →")?.getAttribute("href")).toBe(`#${LESSONS[1].id}`);
    expect($step("← 前のレッスン")).toBeNull();
    // ...and it is not a button competing with the editing actions (SHIG 73, 47).
    expect(queryByRole(app.root, "button", { name: "次のレッスン →" })).toBeNull();
    const keys = getByText(app.root, "⌘/Ctrl + Enter でチェック · Tab でインデント · Esc でエディタから抜ける");
    // The editor points at its keyboard help (WCAG 2.1.2).
    expect($editor().getAttribute("aria-describedby")).toBe(keys.id);
    expect(document.activeElement).toBe(getByRole(app.root, "heading", { level: 1 }));
  });

  it("keeps the task right above the editor and the result right under the buttons", async () => {
    await app.open(SOLID.id);
    // SHIG 30, 32, 12 (goal in view while typing) and 66 (result next to its trigger).
    const order = Array.from(app.root.querySelector(".lesson__work")!.children).map((c) => c.className);
    expect(order.slice(0, 2)).toEqual(["task", "editor-wrap"]);
    expect(order.indexOf("banner")).toBe(order.indexOf("actions") + 2);
    expect(order[order.indexOf("actions") + 1]).toBe("notice");
    expect(app.root.querySelector(".lesson__doc .task")).toBeNull();
  });

  it("links both ways from a lesson in the middle", async () => {
    await app.open(LESSONS[1].id);
    expect($step("← 前のレッスン")?.getAttribute("href")).toBe(`#${LESSONS[0].id}`);
    expect($step("次のレッスン →")?.getAttribute("href")).toBe(`#${LESSONS[2].id}`);
    // Left = back, right = forward (SHIG 81).
    const links = Array.from($nav().querySelectorAll(".step-link")).map((a) => a.textContent);
    expect(links).toEqual(["← 前のレッスン", "次のレッスン →"]);
  });

  it("offers only the way back on the last lesson", async () => {
    await app.open(LAST.id);
    expect($step("次のレッスン →")).toBeNull();
    expect($step("← 前のレッスン")?.getAttribute("href")).toBe(`#${LESSONS[LESSONS.length - 2].id}`);
    // Reopening an earlier lesson brings the forward link back.
    await app.open(SOLID.id);
    expect($step("次のレッスン →")).not.toBeNull();
    expect($step("← 前のレッスン")).toBeNull();
  });

  it("shows the shader canvas and hides the 3D frame", async () => {
    await app.open(SOLID.id);
    expect(app.root.querySelector(".preview-canvas")?.classList.contains("hidden")).toBe(false);
    expect(app.root.querySelector(".preview-frame")?.classList.contains("hidden")).toBe(true);
    expect(preview.resize).toHaveBeenCalled();
    expect(vi.mocked(createSceneSandbox)).not.toHaveBeenCalled();
  });

  it("compiles the starter code into the live preview shortly after opening", async () => {
    await app.open(SOLID.id);
    expect(preview.setSource).not.toHaveBeenCalled();
    await settle();
    expect(preview.setSource).toHaveBeenCalledWith(SOLID.challenge.starterCode);
    expect($errorBar().classList.contains("is-show")).toBe(false);
  });

  it("hides the MDN link for a lesson without one", async () => {
    await app.open("glsl-rgb-mix");
    expect(getByText(app.root, "はじめてのシェーダー · 2 / 3")).toBeTruthy();
    expect(app.root.querySelector(".mdn-link")?.classList.contains("hidden")).toBe(true);
  });

  it("ignores an unknown lesson id", async () => {
    await app.open("nope");
    expect(getByRole(app.root, "heading", { level: 1 }).textContent).toBe("");
    expect(preview.setSource).not.toHaveBeenCalled();
  });
});

describe("live preview", () => {
  it("recompiles after typing pauses and surfaces the compiler log", async () => {
    await app.open(SOLID.id);
    await settle();
    preview.setSource.mockClear();
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}broken");
    expect(preview.setSource).not.toHaveBeenCalled();
    await settle();
    expect(preview.setSource).toHaveBeenCalledTimes(1);
    expect(preview.setSource).toHaveBeenCalledWith("broken");
    // "ERROR: 0:1: …" reads as a line number (SHIG 55, 11).
    expect($errorBar().textContent).toBe("1行目: 'main' : function not found");
    expect($errorBar().classList.contains("is-show")).toBe(true);
    expect($errorBar().getAttribute("role")).toBe("status");
  });

  it("puts one message per line and drops duplicates", async () => {
    preview.setSource.mockReturnValue(
      "ERROR: 0:3: 'x' : undeclared identifier\nERROR: 0:3: 'x' : undeclared identifier\nWARNING: 0:9: unused\n\u0000",
    );
    await app.open(SOLID.id);
    await settle();
    expect($errorBar().textContent).toBe("3行目: 'x' : undeclared identifier\n9行目: unused");
  });

  it("keeps the error bar closed when the log is only the driver's trailing NUL", async () => {
    preview.setSource.mockReturnValue("\u0000");
    await app.open(SOLID.id);
    await settle();
    expect(preview.setSource).toHaveBeenCalled();
    expect($errorBar().textContent).toBe("");
    expect($errorBar().classList.contains("is-show")).toBe(false);
  });

  it("clears the error once the shader compiles again", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}x");
    await settle();
    expect($errorBar().classList.contains("is-show")).toBe(true);
    await user.click($btn("リセット"));
    await settle();
    expect($errorBar().textContent).toBe("");
    expect($errorBar().classList.contains("is-show")).toBe(false);
  });
});

describe("checking a GLSL lesson", () => {
  it("lists what is still wrong when the check fails", async () => {
    await app.open(SOLID.id);
    await user.click($btn("チェック"));
    expect(getByText($banner(), "もう少し！ 次を確認しましょう:")).toBeTruthy();
    const items = Array.from($banner().querySelectorAll("li")).map((li) => li.textContent);
    expect(items).toEqual([
      "画面全体の色が目標と違います（目標: 赤 1.00・緑 0.00・青 1.00 / いま: 赤 0.00・緑 0.00・青 0.00）",
    ]);
    expect($banner().classList.contains("banner--fail")).toBe(true);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(progress()).toEqual([]);
    // No call to action until the lesson is cleared (SHIG 47).
    expect(queryByRole(app.root, "button", { name: "次のレッスン →" })).toBeNull();
    expect(app.root.querySelectorAll(".btn--primary")).toHaveLength(1);
    // The result is brought into view (SHIG 66, 65).
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe($banner());
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });

  it("celebrates, records progress and promotes the next button when the check passes", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    expect(getByText($banner(), "✓ クリア！ よくできました。")).toBeTruthy();
    expect($banner().classList.contains("banner--pass")).toBe(true);
    expect(callbacks.onComplete).toHaveBeenCalledWith(SOLID.id);
    expect(progress()).toEqual([SOLID.id]);
    // The banner carries the single call to action after a pass (SHIG 47, 61, 41).
    const next = getByRole($banner(), "button", { name: "次のレッスン →" });
    expect(next.classList.contains("btn--primary")).toBe(true);
    expect(scrollIntoView.mock.contexts[0]).toBe($banner());
  });

  it("scrolls to the result without animation when reduced motion is on", async () => {
    app.dispose();
    app.root.remove();
    callbacks.reducedMotion = true;
    app = createApp(callbacks as unknown as AppCallbacks);
    document.body.append(app.root);
    await app.open(SOLID.id);
    await user.click($btn("チェック"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
  });

  it("drops the call to action again when a later check fails", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    await user.click($btn("リセット"));
    await user.click($btn("チェック"));
    expect($banner().classList.contains("banner--fail")).toBe(true);
    expect(queryByRole(app.root, "button", { name: "次のレッスン →" })).toBeNull();
  });

  it("checks on Cmd+Enter from inside the editor", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(getByText($banner(), "もう少し！ 次を確認しましょう:")).toBeTruthy();
  });

  it("reports a compile error through the validators", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}nothing");
    await user.click($btn("チェック"));
    const items = Array.from($banner().querySelectorAll("li")).map((li) => li.textContent);
    expect(items[0]).toMatch(/^シェーダーをコンパイルできません: .*'main' : function not found$/);
    expect(items).toContain("コードに必要な記述が見つかりません");
  });

  it("does nothing when no lesson is open", async () => {
    await user.click($btn("チェック"));
    expect($banner().textContent).toBe("");
    expect(grader.grade).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("hints", () => {
  it("reveals hints one at a time and says when they run out", async () => {
    await app.open(SOLID.id);
    await user.click($btn("ヒント（残り2）"));
    const first = getByText(app.root, SOLID.challenge.hints[0]);
    // The bulb is decoration; hints are announced politely (SHIG 25, 96).
    expect(first.textContent).toBe(`💡 ${SOLID.challenge.hints[0]}`);
    expect(first.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
    expect(app.root.querySelector(".hints")?.getAttribute("aria-live")).toBe("polite");
    expect(queryByText(app.root, SOLID.challenge.hints[1])).toBeNull();
    await user.click($btn("ヒント（残り1）"));
    expect(getByText(app.root, SOLID.challenge.hints[1])).toBeTruthy();
    const done = $btn("ヒントはここまで");
    expect(done.disabled).toBe(true);
    expect(app.root.querySelectorAll(".hint")).toHaveLength(2);
  });

  it("starts over when another lesson is opened", async () => {
    await app.open(SOLID.id);
    await user.click($btn("ヒント（残り2）"));
    await app.open("glsl-rgb-mix");
    expect(app.root.querySelectorAll(".hint")).toHaveLength(0);
    expect($btn("ヒント（残り2）").disabled).toBe(false);
  });

  it("does nothing before a lesson is open", async () => {
    const btn = $btn("ヒントはここまで");
    expect(btn.disabled).toBe(true);
    btn.disabled = false;
    await user.click(btn);
    expect(app.root.querySelectorAll(".hint")).toHaveLength(0);
  });
});

describe("solution, reset and undo", () => {
  it("shows the solution with an undo notice instead of a confirm dialog", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    expect($editor().value).toBe(SOLID.challenge.solution);
    expect($notice().classList.contains("is-show")).toBe(true);
    expect(getByText($notice(), "解答のコードを表示しました。")).toBeTruthy();
    expect(drafts()[SOLID.id]).toBe(SOLID.challenge.solution);
    await settle();
    expect(preview.setSource).toHaveBeenLastCalledWith(SOLID.challenge.solution);
  });

  it("undo restores the previous code, forgets the draft and refocuses the editor", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("元に戻す"));
    expect($editor().value).toBe(SOLID.challenge.starterCode);
    expect($notice().classList.contains("is-show")).toBe(false);
    expect(drafts()[SOLID.id]).toBeUndefined();
    expect(document.activeElement).toBe($editor());
  });

  it("undo is inert once the notice is gone", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("元に戻す"));
    await user.click($btn("解答を見る"));
    await user.click($editor());
    await user.keyboard("!");
    expect($notice().classList.contains("is-show")).toBe(false);
    await user.click($btn("元に戻す"));
    expect($editor().value).toBe(`${SOLID.challenge.solution}!`);
  });

  it("reset returns to the starter code and clears the check result", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    expect($banner().classList.contains("banner--show")).toBe(true);
    await user.click($btn("リセット"));
    expect($editor().value).toBe(SOLID.challenge.starterCode);
    expect(getByText($notice(), "最初のコードに戻しました。")).toBeTruthy();
    expect($banner().classList.contains("banner--show")).toBe(false);
    expect($banner().textContent).toBe("");
  });

  it("reset on untouched code shows no notice", async () => {
    await app.open(SOLID.id);
    await user.click($btn("リセット"));
    expect($notice().classList.contains("is-show")).toBe(false);
  });

  it("typing dismisses the notice", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($editor());
    await user.keyboard(" ");
    expect($notice().classList.contains("is-show")).toBe(false);
  });

  it("do nothing before a lesson is open", async () => {
    await user.click($btn("リセット"));
    await user.click($btn("解答を見る"));
    expect($editor().value).toBe("");
    expect($notice().classList.contains("is-show")).toBe(false);
  });
});

describe("drafts", () => {
  it("saves what the learner typed after a pause and restores it on return", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}mine");
    expect(drafts()[SOLID.id]).toBeUndefined();
    await settle();
    expect(drafts()[SOLID.id]).toBe("mine");
    await app.open("glsl-rgb-mix");
    expect($editor().value).toBe(lessonById("glsl-rgb-mix")!.challenge.starterCode);
    await app.open(SOLID.id);
    expect($editor().value).toBe("mine");
  });

  it("flushes a pending draft when another lesson opens before the pause", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}quick");
    await app.open("glsl-rgb-mix");
    expect(drafts()[SOLID.id]).toBe("quick");
  });

  it("keeps no draft for code equal to the starter", async () => {
    await app.open(SOLID.id);
    await user.click($editor());
    await user.keyboard("x{Backspace}");
    await settle();
    expect(localStorage.getItem(DRAFTS_KEY)).toBeNull();
  });
});

describe("storage switched off", () => {
  it("still opens lessons and celebrates a pass without persisting", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await app.open(SOLID.id);
    expect($editor().value).toBe(SOLID.challenge.starterCode);
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    expect(getByText($banner(), "✓ クリア！ よくできました。")).toBeTruthy();
    expect(callbacks.onComplete).toHaveBeenCalledWith(SOLID.id);
    vi.restoreAllMocks();
  });
});

describe("next lesson", () => {
  /** Clear the open lesson so the banner shows its call to action. */
  const pass = async (): Promise<void> => {
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
  };

  it("opens the following lesson in catalogue order", async () => {
    await app.open(SOLID.id);
    await pass();
    await user.click($btn("次のレッスン →"));
    expect(callbacks.onOpen).toHaveBeenCalledWith(LESSONS[1].id);
    expect(callbacks.onBack).not.toHaveBeenCalled();
  });

  it("returns to the catalogue from the last lesson and says so", async () => {
    // The last lesson (the shadow-only floor) is judged on a rendered frame,
    // on the lights in the scene and on the floor's material, which the
    // generic fake does not produce. Hand it a frame that paints each pixel
    // check's target colour at its sample, and the scene's constructors as
    // objects whose material is the last one made.
    const lastLessonFrame = (code: string): SceneSnapshot => {
      const base = fakeSceneSnapshot(code);
      const types = [...code.matchAll(/new THREE\.(\w+)\(/g)].map((m) => m[1]);
      const materials = types.filter((t) => t.endsWith("Material"));
      const px = new Uint8Array(16 * 16 * 4);
      // The grid index whose sample is nearest to v (ties go to the lower one, as nearestSample does).
      const nearest = (v: number): number => [...Array(16).keys()].reduce((b, g) => (Math.abs((g + 0.5) / 16 - v) < Math.abs((b + 0.5) / 16 - v) ? g : b), 0);
      const paint = (spec: ValidatorSpec): void => {
        if (spec.kind === "pixelApprox") {
          px.set([...spec.rgb.map((c) => Math.round(c * 255)), 255], (nearest(spec.y) * 16 + nearest(spec.x)) * 4);
        } else if (spec.kind === "allOf" || spec.kind === "anyOf") {
          spec.of.forEach(paint);
        }
      };
      LAST.challenge.validators.forEach(paint);
      return {
        ...base,
        objects: types.map((type, i) => ({ ...base.objects[0], id: `o${i}`, type, material: materials[materials.length - 1] ?? null })),
        samples: toGridSamples(px, 16, 16, 16),
      };
    };
    expect(evaluate(LAST.challenge.validators, lastLessonFrame(LAST.challenge.solution)).passed).toBe(true);
    sandbox.run.mockImplementation(async (code) => lastLessonFrame(code));
    await app.open(LAST.id);
    await pass();
    await user.click($btn("レッスン一覧へ"));
    expect(callbacks.onBack).toHaveBeenCalled();
    expect(callbacks.onOpen).not.toHaveBeenCalled();
  });

  it("offers no way forward before any lesson is open", () => {
    // The call to action only exists inside a pass banner now (SHIG 47), so
    // there is nothing to press until a lesson has been opened and cleared.
    expect(queryByRole(app.root, "button", { name: /次のレッスン|レッスン一覧へ/ })).toBeNull();
    expect($step("次のレッスン →")).toBeNull();
    expect($step("← 前のレッスン")).toBeNull();
    expect(callbacks.onBack).not.toHaveBeenCalled();
  });
});

describe("opening a Three.js lesson", () => {
  it("switches to the sandbox frame and JS editor", async () => {
    await app.open(MESH.id);
    expect(getByText(app.root, "Three.js")).toBeTruthy();
    expect(getByText(app.root, "コードエディタ (Three.js / JavaScript)")).toBeTruthy();
    expect(getByText(app.root, "シーンの基本 · 1 / 4")).toBeTruthy();
    const frame = app.root.querySelector<HTMLIFrameElement>(".preview-frame")!;
    expect(frame.classList.contains("hidden")).toBe(false);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(app.root.querySelector(".preview-canvas")?.classList.contains("hidden")).toBe(true);
    expect(preview.resize).not.toHaveBeenCalled();
    await settle();
    expect(frame.getAttribute("src")).toBe("/sandbox.html");
    expect(vi.mocked(createSceneSandbox)).toHaveBeenCalledTimes(1);
    expect(sandbox.run).toHaveBeenCalledWith(MESH.challenge.starterCode);
  });

  it("shows a runtime error from the learner's code in the error bar", async () => {
    await app.open(MESH.id);
    await user.click($editor());
    await user.keyboard("{Control>}a{/Control}{Backspace}throw boom");
    await settle();
    expect($errorBar().textContent).toBe("ReferenceError: boom is not defined");
    expect($errorBar().classList.contains("is-show")).toBe(true);
  });

  it("fails the check with the missing pieces, then passes with the solution", async () => {
    await app.open(MESH.id);
    await user.click($btn("チェック"));
    const items = Array.from($banner().querySelectorAll("li")).map((li) => li.textContent);
    expect(items).toContain("コードに必要な記述が見つかりません");
    expect(items).toContain("画面に何も描画されていません");
    expect(progress()).toEqual([]);

    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    expect(getByText($banner(), "✓ クリア！ よくできました。")).toBeTruthy();
    expect(progress()).toEqual([MESH.id]);
    expect(callbacks.onComplete).toHaveBeenCalledWith(MESH.id);
  });

  it("says the check is running while the sandbox is busy, and allows only one run", async () => {
    await app.open(MESH.id);
    await settle();
    sandbox.run.mockClear();
    let finish!: (snap: SceneSnapshot) => void;
    sandbox.run.mockImplementationOnce(() => new Promise<SceneSnapshot>((r) => (finish = r)));
    const check = $btn("チェック");
    await user.click(check);
    // SHIG 65, 25: the wait is visible and announced.
    expect(check.textContent).toBe("チェック中…");
    expect(check.disabled).toBe(true);
    expect(check.getAttribute("aria-busy")).toBe("true");
    expect($banner().textContent).toBe("");
    // Cmd/Ctrl+Enter must not start a second run past the disabled button.
    await user.click($editor());
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(sandbox.run).toHaveBeenCalledTimes(1);

    finish(fakeSceneSnapshot(MESH.challenge.starterCode));
    await vi.advanceTimersByTimeAsync(0);
    expect(check.textContent).toBe("チェック");
    expect(check.disabled).toBe(false);
    expect(check.getAttribute("aria-busy")).toBe("false");
    expect($banner().classList.contains("banner--fail")).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("discards a result that arrives after another lesson was opened", async () => {
    await app.open(MESH.id);
    await settle();
    let finish!: (snap: SceneSnapshot) => void;
    sandbox.run.mockImplementationOnce(() => new Promise<SceneSnapshot>((r) => (finish = r)));
    await user.click($btn("チェック"));
    await app.open(SOLID.id);
    // Opening a lesson never leaves the button stuck on チェック中….
    expect($btn("チェック").disabled).toBe(false);
    finish(fakeSceneSnapshot(MESH.challenge.solution));
    await vi.advanceTimersByTimeAsync(0);
    expect($banner().textContent).toBe("");
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(progress()).toEqual([]);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it("reuses one sandbox across lessons and disposes every runtime once", async () => {
    await app.open(MESH.id);
    await settle();
    await app.open("three-color");
    await settle();
    expect(vi.mocked(createSceneSandbox)).toHaveBeenCalledTimes(1);
    await app.open(SOLID.id);
    await settle();
    await user.click($btn("チェック"));
    app.dispose();
    expect(sandbox.dispose).toHaveBeenCalledTimes(1);
    expect(preview.dispose).toHaveBeenCalledTimes(1);
    expect(grader.dispose).toHaveBeenCalledTimes(1);
  });

  it("dispose is safe before any runtime exists", () => {
    app.dispose();
    expect(sandbox.dispose).not.toHaveBeenCalled();
    expect(preview.dispose).not.toHaveBeenCalled();
  });
});
