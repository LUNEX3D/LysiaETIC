/**
 * ÜRÜN YÖNETİM MERKEZİ — ProductManagementCenter.js (v3 — Temiz & Kullanışlı)
 *
 * Tek sayfa içinde tüm ürün yönetimi:
 *   • Dashboard özet kartları (üstte her zaman görünür)
 *   • Tab 1: Ürünler — Liste + inline fiyat/stok düzenleme
 *   • Tab: Yeni ürün & dağıt — ProductUploadWizard (createAndDistribute)
 *   • Tab: Ürünleri Yükle — Mevcut ürünü pazaryerine yükle / kategori
 *   • Tab: Varyant grupları — Aynı model (Trendyol productMainId) altında renk/beden ailesi
 *   • Tab: Fiyat & Stok — Toplu düzenleme tablosu
 *   • Tab: Senkâronizasyon — Platform kartları + loglar
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
    FaTimesCircle, FaInfoCircle, FaCubes, FaSitemap, FaSpinner, FaObjectGroup
} from "react-icons/fa";
import {
    getProducts, getProductDetail, updateProduct, deleteProduct,
    syncFromMarketplace, distributeProduct, bulkDistribute,
    syncStock, syncPrice, triggerAutoSync, getSyncLogs, getSyncJobStatus,
    getProductManagementDashboard, syncAllMarketplaces,
    bulkDistributeSelected, exportProducts,
    createAndDistribute,
    suggestCodes, generateDescription,
    bulkUpdatePrices, bulkUpdateStocks, bulkDeleteProducts, bulkUpdateFields,
    distributeUndistributed,
    updateChannelPricesLocal,
    listVariantGroups,
    getVariantGroup,
    createVariantGroup,
    updateVariantGroup,
    addVariantGroupMembers,
    removeVariantGroupMembers,
    deleteVariantGroup,
    getFieldAuditList,
    applyPlatformField,
    refreshProductFieldAudit,
} from "../services/productManagementApi";
import { searchCategories, getCategoryTree, resolveForDistribute } from "../services/categoryCenterApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import { logUserActivity } from "../services/errorCenterLog";
import ProductUploadWizard from "./ProductUploadWizard";
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
const isHbListableCategory = (cat) =>
    cat?.canListProduct === true ||
    (cat?.canListProduct !== false && cat?.leaf === true && cat?.available !== false);
const canSelectPmCategory = (platform, cat, hasChildren) => {
    const pl = normMP(platform);
    if (pl === "trendyol") return !hasChildren;
    if (pl === "hepsiburada") return !hasChildren && isHbListableCategory(cat);
    return true;
};
const summarizeVariantAttrs = (attrs) => {
    if (!attrs || typeof attrs !== "object") return "—";
    const c = attrs.color || attrs.renk;
    const s = attrs.size || attrs.beden;
    const bits = [c, s].filter(Boolean);
    return bits.length ? bits.join(" · ") : "—";
};

/** Varyant seçicilerde arama (ad, SKU, barkod) */
const filterVgProductRows = (rows, q) => {
    const t = String(q || "").trim().toLowerCase();
    if (!t) return rows || [];
    return (rows || []).filter((p) => {
        const mp = p.masterProduct || {};
        const blob = `${mp.name || ""} ${mp.sku || ""} ${mp.barcode || ""}`.toLowerCase();
        return blob.includes(t);
    });
};

const vgProductThumb = (p) => {
    const imgs = p.masterProduct?.images || p.images;
    const u = Array.isArray(imgs) && imgs.length ? (typeof imgs[0] === "string" ? imgs[0] : imgs[0]?.url) : null;
    return u && String(u).startsWith("http") ? u : null;
};
// ⚠️ FIX: syncStatus: "error" = platformda yok/kaldırılmış — bu mapping'ler gösterilmez
const getPlMap = (p, name) => (p.marketplaceMappings || []).find(m => normMP(m.marketplaceName) === normMP(name) && m.syncStatus !== "error");
/** syncStatus fark etmeksizin eşleşme (pazaryeri fiyat sekmesi) */
const getPlMappingAny = (p, name) => (p.marketplaceMappings || []).find(m => normMP(m.marketplaceName) === normMP(name));
const getPlStatus = (p, name) => { const m = getPlMap(p, name); if (!m) return { exists: false }; return { exists: true, status: m.syncStatus || (m.isActive !== false ? "active" : "inactive"), price: m.price, stock: m.stock, lastSync: m.lastSyncDate }; };

/* ═══════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════════ */
const MP_LOGO = {
    Trendyol: <FaStore style={{ color: "#f27a1a" }} />,
    Hepsiburada: <FaStore style={{ color: "#ff6000" }} />,
    N11: <FaStore style={{ color: "#8b5cf6" }} />,
    Amazon: <FaStore style={{ color: "#f59e0b" }} />,
    "ÇiçekSepeti": <FaStore style={{ color: "#ec4899" }} />
};

