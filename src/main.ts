// Light bootstrap. The catalogue + shell ship in the initial bundle; the lesson
// runtime (app.ts), each track's lessons and the Three.js cosmic background
// (viz/background.ts) are dynamically imported so the cold load stays light.

import "./styles.css";
import { byId, el, isPlainClick } from "./ui/dom.js";
import { renderCatalogue } from "./ui/catalogue.js";
import { lessonById, loadLesson, trackOf } from "./engine/content/index.js";
import type { Lesson } from "./engine/content/types.js";
import type { ProgressStore } from "./engine/progress.js";
import type { AppController } from "./app.js";

// Cloudflare Web Analytics — production only. The site token is a public
// identifier embedded in every page, not a secret.
if (import.meta.env.PROD) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = '{"token": "cd156fbf0fd24da0a12e58fdb4e63828"}'; // gitleaks:allow
  document.head.appendChild(beacon);
}

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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- lesson loading ----
let app: AppController | null = null;
let loading: Promise<AppController> | null = null;

async function ensureApp(): Promise<AppController> {
  if (app) return app;
  if (!loading) {
    const attempt = import("./app.js").then((m) =>
      m.createApp({
        onComplete: () => void 0,
        onBack: () => navigateTo(null),
        onOpen: (id) => navigateTo(id),
        reducedMotion,
      }),
    );
    // A failed load must not stick: the next attempt imports again.
    attempt.catch(() => {
      loading = null;
    });
    loading = attempt;
  }
  app = await loading;
  return app;
}

// A link straight to a lesson starts fetching the lesson runtime and the
// lesson's track before the shell is even built, so both download while the
// page starts up; route() below picks up the same loads.
const linkedLesson = location.hash.replace(/^#/, "");
if (lessonById(linkedLesson)) {
  void ensureApp().catch(() => undefined);
  void loadLesson(linkedLesson).catch(() => undefined);
}

// ---- shell ----
const appRoot = byId("app");

const bg = el("canvas", { class: "bg", attrs: { id: "bg", "aria-hidden": "true" } }) as HTMLCanvasElement;

const topbar = el("header", { class: "topbar" });
// The brand navigates to the catalogue, so it is a link, not a button: assistive
// tech announces "link" and the destination is a plain URL (SHIG 11, 60).
// The name starts with the text it shows, then the destination, so speech-input
// users can say what they see (WCAG 2.5.3 Label in Name).
const BRAND_NAME = "GLSL Atelier";
const BRAND_TAGLINE = "手を動かして学ぶ WebGL / Three.js";
const brand = el("a", {
  class: "brand",
  attrs: { href: "#", "aria-label": `${BRAND_NAME} ${BRAND_TAGLINE} レッスン一覧へ` },
});
brand.append(el("span", { class: "brand__glyph", attrs: { "aria-hidden": "true" } }));
brand.append(el("span", { class: "brand__name", text: BRAND_NAME }));
brand.append(el("small", { text: BRAND_TAGLINE }));
const crumb = el("div", { class: "crumb" });
// On phones the crumb is hidden and the panel's back link scrolls away; keep a
// way back in the sticky bar while a lesson is open (SHIG 60, 82). CSS shows it
// only under 640px.
const topbarBack = el("a", { class: "topbar-back", text: "レッスン一覧", attrs: { href: "#" } });
topbar.append(brand, el("div", { class: "topbar-spacer" }), crumb, topbarBack);
// The pinned preview sits right under the sticky bar, whose height depends on
// width, pointer type and whether the back link shows; a fixed offset let the
// bar cover the preview's header on phones and tablets.
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--topbar-h", `${topbar.offsetHeight}px`);
  }).observe(topbar);
}

const main = el("main");

const foot = el("footer", { class: "foot" });
foot.append(el("span", { text: "GLSL Atelier · 書いて・光らせて・学ぶ · " }));
foot.append(
  el("a", {
    text: "GitHub",
    attrs: { href: "https://github.com/tktk7l9/glsl-atelier", target: "_blank", rel: "noopener" },
  }),
);

appRoot.append(bg, topbar, main, foot);

// ---- routing ----
const BASE_TITLE = document.title;
// Bumped on every route, so a lesson that finishes loading after the learner
// has moved on does not replace the newer screen.
let routeSeq = 0;

// Where the learner was in the catalogue, so returning from a lesson lands on
// the same spot and on the row they opened (SHIG 59, 76).
let onCatalogue = false;
let catalogueScroll = 0;
let lastLessonId: string | null = null;

