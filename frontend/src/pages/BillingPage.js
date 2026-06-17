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
import React, { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaFileInvoiceDollar, FaFileInvoice, FaClipboardList, FaTruck,
    FaSyncAlt, FaChartBar, FaLink, FaPlus, FaCheckCircle, FaDownload,
} from "react-icons/fa";
import { useApp } from "../context/AppContext";

// ── Billing modülü ──
import useProviders from "./billing/hooks/useProviders";
import useInvoices from "./billing/hooks/useInvoices";
import useAutoInvoice from "./billing/hooks/useAutoInvoice";
import { colors, globalKeyframes } from "./billing/styles";
import { calcInvoiceStats, filterByTab } from "./billing/utils";
import { TABS, TAB_DOC_META } from "./billing/constants";

// ── Bileşenler ──
import { Pill, EmptyState, LoadingState, AlertBox } from "./billing/components/SharedUI";
import KPICards from "./billing/components/KPICards";
import InvoiceTable from "./billing/components/InvoiceTable";
import ProvidersPanel from "./billing/components/ProvidersPanel";
import InvoiceDetailModal from "./billing/components/InvoiceDetailModal";
import CreateInvoiceModal from "./billing/components/CreateInvoiceModal";
import AutoInvoicePanel from "./billing/components/AutoInvoicePanel";
import SovosEArchiveTools from "./billing/components/SovosEArchiveTools";

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
    FaDownload: <FaDownload />,
};

