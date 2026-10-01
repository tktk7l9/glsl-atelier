// @vitest-environment jsdom
//
// Behavioural tests for the lesson view. The two GPU/iframe runtimes are
// replaced by small fakes that turn learner code into a Snapshot, so the real
// validators, drafts, progress and DOM wiring are all exercised.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getByLabelText, getByRole, getByText, queryByText } from "@testing-library/dom";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { LESSONS, lessonById } from "./engine/content/index.js";
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
    expect($btn("次のレッスン →")).toBeTruthy();
    const keys = getByText(app.root, "⌘/Ctrl + Enter でチェック · Tab でインデント · Esc でエディタから抜ける");
    // The editor points at its keyboard help (WCAG 2.1.2).
    expect($editor().getAttribute("aria-describedby")).toBe(keys.id);
    expect(document.activeElement).toBe(getByRole(app.root, "heading", { level: 1 }));
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
    expect($errorBar().textContent).toBe("ERROR: 0:1: 'main' : function not found");
    expect($errorBar().classList.contains("is-show")).toBe(true);
    expect($errorBar().getAttribute("role")).toBe("status");
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
    expect($btn("次のレッスン →").classList.contains("btn--primary")).toBe(false);
  });

  it("celebrates, records progress and promotes the next button when the check passes", async () => {
    await app.open(SOLID.id);
    await user.click($btn("解答を見る"));
    await user.click($btn("チェック"));
    expect(getByText($banner(), "✓ クリア！ よくできました。")).toBeTruthy();
    expect($banner().classList.contains("banner--pass")).toBe(true);
    expect(callbacks.onComplete).toHaveBeenCalledWith(SOLID.id);
    expect(progress()).toEqual([SOLID.id]);
    expect($btn("次のレッスン →").classList.contains("btn--primary")).toBe(true);
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
    expect(items[0]).toBe("シェーダーをコンパイルできません: ERROR: 0:1: 'main' : function not found");
    expect(items).toContain("コードに必要な記述が見つかりません");
  });

  it("does nothing when no lesson is open", async () => {
    await user.click($btn("チェック"));
    expect($banner().textContent).toBe("");
    expect(grader.grade).not.toHaveBeenCalled();
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
  it("opens the following lesson in catalogue order", async () => {
    await app.open(SOLID.id);
    await user.click($btn("次のレッスン →"));
    expect(callbacks.onOpen).toHaveBeenCalledWith(LESSONS[1].id);
    expect(callbacks.onBack).not.toHaveBeenCalled();
  });

  it("returns to the catalogue from the last lesson and says so", async () => {
    await app.open(LAST.id);
    await user.click($btn("レッスン一覧へ"));
    expect(callbacks.onBack).toHaveBeenCalled();
    expect(callbacks.onOpen).not.toHaveBeenCalled();
  });

  it("goes back when pressed before any lesson is open", async () => {
    await user.click($btn("次のレッスン →"));
    expect(callbacks.onBack).toHaveBeenCalled();
  });
});

describe("opening a Three.js lesson", () => {
  it("switches to the sandbox frame and JS editor", async () => {
    await app.open(MESH.id);
    expect(getByText(app.root, "Three.js")).toBeTruthy();
    expect(getByText(app.root, "コードエディタ (Three.js / JavaScript)")).toBeTruthy();
    expect(getByText(app.root, "シーンの基本 · 1 / 3")).toBeTruthy();
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
