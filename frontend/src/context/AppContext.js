import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   DİL SÖZLÜĞÜ
   ═══════════════════════════════════════════════════════════ */
const translations = {
    tr: {
        // Sidebar
        "sidebar.home": "Ana Sayfa",
        "sidebar.marketplace": "Pazaryeri",
        "sidebar.integrations": "Entegrasyonlar",
        "sidebar.orders": "Sipariş Yönetimi",
        "sidebar.inventory": "Stok Yönetimi",
        "sidebar.shipping": "Kargo Yönetimi",
        "sidebar.finance": "Finans Yönetimi",
        "sidebar.productMgmt": "Ürün Yönetimi",
        "sidebar.productCenter": "Ürün Merkezi",
        "sidebar.categoryMapping": "Kategori Eşleştirme",
        "sidebar.analytics": "Analiz & AI",
        "sidebar.advancedAnalytics": "Gelişmiş Analiz",
        "sidebar.aiAssistant": "AI Asistan",
        "sidebar.roketfy": "LysiaRadar",
        "sidebar.management": "Yönetim",
        "sidebar.userMgmt": "Kullanıcı Yönetimi",
        "sidebar.billing": "Faturalandırma",
        "sidebar.settings": "Ayarlar",
        "sidebar.adminPanel": "Admin Paneli",
        "sidebar.logout": "Oturumu Kapat",
        "sidebar.logoutConfirm": "Oturumu kapatmak istediğinize emin misiniz?",

        // Dashboard
        "dashboard.greeting.morning": "Günaydın",
        "dashboard.greeting.afternoon": "İyi Günler",
        "dashboard.greeting.evening": "İyi Akşamlar",
        "dashboard.greeting.night": "İyi Geceler",
        "dashboard.totalOrders": "Toplam Sipariş",
        "dashboard.totalRevenue": "Toplam Ciro",
        "dashboard.productCount": "Ürün Sayısı",
        "dashboard.lowStock": "Düşük Stok",
        "dashboard.weeklyOrders": "7 Günlük Sipariş",
        "dashboard.delivered": "Teslim Edilen",
        "dashboard.new": "yeni",
        "dashboard.processing": "işlemde",
        "dashboard.shipping": "kargoda",
        "dashboard.cancel": "iptal",
        "dashboard.return": "iade",
        "dashboard.active": "Aktif",
        "dashboard.passive": "Pasif",
        "dashboard.outOfStock": "stok tükendi",
        "dashboard.avgBasket": "Ort. sepet",
        "dashboard.activeChannels": "Aktif Kanal",
        "dashboard.errors": "Hata",
        "dashboard.pendingSync": "Bekleyen Senk.",
        "dashboard.stockMismatch": "Stok Uyumsuz",
        "dashboard.lastUpdate": "Son Güncelleme",
        "dashboard.recentOrders": "Son Siparişler",
        "dashboard.viewAll": "Tümü →",
        "dashboard.noOrders": "Henüz sipariş yok",
        "dashboard.alerts": "Uyarılar & Bildirimler",
        "dashboard.noAlerts": "Aktif uyarı yok",
        "dashboard.channelRevenue": "Kanal Bazlı Gelir",
        "dashboard.quickActions": "Hızlı İşlemler",
        "dashboard.operationLogs": "Operasyon Logları",
        "dashboard.noLogs": "Henüz işlem kaydı yok",

        // Settings
        "settings.title": "Ayarlar",
        "settings.subtitle": "Uygulama tercihlerinizi ve hesap ayarlarınızı yönetin",
        "settings.appearance": "Görünüm",
        "settings.theme": "Tema",
        "settings.themeDesc": "Arayüz temasını seçin",
        "settings.dark": "Koyu",
        "settings.light": "Açık",
        "settings.system": "Sistem",
        "settings.language": "Dil",
        "settings.languageDesc": "Arayüz dilini seçin",
        "settings.turkish": "Türkçe",
        "settings.english": "English",
        "settings.notifications": "Bildirimler",
        "settings.notifDesc": "Bildirim tercihlerinizi yönetin",
        "settings.orderNotif": "Sipariş Bildirimleri",
        "settings.orderNotifDesc": "Yeni sipariş geldiğinde bildirim al",
        "settings.stockNotif": "Stok Bildirimleri",
        "settings.stockNotifDesc": "Düşük stok uyarılarını al",
        "settings.soundNotif": "Ses Bildirimleri",
        "settings.soundNotifDesc": "Bildirim geldiğinde ses çal",
        "settings.emailNotif": "E-posta Bildirimleri",
        "settings.emailNotifDesc": "Önemli güncellemeleri e-posta ile al",
        "settings.account": "Hesap",
        "settings.accountDesc": "Hesap bilgilerinizi yönetin",
        "settings.name": "Ad Soyad",
        "settings.email": "E-posta",
        "settings.phone": "Telefon",
        "settings.company": "Şirket",
        "settings.save": "Kaydet",
        "settings.saved": "Kaydedildi!",
        "settings.saving": "Kaydediliyor...",
        "settings.security": "Güvenlik",
        "settings.securityDesc": "Şifre ve güvenlik ayarlarınızı yönetin",
        "settings.currentPassword": "Mevcut Şifre",
        "settings.newPassword": "Yeni Şifre",
        "settings.confirmPassword": "Şifre Tekrar",
        "settings.changePassword": "Şifreyi Değiştir",
        "settings.dangerZone": "Tehlikeli Bölge",
        "settings.deleteAccount": "Hesabı Sil",
        "settings.deleteAccountDesc": "Bu işlem geri alınamaz. Tüm verileriniz silinecektir.",
        "settings.subscription": "Abonelik",
        "settings.plan": "Plan",
        "settings.planFree": "Ücretsiz",
        "settings.planBasic": "Temel",
        "settings.planPro": "Profesyonel",
        "settings.planEnterprise": "Kurumsal",

        // Admin
        "admin.title": "Admin Paneli",
        "admin.subtitle": "Sistem yönetimi ve kullanıcı kontrolü",
        "admin.users": "Kullanıcılar",
        "admin.system": "Sistem Durumu",
        "admin.logs": "Sistem Logları",
        "admin.settings": "Sistem Ayarları",
        "admin.totalUsers": "Toplam Kullanıcı",
        "admin.activeToday": "Bugün Aktif",
        "admin.totalIntegrations": "Toplam Entegrasyon",
        "admin.serverUptime": "Sunucu Uptime",
        "admin.search": "Kullanıcı ara...",
        "admin.allRoles": "Tüm Roller",
        "admin.role": "Rol",
        "admin.registered": "Kayıt Tarihi",
        "admin.actions": "İşlemler",
        "admin.edit": "Düzenle",
        "admin.delete": "Sil",
        "admin.impersonate": "Panele Gir",
        "admin.cpu": "CPU Kullanımı",
        "admin.memory": "Bellek Kullanımı",
        "admin.database": "Veritabanı",
        "admin.connected": "Bağlı",
        "admin.disconnected": "Bağlantı Yok",
        "admin.nodeVersion": "Node.js",
        "admin.platform": "Platform",
        "admin.hostname": "Sunucu Adı",
        "admin.noLogs": "Log kaydı bulunamadı",

        // Common
        "common.loading": "Yükleniyor...",
        "common.error": "Hata oluştu",
        "common.retry": "Tekrar Dene",
        "common.cancel": "İptal",
        "common.confirm": "Onayla",
        "common.close": "Kapat",
        "common.yes": "Evet",
        "common.no": "Hayır",
    },
    en: {
        // Sidebar
        "sidebar.home": "Home",
        "sidebar.marketplace": "Marketplace",
        "sidebar.integrations": "Integrations",
        "sidebar.orders": "Order Management",
        "sidebar.inventory": "Inventory",
        "sidebar.shipping": "Shipping",
        "sidebar.finance": "Finance",
        "sidebar.productMgmt": "Product Management",
        "sidebar.productCenter": "Product Center",
        "sidebar.categoryMapping": "Category Mapping",
        "sidebar.analytics": "Analytics & AI",
        "sidebar.advancedAnalytics": "Advanced Analytics",
        "sidebar.aiAssistant": "AI Assistant",
        "sidebar.roketfy": "LysiaRadar",
        "sidebar.management": "Management",
        "sidebar.userMgmt": "User Management",
        "sidebar.billing": "Billing",
        "sidebar.settings": "Settings",
        "sidebar.adminPanel": "Admin Panel",
        "sidebar.logout": "Sign Out",
        "sidebar.logoutConfirm": "Are you sure you want to sign out?",

        // Dashboard
        "dashboard.greeting.morning": "Good Morning",
        "dashboard.greeting.afternoon": "Good Afternoon",
        "dashboard.greeting.evening": "Good Evening",
        "dashboard.greeting.night": "Good Night",
        "dashboard.totalOrders": "Total Orders",
        "dashboard.totalRevenue": "Total Revenue",
        "dashboard.productCount": "Products",
        "dashboard.lowStock": "Low Stock",
        "dashboard.weeklyOrders": "7-Day Orders",
        "dashboard.delivered": "Delivered",
        "dashboard.new": "new",
        "dashboard.processing": "processing",
        "dashboard.shipping": "shipping",
        "dashboard.cancel": "cancelled",
        "dashboard.return": "returned",
        "dashboard.active": "Active",
        "dashboard.passive": "Passive",
        "dashboard.outOfStock": "out of stock",
        "dashboard.avgBasket": "Avg. basket",
        "dashboard.activeChannels": "Active Channels",
        "dashboard.errors": "Errors",
        "dashboard.pendingSync": "Pending Sync",
        "dashboard.stockMismatch": "Stock Mismatch",
        "dashboard.lastUpdate": "Last Update",
        "dashboard.recentOrders": "Recent Orders",
        "dashboard.viewAll": "View All →",
        "dashboard.noOrders": "No orders yet",
        "dashboard.alerts": "Alerts & Notifications",
        "dashboard.noAlerts": "No active alerts",
        "dashboard.channelRevenue": "Channel Revenue",
        "dashboard.quickActions": "Quick Actions",
        "dashboard.operationLogs": "Operation Logs",
        "dashboard.noLogs": "No operation logs yet",

        // Settings
        "settings.title": "Settings",
        "settings.subtitle": "Manage your app preferences and account settings",
        "settings.appearance": "Appearance",
        "settings.theme": "Theme",
        "settings.themeDesc": "Choose your interface theme",
        "settings.dark": "Dark",
        "settings.light": "Light",
        "settings.system": "System",
        "settings.language": "Language",
        "settings.languageDesc": "Choose your interface language",
        "settings.turkish": "Türkçe",
        "settings.english": "English",
        "settings.notifications": "Notifications",
        "settings.notifDesc": "Manage your notification preferences",
        "settings.orderNotif": "Order Notifications",
        "settings.orderNotifDesc": "Get notified when a new order arrives",
        "settings.stockNotif": "Stock Notifications",
        "settings.stockNotifDesc": "Get low stock alerts",
        "settings.soundNotif": "Sound Notifications",
        "settings.soundNotifDesc": "Play sound on new notifications",
        "settings.emailNotif": "Email Notifications",
        "settings.emailNotifDesc": "Receive important updates via email",
        "settings.account": "Account",
        "settings.accountDesc": "Manage your account information",
        "settings.name": "Full Name",
        "settings.email": "Email",
        "settings.phone": "Phone",
        "settings.company": "Company",
        "settings.save": "Save",
        "settings.saved": "Saved!",
        "settings.saving": "Saving...",
        "settings.security": "Security",
        "settings.securityDesc": "Manage your password and security settings",
        "settings.currentPassword": "Current Password",
        "settings.newPassword": "New Password",
        "settings.confirmPassword": "Confirm Password",
        "settings.changePassword": "Change Password",
        "settings.dangerZone": "Danger Zone",
        "settings.deleteAccount": "Delete Account",
        "settings.deleteAccountDesc": "This action cannot be undone. All your data will be permanently deleted.",
        "settings.subscription": "Subscription",
        "settings.plan": "Plan",
        "settings.planFree": "Free",
        "settings.planBasic": "Basic",
        "settings.planPro": "Professional",
        "settings.planEnterprise": "Enterprise",

        // Admin
        "admin.title": "Admin Panel",
        "admin.subtitle": "System management and user control",
        "admin.users": "Users",
        "admin.system": "System Status",
        "admin.logs": "System Logs",
        "admin.settings": "System Settings",
        "admin.totalUsers": "Total Users",
        "admin.activeToday": "Active Today",
        "admin.totalIntegrations": "Total Integrations",
        "admin.serverUptime": "Server Uptime",
        "admin.search": "Search users...",
        "admin.allRoles": "All Roles",
        "admin.role": "Role",
        "admin.registered": "Registered",
        "admin.actions": "Actions",
        "admin.edit": "Edit",
        "admin.delete": "Delete",
        "admin.impersonate": "Enter Panel",
        "admin.cpu": "CPU Usage",
        "admin.memory": "Memory Usage",
        "admin.database": "Database",
        "admin.connected": "Connected",
        "admin.disconnected": "Disconnected",
        "admin.nodeVersion": "Node.js",
        "admin.platform": "Platform",
        "admin.hostname": "Hostname",
        "admin.noLogs": "No logs found",

        // Common
        "common.loading": "Loading...",
        "common.error": "An error occurred",
        "common.retry": "Retry",
        "common.cancel": "Cancel",
        "common.confirm": "Confirm",
        "common.close": "Close",
        "common.yes": "Yes",
        "common.no": "No",
    }
};

