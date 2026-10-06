import { describe, expect, it } from "vitest";
import { loadDraft, saveDraft } from "./drafts.js";
import type { ProgressStore } from "./progress.js";

function memStore(initial?: string): ProgressStore & { raw(): string | null } {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => {
      value = v;
    },
    raw: () => value,
  };
}

describe("drafts", () => {
  it("returns undefined when nothing is saved", () => {
    expect(loadDraft(memStore(), "a")).toBeUndefined();
  });

  it("round-trips a draft per lesson", () => {
    const store = memStore();
    saveDraft(store, "a", "code A", "starter");
    saveDraft(store, "b", "code B", "starter");
    expect(loadDraft(store, "a")).toBe("code A");
    expect(loadDraft(store, "b")).toBe("code B");
  });

  it("forgets the draft when it equals the starter code", () => {
    const store = memStore();
    saveDraft(store, "a", "edited", "starter");
    saveDraft(store, "a", "starter", "starter");
    expect(loadDraft(store, "a")).toBeUndefined();
  });

  it("does not write when forgetting a draft that was never saved", () => {
    const store = memStore();
    saveDraft(store, "a", "starter", "starter");
    expect(store.raw()).toBeNull();
  });

  it("tolerates corrupt or foreign data", () => {
    expect(loadDraft(memStore("{not json"), "a")).toBeUndefined();
    expect(loadDraft(memStore(JSON.stringify(["x"])), "a")).toBeUndefined();
    expect(loadDraft(memStore(JSON.stringify(null)), "a")).toBeUndefined();
    expect(loadDraft(memStore(JSON.stringify({ a: 1 })), "a")).toBeUndefined();
  });

  it("overwrites corrupt data on save", () => {
    const store = memStore("{not json");
    saveDraft(store, "a", "code", "starter");
    expect(loadDraft(store, "a")).toBe("code");
  });
});

describe("drafts with hostile stored JSON", () => {
  it("ignores keys that only exist on Object.prototype", () => {
    const s = memStore("{}");
    expect(loadDraft(s, "constructor")).toBeUndefined();
    expect(loadDraft(s, "toString")).toBeUndefined();
  });

  it("does not let a stored __proto__ key leak into other lessons", () => {
    const s = memStore('{"__proto__":{"a":"void main(){}"}}');
    expect(loadDraft(s, "a")).toBeUndefined();
    expect(loadDraft(s, "__proto__")).toBeUndefined();
    expect(({} as Record<string, unknown>)["a"]).toBeUndefined();
  });

  it("drops non-string entries and keeps the valid ones on the next save", () => {
    const s = memStore('{"a":42,"b":{"x":1},"c":"kept"}');
    expect(loadDraft(s, "a")).toBeUndefined();
    expect(loadDraft(s, "b")).toBeUndefined();
    saveDraft(s, "d", "new", "starter");
    expect(JSON.parse(s.raw()!)).toEqual({ c: "kept", d: "new" });
  });

  it("does not forget a prototype key that was never saved", () => {
    const s = memStore('{"c":"kept"}');
    saveDraft(s, "constructor", "starter", "starter");
    expect(s.raw()).toBe('{"c":"kept"}');
  });
});
