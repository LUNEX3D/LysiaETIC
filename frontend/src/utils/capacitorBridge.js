/**
 * capacitorBridge.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════
 * Native API bridge for Capacitor (iOS/Android)
 * Falls back gracefully to web APIs when running in browser
 *
 * Usage:
 *   import { isNative, statusBar, pushNotifications, network } from "../utils/capacitorBridge";
 *   if (isNative()) { statusBar.setDark(); }
 * ═══════════════════════════════════════════════════════════
 */

// ── Platform Detection ──────────────────────────────────────

/**
 * Check if running inside Capacitor native app
 */
export function isNative() {
    return window.Capacitor?.isNativePlatform() === true;
}

/**
 * Get platform: 'ios', 'android', or 'web'
 */
export function getPlatform() {
    return window.Capacitor?.getPlatform() || "web";
}

/**
 * Check if running on iOS
 */
export function isIOS() {
    return getPlatform() === "ios";
}

/**
 * Check if running on Android
 */
export function isAndroid() {
    return getPlatform() === "android";
}

// ── Status Bar ──────────────────────────────────────────────

export const statusBar = {
    /**
     * Set dark status bar (light text on dark background)
     */
    async setDark() {
        if (!isNative()) return;
        try {
            const { StatusBar, Style } = await import("@capacitor/status-bar");
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: "#0a0e1a" });
        } catch (e) { /* not available */ }
    },

    /**
     * Set light status bar (dark text on light background)
     */
    async setLight() {
        if (!isNative()) return;
        try {
            const { StatusBar, Style } = await import("@capacitor/status-bar");
            await StatusBar.setStyle({ style: Style.Light });
            await StatusBar.setBackgroundColor({ color: "#ffffff" });
        } catch (e) { /* not available */ }
    },

    /**
     * Hide status bar (fullscreen)
     */
    async hide() {
        if (!isNative()) return;
        try {
            const { StatusBar } = await import("@capacitor/status-bar");
            await StatusBar.hide();
        } catch (e) { /* not available */ }
    },

    /**
     * Show status bar
     */
    async show() {
        if (!isNative()) return;
        try {
            const { StatusBar } = await import("@capacitor/status-bar");
            await StatusBar.show();
        } catch (e) { /* not available */ }
    }
};

// ── Splash Screen ───────────────────────────────────────────

export const splashScreen = {
    /**
     * Hide splash screen (call after app is ready)
     */
    async hide() {
        if (!isNative()) return;
        try {
            const { SplashScreen } = await import("@capacitor/splash-screen");
            await SplashScreen.hide({ fİadeOutDuration: 500 });
        } catch (e) { /* not available */ }
    },

    /**
     * Show splash screen
     */
    async show() {
        if (!isNative()) return;
        try {
            const { SplashScreen } = await import("@capacitor/splash-screen");
            await SplashScreen.show({ autoHide: false });
        } catch (e) { /* not available */ }
    }
};

// ── Push Notifications (Native) ─────────────────────────────

export const pushNotifications = {
    /**
     * Register for push notifications (native)
     * Returns the device token for APNs (iOS) or FCM (Android)
     */
    async register() {
        if (!isNative()) return null;
        try {
            const { PushNotifications } = await import("@capacitor/push-notifications");

            // Request permission
            const permResult = await PushNotifications.requestPermissions();
            if (permResult.receive !== "granted") {
                console.log("[Push Native] Permission denied");
                return null;
            }

            // Register with APNs/FCM
            await PushNotifications.register();

            return new Promise((resolve) => {
                // Listen for registration success
                PushNotifications.addListener("registration", (token) => {
                    console.log("[Push Native] Token:", token.value);
                    resolve(token.value);
                });

                // Listen for registration error
                PushNotifications.addListener("registrationError", (error) => {
                    console.error("[Push Native] Registration error:", error);
                    resolve(null);
                });

                // Timeout after 10 seconds
                setTimeout(() => resolve(null), 10000);
            });
        } catch (e) {
            console.warn("[Push Native] Not available:", e);
            return null;
        }
    },

    /**
     * Listen for incoming push notifications
     * @param {Function} callback - Called with notification data
     * @returns {Function} cleanup function to remove listener
     */
    async onReceived(callback) {
        if (!isNative()) return () => {};
        try {
            const { PushNotifications } = await import("@capacitor/push-notifications");

            // Notification received while app is in foreground
            const foregroundListener = await PushNotifications.addListener(
                "pushNotificationReceived",
                (notification) => {
                    callback({
                        type: "foreground",
                        title: notification.title,
                        body: notification.body,
                        data: notification.data
                    });
                }
            );

            // Notification tapped (app was in background)
            const tapListener = await PushNotifications.addListener(
                "pushNotificationActionPerformed",
                (action) => {
                    callback({
                        type: "tap",
                        title: action.notification.title,
                        body: action.notification.body,
                        data: action.notification.data
                    });
                }
            );

            // Return cleanup function
            return () => {
                foregroundListener.remove();
                tapListener.remove();
            };
        } catch (e) {
            return () => {};
        }
    }
};

