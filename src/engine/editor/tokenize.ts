// Pure C-like tokenizers for syntax highlighting (GLSL + JS). The concatenation
// of all token texts equals the input exactly, so a <pre> overlay can lay out
// span-for-span over a <textarea>. Classification is cosmetic; correctness only
// requires that every character lands in exactly one token.

export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "builtin"
  | "ident"
  | "punct"
  | "space";

export interface Token {
  readonly type: TokenType;
  readonly text: string;
}

interface Lang {
  readonly keywords: ReadonlySet<string>;
  readonly types: ReadonlySet<string>;
  readonly builtins: ReadonlySet<string>;
}

const GLSL: Lang = {
  keywords: new Set([
    "if", "else", "for", "while", "return", "break", "continue", "discard",
    "in", "out", "inout", "uniform", "varying", "attribute", "const",
    "precision", "highp", "mediump", "lowp", "void", "struct", "layout", "define",
  ]),
  types: new Set([
    "float", "int", "bool", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4",
    "sampler2D", "samplerCube",
  ]),
  builtins: new Set([
    "gl_FragColor", "gl_FragCoord", "gl_Position", "gl_PointSize",
    "sin", "cos", "tan", "asin", "acos", "atan", "radians", "degrees",
    "pow", "exp", "log", "exp2", "log2", "sqrt", "inversesqrt",
    "abs", "sign", "floor", "ceil", "fract", "mod", "min", "max", "clamp",
    "mix", "step", "smoothstep", "length", "distance", "dot", "cross",
    "normalize", "reflect", "refract", "texture2D", "texture",
  ]),
};

const JS: Lang = {
  keywords: new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "default", "break", "continue", "new", "class",
    "extends", "import", "export", "from", "of", "in", "this", "typeof",
    "instanceof", "try", "catch", "finally", "throw", "null", "true", "false",
    "undefined", "void", "delete", "yield", "async", "await",
  ]),
  types: new Set([]),
  builtins: new Set(["THREE", "Math", "console", "scene", "camera", "renderer"]),
};

function isSpace(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";
}
function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}
function isIdentStart(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}
function isIdent(c: string): boolean {
  return isIdentStart(c) || isDigit(c);
}

function classify(word: string, lang: Lang): TokenType {
  if (lang.keywords.has(word)) return "keyword";
  if (lang.types.has(word)) return "type";
  if (lang.builtins.has(word)) return "builtin";
  return "ident";
}

function lex(src: string, lang: Lang): Token[] {
  const out: Token[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];

    if (isSpace(c)) {
      let j = i + 1;
      while (j < n && isSpace(src[j])) j++;
      out.push({ type: "space", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c === "/" && src[i + 1] === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") j++;
      out.push({ type: "comment", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = j < n ? j + 2 : n;
      out.push({ type: "comment", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      out.push({ type: "string", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && (isIdent(src[j]) || src[j] === ".")) j++;
      out.push({ type: "number", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdent(src[j])) j++;
      const word = src.slice(i, j);
      out.push({ type: classify(word, lang), text: word });
      i = j;
      continue;
    }

    out.push({ type: "punct", text: c });
    i += 1;
  }
  return out;
}

export function tokenizeGlsl(src: string): Token[] {
  return lex(src, GLSL);
}

export function tokenizeJs(src: string): Token[] {
  return lex(src, JS);
}
