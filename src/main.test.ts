// @vitest-environment jsdom
//
// The shell + hash router. main.ts is a side-effect module, so it is imported
// once and the tests walk through one learner session in order. The lesson
// runtime and the Three.js background are replaced by fakes.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { getByRole, getByText, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { LESSONS, lessonById } from "./engine/content/index.js";
import type { Lesson } from "./engine/content/types.js";

const controller = {
  root: document.createElement("div"),
  open: vi.fn<(lesson: Lesson) => Promise<void>>(async () => undefined),
  dispose: vi.fn(),
};
controller.root.className = "lesson";
controller.root.textContent = "lesson view";

// Vitest clears mock call history before every test, so what the tests need
// to look at later is captured into plain variables.
interface Callbacks {
  onOpen(id: string): void;
  onBack(): void;
  reducedMotion: boolean;
}
let callbacks: Callbacks | null = null;
let appsCreated = 0;
const createApp = vi.fn((cb: Callbacks) => {
  callbacks = cb;
  appsCreated++;
  return controller;
});
vi.mock("./app.js", () => ({ createApp: (cb: Callbacks) => createApp(cb) }));

// Track loading goes through the real loader unless a test swaps in its own
// (a slow or failing network).
// (Hoisted: the module mock runs before this file's own top-level code.)
const loader = vi.hoisted(() => ({
  swap: null as ((id: string) => Promise<Lesson>) | null,
  real: null as unknown as (id: string) => Promise<Lesson>,
}));
vi.mock("./engine/content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./engine/content/index.js")>();
  loader.real = actual.loadLesson;
  return { ...actual, loadLesson: (id: string) => (loader.swap ?? actual.loadLesson)(id) };
});
const opened = (id: string) => expect.objectContaining({ id });

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const createBackground = vi.fn();
vi.mock("./viz/background.js", () => ({
  createBackground: (...args: unknown[]) => createBackground(...args),
}));

const scrollTo = vi.fn();
const mediaQueries: string[] = [];
const matchMedia = (q: string): MediaQueryList => {
  mediaQueries.push(q);
  return { matches: true } as MediaQueryList;
};

const BASE_TITLE = "GLSL Atelier — 手を動かして学ぶ WebGL / Three.js";
const FIRST = LESSONS[0];
const SECOND = LESSONS[1];

const main = (): HTMLElement => document.querySelector("main") as HTMLElement;
const crumb = (): HTMLElement => document.querySelector(".crumb") as HTMLElement;
// The stylesheet (display: none outside phone widths) keeps it out of the
// accessibility tree here, so it cannot be queried by role.
const topbarBack = (): HTMLElement => document.querySelector("header .topbar-back") as HTMLElement;

// jsdom has no layout and no ResizeObserver; record what main.ts observes.
const observed: { target: Element; notify: () => void }[] = [];
class FakeResizeObserver {
  constructor(private readonly cb: () => void) {}
  observe(target: Element): void {
    observed.push({ target, notify: this.cb });
  }
}

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  document.title = BASE_TITLE;
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  window.matchMedia = matchMedia;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  localStorage.setItem("glsl-atelier:progress:v1", JSON.stringify([FIRST.id]));
  await import("./main.js");
});

