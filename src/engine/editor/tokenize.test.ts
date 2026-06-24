import { describe, expect, it } from "vitest";
import { tokenizeGlsl, tokenizeJs, type Token } from "./tokenize.js";

const text = (toks: Token[]) => toks.map((t) => t.text).join("");
const typeOf = (toks: Token[], txt: string) => toks.find((t) => t.text === txt)?.type;

describe("tokenizer round-trip", () => {
  const samples = [
    "",
    "   \t\n",
    "vec3 color = vec3(1.0);",
    "// line\nx",
    "// eof comment",
    "/* block */ y",
    "/* unterminated",
    'a = "str" + "esc\\"aped" + `tpl`;',
    '"unterminated',
    '"trail\\',
    "0.5 + .25 + 12 + a. + .x",
    "foo.bar(1, 2);",
  ];
  it("preserves the input exactly (glsl & js)", () => {
    for (const s of samples) {
      expect(text(tokenizeGlsl(s))).toBe(s);
      expect(text(tokenizeJs(s))).toBe(s);
    }
  });
});

describe("glsl classification", () => {
  const toks = tokenizeGlsl("uniform vec3 col; col = smoothstep(0.0, 1.0, foo);");
  it("tags keyword / type / builtin / ident", () => {
    expect(typeOf(toks, "uniform")).toBe("keyword");
    expect(typeOf(toks, "vec3")).toBe("type");
    expect(typeOf(toks, "smoothstep")).toBe("builtin");
    expect(typeOf(toks, "foo")).toBe("ident");
  });
  it("tags comments, numbers and punctuation", () => {
    const t = tokenizeGlsl("/* c */ 1.0 ;");
    expect(t[0].type).toBe("comment");
    expect(typeOf(t, "1.0")).toBe("number");
    expect(typeOf(t, ";")).toBe("punct");
  });
});

describe("js classification", () => {
  const toks = tokenizeJs("const m = new THREE.Mesh(); foo;");
  it("tags keyword / builtin / ident (no glsl types)", () => {
    expect(typeOf(toks, "const")).toBe("keyword");
    expect(typeOf(toks, "THREE")).toBe("builtin");
    expect(typeOf(toks, "foo")).toBe("ident");
    expect(typeOf(toks, "vec3")).toBeUndefined();
  });
  it("handles strings and template literals", () => {
    const t = tokenizeJs('`a` + "b" + \'c\'');
    expect(t.filter((x) => x.type === "string")).toHaveLength(3);
  });
});

describe("number edge cases", () => {
  it("treats a lone trailing dot as punctuation, but .5 as a number", () => {
    const t = tokenizeGlsl("a. .5");
    expect(typeOf(t, ".")).toBe("punct");
    expect(typeOf(t, ".5")).toBe("number");
  });
});
