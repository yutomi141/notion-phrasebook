const CACHE_VERSION = 'v4';
const CACHE_STATIC = `phrasebook-static-${CACHE_VERSION}`;

// キャッシュ対象の静的アセットパターン（ナビゲーション・HTML・API は除外）
const STATIC_PREFIXES = ['/_next/static/', '/icons/'];
const STATIC_EXACT = new Set(['/favicon.ico', '/manifest.webmanifest']);

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
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

  // API・認証エンドポイントはキャッシュしない
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) return;

  // ナビゲーションリクエスト（HTML ページ）はキャッシュしない
  if (e.request.mode === 'navigate') return;

  // Accept ヘッダーに text/html が含まれていればキャッシュしない
  const accept = e.request.headers.get('Accept') ?? '';
  if (accept.includes('text/html')) return;

  // 静的アセットのみキャッシュ対象
  const isStaticAsset =
    STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    STATIC_EXACT.has(pathname);

  if (!isStaticAsset) return;

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
