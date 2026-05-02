import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaFileExcel, FaDownload, FaUpload, FaSearch,
    FaPlus, FaEdit, FaTrash, FaSync, FaRocket, FaChartBar,
    FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaEye,
    FaFilter, FaTimes, FaSave, FaCloudUploadAlt, FaTable,
    FaLayerGroup, FaExchangeAlt, FaStore, FaTag, FaWarehouse,
    FaChevronDown, FaChevronUp, FaSpinner, FaInfoCircle,
    FaCheck, FaMinus, FaArrowRight, FaFileImport, FaFileExport,
    FaBell, FaHistory, FaCog, FaShoppingCart
} from "react-icons/fa";
import {
    getProducts, createProduct, updateProduct, deleteProduct,
    syncFromMarketplace, distributeProduct, bulkDistributeSelected,
    syncAllMarketplaces, getComparisonMatrix, getProductManagementDashboard,
    getSyncLogs, downloadTemplate, previewImport, executeImport, exportProducts
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/UnifiedProductManagement.css";

// ─── Yardımcı ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("tr-TR").format(n || 0);
const MP_COLORS = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#6f3695", Amazon: "#ff9900", ÇiçekSepeti: "#e91e8c" };
const MP_COLOR = (name) => MP_COLORS[name] || "#4ecdc4";

const Toast = ({ toasts, remove }) => (
    <div className="upm-toast-container">
        <AnimatePresence>
            {toasts.map(t => (
                <motion.div key={t.id} className={`upm-toast upm-toast-${t.type}`}
                    initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}>
                    <span className="upm-toast-icon">
                        {t.type === "success" ? <FaCheckCircle /> : t.type === "error" ? <FaTimesCircle /> : <FaInfoCircle />}
                    </span>
                    <span className="upm-toast-msg">{t.message}</span>
                    <button className="upm-toast-close" onClick={() => remove(t.id)}><FaTimes /></button>
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
);

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
const UnifiedProductManagement = () => {
    const userId = localStorage.getItem("userId");

    // Sekme
    const [activeTab, setActiveTab] = useState("catalog");

    // Toast
    const [toasts, setToasts] = useState([]);
    const toastId = useRef(0);
    const addToast = useCallback((message, type = "info") => {
        const id = ++toastId.current;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

    // Pazaryerleri
    const [marketplaces, setMarketplaces] = useState([]);

    useEffect(() => {
        if (!userId) return;
        getUserMarketplaces()
            .then(data => setMarketplaces(data.map(m => ({ ...m, name: m.marketplaceName }))))
            .catch(() => {});
    }, [userId]);

    const tabs = [
        { id: "catalog",    label: "Ürün Kataloğu",       icon: <FaBoxOpen /> },
        { id: "import",     label: "Excel İçe/Dışa Aktar", icon: <FaFileExcel /> },
        { id: "comparison", label: "Pazaryeri Karşılaştır", icon: <FaLayerGroup /> },
        { id: "distribute", label: "Ürün Dağıtımı",        icon: <FaRocket /> },
        { id: "logs",       label: "Senkron Logları",       icon: <FaHistory /> },
    ];

    return (
        <div className="upm-root">
            <Toast toasts={toasts} remove={removeToast} />

            {/* Header */}
            <div className="upm-header">
                <div className="upm-header-left">
                    <div className="upm-header-icon"><FaStore /></div>
                    <div>
                        <h1 className="upm-header-title">Ürün Yönetimi</h1>
                        <p className="upm-header-sub">Katalog · Excel Import · Pazaryeri Dağıtımı · Stok Takibi</p>
                    </div>
                </div>
                <div className="upm-header-badges">
                    {marketplaces.map(mp => (
                        <span key={mp._id} className="upm-mp-badge" style={{ borderColor: MP_COLOR(mp.name) }}>
                            <span className="upm-mp-dot" style={{ background: MP_COLOR(mp.name) }} />
                            {mp.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* Sekmeler */}
            <div className="upm-tabs">
                {tabs.map(t => (
                    <button key={t.id} className={`upm-tab${activeTab === t.id ? " active" : ""}`}
                        onClick={() => setActiveTab(t.id)}>
                        <span className="upm-tab-icon">{t.icon}</span>
                        <span className="upm-tab-label">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* İçerik */}
            <div className="upm-content">
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                        {activeTab === "catalog"    && <CatalogTab    marketplaces={marketplaces} addToast={addToast} />}
                        {activeTab === "import"     && <ImportTab     marketplaces={marketplaces} addToast={addToast} />}
                        {activeTab === "comparison" && <ComparisonTab marketplaces={marketplaces} addToast={addToast} />}
                        {activeTab === "distribute" && <DistributeTab marketplaces={marketplaces} addToast={addToast} />}
                        {activeTab === "logs"       && <LogsTab       addToast={addToast} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 SEKME 1 — ÜRÜN KATALOĞU
// ═══════════════════════════════════════════════════════════════════════════════
const CatalogTab = ({ marketplaces, addToast }) => {
    const [products, setProducts]     = useState([]);
    const [total, setTotal]           = useState(0);
    const [loading, setLoading]       = useState(false);
    const [page, setPage]             = useState(0);
    const [search, setSearch]         = useState("");
    const [stockFilter, setStockFilter] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showForm, setShowForm]     = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [showDetail, setShowDetail] = useState(null);
    const LIMIT = 20;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: LIMIT };
            if (search)      params.search      = search;
            if (stockFilter) params.stockStatus = stockFilter;
            const data = await getProducts(params);
            setProducts(data.products || []);
            setTotal(data.total || 0);
        } catch { addToast("Ürünler yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [page, search, stockFilter, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" silinsin mi?`)) return;
        try {
            await deleteProduct(id);
            addToast("Ürün silindi", "success");
            load();
        } catch { addToast("Silme başarısız", "error"); }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === products.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(products.map(p => p._id)));
    };

    const stockBadge = (p) => {
        const st = p.stockTracking || {};
        if (st.isOutOfStock) return <span className="upm-badge badge-danger">Stok Yok</span>;
        if (st.isLowStock)   return <span className="upm-badge badge-warn">Düşük Stok</span>;
        return <span className="upm-badge badge-ok">Normal</span>;
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="upm-catalog">
            {/* Toolbar */}
            <div className="upm-toolbar">
                <div className="upm-toolbar-left">
                    <div className="upm-search-box">
                        <FaSearch className="upm-search-icon" />
                        <input className="upm-search-input" placeholder="Ürün adı, barkod, SKU..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
                        {search && <button className="upm-search-clear" onClick={() => setSearch("")}><FaTimes /></button>}
                    </div>
                    <select className="upm-select" value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(0); }}>
                        <option value="">Tüm Stok</option>
                        <option value="outOfStock">Stok Yok</option>
                        <option value="lowStock">Düşük Stok</option>
                    </select>
                </div>
                <div className="upm-toolbar-right">
                    {selectedIds.size > 0 && (
                        <span className="upm-selected-info">{selectedIds.size} seçili</span>
                    )}
                    <button className="upm-btn upm-btn-ghost" onClick={load} disabled={loading}>
                        <FaSync className={loading ? "spin" : ""} /> Yenile
                    </button>
                    <button className="upm-btn upm-btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>
                        <FaPlus /> Yeni Ürün
                    </button>
                </div>
            </div>

            {/* Tablo */}
            <div className="upm-table-wrap">
                {loading ? (
                    <div className="upm-loading"><FaSpinner className="spin" /> Yükleniyor...</div>
                ) : products.length === 0 ? (
                    <div className="upm-empty">
                        <FaBoxOpen className="upm-empty-icon" />
                        <p>Ürün bulunamadı</p>
                        <button className="upm-btn upm-btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>
                            <FaPlus /> İlk Ürünü Ekle
                        </button>
                    </div>
                ) : (
                    <table className="upm-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" checked={selectedIds.size === products.length && products.length > 0}
                                    onChange={toggleAll} /></th>
                                <th>Ürün</th>
                                <th>Barkod / SKU</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                <th>Pazaryerleri</th>
                                <th>Durum</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const mappings = p.marketplaceMappings || [];
                                return (
                                    <tr key={p._id} className={selectedIds.has(p._id) ? "selected" : ""}>
                                        <td><input type="checkbox" checked={selectedIds.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                                        <td>
                                            <div className="upm-product-cell">
                                                {mp.images?.[0]
                                                    ? <img src={mp.images[0]} alt={mp.name} className="upm-product-thumb" onError={e => e.target.style.display = "none"} />
                                                    : <div className="upm-product-thumb-placeholder"><FaBoxOpen /></div>
                                                }
                                                <div>
                                                    <div className="upm-product-name">{mp.name || "—"}</div>
                                                    <div className="upm-product-cat">{mp.category || mp.brand || "—"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="upm-mono">{mp.barcode || "—"}</div>
                                            <div className="upm-mono upm-dim">{mp.sku || "—"}</div>
                                        </td>
                                        <td>
                                            <div className="upm-price">{fmt(mp.price)}</div>
                                            {mp.listPrice > mp.price && <div className="upm-list-price">{fmt(mp.listPrice)}</div>}
                                        </td>
                                        <td>
                                            <div className="upm-stock-num">{fmtNum(st.totalStock ?? mp.stock ?? 0)}</div>
                                        </td>
                                        <td>
                                            <div className="upm-mp-dots">
                                                {mappings.length === 0
                                                    ? <span className="upm-dim">Yok</span>
                                                    : mappings.map(m => (
                                                        <span key={m.marketplaceName} className="upm-mp-chip"
                                                            style={{ background: MP_COLOR(m.marketplaceName) + "22", color: MP_COLOR(m.marketplaceName), borderColor: MP_COLOR(m.marketplaceName) + "55" }}>
                                                            {m.marketplaceName}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                        </td>
                                        <td>{stockBadge(p)}</td>
                                        <td>
                                            <div className="upm-actions">
                                                <button className="upm-icon-btn" title="Detay" onClick={() => setShowDetail(p)}><FaEye /></button>
                                                <button className="upm-icon-btn" title="Düzenle" onClick={() => { setEditProduct(p); setShowForm(true); }}><FaEdit /></button>
                                                <button className="upm-icon-btn danger" title="Sil" onClick={() => handleDelete(p._id, mp.name)}><FaTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
                <div className="upm-pagination">
                    <button className="upm-btn upm-btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ ÖÖnceki</button>
                    <span className="upm-page-info">{page + 1} / {totalPages} ({fmtNum(total)} ürün)</span>
                    <button className="upm-btn upm-btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki ›</button>
                </div>
            )}

            {/* Ürün Formu Modal */}
            <AnimatePresence>
                {showForm && (
                    <ProductFormModal
                        product={editProduct}
                        onClose={() => setShowForm(false)}
                        onSaved={() => { setShowForm(false); load(); addToast(editProduct ? "Ürün güncellendi" : "Ürün oluşturuldu", "success"); }}
                        addToast={addToast}
                    />
                )}
            </AnimatePresence>

            {/* Detay Modal */}
            <AnimatePresence>
                {showDetail && (
                    <ProductDetailModal product={showDetail} onClose={() => setShowDetail(null)} />
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Ürün Form Modal ─────────────────────────────────────────────────────────
const ProductFormModal = ({ product, onClose, onSaved, addToast }) => {
    const isEdit = !!product;
    const mp = product?.masterProduct || {};
    const [form, setForm] = useState({
        name:        mp.name        || "",
        barcode:     mp.barcode     || "",
        sku:         mp.sku         || "",
        description: mp.description || "",
        category:    mp.category    || "",
        brand:       mp.brand       || "",
        price:       mp.price       || "",
        listPrice:   mp.listPrice   || "",
        stock:       mp.stock       ?? (product?.stockTracking?.totalStock ?? ""),
        color:       mp.attributes?.color || "",
        size:        mp.attributes?.size  || "",
        images:      (mp.images || []).join("\n"),
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const validate = () => {
        const e = {};
        if (!form.name.trim())    e.name    = "Ürün adı zorunlu";
        if (!form.barcode.trim()) e.barcode = "Barkod zorunlu";
        if (!form.sku.trim())     e.sku     = "SKU zorunlu";
        if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price = "Geçerli fiyat girin";
        if (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0) e.stock = "Geçerli stok girin";
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setSaving(true);
        try {
            const payload = {
                name:        form.name.trim(),
                barcode:     form.barcode.trim(),
                sku:         form.sku.trim(),
                description: form.description.trim(),
                category:    form.category.trim(),
                brand:       form.brand.trim(),
                price:       Number(form.price),
                listPrice:   form.listPrice ? Number(form.listPrice) : Number(form.price),
                stock:       Number(form.stock),
                attributes:  { color: form.color, size: form.size },
                images:      form.images.split("\n").map(s => s.trim()).filter(Boolean),
            };
            if (isEdit) await updateProduct(product._id, payload);
            else        await createProduct(payload);
            onSaved();
        } catch (err) {
            addToast(err?.response?.data?.error || "Kaydetme başarısız", "error");
        } finally { setSaving(false); }
    };

    const field = (label, key, type = "text", required = false) => (
        <div className="upm-form-field">
            <label className="upm-form-label">{label}{required && <span className="upm-required">*</span>}</label>
            <input className={`upm-form-input${errors[key] ? " error" : ""}`} type={type}
                value={form[key]} onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: "" })); }} />
            {errors[key] && <span className="upm-form-error">{errors[key]}</span>}
        </div>
    );

    return (
        <motion.div className="upm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="upm-modal upm-modal-lg" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="upm-modal-header">
                    <h2>{isEdit ? "Ürün Düzenle" : "Yeni Ürün Ekle"}</h2>
                    <button className="upm-modal-close" onClick={onClose}><FaTimes /></button>
                </div>
                <div className="upm-modal-body">
                    <div className="upm-form-grid">
                        {field("Ürün Adı", "name", "text", true)}
                        {field("Barkod (EAN/GTIN)", "barcode", "text", true)}
                        {field("SKU (Stok Kodu)", "sku", "text", true)}
                        {field("Kategori", "category")}
                        {field("Marka", "brand")}
                        {field("Satış Fiyatı (TL)", "price", "number", true)}
                        {field("Liste Fiyatı (TL)", "listPrice", "number")}
                        {field("Stok Adedi", "stock", "number", true)}
                        {field("Renk", "color")}
                        {field("Beden / Numara", "size")}
                    </div>
                    <div className="upm-form-field">
                        <label className="upm-form-label">Açıklama</label>
                        <textarea className="upm-form-textarea" rows={3} value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="upm-form-field">
                        <label className="upm-form-label">Görsel URL'leri <span className="upm-dim">(her satıra bir URL)</span></label>
                        <textarea className="upm-form-textarea" rows={3} placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                            value={form.images} onChange={e => setForm(p => ({ ...p, images: e.target.value }))} />
                    </div>
                </div>
                <div className="upm-modal-footer">
                    <button className="upm-btn upm-btn-ghost" onClick={onClose}>İptal</button>
                    <button className="upm-btn upm-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <><FaSpinner className="spin" /> Kaydediliyor...</> : <><FaSave /> Kaydet</>}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ─── Ürün Detay Modal ────────────────────────────────────────────────────────
const ProductDetailModal = ({ product, onClose }) => {
    const mp = product?.masterProduct || {};
    const st = product?.stockTracking || {};
    const mappings = product?.marketplaceMappings || [];

    return (
        <motion.div className="upm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="upm-modal upm-modal-lg" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} onClick={e => e.stopPropagation()}>
                <div className="upm-modal-header">
                    <h2>Ürün Detayı</h2>
                    <button className="upm-modal-close" onClick={onClose}><FaTimes /></button>
                </div>
                <div className="upm-modal-body">
                    <div className="upm-detail-grid">
                        <div className="upm-detail-images">
                            {(mp.images || []).length > 0
                                ? mp.images.map((img, i) => <img key={i} src={img} alt="" className="upm-detail-img" onError={e => e.target.style.display = "none"} />)
                                : <div className="upm-detail-no-img"><FaBoxOpen /></div>
                            }
                        </div>
                        <div className="upm-detail-info">
                            <h3 className="upm-detail-name">{mp.name}</h3>
                            <div className="upm-detail-rows">
                                <div className="upm-detail-row"><span>Barkod</span><strong>{mp.barcode}</strong></div>
                                <div className="upm-detail-row"><span>SKU</span><strong>{mp.sku}</strong></div>
                                <div className="upm-detail-row"><span>Kategori</span><strong>{mp.category || "—"}</strong></div>
                                <div className="upm-detail-row"><span>Marka</span><strong>{mp.brand || "—"}</strong></div>
                                <div className="upm-detail-row"><span>Satış Fiyatı</span><strong className="upm-price">{fmt(mp.price)}</strong></div>
                                <div className="upm-detail-row"><span>Liste Fiyatı</span><strong>{fmt(mp.listPrice)}</strong></div>
                                <div className="upm-detail-row"><span>Stok</span><strong>{fmtNum(st.totalStock ?? mp.stock ?? 0)} İadet</strong></div>
                                <div className="upm-detail-row"><span>Renk</span><strong>{mp.attributes?.color || "—"}</strong></div>
                                <div className="upm-detail-row"><span>Beden</span><strong>{mp.attributes?.size || "—"}</strong></div>
                            </div>
                        </div>
                    </div>
                    {mappings.length > 0 && (
                        <div className="upm-detail-mappings">
                            <h4>Pazaryeri Eşleştirmeleri</h4>
                            <div className="upm-mp-mapping-list">
                                {mappings.map(m => (
                                    <div key={m.marketplaceName} className="upm-mp-mapping-row">
                                        <span className="upm-mp-chip" style={{ background: MP_COLOR(m.marketplaceName) + "22", color: MP_COLOR(m.marketplaceName), borderColor: MP_COLOR(m.marketplaceName) + "55" }}>
                                            {m.marketplaceName}
                                        </span>
                                        <span className="upm-dim">SKU: {m.marketplaceSku || "—"}</span>
                                        <span className="upm-dim">Stok: {m.stock ?? "—"}</span>
                                        <span className="upm-dim">Fiyat: {m.price ? fmt(m.price) : "—"}</span>
                                        <span className={`upm-badge ${m.syncStatus === "synced" ? "badge-ok" : m.syncStatus === "error" ? "badge-danger" : "badge-warn"}`}>
                                            {m.syncStatus || "pending"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {mp.description && <div className="upm-detail-desc"><h4>Açıklama</h4><p>{mp.description}</p></div>}
                </div>
                <div className="upm-modal-footer">
                    <button className="upm-btn upm-btn-ghost" onClick={onClose}>Kapat</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📥 SEKME 2 — EXCEL İÇE / DIŞA AKTAR
// ═══════════════════════════════════════════════════════════════════════════════
const ImportTab = ({ addToast }) => {
    const [activeSubTab, setActiveSubTab] = useState("import");

    // Import state
    const [file, setFile]               = useState(null);
    const [dragOver, setDragOver]       = useState(false);
    const [previewing, setPreviewing]   = useState(false);
    const [importing, setImporting]     = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [skipErrors, setSkipErrors]   = useState(true);
    const [updateExisting, setUpdateExisting] = useState(true);
    const fileInputRef = useRef();

    // Export state
    const [exporting, setExporting]     = useState(false);
    const [exportSearch, setExportSearch] = useState("");
    const [exportStock, setExportStock] = useState("");

    const handleFileDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) { setFile(f); setPreviewData(null); setImportResult(null); }
    };

    const handleFileSelect = (e) => {
        const f = e.target.files[0];
        if (f) { setFile(f); setPreviewData(null); setImportResult(null); }
    };

    const handlePreview = async () => {
        if (!file) return;
        setPreviewing(true);
        try {
            const data = await previewImport(file);
            setPreviewData(data);
        } catch (err) {
            addToast(err?.response?.data?.error || "Önizleme başarısız", "error");
        } finally { setPreviewing(false); }
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const data = await executeImport(file, { skipErrors, updateExisting });
            setImportResult(data);
            addToast(`${data.results?.created || 0} yeni, ${data.results?.updated || 0} güncellendi`, "success");
        } catch (err) {
            addToast(err?.response?.data?.error || "İçe aktarma başarısız", "error");
        } finally { setImporting(false); }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a"); a.href = url; a.download = "urun_yukleme_sablonu.xlsx"; a.click();
            window.URL.revokeObjectURL(url);
            addToast("Şablon indirildi", "success");
        } catch { addToast("Şablon indirilemedi", "error"); }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (exportSearch) params.search = exportSearch;
            if (exportStock)  params.stockStatus = exportStock;
            const res = await exportProducts(params);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a"); a.href = url;
            a.download = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
            window.URL.revokeObjectURL(url);
            addToast("Ürünler dışa aktarıldı", "success");
        } catch { addToast("Dışa aktarma başarısız", "error"); }
        finally { setExporting(false); }
    };

    const statusIcon = (s) => {
        if (s === "new")     return <FaPlus className="color-ok" />;
        if (s === "update")  return <FaEdit className="color-warn" />;
        if (s === "skipped") return <FaMinus className="color-dim" />;
        if (s === "error")   return <FaTimesCircle className="color-danger" />;
        return null;
    };

    return (
        <div className="upm-import-root">
            <div className="upm-sub-tabs">
                <button className={`upm-sub-tab${activeSubTab === "import" ? " active" : ""}`} onClick={() => setActiveSubTab("import")}>
                    <FaFileImport /> İçe Aktar (Excel/CSV)
                </button>
                <button className={`upm-sub-tab${activeSubTab === "export" ? " active" : ""}`} onClick={() => setActiveSubTab("export")}>
                    <FaFileExport /> Dışa Aktar
                </button>
            </div>

            {activeSubTab === "import" && (
                <div className="upm-import-panel">
                    {/* Şablon İndir */}
                    <div className="upm-info-card">
                        <div className="upm-info-card-left">
                            <FaFileExcel className="upm-info-icon" style={{ color: "#22c55e" }} />
                            <div>
                                <strong>Excel Şablonu</strong>
                                <p>Ürünlerİşinizi toplu yüklemek için hazır şablonu indirin. Zorunlu alanlar: Ürün Adı, Barkod, SKU, Fiyat, Stok.</p>
                            </div>
                        </div>
                        <button className="upm-btn upm-btn-success" onClick={handleDownloadTemplate}>
                            <FaDownload /> Şablonu İndir
                        </button>
                    </div>

                    {/* Dosya Yükleme Alanı */}
                    <div className={`upm-dropzone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelect} />
                        {file ? (
                            <div className="upm-dropzone-file">
                                <FaFileExcel className="upm-dropzone-file-icon" />
                                <div>
                                    <strong>{file.name}</strong>
                                    <span className="upm-dim"> ({(file.size / 1024).toFixed(1)} KB)</span>
                                </div>
                                <button className="upm-icon-btn danger" onClick={e => { e.stopPropagation(); setFile(null); setPreviewData(null); setImportResult(null); }}>
                                    <FaTimes />
                                </button>
                            </div>
                        ) : (
                            <div className="upm-dropzone-empty">
                                <FaCloudUploadAlt className="upm-dropzone-icon" />
                                <p><strong>Dosyayı buraya sürükleyin</strong> veya tıklayın</p>
                                <span className="upm-dim">.xlsx, .xls, .csv — Maks. 10 MB</span>
                            </div>
                        )}
                    </div>

                    {/* Seçenekler */}
                    {file && (
                        <div className="upm-import-options">
                            <label className="upm-checkbox-label">
                                <input type="checkbox" checked={skipErrors} onChange={e => setSkipErrors(e.target.checked)} />
                                Hatalı satırları atla (devam et)
                            </label>
                            <label className="upm-checkbox-label">
                                <input type="checkbox" checked={updateExisting} onChange={e => setUpdateExisting(e.target.checked)} />
                                Mevcut ürünleri güncelle (aynı barkod)
                            </label>
                        </div>
                    )}

                    {/* Butonlar */}
                    {file && !importResult && (
                        <div className="upm-import-actions">
                            <button className="upm-btn upm-btn-ghost" onClick={handlePreview} disabled={previewing}>
                                {previewing ? <><FaSpinner className="spin" /> Önizleniyor...</> : <><FaEye /> Önizle</>}
                            </button>
                            <button className="upm-btn upm-btn-primary" onClick={handleImport} disabled={importing}>
                                {importing ? <><FaSpinner className="spin" /> Aktarılıyor...</> : <><FaUpload /> İçe Aktar</>}
                            </button>
                        </div>
                    )}

                    {/* Önizleme Tablosu */}
                    {previewData && !importResult && (
                        <div className="upm-preview-section">
                            <div className="upm-preview-stats">
                                <div className="upm-stat-chip chip-blue">Toplam: {previewData.stats?.total}</div>
                                <div className="upm-stat-chip chip-green">Yeni: {previewData.stats?.new}</div>
                                <div className="upm-stat-chip chip-warn">Güncelleme: {previewData.stats?.update}</div>
                                <div className="upm-stat-chip chip-danger">Hatalı: {previewData.stats?.invalid}</div>
                            </div>
                            <div className="upm-table-wrap">
                                <table className="upm-table">
                                    <thead>
                                        <tr>
                                            <th>#</th><th>Durum</th><th>Ürün Adı</th><th>Barkod</th>
                                            <th>SKU</th><th>Fiyat</th><th>Stok</th><th>Sorunlar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.preview?.slice(0, 100).map((row, i) => (
                                            <tr key={i} className={row.validationErrors?.length > 0 ? "row-error" : ""}>
                                                <td className="upm-dim">{row.rowNumber}</td>
                                                <td><span className="upm-status-icon">{statusIcon(row.status)}</span> {row.status}</td>
                                                <td>{row.name || "—"}</td>
                                                <td className="upm-mono">{row.barcode || "—"}</td>
                                                <td className="upm-mono">{row.sku || "—"}</td>
                                                <td>{row.price ? fmt(row.price) : "—"}</td>
                                                <td>{row.stock ?? "—"}</td>
                                                <td className="color-danger">{row.validationErrors?.join(", ") || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {previewData.preview?.length > 100 && <p className="upm-dim upm-center">... ve {previewData.preview.length - 100} satır daha</p>}
                        </div>
                    )}

                    {/* Sonuç */}
                    {importResult && (
                        <div className="upm-result-card">
                            <div className="upm-result-header">
                                <FaCheckCircle className="color-ok" />
                                <h3>İçe Aktarma Tamamlandı</h3>
                            </div>
                            <div className="upm-result-stats">
                                <div className="upm-stat-chip chip-green">✅ Oluşturulan: {importResult.results?.created}</div>
                                <div className="upm-stat-chip chip-warn">🔄 Güncellenen: {importResult.results?.updated}</div>
                                <div className="upm-stat-chip chip-blue">⏭ Atlanan: {importResult.results?.skipped}</div>
                                <div className="upm-stat-chip chip-danger">❌ Hata: {importResult.results?.errors}</div>
                            </div>
                            <div className="upm-table-wrap" style={{ maxHeight: 300 }}>
                                <table className="upm-table">
                                    <thead><tr><th>#</th><th>Durum</th><th>Ürün</th><th>Barkod</th><th>Detay</th></tr></thead>
                                    <tbody>
                                        {importResult.results?.details?.slice(0, 200).map((d, i) => (
                                            <tr key={i}>
                                                <td className="upm-dim">{d.rowNumber}</td>
                                                <td><span className="upm-status-icon">{statusIcon(d.status)}</span> {d.status}</td>
                                                <td>{d.name || "—"}</td>
                                                <td className="upm-mono">{d.barcode || "—"}</td>
                                                <td className="upm-dim">{d.error || d.reason || d.errors?.join(", ") || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button className="upm-btn upm-btn-ghost" onClick={() => { setFile(null); setPreviewData(null); setImportResult(null); }}>
                                Yeni İçe Aktarma
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === "export" && (
                <div className="upm-export-panel">
                    <div className="upm-info-card">
                        <div className="upm-info-card-left">
                            <FaFileExport className="upm-info-icon" style={{ color: "#4ecdc4" }} />
                            <div>
                                <strong>Ürünleri Dışa Aktar</strong>
                                <p>Tüm ürünlerİşinizi veya filtrelenmiş ürünleri Excel dosyası olarak indirin. Pazaryeri durumları da dahil edilir.</p>
                            </div>
                        </div>
                    </div>
                    <div className="upm-export-filters">
                        <div className="upm-form-field">
                            <label className="upm-form-label">Ürün Ara</label>
                            <input className="upm-form-input" placeholder="Ad, barkod, SKU..." value={exportSearch} onChange={e => setExportSearch(e.target.value)} />
                        </div>
                        <div className="upm-form-field">
                            <label className="upm-form-label">Stok Durumu</label>
                            <select className="upm-select" value={exportStock} onChange={e => setExportStock(e.target.value)}>
                                <option value="">Tümü</option>
                                <option value="outOfStock">Stok Yok</option>
                                <option value="lowStock">Düşük Stok</option>
                            </select>
                        </div>
                    </div>
                    <button className="upm-btn upm-btn-primary upm-btn-lg" onClick={handleExport} disabled={exporting}>
                        {exporting ? <><FaSpinner className="spin" /> Hazırlanıyor...</> : <><FaDownload /> Excel Olarak İndir</>}
                    </button>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 SEKME 3 — PAZARYERİ KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════════════════════════
const ComparisonTab = ({ marketplaces, addToast }) => {
    const [matrix, setMatrix]         = useState([]);
    const [mpNames, setMpNames]       = useState([]);
    const [summary, setSummary]       = useState(null);
    const [loading, setLoading]       = useState(false);
    const [search, setSearch]         = useState("");
    const [missingOnly, setMissingOnly] = useState(false);
    const [page, setPage]             = useState(0);
    const [total, setTotal]           = useState(0);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [syncing, setSyncing]       = useState(false);
    const LIMIT = 30;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: LIMIT };
            if (search)      params.search      = search;
            if (missingOnly) params.missingOnly  = "true";
            const data = await getComparisonMatrix(params);
            setMatrix(data.matrix || []);
            setMpNames(data.marketplaces || []);
            setSummary(data.summary || null);
            setTotal(data.total || 0);
        } catch { addToast("Karşılaştırma yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [page, search, missingOnly, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleSyncAll = async () => {
        setSyncing(true);
        try {
            const data = await syncAllMarketplaces();
            addToast(data.message || "Senkronizasyon tamamlandı", "success");
            load();
        } catch { addToast("Senkronizasyon başarısız", "error"); }
        finally { setSyncing(false); }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const presenceCell = (presence) => {
        if (!presence) return <span className="upm-presence upm-presence-none"><FaMinus /></span>;
        if (presence.exists) return <span className="upm-presence upm-presence-ok"><FaCheck /></span>;
        return <span className="upm-presence upm-presence-missing"><FaTimes /></span>;
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="upm-comparison">
            {/* Özet Kartlar */}
            {summary && (
                <div className="upm-summary-cards">
                    <div className="upm-summary-card">
                        <div className="upm-summary-num">{fmtNum(summary.totalProducts)}</div>
                        <div className="upm-summary-label">Toplam Ürün</div>
                    </div>
                    <div className="upm-summary-card card-ok">
                        <div className="upm-summary-num">{fmtNum(summary.fullyDistributed)}</div>
                        <div className="upm-summary-label">Tam Dağıtılmış</div>
                    </div>
                    <div className="upm-summary-card card-warn">
                        <div className="upm-summary-num">{fmtNum(summary.partiallyMissing)}</div>
                        <div className="upm-summary-label">Kısmen Eksik</div>
                    </div>
                    <div className="upm-summary-card card-danger">
                        <div className="upm-summary-num">{fmtNum(summary.notDistributed)}</div>
                        <div className="upm-summary-label">Hiç Dağıtılmamış</div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="upm-toolbar">
                <div className="upm-toolbar-left">
                    <div className="upm-search-box">
                        <FaSearch className="upm-search-icon" />
                        <input className="upm-search-input" placeholder="Ürün ara..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(0); }} />
                    </div>
                    <label className="upm-checkbox-label">
                        <input type="checkbox" checked={missingOnly} onChange={e => { setMissingOnly(e.target.checked); setPage(0); }} />
                        Sİadece eksik olanlar
                    </label>
                </div>
                <div className="upm-toolbar-right">
                    {selectedIds.size > 0 && <span className="upm-selected-info">{selectedIds.size} seçili</span>}
                    <button className="upm-btn upm-btn-ghost" onClick={load} disabled={loading}><FaSync className={loading ? "spin" : ""} /> Yenile</button>
                    <button className="upm-btn upm-btn-primary" onClick={handleSyncAll} disabled={syncing}>
                        {syncing ? <><FaSpinner className="spin" /> Senkronize ediliyor...</> : <><FaSync /> Tümünü Senkronize Et</>}
                    </button>
                </div>
            </div>

            {/* Matris Tablosu */}
            <div className="upm-table-wrap">
                {loading ? (
                    <div className="upm-loading"><FaSpinner className="spin" /> Yükleniyor...</div>
                ) : matrix.length === 0 ? (
                    <div className="upm-empty"><FaLayerGroup className="upm-empty-icon" /><p>Ürün bulunamadı</p></div>
                ) : (
                    <table className="upm-table upm-matrix-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? new Set(matrix.map(p => p._id)) : new Set())} /></th>
                                <th>Ürün</th>
                                <th>Barkod</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                {mpNames.map(mp => (
                                    <th key={mp} style={{ color: MP_COLOR(mp) }}>{mp}</th>
                                ))}
                                <th>Eksik</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map(p => (
                                <tr key={p._id} className={selectedIds.has(p._id) ? "selected" : ""}>
                                    <td><input type="checkbox" checked={selectedIds.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                                    <td><div className="upm-product-name">{p.name || "—"}</div></td>
                                    <td className="upm-mono">{p.barcode || "—"}</td>
                                    <td>{fmt(p.price)}</td>
                                    <td>{fmtNum(p.stock)}</td>
                                    {mpNames.map(mp => (
                                        <td key={mp} className="upm-presence-cell">{presenceCell(p.presence?.[mp])}</td>
                                    ))}
                                    <td>
                                        {p.missingCount > 0
                                            ? <span className="upm-badge badge-warn">{p.missingCount} eksik</span>
                                            : <span className="upm-badge badge-ok">Tam</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
                <div className="upm-pagination">
                    <button className="upm-btn upm-btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ ÖÖnceki</button>
                    <span className="upm-page-info">{page + 1} / {totalPages} ({fmtNum(total)} ürün)</span>
                    <button className="upm-btn upm-btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki ›</button>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SEKME 4 — ÜRÜN DAĞITIMI
// ═══════════════════════════════════════════════════════════════════════════════
const DistributeTab = ({ marketplaces, addToast }) => {
    const [products, setProducts]         = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [selectedIds, setSelectedIds]   = useState(new Set());
    const [targetMPs, setTargetMPs]       = useState(new Set());
    const [distributing, setDistributing] = useState(false);
    const [results, setResults]           = useState(null);
    const [syncingFrom, setSyncingFrom]   = useState("");
    const [syncing, setSyncing]           = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page: 0, limit: 100 };
            if (search) params.search = search;
            const data = await getProducts(params);
            setProducts(data.products || []);
        } catch { addToast("Ürünler yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [search, addToast]);

    useEffect(() => { load(); }, [load]);

    const toggleProduct = (id) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const toggleMP = (name) => {
        setTargetMPs(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
    };

    const handleDistribute = async () => {
        if (selectedIds.size === 0) { addToast("En az 1 ürün seçin", "error"); return; }
        if (targetMPs.size === 0)   { addToast("En az 1 hedef pazaryeri seçin", "error"); return; }
        setDistributing(true);
        setResults(null);
        try {
            const data = await bulkDistributeSelected([...selectedIds], [...targetMPs]);
            setResults(data);
            addToast(data.message || "Dağıtım tamamlandı", "success");
        } catch (err) {
            addToast(err?.response?.data?.error || "Dağıtım başarısız", "error");
        } finally { setDistributing(false); }
    };

    const handleSyncFrom = async () => {
        if (!syncingFrom) { addToast("Kaynak pazaryeri seçin", "error"); return; }
        setSyncing(true);
        try {
            const mp = marketplaces.find(m => m.name === syncingFrom);
            if (!mp) throw new Error("Pazaryeri bulunamadı");
            const data = await syncFromMarketplace(mp._id, syncingFrom);
            addToast(`${syncingFrom} senkronize edildi — Yeni: ${data.stats?.new || 0}, Güncellenen: ${data.stats?.updated || 0}`, "success");
            load();
        } catch (err) {
            addToast(err?.response?.data?.error || "Senkronizasyon başarısız", "error");
        } finally { setSyncing(false); }
    };

    return (
        <div className="upm-distribute">
            {/* Pazaryerinden Çek */}
            <div className="upm-section-card">
                <h3 className="upm-section-title"><FaSync /> Pazaryerinden Ürün Çek</h3>
                <p className="upm-section-desc">Seçili pazaryerindeki ürünleri sisteme çekip kataloğa ekle.</p>
                <div className="upm-distribute-sync-row">
                    <select className="upm-select upm-select-lg" value={syncingFrom} onChange={e => setSyncingFrom(e.target.value)}>
                        <option value="">Kaynak Pazaryeri Seç</option>
                        {marketplaces.map(mp => <option key={mp._id} value={mp.name}>{mp.name}</option>)}
                    </select>
                    <button className="upm-btn upm-btn-primary" onClick={handleSyncFrom} disabled={syncing || !syncingFrom}>
                        {syncing ? <><FaSpinner className="spin" /> Çekiliyor...</> : <><FaDownload /> Ürünleri Çek</>}
                    </button>
                </div>
            </div>

            {/* Toplu Dağıtım */}
            <div className="upm-section-card">
                <h3 className="upm-section-title"><FaRocket /> Toplu Ürün Dağıtımı</h3>
                <p className="upm-section-desc">Seçili ürünleri seçili pazaryerlerine yükle.</p>

                <div className="upm-distribute-layout">
                    {/* Sol: Ürün Listesi */}
                    <div className="upm-distribute-products">
                        <div className="upm-distribute-products-header">
                            <div className="upm-search-box">
                                <FaSearch className="upm-search-icon" />
                                <input className="upm-search-input" placeholder="Ürün ara..." value={search}
                                    onChange={e => setSearch(e.target.value)} />
                            </div>
                            <span className="upm-dim">{selectedIds.size} seçili</span>
                        </div>
                        <div className="upm-distribute-product-list">
                            {loading ? (
                                <div className="upm-loading"><FaSpinner className="spin" /></div>
                            ) : products.map(p => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                return (
                                    <label key={p._id} className={`upm-distribute-product-row${selectedIds.has(p._id) ? " selected" : ""}`}>
                                        <input type="checkbox" checked={selectedIds.has(p._id)} onChange={() => toggleProduct(p._id)} />
                                        <div className="upm-distribute-product-info">
                                            <span className="upm-product-name">{mp.name}</span>
                                            <span className="upm-dim">{mp.barcode} · {fmt(mp.price)} · {fmtNum(st.totalStock ?? mp.stock ?? 0)} İadet</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="upm-distribute-select-all">
                            <button className="upm-btn upm-btn-ghost upm-btn-sm" onClick={() => setSelectedIds(new Set(products.map(p => p._id)))}>Tümünü Seç</button>
                            <button className="upm-btn upm-btn-ghost upm-btn-sm" onClick={() => setSelectedIds(new Set())}>Temizle</button>
                        </div>
                    </div>

                    {/* Ok */}
                    <div className="upm-distribute-arrow"><FaArrowRight /></div>

                    {/* Sağ: Hedef Pazaryerleri */}
                    <div className="upm-distribute-targets">
                        <h4>Hedef Pazaryerleri</h4>
                        <div className="upm-mp-target-list">
                            {marketplaces.map(mp => (
                                <label key={mp._id} className={`upm-mp-target-row${targetMPs.has(mp.name) ? " selected" : ""}`}
                                    style={{ borderColor: targetMPs.has(mp.name) ? MP_COLOR(mp.name) : "transparent" }}>
                                    <input type="checkbox" checked={targetMPs.has(mp.name)} onChange={() => toggleMP(mp.name)} />
                                    <span className="upm-mp-dot" style={{ background: MP_COLOR(mp.name) }} />
                                    <span>{mp.name}</span>
                                </label>
                            ))}
                            {marketplaces.length === 0 && <p className="upm-dim">Entegre pazaryeri yok</p>}
                        </div>
                        <button className="upm-btn upm-btn-primary upm-btn-full" onClick={handleDistribute} disabled={distributing || selectedIds.size === 0 || targetMPs.size === 0}>
                            {distributing ? <><FaSpinner className="spin" /> Dağıtılıyor...</> : <><FaRocket /> {selectedIds.size} Ürünü Dağıt</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sonuçlar */}
            {results && (
                <div className="upm-result-card">
                    <div className="upm-result-header"><FaCheckCircle className="color-ok" /><h3>Dağıtım Tamamlandı</h3></div>
                    <div className="upm-result-stats">
                        <div className="upm-stat-chip chip-green">✅ Başarılı: {results.results?.success}</div>
                        <div className="upm-stat-chip chip-blue">⏭ Atlanan: {results.results?.skipped}</div>
                        <div className="upm-stat-chip chip-danger">❌ Hata: {results.results?.error}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 SEKME 5 — SENKRON LOGLARI
// ═══════════════════════════════════════════════════════════════════════════════
const LogsTab = ({ addToast }) => {
    const [logs, setLogs]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage]       = useState(0);
    const [actionFilter, setActionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const LIMIT = 50;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: LIMIT };
            if (actionFilter) params.actionType = actionFilter;
            if (statusFilter) params.status     = statusFilter;
            const data = await getSyncLogs(params);
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch { addToast("Loglar yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [page, actionFilter, statusFilter, addToast]);

    useEffect(() => { load(); }, [load]);

    const actionLabel = (a) => {
        const map = { product_created: "Ürün Oluşturuldu", product_synced: "Senkronize Edildi", stock_update: "Stok Güncellendi", price_update: "Fiyat Güncellendi", manual_sync: "Manuel Sync", auto_sync: "Otomatik Sync", bulk_update: "Toplu Güncelleme", order_placed: "Sipariş" };
        return map[a] || a;
    };

    const statusBadge = (s) => {
        if (s === "success") return <span className="upm-badge badge-ok">Başarılı</span>;
        if (s === "error")   return <span className="upm-badge badge-danger">Hata</span>;
        if (s === "partial") return <span className="upm-badge badge-warn">Kısmi</span>;
        return <span className="upm-badge">{s}</span>;
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="upm-logs">
            <div className="upm-toolbar">
                <div className="upm-toolbar-left">
                    <select className="upm-select" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}>
                        <option value="">Tüm İşlemler</option>
                        <option value="product_created">Ürün Oluşturuldu</option>
                        <option value="product_synced">Senkronize Edildi</option>
                        <option value="stock_update">Stok Güncellendi</option>
                        <option value="price_update">Fiyat Güncellendi</option>
                        <option value="manual_sync">Manuel Sync</option>
                        <option value="auto_sync">Otomatik Sync</option>
                        <option value="bulk_update">Toplu Güncelleme</option>
                    </select>
                    <select className="upm-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
                        <option value="">Tüm Durumlar</option>
                        <option value="success">Başarılı</option>
                        <option value="error">Hata</option>
                        <option value="partial">Kısmi</option>
                    </select>
                </div>
                <div className="upm-toolbar-right">
                    <button className="upm-btn upm-btn-ghost" onClick={load} disabled={loading}><FaSync className={loading ? "spin" : ""} /> Yenile</button>
                </div>
            </div>

            <div className="upm-table-wrap">
                {loading ? (
                    <div className="upm-loading"><FaSpinner className="spin" /> Yükleniyor...</div>
                ) : logs.length === 0 ? (
                    <div className="upm-empty"><FaHistory className="upm-empty-icon" /><p>Log bulunamadı</p></div>
                ) : (
                    <table className="upm-table">
                        <thead>
                            <tr><th>Tarih</th><th>İşlem</th><th>Ürün</th><th>Pazaryeri</th><th>Değişiklik</th><th>Durum</th></tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log._id}>
                                    <td className="upm-dim upm-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "—"}</td>
                                    <td><span className="upm-badge badge-blue">{actionLabel(log.actionType)}</span></td>
                                    <td>
                                        <div className="upm-product-name">{log.product?.name || "—"}</div>
                                        <div className="upm-dim upm-mono">{log.product?.barcode || ""}</div>
                                    </td>
                                    <td>{log.marketplace?.name ? <span className="upm-mp-chip" style={{ color: MP_COLOR(log.marketplace.name), borderColor: MP_COLOR(log.marketplace.name) + "55", background: MP_COLOR(log.marketplace.name) + "15" }}>{log.marketplace.name}</span> : "—"}</td>
                                    <td className="upm-dim">
                                        {log.changes?.field === "stock" && `Stok: ${log.changes.oldValue} → ${log.changes.newValue}`}
                                        {log.changes?.field === "price" && `Fiyat: ${fmt(log.changes.oldValue)} → ${fmt(log.changes.newValue)}`}
                                        {log.changes?.field === "import" && `${log.changes.newValue} ürün aktarıldı`}
                                        {!log.changes?.field && "—"}
                                    </td>
                                    <td>{statusBadge(log.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {totalPages > 1 && (
                <div className="upm-pagination">
                    <button className="upm-btn upm-btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ ÖÖnceki</button>
                    <span className="upm-page-info">{page + 1} / {totalPages} ({fmtNum(total)} log)</span>
                    <button className="upm-btn upm-btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki ›</button>
                </div>
            )}
        </div>
    );
};

export default UnifiedProductManagement;
