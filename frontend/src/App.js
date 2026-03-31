/**
 * App.js
 *
 * Uygulamanın ana componentidir. Tüm sayfaları, routing ve genel tema yönetimini içerir.
 * Yeni Finans modülümüz /finance altında, tek sayfada (FinancePage) ile entegre edilmiştir.
 */

import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, Container, ThemeProvider, createTheme } from "@mui/material";
import { AppProvider } from "./context/AppContext";

// PWA & Responsive
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import "./styles/responsive.css";

// Sayfalar
import HomePage from "./pages/HomePage";
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";
import UserDashboard from "./pages/UserDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminProducts from "./pages/AdminProducts";
import AdminOrders from "./pages/AdminOrders";
import AdminServers from "./pages/AdminServers";
import AdminUserAccess from "./pages/AdminUserAccess";
import MarketplaceIntegration from "./pages/MarketplaceIntegration";
import ProductWizard from "./components/ProductWizard";
import CategoryMappingPage from "./pages/CategoryMappingPage";

// SaaS Admin Panel Sayfaları
import SaasTenants from "./pages/SaasTenants";
import SaasSubscriptions from "./pages/SaasSubscriptions";
import SaasPayments from "./pages/SaasPayments";
import SaasIntegrations from "./pages/SaasIntegrations";
import SaasUsage from "./pages/SaasUsage";
import SaasReports from "./pages/SaasReports";
import SaasAnnouncements from "./pages/SaasAnnouncements";
import SaasTickets from "./pages/SaasTickets";
import SaasAuditLogs from "./pages/SaasAuditLogs";
import SaasSystemConfig from "./pages/SaasSystemConfig";

// Modern Finans Paneli
import FinancePage from "./pages/FinancePage";

// Ürün Yönetimi — V3: Otomatik sync, karşılaştırma matrisi, toplu dağıtım
import ProductManagementPage from "./pages/ProductManagementPageV3";

// Yeni Ürün Yükleme & Fiyat Eşitleme
import ProductUploadPage from "./pages/ProductUploadPage";
import PriceSyncPage from "./pages/PriceSyncPage";

// Email Doğrulama
import VerifyEmail from "./pages/VerifyEmail";

// Tema ayarları
const theme = createTheme({
    palette: {
        primary: {
            main: "#0f766e"
        },
        secondary: {
            main: "#0ea5e9"
        }
    },
    typography: {
        fontFamily: "Space Grotesk, Inter, sans-serif"
    }
});

const AppContent = () => {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");
    const isAuthRoute = ["/" , "/login", "/register", "/verify-email", "/forgot-password"].includes(location.pathname);

    const routes = (
        <Routes>
            {/* Auth Sayfaları — Direkt login ekranı karşılar */}
            <Route path="/" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Kullanıcı Paneli */}
            <Route path="/dashboard" element={<UserDashboard />} />

            {/* Admin Paneli */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/servers" element={<AdminServers />} />
            <Route path="/admin/user-access" element={<AdminUserAccess />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/products/upload" element={<ProductWizard />} />

            {/* SaaS Admin Panel */}
            <Route path="/admin/tenants" element={<SaasTenants />} />
            <Route path="/admin/subscriptions" element={<SaasSubscriptions />} />
            <Route path="/admin/payments" element={<SaasPayments />} />
            <Route path="/admin/integrations" element={<SaasIntegrations />} />
            <Route path="/admin/usage" element={<SaasUsage />} />
            <Route path="/admin/reports" element={<SaasReports />} />
            <Route path="/admin/announcements" element={<SaasAnnouncements />} />
            <Route path="/admin/tickets" element={<SaasTickets />} />
            <Route path="/admin/audit-logs" element={<SaasAuditLogs />} />
            <Route path="/admin/system-config" element={<SaasSystemConfig />} />

            {/* Pazaryeri Entegrasyonu */}
            <Route path="/marketplace-integration" element={<MarketplaceIntegration />} />

            {/* Finans Modülü */}
            <Route path="/finance" element={<FinancePage />} />

            {/* Ürün Yönetimi */}
            <Route path="/product-management" element={<ProductManagementPage />} />
            <Route path="/product-upload" element={<ProductUploadPage />} />
            <Route path="/price-sync" element={<PriceSyncPage />} />

            {/* Kategori Eşleştirme */}
            <Route path="/category-mapping" element={<CategoryMappingPage />} />
        </Routes>
    );

    // Admin ve Auth sayfaları Container dışında render edilir (tam ekran)
    if (isAdminRoute || isAuthRoute) {
        return routes;
    }

    return (
        <Container
            maxWidth="lg"
            sx={{
                mt: { xs: 2, sm: 3, md: 4 },
                mb: { xs: 2, sm: 3, md: 4 },
                px: { xs: 1, sm: 2, md: 3 },
            }}
        >
            {routes}
        </Container>
    );
};

const App = () => {
    return (
        <AppProvider>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Router>
                    <AppContent />
                    <PWAInstallPrompt />
                </Router>
            </ThemeProvider>
        </AppProvider>
    );
};

export default App;