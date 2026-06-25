// Light bootstrap. The catalogue + shell ship in the initial bundle; the lesson
// runtime (app.ts) and the Three.js cosmic background (viz/background.ts) are
// dynamically imported so the cold load stays light.

import "./styles.css";
import { byId, el } from "./ui/dom.js";
import { renderCatalogue } from "./ui/catalogue.js";
import { lessonById, trackOf } from "./engine/content/index.js";
import type { ProgressStore } from "./engine/progress.js";
import type { AppController } from "./app.js";

// Vercel Web Analytics — production only. Script + beacon are same-origin
// (/_vercel/insights/*), so the strict CSP (script-src/connect-src 'self') is unaffected.
if (import.meta.env.PROD) {
  void import("@vercel/analytics").then(({ inject }) => inject());
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
const brand = el("button", { class: "brand", attrs: { type: "button" } });
brand.append(el("span", { class: "brand__glyph", attrs: { "aria-hidden": "true" } }));
brand.append(el("span", { class: "brand__name", text: "GLSL Atelier" }));
brand.append(el("small", { text: "手を動かして学ぶ WebGL / Three.js" }));
const crumb = el("div", { class: "crumb" });
topbar.append(brand, el("div", { class: "topbar-spacer" }), crumb);

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

function showCatalogue(): void {
  crumb.textContent = "";
  main.replaceChildren(renderCatalogue(store, (id) => navigateTo(id)));
}

async function showLesson(id: string): Promise<void> {
  const controller = await ensureApp();
  const lesson = lessonById(id);
  const track = trackOf(id);
  crumb.textContent = "";
  if (track && lesson) {
    crumb.append(document.createTextNode(`${track.title} › `), el("b", { text: lesson.title }));
  }
  main.replaceChildren(controller.root);
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

brand.addEventListener("click", () => navigateTo(null));
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
