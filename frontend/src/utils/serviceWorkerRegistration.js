/**
 * serviceWorkerRegistration.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════
 * Enhanced Service Worker registration with:
 *   ✅ Push Notification subscription
 *   ✅ Background Sync registration
 *   ✅ Periodic Background Sync (new order checks)
 *   ✅ Update detection & prompt
 *   ✅ Capacitor-aware (skip SW in native app)
 * ═══════════════════════════════════════════════════════════
 */

const isLocalhost = Boolean(
    window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/)
);

/**
 * Register the service worker and set up push/sync
 */
export async function register(config = {}) {
    // Skip in Capacitor native app — Capacitor handles push natively
    if (window.Capacitor?.isNativePlatform()) {
        console.log("[SW] Skipping — running in Capacitor native app");
        return;
    }

    if (!("serviceWorker" in navigator)) {
        console.log("[SW] Service Workers not supported");
        return;
    }

    // Only register in production (or if forced)
    if (process.env.NODE_ENV !== "production" && !config.forceRegister) {
        await cleanupDev();
        return;
    }

    window.addEventListener("load", async () => {
        const swUrl = "/service-worker.js";

        if (isLocalhost) {
            // Localhost: check if SW is valid, then register
            await checkValidServiceWorker(swUrl, config);
            navigator.serviceWorker.ready.then(() => {
                console.log("[SW] Ready (localhost)");
            });
        } else {
            // Production: register directly
            await registerValidSW(swUrl, config);
        }
    });
}

/**
 * Register the SW and set up all features
 */
async function registerValidSW(swUrl, config) {
    try {
        const registration = await navigator.serviceWorker.register(swUrl);
        console.log("[SW] Registered:", registration.scope);

        // ── Update detection ──
        registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed") {
                    if (navigator.serviceWorker.controller) {
                        // New content available — notify user
                        console.log("[SW] New content available — refresh to update");
                        if (config.onUpdate) {
                            config.onUpdate(registration);
                        }
                    } else {
                        // Content cached for offline use
                        console.log("[SW] Content cached for offline use");
                        if (config.onSuccess) {
                            config.onSuccess(registration);
                        }
                    }
                }
            };
        };

        // ── Wait for SW to be ready, then set up features ──
        const readyRegistration = await navigator.serviceWorker.ready;

        // Set up push notifications if permission granted
        await setupPushNotifications(readyRegistration);

        // Set up periodic background sync
        await setupPeriodicSync(readyRegistration);

        // Listen for messages from SW
        setupMessageListener();

        return readyRegistration;
    } catch (error) {
        console.error("[SW] Registration failed:", error);
    }
}

/**
 * Check if SW is valid (localhost development)
 */
async function checkValidServiceWorker(swUrl, config) {
    try {
        const response = await fetch(swUrl, {
            headers: { "Service-Worker": "script" }
        });

        const contentType = response.headers.get("content-type");
        if (response.status === 404 || (contentType && !contentType.includes("javascript"))) {
            // No SW found — unregister and reload
            const registration = await navigator.serviceWorker.ready;
            await registration.unregister();
            window.location.reload();
        } else {
            await registerValidSW(swUrl, config);
        }
    } catch {
        console.log("[SW] No internet — running in offline mode");
    }
}

/**
 * Unregister the service worker
 */
export async function unregister() {
    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.unregister();
            console.log("[SW] Unregistered");
        } catch (error) {
            console.error("[SW] Unregister error:", error);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Request push notification permission and subscribe
 */
export async function setupPushNotifications(registration) {
    if (!("PushManager" in window)) {
        console.log("[Push] Push notifications not supported");
        return null;
    }

    try {
        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Don't auto-request — let the app request when user opts in
            console.log("[Push] No subscription yet — waiting for user opt-in");
            return null;
        }

        console.log("[Push] Existing subscription found");
        return subscription;
    } catch (error) {
        console.warn("[Push] Setup error:", error);
        return null;
    }
}

