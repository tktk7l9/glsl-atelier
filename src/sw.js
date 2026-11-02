// Minimal offline support. Navigations are network-first so deploys are picked
// up online, with a per-URL cached fallback (and the app shell as a last
// resort). Other same-origin GETs are cache-first with runtime caching (build
// assets are content-hashed).
//
// This is a template: the build (lessonChunks() in vite.config.ts) emits it as
// /sw.js with PRECACHE filled in (the lesson runtime and every track's lesson
// chunk), so a lesson opens offline without having been opened online first,
// as when all lessons shipped in the initial bundle. ASSETS lists every hashed
// file of the build, so a new worker can drop the previous build's.

const CACHE = "glsl-atelier-v1";
// Cloudflare redirects /index.html to /, and a redirected response may not
// answer a navigation (Chrome refuses it), so the shell is cached as "/". The
// learner-code sandbox page is not cached at all: the navigation of an
// opaque-origin (sandboxed) iframe never reaches a service worker.
const SHELL = ["/", "/favicon.svg", "/manifest.webmanifest"];
const PRECACHE = [];
const ASSETS = [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...SHELL, ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

/** Hashed assets of an earlier build are dead once a new build is active. */
async function dropStaleAssets() {
  const cache = await caches.open(CACHE);
  const keep = new Set(ASSETS);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/assets/") && !keep.has(path)) await cache.delete(req);
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(dropStaleAssets)
      .then(() => self.clients.claim()),
  );
});

/** Cache a successful response. The worker may be stopped once the response
 *  has been handed over, so the write is registered with waitUntil; a failed
 *  write (quota, private mode) only costs the offline copy. */
function store(req, res) {
  return caches
    .open(CACHE)
    .then((c) => c.put(req, res))
    .catch(() => undefined);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a successful response may become an offline fallback; a 404 or
          // 5xx page must never be what an offline navigation shows.
          if (res.ok) event.waitUntil(store(req, res.clone()));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            // An entry an earlier worker cached through a redirect cannot answer
            // a navigation.
            .then((hit) => (hit && !hit.redirected ? hit : caches.match("/"))),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) event.waitUntil(store(req, res.clone()));
          return res;
        }),
    ),
  );
});