// ── Network ─────────────────────────────────────────────────

export const network = {
    /**
     * Get current network status
     * @returns {{ connected: boolean, connectionType: string }}
     */
    async getStatus() {
        if (!isNative()) {
            return { connected: navigator.onLine, connectionType: "unknown" };
        }
        try {
            const { Network } = await import("@capacitor/network");
            return await Network.getStatus();
        } catch (e) {
            return { connected: navigator.onLine, connectionType: "unknown" };
        }
    },

    /**
     * Listen for network changes
     * @param {Function} callback - Called with { connected, connectionType }
     * @returns {Function} cleanup function
     */
    async onChange(callback) {
        if (!isNative()) {
            // Web fallback
            const onOnline = () => callback({ connected: true, connectionType: "unknown" });
            const onOffline = () => callback({ connected: false, connectionType: "none" });
            window.addEventListener("online", onOnline);
            window.addEventListener("offline", onOffline);
            return () => {
                window.removeEventListener("online", onOnline);
                window.removeEventListener("offline", onOffline);
            };
        }
        try {
            const { Network } = await import("@capacitor/network");
            const listener = await Network.addListener("networkStatusChange", callback);
            return () => listener.remove();
        } catch (e) {
            return () => {};
        }
    }
};

// ── App Lifecycle ───────────────────────────────────────────

export const appLifecycle = {
    /**
     * Listen for app state changes (foreground/background)
     * @param {Function} callback - Called with { isActive: boolean }
     * @returns {Function} cleanup function
     */
    async onStateChange(callback) {
        if (!isNative()) {
            const handler = () => callback({ isActive: !document.hidden });
            document.addEventListener("visibilitychange", handler);
            return () => document.removeEventListener("visibilitychange", handler);
        }
        try {
            const { App } = await import("@capacitor/app");
            const listener = await App.addListener("appStateChange", callback);
            return () => listener.remove();
        } catch (e) {
            return () => {};
        }
    },

    /**
     * Listen for hardware back button (Android)
     * @param {Function} callback - Called when back button pressed
     * @returns {Function} cleanup function
     */
    async onBackButton(callback) {
        if (!isNative() || !isAndroid()) return () => {};
        try {
            const { App } = await import("@capacitor/app");
            const listener = await App.addListener("backButton", callback);
            return () => listener.remove();
        } catch (e) {
            return () => {};
        }
    },

    /**
     * Open a URL in the system browser
     */
    async openExternal(url) {
        if (!isNative()) {
            window.open(url, "_blank");
            return;
        }
        try {
            await import("@capacitor/app");
            // Capacitor doesn't have openUrl on App, use Browser plugin or window
            window.open(url, "_blank");
        } catch (e) {
            window.open(url, "_blank");
        }
    }
};

// ── Camera (Product Photos) ─────────────────────────────────

export const camera = {
    /**
     * Take a photo or pick from gallery
     * @param {{ source: 'camera'|'gallery' }} options
     * @returns {{ dataUrl: string, format: string } | null}
     */
    async getPhoto(options = {}) {
        if (!isNative()) {
            // Web fallback: use file input
            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                if (options.source === "camera") {
                    input.capture = "environment";
                }
                input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) { resolve(null); return; }
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        dataUrl: reader.result,
                        format: file.type
                    });
                    reader.readAsDataURL(file);
                };
                input.click();
            });
        }
        try {
            const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
            const photo = await Camera.getPhoto({
                quality: 85,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: options.source === "camera" ? CameraSource.Camera : CameraSource.Photos,
                width: 1200,
                height: 1200,
                correctOrientation: true
            });
            return {
                dataUrl: photo.dataUrl,
                format: photo.format
            };
        } catch (e) {
            console.warn("[Camera] Error:", e);
            return null;
        }
    }
};

// ── Haptic Feedback ─────────────────────────────────────────

export const haptics = {
    /**
     * Light haptic feedback (button tap)
     */
    async light() {
        if (!isNative()) return;
        try {
            if (navigator.vibrate) navigator.vibrate(10);
        } catch (e) { /* not available */ }
    },

    /**
     * Medium haptic feedback (action complete)
     */
    async medium() {
        if (!isNative()) return;
        try {
            if (navigator.vibrate) navigator.vibrate(25);
        } catch (e) { /* not available */ }
    },

    /**
     * Heavy haptic feedback (error/warning)
     */
    async heavy() {
        if (!isNative()) return;
        try {
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        } catch (e) { /* not available */ }
    }
};
