// Content is pure data. Tracks → Lessons → Challenge. Each challenge composes
// ValidatorSpec primitives. A track's `domain` decides which runtime executes &
// snapshots the learner's code: the WebGL shader runtime ("glsl") or the
// Three.js scene sandbox ("three"). Authored one module per track under
// content/tracks/; content/index.ts holds the catalogue and loads each track's
// module on demand.

import type { ValidatorSpec } from "../validate/primitives.js";

export type Domain = "glsl" | "three";

export interface Challenge {
  /** Pre-filled editor contents (a full GLSL fragment shader, or Three.js JS). */
  readonly starterCode: string;
  /** The goal, shown to the learner. */
  readonly task: string;
  /** Composed validators; the challenge passes when all pass. */
  readonly validators: readonly ValidatorSpec[];
  readonly hints: readonly string[];
  /** Reference code known to satisfy the validators. */
  readonly solution: string;
}

/** What the catalogue (the first screen) knows about a lesson. */
export interface LessonMeta {
  readonly id: string;
  readonly title: string;
}

/** What the catalogue knows about a track. Only this ships in the initial
 *  bundle; the lessons themselves load with their track (see index.ts). */
export interface TrackMeta {
  readonly id: string;
  readonly domain: Domain;
  readonly title: string;
  readonly summary: string;
  readonly icon: string;
  readonly lessons: readonly LessonMeta[];
}

export interface Lesson extends LessonMeta {
  /** Short explanation (tiny markdown-lite: paragraphs + `code`). */
  readonly explanation: string;
  readonly mdnPath?: string;
  readonly challenge: Challenge;
}

export interface Track extends TrackMeta {
  readonly lessons: readonly Lesson[];
}
