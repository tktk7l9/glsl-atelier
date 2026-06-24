import { describe, expect, it } from "vitest";
import {
  completion,
  isComplete,
  loadCompleted,
  markComplete,
  type ProgressStore,
} from "./progress.js";

function memStore(initial?: string): ProgressStore {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => {
      value = v;
    },
  };
}

describe("loadCompleted", () => {
  it("returns [] when empty", () => {
    expect(loadCompleted(memStore())).toEqual([]);
  });
  it("parses a stored array of strings", () => {
    expect(loadCompleted(memStore(JSON.stringify(["a", "b"])))).toEqual(["a", "b"]);
  });
  it("filters out non-strings", () => {
    expect(loadCompleted(memStore(JSON.stringify(["a", 1, null])))).toEqual(["a"]);
  });
  it("returns [] for non-array JSON", () => {
    expect(loadCompleted(memStore(JSON.stringify({ a: 1 })))).toEqual([]);
  });
  it("returns [] for corrupt JSON", () => {
    expect(loadCompleted(memStore("{not json"))).toEqual([]);
  });
});

describe("markComplete / isComplete", () => {
  it("adds an id and is idempotent", () => {
    const store = memStore();
    expect(markComplete(store, "x")).toEqual(["x"]);
    expect(markComplete(store, "x")).toEqual(["x"]);
    expect(isComplete(store, "x")).toBe(true);
    expect(isComplete(store, "y")).toBe(false);
  });
});

describe("completion", () => {
  it("counts matches", () => {
    expect(completion(["a", "b"], ["a", "b", "c"])).toEqual({ done: 2, total: 3, ratio: 2 / 3 });
  });
  it("is zero ratio with no lessons", () => {
    expect(completion([], [])).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});
