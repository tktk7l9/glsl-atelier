import type { Domain, Lesson, Track } from "./types.js";
import { glslTracks } from "./glsl.js";
import { threeTracks } from "./three.js";

/** Catalogue order: WebGL/GLSL tracks first, then Three.js tracks. */
export const TRACKS: readonly Track[] = [...glslTracks, ...threeTracks];

export const LESSONS: readonly Lesson[] = TRACKS.flatMap((t) => t.lessons);

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function trackOf(lessonId: string): Track | undefined {
  return TRACKS.find((t) => t.lessons.some((l) => l.id === lessonId));
}

/** Which runtime executes a lesson ("glsl" shader vs "three" scene). */
export function domainOf(lessonId: string): Domain | undefined {
  return trackOf(lessonId)?.domain;
}

/** The lesson after `id` in catalogue order, or undefined at the end. */
export function nextLesson(id: string): Lesson | undefined {
  const idx = LESSONS.findIndex((l) => l.id === id);
  return idx >= 0 ? LESSONS[idx + 1] : undefined;
}
