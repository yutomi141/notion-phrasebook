const CACHE_VERSION = 'v3';
const CACHE_STATIC = `phrasebook-static-${CACHE_VERSION}`;

// 認証が不要な静的ページのみプリキャッシュ
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const { pathname } = url;

  // API・認証エンドポイントはキャッシュしない（認証済みデータをキャッシュに残さない）
  if (pathname.startsWith('/api/')) return;

  // 静的アセット: キャッシュ優先
  e.respondWith(
    caches.match(e.request).then((cached) => cached ?? fetchAndCache(e.request)),
  );
});

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network error', { status: 503 });
  }
}
