/**
 * Dashtock Radar — AI ürün fırsat motoru (v5 arayüz)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { FaSpinner, FaExclamationTriangle, FaSync, FaCrosshairs, FaSatellite } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import {
    getOpportunities,
    refreshOpportunities,
    recordOpportunityAction,
    getProductOpportunities,
    unwrapRadar,
} from "../services/radarApi";
import { FILTER_OPTIONS } from "../constants/radarProLabels";
import { sortOpportunities, sortProducts } from "../components/radar/radarUtils";
import RadarShell from "../components/radar/RadarShell";
import RadarToolbar from "../components/radar/RadarToolbar";
import RadarOpportunityCard from "../components/radar/RadarOpportunityCard";
import RadarProductCard from "../components/radar/RadarProductCard";
import RadarSimulationModal from "../components/radar/RadarSimulationModal";
import RadarInsightsTab, { invalidateRadarInsightsCache } from "../components/radar/RadarInsightsTab";
import RadarTabGuide from "../components/radar/RadarTabGuide";
import "../styles/RadarProPage.css";

export default function RadarProPage() {
    const { resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";

    const [mainTab, setMainTab] = useState("opportunities");

    const [opportunities, setOpportunities] = useState([]);
    const [oppInitialLoading, setOppInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [infoMessage, setInfoMessage] = useState("");
    const [persistWarning, setPersistWarning] = useState("");
    const [activeFilter, setActiveFilter] = useState("best");
    const [keywordFilter, setKeywordFilter] = useState("");
    const [simOpp, setSimOpp] = useState(null);
    const [radarMeta, setRadarMeta] = useState(null);
    const oppFetchedRef = useRef(false);

    const [products, setProducts] = useState([]);
    const [productsInitialLoading, setProductsInitialLoading] = useState(false);
    const [productsError, setProductsError] = useState("");
    const [productSort, setProductSort] = useState("score");
    const [productStats, setProductStats] = useState({ total: 0, avgScore: 0, avgProfit: 0 });
    const productsFetchedRef = useRef(false);

    const loadOpportunities = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setOppInitialLoading(true);
        setError("");
        setInfoMessage("");
        try {
            const data = unwrapRadar(await getOpportunities({}));
            setOpportunities(data.opportunities || []);
            setRadarMeta(data.meta || null);
            setAnalyzing(data.stats?.analyzing === true);
            setPersistWarning(data.stats?.persistWarning || "");
            if (data.message) setInfoMessage(data.message);
            oppFetchedRef.current = true;
        } catch (err) {
            setError(err?.response?.data?.message || err.message || "Fırsatlar yüklenemedi");
        } finally {
            if (!silent) setOppInitialLoading(false);
        }
    }, []);

    const loadProducts = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setProductsInitialLoading(true);
        setProductsError("");
        try {
            const data = unwrapRadar(await getProductOpportunities({ limit: 80 }));
            setProducts(data.products || []);
            setProductStats(data.stats || { total: 0, avgScore: 0, avgProfit: 0 });
            productsFetchedRef.current = true;
        } catch (err) {
            setProductsError(err?.response?.data?.message || err.message || "Ürünler yüklenemedi");
        } finally {
            if (!silent) setProductsInitialLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOpportunities();
    }, [loadOpportunities]);

    useEffect(() => {
        if (mainTab !== "products" || productsFetchedRef.current) return;
        loadProducts();
    }, [mainTab, loadProducts]);

    useEffect(() => {
        if (!analyzing) return;
        let attempts = 0;
        const maxAttempts = 30;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const data = unwrapRadar(await getOpportunities({}));
                if (data.opportunities?.length > 0) {
                    setOpportunities(data.opportunities);
                    if (data.meta) setRadarMeta(data.meta);
                    setPersistWarning(data.stats?.persistWarning || "");
                    setAnalyzing(false);
                    setInfoMessage("");
                    return;
                }
                if (data.stats?.analyzing === false && attempts >= 3) {
                    setAnalyzing(false);
                    if (data.message) setInfoMessage(data.message);
                }
                if (attempts >= maxAttempts) {
                    setAnalyzing(false);
                    setInfoMessage("Analiz beklenenden uzun sürüyor. Lütfen birkaç dakika sonra yenileyin.");
                }
            } catch {
                /* ignore */
            }
        }, 12000);
        return () => clearInterval(interval);
    }, [analyzing]);

    const handleRefresh = async () => {
        setRefreshing(true);
        setError("");
        setInfoMessage("");
        try {
            const data = unwrapRadar(await refreshOpportunities());
            if (data.opportunities?.length > 0) {
                setOpportunities(data.opportunities);
                if (data.meta) setRadarMeta(data.meta);
                setAnalyzing(false);
            } else if (data.stats?.analyzing) {
                setAnalyzing(true);
            } else {
                setAnalyzing(false);
            }
            setPersistWarning(
                data.stats?.persistWarning ||
                    (data.persisted === false
                        ? "Sonuçlar geçici olarak gösteriliyor; veritabanı kotası dolu olabilir."
                        : "")
            );
            if (data.message) setInfoMessage(data.message);
            oppFetchedRef.current = true;
            productsFetchedRef.current = false;
            invalidateRadarInsightsCache();
            if (mainTab === "products") {
                await loadProducts();
            }
        } catch (err) {
            setError("Yenileme başarısız: " + (err.message || ""));
        } finally {
            setRefreshing(false);
        }
    };

    const handleDismiss = async (id) => {
        try {
            await recordOpportunityAction(id, "dismissed");
            setOpportunities((prev) => prev.filter((o) => o._id !== id));
        } catch {
            /* ignore */
        }
    };

    const handleAddToStore = async (product) => {
        if (product.opportunityId) {
            try {
                await recordOpportunityAction(product.opportunityId, "added_to_store");
            } catch {
                /* ignore */
            }
        }
        if (product.url) window.open(product.url, "_blank", "noopener,noreferrer");
    };

    const handleKeywordSelect = (kw) => {
        if (!kw) return;
        setKeywordFilter(String(kw).toLowerCase());
        setMainTab("opportunities");
    };

    const filterSortKey = FILTER_OPTIONS.find((f) => f.key === activeFilter)?.sortBy || "best";

    const sortedOpportunities = useMemo(
        () => sortOpportunities(opportunities, filterSortKey === null ? "best" : filterSortKey),
        [opportunities, filterSortKey]
    );

    const displayedOpportunities = useMemo(() => {
        if (!keywordFilter) return sortedOpportunities;
        return sortedOpportunities.filter((o) =>
            String(o.keyword || "").toLowerCase().includes(keywordFilter)
        );
    }, [sortedOpportunities, keywordFilter]);

    const sortedProducts = useMemo(
        () => sortProducts(products, productSort),
        [products, productSort]
    );

    const oppStats = useMemo(() => {
        const list = displayedOpportunities;
        if (!list.length) return null;
        const avg = Math.round(
            list.reduce((s, o) => s + (o.totalScore || 0), 0) / list.length
        );
        const strong = list.filter((o) => (o.totalScore || 0) >= 75).length;
        return { count: list.length, avg, strong };
    }, [displayedOpportunities]);

    const oppPanelLoading = oppInitialLoading && !oppFetchedRef.current;
    const productsPanelLoading = productsInitialLoading && !productsFetchedRef.current;

    return (
        <div className="rp-page" data-theme={isDark ? "dark" : "light"}>
            <RadarShell
                mainTab={mainTab}
                onTabChange={setMainTab}
                refreshing={refreshing}
                analyzing={analyzing}
                onRefresh={handleRefresh}
                productCount={productStats?.total || 0}
                toolbar={
                    <RadarToolbar
                        mainTab={mainTab}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        productSort={productSort}
                        onProductSortChange={setProductSort}
                        productStats={productStats}
                        radarMeta={radarMeta}
                        oppStats={oppStats}
                        loading={oppPanelLoading}
                        opportunitiesTabActive={mainTab === "opportunities"}
                    />
                }
            >
                <div
                    className={`rp-panel ${mainTab === "opportunities" ? "is-visible" : ""}`}
                    role="tabpanel"
                    hidden={mainTab !== "opportunities"}
                >
                    <RadarTabGuide tabKey="opportunities" />

                    {keywordFilter && (
                        <div className="rp-banner rp-banner--filter">
                            <span>Kelime filtresi: <strong>{keywordFilter}</strong></span>
                            <button type="button" className="rp-btn-ghost" onClick={() => setKeywordFilter("")}>
                                Temizle
                            </button>
                        </div>
                    )}

                    {analyzing && !refreshing && (
                        <div className="rp-banner rp-banner--scan">
                            <FaSpinner className="rp-spin" />
                            <span>AI taraması devam ediyor — sonuçlar otomatik güncellenir.</span>
                        </div>
                    )}

                    {persistWarning && !analyzing && (
                        <div className="rp-banner rp-banner--filter">
                            <FaExclamationTriangle />
                            <span>{persistWarning}</span>
                        </div>
                    )}

                    {infoMessage && !error && !analyzing && (
                        <div className="rp-banner rp-banner--filter">
                            <span>{infoMessage}</span>
                        </div>
                    )}

                    {oppPanelLoading && (
                        <div className="rp-state rp-state--loading">
                            <div className="rp-state-spinner" />
                            <p>Fırsatlar yükleniyor…</p>
                        </div>
                    )}

                    {error && !oppPanelLoading && (
                        <div className="rp-banner rp-banner--error">
                            <FaExclamationTriangle />
                            <span>{error}</span>
                            <button type="button" className="rp-btn-ghost" onClick={() => loadOpportunities()}>
                                Tekrar dene
                            </button>
                        </div>
                    )}

                    {!oppPanelLoading && !analyzing && !error && displayedOpportunities.length === 0 && (
                        <div className="rp-state rp-state--empty">
                            <div className="rp-state-icon">
                                <FaSatellite />
                            </div>
                            <h2>Henüz fırsat yok</h2>
                            <p>Kataloğunuzu bağlayın veya yeni bir AI taraması başlatın.</p>
                            <button type="button" className="rp-btn-primary rp-btn-primary--lg" onClick={handleRefresh}>
                                <FaSync /> Analiz başlat
                            </button>
                        </div>
                    )}

                    {displayedOpportunities.length > 0 && (
                        <div className="rp-opp-grid">
                            {displayedOpportunities.map((opp, idx) => (
                                <RadarOpportunityCard
                                    key={opp._id || `${opp.keyword}-${idx}`}
                                    opp={opp}
                                    index={idx}
                                    onSimulate={setSimOpp}
                                    onDismiss={handleDismiss}
                                    onKeywordClick={handleKeywordSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className={`rp-panel ${mainTab === "products" ? "is-visible" : ""}`}
                    role="tabpanel"
                    hidden={mainTab !== "products"}
                >
                    <RadarTabGuide tabKey="products" />

                    {productsPanelLoading && (
                        <div className="rp-state rp-state--loading">
                            <div className="rp-state-spinner" />
                            <p>Ürünler yükleniyor…</p>
                        </div>
                    )}
                    {productsError && !productsPanelLoading && (
                        <div className="rp-banner rp-banner--error">
                            <FaExclamationTriangle />
                            <span>{productsError}</span>
                            <button type="button" className="rp-btn-ghost" onClick={() => loadProducts()}>
                                Tekrar dene
                            </button>
                        </div>
                    )}
                    {!productsPanelLoading && !productsError && sortedProducts.length === 0 && (
                        <div className="rp-state rp-state--empty">
                            <div className="rp-state-icon">
                                <FaCrosshairs />
                            </div>
                            <h2>Ürün örneği bulunamadı</h2>
                            <p>Önce Fırsat Radarı analizi çalıştırın; ardından bu liste dolar.</p>
                            <button type="button" className="rp-btn-primary rp-btn-primary--lg" onClick={handleRefresh}>
                                <FaSync /> Analiz başlat
                            </button>
                        </div>
                    )}
                    {sortedProducts.length > 0 && (
                        <div className="rp-product-grid">
                            {sortedProducts.map((product, idx) => (
                                <RadarProductCard
                                    key={`${product.opportunityId}-${product.name}-${idx}`}
                                    product={product}
                                    index={idx}
                                    onAddToStore={handleAddToStore}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className={`rp-panel ${mainTab === "insights" ? "is-visible" : ""}`}
                    role="tabpanel"
                    hidden={mainTab !== "insights"}
                >
                    <RadarInsightsTab
                        active={mainTab === "insights"}
                        onKeywordSelect={handleKeywordSelect}
                        onGoOpportunities={() => {
                            setMainTab("opportunities");
                            if (!oppFetchedRef.current) loadOpportunities();
                        }}
                    />
                </div>
            </RadarShell>

            <AnimatePresence>
                {simOpp && <RadarSimulationModal opp={simOpp} onClose={() => setSimOpp(null)} />}
            </AnimatePresence>
        </div>
    );
}
