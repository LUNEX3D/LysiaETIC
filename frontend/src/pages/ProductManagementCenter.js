/**
 * ÜRÜN YÖNETİM MERKEZİ — ProductManagementCenter.js (v3 — Temiz & Kullanışlı)
 *
 * Tek sayfa içinde tüm ürün yönetimi:
 *   • Dashboard özet kartları (üstte her zaman görünür)
 *   • Tab 1: Ürünler — Liste + inline fiyat/stok düzenleme
 *   • Tab 2: Ürün Yükle — 3 adımlı wizard
 *   • Tab 3: Fiyat & Stok — Toplu düzenleme tablosu
 *   • Tab 4: Senkronizasyon — Platform kartları + loglar
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBox, FaSearch, FaPlus, FaEdit, FaTrash, FaSync, FaRocket,
    FaEye, FaFileExcel, FaCheck, FaTimes, FaChevronLeft, FaChevronRight, FaChevronDown,
    FaTag, FaBarcode, FaDollarSign, FaWarehouse, FaStore, FaGlobe,
    FaBolt, FaClipboardList, FaImage, FaFolderOpen, FaMagic,
    FaArrowRight, FaArrowLeft, FaSave, FaCloudUploadAlt, FaShieldAlt,
    FaPercentage, FaLayerGroup, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaInfoCircle, FaCubes, FaSitemap, FaSpinner
} from "react-icons/fa";
import {
    getProducts, getProductDetail, updateProduct, deleteProduct,
    syncFromMarketplace, distributeProduct, bulkDistribute,
    syncStock, syncPrice, triggerAutoSync, getSyncLogs,
    getProductManagementDashboard, syncAllMarketplaces,
    bulkDistributeSelected, exportProducts,
    createAndDistribute,
    suggestCodes, generateDescription,
    bulkUpdatePrices, bulkUpdateStocks, bulkDeleteProducts, bulkUpdateFields,
    distributeUndistributed,
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementCenter.css";

/* ═══════════════════════════════════════════════════════════════════
   SABİTLER & YARDIMCILAR
   ═══════════════════════════════════════════════════════════════════ */
const PLATFORMS = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];
const PL_COLOR = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#8b5cf6", Amazon: "#f59e0b", ÇiçekSepeti: "#ec4899" };
const PL_SHORT = { Trendyol: "TY", Hepsiburada: "HB", N11: "N11", Amazon: "AZ", ÇiçekSepeti: "ÇS" };

const fmt = (v) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0)); }
    catch { return `${Number(v || 0).toFixed(2)} ₺`; }
};
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d); return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const fmtAgo = (d) => { if (!d) return "—"; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "Az önce"; if (m < 60) return `${m}dk`; const h = Math.floor(m / 60); if (h < 24) return `${h}sa`; return `${Math.floor(h / 24)}g`; };

const normMP = (n) => { if (!n) return ""; const l = n.trim().toLowerCase(); if (l === "trendyol") return "trendyol"; if (l === "hepsiburada") return "hepsiburada"; if (l === "n11") return "n11"; if (l === "amazon" || l === "amazon türkiye") return "amazon"; if (l === "çiçeksepeti" || l === "ciceksepeti") return "ciceksepeti"; return l; };
// ⚠️ FIX: syncStatus: "error" = platformda yok/kaldırılmış — bu mapping'ler gösterilmez
const getPlMap = (p, name) => (p.marketplaceMappings || []).find(m => normMP(m.marketplaceName) === normMP(name) && m.syncStatus !== "error");
const getPlStatus = (p, name) => { const m = getPlMap(p, name); if (!m) return { exists: false }; return { exists: true, status: m.syncStatus || (m.isActive !== false ? "active" : "inactive"), price: m.price, stock: m.stock, lastSync: m.lastSyncDate }; };

