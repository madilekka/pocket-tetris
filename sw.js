const CACHE = 'pocket-tetris-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('pocket-tetris-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function store(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copy));
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) =>
        (res.ok || res.type === 'opaque') ? store(req, res) : res
      ))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Network first, so players get fixes as soon as they are online; the cache is only for offline play.
  event.respondWith(
    fetch(req)
      .then((res) => (res.ok ? store(req, res) : res))
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) =>
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      ))
  );
});
