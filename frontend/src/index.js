import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tailwind.css"; // Tailwind CSS — must be first
import App from "./App";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

// ✅ Enhanced SW registration with Push + Background Sync
import { register as registerSW } from "./utils/serviceWorkerRegistration";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
        <App />
    </LocalizationProvider>
);

// ═══════════════════════════════════════════════════════════
// PWA — Service Worker Registration (Enhanced v3)
// ✅ Push Notifications
// ✅ Background Sync
// ✅ Periodic Sync
// ✅ Update detection
// ✅ Capacitor-aware (skips SW in native app)
// ═══════════════════════════════════════════════════════════
registerSW({
    onUpdate: (registration) => {
        // New version available — show update prompt
        console.log("[PWA] Yeni sürüm mevcut — güncelleme için sayfayı yenileyin");
        // Dispatch event for UpdatePrompt component
        window.dispatchEvent(new CustomEvent("sw-update-available", {
            detail: { registration }
        }));
    },
    onSuccess: (registration) => {
        console.log("[PWA] İçerik çevrimdışı kullanım için önbelleğe alındı");
    }
});
