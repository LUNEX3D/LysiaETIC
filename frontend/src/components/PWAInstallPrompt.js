import React, { useState, useEffect } from "react";

/**
 * PWA Install Prompt — Kullanıcıya uygulamayı ana ekrana ekleme teklifi sunar.
 * Ayrıca çevrimiçi/çevrimdışı durumunu gösterir.
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOnlineStatus, setShowOnlineStatus] = useState(false);

    useEffect(() => {
        // PWA Install Prompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Daha önce kapatılmış mı kontrol et
            const dismissed = localStorage.getItem("pwa-install-dismissed");
            if (!dismissed) {
                // 3 saniye sonra göster
                setTimeout(() => setShowBanner(true), 3000);
            }
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // Standalone modda çalışıyorsa body'ye class ekle
        if (
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone
        ) {
            document.body.classList.add("pwa-standalone");
        }

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
        };
    }, []);

    // Network status listener
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowOnlineStatus(true);
            setTimeout(() => setShowOnlineStatus(false), 4000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowOnlineStatus(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            console.log("[PWA] Kullanıcı yüklemeyi kabul etti");
        }

        setDeferredPrompt(null);
        setShowBanner(false);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem("pwa-install-dismissed", "true");
    };

    return (
        <>
            {/* Network Status Indicator */}
            {showOnlineStatus && (
                <div className={`network-status ${isOnline ? "online" : "offline"}`}>
                    {isOnline
                        ? "✅ İnternet bağlantısı yeniden sağlandı"
                        : "⚠️ İnternet bağlantısı kesildi — Çevrimdışı moddasınız"}
                </div>
            )}

            {/* PWA Install Banner */}
            {showBanner && (
                <div className="pwa-install-banner">
                    <div className="pwa-install-banner-text">
                        <strong>📱 LysiaETIC&apos;i Yükleyin</strong>
                        <span>
                            Ana ekranınıza ekleyerek daha hızlı erişim sağlayın
                        </span>
                    </div>
                    <button className="pwa-install-btn" onClick={handleInstall}>
                        Yükle
                    </button>
                    <button className="pwa-dismiss-btn" onClick={handleDismiss}>
                        Şimdi Değil
                    </button>
                </div>
            )}
        </>
    );
};

export default PWAInstallPrompt;
