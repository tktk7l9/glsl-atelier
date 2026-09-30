// Guards for stylesheet rules that carry meaning, not just looks. A bad merge
// once turned every catalogue mark green, so a cleared lesson and an open one
// looked the same apart from the glyph.

import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

/** The stylesheet without comments, so a comment never sticks to a selector. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every declaration block whose selector list is exactly `selector`. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(rules); m; m = re.exec(rules)) {
    if (m[1].trim() === selector) out.push(m[2]);
  }
  return out;
}

describe("catalogue lesson marks", () => {
  it("only cleared lessons get the success colour", () => {
    expect(blocks(".lesson-row.is-done .lesson-row__mark").join("")).toMatch(/color:\s*var\(--good\)/);
    for (const body of blocks(".lesson-row__mark")) {
      expect(body).not.toMatch(/var\(--good\)/);
    }
  });

  it("defines the visually-hidden helper once", () => {
    expect(blocks(".visually-hidden")).toHaveLength(1);
    expect(css).not.toMatch(/\.is-done \.visually-hidden/);
  });
});

describe("keyboard focus", () => {
  it("rings every focused link and button", () => {
    expect(blocks("a:focus-visible,\nbutton:focus-visible").join("")).toMatch(/outline:\s*2px solid/);
  });

  it("does not reshape buttons when they take focus", () => {
    for (const body of blocks("a:focus-visible,\nbutton:focus-visible")) {
      expect(body).not.toMatch(/border-radius/);
    }
    expect(blocks("button:focus-visible")).toHaveLength(0);
  });

  it("frames the editor while its textarea (outline off) has focus", () => {
    expect(blocks(".editor-stack:focus-within").join("")).toMatch(/border-color:\s*var\(--cyan\)/);
  });
});

describe("phone back link in the top bar", () => {
  it("is shown only through .topbar-back.is-show (never on the catalogue or wide screens)", () => {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    const showing: string[] = [];
    for (let m = re.exec(rules); m; m = re.exec(rules)) {
      const hits = m[1].split(",").map((s) => s.trim()).filter((s) => s.startsWith(".topbar-back"));
      if (hits.length === 0) continue;
      const display = /(?:^|;|\s)display:\s*([\w-]+)/.exec(m[2]);
      if (display && display[1] !== "none") showing.push(...hits);
    }
    expect(showing).toEqual([".topbar-back.is-show"]);
  });
});
