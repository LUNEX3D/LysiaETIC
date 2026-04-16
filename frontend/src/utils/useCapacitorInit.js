/**
 * useCapacitorInit.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════
 * React hook that initializes Capacitor native features
 * Call once in App.js — handles:
 *   ✅ Status bar styling
 *   ✅ Splash screen hide
 *   ✅ Push notification registration
 *   ✅ Android back button handling
 *   ✅ App state change (foreground/background)
 *   ✅ Network monitoring
 * ═══════════════════════════════════════════════════════════
 */

import { useEffect, useRef } from "react";
import {
    isNative,
    getPlatform,
    statusBar,
    splashScreen,
    pushNotifications,
    appLifecycle,
    network
} from "./capacitorBridge";

const useCapacitorInit = (navigate) => {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        if (!isNative()) {
            console.log("[Capacitor] Running in web browser — native features disabled");
            return;
        }

        const platform = getPlatform();
        console.log(`[Capacitor] Initializing native features — platform: ${platform}`);

        const cleanups = [];

        const init = async () => {
            // ── 1. Status Bar ──
            await statusBar.setDark();

            // ── 2. Splash Screen — hide after app is ready ──
            // Small delay to ensure React has rendered
            setTimeout(async () => {
                await splashScreen.hide();
            }, 500);

            // ── 3. Push Notifications ──
            try {
                const token = await pushNotifications.register();
                if (token) {
                    // Send token to backend
                    const authToken = localStorage.getItem("token");
                    if (authToken) {
                        try {
                            await fetch("/api/notifications/register-device", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${authToken}`
                                },
                                body: JSON.stringify({
                                    token,
                                    platform,
                                    deviceId: `${platform}-${Date.now()}`
                                })
                            });
                            console.log("[Capacitor] Device token sent to server");
                        } catch (err) {
                            console.warn("[Capacitor] Failed to send device token:", err);
                        }
                    }
                }

                // Listen for incoming notifications
                const cleanupPush = await pushNotifications.onReceived((notification) => {
                    console.log("[Capacitor] Push received:", notification);

                    if (notification.type === "tap" && notification.data?.url) {
                        // User tapped notification — navigate to URL
                        if (navigate) {
                            navigate(notification.data.url);
                        } else {
                            window.location.href = notification.data.url;
                        }
                    }
                });
                cleanups.push(cleanupPush);
            } catch (err) {
                console.warn("[Capacitor] Push setup error:", err);
            }

            // ── 4. Android Back Button ──
            const cleanupBack = await appLifecycle.onBackButton(({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    // At root — confirm exit
                    // On Android, this will minimize the app
                    import("@capacitor/app").then(({ App }) => {
                        App.minimizeApp();
                    }).catch(() => {});
                }
            });
            cleanups.push(cleanupBack);

            // ── 5. App State Change ──
            const cleanupState = await appLifecycle.onStateChange(({ isActive }) => {
                if (isActive) {
                    console.log("[Capacitor] App resumed (foreground)");
                    // Refresh data when app comes back to foreground
                    window.dispatchEvent(new CustomEvent("app-resumed"));
                } else {
                    console.log("[Capacitor] App paused (background)");
                }
            });
            cleanups.push(cleanupState);

            // ── 6. Network Monitoring ──
            const cleanupNetwork = await network.onChange((status) => {
                console.log("[Capacitor] Network changed:", status);
                window.dispatchEvent(new CustomEvent("network-change", {
                    detail: status
                }));
            });
            cleanups.push(cleanupNetwork);
        };

        init().catch((err) => {
            console.error("[Capacitor] Init error:", err);
        });

        // Cleanup on unmount
        return () => {
            cleanups.forEach((cleanup) => {
                if (typeof cleanup === "function") cleanup();
            });
        };
    }, [navigate]);
};

export default useCapacitorInit;