function showCatalogue(): void {
  crumb.textContent = "";
  topbarBack.classList.remove("is-show");
  document.title = BASE_TITLE;
  main.replaceChildren(renderCatalogue(store, (id) => navigateTo(id)));
  if (lastLessonId) {
    window.scrollTo(0, catalogueScroll);
    main
      .querySelector<HTMLElement>(`[data-lesson="${CSS.escape(lastLessonId)}"]`)
      ?.focus({ preventScroll: true });
  }
  onCatalogue = true;
}

/**
 * The lesson could not be fetched: offline before it was cached, or a page
 * left open across a deploy. Say so in plain words with the fix (SHIG 55, 11),
 * keep a way back (SHIG 60), and move focus to the message like a lesson's
 * heading (SHIG 94).
 */
function showLoadError(): void {
  crumb.textContent = "";
  topbarBack.classList.add("is-show");
  document.title = "レッスンを開けませんでした — GLSL Atelier";
  const box = el("div", { class: "panel load-error", attrs: { role: "alert" } });
  const heading = el("h1", { text: "レッスンを開けませんでした", attrs: { tabindex: "-1" } });
  const reload = el("button", { class: "btn btn--primary", text: "読み込み直す", attrs: { type: "button" } });
  reload.addEventListener("click", () => location.reload());
  box.append(
    heading,
    el("p", { text: "通信が切れているか、アプリが更新された可能性があります。ページを読み込み直してください。" }),
    reload,
    el("a", { class: "back-link", text: "← レッスン一覧", attrs: { href: "#" } }),
  );
  main.replaceChildren(box);
  window.scrollTo(0, 0);
  heading.focus({ preventScroll: true });
}

async function showLesson(id: string, seq: number): Promise<void> {
  if (onCatalogue) catalogueScroll = window.scrollY;
  onCatalogue = false;
  lastLessonId = id;
  // The current screen stays until both the lesson runtime and the lesson's
  // track have arrived (they load in parallel), so it never flashes empty.
  let controller: AppController;
  let lesson: Lesson;
  try {
    [controller, lesson] = await Promise.all([ensureApp(), loadLesson(id)]);
  } catch {
    if (seq === routeSeq) showLoadError();
    return;
  }
  if (seq !== routeSeq) return;
  const track = trackOf(id);
  crumb.textContent = "";
  topbarBack.classList.add("is-show");
  if (track) {
    crumb.append(document.createTextNode(`${track.title} › `), el("b", { text: lesson.title }));
  }
  document.title = `${lesson.title} — GLSL Atelier`;
  main.replaceChildren(controller.root);
  // A lesson always starts at its top, whatever the previous scroll was.
  window.scrollTo(0, 0);
  await controller.open(lesson);
}

/** Drive routing through the URL hash so lessons are deep-linkable. */
function navigateTo(lessonId: string | null): void {
  const next = lessonId ? `#${lessonId}` : "#";
  if (location.hash === next) void route();
  else location.hash = next;
}

async function route(): Promise<void> {
  const seq = ++routeSeq;
  const id = location.hash.replace(/^#/, "");
  if (id && lessonById(id)) await showLesson(id, seq);
  else showCatalogue();
}

brand.addEventListener("click", (e) => {
  // Cmd/Ctrl/middle clicks keep link behaviour (open the catalogue in a new tab).
  if (!isPlainClick(e)) return;
  e.preventDefault();
  navigateTo(null);
});
window.addEventListener("hashchange", () => void route());
const firstScreen = route();

// Warm the heavy lesson chunk on first interaction. A failure here is reported
// by the navigation that needs the chunk.
const warm = (): void => void ensureApp().catch(() => undefined);
window.addEventListener("pointerdown", warm, { once: true });
window.addEventListener("keydown", warm, { once: true });

// Cosmic background (Three.js + bloom) — lazy and non-blocking. It is
// decoration, so it waits until the first screen (the catalogue, or a linked
// lesson once its chunks have arrived) is up, then for idle time: its 135 kB
// chunk must not compete with what the learner came for.
function startBackground(): void {
  void import("./viz/background.js").then((m) => m.createBackground(bg, reducedMotion));
}
void firstScreen.finally(() => {
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback(cb: () => void): void }).requestIdleCallback(startBackground);
  } else {
    setTimeout(startBackground, 600);
  }
});

// Service worker for offline use (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
