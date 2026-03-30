/**
 * App.js
 *
 * Uygulamanın ana componentidir. Tüm sayfaları, routing ve genel tema yönetimini içerir.
 * Yeni Finans modülümüz /finance altında, tek sayfada (FinancePage) ile entegre edilmiştir.
 */

import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, Container, ThemeProvider, createTheme } from "@mui/material";

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

// Modern Finans Paneli
import FinancePage from "./pages/FinancePage";

// Ürün Yönetimi — V3: Otomatik sync, karşılaştırma matrisi, toplu dağıtım
import ProductManagementPage from "./pages/ProductManagementPageV3";

// Yeni Ürün Yükleme & Fiyat Eşitleme
import ProductUploadPage from "./pages/ProductUploadPage";
import PriceSyncPage from "./pages/PriceSyncPage";

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

    const routes = (
        <Routes>
            {/* Genel Sayfalar */}
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/login" element={<LoginForm />} />

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

    if (isAdminRoute) {
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
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <AppContent />
                <PWAInstallPrompt />
            </Router>
        </ThemeProvider>
    );
};

export default App;