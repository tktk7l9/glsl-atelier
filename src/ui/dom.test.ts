// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { byId, el, isPlainClick } from "./dom.js";

describe("byId", () => {
  it("returns the element with that id", () => {
    document.body.innerHTML = '<div id="app"></div>';
    expect(byId("app")).toBe(document.getElementById("app"));
  });

  it("throws a clear error when the markup lacks the id", () => {
    document.body.innerHTML = "";
    expect(() => byId("missing")).toThrow("#missing missing");
  });
});

describe("el", () => {
  it("creates a bare element", () => {
    const node = el("span");
    expect(node.tagName).toBe("SPAN");
    expect(node.className).toBe("");
    expect(node.textContent).toBe("");
  });

  it("applies class, text and attributes", () => {
    const node = el("a", { class: "link", text: "GitHub", attrs: { href: "/x", rel: "noopener" } });
    expect(node.className).toBe("link");
    expect(node.textContent).toBe("GitHub");
    expect(node.getAttribute("href")).toBe("/x");
    expect(node.getAttribute("rel")).toBe("noopener");
  });

  it("sets innerHTML when html is given", () => {
    const node = el("h1", { html: "GLSL <b>Atelier</b>" });
    expect(node.querySelector("b")?.textContent).toBe("Atelier");
  });

  it("keeps an empty string as text (does not treat it as unset)", () => {
    const node = el("p", { text: "" });
    expect(node.textContent).toBe("");
    expect(node.childNodes).toHaveLength(0);
  });
});

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

describe("isPlainClick", () => {
  it("accepts an unmodified primary click", () => {
    expect(isPlainClick(click)).toBe(true);
  });

  it.each([
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
    ["middle button", { button: 1 }],
    ["already handled", { defaultPrevented: true }],
  ])("leaves %s clicks to the browser", (_name, patch) => {
    expect(isPlainClick({ ...click, ...patch })).toBe(false);
  });
});
