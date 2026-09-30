// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { getAllByRole, getByRole, getByText, queryByRole, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { LESSONS, TRACKS } from "../engine/content/index.js";
import type { ProgressStore } from "../engine/progress.js";
import { renderCatalogue } from "./catalogue.js";

const PROGRESS_KEY = "glsl-atelier:progress:v1";

function memStore(completed: readonly string[] = []): ProgressStore {
  const data = new Map<string, string>();
  if (completed.length) data.set(PROGRESS_KEY, JSON.stringify(completed));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const statusText = (root: HTMLElement): string | null =>
  root.querySelector(".resume__status")?.textContent ?? null;

function render(completed: readonly string[] = []) {
  const onOpen = vi.fn();
  const root = renderCatalogue(memStore(completed), onOpen);
  document.body.replaceChildren(root);
  return { root, onOpen };
}

describe("renderCatalogue", () => {
  it("shows the intro, both domain sections and every track card", () => {
    const { root } = render();
    expect(getByRole(root, "heading", { level: 1 }).textContent).toBe("GLSL Atelier");
    expect(getByRole(root, "heading", { level: 2, name: "WebGL · GLSL シェーダー" })).toBeTruthy();
    expect(getByRole(root, "heading", { level: 2, name: "Three.js · 3D シーン" })).toBeTruthy();
    for (const track of TRACKS) expect(getByText(root, track.title)).toBeTruthy();
    expect(root.querySelectorAll(".track-card")).toHaveLength(TRACKS.length);
  });

  it("lists GLSL tracks before Three.js tracks", () => {
    const { root } = render();
    const titles = Array.from(root.querySelectorAll(".track-card__title")).map((n) => n.textContent);
    const glsl = TRACKS.filter((t) => t.domain === "glsl").map((t) => t.title);
    const three = TRACKS.filter((t) => t.domain === "three").map((t) => t.title);
    expect(titles).toEqual([...glsl, ...three]);
  });

  it("renders one button per lesson with its state spelled out for screen readers", () => {
    const { root } = render();
    const rows = root.querySelectorAll<HTMLButtonElement>(".lesson-row");
    expect(rows).toHaveLength(LESSONS.length);
    expect(rows[0].getAttribute("type")).toBe("button");
    expect(rows[0].dataset.lesson).toBe(LESSONS[0].id);
    expect(getByRole(root, "button", { name: `${LESSONS[0].title}（未クリア）` })).toBeTruthy();
  });

  it("marks completed lessons and counts them in the track progress", () => {
    const first = TRACKS[0];
    const doneId = first.lessons[0].id;
    const { root } = render([doneId]);
    const row = getByRole(root, "button", { name: `${first.lessons[0].title}（クリア済み）` });
    expect(row.classList.contains("is-done")).toBe(true);
    expect(row.querySelector(".lesson-row__mark")?.textContent).toBe("✓");
    expect(row.querySelector(".lesson-row__mark")?.getAttribute("aria-hidden")).toBe("true");

    const card = row.closest(".track-card") as HTMLElement;
    expect(getByText(card, `1/${first.lessons.length}`)).toBeTruthy();
    const fill = card.querySelector<HTMLElement>(".track-card__bar i");
    expect(fill?.style.width).toBe(`${Math.round((1 / first.lessons.length) * 100)}%`);
  });

  it("opens a lesson when its row is clicked", async () => {
    const { root, onOpen } = render();
    const target = LESSONS[3];
    await userEvent.click(getByRole(root, "button", { name: `${target.title}（未クリア）` }));
    expect(onOpen).toHaveBeenCalledWith(target.id);
  });

  it("offers to start the first lesson when nothing is done", async () => {
    const { root, onOpen } = render();
    expect(statusText(root)).toBe(
      `クリアしたレッスン 0 / ${LESSONS.length}`,
    );
    const btn = getByRole(root, "button", { name: `はじめる「${LESSONS[0].title}」` });
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith(LESSONS[0].id);
  });

  it("offers to resume at the first unfinished lesson", async () => {
    const { root, onOpen } = render([LESSONS[0].id, LESSONS[1].id, LESSONS[3].id]);
    expect(statusText(root)).toBe(
      `クリアしたレッスン 3 / ${LESSONS.length}`,
    );
    await userEvent.click(getByRole(root, "button", { name: `続きから「${LESSONS[2].title}」` }));
    expect(onOpen).toHaveBeenCalledWith(LESSONS[2].id);
  });

  it("congratulates instead of offering a resume button when everything is done", () => {
    const { root } = render(LESSONS.map((l) => l.id));
    const resume = root.querySelector(".resume") as HTMLElement;
    expect(getByText(resume, "すべてのレッスンをクリアしました。")).toBeTruthy();
    expect(queryByRole(resume, "button")).toBeNull();
    expect(getAllByRole(root, "button").every((b) => b.classList.contains("lesson-row"))).toBe(true);
    for (const card of root.querySelectorAll<HTMLElement>(".track-card")) {
      const n = within(card).getAllByRole("button").length;
      expect(getByText(card, `${n}/${n}`)).toBeTruthy();
    }
  });

  it("ignores completed ids that are not lessons", () => {
    const { root } = render(["ghost"]);
    expect(statusText(root)).toBe(
      `クリアしたレッスン 0 / ${LESSONS.length}`,
    );
    expect(root.querySelectorAll(".is-done")).toHaveLength(0);
  });
});
