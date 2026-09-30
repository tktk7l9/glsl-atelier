// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getByLabelText, getByText } from "@testing-library/dom";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { createEditor, type Editor } from "./editor.js";

let editor: Editor;
let textarea: HTMLTextAreaElement;
let pre: HTMLPreElement;
let user: UserEvent;

beforeEach(() => {
  document.body.innerHTML = "";
  editor = createEditor("editor");
  document.body.append(editor.root);
  textarea = getByLabelText<HTMLTextAreaElement>(editor.root, "editor エディタ");
  pre = editor.root.querySelector("pre") as HTMLPreElement;
  user = userEvent.setup();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const classesOf = (): string[] =>
  Array.from(pre.querySelectorAll("span")).map((s) => s.className);

describe("createEditor", () => {
  it("shows the label and a textarea that does not autocorrect", () => {
    expect(getByText(editor.root, "editor")).toBeTruthy();
    expect(textarea.getAttribute("spellcheck")).toBe("false");
    expect(textarea.getAttribute("autocomplete")).toBe("off");
    expect(pre.getAttribute("aria-hidden")).toBe("true");
  });

  it("mirrors the value into the highlight overlay with GLSL tokens", () => {
    editor.setValue("void main() { gl_FragColor = vec4(1.0); }");
    expect(editor.getValue()).toBe("void main() { gl_FragColor = vec4(1.0); }");
    expect(pre.textContent).toBe("void main() { gl_FragColor = vec4(1.0); }");
    expect(classesOf()).toContain("tok-kw");
    expect(classesOf()).toContain("tok-builtin");
    expect(classesOf()).toContain("tok-num");
  });

  it("switches the label and tokenizer when the language changes", () => {
    editor.setValue("const x = 1; // note");
    editor.setLang("js");
    expect(getByText(editor.root, "scene code (JavaScript)")).toBeTruthy();
    expect(classesOf()).toContain("tok-kw");
    expect(classesOf()).toContain("tok-comment");
    editor.setLang("glsl");
    expect(getByText(editor.root, "fragment shader (GLSL)")).toBeTruthy();
  });

  it("re-highlights and notifies the listener on every input", async () => {
    const seen: string[] = [];
    editor.onInput((v) => seen.push(v));
    await user.click(textarea);
    await user.keyboard("ab");
    expect(seen).toEqual(["a", "ab"]);
    expect(pre.textContent).toBe("ab");
  });

  it("keeps the overlay scrolled in sync with the textarea", () => {
    editor.setValue("x\n".repeat(50));
    textarea.scrollTop = 120;
    textarea.scrollLeft = 8;
    textarea.dispatchEvent(new Event("scroll"));
    expect(pre.scrollTop).toBe(120);
    expect(pre.scrollLeft).toBe(8);
  });

  it("fires onSubmit for Cmd+Enter and Ctrl+Enter without inserting a newline", async () => {
    const submit = vi.fn();
    editor.onSubmit(submit);
    editor.setValue("a");
    await user.click(textarea);
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(submit).toHaveBeenCalledTimes(2);
    expect(editor.getValue()).toBe("a");
  });

  it("inserts a plain Enter as a newline", async () => {
    editor.setValue("");
    await user.click(textarea);
    await user.keyboard("a{Enter}b");
    expect(editor.getValue()).toBe("a\nb");
  });

  it("blurs the textarea on Escape so keyboard users can leave the editor", async () => {
    await user.click(textarea);
    expect(document.activeElement).toBe(textarea);
    await user.keyboard("{Escape}");
    expect(document.activeElement).not.toBe(textarea);
  });

  it("inserts two spaces on Tab instead of moving focus", async () => {
    const seen: string[] = [];
    editor.onInput((v) => seen.push(v));
    editor.setValue("ab");
    await user.click(textarea);
    textarea.setSelectionRange(1, 1);
    await user.keyboard("{Tab}");
    expect(editor.getValue()).toBe("a  b");
    expect(textarea.selectionStart).toBe(3);
    expect(document.activeElement).toBe(textarea);
    expect(seen).toEqual(["a  b"]);
    expect(pre.textContent).toBe("a  b");
  });

  it("replaces a selection with the indent on Tab", async () => {
    editor.setValue("hello");
    await user.click(textarea);
    textarea.setSelectionRange(1, 4);
    await user.keyboard("{Tab}");
    expect(editor.getValue()).toBe("h  o");
  });

  it("removes up to two leading spaces of the line on Shift+Tab", async () => {
    editor.setValue("x\n    y");
    await user.click(textarea);
    textarea.setSelectionRange(7, 7); // after "y"
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(editor.getValue()).toBe("x\n  y");
    expect(textarea.selectionStart).toBe(5);
  });

  it("leaves a line without leading spaces alone on Shift+Tab", async () => {
    editor.setValue("x\ny");
    await user.click(textarea);
    textarea.setSelectionRange(3, 3);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(editor.getValue()).toBe("x\ny");
  });

  it("does not move the caret before the line start when outdenting at column 1", async () => {
    editor.setValue("  y");
    await user.click(textarea);
    textarea.setSelectionRange(1, 1);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(editor.getValue()).toBe("y");
    expect(textarea.selectionStart).toBe(0);
  });

  it("focus() moves keyboard focus into the textarea", () => {
    editor.focus();
    expect(document.activeElement).toBe(textarea);
  });
});
