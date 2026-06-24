// Lesson-completion persistence. The store is injected (an interface matching
// the localStorage API) so this module is pure and 100% testable in Node.

export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "glsl-atelier:progress:v1";

/** Load the set of completed lesson ids (tolerant of missing/corrupt data). */
export function loadCompleted(store: ProgressStore): string[] {
  const raw = store.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export function isComplete(store: ProgressStore, id: string): boolean {
  return loadCompleted(store).includes(id);
}

/** Mark a lesson complete (idempotent). Returns the updated completed list. */
export function markComplete(store: ProgressStore, id: string): string[] {
  const completed = loadCompleted(store);
  if (!completed.includes(id)) {
    completed.push(id);
    store.setItem(KEY, JSON.stringify(completed));
  }
  return completed;
}

export interface Completion {
  readonly done: number;
  readonly total: number;
  /** 0..1; 0 when there are no lessons. */
  readonly ratio: number;
}

/** Pure: how many of `lessonIds` are in `completed`. */
export function completion(
  completed: readonly string[],
  lessonIds: readonly string[],
): Completion {
  const set = new Set(completed);
  const done = lessonIds.reduce((acc, id) => acc + (set.has(id) ? 1 : 0), 0);
  const total = lessonIds.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}
