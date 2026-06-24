import { describe, expect, it } from "vitest";
import type { ValidatorSpec } from "../validate/primitives.js";
import { LESSONS, TRACKS, domainOf, lessonById, nextLesson, trackOf } from "./index.js";

/** Collect sourceMatches patterns the SOLUTION must satisfy (top-level + allOf,
 *  but not anyOf branches, where only one alternative needs to match). */
function requiredPatterns(specs: readonly ValidatorSpec[]): string[] {
  const out: string[] = [];
  for (const s of specs) {
    if (s.kind === "sourceMatches") out.push(s.pattern);
    else if (s.kind === "allOf") out.push(...requiredPatterns(s.of));
  }
  return out;
}

describe("catalogue integrity", () => {
  it("has tracks and lessons", () => {
    expect(TRACKS.length).toBeGreaterThan(8);
    expect(LESSONS.length).toBeGreaterThan(20);
  });

  it("track ids are unique", () => {
    const ids = TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lesson ids are unique", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every track is non-empty and well-formed", () => {
    for (const t of TRACKS) {
      expect(t.title).not.toBe("");
      expect(t.summary).not.toBe("");
      expect(t.icon).not.toBe("");
      expect(["glsl", "three"]).toContain(t.domain);
      expect(t.lessons.length).toBeGreaterThan(0);
    }
  });
});

describe("each lesson", () => {
  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      const c = lesson.challenge;

      it("has copy, starter, solution, hints, validators", () => {
        expect(lesson.title).not.toBe("");
        expect(lesson.explanation).not.toBe("");
        expect(c.task).not.toBe("");
        expect(c.starterCode).not.toBe("");
        expect(c.solution).not.toBe("");
        expect(c.hints.length).toBeGreaterThan(0);
        expect(c.validators.length).toBeGreaterThan(0);
      });

      it("solution satisfies its own sourceMatches validators", () => {
        for (const pattern of requiredPatterns(c.validators)) {
          expect(new RegExp(pattern).test(c.solution), `solution should match /${pattern}/`).toBe(
            true,
          );
        }
      });

      it("is resolvable through the index helpers", () => {
        expect(lessonById(lesson.id)).toBe(lesson);
        expect(trackOf(lesson.id)).toBeDefined();
        expect(domainOf(lesson.id)).toBeDefined();
      });
    });
  }
});

describe("index helpers", () => {
  it("returns undefined for unknown ids", () => {
    expect(lessonById("nope")).toBeUndefined();
    expect(trackOf("nope")).toBeUndefined();
    expect(domainOf("nope")).toBeUndefined();
    expect(nextLesson("nope")).toBeUndefined();
  });

  it("walks lessons in order and ends with undefined", () => {
    expect(nextLesson(LESSONS[0].id)).toBe(LESSONS[1]);
    expect(nextLesson(LESSONS[LESSONS.length - 1].id)).toBeUndefined();
  });
});