/* ═══════════════════════════════════════════════════════════
   TEMA PALETLERİ
   ═══════════════════════════════════════════════════════════ */
const themes = {
    dark: {
        bg: "#0f1419",
        card: "rgba(26, 31, 53, 0.85)",
        border: "rgba(78, 205, 196, 0.18)",
        accent: "#4ecdc4",
        green: "#22c55e",
        red: "#ef4444",
        yellow: "#f59e0b",
        purple: "#8b5cf6",
        blue: "#06b6d4",
        pink: "#ec4899",
        text: "#e2e8f0",
        muted: "#94a3b8",
        dim: "#64748b",
        glass: "rgba(255,255,255,0.03)",
        glassBr: "rgba(255,255,255,0.06)",
        sidebarBg: "rgba(10, 13, 24, 0.97)",
        contentBg: "rgba(14, 18, 30, 0.9)",
        particleBg: "#0a0e1a",
        inputBg: "rgba(255,255,255,0.05)",
        inputBorder: "rgba(255,255,255,0.06)",
        hoverBg: "rgba(255,255,255,0.06)",
    },
    light: {
        bg: "#f0f2f5",
        card: "rgba(255, 255, 255, 0.92)",
        border: "rgba(78, 205, 196, 0.25)",
        accent: "#0d9488",
        green: "#16a34a",
        red: "#dc2626",
        yellow: "#d97706",
        purple: "#7c3aed",
        blue: "#0891b2",
        pink: "#db2777",
        text: "#1e293b",
        muted: "#64748b",
        dim: "#94a3b8",
        glass: "rgba(0,0,0,0.02)",
        glassBr: "rgba(0,0,0,0.08)",
        sidebarBg: "rgba(255, 255, 255, 0.97)",
        contentBg: "rgba(240, 242, 245, 0.95)",
        particleBg: "#e8ecf1",
        inputBg: "rgba(0,0,0,0.04)",
        inputBorder: "rgba(0,0,0,0.1)",
        hoverBg: "rgba(0,0,0,0.04)",
    }
};

