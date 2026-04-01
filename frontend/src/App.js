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

// ✅ FIX #19: Protected Route — Auth guard
import ProtectedRoute from "./components/ProtectedRoute";

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

            {/* Kullanıcı Paneli — ProtectedRoute ile korunuyor */}
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />

            {/* Admin Paneli — Admin/Dev rolü gerekli */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/servers" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminServers /></ProtectedRoute>} />
            <Route path="/admin/user-access" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminUserAccess /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/products" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminProducts /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/products/upload" element={<ProtectedRoute requiredRoles={["admin","dev"]}><ProductWizard /></ProtectedRoute>} />

            {/* SaaS Admin Panel — Admin/Dev rolü gerekli */}
            <Route path="/admin/tenants" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasTenants /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasSubscriptions /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasPayments /></ProtectedRoute>} />
            <Route path="/admin/integrations" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasIntegrations /></ProtectedRoute>} />
            <Route path="/admin/usage" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasUsage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasReports /></ProtectedRoute>} />
            <Route path="/admin/announcements" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasAnnouncements /></ProtectedRoute>} />
            <Route path="/admin/tickets" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasTickets /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasAuditLogs /></ProtectedRoute>} />
            <Route path="/admin/system-config" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasSystemConfig /></ProtectedRoute>} />

            {/* Pazaryeri Entegrasyonu — Giriş gerekli */}
            <Route path="/marketplace-integration" element={<ProtectedRoute><MarketplaceIntegration /></ProtectedRoute>} />

            {/* Finans Modülü — Giriş gerekli */}
            <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />

            {/* Ürün Yönetimi — Giriş gerekli */}
            <Route path="/product-management" element={<ProtectedRoute><ProductManagementPage /></ProtectedRoute>} />
            <Route path="/product-upload" element={<ProtectedRoute><ProductUploadPage /></ProtectedRoute>} />
            <Route path="/price-sync" element={<ProtectedRoute><PriceSyncPage /></ProtectedRoute>} />

            {/* Kategori Eşleştirme — Giriş gerekli */}
            <Route path="/category-mapping" element={<ProtectedRoute><CategoryMappingPage /></ProtectedRoute>} />
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