const CACHE_VERSION = 'kuy-talk-v20261027-2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {body: event.data ? event.data.text() : ''}; }
  const title = data.title || 'Kuy Talk';
  const options = {
    body: data.body || 'มีการแจ้งเตือนใหม่',
    icon: data.icon || '/brand/icon-192.png',
    badge: data.badge || '/brand/icon-192.png',
    tag: data.tag || 'kuy-talk-notification',
    data: {url: data.url || '/'}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const existing = list.find(c => c.url.startsWith(self.location.origin));
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Always prefer the network for the app shell and code so deployments are not stuck in stale cache.
  if (request.mode === 'navigate' || /\.(?:js|css|webmanifest)$/.test(new URL(request.url).pathname) || new URL(request.url).pathname.startsWith('/b/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Cache only safe static assets; API responses and user data are never cached.
  if (/\.(?:png|jpg|jpeg|svg|ico|woff2?)$/.test(new URL(request.url).pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
