/**
 * Dashtock Radar — Trendyol pazar istihbaratı (koyu tema).
 * Sekmeler: en çok satanlar, flaş, ürün araştırması, rakip, listeleme, AI içerik, yorum, kelime & fiyat.
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
    FaTimesCircle, FaChevronUp, FaGlobe, FaFilter,
    FaVenus, FaMars, FaGem, FaShoePrints, FaCouch,
    FaEyeDropper, FaLaptop, FaShoppingBasket, FaBaby, FaRunning,
    FaDownload, FaLink,
} from "react-icons/fa";
import API from "../services/api";
import "../styles/RoketfyPanel.css";

//  Kategori ikonları & renkleri
const CATEGORY_META = {
    "kadin":         { Icon: FaVenus, color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    "erkek":         { Icon: FaMars, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    "aksesuar":      { Icon: FaGem, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    "ayakkabi":      { Icon: FaShoePrints, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    "ev-mobilya":    { Icon: FaCouch, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    "kozmetik":      { Icon: FaEyeDropper, color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    "elektronik":    { Icon: FaLaptop, color: "#4ecdc4", bg: "rgba(78,205,196,0.12)" },
    "supermarket":   { Icon: FaShoppingBasket, color: "#f27a1a", bg: "rgba(242,122,26,0.12)" },
    "anne-bebek":    { Icon: FaBaby, color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    "spor-outdoor":  { Icon: FaRunning, color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
};

const SORT_OPTIONS = [
    { value: "BEST_SELLER", label: "En çok satanlar" },
    { value: "MOST_RATED", label: "En çok değerlendirilen" },
    { value: "PRICE_BY_ASC", label: "Fiyat: düşükten yükseğe" },
    { value: "PRICE_BY_DESC", label: "Fiyat: yüksekten düşük (azalan)" },
    { value: "MOST_RECENT", label: "En yeniler" },
];

const TAB_CONFIG = [
    { id: "best-sellers",  label: "En çok satanlar",     icon: FaTrophy,         color: "accent" },
    { id: "flash",         label: "Flaş ürünler",        icon: FaBolt,           color: "orange" },
    { id: "research",      label: "Ürün araştırması",    icon: FaSearch,         color: "accent" },
    { id: "competitor",    label: "Rakip araştırması",   icon: FaBalanceScale,   color: "accent" },
    { id: "listing",       label: "Listeleme analizi",   icon: FaClipboardCheck, color: "accent" },
    { id: "content",       label: "AI içerik yazarı",    icon: FaPen,            color: "accent" },
    { id: "reviews",       label: "Yorum analizi",       icon: FaComments,       color: "accent" },
    { id: "keywords",      label: "Kelime & fiyat",      icon: FaKey,            color: "accent" },
];

//  Yardımcı fonksiyonlar
const fmt = (n) => (n || 0).toLocaleString("tr-TR");
const fmtPrice = (n) => `${(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const productRowKey = (p, i) =>
    String(p.id ?? p.contentId ?? p.barcode ?? p.listingId ?? p.productId ?? p.url ?? p.name ?? `row-${i}`);

/** Liste içi arama + (flaş sekmesinde) minimum indirim */
function filterRadarProducts(list, query, minDiscount, applyDiscountFilter) {
    let out = Array.isArray(list) ? [...list] : [];
    if (applyDiscountFilter && minDiscount > 0) {
        out = out.filter((p) => (p.discountPercentage || 0) >= minDiscount);
    }
    const q = (query || "").trim().toLowerCase();
    if (q) {
        out = out.filter(
            (p) =>
                (p.name || "").toLowerCase().includes(q) ||
                (p.brand || "").toLowerCase().includes(q) ||
                (p.merchantName || "").toLowerCase().includes(q)
        );
    }
    return out;
}