/* ═══════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════════ */
const ProductManagementCenter = ({ userId }) => {
    // ── Core State ──
    const [tab, setTab] = useState("products");
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [actionLoading, setActionLoading] = useState("");
    const [toast, setToast] = useState(null);
    const [stockFilter, setStockFilter] = useState("");
    const [syncLogs, setSyncLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [editMap, setEditMap] = useState({});
    const [bulkModal, setBulkModal] = useState(false);
    const searchRef = useRef(null);
    const LIMIT = 20;

    // ── Bulk Tab State ──
    const [bulkProducts, setBulkProducts] = useState([]);
    const [bulkTotal, setBulkTotal] = useState(0);
    const [bulkPage, setBulkPage] = useState(0);
    const [bulkSearch, setBulkSearch] = useState("");
    const [bulkSelected, setBulkSelected] = useState(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkAction, setBulkAction] = useState("");
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [bulkPriceMode, setBulkPriceMode] = useState("percent");
    const [bulkPriceValue, setBulkPriceValue] = useState("");
    const [bulkPriceRound, setBulkPriceRound] = useState("");
    const [bulkPriceListToo, setBulkPriceListToo] = useState(true);
    const [bulkPriceSync, setBulkPriceSync] = useState(false);
    const [bulkStockMode, setBulkStockMode] = useState("fixed");
    const [bulkStockValue, setBulkStockValue] = useState("");
    const [bulkStockSync, setBulkStockSync] = useState(false);
    const [bulkFieldCategory, setBulkFieldCategory] = useState("");
    const [bulkFieldBrand, setBulkFieldBrand] = useState("");
    const [bulkFieldSafety, setBulkFieldSafety] = useState("");
    const [bulkResult, setBulkResult] = useState(null);
    const bulkSearchRef = useRef(null);

    // ── Delete Confirm Modal State ──
    const [deleteConfirm, setDeleteConfirm] = useState(null);       // { id, name, platforms: [] }
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteResult, setDeleteResult] = useState(null);         // { success, msg, mpResults: [] }

    // ── Category Tab State ──
    const [catTab, setCatTab] = useState("browse"); // "browse" | "mapping" | "products"
    const [catPlatformSel, setCatPlatformSel] = useState("Trendyol");
    const [catTreeData, setCatTreeData] = useState({}); // { [nodeId]: { children, loaded } }
    const [catExpanded, setCatExpanded] = useState(new Set());
    const [catTreeLoading, setCatTreeLoading] = useState("");
    const [catSearchQ, setCatSearchQ] = useState("");
    const [catSearchResults, setCatSearchResults] = useState([]);
    const [catSearchLoading, setCatSearchLoading] = useState(false);
    const [catSelectedNode, setCatSelectedNode] = useState(null); // { id, name, path, platform }
    const [masterCategories, setMasterCategories] = useState([]);
    const [masterCatLoading, setMasterCatLoading] = useState(false);
    const [masterCatForm, setMasterCatForm] = useState({ name: "", parent: "" });
    const [masterCatExpanded, setMasterCatExpanded] = useState(new Set());
    const [mappingTarget, setMappingTarget] = useState(null);
    const [catProducts, setCatProducts] = useState([]); // products grouped by category
    const [catProdExpanded, setCatProdExpanded] = useState(new Set());
    const [catProdLoading, setCatProdLoading] = useState(false);
    const catSearchTimer = useRef(null);

    // ── Upload State ──
    const [uploadStep, setUploadStep] = useState(1);
    const [uf, setUf] = useState({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "0", category: "", brand: "", imageUrls: [], targetMarketplaces: [] });
    const [uploadLoading, setUploadLoading] = useState(false);
    const [codeSugg, setCodeSugg] = useState(null);
    const [codeLoading, setCodeLoading] = useState(false);
    const [descLoading, setDescLoading] = useState(false);
    const [descTone, setDescTone] = useState("professional");
    const [imgFiles, setImgFiles] = useState([]);
    const [imgUrlInput, setImgUrlInput] = useState("");
    const [catPlatform, setCatPlatform] = useState("Trendyol");
    const [catLevels, setCatLevels] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catSearch, setCatSearch] = useState("");
    const [catResults, setCatResults] = useState([]);
    const fileRef = useRef(null);
    const catSearchRef = useRef(null);

    const showToast = useCallback((msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }, []);
    const ufSet = (k, v) => setUf(p => ({ ...p, [k]: v }));

    // ── Data Loading ──
    useEffect(() => { if (userId) getUserMarketplaces().then(d => setMarketplaces(d.map(m => ({ ...m, name: m.marketplaceName })))).catch(() => {}); }, [userId]);

    const loadProducts = useCallback(async (p = 0, s = search, sf = stockFilter) => {
        setLoading(true);
        try {
            const params = { page: p, limit: LIMIT }; if (s) params.search = s; if (sf) params.stockStatus = sf;
            const res = await getProducts(params);
            setProducts(res.products || []); setTotal(res.total || 0); setPage(p);
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [search, stockFilter, showToast]);

    useEffect(() => { loadProducts(0); }, [stockFilter]); // eslint-disable-line
    useEffect(() => { if (searchRef.current) clearTimeout(searchRef.current); searchRef.current = setTimeout(() => loadProducts(0, search), 400); return () => clearTimeout(searchRef.current); }, [search]); // eslint-disable-line

    const loadDashboard = useCallback(async () => { try { const r = await getProductManagementDashboard(); setDashboard(r.dashboard || r); } catch {} }, []);
    useEffect(() => { loadDashboard(); }, []); // eslint-disable-line

    const loadLogs = useCallback(async () => { setLogsLoading(true); try { const r = await getSyncLogs({ limit: 40 }); setSyncLogs(r.logs || []); } catch {} finally { setLogsLoading(false); } }, []);

    const loadBulkProducts = useCallback(async (p = 0, s = bulkSearch) => {
        setBulkLoading(true);
        try {
            const params = { page: p, limit: LIMIT }; if (s) params.search = s;
            const res = await getProducts(params);
            setBulkProducts(res.products || []); setBulkTotal(res.total || 0); setBulkPage(p);
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); }
        finally { setBulkLoading(false); }
    }, [bulkSearch, showToast]);

    useEffect(() => { if (tab === "sync") loadLogs(); if (tab === "products" || tab === "pricestock") loadProducts(0); if (tab === "bulk") loadBulkProducts(0); }, [tab]); // eslint-disable-line
    useEffect(() => { if (tab === "bulk") { if (bulkSearchRef.current) clearTimeout(bulkSearchRef.current); bulkSearchRef.current = setTimeout(() => loadBulkProducts(0, bulkSearch), 400); return () => clearTimeout(bulkSearchRef.current); } }, [bulkSearch]); // eslint-disable-line

    // ── Actions ──
    const openDetail = async (id) => {
        setDetailLoading(true); setShowDetail(true);
        try { const r = await getProductDetail(id); setDetail(r.product); } catch { showToast("Detay yüklenemedi", "error"); }
        finally { setDetailLoading(false); }
    };

    const handleStockUpdate = async (id, stock) => {
        setActionLoading(`s-${id}`);
        try { await syncStock(id, Number(stock)); showToast(`Stok güncellendi: ${stock}`); loadProducts(page); } catch (e) { showToast("Stok hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handlePriceUpdate = async (id, price, listPrice) => {
        setActionLoading(`p-${id}`);
        try { await syncPrice(id, Number(price), listPrice ? Number(listPrice) : null); showToast(`Fiyat güncellendi: ${fmt(price)}`); loadProducts(page); } catch (e) { showToast("Fiyat hatası", "error"); }
        finally { setActionLoading(""); }
    };

    // Silme onay modal'ını aç
    const askDelete = (id) => {
        const p = products.find(x => x._id === id) || detail;
        const mp = p?.masterProduct || {};
        const mappings = (p?.marketplaceMappings || []).filter(m => m.syncStatus !== "error").map(m => m.marketplaceName);
        setDeleteConfirm({ id, name: mp.name || mp.barcode || "Ürün", platforms: mappings });
        setDeleteResult(null);
    };

    // Silme işlemini gerçekleştir
    const executeDelete = async () => {
        if (!deleteConfirm) return;
        const { id } = deleteConfirm;
        setDeleteLoading(true); setDeleteResult(null);
        try {
            const res = await deleteProduct(id, { deleteFromMarketplaces: true });
            const mpResults = res.marketplaceResults || [];
            const mpSuccess = mpResults.filter(r => r.status === "success").length;
            const mpError = mpResults.filter(r => r.status === "error").length;
            let msg = "Ürün silindi";
            if (mpResults.length > 0) msg += ` | Pazaryeri: ${mpSuccess} başarılı${mpError > 0 ? `, ${mpError} hata` : ""}`;
            setDeleteResult({ success: true, msg, mpResults });
            showToast(msg);
            loadProducts(page); loadDashboard();
            if (detail?._id === id) { setDetail(null); setShowDetail(false); }
        } catch {
            setDeleteResult({ success: false, msg: "Ürün silinemedi", mpResults: [] });
            showToast("Silinemedi", "error");
        } finally { setDeleteLoading(false); }
    };

    const handleSyncFrom = async (mp) => {
        setActionLoading(`sync-${mp._id}`);
        try { const r = await syncFromMarketplace(mp._id, mp.marketplaceName); showToast(`${mp.marketplaceName}: ${r.stats?.created || 0} yeni, ${r.stats?.updated || 0} güncellendi`); loadProducts(0); loadDashboard(); } catch (e) { showToast(`Sync hatası`, "error"); }
        finally { setActionLoading(""); }
    };

    const handleSyncAll = async () => {
        setActionLoading("sync-all");
        try { await syncAllMarketplaces(); showToast("Tüm platformlar senkronize edildi"); loadProducts(0); loadDashboard(); } catch { showToast("Toplu sync hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handleDistributeUndistributed = async () => {
        setActionLoading("dist-undist");
        try {
            const r = await distributeUndistributed({});
            const s = r.stats || {};
            showToast(`${s.distributed || 0} ürün dağıtıldı${s.error > 0 ? `, ${s.error} hata` : ""}`);
            loadProducts(0); loadDashboard();
        } catch (e) { showToast(e.response?.data?.error || "Dağıtım hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handleBulkDistribute = async (targets) => {
        if (selected.size === 0) return showToast("Ürün seçin", "error");
        setActionLoading("bulk"); setBulkModal(false);
        try { await bulkDistributeSelected(Array.from(selected), targets); showToast(`${selected.size} ürün dağıtıldı`); loadProducts(page); setSelected(new Set()); } catch { showToast("Dağıtım hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handleExport = async () => {
        setActionLoading("export");
        try { const r = await exportProducts({ search, stockStatus: stockFilter }); const u = window.URL.createObjectURL(new Blob([r.data])); const a = document.createElement("a"); a.href = u; a.download = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); window.URL.revokeObjectURL(u); showToast("Excel indirildi"); } catch { showToast("Export hatası", "error"); }
        finally { setActionLoading(""); }
    };

    // ── Upload Handlers ──
    const handleSuggestCodes = async () => {
        if (!uf.name.trim()) return showToast("Önce ürün adı girin", "error");
        setCodeLoading(true);
        try { const r = await suggestCodes(uf.name.trim(), uf.brand, uf.category); setCodeSugg(r.suggestions); } catch { showToast("Öneri alınamadı", "error"); }
        finally { setCodeLoading(false); }
    };

    const handleGenDesc = async () => {
        if (!uf.name.trim()) return showToast("Önce ürün adı girin", "error");
        setDescLoading(true);
        try { const r = await generateDescription({ productName: uf.name.trim(), category: uf.category, brand: uf.brand, price: uf.price || undefined, tone: descTone }); ufSet("description", r.description); showToast("Açıklama oluşturuldu"); } catch { showToast("Açıklama hatası", "error"); }
        finally { setDescLoading(false); }
    };

    const handleFileSelect = (e) => { const f = Array.from(e.target.files || []); setImgFiles(p => [...p, ...f.map(file => ({ file, preview: URL.createObjectURL(file), name: file.name }))].slice(0, 8)); if (fileRef.current) fileRef.current.value = ""; };
    const handleAddImgUrl = () => { const u = imgUrlInput.trim(); if (!u || !u.startsWith("http")) return; ufSet("imageUrls", [...uf.imageUrls, u].slice(0, 8)); setImgUrlInput(""); };
    const removeImg = (t, i) => { if (t === "file") setImgFiles(p => { const n = [...p]; if (n[i]?.preview) URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n; }); else ufSet("imageUrls", uf.imageUrls.filter((_, idx) => idx !== i)); };

    const loadCatLevel = async (parentId = "0", li = 0) => {
        setCatLoading(true);
        try { setCatLevels([]); } catch { showToast("Kategori yüklenemedi", "error"); }
        finally { setCatLoading(false); }
    };

    const handleCatSelect = (li, cat) => {
        setCatLevels(p => { const n = p.slice(0, li + 1); n[li] = { ...n[li], selected: cat }; return n; });
        const path = catLevels.slice(0, li).map(l => l.selected?.name).filter(Boolean); path.push(cat.name);
        ufSet("category", path.join(" > "));
        if (cat.hasChildren) loadCatLevel(String(cat.id), li + 1);
    };

    const handleCatSearch = (q) => {
        setCatSearch(q); if (catSearchRef.current) clearTimeout(catSearchRef.current);
        if (!q.trim()) { setCatResults([]); return; }
        catSearchRef.current = setTimeout(async () => { try { setCatResults([]); } catch {} }, 500);
    };

    const handleCreate = async () => {
        if (!uf.name || !uf.barcode || !uf.sku || !uf.price) return showToast("Ad, barkod, SKU ve fiyat zorunlu", "error");
        setUploadLoading(true);
        try {
            const imgs = [...uf.imageUrls, ...imgFiles.map(f => f.preview)].filter(Boolean);
            const r = await createAndDistribute({ name: uf.name.trim(), barcode: uf.barcode.trim(), sku: uf.sku.trim(), description: uf.description.trim(), price: Number(uf.price), listPrice: uf.listPrice ? Number(uf.listPrice) : Number(uf.price), stock: Number(uf.stock) || 0, category: uf.category.trim(), brand: uf.brand.trim(), images: imgs, targetMarketplaces: uf.targetMarketplaces });
            showToast(r.message || "Ürün oluşturuldu!");
            setUf({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "0", category: "", brand: "", imageUrls: [], targetMarketplaces: [] });
            setImgFiles([]); setCodeSugg(null); setCatLevels([]); setUploadStep(1); loadProducts(0); loadDashboard();
        } catch (e) {
            const errData = e.response?.data;
            if (e.response?.status === 409 && errData?.type) {
                // 🛡️ Duplike ürün hatası — kullanıcıya detaylı bilgi göster
                const conflict = errData.conflicts?.[errData.type];
                const conflictInfo = conflict ? ` → Mevcut: "${conflict.name}" (Model: ${conflict.sku || "-"}, Stok Kodu: ${conflict.barcode || "-"})` : "";
                showToast(`⚠️ ${errData.error}${conflictInfo}`, "error");
            } else {
                showToast("Hata: " + (errData?.error || e.message), "error");
            }
        }
        finally { setUploadLoading(false); }
    };

    const toggleTarget = (p) => setUf(prev => { const t = [...prev.targetMarketplaces]; const i = t.indexOf(p); if (i >= 0) t.splice(i, 1); else t.push(p); return { ...prev, targetMarketplaces: t }; });

    // ── Computed ──
    const totalPages = Math.ceil(total / LIMIT);
    const toggleSel = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleAll = () => selected.size === products.length ? setSelected(new Set()) : setSelected(new Set(products.map(p => p._id)));
    const db = dashboard || {};
    const dbP = db.products || {};

    /* ═══════════════════════════════════════════════════════════════
       PAYLAŞILAN ALT BİLEŞENLER
       ═══════════════════════════════════════════════════════════════ */
    const PlatformDots = ({ product }) => (
        <div>
            <div className="ud-pm-platforms">
                {PLATFORMS.map(pl => {
                    const ps = getPlStatus(product, pl);
                    return (
                        <div key={pl} className={`ud-pm-platform-dot ${ps.exists ? "" : "inactive"}`}
                            title={`${pl}: ${ps.exists ? ps.status : "Yok"}`}
                            style={{ background: ps.exists ? PL_COLOR[pl] + "20" : "transparent", color: PL_COLOR[pl] }}>
                            {PL_SHORT[pl]}
                            {ps.exists && (
                                <span className="status-indicator" style={{
                                    background: ps.status === "synced" || ps.status === "active" ? "var(--ud-pm-green)" : ps.status === "error" ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)"
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="ud-pm-platform-count">{(product.marketplaceMappings || []).filter(m => m.marketplaceName && m.syncStatus !== "error").length} platform</div>
        </div>
    );

    const Pagination = ({ currentPage, totalPages: tp, total: t, onPageChange }) => {
        if (tp <= 1) return null;
        return (
            <div className="ud-pm-pagination">
                <button className="ud-pm-btn sm accent outline" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}><FaChevronLeft /></button>
                <span className="page-info">{currentPage + 1} / {tp} <span className="total">({t})</span></span>
                <button className="ud-pm-btn sm accent outline" disabled={currentPage >= tp - 1} onClick={() => onPageChange(currentPage + 1)}><FaChevronRight /></button>
            </div>
        );
    };

    const Empty = ({ icon: Icon = FaBox, title, desc }) => (
        <div className="ud-pm-empty">
            <div className="icon"><Icon /></div>
            <div className="title">{title}</div>
            {desc && <div className="desc">{desc}</div>}
        </div>
    );

    const Loading = () => (
        <div className="ud-pm-loading">
            <div className="spinner-lg" />
            Yükleniyor...
        </div>
    );

    const Pill = ({ color, children }) => (
        <span className="ud-pm-pill" style={{ background: color + "15", color, border: `1px solid ${color}30` }}>{children}</span>
    );

    /* ═══════════════════════════════════════════════════════════════
       DASHBOARD KARTLARI
       ═══════════════════════════════════════════════════════════════ */
    const renderDashCards = () => {
        const cards = [
            { icon: <FaCubes />, label: "Toplam Ürün", val: dbP.total || total, color: "var(--ud-pm-accent)" },
            { icon: <FaCheckCircle />, label: "Sağlıklı", val: dbP.healthy || "—", color: "var(--ud-pm-green)" },
            { icon: <FaExclamationTriangle />, label: "Düşük Stok", val: dbP.lowStock || 0, color: "var(--ud-pm-yellow)" },
            { icon: <FaTimesCircle />, label: "Stok Yok", val: dbP.outOfStock || 0, color: "var(--ud-pm-red)" },
            { icon: <FaStore />, label: "Platform", val: (db.marketplaces || marketplaces || []).length, color: "var(--ud-pm-purple)" },
        ];
        return (
            <div className="ud-pm-dash-grid">
                {cards.map(c => (
                    <div key={c.label} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 1: ÜRÜN LİSTESİ
       ═══════════════════════════════════════════════════════════════ */
    const renderProducts = () => (
        <div>
            {/* Toolbar */}
            <div className="ud-pm-toolbar">
                <div className="ud-pm-search-wrap">
                    <span className="icon"><FaSearch /></span>
                    <input className="ud-pm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..." />
                </div>
                <select className="ud-pm-select" value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                    <option value="">Tüm Stok</option><option value="lowStock">Düşük</option><option value="outOfStock">Yok</option>
                </select>
                <div className="ud-pm-spacer" />
                {selected.size > 0 && <>
                    <Pill color="var(--ud-pm-accent)"><FaCheck style={{ fontSize: 9 }} /> {selected.size}</Pill>
                    <button className="ud-pm-btn sm purple" onClick={() => setBulkModal(true)}><FaRocket /> Dağıt</button>
                </>}
                <button className="ud-pm-btn sm green outline" onClick={handleExport} disabled={actionLoading === "export"}>
                    {actionLoading === "export" ? <span className="spinner" /> : <FaFileExcel />} Excel
                </button>
                <button className="ud-pm-btn sm accent" onClick={handleSyncAll} disabled={actionLoading === "sync-all"}>
                    {actionLoading === "sync-all" ? <span className="spinner" /> : <FaSync />} Çek
                </button>
                <button className="ud-pm-btn sm purple outline" onClick={handleDistributeUndistributed} disabled={actionLoading === "dist-undist"}
                    title="Platformlarda eksik olan ürünleri otomatik dağıt">
                    {actionLoading === "dist-undist" ? <span className="spinner" /> : <FaRocket />} Eksikleri Dağıt
                </button>
            </div>

            {/* Tablo */}
            <div className="ud-pm-table-wrap">
                <div className="ud-pm-table-scroll">
                    <table className="ud-pm-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}><input type="checkbox" className="ud-pm-checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} /></th>
                                <th>Ürün</th>
                                <th>Barkod / SKU</th>
                                <th className="right">Fiyat</th>
                                <th className="center">Stok</th>
                                <th className="center">Platformlar</th>
                                <th className="center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7}><Loading /></td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={7}><Empty icon={FaBox} title="Ürün bulunamadı" desc="Pazaryerlerinden çekin veya yeni ekleyin" /></td></tr>
                            ) : products.map((p, i) => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const isSel = selected.has(p._id);
                                return (
                                    <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                                        className={isSel ? "selected" : ""} onClick={() => openDetail(p._id)}>
                                        <td onClick={e => e.stopPropagation()}><input type="checkbox" className="ud-pm-checkbox" checked={isSel} onChange={() => toggleSel(p._id)} /></td>
                                        <td>
                                            <div className="product-cell">
                                                {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="product-img" />
                                                    : <div className="product-img-placeholder"><FaBox /></div>}
                                                <div>
                                                    <div className="product-name">{mp.name || "İsimsiz"}</div>
                                                    {mp.brand && <div className="product-brand">{mp.brand}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="mono">{mp.barcode || "—"}</div>
                                            <div className="mono-dim">{mp.sku || "—"}</div>
                                        </td>
                                        <td className="right">
                                            <div className="price">{fmt(mp.price)}</div>
                                            {mp.listPrice && mp.listPrice !== mp.price && <div className="price-old">{fmt(mp.listPrice)}</div>}
                                        </td>
                                        <td className="center">
                                            <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"}>
                                                {st.totalStock ?? mp.stock ?? 0}
                                            </span>
                                        </td>
                                        <td className="center"><PlatformDots product={p} /></td>
                                        <td className="center" onClick={e => e.stopPropagation()}>
                                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                                <button className="ud-pm-btn sm accent outline" onClick={() => openDetail(p._id)}><FaEye /></button>
                                                <button className="ud-pm-btn sm red outline" onClick={() => askDelete(p._id)}><FaTrash /></button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={page} totalPages={totalPages} total={total} onPageChange={p => loadProducts(p)} />
            </div>

            {/* Bulk Distribute Modal */}
            {ReactDOM.createPortal(
            <AnimatePresence>
                {bulkModal && (
                    <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBulkModal(false)}>
                        <motion.div className="ud-pm-modal" initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                            <h3 style={{ color: "var(--ud-pm-text)", margin: "0 0 14px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><FaRocket style={{ color: "var(--ud-pm-purple)" }} /> Toplu Dağıtım — {selected.size} Ürün</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {marketplaces.map(mp => (
                                    <button key={mp._id} className="ud-pm-btn" style={{ background: PL_COLOR[mp.marketplaceName] || "var(--ud-pm-accent)", justifyContent: "flex-start" }}
                                        onClick={() => handleBulkDistribute([mp.marketplaceName])} disabled={actionLoading === "bulk"}>
                                        {actionLoading === "bulk" ? <span className="spinner" /> : <FaRocket />} {mp.marketplaceName}
                                    </button>
                                ))}
                                {marketplaces.length > 1 && (
                                    <button className="ud-pm-btn accent" onClick={() => handleBulkDistribute(marketplaces.map(m => m.marketplaceName))} disabled={actionLoading === "bulk"}>
                                        <FaGlobe /> Tümüne Dağıt
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setBulkModal(false)} style={{ marginTop: 12, background: "none", border: "none", color: "var(--ud-pm-text-dim)", cursor: "pointer", fontSize: 12 }}>İptal</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TAB 2: ÜRÜN YÜKLE (3 Adımlı Wizard)
       ═══════════════════════════════════════════════════════════════ */
    const renderUpload = () => {
        const totalImgs = uf.imageUrls.length + imgFiles.length;
        const canSubmit = uf.name && uf.barcode && uf.sku && uf.price;

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Steps */}
                <div className="ud-pm-steps">
                    {[{ num: 1, label: "Temel Bilgiler", icon: <FaEdit /> }, { num: 2, label: "Kategori & Görseller", icon: <FaImage /> }, { num: 3, label: "Açıklama & Gönder", icon: <FaCloudUploadAlt /> }].map(s => (
                        <button key={s.num} className={`ud-pm-step ${uploadStep === s.num ? "active" : ""} ${uploadStep > s.num ? "done" : ""}`} onClick={() => setUploadStep(s.num)}>
                            <span className="step-num">{uploadStep > s.num ? <FaCheck /> : s.icon}</span>
                            <div>
                                <div className="step-label">Adım {s.num}</div>
                                <div className="step-desc">{s.label}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ADIM 1 */}
                {uploadStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div className="ud-pm-card">
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaEdit /></span>
                                <div><div className="title">Temel Bilgiler</div><div className="subtitle">Ürün adı, fiyat, stok ve marka</div></div>
                            </div>
                            <div className="ud-pm-grid-2">
                                <div className="ud-pm-field full">
                                    <label><FaBox style={{ fontSize: 10 }} /> Ürün Adı <span className="required">*</span></label>
                                    <input value={uf.name} onChange={e => ufSet("name", e.target.value)} placeholder="Ürün başlığı..." />
                                </div>
                                <div className="ud-pm-field">
                                    <label><FaTag style={{ fontSize: 10 }} /> Marka</label>
                                    <input value={uf.brand} onChange={e => ufSet("brand", e.target.value)} placeholder="Marka" />
                                </div>
                                <div className="ud-pm-field">
                                    <label><FaWarehouse style={{ fontSize: 10 }} /> Stok</label>
                                    <input type="number" value={uf.stock} onChange={e => ufSet("stock", e.target.value)} placeholder="0" />
                                </div>
                                <div className="ud-pm-field">
                                    <label><FaDollarSign style={{ fontSize: 10 }} /> Satış Fiyatı (₺) <span className="required">*</span></label>
                                    <input type="number" value={uf.price} onChange={e => ufSet("price", e.target.value)} placeholder="0.00" />
                                </div>
                                <div className="ud-pm-field">
                                    <label><FaTag style={{ fontSize: 10 }} /> Liste Fiyatı (₺)</label>
                                    <input type="number" value={uf.listPrice} onChange={e => ufSet("listPrice", e.target.value)} placeholder="Boş = satış fiyatı" />
                                </div>
                            </div>
                        </div>
                        <div className="ud-pm-card">
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaBarcode /></span>
                                <div style={{ flex: 1 }}><div className="title">Barkod & SKU</div><div className="subtitle">Manuel girin veya öneri alın</div></div>
                                <button className="ud-pm-btn sm purple" onClick={handleSuggestCodes} disabled={!uf.name.trim() || codeLoading}>
                                    {codeLoading ? <span className="spinner" /> : <FaMagic />} Öneri
                                </button>
                            </div>
                            <div className="ud-pm-grid-2">
                                <div className="ud-pm-field">
                                    <label><FaBarcode style={{ fontSize: 10 }} /> Barkod <span className="required">*</span></label>
                                    <input value={uf.barcode} onChange={e => ufSet("barcode", e.target.value)} placeholder="Benzersiz barkod" />
                                </div>
                                <div className="ud-pm-field">
                                    <label><FaTag style={{ fontSize: 10 }} /> SKU <span className="required">*</span></label>
                                    <input value={uf.sku} onChange={e => ufSet("sku", e.target.value)} placeholder="Stok kodu" />
                                </div>
                            </div>
                            {codeSugg && (
                                <div className="ud-pm-grid-2" style={{ marginTop: 12 }}>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Barkod Önerileri</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {(codeSugg.barcodes || []).map((b, i) => (
                                                <button key={i} className={`ud-pm-code-chip ${!b.available ? "unavailable" : ""}`}
                                                    onClick={() => b.available && ufSet("barcode", b.value)} disabled={!b.available}>
                                                    {b.available ? <FaCheck style={{ fontSize: 8 }} /> : <FaTimes style={{ fontSize: 8 }} />} {b.value}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>SKU Önerileri</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {(codeSugg.skus || []).map((s, i) => (
                                                <button key={i} className={`ud-pm-code-chip ${!s.available ? "unavailable" : ""}`}
                                                    onClick={() => s.available && ufSet("sku", s.value)} disabled={!s.available}>
                                                    {s.available ? <FaCheck style={{ fontSize: 8 }} /> : <FaTimes style={{ fontSize: 8 }} />} {s.value}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button className="ud-pm-btn accent" onClick={() => setUploadStep(2)} disabled={!uf.name.trim()}><span>İleri</span> <FaArrowRight /></button>
                        </div>
                    </motion.div>
                )}

                {/* ADIM 2 */}
                {uploadStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div className="ud-pm-card">
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaSitemap /></span>
                                <div style={{ flex: 1 }}><div className="title">Kategori</div><div className="subtitle">Platform kategorisi seçin</div></div>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {["Trendyol", "N11"].map(p => (
                                        <button key={p} className={`ud-pm-tone-btn ${catPlatform === p ? "active" : ""}`}
                                            style={catPlatform === p ? { borderColor: PL_COLOR[p], color: PL_COLOR[p], background: PL_COLOR[p] + "15" } : {}}
                                            onClick={() => { setCatPlatform(p); setCatLevels([]); setCatResults([]); setCatSearch(""); }}>
                                            {PL_SHORT[p]} {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {uf.category && (
                                <div className="ud-pm-cat-selected">
                                    <FaCheckCircle style={{ color: "var(--ud-pm-green)", fontSize: 13 }} />
                                    <span className="cat-text">{uf.category}</span>
                                    <button className="clear-btn" onClick={() => { ufSet("category", ""); setCatLevels([]); }}><FaTimes /></button>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                <div className="ud-pm-search-wrap" style={{ maxWidth: "none" }}>
                                    <span className="icon"><FaSearch /></span>
                                    <input className="ud-pm-search" value={catSearch} onChange={e => handleCatSearch(e.target.value)} placeholder={`${catPlatform} kategorilerinde ara...`} />
                                </div>
                                {!catSearch && catLevels.length === 0 && (
                                    <button className="ud-pm-btn sm blue" onClick={() => loadCatLevel("0", 0)} disabled={catLoading}>
                                        {catLoading ? <span className="spinner" /> : <FaFolderOpen />} Aç
                                    </button>
                                )}
                            </div>
                            {catSearch && catResults.length > 0 && (
                                <div className="ud-pm-cat-search-results">
                                    {catResults.map((c, i) => (
                                        <div key={c.id || i} className="ud-pm-cat-search-item"
                                            onClick={() => { ufSet("category", c.path || c.name); setCatSearch(""); setCatResults([]); }}>
                                            <div className="name">{c.name}</div>
                                            {c.path && <div className="path">{c.path}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!catSearch && catLevels.length > 0 && (
                                <div className="ud-pm-cat-levels">
                                    {catLevels.map((lv, li) => (
                                        <div key={li} className="ud-pm-cat-column">
                                            <div className="col-header">{li === 0 ? "Ana Kategori" : `Alt ${li}`}</div>
                                            <div className="col-list">
                                                {lv.categories.map(c => {
                                                    const sel = lv.selected?.id === c.id;
                                                    return (
                                                        <div key={c.id} className={`ud-pm-cat-item ${sel ? "selected" : ""}`} onClick={() => handleCatSelect(li, c)}>
                                                            <span className="cat-icon" style={{ color: c.isLeaf ? "var(--ud-pm-green)" : "var(--ud-pm-yellow)" }}>
                                                                {c.isLeaf ? <FaCheck /> : <FaFolderOpen />}
                                                            </span>
                                                            <span className="cat-name">{c.name}</span>
                                                            {c.hasChildren && <span className="cat-arrow"><FaChevronRight /></span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {catLoading && <div style={{ minWidth: 170, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ud-pm-text-dim)" }}><FaSpinner className="ud-pm-spin" /></div>}
                                </div>
                            )}
                        </div>
                        <div className="ud-pm-card">
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaImage /></span>
                                <div><div className="title">Görseller</div><div className="subtitle">Dosya veya URL (maks. 8)</div></div>
                                <Pill color="var(--ud-pm-accent)">{totalImgs}/8</Pill>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
                                <button className="ud-pm-btn sm purple" onClick={() => fileRef.current?.click()} disabled={totalImgs >= 8}><FaFolderOpen /> Dosya</button>
                                <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 180 }}>
                                    <input className="ud-pm-search" style={{ paddingLeft: 12 }} value={imgUrlInput} onChange={e => setImgUrlInput(e.target.value)} placeholder="https://... görsel URL" onKeyDown={e => e.key === "Enter" && handleAddImgUrl()} />
                                    <button className="ud-pm-btn sm green" onClick={handleAddImgUrl} disabled={!imgUrlInput.trim() || totalImgs >= 8}><FaPlus /></button>
                                </div>
                            </div>
                            {totalImgs > 0 ? (
                                <div className="ud-pm-img-grid">
                                    {uf.imageUrls.map((u, i) => (
                                        <div key={`u${i}`} className="ud-pm-img-item">
                                            <img src={u} alt="" onError={e => e.target.style.display = "none"} />
                                            <button className="remove-btn" onClick={() => removeImg("url", i)}><FaTimes /></button>
                                        </div>
                                    ))}
                                    {imgFiles.map((f, i) => (
                                        <div key={`f${i}`} className="ud-pm-img-item">
                                            <img src={f.preview} alt="" />
                                            <button className="remove-btn" onClick={() => removeImg("file", i)}><FaTimes /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="ud-pm-img-dropzone" onClick={() => fileRef.current?.click()}>
                                    <div className="icon"><FaImage /></div>
                                    <div className="text">Tıklayın veya URL yapıştırın</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <button className="ud-pm-btn muted" onClick={() => setUploadStep(1)}><FaArrowLeft /> Geri</button>
                            <button className="ud-pm-btn accent" onClick={() => setUploadStep(3)}>İleri <FaArrowRight /></button>
                        </div>
                    </motion.div>
                )}

                {/* ADIM 3 */}
                {uploadStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="ud-pm-upload-final">
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div className="ud-pm-card">
                                <div className="ud-pm-card-header">
                                    <span className="icon"><FaEdit /></span>
                                    <div style={{ flex: 1 }}><div className="title">Açıklama</div><div className="subtitle">Yazın veya AI ile oluşturun</div></div>
                                </div>
                                <div className="ud-pm-tone-group" style={{ marginBottom: 10 }}>
                                    <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700 }}><FaMagic /> Ton:</span>
                                    {[{ id: "professional", l: "Profesyonel" }, { id: "friendly", l: "Samimi" }, { id: "luxury", l: "Lüks" }, { id: "minimal", l: "Minimal" }].map(t => (
                                        <button key={t.id} className={`ud-pm-tone-btn ${descTone === t.id ? "active" : ""}`} onClick={() => setDescTone(t.id)}>{t.l}</button>
                                    ))}
                                    <div className="ud-pm-spacer" />
                                    <button className="ud-pm-btn sm purple" onClick={handleGenDesc} disabled={!uf.name.trim() || descLoading}>
                                        {descLoading ? <span className="spinner" /> : <FaMagic />} Oluştur
                                    </button>
                                </div>
                                <div className="ud-pm-field">
                                    <textarea value={uf.description} onChange={e => ufSet("description", e.target.value)} placeholder="Ürün açıklaması..." rows={10} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                    <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 9 }}>{uf.description.length} karakter</span>
                                    {uf.description && <button onClick={() => ufSet("description", "")} style={{ background: "none", border: "none", color: "var(--ud-pm-text-dim)", cursor: "pointer", fontSize: 10 }}><FaTrash style={{ fontSize: 9 }} /> Temizle</button>}
                                </div>
                            </div>
                            <button className="ud-pm-btn muted" onClick={() => setUploadStep(2)} style={{ alignSelf: "flex-start" }}><FaArrowLeft /> Geri</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div className="ud-pm-card">
                                <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><FaRocket style={{ color: "var(--ud-pm-purple)" }} /> Platformlar</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {marketplaces.map(mp => {
                                        const sel = uf.targetMarketplaces.includes(mp.marketplaceName);
                                        const plColor = PL_COLOR[mp.marketplaceName] || "var(--ud-pm-accent)";
                                        return (
                                            <div key={mp._id} className={`ud-pm-target-item ${sel ? "selected" : ""}`}
                                                style={sel ? { background: plColor + "12", borderColor: plColor } : {}}
                                                onClick={() => toggleTarget(mp.marketplaceName)}>
                                                <span className="mp-icon" style={{ color: plColor }}><FaStore /></span>
                                                <span className="mp-name">{mp.marketplaceName}</span>
                                                <span className="ud-pm-target-check" style={sel ? { borderColor: plColor, background: plColor } : {}}>
                                                    {sel && <FaCheck />}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="ud-pm-card ud-pm-summary">
                                <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}><FaClipboardList style={{ fontSize: 9 }} /> Özet</div>
                                {[
                                    ["Ürün", uf.name || "—", "var(--ud-pm-text)"], ["Barkod", uf.barcode || "—", "var(--ud-pm-accent)"], ["SKU", uf.sku || "—", "var(--ud-pm-purple)"],
                                    ["Fiyat", uf.price ? fmt(uf.price) : "—", "var(--ud-pm-green)"], ["Stok", uf.stock || "0", "var(--ud-pm-text)"],
                                    ...(uf.category ? [["Kategori", uf.category, "var(--ud-pm-yellow)"]] : []), ...(uf.brand ? [["Marka", uf.brand, "var(--ud-pm-blue)"]] : []),
                                    ["Görseller", `${totalImgs} adet`, "var(--ud-pm-text)"], ["Açıklama", uf.description ? "✓" : "—", uf.description ? "var(--ud-pm-green)" : "var(--ud-pm-text-dim)"],
                                ].map(([k, v, c]) => (
                                    <div key={k} className="ud-pm-summary-row">
                                        <span className="key">{k}</span>
                                        <span className="val" style={{ color: c }}>{v}</span>
                                    </div>
                                ))}
                                {uf.targetMarketplaces.length > 0 && (
                                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                                        {uf.targetMarketplaces.map(t => <Pill key={t} color={PL_COLOR[t] || "var(--ud-pm-accent)"}>{PL_SHORT[t]} {t}</Pill>)}
                                    </div>
                                )}
                            </div>
                            <button className="ud-pm-btn accent" onClick={handleCreate} disabled={!canSubmit || uploadLoading} style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }}>
                                {uploadLoading ? <span className="spinner" /> : uf.targetMarketplaces.length > 0 ? <FaRocket /> : <FaSave />}
                                {uf.targetMarketplaces.length > 0 ? `Oluştur & ${uf.targetMarketplaces.length} Platforma Dağıt` : "Kaydet"}
                            </button>
                            {!canSubmit && <div style={{ color: "var(--ud-pm-yellow)", fontSize: 10, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><FaExclamationTriangle /> Ad, barkod, SKU ve fiyat zorunlu</div>}
                        </div>
                    </motion.div>
                )}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 3: FİYAT & STOK
       ═══════════════════════════════════════════════════════════════ */
    const renderPriceStock = () => (
        <div>
            <div className="ud-pm-toolbar">
                <div className="ud-pm-search-wrap" style={{ maxWidth: 300 }}>
                    <span className="icon"><FaSearch /></span>
                    <input className="ud-pm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara..." />
                </div>
                <select className="ud-pm-select" value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                    <option value="">Tüm</option><option value="lowStock">Düşük</option><option value="outOfStock">Yok</option>
                </select>
                <div className="ud-pm-spacer" />
                <Pill color="var(--ud-pm-accent)">{total} ürün</Pill>
            </div>
            <div className="ud-pm-table-wrap">
                <div className="ud-pm-table-scroll">
                    <table className="ud-pm-table" style={{ minWidth: 750 }}>
                        <thead>
                            <tr>
                                <th>Ürün</th>
                                <th className="right">Satış Fiyatı</th>
                                <th className="center">Stok</th>
                                <th className="center">Güvenlik</th>
                                <th className="center">Durum</th>
                                {PLATFORMS.slice(0, 3).map(pl => <th key={pl} className="center" style={{ fontSize: 10 }}>{PL_SHORT[pl]}</th>)}
                                <th className="center">Kaydet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8 + Math.min(PLATFORMS.length, 3)}><Loading /></td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={8 + Math.min(PLATFORMS.length, 3)}><Empty icon={FaDollarSign} title="Ürün bulunamadı" /></td></tr>
                            ) : products.map(p => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const ed = editMap[p._id] || {};
                                return (
                                    <tr key={p._id}>
                                        <td>
                                            <div className="product-name">{mp.name}</div>
                                            <div className="mono-dim">{mp.barcode}</div>
                                        </td>
                                        <td className="right">
                                            <input type="number" step="0.01" className="ud-pm-inline-input price-input"
                                                value={ed.price !== undefined ? ed.price : (mp.price || 0)}
                                                onChange={e => setEditMap(p2 => ({ ...p2, [p._id]: { ...p2[p._id], price: e.target.value } }))} />
                                        </td>
                                        <td className="center">
                                            <input type="number" min="0" className="ud-pm-inline-input stock-input"
                                                style={{ color: st.isOutOfStock ? "var(--ud-pm-red)" : st.isLowStock ? "var(--ud-pm-yellow)" : "var(--ud-pm-green)" }}
                                                value={ed.stock !== undefined ? ed.stock : (st.totalStock ?? 0)}
                                                onChange={e => setEditMap(p2 => ({ ...p2, [p._id]: { ...p2[p._id], stock: e.target.value } }))} />
                                        </td>
                                        <td className="center" style={{ color: "var(--ud-pm-text-dim)", fontSize: 11 }}><FaShieldAlt style={{ fontSize: 9 }} /> {st.safetyStock || 0}</td>
                                        <td className="center">
                                            {st.isOutOfStock ? <Pill color="var(--ud-pm-red)">Yok</Pill> : st.isLowStock ? <Pill color="var(--ud-pm-yellow)">Düşük</Pill> : <Pill color="var(--ud-pm-green)">OK</Pill>}
                                        </td>
                                        {PLATFORMS.slice(0, 3).map(pl => { const ps = getPlStatus(p, pl); return (
                                            <td key={pl} className="center">
                                                {ps.exists ? <span style={{ color: "var(--ud-pm-text)", fontSize: 11, fontWeight: 600 }}>{ps.price ? fmt(ps.price) : "—"}</span> : <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 10 }}>—</span>}
                                            </td>
                                        ); })}
                                        <td className="center">
                                            <button className="ud-pm-btn sm green" disabled={actionLoading === `s-${p._id}` || actionLoading === `p-${p._id}`}
                                                onClick={() => {
                                                    const newPrice = ed.price !== undefined ? ed.price : mp.price;
                                                    const newStock = ed.stock !== undefined ? ed.stock : st.totalStock;
                                                    if (ed.price !== undefined) handlePriceUpdate(p._id, newPrice, newPrice);
                                                    if (ed.stock !== undefined) handleStockUpdate(p._id, newStock);
                                                    if (ed.price === undefined && ed.stock === undefined) showToast("Değişiklik yok", "error");
                                                    setEditMap(p2 => { const n = { ...p2 }; delete n[p._id]; return n; });
                                                }}>
                                                {actionLoading === `s-${p._id}` || actionLoading === `p-${p._id}` ? <span className="spinner" /> : <FaSave />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={page} totalPages={totalPages} total={total} onPageChange={p => loadProducts(p)} />
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TAB: KATEGORİLER
       ═══════════════════════════════════════════════════════════════ */

    // ── Kategori Ağacı Yükle (lazy — tıklanınca alt kategorileri çeker) ──
    const loadCatTreeNode = async (platform, parentId = "0") => {
        const key = `${platform}::${parentId}`;
        if (catTreeData[key]?.loaded) return;
        setCatTreeLoading(key);
        try {
            const r = { categories: [] };
            setCatTreeData(prev => ({
                ...prev,
                [key]: { children: r.categories || [], loaded: true }
            }));
        } catch { showToast("Kategori yüklenemedi", "error"); }
        finally { setCatTreeLoading(""); }
    };

    const toggleCatNode = (platform, nodeId, hasChildren) => {
        const key = `${platform}::${nodeId}`;
        setCatExpanded(prev => {
            const n = new Set(prev);
            if (n.has(key)) { n.delete(key); } else { n.add(key); if (hasChildren) loadCatTreeNode(platform, String(nodeId)); }
            return n;
        });
    };

    // ── Kategori Arama ──
    const handleCatSearchChange = (q) => {
        setCatSearchQ(q);
        if (catSearchTimer.current) clearTimeout(catSearchTimer.current);
        if (!q.trim()) { setCatSearchResults([]); return; }
        catSearchTimer.current = setTimeout(async () => {
            setCatSearchLoading(true);
            try {
                const r = { categories: [] };
                setCatSearchResults(r.categories || []);
            } catch { setCatSearchResults([]); }
            finally { setCatSearchLoading(false); }
        }, 500);
    };

    // ── Master Kategori (kaldırıldı — stub) ──
    const loadMasterCategories = async () => {
        setMasterCatLoading(true);
        setMasterCategories([]);
        setMasterCatLoading(false);
    };

    const handleCreateMasterCat = async () => {
        showToast("Kategori eşleştirme özelliği kaldırıldı", "info");
    };

    const handleMapCategory = async (masterCatId, platformName, catId, catName, catPath) => {
        try {
            showToast("Kategori eşleştirme özelliği kaldırıldı", "info");
            setMappingTarget(null);
            setCatSelectedNode(null);
        } catch (e) { showToast(e.response?.data?.error || "Eşleştirme hatası", "error"); }
    };

    // ── Ürünleri Kategoriye Göre Grupla ──
    const loadCatProducts = async () => {
        setCatProdLoading(true);
        try {
            const r = await getProducts({ page: 0, limit: 9999 });
            setCatProducts(r.products || []);
        } catch {}
        finally { setCatProdLoading(false); }
    };

    // Kategori tab açıldığında yükle
    useEffect(() => {
        if (tab === "categories") {
            loadCatTreeNode(catPlatformSel, "0");
            loadMasterCategories();
        }
    }, [tab]); // eslint-disable-line

    useEffect(() => {
        if (tab === "categories") {
            setCatTreeData({});
            setCatExpanded(new Set());
            setCatSearchQ("");
            setCatSearchResults([]);
            loadCatTreeNode(catPlatformSel, "0");
        }
    }, [catPlatformSel]); // eslint-disable-line

    useEffect(() => {
        if (tab === "categories" && catTab === "products") loadCatProducts();
    }, [catTab]); // eslint-disable-line

    // ── Recursive Tree Renderer ──
    const CatTreeNode = ({ platform, node, depth = 0 }) => {
        const key = `${platform}::${node.id}`;
        const isExpanded = catExpanded.has(key);
        const isLoading = catTreeLoading === key;
        const children = catTreeData[key]?.children || [];
        const isSelected = catSelectedNode?.id === node.id && catSelectedNode?.platform === platform;

        return (
            <div>
                <div
                    className={`ud-pm-cat-tree-node ${isSelected ? "selected" : ""} ${node.isLeaf ? "leaf" : ""}`}
                    style={{ paddingLeft: 12 + depth * 18 }}
                    onClick={() => {
                        if (node.hasChildren) toggleCatNode(platform, node.id, true);
                        setCatSelectedNode({ id: node.id, name: node.name, path: node.path || node.name, platform });
                    }}
                >
                    <span className="ud-pm-cat-tree-toggle" style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                        {node.hasChildren ? (isLoading ? <FaSpinner className="ud-pm-spin" style={{ fontSize: 9 }} /> : isExpanded ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />) : <span style={{ width: 8 }} />}
                    </span>
                    <span className="ud-pm-cat-tree-icon" style={{ color: node.isLeaf ? "var(--ud-pm-green)" : "var(--ud-pm-yellow)", fontSize: 10 }}>
                        {node.isLeaf ? <FaTag /> : <FaFolderOpen />}
                    </span>
                    <span className="ud-pm-cat-tree-name">{node.name}</span>
                    {isSelected && mappingTarget && (
                        <button className="ud-pm-btn sm green" style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 9 }}
                            onClick={e => { e.stopPropagation(); handleMapCategory(mappingTarget._id, platform, node.id, node.name, node.path); }}>
                            <FaCheck /> Eşleştir
                        </button>
                    )}
                </div>
                {isExpanded && children.length > 0 && (
                    <div className="ud-pm-cat-tree-children">
                        {children.map(child => <CatTreeNode key={child.id} platform={platform} node={child} depth={depth + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    const renderCategories = () => {
        const catSubTabs = [
            { id: "browse", icon: <FaFolderOpen />, label: "PY Kategorileri" },
            { id: "mapping", icon: <FaSitemap />, label: "Eşleştirme Merkezi" },
            { id: "products", icon: <FaBox />, label: "Ürün Kategorileri" },
        ];

        // Ürünleri kategoriye göre grupla
        const groupedProducts = {};
        for (const p of catProducts) {
            const cat = p.masterProduct?.category || "Kategorisiz";
            if (!groupedProducts[cat]) groupedProducts[cat] = [];
            groupedProducts[cat].push(p);
        }
        const sortedCatKeys = Object.keys(groupedProducts).sort((a, b) => a === "Kategorisiz" ? 1 : b === "Kategorisiz" ? -1 : a.localeCompare(b, "tr"));

        // Master kategorileri ağaç yapısına dönüştür
        const rootMasterCats = masterCategories.filter(c => !c.masterCategory?.parentCategory);
        const childMasterCats = (parentId) => masterCategories.filter(c => c.masterCategory?.parentCategory === parentId);

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Alt Tab Bar */}
                <div className="ud-pm-tabs" style={{ marginBottom: 0 }}>
                    {catSubTabs.map(t => (
                        <button key={t.id} className={`ud-pm-tab ${catTab === t.id ? "active" : ""}`} onClick={() => setCatTab(t.id)}>
                            <span className="ud-pm-tab-icon">{t.icon}</span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── ALT TAB 1: PY Kategorileri (Açılır-Kapanır Ağaç) ── */}
                {catTab === "browse" && (
                    <div style={{ display: "flex", gap: 14 }}>
                        {/* Sol: Ağaç */}
                        <div className="ud-pm-card" style={{ flex: 2, minHeight: 400 }}>
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaFolderOpen /></span>
                                <div style={{ flex: 1 }}>
                                    <div className="title">Pazaryeri Kategori Ağacı</div>
                                    <div className="subtitle">Kategorileri açılır-kapanır şekilde gezin</div>
                                </div>
                            </div>

                            {/* Platform Seçici */}
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {PLATFORMS.filter(p => p === "Trendyol" || p === "N11" || p === "ÇiçekSepeti").map(p => (
                                    <button key={p} className={`ud-pm-tone-btn ${catPlatformSel === p ? "active" : ""}`}
                                        style={catPlatformSel === p ? { borderColor: PL_COLOR[p], color: PL_COLOR[p], background: PL_COLOR[p] + "15" } : {}}
                                        onClick={() => setCatPlatformSel(p)}>
                                        {PL_SHORT[p]} {p}
                                    </button>
                                ))}
                            </div>

                            {/* Arama */}
                            <div className="ud-pm-search-wrap" style={{ maxWidth: "none", marginBottom: 10 }}>
                                <span className="icon"><FaSearch /></span>
                                <input className="ud-pm-search" value={catSearchQ} onChange={e => handleCatSearchChange(e.target.value)}
                                    placeholder={`${catPlatformSel} kategorilerinde ara...`} />
                                {catSearchLoading && <FaSpinner className="ud-pm-spin" style={{ position: "absolute", right: 10, top: 10, fontSize: 11, color: "var(--ud-pm-text-dim)" }} />}
                            </div>

                            {/* Arama Sonuçları */}
                            {catSearchQ.trim() && catSearchResults.length > 0 ? (
                                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                    {catSearchResults.map((c, i) => (
                                        <div key={c.id || i}
                                            className={`ud-pm-cat-tree-node leaf ${catSelectedNode?.id === c.id ? "selected" : ""}`}
                                            style={{ paddingLeft: 12 }}
                                            onClick={() => setCatSelectedNode({ id: c.id, name: c.name, path: c.path || c.name, platform: catPlatformSel })}>
                                            <span className="ud-pm-cat-tree-icon" style={{ color: "var(--ud-pm-green)", fontSize: 10 }}><FaTag /></span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="ud-pm-cat-tree-name">{c.name}</div>
                                                {c.path && <div style={{ fontSize: 9, color: "var(--ud-pm-text-dim)", marginTop: 1 }}>{c.path}</div>}
                                            </div>
                                            {catSelectedNode?.id === c.id && mappingTarget && (
                                                <button className="ud-pm-btn sm green" style={{ padding: "2px 8px", fontSize: 9 }}
                                                    onClick={e => { e.stopPropagation(); handleMapCategory(mappingTarget._id, catPlatformSel, c.id, c.name, c.path); }}>
                                                    <FaCheck /> Eşleştir
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : catSearchQ.trim() && !catSearchLoading ? (
                                <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 12, textAlign: "center", padding: 20 }}>Sonuç bulunamadı</div>
                            ) : (
                                /* Ağaç Görünümü */
                                <div style={{ maxHeight: 450, overflowY: "auto" }}>
                                    {catTreeLoading === `${catPlatformSel}::0` ? (
                                        <Loading />
                                    ) : (catTreeData[`${catPlatformSel}::0`]?.children || []).length === 0 ? (
                                        <Empty icon={FaFolderOpen} title="Kategori bulunamadı" desc="Platform bağlantısını kontrol edin" />
                                    ) : (
                                        (catTreeData[`${catPlatformSel}::0`]?.children || []).map(node => (
                                            <CatTreeNode key={node.id} platform={catPlatformSel} node={node} depth={0} />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sağ: Seçili Kategori Detay */}
                        <div className="ud-pm-card" style={{ flex: 1, minWidth: 260 }}>
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaInfoCircle /></span>
                                <div><div className="title">Seçili Kategori</div></div>
                            </div>
                            {catSelectedNode ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Kategori Adı</div>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 14, fontWeight: 700 }}>{catSelectedNode.name}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Tam Yol</div>
                                        <div style={{ color: "var(--ud-pm-text-sub)", fontSize: 11, lineHeight: 1.5 }}>{catSelectedNode.path}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Platform</div>
                                        <Pill color={PL_COLOR[catSelectedNode.platform] || "var(--ud-pm-accent)"}>{catSelectedNode.platform}</Pill>
                                    </div>
                                    <div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>ID</div>
                                        <div style={{ color: "var(--ud-pm-accent)", fontSize: 12, fontFamily: "monospace" }}>{catSelectedNode.id}</div>
                                    </div>
                                    {mappingTarget && (
                                        <button className="ud-pm-btn green" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
                                            onClick={() => handleMapCategory(mappingTarget._id, catSelectedNode.platform, catSelectedNode.id, catSelectedNode.name, catSelectedNode.path)}>
                                            <FaCheck /> "{mappingTarget.masterCategory?.name}" ile Eşleştir
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 12, textAlign: "center", padding: "30px 10px" }}>
                                    <FaFolderOpen style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }} /><br />
                                    Soldan bir kategori seçin
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── ALT TAB 2: Eşleştirme Merkezi ── */}
                {catTab === "mapping" && (
                    <div style={{ display: "flex", gap: 14 }}>
                        {/* Sol: Master Kategoriler */}
                        <div className="ud-pm-card" style={{ flex: 1, minHeight: 400 }}>
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaSitemap /></span>
                                <div style={{ flex: 1 }}>
                                    <div className="title">Master Kategoriler</div>
                                    <div className="subtitle">Kendi kategori ağacınızı oluşturun</div>
                                </div>
                                <button className="ud-pm-btn sm accent outline" onClick={loadMasterCategories} disabled={masterCatLoading}>
                                    {masterCatLoading ? <span className="spinner" /> : <FaSync />}
                                </button>
                            </div>

                            {/* Yeni Kategori Formu */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                <input className="ud-pm-search" style={{ paddingLeft: 12, flex: 1 }}
                                    value={masterCatForm.name} onChange={e => setMasterCatForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Yeni kategori adı..." onKeyDown={e => e.key === "Enter" && handleCreateMasterCat()} />
                                <select className="ud-pm-select" style={{ maxWidth: 140 }}
                                    value={masterCatForm.parent} onChange={e => setMasterCatForm(p => ({ ...p, parent: e.target.value }))}>
                                    <option value="">Ana Kategori</option>
                                    {rootMasterCats.map(c => (
                                        <option key={c._id} value={c._id}>{c.masterCategory?.name}</option>
                                    ))}
                                </select>
                                <button className="ud-pm-btn sm green" onClick={handleCreateMasterCat}><FaPlus /></button>
                            </div>

                            {/* Master Kategori Ağacı */}
                            <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                {masterCatLoading ? <Loading /> : rootMasterCats.length === 0 ? (
                                    <Empty icon={FaSitemap} title="Henüz kategori yok" desc="Yukarıdan yeni kategori ekleyin" />
                                ) : rootMasterCats.map(cat => {
                                    const isExp = masterCatExpanded.has(cat._id);
                                    const children = childMasterCats(cat._id);
                                    const mpCats = cat.marketplaceCategories || [];
                                    const isMapping = mappingTarget?._id === cat._id;

                                    return (
                                        <div key={cat._id}>
                                            <div className={`ud-pm-cat-tree-node ${isMapping ? "selected" : ""}`}
                                                style={{ paddingLeft: 12 }}
                                                onClick={() => setMasterCatExpanded(prev => { const n = new Set(prev); n.has(cat._id) ? n.delete(cat._id) : n.add(cat._id); return n; })}>
                                                <span className="ud-pm-cat-tree-toggle" style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                                                    {(children.length > 0 || mpCats.length > 0) ? (isExp ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />) : <span style={{ width: 8 }} />}
                                                </span>
                                                <span className="ud-pm-cat-tree-icon" style={{ color: "var(--ud-pm-accent)", fontSize: 11 }}><FaFolderOpen /></span>
                                                <span className="ud-pm-cat-tree-name" style={{ fontWeight: 700 }}>{cat.masterCategory?.name}</span>
                                                <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
                                                    {mpCats.length > 0 && <Pill color="var(--ud-pm-purple)">{mpCats.length} PY</Pill>}
                                                    <button className={`ud-pm-btn sm ${isMapping ? "green" : "accent outline"}`}
                                                        style={{ padding: "2px 8px", fontSize: 9 }}
                                                        onClick={e => { e.stopPropagation(); setMappingTarget(isMapping ? null : cat); setCatTab("browse"); }}>
                                                        {isMapping ? <><FaTimes /> İptal</> : <><FaPlus /> Eşleştir</>}
                                                    </button>
                                                </span>
                                            </div>

                                            {isExp && (
                                                <div>
                                                    {/* Eşleştirilmiş PY Kategorileri */}
                                                    {mpCats.map((mc, i) => (
                                                        <div key={i} className="ud-pm-cat-tree-node leaf" style={{ paddingLeft: 42 }}>
                                                            <Pill color={PL_COLOR[mc.marketplaceName] || "var(--ud-pm-accent)"}>{PL_SHORT[mc.marketplaceName] || mc.marketplaceName}</Pill>
                                                            <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 11, flex: 1 }}>{mc.categoryName}</span>
                                                            <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontFamily: "monospace" }}>ID: {mc.categoryId}</span>
                                                        </div>
                                                    ))}
                                                    {/* Alt Kategoriler */}
                                                    {children.map(child => {
                                                        const childMpCats = child.marketplaceCategories || [];
                                                        const childExp = masterCatExpanded.has(child._id);
                                                        return (
                                                            <div key={child._id}>
                                                                <div className={`ud-pm-cat-tree-node ${mappingTarget?._id === child._id ? "selected" : ""}`}
                                                                    style={{ paddingLeft: 30 }}
                                                                    onClick={() => setMasterCatExpanded(prev => { const n = new Set(prev); n.has(child._id) ? n.delete(child._id) : n.add(child._id); return n; })}>
                                                                    <span className="ud-pm-cat-tree-toggle" style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                                                                        {childMpCats.length > 0 ? (childExp ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />) : <span style={{ width: 8 }} />}
                                                                    </span>
                                                                    <span className="ud-pm-cat-tree-icon" style={{ color: "var(--ud-pm-yellow)", fontSize: 10 }}><FaTag /></span>
                                                                    <span className="ud-pm-cat-tree-name">{child.masterCategory?.name}</span>
                                                                    <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
                                                                        {childMpCats.length > 0 && <Pill color="var(--ud-pm-purple)">{childMpCats.length} PY</Pill>}
                                                                        <button className={`ud-pm-btn sm ${mappingTarget?._id === child._id ? "green" : "accent outline"}`}
                                                                            style={{ padding: "2px 8px", fontSize: 9 }}
                                                                            onClick={e => { e.stopPropagation(); setMappingTarget(mappingTarget?._id === child._id ? null : child); setCatTab("browse"); }}>
                                                                            {mappingTarget?._id === child._id ? <><FaTimes /> İptal</> : <><FaPlus /> Eşleştir</>}
                                                                        </button>
                                                                    </span>
                                                                </div>
                                                                {childExp && childMpCats.map((mc, i) => (
                                                                    <div key={i} className="ud-pm-cat-tree-node leaf" style={{ paddingLeft: 60 }}>
                                                                        <Pill color={PL_COLOR[mc.marketplaceName] || "var(--ud-pm-accent)"}>{PL_SHORT[mc.marketplaceName] || mc.marketplaceName}</Pill>
                                                                        <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 11, flex: 1 }}>{mc.categoryName}</span>
                                                                        <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 9, fontFamily: "monospace" }}>ID: {mc.categoryId}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sağ: Eşleştirme Bilgi Paneli */}
                        <div className="ud-pm-card" style={{ flex: 1, minWidth: 280 }}>
                            <div className="ud-pm-card-header">
                                <span className="icon"><FaInfoCircle /></span>
                                <div><div className="title">Eşleştirme Rehberi</div></div>
                            </div>
                            {mappingTarget ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                                        <div style={{ color: "var(--ud-pm-accent)", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                            <FaSitemap style={{ fontSize: 10 }} /> Eşleştirme Modu Aktif
                                        </div>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700 }}>{mappingTarget.masterCategory?.name}</div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
                                            "PY Kategorileri" sekmesine geçin, bir platform kategorisi seçin ve <strong>"Eşleştir"</strong> butonuna tıklayın.
                                        </div>
                                    </div>
                                    <button className="ud-pm-btn accent" style={{ width: "100%", justifyContent: "center" }}
                                        onClick={() => setCatTab("browse")}>
                                        <FaFolderOpen /> PY Kategorilerine Git
                                    </button>
                                    <button className="ud-pm-btn muted" style={{ width: "100%", justifyContent: "center" }}
                                        onClick={() => setMappingTarget(null)}>
                                        <FaTimes /> Eşleştirmeyi İptal Et
                                    </button>
                                </div>
                            ) : (
                                <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 12, lineHeight: 1.8 }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <strong style={{ color: "var(--ud-pm-text)" }}>Nasıl Çalışır?</strong>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <span style={{ background: "var(--ud-pm-accent)", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>1</span>
                                            <span>Soldan bir <strong>master kategori</strong> oluşturun (ör: "Takı & Mücevher")</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <span style={{ background: "var(--ud-pm-purple)", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>2</span>
                                            <span><strong>"Eşleştir"</strong> butonuna tıklayın</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <span style={{ background: "var(--ud-pm-green)", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>3</span>
                                            <span>"PY Kategorileri" sekmesinde ilgili platform kategorisini seçip <strong>"Eşleştir"</strong> deyin</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── ALT TAB 3: Ürün Kategorileri (Açılır-Kapanır Ağaç) ── */}
                {catTab === "products" && (
                    <div className="ud-pm-card" style={{ minHeight: 400 }}>
                        <div className="ud-pm-card-header">
                            <span className="icon"><FaBox /></span>
                            <div style={{ flex: 1 }}>
                                <div className="title">Ürünler — Kategoriye Göre</div>
                                <div className="subtitle">{catProducts.length} ürün, {sortedCatKeys.length} kategori</div>
                            </div>
                            <button className="ud-pm-btn sm accent outline" onClick={loadCatProducts} disabled={catProdLoading}>
                                {catProdLoading ? <span className="spinner" /> : <FaSync />}
                            </button>
                        </div>

                        {catProdLoading ? <Loading /> : sortedCatKeys.length === 0 ? (
                            <Empty icon={FaBox} title="Ürün bulunamadı" desc="Önce pazaryerlerinden ürün çekin" />
                        ) : (
                            <div style={{ maxHeight: 500, overflowY: "auto" }}>
                                {sortedCatKeys.map(catName => {
                                    const prods = groupedProducts[catName];
                                    const isExp = catProdExpanded.has(catName);
                                    // Alt kategorileri ayır (path'e göre)
                                    const subGroups = {};
                                    for (const p of prods) {
                                        const fullCat = p.masterProduct?.category || "Kategorisiz";
                                        const parts = fullCat.split(" > ");
                                        const subKey = parts.length > 1 ? parts.slice(1).join(" > ") : "_root";
                                        if (!subGroups[subKey]) subGroups[subKey] = [];
                                        subGroups[subKey].push(p);
                                    }

                                    return (
                                        <div key={catName}>
                                            <div className="ud-pm-cat-tree-node"
                                                style={{ paddingLeft: 12, fontWeight: 700 }}
                                                onClick={() => setCatProdExpanded(prev => { const n = new Set(prev); n.has(catName) ? n.delete(catName) : n.add(catName); return n; })}>
                                                <span className="ud-pm-cat-tree-toggle" style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                                                    {isExp ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />}
                                                </span>
                                                <span className="ud-pm-cat-tree-icon" style={{ color: "var(--ud-pm-yellow)", fontSize: 11 }}><FaFolderOpen /></span>
                                                <span className="ud-pm-cat-tree-name">{catName}</span>
                                                <Pill color="var(--ud-pm-accent)">{prods.length}</Pill>
                                            </div>
                                            {isExp && prods.map(p => {
                                                const mp = p.masterProduct || {};
                                                const st = p.stockTracking || {};
                                                return (
                                                    <div key={p._id} className="ud-pm-cat-tree-node leaf"
                                                        style={{ paddingLeft: 42, cursor: "pointer" }}
                                                        onClick={() => openDetail(p._id)}>
                                                        {mp.images?.[0] ? <img src={mp.images[0]} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                                                            : <FaBox style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }} />}
                                                        <span style={{ color: "var(--ud-pm-text)", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name || "İsimsiz"}</span>
                                                        <span style={{ color: "var(--ud-pm-green)", fontSize: 10, fontWeight: 600, minWidth: 55, textAlign: "right" }}>{fmt(mp.price)}</span>
                                                        <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"} style={{ fontSize: 10, minWidth: 30, textAlign: "right" }}>{st.totalStock ?? 0}</span>
                                                        <div className="ud-pm-platforms" style={{ minWidth: 60 }}>
                                                            {PLATFORMS.map(pl => { const ps = getPlStatus(p, pl); return ps.exists ? <span key={pl} style={{ fontSize: 7, color: PL_COLOR[pl], fontWeight: 700 }}>{PL_SHORT[pl]}</span> : null; })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Eşleştirme Modu Banner */}
                {mappingTarget && catTab === "browse" && (
                    <div style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <FaSitemap style={{ color: "var(--ud-pm-accent)", fontSize: 14 }} />
                        <span style={{ color: "var(--ud-pm-text)", fontSize: 12, flex: 1 }}>
                            <strong>Eşleştirme Modu:</strong> "{mappingTarget.masterCategory?.name}" için bir platform kategorisi seçin
                        </span>
                        <button className="ud-pm-btn sm muted" onClick={() => setMappingTarget(null)}><FaTimes /> İptal</button>
                    </div>
                )}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 4: SENKRONİZASYON
       ═══════════════════════════════════════════════════════════════ */
    const renderSync = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ud-pm-sync-grid">
                {marketplaces.map(mp => (
                    <div key={mp._id} className="ud-pm-card ud-pm-sync-card">
                        <div className="ud-pm-sync-header">
                            <span className="mp-icon" style={{ color: PL_COLOR[mp.marketplaceName] || "var(--ud-pm-accent)" }}><FaStore /></span>
                            <div>
                                <div className="mp-name">{mp.marketplaceName}</div>
                                <div className="mp-status">{mp.credentials && Object.keys(mp.credentials).length > 0 ? <><FaCheckCircle style={{ color: "var(--ud-pm-green)", fontSize: 9 }} /> Bağlı</> : <><FaExclamationTriangle style={{ color: "var(--ud-pm-yellow)", fontSize: 9 }} /> Eksik</>}</div>
                            </div>
                        </div>
                        <button className="ud-pm-btn" style={{ width: "100%", justifyContent: "center", background: PL_COLOR[mp.marketplaceName] || "var(--ud-pm-accent)" }}
                            onClick={() => handleSyncFrom(mp)} disabled={actionLoading === `sync-${mp._id}`}>
                            {actionLoading === `sync-${mp._id}` ? <span className="spinner" /> : <FaSync />} Ürün Çek
                        </button>
                    </div>
                ))}
                <div className="ud-pm-card" style={{ background: "linear-gradient(135deg, rgba(78,205,196,0.05), rgba(139,92,246,0.05))", borderColor: "rgba(78,205,196,0.2)" }}>
                    <div className="ud-pm-sync-header">
                        <span className="mp-icon" style={{ color: "var(--ud-pm-accent)" }}><FaGlobe /></span>
                        <div><div className="mp-name">Tüm Platformlar</div><div className="mp-status">Toplu senkronizasyon</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button className="ud-pm-btn accent" style={{ flex: 1, justifyContent: "center" }} onClick={handleSyncAll} disabled={actionLoading === "sync-all"}>
                            {actionLoading === "sync-all" ? <span className="spinner" /> : <FaSync />} Tümünü Çek
                        </button>
                        <button className="ud-pm-btn purple" style={{ flex: 1, justifyContent: "center" }}
                            onClick={async () => { setActionLoading("auto"); try { await triggerAutoSync(); showToast("Oto sync tamamlandı"); loadProducts(page); } catch { showToast("Hata", "error"); } finally { setActionLoading(""); } }}
                            disabled={actionLoading === "auto"}>
                            {actionLoading === "auto" ? <span className="spinner" /> : <FaBolt />} Oto Sync
                        </button>
                    </div>
                </div>
            </div>

            <div className="ud-pm-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ color: "var(--ud-pm-text)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><FaClipboardList style={{ color: "var(--ud-pm-accent)" }} /> Senkronizasyon Logları</div>
                    <button className="ud-pm-btn sm accent outline" onClick={loadLogs}><FaSync /></button>
                </div>
                {logsLoading ? <Loading />
                : syncLogs.length === 0 ? <Empty icon={FaClipboardList} title="Henüz log yok" />
                : (
                    <div className="ud-pm-log-list">
                        {syncLogs.map((log, i) => (
                            <div key={log._id || i} className="ud-pm-log-item">
                                <span className="dot" style={{ background: log.status === "success" ? "var(--ud-pm-green)" : log.status === "error" ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} />
                                <Pill color={log.actionType === "stock_update" ? "var(--ud-pm-green)" : log.actionType === "price_update" ? "var(--ud-pm-yellow)" : log.actionType === "product_created" ? "var(--ud-pm-purple)" : "var(--ud-pm-accent)"}>
                                    {log.actionType === "stock_update" ? <><FaWarehouse style={{ fontSize: 8 }} /> Stok</> : log.actionType === "price_update" ? <><FaDollarSign style={{ fontSize: 8 }} /> Fiyat</> : log.actionType === "product_created" ? <><FaPlus style={{ fontSize: 8 }} /> Yeni</> : log.actionType === "bulk_update" ? <><FaLayerGroup style={{ fontSize: 8 }} /> Toplu</> : log.actionType}
                                </Pill>
                                <span className="log-name">{log.product?.name || log.product?.barcode || "—"}</span>
                                {log.changes?.field && <span className="log-change">{log.changes.oldValue}→{log.changes.newValue}</span>}
                                <span className="log-date">{fmtDate(log.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       ÜRÜN DETAY MODAL
       ═══════════════════════════════════════════════════════════════ */
    const renderDetailModal = () => {
        if (!showDetail) return null;
        const p = detail;
        const mp = p?.masterProduct || {};
        const st = p?.stockTracking || {};
        // ⚠️ FIX: syncStatus: "error" olan mapping'ler platformda yok demek — filtrele
        const mappings = (p?.marketplaceMappings || []).filter(m => m.syncStatus !== "error");

        return ReactDOM.createPortal(
            <AnimatePresence>
                <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => { setShowDetail(false); setDetail(null); }}>
                    <motion.div className="ud-pm-modal" initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .92, y: 20 }}
                        onClick={e => e.stopPropagation()}>
                        {detailLoading ? <Loading /> : !p ? (
                            <div className="ud-pm-empty"><div className="title">Ürün bulunamadı</div></div>
                        ) : (
                            <>
                                <div className="ud-pm-modal-header">
                                    <div className="product-info">
                                        {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="product-img" />
                                            : <div className="product-img-placeholder"><FaBox /></div>}
                                        <div>
                                            <h2>{mp.name}</h2>
                                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                                <Pill color="var(--ud-pm-accent)"><FaBarcode style={{ fontSize: 8 }} /> {mp.barcode}</Pill>
                                                <Pill color="var(--ud-pm-purple)"><FaTag style={{ fontSize: 8 }} /> {mp.sku}</Pill>
                                                {mp.brand && <Pill color="var(--ud-pm-blue)">{mp.brand}</Pill>}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="close-btn" onClick={() => { setShowDetail(false); setDetail(null); }}><FaTimes /></button>
                                </div>

                                <div className="ud-pm-modal-stats">
                                    <div className="ud-pm-modal-stat" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                        <div className="stat-val" style={{ color: "var(--ud-pm-green)" }}>{fmt(mp.price)}</div>
                                        <div className="stat-label">Satış Fiyatı</div>
                                    </div>
                                    <div className="ud-pm-modal-stat" style={{ background: `${st.isOutOfStock ? "rgba(239,68,68,0.06)" : st.isLowStock ? "rgba(245,158,11,0.06)" : "rgba(34,197,94,0.06)"}`, border: `1px solid ${st.isOutOfStock ? "rgba(239,68,68,0.15)" : st.isLowStock ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)"}` }}>
                                        <div className="stat-val" style={{ color: st.isOutOfStock ? "var(--ud-pm-red)" : st.isLowStock ? "var(--ud-pm-yellow)" : "var(--ud-pm-green)" }}>{st.totalStock ?? 0}</div>
                                        <div className="stat-label">Stok</div>
                                    </div>
                                    <div className="ud-pm-modal-stat" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                                        <div className="stat-val" style={{ color: "var(--ud-pm-purple)" }}>{mappings.length}</div>
                                        <div className="stat-label">Platform</div>
                                    </div>
                                </div>

                                <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><FaStore style={{ color: "var(--ud-pm-accent)" }} /> Platform Durumları</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                                    {PLATFORMS.map(pl => {
                                        const m = getPlMap(p, pl);
                                        const exists = !!m;
                                        return (
                                            <div key={pl} className="ud-pm-modal-platform">
                                                <span className="mp-icon" style={{ color: PL_COLOR[pl] }}><FaStore /></span>
                                                <span className="mp-name">{pl}</span>
                                                {exists ? <>
                                                    <Pill color="var(--ud-pm-green)"><FaCheckCircle style={{ fontSize: 8 }} /> Aktif</Pill>
                                                    <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 11 }}>{m.price ? fmt(m.price) : "—"}</span>
                                                    <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 10 }}>{m.lastSyncDate ? fmtAgo(m.lastSyncDate) : "—"}</span>
                                                </> : <>
                                                    <Pill color="var(--ud-pm-text-dim)">Pasif</Pill>
                                                    <button className="ud-pm-btn sm outline" style={{ borderColor: PL_COLOR[pl], color: PL_COLOR[pl] }}
                                                        onClick={() => { distributeProduct(p._id, [pl]).then(() => { showToast(`${pl} dağıtıldı`); openDetail(p._id); }).catch(() => showToast("Hata", "error")); }}>
                                                        <FaRocket /> Gönder
                                                    </button>
                                                </>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {mp.description && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><FaEdit style={{ color: "var(--ud-pm-accent)" }} /> Açıklama</div>
                                        <div style={{ color: "var(--ud-pm-text-sub)", fontSize: 11, lineHeight: 1.6, background: "var(--ud-pm-glass)", borderRadius: 8, padding: "10px 12px", maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap" }}>{mp.description}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        , document.body);
    };

    /* ═══════════════════════════════════════════════════════════════
       ÜRÜN SİLME ONAY MODAL
       ═══════════════════════════════════════════════════════════════ */
    const renderDeleteConfirmModal = () => {
        if (!deleteConfirm) return null;
        const { name, platforms } = deleteConfirm;
        const hasPlatforms = platforms.length > 0;

        return ReactDOM.createPortal(
            <AnimatePresence>
                <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => { if (!deleteLoading) { setDeleteConfirm(null); setDeleteResult(null); } }}>
                    <motion.div className="ud-pm-modal" initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .92, y: 20 }}
                        onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>

                        {/* Başarılı silme sonucu */}
                        {deleteResult?.success ? (
                            <div style={{ textAlign: "center", padding: "10px 0" }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}><FaCheckCircle style={{ color: "var(--ud-pm-green)" }} /></div>
                                <div style={{ color: "var(--ud-pm-text)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Ürün Silindi</div>
                                <div style={{ color: "var(--ud-pm-text-sub)", fontSize: 12, marginBottom: 16 }}>{name}</div>

                                {deleteResult.mpResults?.length > 0 && (
                                    <div style={{ textAlign: "left", marginBottom: 16 }}>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Pazaryeri Sonuçları</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {deleteResult.mpResults.map((r, i) => (
                                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--ud-pm-glass)", border: "1px solid var(--ud-pm-glass-border)" }}>
                                                    {r.status === "success" ? <FaCheckCircle style={{ color: "var(--ud-pm-green)", fontSize: 13, flexShrink: 0 }} />
                                                        : r.status === "skipped" ? <FaInfoCircle style={{ color: "var(--ud-pm-yellow)", fontSize: 13, flexShrink: 0 }} />
                                                        : <FaTimesCircle style={{ color: "var(--ud-pm-red)", fontSize: 13, flexShrink: 0 }} />}
                                                    <span style={{ color: "var(--ud-pm-text)", fontSize: 12, fontWeight: 600, minWidth: 80 }}>{r.name}</span>
                                                    <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 11, flex: 1 }}>{r.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button className="ud-pm-btn accent" style={{ width: "100%", justifyContent: "center" }}
                                    onClick={() => { setDeleteConfirm(null); setDeleteResult(null); }}>
                                    <FaCheck /> Tamam
                                </button>
                            </div>
                        ) : (
                            /* Silme onay ekranı */
                            <>
                                <div style={{ textAlign: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 40, marginBottom: 10 }}><FaExclamationTriangle style={{ color: "var(--ud-pm-red)" }} /></div>
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ürünü Sil</div>
                                    <div style={{ color: "var(--ud-pm-text-sub)", fontSize: 12 }}>
                                        <strong style={{ color: "var(--ud-pm-text)" }}>{name}</strong> kalıcı olarak silinecek.
                                    </div>
                                </div>

                                {hasPlatforms && (
                                    <div style={{ background: "var(--ud-pm-glass)", border: "1px solid var(--ud-pm-glass-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <FaGlobe style={{ color: "var(--ud-pm-red)", fontSize: 14 }} />
                                            <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700 }}>Tüm pazaryerlerinden kaldırılacak</div>
                                        </div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
                                            Ürün aşağıdaki platformlardan tamamen silinecek veya stok 0'a çekilecek:
                                        </div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {platforms.map(pl => (
                                                <span key={pl} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${PL_COLOR[pl] || "var(--ud-pm-accent)"}18`, color: PL_COLOR[pl] || "var(--ud-pm-accent)", border: `1px solid ${PL_COLOR[pl] || "var(--ud-pm-accent)"}30` }}>
                                                    <FaStore style={{ fontSize: 9 }} /> {pl}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!hasPlatforms && (
                                    <div style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                                        <FaInfoCircle style={{ color: "var(--ud-pm-accent)", fontSize: 14, flexShrink: 0 }} />
                                        <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 12 }}>Bu ürün hiçbir pazaryerine dağıtılmamış. Sadece yerel kayıt silinecek.</span>
                                    </div>
                                )}

                                {deleteResult?.success === false && (
                                    <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                        <FaTimesCircle style={{ color: "var(--ud-pm-red)", flexShrink: 0 }} />
                                        <span style={{ color: "var(--ud-pm-red)", fontSize: 12 }}>{deleteResult.msg}</span>
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className="ud-pm-btn outline" style={{ flex: 1, justifyContent: "center" }}
                                        onClick={() => { setDeleteConfirm(null); setDeleteResult(null); }} disabled={deleteLoading}>
                                        İptal
                                    </button>
                                    <button className="ud-pm-btn red" style={{ flex: 1, justifyContent: "center" }}
                                        onClick={executeDelete} disabled={deleteLoading}>
                                        {deleteLoading ? <span className="spinner" /> : <FaTrash />}
                                        {hasPlatforms ? "Her Yerden Sil" : "Sil"}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        , document.body);
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 5: TOPLU ÜRÜN YÖNETİMİ
       ═══════════════════════════════════════════════════════════════ */
    const bulkTotalPages = Math.ceil(bulkTotal / LIMIT);
    const bulkToggleSel = (id) => setBulkSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const bulkToggleAll = () => bulkSelected.size === bulkProducts.length ? setBulkSelected(new Set()) : setBulkSelected(new Set(bulkProducts.map(p => p._id)));
    const bulkSelectAll = async () => {
        setBulkActionLoading(true);
        try {
            const params = { page: 0, limit: 9999 }; if (bulkSearch) params.search = bulkSearch;
            const res = await getProducts(params);
            setBulkSelected(new Set((res.products || []).map(p => p._id)));
            showToast(`${(res.products || []).length} ürün seçildi`);
        } catch { showToast("Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const handleBulkPriceSubmit = async () => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        if (bulkPriceMode !== "round" && !bulkPriceValue) return showToast("Değer girin", "error");
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkUpdatePrices(Array.from(bulkSelected), bulkPriceMode, Number(bulkPriceValue) || 0, { roundTo: bulkPriceRound, applyToListPrice: bulkPriceListToo, syncToMarketplaces: bulkPriceSync });
            setBulkResult({ type: "price", ...r.results }); showToast(r.message); loadBulkProducts(bulkPage); loadDashboard();
        } catch (e) { showToast(e.response?.data?.error || "Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const handleBulkStockSubmit = async () => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        if (!bulkStockValue && bulkStockValue !== "0") return showToast("Değer girin", "error");
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkUpdateStocks(Array.from(bulkSelected), bulkStockMode, Number(bulkStockValue), bulkStockSync);
            setBulkResult({ type: "stock", ...r.results }); showToast(r.message); loadBulkProducts(bulkPage); loadDashboard();
        } catch (e) { showToast(e.response?.data?.error || "Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const handleBulkDelete = async () => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        const confirmMsg = `${bulkSelected.size} ürünü silmek ve tüm pazaryerlerinden kaldırmak istediğinize emin misiniz?\nBu işlem geri alınamaz!`;
        if (!window.confirm(confirmMsg)) return;
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkDeleteProducts(Array.from(bulkSelected), { deleteFromMarketplaces: true });
            const mpStats = r.marketplaceStats || {};
            setBulkResult({ type: "delete", deletedCount: r.deletedCount, mpSuccess: mpStats.success || 0, mpError: mpStats.error || 0, fromMP: true });
            showToast(r.message); setBulkSelected(new Set()); loadBulkProducts(0); loadDashboard();
        } catch (e) { showToast(e.response?.data?.error || "Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const handleBulkDistributeAction = async (targets) => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkDistributeSelected(Array.from(bulkSelected), targets);
            setBulkResult({ type: "distribute", ...r.results }); showToast(r.message); loadBulkProducts(bulkPage);
        } catch (e) { showToast(e.response?.data?.error || "Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const handleBulkFieldsSubmit = async () => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        const fields = {};
        if (bulkFieldCategory.trim()) fields.category = bulkFieldCategory.trim();
        if (bulkFieldBrand.trim()) fields.brand = bulkFieldBrand.trim();
        if (bulkFieldSafety !== "") fields.safetyStock = Number(bulkFieldSafety);
        if (Object.keys(fields).length === 0) return showToast("En az bir alan doldurun", "error");
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkUpdateFields(Array.from(bulkSelected), fields);
            setBulkResult({ type: "fields", modifiedCount: r.modifiedCount, fields: r.fields }); showToast(r.message); loadBulkProducts(bulkPage);
        } catch (e) { showToast(e.response?.data?.error || "Hata", "error"); }
        finally { setBulkActionLoading(false); }
    };

    const renderBulk = () => {
        const actions = [
            { id: "price", icon: <FaDollarSign />, label: "Fiyat Güncelle", color: "var(--ud-pm-green)", desc: "Sabit, yüzde veya yuvarlama" },
            { id: "stock", icon: <FaWarehouse />, label: "Stok Güncelle", color: "var(--ud-pm-blue)", desc: "Sabit, artır veya azalt" },
            { id: "distribute", icon: <FaRocket />, label: "Platformlara Dağıt", color: "var(--ud-pm-purple)", desc: "Seçili platformlara gönder" },
            { id: "fields", icon: <FaTag />, label: "Alan Güncelle", color: "var(--ud-pm-yellow)", desc: "Kategori, marka, güvenlik stoğu" },
            { id: "delete", icon: <FaTrash />, label: "Toplu Sil", color: "var(--ud-pm-red)", desc: "Seçili ürünleri kalıcı sil" },
        ];

        return (
            <div className="ud-pm-bulk-layout">
                {/* SOL: Ürün Listesi */}
                <div>
                    <div className="ud-pm-toolbar">
                        <div className="ud-pm-search-wrap" style={{ maxWidth: 300 }}>
                            <span className="icon"><FaSearch /></span>
                            <input className="ud-pm-search" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..." />
                        </div>
                        <Pill color="var(--ud-pm-accent)"><FaCheck style={{ fontSize: 8 }} /> {bulkSelected.size} / {bulkTotal}</Pill>
                        <button className="ud-pm-btn sm accent outline" onClick={bulkSelectAll} disabled={bulkActionLoading}><FaClipboardList /> Tümünü Seç</button>
                        {bulkSelected.size > 0 && <button className="ud-pm-btn sm muted" onClick={() => setBulkSelected(new Set())}><FaTimes /> Temizle</button>}
                    </div>

                    <div className="ud-pm-table-wrap">
                        <div className="ud-pm-table-scroll">
                            <table className="ud-pm-table" style={{ minWidth: 600 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}><input type="checkbox" className="ud-pm-checkbox" checked={bulkSelected.size === bulkProducts.length && bulkProducts.length > 0} onChange={bulkToggleAll} /></th>
                                        <th>Ürün</th>
                                        <th>Barkod</th>
                                        <th className="right">Fiyat</th>
                                        <th className="center">Stok</th>
                                        <th className="center">Platform</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkLoading ? (
                                        <tr><td colSpan={6}><Loading /></td></tr>
                                    ) : bulkProducts.length === 0 ? (
                                        <tr><td colSpan={6}><Empty icon={FaBox} title="Ürün bulunamadı" /></td></tr>
                                    ) : bulkProducts.map((p, i) => {
                                        const mp = p.masterProduct || {};
                                        const st = p.stockTracking || {};
                                        const isSel = bulkSelected.has(p._id);
                                        return (
                                            <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                                                className={isSel ? "selected" : ""} onClick={() => bulkToggleSel(p._id)}>
                                                <td><input type="checkbox" className="ud-pm-checkbox" checked={isSel} onChange={() => bulkToggleSel(p._id)} /></td>
                                                <td>
                                                    <div className="product-cell">
                                                        {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="product-img" style={{ width: 28, height: 28 }} />
                                                            : <div className="product-img-placeholder" style={{ width: 28, height: 28, fontSize: 12 }}><FaBox /></div>}
                                                        <div>
                                                            <div className="product-name" style={{ maxWidth: 180 }}>{mp.name || "İsimsiz"}</div>
                                                            {mp.brand && <div className="product-brand">{mp.brand}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className="mono" style={{ fontSize: 10 }}>{mp.barcode || "—"}</span></td>
                                                <td className="right"><span className="price">{fmt(mp.price)}</span></td>
                                                <td className="center"><span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"} style={{ fontSize: 12 }}>{st.totalStock ?? 0}</span></td>
                                                <td className="center">
                                                    <div className="ud-pm-platforms">
                                                        {PLATFORMS.map(pl => { const ps = getPlStatus(p, pl); return <span key={pl} className={`ud-pm-platform-dot ${ps.exists ? "" : "inactive"}`} style={{ fontSize: 8, color: PL_COLOR[pl] }}>{PL_SHORT[pl]}</span>; })}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination currentPage={bulkPage} totalPages={bulkTotalPages} total={bulkTotal} onPageChange={p => loadBulkProducts(p)} />
                    </div>
                </div>

                {/* SAĞ: İşlem Paneli */}
                <div className="ud-pm-bulk-panel">
                    <div className="ud-pm-card" style={{ background: "linear-gradient(135deg, rgba(78,205,196,0.05), rgba(139,92,246,0.04))", borderColor: "rgba(78,205,196,0.2)" }}>
                        <div className="ud-pm-card-header">
                            <span className="icon"><FaLayerGroup /></span>
                            <div>
                                <div className="title">Toplu İşlem</div>
                                <div className="subtitle">{bulkSelected.size > 0 ? `${bulkSelected.size} ürün seçili` : "Ürün seçerek başlayın"}</div>
                            </div>
                        </div>
                        <div className="ud-pm-bulk-actions">
                            {actions.map(a => (
                                <button key={a.id} className={`ud-pm-bulk-action-btn ${bulkAction === a.id ? "active" : ""}`}
                                    style={bulkAction === a.id ? { background: `${a.color}12`, borderColor: a.color } : {}}
                                    onClick={() => { setBulkAction(bulkAction === a.id ? "" : a.id); setBulkResult(null); }}>
                                    <span className="action-icon" style={{ color: bulkAction === a.id ? a.color : "var(--ud-pm-text-sub)" }}>{a.icon}</span>
                                    <div>
                                        <div className="action-label" style={bulkAction === a.id ? { color: a.color } : {}}>{a.label}</div>
                                        <div className="action-desc">{a.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* İşlem Detay Panelleri */}
                    <AnimatePresence mode="wait">
                        {bulkAction === "price" && (
                            <motion.div key="price" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <div className="ud-pm-card">
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><FaDollarSign style={{ color: "var(--ud-pm-green)" }} /> Toplu Fiyat Güncelleme</div>
                                    <div className="ud-pm-mode-group">
                                        {[{ id: "percent", l: "% Oran", icon: <FaPercentage /> }, { id: "fixed", l: "Sabit ₺", icon: <FaDollarSign /> }, { id: "round", l: "Yuvarlama", icon: <FaSync /> }].map(m => (
                                            <button key={m.id} className={`ud-pm-mode-btn ${bulkPriceMode === m.id ? "active" : ""}`}
                                                style={bulkPriceMode === m.id ? { color: "var(--ud-pm-green)", borderColor: "var(--ud-pm-green)", background: "rgba(34,197,94,0.1)" } : {}}
                                                onClick={() => setBulkPriceMode(m.id)}>{m.icon} {m.l}</button>
                                        ))}
                                    </div>
                                    {bulkPriceMode !== "round" && (
                                        <div className="ud-pm-field" style={{ marginBottom: 8 }}>
                                            <label>{bulkPriceMode === "percent" ? "Yüzde (+ artış, - azalış)" : "Yeni Fiyat (₺)"}</label>
                                            <input type="number" step={bulkPriceMode === "percent" ? "1" : "0.01"} value={bulkPriceValue} onChange={e => setBulkPriceValue(e.target.value)}
                                                placeholder={bulkPriceMode === "percent" ? "ör: 10 veya -15" : "ör: 299.90"} />
                                        </div>
                                    )}
                                    <div className="ud-pm-field" style={{ marginBottom: 8 }}>
                                        <label>Yuvarlama (opsiyonel)</label>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            {["", "0.90", "0.99", "0.49", "0.00"].map(r => (
                                                <button key={r} className={`ud-pm-mode-btn ${bulkPriceRound === r ? "active" : ""}`}
                                                    style={bulkPriceRound === r ? { color: "var(--ud-pm-accent)", borderColor: "var(--ud-pm-accent)", background: "rgba(78,205,196,0.1)" } : {}}
                                                    onClick={() => setBulkPriceRound(r)}>{r || "Yok"}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--ud-pm-text-sub)" }}>
                                            <input type="checkbox" className="ud-pm-checkbox" checked={bulkPriceListToo} onChange={e => setBulkPriceListToo(e.target.checked)} />
                                            Liste fiyatına da uygula
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--ud-pm-text-sub)" }}>
                                            <input type="checkbox" className="ud-pm-checkbox" checked={bulkPriceSync} onChange={e => setBulkPriceSync(e.target.checked)} />
                                            <FaSync style={{ fontSize: 9 }} /> Platformlara da senkronize et
                                        </label>
                                    </div>
                                    <button className="ud-pm-btn green" style={{ width: "100%", justifyContent: "center" }} onClick={handleBulkPriceSubmit} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                        {bulkActionLoading ? <span className="spinner" /> : <FaDollarSign />} {bulkSelected.size} Ürünün Fiyatını Güncelle
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {bulkAction === "stock" && (
                            <motion.div key="stock" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <div className="ud-pm-card">
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><FaWarehouse style={{ color: "var(--ud-pm-blue)" }} /> Toplu Stok Güncelleme</div>
                                    <div className="ud-pm-mode-group">
                                        {[{ id: "fixed", l: "Sabit" }, { id: "increase", l: "Artır" }, { id: "decrease", l: "Azalt" }].map(m => (
                                            <button key={m.id} className={`ud-pm-mode-btn ${bulkStockMode === m.id ? "active" : ""}`}
                                                style={bulkStockMode === m.id ? { color: "var(--ud-pm-blue)", borderColor: "var(--ud-pm-blue)", background: "rgba(59,130,246,0.1)" } : {}}
                                                onClick={() => setBulkStockMode(m.id)}>{m.l}</button>
                                        ))}
                                    </div>
                                    <div className="ud-pm-field" style={{ marginBottom: 8 }}>
                                        <label>{bulkStockMode === "fixed" ? "Yeni Stok Adedi" : bulkStockMode === "increase" ? "Artırılacak Miktar" : "Azaltılacak Miktar"}</label>
                                        <input type="number" min="0" step="1" value={bulkStockValue} onChange={e => setBulkStockValue(e.target.value)}
                                            placeholder={bulkStockMode === "fixed" ? "ör: 50" : "ör: 10"} />
                                    </div>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--ud-pm-text-sub)", marginBottom: 10 }}>
                                        <input type="checkbox" className="ud-pm-checkbox" checked={bulkStockSync} onChange={e => setBulkStockSync(e.target.checked)} />
                                        <FaSync style={{ fontSize: 9 }} /> Platformlara da senkronize et
                                    </label>
                                    <button className="ud-pm-btn blue" style={{ width: "100%", justifyContent: "center" }} onClick={handleBulkStockSubmit} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                        {bulkActionLoading ? <span className="spinner" /> : <FaWarehouse />} {bulkSelected.size} Ürünün Stoğunu Güncelle
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {bulkAction === "distribute" && (
                            <motion.div key="distribute" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <div className="ud-pm-card">
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><FaRocket style={{ color: "var(--ud-pm-purple)" }} /> Toplu Platform Dağıtımı</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {marketplaces.map(mp => (
                                            <button key={mp._id} className="ud-pm-btn" style={{ background: PL_COLOR[mp.marketplaceName] || "var(--ud-pm-accent)", justifyContent: "flex-start" }}
                                                onClick={() => handleBulkDistributeAction([mp.marketplaceName])} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                                {bulkActionLoading ? <span className="spinner" /> : <FaRocket />} {mp.marketplaceName}'a Dağıt
                                            </button>
                                        ))}
                                        {marketplaces.length > 1 && (
                                            <button className="ud-pm-btn accent" style={{ justifyContent: "center", marginTop: 4 }}
                                                onClick={() => handleBulkDistributeAction(marketplaces.map(m => m.marketplaceName))} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                                <FaGlobe /> Tüm Platformlara Dağıt ({bulkSelected.size} ürün)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {bulkAction === "fields" && (
                            <motion.div key="fields" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <div className="ud-pm-card">
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><FaTag style={{ color: "var(--ud-pm-yellow)" }} /> Toplu Alan Güncelleme</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                                        <div className="ud-pm-field">
                                            <label>Kategori</label>
                                            <input value={bulkFieldCategory} onChange={e => setBulkFieldCategory(e.target.value)} placeholder="Yeni kategori adı" />
                                        </div>
                                        <div className="ud-pm-field">
                                            <label>Marka</label>
                                            <input value={bulkFieldBrand} onChange={e => setBulkFieldBrand(e.target.value)} placeholder="Yeni marka adı" />
                                        </div>
                                        <div className="ud-pm-field">
                                            <label><FaShieldAlt style={{ fontSize: 9 }} /> Güvenlik Stoğu</label>
                                            <input type="number" min="0" value={bulkFieldSafety} onChange={e => setBulkFieldSafety(e.target.value)} placeholder="ör: 5" />
                                        </div>
                                    </div>
                                    <button className="ud-pm-btn yellow" style={{ width: "100%", justifyContent: "center" }} onClick={handleBulkFieldsSubmit} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                        {bulkActionLoading ? <span className="spinner" /> : <FaTag />} {bulkSelected.size} Ürünü Güncelle
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {bulkAction === "delete" && (
                            <motion.div key="delete" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <div className="ud-pm-card" style={{ borderColor: "rgba(239,68,68,0.25)" }}>
                                    <div style={{ color: "var(--ud-pm-red)", fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><FaExclamationTriangle /> Toplu Silme</div>
                                    <div className="ud-pm-delete-warning">
                                        <strong style={{ color: "var(--ud-pm-red)" }}>{bulkSelected.size} ürün</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz!
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, color: "var(--ud-pm-text-sub)" }}>
                                        <FaGlobe style={{ color: "var(--ud-pm-red)", fontSize: 13 }} />
                                        Ürünler tüm pazaryerlerinden de kaldırılacak <span style={{ opacity: 0.6 }}>(stok 0'a çekilir / silinir)</span>
                                    </div>
                                    <button className="ud-pm-btn red" style={{ width: "100%", justifyContent: "center" }} onClick={handleBulkDelete} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                        {bulkActionLoading ? <span className="spinner" /> : <FaTrash />} {bulkSelected.size} Ürünü Her Yerden Sil
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sonuç Kartı */}
                    <AnimatePresence>
                        {bulkResult && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                                <div className="ud-pm-card ud-pm-result">
                                    <div className="result-title"><FaCheckCircle /> İşlem Tamamlandı</div>
                                    {bulkResult.type === "price" && (
                                        <div>
                                            <div className="result-line"><FaCheck style={{ fontSize: 9 }} /> <strong>{bulkResult.updated}</strong> ürün fiyatı güncellendi</div>
                                            {bulkResult.synced > 0 && <div className="result-line"><FaSync style={{ fontSize: 9 }} /> <strong>{bulkResult.synced}</strong> platform senkronize edildi</div>}
                                            {bulkResult.errors > 0 && <div className="result-line error"><FaTimes style={{ fontSize: 9 }} /> <strong>{bulkResult.errors}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "stock" && (
                                        <div>
                                            <div className="result-line"><FaCheck style={{ fontSize: 9 }} /> <strong>{bulkResult.updated}</strong> ürün stoğu güncellendi</div>
                                            {bulkResult.synced > 0 && <div className="result-line"><FaSync style={{ fontSize: 9 }} /> <strong>{bulkResult.synced}</strong> platform senkronize edildi</div>}
                                            {bulkResult.errors > 0 && <div className="result-line error"><FaTimes style={{ fontSize: 9 }} /> <strong>{bulkResult.errors}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "delete" && (
                                        <div>
                                            <div className="result-line"><FaTrash style={{ fontSize: 9 }} /> <strong>{bulkResult.deletedCount}</strong> ürün silindi</div>
                                            {bulkResult.fromMP && bulkResult.mpSuccess > 0 && <div className="result-line"><FaStore style={{ fontSize: 9 }} /> <strong>{bulkResult.mpSuccess}</strong> pazaryeri kaydı kaldırıldı</div>}
                                            {bulkResult.fromMP && bulkResult.mpError > 0 && <div className="result-line error"><FaTimes style={{ fontSize: 9 }} /> <strong>{bulkResult.mpError}</strong> pazaryeri hatası</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "distribute" && (
                                        <div>
                                            <div className="result-line"><FaCheck style={{ fontSize: 9 }} /> <strong>{bulkResult.success}</strong> başarılı</div>
                                            {bulkResult.skipped > 0 && <div className="result-line"><FaArrowRight style={{ fontSize: 9 }} /> <strong>{bulkResult.skipped}</strong> atlandı</div>}
                                            {bulkResult.error > 0 && <div className="result-line error"><FaTimes style={{ fontSize: 9 }} /> <strong>{bulkResult.error}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "fields" && (
                                        <div className="result-line"><FaCheck style={{ fontSize: 9 }} /> <strong>{bulkResult.modifiedCount}</strong> ürünün {(bulkResult.fields || []).join(", ")} güncellendi</div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       ANA RENDER
       ═══════════════════════════════════════════════════════════════ */
    const tabs = [
        { id: "products", icon: <FaBox />, label: "Ürünler", count: total },
        { id: "upload", icon: <FaPlus />, label: "Yükle & Dağıt" },
        { id: "pricestock", icon: <FaDollarSign />, label: "Fiyat & Stok" },
        { id: "categories", icon: <FaSitemap />, label: "Kategori Eşleştirme" },
        { id: "bulk", icon: <FaLayerGroup />, label: "Toplu İşlem", count: bulkSelected.size > 0 ? bulkSelected.size : undefined },
        { id: "sync", icon: <FaSync />, label: "Senkronizasyon" },
    ];

    return (
        <div className="ud-pm-root">
            {/* Header */}
            <div className="ud-pm-header">
                <h1><FaCubes /> Ürün Yönetim Merkezi</h1>
                <p>Ürünlerinizi yönetin, platformlara dağıtın, stok ve fiyat senkronizasyonu yapın</p>
            </div>

            {/* Dashboard Cards */}
            {renderDashCards()}

            {/* Tab Bar */}
            <div className="ud-pm-tabs">
                {tabs.map(t => (
                    <button key={t.id} className={`ud-pm-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                        <span className="ud-pm-tab-icon">{t.icon}</span>
                        <span>{t.label}</span>
                        {t.count !== undefined && <span className="ud-pm-tab-count">{t.count}</span>}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}>
                    {tab === "products" && renderProducts()}
                    {tab === "upload" && renderUpload()}
                    {tab === "pricestock" && renderPriceStock()}
                    {tab === "categories" && renderCategories()}
                    {tab === "bulk" && renderBulk()}
                    {tab === "sync" && renderSync()}
                </motion.div>
            </AnimatePresence>

            {/* Detail Modal */}
            {renderDetailModal()}

            {/* Delete Confirm Modal */}
            {renderDeleteConfirmModal()}

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`ud-pm-toast ${toast.type}`}
                        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}>
                        {toast.type === "error" ? <FaTimesCircle /> : <FaCheckCircle />} {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductManagementCenter;
