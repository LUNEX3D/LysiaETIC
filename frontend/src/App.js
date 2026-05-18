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
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CssBaseline, Container, ThemeProvider, createTheme } from "@mui/material";
import { AppProvider } from "./context/AppContext";

// PWA & Responsive
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import useViewportHeight from "./utils/useViewportHeight";
import useMobileShell from "./utils/useMobileShell";
import "./styles/responsive.css";
import "./styles/mobile-shell.css";

// ✅ Capacitor Native Bridge — iOS/Android native features
import useCapacitorInit from "./utils/useCapacitorInit";

// ✅ P1-2: Global Error Boundary
import ErrorBoundary from "./components/ErrorBoundary";

// ✅ PWA Update Prompt — shows when new version available
import UpdatePrompt from "./components/UpdatePrompt";

// ✅ FIX #19: Protected Route — Auth guard (eager — her route'ta kullanılır)
import ProtectedRoute from "./components/ProtectedRoute";

// ─── Auth sayfaları — Eager import (ilk yüklemede gerekli) ─────────────────────
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";

// ─── Legal sayfaları — Public erişim ────────────────────────────────────────────
import LegalPage from "./pages/LegalPage";
import SeoHead from "./components/SeoHead";

// ─── Lazy-loİaded sayfalar — Sİadece ziyaret edildiğinde yüklenir ────────────────
// Public
const HomePage               = lazy(() => import("./pages/HomePage"));
const IntegrationLandingPage = lazy(() => import("./pages/IntegrationLandingPage"));
const BlogPage               = lazy(() => import("./pages/BlogPage"));

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
const AdminUserDetail        = lazy(() => import("./pages/AdminUserDetail"));
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
const AdminClientErrors      = lazy(() => import("./pages/AdminClientErrors"));
const AdminAccessControl     = lazy(() => import("./pages/AdminAccessControl"));
const SaasSystemConfig       = lazy(() => import("./pages/SaasSystemConfig"));
const SaasPlanManager        = lazy(() => import("./pages/SaasPlanManager"));
const SaasUnitEconomics      = lazy(() => import("./pages/SaasUnitEconomics"));

// Pazaryeri & Ürün Yönetimi
const MarketplaceIntegration = lazy(() => import("./pages/MarketplaceIntegration"));
const ProductManagementPage  = lazy(() => import("./pages/ProductManagementPageV3"));
const ProductUploadPage      = lazy(() => import("./pages/ProductUploadPage"));
const PriceSyncPage          = lazy(() => import("./pages/PriceSyncPage"));
// Finans & Ödeme
const FinancePage            = lazy(() => import("./pages/FinancePage"));
const BillingPage            = lazy(() => import("./pages/BillingPage"));
const SubscriptionPage       = lazy(() => import("./pages/SubscriptionPage"));
const ErrorCenterPage        = lazy(() => import("./pages/ErrorCenterPage"));
const PaymentResult          = lazy(() => import("./pages/PaymentResult"));
// AdminSubscriptionManager kaldırıldı — /admin/subscription-manager → /admin/subscriptions redirect ile yönetiliyor

// Roketfy — Marketplace Intelligence
const RoketfyPanel           = lazy(() => import("./pages/RoketfyPanel"));

// PazarYonet Radar — AI Product Opportunity Engine
const RadarProPage           = lazy(() => import("./pages/RadarProPage"));

