/**
 * App.js
 *
 * Uygulamanın ana componentidir. Tüm sayfaları, routing ve genel tema yönetimini içerir.
 * Yeni Finans modülümüz /finance altında, tek sayfada (FinancePage) ile entegre edilmiştir.
 *
 * ✅ P1-1: React.lazy ile code splitting — ilk yükleme bundle'ı küçültüldü
 * ✅ P1-2: Global ErrorBoundary eklendi — render hataları yakalanır
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, Container, ThemeProvider, createTheme } from "@mui/material";
import { AppProvider } from "./context/AppContext";

// PWA & Responsive
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import useViewportHeight from "./utils/useViewportHeight";
import "./styles/responsive.css";

// ✅ P1-2: Global Error Boundary
import ErrorBoundary from "./components/ErrorBoundary";

// ✅ FIX #19: Protected Route — Auth guard (eager — her route'ta kullanılır)
import ProtectedRoute from "./components/ProtectedRoute";

// ─── Auth sayfaları — Eager import (ilk yüklemede gerekli) ─────────────────────
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";

// ─── Lazy-loaded sayfalar — Sadece ziyaret edildiğinde yüklenir ────────────────
// Kullanıcı Paneli
const UserDashboard          = lazy(() => import("./pages/UserDashboard"));
const VerifyEmail            = lazy(() => import("./pages/VerifyEmail"));

// Admin Paneli
const AdminLogin             = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard         = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers             = lazy(() => import("./pages/AdminUsers"));
const AdminProducts          = lazy(() => import("./pages/AdminProducts"));
const AdminOrders            = lazy(() => import("./pages/AdminOrders"));
const AdminServers           = lazy(() => import("./pages/AdminServers"));
const AdminUserAccess        = lazy(() => import("./pages/AdminUserAccess"));
const ProductWizard          = lazy(() => import("./components/ProductWizard"));

// SaaS Admin Panel
const SaasTenants            = lazy(() => import("./pages/SaasTenants"));
const SaasSubscriptions      = lazy(() => import("./pages/SaasSubscriptions"));
const SaasPayments           = lazy(() => import("./pages/SaasPayments"));
const SaasIntegrations       = lazy(() => import("./pages/SaasIntegrations"));
const SaasUsage              = lazy(() => import("./pages/SaasUsage"));
const SaasReports            = lazy(() => import("./pages/SaasReports"));
const SaasAnnouncements      = lazy(() => import("./pages/SaasAnnouncements"));
const SaasTickets            = lazy(() => import("./pages/SaasTickets"));
const SaasAuditLogs          = lazy(() => import("./pages/SaasAuditLogs"));
const SaasSystemConfig       = lazy(() => import("./pages/SaasSystemConfig"));

// Pazaryeri & Ürün Yönetimi
const MarketplaceIntegration = lazy(() => import("./pages/MarketplaceIntegration"));
const ProductManagementPage  = lazy(() => import("./pages/ProductManagementPageV3"));
const ProductUploadPage      = lazy(() => import("./pages/ProductUploadPage"));
const PriceSyncPage          = lazy(() => import("./pages/PriceSyncPage"));
const CategoryErrorCenter    = lazy(() => import("./pages/CategoryErrorCenter"));

// Finans & Ödeme
const FinancePage            = lazy(() => import("./pages/FinancePage"));
const BillingPage            = lazy(() => import("./pages/BillingPage"));
const SubscriptionPage       = lazy(() => import("./pages/SubscriptionPage"));
const PaymentResult          = lazy(() => import("./pages/PaymentResult"));
const AdminSubscriptionManager = lazy(() => import("./pages/AdminSubscriptionManager"));

// Roketfy — Marketplace Intelligence
const RoketfyPanel           = lazy(() => import("./pages/RoketfyPanel"));

// ✅ WEB APP FIRST: Responsive theme with mobile-first breakpoints
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
        fontFamily: "Space Grotesk, Inter, sans-serif",
        // Responsive typography — scales with viewport
        h1: {
            fontSize: "clamp(1.75rem, 5vw, 3rem)",
            fontWeight: 700,
            lineHeight: 1.2
        },
        h2: {
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: 700,
            lineHeight: 1.3
        },
        h3: {
            fontSize: "clamp(1.25rem, 3.5vw, 2rem)",
            fontWeight: 600,
            lineHeight: 1.4
        },
        h4: {
            fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
            fontWeight: 600,
            lineHeight: 1.4
        },
        h5: {
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            fontWeight: 600,
            lineHeight: 1.5
        },
        h6: {
            fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
            fontWeight: 600,
            lineHeight: 1.5
        },
        body1: {
            fontSize: "clamp(0.875rem, 2vw, 1rem)",
            lineHeight: 1.6
        },
        body2: {
            fontSize: "clamp(0.8rem, 1.8vw, 0.875rem)",
            lineHeight: 1.6
        },
        button: {
            fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
            fontWeight: 600,
            textTransform: "none"
        }
    },
    breakpoints: {
        values: {
            xs: 0,      // Mobile portrait
            sm: 600,    // Mobile landscape / Small tablet
            md: 900,    // Tablet
            lg: 1200,   // Desktop
            xl: 1536    // Large desktop
        }
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    // Touch-friendly minimum size
                    minHeight: 44,
                    minWidth: 44,
                    borderRadius: 10,
                    padding: "10px 20px",
                    "@media (max-width: 600px)": {
                        padding: "8px 16px",
                        fontSize: "0.85rem"
                    }
                }
            }
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    "& .MuiInputBase-root": {
                        minHeight: 44,
                        "@media (max-width: 600px)": {
                            fontSize: "16px" // Prevents iOS zoom on focus
                        }
                    }
                }
            }
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    // Touch-friendly size
                    minWidth: 44,
                    minHeight: 44
                }
            }
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    paddingLeft: "16px",
                    paddingRight: "16px",
                    "@media (max-width: 600px)": {
                        paddingLeft: "12px",
                        paddingRight: "12px"
                    }
                }
            }
        }
    }
});

// ✅ P1-1: Lazy loading sırasında gösterilecek fallback (tema-aware)
const LazyFallback = () => {
    const resolvedTheme = localStorage.getItem("themeMode") || "dark";
    const isDark = resolvedTheme !== "light";
    const lang = localStorage.getItem("language") || "tr";
    return (
        <div style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "1rem",
            background: isDark ? "#0f1419" : "#f0f2f5",
        }}>
            <div style={{
                width: 40, height: 40,
                border: `3px solid ${isDark ? "rgba(78,205,196,0.2)" : "rgba(13,148,136,0.2)"}`,
                borderTopColor: isDark ? "#4ecdc4" : "#0d9488",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
            }} />
            <p style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "0.9rem" }}>
                {lang === "en" ? "Loading..." : "Yükleniyor..."}
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const AppContent = () => {
    // ✅ WEB APP FIRST: Fix mobile browser viewport height (address bar issue)
    useViewportHeight();

    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");
    const isAuthRoute = ["/" , "/login", "/register", "/verify-email", "/forgot-password", "/payment/success", "/payment/failed", "/subscription"].includes(location.pathname);

    const routes = (
        <Suspense fallback={<LazyFallback />}>
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
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />

            {/* Ürün Yönetimi — Giriş gerekli */}
            <Route path="/product-management" element={<ProtectedRoute><ProductManagementPage /></ProtectedRoute>} />
            <Route path="/product-upload" element={<ProtectedRoute><ProductUploadPage /></ProtectedRoute>} />
            <Route path="/price-sync" element={<ProtectedRoute><PriceSyncPage /></ProtectedRoute>} />
            <Route path="/category-errors" element={<ProtectedRoute><CategoryErrorCenter /></ProtectedRoute>} />

            {/* Roketfy — Marketplace Intelligence */}
            <Route path="/roketfy" element={<ProtectedRoute><RoketfyPanel /></ProtectedRoute>} />

            {/* Abonelik & Ödeme */}
            <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="/payment/success" element={<PaymentResult />} />
            <Route path="/payment/failed" element={<PaymentResult />} />

            {/* Admin Abonelik Yönetimi */}
            <Route path="/admin/subscription-manager" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminSubscriptionManager /></ProtectedRoute>} />
        </Routes>
        </Suspense>
    );

    // Admin ve Auth sayfaları Container dışında render edilir (tam ekran)
    // ✅ FIX #16: PWA Install Prompt sadece authenticated sayfalarda gösterilir
    if (isAdminRoute || isAuthRoute) {
        return routes;
    }

    return (
        <>
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
            <PWAInstallPrompt />
        </>
    );
};

const App = () => {
    return (
        <ErrorBoundary>
            <AppProvider>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <Router>
                        <AppContent />
                    </Router>
                </ThemeProvider>
            </AppProvider>
        </ErrorBoundary>
    );
};

export default App;