/* ═══════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════ */
const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // Tema
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem("themeMode") || "dark");
    const [systemTheme, setSystemTheme] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );

    // Dil
    const [language, setLanguageState] = useState(() => localStorage.getItem("language") || "tr");

    // Sistem teması dinle
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e) => setSystemTheme(e.matches ? "dark" : "light");
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // Aktif tema hesapla
    const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;
    const theme = themes[resolvedTheme] || themes.dark;

    // Tema değiştir
    const setTheme = useCallback((mode) => {
        setThemeMode(mode);
        localStorage.setItem("themeMode", mode);
    }, []);

    // Dil değiştir
    const setLanguage = useCallback((lang) => {
        setLanguageState(lang);
        localStorage.setItem("language", lang);
    }, []);

    // Çeviri fonksiyonu
    const t = useCallback((key) => {
        return translations[language]?.[key] || translations.tr[key] || key;
    }, [language]);

    // CSS değişkenlerini uygula
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-theme", resolvedTheme);

        // Sidebar ve content area renkleri CSS'e yansıt
        root.style.setProperty("--app-sidebar-bg", theme.sidebarBg);
        root.style.setProperty("--app-content-bg", theme.contentBg);
        root.style.setProperty("--app-text", theme.text);
        root.style.setProperty("--app-muted", theme.muted);
        root.style.setProperty("--app-accent", theme.accent);
        root.style.setProperty("--app-border", theme.border);
        root.style.setProperty("--app-glass", theme.glass);
        root.style.setProperty("--app-glassBr", theme.glassBr);
        root.style.setProperty("--app-hover-bg", theme.hoverBg);
        root.style.setProperty("--app-input-bg", theme.inputBg);
        root.style.setProperty("--app-input-border", theme.inputBorder);
        root.style.setProperty("--app-particle-bg", theme.particleBg);
    }, [resolvedTheme, theme]);

    return (
        <AppContext.Provider value={{
            // Tema
            themeMode,
            resolvedTheme,
            theme,
            setTheme,
            themes,

            // Dil
            language,
            setLanguage,
            t,

            // Çeviri sözlüğü (direkt erişim)
            translations,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used within AppProvider");
    return ctx;
};

export default AppContext;