function exportRadarCsv(products, baseName) {
    const cols = ["Sıra", "Marka", "Ürün adı", "Fiyat", "İndirim %", "Favori", "Sipariş", "Puan", "Değerlendirme sayısı", "Tahmini ciro/ay", "URL"];
    const esc = (v) => {
        const s = String(v ?? "");
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const rows = products.map((p, i) =>
        [
            i + 1,
            p.brand || p.merchantName || "",
            p.name || "",
            p.price ?? "",
            p.discountPercentage ?? "",
            p.favoriteCount ?? "",
            p.orderCount ?? "",
            p.ratingScore ?? "",
            p.ratingCount ?? "",
            p.estimatedMonthlyRevenue ?? "",
            p.url || "",
        ].map(esc).join(",")
    );
    const csv = `\uFEFF${cols.join(",")}\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

const salesClass = (s) => s > 10 ? "high" : s > 3 ? "medium" : "low";
const scoreColor = (s) => s >= 80 ? "var(--rk-green)" : s >= 60 ? "var(--rk-blue)" : s >= 40 ? "var(--rk-yellow)" : "var(--rk-red)";
const gradeColor = (g) => !g ? "var(--rk-text-sec)" : g.startsWith("A") ? "var(--rk-green)" : g.startsWith("B") ? "var(--rk-blue)" : g.startsWith("C") ? "var(--rk-yellow)" : "var(--rk-red)";
const rankClass = (i) => i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "normal";

// 
// ANA PANEL
// 

export default function RoketfyPanel() {
    //  Genel State 
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // grid | table

    //  Kategori State 
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubCategory, setSelectedSubCategory] = useState("");
    const [expandedCategory, setExpandedCategory] = useState("");
    const [selectedSort, setSelectedSort] = useState("BEST_SELLER");

    //  ok Satanlar State 
    const [bestSellers, setBestSellers] = useState(null);

    //  Fla ürünler State 
    const [flashProducts, setFlashProducts] = useState(null);

    //  ürün Araştırması State 
    const [searchQuery, setSearchQuery] = useState("");
    const [researchResult, setResearchResult] = useState(null);
    const [researchSort, setResearchSort] = useState("BEST_SELLER");
    const [researchLoading, setResearchLoading] = useState(false);
    const lastResearchQueryRef = useRef("");

    //  Rakip State 
    const [compProductUrl, setCompProductUrl] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [compResult, setCompResult] = useState(null);
    const [myProducts, setMyProducts] = useState([]);
    const [myProductsLoaded, setMyProductsLoaded] = useState(false);
    const [myProductSearch, setMyProductSearch] = useState("");
    const [compLoading, setCompLoading] = useState(false);
    const [compAnalyzingBarcode, setCompAnalyzingBarcode] = useState("");

    //  Listeleme State 
    const [listingBarcode, setListingBarcode] = useState("");
    const [listingResult, setListingResult] = useState(null);
    const [bulkResult, setBulkResult] = useState(null);

    //  erik State 
    const [contentBarcode, setContentBarcode] = useState("");
    const [contentKeywords, setContentKeywords] = useState("");
    const [contentProductInfo, setContentProductInfo] = useState("");
    const [titleResult, setTitleResult] = useState(null);
    const [descResult, setDescResult] = useState(null);

    //  Yorum State 
    const [reviewInput, setReviewInput] = useState("");
    const [reviewResult, setReviewResult] = useState(null);

    //  Anahtar Kelime State 
    const [kwSeed, setKwSeed] = useState("");
    const [kwResult, setKwResult] = useState(null);

    //  Fiyat State 
    const [priceBarcode, setPriceBarcode] = useState("");
    const [priceResult, setPriceResult] = useState(null);

    //  Dashtock Radar — liste içi filtre / dışa aktarım
    const [radarListFilter, setRadarListFilter] = useState("");
    const [flashMinDiscount, setFlashMinDiscount] = useState(0);
    const [radarToast, setRadarToast] = useState("");
    const [dashboard, setDashboard] = useState(null);
    const [scrapeHint, setScrapeHint] = useState("");
    const radarToastTimerRef = useRef(null);

    const lastFetchRef = useRef(null);
    const prevActiveTabRef = useRef(-1);
    const autoRefreshRef = useRef(null);
    const [nextRefreshIn, setNextRefreshIn] = useState(0);
    const countdownRef = useRef(null);
    const AUTO_REFRESH_MS = 3 * 60 * 1000; // 3 dakika

    //  API ars 
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

    const showRadarToast = useCallback((message) => {
        setRadarToast(message);
        if (radarToastTimerRef.current) clearTimeout(radarToastTimerRef.current);
        radarToastTimerRef.current = setTimeout(() => setRadarToast(""), 2600);
    }, []);

    useEffect(() => {
        if (activeTab !== 0 && activeTab !== 1) {
            setRadarListFilter("");
            setFlashMinDiscount(0);
        }
    }, [activeTab]);

    //  Kategorileri + dashboard 
    useEffect(() => {
        API.get("/roketfy/categories/detailed")
            .then(res => { if (res.data?.categories) setCategories(res.data.categories); })
            .catch(() => {});
        API.get("/roketfy/dashboard")
            .then(res => { if (res.data) setDashboard(res.data); })
            .catch(() => {});
        fetchBestSellers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    //  Sekmeye her dönüşte taze veri (önceki: sadece ilk yüklemede istek atılıyordu, liste bayat kalıyordu)
    useEffect(() => {
        if (activeTab === 0 && prevActiveTabRef.current !== 0) {
            fetchBestSellers();
        }
        if (activeTab === 1 && prevActiveTabRef.current !== 1) {
            fetchFlashProducts();
        }
        if (activeTab === 3 && !myProductsLoaded) {
            loadMyProducts();
        }
        prevActiveTabRef.current = activeTab;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    //  Kullanıcınn ürünlerini Yükle (Rakip Araştırması için) 
    const loadMyProducts = useCallback(async (search = "") => {
        try {
            const url = `/roketfy/competitor/my-products?limit=500${search ? `&search=${encodeURIComponent(search)}` : ""}`;
            const res = await API.get(url);
            if (res.data?.products) {
                setMyProducts(res.data.products);
                setMyProductsLoaded(true);
            }
        } catch (err) {
            // Sessiz hata  ürün yoksa bo göster
            setMyProducts([]);
            setMyProductsLoaded(true);
        }
    }, []);

    //  Tek Tkla Rakip Analizi (Barkod ile) 
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

    //  Auto-Refresh: Her 3 dakikada bir otomatik yenile 
    useEffect(() => {
        // Countdown balat
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

    //  Veri ekme Fonksiyonlar  Anlk Trendyol Verisi 
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
                fetchedAt: data.fetchedAt || null,
                scrapeOk: data.scrapeOk !== false,
                hint: data.hint || "",
            });
            setScrapeHint((!data.products?.length && data.hint) ? data.hint : "");
            lastFetchRef.current = new Date();
        } catch (err) {
            setError(err.response?.data?.message || "Veriler yüklenemedi");
            setScrapeHint("");
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
                fetchedAt: data.fetchedAt || null,
                hint: data.hint || "",
            });
            if (!data.products?.length && data.hint) setScrapeHint(data.hint);
            lastFetchRef.current = new Date();
        } catch (err) {
            setError(err.response?.data?.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    //  Kategori Seimi 
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

        // Alt kategori seçildiçinde arama terimi ile aratrma yap
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
                        fetchedAt: new Date().toISOString(),
                    });
                } else {
                    // Fla ürünler için indirimli olanlar filtrele
                    const prods = allProducts.filter(p => p.discountPercentage > 5);
                    setFlashProducts({
                        products: prods.length > 0 ? prods : allProducts,
                        totalCount: prods.length > 0 ? prods.length : allProducts.length,
                        source: "search_subcategory_flash",
                        fetchedAt: new Date().toISOString(),
                    });
                }
                lastFetchRef.current = new Date();
            }).catch(err => {
                setError(err.response?.data?.message || "Veriler yüklenemedi");
            }).finally(() => setLoading(false));
        }
    };

    //  Sralama değitiçinde yeniden ek 
    useEffect(() => {
        if (activeTab === 0 && bestSellers) {
            setBestSellers(null);
            fetchBestSellers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSort]);

    //  ürün Araştırması: Arama fonksiyonu 
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

    //  ürün Araştırması: Sralama değitiçinde yeniden ek 
    useEffect(() => {
        if (activeTab === 2 && researchResult && lastResearchQueryRef.current) {
            fetchResearchProducts(lastResearchQueryRef.current, researchSort);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [researchSort]);

    const handleRefresh = () => {
        // Countdown sfrla
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

    // 
    // RENDER: Kategori Paneli (Sol Sidebar)
    // 
    const renderCategoryPanel = () => (
        <div className="rk-categories">
            <h4 className="rk-cat-title">Kategoriler</h4>

            <div
                className={`rk-cat-item ${!selectedCategory ? "active" : ""}`}
                onClick={() => {
                    setSelectedCategory("");
                    setSelectedSubCategory("");
                    setExpandedCategory("");
                    if (activeTab === 0) fetchBestSellers("");
                    else if (activeTab === 1) fetchFlashProducts("");
                }}
            >
                <div className="rk-cat-item-left">
                    <div className="rk-cat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}>
                        <FaGlobe />
                    </div>
                    <span className="rk-cat-name">Tüm Kategoriler</span>
                </div>
            </div>

            {categories.map(cat => {
                const meta = CATEGORY_META[cat.key] || { Icon: FaBoxOpen, color: "#8b95a5", bg: "rgba(139,149,165,0.12)" };
                const CatIcon = meta.Icon || FaBoxOpen;
                const isExpanded = expandedCategory === cat.key;
                const isActive = selectedCategory === cat.key && !selectedSubCategory;

                return (
                    <div key={cat.key}>
                        <div
                            className={`rk-cat-item ${isActive ? "active" : ""} ${isExpanded ? "expanded" : ""}`}
                            onClick={() => handleCategoryClick(cat.key)}
                        >
                            <div className="rk-cat-item-left">
                                <div className="rk-cat-icon" style={{ background: meta.bg, color: meta.color }}>
                                    <CatIcon aria-hidden style={{ fontSize: 15 }} />
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubCategoryClick(cat.key, sub);
                                        }}
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

    // 
    // RENDER: ürün Kart
    // 
    const ProductCard = ({ product, index, isFlash, dataFresh }) => (
        <div
            className="rk-product-card"
            title="Ürünü Trendyol'da açmak için tıklayın"
            onClick={() => product.url && window.open(product.url, "_blank")}
        >
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
                {dataFresh && (
                    <span className="rk-fresh-badge">
                        <span className="rk-live-dot" />
                        Güncel
                    </span>
                )}
                <div className="rk-card-actions">
                    {product.url && (
                        <button
                            type="button"
                            className="rk-card-action-btn"
                            title="Ürün linkini kopyala"
                            aria-label="Linki kopyala"
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(product.url);
                                showRadarToast("Link panoya kopyalandı");
                            }}
                        >
                            <FaLink />
                        </button>
                    )}
                    {product.name && (
                        <button
                            type="button"
                            className="rk-card-action-btn"
                            title="Başlığı kopyala"
                            aria-label="Başlığı kopyala"
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(product.name);
                                showRadarToast("Başlık kopyalandı");
                            }}
                        >
                            <FaCopy />
                        </button>
                    )}
                </div>
                <div className="rk-product-badges">
                    {product.discountPercentage > 0 && (
                        <span className="rk-badge rk-badge-discount">-%{product.discountPercentage}</span>
                    )}
                    {isFlash && (
                        <span className="rk-badge rk-badge-flash"><FaBolt /> Flaş</span>
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
                <div className="rk-product-brand">{product.brand || product.merchantName || ""}</div>
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
                    <div className="rk-meta-item">
                        <FaShoppingCart style={{ color: "var(--rk-accent)" }} />
                        <span className="rk-meta-val">
                            {product.orderCount > 0 ? `${fmt(product.orderCount)} sipariş` : "—"}
                        </span>
                    </div>
                    <div className="rk-meta-item">
                        <FaStar style={{ color: "var(--rk-yellow)" }} />
                        <span className="rk-meta-val">
                            {product.ratingScore || ""}
                            {product.ratingCount > 0 ? ` (${fmt(product.ratingCount)})` : ""}
                        </span>
                    </div>
                    <div className="rk-meta-item">
                        <FaChartLine style={{ color: "var(--rk-green)" }} />
                        <span className="rk-meta-val">{fmtPrice(product.estimatedMonthlyRevenue)}/ay</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // 
    // RENDER: ürün Tablosu
    // 
    const ProductTable = ({ products, isFlash }) => (
        <div className="rk-product-table-wrap">
            <table className="rk-product-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Ürün</th>
                        <th className="right">Fiyat</th>
                        <th className="right">Favori</th>
                        <th className="right">Satış / gün</th>
                        <th className="right">Puan</th>
                        <th className="right">Tahm. aylık ciro</th>
                        {isFlash && <th className="right">İndirim</th>}
                    </tr>
                </thead>
                <tbody>
                    {products.map((p, i) => (
                        <tr key={productRowKey(p, i)} onClick={() => p.url && window.open(p.url, "_blank")}>
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
                                        <div className="rk-table-product-brand">{p.brand || p.merchantName || ""}</div>
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
                                ) : <span style={{ color: "var(--rk-text-dim)" }}></span>}
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

    // 
    // RENDER: statistik Satr
    // 
    const StatsRow = ({ products }) => {
        if (!products?.length) return null;
        const prices = products.map(p => p.price).filter(p => p > 0);
        const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        const totalFav = products.reduce((s, p) => s + (p.favoriteCount || 0), 0);
        const avgSales = products.length > 0
            ? Math.round(products.reduce((s, p) => s + (p.estimatedDailySales || 0), 0) / products.length)
            : 0;

        return (
            <div className="rk-stats-row">
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}>
                        <FaBoxOpen />
                    </div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Toplam ürün</div>
                        <div className="rk-stat-value">{fmt(products.length)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}>
                        <FaDollarSign />
                    </div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Ort. Fiyat</div>
                        <div className="rk-stat-value">{fmtPrice(avgPrice)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(236,72,153,0.12)", color: "var(--rk-pink)" }}>
                        <FaHeart />
                    </div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Toplam favori</div>
                        <div className="rk-stat-value">{fmt(totalFav)}</div>
                    </div>
                </div>
                <div className="rk-stat-card">
                    <div className="rk-stat-icon" style={{ background: "rgba(242,122,26,0.12)", color: "var(--rk-orange)" }}>
                        <FaChartLine />
                    </div>
                    <div className="rk-stat-info">
                        <div className="rk-stat-label">Ort. sat/gün</div>
                        <div className="rk-stat-value">{avgSales}</div>
                    </div>
                </div>
            </div>
        );
    };

    const isLiveSource = (source) =>
        Boolean(source && (source.includes("live") || source.includes("trendyol")));

    //  Veri Kayna Etiketi 
    const DataSourceBadge = ({ source }) => {
        if (!source) return null;
        const isLive = source.includes("live") || source.includes("trendyol");
        const label = isLive ? "Anlık Trendyol verisi" : source.includes("search") ? "Trendyol arama" : "Veri";
        return (
            <span className={`rk-source-badge ${isLive ? "rk-source-live" : "rk-source-search"}`}>
                <span className={isLive ? "rk-live-dot" : ""} />
                {isLive ? "Canlı — " : ""}{label}
            </span>
        );
    };

    //  Sonraki Yenileme Geri Saym 
    const formatCountdown = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    // 
    // TAB 0: En çok satanlar
    // 
    const renderBestSellers = () => {
        const rawProducts = bestSellers?.products || [];
        const source = bestSellers?.source || "";
        const fetchedAt = bestSellers?.fetchedAt;
        const products = filterRadarProducts(rawProducts, radarListFilter, 0, false);
        const filterActive = radarListFilter.trim().length > 0;

        const dataFresh = isLiveSource(source);

        return (
            <div className="rk-content">
                <div className="rk-sort-bar rk-sort-bar-stack">
                    <div className="rk-sort-bar-row">
                        <div className="rk-sort-left">
                            <span className="rk-sort-label">Sıralama:</span>
                            <select className="rk-sort-select" value={selectedSort} onChange={(e) => setSelectedSort(e.target.value)}>
                                {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <div className="rk-view-toggle">
                                <button type="button" className={`rk-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}><FaTh /></button>
                                <button type="button" className={`rk-view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}><FaList /></button>
                            </div>
                        </div>
                        <div className="rk-result-count">
                            <DataSourceBadge source={source} />
                            <strong>{fmt(products.length)}</strong> ürün gösteriliyor
                            {filterActive && rawProducts.length !== products.length && (
                                <span className="rk-filter-hint"> ({fmt(products.length)} / {fmt(rawProducts.length)} kayıt)</span>
                            )}
                            {fetchedAt && (
                                <span className="rk-fetched-at" title="Sunucunun veriyi çektiği zaman">
                                    {" "}· {new Date(fetchedAt).toLocaleString("tr-TR")}
                                </span>
                            )}
                            {!fetchedAt && lastFetchRef.current && (
                                <span> {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>
                            )}
                            {nextRefreshIn > 0 && <span className="rk-countdown"> {formatCountdown(nextRefreshIn)}</span>}
                        </div>
                    </div>
                    <div className="rk-radar-toolbar">
                        <div className="rk-radar-filter-wrap">
                            <FaSearch className="rk-radar-filter-icon" aria-hidden />
                            <input
                                type="search"
                                className="rk-radar-filter-input"
                                placeholder="Listede ara: marka veya ürün adı…"
                                value={radarListFilter}
                                onChange={(e) => setRadarListFilter(e.target.value)}
                                aria-label="Listede ara"
                            />
                            {filterActive && (
                                <button type="button" className="rk-radar-filter-clear" onClick={() => setRadarListFilter("")}>Temizle</button>
                            )}
                        </div>
                        <button
                            type="button"
                            className="rk-csv-btn"
                            disabled={!products.length}
                            onClick={() => {
                                exportRadarCsv(products, "Dashtock Radar-en-cok-satanlar");
                                showRadarToast("CSV dosyası indirildi");
                            }}
                        >
                            <FaDownload /> CSV indir
                        </button>
                    </div>
                </div>

                <StatsRow products={products} />

                {loading ? (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol’dan veriler yükleniyor…</div>
                    </div>
                ) : rawProducts.length === 0 ? (
                    <div className="rk-empty">
                        <FaTrophy className="rk-empty-icon" />
                        <div className="rk-empty-text">Henüz veri yok</div>
                        <div className="rk-empty-sub">Sol menüden kategori seçin veya Yenile’ye basın</div>
                        {(scrapeHint || bestSellers?.hint) && (
                            <p className="rk-empty-hint">{scrapeHint || bestSellers.hint}</p>
                        )}
                        <button type="button" className="rk-retry-btn" onClick={() => fetchBestSellers()}>
                            <FaSync /> Tekrar dene
                        </button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="rk-empty">
                        <FaFilter className="rk-empty-icon" />
                        <div className="rk-empty-text">Filtreye uygun ürün yok</div>
                        <div className="rk-empty-sub">Arama metnini değiştirin veya temizleyin</div>
                        <button type="button" className="rk-refresh-btn" style={{ marginTop: 12 }} onClick={() => setRadarListFilter("")}>Filtreyi temizle</button>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="rk-product-grid">
                        {products.map((p, i) => (
                            <ProductCard
                                key={productRowKey(p, i)}
                                product={p}
                                index={i}
                                isFlash={false}
                                dataFresh={dataFresh}
                            />
                        ))}
                    </div>
                ) : (
                    <ProductTable products={products} isFlash={false} />
                )}
            </div>
        );
    };

    // 
    // TAB 1: Flaş ürünler
    // 
    const renderFlashProducts = () => {
        const rawProducts = flashProducts?.products || [];
        const source = flashProducts?.source || "";
        const fetchedAt = flashProducts?.fetchedAt;
        const products = filterRadarProducts(rawProducts, radarListFilter, flashMinDiscount, true);
        const filterActive = radarListFilter.trim().length > 0 || flashMinDiscount > 0;

        const dataFresh = isLiveSource(source);

        return (
            <div className="rk-content">
                <div className="rk-sort-bar rk-sort-bar-stack">
                    <div className="rk-sort-bar-row">
                        <div className="rk-sort-left">
                            <span className="rk-sort-label" style={{ color: "var(--rk-orange)" }}>
                                <FaBolt style={{ marginRight: 4 }} /> Flaş indirimler
                            </span>
                            <label className="rk-sr-only" htmlFor="rk-flash-min-disc">Minimum indirim</label>
                            <select
                                id="rk-flash-min-disc"
                                className="rk-sort-select"
                                value={flashMinDiscount}
                                onChange={(e) => setFlashMinDiscount(Number(e.target.value))}
                                title="Minimum indirim oranı"
                            >
                                <option value={0}>Tüm indirimler</option>
                                <option value={5}>%5 ve üzeri</option>
                                <option value={10}>%10 ve üzeri</option>
                                <option value={15}>%15 ve üzeri</option>
                                <option value={20}>%20 ve üzeri</option>
                                <option value={30}>%30 ve üzeri</option>
                            </select>
                            <div className="rk-view-toggle">
                                <button type="button" className={`rk-view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}><FaTh /></button>
                                <button type="button" className={`rk-view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}><FaList /></button>
                            </div>
                        </div>
                        <div className="rk-result-count">
                            <DataSourceBadge source={source} />
                            <strong>{fmt(products.length)}</strong> ürün gösteriliyor
                            {filterActive && rawProducts.length !== products.length && (
                                <span className="rk-filter-hint"> ({fmt(products.length)} / {fmt(rawProducts.length)} kayıt)</span>
                            )}
                            {fetchedAt && (
                                <span className="rk-fetched-at" title="Sunucunun veriyi çektiği zaman">
                                    {" "}· {new Date(fetchedAt).toLocaleString("tr-TR")}
                                </span>
                            )}
                            {!fetchedAt && lastFetchRef.current && (
                                <span> {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>
                            )}
                            {nextRefreshIn > 0 && <span className="rk-countdown"> {formatCountdown(nextRefreshIn)}</span>}
                        </div>
                    </div>
                    <div className="rk-radar-toolbar">
                        <div className="rk-radar-filter-wrap">
                            <FaSearch className="rk-radar-filter-icon" aria-hidden />
                            <input
                                type="search"
                                className="rk-radar-filter-input"
                                placeholder="Listede ara: marka veya ürün adı…"
                                value={radarListFilter}
                                onChange={(e) => setRadarListFilter(e.target.value)}
                                aria-label="Listede ara"
                            />
                            {filterActive && (
                                <button
                                    type="button"
                                    className="rk-radar-filter-clear"
                                    onClick={() => { setRadarListFilter(""); setFlashMinDiscount(0); }}
                                >
                                    Filtreleri temizle
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            className="rk-csv-btn"
                            disabled={!products.length}
                            onClick={() => {
                                exportRadarCsv(products, "Dashtock Radar-flas");
                                showRadarToast("CSV dosyası indirildi");
                            }}
                        >
                            <FaDownload /> CSV indir
                        </button>
                    </div>
                </div>

                <StatsRow products={products} />

                {loading ? (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Flaş ürünler yükleniyor…</div>
                    </div>
                ) : rawProducts.length === 0 ? (
                    <div className="rk-empty">
                        <FaBolt className="rk-empty-icon" />
                        <div className="rk-empty-text">Flaş ürün bulunamadı</div>
                        <div className="rk-empty-sub">Başka kategori deneyin veya indirim eşiğini düşürün</div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="rk-empty">
                        <FaFilter className="rk-empty-icon" />
                        <div className="rk-empty-text">Filtreye uygun ürün yok</div>
                        <div className="rk-empty-sub">Minimum indirim veya aramayı gevşetin</div>
                        <button type="button" className="rk-refresh-btn" style={{ marginTop: 12 }} onClick={() => { setRadarListFilter(""); setFlashMinDiscount(0); }}>Filtreleri temizle</button>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="rk-product-grid">
                        {products.map((p, i) => (
                            <ProductCard
                                key={productRowKey(p, i)}
                                product={p}
                                index={i}
                                isFlash
                                dataFresh={dataFresh}
                            />
                        ))}
                    </div>
                ) : (
                    <ProductTable products={products} isFlash={true} />
                )}
            </div>
        );
    };

    // 
    // TAB 2: RN ARATIRMASI
    // 
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
                            placeholder="Trendyol'da ürün ara… (ör. tişört, iPhone kılıf, ayakkabı)"
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
                        <FaSearch /> Ara
                    </button>
                </div>

                {research && (
                    <>
                        <div className="rk-stats-row">
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaBoxOpen /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Toplam ürün</div>
                                    <div className="rk-stat-value">{fmt(research.totalResults)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}><FaDollarSign /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Ort. Fiyat</div>
                                    <div className="rk-stat-value">{fmtPrice(research.marketStats?.avgPrice)}</div>
                                    <div className="rk-stat-sub">{fmtPrice(research.marketStats?.minPrice)}  {fmtPrice(research.marketStats?.maxPrice)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--rk-yellow)" }}><FaStore /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Rekabet</div>
                                    <div className="rk-stat-value">
                                        {{ very_high: "Çok yüksek", high: "Yüksek", medium: "Orta", low: "Düşük", very_low: "Çok düşük" }[research.marketStats?.competitionLevel] || ""}
                                    </div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(139,92,246,0.12)", color: "var(--rk-purple)" }}><FaTag /></div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Marka sayısı</div>
                                    <div className="rk-stat-value">{research.topBrands?.length || 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Marka Dalm */}
                        {research.topBrands?.length > 0 && (
                            <div className="rk-brands-section">
                                <h4 className="rk-brands-title"><FaTag /> Marka dağılımı</h4>
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
                                {lastFetchRef.current && <span>  {lastFetchRef.current.toLocaleTimeString("tr-TR")}</span>}
                            </div>
                        </div>

                        {isSearching ? (
                            <div className="rk-loading">
                                <div className="rk-loading-spinner" />
                                <div className="rk-loading-text">Trendyol’dan ürünler yükleniyor…</div>
                            </div>
                        ) : viewMode === "grid" ? (
                            <div className="rk-product-grid">
                                {products.map((p, i) => <ProductCard key={productRowKey(p, i)} product={p} index={i} isFlash={false} />)}
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
                        <div className="rk-empty-sub">Trendyol’daki ürünleri analiz edin: fiyatlar, satışlar, rakipler.</div>
                    </div>
                )}

                {!research && isSearching && (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol’dan veriler yükleniyor…</div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 3: RAKP ARATIRMASI
    // 
    const runManualCompetitorAnalyze = () => {
        if (!compProductUrl && !compSearchQuery) return;
        apiCall("post", "/roketfy/competitor/analyze", {
            productUrl: compProductUrl,
            searchQuery: compSearchQuery,
        }, setCompResult);
    };

    const renderCompetitorAnalysis = () => {
        const comp = compResult?.competitor;
        const filteredMyProducts = myProductSearch
            ? myProducts.filter(p =>
                p.name.toLowerCase().includes(myProductSearch.toLowerCase()) ||
                p.barcode.toLowerCase().includes(myProductSearch.toLowerCase()) ||
                (p.brand || "").toLowerCase().includes(myProductSearch.toLowerCase())
            )
            : myProducts;
        const canAnalyzeManual = Boolean(compProductUrl || compSearchQuery);

        return (
            <div className="rk-content rk-comp">
                <section className="rk-comp-hero">
                    <div className="rk-comp-hero-top">
                        <div className="rk-comp-hero-icon" aria-hidden>
                            <FaBalanceScale />
                        </div>
                        <div>
                            <h3>Rakip araştırması</h3>
                            <p>
                                Mağazanızdaki ürünü seçin veya Trendyol linki / anahtar kelime ile rakip fiyatlarını,
                                anahtar kelimeleri ve fırsatları karşılaştırın.
                            </p>
                        </div>
                    </div>
                    <div className="rk-comp-search">
                        <div className="rk-comp-field">
                            <label htmlFor="rk-comp-url">Trendyol ürün linki</label>
                            <input
                                id="rk-comp-url"
                                className="rk-input"
                                placeholder="https://www.trendyol.com/…"
                                value={compProductUrl}
                                onChange={(e) => setCompProductUrl(e.target.value)}
                            />
                        </div>
                        <div className="rk-comp-field">
                            <label htmlFor="rk-comp-kw">Arama kelimesi</label>
                            <input
                                id="rk-comp-kw"
                                className="rk-input"
                                placeholder="ör. bluetooth kulaklık"
                                value={compSearchQuery}
                                onChange={(e) => setCompSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && canAnalyzeManual && runManualCompetitorAnalyze()}
                            />
                        </div>
                        <button
                            type="button"
                            className="rk-btn rk-btn-orange rk-comp-submit"
                            disabled={!canAnalyzeManual || loading || compLoading}
                            onClick={runManualCompetitorAnalyze}
                        >
                            <FaBalanceScale /> Analiz et
                        </button>
                    </div>
                </section>

                {myProducts.length > 0 && (
                    <section className="rk-comp-my">
                        <div className="rk-comp-my-head">
                            <h4>
                                <FaBoxOpen /> Ürünlerim
                                <span className="rk-comp-my-count">({fmt(myProducts.length)})</span>
                            </h4>
                            <div className="rk-search-input-wrap rk-comp-my-filter">
                                <FaSearch className="rk-search-icon" aria-hidden />
                                <input
                                    type="search"
                                    className="rk-search-input"
                                    placeholder="Ürün, barkod veya marka ara…"
                                    value={myProductSearch}
                                    onChange={(e) => setMyProductSearch(e.target.value)}
                                    aria-label="Ürünlerimde ara"
                                />
                            </div>
                        </div>
                        <div className="rk-comp-strip">
                            {filteredMyProducts.map((p) => {
                                const stockCls = p.isOutOfStock
                                    ? "rk-comp-pick-stock--out"
                                    : p.stock < 5
                                        ? "rk-comp-pick-stock--low"
                                        : "rk-comp-pick-stock--ok";
                                return (
                                    <div
                                        key={p.barcode}
                                        className={`rk-comp-pick ${compAnalyzingBarcode === p.barcode ? "is-active" : ""}`}
                                    >
                                        <div className="rk-comp-pick-top">
                                            {p.imageUrl ? (
                                                <img
                                                    className="rk-comp-pick-img"
                                                    src={p.imageUrl}
                                                    alt=""
                                                    onError={(e) => { e.target.style.display = "none"; }}
                                                />
                                            ) : (
                                                <div className="rk-comp-pick-img rk-comp-pick-img--empty">
                                                    <FaBoxOpen />
                                                </div>
                                            )}
                                            <div className="rk-comp-pick-info">
                                                <div className="rk-comp-pick-name">{p.name}</div>
                                                <div className="rk-comp-pick-barcode">{p.barcode}</div>
                                            </div>
                                        </div>
                                        <div className="rk-comp-pick-meta">
                                            <div>
                                                <div className="rk-comp-pick-price">{fmtPrice(p.price)}</div>
                                                <div className={`rk-comp-pick-stock ${stockCls}`}>
                                                    {p.isOutOfStock ? "Stok yok" : `${fmt(p.stock)} adet`}
                                                </div>
                                            </div>
                                            {p.marketplaces?.length > 0 && (
                                                <div className="rk-comp-pick-mp">
                                                    {p.marketplaces.slice(0, 3).map((m, i) => (
                                                        <span key={i}>{m}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="rk-btn rk-btn-primary rk-comp-pick-btn"
                                            disabled={compLoading}
                                            onClick={() => analyzeCompetitorByBarcode(p.barcode)}
                                        >
                                            {compAnalyzingBarcode === p.barcode ? (
                                                <><FaSync className="spinning" /> Analiz…</>
                                            ) : (
                                                <><FaSearch /> Rakip analizi</>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredMyProducts.length === 0 && myProductSearch && (
                            <p style={{ textAlign: "center", margin: "12px 0 0", fontSize: 12, color: "var(--rk-text-dim)" }}>
                                “{myProductSearch}” ile eşleşen ürün bulunamadı
                            </p>
                        )}
                    </section>
                )}

                {compLoading && (
                    <div className="rk-loading">
                        <div className="rk-loading-spinner" />
                        <div className="rk-loading-text">Trendyol’dan rakip verileri yükleniyor…</div>
                    </div>
                )}

                {comp && !compLoading && (
                    <>
                        {comp.myProduct && (
                            <section className="rk-comp-highlight">
                                <div className="rk-comp-highlight-head">
                                    <FaBoxOpen /> Sizin ürününüz
                                </div>
                                <div className="rk-comp-highlight-body">
                                    {comp.myProduct.imageUrl && (
                                        <img
                                            className="rk-comp-highlight-img"
                                            src={comp.myProduct.imageUrl}
                                            alt=""
                                            onError={(e) => { e.target.style.display = "none"; }}
                                        />
                                    )}
                                    <div className="rk-comp-highlight-main">
                                        <div className="rk-comp-highlight-title">{comp.myProduct.name}</div>
                                        <div className="rk-comp-highlight-chips">
                                            <span className="rk-chip rk-chip-accent">{fmtPrice(comp.myProduct.price)}</span>
                                            {comp.myProduct.brand && (
                                                <span className="rk-chip rk-chip-info">{comp.myProduct.brand}</span>
                                            )}
                                            <span
                                                className="rk-chip"
                                                style={{
                                                    background: comp.myProduct.stock > 0
                                                        ? "rgba(34,197,94,0.12)"
                                                        : "rgba(239,68,68,0.12)",
                                                    color: comp.myProduct.stock > 0 ? "var(--rk-green)" : "var(--rk-red)",
                                                }}
                                            >
                                                {comp.myProduct.stock > 0 ? `${fmt(comp.myProduct.stock)} stok` : "Stok yok"}
                                            </span>
                                            <span className="rk-chip" style={{ fontFamily: "monospace", fontSize: "0.65rem" }}>
                                                {comp.myProduct.barcode}
                                            </span>
                                        </div>
                                    </div>
                                    {comp.priceAnalysis?.myPricePosition && (
                                        <div className="rk-comp-position">
                                            <div className="rk-comp-position-val">
                                                %{comp.priceAnalysis.myPricePosition.cheaperThanPercent}
                                            </div>
                                            <div className="rk-comp-position-lbl">rakiplerden daha ucuz</div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {comp.analyzedProduct && (
                            <section className="rk-comp-highlight rk-comp-highlight--trendyol">
                                <div className="rk-comp-highlight-head">
                                    <FaEye /> Analiz edilen Trendyol ürünü
                                </div>
                                <div className="rk-comp-highlight-body">
                                    {comp.analyzedProduct.imageUrl && (
                                        <img
                                            className="rk-comp-highlight-img"
                                            src={comp.analyzedProduct.imageUrl}
                                            alt=""
                                            onError={(e) => { e.target.style.display = "none"; }}
                                        />
                                    )}
                                    <div className="rk-comp-highlight-main">
                                        <div className="rk-comp-highlight-title">{comp.analyzedProduct.name}</div>
                                        <div className="rk-comp-highlight-chips">
                                            <span className="rk-chip rk-chip-accent">{fmtPrice(comp.analyzedProduct.price)}</span>
                                            {comp.analyzedProduct.ratingScore > 0 && (
                                                <span className="rk-chip rk-chip-warning">
                                                    <FaStar style={{ marginRight: 4 }} />
                                                    {comp.analyzedProduct.ratingScore}
                                                </span>
                                            )}
                                            <span className="rk-chip rk-chip-danger">
                                                <FaHeart style={{ marginRight: 4 }} />
                                                {fmt(comp.analyzedProduct.favoriteCount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        <div className="rk-stats-row">
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}>
                                    <FaStore />
                                </div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Toplam rakip</div>
                                    <div className="rk-stat-value">{fmt(comp.totalCompetitors)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--rk-green)" }}>
                                    <FaDollarSign />
                                </div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Ort. fiyat</div>
                                    <div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.avgPrice)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "var(--rk-blue)" }}>
                                    <FaChartLine />
                                </div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Min fiyat</div>
                                    <div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.minPrice)}</div>
                                </div>
                            </div>
                            <div className="rk-stat-card">
                                <div className="rk-stat-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--rk-red)" }}>
                                    <FaChartLine />
                                </div>
                                <div className="rk-stat-info">
                                    <div className="rk-stat-label">Max fiyat</div>
                                    <div className="rk-stat-value">{fmtPrice(comp.priceAnalysis?.maxPrice)}</div>
                                </div>
                            </div>
                        </div>

                        {comp.productComparison?.length > 0 && (
                            <section>
                                <div className="rk-comp-results-head">
                                    <h4>Rakip ürün listesi</h4>
                                    <span>{fmt(comp.productComparison.length)} ürün karşılaştırıldı</span>
                                </div>
                                <ProductTable products={comp.productComparison} isFlash={false} />
                            </section>
                        )}

                        {comp.topKeywords?.length > 0 && (
                            <section className="rk-comp-keywords">
                                <h4><FaKey /> Rakiplerin anahtar kelimeleri</h4>
                                <div className="rk-brands-wrap">
                                    {comp.topKeywords.map((k, i) => (
                                        <span key={i} className={`rk-brand-tag ${i < 5 ? "top" : ""}`}>
                                            {k.keyword} <strong>({k.count})</strong>
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {comp.insights?.length > 0 && (
                            <section className="rk-section">
                                <h4 className="rk-section-title">
                                    <FaLightbulb style={{ color: "var(--rk-yellow)" }} /> Görüşler ve öneriler
                                </h4>
                                <div className="rk-comp-insights">
                                    {comp.insights.map((ins, i) => {
                                        const isAlert = /kritik|risk|uyarı|zarar|düşük|yüksek fiyat|pahalı/i.test(ins);
                                        return (
                                            <div
                                                key={i}
                                                className={`rk-comp-insight ${isAlert ? "rk-comp-insight--warn" : "rk-comp-insight--tip"}`}
                                            >
                                                {isAlert ? <FaExclamationTriangle /> : <FaLightbulb />}
                                                <span>{ins}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {!comp && !compLoading && myProducts.length === 0 && (
                    <div className="rk-comp-empty">
                        <FaBalanceScale className="rk-comp-empty-icon" aria-hidden />
                        <h4>Rakip analizine başlayın</h4>
                        <p>
                            Üstte Trendyol linki veya anahtar kelime girin. Mağazanıza ürün eklediğinizde
                            buradan tek tıkla da analiz yapabilirsiniz.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 4: LSTELEME ANALST
    // 
    const renderListingAnalyst = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaClipboardCheck style={{ color: "var(--rk-blue)" }} /> Listeleme analisti</h3>
                <p className="rk-section-desc">Ürününüzü Trendyol’daki örnek ürünlerle kıyaslayın: SEO, başlık, görsel, fiyat ve stok.</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod girin" value={listingBarcode} onChange={(e) => setListingBarcode(e.target.value)} />
                    <button className="rk-btn rk-btn-primary" disabled={!listingBarcode || loading}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze", { barcode: listingBarcode }, setListingResult)}>
                        <FaClipboardCheck /> Analiz Et
                    </button>
                    <button className="rk-btn rk-btn-secondary" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze-all", {}, setBulkResult)}>
                        <FaSync /> Tümünü analiz et
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
                            <div className="rk-score-label">Listeleme skoru — {listingResult.analysis.priceScore?.comparedWith || 0} ürünle kıyaslandı</div>
                        </div>
                    </div>

                    <div className="rk-stats-row">
                        {[
                            { label: "Başlık", score: listingResult.analysis.titleScore?.score, icon: "" },
                            { label: "Açıklama", score: listingResult.analysis.descriptionScore?.score, icon: "" },
                            { label: "Görseller", score: listingResult.analysis.imageScore?.score, icon: "" },
                            { label: "Fiyat", score: listingResult.analysis.priceScore?.score, icon: "" },
                            { label: "Stok", score: listingResult.analysis.stockScore?.score, icon: "" },
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
                                    <span style={{ fontSize: 12, color: "var(--rk-green)", fontWeight: 600 }}>Eşleşen: </span>
                                    {listingResult.analysis.seoAnalysis.matchedKeywords.map((kw, i) => (
                                        <span key={i} className="rk-chip rk-chip-success" style={{ marginLeft: 4 }}>{kw}</span>
                                    ))}
                                </div>
                            )}
                            {listingResult.analysis.seoAnalysis.missingKeywords?.length > 0 && (
                                <div>
                                    <span style={{ fontSize: 12, color: "var(--rk-red)", fontWeight: 600 }}> Eksik: </span>
                                    {listingResult.analysis.seoAnalysis.missingKeywords.map((kw, i) => (
                                        <span key={i} className="rk-chip rk-chip-danger" style={{ marginLeft: 4 }}>{kw}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* öneriler */}
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

            {/* Toplu Sonu */}
            {bulkResult?.products && (
                <div className="rk-section">
                    <div className="rk-score-wrap">
                        <div className="rk-score-circle" style={{ color: scoreColor(bulkResult.averageScore) }}>{bulkResult.averageScore}</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{bulkResult.totalProducts} ürün analiz edildi</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <span className="rk-chip rk-chip-success">{bulkResult.gradeDistribution?.excellent || 0} Mükemmel</span>
                                <span className="rk-chip rk-chip-info">{bulkResult.gradeDistribution?.good || 0} İyi</span>
                                <span className="rk-chip rk-chip-danger">{bulkResult.gradeDistribution?.poor || 0} Zayıf</span>
                            </div>
                        </div>
                    </div>
                    <div className="rk-product-table-wrap">
                        <table className="rk-product-table">
                            <thead><tr><th>Ürün</th><th>Barkod</th><th className="right">Skor</th><th className="right">Not</th></tr></thead>
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

    // 
    // TAB 5: AI ERK YAZARI
    // 
    const renderContentWriter = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaPen style={{ color: "var(--rk-purple)" }} /> AI içerik yazarı</h3>
                <p className="rk-section-desc">SEO uyumlu başlık ve açıklama üretin.</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod (opsiyonel)" value={contentBarcode} onChange={(e) => setContentBarcode(e.target.value)} />
                    <input className="rk-input" placeholder="Anahtar kelimeler (virgülle ayırın)" value={contentKeywords} onChange={(e) => setContentKeywords(e.target.value)} />
                    <input className="rk-input" placeholder="Ürün bilgisi" value={contentProductInfo} onChange={(e) => setContentProductInfo(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className="rk-btn rk-btn-purple" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/content/title", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setTitleResult)}>
                        <FaPen /> Başlık üret
                    </button>
                    <button className="rk-btn rk-btn-orange" disabled={loading}
                        onClick={() => apiCall("post", "/roketfy/content/description", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setDescResult)}>
                        <FaRobot /> Açıklama üret
                    </button>
                </div>
            </div>

            {titleResult?.content?.generatedTitles?.length > 0 && (
                <div className="rk-section">
                    <h4 className="rk-section-title">Üretilen başlıklar</h4>
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
                    <h4 className="rk-section-title">Üretilen açıklamalar</h4>
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

    // 
    // TAB 6: YORUM ANALZ
    // 
    const renderReviewAnalysis = () => (
        <div className="rk-content">
            <div className="rk-section">
                <h3 className="rk-section-title"><FaComments style={{ color: "var(--rk-pink)" }} /> Yorum Analizi</h3>
                <p className="rk-section-desc">Trendyol ürün linki veya Content ID ile yorumları yapay zekâ destekli analiz edin.</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Trendyol ürün linki veya Content ID" value={reviewInput} onChange={(e) => setReviewInput(e.target.value)} />
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
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Duygu dağılımı</div>
                            <div className="rk-sentiment-bar">
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.positive || 0}%`, background: "var(--rk-green)" }} />
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.neutral || 0}%`, background: "var(--rk-yellow)" }} />
                                <div style={{ width: `${reviewResult.reviews.sentimentBreakdown?.negative || 0}%`, background: "var(--rk-red)" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "var(--rk-green)" }}> %{reviewResult.reviews.sentimentBreakdown?.positive}</span>
                                <span style={{ color: "var(--rk-yellow)" }}> %{reviewResult.reviews.sentimentBreakdown?.neutral}</span>
                                <span style={{ color: "var(--rk-red)" }}> %{reviewResult.reviews.sentimentBreakdown?.negative}</span>
                            </div>
                        </div>
                        <div className="rk-stat-card" style={{ flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rk-green)" }}>Güçlü yönler</div>
                            {(reviewResult.reviews.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 11, color: "var(--rk-text-sec)" }}> {s}</div>)}
                            {(reviewResult.reviews.strengths || []).length === 0 && <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Veri yetersiz</div>}
                        </div>
                        <div className="rk-stat-card" style={{ flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rk-red)" }}>Zayıf yönler</div>
                            {(reviewResult.reviews.weaknesses || []).map((w, i) => <div key={i} style={{ fontSize: 11, color: "var(--rk-text-sec)" }}> {w}</div>)}
                            {(reviewResult.reviews.weaknesses || []).length === 0 && <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Sorun yok</div>}
                        </div>
                    </div>

                    {/* Konu Analizi */}
                    {reviewResult.reviews.topicAnalysis?.length > 0 && (
                        <div className="rk-section">
                            <h4 className="rk-section-title">Konu bazlı analiz</h4>
                            {reviewResult.reviews.topicAnalysis.map((topic, i) => (
                                <div key={i} style={{ padding: "10px 14px", border: "1px solid var(--rk-border)", borderRadius: 8, marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{topic.topic}</span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <span className={`rk-chip ${topic.sentiment === "positive" ? "rk-chip-success" : topic.sentiment === "negative" ? "rk-chip-danger" : "rk-chip-warning"}`}>
                                                {topic.sentiment === "positive" ? "Pozitif" : topic.sentiment === "negative" ? "Negatif" : "Nötr"}
                                            </span>
                                            <span className="rk-chip rk-chip-info">{topic.mentionCount} atıf</span>
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
                            <h4 className="rk-section-title">Son yorumlar ({reviewResult.reviews.recentReviews.length})</h4>
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
                                            {r.sentiment === "positive" ? "Pozitif" : r.sentiment === "negative" ? "Negatif" : "Nötr"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--rk-text-sec)", lineHeight: 1.5 }}>{r.comment}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI zet */}
                    {reviewResult.reviews.aiSummary && (
                        <div className="rk-section" style={{ borderColor: "rgba(78,205,196,0.3)", background: "rgba(78,205,196,0.04)" }}>
                            <h4 className="rk-section-title"><FaRobot style={{ color: "var(--rk-accent)" }} /> AI özeti</h4>
                            <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--rk-text-sec)", margin: 0 }}>{reviewResult.reviews.aiSummary}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // 
    // TAB 7: Anahtar kelime ve fiyat
    // 
    const renderKeywordsAndPrice = () => (
        <div className="rk-content">
            {/* Anahtar Kelime */}
            <div className="rk-section">
                <h3 className="rk-section-title"><FaKey style={{ color: "var(--rk-accent)" }} /> Anahtar Kelime Araştırması</h3>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Anahtar kelime girin… (ör. tişört, ayakkabı)" value={kwSeed} onChange={(e) => setKwSeed(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && kwSeed && apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)} />
                    <button className="rk-btn rk-btn-primary" disabled={!kwSeed || loading}
                        onClick={() => apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)}>
                        <FaSearch /> Ara
                    </button>
                </div>
            </div>

            {kwResult?.keywords && (
                <>
                    <div className="rk-stats-row">
                        <div className="rk-stat-card">
                            <div className="rk-stat-icon" style={{ background: "rgba(78,205,196,0.12)", color: "var(--rk-accent)" }}><FaBoxOpen /></div>
                            <div className="rk-stat-info"><div className="rk-stat-label">Toplam ürün</div><div className="rk-stat-value">{fmt(kwResult.keywords.totalMarketProducts)}</div></div>
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
                                <thead><tr><th>Anahtar kelime</th><th className="right">Arama hacmi</th><th className="right">Rekabet</th><th className="right">Uygunluk</th></tr></thead>
                                <tbody>
                                    {kwResult.keywords.keywords.slice(0, 25).map((kw, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: i < 3 ? 700 : 400 }}>{kw.keyword}</td>
                                            <td className="right" style={{ fontWeight: 600 }}>{fmt(kw.searchVolume)}</td>
                                            <td className="right">
                                                <span className={`rk-chip ${kw.competition === "low" ? "rk-chip-success" : kw.competition === "high" || kw.competition === "very_high" ? "rk-chip-danger" : "rk-chip-warning"}`}>
                                                    {kw.competition === "low" ? "Düşük" : kw.competition === "high" ? "Yüksek" : kw.competition === "very_high" ? "Çok yüksek" : "Orta"}
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
                            <h4 className="rk-brands-title"><FaTag /> En popüler markalar</h4>
                            <div className="rk-brands-wrap">
                                {kwResult.keywords.topBrands.map((b, i) => (
                                    <span key={i} className={`rk-brand-tag ${i < 3 ? "top" : ""}`}>{b.name} (%{b.percentage})</span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Fiyat önerisi */}
            <div className="rk-section" style={{ marginTop: 20 }}>
                <h3 className="rk-section-title"><FaDollarSign style={{ color: "var(--rk-green)" }} /> Fiyat önerisi</h3>
                <p className="rk-section-desc">Ürününüzü Trendyol pazar fiyatlarıyla karşılaştırın.</p>
                <div className="rk-form-row">
                    <input className="rk-input" placeholder="Barkod girin" value={priceBarcode} onChange={(e) => setPriceBarcode(e.target.value)} />
                    <button className="rk-btn rk-btn-primary" disabled={!priceBarcode || loading}
                        onClick={() => apiCall("post", "/roketfy/price/suggest", { barcode: priceBarcode }, setPriceResult)}>
                        <FaDollarSign /> Fiyat öner
                    </button>
                </div>
            </div>

            {priceResult?.pricing && (
                <div className="rk-section" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.03)" }}>
                    <div className="rk-stats-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Mevcut fiyat</div>
                            <div style={{ fontSize: 28, fontWeight: 800 }}>{fmtPrice(priceResult.pricing.currentPrice)}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-green)", fontWeight: 600 }}>Önerilen fiyat</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--rk-green)" }}>{fmtPrice(priceResult.pricing.suggestedPrice)}</div>
                            {priceResult.pricing.profitMargin != null && <span className="rk-chip rk-chip-success">Kâr: %{priceResult.pricing.profitMargin}</span>}
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--rk-text-dim)" }}>Trendyol ortalaması</div>
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
                         {priceResult.pricing.reasoning}
                    </div>

                    {priceResult.pricing.competitorPrices?.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <h4 className="rk-brands-title"><FaTag /> Rakip fiyatları</h4>
                            <div className="rk-product-table-wrap">
                                <table className="rk-product-table">
                                    <thead><tr><th>Ürün</th><th>Satıcı</th><th className="right">Fiyat</th><th className="right">Puan</th><th className="right">Fark %</th></tr></thead>
                                    <tbody>
                                        {priceResult.pricing.competitorPrices.map((cp, i) => {
                                            const diff = priceResult.pricing.currentPrice > 0 ? Math.round(((cp.price - priceResult.pricing.currentPrice) / priceResult.pricing.currentPrice) * 100) : 0;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.productName}</td>
                                                    <td style={{ fontSize: 12, color: "var(--rk-text-sec)" }}>{cp.sellerName}</td>
                                                    <td className="right" style={{ fontWeight: 600 }}>{fmtPrice(cp.price)}</td>
                                                    <td className="right"> {cp.ratingScore || ""}</td>
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

    // 
    // ANA RENDER
    // 
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
            <div className="rk-header">
                <div className="rk-header-left">
                    <h1>
                        <FaRocket className="rk-header-icon" />
                        Dashtock Radar
                    </h1>
                    <p>Pazar istihbaratı: en çok satanlar, flaş fırsatlar, rakip analizi ve fiyat takibi — tek ekranda.</p>
                </div>
                <div className="rk-header-right">
                    <div className="rk-live-badge">
                        <span className="rk-live-dot" />
                        CANLI VERİ
                        {(activeTab === 0 || activeTab === 1 || (activeTab === 2 && researchResult)) && nextRefreshIn > 0 && (
                            <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>
                                {formatCountdown(nextRefreshIn)}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className={`rk-refresh-btn ${loading ? "spinning" : ""}`}
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        <FaSync /> Yenile
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rk-error">
                    <FaExclamationTriangle /> {error}
                    <button type="button" className="rk-retry-btn" style={{ marginLeft: 8 }} onClick={handleRefresh}>Tekrar dene</button>
                    <button className="rk-error-close" onClick={() => setError("")}><FaTimes /></button>
                </div>
            )}

            {dashboard?.overview && (
                <div className="rk-dash-strip">
                    <div className="rk-dash-card">
                        <strong>{fmt(dashboard.overview.totalProducts)}</strong>
                        <span>Mağaza ürünü</span>
                    </div>
                    <div className="rk-dash-card">
                        <strong>{dashboard.overview.avgListingGrade || "—"}</strong>
                        <span>Ort. liste skoru</span>
                    </div>
                    <div className="rk-dash-card">
                        <strong>{fmt(dashboard.overview.monthlyOrders)}</strong>
                        <span>Sipariş (30 gün)</span>
                    </div>
                    <div className="rk-dash-card">
                        <strong>{bestSellers?.products?.length ?? "—"}</strong>
                        <span>Canlı liste</span>
                    </div>
                </div>
            )}

            <nav className="rk-tabs-nav" aria-label="Radar analiz sekmeleri">
                <div className="rk-main-tabs">
                    {TAB_CONFIG.map((tab, i) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                type="button"
                                key={tab.id}
                                className={`rk-main-tab ${activeTab === i ? `active ${tab.color}` : ""}`}
                                onClick={() => setActiveTab(i)}
                                aria-current={activeTab === i ? "page" : undefined}
                            >
                                <Icon className="rk-tab-icon" aria-hidden />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {showCategoryPanel ? (
                <div className="rk-layout">
                    {renderCategoryPanel()}
                    {renderActiveTab()}
                </div>
            ) : (
                renderActiveTab()
            )}

            {radarToast && (
                <div className="rk-toast" role="status" aria-live="polite">{radarToast}</div>
            )}
        </div>
    );
}
