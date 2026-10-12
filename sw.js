/* #FrankMyMP #FrankMyChoice - offline and update-aware service worker */
const VERSION = 'frank-news-v4';
const OFFLINE = ['/', '/manifest.webmanifest', '/css/style.css', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(async cache => {
    await Promise.allSettled(OFFLINE.map(url => cache.add(url)));
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('frank-news-') && name !== VERSION).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/admin/') || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && (request.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(url.pathname))) {
        const cache = await caches.open(VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('/')) || new Response('Offline. Reconnect for latest news.', {status:503});
      return new Response('Offline', {status:503});
    }
  })());
});
