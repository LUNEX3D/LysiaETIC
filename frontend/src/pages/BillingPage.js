/**
 * BillingPage — Faturalandırma & e-Belge Yönetimi
 * LysiaETIC v2
 *
 * Modüler mimari:
 *   - hooks/useProviders.js    → Sağlayıcı bağlantı yönetimi
 *   - hooks/useInvoices.js     → Fatura veri yönetimi
 *   - hooks/useAutoInvoice.js  → Otomatik fatura yönetimi
 *   - components/*             → UI bileşenleri
 *   - constants.js             → Sabitler
 *   - styles.js                → Ortak stiller
 *   - utils.js                 → Yardımcı fonksiyonlar
 *
 * Güvenlik iyileştirmeleri:
 *   ✅ api.js Axios instance kullanılıyor (refresh token rotation)
 *   ✅ Credential'lar localStorage'da saklanmıyor (sadece session token)
 *   ✅ Hardcoded VKN kaldırıldı
 */
import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaFileInvoiceDollar, FaFileInvoice, FaClipboardList, FaTruck,
    FaSyncAlt, FaChartBar, FaLink, FaPlus, FaCheckCircle,
} from "react-icons/fa";
import { useApp } from "../context/AppContext";

// ── Billing modülü ──
import useProviders from "./billing/hooks/useProviders";
import useInvoices from "./billing/hooks/useInvoices";
import useAutoInvoice from "./billing/hooks/useAutoInvoice";
import { colors, globalKeyframes } from "./billing/styles";
import { calcInvoiceStats, filterByTab } from "./billing/utils";
import { TABS } from "./billing/constants";

// ── Bileşenler ──
import { Pill, EmptyState, LoadingState, AlertBox } from "./billing/components/SharedUI";
import KPICards from "./billing/components/KPICards";
import InvoiceTable from "./billing/components/InvoiceTable";
import ProvidersPanel from "./billing/components/ProvidersPanel";
import InvoiceDetailModal from "./billing/components/InvoiceDetailModal";
import CreateInvoiceModal from "./billing/components/CreateInvoiceModal";
import AutoInvoicePanel from "./billing/components/AutoInvoicePanel";

// ── Lazy load: Gelişmiş Analiz (ağır bileşen) ──
const AdvancedAnalysis = lazy(() => import("./billing/components/AdvancedAnalysis"));

// ── Sekme ikon haritası ──
const TAB_ICONS = {
    FaFileInvoiceDollar: <FaFileInvoiceDollar />,
    FaFileInvoice: <FaFileInvoice />,
    FaClipboardList: <FaClipboardList />,
    FaTruck: <FaTruck />,
    FaSyncAlt: <FaSyncAlt />,
    FaChartBar: <FaChartBar />,
    FaLink: <FaLink />,
};

