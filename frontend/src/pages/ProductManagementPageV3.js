/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİMİ SİSTEMİ V4 - TAM ENTEGRASYONLU PAZARYERI YÖNETİMİ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 📦 STOK TAKİBİ       → Tüm pazaryerlerinde otomatik senkâronizasyon
 * 🔄 ÜRÜN DAĞITIMI     → Tek girişten tüm platformlara otomatik dağıtım
 * 💰 FİYAT YÖNETİMİ   → Merkezi fiyat & kampanya kontrolü
 * 📊 KARŞILAŞTIRMA     → Hangi ürün hangi pazaryerinde var/yok
 * ⚡ TOPLU İŞLEMLER    → Seçili ürünleri toplu dağıt / güncelle
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaChartBar, FaExchangeAlt, FaListAlt,
    FaSearch, FaSync, FaBell, FaSpinner, FaBox, FaStore,
    FaWarehouse, FaMoneyBillWave, FaUpload, FaTrash,
    FaTimes, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaArrowLeft, FaArrowRight, FaSave,
    FaBarcode, FaTag, FaInfoCircle, FaBolt, FaTable,
    FaRocket, FaPercent, FaTags, FaPlus,
    FaCheck, FaEdit, FaLayerGroup, FaClipboardList,
    FaImage, FaCheckSquare, FaSquare,
    FaFilter, FaGlobe, FaExclamation, FaChevronRight,
    FaChevronDown, FaEye
} from "react-icons/fa";

import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    syncAllMarketplaces,
    syncStock,
    syncPrice,
    getComparisonMatrix,
    bulkDistributeSelected,
    getSyncLogs,
    getUnreadNotifications,
    markNotificationRead,
    getProductManagementDashboard,
    distributeProduct,
    distributeUndistributed,
    listVariantGroups,
    getVariantGroup,
    createVariantGroup,
    updateVariantGroup,
    addVariantGroupMembers,
    removeVariantGroupMembers,
    deleteVariantGroup,
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementCenter.css";
import "../styles/ProductManagementPageV4.css";

// ─── Sabitler ────────────────────────────────────────────────────────────────

/** Varyant satırında renk/beden özetı (masterProduct.attributes) */
const summarizeVariantAttrs = (attrs) => {
    if (!attrs || typeof attrs !== "object") return "—";
    const c = attrs.color || attrs.renk;
    const s = attrs.size || attrs.beden;
    const bits = [c, s].filter(Boolean);
    return bits.length ? bits.join(" · ") : "—";
};

const TABS = [
    { key: "dashboard",       icon: <FaChartBar />,      label: "Dashboard"            },
    { key: "stock",           icon: <FaWarehouse />,     label: "Stok Takibi"          },
    { key: "distribution",   icon: <FaExchangeAlt />,   label: "Ürün Dağıtımı"       },
    { key: "variants",       icon: <FaLayerGroup />,    label: "Varyant grupları"     },
    { key: "priçing",        icon: <FaMoneyBillWave />, label: "Fiyat & Kampanya"     },

    { key: "comparison",     icon: <FaTable />,         label: "Karşılaştırma"        },
    { key: "logs",           icon: <FaListAlt />,       label: "Loglar"               },
];

const MP_COLORS = {
    trendyol:    "#f27a1a",
    hepsiburada: "#ff6000",
    n11:         "#6f2da8",
    çiçeksepeti: "#e91e8c",
    amazon:      "#ff9900",
};
const mpColor = (name = "") => MP_COLORS[(name || "").toLowerCase()] || "#0f766e";

const PAGE_SIZE = 20;

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

const StockBadge = ({ stock, threshold = 10 }) => {
    if (stock === 0)        return <span className="pmv4-badge pmv4-badge-danger">Stok Yok</span>;
    if (stock <= threshold) return <span className="pmv4-badge pmv4-badge-warning">Düşük Stok</span>;
    return                         <span className="pmv4-badge pmv4-badge-success">Stokta</span>;
};

const SyncBadge = ({ status }) => {
    const map = {
        synced:  ["pmv4-badge-success", "Senkâron"],
        error:   ["pmv4-badge-danger",  "Hata"],
        pending: ["pmv4-badge-warning", "Bekliyor"],
    };
    const [cls, label] = map[status] || ["pmv4-badge-info", status || "—"];
    return <span className={`pmv4-badge ${cls}`}>{label}</span>;
};

const safeImg = (images) => {
    if (!images || !images.length) return null;
    const f = images[0];
    return typeof f === "string" ? f : f?.url || null;
};

const Spinner = () => <FaSpinner className="pmv4-spin" />;

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

