import React, { useState, useEffect } from "react";
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from "../utils/serviceWorkerRegistration";

/**
 * NotificationSettings — Push notification toggle for user settings
 * Can be embedded in UserDashboard or Settings page
 */
const NotificationSettings = () => {
    const [pushStatus, setPushStatus] = useState({ supported: false, permission: "default" });
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const status = getPushStatus();
        setPushStatus(status);

        // Check if already subscribed
        if (status.permission === "granted") {
            checkSubscription();
        }
    }, []);

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        } catch (err) {
            console.warn("[Push] Check subscription error:", err);
        }
    };

    const handleToggle = async () => {
        setLoading(true);
        try {
            if (isSubscribed) {
                // Unsubscribe
                const success = await unsubscribeFromPush();
                if (success) {
                    setIsSubscribed(false);
                    setPushStatus({ ...pushStatus, permission: "default" });
                }
            } else {
                // Subscribe
                const subscription = await subscribeToPush();
                if (subscription) {
                    setIsSubscribed(true);
                    setPushStatus({ ...pushStatus, permission: "granted" });
                } else {
                    // Permission denied or error
                    const newStatus = getPushStatus();
                    setPushStatus(newStatus);
                }
            }
        } catch (err) {
            console.error("[Push] Toggle error:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!pushStatus.supported) {
        return (
            <div style={{
                padding: "16px",
                background: "rgba(255,193,7,0.1)",
                border: "1px solid rgba(255,193,7,0.3)",
                borderRadius: 12,
                color: "#f59e0b",
                fontSize: "0.9rem"
            }}>
                ⚠️ Tarayıcınız push bildirimleri desteklemiyor
            </div>
        );
    }

    if (pushStatus.permission === "denied") {
        return (
            <div style={{
                padding: "16px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12,
                color: "#ef4444",
                fontSize: "0.9rem"
            }}>
                🚫 Bildirim izni reddedildi. Tarayıcı ayarlarından izin verebilirsiniz.
            </div>
        );
    }

    return (
        <div style={{
            padding: "20px",
            background: "rgba(15,118,110,0.05)",
            border: "1px solid rgba(15,118,110,0.2)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16
        }}>
            <div style={{ flex: 1 }}>
                <div style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "#0f766e",
                    marginBottom: 4
                }}>
                    🔔 Push Bildirimleri
                </div>
                <div style={{
                    fontSize: "0.85rem",
                    color: "#64748b",
                    lineHeight: 1.5
                }}>
                    {isSubscribed
                        ? "Yeni siparişler, stok uyarıları ve önemli güncellemeler için bildirim alıyorsunuz"
                        : "Önemli güncellemelerden haberdar olmak için bildirimleri etkinleştirin"}
                </div>
            </div>
            <button
                onClick={handleToggle}
                disabled={loading}
                style={{
                    background: isSubscribed
                        ? "linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)"
                        : "rgba(100,116,139,0.1)",
                    color: isSubscribed ? "#fff" : "#64748b",
                    border: isSubscribed ? "none" : "1px solid rgba(100,116,139,0.3)",
                    padding: "10px 24px",
                    borderRadius: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    minHeight: 44,
                    minWidth: 120,
                    opacity: loading ? 0.6 : 1,
                    transition: "all 0.3s ease"
                }}
            >
                {loading ? "..." : isSubscribed ? "Aktif ✓" : "Etkinleştir"}
            </button>
        </div>
    );
};

export default NotificationSettings;