/* ═══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const BillingPage = () => {
    const { t } = useApp();

    // ── Sekmeler ──
    const [activeTab, setActiveTab] = useState("overview");

    // ── Modallar ──
    const [showCreateModal, setShowCreateModal] = useState(false);

    // ── Hook'lar ──
    const providers = useProviders();
    const invoiceHook = useInvoices(providers.connectedProviders);
    const autoInvoice = useAutoInvoice();

    // ── Hesaplanmış veriler ──
    const stats = useMemo(() => calcInvoiceStats(invoiceHook.invoices), [invoiceHook.invoices]);
    const tabInvoices = useMemo(() => filterByTab(invoiceHook.invoices, activeTab), [invoiceHook.invoices, activeTab]);

    // ── Detay modal handler ──
    const handleViewDetail = useCallback((inv) => {
        invoiceHook.selectInvoice(inv);
    }, [invoiceHook]);

    const handleCloseDetail = useCallback(() => {
        invoiceHook.clearSelection();
    }, [invoiceHook]);

    // ── Bağlantı yok durumu ──
    const renderNoConnection = () => (
        <EmptyState
            icon="🔗"
            title="E-Fatura Sağlayıcısı Bağlı Değil"
            description="Faturalandırma özelliklerini kullanabilmek için önce bir e-Fatura sağlayıcısı bağlamanız gerekiyor."
            action={
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab("providers")}
                    style={{
                        background: "linear-gradient(135deg, " + colors.accent + ", #44a08d)",
                        border: "none",
                        borderRadius: 10,
                        padding: "0.7rem 1.5rem",
                        color: "#fff",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                    }}
                >
                    <FaLink /> Sağlayıcı Bağla
                </motion.button>
            }
        />
    );

    /* ═══════════════════════════════════════════════════════
       GENEL BAKIŞ
       ═══════════════════════════════════════════════════════ */
    const renderOverview = () => {
        if (!providers.isConnected) return renderNoConnection();
        if (invoiceHook.loading && invoiceHook.invoices.length === 0) {
            return <LoadingState message="Belgeler yükleniyor..." sub="Sağlayıcınızdan veriler çekiliyor, lütfen bekleyin." />;
        }

        return (
            <div>
                {/* Hata */}
                {invoiceHook.fetchError && (
                    <AlertBox
                        type="error"
                        message={invoiceHook.fetchError}
                        onAction={invoiceHook.fetchAll}
                        actionLabel="Tekrar Dene"
                    />
                )}

                {/* KPI Kartları */}
                <KPICards stats={stats} />

                {/* Bağlı Sağlayıcılar + Son Belgeler */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
                    {/* Bağlı Sağlayıcılar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: colors.cardGradient,
                            border: "1px solid " + colors.border,
                            borderRadius: 16,
                            padding: "1.5rem",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaLink style={{ color: colors.accent }} /> Sağlayıcılar
                            </h3>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveTab("providers")}
                                style={{
                                    background: colors.glass,
                                    border: "1px solid " + colors.glassBr,
                                    borderRadius: 8,
                                    padding: "0.3rem 0.6rem",
                                    cursor: "pointer",
                                    color: colors.accent,
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                }}
                            >
                                Yönet →
                            </motion.button>
                        </div>

                        {providers.connectedProviders.map((p) => (
                            <div
                                key={p.id}
                                style={{
                                    background: colors.glass,
                                    border: "1px solid " + colors.glassBr,
                                    borderRadius: 10,
                                    padding: "0.75rem",
                                    marginBottom: "0.5rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.6rem",
                                }}
                            >
                                <span style={{ fontSize: "1.5rem" }}>{p.logo}</span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>{p.name}</p>
                                    <p style={{ color: colors.dim, fontSize: "0.68rem", margin: 0 }}>
                                        {p.env === "production" ? "🟢 Canlı" : "🟡 Test"} ortam
                                    </p>
                                </div>
                                <Pill color={colors.green}>
                                    <FaCheckCircle /> Bağlı
                                </Pill>
                            </div>
                        ))}

                        {/* Yenile butonu */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={invoiceHook.fetchAll}
                            disabled={invoiceHook.loading}
                            style={{
                                width: "100%",
                                marginTop: "0.75rem",
                                background: invoiceHook.loading ? colors.accent + "30" : colors.accent + "15",
                                border: "1px solid " + colors.accent + "30",
                                borderRadius: 8,
                                padding: "0.5rem",
                                cursor: invoiceHook.loading ? "not-allowed" : "pointer",
                                color: colors.accent,
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.4rem",
                            }}
                        >
                            <FaSyncAlt style={invoiceHook.loading ? { animation: "spin 1s linear infinite" } : {}} />
                            {invoiceHook.loading ? "Yükleniyor..." : "Belgeleri Yenile"}
                        </motion.button>

                        {invoiceHook.lastFetchTime && (
                            <p style={{ color: colors.dim, fontSize: "0.65rem", textAlign: "center", margin: "0.4rem 0 0" }}>
                                Son güncelleme: {invoiceHook.lastFetchTime.toLocaleTimeString("tr-TR")}
                            </p>
                        )}
                    </motion.div>

                    {/* Son Belgeler */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            background: colors.cardGradient,
                            border: "1px solid " + colors.border,
                            borderRadius: 16,
                            padding: "1.5rem",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaFileInvoice style={{ color: colors.accent }} /> Son Belgeler
                            </h3>
                            {invoiceHook.invoices.length > 0 && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActiveTab("invoices")}
                                    style={{
                                        background: colors.glass,
                                        border: "1px solid " + colors.glassBr,
                                        borderRadius: 8,
                                        padding: "0.3rem 0.6rem",
                                        cursor: "pointer",
                                        color: colors.accent,
                                        fontSize: "0.7rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    Tümünü Gör →
                                </motion.button>
                            )}
                        </div>

                        {invoiceHook.invoices.length > 0 ? (
                            <InvoiceTable
                                invoices={invoiceHook.invoices.slice(0, 8)}
                                loading={invoiceHook.loading}
                                lastFetchTime={invoiceHook.lastFetchTime}
                                onRefresh={invoiceHook.fetchAll}
                                onViewDetail={handleViewDetail}
                                onDownload={invoiceHook.downloadPdf}
                                pdfLoading={invoiceHook.pdfLoading}
                                showFilters={false}
                            />
                        ) : (
                            <EmptyState
                                icon="📭"
                                title="Henüz belge yok"
                                description="Sağlayıcınızda kayıtlıı belge bulunamadı."
                            />
                        )}
                    </motion.div>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       SEKMELERİN İÇERİĞİ
       ═══════════════════════════════════════════════════════ */
    const renderTabContent = () => {
        switch (activeTab) {
            case "overview":
                return renderOverview();

            case "invoices":
                if (!providers.isConnected) return renderNoConnection();
                return (
                    <InvoiceTable
                        invoices={invoiceHook.invoices}
                        loading={invoiceHook.loading}
                        lastFetchTime={invoiceHook.lastFetchTime}
                        onRefresh={invoiceHook.fetchAll}
                        onCreateNew={() => setShowCreateModal(true)}
                        onViewDetail={handleViewDetail}
                        onDownload={invoiceHook.downloadPdf}
                        pdfLoading={invoiceHook.pdfLoading}
                        showFilters={true}
                    />
                );

            case "e-archive":
            case "e-invoice":
            case "e-despatch":
                if (!providers.isConnected) return renderNoConnection();
                return (
                    <InvoiceTable
                        invoices={tabInvoices}
                        loading={invoiceHook.loading}
                        lastFetchTime={invoiceHook.lastFetchTime}
                        onRefresh={invoiceHook.fetchAll}
                        onCreateNew={() => setShowCreateModal(true)}
                        onViewDetail={handleViewDetail}
                        onDownload={invoiceHook.downloadPdf}
                        pdfLoading={invoiceHook.pdfLoading}
                        showFilters={false}
                    />
                );

            case "auto-invoice":
                return <AutoInvoicePanel autoInvoice={autoInvoice} />;

            case "analysis":
                if (!providers.isConnected) return renderNoConnection();
                if (invoiceHook.loading && invoiceHook.invoices.length === 0) {
                    return <LoadingState message="Belgeler yükleniyor..." />;
                }
                return (
                    <Suspense fallback={<LoadingState message="Analiz modülü yükleniyor..." />}>
                        <AdvancedAnalysis
                            invoices={invoiceHook.invoices}
                            onInvoiceClick={handleViewDetail}
                        />
                    </Suspense>
                );

            case "providers":
                return (
                    <ProvidersPanel
                        connectedProviders={providers.connectedProviders}
                        connecting={providers.connecting}
                        connectionError={providers.connectionError}
                        onConnect={providers.connect}
                        onDisconnect={providers.disconnect}
                        onClearError={providers.clearError}
                    />
                );

            default:
                return renderOverview();
        }
    };

    /* ═══════════════════════════════════════════════════════
       ANA RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: colors.bg, padding: 0, margin: 0 }}>
            {/* ── HEADER ── */}
            <div
                style={{
                    background: "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)",
                    borderBottom: "1px solid " + colors.border,
                    padding: "1.25rem clamp(1rem, 4vw, 2rem)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                        <h1
                            style={{
                                background: "linear-gradient(135deg, " + colors.accent + " 0%, " + colors.purple + " 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                                fontWeight: 800,
                                margin: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <FaFileInvoiceDollar style={{ WebkitTextFillColor: colors.accent }} />
                            Faturalandırma & e-Belge Yönetimi
                        </h1>
                        <p style={{ color: colors.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                            e-Fatura, e-Arşiv, e-İrsaliye — Tüm e-belge işlemlerİşinizi tek yerden yönetin
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {providers.isConnected && (
                            <Pill color={colors.green}>
                                <FaCheckCircle /> {providers.activeProvider.name} — {providers.activeProvider.env === "production" ? "Canlı" : "Test"}
                            </Pill>
                        )}
                        {providers.isConnected && (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setShowCreateModal(true)}
                                style={{
                                    background: "linear-gradient(135deg, " + colors.accent + ", #44a08d)",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "0.6rem 1.25rem",
                                    color: "#fff",
                                    fontSize: "0.82rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                }}
                            >
                                <FaPlus /> Yeni Belge
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SEKMELER ── */}
            <div
                style={{
                    background: colors.bg,
                    padding: "0 clamp(1rem, 4vw, 2rem)",
                    borderBottom: "2px solid rgba(255,255,255,0.05)",
                }}
            >
                <div style={{ display: "flex", gap: "0.15rem", overflowX: "auto" }}>
                    {TABS.map((tab) => (
                        <motion.button
                            key={tab.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? colors.accent + "15" : "transparent",
                                border: "none",
                                borderBottom: activeTab === tab.id ? "2px solid " + colors.accent : "2px solid transparent",
                                padding: "0.85rem 1.25rem",
                                cursor: "pointer",
                                color: activeTab === tab.id ? colors.accent : colors.muted,
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                transition: "all 0.2s",
                                marginBottom: "-2px",
                                flexShrink: 0,
                            }}
                        >
                            {TAB_ICONS[tab.icon]} {tab.label}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* ── İÇERİK ── */}
            <div style={{ padding: "clamp(1rem, 3vw, 1.75rem) clamp(1rem, 4vw, 2rem)" }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                    >
                        {renderTabContent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ═══ FATURA OLUŞTURMA MODAL ═══ */}
            {showCreateModal && (
                <CreateInvoiceModal
                    isConnected={providers.isConnected}
                    activeProvider={providers.activeProvider}
                    onCreateInvoice={invoiceHook.createInvoice}
                    onClose={() => setShowCreateModal(false)}
                    onGoToProviders={() => setActiveTab("providers")}
                />
            )}

            {/* ═══ FATURA DETAY MODAL ═══ */}
            {invoiceHook.selectedInvoice && (
                <InvoiceDetailModal
                    invoice={invoiceHook.selectedInvoice}
                    detailData={invoiceHook.detailData}
                    detailLoading={invoiceHook.detailLoading}
                    pdfLoading={invoiceHook.pdfLoading}
                    onClose={handleCloseDetail}
                    onPreview={invoiceHook.previewInvoice}
                    onDownload={invoiceHook.downloadPdf}
                />
            )}

            {/* ── Global Keyframes ── */}
            <style>{globalKeyframes}</style>
        </div>
    );
};

export default BillingPage;