/* ═══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const BillingPage = ({ embedded = false }) => {
    const { t } = useApp();

    // ── Sekmeler ──
    const [activeTab, setActiveTab] = useState("overview");
    /** QNB sağlayıcı kartındaki “Ayarlar” → Otomatik Fatura formunu açmak için artan sayaç */
    const [autoInvoiceSettingsTick, setAutoInvoiceSettingsTick] = useState(0);
    const [providerSettingsHint, setProviderSettingsHint] = useState("");

    // ── Modallar ──
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createModalInitialType, setCreateModalInitialType] = useState("e-arsiv");

    // ── Hook'lar ──
    const providers = useProviders();
    const invoiceHook = useInvoices(providers.connectedProviders);
    const autoInvoice = useAutoInvoice();

    // ── Hesaplanmış veriler ──
    const stats = useMemo(() => calcInvoiceStats(invoiceHook.invoices), [invoiceHook.invoices]);
    const tabInvoices = useMemo(() => filterByTab(invoiceHook.invoices, activeTab), [invoiceHook.invoices, activeTab]);
    const tabMeta = TAB_DOC_META[activeTab];

    const openCreateModal = useCallback((docType) => {
        const meta = TAB_DOC_META[activeTab];
        if (meta?.viewOnly) return;
        setCreateModalInitialType(docType || tabMeta?.defaultCreateType || "e-arsiv");
        setShowCreateModal(true);
    }, [tabMeta, activeTab]);

    const navigateToTab = useCallback((tabId) => {
        setActiveTab(tabId);
    }, []);

    const activeProvider = providers.connectedProviders[0];
    const isSovosBilling = activeProvider?.authType === "sovos";
    const refreshInvoices = useCallback(() => {
        if (isSovosBilling) {
            return invoiceHook.syncFromProvider();
        }
        return invoiceHook.fetchAll();
    }, [isSovosBilling, invoiceHook]);

    const processSingleOrderAndRefresh = useCallback(async (orderId) => {
        const result = await autoInvoice.processSingleOrder(orderId);
        if (result?.success) {
            await invoiceHook.fetchAll();
        }
        return result;
    }, [autoInvoice, invoiceHook]);

    // Sekme değişiminde Sovos API çağrısı yapılmaz (getUBLList yoğunluğunu önler)

    useEffect(() => {
        if (activeTab !== "analysis") return;
        if (invoiceHook.invoices.length === 0 && !invoiceHook.loading) {
            refreshInvoices();
        }
    }, [activeTab, invoiceHook.invoices.length, invoiceHook.loading, refreshInvoices]);

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
                        onAction={refreshInvoices}
                        actionLabel="Tekrar Dene"
                    />
                )}

                {/* KPI Kartları */}
                <KPICards stats={stats} />

                {isSovosBilling && (
                    <SovosEArchiveTools provider={activeProvider} />
                )}

                {/* Bağlı Sağlayıcılar + Son Belgeler */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 2.5fr)", gap: "1.5rem" }}>
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
                            onClick={refreshInvoices}
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
                                onRefresh={refreshInvoices}
                                onViewDetail={handleViewDetail}
                                onPreview={invoiceHook.previewInvoice}
                                onDownload={invoiceHook.downloadPdf}
                                isDocLoading={invoiceHook.isDocLoading}
                                isAnyDocLoading={invoiceHook.isAnyDocLoading}
                                showFilters={false}
                            />
                        ) : (
                            <EmptyState
                                icon="📭"
                                title="Henüz belge yok"
                                description="Sağlayıcınızda kayıtlı belge bulunamadı."
                            />
                        )}
                    </motion.div>
                </div>
            </div>
        );
    };

    const renderDocTab = (invoices, { showFilters = false } = {}) => {
        if (!providers.isConnected) return renderNoConnection();
        return (
            <div>
                {tabMeta && (
                    <div style={{
                        marginBottom: "1.25rem",
                        padding: "1rem 1.15rem",
                        background: colors.cardGradient,
                        border: "1px solid " + colors.border,
                        borderRadius: 14,
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                            <div style={{ flex: 1, minWidth: 220 }}>
                                <h2 style={{ color: "#fff", fontSize: "1.08rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
                                    {tabMeta.title}
                                </h2>
                                <p style={{ color: colors.textMuted, fontSize: "0.82rem", margin: 0, lineHeight: 1.55 }}>
                                    {tabMeta.description}
                                </p>
                                {tabMeta.tip && (
                                    <p style={{ color: colors.dim, fontSize: "0.74rem", margin: "0.5rem 0 0", lineHeight: 1.45 }}>
                                        💡 {tabMeta.tip}
                                    </p>
                                )}
                                {isSovosBilling && (
                                    <p style={{ color: colors.accent, fontSize: "0.74rem", margin: "0.5rem 0 0", lineHeight: 1.45 }}>
                                        Sovos: Liste veritabanından gösterilir. &quot;Yenile&quot; ile son 30 günün belgeleri Sovos portalından çekilir (e-Arşiv + e-Fatura).
                                    </p>
                                )}
                            </div>
                            {!tabMeta?.viewOnly && (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => openCreateModal(tabMeta.defaultCreateType)}
                                style={{
                                    background: "linear-gradient(135deg, " + colors.accent + ", #44a08d)",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "0.55rem 1rem",
                                    color: "#fff",
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <FaPlus /> Yeni Belge
                            </motion.button>
                            )}
                        </div>
                    </div>
                )}
                <InvoiceTable
                    invoices={invoices}
                    loading={invoiceHook.loading}
                    lastFetchTime={invoiceHook.lastFetchTime}
                    onRefresh={refreshInvoices}
                    onViewDetail={handleViewDetail}
                    onPreview={invoiceHook.previewInvoice}
                    onDownload={invoiceHook.downloadPdf}
                    isDocLoading={invoiceHook.isDocLoading}
                    isAnyDocLoading={invoiceHook.isAnyDocLoading}
                    showFilters={showFilters}
                    showSovosCancelColumn={isSovosBilling && (activeTab === "e-archive" || activeTab === "overview" || activeTab === "e-invoice-out")}
                    emptyTitle={tabMeta?.emptyTitle}
                    emptyDescription={tabMeta?.emptyDescription}
                />
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
                return renderDocTab(invoiceHook.invoices, { showFilters: true });

            case "e-archive":
                return renderDocTab(tabInvoices);

            case "e-invoice-out":
            case "e-invoice-in":
                return renderDocTab(tabInvoices);

            case "e-despatch":
                return renderDocTab(tabInvoices);

            case "auto-invoice":
                return (
                    <AutoInvoicePanel
                        autoInvoice={autoInvoice}
                        settingsRequestTick={autoInvoiceSettingsTick}
                        processSingleOrder={processSingleOrderAndRefresh}
                    />
                );

            case "analysis":
                if (invoiceHook.loading && invoiceHook.invoices.length === 0) {
                    return <LoadingState message="Belgeler yükleniyor..." />;
                }
                return (
                    <Suspense fallback={<LoadingState message="Analiz modülü yükleniyor..." />}>
                        <AdvancedAnalysis
                            invoices={invoiceHook.invoices}
                            onRefresh={refreshInvoices}
                            parentLoading={invoiceHook.loading}
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
                        onOpenProviderSettings={(provider) => {
                            if (provider.id === "qnb-esolutions" || provider.id === "sovos") {
                                setProviderSettingsHint("");
                                setActiveTab("auto-invoice");
                                setAutoInvoiceSettingsTick((n) => n + 1);
                                return;
                            }
                            setProviderSettingsHint(
                                "Bu sağlayıcıda gelişmiş ayar formu henüz yok. Bağlantı bilgilerini güncellemek için önce bağlantıyı kesip aynı karttan yeniden “Bağlan” ile giriş yapın."
                            );
                        }}
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
        <div
            className={`billing-page ${embedded ? "billing-page--embedded" : "billing-page--full"}`}
            style={{
                width: "100%",
                minHeight: embedded ? "auto" : "100vh",
                background: colors.bg,
                padding: 0,
                margin: 0,
                boxSizing: "border-box",
            }}
        >
            {/* ── HEADER ── */}
            <div
                className="billing-page-header"
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
                            e-Fatura, e-Arşiv, e-İrsaliye — Tüm e-belge işlemlerinizi tek yerden yönetin
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {providers.isConnected && (
                            <Pill color={colors.green}>
                                <FaCheckCircle /> {providers.activeProvider.name} — {providers.activeProvider.env === "production" ? "Canlı" : "Test"}
                            </Pill>
                        )}
                        {providers.isConnected && activeTab === "overview" && (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => openCreateModal()}
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
            <div style={{ padding: "clamp(1rem, 2vw, 1.5rem) clamp(1rem, 2.5vw, 2rem)", maxWidth: "100%", boxSizing: "border-box" }}>
                {invoiceHook.actionError && (
                    <div style={{ marginBottom: "1rem" }}>
                        <AlertBox
                            type="error"
                            message={invoiceHook.actionError}
                            onClose={invoiceHook.clearActionError}
                        />
                    </div>
                )}
                {providerSettingsHint && activeTab === "providers" && (
                    <div style={{ marginBottom: "1rem" }}>
                        <AlertBox
                            type="info"
                            message={providerSettingsHint}
                            onClose={() => setProviderSettingsHint("")}
                        />
                    </div>
                )}
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
                    initialDocType={createModalInitialType}
                    onCreateInvoice={invoiceHook.createInvoice}
                    onClose={() => setShowCreateModal(false)}
                    onGoToProviders={() => setActiveTab("providers")}
                    onNavigateTab={navigateToTab}
                />
            )}

            {/* ═══ FATURA DETAY MODAL ═══ */}
            {invoiceHook.selectedInvoice && (
                <InvoiceDetailModal
                    invoice={invoiceHook.selectedInvoice}
                    detailData={invoiceHook.detailData}
                    detailLoading={invoiceHook.detailLoading}
                    isDocLoading={invoiceHook.isDocLoading}
                    isAnyDocLoading={invoiceHook.isAnyDocLoading}
                    onClose={handleCloseDetail}
                    onPreview={invoiceHook.previewInvoice}
                    onDownload={invoiceHook.downloadPdf}
                    onRefreshStatus={invoiceHook.refreshInvoiceStatus}
                    onCancel={invoiceHook.cancelInvoice}
                    onDelete={invoiceHook.deleteInvoice}
                    onRespond={invoiceHook.respondToInvoice}
                    onDownloadSigned={invoiceHook.downloadSignedXml}
                    onRetrigger={invoiceHook.retriggerInvoice}
                    onDetailedQuery={invoiceHook.detailedQuery}
                    actionError={invoiceHook.actionError}
                />
            )}

            {/* ── Global Keyframes ── */}
            <style>{globalKeyframes}</style>
        </div>
    );
};

export default BillingPage;
