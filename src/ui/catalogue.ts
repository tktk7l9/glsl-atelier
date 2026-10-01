// The lesson catalogue (light — no Three.js / WebGL). Renders tracks as cards,
// grouped by domain (GLSL shaders vs Three.js scenes), each listing its lessons
// with completion marks and a progress bar.

import { LESSONS, TRACKS, lessonById } from "../engine/content/index.js";
import type { Domain, Track } from "../engine/content/types.js";
import {
  completion,
  firstIncomplete,
  loadCompleted,
  type ProgressStore,
} from "../engine/progress.js";
import { el } from "./dom.js";

const SECTIONS: ReadonlyArray<{ domain: Domain; title: string; blurb: string }> = [
  {
    domain: "glsl",
    title: "WebGL · GLSL シェーダー",
    blurb: "1ピクセルずつ色を計算する。座標・図形・色・時間でフラグメントシェーダーを描く。",
  },
  {
    domain: "three",
    title: "Three.js · 3D シーン",
    blurb: "ジオメトリ・マテリアル・ライト・カメラを組み立てて立体を描く。",
  },
];

function trackCard(
  track: Track,
  completed: readonly string[],
  completedSet: ReadonlySet<string>,
  onOpen: (lessonId: string) => void,
): HTMLElement {
  const prog = completion(completed, track.lessons.map((l) => l.id));

  const card = el("div", { class: "track-card" });
  const head = el("div", { class: "track-card__head" });
  // The emoji is decoration; the title carries the meaning (SHIG 70, 96).
  head.append(el("span", { class: "track-card__icon", text: track.icon, attrs: { "aria-hidden": "true" } }));
  head.append(el("span", { class: "track-card__title", text: track.title }));
  card.append(head);
  card.append(el("div", { class: "track-card__summary", text: track.summary }));

  const list = el("div", { class: "lesson-list" });
  for (const lesson of track.lessons) {
    const done = completedSet.has(lesson.id);
    const row = el("button", {
      class: `lesson-row${done ? " is-done" : ""}`,
      attrs: { type: "button", "data-lesson": lesson.id },
    });
    // The mark is decoration; the state is also given in words (SHIG 70, 94).
    row.append(
      el("span", { class: "lesson-row__mark", text: done ? "✓" : "○", attrs: { "aria-hidden": "true" } }),
    );
    row.append(el("span", { text: lesson.title }));
    row.append(el("span", { class: "visually-hidden", text: done ? "（クリア済み）" : "（未クリア）" }));
    row.addEventListener("click", () => onOpen(lesson.id));
    list.append(row);
  }
  card.append(list);

  const meta = el("div", { class: "track-card__meta" });
  // The bar repeats the "done/total" text next to it, so hide it from AT (SHIG 70).
  const bar = el("div", { class: "track-card__bar", attrs: { "aria-hidden": "true" } });
  const fillEl = el("i");
  fillEl.style.width = `${Math.round(prog.ratio * 100)}%`;
  bar.append(fillEl);
  meta.append(bar);
  meta.append(el("span", { text: `${prog.done}/${prog.total}` }));
  card.append(meta);

  return card;
}

/** "続きから" entry: the first unfinished lesson, one tap away (SHIG 20, 12). */
function resumeBlock(completed: readonly string[], onOpen: (lessonId: string) => void): HTMLElement {
  const ids = LESSONS.map((l) => l.id);
  const prog = completion(completed, ids);
  const nextId = firstIncomplete(completed, ids);
  const next = nextId ? lessonById(nextId) : undefined;

  const box = el("div", { class: "resume" });
  const status = el("p", { class: "resume__status" });
  status.append(document.createTextNode("クリアしたレッスン "));
  status.append(el("b", { text: `${prog.done} / ${prog.total}` }));
  box.append(status);
  if (next) {
    const btn = el("button", {
      class: "btn btn--primary resume__btn",
      text: `${prog.done === 0 ? "はじめる" : "続きから"}「${next.title}」`,
      attrs: { type: "button" },
    });
    btn.addEventListener("click", () => onOpen(next.id));
    box.append(btn);
  } else {
    box.append(el("p", { class: "resume__done", text: "すべてのレッスンをクリアしました。" }));
  }
  return box;
}

export function renderCatalogue(
  store: ProgressStore,
  onOpen: (lessonId: string) => void,
): HTMLElement {
  const completed = loadCompleted(store);
  const completedSet = new Set(completed);
  const wrap = el("div");

  const intro = el("div", { class: "intro" });
  intro.append(el("h1", { html: "GLSL <span class='intro__accent'>Atelier</span>" }));
  intro.append(
    el("p", {
      text:
        "解説を読み、エディタにコードを書いてチャレンジをクリアしよう。GLSL フラグメントシェーダーと Three.js シーンを、ライブ描画と自動採点で学べます。",
    }),
  );
  wrap.append(intro);
  wrap.append(resumeBlock(completed, onOpen));

  for (const section of SECTIONS) {
    const tracks = TRACKS.filter((t) => t.domain === section.domain);
    const head = el("div", { class: "section-head" });
    head.append(el("h2", { text: section.title }));
    head.append(el("p", { text: section.blurb }));
    wrap.append(head);

    const grid = el("div", { class: "track-grid" });
    for (const track of tracks) {
      grid.append(trackCard(track, completed, completedSet, onOpen));
    }
    wrap.append(grid);
  }

  return wrap;
}