describe("shell", () => {
  it("builds the header, catalogue and footer, and honours reduced motion", () => {
    expect(mediaQueries).toEqual(["(prefers-reduced-motion: reduce)"]);
    // The brand navigates, so it is a link to the catalogue (SHIG 11, 60).
    expect(getByRole(document.body, "link", { name: "GLSL Atelier 手を動かして学ぶ WebGL / Three.js レッスン一覧へ" }).getAttribute("href")).toBe("#");
    expect(getByText(document.body, "手を動かして学ぶ WebGL / Three.js")).toBeTruthy();
    expect(getByRole(document.body, "link", { name: "GitHub" }).getAttribute("href")).toBe(
      "https://github.com/tktk7l9/glsl-atelier",
    );
    expect(document.querySelector("canvas#bg")?.getAttribute("aria-hidden")).toBe("true");
    expect(getByRole(main(), "heading", { level: 1 }).textContent).toBe("GLSL Atelier");
    expect(document.title).toBe(BASE_TITLE);
    expect(crumb().textContent).toBe("");
    // The phone back link is in the bar but only shown while a lesson is open (SHIG 60, 82).
    expect(topbarBack().tagName).toBe("A");
    expect(topbarBack().textContent).toBe("レッスン一覧");
    expect(topbarBack().getAttribute("href")).toBe("#");
    expect(topbarBack().classList.contains("is-show")).toBe(false);
  });

  it("publishes the sticky bar's height for the pinned preview", () => {
    const header = document.querySelector("header.topbar") as HTMLElement;
    expect(observed.map((o) => o.target)).toEqual([header]);
    Object.defineProperty(header, "offsetHeight", { value: 61, configurable: true });
    observed[0].notify();
    expect(document.documentElement.style.getPropertyValue("--topbar-h")).toBe("61px");
  });

  it("reads saved progress into the catalogue", () => {
    expect(getByRole(main(), "button", { name: `${FIRST.title}（クリア済み）` })).toBeTruthy();
    expect(getByRole(main(), "button", { name: `続きから「${SECOND.title}」` })).toBeTruthy();
  });

  it("does not load the lesson runtime or the background up front", () => {
    expect(appsCreated).toBe(0);
    expect(createBackground).not.toHaveBeenCalled();
    expect(document.querySelector("script[data-cf-beacon]")).toBeNull();
  });

  it("starts the cosmic background after the idle fallback delay", async () => {
    await waitFor(() => expect(createBackground).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(createBackground).toHaveBeenCalledWith(document.querySelector("canvas#bg"), true);
  });
});

describe("routing", () => {
  it("opens a lesson from its catalogue row via the URL hash", async () => {
    Object.defineProperty(window, "scrollY", { value: 320, configurable: true });
    await userEvent.click(getByRole(main(), "button", { name: `${SECOND.title}（未クリア）` }));
    expect(location.hash).toBe(`#${SECOND.id}`);
    await waitFor(() => expect(controller.open).toHaveBeenCalledWith(opened(SECOND.id)));
    expect(appsCreated).toBe(1);
    expect(callbacks?.reducedMotion).toBe(true);
    expect(main().firstElementChild).toBe(controller.root);
    expect(crumb().textContent).toBe(`はじめてのシェーダー › ${SECOND.title}`);
    expect(crumb().querySelector("b")?.textContent).toBe(SECOND.title);
    expect(document.title).toBe(`${SECOND.title} — GLSL Atelier`);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(topbarBack().classList.contains("is-show")).toBe(true);
  });

  it("returns to the catalogue on the brand link, restoring scroll and focus", async () => {
    scrollTo.mockClear();
    await userEvent.click(getByRole(document.body, "link", { name: "GLSL Atelier 手を動かして学ぶ WebGL / Three.js レッスン一覧へ" }));
    await waitFor(() => expect(location.hash).toBe(""));
    await waitFor(() => expect(main().querySelector("h1")).not.toBeNull());
    expect(document.title).toBe(BASE_TITLE);
    expect(crumb().textContent).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 320);
    const row = getByRole(main(), "button", { name: `${SECOND.title}（未クリア）` });
    expect(document.activeElement).toBe(row);
    expect(topbarBack().classList.contains("is-show")).toBe(false);
  });

  it("reuses the same lesson controller for the next lesson", async () => {
    callbacks!.onOpen(LESSONS[2].id);
    await waitFor(() => expect(controller.open).toHaveBeenLastCalledWith(opened(LESSONS[2].id)));
    expect(appsCreated).toBe(1);
    expect(document.title).toBe(`${LESSONS[2].title} — GLSL Atelier`);
  });

  it("returns to the catalogue from the sticky bar's back link", async () => {
    expect(topbarBack().classList.contains("is-show")).toBe(true);
    await userEvent.click(topbarBack());
    await waitFor(() => expect(main().querySelector("h1")).not.toBeNull());
    expect(topbarBack().classList.contains("is-show")).toBe(false);
    expect(document.title).toBe(BASE_TITLE);
    callbacks!.onOpen(LESSONS[2].id);
    await waitFor(() => expect(topbarBack().classList.contains("is-show")).toBe(true));
  });

  it("goes back to the catalogue through the controller's onBack", async () => {
    callbacks!.onBack();
    await waitFor(() => expect(main().querySelector("h1")).not.toBeNull());
    expect(location.hash).toBe("");
  });

  it("treats an unknown hash as the catalogue", async () => {
    location.hash = "#no-such-lesson";
    await waitFor(() => expect(location.hash).toBe("#no-such-lesson"));
    // hashchange is async in jsdom: give the router a tick, then assert nothing changed.
    await new Promise((r) => setTimeout(r, 20));
    expect(main().querySelector("h1")).not.toBeNull();
    expect(document.title).toBe(BASE_TITLE);
    expect(controller.open).not.toHaveBeenCalled();
  });

  it("deep-links straight to a lesson", async () => {
    const last = LESSONS[LESSONS.length - 1];
    location.hash = `#${last.id}`;
    await waitFor(() => expect(controller.open).toHaveBeenLastCalledWith(opened(last.id)));
    expect(crumb().textContent).toBe(`空気感: 霧と影 › ${last.title}`);
    expect(lessonById(last.id)?.title).toBe(last.title);
  });

  it("re-routes when navigating to the hash that is already current", async () => {
    const last = LESSONS[LESSONS.length - 1];
    expect(location.hash).toBe(`#${last.id}`);
    callbacks!.onOpen(last.id);
    await waitFor(() => expect(controller.open).toHaveBeenCalledWith(opened(last.id)));
    expect(location.hash).toBe(`#${last.id}`);
  });
});