const ProductManagementCenter = ({ userId, initialTab = "products" }) => {
    // ── Core State ──
    const [tab, setTab] = useState(initialTab);
    const [uploadMpProduct, setUploadMpProduct] = useState(null);
    const [uploadMpSearch, setUploadMpSearch] = useState("");
    const [uploadMpPage, setUploadMpPage] = useState(0);
    const [uploadMpLoading, setUploadMpLoading] = useState(false);
    const [uploadMpActionLoading, setUploadMpActionLoading] = useState("");
    const [uploadMpCatSearch, setUploadMpCatSearch] = useState("");
    const [uploadMpCatResults, setUploadMpCatResults] = useState([]);
    const [uploadMpCatLoading, setUploadMpCatLoading] = useState(false);
    const [uploadMpSelectedPlatform, setUploadMpSelectedPlatform] = useState(null);
    const [uploadMpSelectedCategory, setUploadMpSelectedCategory] = useState(null); // { id, path, name }
    const [uploadMpCatTree, setUploadMpCatTree] = useState([]);
    const [uploadMpCatPath, setUploadMpCatPath] = useState([]); // [{id, name}]
    const [uploadMpCatExpanded, setUploadMpCatExpanded] = useState(new Set()); // Genişletilmiş kategori ID'leri
    const [uploadMpCatTreeLoading, setUploadMpCatTreeLoading] = useState(false);

    // Ürün değiştiğinde seçimleri sıfırla
    useEffect(() => {
        setUploadMpSelectedPlatform(null);
        setUploadMpSelectedCategory(null);
        setUploadMpCatTree([]);
        setUploadMpCatExpanded(new Set());
        setUploadMpCatPath([]);
    }, [uploadMpProduct?._id]); // eslint-disable-line

    const [uploadMpFilterPl, setUploadMpFilterPl] = useState(""); // Filtrelemek istenen platform
    const [uploadMpFilterType, setUploadMpFilterType] = useState(""); // "listed" | "not_listed"
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
    /** @type {null | { title: string, jobId?: string, status: string, progressPercent?: number, message?: string, etaSeconds?: number|null, phase?: string }} */
    const [syncProgress, setSyncProgress] = useState(null);
    const [stockFilter, setStockFilter] = useState("");
    const [syncLogs, setSyncLogs] = useState([]);
    const [logSummary, setLogSummary] = useState(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logHours, setLogHours] = useState("24");
    const [logStockOnly, setLogStockOnly] = useState(true);
    const [logActionFilter, setLogActionFilter] = useState("");
    const [logSourceFilter, setLogSourceFilter] = useState("");
    const [logSearch, setLogSearch] = useState("");
    const [logExpandedId, setLogExpandedId] = useState(null);
    const [faItems, setFaItems] = useState([]);
    const [faTotal, setFaTotal] = useState(0);
    const [faPage, setFaPage] = useState(0);
    const [faSearch, setFaSearch] = useState("");
    const [faCriticalOnly, setFaCriticalOnly] = useState(false);
    const [faLoading, setFaLoading] = useState(false);
    const [faSummary, setFaSummary] = useState(null);
    const [faExpandedId, setFaExpandedId] = useState(null);
    const [editMap, setEditMap] = useState({});
    const [bulkModal, setBulkModal] = useState(false);
    const [psSelected, setPsSelected] = useState(new Set());
    const [psCloseLoading, setPsCloseLoading] = useState(false);
    const searchRef = useRef(null);
    const syncPollTimerRef = useRef(null);
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
    /** Toplu sil: pazaryeri kapsamı */
    const [bulkDeleteLocalOnly, setBulkDeleteLocalOnly] = useState(false);
    const [bulkDeleteMpScope, setBulkDeleteMpScope] = useState("all"); // "all" | "pick"
    const [bulkDeleteMpPick, setBulkDeleteMpPick] = useState([]);

    // ── Delete Confirm Modal State ──
    const [deleteConfirm, setDeleteConfirm] = useState(null);       // { id, name, platforms, selectedForRemoval, localOnly }
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteResult, setDeleteResult] = useState(null);         // { success, msg, mpResults: [] }

    // ── Varyant grupları sekmesi ──
    const [vgGroups, setVgGroups] = useState([]);
    const [vgLoading, setVgLoading] = useState(false);
    const [vgCreateOpen, setVgCreateOpen] = useState(false);
    const [vgDetailOpen, setVgDetailOpen] = useState(false);
    const [vgPickerOpen, setVgPickerOpen] = useState(false);
    const [vgActiveId, setVgActiveId] = useState(null);
    const [vgMembers, setVgMembers] = useState([]);
    const [vgPickerRows, setVgPickerRows] = useState([]);
    const [vgFormName, setVgFormName] = useState("");
    const [vgFormNotes, setVgFormNotes] = useState("");
    const [vgFormMainId, setVgFormMainId] = useState("");
    const [vgFormColorLbl, setVgFormColorLbl] = useState("Renk");
    const [vgFormSizeLbl, setVgFormSizeLbl] = useState("Beden");
    const [vgCreatePick, setVgCreatePick] = useState(() => new Set());
    const [vgPickerPick, setVgPickerPick] = useState(() => new Set());
    const [vgCreateStep, setVgCreateStep] = useState(1);
    const [vgListSearch, setVgListSearch] = useState("");
    const [vgListLoading, setVgListLoading] = useState(false);

    // ── Category Tab State ──
    const [catTab, setCatTab] = useState("browse"); // "browse" | "mapping" | "products"
    const [catPlatformSel, setCatPlatformSel] = useState("Trendyol");
    const [catTreeData, setCatTreeData] = useState({}); // { [nodeId]: { children, loİaded } }
    const [catExpanded, setCatExpanded] = useState(new Set());
    const [catTreeLoading, setCatTreeLoading] = useState("");
    const [catSearchQ, setCatSearchQ] = useState("");
    const [catSearchResults, setCatSearchResults] = useState([]);
    const [catSearchLoading, setCatSearchLoading] = useState(false);
    const uploadMpCatSearchTimer = useRef(null);
    const distSearchTimer = useRef(null);

    /* ── Ürün detayından "Gönder" → kategori seçimi ── */
    const [distUi, setDistUi] = useState(null);
    const [distTree, setDistTree] = useState([]);
    const [distExpanded, setDistExpanded] = useState(() => new Set());
    const [distSelected, setDistSelected] = useState(null);
    const [distSearch, setDistSearch] = useState("");
    const [distResults, setDistResults] = useState([]);
    const [distLoadingTree, setDistLoadingTree] = useState(false);
    const [distLoadingSearch, setDistLoadingSearch] = useState(false);
    const [distCenter, setDistCenter] = useState(null);
    const [distCenterLoading, setDistCenterLoading] = useState(false);
    const [distActionLoading, setDistActionLoading] = useState(false);

    const [chTabProducts, setChTabProducts] = useState([]);
    const [chTabTotal, setChTabTotal] = useState(0);
    const [chTabPage, setChTabPage] = useState(0);
    const [chTabSearch, setChTabSearch] = useState("");
    const [chTabLoading, setChTabLoading] = useState(false);
    const [chSelectedId, setChSelectedId] = useState(null);
    const [chDetail, setChDetail] = useState(null);
    const [chDetailLoading, setChDetailLoading] = useState(false);
    const [chDraft, setChDraft] = useState({});
    const [chRowAction, setChRowAction] = useState("");

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

    useEffect(() => {
        setTab(initialTab || "products");
    }, [initialTab]);

    // ── Data Loading ──
    useEffect(() => {
        if (!userId) return;
        getUserMarketplaces()
            .then((d) => {
                const list = (d || []).map((m) => ({ ...m, name: m.marketplaceName }));
                setMarketplaces(list);
                const names = list.map((m) => m.marketplaceName).filter(Boolean);
                if (names.length === 0) return;
                setUf((prev) => {
                    if (prev.targetMarketplaces.length > 0) return prev;
                    return { ...prev, targetMarketplaces: names };
                });
            })
            .catch(() => {});
    }, [userId]);

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

    const loadLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const params = { limit: 80, page: 0 };
            if (logHours && logHours !== "0") params.hours = Number(logHours);
            if (logStockOnly) params.stockOnly = "true";
            if (logActionFilter) params.actionType = logActionFilter;
            if (logSourceFilter) params.source = logSourceFilter;
            if (logSearch.trim()) params.search = logSearch.trim();
            const r = await getSyncLogs(params);
            setSyncLogs(r.logs || []);
            setLogSummary(r.summary || null);
        } catch {
            showToast("Stok defteri yüklenemedi", "error");
        } finally {
            setLogsLoading(false);
        }
    }, [logHours, logStockOnly, logActionFilter, logSourceFilter, logSearch, showToast]);

    const loadFieldAudit = useCallback(async (p = 0, s = faSearch, critical = faCriticalOnly) => {
        setFaLoading(true);
        try {
            const r = await getFieldAuditList({
                page: p,
                limit: 30,
                search: s.trim() || undefined,
                driftOnly: "true",
                criticalOnly: critical ? "true" : "false"
            });
            setFaItems(r.items || []);
            setFaTotal(r.total || 0);
            setFaSummary(r.summary || null);
            setFaPage(p);
        } catch {
            showToast("Alan denetimi yüklenemedi", "error");
        } finally {
            setFaLoading(false);
        }
    }, [faSearch, faCriticalOnly, showToast]);

    const handleApplyPlatformField = async (productId, marketplaceName, field) => {
        const key = `fa-${productId}-${field}`;
        setActionLoading(key);
        try {
            await applyPlatformField(productId, { marketplaceName, field });
            showToast("Platform değeri master kayda uygulandı");
            await loadFieldAudit(faPage);
            if (detail?._id === productId) {
                const r = await getProductDetail(productId);
                setDetail(r.product);
            }
        } catch (e) {
            showToast(e?.response?.data?.error || "Uygulanamadı", "error");
        } finally {
            setActionLoading("");
        }
    };

    const handleRefreshFieldAuditOne = async (productId) => {
        setActionLoading(`fa-refresh-${productId}`);
        try {
            await refreshProductFieldAudit(productId);
            showToast("Alan denetimi yenilendi");
            await loadFieldAudit(faPage);
            if (detail?._id === productId) {
                const r = await getProductDetail(productId);
                setDetail(r.product);
            }
        } catch (e) {
            showToast(e?.response?.data?.error || "Yenilenemedi", "error");
        } finally {
            setActionLoading("");
        }
    };

    const formatSyncEta = (sec) => {
        if (sec == null || Number.isNaN(Number(sec))) return "—";
        const s = Math.max(0, Math.round(Number(sec)));
        if (s < 60) return `~${s} sn`;
        if (s < 3600) return `~${Math.ceil(s / 60)} dk`;
        return `~${Math.ceil(s / 3600)} sa`;
    };

    const startSyncJobPoll = useCallback((jobId, title, kind) => {
        const poll = async () => {
            try {
                const data = await getSyncJobStatus(jobId);
                const j = data.job;
                setSyncProgress({
                    title,
                    jobId,
                    status: j.status,
                    progressPercent: typeof j.progressPercent === "number" ? j.progressPercent : 0,
                    message: j.message || "",
                    etaSeconds: j.etaSeconds,
                    phase: j.phase
                });
                if (j.status === "running") {
                    syncPollTimerRef.current = setTimeout(poll, 1000);
                    return;
                }
                if (j.status === "completed") {
                    syncPollTimerRef.current = null;
                    setSyncProgress(null);
                    const r = j.result;
                    if (kind === "auto") {
                        const n = Array.isArray(r?.results) ? r.results.length : 0;
                        const ok = Array.isArray(r?.results) ? r.results.filter(x => x.status === "success").length : 0;
                        showToast(`Oto sync tamamlandı (${ok}/${n} başarılı)`);
                    } else if (kind === "all") {
                        showToast(`Toplu çekme bitti — yeni: ${r?.summary?.totalNew ?? 0}, güncellenen: ${r?.summary?.totalUpdated ?? 0}${(r?.summary?.totalErrors > 0) ? ` (${r.summary.totalErrors} platform hatası)` : ""}`);
                    } else {
                        showToast(`${r?.stats?.new ?? 0} yeni, ${r?.stats?.updated ?? 0} güncellendi`);
                    }
                    loadProducts(0);
                    loadDashboard();
                    loadLogs();
                    return;
                }
                syncPollTimerRef.current = null;
                setSyncProgress(null);
                showToast(j.error || "İşlem başarısız", "error");
            } catch (e) {
                syncPollTimerRef.current = null;
                setSyncProgress(null);
                showToast(e.response?.data?.error || e.message || "Durum alınamadı", "error");
            }
        };
        setSyncProgress({ title, jobId, status: "running", progressPercent: 0, message: "Başlatılıyor...", etaSeconds: null });
        poll();
    }, [showToast, loadProducts, loadDashboard, loadLogs]);

    useEffect(() => () => { if (syncPollTimerRef.current) clearTimeout(syncPollTimerRef.current); }, []);

    const loadUploadMpProducts = useCallback(async (p = 0, s = uploadMpSearch, fp = uploadMpFilterPl, ft = uploadMpFilterType) => {
        setUploadMpLoading(true);
        try {
            const params = { page: p, limit: LIMIT }; 
            if (s) params.search = s;
            if (fp && ft) {
                params.mpFilter = fp;
                params.mpFilterStatus = ft;
            }
            const res = await getProducts(params);
            setProducts(res.products || []); setTotal(res.total || 0); setUploadMpPage(p);
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); }
        finally { setUploadMpLoading(false); }
    }, [uploadMpSearch, uploadMpFilterPl, uploadMpFilterType, showToast]);

    const handleUploadMpCatSearch = useCallback((val, platform) => {
        setUploadMpCatSearch(val);
        if (uploadMpCatSearchTimer.current) clearTimeout(uploadMpCatSearchTimer.current);
        if (!val || val.trim().length < 2) { 
            setUploadMpCatResults([]); 
            return; 
        }
        uploadMpCatSearchTimer.current = setTimeout(async () => {
            setUploadMpCatLoading(true);
            try {
                const normalizedPl = normMP(platform);
                const res = await searchCategories(normalizedPl, val.trim(), { listingOnly: true });
                setUploadMpCatResults(res?.data?.results || []);
            } catch { setUploadMpCatResults([]); }
            finally { setUploadMpCatLoading(false); }
        }, 400);
    }, []);

    const loadCategoryTree = async (platform, parentId = null) => {
        setUploadMpCatTreeLoading(true);
        try {
            const normalizedPl = normMP(platform);
            const res = await getCategoryTree(normalizedPl);
            const tree = res?.data?.categories || res?.data?.tree || res?.data || [];
            setUploadMpCatTree(tree);
        } catch (e) {
            showToast("Kategoriler yüklenemedi", "error");
        } finally {
            setUploadMpCatTreeLoading(false);
        }
    };

    const toggleCatExpand = (catId) => {
        setUploadMpCatExpanded(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else {
                // Sİadece tıklananı aç, diğerlerini kapatmak istenebilir ama 
                // kullanıcı hiyerarşiyi görmek istiyor genelde.
                next.add(catId);
            }
            return next;
        });
    };

    const handleCatTreeClick = (cat, path = [], platform = uploadMpSelectedPlatform) => {
        const hasChildren = (cat.children && cat.children.length > 0) || (cat.subCategories && cat.subCategories.length > 0);
        
        if (hasChildren) {
            toggleCatExpand(cat.id);
        }
        
        if (!canSelectPmCategory(platform, cat, hasChildren)) {
            if (normMP(platform) === "hepsiburada") {
                showToast("Hepsiburada için yaprak ve listelenebilir katalog kategorisi seçin (kampanya değil)", "error");
            }
            return;
        }
        const fullPath = [...path, cat.name].join(" > ");
        setUploadMpSelectedCategory({ id: cat.id, name: cat.name, path: fullPath });
    };

    const renderCategoryNode = (cat, level = 0, path = []) => {
        const hasChildren = (cat.children && cat.children.length > 0) || (cat.subCategories && cat.subCategories.length > 0);
        const children = cat.children || cat.subCategories || [];
        const isExpanded = uploadMpCatExpanded.has(cat.id);
        const isSelected = uploadMpSelectedCategory?.id === cat.id;
        const currentPath = [...path, cat.name];
        const treeSelectable = canSelectPmCategory(uploadMpSelectedPlatform, cat, hasChildren);

        return (
            <div key={cat.id} className={`ud-pm-cat-node-wrapper ${isExpanded ? "expanded" : ""}`}>
                <div 
                    className={`ud-pm-cat-tree-item ${isSelected ? "selected" : ""} level-${level} ${hasChildren ? "has-children" : "is-leaf"}`}
                    style={{
                        paddingLeft: 12 + (level * 20),
                        opacity: normMP(uploadMpSelectedPlatform) === "hepsiburada" && !treeSelectable ? 0.55 : 1
                    }}
                >
                    <div className="cat-info" onClick={() => handleCatTreeClick(cat, path, uploadMpSelectedPlatform)}>
                        {hasChildren ? (
                            <span className="expand-icon" onClick={(e) => { e.stopPropagation(); toggleCatExpand(cat.id); }}>
                                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                            </span>
                        ) : (
                            <span className="leaf-icon"><FaTag size={10} /></span>
                        )}
                        <div className="cat-name">{cat.name}</div>
                    </div>
                    
                    {hasChildren && (
                        <div className="cat-meta" onClick={(e) => { e.stopPropagation(); toggleCatExpand(cat.id); }}>
                            <span className="child-count">{children.length} alt</span>
                        </div>
                    )}
                    
                    {isSelected && <FaCheckCircle className="check-icon" />}
                </div>
                
                {hasChildren && isExpanded && (
                    <div className="cat-children-container">
                        {children.map(child => renderCategoryNode(child, level + 1, currentPath))}
                    </div>
                )}
            </div>
        );
    };

    const handleCatPathGoBack = (index) => {
        if (index === -1) {
            setUploadMpCatPath([]);
            loadCategoryTree(uploadMpSelectedPlatform);
            return;
        }
        
        const newPath = uploadMpCatPath.slice(0, index + 1);
        const lastStep = newPath[newPath.length - 1];
        setUploadMpCatPath(newPath);
        
        if (lastStep.children) {
            setUploadMpCatTree(lastStep.children);
        }
    };

    const resetUploadMpCategoryState = () => {
        setUploadMpSelectedCategory(null);
        setUploadMpCatResults([]);
        setUploadMpCatSearch("");
        setUploadMpCatPath([]);
        setUploadMpCatExpanded(new Set());
    };

    const normalizeUploadCategory = (category) => {
        if (!category) return null;
        const id = category.id || category.categoryId || category.externalCategoryId;
        const name = category.name || category.categoryName || category.externalCategoryName || "";
        const path = category.path || category.categoryPath || category.externalCategoryPath || name;
        if (!id) return null;
        return { id: String(id), name, path };
    };

    const handleUploadToMarketplace = async (product, platform, category) => {
        const normalizedCategory = normalizeUploadCategory(category);
        if (!normalizedCategory) return showToast("Geçerli bir kategori seçmelisiniz (Kategori ID eksik)", "error");
        setUploadMpActionLoading(`${product._id}-${platform}`);
        try {
            const response = await distributeProduct(product._id, [platform], {
                id: normalizedCategory.id,
                path: normalizedCategory.path,
                name: normalizedCategory.name
            }); 
            const platformResult = Array.isArray(response?.results)
                ? response.results.find((r) => normMP(r.marketplace) === normMP(platform))
                : null;
            const st = platformResult?.status;
            let statusText;
            let toastType = "success";
            if (st === "error") {
                statusText = platformResult?.message || `${platform}: yükleme başarısız`;
                toastType = "error";
            } else if (st === "skipped") {
                statusText = platformResult?.message || `${platform}: atlandı (zaten yüklü veya kategori güncellemesi yok)`;
            } else if (st === "success" || st === "pending") {
                statusText = platformResult?.message || (st === "pending" ? `${platform}: kuyrukta — sonuç bekleniyor` : `${platform}: gönderim tamamlandı`);
            } else {
                statusText = platformResult?.message || `${platform}: beklenmeyen yanıt — konsol / ağ sekmesini kontrol edin`;
                toastType = "error";
            }
            showToast(statusText, toastType);
            // Detayı güncelle
            const r = await getProductDetail(product._id);
            setUploadMpProduct(r.product);
            loadProducts(page); // Listeyi de tazele
        } catch (e) {
            const err = e?.response?.data;
            const msg = err?.details || err?.error || err?.message || `${platform} gönderim hatası`;
            showToast(msg, "error");
        } finally {
            setUploadMpActionLoading("");
        }
    };

    const resetDistUiState = () => {
        setDistTree([]);
        setDistExpanded(new Set());
        setDistSelected(null);
        setDistSearch("");
        setDistResults([]);
        setDistCenter(null);
        if (distSearchTimer.current) clearTimeout(distSearchTimer.current);
    };

    const closeDistFlow = () => {
        resetDistUiState();
        setDistUi(null);
        setDistCenterLoading(false);
        setDistActionLoading(false);
    };

    const openDistFlow = (product, platform) => {
        resetDistUiState();
        setDistUi({ product, platform, phase: "menu" });
    };

    const loadDistCategoryTree = async (platform) => {
        setDistLoadingTree(true);
        try {
            const normalizedPl = normMP(platform);
            const res = await getCategoryTree(normalizedPl);
            const tree = res?.data?.categories || res?.data?.tree || res?.data || [];
            setDistTree(Array.isArray(tree) ? tree : []);
        } catch {
            showToast(`${platform} kategori ağacı yüklenemedi. Entegrasyonu kontrol edin.`, "error");
            setDistTree([]);
        } finally {
            setDistLoadingTree(false);
        }
    };

    const goDistPhaseSearch = () => {
        if (!distUi) return;
        const pl = distUi.platform;
        setDistSelected(null);
        setDistSearch("");
        setDistResults([]);
        setDistExpanded(new Set());
        setDistUi((u) => (u ? { ...u, phase: "search" } : u));
        loadDistCategoryTree(pl);
    };

    const handleDistSearchChange = (val) => {
        setDistSearch(val);
        if (distSearchTimer.current) clearTimeout(distSearchTimer.current);
        if (!distUi || !val || val.trim().length < 2) {
            setDistResults([]);
            return;
        }
        const platform = distUi.platform;
        distSearchTimer.current = setTimeout(async () => {
            setDistLoadingSearch(true);
            try {
                const res = await searchCategories(normMP(platform), val.trim(), { listingOnly: true });
                setDistResults(res?.data?.results || []);
            } catch {
                setDistResults([]);
            } finally {
                setDistLoadingSearch(false);
            }
        }, 400);
    };

    const toggleDistExpand = (catId) => {
        setDistExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    const handleDistTreeClick = (cat, path = [], platform = distUi?.platform) => {
        const children = cat.children || cat.subCategories || [];
        const hasChildren = children.length > 0;
        if (hasChildren) toggleDistExpand(cat.id);
        if (!canSelectPmCategory(platform, cat, hasChildren)) {
            if (normMP(platform) === "hepsiburada") {
                showToast("Hepsiburada için yaprak ve listelenebilir katalog kategorisi seçin (kampanya değil)", "error");
            }
            return;
        }
        const fullPath = [...path, cat.name].join(" > ");
        setDistSelected({ id: cat.id, name: cat.name, path: fullPath });
    };

    const renderDistCategoryNode = (cat, level = 0, path = []) => {
        const children = cat.children || cat.subCategories || [];
        const hasChildren = children.length > 0;
        const isExpanded = distExpanded.has(cat.id);
        const isSelected = distSelected?.id === cat.id;
        const currentPath = [...path, cat.name];
        const treeSelectable = canSelectPmCategory(distUi?.platform, cat, hasChildren);
        return (
            <div key={cat.id} className={`ud-pm-cat-node-wrapper ${isExpanded ? "expanded" : ""}`}>
                <div
                    className={`ud-pm-cat-tree-item ${isSelected ? "selected" : ""} level-${level} ${hasChildren ? "has-children" : "is-leaf"}`}
                    style={{
                        paddingLeft: 12 + level * 20,
                        opacity: normMP(distUi?.platform) === "hepsiburada" && !treeSelectable ? 0.55 : 1
                    }}
                >
                    <div className="cat-info" onClick={() => handleDistTreeClick(cat, path, distUi?.platform)}>
                        {hasChildren ? (
                            <span className="expand-icon" onClick={(e) => { e.stopPropagation(); toggleDistExpand(cat.id); }}>
                                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                            </span>
                        ) : (
                            <span className="leaf-icon"><FaTag size={10} /></span>
                        )}
                        <div className="cat-name">{cat.name}</div>
                    </div>
                    {hasChildren && (
                        <div className="cat-meta" onClick={(e) => { e.stopPropagation(); toggleDistExpand(cat.id); }}>
                            <span className="child-count">{children.length} alt</span>
                        </div>
                    )}
                    {isSelected && <FaCheckCircle className="check-icon" />}
                </div>
                {hasChildren && isExpanded && (
                    <div className="cat-children-container">
                        {children.map((child) => renderDistCategoryNode(child, level + 1, currentPath))}
                    </div>
                )}
            </div>
        );
    };

    const distributeWithCategoryAndRefresh = async (product, platform, categoryPayload) => {
        const normalizedCategory = normalizeUploadCategory(categoryPayload);
        if (!normalizedCategory) {
            showToast("Kategori ID gerekli", "error");
            return;
        }
        setDistActionLoading(true);
        try {
            const response = await distributeProduct(product._id, [platform], {
                id: normalizedCategory.id,
                path: normalizedCategory.path,
                name: normalizedCategory.name
            });
            const platformResult = Array.isArray(response?.results)
                ? response.results.find((r) => normMP(r.marketplace) === normMP(platform))
                : null;
            const statusText = platformResult?.status === "success" || platformResult?.status === "pending"
                ? (platformResult?.message || `${platform} gönderimi başlatıldı`)
                : (platformResult?.message || `${platform} işlendi`);
            showToast(statusText, platformResult?.status === "error" ? "error" : "success");
            closeDistFlow();
            if (showDetail && detail && String(detail._id) === String(product._id)) {
                const r = await getProductDetail(product._id);
                setDetail(r.product);
            }
            loadProducts(page);
        } catch (e) {
            const err = e?.response?.data;
            showToast(err?.details || err?.error || err?.message || "Dağıtım hatası", "error");
        } finally {
            setDistActionLoading(false);
        }
    };

    const goDistPhaseCenter = async () => {
        if (!distUi) return;
        const pid = distUi.product._id;
        const pl = distUi.platform;
        setDistUi((u) => (u ? { ...u, phase: "center" } : u));
        setDistCenterLoading(true);
        setDistCenter(null);
        try {
            const res = await resolveForDistribute(pid, pl);
            setDistCenter(res?.data ?? null);
        } catch {
            setDistCenter({ resolved: false });
            showToast("Kategori merkezi yanıtı alınamadı", "error");
        } finally {
            setDistCenterLoading(false);
        }
    };

    const confirmCenterDistribute = () => {
        if (!distUi || !distCenter?.resolved || !distCenter.platformCategory?.categoryId) {
            showToast("Bu platform için merkezde geçerli kategori ID yok", "error");
            return;
        }
        const pc = distCenter.platformCategory;
        const leafName = pc.categoryPath && /[>]/.test(pc.categoryPath)
            ? pc.categoryPath.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean).pop()
            : (pc.categoryPath || distUi.platform);
        distributeWithCategoryAndRefresh(distUi.product, distUi.platform, {
            id: pc.categoryId,
            path: pc.categoryPath || String(pc.categoryId),
            name: leafName || distUi.platform
        });
    };

    const loadBulkProducts = useCallback(async (p = 0, s = bulkSearch) => {
        setBulkLoading(true);
        try {
            const params = { page: p, limit: LIMIT }; if (s) params.search = s;
            const res = await getProducts(params);
            setBulkProducts(res.products || []); setBulkTotal(res.total || 0); setBulkPage(p);
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); }
        finally { setBulkLoading(false); }
    }, [bulkSearch, showToast]);

    const loadChTabProducts = useCallback(async (p = 0) => {
        setChTabLoading(true);
        try {
            const params = { page: p, limit: LIMIT };
            const q = chTabSearch.trim();
            if (q) params.search = q;
            const res = await getProducts(params);
            setChTabProducts(res.products || []);
            setChTabTotal(res.total || 0);
            setChTabPage(p);
        } catch { showToast("Liste yüklenemedi", "error"); }
        finally { setChTabLoading(false); }
    }, [chTabSearch, showToast]);

    const loadVariantGroups = useCallback(async () => {
        setVgLoading(true);
        try {
            const data = await listVariantGroups();
            setVgGroups(data.groups || []);
        } catch (e) {
            showToast(e.response?.data?.error || e.message || "Varyant grupları yüklenemedi", "error");
        } finally {
            setVgLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (tab === "sync") loadLogs();
        if (tab === "fieldAudit") loadFieldAudit(0);
        if (tab === "products" || tab === "pricestock") loadProducts(0);
        if (tab === "bulk") loadBulkProducts(0);
        if (tab === "uploadMp") loadUploadMpProducts(0, uploadMpSearch, uploadMpFilterPl, uploadMpFilterType);
        if (tab === "channel-prices") loadChTabProducts(0);
        if (tab === "variants") loadVariantGroups();
    }, [tab, loadLogs]); // eslint-disable-line
    useEffect(() => { if (tab === "bulk") { if (bulkSearchRef.current) clearTimeout(bulkSearchRef.current); bulkSearchRef.current = setTimeout(() => loadBulkProducts(0, bulkSearch), 400); return () => clearTimeout(bulkSearchRef.current); } }, [bulkSearch]); // eslint-disable-line
    useEffect(() => { if (tab === "uploadMp") { const t = setTimeout(() => loadUploadMpProducts(0, uploadMpSearch, uploadMpFilterPl, uploadMpFilterType), 400); return () => clearTimeout(t); } }, [uploadMpSearch, uploadMpFilterPl, uploadMpFilterType]); // eslint-disable-line
    useEffect(() => {
        if (tab !== "channel-prices") return;
        const t = setTimeout(() => loadChTabProducts(0), 400);
        return () => clearTimeout(t);
    }, [chTabSearch]); // eslint-disable-line

    useEffect(() => {
        if (!chDetail) {
            setChDraft({});
            return;
        }
        const d = {};
        const master = chDetail.masterProduct || {};
        for (const pl of PLATFORMS) {
            const m = getPlMappingAny(chDetail, pl);
            const sale = m?.price != null && m.price !== "" ? m.price : master.price;
            const list = m?.listPrice != null && m.listPrice !== "" ? m.listPrice : (master.listPrice != null ? master.listPrice : sale);
            d[pl] = {
                sale: sale == null ? "" : String(sale),
                list: list == null ? "" : String(list)
            };
        }
        setChDraft(d);
    }, [chDetail]);

    // ── Actions ──
    const openDetail = async (id) => {
        setDetailLoading(true); setShowDetail(true);
        try { const r = await getProductDetail(id); setDetail(r.product); } catch { showToast("Detay yüklenemedi", "error"); }
        finally { setDetailLoading(false); }
    };

    const handleStockUpdate = async (id, stock) => {
        setActionLoading(`s-${id}`);
        try {
            await syncStock(id, Number(stock));
            showToast(`Stok güncellendi: ${stock}`);
            logUserActivity("marketplace", "Stok güncellendi", `Ürün #${String(id).slice(-8)} → ${stock} adet`, "success", { productId: id, stock: Number(stock) });
            loadProducts(page);
        } catch (e) { showToast("Stok hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handlePriceUpdate = async (id, price, listPrice) => {
        setActionLoading(`p-${id}`);
        try {
            await syncPrice(id, Number(price), listPrice ? Number(listPrice) : null);
            showToast(`Fiyat güncellendi: ${fmt(price)}`);
            logUserActivity("marketplace", "Fiyat güncellendi", `Ürün #${String(id).slice(-8)} → ${fmt(price)}`, "success", { productId: id, price: Number(price) });
            loadProducts(page);
        } catch (e) { showToast("Fiyat hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const selectChProduct = async (id) => {
        setChSelectedId(id);
        setChDetailLoading(true);
        setChDetail(null);
        try {
            const r = await getProductDetail(id);
            setChDetail(r.product);
        } catch { showToast("Ürün detayı alınamadı", "error"); }
        finally { setChDetailLoading(false); }
    };

    const setChDraftField = (pl, field, value) => {
        setChDraft((prev) => ({
            ...prev,
            [pl]: { ...(prev[pl] || { sale: "", list: "" }), [field]: value }
        }));
    };

    const parseChMoney = (v) => {
        if (v === "" || v == null) return null;
        const n = parseFloat(String(v).replace(",", "."));
        return Number.isNaN(n) ? null : n;
    };

    const saveChLocal = async (pl) => {
        if (!chDetail) return;
        const sale = parseChMoney(chDraft[pl]?.sale);
        const list = parseChMoney(chDraft[pl]?.list);
        if (sale == null || sale <= 0) { showToast("Geçerli satış fiyatı girin", "error"); return; }
        const listFin = list != null && list > 0 ? list : sale;
        setChRowAction(`${pl}-local`);
        try {
            await updateChannelPricesLocal(chDetail._id, [{ marketplaceName: pl, price: sale, listPrice: listFin }]);
            showToast(`${pl}: panelde kaydedildi`);
            const r = await getProductDetail(chDetail._id);
            setChDetail(r.product);
            loadChTabProducts(chTabPage);
        } catch (e) {
            showToast(e?.response?.data?.error || "Kayıt başarısız", "error");
        } finally { setChRowAction(""); }
    };

    const pushChPrice = async (pl) => {
        if (!chDetail) return;
        const sale = parseChMoney(chDraft[pl]?.sale);
        const list = parseChMoney(chDraft[pl]?.list);
        if (sale == null || sale <= 0) { showToast("Geçerli satış fiyatı girin", "error"); return; }
        const listFin = list != null && list > 0 ? list : null;
        setChRowAction(`${pl}-push`);
        try {
            await syncPrice(chDetail._id, sale, listFin, pl);
            showToast(`${pl}: pazaryerine iletildi`);
            const r = await getProductDetail(chDetail._id);
            setChDetail(r.product);
            loadChTabProducts(chTabPage);
        } catch (e) {
            showToast(e?.response?.data?.error || e?.response?.data?.details || "Pazaryeri güncellemesi başarısız", "error");
        } finally { setChRowAction(""); }
    };

    const fillChDraftFromMaster = () => {
        const master = chDetail?.masterProduct || {};
        const mp = Number(master.price);
        const lp = master.listPrice != null && master.listPrice !== "" ? Number(master.listPrice) : mp;
        if (!chDetail || !Number.isFinite(mp) || mp <= 0) {
            showToast("Master satış fiyatı yok veya geçersiz", "error");
            return;
        }
        const listVal = Number.isFinite(lp) && lp > 0 ? lp : mp;
        setChDraft((prev) => {
            const next = { ...prev };
            for (const pl of PLATFORMS) {
                if (!getPlMappingAny(chDetail, pl)) continue;
                next[pl] = { sale: String(mp), list: String(listVal) };
            }
            return next;
        });
        showToast("Taslaklar master referans fiyatıyla dolduruldu", "success");
    };

    const chListedCount = chDetail
        ? PLATFORMS.filter((pl) => getPlMappingAny(chDetail, pl)).length
        : 0;

    // Silme onay modal'ını aç
    const askDelete = (id) => {
        const p = products.find(x => x._id === id) || detail;
        const mp = p?.masterProduct || {};
        const platformList = [...new Set((p?.marketplaceMappings || []).map(m => m.marketplaceName).filter(Boolean))];
        setDeleteConfirm({
            id,
            name: mp.name || mp.barcode || "Ürün",
            platforms: platformList,
            selectedForRemoval: [...platformList],
            localOnly: false,
        });
        setDeleteResult(null);
    };

    const toggleDeletePlatform = (pl) => {
        setDeleteConfirm((c) => {
            if (!c) return c;
            const has = c.selectedForRemoval.includes(pl);
            const next = has ? c.selectedForRemoval.filter((x) => x !== pl) : [...c.selectedForRemoval, pl];
            return { ...c, selectedForRemoval: next };
        });
    };

    // Silme işlemini gerçekleştir
    const executeDelete = async () => {
        if (!deleteConfirm) return;
        const { id, platforms, selectedForRemoval, localOnly } = deleteConfirm;
        setDeleteLoading(true); setDeleteResult(null);
        try {
            const opts = { deleteFromMarketplaces: !localOnly };
            if (!localOnly && platforms.length > 0) {
                if (selectedForRemoval.length === 0) {
                    showToast("En az bir pazaryeri seçin veya \"sadece yerel sil\" işaretleyin", "error");
                    setDeleteLoading(false);
                    return;
                }
                const allPicked = platforms.length === selectedForRemoval.length
                    && platforms.every((pl) => selectedForRemoval.includes(pl));
                if (!allPicked) opts.platforms = selectedForRemoval;
            }
            const res = await deleteProduct(id, opts);
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

    const syncJobBusy = syncProgress?.status === "running";

    const handleSyncFrom = async (mp) => {
        try {
            const r = await syncFromMarketplace(mp._id, mp.marketplaceName, { async: true });
            if (r.jobId) startSyncJobPoll(r.jobId, `${mp.marketplaceName} — ürün çekme`, "single");
            else showToast("Sunucu iş kimliği döndürmedi", "error");
        } catch (e) {
            showToast(e.response?.data?.error || "Senkron başlatılamadı", "error");
        }
    };

    const handleSyncAll = async () => {
        try {
            const r = await syncAllMarketplaces({ async: true });
            if (r.jobId) startSyncJobPoll(r.jobId, "Tüm platformlar — ürün çekme", "all");
            else showToast("Sunucu iş kimliği döndürmedi", "error");
        } catch (e) {
            showToast(e.response?.data?.error || "Toplu senkron başlatılamadı", "error");
        }
    };

    const handleAutoSyncJob = async () => {
        try {
            const r = await triggerAutoSync({ async: true });
            if (r.jobId) startSyncJobPoll(r.jobId, "Otomatik stok senkronu", "auto");
            else showToast("Sunucu iş kimliği döndürmedi", "error");
        } catch (e) {
            showToast(e.response?.data?.error || "Oto sync başlatılamadı", "error");
        }
    };

    const handleDistributeUndistributed = async () => {
        setActionLoading("dist-undist");
        try {
            const r = await distributeUndistributed({});
            const s = r.stats || {};
            showToast(`${s.distributed || 0} ürün dağıtıldı${s.error > 0 ? `, ${s.error} hata` : ""}`);
            logUserActivity(
                "marketplace",
                "Dağıtım (bekleyen ürünler)",
                `${s.distributed || 0} ürün${s.error > 0 ? `, ${s.error} hata` : ""}`,
                s.error > 0 ? "warning" : "success",
                { stats: s }
            );
            loadProducts(0); loadDashboard();
        } catch (e) { showToast(e.response?.data?.error || "Dağıtım hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const handleBulkDistribute = async (targets) => {
        if (selected.size === 0) return showToast("Ürün seçin", "error");
        setActionLoading("bulk"); setBulkModal(false);
        try {
            const ids = Array.from(selected);
            await bulkDistributeSelected(ids, targets);
            showToast(`${selected.size} ürün dağıtıldı`);
            logUserActivity("marketplace", "Toplu dağıtım", `${ids.length} ürün seçilen pazaryerlerine gönderildi`, "success", { count: ids.length, targets });
            loadProducts(page); setSelected(new Set());
        } catch { showToast("Dağıtım hatası", "error"); }
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
        try { const r = await suggestCodes(uf.name.trim(), uf.brand, uf.category); setCodeSugg(r.suggestions); } catch { showToast("Ööneri alınamadı", "error"); }
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
        if (marketplaces.length > 0 && uf.targetMarketplaces.length === 0) {
            return showToast("En az bir hedef pazaryeri seçin.", "error");
        }
        setUploadLoading(true);
        try {
            const imgs = [...uf.imageUrls, ...imgFiles.map(f => f.preview)].filter(Boolean);
            const r = await createAndDistribute({ name: uf.name.trim(), barcode: uf.barcode.trim(), sku: uf.sku.trim(), description: uf.description.trim(), price: Number(uf.price), listPrice: uf.listPrice ? Number(uf.listPrice) : Number(uf.price), stock: Number(uf.stock) || 0, category: uf.category.trim(), brand: uf.brand.trim(), images: imgs, targetMarketplaces: uf.targetMarketplaces });
            const dist = r.distributeResults || [];
            const distFailed = dist.filter((x) => x.success === false);
            const allMarketplacesFailed =
                uf.targetMarketplaces.length > 0 && dist.length > 0 && distFailed.length === dist.length;
            const msg = r.message || "Ürün oluşturuldu!";
            if (allMarketplacesFailed) {
                showToast(msg, "error");
            } else if (distFailed.length > 0) {
                showToast(msg, "error");
            } else {
                showToast(msg);
            }
            if (!allMarketplacesFailed) {
                const defaultTargets = marketplaces.map((m) => m.marketplaceName).filter(Boolean);
                setUf({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "0", category: "", brand: "", imageUrls: [], targetMarketplaces: defaultTargets });
                setImgFiles([]); setCodeSugg(null); setCatLevels([]); setUploadStep(1);
            }
            loadProducts(0); loadDashboard();
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

    const toggleTarget = (p) => setUf((prev) => {
        const t = [...prev.targetMarketplaces];
        const i = t.indexOf(p);
        if (i >= 0) {
            if (t.length <= 1 && marketplaces.length > 0) {
                showToast("Dağıtım için en az bir pazaryeri seçili olmalıdır.", "error");
                return prev;
            }
            t.splice(i, 1);
        } else {
            t.push(p);
        }
        return { ...prev, targetMarketplaces: t };
    });

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
            <div className="icon" style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}><Icon /></div>
            <div className="title" style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
            {desc && <div className="desc" style={{ fontSize: 14, opacity: 0.7 }}>{desc}</div>}
        </div>
    );

    const Loading = () => (
        <div className="ud-pm-loading">
            <div className="spinner-lg" />
            Yükleniyor...
        </div>
    );

    const Pill = ({ color, children, style: pillStyle }) => (
        <span className="ud-pm-pill" style={{ background: color + "15", color, border: `1px solid ${color}30`, ...pillStyle }}>{children}</span>
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
            {
                icon: <FaShieldAlt />,
                label: "Alan farkı",
                val: dbP.withFieldDrift ?? "—",
                sub: dbP.criticalFieldDrift > 0 ? `${dbP.criticalFieldDrift} kritik` : "",
                color: dbP.criticalFieldDrift > 0 ? "var(--ud-pm-red)" : "var(--ud-pm-purple)",
                onClick: () => setTab("fieldAudit")
            },
            { icon: <FaStore />, label: "Platform", val: (db.marketplaces || marketplaces || []).length, color: "var(--ud-pm-purple)" },
        ];
        return (
            <div className="ud-pm-dash-grid">
                {cards.map(c => (
                    <motion.div key={c.label} role={c.onClick ? "button" : undefined} tabIndex={c.onClick ? 0 : undefined} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20`, cursor: c.onClick ? "pointer" : undefined }} onClick={c.onClick} onKeyDown={c.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onClick(); } } : undefined}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                            {c.sub ? <div style={{ fontSize: 10, color: c.color, marginTop: 2, opacity: 0.85 }}>{c.sub}</div> : null}
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    const driftSeverityColor = (s) => {
        if (s === "critical") return "var(--ud-pm-red)";
        if (s === "high") return "var(--ud-pm-yellow)";
        if (s === "medium") return "var(--ud-pm-accent)";
        return "var(--ud-pm-text-dim)";
    };

    const renderFieldAudit = () => {
        const faPages = Math.max(1, Math.ceil(faTotal / 30));
        return (
            <div className="ud-pm-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <FaShieldAlt style={{ color: "var(--ud-pm-purple)" }} /> Alan denetimi
                    </h3>
                    {faSummary && <Pill color="var(--ud-pm-purple)">{faSummary.productsWithDrift} ürün</Pill>}
                    {faSummary?.criticalProducts > 0 && <Pill color="var(--ud-pm-red)">{faSummary.criticalProducts} kritik</Pill>}
                </div>
                <p style={{ fontSize: 12, color: "var(--ud-pm-text-dim)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Master kayıt ile pazaryeri snapshot karşılaştırması (barkod, SKU, ad, model, marka, kategori, fiyat).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <input className="ud-pm-input" style={{ flex: 1, minWidth: 180 }} placeholder="Ürün / barkod / SKU ara…" value={faSearch}
                        onChange={e => setFaSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && loadFieldAudit(0)} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ud-pm-text-dim)" }}>
                        <input type="checkbox" className="ud-pm-checkbox" checked={faCriticalOnly} onChange={e => setFaCriticalOnly(e.target.checked)} />
                        Sadece kritik (barkod/SKU)
                    </label>
                    <button type="button" className="ud-pm-btn sm accent" onClick={() => loadFieldAudit(0)}><FaSearch /> Listele</button>
                </div>
                {faLoading ? <Loading /> : faItems.length === 0 ? (
                    <Empty icon={FaShieldAlt} title="Alan farkı yok" desc="Uyumlu veya henüz ürün çekilmedi." />
                ) : (
                    <div className="ud-pm-log-list ud-pm-log-list--journal">
                        {faItems.map(item => {
                            const expanded = faExpandedId === item._id;
                            return (
                                <div key={item._id} className="ud-pm-log-item ud-pm-log-item--expandable"
                                    onClick={() => setFaExpandedId(expanded ? null : item._id)}>
                                    <div className="ud-pm-log-item-row">
                                        <span className="dot" style={{ background: item.hasCritical ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} />
                                        {item.hasCritical && <Pill color="var(--ud-pm-red)">Kritik</Pill>}
                                        <span className="log-name">{item.name}</span>
                                        <span style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>{item.barcode} · {item.sku}</span>
                                        <Pill color="var(--ud-pm-purple)">{item.driftPlatformCount} platform</Pill>
                                        {expanded ? <FaChevronDown style={{ fontSize: 10 }} /> : <FaChevronRight style={{ fontSize: 10 }} />}
                                    </div>
                                    {expanded && (
                                        <div className="ud-pm-log-item-detail" onClick={e => e.stopPropagation()}>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={() => openDetail(item._id)}><FaEye /> Ürün detayı</button>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={() => handleRefreshFieldAuditOne(item._id)}
                                                    disabled={actionLoading === `fa-refresh-${item._id}`}>
                                                    <FaSync /> Yeniden denetle
                                                </button>
                                            </div>
                                            {(item.platforms || []).map(pl => (
                                                <div key={pl.marketplaceName} style={{ marginBottom: 10, padding: 8, border: "1px solid var(--ud-pm-glass-border)", borderRadius: 8 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 12, color: PL_COLOR[pl.marketplaceName], marginBottom: 6 }}>{pl.marketplaceName}</div>
                                                    {(pl.drifts || []).map((d, di) => (
                                                        <div key={di} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) 1fr 1fr auto", gap: 6, fontSize: 11, marginTop: 6, alignItems: "center" }}>
                                                            <span style={{ color: driftSeverityColor(d.severity) }}>{d.label}</span>
                                                            <span style={{ wordBreak: "break-all" }} title="Master">{d.masterValue || "—"}</span>
                                                            <span style={{ wordBreak: "break-all" }} title="Platform">{d.platformValue || "—"}</span>
                                                            <button type="button" className="ud-pm-btn sm accent outline"
                                                                disabled={actionLoading === `fa-${item._id}-${d.field}`}
                                                                onClick={() => handleApplyPlatformField(item._id, pl.marketplaceName, d.field)}>
                                                                Platformu al
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {faTotal > 30 && <Pagination currentPage={faPage} totalPages={faPages} total={faTotal} onPageChange={pg => loadFieldAudit(pg)} />}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB: PAZARYERİ BAZLI FİYATLAR
       ═══════════════════════════════════════════════════════════════ */
    const renderChannelPrices = () => {
        const master = chDetail?.masterProduct || {};
        const chPages = Math.max(1, Math.ceil(chTabTotal / LIMIT));
        return (
            <div className="ud-pm-chpr-root">
                <div className="ud-pm-chpr-hero ud-pm-card">
                    <div className="ud-pm-chpr-hero-main">
                        <div className="ud-pm-chpr-hero-icon" aria-hidden><FaPercentage /></div>
                        <div className="ud-pm-chpr-hero-copy">
                            <h3 className="ud-pm-chpr-title"><FaDollarSign /> Pazaryeri fiyatları</h3>
                            <p className="ud-pm-chpr-sub">Soldan ürün seçin; her pazaryeri için satış ve liste fiyatını girin. Önce <strong>Panelde kaydet</strong>, ardından <strong>Pazaryerine gönder</strong> ile canlı güncelleyin.</p>
                        </div>
                    </div>
                    <ol className="ud-pm-chpr-steps" aria-label="İşlem adımları">
                        <li><span className="ud-pm-chpr-step-num">1</span> Ürün seç</li>
                        <li><span className="ud-pm-chpr-step-num">2</span> Fiyatları düzenle</li>
                        <li><span className="ud-pm-chpr-step-num">3</span> Kaydet / gönder</li>
                    </ol>
                </div>
                <div className="ud-pm-chpr-layout">
                    <div className="ud-pm-chpr-list ud-pm-card">
                        <div className="ud-pm-chpr-list-top">
                            <div className="ud-pm-chpr-list-title">
                                <FaLayerGroup /> Ürünler
                                <span className="ud-pm-chpr-count">{chTabTotal}</span>
                            </div>
                        </div>
                        <div className="ud-pm-search-wrap ud-pm-chpr-search">
                            <span className="icon"><FaSearch /></span>
                            <input className="ud-pm-search" value={chTabSearch} onChange={(e) => setChTabSearch(e.target.value)} placeholder="Ad, barkod veya SKU…" aria-label="Pazaryeri fiyatlarında ürün ara" />
                        </div>
                        {chTabLoading ? <Loading /> : chTabProducts.length === 0 ? <Empty title="Ürün yok" desc="Aramayı değiştirin veya ürün ekleyin." />
                            : (
                                <div className="ud-pm-chpr-list-scroll">
                                    {chTabProducts.map((row) => {
                                        const mp = row.masterProduct || {};
                                        const active = chSelectedId && String(chSelectedId) === String(row._id);
                                        const nListed = PLATFORMS.filter((pl) => getPlMappingAny(row, pl)).length;
                                        return (
                                            <button
                                                key={row._id}
                                                type="button"
                                                className={`ud-pm-chpr-list-item ${active ? "active" : ""}`}
                                                onClick={() => selectChProduct(row._id)}
                                            >
                                                {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="ud-pm-chpr-thumb" /> : <div className="ud-pm-chpr-thumb ph"><FaBox /></div>}
                                                <div className="ud-pm-chpr-list-meta">
                                                    <div className="ud-pm-chpr-list-name">{mp.name || "İsimsiz"}</div>
                                                    <div className="ud-pm-chpr-list-sub">{mp.barcode || "—"} · {fmt(mp.price)}</div>
                                                    <div className="ud-pm-chpr-list-footer">
                                                        <div className="ud-pm-chpr-list-pldots" aria-hidden>
                                                            {PLATFORMS.map((pl) => {
                                                                const on = getPlMappingAny(row, pl);
                                                                return (
                                                                    <span
                                                                        key={pl}
                                                                        className={`ud-pm-chpr-pldot ${on ? "on" : ""}`}
                                                                        style={{ "--pl": PL_COLOR[pl] }}
                                                                        title={pl}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                        <span className="ud-pm-chpr-list-plhint">{nListed}/{PLATFORMS.length} kanal</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        <Pagination currentPage={chTabPage} totalPages={chPages} total={chTabTotal} onPageChange={(p) => loadChTabProducts(p)} />
                    </div>
                    <div className="ud-pm-chpr-panel ud-pm-card">
                        {!chSelectedId ? (
                            <div className="ud-pm-chpr-placeholder">
                                <div className="ud-pm-chpr-placeholder-icon"><FaStore /></div>
                                <div className="ud-pm-chpr-placeholder-title">Ürün seçilmedi</div>
                                <p>Soldaki listeden bir ürün seçerek pazaryeri fiyatlarını görüntüleyip düzenleyebilirsiniz.</p>
                            </div>
                        ) : chDetailLoading ? <Loading /> : !chDetail ? <Empty title="Yüklenemedi" />
                            : (
                                <>
                                    <div className="ud-pm-chpr-summary">
                                        <div className="ud-pm-chpr-product-head">
                                            {master.images?.[0] ? <img src={master.images[0]} alt="" className="ud-pm-chpr-hero-img" /> : <div className="ud-pm-chpr-hero-img ph"><FaBox /></div>}
                                            <div className="ud-pm-chpr-product-head-text">
                                                <h4 className="ud-pm-chpr-product-title">{master.name}</h4>
                                                <div className="ud-pm-chpr-badges">
                                                    <Pill color="var(--ud-pm-accent)"><FaBarcode style={{ fontSize: 8 }} /> {master.barcode}</Pill>
                                                    {master.sku && <Pill color="var(--ud-pm-purple)">{master.sku}</Pill>}
                                                    <span className="ud-pm-chpr-kanal-badge">{chListedCount} aktif kanal</span>
                                                </div>
                                                <div className="ud-pm-chpr-master-strip">
                                                    <div className="ud-pm-chpr-master-row">
                                                        <div className="ud-pm-chpr-master-ref">
                                                            <span className="ud-pm-chpr-master-label">Master referans</span>
                                                            <strong>{fmt(master.price)}</strong>
                                                            {master.listPrice != null && master.listPrice !== master.price && (
                                                                <span className="ud-pm-chpr-master-list"> · Liste {fmt(master.listPrice)}</span>
                                                            )}
                                                        </div>
                                                        <button type="button" className="ud-pm-btn sm accent outline ud-pm-chpr-fill-master" onClick={fillChDraftFromMaster} disabled={chListedCount === 0}>
                                                            <FaBolt /> Referansı doldur
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ud-pm-chpr-channels-head">
                                        <span className="ud-pm-chpr-channels-title">Kanal fiyatları</span>
                                        <span className="ud-pm-chpr-channels-hint">Her satır bağımsız kaydedilir</span>
                                    </div>
                                    <div className="ud-pm-chpr-channels">
                                        {PLATFORMS.map((pl) => {
                                            const m = getPlMappingAny(chDetail, pl);
                                            const listed = !!m;
                                            const rowBusy = chRowAction.startsWith(`${pl}-`);
                                            const d = chDraft[pl] || { sale: "", list: "" };
                                            return (
                                                <div
                                                    key={pl}
                                                    className={`ud-pm-chpr-card ${listed ? "is-listed" : "is-muted"}`}
                                                    style={{ "--chpr-accent": PL_COLOR[pl] }}
                                                >
                                                    <div className="ud-pm-chpr-card-head">
                                                        <span className="ud-pm-chpr-pl ud-pm-chpr-pl--lg" style={{ color: PL_COLOR[pl] }}>
                                                            {MP_LOGO[pl]} {pl}
                                                        </span>
                                                        {listed ? (
                                                            <span className="ud-pm-chpr-card-badge ud-pm-chpr-card-badge--ok">Kayıtlı</span>
                                                        ) : (
                                                            <span className="ud-pm-chpr-card-badge">Bu kanalda yok</span>
                                                        )}
                                                    </div>
                                                    {listed ? (
                                                        <>
                                                            <div className="ud-pm-chpr-card-fields">
                                                                <label className="ud-pm-chpr-field">
                                                                    <span>Satış (₺)</span>
                                                                    <input
                                                                        className="ud-pm-chpr-input"
                                                                        value={d.sale}
                                                                        onChange={(e) => setChDraftField(pl, "sale", e.target.value)}
                                                                        inputMode="decimal"
                                                                        placeholder="0,00"
                                                                    />
                                                                </label>
                                                                <label className="ud-pm-chpr-field">
                                                                    <span>Liste (₺)</span>
                                                                    <input
                                                                        className="ud-pm-chpr-input"
                                                                        value={d.list}
                                                                        onChange={(e) => setChDraftField(pl, "list", e.target.value)}
                                                                        inputMode="decimal"
                                                                        placeholder="0,00"
                                                                    />
                                                                </label>
                                                            </div>
                                                            <div className="ud-pm-chpr-card-live">
                                                                <span className="ud-pm-chpr-card-live-label">Kayıtlı fiyat</span>
                                                                <span className="ud-pm-chpr-now">
                                                                    {m.price != null ? fmt(m.price) : "—"}
                                                                    {m.listPrice != null && m.listPrice !== m.price && <small> · liste {fmt(m.listPrice)}</small>}
                                                                </span>
                                                            </div>
                                                            <div className="ud-pm-chpr-card-actions">
                                                                <button type="button" className="ud-pm-btn sm muted ud-pm-chpr-card-btn" disabled={rowBusy} onClick={() => saveChLocal(pl)} title="Sadece panel veritabanı">
                                                                    {rowBusy && chRowAction === `${pl}-local` ? <span className="spinner" /> : <FaSave />} Panelde kaydet
                                                                </button>
                                                                <button type="button" className="ud-pm-btn sm green ud-pm-chpr-card-btn ud-pm-chpr-btn-mp" disabled={rowBusy} onClick={() => pushChPrice(pl)} title="Pazaryeri API">
                                                                    {rowBusy && chRowAction === `${pl}-push` ? <span className="spinner" /> : <FaGlobe />} Pazaryerine gönder
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="ud-pm-chpr-card-hint">Bu ürün bu pazaryerine dağıtılmamış; fiyat alanları kapalıdır.</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="ud-pm-chpr-footnote ud-pm-chpr-footnote--box">
                                        <FaInfoCircle className="ud-pm-chpr-footnote-ico" />
                                        <div>
                                            <strong>Panelde kaydet</strong> yalnızca veritabanını günceller. <strong>Pazaryerine gönder</strong> ilgili API ile canlı fiyat güncellemesi dener; ürünün o platformda aktif olması gerekir.
                                        </div>
                                    </div>
                                </>
                            )}
                    </div>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 1: ÜRÜN LİSTESİ
       ═══════════════════════════════════════════════════════════════ */
    const renderProducts = () => (
        <div>
            {/* Toolbar */}
            <div className="ud-pm-toolbar ud-pm-toolbar--card">
                <div className="ud-pm-search-wrap">
                    <span className="icon"><FaSearch /></span>
                    <input className="ud-pm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..." aria-label="Ürün ara" />
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
                <button className="ud-pm-btn sm accent" onClick={handleSyncAll} disabled={syncJobBusy}>
                    {syncJobBusy ? <span className="spinner" /> : <FaSync />} Çek
                </button>
                <button className="ud-pm-btn sm purple outline" onClick={handleDistributeUndistributed} disabled={actionLoading === "dist-undist"}
                    title="Platformlarda eksik olan ürünleri otomatik dağıt">
                    {actionLoading === "dist-undist" ? <span className="spinner" /> : <FaRocket />} Eksikleri Dağıt
                </button>
            </div>

            {/* Ürünler — tek sütun, alt alta liste */}
            <div className="ud-pm-product-list-wrap ud-pm-card">
                <div className="ud-pm-product-list-head">
                    <label className="ud-pm-product-list-check-all">
                        <input type="checkbox" className="ud-pm-checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                        <span>Tümünü seç</span>
                    </label>
                </div>
                <div className="ud-pm-product-list">
                    {loading ? (
                        <div className="ud-pm-product-list-loading"><Loading /></div>
                    ) : products.length === 0 ? (
                        <Empty icon={FaBox} title="Ürün bulunamadı" desc="Pazaryerlerinden çekin veya yeni ekleyin" />
                    ) : products.map((p, i) => {
                        const mp = p.masterProduct || {};
                        const st = p.stockTracking || {};
                        const isSel = selected.has(p._id);
                        return (
                            <motion.div
                                key={p._id}
                                layout={false}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.02, 0.35) }}
                                className={`ud-pm-product-list-item ${isSel ? "selected" : ""}`}
                                onClick={() => openDetail(p._id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(p._id); } }}
                            >
                                <div className="ud-pm-product-list-item-check" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" className="ud-pm-checkbox" checked={isSel} onChange={() => toggleSel(p._id)} />
                                </div>
                                <div className="ud-pm-product-list-item-main">
                                    {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="ud-pm-product-list-img" />
                                        : <div className="ud-pm-product-list-img ud-pm-product-list-img--ph"><FaBox /></div>}
                                    <div className="ud-pm-product-list-text">
                                        <div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</div>
                                        {mp.brand && <div className="ud-pm-product-list-brand">{mp.brand}</div>}
                                        <div className="ud-pm-product-list-codes">
                                            <span className="mono">{mp.barcode || "—"}</span>
                                            <span className="mono-dim">{mp.sku || "—"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="ud-pm-product-list-item-stats">
                                    <div className="ud-pm-product-list-stat">
                                        <span className="ud-pm-product-list-stat-label">Fiyat</span>
                                        <span className="price">{fmt(mp.price)}</span>
                                        {mp.listPrice != null && mp.listPrice !== mp.price && <span className="price-old">{fmt(mp.listPrice)}</span>}
                                    </div>
                                    <div className="ud-pm-product-list-stat">
                                        <span className="ud-pm-product-list-stat-label">Stok</span>
                                        <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"}>
                                            {st.totalStock ?? mp.stock ?? 0}
                                        </span>
                                    </div>
                                    <div className="ud-pm-product-list-stat ud-pm-product-list-stat--platforms">
                                        <span className="ud-pm-product-list-stat-label">Platform</span>
                                        <PlatformDots product={p} />
                                    </div>
                                </div>
                                <div className="ud-pm-product-list-item-actions" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" className="ud-pm-btn sm accent outline" onClick={() => openDetail(p._id)}><FaEye /></button>
                                    <button type="button" className="ud-pm-btn sm red outline" onClick={() => askDelete(p._id)}><FaTrash /></button>
                                </div>
                            </motion.div>
                        );
                    })}
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
       TAB: YENİ ÜRÜN & DAĞIT (sihirbaz — createAndDistribute)
       ═══════════════════════════════════════════════════════════════ */
    const renderNewProductWizard = () => (
        <div className="ud-pm-wizard-tab">
            <div className="ud-pm-wizard-tab-intro ud-pm-card" role="note">
                <p className="ud-pm-wizard-tab-desc">
                    Pazaryeri seçtiyseniz 4. adımda her platform için kategori seçin. Görseller: pazaryerine aktarım için en az bir <strong>https://</strong> görsel URL gerekir.
                    Zaten kayıtlı bir ürünü yüklemek için <strong>Ürünleri Yükle</strong> sekmesine geçin.
                </p>
            </div>
            <div className="ud-pm-card ud-pm-wizard-tab-body">
                <ProductUploadWizard userId={userId} />
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TAB 3: FİYAT & STOK
       ═══════════════════════════════════════════════════════════════ */
    const psToggleSel = (id) => setPsSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const psToggleAll = () => psSelected.size === products.length ? setPsSelected(new Set()) : setPsSelected(new Set(products.map(p => p._id)));
    const handleBulkCloseStock = async () => {
        if (psSelected.size === 0) { showToast("Önce ürün seçin", "error"); return; }
        setPsCloseLoading(true);
        let ok = 0, fail = 0;
        for (const id of psSelected) {
            try { await syncStock(id, 0); ok++; } catch { fail++; }
        }
        setPsCloseLoading(false);
        showToast(`${ok} ürünün stoğu kapatıldı${fail ? `, ${fail} hata` : ""}`, fail ? "warning" : "success");
        setPsSelected(new Set());
        loadProducts(page);
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB 5: PAZARYERİNE YÜKLE
       ═══════════════════════════════════════════════════════════════ */
    const renderUploadMarketplace = () => (
        <div className="ud-pm-upload-mp-container">
            {/* Sol: Ürün Listesi */}
            <div className="ud-pm-card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
                <div style={{ padding: 15, borderBottom: "1px solid var(--ud-pm-border)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="ud-pm-search-wrap" style={{ width: "100%" }}>
                        <span className="icon"><FaSearch /></span>
                        <input className="ud-pm-search" value={uploadMpSearch} onChange={e => setUploadMpSearch(e.target.value)} placeholder="Ürün ara..." />
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                        <select 
                            className="ud-pm-select sm" 
                            style={{ flex: 1, fontSize: 11 }}
                            value={uploadMpFilterPl} 
                            onChange={e => setUploadMpFilterPl(e.target.value)}
                        >
                            <option value="">Tüm Platformlar</option>
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select 
                            className="ud-pm-select sm" 
                            style={{ flex: 1, fontSize: 11 }}
                            value={uploadMpFilterType} 
                            onChange={e => setUploadMpFilterType(e.target.value)}
                        >
                            <option value="">Durum Hepsi</option>
                            <option value="listed">Yüklü Olanlar</option>
                            <option value="not_listed">Yüklü Olmayanlar</option>
                        </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 11 }}>{total} ürün</span>
                        <button
                            className="ud-pm-btn sm outline"
                            onClick={() => { setUploadMpSearch(""); setUploadMpFilterPl(""); setUploadMpFilterType(""); }}
                        >
                            <FaTimes /> Filtreyi Temizle
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
                    {uploadMpLoading ? <Loading /> : products.length === 0 ? <Empty title="Ürün bulunamadı" /> : (
                        products.map(p => (
                            <div key={p._id} 
                                className={`ud-pm-upload-list-item ${uploadMpProduct?._id === p._id ? "active" : ""}`}
                                onClick={() => setUploadMpProduct(p)}>
                                                <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: "1px solid var(--ud-pm-border)", background: "#fff" }}>
                                                    {p.masterProduct?.images?.[0] ? <img src={p.masterProduct.images[0]} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}><FaImage size={24} /></div>}
                                                </div>
                                                <div>
                                                    <div className="name" style={{ fontWeight: 600, color: "var(--ud-pm-text)" }}>{p.masterProduct?.name || "İsimsiz"}</div>
                                                    <div className="sku" style={{ fontSize: 11, color: "var(--ud-pm-text-sub)" }}>{p.masterProduct?.sku || p.masterProduct?.barcode || "-"}</div>
                                                    <div className="mps" style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                                        {PLATFORMS.map(pl => {
                                                            const m = (p.marketplaceMappings || []).find(mm => normMP(mm.marketplaceName) === normMP(pl) && mm.syncStatus !== "error");
                                                            return m ? <span key={pl} title={pl} style={{ width: 6, height: 6, borderRadius: "50%", background: PL_COLOR[pl] }} /> : null;
                                                        })}
                                                    </div>
                                                </div>
                                <FaChevronRight className="chevron" />
                            </div>
                        ))
                    )}
                </div>
                <div style={{ padding: 10, borderTop: "1px solid var(--ud-pm-border)" }}>
                    <Pagination currentPage={uploadMpPage} totalPages={Math.ceil(total / LIMIT)} total={total} onPageChange={loadUploadMpProducts} />
                </div>
            </div>

            {/* Sağ: Pazaryeri Dağıtım Paneli */}
            <div className="ud-pm-card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--ud-pm-bg-card)", position: "relative" }}>
                {!uploadMpProduct ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", color: "var(--ud-pm-text-sub)", gap: 10 }}>
                        <FaCloudUploadAlt style={{ fontSize: 48, opacity: 0.2 }} />
                        <p>Düzenlemek veya yüklemek için soldan bir ürün seçin.</p>
                    </div>
                ) : (
                    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {/* Üst Bilgi */}
                        <div style={{ flexShrink: 0, padding: 20, borderBottom: "1px solid var(--ud-pm-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(255,255,255,0.02)" }}>
                            <div style={{ display: "flex", gap: 15 }}>
                                <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: "1px solid var(--ud-pm-border)", background: "#fff" }}>
                                    {uploadMpProduct.masterProduct?.images?.[0] ? <img src={uploadMpProduct.masterProduct.images[0]} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}><FaImage size={24} /></div>}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 18, margin: "0 0 5px 0", color: "var(--ud-pm-text)" }}>{uploadMpProduct.masterProduct?.name || "İsimsiz"}</h2>
                                    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                                        <Pill color="var(--ud-pm-blue)">SKU: {uploadMpProduct.masterProduct?.sku || "-"}</Pill>
                                        <Pill color="var(--ud-pm-purple)">Barkod: {uploadMpProduct.masterProduct?.barcode || "-"}</Pill>
                                        <Pill color="var(--ud-pm-accent)">{(uploadMpProduct.masterProduct?.price || 0).toLocaleString("tr-TR", { style: "currency", currency: uploadMpProduct.masterProduct?.currency || "TRY" })}</Pill>
                                    </div>
                                </div>
                            </div>
                            <button className="ud-pm-btn sm outline" onClick={() => openDetail(uploadMpProduct._id)}><FaBolt /> Tüm Bilgiler</button>
                        </div>

                        {/* Pazaryeri listesi + kategori: kategori seçilince dikey alan bölünür */}
                        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <div style={{ flexShrink: 0, padding: "16px 20px 12px", maxHeight: uploadMpSelectedPlatform ? "min(38vh, 400px)" : "none", overflowY: uploadMpSelectedPlatform ? "auto" : "visible" }}>
                            <h3 style={{ fontSize: 14, marginBottom: 15, display: "flex", alignItems: "center", gap: 8, color: "var(--ud-pm-text)" }}><FaStore /> Satış Platformları</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 15 }}>
                                {marketplaces.map(mp => {
                                    const ps = getPlStatus(uploadMpProduct, mp.marketplaceName);
                                    const isSelected = uploadMpSelectedPlatform === mp.marketplaceName;
                                    const mapping = uploadMpProduct.marketplaceMappings?.find(m => m.marketplaceName === mp.marketplaceName);
                                    
                                    return (
                                        <div key={mp._id} 
                                            className={`ud-pm-mp-upload-card ${isSelected ? "selected" : ""} ${ps.exists ? "exists" : ""}`}
                                            onClick={() => {
                                                setUploadMpSelectedPlatform(mp.marketplaceName);
                                                const catPathStr = Array.isArray(mapping?.categoryPath) ? mapping.categoryPath.join(" > ") : mapping?.categoryPath;
                                                setUploadMpSelectedCategory(mapping ? { 
                                                    id: mapping.categoryId || mapping.externalCategoryId, 
                                                    path: catPathStr, 
                                                    name: mapping.categoryName || mapping.externalCategoryName 
                                                } : null);
                                                setUploadMpCatResults([]);
                                                setUploadMpCatSearch("");
                                                setUploadMpCatPath([]);
                                                setUploadMpCatExpanded(new Set());
                                                loadCategoryTree(mp.marketplaceName);
                                            }}>
                                            <div className="mp-icon" style={{ background: PL_COLOR[mp.marketplaceName] + "15", color: PL_COLOR[mp.marketplaceName] }}>
                                                {PL_SHORT[mp.marketplaceName]}
                                            </div>
                                            <div className="mp-info">
                                                <div className="mp-name">{mp.marketplaceName}</div>
                                                <div className="mp-status">
                                                    {ps.exists ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                            <span style={{ color: "var(--ud-pm-green)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                                                                <FaCheckCircle size={10} /> Yüklü
                                                            </span>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                {mapping?.categoryName && (
                                                                    <span style={{ fontSize: 9, color: "var(--ud-pm-text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>
                                                                        {mapping.categoryName}
                                                                    </span>
                                                                )}
                                                                {(mapping?.categoryId || mapping?.externalCategoryId) && (
                                                                    <span style={{ fontSize: 8, color: "var(--ud-pm-text-sub)", fontFamily: 'monospace' }}>
                                                                        ID: {mapping.categoryId || mapping.externalCategoryId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "var(--ud-pm-text-sub)", fontSize: 11 }}>Yüklü Değil</span>
                                                    )}
                                                </div>
                                            </div>
                                            {ps.exists && <div className="mp-synced"><FaSync size={10} /></div>}
                                        </div>
                                    );
                                })}
                            </div>
                            </div>

                            {/* Kategori Seçim Alanı */}
                            {uploadMpSelectedPlatform && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", marginTop: 8, borderTop: "1px solid var(--ud-pm-border)", padding: "12px 20px 20px" }}>
                                    <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                                        <h3 style={{ fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--ud-pm-text)" }}>
                                            <FaSitemap color={PL_COLOR[uploadMpSelectedPlatform]} /> {uploadMpSelectedPlatform} Kategori Seçimi
                                        </h3>
                                        {uploadMpSelectedCategory && (
                                            <Pill color="var(--ud-pm-green)">Seçili: {uploadMpSelectedCategory.id}</Pill>
                                        )}
                                    </div>

                                    {/* Mevcut Kategori / Breadcrumb */}
                                    <div className="ud-pm-cat-breadcrumb-container" style={{ flexShrink: 0 }}>
                                        <div className="ud-pm-cat-breadcrumb-title">
                                            <FaFolderOpen /> Kategori Yolu:
                                        </div>
                                        <div className="ud-pm-cat-breadcrumb">
                                            <span className="breadcrumb-item" onClick={() => { setUploadMpCatExpanded(new Set()); setUploadMpSelectedCategory(null); }}>
                                                {uploadMpSelectedPlatform}
                                            </span>
                                            {uploadMpSelectedCategory && (
                                                <>
                                                    <FaChevronRight className="sep" />
                                                    <span className="breadcrumb-item active">
                                                        {uploadMpSelectedCategory.name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {uploadMpSelectedCategory && (
                                            <div className="ud-pm-cat-full-path" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--ud-pm-bg-alt)', borderRadius: 6, borderLeft: '3px solid var(--ud-pm-accent)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ud-pm-text)', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                                                    <FaInfoCircle size={12} color="var(--ud-pm-accent)" /> Detaylı Kategori Bilgisi
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--ud-pm-text-sub)', lineHeight: 1.4 }}>
                                                    <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <strong style={{ color: 'var(--ud-pm-text)', minWidth: 80 }}>Kategori ID:</strong> 
                                                        <code style={{ background: 'var(--ud-pm-bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--ud-pm-border)', color: 'var(--ud-pm-accent)' }}>
                                                            {uploadMpSelectedCategory.id}
                                                        </code>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                                        <strong style={{ color: 'var(--ud-pm-text)', minWidth: 80, marginTop: 2 }}>Kategori Yolu:</strong> 
                                                        <div style={{ flex: 1, color: 'var(--ud-pm-text)', background: 'var(--ud-pm-bg)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--ud-pm-border)', fontSize: 10 }}>
                                                            {uploadMpSelectedCategory.path || uploadMpSelectedCategory.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Arama */}
                                    <div className="ud-pm-field" style={{ flexShrink: 0, marginBottom: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                            <label style={{ margin: 0 }}>Kategori Ara <small>(En az 2 harf)</small></label>
                                            <button className="ud-pm-btn sm outline" onClick={resetUploadMpCategoryState}>
                                                <FaTimes /> Temizle
                                            </button>
                                        </div>
                                        <div className="ud-pm-cat-search-grid">
                                            <span className="search-icon"><FaSearch /></span>
                                            <input className="search-input" 
                                                value={uploadMpCatSearch} 
                                                onChange={e => handleUploadMpCatSearch(e.target.value, uploadMpSelectedPlatform)} 
                                                placeholder={`${uploadMpSelectedPlatform} kategorilerinde ara...`} />
                                            <span className="search-spinner">
                                                {(uploadMpCatLoading || uploadMpCatTreeLoading) ? <FaSpinner className="ud-pm-spin" /> : null}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: 6, fontSize: 10, color: "var(--ud-pm-text-dim)" }}>
                                            {uploadMpCatSearch.length >= 2
                                                ? `${uploadMpCatResults.length} sonuç`
                                                : "Arama yapmazsanız kategori ağacı listelenir."}
                                        </div>
                                    </div>

                                    {/* Sonuçlar veya Ağaç */}
                                    <div className="ud-pm-cat-results ud-pm-upload-mp-cat-scroll" style={{ flex: 1, minHeight: 0 }}>
                                        {uploadMpCatSearch.length >= 2 ? (
                                            /* Arama Sonuçları */
                                            uploadMpCatResults.length > 0 ? (
                                                uploadMpCatResults.map(cat => {
                                                    const selectable = canSelectPmCategory(uploadMpSelectedPlatform, cat, cat.hasChildren);
                                                    return (
                                                    <div key={cat.id} 
                                                        className={`ud-pm-cat-result-item ${uploadMpSelectedCategory?.id === cat.id ? "selected" : ""}`}
                                                        style={selectable ? undefined : { opacity: 0.6, cursor: "not-allowed" }}
                                                        title={!selectable && normMP(uploadMpSelectedPlatform) === "hepsiburada" ? "Listelenebilir yaprak kategori değil" : undefined}
                                                        onClick={() => {
                                                            if (!canSelectPmCategory(uploadMpSelectedPlatform, cat, cat.hasChildren)) {
                                                                if (normMP(uploadMpSelectedPlatform) === "hepsiburada") {
                                                                    showToast("Hepsiburada için listelenebilir yaprak kategori seçin", "error");
                                                                }
                                                                return;
                                                            }
                                                            setUploadMpSelectedCategory(cat);
                                                        }}>
                                                        <div className="cat-name">{cat.name}</div>
                                                        <div className="cat-path">{cat.path}</div>
                                                        {uploadMpSelectedCategory?.id === cat.id && <FaCheckCircle className="check" />}
                                                    </div>
                                                    );
                                                })
                                            ) : !uploadMpCatLoading && (
                                                <div className="ud-pm-cat-no-results">Sonuç bulunamadı.</div>
                                            )
                                        ) : uploadMpCatSearch.length > 0 ? (
                                            <div className="ud-pm-cat-hint">Arama için en az 2 karakter girin.</div>
                                        ) : (
                                            /* Kategori Ağacı */
                                            uploadMpCatTreeLoading ? (
                                                <div className="ud-pm-cat-loading"><FaSpinner className="spin" /> Kategoriler yükleniyor...</div>
                                            ) : uploadMpCatTree.length > 0 ? (
                                                <div className="ud-pm-cat-tree-container">
                                                    {uploadMpCatTree.map(cat => renderCategoryNode(cat, 0, []))}
                                                </div>
                                            ) : (
                                                <div className="ud-pm-cat-hint">
                                                    <p>Kategoriler yüklenemedi.</p>
                                                    <button className="ud-pm-btn-sm" onClick={() => loadCategoryTree(uploadMpSelectedPlatform)}>Yenile</button>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Gönderim Butonu */}
                                    <div style={{ marginTop: 16, flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                        <button className="ud-pm-btn outline" onClick={() => { setUploadMpSelectedPlatform(null); resetUploadMpCategoryState(); }}>Vazgeç</button>
                                        {!normalizeUploadCategory(uploadMpSelectedCategory) && (
                                            <div style={{ alignSelf: "center", color: "var(--ud-pm-yellow)", fontSize: 11, marginRight: 6 }}>
                                                Yüklemek için kategori ID'si olan bir seçim yapın
                                            </div>
                                        )}
                                        <button 
                                            className="ud-pm-btn" 
                                            style={{ background: PL_COLOR[uploadMpSelectedPlatform], color: "#fff", minWidth: 200, justifyContent: "center" }}
                                            disabled={!normalizeUploadCategory(uploadMpSelectedCategory) || uploadMpActionLoading}
                                            onClick={() => handleUploadToMarketplace(uploadMpProduct, uploadMpSelectedPlatform, uploadMpSelectedCategory)}>
                                            {uploadMpActionLoading === `${uploadMpProduct._id}-${uploadMpSelectedPlatform}` ? <span className="spinner" /> : <FaCloudUploadAlt />}
                                            {uploadMpProduct.marketplaceMappings?.some(m => m.marketplaceName === uploadMpSelectedPlatform) ? "Kategoriyi Güncelle & Gönder" : `${uploadMpSelectedPlatform}'a Yükle`}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderPriceStock = () => (
        <div>
            <div className="ud-pm-toolbar ud-pm-toolbar--card">
                <div className="ud-pm-search-wrap">
                    <span className="icon"><FaSearch /></span>
                    <input className="ud-pm-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara..." aria-label="Fiyat stok listesinde ara" />
                </div>
                <select className="ud-pm-select" value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                    <option value="">Tüm</option><option value="lowStock">Düşük</option><option value="outOfStock">Yok</option>
                </select>
                <div className="ud-pm-spacer" />
                {psSelected.size > 0 && (
                    <button className="ud-pm-btn sm" disabled={psCloseLoading}
                        style={{ background: "var(--ud-pm-red)", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "6px 14px" }}
                        onClick={handleBulkCloseStock}>
                        {psCloseLoading ? <FaSpinner className="spin" /> : <FaTimesCircle />}
                        <span>Seçili ({psSelected.size}) Stoğu Kapat</span>
                    </button>
                )}
                <Pill color="var(--ud-pm-accent)">{total} ürün</Pill>
            </div>
            <div className="ud-pm-table-wrap">
                <div className="ud-pm-table-scroll">
                    <table className="ud-pm-table ud-pm-ps-table" style={{ minWidth: 850 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}><input type="checkbox" className="ud-pm-checkbox" checked={psSelected.size === products.length && products.length > 0} onChange={psToggleAll} /></th>
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
                                <tr><td colSpan={9 + Math.min(PLATFORMS.length, 3)}><Loading /></td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={9 + Math.min(PLATFORMS.length, 3)}><Empty icon={FaDollarSign} title="Ürün bulunamadı" /></td></tr>
                            ) : products.map(p => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const ed = editMap[p._id] || {};
                                const isSel = psSelected.has(p._id);
                                return (
                                    <tr key={p._id} className={isSel ? "selected" : ""}>
                                        <td onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" className="ud-pm-checkbox" checked={isSel} onChange={() => psToggleSel(p._id)} />
                                        </td>
                                        <td>
                                            <div className="product-cell">
                                                {mp.images?.[0] ? <img src={mp.images[0]} alt="" className="product-img" />
                                                    : <div className="product-img-placeholder"><FaBox /></div>}
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</div>
                                                    <div className="mono-dim">{mp.barcode}</div>
                                                </div>
                                            </div>
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
                                                {ps.exists ? (
                                                    <div className="p-card-mp-info" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                                        <span className="mp-icon-mini" style={{ display: "flex", fontSize: 14 }}>{MP_LOGO[pl] || <FaStore />}</span>
                                                        <span style={{ color: "var(--ud-pm-text)", fontSize: 11, fontWeight: 600 }}>
                                                            {ps.price ? fmt(ps.price) : "—"}
                                                        </span>
                                                    </div>
                                                ) : <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 10 }}>—</span>}
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
        if (catTreeData[key]?.loİaded) return;
        setCatTreeLoading(key);
        try {
            const r = { categories: [] };
            setCatTreeData(prev => ({
                ...prev,
                [key]: { children: r.categories || [], loİaded: true }
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
                        if (!node.hasChildren || platform !== "Trendyol") {
                            setCatSelectedNode({ id: node.id, name: node.name, path: node.path || node.name, platform });
                        }
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
                                                            <span className="mp-icon-mini" style={{ marginRight: 6 }}>{MP_LOGO[mc.marketplaceName] || <FaStore />}</span>
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
                                                                        <span className="mp-icon-mini" style={{ marginRight: 6 }}>{MP_LOGO[mc.marketplaceName] || <FaStore />}</span>
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
                            onClick={() => handleSyncFrom(mp)} disabled={syncJobBusy}>
                            <FaSync /> Ürün Çek
                        </button>
                    </div>
                ))}
                <div className="ud-pm-card" style={{ background: "linear-gradient(135deg, rgba(78,205,196,0.05), rgba(139,92,246,0.05))", borderColor: "rgba(78,205,196,0.2)" }}>
                    <div className="ud-pm-sync-header">
                        <span className="mp-icon" style={{ color: "var(--ud-pm-accent)" }}><FaGlobe /></span>
                        <div><div className="mp-name">Tüm Platformlar</div><div className="mp-status">Toplu senkâronizasyon</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button className="ud-pm-btn accent" style={{ flex: 1, justifyContent: "center" }} onClick={handleSyncAll} disabled={syncJobBusy}>
                            <FaSync /> Tümünü Çek
                        </button>
                        <button className="ud-pm-btn purple" style={{ flex: 1, justifyContent: "center" }}
                            onClick={handleAutoSyncJob}
                            disabled={syncJobBusy}>
                            <FaBolt /> Oto Sync
                        </button>
                    </div>
                </div>
            </div>

            <div className="ud-pm-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                        <div style={{ color: "var(--ud-pm-text)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                            <FaClipboardList style={{ color: "var(--ud-pm-accent)" }} /> Stok Defteri
                        </div>
                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 11, marginTop: 4 }}>
                            Son {logHours === "0" ? "tüm" : `${logHours} saat`} — hangi ürünün stoku neden değişti burada görünür
                        </div>
                    </div>
                    <button type="button" className="ud-pm-btn sm accent outline" onClick={loadLogs} disabled={logsLoading}><FaSync /> Yenile</button>
                </div>

                {logSummary && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
                        <div className="ud-pm-stat-mini" style={{ borderColor: "rgba(78,205,196,0.35)" }}>
                            <div className="val">{logSummary.totalEvents}</div>
                            <div className="lbl">Toplam olay</div>
                        </div>
                        <div className="ud-pm-stat-mini">
                            <div className="val">{logSummary.uniqueProducts}</div>
                            <div className="lbl">Ürün (benzersiz)</div>
                        </div>
                        <div className="ud-pm-stat-mini" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
                            <div className="val" style={{ color: "var(--ud-pm-red)" }}>{logSummary.wentToZero}</div>
                            <div className="lbl">Stok → 0</div>
                        </div>
                        <div className="ud-pm-stat-mini">
                            <div className="val" style={{ color: "var(--ud-pm-green)" }}>+{logSummary.stockIncreased}</div>
                            <div className="lbl">Stok artışı</div>
                        </div>
                        <div className="ud-pm-stat-mini">
                            <div className="val" style={{ color: "var(--ud-pm-yellow)" }}>-{logSummary.stockDecreased}</div>
                            <div className="lbl">Stok düşüşü</div>
                        </div>
                        <div className="ud-pm-stat-mini">
                            <div className="val">{logSummary.orderRelated}</div>
                            <div className="lbl">Sipariş kaynaklı</div>
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
                    <select className="ud-pm-select" style={{ minWidth: 100 }} value={logHours} onChange={e => setLogHours(e.target.value)}>
                        <option value="24">Son 24 saat</option>
                        <option value="48">Son 48 saat</option>
                        <option value="168">Son 7 gün</option>
                        <option value="0">Tümü</option>
                    </select>
                    <select className="ud-pm-select" style={{ minWidth: 130 }} value={logSourceFilter} onChange={e => setLogSourceFilter(e.target.value)}>
                        <option value="">Tüm kaynaklar</option>
                        <option value="order">Sipariş</option>
                        <option value="manual">Manuel</option>
                        <option value="cron">Cron (oto)</option>
                        <option value="bulk">Toplu işlem</option>
                        <option value="catalog">Katalog denetimi</option>
                    </select>
                    <select className="ud-pm-select" style={{ minWidth: 140 }} value={logActionFilter} onChange={e => setLogActionFilter(e.target.value)}>
                        <option value="">Tüm işlemler</option>
                        <option value="order_placed">Sipariş düşüşü</option>
                        <option value="manual_sync">Manuel push</option>
                        <option value="auto_sync">Otomatik push</option>
                        <option value="stock_update">Stok güncelleme</option>
                        <option value="bulk_update">Toplu güncelleme</option>
                        <option value="product_field_drift">Katalog alan farkı</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ud-pm-text-dim)", cursor: "pointer" }}>
                        <input type="checkbox" className="ud-pm-checkbox" checked={logStockOnly} onChange={e => setLogStockOnly(e.target.checked)} />
                        Sadece stok olayları
                    </label>
                    <input
                        className="ud-pm-input"
                        style={{ flex: 1, minWidth: 160 }}
                        placeholder="Barkod / ürün adı ara…"
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && loadLogs()}
                    />
                    <button type="button" className="ud-pm-btn sm accent" onClick={loadLogs}><FaSearch /> Ara</button>
                </div>

                {logsLoading ? <Loading />
                : syncLogs.length === 0 ? <Empty icon={FaClipboardList} title="Bu filtrede kayıt yok" desc="Süreyi genişletin veya 'Sadece stok' işaretini kaldırın" />
                : (
                    <div className="ud-pm-log-list ud-pm-log-list--journal">
                        {syncLogs.map((log, i) => {
                            const rowId = log._id || i;
                            const expanded = logExpandedId === rowId;
                            const pillColor = log.isZeroStock ? "var(--ud-pm-red)"
                                : log.isStockIncrease ? "var(--ud-pm-green)"
                                : log.isStockDecrease ? "var(--ud-pm-yellow)"
                                : log.actionType === "price_update" ? "var(--ud-pm-yellow)" : "var(--ud-pm-accent)";
                            return (
                                <div key={rowId} className="ud-pm-log-item ud-pm-log-item--expandable"
                                    onClick={() => setLogExpandedId(expanded ? null : rowId)}>
                                    <div className="ud-pm-log-item-row">
                                        <span className="dot" style={{ background: log.status === "success" ? "var(--ud-pm-green)" : log.status === "error" ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} />
                                        <Pill color={pillColor}>{log.actionLabel || log.actionType}</Pill>
                                        <Pill color="var(--ud-pm-text-dim)">{log.sourceLabel || log.source}</Pill>
                                        {log.isZeroStock && <Pill color="var(--ud-pm-red)">Sıfırlandı</Pill>}
                                        <span className="log-name">{log.product?.name || log.product?.barcode || "—"}</span>
                                        {log.changes?.field === "stock" && (
                                            <span className="log-change" style={{ fontWeight: 700 }}>
                                                {log.changes.oldValue} → {log.changes.newValue}
                                                {log.stockDelta != null && log.stockDelta !== 0 && (
                                                    <span style={{ color: log.stockDelta > 0 ? "var(--ud-pm-green)" : "var(--ud-pm-red)", marginLeft: 4 }}>
                                                        ({log.stockDelta > 0 ? "+" : ""}{log.stockDelta})
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        <span className="log-date">{fmtDate(log.timestamp)}</span>
                                        {expanded ? <FaChevronDown style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }} /> : <FaChevronRight style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }} />}
                                    </div>
                                    {expanded && (
                                        <div className="ud-pm-log-item-detail" onClick={e => e.stopPropagation()}>
                                            {log.product?.barcode && <div>Barkod: <strong style={{ color: "var(--ud-pm-text)" }}>{log.product.barcode}</strong></div>}
                                            {log.order?.orderNumber && <div>Sipariş: <strong style={{ color: "var(--ud-pm-text)" }}>{log.order.orderNumber}</strong> ({log.order.marketplace || log.marketplace?.name || "—"})</div>}
                                            {log.marketplaceSummary && <div>Pazaryerleri: {log.marketplaceSummary}</div>}
                                            {log.hasMarketplaceErrors && log.marketplaceErrors?.map((e, j) => (
                                                <div key={j} style={{ color: "var(--ud-pm-red)" }}>{e.name}: {e.error}</div>
                                            ))}
                                            {log.product?.productMappingId && (
                                                <button type="button" className="ud-pm-btn sm accent outline" style={{ marginTop: 6 }}
                                                    onClick={() => openDetail(log.product.productMappingId)}>
                                                    <FaEye /> Ürünü aç
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       DAĞITIM — Kategori seçimi (detay modalından Gönder)
       ═══════════════════════════════════════════════════════════════ */
    const renderDistributeModal = () => {
        if (!distUi) return null;
        const { product, platform, phase } = distUi;

        return ReactDOM.createPortal(
            <AnimatePresence>
                <motion.div
                    className="ud-pm-modal-overlay ud-pm-dist-layer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { if (!distActionLoading && !distCenterLoading) closeDistFlow(); }}
                >
                    <motion.div
                        className={`ud-pm-modal ud-pm-dist-modal ud-pm-dist-modal--${phase}`}
                        initial={{ scale: 0.94, y: 16 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.94, y: 16 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ud-pm-modal-header" style={{ marginBottom: 14 }}>
                            <div className="product-info" style={{ alignItems: "flex-start" }}>
                                <div>
                                    <h2 style={{ fontSize: 16, margin: 0 }}>{platform} — Ürün gönderimi</h2>
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ud-pm-text-dim)", fontWeight: 400 }}>
                                        {(product.masterProduct || {}).name || "Ürün"}
                                    </p>
                                </div>
                            </div>
                            <button type="button" className="close-btn" disabled={distActionLoading} onClick={closeDistFlow}><FaTimes /></button>
                        </div>

                        {phase === "menu" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <button type="button" className="ud-pm-btn accent" style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
                                    onClick={goDistPhaseSearch}>
                                    <FaSearch /> Kategori ara (ağaç ve arama)
                                </button>
                                <button type="button" className="ud-pm-btn purple" style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
                                    onClick={() => { void goDistPhaseCenter(); }}>
                                    <FaSitemap /> Kategori merkezini kullan (otomatik)
                                </button>
                                <p style={{ fontSize: 11, color: "var(--ud-pm-text-dim)", margin: 0, lineHeight: 1.5 }}>
                                    Kategori merkezi: ürününüzün Trendyol kayıtlı kategori ID’si veya ana ürün kategori metniyle eşleşen satırdan, <strong>{platform}</strong> için tanımlı kategori kullanılır.
                                </p>
                            </div>
                        )}

                        {phase === "search" && (
                            <div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    <button type="button" className="ud-pm-btn sm muted" onClick={() => { setDistUi((u) => (u ? { ...u, phase: "menu" } : u)); }}>
                                        <FaChevronLeft /> Geri
                                    </button>
                                    <button type="button" className="ud-pm-btn sm outline" onClick={() => loadDistCategoryTree(platform)} disabled={distLoadingTree}>
                                        <FaSync /> Yenile
                                    </button>
                                </div>
                                <div className="ud-pm-cat-search-grid" style={{ marginBottom: 10 }}>
                                    <span className="search-icon"><FaSearch /></span>
                                    <input
                                        className="search-input"
                                        value={distSearch}
                                        onChange={(e) => handleDistSearchChange(e.target.value)}
                                        placeholder={`${platform} kategorilerinde ara (en az 2 harf)...`}
                                    />
                                    <span className="search-spinner">{distLoadingSearch ? <FaSpinner className="ud-pm-spin" /> : null}</span>
                                </div>
                                {distResults.length > 0 && (
                                    <div className="ud-pm-cat-results ud-pm-dist-cat-results">
                                        {distResults.map((cat) => {
                                            const selectable = canSelectPmCategory(platform, cat, cat.hasChildren);
                                            return (
                                            <div
                                                key={String(cat.id)}
                                                className={`ud-pm-cat-result-item ${distSelected?.id === cat.id ? "selected" : ""}`}
                                                style={selectable ? undefined : { opacity: 0.6, cursor: "not-allowed" }}
                                                title={!selectable && normMP(platform) === "hepsiburada" ? "Listelenebilir yaprak kategori değil" : undefined}
                                                onClick={() => {
                                                    const hasChildren = cat.hasChildren === true;
                                                    if (!canSelectPmCategory(platform, cat, hasChildren)) {
                                                        if (normMP(platform) === "hepsiburada") {
                                                            showToast("Hepsiburada için listelenebilir yaprak kategori seçin", "error");
                                                        }
                                                        return;
                                                    }
                                                    setDistSelected({ id: cat.id, name: cat.name, path: cat.path || cat.name });
                                                }}
                                            >
                                                <div className="cat-name">{cat.name}</div>
                                                <div className="cat-path">{cat.path}</div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {distLoadingTree ? <div className="ud-pm-cat-loading"><FaSpinner className="spin" /> Yükleniyor...</div>
                                    : (
                                        <div className="ud-pm-cat-tree-container ud-pm-dist-cat-tree">
                                            {distTree.length ? distTree.map((c) => renderDistCategoryNode(c, 0, []))
                                                : <div style={{ fontSize: 12, color: "var(--ud-pm-text-dim)" }}>Kategori bulunamadı.</div>}
                                        </div>
                                    )}
                                {distSelected && (
                                    <div style={{ marginTop: 12, padding: 10, background: "rgba(78,205,196,0.08)", borderRadius: 8, fontSize: 11 }}>
                                        <strong>Seçili:</strong> {distSelected.path}{" "}
                                        <span style={{ color: "var(--ud-pm-text-dim)" }}>(ID: {distSelected.id})</span>
                                    </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                                    <button type="button" className="ud-pm-btn accent" disabled={distActionLoading || !normalizeUploadCategory(distSelected)}
                                        onClick={() => distributeWithCategoryAndRefresh(product, platform, distSelected)}>
                                        {distActionLoading ? <span className="spinner" /> : <FaRocket />} Gönder
                                    </button>
                                </div>
                            </div>
                        )}

                        {phase === "center" && (
                            <div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    <button type="button" className="ud-pm-btn sm muted" onClick={() => { setDistCenter(null); setDistUi((u) => (u ? { ...u, phase: "menu" } : u)); }} disabled={distCenterLoading}>
                                        <FaChevronLeft /> Geri
                                    </button>
                                </div>
                                {distCenterLoading ? <Loading />
                                    : distCenter?.resolved ? (
                                        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                                            <div style={{ marginBottom: 10, padding: 10, background: "var(--ud-pm-glass)", borderRadius: 8 }}>
                                                <div style={{ fontWeight: 700, color: "var(--ud-pm-text)", marginBottom: 6 }}>Kategori merkezi (master)</div>
                                                <div style={{ color: "var(--ud-pm-text-sub)" }}>{distCenter.master?.masterPath || distCenter.master?.masterName || "—"}</div>
                                            </div>
                                            <div style={{ marginBottom: 10, padding: 10, border: "1px solid var(--ud-pm-border)", borderRadius: 8 }}>
                                                <div style={{ fontWeight: 700, color: "var(--ud-pm-accent)", marginBottom: 6 }}>{platform} — merkezdeki eşlenik</div>
                                                {distCenter.platformCategory?.categoryPath ? (
                                                    <div style={{ color: "var(--ud-pm-text)" }}>{distCenter.platformCategory.categoryPath}</div>
                                                ) : null}
                                                <div style={{ color: "var(--ud-pm-text-dim)", marginTop: 4 }}>
                                                    Kategori ID: <code style={{ color: "var(--ud-pm-accent)" }}>{distCenter.platformCategory?.categoryId || "—"}</code>
                                                </div>
                                                {!distCenter.platformCategory?.isComplete && (
                                                    <p style={{ color: "var(--ud-pm-yellow)", margin: "8px 0 0" }}>
                                                        Merkezde bu platform için kategori ID boş. Kategori Ara ile manuel seçin veya Kategori Merkezi sayfasında eşleştirmeyi tamamlayın.
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                                <button type="button" className="ud-pm-btn purple" disabled={distActionLoading || !distCenter.platformCategory?.categoryId}
                                                    onClick={confirmCenterDistribute}>
                                                    {distActionLoading ? <span className="spinner" /> : <FaRocket />} Bu kategori ile gönder
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "8px 0" }}>
                                            <p style={{ color: "var(--ud-pm-text-sub)", fontSize: 12, marginBottom: 12 }}>
                                                {distCenter?.hint
                                                    ? `Ürün kategorisi: "${distCenter.hint}" — merkezde eşleşen satır bulunamadı.`
                                                    : "Kategori merkezinde eşleşme yok. Önce ürüne kategori atayın veya Kategori Ara kullanın."}
                                            </p>
                                            <button type="button" className="ud-pm-btn accent outline" onClick={goDistPhaseSearch}>
                                                Kategori ara
                                            </button>
                                        </div>
                                    )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>,
            document.body
        );
    };

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
                                                        onClick={() => openDistFlow(p, pl)}>
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

                                {p.fieldAuditSummary?.hasAnyDrift && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            <FaShieldAlt style={{ color: p.fieldAuditSummary.hasCritical ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} /> Alan farkı (master vs platform)
                                            {p.fieldAuditSummary.hasCritical && <Pill color="var(--ud-pm-red)">Kritik</Pill>}
                                            <button type="button" className="ud-pm-btn sm outline" style={{ marginLeft: "auto" }}
                                                onClick={() => handleRefreshFieldAuditOne(p._id)}
                                                disabled={actionLoading === `fa-refresh-${p._id}`}>
                                                <FaSync /> Yeniden denetle
                                            </button>
                                        </div>
                                        {(p.fieldAuditSummary.platforms || []).map((pl) => (
                                            <div key={pl.marketplaceName} style={{ marginBottom: 10, padding: 8, border: "1px solid var(--ud-pm-glass-border)", borderRadius: 8 }}>
                                                <div style={{ fontWeight: 700, fontSize: 12, color: PL_COLOR[pl.marketplaceName], marginBottom: 6 }}>
                                                    {pl.marketplaceName}
                                                    {pl.hasCritical && <Pill color="var(--ud-pm-red)" style={{ marginLeft: 6 }}>Kritik</Pill>}
                                                </div>
                                                {(pl.drifts || []).map((d, di) => (
                                                    <div key={di} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) 1fr 1fr auto", gap: 6, fontSize: 11, marginTop: 6, alignItems: "center" }}>
                                                        <span style={{ color: driftSeverityColor(d.severity) }}>{d.label}</span>
                                                        <span style={{ wordBreak: "break-all" }}>{d.masterValue || "—"}</span>
                                                        <span style={{ wordBreak: "break-all" }}>{d.platformValue || "—"}</span>
                                                        <button type="button" className="ud-pm-btn sm accent outline"
                                                            disabled={actionLoading === `fa-${p._id}-${d.field}`}
                                                            onClick={() => handleApplyPlatformField(p._id, pl.marketplaceName, d.field)}>
                                                            Platformu al
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {Array.isArray(p.categoryFieldOverview) && p.categoryFieldOverview.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <FaClipboardList style={{ color: "var(--ud-pm-accent)" }} /> Kategori gereksinimleri
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--ud-pm-text-dim)", marginBottom: 10, lineHeight: 1.5 }}>
                                            Her pazaryerinin <strong>kategori şeması</strong> ile ürün kaydındaki değerler birleştirilir (marka, renk, boyut, tablo alanları vb.). Zorunlu satırlar üstte listelenir.
                                        </div>
                                        {p.categoryFieldOverview.map((block, bi) => {
                                            const pl = block.marketplace || "";
                                            const plColor = PL_COLOR[pl] || "var(--ud-pm-accent)";
                                            const attrs = Array.isArray(block.attributes) ? block.attributes : [];
                                            return (
                                                <div
                                                    key={`${pl}-${block.categoryId || bi}`}
                                                    style={{
                                                        marginBottom: 12,
                                                        borderRadius: 10,
                                                        border: "1px solid var(--ud-pm-glass-border)",
                                                        background: "var(--ud-pm-glass)",
                                                        overflow: "hidden"
                                                    }}
                                                >
                                                    <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--ud-pm-glass-border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 12, color: plColor }}>{pl}</span>
                                                        {block.categoryId != null && (
                                                            <Pill color="var(--ud-pm-text-dim)" style={{ fontSize: 10 }}>Kat. ID: {block.categoryId}</Pill>
                                                        )}
                                                        {block.categoryName && (
                                                            <span style={{ fontSize: 11, color: "var(--ud-pm-text-sub)", flex: "1 1 140px" }}>{block.categoryName}</span>
                                                        )}
                                                        {block.syncStatus && (
                                                            <Pill color="var(--ud-pm-text-dim)" style={{ fontSize: 10 }}>{block.syncStatus}</Pill>
                                                        )}
                                                    </div>
                                                    <div style={{ padding: "8px 10px" }}>
                                                        {block.skipped && block.message && (
                                                            <div style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>{block.message}</div>
                                                        )}
                                                        {block.error && (
                                                            <div style={{ fontSize: 11, color: "var(--ud-pm-red)", marginBottom: 6 }}>{block.error}</div>
                                                        )}
                                                        {!block.skipped && !block.error && attrs.length === 0 && (
                                                            <div style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>Bu kategori için özellik listesi boş döndü.</div>
                                                        )}
                                                        {attrs.length > 0 && (
                                                            <div style={{ maxHeight: 280, overflow: "auto" }}>
                                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                                                    <thead>
                                                                        <tr style={{ textAlign: "left", color: "var(--ud-pm-text-dim)", borderBottom: "1px solid var(--ud-pm-glass-border)" }}>
                                                                            <th style={{ padding: "6px 4px", fontWeight: 700 }}>Özellik</th>
                                                                            <th style={{ padding: "6px 4px", fontWeight: 700, width: 56 }}>Zorunlu</th>
                                                                            <th style={{ padding: "6px 4px", fontWeight: 700 }}>Mevcut değer</th>
                                                                            <th style={{ padding: "6px 4px", fontWeight: 700 }}>Örnek / liste</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {attrs.map((row, ri) => {
                                                                            const sample = (row.valueSample || []).map((v) => v.name).filter(Boolean).slice(0, 4).join(", ");
                                                                            const more =
                                                                                row.valueTotal > (row.valueSample || []).length
                                                                                    ? ` (+${row.valueTotal - (row.valueSample || []).length})`
                                                                                    : row.valueTotal > 4 && sample
                                                                                      ? ` (+${row.valueTotal - 4})`
                                                                                      : "";
                                                                            return (
                                                                                <tr
                                                                                    key={`${row.attributeId ?? "a"}-${row.name}-${ri}`}
                                                                                    style={{
                                                                                        borderBottom: "1px solid rgba(128,128,128,0.08)",
                                                                                        background: row.required ? "rgba(245,158,11,0.04)" : "transparent"
                                                                                    }}
                                                                                >
                                                                                    <td style={{ padding: "6px 4px", color: "var(--ud-pm-text)", fontWeight: row.required ? 600 : 500 }}>
                                                                                        {row.name || row.attributeId || "—"}
                                                                                        {row.variant ? <span style={{ color: "var(--ud-pm-purple)", fontWeight: 600, marginLeft: 4 }}>varyant</span> : null}
                                                                                        {row.type ? <div style={{ fontSize: 9, color: "var(--ud-pm-text-dim)", fontWeight: 400 }}>{row.type}</div> : null}
                                                                                    </td>
                                                                                    <td style={{ padding: "6px 4px", color: row.required ? "var(--ud-pm-yellow)" : "var(--ud-pm-text-dim)" }}>
                                                                                        {row.required ? "Evet" : "—"}
                                                                                    </td>
                                                                                    <td style={{ padding: "6px 4px", color: row.currentValue ? "var(--ud-pm-green)" : "var(--ud-pm-red)", wordBreak: "break-word" }}>
                                                                                        {row.currentValue || "—"}
                                                                                    </td>
                                                                                    <td style={{ padding: "6px 4px", color: "var(--ud-pm-text-sub)", wordBreak: "break-word" }}>
                                                                                        {sample || "—"}
                                                                                        {more}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
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
        const { name, platforms, selectedForRemoval, localOnly } = deleteConfirm;
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
                            /* Silme onay ekâranı */
                            <>
                                <div style={{ textAlign: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 40, marginBottom: 10 }}><FaExclamationTriangle style={{ color: "var(--ud-pm-red)" }} /></div>
                                    <div style={{ color: "var(--ud-pm-text)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ürünü Sil</div>
                                    <div style={{ color: "var(--ud-pm-text-sub)", fontSize: 12 }}>
                                        <strong style={{ color: "var(--ud-pm-text)" }}>{name}</strong> kalıcı olarak silinecek.
                                    </div>
                                </div>

                                <label style={{
                                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12,
                                    padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ud-pm-glass-border)", background: "var(--ud-pm-glass)",
                                }}>
                                    <input
                                        type="checkbox"
                                        className="ud-pm-checkbox"
                                        checked={!!localOnly}
                                        onChange={(e) => setDeleteConfirm((c) => (c ? { ...c, localOnly: e.target.checked } : c))}
                                    />
                                    <span style={{ color: "var(--ud-pm-text)", fontSize: 12, fontWeight: 600 }}>Sadece yerel kaydı sil (pazaryerlerine dokunma)</span>
                                </label>

                                {hasPlatforms && !localOnly && (
                                    <div style={{ background: "var(--ud-pm-glass)", border: "1px solid var(--ud-pm-glass-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <FaGlobe style={{ color: "var(--ud-pm-red)", fontSize: 14 }} />
                                            <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700 }}>Pazaryerlerinden kaldır</div>
                                        </div>
                                        <div style={{ color: "var(--ud-pm-text-dim)", fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
                                            İşaretli platformlarda stok 0 / arşiv / silme uygulanır (platform kurallarına göre). Tümünü seçili bırakmak = ürünün olduğu her yer.
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {platforms.map(pl => (
                                                <label key={pl} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--ud-pm-text)" }}>
                                                    <input
                                                        type="checkbox"
                                                        className="ud-pm-checkbox"
                                                        checked={selectedForRemoval.includes(pl)}
                                                        onChange={() => toggleDeletePlatform(pl)}
                                                    />
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                                                        <FaStore style={{ fontSize: 10, color: PL_COLOR[pl] || "var(--ud-pm-accent)" }} /> {pl}
                                                    </span>
                                                </label>
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
                                        {localOnly ? "Yerel Sil" : hasPlatforms ? "Sil (pazaryeri + yerel)" : "Sil"}
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

    const toggleBulkDeleteMpPick = (mpName) => {
        setBulkDeleteMpPick((prev) => (prev.includes(mpName) ? prev.filter((x) => x !== mpName) : [...prev, mpName]));
    };

    const handleBulkDelete = async () => {
        if (bulkSelected.size === 0) return showToast("Ürün seçin", "error");
        if (!bulkDeleteLocalOnly && bulkDeleteMpScope === "pick") {
            if (bulkDeleteMpPick.length === 0) return showToast("En az bir pazaryeri seçin veya \"Tüm pazaryerler\" moduna dönün", "error");
        }
        let confirmMsg = `${bulkSelected.size} ürün kalıcı silinecek. Bu işlem geri alınamaz!`;
        if (bulkDeleteLocalOnly) {
            confirmMsg = `${bulkSelected.size} ürün yalnızca program kaydından silinsin mi?\nPazaryeri listelerinizde ürün kalır.`;
        } else if (bulkDeleteMpScope === "pick") {
            confirmMsg = `${bulkSelected.size} ürün silinsin; pazaryerinden kaldırma yalnızca şunlar için uygulansın mı?\n${bulkDeleteMpPick.join(", ")}\n\nYerel kayıt da silinir. Geri alınamaz!`;
        } else {
            confirmMsg = `${bulkSelected.size} ürün silinecek ve ürünün bulunduğu tüm pazaryerlerinden kaldırılacak.\nBu işlem geri alınamaz!`;
        }
        if (!window.confirm(confirmMsg)) return;
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const opts = { deleteFromMarketplaces: !bulkDeleteLocalOnly };
            if (!bulkDeleteLocalOnly && bulkDeleteMpScope === "pick" && bulkDeleteMpPick.length > 0) {
                opts.platforms = bulkDeleteMpPick;
            }
            const r = await bulkDeleteProducts(Array.from(bulkSelected), opts);
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
                    <div className="ud-pm-toolbar ud-pm-toolbar--card">
                        <div className="ud-pm-search-wrap ud-pm-search-wrap--narrow">
                            <span className="icon"><FaSearch /></span>
                            <input className="ud-pm-search" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..." aria-label="Toplu işlemde ürün ara" />
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
                                    onClick={() => {
                                        setBulkResult(null);
                                        const next = bulkAction === a.id ? "" : a.id;
                                        if (next === "delete") {
                                            setBulkDeleteLocalOnly(false);
                                            setBulkDeleteMpScope("all");
                                            setBulkDeleteMpPick([]);
                                        }
                                        setBulkAction(next);
                                    }}>
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
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10, fontSize: 11, color: "var(--ud-pm-text-sub)" }}>
                                        <input type="checkbox" className="ud-pm-checkbox" checked={bulkDeleteLocalOnly} onChange={(e) => setBulkDeleteLocalOnly(e.target.checked)} />
                                        Sadece yerel kayıt sil (pazaryerlerine dokunma)
                                    </label>
                                    {!bulkDeleteLocalOnly && (
                                        <>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ud-pm-text)", marginBottom: 6 }}>Pazaryeri kapsamı</div>
                                            <div className="ud-pm-mode-group" style={{ marginBottom: 10 }}>
                                                <button type="button" className={`ud-pm-mode-btn ${bulkDeleteMpScope === "all" ? "active" : ""}`}
                                                    style={bulkDeleteMpScope === "all" ? { color: "var(--ud-pm-red)", borderColor: "var(--ud-pm-red)", background: "rgba(239,68,68,0.08)" } : {}}
                                                    onClick={() => setBulkDeleteMpScope("all")}>
                                                    <FaGlobe style={{ fontSize: 10 }} /> Tümü (ürünün olduğu her pazaryeri)
                                                </button>
                                                <button type="button" className={`ud-pm-mode-btn ${bulkDeleteMpScope === "pick" ? "active" : ""}`}
                                                    style={bulkDeleteMpScope === "pick" ? { color: "var(--ud-pm-red)", borderColor: "var(--ud-pm-red)", background: "rgba(239,68,68,0.08)" } : {}}
                                                    onClick={() => setBulkDeleteMpScope("pick")}>
                                                    Seçili pazaryerleri
                                                </button>
                                            </div>
                                            {bulkDeleteMpScope === "pick" && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 160, overflowY: "auto" }}>
                                                    {(marketplaces.length ? marketplaces : []).map((mp) => {
                                                        const n = mp.marketplaceName;
                                                        return (
                                                            <label key={mp._id || n} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: "var(--ud-pm-text)" }}>
                                                                <input type="checkbox" className="ud-pm-checkbox" checked={bulkDeleteMpPick.includes(n)} onChange={() => toggleBulkDeleteMpPick(n)} />
                                                                <FaStore style={{ fontSize: 9, color: PL_COLOR[n] || "var(--ud-pm-accent)" }} /> {n}
                                                            </label>
                                                        );
                                                    })}
                                                    {marketplaces.length === 0 && (
                                                        <span style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }}>Entegrasyon listesi yüklenemedi; yine de silme yerelde çalışır.</span>
                                                    )}
                                                </div>
                                            )}
                                            {bulkDeleteMpScope === "all" && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, color: "var(--ud-pm-text-sub)" }}>
                                                    <FaGlobe style={{ color: "var(--ud-pm-red)", fontSize: 13 }} />
                                                    Her ürün için eşleşen tüm pazaryerlerinden kaldırılır <span style={{ opacity: 0.6 }}>(stok 0 / arşiv / silme)</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <button className="ud-pm-btn red" style={{ width: "100%", justifyContent: "center" }} onClick={handleBulkDelete} disabled={bulkSelected.size === 0 || bulkActionLoading}>
                                        {bulkActionLoading ? <span className="spinner" /> : <FaTrash />}
                                        {bulkDeleteLocalOnly ? ` ${bulkSelected.size} Ürünü Yerel Sil` : ` ${bulkSelected.size} Ürünü Sil`}
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
       TAB: VARYANT GRUPLARI (aynı model — Trendyol productMainId hizası)
       ═══════════════════════════════════════════════════════════════ */
    const vgToggleCreatePick = (id) => {
        const s = String(id);
        setVgCreatePick((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
    };
    const vgTogglePickerPick = (id) => {
        const s = String(id);
        setVgPickerPick((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
    };
    const vgCloseCreate = () => {
        setVgCreateOpen(false);
        setVgCreateStep(1);
        setVgListSearch("");
    };
    const vgOpenCreate = async () => {
        setVgFormName(""); setVgFormNotes(""); setVgFormMainId(""); setVgFormColorLbl("Renk"); setVgFormSizeLbl("Beden");
        setVgCreatePick(new Set()); setVgCreateStep(1); setVgListSearch("");
        setVgCreateOpen(true);
        setVgListLoading(true);
        try {
            const res = await getProducts({ page: 0, limit: 300 });
            setVgPickerRows((res.products || []).filter((p) => !p.variantGroupId));
        } catch { setVgPickerRows([]); }
        finally { setVgListLoading(false); }
    };
    const vgFilteredUngrouped = () => filterVgProductRows(vgPickerRows, vgListSearch);
    const vgSelectAllFilteredCreate = () => {
        const filtered = vgFilteredUngrouped();
        setVgCreatePick((prev) => {
            const n = new Set(prev);
            filtered.forEach((p) => n.add(String(p._id)));
            return n;
        });
    };
    const vgClearCreatePick = () => setVgCreatePick(new Set());
    const vgSelectAllFilteredPicker = () => {
        const filtered = vgFilteredUngrouped();
        setVgPickerPick((prev) => {
            const n = new Set(prev);
            filtered.forEach((p) => n.add(String(p._id)));
            return n;
        });
    };
    const vgClearPickerPick = () => setVgPickerPick(new Set());
    const vgClosePicker = () => {
        setVgPickerOpen(false);
        setVgListSearch("");
        setVgPickerPick(new Set());
    };
    const vgSubmitCreate = async () => {
        if (vgFormName.trim().length < 2) { showToast("Grup adı en az 2 karakter olmalı", "error"); return; }
        try {
            await createVariantGroup({
                name: vgFormName.trim(),
                notes: vgFormNotes,
                trendyolProductMainId: vgFormMainId.trim(),
                memberIds: [...vgCreatePick],
                dimensionHint: { colorLabel: vgFormColorLbl, sizeLabel: vgFormSizeLbl },
            });
            vgCloseCreate();
            showToast("Varyant grubu oluşturuldu");
            loadVariantGroups();
            loadProducts(page);
        } catch (e) { showToast(e.response?.data?.error || e.message, "error"); }
    };
    const vgOpenDetail = async (groupId) => {
        setVgActiveId(groupId); setVgDetailOpen(true);
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
            showToast("Grup bilgileri kaydedildi");
            loadVariantGroups();
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
        } catch (e) { showToast(e.response?.data?.error || e.message, "error"); }
    };
    const vgOpenAddPicker = async () => {
        if (!vgActiveId) return;
        setVgPickerPick(new Set()); setVgListSearch(""); setVgPickerOpen(true);
        setVgListLoading(true);
        try {
            const res = await getProducts({ page: 0, limit: 300 });
            setVgPickerRows((res.products || []).filter((p) => !p.variantGroupId));
        } catch { setVgPickerRows([]); }
        finally { setVgListLoading(false); }
    };
    const vgSubmitAddMembers = async () => {
        if (!vgActiveId || vgPickerPick.size === 0) return;
        try {
            await addVariantGroupMembers(vgActiveId, [...vgPickerPick]);
            vgClosePicker();
            showToast("Ürünler gruba eklendi");
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
            loadVariantGroups();
            loadProducts(page);
        } catch (e) { showToast(e.response?.data?.error || e.message, "error"); }
    };
    const vgRemoveMember = async (productId) => {
        if (!vgActiveId) return;
        if (!window.confirm("Bu ürünü gruptan çıkarmak istiyor musunuz?")) return;
        try {
            await removeVariantGroupMembers(vgActiveId, [productId]);
            showToast("Ürün gruptan çıkarıldı");
            const data = await getVariantGroup(vgActiveId);
            setVgMembers(data.members || []);
            loadVariantGroups();
            loadProducts(page);
        } catch (e) { showToast(e.response?.data?.error || e.message, "error"); }
    };
    const vgDeleteGroup = async () => {
        if (!vgActiveId) return;
        if (!window.confirm("Grup silinecek; ürünlerdeki grup bağlantısı kalkar. Emin misiniz?")) return;
        try {
            await deleteVariantGroup(vgActiveId);
            setVgDetailOpen(false); setVgActiveId(null);
            showToast("Grup silindi");
            loadVariantGroups();
            loadProducts(page);
        } catch (e) { showToast(e.response?.data?.error || e.message, "error"); }
    };
    const vgCopyMainId = () => {
        const t = (vgFormMainId || "").trim();
        if (t) navigator.clipboard?.writeText(t).then(() => showToast("Model kodu kopyalandı")).catch(() => {});
        else showToast("Önce Trendyol model kodunu girin", "error");
    };

    const renderVariantGroups = () => (
        <div className="ud-pm-wizard-tab">
            <div className="ud-pm-wizard-tab-intro ud-pm-card" role="note">
                <p className="ud-pm-wizard-tab-desc" style={{ marginBottom: 10 }}>
                    <strong>Varyant grubu</strong> aynı ürün modelinin farklı <strong>renk / beden</strong> satırlarını tek çatı altında tutar.
                    Trendyol’da ortak <strong>model kodu</strong> (<code style={{ color: "var(--ud-pm-accent)" }}>productMainId</code>) burada tanımlanır; her satırın kendi barkodu ve stok kodu kalır.
                </p>
                <p className="ud-pm-wizard-tab-desc" style={{ marginBottom: 0 }}>
                    <FaInfoCircle style={{ color: "var(--ud-pm-accent)", marginRight: 6, verticalAlign: "middle" }} />
                    <strong>Kullanım:</strong> Yeni grup → (isteğe bağlı) grupsuz ürünleri seçin → Trendyol model kodunu girin.
                    Düzenle ile üye ekleyip çıkarın. Başka gruptaki ürün eklenemez.
                </p>
            </div>
            <div className="ud-pm-card" style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                        <FaObjectGroup style={{ color: "var(--ud-pm-accent)" }} /> Gruplar
                    </h2>
                    <button type="button" className="ud-pm-btn accent" onClick={vgOpenCreate}><FaPlus /> Yeni grup</button>
                </div>
                {vgLoading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--ud-pm-text-dim)" }}><FaSpinner className="spinner" /> Yükleniyor…</div>
                ) : vgGroups.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 36, color: "var(--ud-pm-text-dim)" }}>
                        <p>Henüz grup yok.</p>
                        <button type="button" className="ud-pm-btn outline" onClick={vgOpenCreate}><FaPlus /> İlk grubu oluştur</button>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                        {vgGroups.map((g) => (
                            <div key={g._id} className="ud-pm-card" style={{ margin: 0, padding: 16 }}>
                                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>{g.name}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                                        background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.35)", color: "var(--ud-pm-accent)",
                                    }}>{(g.memberIds || []).length} ürün</span>
                                    {g.trendyolProductMainId && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                                            border: "1px solid var(--ud-pm-border)", color: "var(--ud-pm-text-sub)",
                                        }}>TY: {g.trendyolProductMainId}</span>
                                    )}
                                </div>
                                <button type="button" className="ud-pm-btn sm outline" onClick={() => vgOpenDetail(g._id)}><FaEdit /> Düzenle</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       ANA RENDER
       ═══════════════════════════════════════════════════════════════ */
    const tabs = [
        { id: "products", icon: <FaBox />, label: "Ürünler", count: total },
        { id: "newProduct", icon: <FaRocket />, label: "Yeni ürün & dağıt" },
        { id: "uploadMp", icon: <FaCloudUploadAlt />, label: "Ürünleri Yükle" },
        { id: "variants", icon: <FaObjectGroup />, label: "Varyant grupları", count: vgGroups.length > 0 ? vgGroups.length : undefined },
        { id: "pricestock", icon: <FaDollarSign />, label: "Fiyat & Stok" },
        { id: "channel-prices", icon: <FaPercentage />, label: "Pazaryeri Fiyatları" },
        { id: "bulk", icon: <FaLayerGroup />, label: "Toplu İşlem", count: bulkSelected.size > 0 ? bulkSelected.size : undefined },
        { id: "fieldAudit", icon: <FaShieldAlt />, label: "Alan denetimi" },
        { id: "sync", icon: <FaSync />, label: "Senkâronizasyon" },
    ];

    return (
        <div className="ud-pm-root">
            {/* Header */}
            <header className="ud-pm-header ud-pm-header--panel">
                <h1><FaCubes /> Ürün Yönetim Merkezi</h1>
                <p>Ürünlerinizi yönetin, platformlara dağıtın, stok ve fiyat senkronizasyonu yapın.</p>
            </header>

            {/* Dashboard Cards */}
            {renderDashCards()}

            {/* Tab Bar */}
            <nav className="ud-pm-tabs-rail" aria-label="Bölümler">
                <div className="ud-pm-tabs" role="tablist">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            className={`ud-pm-tab ${tab === t.id ? "active" : ""}`}
                            onClick={() => setTab(t.id)}
                        >
                            <span className="ud-pm-tab-icon" aria-hidden>{t.icon}</span>
                            <span className="ud-pm-tab-label">{t.label}</span>
                            {t.count !== undefined && <span className="ud-pm-tab-count">{t.count}</span>}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div className="ud-pm-tab-panel" key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }} role="tabpanel">
                    {tab === "products" && renderProducts()}
                    {tab === "newProduct" && renderNewProductWizard()}
                    {tab === "uploadMp" && renderUploadMarketplace()}
                    {tab === "variants" && renderVariantGroups()}
                    {tab === "pricestock" && renderPriceStock()}
                    {tab === "channel-prices" && renderChannelPrices()}

                    {tab === "bulk" && renderBulk()}
                    {tab === "fieldAudit" && renderFieldAudit()}
                    {tab === "sync" && renderSync()}
                </motion.div>
            </AnimatePresence>

            {/* Detail Modal */}
            {renderDetailModal()}

            {/* Gönder → kategori seçimi */}
            {renderDistributeModal()}

            {/* Delete Confirm Modal */}
            {renderDeleteConfirmModal()}

            {ReactDOM.createPortal(
                <AnimatePresence>
                    {syncProgress?.status === "running" && (
                        <motion.div
                            className="ud-pm-modal-overlay"
                            style={{ zIndex: 10050 }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="ud-pm-modal"
                                initial={{ scale: 0.96, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.96, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: "min(96vw, 440px)",
                                    padding: 24,
                                    border: "1px solid var(--ud-pm-border)",
                                }}
                            >
                                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
                                    <span className="spinner" aria-hidden />
                                    {syncProgress.title}
                                </h3>
                                <div style={{ height: 10, borderRadius: 6, background: "var(--ud-pm-glass)", overflow: "hidden", marginBottom: 12 }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${Math.min(100, Math.max(0, Number(syncProgress.progressPercent) || 0))}%`,
                                        background: "linear-gradient(90deg, var(--ud-pm-accent), var(--ud-pm-purple))",
                                        transition: "width 0.35s ease",
                                    }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--ud-pm-text-sub)", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700 }}>%{Math.round(Math.min(100, Math.max(0, Number(syncProgress.progressPercent) || 0)))}</span>
                                    <span>Tahmini kalan: <strong style={{ color: "var(--ud-pm-text)" }}>{formatSyncEta(syncProgress.etaSeconds)}</strong></span>
                                </div>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--ud-pm-text-dim)", lineHeight: 1.55 }}>{syncProgress.message || "…"}</p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`ud-pm-toast ${toast.type}`}
                        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}>
                        {toast.type === "error" ? <FaTimesCircle /> : <FaCheckCircle />} {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {ReactDOM.createPortal(
            <AnimatePresence>
                {vgCreateOpen && (
                    <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={vgCloseCreate}>
                        <motion.div className="ud-pm-modal" initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }} onClick={e => e.stopPropagation()} style={{
                            width: "min(96vw, 900px)",
                            maxHeight: "min(92vh, 720px)",
                            display: "flex",
                            flexDirection: "column",
                            padding: 0,
                            overflow: "hidden",
                        }}>
                            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--ud-pm-border)", flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                    <span style={{
                                        fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                                        padding: "4px 10px", borderRadius: 999,
                                        background: vgCreateStep === 1 ? "rgba(78,205,196,0.2)" : "var(--ud-pm-glass)",
                                        color: vgCreateStep === 1 ? "var(--ud-pm-accent)" : "var(--ud-pm-text-dim)",
                                    }}>1 · Grup bilgisi</span>
                                    <span style={{ color: "var(--ud-pm-text-dim)", fontSize: 12 }}>→</span>
                                    <span style={{
                                        fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                                        padding: "4px 10px", borderRadius: 999,
                                        background: vgCreateStep === 2 ? "rgba(78,205,196,0.2)" : "var(--ud-pm-glass)",
                                        color: vgCreateStep === 2 ? "var(--ud-pm-accent)" : "var(--ud-pm-text-dim)",
                                    }}>2 · Ürün seçimi</span>
                                </div>
                                <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8, color: "var(--ud-pm-text)" }}>
                                    <FaObjectGroup style={{ color: "var(--ud-pm-accent)" }} /> {vgCreateStep === 1 ? "Yeni varyant grubu" : "Hangi ürünler bu grupta?"}
                                </h3>
                                <p style={{ fontSize: 12, color: "var(--ud-pm-text-dim)", margin: "8px 0 0", lineHeight: 1.55 }}>
                                    {vgCreateStep === 1
                                        ? "Önce grubu tanımlayın. İsterseniz bir sonraki adımda grupsuz ürünleri tek seferde seçebilir veya hiç seçmeden boş grup oluşturup sonra düzenleyebilirsiniz."
                                        : "Arama ile listede daraltın. Filtrede görünen tümünü seç veya tek tek işaretleyin. Seçim zorunlu değil — ürünleri daha sonra da ekleyebilirsiniz."}
                                </p>
                            </div>

                            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                                {vgCreateStep === 1 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
                                        <div className="ud-pm-field">
                                            <label>Grup adı <span className="required">*</span></label>
                                            <input className="ud-pm-inline-input" style={{ width: "100%", boxSizing: "border-box" }} value={vgFormName} onChange={(e) => setVgFormName(e.target.value)} placeholder="Örn. Yıldız model temassız aparat" />
                                        </div>
                                        <div className="ud-pm-field">
                                            <label>Notlar (isteğe bağlı)</label>
                                            <textarea className="ud-pm-inline-input" style={{ width: "100%", boxSizing: "border-box", minHeight: 72 }} rows={3} value={vgFormNotes} onChange={(e) => setVgFormNotes(e.target.value)} />
                                        </div>
                                        <div className="ud-pm-field">
                                            <label>Trendyol model kodu (productMainId)</label>
                                            <input className="ud-pm-inline-input" style={{ width: "100%", boxSizing: "border-box" }} value={vgFormMainId} onChange={(e) => setVgFormMainId(e.target.value)} placeholder="Tüm varyantlarda aynı olacak kod — boş bırakılabilir" />
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                            <div className="ud-pm-field">
                                                <label>Varyant etiketi — renk</label>
                                                <input className="ud-pm-inline-input" style={{ width: "100%", boxSizing: "border-box" }} value={vgFormColorLbl} onChange={(e) => setVgFormColorLbl(e.target.value)} />
                                            </div>
                                            <div className="ud-pm-field">
                                                <label>Varyant etiketi — beden</label>
                                                <input className="ud-pm-inline-input" style={{ width: "100%", boxSizing: "border-box" }} value={vgFormSizeLbl} onChange={(e) => setVgFormSizeLbl(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ position: "relative" }}>
                                            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ud-pm-text-dim)", fontSize: 14, pointerEvents: "none" }} />
                                            <input
                                                className="ud-pm-inline-input"
                                                style={{ width: "100%", boxSizing: "border-box", paddingLeft: 36 }}
                                                value={vgListSearch}
                                                onChange={(e) => setVgListSearch(e.target.value)}
                                                placeholder="Ürün adı, stok kodu veya barkod ile ara…"
                                                aria-label="Ürün ara"
                                            />
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                                            <div style={{ fontSize: 12, color: "var(--ud-pm-text-sub)", fontWeight: 600 }}>
                                                <strong style={{ color: "var(--ud-pm-accent)" }}>{vgCreatePick.size}</strong> seçili
                                                <span style={{ color: "var(--ud-pm-text-dim)", fontWeight: 500 }}> · </span>
                                                Liste: <strong>{vgFilteredUngrouped().length}</strong> / {vgPickerRows.length} grupsuz
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={vgSelectAllFilteredCreate} disabled={vgFilteredUngrouped().length === 0}>Filtreyi tamamını seç</button>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={vgClearCreatePick} disabled={vgCreatePick.size === 0}>Seçimi temizle</button>
                                            </div>
                                        </div>
                                        <div style={{
                                            border: "1px solid var(--ud-pm-border)",
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            minHeight: 280,
                                            maxHeight: "min(42vh, 380px)",
                                            overflowY: "auto",
                                            background: "var(--ud-pm-card-alt)",
                                        }}>
                                            {vgListLoading ? (
                                                <div style={{ padding: 48, textAlign: "center", color: "var(--ud-pm-text-dim)" }}><FaSpinner className="spinner" /> Ürünler yükleniyor…</div>
                                            ) : vgPickerRows.length === 0 ? (
                                                <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--ud-pm-text-dim)" }}>
                                                    Grupsuz ürün yok. Önce ürün ekleyin veya mevcut ürünler başka grupta olabilir.
                                                </div>
                                            ) : vgFilteredUngrouped().length === 0 ? (
                                                <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--ud-pm-text-dim)" }}>
                                                    Aramanızla eşleşen ürün yok. Filtreyi temizleyin veya farklı kelime deneyin.
                                                </div>
                                            ) : (
                                                vgFilteredUngrouped().map((p) => {
                                                    const thumb = vgProductThumb(p);
                                                    return (
                                                        <label
                                                            key={p._id}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 12,
                                                                padding: "10px 14px",
                                                                borderBottom: "1px solid var(--ud-pm-glass-border)",
                                                                cursor: "pointer",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            <input type="checkbox" checked={vgCreatePick.has(String(p._id))} onChange={() => vgToggleCreatePick(p._id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                                                            {thumb ? (
                                                                <img src={thumb} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--ud-pm-surface)" }} />
                                                            ) : (
                                                                <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--ud-pm-glass)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ud-pm-text-dim)", fontSize: 10 }}>—</div>
                                                            )}
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <div style={{ fontWeight: 700, color: "var(--ud-pm-text)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.masterProduct?.name || "—"}</div>
                                                                <div style={{ color: "var(--ud-pm-text-dim)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                                    <span>SKU: <strong style={{ color: "var(--ud-pm-text-sub)" }}>{p.masterProduct?.sku || "—"}</strong></span>
                                                                    <span>Barkod: <strong style={{ color: "var(--ud-pm-text-sub)" }}>{p.masterProduct?.barcode || "—"}</strong></span>
                                                                    <span>{summarizeVariantAttrs(p.masterProduct?.attributes)}</span>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{
                                padding: "14px 20px",
                                borderTop: "1px solid var(--ud-pm-border)",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 10,
                                justifyContent: "flex-end",
                                alignItems: "center",
                                flexShrink: 0,
                                background: "rgba(0,0,0,0.12)",
                            }}>
                                {vgCreateStep === 2 && (
                                    <button type="button" className="ud-pm-btn outline" style={{ marginRight: "auto" }} onClick={() => setVgCreateStep(1)}><FaChevronLeft /> Geri</button>
                                )}
                                <button type="button" className="ud-pm-btn outline" onClick={vgCloseCreate}>İptal</button>
                                {vgCreateStep === 1 ? (
                                    <button type="button" className="ud-pm-btn accent" onClick={() => setVgCreateStep(2)} disabled={vgFormName.trim().length < 2}>
                                        İleri — ürün seç <FaChevronRight style={{ marginLeft: 4 }} />
                                    </button>
                                ) : (
                                    <button type="button" className="ud-pm-btn accent" onClick={vgSubmitCreate} disabled={vgFormName.trim().length < 2}>
                                        Grubu oluştur{vgCreatePick.size > 0 ? ` (${vgCreatePick.size} ürün)` : " (boş)"}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>, document.body)}

            {ReactDOM.createPortal(
            <AnimatePresence>
                {vgDetailOpen && vgActiveId && (
                    <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVgDetailOpen(false)}>
                        <motion.div className="ud-pm-modal" initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "92vh", overflow: "auto" }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--ud-pm-text)" }}><FaEdit /> Grup düzenle</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>Grup adı</label>
                                <input className="ud-pm-inline-input" value={vgFormName} onChange={(e) => setVgFormName(e.target.value)} />
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>Trendyol model kodu</label>
                                        <input className="ud-pm-inline-input" value={vgFormMainId} onChange={(e) => setVgFormMainId(e.target.value)} />
                                    </div>
                                    <button type="button" className="ud-pm-btn sm outline" style={{ marginTop: 20 }} onClick={vgCopyMainId}>Kopyala</button>
                                </div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>Notlar</label>
                                <textarea className="ud-pm-inline-input" rows={2} value={vgFormNotes} onChange={(e) => setVgFormNotes(e.target.value)} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div><label style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>Renk etiketi</label><input className="ud-pm-inline-input" value={vgFormColorLbl} onChange={(e) => setVgFormColorLbl(e.target.value)} /></div>
                                    <div><label style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>Beden etiketi</label><input className="ud-pm-inline-input" value={vgFormSizeLbl} onChange={(e) => setVgFormSizeLbl(e.target.value)} /></div>
                                </div>
                                <button type="button" className="ud-pm-btn sm accent" onClick={vgSaveDetailMeta}><FaSave /> Kaydet</button>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                    <strong style={{ fontSize: 13 }}>Ürünler ({vgMembers.length})</strong>
                                    <button type="button" className="ud-pm-btn sm outline" onClick={vgOpenAddPicker}><FaPlus /> Ürün ekle</button>
                                </div>
                                <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--ud-pm-border)", borderRadius: 8 }}>
                                    {vgMembers.length === 0 ? <p style={{ padding: 10, margin: 0, fontSize: 12 }}>Üye yok.</p> : vgMembers.map((m) => (
                                        <div key={m._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--ud-pm-glass-border)", fontSize: 12 }}>
                                            <div style={{ minWidth: 0 }}>
                                                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.masterProduct?.name}</strong>
                                                <span style={{ color: "var(--ud-pm-text-dim)" }}>{m.masterProduct?.sku} · {m.masterProduct?.barcode} · {summarizeVariantAttrs(m.masterProduct?.attributes)} · stok: {m.stockTracking?.totalStock ?? "—"}</span>
                                            </div>
                                            <button type="button" className="ud-pm-btn sm red outline" onClick={() => vgRemoveMember(m._id)}>Çıkar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
                                <button type="button" className="ud-pm-btn sm red" onClick={vgDeleteGroup}><FaTrash /> Grubu sil</button>
                                <button type="button" className="ud-pm-btn outline" onClick={() => setVgDetailOpen(false)}>Kapat</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>, document.body)}

            {ReactDOM.createPortal(
            <AnimatePresence>
                {vgPickerOpen && (
                    <motion.div className="ud-pm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={vgClosePicker}>
                        <motion.div className="ud-pm-modal" initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }} onClick={e => e.stopPropagation()} style={{
                            width: "min(96vw, 640px)",
                            maxHeight: "min(90vh, 640px)",
                            display: "flex",
                            flexDirection: "column",
                            padding: 0,
                            overflow: "hidden",
                        }}>
                            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--ud-pm-border)", flexShrink: 0 }}>
                                <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8, color: "var(--ud-pm-text)" }}><FaPlus style={{ color: "var(--ud-pm-accent)" }} /> Gruba ürün ekle</h3>
                                <p style={{ fontSize: 12, color: "var(--ud-pm-text-dim)", margin: "8px 0 0", lineHeight: 1.55 }}>
                                    Yalnızca henüz bir varyant grubuna bağlı olmayan ürünler listelenir (en fazla 300). Arama ile daraltıp toplu seçim yapabilirsiniz.
                                </p>
                            </div>
                            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ position: "relative" }}>
                                    <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ud-pm-text-dim)", fontSize: 14, pointerEvents: "none" }} />
                                    <input
                                        className="ud-pm-inline-input"
                                        style={{ width: "100%", boxSizing: "border-box", paddingLeft: 36 }}
                                        value={vgListSearch}
                                        onChange={(e) => setVgListSearch(e.target.value)}
                                        placeholder="Ürün adı, stok kodu veya barkod ile ara…"
                                        aria-label="Ürün ara"
                                    />
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                                    <div style={{ fontSize: 12, color: "var(--ud-pm-text-sub)", fontWeight: 600 }}>
                                        <strong style={{ color: "var(--ud-pm-accent)" }}>{vgPickerPick.size}</strong> seçili
                                        <span style={{ color: "var(--ud-pm-text-dim)", fontWeight: 500 }}> · </span>
                                        Liste: <strong>{vgFilteredUngrouped().length}</strong> / {vgPickerRows.length} grupsuz
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        <button type="button" className="ud-pm-btn sm outline" onClick={vgSelectAllFilteredPicker} disabled={vgFilteredUngrouped().length === 0}>Filtreyi tamamını seç</button>
                                        <button type="button" className="ud-pm-btn sm outline" onClick={vgClearPickerPick} disabled={vgPickerPick.size === 0}>Seçimi temizle</button>
                                    </div>
                                </div>
                                <div style={{
                                    border: "1px solid var(--ud-pm-border)",
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    minHeight: 260,
                                    maxHeight: "min(48vh, 400px)",
                                    overflowY: "auto",
                                    background: "var(--ud-pm-card-alt)",
                                }}>
                                    {vgListLoading ? (
                                        <div style={{ padding: 48, textAlign: "center", color: "var(--ud-pm-text-dim)" }}><FaSpinner className="spinner" /> Ürünler yükleniyor…</div>
                                    ) : vgPickerRows.length === 0 ? (
                                        <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--ud-pm-text-dim)" }}>
                                            Gruba eklenebilecek grupsuz ürün yok.
                                        </div>
                                    ) : vgFilteredUngrouped().length === 0 ? (
                                        <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--ud-pm-text-dim)" }}>
                                            Aramanızla eşleşen ürün yok. Farklı kelime deneyin.
                                        </div>
                                    ) : (
                                        vgFilteredUngrouped().map((p) => {
                                            const thumb = vgProductThumb(p);
                                            return (
                                                <label
                                                    key={p._id}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 12,
                                                        padding: "10px 14px",
                                                        borderBottom: "1px solid var(--ud-pm-glass-border)",
                                                        cursor: "pointer",
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    <input type="checkbox" checked={vgPickerPick.has(String(p._id))} onChange={() => vgTogglePickerPick(p._id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                                                    {thumb ? (
                                                        <img src={thumb} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--ud-pm-surface)" }} />
                                                    ) : (
                                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--ud-pm-glass)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ud-pm-text-dim)", fontSize: 10 }}>—</div>
                                                    )}
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontWeight: 700, color: "var(--ud-pm-text)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.masterProduct?.name || "—"}</div>
                                                        <div style={{ color: "var(--ud-pm-text-dim)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                            <span>SKU: <strong style={{ color: "var(--ud-pm-text-sub)" }}>{p.masterProduct?.sku || "—"}</strong></span>
                                                            <span>Barkod: <strong style={{ color: "var(--ud-pm-text-sub)" }}>{p.masterProduct?.barcode || "—"}</strong></span>
                                                            <span>{summarizeVariantAttrs(p.masterProduct?.attributes)}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--ud-pm-border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0, background: "rgba(0,0,0,0.12)" }}>
                                <button type="button" className="ud-pm-btn outline" onClick={vgClosePicker}>İptal</button>
                                <button type="button" className="ud-pm-btn accent" onClick={vgSubmitAddMembers} disabled={vgPickerPick.size === 0}>Ekle ({vgPickerPick.size})</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>, document.body)}
        </div>
    );
};

export default ProductManagementCenter;
