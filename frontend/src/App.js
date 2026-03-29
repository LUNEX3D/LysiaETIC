/**
 * App.js
 *
 * Uygulamanın ana componentidir. Tüm sayfaları, routing ve genel tema yönetimini içerir.
 * Yeni Finans modülümüz /finance altında, tek sayfada (FinancePage) ile entegre edilmiştir.
 */

import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, Container, ThemeProvider, createTheme } from "@mui/material";

// Sayfalar
import HomePage from "./pages/HomePage";
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminProducts from "./pages/AdminProducts";
import AdminOrders from "./pages/AdminOrders";
import MarketplaceIntegration from "./pages/MarketplaceIntegration";
import ProductWizard from "./components/ProductWizard";
import CategoryMappingPage from "./pages/CategoryMappingPage";

// Modern Finans Paneli
import FinancePage from "./pages/FinancePage";

// Ürün Yönetimi — V3: Otomatik sync, karşılaştırma matrisi, toplu dağıtım
import ProductManagementPage from "./pages/ProductManagementPageV3";

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
            <Route path="/admin" element={<AdminDashboard />} />
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

            {/* Kategori Eşleştirme */}
            <Route path="/category-mapping" element={<CategoryMappingPage />} />
        </Routes>
    );

    if (isAdminRoute) {
        return routes;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
            </Router>
        </ThemeProvider>
    );
};

export default App;