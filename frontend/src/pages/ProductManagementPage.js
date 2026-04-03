/**
 * ProductManagementPage.js
 *
 * Sıfırdan yazılmış, tam kapsamlı Ürün Yönetimi sayfası.
 *
 * 5 Sekme:
 *  1. Dashboard   — İstatistikler, pazaryeri durumu, son loglar
 *  2. Ürünler     — Liste, arama/filtre, stok/fiyat güncelle, dağıt, sil
 *  3. Yeni Ürün   — 6 adımlı wizard (temel bilgi → fiyat → görsel → kategori → pazaryeri → onay)
 *  4. Dağıtım     — Pazaryerinden çek / toplu dağıt / tek pazaryeri sync
 *  5. Loglar      — İşlem geçmişi & bildirimler
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaChartBar, FaPlus, FaExchangeAlt, FaListAlt,
    FaSearch, FaSync, FaBell, FaSpinner, FaBox, FaStore,
    FaWarehouse, FaMoneyBillWave, FaTrash, FaUpload, FaDownload,
    FaCheck, FaTimes, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaArrowLeft, FaArrowRight, FaSave,
    FaBarcode, FaTag, FaImage, FaLayerGroup, FaDollarSign,
    FaInfoCircle, FaEdit, FaEye, FaFilter, FaBolt
} from "react-icons/fa";

import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    syncFromMarketplace,
    distributeProduct,
    bulkDistribute,
    syncStock,
    syncPrice,
    triggerAutoSync,
    getCategoryMappings,
    getSyncLogs,
    getUnreadNotifications,
    markNotificationRead,
    getProductManagementDashboard
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementPage.css";

// ─── Sabitler ────────────────────────────────────────────────────────────────

const TABS = [
    { key: "dashboard",     icon: <FaChartBar />,     label: "Dashboard"    },
    { key: "products",      icon: <FaBox />,           label: "Ürünler"      },
    { key: "new-product",   icon: <FaPlus />,          label: "Yeni Ürün"    },
    { key: "distribution",  icon: <FaExchangeAlt />,   label: "Dağıtım"      },
    { key: "logs",          icon: <FaListAlt />,       label: "Loglar"       },
];

const WIZARD_STEPS = [
    { id: 1, title: "Temel Bilgiler",          icon: <FaBoxOpen />,    desc: "Ürün adı, barkod, SKU, marka"          },
    { id: 2, title: "Fiyat & Stok",            icon: <FaDollarSign />, desc: "Fiyatlandırma ve stok miktarı"         },
    { id: 3, title: "Görsel & Açıklama",       icon: <FaImage />,      desc: "Ürün görselleri ve detay açıklaması"   },
    { id: 4, title: "Kategori & Özellikler",   icon: <FaLayerGroup />, desc: "Kategori seçimi ve ürün özellikleri"   },
    { id: 5, title: "Pazaryeri Seçimi",        icon: <FaStore />,      desc: "Hangi pazaryerlerine dağıtılacak"      },
    { id: 6, title: "Onay & Kaydet",           icon: <FaCheck />,      desc: "Son kontrol ve kaydetme"               },
];

const MASTER_CATEGORIES = [
    { group: "👕 Giyim & Moda",           items: ["Giyim > Kadın Giyim","Giyim > Erkek Giyim","Giyim > Çocuk Giyim","Giyim > Ayakkabı","Giyim > Çanta","Giyim > Aksesuar"] },
    { group: "📱 Elektronik",             items: ["Elektronik > Telefon & Tablet","Elektronik > Telefon Aksesuarları","Elektronik > Bilgisayar","Elektronik > TV & Ses","Elektronik > Kamera","Elektronik > Oyun"] },
    { group: "🏠 Ev & Yaşam",             items: ["Ev & Yaşam > Mobilya","Ev & Yaşam > Dekorasyon","Ev & Yaşam > Tekstil","Ev & Yaşam > Mutfak","Ev & Yaşam > Banyo","Ev & Yaşam > Aydınlatma"] },
    { group: "💄 Kozmetik",               items: ["Kozmetik > Makyaj","Kozmetik > Cilt Bakımı","Kozmetik > Saç Bakımı","Kozmetik > Parfüm","Kozmetik > Kişisel Bakım"] },
    { group: "⚽ Spor & Outdoor",         items: ["Spor > Spor Giyim","Spor > Spor Ayakkabı","Spor > Ekipman","Spor > Outdoor","Spor > Bisiklet"] },
    { group: "🧸 Bebek & Çocuk",          items: ["Bebek > Giyim","Bebek > Bakım","Bebek > Odası","Bebek > Oyuncak"] },
    { group: "📚 Kitap & Kırtasiye",      items: ["Kitap > Kitap","Kitap > Dergi","Kitap > Kırtasiye","Kitap > Hobi"] },
    { group: "🚗 Otomotiv",               items: ["Otomotiv > Aksesuar","Otomotiv > Yedek Parça","Otomotiv > Bakım"] },
    { group: "🔧 Yapı Market",            items: ["Yapı Market > Hırdavat","Yapı Market > Elektrik","Yapı Market > Bahçe"] },
    { group: "🐾 Pet Shop",               items: ["Pet Shop > Kedi","Pet Shop > Köpek","Pet Shop > Kuş","Pet Shop > Balık"] },
    { group: "🍽️ Süpermarket",           items: ["Süpermarket > Gıda","Süpermarket > İçecek","Süpermarket > Temizlik"] },
    { group: "🎁 Diğer",                  items: ["Diğer > Hediyelik","Diğer > Ofis","Diğer > Hobi & Eğlence"] },
];

const MP_COLORS = {
    trendyol:    "#f27a1a",
    hepsiburada: "#ff6000",
    n11:         "#6f2da8",
    çiçeksepeti: "#e91e8c",
    amazon:      "#ff9900",
};

const mpColor = (name = "") => MP_COLORS[(name || "").toLowerCase()] || "#0f766e";

const EMPTY_FORM = {
    name: "", barcode: "", sku: "", brand: "", currencyType: "TRY",
    price: "", listPrice: "", stock: "", vatRate: 18,
    description: "", images: [""],
    category: "", color: "", size: "", weight: "",
    selectedMarketplaces: [], marketplaceCategoryOverrides: {}
};

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

const StockBadge = ({ stock, threshold = 10 }) => {
    if (stock === 0)         return <span className="pm-badge pm-badge-danger">Stok Yok</span>;
    if (stock <= threshold)  return <span className="pm-badge pm-badge-warning">Düşük Stok</span>;
    return                          <span className="pm-badge pm-badge-success">Stokta</span>;
};

const SyncBadge = ({ status }) => {
    const map = { synced: ["pm-badge-success","Senkron"], error: ["pm-badge-danger","Hata"], pending: ["pm-badge-warning","Bekliyor"] };
    const [cls, label] = map[status] || ["pm-badge-info", status || "—"];
    return <span className={`pm-badge ${cls}`}>{label}</span>;
};

const safeImg = (images) => {
    if (!images || !images.length) return null;
    const f = images[0];
    return typeof f === "string" ? f : f?.url || null;
};

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

const ProductManagementPage = () => {
    // ── Genel state ──────────────────────────────────────────────────────────
    const [activeTab,       setActiveTab]       = useState("dashboard");
    const [toast,           setToast]           = useState(null);   // { msg, type }
    const [loading,         setLoading]         = useState(false);
    const toastTimer = useRef(null);

    // ── Dashboard ────────────────────────────────────────────────────────────
    const [dashboard,       setDashboard]       = useState(null);

    // ── Ürünler ──────────────────────────────────────────────────────────────
    const [products,        setProducts]        = useState([]);
    const [totalProducts,   setTotalProducts]   = useState(0);
    const [page,            setPage]            = useState(0);
    const [search,          setSearch]          = useState("");
    const [filterMP,        setFilterMP]        = useState("");
    const [filterStock,     setFilterStock]     = useState("");
    const [marketplaces,    setMarketplaces]    = useState([]);

    // ── Stok/Fiyat modal ─────────────────────────────────────────────────────
    const [editModal,       setEditModal]       = useState(null);   // { product, type:"stock"|"price" }
    const [editValue,       setEditValue]       = useState("");
    const [editListPrice,   setEditListPrice]   = useState("");

    // ── Dağıtım modal ────────────────────────────────────────────────────────
    const [distModal,       setDistModal]       = useState(null);   // { product }
    const [distTargets,     setDistTargets]     = useState([]);

    // ── Silme onay modal ─────────────────────────────────────────────────────
    const [deleteModal,     setDeleteModal]     = useState(null);   // product

    // ── Wizard (Yeni Ürün) ───────────────────────────────────────────────────
    const [wizardStep,      setWizardStep]      = useState(1);
    const [formData,        setFormData]        = useState({ ...EMPTY_FORM });
    const [wizardError,     setWizardError]     = useState("");
    const [wizardSuccess,   setWizardSuccess]   = useState(false);

    // ── Dağıtım sekmesi ──────────────────────────────────────────────────────
    const [selectedMPs,     setSelectedMPs]     = useState([]);
    const [bulkSrc,         setBulkSrc]         = useState("");
    const [bulkTargets,     setBulkTargets]     = useState([]);

    // ── Loglar ───────────────────────────────────────────────────────────────
    const [logs,            setLogs]            = useState([]);
    const [notifications,   setNotifications]   = useState([]);
    const [unreadCount,     setUnreadCount]     = useState(0);

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
            const params = { page, limit: 20 };
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

    // ─── İlk yükleme ──────────────────────────────────────────────────────────
    useEffect(() => {
        loadDashboard();
        loadProducts();
        loadMarketplaces();
        loadNotifications();
        const iv = setInterval(() => { loadNotifications(); }, 15000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]);

    useEffect(() => {
        if (activeTab === "logs") { loadLogs(); loadNotifications(); }
        if (activeTab === "dashboard") loadDashboard();
    }, [activeTab]);

    // ─── Stok güncelle ────────────────────────────────────────────────────────
    const handleSyncStock = async () => {
        if (!editModal?.product) return;
        const val = parseInt(editValue);
        if (isNaN(val) || val < 0) { showToast("Geçerli bir stok girin (0 veya üzeri)", "warning"); return; }
        setLoading(true);
        try {
            const priceUpd = editListPrice ? { listPrice: parseFloat(editListPrice) } : null;
            const res = await syncStock(editModal.product._id, val, priceUpd);
            showToast(res.message || "Stok güncellendi ✅", "success");
            setEditModal(null); setEditValue(""); setEditListPrice("");
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Stok güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Fiyat güncelle ───────────────────────────────────────────────────────
    const handleSyncPrice = async () => {
        if (!editModal?.product) return;
        const val = parseFloat(editValue);
        if (isNaN(val) || val <= 0) { showToast("Geçerli bir fiyat girin", "warning"); return; }
        setLoading(true);
        try {
            const listP = editListPrice ? parseFloat(editListPrice) : null;
            const res = await syncPrice(editModal.product._id, val, listP);
            showToast(res.message || "Fiyat güncellendi ✅", "success");
            setEditModal(null); setEditValue(""); setEditListPrice("");
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Fiyat güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Ürün dağıt ───────────────────────────────────────────────────────────
    const handleDistribute = async () => {
        if (!distModal?.product || distTargets.length === 0) {
            showToast("En az bir hedef pazaryeri seçin", "warning"); return;
        }
        setLoading(true);
        try {
            const res = await distributeProduct(distModal.product._id, distTargets);
            const ok = (res.results || []).filter(r => r.status === "success").length;
            showToast(`${ok} pazaryerine dağıtıldı ✅`, "success");
            setDistModal(null); setDistTargets([]);
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Dağıtım başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Ürün sil ─────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteModal) return;
        setLoading(true);
        try {
            await deleteProduct(deleteModal._id);
            showToast("Ürün silindi ✅", "success");
            setDeleteModal(null);
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Ürün silinemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Otomatik sync ────────────────────────────────────────────────────────
    const handleAutoSync = async () => {
        setLoading(true);
        try {
            const res = await triggerAutoSync();
            showToast(`Otomatik senkronizasyon tamamlandı — ${(res.results || []).length} ürün işlendi ✅`, "success");
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Otomatik senkronizasyon başarısız", "error");
        } finally { setLoading(false); }
    };

    // ─── Pazaryerinden sync ───────────────────────────────────────────────────
    const handleSyncFromMP = async (mp) => {
        setLoading(true);
        try {
            const res = await syncFromMarketplace(mp._id || mp.name, mp.name);
            showToast(`${mp.name} senkronize edildi — Yeni: ${res.stats?.new || 0}, Güncellenen: ${res.stats?.updated || 0} ✅`, "success");
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast(`${mp.name} senkronizasyonu başarısız: ` + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Toplu dağıtım ────────────────────────────────────────────────────────
    const handleBulkDistribute = async () => {
        if (!bulkSrc || bulkTargets.length === 0) {
            showToast("Kaynak ve hedef pazaryeri seçin", "warning"); return;
        }
        setLoading(true);
        try {
            const res = await bulkDistribute(bulkSrc, bulkTargets);
            showToast(`Toplu dağıtım tamamlandı — ${res.results?.distributed || 0} ürün dağıtıldı ✅`, "success");
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Toplu dağıtım başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    // ─── Bildirim okundu ──────────────────────────────────────────────────────
    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            loadNotifications();
        } catch { /* sessiz */ }
    };

    const handleMarkAllRead = async () => {
        try {
            await markNotificationRead("all");
            loadNotifications();
            showToast("Tüm bildirimler okundu ✅", "success");
        } catch { /* sessiz */ }
    };

    // ─── Wizard helpers ───────────────────────────────────────────────────────
    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setWizardError("");
    };

    const addImage = () => setFormData(prev => ({ ...prev, images: [...prev.images, ""] }));
    const removeImage = (i) => setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }));
    const updateImage = (i, v) => setFormData(prev => {
        const imgs = [...prev.images]; imgs[i] = v; return { ...prev, images: imgs };
    });

    const toggleWizardMP = (name) => setFormData(prev => {
        const sel = prev.selectedMarketplaces.includes(name)
            ? prev.selectedMarketplaces.filter(m => m !== name)
            : [...prev.selectedMarketplaces, name];
        return { ...prev, selectedMarketplaces: sel };
    });

    const updateMPCategory = (mpName, field, value) => setFormData(prev => ({
        ...prev,
        marketplaceCategoryOverrides: {
            ...prev.marketplaceCategoryOverrides,
            [mpName]: { ...prev.marketplaceCategoryOverrides[mpName], [field]: value }
        }
    }));

    const validateWizardStep = () => {
        switch (wizardStep) {
            case 1:
                if (!formData.name.trim())    return "Ürün adı zorunludur";
                if (!formData.barcode.trim()) return "Barkod zorunludur";
                if (!formData.sku.trim())     return "SKU / Stok kodu zorunludur";
                return null;
            case 2:
                if (!formData.price || Number(formData.price) <= 0) return "Geçerli bir satış fiyatı girin";
                if (formData.stock === "" || Number(formData.stock) < 0) return "Geçerli bir stok miktarı girin";
                return null;
            case 5:
                if (formData.selectedMarketplaces.length === 0) return "En az bir pazaryeri seçin";
                return null;
            default: return null;
        }
    };

    const nextWizardStep = () => {
        const err = validateWizardStep();
        if (err) { setWizardError(err); return; }
        setWizardError("");
        setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length));
    };

    const prevWizardStep = () => { setWizardError(""); setWizardStep(s => Math.max(s - 1, 1)); };

    const handleWizardSubmit = async () => {
        setLoading(true);
        setWizardError("");
        try {
            const payload = {
                name:        formData.name,
                barcode:     formData.barcode,
                sku:         formData.sku,
                brand:       formData.brand,
                description: formData.description,
                images:      formData.images.filter(i => i.trim()),
                price:       Number(formData.price),
                listPrice:   Number(formData.listPrice) || Number(formData.price),
                stock:       Number(formData.stock),
                category:    formData.category,
                attributes:  { color: formData.color, size: formData.size, weight: Number(formData.weight) || 0 },
                marketplaceMappings: formData.selectedMarketplaces.map(mpName => ({
                    marketplaceName: mpName,
                    categoryId:   formData.marketplaceCategoryOverrides[mpName]?.categoryId   || "",
                    categoryName: formData.marketplaceCategoryOverrides[mpName]?.categoryName || formData.category,
                    syncStatus:   "pending"
                }))
            };
            await createProduct(payload);
            setWizardSuccess(true);
            loadProducts(); loadDashboard();
        } catch (e) {
            setWizardError(e.response?.data?.error || "Ürün oluşturulamadı");
        } finally { setLoading(false); }
    };

    const resetWizard = () => {
        setFormData({ ...EMPTY_FORM });
        setWizardStep(1);
        setWizardSuccess(false);
        setWizardError("");
    };

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER — SEKMELER
    // ════════════════════════════════════════════════════════════════════════════

    // ── 1. DASHBOARD ─────────────────────────────────────────────────────────
    const renderDashboard = () => (
        <motion.div key="dashboard" className="pm-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* İstatistik kartları */}
            <div className="pm-stats-grid">
                {[
                    { icon: <FaBox />,                 label: "Toplam Ürün",         value: dashboard?.products?.total     ?? 0, cls: "blue"   },
                    { icon: <FaStore />,               label: "Pazaryeri",            value: marketplaces.length,                cls: "teal"   },
                    { icon: <FaCheckCircle />,         label: "Senkron",              value: dashboard?.products?.synced    ?? 0, cls: "green"  },
                    { icon: <FaExclamationTriangle />, label: "Stok Yok",             value: dashboard?.products?.outOfStock ?? 0, cls: "red"   },
                    { icon: <FaWarehouse />,           label: "Düşük Stok",           value: dashboard?.products?.lowStock  ?? 0, cls: "yellow" },
                    { icon: <FaBell />,                label: "Okunmamış Bildirim",   value: unreadCount,                        cls: "purple" },
                ].map((s, i) => (
                    <div key={i} className={`pm-stat-card pm-stat-${s.cls}`}>
                        <div className="pm-stat-icon">{s.icon}</div>
                        <div className="pm-stat-body">
                            <h3>{s.value}</h3>
                            <p>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pazaryeri durumu */}
            {(dashboard?.marketplaces?.length > 0 || marketplaces.length > 0) && (
                <div className="pm-section">
                    <h2><FaStore /> Pazaryeri Durumu</h2>
                    <div className="pm-mp-grid">
                        {(dashboard?.marketplaces?.length > 0 ? dashboard.marketplaces : marketplaces).map((mp, i) => (
                            <div key={i} className="pm-mp-card" style={{ borderTop: `4px solid ${mpColor(mp.name)}` }}>
                                <div className="pm-mp-card-header" style={{ color: mpColor(mp.name) }}>
                                    <FaStore /> <strong>{mp.name}</strong>
                                </div>
                                <div className="pm-mp-card-body">
                                    <div className="pm-mp-row"><span>Toplam Ürün</span><strong>{mp.totalProducts ?? 0}</strong></div>
                                    {mp.syncedProducts  !== undefined && <div className="pm-mp-row"><span>Senkron</span><strong className="pm-text-green">{mp.syncedProducts}</strong></div>}
                                    {mp.pendingProducts !== undefined && <div className="pm-mp-row"><span>Bekliyor</span><strong className="pm-text-yellow">{mp.pendingProducts}</strong></div>}
                                    {mp.errorProducts   !== undefined && <div className="pm-mp-row"><span>Hata</span><strong className="pm-text-red">{mp.errorProducts}</strong></div>}
                                </div>
                                <div className="pm-mp-card-footer">
                                    <button className="pm-btn pm-btn-sm pm-btn-outline"
                                        onClick={() => handleSyncFromMP(mp)} disabled={loading}>
                                        <FaSync /> Senkronize Et
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Son işlemler */}
            {dashboard?.recentLogs?.length > 0 && (
                <div className="pm-section">
                    <h2><FaListAlt /> Son İşlemler</h2>
                    <div className="pm-log-list">
                        {dashboard.recentLogs.map((log, i) => (
                            <div key={i} className={`pm-log-row pm-log-${log.status}`}>
                                <span className="pm-log-action">{log.actionType}</span>
                                <span className="pm-log-name">{log.product?.name || log.product?.barcode || "—"}</span>
                                <span className="pm-log-time">{new Date(log.timestamp).toLocaleString("tr-TR")}</span>
                                <SyncBadge status={log.status} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Hızlı aksiyonlar */}
            <div className="pm-section">
                <h2><FaBolt /> Hızlı Aksiyonlar</h2>
                <div className="pm-quick-actions">
                    <button className="pm-btn pm-btn-primary" onClick={() => setActiveTab("new-product")}>
                        <FaPlus /> Yeni Ürün Ekle
                    </button>
                    <button className="pm-btn pm-btn-secondary" onClick={handleAutoSync} disabled={loading}>
                        {loading ? <FaSpinner className="pm-spin" /> : <FaSync />} Otomatik Senkronize Et
                    </button>
                    <button className="pm-btn pm-btn-secondary" onClick={() => setActiveTab("distribution")}>
                        <FaExchangeAlt /> Dağıtım Yönetimi
                    </button>
                    <button className="pm-btn pm-btn-secondary" onClick={() => setActiveTab("logs")}>
                        <FaListAlt /> İşlem Logları
                    </button>
                </div>
            </div>
        </motion.div>
    );

    // ── 2. ÜRÜNLER ────────────────────────────────────────────────────────────
    const renderProducts = () => (
        <motion.div key="products" className="pm-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Filtreler */}
            <div className="pm-filters">
                <div className="pm-search-box">
                    <FaSearch />
                    <input type="text" placeholder="Ürün adı, barkod veya SKU ara..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }} />
                </div>
                <select className="pm-select" value={filterMP}
                    onChange={e => { setFilterMP(e.target.value); setPage(0); }}>
                    <option value="">Tüm Pazaryerleri</option>
                    {marketplaces.map((mp, i) => <option key={i} value={mp.name}>{mp.name}</option>)}
                </select>
                <select className="pm-select" value={filterStock}
                    onChange={e => { setFilterStock(e.target.value); setPage(0); }}>
                    <option value="">Tüm Stok Durumları</option>
                    <option value="outOfStock">Stok Yok</option>
                    <option value="lowStock">Düşük Stok</option>
                </select>
                <span className="pm-total-label">{totalProducts} ürün</span>
                <button className="pm-btn pm-btn-primary pm-btn-sm" onClick={() => setActiveTab("new-product")}>
                    <FaPlus /> Yeni Ürün
                </button>
            </div>

            {/* Ürün grid */}
            {products.length === 0 ? (
                <div className="pm-empty-state">
                    <FaBox size={48} />
                    <p>Ürün bulunamadı.</p>
                    <button className="pm-btn pm-btn-primary" onClick={() => setActiveTab("new-product")}>
                        <FaPlus /> İlk Ürünü Ekle
                    </button>
                </div>
            ) : (
                <div className="pm-product-grid">
                    {products.map(product => {
                        const mp   = product.masterProduct || product;
                        const img  = safeImg(mp.images);
                        const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                        const price = mp.price ?? 0;
                        const mappings = product.marketplaceMappings || [];

                        return (
                            <div key={product._id} className="pm-product-card">
                                {/* Görsel */}
                                <div className="pm-product-img">
                                    {img
                                        ? <img src={img} alt={mp.name} onError={e => { e.target.style.display = "none"; }} />
                                        : <div className="pm-no-img"><FaBox /></div>
                                    }
                                    <div className="pm-product-img-badge">
                                        <StockBadge stock={stock} threshold={product.stockTracking?.lowStockThreshold || 10} />
                                    </div>
                                </div>

                                {/* Bilgi */}
                                <div className="pm-product-info">
                                    <h4 title={mp.name}>{mp.name}</h4>
                                    <p className="pm-product-meta">
                                        <FaBarcode /> {mp.barcode || "—"}
                                        &nbsp;·&nbsp;
                                        <FaTag /> {mp.sku || "—"}
                                    </p>
                                    <div className="pm-product-price-row">
                                        <span className="pm-price">₺{Number(price).toLocaleString("tr-TR")}</span>
                                        <span className="pm-stock">{stock} adet</span>
                                    </div>
                                    {mappings.length > 0 && (
                                        <div className="pm-mp-badges">
                                            {mappings.map((m, i) => (
                                                <span key={i} className="pm-mp-badge"
                                                    style={{ background: mpColor(m.marketplaceName) }}
                                                    title={`${m.marketplaceName} — ${m.syncStatus || "pending"}`}>
                                                    {m.marketplaceName}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Aksiyonlar */}
                                <div className="pm-product-actions">
                                    <button className="pm-btn pm-btn-sm pm-btn-blue" title="Stok Güncelle"
                                        onClick={() => { setEditModal({ product, type: "stock" }); setEditValue(String(stock)); setEditListPrice(""); }}>
                                        <FaWarehouse />
                                    </button>
                                    <button className="pm-btn pm-btn-sm pm-btn-green" title="Fiyat Güncelle"
                                        onClick={() => { setEditModal({ product, type: "price" }); setEditValue(String(price)); setEditListPrice(""); }}>
                                        <FaMoneyBillWave />
                                    </button>
                                    <button className="pm-btn pm-btn-sm pm-btn-orange" title="Pazaryerlerine Dağıt"
                                        onClick={() => { setDistModal({ product }); setDistTargets([]); }}>
                                        <FaUpload />
                                    </button>
                                    <button className="pm-btn pm-btn-sm pm-btn-danger" title="Ürünü Sil"
                                        onClick={() => setDeleteModal(product)}>
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Sayfalama */}
            {totalProducts > 20 && (
                <div className="pm-pagination">
                    <button className="pm-btn pm-btn-sm pm-btn-outline"
                        disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                        <FaArrowLeft /> Önceki
                    </button>
                    <span>Sayfa {page + 1} / {Math.ceil(totalProducts / 20)}</span>
                    <button className="pm-btn pm-btn-sm pm-btn-outline"
                        disabled={(page + 1) * 20 >= totalProducts} onClick={() => setPage(p => p + 1)}>
                        Sonraki <FaArrowRight />
                    </button>
                </div>
            )}
        </motion.div>
    );

    // ── 3. YENİ ÜRÜN (WIZARD) ────────────────────────────────────────────────
    const renderWizardStepContent = () => {
        switch (wizardStep) {
            case 1: return (
                <div className="pm-form-grid">
                    <div className="pm-form-group pm-full">
                        <label>Ürün Adı *</label>
                        <input className="pm-input" type="text" value={formData.name}
                            onChange={e => updateField("name", e.target.value)} placeholder="Ürün adını girin..." />
                    </div>
                    <div className="pm-form-group">
                        <label><FaBarcode /> Barkod *</label>
                        <input className="pm-input" type="text" value={formData.barcode}
                            onChange={e => updateField("barcode", e.target.value)} placeholder="EAN / GTIN barkod" />
                    </div>
                    <div className="pm-form-group">
                        <label>SKU / Stok Kodu *</label>
                        <input className="pm-input" type="text" value={formData.sku}
                            onChange={e => updateField("sku", e.target.value)} placeholder="Benzersiz stok kodu" />
                    </div>
                    <div className="pm-form-group">
                        <label>Marka</label>
                        <input className="pm-input" type="text" value={formData.brand}
                            onChange={e => updateField("brand", e.target.value)} placeholder="Marka adı" />
                    </div>
                    <div className="pm-form-group">
                        <label>Para Birimi</label>
                        <select className="pm-input" value={formData.currencyType}
                            onChange={e => updateField("currencyType", e.target.value)}>
                            <option value="TRY">TRY (₺)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                        </select>
                    </div>
                    <div className="pm-info-box pm-full">
                        <FaInfoCircle /> Barkod ve SKU tüm pazaryerlerinde ürünü eşleştirmek için kullanılır. Benzersiz olduğundan emin olun.
                    </div>
                </div>
            );

            case 2: return (
                <div className="pm-form-grid">
                    <div className="pm-form-group">
                        <label><FaDollarSign /> Satış Fiyatı *</label>
                        <input className="pm-input" type="number" min="0" step="0.01"
                            value={formData.price} onChange={e => updateField("price", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="pm-form-group">
                        <label>Liste Fiyatı (Üstü Çizili)</label>
                        <input className="pm-input" type="number" min="0" step="0.01"
                            value={formData.listPrice} onChange={e => updateField("listPrice", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="pm-form-group">
                        <label>📦 Stok Miktarı *</label>
                        <input className="pm-input" type="number" min="0"
                            value={formData.stock} onChange={e => updateField("stock", e.target.value)} placeholder="0" />
                    </div>
                    <div className="pm-form-group">
                        <label>KDV Oranı (%)</label>
                        <select className="pm-input" value={formData.vatRate}
                            onChange={e => updateField("vatRate", Number(e.target.value))}>
                            {[0, 1, 8, 10, 18, 20].map(v => <option key={v} value={v}>%{v}</option>)}
                        </select>
                    </div>
                    {formData.price && formData.listPrice && Number(formData.listPrice) > Number(formData.price) && (
                        <div className="pm-discount-badge pm-full">
                            🏷️ İndirim: %{((1 - Number(formData.price) / Number(formData.listPrice)) * 100).toFixed(1)}
                            &nbsp;·&nbsp; Tasarruf: {(Number(formData.listPrice) - Number(formData.price)).toFixed(2)} {formData.currencyType}
                        </div>
                    )}
                </div>
            );

            case 3: return (
                <div className="pm-form-grid">
                    <div className="pm-form-group pm-full">
                        <label>Ürün Açıklaması</label>
                        <textarea className="pm-input pm-textarea" rows={5}
                            value={formData.description}
                            onChange={e => updateField("description", e.target.value)}
                            placeholder="SEO dostu, detaylı ürün açıklaması..." />
                    </div>
                    <div className="pm-form-group pm-full">
                        <label><FaImage /> Ürün Görselleri (URL)</label>
                        {formData.images.map((img, idx) => (
                            <div key={idx} className="pm-image-row">
                                <input className="pm-input" type="text" value={img}
                                    onChange={e => updateImage(idx, e.target.value)}
                                    placeholder={`Görsel URL ${idx + 1} (https://...)`} />
                                {formData.images.length > 1 && (
                                    <button className="pm-btn pm-btn-sm pm-btn-danger" onClick={() => removeImage(idx)}>
                                        <FaTrash />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button className="pm-btn pm-btn-sm pm-btn-outline" style={{ marginTop: "0.5rem" }} onClick={addImage}>
                            <FaPlus /> Görsel Ekle
                        </button>
                    </div>
                    {formData.images.filter(i => i.trim()).length > 0 && (
                        <div className="pm-image-preview pm-full">
                            {formData.images.filter(i => i.trim()).map((img, idx) => (
                                <div key={idx} className="pm-preview-thumb">
                                    <img src={img} alt={`Görsel ${idx + 1}`}
                                        onError={e => { e.target.src = "https://via.placeholder.com/80?text=Hata"; }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );

            case 4: return (
                <div className="pm-form-grid">
                    <div className="pm-form-group pm-full">
                        <label><FaLayerGroup /> Ana Kategori</label>
                        <select className="pm-input" value={formData.category}
                            onChange={e => updateField("category", e.target.value)}>
                            <option value="">-- Kategori Seçin --</option>
                            {MASTER_CATEGORIES.map(g => (
                                <optgroup key={g.group} label={g.group}>
                                    {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                                </optgroup>
                            ))}
                        </select>
                        <small className="pm-hint-text">💡 Bu kategori tüm pazaryerleri için temel kategoridir. Sonraki adımda her pazaryeri için özel kategori belirleyebilirsiniz.</small>
                    </div>
                    <div className="pm-form-group">
                        <label>Renk</label>
                        <input className="pm-input" type="text" value={formData.color}
                            onChange={e => updateField("color", e.target.value)} placeholder="Siyah, Beyaz, Kırmızı..." />
                    </div>
                    <div className="pm-form-group">
                        <label>Beden / Boyut</label>
                        <input className="pm-input" type="text" value={formData.size}
                            onChange={e => updateField("size", e.target.value)} placeholder="S, M, L, XL, 38, 40..." />
                    </div>
                    <div className="pm-form-group">
                        <label>Ağırlık (gram)</label>
                        <input className="pm-input" type="number" min="0" value={formData.weight}
                            onChange={e => updateField("weight", e.target.value)} placeholder="0" />
                    </div>
                </div>
            );

            case 5: return (
                <div className="pm-marketplace-selection">
                    <div className="pm-info-box" style={{ marginBottom: "1.25rem" }}>
                        <strong>📋 Pazaryeri Seçimi</strong><br />
                        Ürünün yükleneceği pazaryerlerini seçin. Her pazaryeri için özel kategori ID girebilirsiniz.
                    </div>
                    {marketplaces.length === 0 ? (
                        <div className="pm-empty-state">
                            <FaStore size={36} />
                            <p>Henüz pazaryeri entegrasyonu eklenmemiş.</p>
                        </div>
                    ) : (
                        <div className="pm-mp-select-grid">
                            {marketplaces.map(mp => {
                                const mpName   = mp.marketplaceName || mp.name;
                                const isSel    = formData.selectedMarketplaces.includes(mpName);
                                const override = formData.marketplaceCategoryOverrides[mpName] || {};
                                return (
                                    <div key={mp._id || mpName} className={`pm-mp-select-card ${isSel ? "selected" : ""}`}>
                                        <div className="pm-mp-select-header" onClick={() => toggleWizardMP(mpName)}>
                                            <div className="pm-mp-select-info">
                                                <span className="pm-mp-dot" style={{ background: mpColor(mpName) }} />
                                                <strong>{mpName}</strong>
                                                {isSel && <span className="pm-badge pm-badge-success" style={{ marginLeft: "0.5rem" }}>✓ Seçildi</span>}
                                            </div>
                                            <div className={`pm-mp-checkbox ${isSel ? "checked" : ""}`}>
                                                {isSel && <FaCheck />}
                                            </div>
                                        </div>
                                        {isSel && (
                                            <motion.div className="pm-mp-select-body"
                                                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                                onClick={e => e.stopPropagation()}>
                                                <label>{mpName} Kategori Adı</label>
                                                <input className="pm-input pm-input-sm" type="text"
                                                    placeholder="Kategori adı (opsiyonel)"
                                                    value={override.categoryName || ""}
                                                    onChange={e => updateMPCategory(mpName, "categoryName", e.target.value)} />
                                                <label style={{ marginTop: "0.5rem" }}>{mpName} Kategori ID</label>
                                                <input className="pm-input pm-input-sm" type="text"
                                                    placeholder="Kategori ID (opsiyonel)"
                                                    value={override.categoryId || ""}
                                                    onChange={e => updateMPCategory(mpName, "categoryId", e.target.value)} />
                                                {formData.category && !override.categoryName && (
                                                    <button className="pm-btn pm-btn-sm pm-btn-outline" style={{ marginTop: "0.5rem" }}
                                                        onClick={() => updateMPCategory(mpName, "categoryName", formData.category)}>
                                                        Ana kategoriyi kullan: "{formData.category}"
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {formData.selectedMarketplaces.length > 0 && (
                        <div className="pm-selected-summary">
                            ✅ <strong>{formData.selectedMarketplaces.length}</strong> pazaryeri seçildi:&nbsp;
                            {formData.selectedMarketplaces.join(" · ")}
                        </div>
                    )}
                </div>
            );

            case 6: return (
                <div className="pm-review">
                    <h3 className="pm-review-title">📋 Ürün Özeti — Son Kontrol</h3>
                    <div className="pm-review-grid">
                        <div className="pm-review-section">
                            <h4>Temel Bilgiler</h4>
                            <div className="pm-review-row"><span>Ürün Adı</span><strong>{formData.name}</strong></div>
                            <div className="pm-review-row"><span>Barkod</span><strong>{formData.barcode}</strong></div>
                            <div className="pm-review-row"><span>SKU</span><strong>{formData.sku}</strong></div>
                            <div className="pm-review-row"><span>Marka</span><strong>{formData.brand || "—"}</strong></div>
                        </div>
                        <div className="pm-review-section">
                            <h4>Fiyat & Stok</h4>
                            <div className="pm-review-row"><span>Satış Fiyatı</span><strong>{formData.price} {formData.currencyType}</strong></div>
                            <div className="pm-review-row"><span>Liste Fiyatı</span><strong>{formData.listPrice || formData.price} {formData.currencyType}</strong></div>
                            <div className="pm-review-row"><span>Stok</span><strong>{formData.stock} adet</strong></div>
                            <div className="pm-review-row"><span>KDV</span><strong>%{formData.vatRate}</strong></div>
                        </div>
                        <div className="pm-review-section">
                            <h4>Kategori & Özellikler</h4>
                            <div className="pm-review-row"><span>Kategori</span><strong>{formData.category || "—"}</strong></div>
                            <div className="pm-review-row"><span>Renk</span><strong>{formData.color || "—"}</strong></div>
                            <div className="pm-review-row"><span>Beden</span><strong>{formData.size || "—"}</strong></div>
                            <div className="pm-review-row"><span>Ağırlık</span><strong>{formData.weight ? `${formData.weight} gr` : "—"}</strong></div>
                        </div>
                        <div className="pm-review-section">
                            <h4>Pazaryeri Dağıtımı</h4>
                            {formData.selectedMarketplaces.length === 0
                                ? <p style={{ color: "#f85149" }}>⚠️ Pazaryeri seçilmedi</p>
                                : formData.selectedMarketplaces.map(mp => {
                                    const ov = formData.marketplaceCategoryOverrides[mp] || {};
                                    return (
                                        <div key={mp} className="pm-review-mp-row">
                                            <span className="pm-mp-dot" style={{ background: mpColor(mp) }} />
                                            <div>
                                                <strong>{mp}</strong>
                                                <small>{ov.categoryName || formData.category || "—"}{ov.categoryId ? ` (ID: ${ov.categoryId})` : ""}</small>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                    {formData.images.filter(i => i.trim()).length > 0 && (
                        <div className="pm-review-section" style={{ marginTop: "1rem" }}>
                            <h4>Görseller ({formData.images.filter(i => i.trim()).length} adet)</h4>
                            <div className="pm-image-preview">
                                {formData.images.filter(i => i.trim()).map((img, idx) => (
                                    <div key={idx} className="pm-preview-thumb">
                                        <img src={img} alt={`Görsel ${idx + 1}`}
                                            onError={e => { e.target.src = "https://via.placeholder.com/80?text=Hata"; }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );

            default: return null;
        }
    };

    const renderNewProduct = () => {
        if (wizardSuccess) return (
            <motion.div key="success" className="pm-tab-content"
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="pm-success-card">
                    <div className="pm-success-icon">✅</div>
                    <h2>Ürün Başarıyla Oluşturuldu!</h2>
                    <p><strong>{formData.name}</strong> sisteme eklendi ve seçili pazaryerlerine dağıtım kuyruğuna alındı.</p>
                    <div className="pm-success-details">
                        <span>📦 Barkod: {formData.barcode}</span>
                        <span>💰 Fiyat: {formData.price} {formData.currencyType}</span>
                        <span>📊 Stok: {formData.stock} adet</span>
                        <span>🏪 Pazaryeri: {formData.selectedMarketplaces.join(", ")}</span>
                    </div>
                    <div className="pm-success-actions">
                        <button className="pm-btn pm-btn-primary" onClick={resetWizard}><FaPlus /> Yeni Ürün Ekle</button>
                        <button className="pm-btn pm-btn-secondary" onClick={() => setActiveTab("products")}><FaBox /> Ürünlere Git</button>
                    </div>
                </div>
            </motion.div>
        );

        return (
            <motion.div key="wizard" className="pm-tab-content"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* Stepper */}
                <div className="pm-stepper">
                    {WIZARD_STEPS.map((step, idx) => (
                        <div key={step.id} className={`pm-step ${wizardStep === step.id ? "active" : ""} ${wizardStep > step.id ? "completed" : ""}`}>
                            <div className="pm-step-circle"
                                onClick={() => { if (step.id < wizardStep) setWizardStep(step.id); }}>
                                {wizardStep > step.id ? <FaCheck /> : step.id}
                            </div>
                            <span className="pm-step-label">{step.title}</span>
                            {idx < WIZARD_STEPS.length - 1 && <div className="pm-step-line" />}
                        </div>
                    ))}
                </div>

                {/* Step içeriği */}
                <div className="pm-wizard-card">
                    <div className="pm-wizard-card-header">
                        <span className="pm-wizard-icon">{WIZARD_STEPS[wizardStep - 1].icon}</span>
                        <div>
                            <h2>{WIZARD_STEPS[wizardStep - 1].title}</h2>
                            <p>{WIZARD_STEPS[wizardStep - 1].desc}</p>
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div key={wizardStep}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                            {renderWizardStepContent()}
                        </motion.div>
                    </AnimatePresence>

                    {/* Hata */}
                    {wizardError && (
                        <motion.div className="pm-error-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                            <FaTimes /> {wizardError}
                        </motion.div>
                    )}

                    {/* Navigasyon */}
                    <div className="pm-wizard-nav">
                        {wizardStep > 1 && (
                            <button className="pm-btn pm-btn-outline" onClick={prevWizardStep}>
                                <FaArrowLeft /> Geri
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        {wizardStep < WIZARD_STEPS.length ? (
                            <button className="pm-btn pm-btn-primary" onClick={nextWizardStep}>
                                İleri <FaArrowRight />
                            </button>
                        ) : (
                            <button className="pm-btn pm-btn-success" onClick={handleWizardSubmit} disabled={loading}>
                                {loading ? <><FaSpinner className="pm-spin" /> Kaydediliyor...</> : <><FaSave /> Ürünü Kaydet & Dağıt</>}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    // ── 4. DAĞITIM ────────────────────────────────────────────────────────────
    const renderDistribution = () => (
        <motion.div key="distribution" className="pm-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Pazaryerinden Çek */}
            <div className="pm-section">
                <h2><FaDownload /> Pazaryerinden Ürün Çek</h2>
                <p className="pm-section-desc">Seçili pazaryerlerindeki ürünleri sisteme aktarın ve senkronize edin.</p>
                {marketplaces.length === 0 ? (
                    <div className="pm-empty-state"><FaStore size={36} /><p>Pazaryeri entegrasyonu bulunamadı.</p></div>
                ) : (
                    <div className="pm-dist-mp-list">
                        {marketplaces.map((mp, i) => (
                            <div key={i} className="pm-dist-mp-row" style={{ borderLeft: `4px solid ${mpColor(mp.name)}` }}>
                                <div className="pm-dist-mp-info">
                                    <FaStore style={{ color: mpColor(mp.name) }} />
                                    <strong>{mp.name}</strong>
                                </div>
                                <div className="pm-dist-mp-actions">
                                    <button className="pm-btn pm-btn-sm pm-btn-outline"
                                        onClick={() => handleSyncFromMP(mp)} disabled={loading}>
                                        <FaSync /> Senkronize Et
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Toplu Dağıtım */}
            <div className="pm-section">
                <h2><FaUpload /> Toplu Ürün Dağıtımı</h2>
                <p className="pm-section-desc">Bir pazaryerindeki tüm ürünleri diğer pazaryerlerine dağıtın.</p>
                <div className="pm-bulk-form">
                    <div className="pm-form-group">
                        <label>Kaynak Pazaryeri</label>
                        <select className="pm-input" value={bulkSrc} onChange={e => setBulkSrc(e.target.value)}>
                            <option value="">-- Kaynak Seçin --</option>
                            {marketplaces.map((mp, i) => <option key={i} value={mp.name}>{mp.name}</option>)}
                        </select>
                    </div>
                    <div className="pm-form-group">
                        <label>Hedef Pazaryerleri</label>
                        <div className="pm-checkbox-group">
                            {marketplaces.filter(mp => mp.name !== bulkSrc).map((mp, i) => (
                                <label key={i} className="pm-checkbox-label">
                                    <input type="checkbox"
                                        checked={bulkTargets.includes(mp.name)}
                                        onChange={() => setBulkTargets(prev =>
                                            prev.includes(mp.name) ? prev.filter(x => x !== mp.name) : [...prev, mp.name]
                                        )} />
                                    <span className="pm-mp-dot" style={{ background: mpColor(mp.name) }} />
                                    {mp.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <button className="pm-btn pm-btn-primary"
                        onClick={handleBulkDistribute}
                        disabled={loading || !bulkSrc || bulkTargets.length === 0}>
                        {loading ? <FaSpinner className="pm-spin" /> : <FaUpload />}
                        Toplu Dağıt
                    </button>
                </div>
            </div>

            {/* Otomatik Senkronizasyon */}
            <div className="pm-section">
                <h2><FaBolt /> Otomatik Senkronizasyon</h2>
                <p className="pm-section-desc">Tüm ürünlerin stok ve fiyat bilgilerini tüm pazaryerlerinde otomatik olarak günceller.</p>
                <button className="pm-btn pm-btn-primary" onClick={handleAutoSync} disabled={loading}>
                    {loading ? <FaSpinner className="pm-spin" /> : <FaSync />} Otomatik Senkronize Et
                </button>
            </div>
        </motion.div>
    );

    // ── 5. LOGLAR ─────────────────────────────────────────────────────────────
    const renderLogs = () => (
        <motion.div key="logs" className="pm-tab-content"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Bildirimler */}
            {notifications.length > 0 && (
                <div className="pm-section">
                    <div className="pm-section-header">
                        <h2><FaBell /> Okunmamış Bildirimler ({unreadCount})</h2>
                        <button className="pm-btn pm-btn-sm pm-btn-outline" onClick={handleMarkAllRead}>
                            <FaCheckCircle /> Tümünü Okundu İşaretle
                        </button>
                    </div>
                    <div className="pm-notif-list">
                        {notifications.map((n, i) => (
                            <div key={i} className={`pm-notif-row pm-notif-${n.notification?.priority || "low"}`}>
                                <div className="pm-notif-info">
                                    <span className="pm-notif-action">{n.actionType}</span>
                                    <span className="pm-notif-name">{n.product?.name || n.product?.barcode || "—"}</span>
                                    <span className="pm-notif-time">{new Date(n.timestamp).toLocaleString("tr-TR")}</span>
                                </div>
                                <button className="pm-btn pm-btn-sm pm-btn-outline"
                                    onClick={() => handleMarkRead(n._id)}>
                                    <FaCheck /> Okundu
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* İşlem Logları */}
            <div className="pm-section">
                <h2><FaListAlt /> İşlem Logları</h2>
                {logs.length === 0 ? (
                    <div className="pm-empty-state"><FaListAlt size={36} /><p>Henüz işlem logu yok.</p></div>
                ) : (
                    <div className="pm-logs-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>İşlem</th>
                                    <th>Ürün</th>
                                    <th>Değişiklik</th>
                                    <th>Durum</th>
                                    <th>Tarih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={i}>
                                        <td><span className="pm-log-action-badge">{log.actionType}</span></td>
                                        <td>
                                            <div>{log.product?.name || "—"}</div>
                                            <small className="pm-text-muted">{log.product?.barcode}</small>
                                        </td>
                                        <td>
                                            {log.changes?.field && (
                                                <span className="pm-text-muted">
                                                    {log.changes.field}: {log.changes.oldValue} → {log.changes.newValue}
                                                </span>
                                            )}
                                        </td>
                                        <td><SyncBadge status={log.status} /></td>
                                        <td className="pm-text-muted">{new Date(log.timestamp).toLocaleString("tr-TR")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </motion.div>
    );

    // ════════════════════════════════════════════════════════════════════════════
    // MODALLER
    // ════════════════════════════════════════════════════════════════════════════

    const renderEditModal = () => {
        if (!editModal) return null;
        const isStock = editModal.type === "stock";
        const mp = editModal.product.masterProduct || editModal.product;
        return (
            <div className="pm-modal-overlay" onClick={() => setEditModal(null)}>
                <motion.div className="pm-modal" onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="pm-modal-header">
                        <h3>{isStock ? <><FaWarehouse /> Stok Güncelle</> : <><FaMoneyBillWave /> Fiyat Güncelle</>}</h3>
                        <button onClick={() => setEditModal(null)}><FaTimes /></button>
                    </div>
                    <div className="pm-modal-body">
                        <p><strong>{mp.name}</strong></p>
                        <p className="pm-text-muted">Barkod: {mp.barcode} · SKU: {mp.sku}</p>
                        <div className="pm-form-group" style={{ marginTop: "1rem" }}>
                            <label>{isStock ? "Yeni Stok Miktarı" : "Yeni Satış Fiyatı (₺)"}</label>
                            <input className="pm-input" type="number" min={isStock ? "0" : "0.01"} step={isStock ? "1" : "0.01"}
                                value={editValue} onChange={e => setEditValue(e.target.value)}
                                placeholder={isStock ? "0" : "0.00"} autoFocus />
                        </div>
                        <div className="pm-form-group">
                            <label>{isStock ? "Fiyat Güncelle (opsiyonel, ₺)" : "Liste Fiyatı (opsiyonel, ₺)"}</label>
                            <input className="pm-input" type="number" min="0" step="0.01"
                                value={editListPrice} onChange={e => setEditListPrice(e.target.value)}
                                placeholder="Boş bırakılabilir" />
                        </div>
                        <div className="pm-info-box">
                            <FaInfoCircle /> Güncelleme tüm bağlı pazaryerlerine otomatik olarak yansıtılacaktır.
                        </div>
                    </div>
                    <div className="pm-modal-footer">
                        <button className="pm-btn pm-btn-outline" onClick={() => setEditModal(null)}>İptal</button>
                        <button className="pm-btn pm-btn-primary" disabled={loading}
                            onClick={isStock ? handleSyncStock : handleSyncPrice}>
                            {loading ? <FaSpinner className="pm-spin" /> : <FaSave />} Güncelle & Senkronize Et
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    const renderDistModal = () => {
        if (!distModal) return null;
        const mp = distModal.product.masterProduct || distModal.product;
        const existingMPs = (distModal.product.marketplaceMappings || []).map(m => m.marketplaceName);
        const available = marketplaces.filter(m => !existingMPs.includes(m.name));
        return (
            <div className="pm-modal-overlay" onClick={() => setDistModal(null)}>
                <motion.div className="pm-modal" onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="pm-modal-header">
                        <h3><FaUpload /> Pazaryerlerine Dağıt</h3>
                        <button onClick={() => setDistModal(null)}><FaTimes /></button>
                    </div>
                    <div className="pm-modal-body">
                        <p><strong>{mp.name}</strong></p>
                        {existingMPs.length > 0 && (
                            <p className="pm-text-muted">Mevcut: {existingMPs.join(", ")}</p>
                        )}
                        {available.length === 0 ? (
                            <div className="pm-info-box" style={{ marginTop: "1rem" }}>
                                ✅ Bu ürün tüm pazaryerlerinde zaten mevcut.
                            </div>
                        ) : (
                            <div className="pm-checkbox-group" style={{ marginTop: "1rem" }}>
                                {available.map((m, i) => (
                                    <label key={i} className="pm-checkbox-label">
                                        <input type="checkbox"
                                            checked={distTargets.includes(m.name)}
                                            onChange={() => setDistTargets(prev =>
                                                prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name]
                                            )} />
                                        <span className="pm-mp-dot" style={{ background: mpColor(m.name) }} />
                                        {m.name}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="pm-modal-footer">
                        <button className="pm-btn pm-btn-outline" onClick={() => setDistModal(null)}>İptal</button>
                        {available.length > 0 && (
                            <button className="pm-btn pm-btn-primary" disabled={loading || distTargets.length === 0}
                                onClick={handleDistribute}>
                                {loading ? <FaSpinner className="pm-spin" /> : <FaUpload />} Dağıt
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    };

    const renderDeleteModal = () => {
        if (!deleteModal) return null;
        const mp = deleteModal.masterProduct || deleteModal;
        return (
            <div className="pm-modal-overlay" onClick={() => setDeleteModal(null)}>
                <motion.div className="pm-modal" onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="pm-modal-header">
                        <h3><FaTrash /> Ürünü Sil</h3>
                        <button onClick={() => setDeleteModal(null)}><FaTimes /></button>
                    </div>
                    <div className="pm-modal-body">
                        <p><strong>{mp.name}</strong> ürününü silmek istediğinizden emin misiniz?</p>
                        <p className="pm-text-muted">Barkod: {mp.barcode}</p>
                        <div className="pm-info-box pm-info-danger" style={{ marginTop: "1rem" }}>
                            <FaExclamationTriangle /> Bu işlem geri alınamaz. Ürün tüm pazaryeri eşleştirmeleriyle birlikte silinecektir.
                        </div>
                    </div>
                    <div className="pm-modal-footer">
                        <button className="pm-btn pm-btn-outline" onClick={() => setDeleteModal(null)}>İptal</button>
                        <button className="pm-btn pm-btn-danger" disabled={loading} onClick={handleDelete}>
                            {loading ? <FaSpinner className="pm-spin" /> : <FaTrash />} Evet, Sil
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    };

    // ════════════════════════════════════════════════════════════════════════════
    // ANA RENDER
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <div className="pm-container">

            {/* ── Header ── */}
            <div className="pm-header">
                <div className="pm-header-left">
                    <h1><FaBoxOpen /> Ürün Yönetimi</h1>
                    <p>Tüm pazaryerlerinizi tek panelden yönetin</p>
                </div>
                <div className="pm-header-right">
                    <button className="pm-btn pm-btn-secondary" onClick={handleAutoSync} disabled={loading}>
                        {loading ? <FaSpinner className="pm-spin" /> : <FaSync />} Otomatik Sync
                    </button>
                    <button className="pm-notif-btn" onClick={() => setActiveTab("logs")}>
                        <FaBell />
                        {unreadCount > 0 && <span className="pm-notif-count">{unreadCount}</span>}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="pm-tabs">
                {TABS.map(tab => (
                    <button key={tab.key}
                        className={`pm-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}>
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.key === "logs" && unreadCount > 0 && (
                            <span className="pm-tab-badge">{unreadCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── İçerik ── */}
            <div className="pm-content">
                <AnimatePresence mode="wait">
                    {activeTab === "dashboard"    && renderDashboard()}
                    {activeTab === "products"     && renderProducts()}
                    {activeTab === "new-product"  && renderNewProduct()}
                    {activeTab === "distribution" && renderDistribution()}
                    {activeTab === "logs"         && renderLogs()}
                </AnimatePresence>
            </div>

            {/* ── Modaller ── */}
            <AnimatePresence>
                {editModal   && renderEditModal()}
                {distModal   && renderDistModal()}
                {deleteModal && renderDeleteModal()}
            </AnimatePresence>

            {/* ── Toast ── */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`pm-toast pm-toast-${toast.type}`}
                        initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60 }}>
                        {toast.type === "success" && <FaCheckCircle />}
                        {toast.type === "error"   && <FaTimesCircle />}
                        {toast.type === "warning" && <FaExclamationTriangle />}
                        {toast.type === "info"    && <FaInfoCircle />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductManagementPage;
