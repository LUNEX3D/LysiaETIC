/* ═══════════════════════════════════════════════════════════
   LysiaETIC - Service Worker (PWA)
   ⚠️ SPA-uyumlu: Navigation istekleri her zaman /index.html'e düşer.
   Cache-first strategy for static assets,
   Network-first for API calls
   ═══════════════════════════════════════════════════════════ */

// ✅ Auto-versioning: build tarihine göre cache versiyonu (hardcoded "v2" yerine)
const CACHE_VERSION = '20250702';
const CACHE_NAME = `lysiaetic-${CACHE_VERSION}`;
const STATIC_CACHE = `lysiaetic-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `lysiaetic-dynamic-${CACHE_VERSION}`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event — pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.log('[SW] Pre-cache failed (non-critical):', err);
        return self.skipWaiting();
      })
  );
});

// Activate event — clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ═══════════════════════════════════════════════════════════
  // ✅ SPA NAVIGATION FIX: Tüm sayfa navigasyonlarını /index.html'e yönlendir
  // Bu, React Router'ın client-side routing yapabilmesi için şart.
  // /login, /dashboard, /admin vs. hepsi index.html üzerinden çalışır.
  // ═══════════════════════════════════════════════════════════
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html').catch(() => {
        return caches.match('/index.html') || caches.match('/offline.html');
      })
    );
    return;
  }

  // API calls — Network first, fallback to cache
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — Cache first
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else — Network first
  event.respondWith(networkFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return new Response(
      JSON.stringify({ error: 'Çevrimdışı - Veri mevcut değil' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Check if request is for a static asset
function isStaticAsset(url) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webp'
  ];
  return staticExtensions.some((ext) => url.includes(ext));
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
