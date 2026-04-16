import React, { useState, useEffect } from "react";

/**
 * UpdatePrompt — Shows a banner when a new version of the app is available
 * Listens for 'sw-update-available' event from service worker registration
 */
const UpdatePrompt = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [registration, setRegistration] = useState(null);

    useEffect(() => {
        const handleUpdate = (event) => {
            setRegistration(event.detail?.registration);
            setShowUpdate(true);
        };

        window.addEventListener("sw-update-available", handleUpdate);
        return () => window.removeEventListener("sw-update-available", handleUpdate);
    }, []);

    const handleRefresh = () => {
        if (registration?.waiting) {
            // Tell the waiting SW to take over
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        // Reload the page to get the new version
        window.location.reload();
    };

    const handleDismiss = () => {
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99999,
            background: "linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)",
            color: "#fff",
            padding: "14px 24px",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            maxWidth: "calc(100vw - 32px)",
            width: "auto",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9rem",
            backdropFilter: "blur(10px)",
            animation: "slideUp 0.4s ease-out"
        }}>
            <span style={{ fontSize: "1.3em" }}>🔄</span>
            <span style={{ flex: 1 }}>
                <strong>Yeni sürüm mevcut!</strong>
                <br />
                <span style={{ opacity: 0.9, fontSize: "0.85em" }}>
                    Güncellemek için yenileyin
                </span>
            </span>
            <button
                onClick={handleRefresh}
                style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    padding: "8px 18px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                    minHeight: 40,
                    minWidth: 44
                }}
            >
                Güncelle
            </button>
            <button
                onClick={handleDismiss}
                style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.7)",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    padding: "4px 8px",
                    minHeight: 40,
                    minWidth: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
                aria-label="Kapat"
            >
                ✕
            </button>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default UpdatePrompt;
