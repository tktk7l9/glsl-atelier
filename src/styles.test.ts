// Guards for stylesheet rules that carry meaning, not just looks. A bad merge
// once turned every catalogue mark green, so a cleared lesson and an open one
// looked the same apart from the glyph.

import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

/** Every declaration block whose selector list is exactly `selector`. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
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