const ProductManagementPageV3 = () => {
    // ── Genel ────────────────────────────────────────────────────────────────
    const [activeTab,       setActiveTab]       = useState("dashboard");
    const [toast,           setToast]           = useState(null);
    const [loading,         setLoading]         = useState(false);
    const toastTimer = useRef(null);

    // ── Dashboard ────────────────────────────────────────────────────────────
    const [dashboard,       setDashboard]       = useState(null);
    const [autoSyncRunning, setAutoSyncRunning] = useState(false);
    const [autoSyncStatus,  setAutoSyncStatus]  = useState("");

    // ── Ürünler (Stok & Fiyat sekmelerinde ortak) ────────────────────────────
    const [products,        setProducts]        = useState([]);
    const [totalProducts,   setTotalProducts]   = useState(0);
    const [page,            setPage]            = useState(0);
    const [search,          setSearch]          = useState("");
    const [filterMP,        setFilterMP]        = useState("");
    const [filterStock,     setFilterStock]     = useState("");
    const [marketplaces,    setMarketplaces]    = useState([]);

    // ── Stok modal ───────────────────────────────────────────────────────────
    const [stockModal,      setStockModal]      = useState(null); // { product }
    const [stockValue,      setStockValue]      = useState("");
    const [stockThreshold,  setStockThreshold]  = useState("");

    // ── Fiyat modal ──────────────────────────────────────────────────────────
    const [priceModal,      setPriceModal]      = useState(null); // { product }
    const [salePrice,       setSalePrice]       = useState("");
    const [listPrice,       setListPrice]       = useState("");
    const [discountRate,    setDiscountRate]    = useState("");

    // ── Ürün Dağıtımı ────────────────────────────────────────────────────────
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkTargets,      setBulkTargets]      = useState([]);
    const [distResult,       setDistResult]       = useState(null);

    // ── Yeni Ürün Formu ──────────────────────────────────────────────────────
    const [showNewProductForm, setShowNewProductForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: "", barcode: "", sku: "", description: "",
        price: "", listPrice: "", stock: "", category: "", brand: "",
        images: [""],
    });
    const [newProductTargets, setNewProductTargets] = useState([]);

    // ── Karşılaştırma ────────────────────────────────────────────────────────
    const [compMatrix,      setCompMatrix]      = useState([]);
    const [compTotal,       setCompTotal]       = useState(0);
    const [compPage,        setCompPage]        = useState(0);
    const [compSearch,      setCompSearch]      = useState("");
    const [missingOnly,     setMissingOnly]     = useState(false);
    const [compSummary,     setCompSummary]     = useState(null);

    // ── Silme onay ───────────────────────────────────────────────────────────
    const [deleteModal,     setDeleteModal]     = useState(null);
    const [deleteResults,   setDeleteResults]   = useState(null);  // silme sonuçları
    const [deleting,        setDeleting]        = useState(false); // silme işlemi devam ediyor

    // ── Loglar & Bildirimler ─────────────────────────────────────────────────
    const [logs,            setLogs]            = useState([]);
    const [notifications,   setNotifications]   = useState([]);
    const [unreadCount,     setUnreadCount]     = useState(0);

    // ── Toplu Fiyat Güncelleme ───────────────────────────────────────────────
    const [bulkPriceMode,   setBulkPriceMode]   = useState("fixed"); // fixed | percent | margin
    const [bulkPriceValue,  setBulkPriceValue]  = useState("");
    const [bulkPriceTargets, setBulkPriceTargets] = useState([]);

    // ── Dağıtım Detay Görünümü ────────────────────────────────────────────────
    const [distDetailProduct,  setDistDetailProduct]  = useState(null); // seçili ürün detay
    const [distSearch,         setDistSearch]         = useState("");
    const [distFilterStatus,   setDistFilterStatus]   = useState(""); // ""|"synced"|"error"|"pending"|"missing"
    const [distFilterMP,       setDistFilterMP]       = useState("");

    // ── Varyant grupları sekmesi ─────────────────────────────────────────────
    const [variantGroups,     setVariantGroups]     = useState([]);
    const [vgLoading,         setVgLoading]         = useState(false);
    const [vgCreateOpen,      setVgCreateOpen]      = useState(false);
    const [vgDetailOpen,      setVgDetailOpen]      = useState(false);
    const [vgPickerOpen,      setVgPickerOpen]      = useState(false);
    const [vgActiveId,        setVgActiveId]        = useState(null);
    const [vgMembers,         setVgMembers]         = useState([]);
    const [vgPickerRows,      setVgPickerRows]      = useState([]);
    const [vgFormName,        setVgFormName]        = useState("");
    const [vgFormNotes,       setVgFormNotes]       = useState("");
    const [vgFormMainId,      setVgFormMainId]      = useState("");
    const [vgFormColorLbl,    setVgFormColorLbl]    = useState("Renk");
    const [vgFormSizeLbl,     setVgFormSizeLbl]     = useState("Beden");
    const [vgCreatePick,      setVgCreatePick]      = useState(() => new Set());
    const [vgPickerPick,      setVgPickerPick]      = useState(() => new Set());

    // ─── Toast ────────────────────────────────────────────────────────────────
    const showToast = useCallback((msg, type = "info") => {
        setToast({ msg, type });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4500);
    }, []);

    // ─── Veri yükleme ─────────────────────────────────────────────────────────
    const loadDashboard = useCallback(async () => {
        try {
            const res = await getProductManagementDashboard();
            if (res?.dashboard) setDashboard(res.dashboard);
        } catch { /* sessiz */ }
    }, []);

    const loadProducts = useCallback(async () => {
        try {
            const params = { page, limit: PAGE_SIZE };
            if (search)      params.search      = search;
            if (filterMP)    params.marketplace = filterMP;
            if (filterStock) params.stockStatus = filterStock;
            const res = await getProducts(params);
            setProducts(res.products || []);
            setTotalProducts(res.total || 0);
        } catch (e) {
            showToast("Ürünler yüklenemedi: " + (e.response?.data?.error || e.message), "error");
        }
    }, [page, search, filterMP, filterStock, showToast]);

    const loadMarketplaces = useCallback(async () => {
        try {
            const res = await getUserMarketplaces();
            const list = Array.isArray(res) ? res : (res.marketplaces || res.data || []);
            setMarketplaces(list.map(m => ({ ...m, name: m.marketplaceName || m.name || "" })));
        } catch { /* sessiz */ }
    }, []);

    const loadComparison = useCallback(async () => {
        try {
            const params = { page: compPage, limit: PAGE_SIZE };
            if (compSearch)  params.search      = compSearch;
            if (missingOnly) params.missingOnly  = "true";
            const res = await getComparisonMatrix(params);
            setCompMatrix(res.matrix || []);
            setCompTotal(res.total || 0);
            setCompSummary(res.summary || null);
        } catch (e) {
            showToast("Karşılaştırma yüklenemedi: " + (e.response?.data?.error || e.message), "error");
        }
    }, [compPage, compSearch, missingOnly, showToast]);

    const loadLogs = useCallback(async () => {
        try {
            const res = await getSyncLogs({ limit: 50 });
            setLogs(res.logs || []);
        } catch { /* sessiz */ }
    }, []);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await getUnreadNotifications();
            setNotifications(res.notifications || []);
            setUnreadCount(res.counts?.total || 0);
        } catch { /* sessiz */ }
    }, []);

    const loadVariantGroups = useCallback(async () => {
        setVgLoading(true);
        try {
            const data = await listVariantGroups();
            setVariantGroups(data.groups || []);
        } catch (e) {
            showToast("Varyant grupları yüklenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setVgLoading(false);
        }
    }, [showToast]);

    // ─── Otomatik arka plan sync ──────────────────────────────────────────────
    const runAutoSync = useCallback(async () => {
        if (autoSyncRunning) return;
        setAutoSyncRunning(true);
        setAutoSyncStatus("⏳ Tüm pazaryerlerinden ürünler çekiliyor...");
        try {
            const res = await syncAllMarketplaces();
            const { totalNew = 0, totalUpdated = 0, totalErrors = 0 } = res.summary || {};
            setAutoSyncStatus(`✅ Tamamlandı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated} | Hata: ${totalErrors}`);
            showToast(`Senkâronizasyon tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`, "success");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            setAutoSyncStatus("❌ Hata: " + (e.response?.data?.error || e.message));
            showToast("Senkâronizasyon başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setAutoSyncRunning(false);
            setTimeout(() => setAutoSyncStatus(""), 6000);
        }
    }, [autoSyncRunning, showToast, loadProducts, loadDashboard, loadComparison]);

    // ─── İlk yükleme ─────────────────────────────────────────────────────────
    useEffect(() => {
        loadDashboard();
        loadMarketplaces();
        loadNotifications();
        loadProducts();
        setTimeout(() => runAutoSync(), 1200);
        const iv = setInterval(() => loadNotifications(), 15000);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]);

    useEffect(() => {
        if (activeTab === "logs")       { loadLogs(); loadNotifications(); }
        if (activeTab === "dashboard")  loadDashboard();
        if (activeTab === "comparison") loadComparison();
        if (activeTab === "stock" || activeTab === "priçing" || activeTab === "distribution") loadProducts();
        if (activeTab === "variants")   { loadVariantGroups(); loadProducts(); }
        // n11upload sekmesi kaldırıldı
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => { loadComparison(); }, [compPage, compSearch, missingOnly]);

    // ─── Stok güncelle ────────────────────────────────────────────────────────
    const handleSyncStock = async () => {
        if (!stockModal?.product) return;
        const val = parseInt(stockValue);
        if (isNaN(val) || val < 0) { showToast("Geçerli bir stok girin (0 veya üzeri)", "warning"); return; }
        setLoading(true);
        try {
            const priceUpd = listPrice ? { listPrice: parseFloat(listPrice) } : null;
            await syncStock(stockModal.product._id, val, priceUpd);
            showToast("✅ Stok tüm pazaryerlerinde güncellendi!", "success");
            setStockModal(null); setStockValue(""); setStockThreshold("");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Stok güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Fiyat güncelle ───────────────────────────────────────────────────────
    const handleSyncPrice = async () => {
        if (!priceModal?.product) return;
        const sp = parseFloat(salePrice);
        if (isNaN(sp) || sp <= 0) { showToast("Geçerli bir satış fiyatı girin", "warning"); return; }
        setLoading(true);
        try {
            const lp = listPrice ? parseFloat(listPrice) : null;
            await syncPrice(priceModal.product._id, sp, lp);
            showToast("✅ Fiyat tüm pazaryerlerinde güncellendi!", "success");
            setPriceModal(null); setSalePrice(""); setListPrice(""); setDiscountRate("");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Fiyat güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Fiyat hesaplama yardımcıları ─────────────────────────────────────────
    const calcDiscountRate = (sp, lp) => {
        if (!sp || !lp || parseFloat(lp) <= 0) return "";
        const rate = ((parseFloat(lp) - parseFloat(sp)) / parseFloat(lp) * 100).toFixed(1);
        return rate > 0 ? rate : "";
    };

    const applyDiscount = (lp, rate) => {
        if (!lp || !rate) return "";
        return (parseFloat(lp) * (1 - parseFloat(rate) / 100)).toFixed(2);
    };

    // ─── Toplu fiyat güncelleme ───────────────────────────────────────────────
    const handleBulkPriceUpdate = async () => {
        if (selectedProducts.length === 0) { showToast("En az bir ürün seçin", "warning"); return; }
        if (!bulkPriceValue) { showToast("Fiyat değeri girin", "warning"); return; }
        setLoading(true);
        let successCount = 0, errorCount = 0;
        try {
            for (const pid of selectedProducts) {
                const product = products.find(p => p._id === pid);
                if (!product) continue;
                const mp = product.masterProduct || product;
                let newPrice;
                if (bulkPriceMode === "fixed") {
                    newPrice = parseFloat(bulkPriceValue);
                } else if (bulkPriceMode === "percent") {
                    newPrice = parseFloat(mp.price || 0) * (1 - parseFloat(bulkPriceValue) / 100);
                } else if (bulkPriceMode === "margin") {
                    newPrice = parseFloat(mp.price || 0) * (1 + parseFloat(bulkPriceValue) / 100);
                }
                if (!newPrice || newPrice <= 0) continue;
                try {
                    await syncPrice(pid, parseFloat(newPrice.toFixed(2)));
                    successCount++;
                } catch { errorCount++; }
            }
            showToast(`✅ Toplu fiyat güncellendi — Başarılı: ${successCount}, Hata: ${errorCount}`, "success");
            setBulkPriceValue(""); setSelectedProducts([]);
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Toplu fiyat güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Ürün sil (tekli — pazaryerlerinden de zorunlu kaldırma) ────────────
    const handleDelete = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        setDeleteResults(null);
        try {
            const res = await deleteProduct(deleteModal._id, {
                deleteFromMarketplaces: true
            });
            setDeleteResults(res.marketplaceResults || []);
            showToast("✅ " + (res.message || "Ürün silindi"), "success");
            // Sonuçları 3sn göster, sonra kapat
            setTimeout(() => {
                setDeleteModal(null); setDeleteResults(null);
                loadProducts(); loadDashboard(); loadComparison();
            }, res.marketplaceResults?.length > 0 ? 3000 : 500);
        } catch (e) {
            showToast("Ürün silinemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setDeleting(false); }
    };

    // ─── Toplu dağıtım ────────────────────────────────────────────────────────
    const handleBulkDistribute = async () => {
        if (selectedProducts.length === 0) { showToast("En az bir ürün seçin", "warning"); return; }
        if (bulkTargets.length === 0)       { showToast("En az bir hedef pazaryeri seçin", "warning"); return; }
        setLoading(true);
        setDistResult(null);
        try {
            const res = await bulkDistributeSelected(selectedProducts, bulkTargets);
            const r = res.results || {};
            setDistResult(r);
            showToast(`✅ Dağıtım tamamlandı — Başarılı: ${r.success || 0}, Atlanan: ${r.skipped || 0}, Hata: ${r.error || 0}`, "success");
            setSelectedProducts([]); setBulkTargets([]);
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Toplu dağıtım başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Yeni ürün oluştur ────────────────────────────────────────────────────
    const handleCreateProduct = async () => {
        const { name, barcode, sku, price } = newProduct;
        if (!name || !barcode || !sku || !price) {
            showToast("Ad, barkod, SKU ve fiyat zorunludur", "warning"); return;
        }
        setLoading(true);
        try {
            const payload = {
                ...newProduct,
                price:     parseFloat(newProduct.price),
                listPrice: newProduct.listPrice ? parseFloat(newProduct.listPrice) : parseFloat(newProduct.price),
                stock:     parseInt(newProduct.stock) || 0,
                images:    newProduct.images.filter(Boolean).map(url => ({ url })),
                marketplaceMappings: newProductTargets.map(mpName => {
                    const mp = marketplaces.find(m => m.name === mpName);
                    return { marketplaceId: mp?._id, marketplaceName: mpName, syncStatus: "pending" };
                }),
            };
            await createProduct(payload);
            showToast("✅ Ürün oluşturuldu ve seçili pazaryerlerine dağıtıldı!", "success");
            setShowNewProductForm(false);
            setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
            setNewProductTargets([]);
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            const errData = e.response?.data;
            if (e.response?.status === 409 && errData?.type) {
                // 🛡️ Duplike ürün hatası — kullanıcıya detaylı bilgi göster
                const conflict = errData.conflicts?.[errData.type];
                const conflictInfo = conflict ? `\nMevcut ürün: "${conflict.name}" (Model: ${conflict.sku || "-"}, Stok Kodu: ${conflict.barcode || "-"})` : "";
                showToast(`⚠️ ${errData.error}${conflictInfo}`, "error");
            } else {
                showToast("Ürün oluşturulamadı: " + (errData?.error || e.message), "error");
            }
        } finally { setLoading(false); }
    };

    // ─── Seçim yardımcıları ───────────────────────────────────────────────────
    const toggleProduct = (id) =>
        setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const toggleAllProducts = () =>
        setSelectedProducts(selectedProducts.length === products.length ? [] : products.map(p => p._id));

    const toggleTarget = (name) =>
        setBulkTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const toggleBulkPriceTarget = (name) =>
        setBulkPriceTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const toggleNewProductTarget = (name) =>
        setNewProductTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    // ─── Dağıtım yardımcıları ─────────────────────────────────────────────────
    // ⚠️ FIX: syncStatus: "error" olan mapping'ler platformdan kaldırılmış/bulunamıyor demektir.
    //   Bu mapping'ler platform listesinde gösterilmez — ürün o platformda "yok" sayılır.
    const getProductSyncStatus = (product, mpName) => {
        const m = (product.marketplaceMappings || []).find(
            x => (x.marketplaceName || "").toLowerCase() === (mpName || "").toLowerCase()
                && x.syncStatus !== "error"
        );
        return m?.syncStatus || null;
    };

    const getProductMPs = (product) =>
        (product.marketplaceMappings || [])
            .filter(m => m.syncStatus !== "error") // error = platformda yok
            .map(m => m.marketplaceName)
            .filter(Boolean);

    const getMissingMPs = (product) =>
        marketplaces.map(m => m.name).filter(
            mpName => !getProductMPs(product).includes(mpName)
        );

    // ─── Bildirim ─────────────────────────────────────────────────────────────
    const handleMarkRead = async (id) => {
        try { await markNotificationRead(id); loadNotifications(); } catch { /* sessiz */ }
    };
    const handleMarkAllRead = async () => {
        try { await markNotificationRead("all"); loadNotifications(); showToast("Tüm bildirimler okundu ✅", "success"); } catch { /* sessiz */ }
    };

    // ── Varyant grupları (sekme) ─────────────────────────────────────────────
    const vgToggleCreatePick = (id) => {
        const s = String(id);
        setVgCreatePick((prev) => {
            const n = new Set(prev);
            if (n.has(s)) n.delete(s);
            else n.add(s);
            return n;
        });
    };
    const vgTogglePickerPick = (id) => {
        const s = String(id);
        setVgPickerPick((prev) => {
            const n = new Set(prev);
            if (n.has(s)) n.delete(s);
            else n.add(s);
            return n;
        });
    };

    const vgOpenCreate = async () => {
        setVgFormName("");
        setVgFormNotes("");
        setVgFormMainId("");
        setVgFormColorLbl("Renk");
        setVgFormSizeLbl("Beden");
        setVgCreatePick(new Set());
        setVgCreateOpen(true);
        try {
            const res = await getProducts({ page: 0, limit: 200 });
            setVgPickerRows((res.products || []).filter((p) => !p.variantGroupId));
        } catch {
            setVgPickerRows([]);
        }
    };

    const vgSubmitCreate = async () => {
        if (vgFormName.trim().length < 2) {
            showToast("Grup adı en az 2 karakter olmalı", "warning");
            return;
        }
        try {
            await createVariantGroup({
                name: vgFormName.trim(),
                notes: vgFormNotes,
                trendyolProductMainId: vgFormMainId.trim(),
                memberIds: [...vgCreatePick],
                dimensionHint: { colorLabel: vgFormColorLbl, sizeLabel: vgFormSizeLbl },
            });
            setVgCreateOpen(false);
            showToast("Varyant grubu oluşturuldu", "success");
            loadVariantGroups();
            loadProducts();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
        }
    };

    const vgOpenDetail = async (groupId) => {
        setVgActiveId(groupId);
        setVgDetailOpen(true);
        try {
            const data = await getVariantGroup(groupId);
            setVgFormName(data.group?.name || "");
            setVgFormNotes(data.group?.notes || "");
            setVgFormMainId(data.group?.trendyolProductMainId || "");
            setVgFormColorLbl(data.group?.dimensionHint?.colorLabel || "Renk");
            setVgFormSizeLbl(data.group?.dimensionHint?.sizeLabel || "Beden");
            setVgMembers(data.members || []);
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
            setVgMembers([]);
        }
    };

    const vgSaveDetailMeta = async () => {
        if (!vgActiveId) return;
        try {
            await updateVariantGroup(vgActiveId, {
                name: vgFormName.trim(),
                notes: vgFormNotes,
                trendyolProductMainId: vgFormMainId.trim(),
                dimensionHint: { colorLabel: vgFormColorLbl, sizeLabel: vgFormSizeLbl },
            });
            showToast("Grup bilgileri kaydedildi", "success");
            loadVariantGroups();
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
        }
    };

    const vgOpenAddPicker = async () => {
        if (!vgActiveId) return;
        setVgPickerPick(new Set());
        setVgPickerOpen(true);
        try {
            const res = await getProducts({ page: 0, limit: 250 });
            setVgPickerRows((res.products || []).filter((p) => !p.variantGroupId));
        } catch {
            setVgPickerRows([]);
        }
    };

    const vgSubmitAddMembers = async () => {
        if (!vgActiveId || vgPickerPick.size === 0) return;
        try {
            await addVariantGroupMembers(vgActiveId, [...vgPickerPick]);
            setVgPickerOpen(false);
            showToast("Ürünler gruba eklendi", "success");
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
            loadVariantGroups();
            loadProducts();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
        }
    };

    const vgRemoveMember = async (productId) => {
        if (!vgActiveId) return;
        if (!window.confirm("Bu ürünü gruptan çıkarmak istiyor musunuz?")) return;
        try {
            await removeVariantGroupMembers(vgActiveId, [productId]);
            showToast("Ürün gruptan çıkarıldı", "success");
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
            loadVariantGroups();
            loadProducts();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
        }
    };

    const vgDeleteGroup = async () => {
        if (!vgActiveId) return;
        if (!window.confirm("Grup silinecek; ürünlerdeki grup bağlantısı kalkar. Emin misiniz?")) return;
        try {
            await deleteVariantGroup(vgActiveId);
            setVgDetailOpen(false);
            setVgActiveId(null);
            showToast("Grup silindi", "success");
            loadVariantGroups();
            loadProducts();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, "error");
        }
    };

    const vgCopyMainId = () => {
        const t = (vgFormMainId || "").trim();
        if (t) navigator.clipboard?.writeText(t).then(() => showToast("Model kodu kopyalandı", "success")).catch(() => {});
        else showToast("Önce Trendyol model kodunu girin", "warning");
    };

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER — SEKMELER
    // ════════════════════════════════════════════════════════════════════════════

    // ── 0. VARYANT GRUPLARI ───────────────────────────────────────────────────
    const renderVariantGroups = () => (
        <motion.div key="variants" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            <div className="pmv4-section">
                <div className="pmv4-section-head">
                    <h2><FaLayerGroup /> Varyant grupları</h2>
                    <button type="button" className="pmv4-btn pmv4-btn-primary pmv4-btn-sm" onClick={vgOpenCreate}>
                        <FaPlus /> Yeni grup
                    </button>
                </div>
                <p className="pmv4-section-desc">
                    Aynı ürünün farklı <strong>renk</strong> veya <strong>beden</strong> satırlarını tek bir aile altında toplayın.
                    Trendyol tarafında bu ailenin ortak <strong>model kodu</strong> alanı <code style={{ color: "#4ecdc4" }}>productMainId</code> ile eşleşir;
                    her satırın kendi barkodu / stok kodu kalır. Böylece aynı katalogta çift liste hatası riskini azaltırsınız.
                </p>
                <div className="pmv4-modal-info-box" style={{ marginBottom: 14 }}>
                    <FaInfoCircle />
                    <span>
                        <strong>Nasıl kullanılır?</strong> (1) <em>Yeni grup</em> ile ad ve isteğe bağlı ürün seçimi yapın.
                        (2) Trendyol için ortak <em>model kodunu</em> yazın — tüm varyantlarda yükleme sırasında bu değer kullanılmalıdır.
                        (3) Sonradan <em>Ürün ekle</em> ile grupsuz satırları dahil edin. Zaten başka grupta olan ürün eklenemez.
                    </span>
                </div>
                <p className="pmv4-section-desc" style={{ marginTop: 0 }}>
                    <FaExclamationTriangle style={{ color: "#f59e0b", marginRight: 6, verticalAlign: "middle" }} />
                    N11 ve diğer pazaryerlerinde katalog kuralları farklıdır; bu sekme önce veriyi düzenli tutmanız için tasarlandı.
                    Otomatik pazaryeri gönderimi sonraki adımda gruptaki model kodu ile bağlanabilir.
                </p>
            </div>

            {vgLoading ? (
                <div className="pmv4-empty" style={{ padding: "48px 20px" }}>
                    <Spinner />
                    <p>Gruplar yükleniyor…</p>
                </div>
            ) : variantGroups.length === 0 ? (
                <div className="pmv4-section">
                    <div className="pmv4-empty" style={{ padding: "36px 20px" }}>
                        <FaLayerGroup size={36} style={{ opacity: 0.5 }} />
                        <p>Henüz varyant grubu yok.</p>
                        <button type="button" className="pmv4-btn pmv4-btn-outline" onClick={vgOpenCreate}>
                            <FaPlus /> İlk grubu oluştur
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {variantGroups.map((g) => (
                        <div key={g._id} className="pmv4-section" style={{ marginBottom: 0, cursor: "default" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--pmv4-text)", lineHeight: 1.3 }}>
                                        {g.name}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                                        <span className="pmv4-badge pmv4-badge-info">
                                            {(g.memberIds || []).length} ürün
                                        </span>
                                        {g.trendyolProductMainId && (
                                            <span className="pmv4-badge pmv4-badge-success" title="Trendyol productMainId">
                                                TY: {g.trendyolProductMainId}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button type="button" className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={() => vgOpenDetail(g._id)}>
                                    <FaEdit /> Düzenle
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );

    // ── 1. DASHBOARD ─────────────────────────────────────────────────────────
    const renderDashboard = () => {
        // ── Ürün bazlı istatistikler (çift sayma YOK — her ürün 1 kez sayılır) ──
        const totalUniqueProducts  = products.length;
        const outOfStockProducts   = products.filter(p => {
            const mp = p.masterProduct || p;
            const stock = p.stockTracking?.totalStock ?? mp.stock ?? 0;
            return stock === 0;
        }).length;
        const lowStockProducts     = products.filter(p => {
            const mp = p.masterProduct || p;
            const stock = p.stockTracking?.totalStock ?? mp.stock ?? 0;
            const threshold = p.stockTracking?.lowStockThreshold || 10;
            return stock > 0 && stock <= threshold;
        }).length;
        // Senkâron durumu: ürün en az 1 platformda "synced" ise senkâron sayılır
        const syncedProducts       = products.filter(p =>
            (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")
        ).length;
        // Hatalı: TÜM mapping'leri "error" olan ürün sayısı (en az 1 mapping olmalı)
        // Not: error = platformdan kaldırılmış/bulunamıyor. Sİadece error mapping'i olan ürünler sayılır.
        const errorProducts        = products.filter(p => {
            const mps = (p.marketplaceMappings || []);
            return mps.length > 0 && mps.every(m => m.syncStatus === "error");
        }).length;
        // Hiç platforma dağıtılmamış ürünler (error mapping'ler sayılmaz — platformda yok demek)
        const undistributedProducts = products.filter(p =>
            (p.marketplaceMappings || []).filter(m => m.syncStatus !== "error").length === 0
        ).length;

        // ── Pazaryeri başına ürün sayısı (unique ürün bazında) ──
        // ⚠️ FIX: syncStatus: "error" olan mapping'ler sayılmaz — platformda yok demek
        const mpProductCounts = marketplaces.map(mp => {
            const count = products.filter(p =>
                (p.marketplaceMappings || []).some(
                    m => (m.marketplaceName || "").toLowerCase() === (mp.name || "").toLowerCase()
                        && m.syncStatus !== "error"
                )
            ).length;
            const synced = products.filter(p =>
                (p.marketplaceMappings || []).some(
                    m => (m.marketplaceName || "").toLowerCase() === (mp.name || "").toLowerCase()
                        && m.syncStatus === "synced"
                )
            ).length;
            const errors = products.filter(p =>
                (p.marketplaceMappings || []).some(
                    m => (m.marketplaceName || "").toLowerCase() === (mp.name || "").toLowerCase()
                        && m.syncStatus === "error"
                )
            ).length;
            return { name: mp.name, count, synced, errors, color: mpColor(mp.name) };
        });

        const syncRate = totalUniqueProducts > 0
            ? Math.round((syncedProducts / totalUniqueProducts) * 100)
            : 0;

        const kpiCards = [
            {
                icon: "📦", label: "Toplam Ürün",
                value: totalUniqueProducts,
                sub: `${marketplaces.length} pazaryeri`,
                color: "#4ecdc4",
                onClick: () => setActiveTab("stock"),
                hint: "Her ürün 1 kez sayılır"
            },
            {
                icon: "✅", label: "Senkâron Ürün",
                value: syncedProducts,
                sub: `%${syncRate} senkâron oranı`,
                color: "#22c55e",
                onClick: () => setActiveTab("distribution"),
                hint: "En az 1 platformda senkâron"
            },
            {
                icon: "❌", label: "Hatalı Ürün",
                value: errorProducts,
                sub: errorProducts > 0 ? "Dikkat gerekiyor" : "Sorun yok",
                color: errorProducts > 0 ? "#ef4444" : "#22c55e",
                onClick: () => { setActiveTab("distribution"); setDistFilterStatus("error"); },
                hint: "En az 1 platformda hata"
            },
            {
                icon: "📉", label: "Stok Yok",
                value: outOfStockProducts,
                sub: outOfStockProducts > 0 ? "Acil stok gerekli" : "Stok sağlıklı",
                color: outOfStockProducts > 0 ? "#ef4444" : "#22c55e",
                onClick: () => { setActiveTab("stock"); setFilterStock("outOfStock"); },
                hint: "Stok = 0 olan ürünler"
            },
            {
                icon: "⚠️", label: "Düşük Stok",
                value: lowStockProducts,
                sub: `Eşik altında`,
                color: lowStockProducts > 0 ? "#f59e0b" : "#22c55e",
                onClick: () => { setActiveTab("stock"); setFilterStock("lowStock"); },
                hint: "Stok eşiğinin altındaki ürünler"
            },
            {
                icon: "🚀", label: "Dağıtılmamış",
                value: undistributedProducts,
                sub: undistributedProducts > 0 ? "Platforma ekle" : "Tümü dağıtılmış",
                color: undistributedProducts > 0 ? "#8b5cf6" : "#22c55e",
                onClick: () => { setActiveTab("distribution"); setDistFilterStatus("missing"); },
                hint: "Hiç platforma eklenmemiş"
            },
        ];

        return (
        <motion.div key="dashboard" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── Sync Durum Bandı ── */}
            {autoSyncStatus && (
                <div className={`pmv4-sync-banner ${autoSyncRunning ? "running" : "done"}`}>
                    {autoSyncRunning && <Spinner />}
                    <span>{autoSyncStatus}</span>
                </div>
            )}

            {/* ── Bilgi Notu ── */}
            <div style={{
                background: "rgba(78,205,196,0.06)",
                border: "1px solid rgba(78,205,196,0.2)",
                borderRadius: "10px",
                padding: "10px 16px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
                color: "#94a3b8"
            }}>
                <FaInfoCircle style={{ color: "#4ecdc4", flexShrink: 0 }} />
                <span>
                    Tüm sayılar <strong style={{ color: "#4ecdc4" }}>benzersiz ürün</strong> bazındadır —
                    bir ürün birden fazla platformda olsa bile <strong style={{ color: "#4ecdc4" }}>yalnızca 1 kez</strong> sayılır.
                    Kartlara tıklayarak ilgili sekmeye geçebilirsiniz.
                </span>
            </div>

            {/* ── KPI Kartları ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
                marginBottom: "24px"
            }}>
                {kpiCards.map((k, i) => (
                    <motion.div key={i}
                        onClick={k.onClick}
                        whileHover={{ y: -4, boxShadow: `0 8px 24px ${k.color}30` }}
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1.5px solid ${k.color}30`,
                            borderTop: `3px solid ${k.color}`,
                            borderRadius: "12px",
                            padding: "16px",
                            cursor: "pointer",
                            transition: "all .15s",
                            position: "relative",
                            overflow: "hidden"
                        }}>
                        {/* Arka plan parıltısı */}
                        <div style={{
                            position: "absolute", top: 0, right: 0,
                            width: "80px", height: "80px",
                            background: `radial-gradient(circle, ${k.color}15 0%, transparent 70%)`,
                            pointerEvents: "none"
                        }} />
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <span style={{ fontSize: "22px" }}>{k.icon}</span>
                            <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600 }}>{k.label}</span>
                        </div>
                        <div style={{ color: k.color, fontSize: "28px", fontWeight: 800, lineHeight: 1, marginBottom: "4px" }}>
                            {k.value}
                        </div>
                        <div style={{ color: "#475569", fontSize: "11px" }}>{k.sub}</div>
                        <div style={{
                            position: "absolute", bottom: "8px", right: "10px",
                            color: "#1e293b", fontSize: "9px", fontStyle: "italic"
                        }}>{k.hint}</div>
                    </motion.div>
                ))}
            </div>

            {/* ── İki Kolon: Pazaryeri Durumu + Senkron Özeti ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>

                {/* Pazaryeri Başına Ürün Dağılımı */}
                <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "18px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaStore style={{ color: "#4ecdc4" }} /> Pazaryeri Dağılımı
                        </h3>
                        <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm"
                            onClick={runAutoSync} disabled={autoSyncRunning}>
                            {autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et
                        </button>
                    </div>
                    {mpProductCounts.length === 0 ? (
                        <div style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: "20px" }}>
                            Henüz pazaryeri eklenmemiş.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {mpProductCounts.map((mp, i) => {
                                const pct = totalUniqueProducts > 0
                                    ? Math.round((mp.count / totalUniqueProducts) * 100)
                                    : 0;
                                return (
                                    <div key={i}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{
                                                    width: 10, height: 10, borderRadius: "50%",
                                                    background: mp.color, display: "inline-block", flexShrink: 0
                                                }} />
                                                <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{mp.name}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                <span style={{ color: "#22c55e", fontSize: "11px" }}>✅ {mp.synced}</span>
                                                {mp.errors > 0 && <span style={{ color: "#ef4444", fontSize: "11px" }}>❌ {mp.errors}</span>}
                                                <span style={{ color: mp.color, fontWeight: 700, fontSize: "13px" }}>{mp.count} ürün</span>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{
                                            height: "5px", background: "rgba(255,255,255,0.06)",
                                            borderRadius: "3px", overflow: "hidden"
                                        }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                                style={{ height: "100%", background: mp.color, borderRadius: "3px" }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Senkronizasyon Özeti */}
                <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "18px"
                }}>
                    <h3 style={{ margin: "0 0 14px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <FaSync style={{ color: "#4ecdc4" }} /> Senkronizasyon Durumu
                    </h3>

                    {/* Dairesel oran göstergesi */}
                    <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
                        <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                            <svg width="80" height="80" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                                <circle cx="40" cy="40" r="32" fill="none"
                                    stroke={syncRate >= 80 ? "#22c55e" : syncRate >= 50 ? "#f59e0b" : "#ef4444"}
                                    strokeWidth="8"
                                    strokeDasharray={`${syncRate * 2.01} 201`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 40 40)"
                                />
                            </svg>
                            <div style={{
                                position: "absolute", inset: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexDirection: "column"
                            }}>
                                <span style={{
                                    color: syncRate >= 80 ? "#22c55e" : syncRate >= 50 ? "#f59e0b" : "#ef4444",
                                    fontSize: "16px", fontWeight: 800, lineHeight: 1
                                }}>%{syncRate}</span>
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "8px" }}>
                                {totalUniqueProducts} benzersiz üründen {syncedProducts} tanesi en az 1 platformda senkron
                            </div>
                            {[
                                { label: "Senkron",       value: syncedProducts,        color: "#22c55e" },
                                { label: "Hatalı",        value: errorProducts,          color: "#ef4444" },
                                { label: "Dağıtılmamış",  value: undistributedProducts,  color: "#8b5cf6" },
                                { label: "Stok Yok",      value: outOfStockProducts,     color: "#f59e0b" },
                            ].map(row => (
                                <div key={row.label} style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", marginBottom: "4px"
                                }}>
                                    <span style={{ color: "#64748b", fontSize: "12px" }}>{row.label}</span>
                                    <span style={{ color: row.color, fontWeight: 700, fontSize: "13px" }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Son sync zamanı */}
                    {autoSyncStatus && (
                        <div style={{
                            background: "rgba(78,205,196,0.06)",
                            border: "1px solid rgba(78,205,196,0.15)",
                            borderRadius: "8px", padding: "8px 12px",
                            color: "#4ecdc4", fontSize: "11px",
                            display: "flex", alignItems: "center", gap: "6px"
                        }}>
                            {autoSyncRunning ? <Spinner /> : "✅"} {autoSyncStatus}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Hızlı Aksiyonlar ── */}
            <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                padding: "18px",
                marginBottom: "20px"
            }}>
                <h3 style={{ margin: "0 0 14px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaRocket style={{ color: "#4ecdc4" }} /> Hızlı Aksiyonlar
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                    {[
                        {
                            icon: <FaSync />, label: "Tüm Pazaryerlerini Senkronize Et",
                            desc: "Stok & fiyatları güncelle",
                            color: "#4ecdc4",
                            action: runAutoSync,
                            disabled: autoSyncRunning
                        },
                        {
                            icon: <FaPlus />, label: "Yeni Ürün Ekle & Dağıt",
                            desc: "Tüm platformlara dağıt",
                            color: "#22c55e",
                            action: () => { setShowNewProductForm(true); setActiveTab("distribution"); }
                        },
                        {
                            icon: <FaTable />, label: "Karşılaştırma Matrisi",
                            desc: "Hangi ürün nerede var?",
                            color: "#8b5cf6",
                            action: () => setActiveTab("comparison")
                        },
                        {
                            icon: <FaRocket />, label: "Eksikleri Dağıt",
                            desc: "Platformlarda eksik ürünleri dağıt",
                            color: "#f59e0b",
                            action: async () => {
                                try {
                                    showToast("🚀 Dağıtım başlatılıyor...", "info");
                                    const r = await distributeUndistributed({});
                                    const s = r.stats || {};
                                    showToast(`✅ ${s.distributed || 0} ürün dağıtıldı${s.error > 0 ? `, ${s.error} hata` : ""}`, "success");
                                    loadProducts(); loadDashboard(); loadComparison();
                                } catch (e) {
                                    showToast(e.response?.data?.error || "Dağıtım hatası", "error");
                                }
                            }
                        },
                        {
                            icon: <FaListAlt />, label: "İşlem Logları",
                            desc: `${unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Tüm işlem geçmişi"}`,
                            color: unreadCount > 0 ? "#ec4899" : "#64748b",
                            action: () => setActiveTab("logs")
                        },
                    ].map((a, i) => (
                        <motion.button key={i}
                            onClick={a.action}
                            disabled={a.disabled}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                background: `${a.color}0d`,
                                border: `1px solid ${a.color}30`,
                                borderRadius: "10px",
                                padding: "12px 14px",
                                cursor: a.disabled ? "not-allowed" : "pointer",
                                opacity: a.disabled ? 0.6 : 1,
                                display: "flex", alignItems: "center", gap: "12px",
                                textAlign: "left", transition: "all .12s"
                            }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "8px",
                                background: `${a.color}20`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: a.color, fontSize: "15px", flexShrink: 0
                            }}>
                                {a.disabled ? <Spinner /> : a.icon}
                            </div>
                            <div>
                                <div style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700 }}>{a.label}</div>
                                <div style={{ color: "#475569", fontSize: "11px", marginTop: "2px" }}>{a.desc}</div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* ── Son Loglar ── */}
            {logs.length > 0 && (
                <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "18px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                            <FaListAlt style={{ color: "#4ecdc4" }} /> Son İşlemler
                        </h3>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={() => setActiveTab("logs")}>
                            Tümünü Gör →
                        </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {logs.slice(0, 5).map((log, i) => (
                            <div key={i} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 120px 100px 60px",
                                gap: "10px", alignItems: "center",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                                borderRadius: "8px", padding: "8px 12px"
                            }}>
                                <span style={{ color: "#e2e8f0", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {log.product?.name || log.product?.barcode || "—"}
                                </span>
                                <span style={{ color: "#64748b", fontSize: "11px" }}>{log.marketplace?.name || "—"}</span>
                                <span style={{ color: "#94a3b8", fontSize: "11px" }}>{log.actionType || "—"}</span>
                                <SyncBadge status={log.status} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
        );
    };

    // ── 2. STOK TAKİBİ ───────────────────────────────────────────────────────
    const renderStock = () => {
        const totalStock   = products.length;
        const outOfStock   = products.filter(p => { const s = p.stockTracking?.totalStock ?? (p.masterProduct||p).stock ?? 0; return s === 0; }).length;
        const lowStock     = products.filter(p => { const mp2 = p.masterProduct||p; const s = p.stockTracking?.totalStock ?? mp2.stock ?? 0; const t = p.stockTracking?.lowStockThreshold||10; return s>0 && s<=t; }).length;
        const healthyStock = totalStock - outOfStock - lowStock;

        return (
        <motion.div key="stock" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* KPI Satırı */}
            <div className="pmv4-stock-kpi-row">
                {[
                    { icon:"📦", label:"Toplam Ürün",   val: totalStock,   color:"#14b8a6", bg:"rgba(20,184,166,0.1)",  filter:"" },
                    { icon:"✅", label:"Stok Sağlıklı", val: healthyStock, color:"#22c55e", bg:"rgba(34,197,94,0.1)",   filter:"" },
                    { icon:"⚠️", label:"Düşük Stok",    val: lowStock,     color:"#f59e0b", bg:"rgba(245,158,11,0.1)",  filter:"lowStock" },
                    { icon:"🚫", label:"Stok Yok",      val: outOfStock,   color:"#ef4444", bg:"rgba(239,68,68,0.1)",   filter:"outOfStock" },
                ].map((k,i) => (
                    <div key={i} className="pmv4-stock-kpi"
                        onClick={() => { setFilterStock(filterStock===k.filter?"":k.filter); setPage(0); }}
                        style={{ borderColor: filterStock===k.filter ? k.color : undefined, cursor:"pointer" }}>
                        <div className="pmv4-stock-kpi-icon" style={{ background: k.bg, color: k.color }}>
                            <span style={{fontSize:"1.3rem"}}>{k.icon}</span>
                        </div>
                        <div>
                            <div className="pmv4-stock-kpi-val" style={{ color: k.color }}>{k.val}</div>
                            <div className="pmv4-stock-kpi-label">{k.label}</div>
                        </div>
                        {filterStock===k.filter && k.filter && (
                            <div style={{ position:"absolute", top:8, right:10, fontSize:9, color:k.color, fontWeight:700, background:`${k.color}20`, borderRadius:4, padding:"1px 6px" }}>AKTİF</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Açıklama Bandı */}
            <div className="pmv4-info-banner">
                <span className="pmv4-info-icon">🔄</span>
                <div>
                    <strong>Merkezi Stok Yönetimi</strong>
                    <p>Stok güncellediğinizde sistem <strong>tüm bağlı pazaryerlerini</strong> aynı anda günceller.
                    Trendyol'da satış olduğunda Hepsiburada, N11 ve diğer platformlar da otomatik düşer — fazla satış riski sıfırlanır.</p>
                </div>
            </div>

            {/* Filtreler */}
            <div className="pmv4-filters">
                <div className="pmv4-search-box">
                    <FaSearch />
                    <input type="text" placeholder="Ürün adı, barkod veya SKU ara..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
                </div>
                <select className="pmv4-select" value={filterMP}
                    onChange={e => { setFilterMP(e.target.value); setPage(0); }}>
                    <option value="">Tüm Pazaryerleri</option>
                    {marketplaces.map((mp, i) => <option key={i} value={mp.name}>{mp.name}</option>)}
                </select>
                <select className="pmv4-select" value={filterStock}
                    onChange={e => { setFilterStock(e.target.value); setPage(0); }}>
                    <option value="">Tüm Stok Durumları</option>
                    <option value="outOfStock">🚫 Stok Yok</option>
                    <option value="lowStock">⚠️ Düşük Stok</option>
                </select>
                <span className="pmv4-total-label">{totalProducts} ürün</span>
                <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm" onClick={runAutoSync} disabled={autoSyncRunning}>
                    {autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et
                </button>
            </div>

            {/* Ürün Listesi */}
            {products.length === 0 ? (
                <div className="pmv4-empty">
                    <FaBox size={48} />
                    <p>Henüz ürün yok. Pazaryerlerinden senkronize edin.</p>
                    <button className="pmv4-btn pmv4-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>
                        {autoSyncRunning ? <Spinner /> : <FaSync />} Pazaryerlerinden Çek
                    </button>
                </div>
            ) : (
                <div className="pmv4-stock-table-wrapper">
                    <table className="pmv4-stock-table">
                        <thead>
                            <tr>
                                <th>Ürün</th>
                                <th>Barkod / SKU</th>
                                <th style={{textAlign:"center"}}>Stok</th>
                                <th style={{textAlign:"center"}}>Durum</th>
                                <th>Pazaryerleri</th>
                                <th style={{textAlign:"right"}}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => {
                                const mp    = product.masterProduct || product;
                                const img   = safeImg(mp.images);
                                const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                const threshold = product.stockTracking?.lowStockThreshold || 10;
                                const mappings  = (product.marketplaceMappings || []).filter(m => m.syncStatus !== "error");
                                const stockColor = stock === 0 ? "#ef4444" : stock <= threshold ? "#f59e0b" : "#22c55e";
                                return (
                                    <tr key={product._id}>
                                        <td>
                                            <div className="pmv4-product-cell">
                                                <div className="pmv4-product-thumb">
                                                    {img
                                                        ? <img src={img} alt={mp.name} onError={e => { e.target.style.display = "none"; }} />
                                                        : <FaBox />
                                                    }
                                                </div>
                                                <div>
                                                    <div className="pmv4-product-name" title={mp.name}>{mp.name || "İsimsiz"}</div>
                                                    {mp.brand && <div style={{fontSize:"0.72rem",color:"#64748b",marginTop:2}}>{mp.brand}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="pmv4-meta-cell">
                                                <span><FaBarcode style={{color:"#475569"}} /> {mp.barcode || "—"}</span>
                                                <span><FaTag style={{color:"#475569"}} /> {mp.sku || "—"}</span>
                                            </div>
                                        </td>
                                        <td style={{textAlign:"center"}}>
                                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                                <span className="pmv4-stock-value" style={{color:stockColor}}>{stock}</span>
                                                <span className="pmv4-stock-unit">İadet</span>
                                            </div>
                                        </td>
                                        <td style={{textAlign:"center"}}>
                                            <StockBadge stock={stock} threshold={threshold} />
                                        </td>
                                        <td>
                                            <div className="pmv4-mp-badges">
                                                {mappings.length > 0
                                                    ? mappings.map((m, i) => (
                                                        <span key={i} className="pmv4-mp-chip"
                                                            style={{ background: mpColor(m.marketplaceName) }}
                                                            title={`${m.marketplaceName} — ${m.syncStatus || "pending"}`}>
                                                            {m.marketplaceName}
                                                        </span>
                                                    ))
                                                    : <span className="pmv4-text-muted" style={{fontSize:"0.75rem"}}>Platform yok</span>
                                                }
                                            </div>
                                        </td>
                                        <td style={{textAlign:"right"}}>
                                            <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                                                <button className="pmv4-btn pmv4-btn-blue pmv4-btn-sm"
                                                    onClick={() => {
                                                        setStockModal({ product });
                                                        setStockValue(String(stock));
                                                        setStockThreshold(String(threshold));
                                                    }}>
                                                    <FaWarehouse /> Stok Güncelle
                                                </button>
                                                <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm"
                                                    style={{color:"#ef4444",borderColor:"rgba(239,68,68,0.3)"}}
                                                    onClick={() => setDeleteModal(product)}
                                                    title="Ürünü sil">
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sayfalama */}
            {totalProducts > PAGE_SIZE && (
                <div className="pmv4-pagination">
                    <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                        disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                        <FaArrowLeft /> ÖÖnceki
                    </button>
                    <span>Sayfa {page + 1} / {Math.ceil(totalProducts / PAGE_SIZE)} · {totalProducts} ürün</span>
                    <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                        disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>
                        Sonraki <FaArrowRight />
                    </button>
                </div>
            )}
        </motion.div>
        );
    };

    // ── 3. ÜRÜN DAĞITIMI — YENİDEN TASARIM ──────────────────────────────────
    const renderDistribution = () => {
        // Filtreli ürün listesi
        const distFiltered = products.filter(p => {
            const mp    = p.masterProduct || p;
            const name  = (mp.name || "").toLowerCase();
            const sku   = (mp.sku || mp.barcode || "").toLowerCase();
            const q     = distSearch.toLowerCase();
            const matchSearch = !distSearch || name.includes(q) || sku.includes(q);

            const matchMP = !distFilterMP || getProductMPs(p).includes(distFilterMP);

            let matchStatus = true;
            if (distFilterStatus === "missing") {
                matchStatus = getMissingMPs(p).length > 0;
            } else if (distFilterStatus === "synced") {
                matchStatus = (p.marketplaceMappings || []).some(m => m.syncStatus === "synced");
            } else if (distFilterStatus === "error") {
                matchStatus = (p.marketplaceMappings || []).some(m => m.syncStatus === "error");
            } else if (distFilterStatus === "pending") {
                matchStatus = (p.marketplaceMappings || []).some(m => m.syncStatus === "pending");
            }

            return matchSearch && matchMP && matchStatus;
        });

        // ── Özet istatistikler: her ürün 1 kez sayılır (çift sayma YOK) ──
        // ⚠️ FIX: syncStatus: "error" = platformda yok demek, aktif platform sayılmaz
        // Senkâron: en az 1 platformda "synced" olan benzersiz ürün sayısı
        const totalSynced  = products.filter(p =>
            (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")
        ).length;
        // Hata: TÜM mapping'leri "error" olan ürün sayısı (platformdan kaldırılmış)
        const totalError   = products.filter(p => {
            const mps = (p.marketplaceMappings || []);
            return mps.length > 0 && mps.every(m => m.syncStatus === "error");
        }).length;
        // Eksik platform: en az 1 platformda hiç kaydı olmayan benzersiz ürün sayısı
        const totalMissing = products.filter(p => getMissingMPs(p).length > 0).length;
        // Bekliyor: en az 1 platformda "pending" olan benzersiz ürün sayısı
        const totalPending = products.filter(p =>
            (p.marketplaceMappings || []).some(m => m.syncStatus === "pending")
        ).length;

        return (
        <motion.div key="distribution" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── Bilgi Notu ── */}
            <div style={{
                background: "rgba(78,205,196,0.06)",
                border: "1px solid rgba(78,205,196,0.2)",
                borderRadius: "10px",
                padding: "9px 14px",
                marginBottom: "14px",
                display: "flex", alignItems: "center", gap: "8px",
                fontSize: "11px", color: "#94a3b8"
            }}>
                <FaInfoCircle style={{ color: "#4ecdc4", flexShrink: 0 }} />
                <span>
                    Tüm sayılar <strong style={{ color: "#4ecdc4" }}>benzersiz ürün</strong> bazındadır —
                    bir ürün 2 platformda olsa bile <strong style={{ color: "#4ecdc4" }}>yalnızca 1 kez</strong> sayılır.
                    Kartlara tıklayarak filtreleyin.
                </span>
            </div>

            {/* ── Üst Özet Kartları ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px", marginBottom: "20px"
            }}>
                {[
                    { label: "Toplam Ürün",    value: products.length, color: "#4ecdc4", icon: "📦", filter: "",        hint: "Tüm benzersiz ürünler" },
                    { label: "Senkâron",         value: totalSynced,     color: "#22c55e", icon: "✅", filter: "synced",  hint: "≥1 platformda senkâron" },
                    { label: "Hata",            value: totalError,      color: "#ef4444", icon: "❌", filter: "error",   hint: "≥1 platformda hata" },
                    { label: "Bekliyor",        value: totalPending,    color: "#f59e0b", icon: "⏳", filter: "pending", hint: "≥1 platformda bekliyor" },
                    { label: "Eksik Platform",  value: totalMissing,    color: "#8b5cf6", icon: "⚠️", filter: "missing", hint: "En az 1 platform eksik" },
                ].map(card => (
                    <div key={card.label}
                        onClick={() => setDistFilterStatus(distFilterStatus === card.filter ? "" : card.filter)}
                        title={card.hint}
                        style={{
                            background: distFilterStatus === card.filter
                                ? `${card.color}22`
                                : "rgba(255,255,255,0.03)",
                            border: `1.5px solid ${distFilterStatus === card.filter ? card.color : "rgba(255,255,255,0.08)"}`,
                            borderRadius: "12px", padding: "14px 16px",
                            cursor: "pointer", transition: "all .15s",
                            display: "flex", alignItems: "center", gap: "12px",
                            position: "relative", overflow: "hidden"
                        }}>
                        {distFilterStatus === card.filter && (
                            <div style={{
                                position: "absolute", top: 0, right: 0,
                                width: "60px", height: "60px",
                                background: `radial-gradient(circle, ${card.color}20 0%, transparent 70%)`,
                                pointerEvents: "none"
                            }} />
                        )}
                        <span style={{ fontSize: "22px" }}>{card.icon}</span>
                        <div>
                            <div style={{ fontSize: "22px", fontWeight: 800, color: card.color, lineHeight: 1 }}>
                                {card.value}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{card.label}</div>
                            <div style={{ fontSize: "9px", color: "#334155", marginTop: "1px", fontStyle: "italic" }}>{card.hint}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── İki Kolon Layout: Sol Liste + Sağ Detay ── */}
            <div style={{ display: "grid", gridTemplateColumns: distDetailProduct ? "1fr 420px" : "1fr", gap: "16px", alignItems: "start" }}>

                {/* ── Sol: Ürün Listesi ── */}
                <div>
                    {/* Filtre Çubuğu */}
                    <div style={{
                        display: "flex", gap: "10px", flexWrap: "wrap",
                        marginBottom: "14px", alignItems: "center"
                    }}>
                        <div className="pmv4-search-box" style={{ flex: "1 1 200px", minWidth: "180px" }}>
                            <FaSearch />
                            <input type="text" placeholder="Ürün adı veya SKU ara..."
                                value={distSearch}
                                onChange={e => setDistSearch(e.target.value)} />
                        </div>
                        <select className="pmv4-select" style={{ flex: "0 0 160px" }}
                            value={distFilterMP}
                            onChange={e => setDistFilterMP(e.target.value)}>
                            <option value="">Tüm Platformlar</option>
                            {marketplaces.map((mp, i) => (
                                <option key={i} value={mp.name}>{mp.name}</option>
                            ))}
                        </select>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {[
                                { key: "",        label: "Tümü",    color: "#64748b" },
                                { key: "synced",  label: "✅ Senkâron", color: "#22c55e" },
                                { key: "error",   label: "❌ Hata",    color: "#ef4444" },
                                { key: "pending", label: "⏳ Bekliyor",color: "#f59e0b" },
                                { key: "missing", label: "⚠️ Eksik",   color: "#8b5cf6" },
                            ].map(f => (
                                <button key={f.key}
                                    onClick={() => setDistFilterStatus(f.key)}
                                    style={{
                                        background: distFilterStatus === f.key ? `${f.color}22` : "transparent",
                                        border: `1px solid ${distFilterStatus === f.key ? f.color : "rgba(255,255,255,0.1)"}`,
                                        borderRadius: "6px", color: distFilterStatus === f.key ? f.color : "#64748b",
                                        padding: "5px 10px", fontSize: "12px", cursor: "pointer",
                                        fontWeight: distFilterStatus === f.key ? 700 : 400,
                                        transition: "all .12s"
                                    }}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                            <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={toggleAllProducts}>
                                {selectedProducts.length === distFiltered.length && distFiltered.length > 0
                                    ? <><FaTimesCircle /> Seçimi Kaldır</>
                                    : <><FaCheckSquare /> Tümünü Seç</>
                                }
                            </button>
                            <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={loadProducts}>
                                <FaSync />
                            </button>
                        </div>
                    </div>

                    {/* Toplu İşlem Çubuğu */}
                    <AnimatePresence>
                        {selectedProducts.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{
                                    background: "rgba(15,118,110,0.12)",
                                    border: "1.5px solid rgba(15,118,110,0.4)",
                                    borderRadius: "10px", padding: "12px 16px",
                                    marginBottom: "12px",
                                    display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap"
                                }}>
                                <span style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "14px" }}>
                                    <FaCheckSquare style={{ marginRight: 6 }} />
                                    {selectedProducts.length} ürün seçildi
                                </span>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                                    {marketplaces.map(mp => (
                                        <label key={mp._id}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "6px",
                                                background: bulkTargets.includes(mp.name) ? `${mpColor(mp.name)}22` : "rgba(255,255,255,0.04)",
                                                border: `1px solid ${bulkTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`,
                                                borderRadius: "6px", padding: "5px 10px",
                                                cursor: "pointer", fontSize: "12px", color: "#e2e8f0",
                                                transition: "all .12s"
                                            }}>
                                            <input type="checkbox" style={{ display: "none" }}
                                                checked={bulkTargets.includes(mp.name)}
                                                onChange={() => toggleTarget(mp.name)} />
                                            <span style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: mpColor(mp.name), display: "inline-block"
                                            }} />
                                            {mp.name}
                                            {bulkTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}
                                        </label>
                                    ))}
                                </div>
                                <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm"
                                    onClick={handleBulkDistribute}
                                    disabled={loading || bulkTargets.length === 0}>
                                    {loading ? <Spinner /> : <FaRocket />}
                                    {bulkTargets.length > 0 ? `${bulkTargets.length} Platforma Dağıt` : "Platform Seç"}
                                </button>
                                <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm"
                                    onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}>
                                    <FaTimes />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Dağıtım Sonucu */}
                    <AnimatePresence>
                        {distResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap"
                                }}>
                                <div style={{
                                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                                    borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px",
                                    color: "#22c55e", fontSize: "13px", fontWeight: 600
                                }}>
                                    <FaCheckCircle /> {distResult.success || 0} Başarılı
                                </div>
                                <div style={{
                                    background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                                    borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px",
                                    color: "#f59e0b", fontSize: "13px", fontWeight: 600
                                }}>
                                    <FaExclamationTriangle /> {distResult.skipped || 0} Atlanan
                                </div>
                                <div style={{
                                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                                    borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px",
                                    color: "#ef4444", fontSize: "13px", fontWeight: 600
                                }}>
                                    <FaTimesCircle /> {distResult.error || 0} Hata
                                </div>
                                <button onClick={() => setDistResult(null)}
                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>
                                    <FaTimes />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Ürün Listesi */}
                    {products.length === 0 ? (
                        <div className="pmv4-empty">
                            <FaBox size={40} />
                            <p>Ürün bulunamadı. Pazaryerlerinden senkronize edin.</p>
                            <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm" onClick={runAutoSync} disabled={autoSyncRunning}>
                                {autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et
                            </button>
                        </div>
                    ) : distFiltered.length === 0 ? (
                        <div className="pmv4-empty" style={{ padding: "30px" }}>
                            <FaSearch size={32} />
                            <p>Filtreyle eşleşen ürün bulunamadı.</p>
                            <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm"
                                onClick={() => { setDistSearch(""); setDistFilterStatus(""); setDistFilterMP(""); }}>
                                Filtreleri Temizle
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {distFiltered.map(product => {
                                const mp      = product.masterProduct || product;
                                const img     = safeImg(mp.images);
                                const stock   = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                const sel     = selectedProducts.includes(product._id);
                                const isDetail = distDetailProduct?._id === product._id;
                                const productMPs  = getProductMPs(product);
                                const missingMPs  = getMissingMPs(product);
                                const hasError    = (product.marketplaceMappings || []).some(m => m.syncStatus === "error");
                                const hasPending  = (product.marketplaceMappings || []).some(m => m.syncStatus === "pending");

                                // Kart rengi
                                const cardBorder = isDetail
                                    ? "#4ecdc4"
                                    : sel
                                        ? "#0f766e"
                                        : hasError
                                            ? "rgba(239,68,68,0.3)"
                                            : missingMPs.length > 0
                                                ? "rgba(139,92,246,0.3)"
                                                : "rgba(255,255,255,0.07)";

                                return (
                                    <motion.div key={product._id}
                                        layout
                                        style={{
                                            background: isDetail
                                                ? "rgba(78,205,196,0.06)"
                                                : sel
                                                    ? "rgba(15,118,110,0.08)"
                                                    : "rgba(255,255,255,0.02)",
                                            border: `1.5px solid ${cardBorder}`,
                                            borderRadius: "12px", padding: "12px 14px",
                                            transition: "all .15s", cursor: "pointer"
                                        }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            {/* Checkbox */}
                                            <div onClick={e => { e.stopPropagation(); toggleProduct(product._id); }}
                                                style={{ flexShrink: 0, cursor: "pointer" }}>
                                                {sel
                                                    ? <FaCheckSquare style={{ color: "#0f766e", fontSize: 18 }} />
                                                    : <FaSquare style={{ color: "#30363d", fontSize: 18 }} />
                                                }
                                            </div>

                                            {/* Görsel */}
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 8, overflow: "hidden",
                                                background: "rgba(255,255,255,0.05)", flexShrink: 0,
                                                display: "flex", alignItems: "center", justifyContent: "center"
                                            }}>
                                                {img
                                                    ? <img src={img} alt={mp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                        onError={e => { e.target.style.display = "none"; }} />
                                                    : <FaBox style={{ color: "#30363d", fontSize: 18 }} />
                                                }
                                            </div>

                                            {/* Bilgi */}
                                            <div style={{ flex: 1, minWidth: 0 }}
                                                onClick={() => setDistDetailProduct(isDetail ? null : product)}>
                                                <div style={{
                                                    color: "#e2e8f0", fontWeight: 600, fontSize: "13px",
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                                                }}>
                                                    {mp.name || "İsimsiz"}
                                                </div>
                                                <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                                    <span><FaBarcode style={{ marginRight: 3 }} />{mp.barcode || "—"}</span>
                                                    <span><FaTag style={{ marginRight: 3 }} />{mp.sku || "—"}</span>
                                                    <span>💰 ₺{Number(mp.price || 0).toLocaleString("tr-TR")}</span>
                                                    <span>📦 {stock} İadet</span>
                                                </div>
                                            </div>

                                            {/* Platform Durumu */}
                                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}
                                                onClick={() => setDistDetailProduct(isDetail ? null : product)}>
                                                {marketplaces.map((mpItem, i) => {
                                                    const status = getProductSyncStatus(product, mpItem.name);
                                                    const exists = productMPs.includes(mpItem.name);
                                                    return (
                                                        <div key={i} title={`${mpItem.name}: ${status || "Yok"}`}
                                                            style={{
                                                                background: exists
                                                                    ? status === "synced"  ? "rgba(34,197,94,0.15)"
                                                                    : status === "error"   ? "rgba(239,68,68,0.15)"
                                                                    : "rgba(245,158,11,0.15)"
                                                                    : "rgba(255,255,255,0.04)",
                                                                border: `1px solid ${exists
                                                                    ? status === "synced"  ? "rgba(34,197,94,0.4)"
                                                                    : status === "error"   ? "rgba(239,68,68,0.4)"
                                                                    : "rgba(245,158,11,0.4)"
                                                                    : "rgba(255,255,255,0.1)"}`,
                                                                borderRadius: "5px", padding: "3px 7px",
                                                                fontSize: "10px", fontWeight: 600,
                                                                color: exists
                                                                    ? status === "synced"  ? "#22c55e"
                                                                    : status === "error"   ? "#ef4444"
                                                                    : "#f59e0b"
                                                                    : "#475569",
                                                                display: "flex", alignItems: "center", gap: "4px"
                                                            }}>
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: "50%",
                                                                background: mpColor(mpItem.name), display: "inline-block"
                                                            }} />
                                                            {mpItem.name}
                                                            {!exists && <span style={{ fontSize: 9 }}>✕</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Detay / Dağıt Butonları */}
                                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                                {missingMPs.length > 0 && (
                                                    <button
                                                        className="pmv4-btn pmv4-btn-primary pmv4-btn-sm"
                                                        title={`${missingMPs.join(", ")} platformuna dağıt`}
                                                        onClick={async e => {
                                                            e.stopPropagation();
                                                            setLoading(true);
                                                            try {
                                                                const res = await bulkDistributeSelected([product._id], missingMPs);
                                                                const r = res.results || {};
                                                                setDistResult(r);
                                                                showToast(`✅ Dağıtıldı — Başarılı: ${r.success || 0}`, "success");
                                                                loadProducts();
                                                            } catch (e2) {
                                                                showToast("Dağıtım hatası: " + (e2.response?.data?.error || e2.message), "error");
                                                            } finally { setLoading(false); }
                                                        }}
                                                        style={{ fontSize: "11px", padding: "5px 10px" }}>
                                                        <FaRocket /> Dağıt
                                                    </button>
                                                )}
                                                <button
                                                    onClick={e => { e.stopPropagation(); setDistDetailProduct(isDetail ? null : product); }}
                                                    style={{
                                                        background: isDetail ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.05)",
                                                        border: `1px solid ${isDetail ? "#4ecdc4" : "rgba(255,255,255,0.1)"}`,
                                                        borderRadius: "6px", color: isDetail ? "#4ecdc4" : "#64748b",
                                                        padding: "5px 8px", cursor: "pointer", fontSize: "12px",
                                                        display: "flex", alignItems: "center", gap: "4px"
                                                    }}>
                                                    {isDetail ? <FaChevronDown /> : <FaChevronRight />}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* Sayfalama */}
                    {totalProducts > PAGE_SIZE && (
                        <div className="pmv4-pagination" style={{ marginTop: "16px" }}>
                            <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                                disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                                <FaArrowLeft /> ÖÖnceki
                            </button>
                            <span style={{ color: "#64748b", fontSize: "13px" }}>
                                Sayfa {page + 1} / {Math.ceil(totalProducts / PAGE_SIZE)} · {totalProducts} ürün
                            </span>
                            <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                                disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>
                                Sonraki <FaArrowRight />
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Sağ: Ürün Detay & Dağıtım Paneli ── */}
                <AnimatePresence>
                    {distDetailProduct && (() => {
                        const mp      = distDetailProduct.masterProduct || distDetailProduct;
                        const img     = safeImg(mp.images);
                        const stock   = distDetailProduct.stockTracking?.totalStock ?? mp.stock ?? 0;
                        const missingMPs = getMissingMPs(distDetailProduct);
                        const [singleTargets, setSingleTargets] = [bulkTargets, setBulkTargets];

                        return (
                            <motion.div
                                key="detail-panel"
                                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 30 }}
                                style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1.5px solid rgba(78,205,196,0.3)",
                                    borderRadius: "14px", padding: "20px",
                                    position: "sticky", top: "80px"
                                }}>
                                {/* Kapat */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <span style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "14px" }}>
                                        <FaEye style={{ marginRight: 6 }} /> Ürün Detayı
                                    </span>
                                    <button onClick={() => setDistDetailProduct(null)}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>
                                        <FaTimes />
                                    </button>
                                </div>

                                {/* Ürün Bilgisi */}
                                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 10, overflow: "hidden",
                                        background: "rgba(255,255,255,0.05)", flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                        {img
                                            ? <img src={img} alt={mp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            : <FaBox style={{ color: "#30363d", fontSize: 24 }} />
                                        }
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                                            {mp.name || "İsimsiz"}
                                        </div>
                                        <div style={{ color: "#64748b", fontSize: "11px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                            <span>SKU: {mp.sku || "—"}</span>
                                            <span>Barkod: {mp.barcode || "—"}</span>
                                            <span>Marka: {mp.brand || "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Fiyat & Stok */}
                                <div style={{
                                    display: "grid", gridTemplateColumns: "1fr 1fr",
                                    gap: "8px", marginBottom: "16px"
                                }}>
                                    {[
                                        { label: "Satış Fiyatı", value: `₺${Number(mp.price || 0).toLocaleString("tr-TR")}`, color: "#22c55e" },
                                        { label: "Liste Fiyatı", value: `₺${Number(mp.listPrice || mp.price || 0).toLocaleString("tr-TR")}`, color: "#94a3b8" },
                                        { label: "Stok",         value: `${stock} İadet`, color: stock === 0 ? "#ef4444" : stock < 10 ? "#f59e0b" : "#4ecdc4" },
                                        { label: "Kategori",     value: mp.category || "—", color: "#94a3b8" },
                                    ].map(item => (
                                        <div key={item.label} style={{
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid rgba(255,255,255,0.07)",
                                            borderRadius: "8px", padding: "8px 10px"
                                        }}>
                                            <div style={{ color: "#64748b", fontSize: "10px", marginBottom: "2px" }}>{item.label}</div>
                                            <div style={{ color: item.color, fontWeight: 700, fontSize: "13px" }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Platform Durumları */}
                                <div style={{ marginBottom: "16px" }}>
                                    <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Platform Durumları
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {marketplaces.map((mpItem, i) => {
                                            const status = getProductSyncStatus(distDetailProduct, mpItem.name);
                                            const exists = getProductMPs(distDetailProduct).includes(mpItem.name);
                                            const statusColor = !exists ? "#475569"
                                                : status === "synced"  ? "#22c55e"
                                                : status === "error"   ? "#ef4444"
                                                : "#f59e0b";
                                            const statusLabel = !exists ? "Yok"
                                                : status === "synced"  ? "Senkâron"
                                                : status === "error"   ? "Hata"
                                                : status === "pending" ? "Bekliyor"
                                                : status || "Bilinmiyor";
                                            return (
                                                <div key={i} style={{
                                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    background: "rgba(255,255,255,0.03)",
                                                    border: `1px solid ${exists ? `${statusColor}33` : "rgba(255,255,255,0.06)"}`,
                                                    borderRadius: "8px", padding: "8px 12px"
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{
                                                            width: 10, height: 10, borderRadius: "50%",
                                                            background: mpColor(mpItem.name), display: "inline-block"
                                                        }} />
                                                        <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{mpItem.name}</span>
                                                    </div>
                                                    <span style={{
                                                        color: statusColor, fontSize: "11px", fontWeight: 700,
                                                        background: `${statusColor}15`,
                                                        border: `1px solid ${statusColor}33`,
                                                        borderRadius: "4px", padding: "2px 8px"
                                                    }}>
                                                        {statusLabel}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Dağıtım Aksiyonu */}
                                {missingMPs.length > 0 ? (
                                    <div>
                                        <div style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Eksik Platformlara Dağıt
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                                            {missingMPs.map(mpName => (
                                                <div key={mpName} style={{
                                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    background: "rgba(139,92,246,0.08)",
                                                    border: "1px solid rgba(139,92,246,0.25)",
                                                    borderRadius: "8px", padding: "8px 12px"
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{
                                                            width: 10, height: 10, borderRadius: "50%",
                                                            background: mpColor(mpName), display: "inline-block"
                                                        }} />
                                                        <span style={{ color: "#e2e8f0", fontSize: "13px" }}>{mpName}</span>
                                                    </div>
                                                    <span style={{ color: "#8b5cf6", fontSize: "11px", fontWeight: 600 }}>⚠️ Eksik</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className="pmv4-btn pmv4-btn-primary"
                                            style={{ width: "100%" }}
                                            disabled={loading}
                                            onClick={async () => {
                                                setLoading(true);
                                                try {
                                                    const res = await bulkDistributeSelected([distDetailProduct._id], missingMPs);
                                                    const r = res.results || {};
                                                    setDistResult(r);
                                                    showToast(`✅ Dağıtıldı — Başarılı: ${r.success || 0}`, "success");
                                                    loadProducts();
                                                    setDistDetailProduct(null);
                                                } catch (e2) {
                                                    showToast("Dağıtım hatası: " + (e2.response?.data?.error || e2.message), "error");
                                                } finally { setLoading(false); }
                                            }}>
                                            {loading ? <Spinner /> : <FaRocket />}
                                            {missingMPs.length} Platforma Dağıt
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        background: "rgba(34,197,94,0.08)",
                                        border: "1px solid rgba(34,197,94,0.25)",
                                        borderRadius: "8px", padding: "12px",
                                        textAlign: "center", color: "#22c55e",
                                        fontSize: "13px", fontWeight: 600
                                    }}>
                                        <FaCheckCircle style={{ marginRight: 6 }} />
                                        Tüm platformlarda mevcut
                                    </div>
                                )}

                                {/* Yeni Ürün Formu Aç */}
                                <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px" }}>
                                    <button
                                        className="pmv4-btn pmv4-btn-outline"
                                        style={{ width: "100%", fontSize: "12px" }}
                                        onClick={() => { setShowNewProductForm(true); setDistDetailProduct(null); }}>
                                        <FaPlus /> Yeni Ürün Ekle & Dağıt
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>

            {/* ── Yeni Ürün Formu (Alt Bölüm) ── */}
            <AnimatePresence>
                {showNewProductForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ marginTop: "20px" }}>
                        <div style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1.5px solid rgba(15,118,110,0.4)",
                            borderRadius: "14px", padding: "20px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h3 style={{ margin: 0, color: "#4ecdc4", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaPlus /> Yeni Ürün Oluştur & Dağıt
                                </h3>
                                <button onClick={() => setShowNewProductForm(false)}
                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="pmv4-new-product-form">
                                <div className="pmv4-form-section">
                                    <h4><FaTag /> Temel Bilgiler</h4>
                                    <div className="pmv4-form-grid">
                                        {[
                                            { label: "Ürün Adı *",    key: "name",        placeholder: "Ürün adını girin" },
                                            { label: "Barkod *",       key: "barcode",     placeholder: "EAN / GTIN barkod" },
                                            { label: "SKU *",          key: "sku",         placeholder: "Stok kodu" },
                                            { label: "Marka",          key: "brand",       placeholder: "Marka adı" },
                                            { label: "Kategori",       key: "category",    placeholder: "Ürün kategorisi" },
                                            { label: "Başlangıç Stok", key: "stock",       placeholder: "0", type: "number" },
                                        ].map(f => (
                                            <div key={f.key} className="pmv4-form-group">
                                                <label>{f.label}</label>
                                                <input className="pmv4-input" type={f.type || "text"}
                                                    placeholder={f.placeholder}
                                                    value={newProduct[f.key]}
                                                    onChange={e => setNewProduct(p => ({ ...p, [f.key]: e.target.value }))} />
                                            </div>
                                        ))}
                                        <div className="pmv4-form-group pmv4-full">
                                            <label>Açıklama</label>
                                            <textarea className="pmv4-input pmv4-textarea" placeholder="Ürün açıklaması"
                                                value={newProduct.description}
                                                onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pmv4-form-section">
                                    <h4><FaMoneyBillWave /> Fiyat</h4>
                                    <div className="pmv4-form-grid">
                                        <div className="pmv4-form-group">
                                            <label>Satış Fiyatı (₺) *</label>
                                            <input className="pmv4-input" type="number" min="0" step="0.01" placeholder="0.00"
                                                value={newProduct.price}
                                                onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} />
                                        </div>
                                        <div className="pmv4-form-group">
                                            <label>Liste Fiyatı (₺)</label>
                                            <input className="pmv4-input" type="number" min="0" step="0.01" placeholder="0.00"
                                                value={newProduct.listPrice}
                                                onChange={e => setNewProduct(p => ({ ...p, listPrice: e.target.value }))} />
                                        </div>
                                        {newProduct.price && newProduct.listPrice && parseFloat(newProduct.listPrice) > parseFloat(newProduct.price) && (
                                            <div className="pmv4-form-group pmv4-full">
                                                <div className="pmv4-discount-preview">
                                                    <FaPercent />
                                                    <span>İndirim: <strong>%{calcDiscountRate(newProduct.price, newProduct.listPrice)}</strong></span>
                                                    <span>Tasarruf: <strong>₺{(parseFloat(newProduct.listPrice) - parseFloat(newProduct.price)).toFixed(2)}</strong></span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pmv4-form-section">
                                    <h4><FaImage /> Görseller</h4>
                                    {newProduct.images.map((url, idx) => (
                                        <div key={idx} className="pmv4-image-row">
                                            <input className="pmv4-input" placeholder={`Görsel URL ${idx + 1}`}
                                                value={url}
                                                onChange={e => {
                                                    const imgs = [...newProduct.images];
                                                    imgs[idx] = e.target.value;
                                                    setNewProduct(p => ({ ...p, images: imgs }));
                                                }} />
                                            {idx > 0 && (
                                                <button className="pmv4-btn pmv4-btn-danger pmv4-btn-sm"
                                                    onClick={() => setNewProduct(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}>
                                                    <FaTimes />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" style={{ marginTop: "8px" }}
                                        onClick={() => setNewProduct(p => ({ ...p, images: [...p.images, ""] }))}>
                                        <FaPlus /> Görsel Ekle
                                    </button>
                                </div>

                                <div className="pmv4-form-section">
                                    <h4><FaStore /> Dağıtılacak Platformlar</h4>
                                    <div className="pmv4-mp-checkboxes">
                                        {marketplaces.map(mp => (
                                            <label key={mp._id}
                                                className={`pmv4-mp-checkbox-label ${newProductTargets.includes(mp.name) ? "checked" : ""}`}
                                                style={{ borderColor: newProductTargets.includes(mp.name) ? mpColor(mp.name) : undefined }}>
                                                <input type="checkbox"
                                                    checked={newProductTargets.includes(mp.name)}
                                                    onChange={() => toggleNewProductTarget(mp.name)} />
                                                <span className="pmv4-mp-dot" style={{ background: mpColor(mp.name) }} />
                                                <span>{mp.name}</span>
                                                {newProductTargets.includes(mp.name) && <FaCheck className="pmv4-check-icon" />}
                                            </label>
                                        ))}
                                    </div>
                                    {newProductTargets.length > 0 && (
                                        <div className="pmv4-dist-preview">
                                            <FaRocket /> <strong>{newProductTargets.length}</strong> platforma dağıtılacak:
                                            {newProductTargets.map(t => (
                                                <span key={t} className="pmv4-mp-chip" style={{ background: mpColor(t) }}>{t}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pmv4-form-actions">
                                    <button className="pmv4-btn pmv4-btn-outline" onClick={() => setShowNewProductForm(false)}>
                                        <FaTimes /> İptal
                                    </button>
                                    <button className="pmv4-btn pmv4-btn-primary pmv4-btn-lg"
                                        onClick={handleCreateProduct} disabled={loading}>
                                        {loading ? <Spinner /> : <FaRocket />}
                                        Oluştur & {newProductTargets.length > 0 ? `${newProductTargets.length} Platforma Dağıt` : "Kaydet"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        );
    };

    // ── 4. FİYAT & KAMPANYA YÖNETİMİ ─────────────────────────────────────────
    const renderPriçing = () => {
        // Fiyat istatistikleri
        const withDiscount = products.filter(p => {
            const mp2 = p.masterProduct || p;
            return mp2.listPrice && mp2.listPrice > (mp2.price || 0);
        }).length;
        const avgPrice = products.length > 0
            ? (products.reduce((sum, p) => sum + ((p.masterProduct||p).price || 0), 0) / products.length).toFixed(2)
            : 0;
        const maxPrice = products.length > 0
            ? Math.max(...products.map(p => (p.masterProduct||p).price || 0))
            : 0;

        return (
        <motion.div key="priçing" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Üst KPI Satırı */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
                {[
                    { icon:"💰", label:"Toplam Ürün",    val: products.length,  color:"#14b8a6", sub:"fiyat yönetiminde" },
                    { icon:"🏷️", label:"İndirimli Ürün", val: withDiscount,     color:"#22c55e", sub:"liste fiyatı var" },
                    { icon:"📊", label:"Ortalama Fiyat", val:`₺${Number(avgPrice).toLocaleString("tr-TR")}`, color:"#f59e0b", sub:"tüm ürünler" },
                    { icon:"⬆️", label:"En Yüksek",      val:`₺${Number(maxPrice).toLocaleString("tr-TR")}`, color:"#8b5cf6", sub:"maksimum fiyat" },
                ].map((k,i) => (
                    <div key={i} style={{
                        background:"rgba(255,255,255,0.02)", border:`1px solid rgba(255,255,255,0.07)`,
                        borderTop:`3px solid ${k.color}`, borderRadius:12, padding:"14px 16px"
                    }}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontSize:"1.2rem"}}>{k.icon}</span>
                            <span style={{fontSize:"0.72rem",color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{k.label}</span>
                        </div>
                        <div style={{fontSize:"1.4rem",fontWeight:800,color:k.color,lineHeight:1}}>{k.val}</div>
                        <div style={{fontSize:"0.72rem",color:"#475569",marginTop:3}}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Kampanya Kartları */}
            <div className="pmv4-campaign-grid">
                {[
                    {
                        icon:"⚡", title:"Toplu Fiyat Güncelleme", color:"#14b8a6",
                        desc:"Seçili ürünlerin tüm pazaryerlerindeki fiyatlarını tek seferde güncelleyin. Sabit fiyat, yüzde indirim veya kar marjı belirleyin.",
                        badge: selectedProducts.length > 0 ? `${selectedProducts.length} ürün seçili` : null
                    },
                    {
                        icon:"🎯", title:"İndirim Kampanyası", color:"#f59e0b",
                        desc:"Liste fiyatı üzerinden indirim oranı belirleyin. Müşteriler tasarruf miktarını görsün, dönüşüm oranınız artsın.",
                        badge: `${withDiscount} ürün indirimli`
                    },
                    {
                        icon:"📈", title:"Kar Marjı Optimizasyonu", color:"#8b5cf6",
                        desc:"Mevcut fiyatlarınıza belirli bir yüzde ekleyerek kar marjınızı optimize edin. Tüm platformlara anında yansır.",
                        badge: null
                    },
                ].map((c,i) => (
                    <div key={i} className="pmv4-campaign-card" style={{borderTop:`3px solid ${c.color}`}}>
                        <div className="pmv4-campaign-card-header">
                            <div className="pmv4-campaign-icon" style={{background:`${c.color}18`,color:c.color}}>
                                <span style={{fontSize:"1.3rem"}}>{c.icon}</span>
                            </div>
                            <div>
                                <h4>{c.title}</h4>
                                {c.badge && (
                                    <span style={{fontSize:"0.7rem",background:`${c.color}18`,color:c.color,borderRadius:4,padding:"1px 7px",fontWeight:700}}>
                                        {c.badge}
                                    </span>
                                )}
                            </div>
                        </div>
                        <p>{c.desc}</p>
                    </div>
                ))}
            </div>

            {/* Toplu Fiyat Güncelleme Paneli */}
            <div className="pmv4-section">
                <div className="pmv4-section-head">
                    <h2><FaTags /> Toplu Fiyat Güncelleme</h2>
                    {selectedProducts.length > 0 && (
                        <span style={{
                            background:"rgba(20,184,166,0.12)", border:"1px solid rgba(20,184,166,0.25)",
                            borderRadius:20, padding:"4px 14px", fontSize:"0.78rem",
                            color:"#14b8a6", fontWeight:700
                        }}>
                            {selectedProducts.length} ürün seçili
                        </span>
                    )}
                </div>
                <p className="pmv4-section-desc">
                    Aşağıdan güncelleme yöntemini seçin, değeri girin ve ürünleri seçerek tüm pazaryerlerinde tek tıkla güncelleyin.
                </p>

                <div className="pmv4-bulk-price-form">
                    {/* Mod Seçimi */}
                    <div className="pmv4-bulk-price-mode">
                        {[
                            { key:"fixed",   label:"Sabit Fiyat",  icon:"₺",  desc:"Belirlediğiniz fiyatı uygular" },
                            { key:"percent", label:"% İndirim",    icon:"🏷️", desc:"Mevcut fiyattan indirim yapar" },
                            { key:"margin",  label:"% Kar Marjı",  icon:"📈", desc:"Mevcut fiyata kar ekler" },
                        ].map(m => (
                            <div key={m.key}
                                className={`pmv4-mode-card ${bulkPriceMode === m.key ? "active" : ""}`}
                                onClick={() => setBulkPriceMode(m.key)}>
                                <span className="pmv4-mode-icon">{m.icon}</span>
                                <strong>{m.label}</strong>
                                <small>{m.desc}</small>
                            </div>
                        ))}
                    </div>

                    {/* Değer Girişi */}
                    <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
                        <div className="pmv4-bulk-price-input">
                            <label>
                                {bulkPriceMode === "fixed"   && "Yeni Fiyat (₺)"}
                                {bulkPriceMode === "percent" && "İndirim Oranı (%)"}
                                {bulkPriceMode === "margin"  && "Kar Marjı (%)"}
                            </label>
                            <div className="pmv4-input-with-suffix">
                                <input className="pmv4-input" type="number" min="0" step="0.01"
                                    placeholder={bulkPriceMode === "fixed" ? "öÖrn: 299.90" : "öÖrn: 15"}
                                    value={bulkPriceValue}
                                    onChange={e => setBulkPriceValue(e.target.value)} />
                                <span className="pmv4-input-suffix">
                                    {bulkPriceMode === "fixed" ? "₺" : "%"}
                                </span>
                            </div>
                        </div>

                        {/* Önizleme */}
                        {bulkPriceValue && selectedProducts.length > 0 && (
                            <div style={{
                                background:"rgba(20,184,166,0.06)", border:"1px solid rgba(20,184,166,0.18)",
                                borderRadius:8, padding:"10px 16px", fontSize:"0.82rem", color:"#14b8a6"
                            }}>
                                <div style={{fontWeight:700,marginBottom:3}}>📋 Önizleme</div>
                                <div style={{color:"#94a3b8"}}>
                                    {bulkPriceMode === "fixed"   && `${selectedProducts.length} ürün → ₺${Number(bulkPriceValue).toLocaleString("tr-TR")} olacak`}
                                    {bulkPriceMode === "percent" && `${selectedProducts.length} ürün → %${bulkPriceValue} indirim uygulanacak`}
                                    {bulkPriceMode === "margin"  && `${selectedProducts.length} ürün → %${bulkPriceValue} kar marjı eklenecek`}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pmv4-bulk-price-actions">
                        <button className="pmv4-btn pmv4-btn-primary"
                            onClick={handleBulkPriceUpdate}
                            disabled={loading || selectedProducts.length === 0 || !bulkPriceValue}>
                            {loading ? <Spinner /> : <FaMoneyBillWave />}
                            {selectedProducts.length > 0 ? `${selectedProducts.length} Ürünü Güncelle` : "Önce Ürün Seçin ↓"}
                        </button>
                        {selectedProducts.length > 0 && (
                            <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm"
                                onClick={() => setSelectedProducts([])}>
                                <FaTimes /> Seçimi Temizle ({selectedProducts.length})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Ürün Fiyat Listesi */}
            <div className="pmv4-section">
                <div className="pmv4-section-head">
                    <h2><FaMoneyBillWave /> Ürün Fiyat Listesi</h2>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                        <div className="pmv4-search-box" style={{ minWidth:"220px" }}>
                            <FaSearch />
                            <input type="text" placeholder="Ürün adı veya SKU ara..."
                                value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
                        </div>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={toggleAllProducts}>
                            {selectedProducts.length === products.length && products.length > 0
                                ? <><FaTimesCircle /> Seçimi Kaldır</>
                                : <><FaCheckSquare /> Tümünü Seç</>
                            }
                        </button>
                    </div>
                </div>
                <p className="pmv4-section-desc">
                    Ürünleri seçerek toplu güncelleme yapın veya tek tek <strong>Fiyat Güncelle</strong> butonuna tıklayın.
                    Her güncelleme tüm bağlı pazaryerlerine anında yansır.
                </p>

                {products.length === 0 ? (
                    <div className="pmv4-empty-sm"><p>Ürün bulunamadı.</p></div>
                ) : (
                    <div className="pmv4-price-table-wrapper">
                        <table className="pmv4-price-table">
                            <thead>
                                <tr>
                                    <th style={{ width:40 }}>
                                        <input type="checkbox"
                                            checked={selectedProducts.length === products.length && products.length > 0}
                                            onChange={toggleAllProducts} />
                                    </th>
                                    <th>Ürün</th>
                                    <th>Satış Fiyatı</th>
                                    <th>Liste Fiyatı</th>
                                    <th>İndirim</th>
                                    <th>Stok</th>
                                    <th>Pazaryerleri</th>
                                    <th style={{textAlign:"right"}}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(product => {
                                    const mp       = product.masterProduct || product;
                                    const price    = mp.price ?? 0;
                                    const lp       = mp.listPrice ?? price;
                                    const discount = lp > price ? ((lp - price) / lp * 100).toFixed(1) : null;
                                    const stock    = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                    const mappings = product.marketplaceMappings || [];
                                    const sel      = selectedProducts.includes(product._id);
                                    return (
                                        <tr key={product._id} className={sel ? "pmv4-row-selected" : ""}>
                                            <td>
                                                <input type="checkbox" checked={sel}
                                                    onChange={() => toggleProduct(product._id)} />
                                            </td>
                                            <td>
                                                <div className="pmv4-product-cell">
                                                    <div className="pmv4-product-thumb">
                                                        {safeImg(mp.images)
                                                            ? <img src={safeImg(mp.images)} alt={mp.name} onError={e => { e.target.style.display="none"; }} />
                                                            : <FaBox />
                                                        }
                                                    </div>
                                                    <div>
                                                        <div className="pmv4-product-name">{mp.name || "İsimsiz"}</div>
                                                        <div style={{fontSize:"0.72rem",color:"#64748b"}}>{mp.sku || mp.barcode || "—"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="pmv4-price">₺{Number(price).toLocaleString("tr-TR")}</span>
                                            </td>
                                            <td>
                                                {lp > price
                                                    ? <span className="pmv4-list-price">₺{Number(lp).toLocaleString("tr-TR")}</span>
                                                    : <span style={{color:"#334155",fontSize:"0.78rem"}}>—</span>
                                                }
                                            </td>
                                            <td>
                                                {discount
                                                    ? <span className="pmv4-badge pmv4-badge-success">%{discount} indirim</span>
                                                    : <span style={{color:"#334155",fontSize:"0.78rem"}}>—</span>
                                                }
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontWeight:700, fontSize:"0.88rem",
                                                    color: stock===0?"#ef4444":stock<10?"#f59e0b":"#22c55e"
                                                }}>{stock}</span>
                                                <span style={{color:"#475569",fontSize:"0.72rem"}}> İadet</span>
                                            </td>
                                            <td>
                                                <div className="pmv4-mp-badges">
                                                    {mappings.length > 0
                                                        ? mappings.map((m, i) => (
                                                            <span key={i} className="pmv4-mp-chip"
                                                                style={{ background: mpColor(m.marketplaceName) }}
                                                                title={`${m.marketplaceName}: ${m.syncStatus||"pending"}`}>
                                                                {m.marketplaceName}
                                                            </span>
                                                        ))
                                                        : <span style={{color:"#334155",fontSize:"0.75rem"}}>—</span>
                                                    }
                                                </div>
                                            </td>
                                            <td style={{textAlign:"right"}}>
                                                <button className="pmv4-btn pmv4-btn-green pmv4-btn-sm"
                                                    onClick={() => {
                                                        setPriceModal({ product });
                                                        setSalePrice(String(price));
                                                        setListPrice(String(lp));
                                                        setDiscountRate(discount || "");
                                                    }}>
                                                    <FaEdit /> Fiyat Güncelle
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalProducts > PAGE_SIZE && (
                    <div className="pmv4-pagination">
                        <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                            disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                            <FaArrowLeft /> ÖÖnceki
                        </button>
                        <span>Sayfa {page + 1} / {Math.ceil(totalProducts / PAGE_SIZE)} · {totalProducts} ürün</span>
                        <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                            disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>
                            Sonraki <FaArrowRight />
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
        );
    };

    // ── 5. KARŞILAŞTIRMA MATRİSİ ─────────────────────────────────────────────
    const renderComparison = () => (
        <motion.div key="comparison" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Açıklama Bandı */}
            <div className="pmv4-info-banner">
                <span className="pmv4-info-icon">🗺️</span>
                <div>
                    <strong>Karşılaştırma Matrisi Nedir?</strong>
                    <p>Her ürünün hangi pazaryerinde <strong>mevcut</strong>, hangisinde <strong>eksik</strong> olduğunu tek bakışta görün.
                    Eksik ürünleri seçip <strong>toplu dağıtım</strong> yapabilirsiniz. Yeşil = var &amp; senkâron, Sarı = bekliyor, Kırmızı = hata, Gri = hiç yok.</p>
                </div>
            </div>

            {/* Özet Kartlar */}
            {compSummary && (
                <div className="pmv4-comp-summary" style={{ marginBottom: 16 }}>
                    <div className="pmv4-comp-summary-card pmv4-comp-success">
                        <strong>{compSummary.fullyDistributed ?? 0}</strong>
                        <span>✅ Tam Dağıtılmış</span>
                    </div>
                    <div className="pmv4-comp-summary-card pmv4-comp-warning">
                        <strong>{compSummary.partiallyMissing ?? 0}</strong>
                        <span>⚠️ Kısmi Eksik</span>
                    </div>
                    <div className="pmv4-comp-summary-card pmv4-comp-danger">
                        <strong>{compSummary.notDistributed ?? 0}</strong>
                        <span>🚫 Hiç Dağıtılmamış</span>
                    </div>
                    <div style={{
                        flex: 1, minWidth: 120,
                        background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                        borderRadius: 10, padding: "16px 18px", textAlign: "center"
                    }}>
                        <strong style={{ display:"block", fontSize:"1.8rem", fontWeight:800, color:"#3b82f6", lineHeight:1, marginBottom:4 }}>
                            {compTotal}
                        </strong>
                        <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#3b82f6" }}>📦 Toplam Ürün</span>
                    </div>
                </div>
            )}

            {/* Filtre Çubuğu */}
            <div className="pmv4-comp-filter-bar">
                <div className="pmv4-search-box" style={{ flex: 1, minWidth: 200 }}>
                    <FaSearch />
                    <input type="text" placeholder="Ürün adı veya barkod ara..."
                        value={compSearch}
                        onChange={e => { setCompSearch(e.target.value); setCompPage(0); }} />
                </div>
                <label className="pmv4-checkbox-label" style={{
                    background: missingOnly ? "rgba(239,68,68,0.08)" : "transparent",
                    border: `1px solid ${missingOnly ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 6, padding: "7px 12px", transition: "all .15s"
                }}>
                    <input type="checkbox" checked={missingOnly}
                        onChange={e => { setMissingOnly(e.target.checked); setCompPage(0); }} />
                    <span style={{ color: missingOnly ? "#ef4444" : undefined }}>🔍 Sİadece eksik olanlar</span>
                </label>
                <span className="pmv4-total-label">{compTotal} ürün</span>
                <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={loadComparison}>
                    <FaSync /> Yenile
                </button>
            </div>

            {/* Seçili Ürün Dağıtım Çubuğu */}
            <AnimatePresence>
                {selectedProducts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pmv4-comp-dist-bar" style={{ marginBottom: 12 }}>
                        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                            <FaCheckSquare style={{ marginRight: 6, color: "#14b8a6" }} />
                            {selectedProducts.length} ürün seçildi
                        </span>
                        <div className="pmv4-mp-checkboxes" style={{ flex: 1, marginBottom: 0 }}>
                            {marketplaces.map(mp => (
                                <label key={mp._id}
                                    className={`pmv4-mp-checkbox-label ${bulkTargets.includes(mp.name) ? "checked" : ""}`}
                                    style={{ borderColor: bulkTargets.includes(mp.name) ? mpColor(mp.name) : undefined }}>
                                    <input type="checkbox"
                                        checked={bulkTargets.includes(mp.name)}
                                        onChange={() => toggleTarget(mp.name)} />
                                    <span className="pmv4-mp-dot" style={{ background: mpColor(mp.name) }} />
                                    <span>{mp.name}</span>
                                    {bulkTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}
                                </label>
                            ))}
                        </div>
                        <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm"
                            onClick={handleBulkDistribute}
                            disabled={loading || bulkTargets.length === 0}>
                            {loading ? <Spinner /> : <FaRocket />}
                            {bulkTargets.length > 0 ? `${bulkTargets.length} Platforma Dağıt` : "Platform Seç"}
                        </button>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm"
                            onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}>
                            <FaTimes />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Matris Tablosu */}
            {compMatrix.length === 0 ? (
                <div className="pmv4-empty" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
                    <FaTable size={48} />
                    <p>Karşılaştırma verisi bulunamadı.</p>
                    <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm" onClick={loadComparison}>
                        <FaSync /> Yenile
                    </button>
                </div>
            ) : (
                <div className="pmv4-comp-table-wrapper">
                    <table className="pmv4-comp-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox"
                                        checked={selectedProducts.length === compMatrix.length && compMatrix.length > 0}
                                        onChange={() => {
                                            if (selectedProducts.length === compMatrix.length) setSelectedProducts([]);
                                            else setSelectedProducts(compMatrix.map(p => p._id));
                                        }} />
                                </th>
                                <th>Ürün</th>
                                <th>Barkod</th>
                                <th>Fiyat</th>
                                <th style={{ textAlign: "center" }}>Stok</th>
                                {marketplaces.map((mp, i) => (
                                    <th key={i} style={{
                                        background: mpColor(mp.name) + "22",
                                        color: mpColor(mp.name),
                                        minWidth: 120,
                                        textAlign: "center",
                                        borderBottom: `2px solid ${mpColor(mp.name)}55`
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name), display: "inline-block" }} />
                                            {mp.name}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ textAlign: "center" }}>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {compMatrix.map(product => {
                                const missingCount = product.missingCount || 0;
                                const isSelected = selectedProducts.includes(product._id);
                                return (
                                    <tr key={product._id} style={{
                                        background: isSelected ? "rgba(20,184,166,0.04)" : undefined
                                    }}>
                                        <td>
                                            <input type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleProduct(product._id)} />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: "0.84rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {product.name || "İsimsiz"}
                                            </div>
                                            {product.brand && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{product.brand}</div>}
                                        </td>
                                        <td style={{ color: "#64748b", fontSize: "0.78rem" }}>{product.barcode || "—"}</td>
                                        <td><span className="pmv4-price">₺{Number(product.price || 0).toLocaleString("tr-TR")}</span></td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{
                                                fontWeight: 700,
                                                color: (product.stock || 0) === 0 ? "#ef4444" : (product.stock || 0) < 10 ? "#f59e0b" : "#22c55e"
                                            }}>{product.stock ?? "—"}</span>
                                        </td>
                                        {marketplaces.map((mp, i) => {
                                            const presence = product.presence?.[mp.name];
                                            const exists = presence?.exists;
                                            const status = presence?.syncStatus;
                                            const statusColor = !exists ? "#334155"
                                                : status === "synced"  ? "#22c55e"
                                                : status === "error"   ? "#ef4444"
                                                : "#f59e0b";
                                            return (
                                                <td key={i} style={{ textAlign: "center" }}>
                                                    {exists ? (
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                                                            title={`Stok: ${presence.stock ?? "?"} | Fiyat: ₺${presence.price ?? "?"}`}>
                                                            <span style={{ color: statusColor, fontSize: "1rem" }}>
                                                                {status === "synced" ? "✅" : status === "error" ? "❌" : "⏳"}
                                                            </span>
                                                            <span style={{ fontSize: "0.68rem", color: statusColor, fontWeight: 600 }}>
                                                                {status === "synced" ? "Senkâron" : status === "error" ? "Hata" : "Bekliyor"}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                                            <span style={{ color: "#334155", fontSize: "1rem" }}>⬜</span>
                                                            <span style={{ fontSize: "0.68rem", color: "#334155", fontWeight: 600 }}>Yok</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: "center" }}>
                                            {missingCount > 0
                                                ? <span className="pmv4-badge pmv4-badge-warning">{missingCount} eksik</span>
                                                : <span className="pmv4-badge pmv4-badge-success">✅ Tam</span>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sayfalama */}
            {compTotal > PAGE_SIZE && (
                <div className="pmv4-pagination">
                    <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                        disabled={compPage === 0} onClick={() => setCompPage(p => Math.max(0, p - 1))}>
                        <FaArrowLeft /> ÖÖnceki
                    </button>
                    <span>Sayfa {compPage + 1} / {Math.ceil(compTotal / PAGE_SIZE)} · {compTotal} ürün</span>
                    <button className="pmv4-btn pmv4-btn-sm pmv4-btn-outline"
                        disabled={(compPage + 1) * PAGE_SIZE >= compTotal} onClick={() => setCompPage(p => p + 1)}>
                        Sonraki <FaArrowRight />
                    </button>
                </div>
            )}
        </motion.div>
    );

    // ── 6. LOGLAR ────────────────────────────────────────────────────────────
    const renderLogs = () => {
        const successLogs = logs.filter(l => l.status === "synced" || l.status === "success").length;
        const errorLogs   = logs.filter(l => l.status === "error").length;
        const pendingLogs = logs.filter(l => l.status === "pending").length;

        return (
        <motion.div key="logs" className="pmv4-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Log İstatistikleri */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
                {[
                    { icon:"📋", label:"Toplam Log",    val: logs.length,    color:"#14b8a6" },
                    { icon:"✅", label:"Başarılı",       val: successLogs,    color:"#22c55e" },
                    { icon:"❌", label:"Hatalı",         val: errorLogs,      color:"#ef4444" },
                    { icon:"⏳", label:"Bekleyen",       val: pendingLogs,    color:"#f59e0b" },
                    { icon:"🔔", label:"Okunmamış",      val: unreadCount,    color:"#8b5cf6" },
                ].map((k,i) => (
                    <div key={i} style={{
                        background:"rgba(255,255,255,0.02)", border:`1px solid rgba(255,255,255,0.07)`,
                        borderLeft:`3px solid ${k.color}`, borderRadius:10, padding:"12px 16px",
                        display:"flex", alignItems:"center", gap:12
                    }}>
                        <span style={{fontSize:"1.4rem"}}>{k.icon}</span>
                        <div>
                            <div style={{fontSize:"1.4rem",fontWeight:800,color:k.color,lineHeight:1}}>{k.val}</div>
                            <div style={{fontSize:"0.72rem",color:"#64748b",fontWeight:600,marginTop:2}}>{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bildirimler */}
            {notifications.length > 0 && (
                <div className="pmv4-section">
                    <div className="pmv4-section-head">
                        <h2>
                            <FaBell style={{color:"#8b5cf6"}} /> Bildirimler
                            {unreadCount > 0 && (
                                <span style={{
                                    background:"#8b5cf6", color:"#fff", borderRadius:999,
                                    padding:"1px 8px", fontSize:"0.7rem", fontWeight:700, marginLeft:6
                                }}>{unreadCount}</span>
                            )}
                        </h2>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={handleMarkAllRead}>
                            <FaCheck /> Tümünü Okundu İşaretle
                        </button>
                    </div>
                    <div className="pmv4-notif-list">
                        {notifications.map((notif, i) => (
                            <div key={i}
                                className={`pmv4-notif-item pmv4-notif-${notif.notification?.priority || "low"}`}
                                onClick={() => handleMarkRead(notif._id)}>
                                <div className="pmv4-notif-icon">
                                    {notif.notification?.priority === "critical" && <FaExclamationTriangle style={{color:"#ef4444"}} />}
                                    {notif.notification?.priority === "high"     && <FaBell style={{color:"#f59e0b"}} />}
                                    {notif.notification?.priority === "medium"   && <FaInfoCircle style={{color:"#3b82f6"}} />}
                                    {(!notif.notification?.priority || notif.notification?.priority === "low") && <FaCheckCircle style={{color:"#22c55e"}} />}
                                </div>
                                <div className="pmv4-notif-body">
                                    <strong>{notif.actionType || "Bildirim"}</strong>
                                    <p>{notif.product?.name || notif.product?.barcode || "—"}</p>
                                    <small>{notif.timestamp ? new Date(notif.timestamp).toLocaleString("tr-TR") : "—"}</small>
                                </div>
                                <FaTimes className="pmv4-notif-close" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* İşlem Geçmişi */}
            <div className="pmv4-section">
                <div className="pmv4-section-head">
                    <h2><FaClipboardList /> İşlem Geçmişi</h2>
                    <div style={{display:"flex",gap:8}}>
                        <span className="pmv4-total-label">{logs.length} kayıt</span>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={loadLogs}>
                            <FaSync /> Yenile
                        </button>
                    </div>
                </div>
                <p className="pmv4-section-desc">
                    Tüm senkâronizasyon, stok güncelleme ve fiyat değişikliği işlemlerinin geçmişi burada listelenir.
                </p>

                {logs.length === 0 ? (
                    <div className="pmv4-empty" style={{padding:"40px 20px"}}>
                        <FaClipboardList size={40} />
                        <p>Henüz işlem kaydı yok.</p>
                        <button className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={runAutoSync} disabled={autoSyncRunning}>
                            {autoSyncRunning ? <Spinner /> : <FaSync />} Senkâronizasyon Başlat
                        </button>
                    </div>
                ) : (
                    <div className="pmv4-log-table-wrapper">
                        <table className="pmv4-log-table">
                            <thead>
                                <tr>
                                    <th>Tarih & Saat</th>
                                    <th>İşlem Türü</th>
                                    <th>Ürün</th>
                                    <th>Pazaryeri</th>
                                    <th style={{textAlign:"center"}}>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => {
                                    const statusColor = log.status === "synced" || log.status === "success"
                                        ? "#22c55e" : log.status === "error" ? "#ef4444" : "#f59e0b";
                                    const statusIcon  = log.status === "synced" || log.status === "success"
                                        ? "✅" : log.status === "error" ? "❌" : "⏳";
                                    return (
                                        <tr key={i}>
                                            <td style={{color:"#64748b",fontSize:"0.78rem",whiteSpace:"nowrap"}}>
                                                {log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "—"}
                                            </td>
                                            <td>
                                                <span className="pmv4-log-action-badge">{log.actionType || "—"}</span>
                                            </td>
                                            <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                                {log.product?.name || log.product?.barcode || "—"}
                                            </td>
                                            <td>
                                                {log.marketplace?.name ? (
                                                    <span style={{display:"flex",alignItems:"center",gap:6}}>
                                                        <span style={{width:8,height:8,borderRadius:"50%",background:mpColor(log.marketplace.name),display:"inline-block",flexShrink:0}} />
                                                        {log.marketplace.name}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td style={{textAlign:"center"}}>
                                                <span style={{
                                                    display:"inline-flex",alignItems:"center",gap:5,
                                                    background:`${statusColor}15`,border:`1px solid ${statusColor}33`,
                                                    borderRadius:999,padding:"2px 10px",
                                                    fontSize:"0.72rem",fontWeight:700,color:statusColor
                                                }}>
                                                    {statusIcon} {log.status || "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </motion.div>
        );
    };

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER — ANA LAYOUT
    // ════════════════════════════════════════════════════════════════════════════

    return (
        <div className="pmv4-container">

            {/* ── Header ── */}
            <div className="pmv4-header">
                <div className="pmv4-header-left">
                    <h1><FaLayerGroup /> Ürün Yönetimi</h1>
                    <p>
                        Tüm pazaryerlerİşinizi tek panelden yönetin —&nbsp;
                        <span style={{ color: "#4ecdc4" }}>Stok</span> ·&nbsp;
                        <span style={{ color: "#22c55e" }}>Dağıtım</span> ·&nbsp;
                        <span style={{ color: "#f59e0b" }}>Fiyat</span>
                        {products.length > 0 && (
                            <span style={{
                                marginLeft: "12px",
                                background: "rgba(78,205,196,0.12)",
                                border: "1px solid rgba(78,205,196,0.25)",
                                borderRadius: "20px",
                                padding: "2px 10px",
                                fontSize: "12px",
                                color: "#4ecdc4",
                                fontWeight: 700
                            }}>
                                {products.length} benzersiz ürün
                            </span>
                        )}
                    </p>
                </div>
                <div className="pmv4-header-right">
                    {/* Sync durumu küçük gösterge */}
                    {autoSyncRunning && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            color: "#4ecdc4", fontSize: "12px", fontWeight: 600
                        }}>
                            <Spinner /> Senkronize ediliyor...
                        </div>
                    )}
                    <button className="pmv4-notif-btn" onClick={() => setActiveTab("logs")}
                        title={unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Bildirimler"}>
                        <FaBell />
                        {unreadCount > 0 && <span className="pmv4-notif-count">{unreadCount}</span>}
                    </button>
                    <button className="pmv4-btn pmv4-btn-primary pmv4-btn-sm"
                        onClick={runAutoSync} disabled={autoSyncRunning}>
                        {autoSyncRunning ? <Spinner /> : <FaSync />}
                        {autoSyncRunning ? "Senkronize Ediliyor..." : "Senkronize Et"}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="pmv4-tabs">
                {TABS.map(tab => (
                    <button key={tab.key}
                        className={`pmv4-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}>
                        {tab.icon} {tab.label}
                        {tab.key === "logs" && unreadCount > 0 && (
                            <span className="pmv4-tab-badge">{unreadCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="pmv4-content">
                <AnimatePresence mode="wait">
                    {activeTab === "dashboard"       && renderDashboard()}
                    {activeTab === "stock"           && renderStock()}
                    {activeTab === "distribution"    && renderDistribution()}
                    {activeTab === "variants"        && renderVariantGroups()}
                    {activeTab === "priçing"         && renderPriçing()}

                    {activeTab === "comparison"      && renderComparison()}
                    {activeTab === "logs"            && renderLogs()}
                </AnimatePresence>
            </div>

            {/* ── Toast ─────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`pmv4-toast pmv4-toast-${toast.type}`}
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}>
                        {toast.type === "success" && <FaCheckCircle />}
                        {toast.type === "error"   && <FaTimesCircle />}
                        {toast.type === "warning" && <FaExclamationTriangle />}
                        {toast.type === "info"    && <FaInfoCircle />}
                        <span>{toast.msg}</span>
                        <button onClick={() => setToast(null)}><FaTimes /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Varyant grubu: oluştur ─────────────────────────────────────── */}
            <AnimatePresence>
                {vgCreateOpen && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setVgCreateOpen(false)}>
                        <motion.div className="pmv4-modal pmv4-modal-wide"
                            style={{ maxWidth: 560 }}
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="pmv4-modal-header">
                                <h3><FaLayerGroup /> Yeni varyant grubu</h3>
                                <button type="button" onClick={() => setVgCreateOpen(false)}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <div className="pmv4-modal-info-box">
                                    <FaInfoCircle />
                                    <span>Grup adı kısa ve tanınır olsun (ör. ürün modeli). Trendyol model kodunu şimdi veya düzenlemede girebilirsiniz.</span>
                                </div>
                                <div className="pmv4-form-group">
                                    <label>Grup adı *</label>
                                    <input className="pmv4-input" value={vgFormName} onChange={(e) => setVgFormName(e.target.value)} placeholder="Örn. Temassız ödeme aparatı — yıldız model" />
                                </div>
                                <div className="pmv4-form-group">
                                    <label>Notlar</label>
                                    <textarea className="pmv4-input pmv4-textarea" value={vgFormNotes} onChange={(e) => setVgFormNotes(e.target.value)} rows={2} />
                                </div>
                                <div className="pmv4-form-grid">
                                    <div className="pmv4-form-group">
                                        <label>Trendyol model kodu (productMainId)</label>
                                        <input className="pmv4-input" value={vgFormMainId} onChange={(e) => setVgFormMainId(e.target.value)} placeholder="Tüm varyantlarda aynı olacak kod" />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>&nbsp;</label>
                                        <span className="pmv4-text-muted" style={{ fontSize: "0.78rem" }}>Boş bırakıp sonra düzenleyebilirsiniz.</span>
                                    </div>
                                </div>
                                <div className="pmv4-form-grid">
                                    <div className="pmv4-form-group">
                                        <label>Renk etiketi</label>
                                        <input className="pmv4-input" value={vgFormColorLbl} onChange={(e) => setVgFormColorLbl(e.target.value)} />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>Beden etiketi</label>
                                        <input className="pmv4-input" value={vgFormSizeLbl} onChange={(e) => setVgFormSizeLbl(e.target.value)} />
                                    </div>
                                </div>
                                <div className="pmv4-form-group pmv4-full">
                                    <label>Grupsuz ürünlerden seç (isteğe bağlı, son 200 kayıt)</label>
                                    <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--pmv4-border)", borderRadius: 8 }}>
                                        {vgPickerRows.length === 0 ? (
                                            <p style={{ padding: 12, margin: 0, color: "var(--pmv4-text-muted)", fontSize: "0.82rem" }}>Grupsuz ürün bulunamadı.</p>
                                        ) : (
                                            vgPickerRows.map((p) => (
                                                <label key={p._id} style={{
                                                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                                                    borderBottom: "1px solid var(--pmv4-border)", cursor: "pointer",
                                                }}>
                                                    <input type="checkbox" checked={vgCreatePick.has(String(p._id))} onChange={() => vgToggleCreatePick(p._id)} />
                                                    <span style={{ fontSize: "0.8rem" }}>
                                                        <strong>{(p.masterProduct?.name || "").slice(0, 70)}</strong>
                                                        <br />
                                                        <span className="pmv4-text-muted">{p.masterProduct?.sku} · {p.masterProduct?.barcode}</span>
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="pmv4-modal-footer">
                                <button type="button" className="pmv4-btn pmv4-btn-outline" onClick={() => setVgCreateOpen(false)}>İptal</button>
                                <button type="button" className="pmv4-btn pmv4-btn-primary" onClick={vgSubmitCreate} disabled={vgFormName.trim().length < 2}>
                                    Oluştur
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Varyant grubu: detay ──────────────────────────────────────── */}
            <AnimatePresence>
                {vgDetailOpen && vgActiveId && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setVgDetailOpen(false)}>
                        <motion.div className="pmv4-modal pmv4-modal-wide"
                            style={{ maxWidth: 640 }}
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="pmv4-modal-header">
                                <h3><FaEdit /> Grup düzenle</h3>
                                <button type="button" onClick={() => setVgDetailOpen(false)}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <div className="pmv4-form-grid">
                                    <div className="pmv4-form-group">
                                        <label>Grup adı</label>
                                        <input className="pmv4-input" value={vgFormName} onChange={(e) => setVgFormName(e.target.value)} />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>Trendyol model kodu</label>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <input className="pmv4-input" style={{ flex: 1 }} value={vgFormMainId} onChange={(e) => setVgFormMainId(e.target.value)} />
                                            <button type="button" className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={vgCopyMainId}>Kopyala</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="pmv4-form-group">
                                    <label>Notlar</label>
                                    <textarea className="pmv4-input pmv4-textarea" value={vgFormNotes} onChange={(e) => setVgFormNotes(e.target.value)} rows={2} />
                                </div>
                                <div className="pmv4-form-grid">
                                    <div className="pmv4-form-group">
                                        <label>Renk etiketi</label>
                                        <input className="pmv4-input" value={vgFormColorLbl} onChange={(e) => setVgFormColorLbl(e.target.value)} />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>Beden etiketi</label>
                                        <input className="pmv4-input" value={vgFormSizeLbl} onChange={(e) => setVgFormSizeLbl(e.target.value)} />
                                    </div>
                                </div>
                                <button type="button" className="pmv4-btn pmv4-btn-success pmv4-btn-sm" onClick={vgSaveDetailMeta}>
                                    <FaSave /> Bilgileri kaydet
                                </button>
                                <div className="pmv4-modal-info-box" style={{ marginTop: 14 }}>
                                    <FaInfoCircle />
                                    <span><strong>Üyeler</strong> bu gruptaki ürün satırlarıdır. Çıkarmak silmez; sadece gruptan ayırır.</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <strong style={{ fontSize: "0.85rem" }}>Ürünler ({vgMembers.length})</strong>
                                    <button type="button" className="pmv4-btn pmv4-btn-outline pmv4-btn-sm" onClick={vgOpenAddPicker}><FaPlus /> Ürün ekle</button>
                                </div>
                                <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--pmv4-border)", borderRadius: 8 }}>
                                    {vgMembers.length === 0 ? (
                                        <p style={{ padding: 12, margin: 0, color: "var(--pmv4-text-muted)", fontSize: "0.82rem" }}>Henüz üye yok.</p>
                                    ) : (
                                        vgMembers.map((m) => (
                                            <div key={m._id} style={{
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--pmv4-border)",
                                            }}>
                                                <div style={{ fontSize: "0.8rem", minWidth: 0 }}>
                                                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>
                                                        {m.masterProduct?.name}
                                                    </strong>
                                                    <span className="pmv4-text-muted">
                                                        {m.masterProduct?.sku} · {m.masterProduct?.barcode} · {summarizeVariantAttrs(m.masterProduct?.attributes)} · stok: {m.stockTracking?.totalStock ?? "—"}
                                                    </span>
                                                </div>
                                                <button type="button" className="pmv4-btn pmv4-btn-danger pmv4-btn-sm" onClick={() => vgRemoveMember(m._id)}>Çıkar</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="pmv4-modal-footer">
                                <button type="button" className="pmv4-btn pmv4-btn-danger" onClick={vgDeleteGroup}><FaTrash /> Grubu sil</button>
                                <button type="button" className="pmv4-btn pmv4-btn-outline" onClick={() => setVgDetailOpen(false)}>Kapat</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Varyant grubu: ürün seçici ───────────────────────────────── */}
            <AnimatePresence>
                {vgPickerOpen && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setVgPickerOpen(false)}>
                        <motion.div className="pmv4-modal pmv4-modal-wide"
                            style={{ maxWidth: 520 }}
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="pmv4-modal-header">
                                <h3><FaPlus /> Gruba ürün ekle</h3>
                                <button type="button" onClick={() => setVgPickerOpen(false)}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <p className="pmv4-section-desc" style={{ marginTop: 0 }}>Yalnızca <strong>henüz gruba bağlı olmayan</strong> ürünler listelenir (son 250 kayıt).</p>
                                <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--pmv4-border)", borderRadius: 8 }}>
                                    {vgPickerRows.length === 0 ? (
                                        <p style={{ padding: 12, margin: 0, color: "var(--pmv4-text-muted)", fontSize: "0.82rem" }}>Eklenebilecek ürün yok.</p>
                                    ) : (
                                        vgPickerRows.map((p) => (
                                            <label key={p._id} style={{
                                                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                                                borderBottom: "1px solid var(--pmv4-border)", cursor: "pointer",
                                            }}>
                                                <input type="checkbox" checked={vgPickerPick.has(String(p._id))} onChange={() => vgTogglePickerPick(p._id)} />
                                                <span style={{ fontSize: "0.8rem" }}>
                                                    <strong>{(p.masterProduct?.name || "").slice(0, 64)}</strong>
                                                    <br />
                                                    <span className="pmv4-text-muted">{p.masterProduct?.sku} · {p.masterProduct?.barcode}</span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="pmv4-modal-footer">
                                <button type="button" className="pmv4-btn pmv4-btn-outline" onClick={() => setVgPickerOpen(false)}>İptal</button>
                                <button type="button" className="pmv4-btn pmv4-btn-primary" onClick={vgSubmitAddMembers} disabled={vgPickerPick.size === 0}>
                                    Ekle ({vgPickerPick.size})
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Stok Güncelleme Modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {stockModal && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setStockModal(null)}>
                        <motion.div className="pmv4-modal"
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}>
                            <div className="pmv4-modal-header">
                                <h3><FaWarehouse /> Stok Güncelle</h3>
                                <button onClick={() => setStockModal(null)}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <div className="pmv4-modal-product-info">
                                    <strong>{stockModal.product?.masterProduct?.name || stockModal.product?.name}</strong>
                                    <span className="pmv4-text-muted">
                                        {stockModal.product?.masterProduct?.barcode || stockModal.product?.barcode}
                                    </span>
                                </div>
                                <div className="pmv4-modal-info-box">
                                    <FaInfoCircle />
                                    <span>Stok güncellediğinizde <strong>tüm pazaryerleri</strong> otomatik olarak güncellenir.</span>
                                </div>
                                <div className="pmv4-form-group">
                                    <label>Yeni Stok Miktarı</label>
                                    <input className="pmv4-input" type="number" min="0"
                                        value={stockValue} onChange={e => setStockValue(e.target.value)} />
                                </div>
                                <div className="pmv4-form-group">
                                    <label>Düşük Stok Eşiği (Uyarı için)</label>
                                    <input className="pmv4-input" type="number" min="0"
                                        value={stockThreshold} onChange={e => setStockThreshold(e.target.value)} />
                                </div>
                                {/* Pazaryeri önizleme */}
                                {(stockModal.product?.marketplaceMappings || []).length > 0 && (
                                    <div className="pmv4-modal-mp-preview">
                                        <p>Güncellenecek pazaryerleri:</p>
                                        <div className="pmv4-mp-badges">
                                            {(stockModal.product.marketplaceMappings || []).map((m, i) => (
                                                <span key={i} className="pmv4-mp-chip"
                                                    style={{ background: mpColor(m.marketplaceName) }}>
                                                    {m.marketplaceName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="pmv4-modal-footer">
                                <button className="pmv4-btn pmv4-btn-outline" onClick={() => setStockModal(null)}>İptal</button>
                                <button className="pmv4-btn pmv4-btn-primary" onClick={handleSyncStock} disabled={loading}>
                                    {loading ? <Spinner /> : <FaSave />} Tüm Pazaryerlerinde Güncelle
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Fiyat Güncelleme Modal ─────────────────────────────────────── */}
            <AnimatePresence>
                {priceModal && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setPriceModal(null)}>
                        <motion.div className="pmv4-modal pmv4-modal-wide"
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}>
                            <div className="pmv4-modal-header">
                                <h3><FaMoneyBillWave /> Fiyat Güncelle</h3>
                                <button onClick={() => setPriceModal(null)}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <div className="pmv4-modal-product-info">
                                    <strong>{priceModal.product?.masterProduct?.name || priceModal.product?.name}</strong>
                                    <span className="pmv4-text-muted">
                                        {priceModal.product?.masterProduct?.sku || priceModal.product?.sku}
                                    </span>
                                </div>
                                <div className="pmv4-modal-info-box">
                                    <FaInfoCircle />
                                    <span>Fiyat güncellediğinizde <strong>tüm pazaryerleri</strong> otomatik olarak güncellenir.</span>
                                </div>
                                <div className="pmv4-form-grid">
                                    <div className="pmv4-form-group">
                                        <label>Satış Fiyatı (₺) *</label>
                                        <input className="pmv4-input" type="number" min="0" step="0.01"
                                            value={salePrice}
                                            onChange={e => {
                                                setSalePrice(e.target.value);
                                                setDiscountRate(calcDiscountRate(e.target.value, listPrice));
                                            }} />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>Liste Fiyatı (₺)</label>
                                        <input className="pmv4-input" type="number" min="0" step="0.01"
                                            value={listPrice}
                                            onChange={e => {
                                                setListPrice(e.target.value);
                                                setDiscountRate(calcDiscountRate(salePrice, e.target.value));
                                            }} />
                                    </div>
                                    <div className="pmv4-form-group">
                                        <label>İndirim Oranı (%)</label>
                                        <input className="pmv4-input" type="number" min="0" max="100" step="0.1"
                                            value={discountRate}
                                            onChange={e => {
                                                setDiscountRate(e.target.value);
                                                if (listPrice) setSalePrice(applyDiscount(listPrice, e.target.value));
                                            }} />
                                    </div>
                                    {salePrice && listPrice && parseFloat(listPrice) > parseFloat(salePrice) && (
                                        <div className="pmv4-form-group">
                                            <label>Tasarruf</label>
                                            <div className="pmv4-discount-preview">
                                                <FaPercent />
                                                <span>₺{(parseFloat(listPrice) - parseFloat(salePrice)).toFixed(2)} tasarruf</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Pazaryeri önizleme */}
                                {(priceModal.product?.marketplaceMappings || []).length > 0 && (
                                    <div className="pmv4-modal-mp-preview">
                                        <p>Güncellenecek pazaryerleri:</p>
                                        <div className="pmv4-mp-badges">
                                            {(priceModal.product.marketplaceMappings || []).map((m, i) => (
                                                <span key={i} className="pmv4-mp-chip"
                                                    style={{ background: mpColor(m.marketplaceName) }}>
                                                    {m.marketplaceName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="pmv4-modal-footer">
                                <button className="pmv4-btn pmv4-btn-outline" onClick={() => setPriceModal(null)}>İptal</button>
                                <button className="pmv4-btn pmv4-btn-primary" onClick={handleSyncPrice} disabled={loading}>
                                    {loading ? <Spinner /> : <FaSave />} Tüm Pazaryerlerinde Güncelle
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Silme Onay Modal ───────────────────────────────────────────── */}
            <AnimatePresence>
                {deleteModal && (
                    <motion.div className="pmv4-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => { if (!deleting) { setDeleteModal(null); setDeleteResults(null); } }}>
                        <motion.div className="pmv4-modal pmv4-modal-danger"
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: 520 }}>
                            <div className="pmv4-modal-header">
                                <h3><FaTrash /> Ürünü Sil</h3>
                                <button onClick={() => { if (!deleting) { setDeleteModal(null); setDeleteResults(null); } }}><FaTimes /></button>
                            </div>
                            <div className="pmv4-modal-body">
                                <p>Bu ürünü silmek istediğinizden emin misiniz?</p>
                                <p><strong>{deleteModal.masterProduct?.name || deleteModal.name}</strong></p>

                                {/* Pazaryeri bilgisi */}
                                {deleteModal.marketplaceMappings?.length > 0 && (
                                    <div style={{ margin: "12px 0", padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                                            <FaGlobe /> Tüm pazaryerlerinden kaldırılacak
                                        </div>
                                        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>
                                            Ürün aşağıdaki platformlardan tamamen silinecek veya stok 0'a çekilecek:
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {deleteModal.marketplaceMappings.map((mp, i) => {
                                                const name = mp.marketplaceName || "?";
                                                const colors = { Trendyol: "#f27a1a", N11: "#7b61ff", Hepsiburada: "#ff6000", ÇiçekSepeti: "#e91e8c", Amazon: "#ff9900" };
                                                return (
                                                    <span key={i} style={{
                                                        display: "inline-flex", alignItems: "center", gap: 4,
                                                        padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                                                        background: `${colors[name] || "#666"}22`, color: colors[name] || "#666",
                                                        border: `1px solid ${colors[name] || "#666"}44`
                                                    }}>
                                                        {name}
                                                        {mp.marketplaceSku && <span style={{ opacity: 0.7, fontWeight: 400 }}>({mp.marketplaceSku})</span>}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Silme sonuçları */}
                                {deleteResults && deleteResults.length > 0 && (
                                    <div style={{ margin: "12px 0", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#aaa" }}>Pazaryeri Sonuçları:</div>
                                        {deleteResults.map((r, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0" }}>
                                                <span>{r.status === "success" ? "✅" : r.status === "skipped" ? "⏭️" : "❌"}</span>
                                                <span style={{ fontWeight: 600, minWidth: 80 }}>{r.name}</span>
                                                <span style={{ color: r.status === "success" ? "#22c55e" : r.status === "error" ? "#ef4444" : "#888" }}>{r.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="pmv4-modal-info-box pmv4-info-danger">
                                    <FaExclamationTriangle />
                                    <span>
                                        {deleteModal.marketplaceMappings?.length > 0
                                            ? "Bu işlem geri alınamaz. Ürün yerel kayıttan silinecek ve tüm pazaryerlerinden kaldırılacaktır (stok 0 / tamamen silinir)."
                                            : "Bu işlem geri alınamaz. Ürün sadece yerel kayıttan silinecektir."}
                                    </span>
                                </div>
                            </div>
                            <div className="pmv4-modal-footer">
                                <button className="pmv4-btn pmv4-btn-outline" onClick={() => { setDeleteModal(null); setDeleteResults(null); }} disabled={deleting}>İptal</button>
                                <button className="pmv4-btn pmv4-btn-danger" onClick={handleDelete} disabled={deleting || deleteResults}>
                                    {deleting ? <><Spinner /> Siliniyor...</> : <><FaTrash /> {deleteModal.marketplaceMappings?.length > 0 ? "Her Yerden Sil" : "Sil"}</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default ProductManagementPageV3;
