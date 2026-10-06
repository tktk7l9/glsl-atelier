import rules from "../public/_headers?raw";
import { describe, expect, it } from "vitest";

// public/_headers is the only place security headers are set (static assets on
// Workers, no Worker script). Pin the strict app posture and the sandbox
// carve-out: learner Three.js code runs in /sandbox.html, which may use
// inline/eval only because it is an opaque origin with no network.
function block(path: string): Record<string, string> {
  const lines = rules.split("\n");
  const start = lines.indexOf(path);
  expect(start, `rule block for ${path}`).toBeGreaterThanOrEqual(0);
  const headers: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    const trimmed = line.trim();
    // "! Name" detaches the value inherited from /* before it is set again.
    if (trimmed.startsWith("! ")) continue;
    const [name, ...rest] = trimmed.split(": ");
    // Cloudflare comma-joins repeated names, which would corrupt a CSP.
    expect(headers, `${name} set once under ${path}`).not.toHaveProperty(name);
    headers[name] = rest.join(": ");
  }
  return headers;
}

describe("public/_headers: app", () => {
  const site = block("/*");
  const csp = site["Content-Security-Policy"];

  it("keeps script and style sources strict (no inline, no eval, no wildcard)", () => {
    expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    expect(csp).toContain("style-src 'self';");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  it("only frames same-origin content (the sandbox) and limits fetch targets", () => {
    expect(csp).toContain("frame-src 'self';");
    expect(csp).toContain("img-src 'self' data: blob:;");
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
  });

  it("locks framing, navigation and plugins", () => {
    for (const directive of [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(site["X-Frame-Options"]).toBe("DENY");
  });

  it("sets the remaining hardening headers", () => {
    expect(site["X-Content-Type-Options"]).toBe("nosniff");
    expect(site["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(site["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(site["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(site["Permissions-Policy"]).toContain("camera=()");
  });

  it("caches hashed Vite assets as immutable", () => {
    expect(block("/assets/*")["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });
});

describe("public/_headers: learner-code sandbox", () => {
  const app = block("/*")["Content-Security-Policy"];

  for (const path of ["/sandbox.html", "/sandbox"]) {
    it(`${path} replaces (not appends to) the app CSP`, () => {
      const lines = rules.split("\n");
      const body = lines.slice(lines.indexOf(path) + 1);
      expect(body[0].trim()).toBe("! Content-Security-Policy");
    });

    it(`${path} forces an opaque origin with no network`, () => {
      const csp = block(path)["Content-Security-Policy"];
      expect(csp).not.toBe(app);
      expect(csp).toMatch(/(^|; )sandbox allow-scripts$/);
      expect(csp).not.toContain("allow-same-origin");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("connect-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("form-action 'none'");
      expect(block(path)["Referrer-Policy"]).toBe("no-referrer");
    });
  }

  it("serves the same policy on both sandbox paths", () => {
    expect(block("/sandbox")).toEqual(block("/sandbox.html"));
  });
});
