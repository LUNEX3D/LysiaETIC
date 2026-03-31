import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tailwind.css"; // Tailwind CSS — must be first
import App from "./App";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
        <App />
    </LocalizationProvider>
);

// ═══════════════════════════════════════════════════════════
// PWA — Service Worker Registration
// ⚠️ Local geliştirmede devre dışı, sadece production'da aktif
// ═══════════════════════════════════════════════════════════
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then((registration) => {
                console.log("[PWA] Service Worker registered:", registration.scope);
            })
            .catch((error) => {
                console.log("[PWA] Service Worker registration failed:", error);
            });
    });
} else if ("serviceWorker" in navigator && process.env.NODE_ENV !== "production") {
    // ⚠️ Development modunda: Eski service worker'ları ve TÜM cache'leri temizle
    // Bu, service worker'ın SPA routing'i bozmasını engeller.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
            registration.unregister();
            console.log("[PWA] Service Worker unregistered (dev mode)");
        });
    });
    // Eski cache'leri de temizle
    if ("caches" in window) {
        caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
                caches.delete(cacheName);
                console.log("[PWA] Cache deleted (dev mode):", cacheName);
            });
        });
    }
}
