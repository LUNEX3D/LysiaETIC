import "./styles/tailwind.css"; // Tailwind CSS — must be first
import "./styles/designSystem/lysiaDesignSystem.css";
import "./styles/websiteBuilder/premiumSections.css";
import "./styles/websiteBuilder/wbPremiumUI.css";
import "./styles/storeBuilder/storeBuilderV5.css";
import "./styles/ecommercePlatform.css";
import "./styles/ikas/ikasThemeSystem.css";
import "./styles/ecEditorPro.css";
import "./styles/ecThemeEditorV6.css";
import "./styles/pageHelp.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import App from "./App";
import { initClientProtection } from "./utils/clientProtection";
import { register as registerSW } from "./utils/serviceWorkerRegistration";
import { suppressWalletExtensionErrors } from "./utils/suppressWalletExtensionErrors";

suppressWalletExtensionErrors();
initClientProtection();

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
