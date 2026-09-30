import { describe, expect, it } from "vitest";
import { isPlainClick } from "./dom";

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
