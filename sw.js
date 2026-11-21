// Bump VERSION whenever you add or rename files in SHELL.
const VERSION = 'rlcc-framework-v2';
const FONTS = 'rlcc-fonts-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/logo-green.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rlcc-framework-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function notify() {
  self.clients.matchAll({ type: 'window' }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'CONTENT_UPDATED' })));
}

// Pages: serve instantly from cache, refresh in the background (good on slow connections).
async function page(req) {
  const cache = await caches.open(VERSION);
  const key = new URL('index.html', self.registration.scope).href;
  const cached = await cache.match(key);
  const fresh = fetch(req).then((res) => {
    if (res && res.ok) {
      if (cached && (res.headers.get('etag') !== cached.headers.get('etag') || res.headers.get('last-modified') !== cached.headers.get('last-modified'))) notify();
      cache.put(key, res.clone());
    }
    return res;
  }).catch(() => null);
  return cached || (await fresh) || Response.error();
}

async function swr(req, name) {
  const cache = await caches.open(name);
  const cached = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await fresh) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') return e.respondWith(page(req));
  if (url.origin === self.location.origin) return e.respondWith(swr(req, VERSION));
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(swr(req, FONTS));
});
