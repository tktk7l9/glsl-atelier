// Per-lesson code drafts (SHIG 38: what the learner typed is theirs). Stored
// under its own key so the progress format is untouched. A draft equal to the
// starter code is forgotten, so an untouched lesson keeps no entry.

import type { ProgressStore } from "./progress.js";

const KEY = "glsl-atelier:drafts:v1";

type Drafts = Record<string, string>;

function read(store: ProgressStore): Drafts {
  const raw = store.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Drafts)
      : {};
  } catch {
    return {};
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
