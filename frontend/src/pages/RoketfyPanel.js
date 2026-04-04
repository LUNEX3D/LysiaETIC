    /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LysiaRadar PANELİ V5 — Modern Dark Theme Arayüz
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trendyol pazar istihbaratı paneli — anlık veri, hiyerarşik kategori sistemi.
 *
 * 8 Sekme:
 *   0. Çok Satanlar       — Anlık en çok satan ürünler (kategori/alt kategori)
 *   1. Flaş Ürünler       — Anlık yüksek indirimli ürünler
 *   2. Ürün Araştırması   — Anahtar kelime ile arama
 *   3. Rakip Araştırması  — Ürün URL veya kelime ile rakip analizi
 *   4. Listeleme Analisti — Kendi ürünlerinin skoru
 *   5. AI İçerik Yazarı   — SEO başlık/açıklama üretimi
 *   6. Yorum Analizi      — Trendyol yorumları NLP analizi
 *   7. Kelime & Fiyat     — Anahtar kelime araştırması + fiyat önerisi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    FaSearch, FaSync, FaFire, FaTrophy, FaChevronRight,
    FaChevronDown, FaHeart, FaStar, FaShoppingCart,
    FaEye, FaTag, FaStore, FaChartLine, FaBolt,
    FaTh, FaList, FaBoxOpen, FaPercent, FaTruck,
    FaArrowLeft, FaArrowRight, FaTimes, FaRocket,
    FaCopy, FaBarcode, FaComments, FaKey, FaDollarSign,
    FaPen, FaRobot, FaBalanceScale, FaClipboardCheck,
    FaLightbulb, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaChevronUp, FaGlobe, FaFilter
} from "react-icons/fa";
import API from "../services/api";
import "../styles/RoketfyPanel.css";

