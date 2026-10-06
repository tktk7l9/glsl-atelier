// Per-lesson code drafts (SHIG 38: what the learner typed is theirs). Stored
// under its own key so the progress format is untouched. A draft equal to the
// starter code is forgotten, so an untouched lesson keeps no entry.

import type { ProgressStore } from "./progress.js";

const KEY = "glsl-atelier:drafts:v1";

type Drafts = Record<string, string>;

/** Stored JSON is untrusted: keep only own string entries, in a prototype-less
 *  object so keys like `__proto__` / `constructor` can never alias Object.prototype. */
function read(store: ProgressStore): Drafts {
  const drafts: Drafts = Object.create(null) as Drafts;
  const raw = store.getItem(KEY);
  if (!raw) return drafts;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return drafts;
    for (const [id, code] of Object.entries(parsed)) {
      if (id !== "__proto__" && typeof code === "string") drafts[id] = code;
    }
    return drafts;
  } catch {
    return drafts;
  }
}

export function loadDraft(store: ProgressStore, lessonId: string): string | undefined {
  const v = read(store)[lessonId];
  return typeof v === "string" ? v : undefined;
}

/** Save `code` for `lessonId`, or forget it when it equals `starter`. */
export function saveDraft(
  store: ProgressStore,
  lessonId: string,
  code: string,
  starter: string,
): void {
  const drafts = read(store);
  if (code === starter) {
    if (!(lessonId in drafts)) return;
    delete drafts[lessonId];
  } else {
    drafts[lessonId] = code;
  }
  store.setItem(KEY, JSON.stringify(drafts));
}
