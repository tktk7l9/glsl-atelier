// Light bootstrap. The catalogue + shell ship in the initial bundle; the lesson
// runtime (app.ts) and the Three.js cosmic background (viz/background.ts) are
// dynamically imported so the cold load stays light.

import "./styles.css";
import { byId, el, isPlainClick } from "./ui/dom.js";
import { renderCatalogue } from "./ui/catalogue.js";
import { lessonById, trackOf } from "./engine/content/index.js";
import type { ProgressStore } from "./engine/progress.js";
import type { AppController } from "./app.js";

// Cloudflare Web Analytics — production only. The site token is a public
// identifier embedded in every page, not a secret.
if (import.meta.env.PROD) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = '{"token": "cd156fbf0fd24da0a12e58fdb4e63828"}';
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

// ---- shell ----
const appRoot = byId("app");

const bg = el("canvas", { class: "bg", attrs: { id: "bg", "aria-hidden": "true" } }) as HTMLCanvasElement;

const topbar = el("header", { class: "topbar" });
// The brand navigates to the catalogue, so it is a link, not a button: assistive
// tech announces "link" and the destination is a plain URL (SHIG 11, 60).
const brand = el("a", { class: "brand", attrs: { href: "#", "aria-label": "GLSL Atelier レッスン一覧へ" } });
brand.append(el("span", { class: "brand__glyph", attrs: { "aria-hidden": "true" } }));
brand.append(el("span", { class: "brand__name", text: "GLSL Atelier" }));
brand.append(el("small", { text: "手を動かして学ぶ WebGL / Three.js" }));
const crumb = el("div", { class: "crumb" });
// On phones the crumb is hidden and the panel's back link scrolls away; keep a
// way back in the sticky bar while a lesson is open (SHIG 60, 82). CSS shows it
// only under 640px.
const topbarBack = el("a", { class: "topbar-back", text: "レッスン一覧", attrs: { href: "#" } });
topbar.append(brand, el("div", { class: "topbar-spacer" }), crumb, topbarBack);

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
let app: AppController | null = null;
let loading: Promise<AppController> | null = null;

async function ensureApp(): Promise<AppController> {
  if (app) return app;
  if (!loading) {
    loading = import("./app.js").then((m) =>
      m.createApp({
        onComplete: () => void 0,
        onBack: () => navigateTo(null),
        onOpen: (id) => navigateTo(id),
        reducedMotion,
      }),
    );
  }
  app = await loading;
  return app;
}

const BASE_TITLE = document.title;

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

async function showLesson(id: string): Promise<void> {
  if (onCatalogue) catalogueScroll = window.scrollY;
  onCatalogue = false;
  lastLessonId = id;
  const controller = await ensureApp();
  const lesson = lessonById(id);
  const track = trackOf(id);
  crumb.textContent = "";
  topbarBack.classList.add("is-show");
  if (track && lesson) {
    crumb.append(document.createTextNode(`${track.title} › `), el("b", { text: lesson.title }));
    document.title = `${lesson.title} — GLSL Atelier`;
  }
  main.replaceChildren(controller.root);
  // A lesson always starts at its top, whatever the previous scroll was.
  window.scrollTo(0, 0);
  await controller.open(id);
}

/** Drive routing through the URL hash so lessons are deep-linkable. */
function navigateTo(lessonId: string | null): void {
  const next = lessonId ? `#${lessonId}` : "#";
  if (location.hash === next) void route();
  else location.hash = next;
}

async function route(): Promise<void> {
  const id = location.hash.replace(/^#/, "");
  if (id && lessonById(id)) await showLesson(id);
  else showCatalogue();
}

brand.addEventListener("click", (e) => {
  // Cmd/Ctrl/middle clicks keep link behaviour (open the catalogue in a new tab).
  if (!isPlainClick(e)) return;
  e.preventDefault();
  navigateTo(null);
});
window.addEventListener("hashchange", () => void route());
void route();

// Warm the heavy lesson chunk on first interaction.
const warm = (): void => void ensureApp();
window.addEventListener("pointerdown", warm, { once: true });
window.addEventListener("keydown", warm, { once: true });

// Cosmic background (Three.js + bloom) — lazy, after first paint, non-blocking.
function startBackground(): void {
  void import("./viz/background.js").then((m) => m.createBackground(bg, reducedMotion));
}
if ("requestIdleCallback" in window) {
  (window as Window & { requestIdleCallback(cb: () => void): void }).requestIdleCallback(startBackground);
} else {
  setTimeout(startBackground, 600);
}

// Service worker for offline use (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