/**
 * Request permission and subscribe to push notifications
 * Call this when user explicitly opts in (e.g., clicks "Enable Notifications")
 */
export async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("[Push] Not supported");
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("[Push] Permission denied");
            return null;
        }

        const registration = await navigator.serviceWorker.ready;

        // VAPID public key — generate with: npx web-push generate-vapid-keys
        // For now, use a placeholder. Replace with your actual VAPID key.
        const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
            console.warn("[Push] VAPID public key not configured (REACT_APP_VAPID_PUBLIC_KEY)");
            // Still works for local testing without VAPID
            return null;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        // Send subscription to backend
        try {
            await fetch("/api/notifications/subscribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify(subscription)
            });
            console.log("[Push] Subscribed and sent to server");
        } catch (err) {
            console.warn("[Push] Failed to send subscription to server:", err);
        }

        return subscription;
    } catch (error) {
        console.error("[Push] Subscribe error:", error);
        return null;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            // Notify backend
            try {
                await fetch("/api/notifications/unsubscribe", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                    },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
            } catch (err) {
                console.warn("[Push] Failed to notify server of unsubscribe:", err);
            }

            console.log("[Push] Unsubscribed");
            return true;
        }
        return false;
    } catch (error) {
        console.error("[Push] Unsubscribe error:", error);
        return false;
    }
}

/**
 * Check if push notifications are supported and permission status
 */
export function getPushStatus() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return { supported: false, permission: "unsupported" };
    }

    return {
        supported: true,
        permission: Notification.permission // "granted", "denied", "default"
    };
}

// ═══════════════════════════════════════════════════════════
// BACKGROUND SYNC
// ═══════════════════════════════════════════════════════════

/**
 * Queue an action for background sync (when offline)
 */
export async function queueForSync(url, method, body, tag = "sync-offline-actions") {
    if (!("serviceWorker" in navigator)) return false;

    try {
        const registration = await navigator.serviceWorker.ready;

        // Send to SW to queue
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: "QUEUE_SYNC",
                url,
                method,
                body,
                tag
            });
        }

        // Register sync
        if ("sync" in registration) {
            await registration.sync.register(tag);
            console.log("[Sync] Queued for background sync:", tag);
            return true;
        }

        return false;
    } catch (error) {
        console.warn("[Sync] Queue failed:", error);
        return false;
    }
}

/**
 * Set up periodic background sync (check for new orders)
 */
async function setupPeriodicSync(registration) {
    if (!("periodicSync" in registration)) {
        console.log("[PeriodicSync] Not supported");
        return;
    }

    try {
        const status = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (status.state === "granted") {
            await registration.periodicSync.register("check-new-orders", {
                minInterval: 15 * 60 * 1000 // 15 minutes minimum
            });
            console.log("[PeriodicSync] Registered: check-new-orders (15min)");
        }
    } catch (error) {
        // Periodic sync not available — that's OK
        console.log("[PeriodicSync] Not available:", error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// MESSAGE LISTENER — Communication between SW and app
// ═══════════════════════════════════════════════════════════

function setupMessageListener() {
    navigator.serviceWorker.addEventListener("message", (event) => {
        const { type, url, data } = event.data || {};

        if (type === "NOTIFICATION_CLICK") {
            // Navigate to the URL from notification
            if (url && window.location.pathname !== url) {
                window.location.href = url;
            }
        }

        if (type === "SYNC_COMPLETE") {
            console.log("[SW→App] Sync complete:", data);
            // Dispatch custom event for React components to listen
            window.dispatchEvent(new CustomEvent("sw-sync-complete", { detail: data }));
        }
    });
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Development mode cleanup — unregister SW and clear caches
 */
async function cleanupDev() {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
            console.log("[SW] Unregistered (dev mode)");
        }

        if ("caches" in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log("[SW] Cache deleted (dev mode):", cacheName);
            }
        }
    } catch (err) {
        console.warn("[SW] Dev cleanup error:", err);
    }
}