describe("loading a track", () => {
  const goTo = async (id: string | null): Promise<void> => {
    location.hash = id ? `#${id}` : "#";
    await new Promise((r) => setTimeout(r, 20));
  };

  it("keeps the current screen until the lesson's track has arrived (never an empty main)", async () => {
    await goTo(null);
    await waitFor(() => expect(main().querySelector("h1")?.textContent).toBe("GLSL Atelier"));
    const slow = deferred<Lesson>();
    const target = LESSONS[3];
    loader.swap = () => slow.promise;
    await goTo(target.id);
    // Still the catalogue while the track is on its way.
    expect(main().querySelector("h1")?.textContent).toBe("GLSL Atelier");
    expect(controller.open).not.toHaveBeenCalledWith(opened(target.id));
    slow.resolve(await loader.real(target.id));
    await waitFor(() => expect(controller.open).toHaveBeenLastCalledWith(opened(target.id)));
    expect(main().firstElementChild).toBe(controller.root);
    loader.swap = null;
  });

  it("drops a lesson that arrives after the learner has moved on", async () => {
    const slow = deferred<Lesson>();
    const [stale, fresh] = [LESSONS[4], LESSONS[5]];
    loader.swap = (id) => (id === stale.id ? slow.promise : loader.real(id));
    await goTo(stale.id);
    await goTo(fresh.id);
    await waitFor(() => expect(controller.open).toHaveBeenLastCalledWith(opened(fresh.id)));
    slow.resolve(await loader.real(stale.id));
    await new Promise((r) => setTimeout(r, 20));
    expect(controller.open).not.toHaveBeenCalledWith(opened(stale.id));
    expect(document.title).toBe(`${fresh.title} — GLSL Atelier`);
    loader.swap = null;
  });

  it("says plainly when a lesson cannot be fetched, with a way back and a reload, and loads it on the next try (SHIG 55, 60, 94)", async () => {
    const target = LESSONS[6];
    loader.swap = () => Promise.reject(new Error("offline"));
    await goTo(target.id);
    const alert = await waitFor(() => getByRole(main(), "alert"));
    const heading = getByRole(alert, "heading", { level: 1, name: "レッスンを開けませんでした" });
    expect(document.activeElement).toBe(heading);
    expect(alert.textContent).toContain("ページを読み込み直してください");
    expect(getByRole(alert, "button", { name: "読み込み直す" }).getAttribute("type")).toBe("button");
    expect(getByRole(alert, "link", { name: "← レッスン一覧" }).getAttribute("href")).toBe("#");
    expect(topbarBack().classList.contains("is-show")).toBe(true);
    expect(document.title).toBe("レッスンを開けませんでした — GLSL Atelier");
    expect(controller.open).not.toHaveBeenCalledWith(opened(target.id));
    // The network is back: the same lesson opens on the next try.
    loader.swap = null;
    callbacks!.onOpen(target.id);
    await waitFor(() => expect(controller.open).toHaveBeenLastCalledWith(opened(target.id)));
    expect(main().firstElementChild).toBe(controller.root);
  });

  it("does not show a failure once the learner has left for the catalogue", async () => {
    const failing = deferred<Lesson>();
    loader.swap = () => failing.promise;
    await goTo(LESSONS[7].id);
    await goTo(null);
    await waitFor(() => expect(main().querySelector("h1")?.textContent).toBe("GLSL Atelier"));
    failing.reject(new Error("offline"));
    await new Promise((r) => setTimeout(r, 20));
    expect(main().querySelector("[role=alert]")).toBeNull();
    expect(document.title).toBe(BASE_TITLE);
    loader.swap = null;
  });
});