// LysiaBrain2 — Standalone test page (UserDashboard dışında)
const LysiaBrain2Page        = lazy(() => import("./pages/LysiaBrain2Page"));
const LunexeticLoginPreview  = lazy(() => import("./pages/LunexeticLoginPreview"));

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
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    "@media (max-width: 768px)": {
                        margin: 0,
                        width: "100%",
                        maxWidth: "100%",
                        maxHeight: "min(92dvh, calc(var(--vh, 1vh) * 92))"
                    }
                }
            }
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    "@media (max-width: 768px)": {
                        width: "min(300px, 88vw)"
                    }
                }
            }
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    "@media (max-width: 768px)": {
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch"
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
    useMobileShell();

    // ✅ Capacitor: Initialize native features (status bar, push, back button)
    const navigate = useNavigate();
    useCapacitorInit(navigate);

    const location = useLocation();
    const integrationRoutes = [
        "trendyol-entegrasyonu",
        "hepsiburada-entegrasyonu",
        "amazon-entegrasyonu",
        "n11-entegrasyonu",
        "ciceksepeti-entegrasyonu",
    ];
    const isAdminRoute = location.pathname.startsWith("/admin");
    const isLysiaBrain2 = location.pathname === "/lysiabrain2";
    const isLegalRoute = ["/privacy", "/terms", "/cookies", "/distance-sales", "/preliminary-info"].includes(location.pathname);
    const isBlogRoute = location.pathname === "/blog" || location.pathname.startsWith("/blog/");
    const isPublicMarketingRoute =
        isLegalRoute ||
        isBlogRoute ||
        integrationRoutes.some((s) => location.pathname === `/${s}`);
    const isAuthRoute = ["/" , "/home", "/login", "/login-lunexetic", "/register", "/verify-email", "/payment/success", "/payment/failed", "/subscription"].includes(location.pathname) || isPublicMarketingRoute;

    const routes = (
        <Suspense fallback={<LazyFallback />}>
        <SeoHead />
        <Routes>
            {/* Ana Sayfa — Public landing page */}
            <Route path="/home" element={<HomePage />} />
            {integrationRoutes.map((slug) => (
                <Route key={slug} path={`/${slug}`} element={<IntegrationLandingPage />} />
            ))}

            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPage />} />

            {/* Auth Sayfaları — Direkt login ekranı karşılar */}
            <Route path="/" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/login-lunexetic" element={<LunexeticLoginPreview />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Legal Sayfaları — Public erişim, auth gerektirmez */}
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/cookies" element={<LegalPage />} />
            <Route path="/distance-sales" element={<LegalPage />} />
            <Route path="/preliminary-info" element={<LegalPage />} />

            {/* Kullanıcı Paneli — ProtectedRoute ile korunuyor */}
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />

            {/* ═══ Admin Paneli — Admin/Dev rolü gerekli ═══ */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminDashboard /></ProtectedRoute>} />

            {/* Ana Kontrol */}
            <Route path="/admin/tenants" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasTenants /></ProtectedRoute>} />
            <Route path="/admin/user-access" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminUserAccess /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/user/:id" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminUserDetail /></ProtectedRoute>} />

            {/* Finans & Abonelik */}
            <Route path="/admin/plan-manager" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasPlanManager /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasSubscriptions /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasPayments /></ProtectedRoute>} />
            <Route path="/admin/unit-economics" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasUnitEconomics /></ProtectedRoute>} />

            {/* Operasyon */}
            <Route path="/admin/products" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminProducts /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/integrations" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasIntegrations /></ProtectedRoute>} />
            <Route path="/admin/usage" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasUsage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasReports /></ProtectedRoute>} />
            <Route path="/admin/products/upload" element={<ProtectedRoute requiredRoles={["admin","dev"]}><ProductWizard /></ProtectedRoute>} />

            {/* İletişim */}
            <Route path="/admin/announcements" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasAnnouncements /></ProtectedRoute>} />
            <Route path="/admin/tickets" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasTickets /></ProtectedRoute>} />

            {/* Sistem & Güvenlik */}
            <Route path="/admin/servers" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminServers /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRoles={["admin","dev"]}><SaasAuditLogs /></ProtectedRoute>} />
            <Route path="/admin/client-errors" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminClientErrors /></ProtectedRoute>} />
            <Route path="/admin/access-control" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminAccessControl /></ProtectedRoute>} />
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

            {/* Roketfy — Marketplace Intelligence */}
            <Route path="/roketfy" element={<ProtectedRoute><RoketfyPanel /></ProtectedRoute>} />

            {/* PazarYonet Radar — AI Product Opportunity Engine */}
            <Route path="/radar-pro" element={<ProtectedRoute><RadarProPage /></ProtectedRoute>} />

            {/* Abonelik & Ödeme */}
            <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            {/* Operasyon Defteri — kullanıcı + AI + sistem birleşik akışı (eski URL /errors geri uyumlu) */}
            <Route path="/journal" element={<ProtectedRoute><ErrorCenterPage /></ProtectedRoute>} />
            <Route path="/errors" element={<Navigate to="/journal" replace />} />
            <Route path="/payment/success" element={<PaymentResult />} />
            <Route path="/payment/failed" element={<PaymentResult />} />

            {/* Admin Abonelik Yönetimi — eski URL yönlendirmesi */}
            <Route path="/admin/subscription-manager" element={<Navigate to="/admin/subscriptions" replace />} />

            {/* LysiaBrain2 — Standalone test (UserDashboard dışında) */}
            <Route path="/lysiabrain2" element={<ProtectedRoute><LysiaBrain2Page /></ProtectedRoute>} />
        </Routes>
        </Suspense>
    );

    // Admin ve Auth sayfaları Container dışında render edilir (tam ekran)
    // ✅ FIX #16: PWA Install Prompt sadece authenticated sayfalarda gösterilir
    if (isAdminRoute || isAuthRoute || isLysiaBrain2) {
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
                    <UpdatePrompt />
                </ThemeProvider>
            </AppProvider>
        </ErrorBoundary>
    );
};

export default App;