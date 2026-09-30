/** Get a required element by id, throwing a clear error if the markup changed. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
}

/** Create an element with optional class, text, and attributes. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    class?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  return node;
}

/**
 * True for an unmodified primary-button click. Links that route in-app should
 * only take over these; Cmd/Ctrl/Shift/Alt or middle clicks keep the browser's
 * own behaviour (open in a new tab/window, download).
 */
export function isPlainClick(
  e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">,
): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
