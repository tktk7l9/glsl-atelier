// @vitest-environment jsdom
//
// A cold start on a lesson's link: main.ts starts loading the lesson's track
// and the lesson runtime before it builds the shell, and a runtime that fails
// to load is reported and retried.

import { beforeAll, describe, expect, it, vi } from "vitest";
import { getByRole, waitFor } from "@testing-library/dom";
import type { Lesson } from "./engine/content/types.js";

const LINKED = "glsl-blur";

const controller = {
  root: document.createElement("div"),
  open: vi.fn<(lesson: Lesson) => Promise<void>>(async () => undefined),
  dispose: vi.fn(),
};
let createAppFails = true;
let onOpen: ((id: string) => void) | null = null;
vi.mock("./app.js", () => ({
  createApp: (cb: { onOpen(id: string): void }) => {
    if (createAppFails) throw new Error("chunk failed to load");
    onOpen = cb.onOpen;
    return controller;
  },
}));
vi.mock("./viz/background.js", () => ({ createBackground: vi.fn() }));

// Whether the shell (its header) existed when each track load started.
const loadsBeforeShell: boolean[] = [];
vi.mock("./engine/content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./engine/content/index.js")>();
  return {
    ...actual,
    loadLesson: (id: string) => {
      loadsBeforeShell.push(document.querySelector("header") === null);
      return actual.loadLesson(id);
    },
  };
});

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = () => ({ matches: true }) as MediaQueryList;
  location.hash = `#${LINKED}`;
  await import("./main.js");
});

describe("a cold start on a lesson's link", () => {
  it("starts loading the lesson's track before the shell is built", () => {
    expect(loadsBeforeShell[0]).toBe(true);
    // route() asks again once the shell exists; the import itself is shared.
    expect(loadsBeforeShell.slice(1)).toEqual([false]);
  });

  it("reports a lesson runtime that failed to load instead of hanging", async () => {
    const main = document.querySelector("main") as HTMLElement;
    const alert = await waitFor(() => getByRole(main, "alert"));
    expect(getByRole(alert, "heading", { level: 1 }).textContent).toBe("レッスンを開けませんでした");
    expect(controller.open).not.toHaveBeenCalled();
  });

  it("does not warm a runtime that cannot load into an unhandled failure", async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise((r) => setTimeout(r, 20));
    expect(controller.open).not.toHaveBeenCalled();
  });

  it("imports the runtime again on the next try and opens the lesson", async () => {
    createAppFails = false;
    location.hash = "#";
    await new Promise((r) => setTimeout(r, 20));
    location.hash = `#${LINKED}`;
    await waitFor(() => expect(controller.open).toHaveBeenCalledWith(expect.objectContaining({ id: LINKED })));
    expect(document.querySelector("main")?.firstElementChild).toBe(controller.root);
    expect(typeof onOpen).toBe("function");
  });
});
