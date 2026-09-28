// Learner-facing wording for check results (SHIG 55: constructive errors,
// 11: the user's words). Validators report *where* and *what* in plain terms —
// "左端の中ほど", "赤 1.00・緑 0.00・青 1.00" — instead of raw axes and rects.

import type { Channel, Rect } from "./sample.js";
import type { RGB, Vec3 } from "./snapshot.js";

const two = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);

/** "赤 1.00・緑 0.00・青 0.50" */
export function formatRgb(rgb: RGB): string {
  return `赤 ${two(rgb[0])}・緑 ${two(rgb[1])}・青 ${two(rgb[2])}`;
}

/** "(0, 1.5, -2)" — up to two decimals, no trailing zeros. */
export function formatVec3(v: Vec3): string {
  return `(${v.map((n) => String(Math.round(n * 100) / 100)).join(", ")})`;
}

type Band = 0 | 1 | 2;
const band = (t: number): Band => (t < 1 / 3 ? 0 : t > 2 / 3 ? 2 : 1);

/** Name one of the nine regions of the canvas (origin bottom-left, GL style). */
export function describePoint(x: number, y: number): string {
  const h = band(x);
  const v = band(y);
  if (h === 1 && v === 1) return "中央";
  if (v === 1) return h === 0 ? "左端の中ほど" : "右端の中ほど";
  if (h === 1) return v === 0 ? "下端の中ほど" : "上端の中ほど";
  return `${h === 0 ? "左" : "右"}${v === 0 ? "下" : "上"}の角`;
}

/** "画面全体" for a full-canvas rect, otherwise the region of its centre. */
export function describeRect(rect: Rect): string {
  const [x0, y0, x1, y1] = rect;
  if (x0 <= 0 && y0 <= 0 && x1 >= 1 && y1 >= 1) return "画面全体";
  return describePoint((x0 + x1) / 2, (y0 + y1) / 2);
}

const CHANNEL_GROWS: Record<Channel, string> = {
  lum: "明るくなる",
  r: "赤が強くなる",
  g: "緑が強くなる",
  b: "青が強くなる",
};

/** "左 → 右 に向かって明るくなる" */
export function describeDirection(axis: "x" | "y", dir: "up" | "down", ch: Channel): string {
  const [low, high] = axis === "x" ? ["左", "右"] : ["下", "上"];
  const [from, to] = dir === "up" ? [low, high] : [high, low];
  return `${from} → ${to} に向かって${CHANNEL_GROWS[ch]}`;
}
