// A dependency-free code editor: a <textarea> (transparent text, visible caret)
// over a <pre> highlight overlay. A pure tokenizer (engine/editor/tokenize)
// drives the overlay; we only ever set className / textContent / scroll — never
// cssText or style attributes — so it stays CSP-strict. The language picks the
// tokenizer (GLSL or JS).

import { tokenizeGlsl, tokenizeJs, type Token, type TokenType } from "../engine/editor/tokenize.js";
import { el } from "./dom.js";

const CLASS: Record<TokenType, string> = {
  comment: "tok-comment",
  string: "tok-string",
  number: "tok-num",
  keyword: "tok-kw",
  type: "tok-type",
  builtin: "tok-builtin",
  ident: "tok-ident",
  punct: "tok-punc",
  space: "",
};

export type EditorLang = "glsl" | "js";

export interface Editor {
  readonly root: HTMLElement;
  getValue(): string;
  setValue(v: string): void;
  setLang(lang: EditorLang): void;
  onInput(cb: (v: string) => void): void;
  /** Fired on Cmd/Ctrl+Enter (a "submit/check" shortcut). */
  onSubmit(cb: () => void): void;
  focus(): void;
}

export function createEditor(label: string): Editor {
  const root = el("div", { class: "editor-wrap" });
  const labelEl = el("div", { class: "editor-label", text: label });
  root.append(labelEl);

  const stack = el("div", { class: "editor-stack" });
  const pre = el("pre", { attrs: { "aria-hidden": "true" } });
  const textarea = el("textarea", {
    attrs: {
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
      autocorrect: "off",
      "aria-label": `${label} エディタ`,
    },
  });
  stack.append(pre, textarea);
  root.append(stack);

  let lang: EditorLang = "glsl";
  let listener: ((v: string) => void) | null = null;
  let submitListener: (() => void) | null = null;

  function tokenize(code: string): Token[] {
    return lang === "glsl" ? tokenizeGlsl(code) : tokenizeJs(code);
  }

  function highlight(code: string): void {
    pre.textContent = "";
    for (const tok of tokenize(code)) {
      if (tok.type === "space") {
        pre.append(document.createTextNode(tok.text));
      } else {
        pre.append(el("span", { class: CLASS[tok.type], text: tok.text }));
      }
    }
  }

  function render(): void {
    highlight(textarea.value);
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  }

  textarea.addEventListener("input", () => {
    render();
    listener?.(textarea.value);
  });
  textarea.addEventListener("scroll", () => {
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  });

  textarea.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitListener?.();
      return;
    }
    if (e.key === "Escape") {
      textarea.blur();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const v = textarea.value;
      const lineStart = v.lastIndexOf("\n", start - 1) + 1;
      if (e.shiftKey) {
        const lead = v.slice(lineStart).match(/^ {1,2}/);
        if (lead) {
          const n = lead[0].length;
          textarea.value = v.slice(0, lineStart) + v.slice(lineStart + n);
          textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - n);
        }
      } else {
        textarea.value = v.slice(0, start) + "  " + v.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
      render();
      listener?.(textarea.value);
    }
  });

  return {
    root,
    getValue: () => textarea.value,
    setValue(v) {
      textarea.value = v;
      render();
    },
    setLang(next) {
      lang = next;
      labelEl.textContent = next === "glsl" ? "fragment shader (GLSL)" : "scene code (JavaScript)";
      render();
    },
    onInput(cb) {
      listener = cb;
    },
    onSubmit(cb) {
      submitListener = cb;
    },
    focus: () => textarea.focus(),
  };
}