// ─── Kategori İkonları & Renkleri ────────────────────────────────────────────
const CATEGORY_META = {
    "kadin":         { icon: "👗", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    "erkek":         { icon: "👔", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    "aksesuar":      { icon: "👜", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    "ayakkabi":      { icon: "👟", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    "ev-mobilya":    { icon: "🏠", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    "kozmetik":      { icon: "💄", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    "elektronik":    { icon: "📱", color: "#4ecdc4", bg: "rgba(78,205,196,0.12)" },
    "supermarket":   { icon: "🛒", color: "#f27a1a", bg: "rgba(242,122,26,0.12)" },
    "anne-bebek":    { icon: "👶", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    "spor-outdoor":  { icon: "⚽", color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
};

const SORT_OPTIONS = [
    { value: "BEST_SELLER", label: "En Çok Satanlar" },
    { value: "MOST_RATED", label: "En Çok Değerlendirilen" },
    { value: "PRICE_BY_ASC", label: "Fiyat: Düşükten Yükseğe" },
    { value: "PRICE_BY_DESC", label: "Fiyat: Yüksekten Düşüğe" },
    { value: "MOST_RECENT", label: "En Yeniler" },
];

const TAB_CONFIG = [
    { id: "best-sellers",  label: "Çok Satanlar",       icon: FaTrophy,         color: "accent" },
    { id: "flash",         label: "Flaş Ürünler",       icon: FaBolt,           color: "orange" },
    { id: "research",      label: "Ürün Araştırması",   icon: FaSearch,         color: "accent" },
    { id: "competitor",    label: "Rakip Araştırması",   icon: FaBalanceScale,   color: "accent" },
    { id: "listing",       label: "Listeleme Analisti",  icon: FaClipboardCheck, color: "accent" },
    { id: "content",       label: "AI İçerik Yazarı",   icon: FaPen,            color: "accent" },
    { id: "reviews",       label: "Yorum Analizi",       icon: FaComments,       color: "accent" },
    { id: "keywords",      label: "Kelime & Fiyat",      icon: FaKey,            color: "accent" },
];

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString("tr-TR");
const fmtPrice = (n) => `₺${(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const salesClass = (s) => s > 10 ? "high" : s > 3 ? "medium" : "low";
const scoreColor = (s) => s >= 80 ? "var(--rk-green)" : s >= 60 ? "var(--rk-blue)" : s >= 40 ? "var(--rk-yellow)" : "var(--rk-red)";
const gradeColor = (g) => !g ? "var(--rk-text-sec)" : g.startsWith("A") ? "var(--rk-green)" : g.startsWith("B") ? "var(--rk-blue)" : g.startsWith("C") ? "var(--rk-yellow)" : "var(--rk-red)";
const rankClass = (i) => i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "normal";

// ═════════════════════════════════════════════════════════════════════════════
// ANA PANEL
// ═════════════════════════════════════════════════════════════════════════════

export default function RoketfyPanel() {
    // ── Genel State ──
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // grid | table

    // ── Kategori State ──
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubCategory, setSelectedSubCategory] = useState("");
    const [expandedCategory, setExpandedCategory] = useState("");
    const [selectedSort, setSelectedSort] = useState("BEST_SELLER");

    // ── Çok Satanlar State ──
    const [bestSellers, setBestSellers] = useState(null);

    // ── Flaş Ürünler State ──
    const [flashProducts, setFlashProducts] = useState(null);

    // ── Ürün Araştırması State ──
    const [searchQuery, setSearchQuery] = useState("");
    const [researchResult, setResearchResult] = useState(null);
    const [researchSort, setResearchSort] = useState("BEST_SELLER");
    const [researchLoading, setResearchLoading] = useState(false);
    const lastResearchQueryRef = useRef("");

    // ── Rakip State ──
    const [compProductUrl, setCompProductUrl] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [compResult, setCompResult] = useState(null);
    const [myProducts, setMyProducts] = useState([]);
    const [myProductsLoaded, setMyProductsLoaded] = useState(false);
    const [myProductSearch, setMyProductSearch] = useState("");
    const [compLoading, setCompLoading] = useState(false);
    const [compAnalyzingBarcode, setCompAnalyzingBarcode] = useState("");

    // ── Listeleme State ──
    const [listingBarcode, setListingBarcode] = useState("");
    const [listingResult, setListingResult] = useState(null);
    const [bulkResult, setBulkResult] = useState(null);

    // ── İçerik State ──
    const [contentBarcode, setContentBarcode] = useState("");
    const [contentKeywords, setContentKeywords] = useState("");
    const [contentProductInfo, setContentProductInfo] = useState("");
    const [titleResult, setTitleResult] = useState(null);
    const [descResult, setDescResult] = useState(null);

    // ── Yorum State ──
    const [reviewInput, setReviewInput] = useState("");
    const [reviewResult, setReviewResult] = useState(null);

    // ── Anahtar Kelime State ──
    const [kwSeed, setKwSeed] = useState("");
    const [kwResult, setKwResult] = useState(null);

    // ── Fiyat State ──
    const [priceBarcode, setPriceBarcode] = useState("");
    const [priceResult, setPriceResult] = useState(null);

    const lastFetchRef = useRef(null);
    const autoRefreshRef = useRef(null);
    const [nextRefreshIn, setNextRefreshIn] = useState(0);
    const countdownRef = useRef(null);
    const AUTO_REFRESH_MS = 3 * 60 * 1000; // 3 dakika

    // ── API Çağrısı ──
    const apiCall = useCallback(async (method, url, data, setter) => {
        setLoading(true);
        setError("");
        try {
            const res = method === "get" ? await API.get(url) : await API.post(url, data);
            if (setter) setter(res.data);
            return res.data;
        } catch (err) {
            setError(err.response?.data?.message || "İşlem başarısız");
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    // ── Kategorileri Yükle ──
    useEffect(() => {
        API.get("/roketfy/categories/detailed")
            .then(res => { if (res.data?.categories) setCategories(res.data.categories); })
            .catch(() => {});
    }, []);

    // ── İlk Yüklemede & Tab Değişiminde Anlık Veri Çek ──
    useEffect(() => {
        if (activeTab === 0 && !bestSellers) {
            fetchBestSellers();
        }
        if (activeTab === 1 && !flashProducts) {
            fetchFlashProducts();
        }
        if (activeTab === 3 && !myProductsLoaded) {
            loadMyProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // ── Kullanıcının Ürünlerini Yükle (Rakip Araştırması için) ──
    const loadMyProducts = useCallback(async (search = "") => {
        try {
            const url = `/roketfy/competitor/my-products?limit=500${search ? `&search=${encodeURIComponent(search)}` : ""}`;
            const res = await API.get(url);
            if (res.data?.products) {
                setMyProducts(res.data.products);
                setMyProductsLoaded(true);
            }
        } catch (err) {
            // Sessiz hata — ürün yoksa boş göster
            setMyProducts([]);
            setMyProductsLoaded(true);
        }
    }, []);

    // ── Tek Tıkla Rakip Analizi (Barkod ile) ──
    const analyzeCompetitorByBarcode = useCallback(async (barcode) => {
        setCompLoading(true);
        setCompAnalyzingBarcode(barcode);
        setCompResult(null);
        setError("");
        try {
            const res = await API.post("/roketfy/competitor/analyze", { barcode });
            if (res.data) setCompResult(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "Rakip analizi başarısız");
        } finally {
            setCompLoading(false);
            setCompAnalyzingBarcode("");
        }
    }, []);

    // ── Auto-Refresh: Her 3 dakikada bir otomatik yenile ──
    useEffect(() => {
        // Countdown başlat
        const startCountdown = () => {
            setNextRefreshIn(AUTO_REFRESH_MS / 1000);
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = setInterval(() => {
                setNextRefreshIn(prev => {
                    if (prev <= 1) return AUTO_REFRESH_MS / 1000;
                    return prev - 1;
                });
            }, 1000);
        };

        // Auto-refresh interval
        if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = setInterval(() => {
            if (activeTab === 0) {
                fetchBestSellers();
            } else if (activeTab === 1) {
                fetchFlashProducts();
            } else if (activeTab === 2 && lastResearchQueryRef.current) {
                fetchResearchProducts(lastResearchQueryRef.current);
            }
            startCountdown();
        }, AUTO_REFRESH_MS);

        startCountdown();

        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedCategory, selectedSort]);

    // ── Veri Çekme Fonksiyonları — Anlık Trendyol Verisi ──
    const fetchBestSellers = useCallback(async (catKey = "") => {
        setLoading(true);
        setError("");
        try {
            const catParam = catKey || selectedCategory;
            const sortParam = selectedSort || "BEST_SELLER";
            const url = `/roketfy/research/best-sellers?limit=100&sort=${sortParam}${catParam ? `&category=${catParam}` : ""}`;
            const res = await API.get(url);
            const data = res.data.bestSellers || {};
            setBestSellers({
                products: data.products || [],
                totalCount: data.totalCount || data.products?.length || 0,
                source: data.source || "unknown",
            });
            lastFetchRef.current = new Date();
        } catch (err) {
            setError(err.response?.data?.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, selectedSort]);

    const fetchFlashProducts = useCallback(async (catKey = "") => {
        setLoading(true);
        setError("");
        try {
            const catParam = catKey || selectedCategory;
            const url = `/roketfy/research/flash-products?limit=100${catParam ? `&category=${catParam}` : ""}`;
            const res = await API.get(url);
            const data = res.data.flashProducts || {};
            setFlashProducts({
                products: data.products || [],
                totalCount: data.totalCount || data.products?.length || 0,
                source: data.source || "unknown",
            });
            lastFetchRef.current = new Date();
        } catch (err) {
            setError(err.response?.data?.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    // ── Kategori Seçimi ──
    const handleCategoryClick = (catKey) => {
        if (expandedCategory === catKey) {
            setExpandedCategory("");
        } else {
            setExpandedCategory(catKey);
        }

        setSelectedCategory(catKey);
        setSelectedSubCategory("");

        if (activeTab === 0) {
            setBestSellers(null);
            fetchBestSellers(catKey);
        } else if (activeTab === 1) {
            setFlashProducts(null);
            fetchFlashProducts(catKey);
        }
    };

    const handleSubCategoryClick = (catKey, subCat) => {
        setSelectedCategory(catKey);
        setSelectedSubCategory(subCat.key);

        // Alt kategori seçildiğinde arama terimi ile araştırma yap
        if (activeTab === 0 || activeTab === 1) {
            setLoading(true);
            setError("");
            API.post("/roketfy/research/products", {
                query: subCat.searchTerm,
                sort: selectedSort,
            }).then(res => {
                const allProducts = res.data.research?.topProducts || [];
                if (activeTab === 0) {
                    setBestSellers({
                        products: allProducts,
                        totalCount: res.data.research?.totalResults || allProducts.length,
                        source: "search_subcategory",
                    });
                } else {
                    // Flaş ürünler için indirimli olanları filtrele
                    const prods = allProducts.filter(p => p.discountPercentage > 5);
                    setFlashProducts({
                        products: prods.length > 0 ? prods : allProducts,
                        totalCount: prods.length > 0 ? prods.length : allProducts.length,
                        source: "search_subcategory_flash",
                    });
                }
                lastFetchRef.current = new Date();
            }).catch(err => {
                setError(err.response?.data?.message || "Veriler yüklenemedi");
            }).finally(() => setLoading(false));
        }
    };

    // ── Sıralama değiştiğinde yeniden çek ──
    useEffect(() => {
        if (activeTab === 0 && bestSellers) {
            setBestSellers(null);
            fetchBestSellers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSort]);

    // ── Ürün Araştırması: Arama fonksiyonu ──
    const fetchResearchProducts = useCallback(async (queryOverride, sortOverride) => {
        const q = queryOverride || lastResearchQueryRef.current || searchQuery;
        if (!q) return;
        lastResearchQueryRef.current = q;
        setResearchLoading(true);
        setError("");
        try {
            const sortParam = sortOverride || researchSort || "BEST_SELLER";
            const res = await API.post("/roketfy/research/products", {
                query: q,
                sort: sortParam,
                limit: 100,
            });
            if (res.data) setResearchResult(res.data);
            lastFetchRef.current = new Date();
        } catch (err) {
            setError(err.response?.data?.message || "Arama başarısız");
        } finally {
            setResearchLoading(false);
        }
    }, [searchQuery, researchSort]);

    // ── Ürün Araştırması: Sıralama değiştiğinde yeniden çek ──
    useEffect(() => {
        if (activeTab === 2 && researchResult && lastResearchQueryRef.current) {
            fetchResearchProducts(lastResearchQueryRef.current, researchSort);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [researchSort]);

    const handleRefresh = () => {
        // Countdown sıfırla
        setNextRefreshIn(AUTO_REFRESH_MS / 1000);
        if (activeTab === 0) {
            setBestSellers(null);
            fetchBestSellers();
        } else if (activeTab === 1) {
            setFlashProducts(null);
            fetchFlashProducts();
        } else if (activeTab === 2 && lastResearchQueryRef.current) {
            fetchResearchProducts(lastResearchQueryRef.current);
        }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Kategori Paneli (Sol Sidebar)
    // ═════════════════════════════════════════════════════════════════════════
    const renderCategoryPanel = () => (
        <div className="rk-categories">
            <h4 className="rk-cat-title">Kategoriler</h4>

            {/* Tüm Kategoriler */}
            <div
                className={`rk-cat-item ${!selectedCategory ? "active" : ""}`}
                onClick={() => { setSelectedCategory(""); setSelectedSubCategory(""); setExpandedCategory(""); if (activeTab === 0) fetchBestSellers(""); else if (activeTab === 1) fetchFlashProducts(""); }}
            >
                <div className="rk-cat-item-left">
                    <div className="rk-cat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}>
                        <FaGlobe />
                    </div>
                    <span className="rk-cat-name">Tüm Kategoriler</span>
                </div>
            </div>

            {categories.map(cat => {
                const meta = CATEGORY_META[cat.key] || { icon: "📦", color: "#8b95a5", bg: "rgba(139,149,165,0.12)" };
                const isExpanded = expandedCategory === cat.key;
                const isActive = selectedCategory === cat.key && !selectedSubCategory;

                return (
                    <div key={cat.key}>
                        <div
                            className={`rk-cat-item ${isActive ? "active" : ""} ${isExpanded ? "expanded" : ""}`}
                            onClick={() => handleCategoryClick(cat.key)}
                        >
                            <div className="rk-cat-item-left">
                                <div className="rk-cat-icon" style={{ background: meta.bg, fontSize: 16 }}>
                                    {meta.icon}
                                </div>
                                <span className="rk-cat-name">{cat.name}</span>
                            </div>
                            {cat.subCategories?.length > 0 && (
                                <FaChevronRight className="rk-cat-chevron" />
                            )}
                        </div>

                        {/* Alt Kategoriler */}
                        {cat.subCategories?.length > 0 && (
                            <div className={`rk-subcats ${isExpanded ? "open" : ""}`}>
                                {cat.subCategories.map(sub => (
                                    <div
                                        key={sub.key}
                                        className={`rk-subcat-item ${selectedSubCategory === sub.key ? "active" : ""}`}
                                        onClick={(e) => { e.stopPropagation(); handleSubCategoryClick(cat.key, sub); }}
                                    >
                                        <span className="rk-subcat-dot" />
                                        <span>{sub.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Ürün Kartı
    // ═════════════════════════════════════════════════════════════════════════
    const ProductCard = ({ product, index, isFlash }) => (
        <div className="rk-product-card" onClick={() => product.url && window.open(product.url, "_blank")}>
            <div className="rk-product-img-wrap">
                {product.imageUrl && (
                    <img
                        className="rk-product-img"
                        src={product.imageUrl}
                        alt={product.name}
                        onError={(e) => { e.target.style.display = "none"; }}
                    />
                )}
                <div className={`rk-product-rank ${rankClass(index)}`}>{index + 1}</div>
                <div className="rk-product-badges">
                    {product.discountPercentage > 0 && (
                        <span className="rk-badge rk-badge-discount">-%{product.discountPercentage}</span>
                    )}
                    {isFlash && (
                        <span className="rk-badge rk-badge-flash"><FaBolt /> FLAŞ</span>
                    )}
                    {(product.freeCargo || product.hasFreeCargo) && (
                        <span className="rk-badge rk-badge-cargo"><FaTruck /> Ücretsiz</span>
                    )}
                    {product.isBestSeller && (
                        <span className="rk-badge rk-badge-best"><FaTrophy /> #1</span>
                    )}
                </div>
            </div>
            <div className="rk-product-body">
                <div className="rk-product-brand">{product.brand || product.merchantName || "—"}</div>
                <div className="rk-product-name">{product.name}</div>
                <div className="rk-product-price-row">
                    <span className="rk-product-price">{fmtPrice(product.price)}</span>
                    {product.originalPrice > product.price && (
                        <span className="rk-product-price-old">{fmtPrice(product.originalPrice)}</span>
                    )}
                </div>
                <div className="rk-product-meta">
                    <div className="rk-meta-item">
                        <FaHeart style={{ color: "var(--rk-pink)" }} />
                        <span className="rk-meta-val">{fmt(product.favoriteCount)}</span>
                    </div>
                    {product.orderCount > 0 && (
                        <div className="rk-meta-item">
                            <FaShoppingCart style={{ color: "var(--rk-accent)" }} />
                            <span className="rk-meta-val">{fmt(product.orderCount)} sipariş</span>
                        </div>
                    )}
                    <div className="rk-meta-item">
                        <FaStar style={{ color: "var(--rk-yellow)" }} />
                        <span className="rk-meta-val">{product.ratingScore || "—"}{product.ratingCount > 0 ? ` (${fmt(product.ratingCount)})` : ""}</span>
                    </div>
                    <div className="rk-meta-item">
                        <FaChartLine style={{ color: "var(--rk-green)" }} />
                        <span className="rk-meta-val">{fmtPrice(product.estimatedMonthlyRevenue)}/ay</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Ürün Tablosu
    // ═════════════════════════════════════════════════════════════════════════
    const ProductTable = ({ products, isFlash }) => (
        <div className="rk-product-table-wrap">
            <table className="rk-product-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>ÜRÜN</th>
                        <th className="right">FİYAT</th>
                        <th className="right">FAVORİ</th>
                        <th className="right">SİPARİŞ</th>
                        <th className="right">PUAN</th>
                        <th className="right">TAH. CİRO/AY</th>
                        {isFlash && <th className="right">İNDİRİM</th>}
                    </tr>
                </thead>
                <tbody>
                    {products.map((p, i) => (
                        <tr key={i} onClick={() => p.url && window.open(p.url, "_blank")}>
                            <td>
                                <div className={`rk-table-rank ${rankClass(i)}`}>{i + 1}</div>
                            </td>
                            <td>
                                <div className="rk-table-product-cell">
                                    {p.imageUrl && (
                                        <img className="rk-table-img" src={p.imageUrl} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                                    )}
                                    <div className="rk-table-product-info">
                                        <div className="rk-table-product-name">{(p.name || "").slice(0, 70)}</div>
                                        <div className="rk-table-product-brand">{p.brand || p.merchantName || "—"}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="right">
                                <div className="rk-table-price">{fmtPrice(p.price)}</div>
                                {p.originalPrice > p.price && (
                                    <div className="rk-table-price-old">{fmtPrice(p.originalPrice)}</div>
                                )}
                            </td>
                            <td className="right">
                                <div className="rk-table-fav">
                                    <FaHeart /> {fmt(p.favoriteCount)}
                                </div>
                            </td>
                            <td className="right">
                                <span className={`rk-table-sales ${salesClass(p.estimatedDailySales)}`}>
                                    {p.orderCount > 0 ? fmt(p.orderCount) : (p.estimatedDailySales || 0) + "/gün"}
                                </span>
                            </td>
                            <td className="right">
                                {p.ratingScore > 0 ? (
                                    <span style={{ color: "var(--rk-yellow)", fontWeight: 600 }}>
                                        <FaStar style={{ fontSize: 10, marginRight: 2 }} />{p.ratingScore}
                                        {p.ratingCount > 0 && <span style={{ color: "var(--rk-text-dim)", fontWeight: 400, fontSize: 10 }}> ({fmt(p.ratingCount)})</span>}
                                    </span>
                                ) : <span style={{ color: "var(--rk-text-dim)" }}>—</span>}
                            </td>
                            <td className="right">
                                <span className="rk-table-revenue">{fmtPrice(p.estimatedMonthlyRevenue)}</span>
                            </td>
                            {isFlash && (
                                <td className="right">
                                    <span className="rk-chip rk-chip-danger">-%{p.discountPercentage}</span>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: İstatistik Satırı
    // ═════════════════════════════════════════════════════════════════════════
    const StatsRow = ({ products }) => {
        if (!products?.length) return null;
        const prices = products.map(p => p.price).filter(p => p > 0);
        const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        const totalFav = products.reduce((s, p) => s + (p.favoriteCount || 0), 0);
        const avgSales = products.length > 0 ? Math.round(products.reduce((s, p) => s + (p.estimatedDailySales || 0), 0) / products.length) : 0;

        return (
            <div className="rk-stats-row">
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaBoxOpen /></div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Toplam Ürün</div>
                        <div className="rk-stat-value">{fmt(products.length)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}><FaDollarSign /></div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Ort. Fiyat</div>
                        <div className="rk-stat-value">{fmtPrice(avgPrice)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(236,72,153,0.12)", color: "var(--rk-pink)" }}><FaHeart /></div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Toplam Favori</div>
                        <div className="rk-stat-value">{fmt(totalFav)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(242,122,26,0.12)", color: "var(--rk-orange)" }}><FaChartLine /></div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Ort. Satış/Gün</div>
                        <div className="rk-stat-value">{avgSales}</div>
                    </div>
                </div>
            </div>
        );
    };

    // ── Veri Kaynağı Etiketi ──
    const DataSourceBadge = ({ source }) => {
        if (!source) return null;
        const isLive = source.includes("live") || source.includes("trendyol");
        const label = isLive ? "Anlık Trendyol Verisi" : source.includes("search") ? "Trendyol Arama" : "Veri";
        return (
            <span className={`rk-source-badge ${isLive ? "rk-source-live" : "rk-source-search"}`}>
                <span className={isLive ? "rk-live-dot" : ""} />
                {isLive ? "🔴 CANLI" : "🔍"} {label}
            </span>
        );
    };

    // ── Sonraki Yenileme Geri Sayımı ──
    const formatCountdown = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 0: ÇOK SATANLAR
    // ═════════════════════════════════════════════════════════════════════════
    const renderBestSellers = () => {
        const products = bestSellers?.products || [];
        const source = bestSellers?.source || "";

        return (
            <div className="rk-content">
                {/* Sort Bar */}
                <div className="rk-sort-bar">
                    <div className="rk-sort-left">
                        <span className="rk-sort-label">Sıralama:</span>
                        <select className="rk-sort-select" value={selectedSort} onChange={(e) => setSelectedSort(e.target.value)}>
                            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <div className="rk-view-toggle">
                            <button className={`rk-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}><FaTh /></button>
                            <button className={`rk-view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}><FaList /></button>
                        </div>
                    </div>
                    <div className="rk-result-count">
                        <DataSourceBadge source={source} />
                        <strong>{fmt(products.length)}</strong> ürün
                        {lastFetchRef.current && <span> · {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>}
                        {nextRefreshIn > 0 && <span className="rk-countdown"> · ⏱ {formatCountdown(nextRefreshIn)}</span>}
                    </div>
                </div>

                <StatsRow products={products} />

                {loading ? (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol'dan anlık veriler çekiliyor...</div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="rk-empty">
                        <FaTrophy className="rk-empty-icon" />
                        <div className="rk-empty-text">Henüz veri yok</div>
                        <div className="rk-empty-sub">Bir kategori seçin veya yenile butonuna tıklayın</div>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="rk-product-grid">
                        {products.map((p, i) => <ProductCard key={i} product={p} index={i} isFlash={false} />)}
                    </div>
                ) : (
                    <ProductTable products={products} isFlash={false} />
                )}
            </div>
        );
    };

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 1: FLAŞ ÜRÜNLER
    // ═════════════════════════════════════════════════════════════════════════
    const renderFlashProducts = () => {
        const products = flashProducts?.products || [];
        const source = flashProducts?.source || "";

        return (
            <div className="rk-content">
                <div className="rk-sort-bar">
                    <div className="rk-sort-left">
                        <span className="rk-sort-label" style={{ color: "var(--rk-orange)" }}>
                            <FaBolt style={{ marginRight: 4 }} /> Flaş İndirimler
                        </span>
                        <div className="rk-view-toggle">
                            <button className={`rk-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}><FaTh /></button>
                            <button className={`rk-view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}><FaList /></button>
                        </div>
                    </div>
                    <div className="rk-result-count">
                        <DataSourceBadge source={source} />
                        <strong>{fmt(products.length)}</strong> indirimli ürün
                        {lastFetchRef.current && <span> · {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>}
                        {nextRefreshIn > 0 && <span className="rk-countdown"> · ⏱ {formatCountdown(nextRefreshIn)}</span>}
                    </div>
                </div>

                <StatsRow products={products} />

                {loading ? (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol'dan flaş ürünler çekiliyor...</div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="rk-empty">
                        <FaBolt className="rk-empty-icon" />
                        <div className="rk-empty-text">Flaş ürün bulunamadı</div>
                        <div className="rk-empty-sub">Farklı bir kategori deneyin</div>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="rk-product-grid">
                        {products.map((p, i) => <ProductCard key={i} product={p} index={i} isFlash={true} />)}
                    </div>
                ) : (
                    <ProductTable products={products} isFlash={true} />
                )}
            </div>
        );
    };

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 2: ÜRÜN ARAŞTIRMASI
    // ═════════════════════════════════════════════════════════════════════════
    const renderProductResearch = () => {
        const research = researchResult?.research;
        const products = research?.topProducts || [];
        const isSearching = researchLoading;

        return (
            <div className="rk-content">
                <div className="rk-search-bar">
                    <div className="rk-search-input-wrap">
                        <FaSearch className="rk-search-icon" />
                        <input
                            className="rk-search-input"
                            placeholder="Trendyol'da ürün ara... (tişört, iphone kılıf, ayakkabı)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchQuery && fetchResearchProducts(searchQuery)}
                        />
                    </div>
                    <button
                        className="rk-search-btn"
                        disabled={!searchQuery || isSearching}
                        onClick={() => fetchResearchProducts(searchQuery)}
                    >
                        <FaSearch /> Araştır
                    </button>
                </div>

                {research && (
                    <>
                        <div className="rk-stats-row">
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaBoxOpen /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Toplam Ürün</div>
                                    <div className="rk-stat-value">{fmt(research.totalResults)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}><FaDollarSign /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Ort. Fiyat</div>
                                    <div className="rk-stat-value">{fmtPrice(research.marketStats?.avgPrice)}</div>
                                    <div className="rk-stat-sub">{fmtPrice(research.marketStats?.minPrice)} — {fmtPrice(research.marketStats?.maxPrice)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--rk-yellow)" }}><FaStore /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Rekabet</div>
                                    <div className="rk-stat-value">
                                        {{ very_high: "Çok Yüksek", high: "Yüksek", medium: "Orta", low: "Düşük", very_low: "Çok Düşük" }[research.marketStats?.competitionLevel] || "—"}
                                    </div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(139,92,246,0.12)", color: "var(--rk-purple)" }}><FaTag /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Marka Sayısı</div>
                                    <div className="rk-stat-value">{research.topBrands?.length || 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Marka Dağılımı */}
                        {research.topBrands?.length > 0 && (
                            <div className="rk-brands-section">
                                <h4 className="rk-brands-title"><FaTag /> Marka Dağılımı</h4>
                                <div className="rk-brands-wrap">
                                    {research.topBrands.map((b, i) => (
                                        <span key={i} className={`rk-brand-tag ${i < 3 ? "top" : ""}`}>
                                            {b.name} ({b.count})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rk-sort-bar">
                            <div className="rk-sort-left">
                                <span className="rk-sort-label">Sıralama:</span>
                                <select className="rk-sort-select" value={researchSort} onChange={(e) => setResearchSort(e.target.value)}>
                                    {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <div className="rk-view-toggle">
                                    <button className={`rk-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}><FaTh /></button>
                                    <button className={`rk-view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}><FaList /></button>
                                </div>
                            </div>
                            <div className="rk-result-count">
                                <DataSourceBadge source="trendyol_search_live" />
                                <strong>{fmt(products.length)}</strong> ürün listeleniyor
                                {research.totalResults > products.length && (
                                    <span style={{ color: "var(--rk-text-dim)", fontSize: 11 }}> (Trendyol'da {fmt(research.totalResults)} ürün)</span>
                                )}
                                {lastFetchRef.current && <span> · {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>}
                            </div>
                        </div>

                        {isSearching ? (
                            <div className="rk-loading">
                                <div className="rk-loading-spinner" />
                                <div className="rk-loading-text">Trendyol'dan ürünler çekiliyor...</div>
                            </div>
                        ) : viewMode === "grid" ? (
                            <div className="rk-product-grid">
                                {products.map((p, i) => <ProductCard key={i} product={p} index={i} isFlash={false} />)}
                            </div>
                        ) : (
                            <ProductTable products={products} isFlash={false} />
                        )}
                    </>
                )}

                {!research && !isSearching && !loading && (
                    <div className="rk-empty">
                        <FaSearch className="rk-empty-icon" />
                        <div className="rk-empty-text">Bir arama kelimesi girin</div>
                        <div className="rk-empty-sub">Trendyol'daki tüm ürünleri analiz edin — fiyatlar, satışlar, rakipler</div>
                    </div>
                )}

                {!research && isSearching && (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol'dan anlık veriler çekiliyor...</div>
                    </div>
                )}
            </div>
        );
    };

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 3: RAKİP ARAŞTIRMASI
    // ═════════════════════════════════════════════════════════════════════════
    const renderCompetitorAnalysis = () => {
        const comp = compResult?.competitor;
        const filteredMyProducts = myProductSearch
            ? myProducts.filter(p =>
                p.name.toLowerCase().includes(myProductSearch.toLowerCase()) ||
                p.barcode.toLowerCase().includes(myProductSearch.toLowerCase()) ||
                (p.brand || "").toLowerCase().includes(myProductSearch.toLowerCase())
            )
            : myProducts;

        return (
            <div className="rk-content">
                {/* ÜRÜNLERİM — Yatay kart listesi */}
                {myProducts.length > 0 && (
                    <div className="rk-section" style={{ borderColor: "rgba(78,205,196,0.3)", background: "rgba(78,205,196,0.03)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h4 className="rk-section-title" style={{ margin: 0 }}>
                                <FaBoxOpen style={{ color: "var(--rk-accent)" }} /> Ürünlerim
                                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--rk-text-dim)", marginLeft: 8 }}>({myProducts.length} ürün)</span>
                            </h4>
                            <div className="rk-search-input-wrap" style={{ maxWidth: 260, margin: 0 }}>
                                <FaSearch className="rk-search-icon" />
                                <input
                                    className="rk-search-input"
                                    placeholder="Ürün ara..."
                                    value={myProductSearch}
                                    onChange={(e) => setMyProductSearch(e.target.value)}
                                    style={{ fontSize: 12, padding: "6px 10px 6px 32px" }}
                                />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
                            {filteredMyProducts.map((p) => (
                                <div
                                    key={p.barcode}
                                    style={{
                                        minWidth: 200, maxWidth: 220, flexShrink: 0, scrollSnapAlign: "start",
                                        background: "var(--rk-card)", border: "1px solid var(--rk-border)", borderRadius: 12,
                                        padding: 12, display: "flex", flexDirection: "column", gap: 8,
                                        transition: "border-color 0.2s, box-shadow 0.2s",
                                        borderColor: compAnalyzingBarcode === p.barcode ? "var(--rk-accent)" : "var(--rk-border)",
                                        boxShadow: compAnalyzingBarcode === p.barcode ? "0 0 0 2px rgba(78,205,196,0.3)" : "none",
                                    }}
                                >
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", background: "var(--rk-bg-sec)" }} onError={(e) => { e.target.style.display = "none"; }} />
                                        ) : (
                                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--rk-bg-sec)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--rk-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                            <div style={{ fontSize: 10, color: "var(--rk-text-dim)", fontFamily: "monospace" }}>{p.barcode}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--rk-accent)" }}>{fmtPrice(p.price)}</div>
                                            <div style={{ fontSize: 10, color: p.isOutOfStock ? "var(--rk-red)" : p.stock < 5 ? "var(--rk-yellow)" : "var(--rk-text-dim)" }}>
                                                {p.isOutOfStock ? "❌ Stok Yok" : `📦 ${p.stock} adet`}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            {p.marketplaces?.length > 0 && (
                                                <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                                                    {p.marketplaces.slice(0, 3).map((m, i) => (
                                                        <span key={i} style={{ fontSize: 8, padding: "1px 4px", borderRadius: 4, background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}>{m}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className="rk-btn rk-btn-primary"
                                        style={{ fontSize: 11, padding: "6px 10px", width: "100%", justifyContent: "center" }}
                                        disabled={compLoading}
                                        onClick={() => analyzeCompetitorByBarcode(p.barcode)}
                                    >
                                        {compAnalyzingBarcode === p.barcode ? (
                                            <><FaSync className="spinning" /> Analiz ediliyor...</>
                                        ) : (
                                            <><FaSearch /> Rakip Analizi</>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                        {filteredMyProducts.length === 0 && myProductSearch && (
                            <div style={{ textAlign: "center", padding: 12, fontSize: 12, color: "var(--rk-text-dim)" }}>
                                "{myProductSearch}" ile eşleşen ürün bulunamadı
                            </div>
                        )}
                    </div>
                )}

                {/* MANUEL GİRİŞ */}
                <div className="rk-section">
                    <h3 className="rk-section-title"><FaBalanceScale style={{ color: "var(--rk-yellow)" }} /> Manuel Rakip Araştırması</h3>
                    <p className="rk-section-desc">Trendyol ürün linki veya anahtar kelime girerek rakiplerinizi analiz edin</p>
                    <div className="rk-form-row">
                        <input className="rk-input" placeholder="Trendyol Ürün Linki (opsiyonel)" value={compProductUrl} onChange={(e) => setCompProductUrl(e.target.value)} />
                        <input className="rk-input" placeholder="Arama Kelimesi" value={compSearchQuery} onChange={(e) => setCompSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && compSearchQuery && apiCall("post", "/roketfy/competitor/analyze", { productUrl: compProductUrl, searchQuery: compSearchQuery }, setCompResult)} />
                        <button className="rk-btn rk-btn-orange" disabled={(!compProductUrl && !compSearchQuery) || loading || compLoading}
                            onClick={() => apiCall("post", "/roketfy/competitor/analyze", { productUrl: compProductUrl, searchQuery: compSearchQuery }, setCompResult)}>
                            <FaBalanceScale /> Analiz Et
                        </button>
                    </div>
                </div>

                {/* LOADING */}
                {compLoading && (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol'dan rakip verileri çekiliyor...</div>
                    </div>
                )}

                {/* SONUÇLAR */}
                {comp && !compLoading && (
                    <>
                        {/* SENİN ÜRÜNÜN KARTI */}
                        {comp.myProduct && (
                            <div className="rk-section" style={{ borderColor: "rgba(78,205,196,0.4)", background: "rgba(78,205,196,0.04)" }}>
                                <h4 className="rk-section-title"><FaBoxOpen style={{ color: "var(--rk-accent)" }} /> Senin Ürünün</h4>
                                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                                    {comp.myProduct.imageUrl && (
                                        <img src={comp.myProduct.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: "2px solid var(--rk-accent)" }} onError={(e) => { e.target.style.display = "none"; }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{comp.myProduct.name}</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            <span className="rk-chip rk-chip-accent">{fmtPrice(comp.myProduct.price)}</span>
                                            {comp.myProduct.brand && <span className="rk-chip rk-chip-info">{comp.myProduct.brand}</span>}
                                            <span className="rk-chip" style={{ background: comp.myProduct.stock > 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: comp.myProduct.stock > 0 ? "var(--rk-green)" : "var(--rk-red)" }}>
                                                {comp.myProduct.stock > 0 ? `📦 ${comp.myProduct.stock} stok` : "❌ Stok Yok"}
                                            </span>
                                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--rk-text-dim)", alignSelf: "center" }}>{comp.myProduct.barcode}</span>
                                        </div>
                                    </div>
                                    {comp.priceAnalysis?.myPricePosition && (
                                        <div style={{ textAlign: "center", padding: "8px 16px", background: "rgba(78,205,196,0.08)", borderRadius: 10 }}>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--rk-accent)" }}>%{comp.priceAnalysis.myPricePosition.cheaperThanPercent}</div>
                                            <div style={{ fontSize: 10, color: "var(--rk-text-sec)" }}>rakiplerden ucuz</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TRENDYOL ÜRÜNÜ (URL ile analiz) */}
                        {comp.analyzedProduct && (
                            <div className="rk-section" style={{ borderColor: "rgba(242,122,26,0.3)" }}>
                                <h4 className="rk-section-title"><FaEye /> Analiz Edilen Trendyol Ürünü</h4>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{comp.analyzedProduct.name}</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <span className="rk-chip rk-chip-accent">{fmtPrice(comp.analyzedProduct.price)}</span>
                                    <span className="rk-chip rk-chip-warning">⭐ {comp.analyzedProduct.ratingScore}</span>
                                    <span className="rk-chip rk-chip-danger">❤️ {fmt(comp.analyzedProduct.favoriteCount)}</span>
                                </div>
                            </div>
                        )}

                        <div className="rk-stats-row">
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaStore /></div>
                                <div className="rk-stat-info"><div className="rk-stat-label">Toplam Rakip</div><div className="rk-stat-value">{fmt(comp.totalCompetitors)}</div></div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}><FaDollarSign /></div>
                                <div className="rk-stat-info"><div className="rk-stat-label">Ort. Fiyat</div><div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.avgPrice)}</div></div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "var(--rk-blue)" }}><FaChartLine /></div>
                                <div className="rk-stat-info"><div className="rk-stat-label">Min Fiyat</div><div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.minPrice)}</div></div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--rk-red)" }}><FaChartLine /></div>
                                <div className="rk-stat-info"><div className="rk-stat-label">Max Fiyat</div><div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.maxPrice)}</div></div>
                            </div>
                        </div>

                        {comp.productComparison?.length > 0 && (
                            <ProductTable products={comp.productComparison} isFlash={false} />
                        )}

                        {comp.topKeywords?.length > 0 && (
                            <div className="rk-brands-section">
                                <h4 className="rk-brands-title"><FaKey /> Rakiplerin Anahtar Kelimeleri</h4>
                                <div className="rk-brands-wrap">
                                    {comp.topKeywords.map((k, i) => (
                                        <span key={i} className={`rk-brand-tag ${i < 5 ? "top" : ""}`}>{k.keyword} ({k.count})</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {comp.insights?.length > 0 && (
                            <div className="rk-section">
                                <h4 className="rk-section-title"><FaLightbulb style={{ color: "var(--rk-yellow)" }} /> İçgörüler & Öneriler</h4>
                                {comp.insights.map((ins, i) => (
                                    <div key={i} style={{
                                        padding: "8px 12px",
                                        background: ins.includes("⚠️") ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)",
                                        border: `1px solid ${ins.includes("⚠️") ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"}`,
                                        borderRadius: 8, marginBottom: 6, fontSize: 13, color: "var(--rk-text-sec)"
                                    }}>
                                        {ins.includes("⚠️") ? "" : "💡 "}{ins}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* BOŞ DURUM */}
                {!comp && !compLoading && myProducts.length === 0 && (
                    <div className="rk-empty">
                        <FaBalanceScale className="rk-empty-icon" />
                        <div className="rk-empty-text">Rakip analizi yapmak için</div>
                        <div className="rk-empty-sub">Yukarıdaki alana Trendyol ürün linki veya anahtar kelime girin</div>
                    </div>
                )}
            </div>
        );
    };

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 4: LİSTELEME ANALİSTİ
    // ═════════════════════════════════════════════════════════════════════════
    const renderListingAnalyst = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaClipboardCheck style={{ color: "var(--rk-blue)" }} /> Listeleme Analisti</h3>
                <p className="rk-section-desc">Ürününüzü Trendyol'daki en iyi ürünlerle karşılaştırın — SEO, başlık, görsel, fiyat analizi</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod girin" value={listingBarcode} onChange={(e) => setListingBarcode(e.target.value)} />
                    <button className="rk-btn rk-btn-primary" disabled={!listingBarcode || loading}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze", { barcode: listingBarcode }, setListingResult)}>
                        <FaClipboardCheck /> Analiz Et
                    </button>
                    <button className="rk-btn rk-btn-secondary" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze-all", {}, setBulkResult)}>
                        <FaSync /> Tümünü Analiz Et
                    </button>
                </div>
            </div>

            {listingResult?.analysis && (
                <div className="rk-section">
                    <div className="rk-score-wrap">
                        <div className="rk-score-circle" style={{ color: scoreColor(listingResult.analysis.overallScore), borderColor: scoreColor(listingResult.analysis.overallScore) }}>
                            {listingResult.analysis.overallScore}
                        </div>
                        <div>
                            <div className="rk-score-grade" style={{ color: gradeColor(listingResult.analysis.grade) }}>{listingResult.analysis.grade}</div>
                            <div className="rk-score-label">Listeleme Skoru · {listingResult.analysis.priceScore?.comparedWith || 0} ürünle karşılaştırıldı</div>
                        </div>
                    </div>

                    <div className="rk-stats-row">
                        {[
                            { label: "Başlık", score: listingResult.analysis.titleScore?.score, icon: "📝" },
                            { label: "Açıklama", score: listingResult.analysis.descriptionScore?.score, icon: "📄" },
                            { label: "Görseller", score: listingResult.analysis.imageScore?.score, icon: "🖼️" },
                            { label: "Fiyat", score: listingResult.analysis.priceScore?.score, icon: "💰" },
                            { label: "Stok", score: listingResult.analysis.stockScore?.score, icon: "📦" },
                        ].map((item, i) => (
                            <div key={i} className="rk-stat-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{item.icon} {item.label}</span>
                                    <span style={{ fontWeight: 700, color: scoreColor(item.score || 0) }}>{item.score || 0}/100</span>
                                </div>
                                <div className="rk-progress" style={{ width: "100%" }}>
                                    <div className="rk-progress-bar" style={{ width: `${item.score || 0}%`, background: scoreColor(item.score || 0) }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SEO Analizi */}
                    {listingResult.analysis.seoAnalysis && (
                        <div style={{ marginBottom: 16 }}>
                            {listingResult.analysis.seoAnalysis.matchedKeywords?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, color: "var(--rk-green)", fontWeight: 600 }}>✅ Eşleşen: </span>
                                    {listingResult.analysis.seoAnalysis.matchedKeywords.map((kw, i) => (
                                        <span key={i} className="rk-chip rk-chip-success" style={{ marginLeft: 4 }}>{kw}</span>
                                    ))}
                                </div>
                            )}
                            {listingResult.analysis.seoAnalysis.missingKeywords?.length > 0 && (
                                <div>
                                    <span style={{ fontSize: 12, color: "var(--rk-red)", fontWeight: 600 }}>❌ Eksik: </span>
                                    {listingResult.analysis.seoAnalysis.missingKeywords.map((kw, i) => (
                                        <span key={i} className="rk-chip rk-chip-danger" style={{ marginLeft: 4 }}>{kw}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Öneriler */}
                    {listingResult.analysis.recommendations?.length > 0 && (
                        <div>
                            <h4 className="rk-brands-title"><FaLightbulb /> Öneriler</h4>
                            {listingResult.analysis.recommendations.map((rec, i) => (
                                <div key={i} style={{ padding: "10px 14px", background: rec.priority === "critical" ? "rgba(239,68,68,0.08)" : rec.priority === "high" ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)", borderRadius: 8, marginBottom: 6, border: `1px solid ${rec.priority === "critical" ? "rgba(239,68,68,0.2)" : rec.priority === "high" ? "rgba(245,158,11,0.2)" : "rgba(59,130,246,0.2)"}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span className={`rk-chip ${rec.priority === "critical" ? "rk-chip-danger" : rec.priority === "high" ? "rk-chip-warning" : "rk-chip-info"}`}>
                                            {rec.priority === "critical" ? "Kritik" : rec.priority === "high" ? "Yüksek" : "Orta"}
                                        </span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rk-text)" }}>{rec.message}</span>
                                    </div>
                                    {rec.currentValue && <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Mevcut: {rec.currentValue}</div>}
                                    {rec.suggestedValue && <div style={{ fontSize: 11, color: "var(--rk-green)" }}>Öneri: {rec.suggestedValue}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Toplu Sonuç */}
            {bulkResult?.products && (
                <div className="rk-section">
                    <div className="rk-score-wrap">
                        <div className="rk-score-circle" style={{ color: scoreColor(bulkResult.averageScore) }}>{bulkResult.averageScore}</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{bulkResult.totalProducts} Ürün Analiz Edildi</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <span className="rk-chip rk-chip-success">{bulkResult.gradeDistribution?.excellent || 0} Mükemmel</span>
                                <span className="rk-chip rk-chip-info">{bulkResult.gradeDistribution?.good || 0} İyi</span>
                                <span className="rk-chip rk-chip-danger">{bulkResult.gradeDistribution?.poor || 0} Zayıf</span>
                            </div>
                        </div>
                    </div>
                    <div className="rk-product-table-wrap">
                        <table className="rk-product-table">
                            <thead><tr><th>ÜRÜN</th><th>BARKOD</th><th className="right">SKOR</th><th className="right">NOT</th></tr></thead>
                            <tbody>
                                {bulkResult.products.slice(0, 30).map((p, i) => (
                                    <tr key={i}>
                                        <td style={{ fontSize: 12 }}>{p.name}</td>
                                        <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--rk-text-sec)" }}>{p.barcode}</td>
                                        <td className="right"><span className="rk-chip" style={{ background: `${scoreColor(p.score)}20`, color: scoreColor(p.score) }}>{p.score}</span></td>
                                        <td className="right" style={{ fontWeight: 800, color: gradeColor(p.grade) }}>{p.grade}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 5: AI İÇERİK YAZARI
    // ═════════════════════════════════════════════════════════════════════════
    const renderContentWriter = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaPen style={{ color: "var(--rk-purple)" }} /> AI İçerik Yazarı</h3>
                <p className="rk-section-desc">SEO uyumlu başlık ve açıklama üretin</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod (opsiyonel)" value={contentBarcode} onChange={(e) => setContentBarcode(e.target.value)} />
                    <input className="rk-input" placeholder="Anahtar Kelimeler (virgülle)" value={contentKeywords} onChange={(e) => setContentKeywords(e.target.value)} />
                    <input className="rk-input" placeholder="Ürün Bilgisi" value={contentProductInfo} onChange={(e) => setContentProductInfo(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className="rk-btn rk-btn-purple" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/content/title", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setTitleResult)}>
                        <FaPen /> Başlık Üret
                    </button>
                    <button className="rk-btn rk-btn-orange" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/content/description", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setDescResult)}>
                        <FaRobot /> Açıklama Üret
                    </button>
                </div>
            </div>

            {titleResult?.content?.generatedTitles?.length > 0 && (
                <div className="rk-section">
                    <h4 className="rk-section-title">📝 Üretilen Başlıklar</h4>
                    {titleResult.content.generatedTitles.map((t, i) => (
                        <div key={i} style={{ padding: "12px 16px", background: i === 0 ? "rgba(34,197,94,0.06)" : "transparent", border: "1px solid var(--rk-border)", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.title}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <span className="rk-chip" style={{ background: `${scoreColor(t.seoScore)}20`, color: scoreColor(t.seoScore) }}>SEO: {t.seoScore}</span>
                                <span className="rk-chip rk-chip-info">{t.charCount} kar.</span>
                                {t.isReference && <span className="rk-chip rk-chip-warning">Referans</span>}
                                <button style={{ background: "none", border: "none", color: "var(--rk-text-sec)", cursor: "pointer", padding: 4 }} onClick={() => copyToClipboard(t.title)}><FaCopy /></button>
                            </div>
                        </div>
                    ))}
                    {titleResult.content.marketKeywords?.length > 0 && (
                        <div className="rk-brands-section" style={{ marginTop: 12 }}>
                            <h4 className="rk-brands-title"><FaKey /> Pazar Anahtar Kelimeleri</h4>
                            <div className="rk-brands-wrap">
                                {titleResult.content.marketKeywords.map((k, i) => (
                                    <span key={i} className="rk-brand-tag">{k.keyword}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {descResult?.content?.generatedDescriptions?.length > 0 && (
                <div className="rk-section">
                    <h4 className="rk-section-title">📄 Üretilen Açıklamalar</h4>
                    {descResult.content.generatedDescriptions.map((d, i) => (
                        <div key={i} className="rk-accordion">
                            <div className="rk-accordion-header">
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>Varyasyon {i + 1}</span>
                                    <span className="rk-chip" style={{ background: `${scoreColor(d.seoScore)}20`, color: scoreColor(d.seoScore) }}>SEO: {d.seoScore}</span>
                                </div>
                                <button style={{ background: "none", border: "none", color: "var(--rk-text-sec)", cursor: "pointer" }} onClick={() => copyToClipboard(d.description)}><FaCopy /></button>
                            </div>
                            <div className="rk-accordion-body">
                                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "var(--rk-text-sec)", margin: 0, fontFamily: "inherit" }}>{d.description}</pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 6: YORUM ANALİZİ
    // ═════════════════════════════════════════════════════════════════════════
    const renderReviewAnalysis = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaComments style={{ color: "var(--rk-pink)" }} /> Yorum Analizi</h3>
                <p className="rk-section-desc">Trendyol ürün linki veya Content ID girerek yorumları NLP ile analiz edin</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Trendyol Ürün Linki veya Content ID" value={reviewInput} onChange={(e) => setReviewInput(e.target.value)} />
                    <button className="rk-btn rk-btn-orange" disabled={!reviewInput || loading}
                        onClick={() => {
                            const isUrl = reviewInput.includes("trendyol.com");
                            apiCall("post", "/roketfy/reviews/analyze", isUrl ? { productUrl: reviewInput } : { contentId: reviewInput }, setReviewResult);
                        }}>
                        <FaComments /> Analiz Et
                    </button>
                </div>
            </div>

            {reviewResult?.reviews && (
                <>
                    {reviewResult.reviews.productName && (
                        <div className="rk-section">
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{reviewResult.reviews.productName}</div>
                            <div style={{ display: "flex", gap: 6 }}>
                                {reviewResult.reviews.productBrand && <span className="rk-chip rk-chip-accent">{reviewResult.reviews.productBrand}</span>}
                                {reviewResult.reviews.productPrice > 0 && <span className="rk-chip rk-chip-success">{fmtPrice(reviewResult.reviews.productPrice)}</span>}
                            </div>
                        </div>
                    )}

                    <div className="rk-stats-row">
                        <div className="rk-stat-card" style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--rk-yellow)" }}>{reviewResult.reviews.averageRating}</div>
                            <div style={{ display: "flex", gap: 2 }}>
                                {[1,2,3,4,5].map(s => <FaStar key={s} style={{ color: s <= Math.round(reviewResult.reviews.averageRating) ? "var(--rk-yellow)" : "var(--rk-text-dim)", fontSize: 14 }} />)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--rk-text-sec)", marginTop: 4 }}>{fmt(reviewResult.reviews.totalReviews)} değerlendirme</div>
                        </div>
                        <div className="rk-stat-card" style={{ flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Duygu Dağılımı</div>
                            <div className="rk-sentiment-bar">
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.positive || 0}%`, background: "var(--rk-green)" }} />
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.neutral || 0}%`, background: "var(--rk-yellow)" }} />
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.negative || 0}%`, background: "var(--rk-red)" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "var(--rk-green)" }}>😊 %{reviewResult.reviews.sentimentBreakdown?.positive}</span>
                                <span style={{ color: "var(--rk-yellow)" }}>😐 %{reviewResult.reviews.sentimentBreakdown?.neutral}</span>
                                <span style={{ color: "var(--rk-red)" }}>😞 %{reviewResult.reviews.sentimentBreakdown?.negative}</span>
                            </div>
                        </div>
                        <div className="rk-stat-card" style={{ flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rk-green)" }}>💪 Güçlü</div>
                            {(reviewResult.reviews.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 11, color: "var(--rk-text-sec)" }}>✅ {s}</div>)}
                            {(reviewResult.reviews.strengths || []).length === 0 && <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Veri yetersiz</div>}
                        </div>
                        <div className="rk-stat-card" style={{ flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rk-red)" }}>⚠️ Zayıf</div>
                            {(reviewResult.reviews.weaknesses || []).map((w, i) => <div key={i} style={{ fontSize: 11, color: "var(--rk-text-sec)" }}>❌ {w}</div>)}
                            {(reviewResult.reviews.weaknesses || []).length === 0 && <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Sorun yok</div>}
                        </div>
                    </div>

                    {/* Konu Analizi */}
                    {reviewResult.reviews.topicAnalysis?.length > 0 && (
                        <div className="rk-section">
                            <h4 className="rk-section-title">📊 Konu Bazlı Analiz</h4>
                            {reviewResult.reviews.topicAnalysis.map((topic, i) => (
                                <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--rk-border)", borderRadius: 8, marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{topic.topic}</span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <span className={`rk-chip ${topic.sentiment === "positive" ? "rk-chip-success" : topic.sentiment === "negative" ? "rk-chip-danger" : "rk-chip-warning"}`}>
                                                {topic.sentiment === "positive" ? "Pozitif" : topic.sentiment === "negative" ? "Negatif" : "Karışık"}
                                            </span>
                                            <span className="rk-chip rk-chip-info">{topic.mentionCount} bahsetme</span>
                                        </div>
                                    </div>
                                    <div className="rk-progress">
                                        <div className="rk-progress-bar" style={{ width: `${topic.percentage}%`, background: topic.sentiment === "positive" ? "var(--rk-green)" : topic.sentiment === "negative" ? "var(--rk-red)" : "var(--rk-yellow)" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Son Yorumlar */}
                    {reviewResult.reviews.recentReviews?.length > 0 && (
                        <div className="rk-section">
                            <h4 className="rk-section-title">💬 Son Yorumlar ({reviewResult.reviews.recentReviews.length})</h4>
                            {reviewResult.reviews.recentReviews.slice(0, 10).map((r, i) => (
                                <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--rk-border)", borderRadius: 8, marginBottom: 6, background: r.sentiment === "negative" ? "rgba(239,68,68,0.04)" : r.sentiment === "positive" ? "rgba(34,197,94,0.04)" : "transparent" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600 }}>{r.userName}</span>
                                            <div style={{ display: "flex", gap: 1 }}>
                                                {[1,2,3,4,5].map(s => <FaStar key={s} style={{ color: s <= r.rate ? "var(--rk-yellow)" : "var(--rk-text-dim)", fontSize: 10 }} />)}
                                            </div>
                                        </div>
                                        <span className={`rk-chip ${r.sentiment === "positive" ? "rk-chip-success" : r.sentiment === "negative" ? "rk-chip-danger" : "rk-chip-warning"}`}>
                                            {r.sentiment === "positive" ? "😊" : r.sentiment === "negative" ? "😞" : "😐"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--rk-text-sec)", lineHeight: 1.5 }}>{r.comment}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI Özet */}
                    {reviewResult.reviews.aiSummary && (
                        <div className="rk-section" style={{ borderColor: "rgba(78,205,196,0.3)", background: "rgba(78,205,196,0.04)" }}>
                            <h4 className="rk-section-title"><FaRobot style={{ color: "var(--rk-accent)" }} /> AI Özet</h4>
                            <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--rk-text-sec)", margin: 0 }}>{reviewResult.reviews.aiSummary}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 7: ANAHTAR KELİME & FİYAT
    // ═════════════════════════════════════════════════════════════════════════
    const renderKeywordsAndPrice = () => (
        <div className="rk-content">
            {/* Anahtar Kelime */}
            <div className="rk-section">
                <h3 className="rk-section-title"><FaKey style={{ color: "var(--rk-accent)" }} /> Anahtar Kelime Araştırması</h3>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Anahtar kelime girin... (tişört, ayakkabı)" value={kwSeed} onChange={(e) => setKwSeed(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && kwSeed && apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)} />
                    <button className="rk-btn rk-btn-primary" disabled={!kwSeed || loading}
                        onClick={() => apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)}>
                        <FaSearch /> Araştır
                    </button>
                </div>
            </div>

            {kwResult?.keywords && (
                <>
                    <div className="rk-stats-row">
                        <div className="rk-stat-card">
                            <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaBoxOpen /></div>
                            <div className="rk-stat-info"><div className="rk-stat-label">Toplam Ürün</div><div className="rk-stat-value">{fmt(kwResult.keywords.totalMarketProducts)}</div></div>
                        </div>
                        <div className="rk-stat-card">
                            <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}><FaDollarSign /></div>
                            <div className="rk-stat-info"><div className="rk-stat-label">Ort. Fiyat</div><div className="rk-stat-value">{fmtPrice(kwResult.keywords.priceStats?.avg)}</div></div>
                        </div>
                        <div className="rk-stat-card">
                            <div className="rk-stat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "var(--rk-blue)" }}><FaChartLine /></div>
                            <div className="rk-stat-info"><div className="rk-stat-label">Min Fiyat</div><div className="rk-stat-value">{fmtPrice(kwResult.keywords.priceStats?.min)}</div></div>
                        </div>
                        <div className="rk-stat-card">
                            <div className="rk-stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--rk-red)" }}><FaChartLine /></div>
                            <div className="rk-stat-info"><div className="rk-stat-label">Max Fiyat</div><div className="rk-stat-value">{fmtPrice(kwResult.keywords.priceStats?.max)}</div></div>
                        </div>
                    </div>

                    {kwResult.keywords.keywords?.length > 0 && (
                        <div className="rk-product-table-wrap">
                            <table className="rk-product-table">
                                <thead><tr><th>ANAHTAR KELİME</th><th className="right">ÜRÜN SAYISI</th><th className="right">REKABET</th><th className="right">UYGUNLUK</th></tr></thead>
                                <tbody>
                                    {kwResult.keywords.keywords.slice(0, 25).map((kw, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: i < 3 ? 700 : 400 }}>{kw.keyword}</td>
                                            <td className="right" style={{ fontWeight: 600 }}>{fmt(kw.searchVolume)}</td>
                                            <td className="right">
                                                <span className={`rk-chip ${kw.competition === "low" ? "rk-chip-success" : kw.competition === "high" || kw.competition === "very_high" ? "rk-chip-danger" : "rk-chip-warning"}`}>
                                                    {kw.competition === "low" ? "Düşük" : kw.competition === "high" ? "Yüksek" : kw.competition === "very_high" ? "Çok Yüksek" : "Orta"}
                                                </span>
                                            </td>
                                            <td className="right">
                                                <span className="rk-chip" style={{ background: `${scoreColor(kw.relevanceScore)}20`, color: scoreColor(kw.relevanceScore) }}>{kw.relevanceScore}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {kwResult.keywords.topBrands?.length > 0 && (
                        <div className="rk-brands-section">
                            <h4 className="rk-brands-title"><FaTag /> En Popüler Markalar</h4>
                            <div className="rk-brands-wrap">
                                {kwResult.keywords.topBrands.map((b, i) => (
                                    <span key={i} className={`rk-brand-tag ${i < 3 ? "top" : ""}`}>{b.name} (%{b.percentage})</span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Fiyat Önerisi */}
            <div className="rk-section" style={{ marginTop: 20 }}>
                <h3 className="rk-section-title"><FaDollarSign style={{ color: "var(--rk-green)" }} /> Fiyat Önerisi</h3>
                <p className="rk-section-desc">Ürününüzü Trendyol pazar fiyatlarıyla karşılaştırın</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod girin" value={priceBarcode} onChange={(e) => setPriceBarcode(e.target.value)} />
                    <button className="rk-btn rk-btn-primary" disabled={!priceBarcode || loading}
                        onClick={() => apiCall("post", "/roketfy/price/suggest", { barcode: priceBarcode }, setPriceResult)}>
                        <FaDollarSign /> Fiyat Öner
                    </button>
                </div>
            </div>

            {priceResult?.pricing && (
                <div className="rk-section" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.03)" }}>
                    <div className="rk-stats-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Mevcut Fiyat</div>
                            <div style={{ fontSize: 28, fontWeight: 800 }}>{fmtPrice(priceResult.pricing.currentPrice)}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-green)", fontWeight: 600 }}>Önerilen Fiyat</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--rk-green)" }}>{fmtPrice(priceResult.pricing.suggestedPrice)}</div>
                            {priceResult.pricing.profitMargin != null && <span className="rk-chip rk-chip-success">Kâr: %{priceResult.pricing.profitMargin}</span>}
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Trendyol Ortalaması</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--rk-purple)" }}>{fmtPrice(priceResult.pricing.marketAvgPrice)}</div>
                            <div style={{ fontSize: 11, color: "var(--rk-text-sec)" }}>{priceResult.pricing.analyzedProductCount} rakip</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
                        <span className="rk-chip rk-chip-info">Min: {fmtPrice(priceResult.pricing.minPrice)}</span>
                        <span className="rk-chip rk-chip-accent">Medyan: {fmtPrice(priceResult.pricing.medianPrice)}</span>
                        <span className="rk-chip rk-chip-warning">Max: {fmtPrice(priceResult.pricing.maxPrice)}</span>
                    </div>

                    <div style={{ padding: "12px 16px", background: "rgba(59,130,246,0.08)", borderRadius: 10, fontSize: 13, lineHeight: 1.8, color: "var(--rk-text-sec)" }}>
                        💡 {priceResult.pricing.reasoning}
                    </div>

                    {priceResult.pricing.competitorPrices?.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <h4 className="rk-brands-title"><FaTag /> Rakip Fiyatları</h4>
                            <div className="rk-product-table-wrap">
                                <table className="rk-product-table">
                                    <thead><tr><th>ÜRÜN</th><th>MARKA</th><th className="right">FİYAT</th><th className="right">RATING</th><th className="right">FARK</th></tr></thead>
                                    <tbody>
                                        {priceResult.pricing.competitorPrices.map((cp, i) => {
                                            const diff = priceResult.pricing.currentPrice > 0 ? Math.round(((cp.price - priceResult.pricing.currentPrice) / priceResult.pricing.currentPrice) * 100) : 0;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.productName}</td>
                                                    <td style={{ fontSize: 12, color: "var(--rk-text-sec)" }}>{cp.sellerName}</td>
                                                    <td className="right" style={{ fontWeight: 600 }}>{fmtPrice(cp.price)}</td>
                                                    <td className="right">⭐ {cp.ratingScore || "—"}</td>
                                                    <td className="right">
                                                        <span className={`rk-chip ${diff > 0 ? "rk-chip-danger" : diff < 0 ? "rk-chip-success" : "rk-chip-warning"}`}>
                                                            {diff > 0 ? "+" : ""}{diff}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // ANA RENDER
    // ═════════════════════════════════════════════════════════════════════════
    const showCategoryPanel = activeTab === 0 || activeTab === 1;

    const renderActiveTab = () => {
        switch (activeTab) {
            case 0: return renderBestSellers();
            case 1: return renderFlashProducts();
            case 2: return renderProductResearch();
            case 3: return renderCompetitorAnalysis();
            case 4: return renderListingAnalyst();
            case 5: return renderContentWriter();
            case 6: return renderReviewAnalysis();
            case 7: return renderKeywordsAndPrice();
            default: return renderBestSellers();
        }
    };

    return (
        <div className="rk-container">
            {/* Header */}
            <div className="rk-header">
                <div className="rk-header-left">
                    <h1>
                        <FaRocket className="rk-header-icon" />
                        LysiaRadar
                    </h1>
                    <p>Pazar istihbaratınız — en çok satanlar, flaş indirimler, rakip analizi, fiyat takibi</p>
                </div>
                <div className="rk-header-right">
                    <div className="rk-live-badge">
                        <span className="rk-live-dot" />
                        CANLI VERİ
                        {(activeTab === 0 || activeTab === 1 || (activeTab === 2 && researchResult)) && nextRefreshIn > 0 && (
                            <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>⏱ {formatCountdown(nextRefreshIn)}</span>
                        )}
                    </div>
                    <button className={`rk-refresh-btn ${loading ? "spinning" : ""}`} onClick={handleRefresh} disabled={loading}>
                        <FaSync /> Yenile
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rk-error">
                    <FaExclamationTriangle /> {error}
                    <button className="rk-error-close" onClick={() => setError("")}><FaTimes /></button>
                </div>
            )}

            {/* Main Tabs */}
            <div className="rk-main-tabs">
                {TAB_CONFIG.map((tab, i) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`rk-main-tab ${activeTab === i ? `active ${tab.color}` : ""}`}
                            onClick={() => setActiveTab(i)}
                        >
                            <Icon className="rk-tab-icon" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Layout: Category Panel + Content */}
            {showCategoryPanel ? (
                <div className="rk-layout">
                    {renderCategoryPanel()}
                    {renderActiveTab()}
                </div>
            ) : (
                renderActiveTab()
            )}
        </div>
    );
}
