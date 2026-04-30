/* ═══════════════════════════════════════════════════════════
   Pazaryönetim - Service Worker (PWA) — ENHANCED v3
   ✅ SPA-uyumlu: Navigation istekleri her zaman /index.html'e düşer
   ✅ Cache-first for static assets (JS, CSS, images, fonts)
   ✅ Network-first for API calls
   ✅ Stale-while-revalidate for fonts (Google Fonts)
   ✅ Cache size limits to prevent storage bloat
   ✅ Push Notifications support
   ✅ Background Sync support
   ✅ Periodic Background Sync (order/stock check)
   ═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = '20250702-v3';
const STATIC_CACHE = `lysiaetic-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `lysiaetic-dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `lysiaetic-fonts-${CACHE_VERSION}`;
const IMAGE_CACHE = `lysiaetic-images-${CACHE_VERSION}`;

// Max cache sizes to prevent storage bloat
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

// Static assets to pre-cache (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ═══════════════════════════════════════════════════════════
// INSTALL — Pre-cache app shell
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Non-critical: continue even if pre-cache fails
        console.warn('[SW] Pre-cache failed:', err);
        return self.skipWaiting();
      })
  );
});

// ═══════════════════════════════════════════════════════════
// ACTIVATE — Clean up ALL old caches
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, FONT_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ═══════════════════════════════════════════════════════════
// FETCH — Smart routing with multiple strategies
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ── SPA Navigation: Always serve index.html ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html')
        .then((response) => {
          // Update cache with fresh index.html
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/offline.html');
        })
    );
    return;
  }

  // ── API calls: Network first ──
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // ── Google Fonts: Stale-while-revalidate ──
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // ── Images: Cache first with size limit ──
  if (isImageAsset(request.url)) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, MAX_IMAGE_CACHE));
    return;
  }

  // ── Static assets (JS, CSS): Cache first ──
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Everything else: Network first ──
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ═══════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let data = {
    title: 'Pazaryönetim',
    body: 'Yeni bir bildiriminiz var',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'lysiaetic-notification',
    data: { url: '/dashboard' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    // If not JSON, use text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    tag: data.tag || 'lysiaetic-notification',
    vibrate: [100, 50, 100, 50, 200],
    data: data.data || { url: '/dashboard' },
    actions: data.actions || [
      { action: 'open', title: '📂 Aç' },
      { action: 'dismiss', title: '❌ Kapat' }
    ],
    requireInteraction: data.requireInteraction || false,
    renotify: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click Handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/dashboard';

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: targetUrl,
              data: notificationData
            });
            return;
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});

// ── Notification Close Handler ──
self.addEventListener('notificationclose', (event) => {
  // Analytics: track dismissed notifications
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ═══════════════════════════════════════════════════════════
// BACKGROUND SYNC — Retry failed API calls when back online
// ═══════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }

  if (event.tag === 'sync-stock-updates') {
    event.waitUntil(syncPendingStockUpdates());
  }

  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// ── Sync pending orders that failed while offline ──
async function syncPendingOrders() {
  try {
    const cache = await caches.open('lysiaetic-sync-queue');
    const requests = await cache.keys();
    const orderRequests = requests.filter(r => r.url.includes('/api/orders'));

    for (const request of orderRequests) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const body = await cachedResponse.json();
          await fetch(request.url, {
            method: request.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          await cache.delete(request);
          console.log('[SW] Synced order:', request.url);
        }
      } catch (err) {
        console.warn('[SW] Order sync failed, will retry:', err.message);
      }
    }
  } catch (err) {
    console.error('[SW] syncPendingOrders error:', err);
  }
}

// ── Sync pending stock updates ──
async function syncPendingStockUpdates() {
  try {
    const cache = await caches.open('lysiaetic-sync-queue');
    const requests = await cache.keys();
    const stockRequests = requests.filter(r => r.url.includes('/api/stock'));

    for (const request of stockRequests) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const body = await cachedResponse.json();
          await fetch(request.url, {
            method: request.method || 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          await cache.delete(request);
          console.log('[SW] Synced stock update:', request.url);
        }
      } catch (err) {
        console.warn('[SW] Stock sync failed, will retry:', err.message);
      }
    }
  } catch (err) {
    console.error('[SW] syncPendingStockUpdates error:', err);
  }
}

// ── Sync any offline actions ──
async function syncOfflineActions() {
  try {
    const cache = await caches.open('lysiaetic-sync-queue');
    const requests = await cache.keys();

    for (const request of requests) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const body = await cachedResponse.json();
          await fetch(request.url, {
            method: body._method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          await cache.delete(request);
        }
      } catch (err) {
        console.warn('[SW] Offline action sync failed:', err.message);
      }
    }
  } catch (err) {
    console.error('[SW] syncOfflineActions error:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// PERIODIC BACKGROUND SYNC — Check for new orders/updates
// ═══════════════════════════════════════════════════════════
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-new-orders') {
    event.waitUntil(checkForNewOrders());
  }
});

async function checkForNewOrders() {
  try {
    const response = await fetch('/api/notifications/unread-count');
    if (response.ok) {
      const data = await response.json();
      if (data.count > 0) {
        await self.registration.showNotification('Pazaryönetim', {
          body: `${data.count} yeni bildiriminiz var`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'new-orders',
          data: { url: '/dashboard' }
        });
      }
    }
  } catch (err) {
    // Silently fail — periodic sync is best-effort
  }
}

// ═══════════════════════════════════════════════════════════
// CACHING STRATEGIES
// ═══════════════════════════════════════════════════════════

// Cache-first: Try cache, fallback to network
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return new Response('Offline', { status: 503 });
  }
}

// Cache-first with size limit: Evict oldest entries
async function cacheFirstWithLimit(request, cacheName, maxEntries) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());

      // Evict oldest if over limit
      const keys = await cache.keys();
      if (keys.length > maxEntries) {
        await cache.delete(keys[0]);
      }
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    return new Response('Offline', { status: 503 });
  }
}

// Network-first: Try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());

      // Limit dynamic cache size
      const keys = await cache.keys();
      if (keys.length > MAX_DYNAMIC_CACHE) {
        await cache.delete(keys[0]);
      }
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

// Stale-while-revalidate: Serve cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|ttf|eot)(\?|$)/i.test(url);
}

function isImageAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|avif)(\?|$)/i.test(url);
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // App can request to queue an action for background sync
  if (event.data && event.data.type === 'QUEUE_SYNC') {
    const { url, method, body, tag } = event.data;
    caches.open('lysiaetic-sync-queue').then((cache) => {
      const request = new Request(url, { method });
      const response = new Response(JSON.stringify({ ...body, _method: method }));
      cache.put(request, response);
    }).then(() => {
      // Register for background sync
      if (self.registration.sync) {
        return self.registration.sync.register(tag || 'sync-offline-actions');
      }
    }).catch((err) => {
      console.warn('[SW] Failed to queue sync:', err);
    });
  }
});

