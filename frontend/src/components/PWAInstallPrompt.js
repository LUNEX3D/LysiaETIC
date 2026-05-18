import React, { useState, useEffect, useCallback } from "react";

/**
 * PWA Install Prompt - Cross-platform install support
 * Android/Chrome: Native beforeinstallprompt
 * iOS Safari: Manual instructions (Share -> Add to Home Screen)
 *  Network status indicator (online/offline)
 */
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOnlineStatus, setShowOnlineStatus] = useState(false);

    // Detect iOS Safari
    const isIOS = useCallback(() => {
        const ua = window.navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }, []);

    const isInStandaloneMode = useCallback(() => {
        return window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;
    }, []);

    const isSafari = useCallback(() => {
        const ua = window.navigator.userAgent;
        return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
    }, []);

    useEffect(() => {
        // Chrome/Android: Native install prompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            const dismissed = localStorage.getItem("pwa-install-dismissed");
            const dismissedAt = localStorage.getItem("pwa-install-dismissed-at");

            // Re-show after 7 days if previously dismissed
            if (dismissed && dismissedAt) {
                const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
                if (daysSince < 7) return;
                localStorage.removeItem("pwa-install-dismissed");
            }

            if (!dismissed) {
                setTimeout(() => setShowBanner(true), 3000);
            }
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // iOS Safari: Show manual instructions
        if (isIOS() && isSafari() && !isInStandaloneMode()) {
            const iosDismissed = localStorage.getItem("pwa-ios-dismissed");
            const iosDismissedAt = localStorage.getItem("pwa-ios-dismissed-at");

            let shouldShow = !iosDismissed;
            if (iosDismissed && iosDismissedAt) {
                const daysSince = (Date.now() - parseInt(iosDismissedAt, 10)) / (1000 * 60 * 60 * 24);
                if (daysSince >= 14) {
                    shouldShow = true;
                    localStorage.removeItem("pwa-ios-dismissed");
                }
            }

            if (shouldShow) {
                setTimeout(() => setShowIOSInstructions(true), 5000);
            }
        }

        // Standalone modda çalışıyorsa body'ye class ekle
        if (isInStandaloneMode()) {
            document.body.classList.add("pwa-standalone");
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, [isIOS, isSafari, isInStandaloneMode]);

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
        await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        setShowBanner(false);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem("pwa-install-dismissed", "true");
        localStorage.setItem("pwa-install-dismissed-at", Date.now().toString());
    };

    const handleIOSDismiss = () => {
        setShowIOSInstructions(false);
        localStorage.setItem("pwa-ios-dismissed", "true");
        localStorage.setItem("pwa-ios-dismissed-at", Date.now().toString());
    };

    return (
        <>
            {/* Network Status Indicator */}
            {showOnlineStatus && (
                <div className={`network-status ${isOnline ? "online" : "offline"}`}>
                    {isOnline
                        ? "İnternet bağlantısı yeniden sağlandı"
                        : "İnternet bağlantısı kesildi - çevrimdışı moddasınız"}
                </div>
            )}

            {/* Chrome/Android: Native PWA Install Banner */}
            {showBanner && (
                <div className="pwa-install-banner">
                    <div className="pwa-install-banner-text">
                        <strong>PazarYonet&apos;i Yükleyin</strong>
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

            {/* iOS Safari: Manual install instructions */}
            {showIOSInstructions && (
                <div className="pwa-ios-instructions">
                    <div className="pwa-ios-instructions-title">
                        PazarYonet&apos;i Ana Ekrana Ekleyin
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">1</span>
                        <span>
                            Alt menüdeki{" "}
                            <strong style={{ fontSize: "1.1em" }}>Paylaş</strong> butonuna dokunun
                        </span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">2</span>
                        <span>
                            <strong>&quot;Ana Ekrana Ekle&quot;</strong> seçeneğini bulun
                        </span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">3</span>
                        <span>
                            Sağ üstteki <strong>&quot;Ekle&quot;</strong> butonuna dokunun
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                            className="pwa-dismiss-btn"
                            onClick={handleIOSDismiss}
                            style={{ flex: 1, textAlign: "center" }}
                        >
                            Anladım
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default PWAInstallPrompt;

