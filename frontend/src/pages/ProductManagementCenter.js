/**
 * ÜRÜN YÖNETİM MERKEZİ — ProductManagementCenter.js (v2 — Kompakt & Modern)
 *
 * Tek sayfa içinde tüm ürün yönetimi:
 *   • Dashboard özet kartları (üstte her zaman görünür)
 *   • Tab 1: Ürünler — Liste + inline fiyat/stok düzenleme
 *   • Tab 2: Ürün Yükle — 3 adımlı wizard
 *   • Tab 3: Fiyat & Stok — Toplu düzenleme tablosu
 *   • Tab 4: Senkronizasyon — Platform kartları + loglar
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    getProducts, getProductDetail, updateProduct, deleteProduct,
    syncFromMarketplace, distributeProduct, bulkDistribute,
    syncStock, syncPrice, triggerAutoSync, getSyncLogs,
    getProductManagementDashboard, syncAllMarketplaces,
    bulkDistributeSelected, exportProducts,
    getCategoryMappings, createAndDistribute,
    suggestCodes, generateDescription, getCategoryTree,
    bulkUpdatePrices, bulkUpdateStocks, bulkDeleteProducts, bulkUpdateFields,
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";

/* ═══════════════════════════════════════════════════════════════════
   RENK PALETİ & SABİTLER
   ═══════════════════════════════════════════════════════════════════ */
const C = {
    bg: "#060a13", surface: "#0c1120", card: "#111827", cardAlt: "#151d2e",
    border: "rgba(255,255,255,0.06)", borderHover: "rgba(99,179,237,0.3)",
    accent: "#38bdf8", accentDark: "#0ea5e9", purple: "#a78bfa", purpleDark: "#7c3aed",
    green: "#34d399", greenDark: "#059669", yellow: "#fbbf24", yellowDark: "#d97706",
    red: "#f87171", redDark: "#dc2626", blue: "#60a5fa",
    text: "#f1f5f9", textSub: "#94a3b8", textDim: "#475569",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.08)",
};

const PLATFORMS = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];
const PL_COLOR = { Trendyol: "#f97316", Hepsiburada: "#eab308", N11: "#a855f7", Amazon: "#f59e0b", ÇiçekSepeti: "#ec4899" };
const PL_ICON = { Trendyol: "🟠", Hepsiburada: "🟡", N11: "🟣", Amazon: "🔶", ÇiçekSepeti: "🌸" };

const fmt = (v) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0)); }
    catch { return `${Number(v || 0).toFixed(2)} ₺`; }
};
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d); return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const fmtAgo = (d) => { if (!d) return "—"; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "Az önce"; if (m < 60) return `${m}dk`; const h = Math.floor(m / 60); if (h < 24) return `${h}sa`; return `${Math.floor(h / 24)}g`; };

/* ═══════════════════════════════════════════════════════════════════
   MİNİ BİLEŞENLER
   ═══════════════════════════════════════════════════════════════════ */
const Pill = ({ color, children, style }) => (
    <span style={{ background: color + "15", color, border: `1px solid ${color}30`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3, ...style }}>{children}</span>
);

const Btn = ({ onClick, children, color = C.accent, disabled, loading, small, outline, style }) => (
    <motion.button whileHover={!disabled ? { scale: 1.02 } : {}} whileTap={!disabled ? { scale: 0.97 } : {}} onClick={onClick} disabled={disabled || loading}
        style={{
            background: outline ? "transparent" : `linear-gradient(135deg, ${color}, ${color}cc)`,
            border: outline ? `1.5px solid ${color}` : "none", borderRadius: 8,
            padding: small ? "5px 12px" : "8px 18px", color: outline ? color : "#fff",
            fontSize: small ? 11 : 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1,
            boxShadow: outline ? "none" : `0 2px 8px ${color}30`, transition: "all .15s", ...style
        }}>
        {loading && <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
        {children}
    </motion.button>
);

const Card = ({ children, style, hover, onClick }) => (
    <div onClick={onClick} style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1rem",
        cursor: onClick ? "pointer" : "default", transition: "all .2s",
        ...(hover ? { ":hover": { borderColor: C.borderHover } } : {}), ...style
    }}>{children}</div>
);

const Empty = ({ icon = "📭", title, desc }) => (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.textDim }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>{icon}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{title}</div>
        {desc && <div style={{ fontSize: 11, marginTop: 4 }}>{desc}</div>}
    </div>
);

const Input = ({ label, icon, value, onChange, placeholder, type = "text", required, style: sx }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...sx }}>
        {label && <label style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 3 }}>
            {icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}{required && <span style={{ color: C.red }}>*</span>}
        </label>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 12, outline: "none", transition: "border .2s" }}
            onFocus={e => e.target.style.borderColor = C.accent + "60"} onBlur={e => e.target.style.borderColor = C.border} />
    </div>
);

/* ═══════════════════════════════════════════════════════════════════
   PLATFORM YARDIMCILARI
   ═══════════════════════════════════════════════════════════════════ */
const normMP = (n) => { if (!n) return ""; const l = n.trim().toLowerCase(); if (l === "trendyol") return "trendyol"; if (l === "hepsiburada") return "hepsiburada"; if (l === "n11") return "n11"; if (l === "amazon" || l === "amazon türkiye") return "amazon"; if (l === "çiçeksepeti" || l === "ciceksepeti") return "ciceksepeti"; return l; };
const getPlMap = (p, name) => (p.marketplaceMappings || []).find(m => normMP(m.marketplaceName) === normMP(name));
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
    const [editMap, setEditMap] = useState({}); // { [id]: { price, stock } }
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
    const [bulkAction, setBulkAction] = useState(""); // "price"|"stock"|"delete"|"distribute"|"fields"
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [bulkPriceMode, setBulkPriceMode] = useState("percent"); // "fixed"|"percent"|"round"
    const [bulkPriceValue, setBulkPriceValue] = useState("");
    const [bulkPriceRound, setBulkPriceRound] = useState("");
    const [bulkPriceListToo, setBulkPriceListToo] = useState(true);
    const [bulkPriceSync, setBulkPriceSync] = useState(false);
    const [bulkStockMode, setBulkStockMode] = useState("fixed"); // "fixed"|"increase"|"decrease"
    const [bulkStockValue, setBulkStockValue] = useState("");
    const [bulkStockSync, setBulkStockSync] = useState(false);
    const [bulkFieldCategory, setBulkFieldCategory] = useState("");
    const [bulkFieldBrand, setBulkFieldBrand] = useState("");
    const [bulkFieldSafety, setBulkFieldSafety] = useState("");
    const [bulkResult, setBulkResult] = useState(null);
    const bulkSearchRef = useRef(null);

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

    const handleDelete = async (id) => {
        if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
        setActionLoading(`d-${id}`);
        try { await deleteProduct(id); showToast("Ürün silindi"); loadProducts(page); if (detail?._id === id) { setDetail(null); setShowDetail(false); } } catch { showToast("Silinemedi", "error"); }
        finally { setActionLoading(""); }
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
        try { const r = await getCategoryTree(catPlatform, parentId); setCatLevels(p => { const n = p.slice(0, li); n.push({ parentId, categories: r.categories || [], selected: null }); return n; }); } catch { showToast("Kategori yüklenemedi", "error"); }
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
        catSearchRef.current = setTimeout(async () => { try { const r = await getCategoryTree(catPlatform, "0", q.trim()); setCatResults(r.categories || []); } catch {} }, 500);
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
        } catch (e) { showToast("Hata: " + (e.response?.data?.error || e.message), "error"); }
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
       DASHBOARD KARTLARI (her zaman üstte)
       ═══════════════════════════════════════════════════════════════ */
    const renderDashCards = () => {
        const cards = [
            { icon: "📦", label: "Toplam Ürün", val: dbP.total || total, color: C.accent },
            { icon: "✅", label: "Sağlıklı", val: dbP.healthy || "—", color: C.green },
            { icon: "⚠️", label: "Düşük Stok", val: dbP.lowStock || 0, color: C.yellow },
            { icon: "❌", label: "Stok Yok", val: dbP.outOfStock || 0, color: C.red },
            { icon: "🏪", label: "Platform", val: (db.marketplaces || marketplaces || []).length, color: C.purple },
        ];
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
                {cards.map(c => (
                    <div key={c.label} style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, border: `1px solid ${c.color}20`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{c.icon}</span>
                        <div>
                            <div style={{ color: c.color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{c.val}</div>
                            <div style={{ color: C.textDim, fontSize: 10, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textDim }}>🔍</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..."
                        style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px 8px 32px", color: C.text, fontSize: 12, outline: "none" }}
                        onFocus={e => e.target.style.borderColor = C.accent + "50"} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
                    style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 11, outline: "none" }}>
                    <option value="">Tüm Stok</option><option value="lowStock">Düşük</option><option value="outOfStock">Yok</option>
                </select>
                <div style={{ flex: 1 }} />
                {selected.size > 0 && <>
                    <Pill color={C.accent}>✓ {selected.size}</Pill>
                    <Btn small color={C.purple} onClick={() => setBulkModal(true)}>🚀 Dağıt</Btn>
                </>}
                <Btn small outline color={C.green} onClick={handleExport} loading={actionLoading === "export"}>📥 Excel</Btn>
                <Btn small onClick={handleSyncAll} loading={actionLoading === "sync-all"}>🔄 Çek</Btn>
            </div>

            {/* Tablo */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                <th style={th}><input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} style={{ accentColor: C.accent }} /></th>
                                <th style={th}>Ürün</th>
                                <th style={th}>Barkod / SKU</th>
                                <th style={{ ...th, textAlign: "right" }}>Fiyat</th>
                                <th style={{ ...th, textAlign: "center" }}>Stok</th>
                                <th style={{ ...th, textAlign: "center" }}>Platformlar</th>
                                <th style={{ ...th, textAlign: "center" }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: C.textDim }}><span style={{ fontSize: 20, animation: "spin .8s linear infinite", display: "inline-block" }}>⏳</span><div style={{ marginTop: 6, fontSize: 12 }}>Yükleniyor...</div></td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={7}><Empty icon="📦" title="Ürün bulunamadı" desc="Pazaryerlerinden çekin veya yeni ekleyin" /></td></tr>
                            ) : products.map((p, i) => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const isSel = selected.has(p._id);
                                const plCount = (p.marketplaceMappings || []).filter(m => m.marketplaceName).length;
                                return (
                                    <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                                        style={{ borderBottom: `1px solid ${C.border}`, background: isSel ? C.accent + "08" : "transparent", cursor: "pointer", transition: "background .1s" }}
                                        onClick={() => openDetail(p._id)}
                                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,.015)"; }}
                                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                                        <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={isSel} onChange={() => toggleSel(p._id)} style={{ accentColor: C.accent }} /></td>
                                        <td style={td}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {mp.images?.[0] ? <img src={mp.images[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: `1px solid ${C.border}` }} />
                                                    : <div style={{ width: 32, height: 32, borderRadius: 6, background: C.glass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📦</div>}
                                                <div>
                                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name || "İsimsiz"}</div>
                                                    {mp.brand && <div style={{ color: C.textDim, fontSize: 10 }}>{mp.brand}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={td}>
                                            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.textSub }}>{mp.barcode || "—"}</div>
                                            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.textDim }}>{mp.sku || "—"}</div>
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            <div style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>{fmt(mp.price)}</div>
                                            {mp.listPrice && mp.listPrice !== mp.price && <div style={{ color: C.textDim, fontSize: 10, textDecoration: "line-through" }}>{fmt(mp.listPrice)}</div>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <span style={{ color: st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green, fontWeight: 800, fontSize: 13 }}>{st.totalStock ?? mp.stock ?? 0}</span>
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                                                {PLATFORMS.map(pl => { const ps = getPlStatus(p, pl); return (
                                                    <span key={pl} title={`${pl}: ${ps.exists ? ps.status : "Yok"}`} style={{ fontSize: 12, opacity: ps.exists ? 1 : 0.15, position: "relative" }}>
                                                        {PL_ICON[pl]}
                                                        {ps.exists && <span style={{ position: "absolute", bottom: -1, right: -1, width: 5, height: 5, borderRadius: "50%", background: ps.status === "synced" || ps.status === "active" ? C.green : ps.status === "error" ? C.red : C.yellow, border: `1px solid ${C.card}` }} />}
                                                    </span>
                                                ); })}
                                            </div>
                                            <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>{plCount} platform</div>
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                                                <Btn small outline color={C.accent} onClick={() => openDetail(p._id)}>👁️</Btn>
                                                <Btn small outline color={C.red} onClick={() => handleDelete(p._id)} disabled={actionLoading === `d-${p._id}`}>🗑️</Btn>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
                        <Btn small outline disabled={page === 0} onClick={() => loadProducts(page - 1)}>◀</Btn>
                        <span style={{ color: C.textSub, fontSize: 12 }}>{page + 1} / {totalPages} <span style={{ color: C.textDim }}>({total})</span></span>
                        <Btn small outline disabled={page >= totalPages - 1} onClick={() => loadProducts(page + 1)}>▶</Btn>
                    </div>
                )}
            </div>

            {/* Bulk Modal */}
            <AnimatePresence>
                {bulkModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBulkModal(false)}
                        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                        <motion.div initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }} onClick={e => e.stopPropagation()}
                            style={{ background: C.card, border: `1px solid ${C.borderHover}`, borderRadius: 16, padding: "1.5rem", maxWidth: 420, width: "100%" }}>
                            <h3 style={{ color: C.text, margin: 0, marginBottom: 14, fontSize: 16 }}>🚀 Toplu Dağıtım — {selected.size} Ürün</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {marketplaces.map(mp => (
                                    <Btn key={mp._id} color={PL_COLOR[mp.marketplaceName] || C.accent} onClick={() => handleBulkDistribute([mp.marketplaceName])} loading={actionLoading === "bulk"} style={{ justifyContent: "flex-start" }}>
                                        {PL_ICON[mp.marketplaceName] || "🔗"} {mp.marketplaceName}
                                    </Btn>
                                ))}
                                {marketplaces.length > 1 && <Btn color={C.accent} onClick={() => handleBulkDistribute(marketplaces.map(m => m.marketplaceName))} loading={actionLoading === "bulk"}>🌐 Tümüne Dağıt</Btn>}
                            </div>
                            <button onClick={() => setBulkModal(false)} style={{ marginTop: 12, background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12 }}>İptal</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TAB 2: ÜRÜN YÜKLE (3 Adımlı Wizard)
       ═══════════════════════════════════════════════════════════════ */
    const renderUpload = () => {
        const totalImgs = uf.imageUrls.length + imgFiles.length;
        const canSubmit = uf.name && uf.barcode && uf.sku && uf.price;

        const Step = ({ num, label, icon }) => (
            <div onClick={() => setUploadStep(num)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, cursor: "pointer", flex: 1,
                background: uploadStep === num ? C.accent + "12" : "transparent", border: `1.5px solid ${uploadStep === num ? C.accent : uploadStep > num ? C.green + "40" : C.border}`, transition: "all .2s" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: uploadStep > num ? C.green : uploadStep === num ? C.accent : C.glass, color: uploadStep >= num ? "#fff" : C.textDim, fontSize: 11, fontWeight: 800 }}>
                    {uploadStep > num ? "✓" : icon}
                </span>
                <div>
                    <div style={{ color: uploadStep === num ? C.accent : uploadStep > num ? C.green : C.textDim, fontSize: 10, fontWeight: 700 }}>Adım {num}</div>
                    <div style={{ color: uploadStep === num ? C.text : C.textDim, fontSize: 10 }}>{label}</div>
                </div>
            </div>
        );

        const CodeChip = ({ item, onClick }) => (
            <button onClick={() => item.available && onClick(item.value)} disabled={!item.available}
                style={{ background: item.available ? C.accent + "12" : C.red + "08", border: `1px solid ${item.available ? C.accent + "35" : C.red + "25"}`, borderRadius: 6, padding: "4px 10px", cursor: item.available ? "pointer" : "not-allowed", color: item.available ? C.accent : C.red, fontSize: 11, fontWeight: 600, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4, opacity: item.available ? 1 : .5 }}>
                {item.available ? "✓" : "✗"} {item.value}
            </button>
        );

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>{Step({ num: 1, label: "Temel Bilgiler", icon: "1" })}{Step({ num: 2, label: "Kategori & Görseller", icon: "2" })}{Step({ num: 3, label: "Açıklama & Gönder", icon: "3" })}</div>

                {/* ADIM 1 */}
                {uploadStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                <span style={{ fontSize: 20 }}>📝</span>
                                <div><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Temel Bilgiler</div><div style={{ color: C.textDim, fontSize: 10 }}>Ürün adı, fiyat, stok ve marka</div></div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div style={{ gridColumn: "1/-1" }}><Input label="Ürün Adı" icon="📦" value={uf.name} onChange={v => ufSet("name", v)} placeholder="Ürün başlığı..." required /></div>
                                <Input label="Marka" icon="🏷️" value={uf.brand} onChange={v => ufSet("brand", v)} placeholder="Marka" />
                                <Input label="Stok" icon="📊" value={uf.stock} onChange={v => ufSet("stock", v)} placeholder="0" type="number" />
                                <Input label="Satış Fiyatı (₺)" icon="💰" value={uf.price} onChange={v => ufSet("price", v)} placeholder="0.00" type="number" required />
                                <Input label="Liste Fiyatı (₺)" icon="🏷️" value={uf.listPrice} onChange={v => ufSet("listPrice", v)} placeholder="Boş = satış fiyatı" type="number" />
                            </div>
                        </Card>
                        <Card>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 20 }}>🔢</span>
                                    <div><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Barkod & SKU</div><div style={{ color: C.textDim, fontSize: 10 }}>Manuel girin veya öneri alın</div></div>
                                </div>
                                <Btn small color={C.purple} onClick={handleSuggestCodes} loading={codeLoading} disabled={!uf.name.trim()}>✨ Öneri</Btn>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <Input label="Barkod" icon="📊" value={uf.barcode} onChange={v => ufSet("barcode", v)} placeholder="Benzersiz barkod" required />
                                <Input label="SKU" icon="🏷️" value={uf.sku} onChange={v => ufSet("sku", v)} placeholder="Stok kodu" required />
                            </div>
                            {codeSugg && (
                                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div><div style={{ color: C.textDim, fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Barkod Önerileri</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{(codeSugg.barcodes || []).map((b, i) => <CodeChip key={i} item={b} onClick={v => ufSet("barcode", v)} />)}</div></div>
                                    <div><div style={{ color: C.textDim, fontSize: 9, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>SKU Önerileri</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{(codeSugg.skus || []).map((s, i) => <CodeChip key={i} item={s} onClick={v => ufSet("sku", v)} />)}</div></div>
                                </div>
                            )}
                        </Card>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Btn onClick={() => setUploadStep(2)} disabled={!uf.name.trim()}>İleri →</Btn>
                        </div>
                    </motion.div>
                )}

                {/* ADIM 2 */}
                {uploadStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 20 }}>🗂️</span>
                                <div style={{ flex: 1 }}><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Kategori</div><div style={{ color: C.textDim, fontSize: 10 }}>Platform kategorisi seçin</div></div>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {["Trendyol", "N11"].map(p => (
                                        <button key={p} onClick={() => { setCatPlatform(p); setCatLevels([]); setCatResults([]); setCatSearch(""); }}
                                            style={{ background: catPlatform === p ? (PL_COLOR[p] || C.accent) + "18" : "transparent", border: `1px solid ${catPlatform === p ? PL_COLOR[p] || C.accent : C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: catPlatform === p ? C.text : C.textDim, fontSize: 10, fontWeight: 700 }}>
                                            {PL_ICON[p]} {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {uf.category && (
                                <div style={{ background: C.green + "0c", border: `1px solid ${C.green}25`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: C.green, fontSize: 12 }}>✅</span>
                                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600, flex: 1 }}>{uf.category}</span>
                                    <button onClick={() => { ufSet("category", ""); setCatLevels([]); }} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 14 }}>✕</button>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                <div style={{ position: "relative", flex: 1 }}>
                                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textDim }}>🔍</span>
                                    <input value={catSearch} onChange={e => handleCatSearch(e.target.value)} placeholder={`${catPlatform} kategorilerinde ara...`}
                                        style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px 8px 30px", color: C.text, fontSize: 11, outline: "none" }} />
                                </div>
                                {!catSearch && catLevels.length === 0 && <Btn small color={C.blue} onClick={() => loadCatLevel("0", 0)} loading={catLoading}>📂 Aç</Btn>}
                            </div>
                            {catSearch && catResults.length > 0 && (
                                <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10 }}>
                                    {catResults.map((c, i) => (
                                        <div key={c.id || i} onClick={() => { ufSet("category", c.path || c.name); setCatSearch(""); setCatResults([]); }}
                                            style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, fontSize: 11, transition: "background .1s" }}
                                            onMouseEnter={e => e.currentTarget.style.background = C.accent + "08"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <div style={{ color: C.text, fontWeight: 600 }}>{c.name}</div>
                                            {c.path && <div style={{ color: C.textDim, fontSize: 9 }}>{c.path}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!catSearch && catLevels.length > 0 && (
                                <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 4 }}>
                                    {catLevels.map((lv, li) => (
                                        <div key={li} style={{ minWidth: 170, maxWidth: 210, border: `1px solid ${C.border}`, borderRadius: 8, background: C.glass, flexShrink: 0 }}>
                                            <div style={{ padding: "6px 10px", borderBottom: `1px solid ${C.border}`, color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{li === 0 ? "Ana Kategori" : `Alt ${li}`}</div>
                                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                                {lv.categories.map(c => { const sel = lv.selected?.id === c.id; return (
                                                    <div key={c.id} onClick={() => handleCatSelect(li, c)}
                                                        style={{ padding: "6px 10px", cursor: "pointer", background: sel ? C.accent + "12" : "transparent", borderLeft: sel ? `2px solid ${C.accent}` : "2px solid transparent", display: "flex", alignItems: "center", gap: 4, transition: "all .1s" }}
                                                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "rgba(255,255,255,.02)"; }} onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                                                        <span style={{ fontSize: 10, color: c.isLeaf ? C.green : C.yellow }}>{c.isLeaf ? "📄" : "📁"}</span>
                                                        <span style={{ color: sel ? C.accent : C.text, fontSize: 11, fontWeight: sel ? 700 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                                                        {c.hasChildren && <span style={{ color: C.textDim, fontSize: 9 }}>›</span>}
                                                    </div>
                                                ); })}
                                            </div>
                                        </div>
                                    ))}
                                    {catLoading && <div style={{ minWidth: 170, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 11 }}>⏳</div>}
                                </div>
                            )}
                        </Card>
                        <Card>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 20 }}>🖼️</span>
                                <div><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Görseller</div><div style={{ color: C.textDim, fontSize: 10 }}>Dosya veya URL (maks. 8)</div></div>
                                <Pill color={C.accent} style={{ marginLeft: "auto" }}>{totalImgs}/8</Pill>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
                                <Btn small color={C.purple} onClick={() => fileRef.current?.click()} disabled={totalImgs >= 8}>📁 Dosya</Btn>
                                <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 180 }}>
                                    <input value={imgUrlInput} onChange={e => setImgUrlInput(e.target.value)} placeholder="https://... görsel URL" onKeyDown={e => e.key === "Enter" && handleAddImgUrl()}
                                        style={{ flex: 1, background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", color: C.text, fontSize: 11, outline: "none" }} />
                                    <Btn small color={C.green} onClick={handleAddImgUrl} disabled={!imgUrlInput.trim() || totalImgs >= 8}>+</Btn>
                                </div>
                            </div>
                            {totalImgs > 0 ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                                    {uf.imageUrls.map((u, i) => (
                                        <div key={`u${i}`} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, aspectRatio: "1" }}>
                                            <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                                            <button onClick={() => removeImg("url", i)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                                        </div>
                                    ))}
                                    {imgFiles.map((f, i) => (
                                        <div key={`f${i}`} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, aspectRatio: "1" }}>
                                            <img src={f.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            <button onClick={() => removeImg("file", i)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "2rem", textAlign: "center", cursor: "pointer" }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + "40"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                                    <div style={{ fontSize: 28, marginBottom: 4 }}>📸</div>
                                    <div style={{ color: C.textDim, fontSize: 11 }}>Tıklayın veya URL yapıştırın</div>
                                </div>
                            )}
                        </Card>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Btn outline color={C.textDim} onClick={() => setUploadStep(1)}>← Geri</Btn>
                            <Btn onClick={() => setUploadStep(3)}>İleri →</Btn>
                        </div>
                    </motion.div>
                )}

                {/* ADIM 3 */}
                {uploadStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, alignItems: "start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <Card>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontSize: 20 }}>✍️</span>
                                    <div style={{ flex: 1 }}><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Açıklama</div><div style={{ color: C.textDim, fontSize: 10 }}>Yazın veya AI ile oluşturun</div></div>
                                </div>
                                <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ color: C.textDim, fontSize: 9, fontWeight: 700 }}>🤖 Ton:</span>
                                    {[{ id: "professional", l: "Profesyonel", i: "💼" }, { id: "friendly", l: "Samimi", i: "😊" }, { id: "luxury", l: "Lüks", i: "✨" }, { id: "minimal", l: "Minimal", i: "📝" }].map(t => (
                                        <button key={t.id} onClick={() => setDescTone(t.id)}
                                            style={{ background: descTone === t.id ? C.accent + "18" : "transparent", border: `1px solid ${descTone === t.id ? C.accent : C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: descTone === t.id ? C.accent : C.textDim, fontSize: 10, fontWeight: 600 }}>
                                            {t.i} {t.l}
                                        </button>
                                    ))}
                                    <Btn small color={C.purple} onClick={handleGenDesc} loading={descLoading} disabled={!uf.name.trim()} style={{ marginLeft: "auto" }}>🤖 Oluştur</Btn>
                                </div>
                                <textarea value={uf.description} onChange={e => ufSet("description", e.target.value)} placeholder="Ürün açıklaması..." rows={10}
                                    style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                    <span style={{ color: C.textDim, fontSize: 9 }}>{uf.description.length} karakter</span>
                                    {uf.description && <button onClick={() => ufSet("description", "")} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 10 }}>🗑️ Temizle</button>}
                                </div>
                            </Card>
                            <Btn outline color={C.textDim} onClick={() => setUploadStep(2)} style={{ alignSelf: "flex-start" }}>← Geri</Btn>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <Card>
                                <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>🚀 Platformlar</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {marketplaces.map(mp => { const sel = uf.targetMarketplaces.includes(mp.marketplaceName); return (
                                        <div key={mp._id} onClick={() => toggleTarget(mp.marketplaceName)}
                                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: sel ? (PL_COLOR[mp.marketplaceName] || C.accent) + "15" : C.glass, border: `1.5px solid ${sel ? PL_COLOR[mp.marketplaceName] || C.accent : C.border}`, transition: "all .15s" }}>
                                            <span style={{ fontSize: 16 }}>{PL_ICON[mp.marketplaceName] || "🔗"}</span>
                                            <span style={{ color: sel ? C.text : C.textSub, fontWeight: 700, fontSize: 12, flex: 1 }}>{mp.marketplaceName}</span>
                                            <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? PL_COLOR[mp.marketplaceName] || C.accent : C.border}`, background: sel ? PL_COLOR[mp.marketplaceName] || C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9 }}>{sel && "✓"}</span>
                                        </div>
                                    ); })}
                                </div>
                            </Card>
                            <Card style={{ background: `linear-gradient(135deg, ${C.accent}06, ${C.purple}06)` }}>
                                <div style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>📋 Özet</div>
                                {[
                                    ["Ürün", uf.name || "—", C.text], ["Barkod", uf.barcode || "—", C.accent], ["SKU", uf.sku || "—", C.purple],
                                    ["Fiyat", uf.price ? fmt(uf.price) : "—", C.green], ["Stok", uf.stock || "0", C.text],
                                    ...(uf.category ? [["Kategori", uf.category, C.yellow]] : []), ...(uf.brand ? [["Marka", uf.brand, C.blue]] : []),
                                    ["Görseller", `${totalImgs} adet`, C.text], ["Açıklama", uf.description ? "✓" : "—", uf.description ? C.green : C.textDim],
                                ].map(([k, v, c]) => (
                                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                                        <span style={{ color: C.textDim }}>{k}</span>
                                        <span style={{ color: c, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{v}</span>
                                    </div>
                                ))}
                                {uf.targetMarketplaces.length > 0 && (
                                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 6 }}>
                                        {uf.targetMarketplaces.map(t => <Pill key={t} color={PL_COLOR[t] || C.accent} style={{ fontSize: 9 }}>{PL_ICON[t]} {t}</Pill>)}
                                    </div>
                                )}
                            </Card>
                            <Btn onClick={handleCreate} loading={uploadLoading} disabled={!canSubmit} style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }}>
                                {uf.targetMarketplaces.length > 0 ? `🚀 Oluştur & ${uf.targetMarketplaces.length} Platforma Dağıt` : "💾 Kaydet"}
                            </Btn>
                            {!canSubmit && <div style={{ color: C.yellow, fontSize: 10, textAlign: "center" }}>⚠️ Ad, barkod, SKU ve fiyat zorunlu</div>}
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textDim }}>🔍</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara..."
                        style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px 8px 32px", color: C.text, fontSize: 12, outline: "none" }} />
                </div>
                <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
                    style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 11, outline: "none" }}>
                    <option value="">Tüm</option><option value="lowStock">Düşük</option><option value="outOfStock">Yok</option>
                </select>
                <div style={{ flex: 1 }} />
                <Pill color={C.accent}>{total} ürün</Pill>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 750, borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                <th style={th}>Ürün</th>
                                <th style={{ ...th, textAlign: "right" }}>Satış Fiyatı</th>
                                <th style={{ ...th, textAlign: "center" }}>Stok</th>
                                <th style={{ ...th, textAlign: "center" }}>Güvenlik</th>
                                <th style={{ ...th, textAlign: "center" }}>Durum</th>
                                {PLATFORMS.slice(0, 3).map(pl => <th key={pl} style={{ ...th, textAlign: "center", fontSize: 10 }}>{PL_ICON[pl]}</th>)}
                                <th style={{ ...th, textAlign: "center" }}>Kaydet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8 + Math.min(PLATFORMS.length, 3)} style={{ textAlign: "center", padding: "2rem", color: C.textDim, fontSize: 12 }}>Yükleniyor...</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={8 + Math.min(PLATFORMS.length, 3)}><Empty icon="💰" title="Ürün bulunamadı" /></td></tr>
                            ) : products.map(p => {
                                const mp = p.masterProduct || {};
                                const st = p.stockTracking || {};
                                const ed = editMap[p._id] || {};
                                const mktStock = Math.max(0, (st.totalStock || 0) - (st.safetyStock || 0));
                                return (
                                    <tr key={p._id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <td style={td}>
                                            <div style={{ color: C.text, fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name}</div>
                                            <div style={{ color: C.textDim, fontSize: 10, fontFamily: "monospace" }}>{mp.barcode}</div>
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            <input type="number" step="0.01" value={ed.price !== undefined ? ed.price : (mp.price || 0)}
                                                onChange={e => setEditMap(p2 => ({ ...p2, [p._id]: { ...p2[p._id], price: e.target.value } }))}
                                                style={{ width: 80, background: C.glass, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 6px", color: C.green, fontSize: 12, fontWeight: 700, textAlign: "right", outline: "none" }} />
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <input type="number" min="0" value={ed.stock !== undefined ? ed.stock : (st.totalStock ?? 0)}
                                                onChange={e => setEditMap(p2 => ({ ...p2, [p._id]: { ...p2[p._id], stock: e.target.value } }))}
                                                style={{ width: 60, background: C.glass, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 6px", color: st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green, fontSize: 12, fontWeight: 800, textAlign: "center", outline: "none" }} />
                                        </td>
                                        <td style={{ ...td, textAlign: "center", color: C.textDim, fontSize: 11 }}>🛡️ {st.safetyStock || 0}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {st.isOutOfStock ? <Pill color={C.red}>Yok</Pill> : st.isLowStock ? <Pill color={C.yellow}>Düşük</Pill> : <Pill color={C.green}>OK</Pill>}
                                        </td>
                                        {PLATFORMS.slice(0, 3).map(pl => { const ps = getPlStatus(p, pl); return (
                                            <td key={pl} style={{ ...td, textAlign: "center" }}>
                                                {ps.exists ? <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{ps.price ? fmt(ps.price) : "—"}</span> : <span style={{ color: C.textDim, fontSize: 10 }}>—</span>}
                                            </td>
                                        ); })}
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <Btn small color={C.green} disabled={actionLoading === `s-${p._id}` || actionLoading === `p-${p._id}`}
                                                onClick={() => {
                                                    const newPrice = ed.price !== undefined ? ed.price : mp.price;
                                                    const newStock = ed.stock !== undefined ? ed.stock : st.totalStock;
                                                    if (ed.price !== undefined) handlePriceUpdate(p._id, newPrice, newPrice);
                                                    if (ed.stock !== undefined) handleStockUpdate(p._id, newStock);
                                                    if (ed.price === undefined && ed.stock === undefined) showToast("Değişiklik yok", "error");
                                                    setEditMap(p2 => { const n = { ...p2 }; delete n[p._id]; return n; });
                                                }}>
                                                {actionLoading === `s-${p._id}` || actionLoading === `p-${p._id}` ? "⏳" : "💾"}
                                            </Btn>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
                        <Btn small outline disabled={page === 0} onClick={() => loadProducts(page - 1)}>◀</Btn>
                        <span style={{ color: C.textSub, fontSize: 12 }}>{page + 1} / {totalPages}</span>
                        <Btn small outline disabled={page >= totalPages - 1} onClick={() => loadProducts(page + 1)}>▶</Btn>
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       TAB 4: SENKRONİZASYON
       ═══════════════════════════════════════════════════════════════ */
    const renderSync = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {marketplaces.map(mp => (
                    <Card key={mp._id} style={{ transition: "border-color .2s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = PL_COLOR[mp.marketplaceName] || C.borderHover}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span style={{ fontSize: 24 }}>{PL_ICON[mp.marketplaceName] || "🔗"}</span>
                            <div>
                                <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{mp.marketplaceName}</div>
                                <div style={{ color: C.textDim, fontSize: 10 }}>{mp.credentials && Object.keys(mp.credentials).length > 0 ? "✅ Bağlı" : "⚠️ Eksik"}</div>
                            </div>
                        </div>
                        <Btn onClick={() => handleSyncFrom(mp)} loading={actionLoading === `sync-${mp._id}`} color={PL_COLOR[mp.marketplaceName] || C.accent} style={{ width: "100%", justifyContent: "center", fontSize: 11 }}>
                            📥 Ürün Çek
                        </Btn>
                    </Card>
                ))}
                <Card style={{ background: `linear-gradient(135deg, ${C.accent}08, ${C.purple}08)`, borderColor: C.accent + "25" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 24 }}>🌐</span>
                        <div><div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Tüm Platformlar</div><div style={{ color: C.textDim, fontSize: 10 }}>Toplu senkronizasyon</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <Btn onClick={handleSyncAll} loading={actionLoading === "sync-all"} style={{ flex: 1, justifyContent: "center", fontSize: 11 }}>🔄 Tümünü Çek</Btn>
                        <Btn color={C.purple} onClick={async () => { setActionLoading("auto"); try { await triggerAutoSync(); showToast("Oto sync tamamlandı"); loadProducts(page); } catch { showToast("Hata", "error"); } finally { setActionLoading(""); } }} loading={actionLoading === "auto"} style={{ flex: 1, justifyContent: "center", fontSize: 11 }}>⚡ Oto Sync</Btn>
                    </div>
                </Card>
            </div>

            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>📋 Senkronizasyon Logları</div>
                    <Btn small outline color={C.accent} onClick={loadLogs}>🔄</Btn>
                </div>
                {logsLoading ? <div style={{ textAlign: "center", padding: "1.5rem", color: C.textDim, fontSize: 12 }}>Yükleniyor...</div>
                : syncLogs.length === 0 ? <Empty icon="📋" title="Henüz log yok" />
                : (
                    <div style={{ maxHeight: 350, overflowY: "auto" }}>
                        {syncLogs.map((log, i) => (
                            <div key={log._id || i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: log.status === "success" ? C.green : log.status === "error" ? C.red : C.yellow, flexShrink: 0 }} />
                                <Pill color={log.actionType === "stock_update" ? C.green : log.actionType === "price_update" ? C.yellow : log.actionType === "product_created" ? C.purple : C.accent} style={{ minWidth: 55, justifyContent: "center", fontSize: 9 }}>
                                    {log.actionType === "stock_update" ? "📊 Stok" : log.actionType === "price_update" ? "💰 Fiyat" : log.actionType === "product_created" ? "➕ Yeni" : log.actionType === "bulk_update" ? "📦 Toplu" : log.actionType}
                                </Pill>
                                <span style={{ color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.product?.name || log.product?.barcode || "—"}</span>
                                {log.changes?.field && <span style={{ color: C.textDim, fontSize: 10 }}>{log.changes.oldValue}→{log.changes.newValue}</span>}
                                <span style={{ color: C.textDim, whiteSpace: "nowrap", fontSize: 10 }}>{fmtDate(log.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
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
        const mappings = p?.marketplaceMappings || [];

        return (
            <AnimatePresence>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => { setShowDetail(false); setDetail(null); }}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <motion.div initial={{ scale: .92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .92, y: 20 }}
                        onClick={e => e.stopPropagation()}
                        style={{ background: C.card, border: `1px solid ${C.borderHover}`, borderRadius: 18, padding: "1.5rem", maxWidth: 700, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
                        {detailLoading ? (
                            <div style={{ textAlign: "center", padding: "3rem", color: C.textDim }}><span style={{ fontSize: 28 }}>⏳</span><div style={{ marginTop: 8, fontSize: 12 }}>Yükleniyor...</div></div>
                        ) : !p ? (
                            <div style={{ textAlign: "center", padding: "2rem", color: C.textDim }}>Ürün bulunamadı</div>
                        ) : (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                                        {mp.images?.[0] ? <img src={mp.images[0]} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: `1px solid ${C.border}` }} />
                                            : <div style={{ width: 64, height: 64, borderRadius: 10, background: C.glass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📦</div>}
                                        <div>
                                            <h2 style={{ color: C.text, margin: 0, fontSize: 16, fontWeight: 700 }}>{mp.name}</h2>
                                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                                <Pill color={C.accent}>Barkod: {mp.barcode}</Pill>
                                                <Pill color={C.purple}>SKU: {mp.sku}</Pill>
                                                {mp.brand && <Pill color={C.blue}>{mp.brand}</Pill>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => { setShowDetail(false); setDetail(null); }} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18 }}>✕</button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                                    <div style={{ background: C.green + "0c", border: `1px solid ${C.green}20`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                                        <div style={{ color: C.green, fontSize: 20, fontWeight: 800 }}>{fmt(mp.price)}</div>
                                        <div style={{ color: C.textDim, fontSize: 10 }}>Satış Fiyatı</div>
                                    </div>
                                    <div style={{ background: (st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green) + "0c", border: `1px solid ${(st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green)}20`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                                        <div style={{ color: st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green, fontSize: 20, fontWeight: 800 }}>{st.totalStock ?? 0}</div>
                                        <div style={{ color: C.textDim, fontSize: 10 }}>Stok</div>
                                    </div>
                                    <div style={{ background: C.purple + "0c", border: `1px solid ${C.purple}20`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                                        <div style={{ color: C.purple, fontSize: 20, fontWeight: 800 }}>{mappings.length}</div>
                                        <div style={{ color: C.textDim, fontSize: 10 }}>Platform</div>
                                    </div>
                                </div>

                                <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏪 Platform Durumları</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                                    {PLATFORMS.map(pl => {
                                        const m = getPlMap(p, pl);
                                        const exists = !!m;
                                        return (
                                            <div key={pl} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: C.glass, border: `1px solid ${C.border}` }}>
                                                <span style={{ fontSize: 16 }}>{PL_ICON[pl]}</span>
                                                <span style={{ color: C.text, fontWeight: 600, fontSize: 12, flex: 1 }}>{pl}</span>
                                                {exists ? <>
                                                    <Pill color={C.green}>Aktif</Pill>
                                                    <span style={{ color: C.textSub, fontSize: 11 }}>{m.price ? fmt(m.price) : "—"}</span>
                                                    <span style={{ color: C.textDim, fontSize: 10 }}>{m.lastSyncDate ? fmtAgo(m.lastSyncDate) : "—"}</span>
                                                </> : <>
                                                    <Pill color={C.textDim}>Pasif</Pill>
                                                    <Btn small outline color={PL_COLOR[pl] || C.accent} onClick={() => {
                                                        distributeProduct(p._id, [pl]).then(() => { showToast(`${pl} dağıtıldı`); openDetail(p._id); }).catch(e => showToast("Hata", "error"));
                                                    }}>🚀 Gönder</Btn>
                                                </>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {mp.description && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📝 Açıklama</div>
                                        <div style={{ color: C.textSub, fontSize: 11, lineHeight: 1.6, background: C.glass, borderRadius: 8, padding: "10px 12px", maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap" }}>{mp.description}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       ANA RENDER
       ═══════════════════════════════════════════════════════════════ */
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
            const r = await bulkUpdatePrices(
                Array.from(bulkSelected), bulkPriceMode, Number(bulkPriceValue) || 0,
                { roundTo: bulkPriceRound, applyToListPrice: bulkPriceListToo, syncToMarketplaces: bulkPriceSync }
            );
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
        if (!window.confirm(`${bulkSelected.size} ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;
        setBulkActionLoading(true); setBulkResult(null);
        try {
            const r = await bulkDeleteProducts(Array.from(bulkSelected));
            setBulkResult({ type: "delete", deletedCount: r.deletedCount }); showToast(r.message); setBulkSelected(new Set()); loadBulkProducts(0); loadDashboard();
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
            { id: "price", icon: "💰", label: "Fiyat Güncelle", color: C.green, desc: "Sabit, yüzde veya yuvarlama" },
            { id: "stock", icon: "📦", label: "Stok Güncelle", color: C.blue, desc: "Sabit, artır veya azalt" },
            { id: "distribute", icon: "🚀", label: "Platformlara Dağıt", color: C.purple, desc: "Seçili platformlara gönder" },
            { id: "fields", icon: "🏷️", label: "Alan Güncelle", color: C.yellow, desc: "Kategori, marka, güvenlik stoğu" },
            { id: "delete", icon: "🗑️", label: "Toplu Sil", color: C.red, desc: "Seçili ürünleri kalıcı sil" },
        ];

        return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
                {/* SOL: Ürün Listesi + Seçim */}
                <div>
                    {/* Toolbar */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textDim }}>🔍</span>
                            <input value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder="Ürün adı, barkod, SKU..."
                                style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px 8px 32px", color: C.text, fontSize: 12, outline: "none" }} />
                        </div>
                        <Pill color={C.accent}>✓ {bulkSelected.size} / {bulkTotal}</Pill>
                        <Btn small outline color={C.accent} onClick={bulkSelectAll} loading={bulkActionLoading}>📋 Tümünü Seç</Btn>
                        {bulkSelected.size > 0 && <Btn small outline color={C.textDim} onClick={() => setBulkSelected(new Set())}>✕ Temizle</Btn>}
                    </div>

                    {/* Tablo */}
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <th style={th}><input type="checkbox" checked={bulkSelected.size === bulkProducts.length && bulkProducts.length > 0} onChange={bulkToggleAll} style={{ accentColor: C.accent }} /></th>
                                        <th style={th}>Ürün</th>
                                        <th style={th}>Barkod</th>
                                        <th style={{ ...th, textAlign: "right" }}>Fiyat</th>
                                        <th style={{ ...th, textAlign: "center" }}>Stok</th>
                                        <th style={{ ...th, textAlign: "center" }}>Platform</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkLoading ? (
                                        <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: C.textDim, fontSize: 12 }}>⏳ Yükleniyor...</td></tr>
                                    ) : bulkProducts.length === 0 ? (
                                        <tr><td colSpan={6}><Empty icon="📦" title="Ürün bulunamadı" /></td></tr>
                                    ) : bulkProducts.map((p, i) => {
                                        const mp = p.masterProduct || {};
                                        const st = p.stockTracking || {};
                                        const isSel = bulkSelected.has(p._id);
                                        const plCount = (p.marketplaceMappings || []).filter(m => m.marketplaceName).length;
                                        return (
                                            <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                                                onClick={() => bulkToggleSel(p._id)}
                                                style={{ borderBottom: `1px solid ${C.border}`, background: isSel ? C.accent + "0c" : "transparent", cursor: "pointer", transition: "background .1s" }}
                                                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,.015)"; }}
                                                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? C.accent + "0c" : "transparent"; }}>
                                                <td style={td}><input type="checkbox" checked={isSel} onChange={() => bulkToggleSel(p._id)} style={{ accentColor: C.accent }} /></td>
                                                <td style={td}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        {mp.images?.[0] ? <img src={mp.images[0]} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", border: `1px solid ${C.border}` }} />
                                                            : <div style={{ width: 28, height: 28, borderRadius: 5, background: C.glass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📦</div>}
                                                        <div>
                                                            <div style={{ color: C.text, fontSize: 11, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name || "İsimsiz"}</div>
                                                            {mp.brand && <div style={{ color: C.textDim, fontSize: 9 }}>{mp.brand}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={td}><span style={{ fontFamily: "monospace", fontSize: 10, color: C.textSub }}>{mp.barcode || "—"}</span></td>
                                                <td style={{ ...td, textAlign: "right" }}><span style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>{fmt(mp.price)}</span></td>
                                                <td style={{ ...td, textAlign: "center" }}><span style={{ color: st.isOutOfStock ? C.red : st.isLowStock ? C.yellow : C.green, fontWeight: 800, fontSize: 12 }}>{st.totalStock ?? 0}</span></td>
                                                <td style={{ ...td, textAlign: "center" }}>
                                                    <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                                                        {PLATFORMS.map(pl => { const ps = getPlStatus(p, pl); return <span key={pl} style={{ fontSize: 10, opacity: ps.exists ? 1 : 0.15 }}>{PL_ICON[pl]}</span>; })}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {bulkTotalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
                                <Btn small outline disabled={bulkPage === 0} onClick={() => loadBulkProducts(bulkPage - 1)}>◀</Btn>
                                <span style={{ color: C.textSub, fontSize: 12 }}>{bulkPage + 1} / {bulkTotalPages} <span style={{ color: C.textDim }}>({bulkTotal})</span></span>
                                <Btn small outline disabled={bulkPage >= bulkTotalPages - 1} onClick={() => loadBulkProducts(bulkPage + 1)}>▶</Btn>
                            </div>
                        )}
                    </div>
                </div>

                {/* SAĞ: İşlem Paneli */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 20 }}>
                    {/* Seçim Özeti */}
                    <Card style={{ background: `linear-gradient(135deg, ${C.accent}08, ${C.purple}06)`, borderColor: C.accent + "25" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 20 }}>📋</span>
                            <div>
                                <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Toplu İşlem</div>
                                <div style={{ color: C.textDim, fontSize: 10 }}>{bulkSelected.size > 0 ? `${bulkSelected.size} ürün seçili` : "Ürün seçerek başlayın"}</div>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {actions.map(a => (
                                <div key={a.id} onClick={() => { setBulkAction(bulkAction === a.id ? "" : a.id); setBulkResult(null); }}
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                        background: bulkAction === a.id ? a.color + "15" : C.glass, border: `1.5px solid ${bulkAction === a.id ? a.color : C.border}`, transition: "all .15s" }}
                                    onMouseEnter={e => { if (bulkAction !== a.id) e.currentTarget.style.borderColor = a.color + "40"; }}
                                    onMouseLeave={e => { if (bulkAction !== a.id) e.currentTarget.style.borderColor = C.border; }}>
                                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                                    <div>
                                        <div style={{ color: bulkAction === a.id ? a.color : C.text, fontSize: 11, fontWeight: 700 }}>{a.label}</div>
                                        <div style={{ color: C.textDim, fontSize: 8 }}>{a.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* İşlem Detay Paneli */}
                    <AnimatePresence mode="wait">
                        {bulkAction === "price" && (
                            <motion.div key="price" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Card>
                                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>💰 Toplu Fiyat Güncelleme</div>
                                    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                        {[{ id: "percent", l: "% Oran", i: "📊" }, { id: "fixed", l: "Sabit ₺", i: "💵" }, { id: "round", l: "Yuvarlama", i: "🔄" }].map(m => (
                                            <button key={m.id} onClick={() => setBulkPriceMode(m.id)}
                                                style={{ flex: 1, background: bulkPriceMode === m.id ? C.green + "18" : C.glass, border: `1px solid ${bulkPriceMode === m.id ? C.green : C.border}`, borderRadius: 6, padding: "6px 4px", cursor: "pointer", color: bulkPriceMode === m.id ? C.green : C.textDim, fontSize: 10, fontWeight: 700, textAlign: "center" }}>
                                                {m.i} {m.l}
                                            </button>
                                        ))}
                                    </div>
                                    {bulkPriceMode !== "round" && (
                                        <div style={{ marginBottom: 8 }}>
                                            <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                                                {bulkPriceMode === "percent" ? "Yüzde (+ artış, - azalış)" : "Yeni Fiyat (₺)"}
                                            </label>
                                            <input type="number" step={bulkPriceMode === "percent" ? "1" : "0.01"} value={bulkPriceValue} onChange={e => setBulkPriceValue(e.target.value)}
                                                placeholder={bulkPriceMode === "percent" ? "ör: 10 veya -15" : "ör: 299.90"}
                                                style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 8 }}>
                                        <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Yuvarlama (opsiyonel)</label>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            {["", "0.90", "0.99", "0.49", "0.00"].map(r => (
                                                <button key={r} onClick={() => setBulkPriceRound(r)}
                                                    style={{ flex: 1, background: bulkPriceRound === r ? C.accent + "18" : C.glass, border: `1px solid ${bulkPriceRound === r ? C.accent : C.border}`, borderRadius: 6, padding: "5px 2px", cursor: "pointer", color: bulkPriceRound === r ? C.accent : C.textDim, fontSize: 10, fontWeight: 600 }}>
                                                    {r || "Yok"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: C.textSub }}>
                                            <input type="checkbox" checked={bulkPriceListToo} onChange={e => setBulkPriceListToo(e.target.checked)} style={{ accentColor: C.accent }} />
                                            Liste fiyatına da uygula
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: C.textSub }}>
                                            <input type="checkbox" checked={bulkPriceSync} onChange={e => setBulkPriceSync(e.target.checked)} style={{ accentColor: C.green }} />
                                            🔄 Platformlara da senkronize et
                                        </label>
                                    </div>
                                    <Btn onClick={handleBulkPriceSubmit} loading={bulkActionLoading} disabled={bulkSelected.size === 0} color={C.green} style={{ width: "100%", justifyContent: "center" }}>
                                        💰 {bulkSelected.size} Ürünün Fiyatını Güncelle
                                    </Btn>
                                </Card>
                            </motion.div>
                        )}

                        {bulkAction === "stock" && (
                            <motion.div key="stock" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Card>
                                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>📦 Toplu Stok Güncelleme</div>
                                    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                        {[{ id: "fixed", l: "Sabit", i: "📌" }, { id: "increase", l: "Artır", i: "📈" }, { id: "decrease", l: "Azalt", i: "📉" }].map(m => (
                                            <button key={m.id} onClick={() => setBulkStockMode(m.id)}
                                                style={{ flex: 1, background: bulkStockMode === m.id ? C.blue + "18" : C.glass, border: `1px solid ${bulkStockMode === m.id ? C.blue : C.border}`, borderRadius: 6, padding: "6px 4px", cursor: "pointer", color: bulkStockMode === m.id ? C.blue : C.textDim, fontSize: 10, fontWeight: 700, textAlign: "center" }}>
                                                {m.i} {m.l}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginBottom: 8 }}>
                                        <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                                            {bulkStockMode === "fixed" ? "Yeni Stok Adedi" : bulkStockMode === "increase" ? "Artırılacak Miktar" : "Azaltılacak Miktar"}
                                        </label>
                                        <input type="number" min="0" step="1" value={bulkStockValue} onChange={e => setBulkStockValue(e.target.value)}
                                            placeholder={bulkStockMode === "fixed" ? "ör: 50" : "ör: 10"}
                                            style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: C.textSub, marginBottom: 10 }}>
                                        <input type="checkbox" checked={bulkStockSync} onChange={e => setBulkStockSync(e.target.checked)} style={{ accentColor: C.green }} />
                                        🔄 Platformlara da senkronize et
                                    </label>
                                    <Btn onClick={handleBulkStockSubmit} loading={bulkActionLoading} disabled={bulkSelected.size === 0} color={C.blue} style={{ width: "100%", justifyContent: "center" }}>
                                        📦 {bulkSelected.size} Ürünün Stoğunu Güncelle
                                    </Btn>
                                </Card>
                            </motion.div>
                        )}

                        {bulkAction === "distribute" && (
                            <motion.div key="distribute" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Card>
                                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>🚀 Toplu Platform Dağıtımı</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {marketplaces.map(mp => (
                                            <Btn key={mp._id} color={PL_COLOR[mp.marketplaceName] || C.accent}
                                                onClick={() => handleBulkDistributeAction([mp.marketplaceName])}
                                                loading={bulkActionLoading} disabled={bulkSelected.size === 0}
                                                style={{ justifyContent: "flex-start" }}>
                                                {PL_ICON[mp.marketplaceName] || "🔗"} {mp.marketplaceName}'a Dağıt
                                            </Btn>
                                        ))}
                                        {marketplaces.length > 1 && (
                                            <Btn color={C.accent} onClick={() => handleBulkDistributeAction(marketplaces.map(m => m.marketplaceName))}
                                                loading={bulkActionLoading} disabled={bulkSelected.size === 0}
                                                style={{ justifyContent: "center", marginTop: 4 }}>
                                                🌐 Tüm Platformlara Dağıt ({bulkSelected.size} ürün)
                                            </Btn>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {bulkAction === "fields" && (
                            <motion.div key="fields" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Card>
                                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>🏷️ Toplu Alan Güncelleme</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Kategori</label>
                                            <input value={bulkFieldCategory} onChange={e => setBulkFieldCategory(e.target.value)} placeholder="Yeni kategori adı"
                                                style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Marka</label>
                                            <input value={bulkFieldBrand} onChange={e => setBulkFieldBrand(e.target.value)} placeholder="Yeni marka adı"
                                                style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <label style={{ color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 3 }}>🛡️ Güvenlik Stoğu</label>
                                            <input type="number" min="0" value={bulkFieldSafety} onChange={e => setBulkFieldSafety(e.target.value)} placeholder="ör: 5"
                                                style={{ width: "100%", background: C.glass, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    </div>
                                    <Btn onClick={handleBulkFieldsSubmit} loading={bulkActionLoading} disabled={bulkSelected.size === 0} color={C.yellow} style={{ width: "100%", justifyContent: "center" }}>
                                        🏷️ {bulkSelected.size} Ürünü Güncelle
                                    </Btn>
                                </Card>
                            </motion.div>
                        )}

                        {bulkAction === "delete" && (
                            <motion.div key="delete" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                <Card style={{ borderColor: C.red + "30" }}>
                                    <div style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>⚠️ Toplu Silme</div>
                                    <div style={{ color: C.textSub, fontSize: 11, lineHeight: 1.5, marginBottom: 12, background: C.red + "08", borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.red}15` }}>
                                        <strong style={{ color: C.red }}>{bulkSelected.size} ürün</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz!
                                        Pazaryerlerindeki ürünler etkilenmez, sadece yerel kayıtlar silinir.
                                    </div>
                                    <Btn onClick={handleBulkDelete} loading={bulkActionLoading} disabled={bulkSelected.size === 0} color={C.red} style={{ width: "100%", justifyContent: "center" }}>
                                        🗑️ {bulkSelected.size} Ürünü Kalıcı Sil
                                    </Btn>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sonuç Kartı */}
                    <AnimatePresence>
                        {bulkResult && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                                <Card style={{ borderColor: C.green + "30", background: C.green + "06" }}>
                                    <div style={{ color: C.green, fontSize: 12, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>✅ İşlem Tamamlandı</div>
                                    {bulkResult.type === "price" && (
                                        <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
                                            <div>✓ <strong>{bulkResult.updated}</strong> ürün fiyatı güncellendi</div>
                                            {bulkResult.synced > 0 && <div>🔄 <strong>{bulkResult.synced}</strong> platform senkronize edildi</div>}
                                            {bulkResult.errors > 0 && <div style={{ color: C.red }}>✗ <strong>{bulkResult.errors}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "stock" && (
                                        <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
                                            <div>✓ <strong>{bulkResult.updated}</strong> ürün stoğu güncellendi</div>
                                            {bulkResult.synced > 0 && <div>🔄 <strong>{bulkResult.synced}</strong> platform senkronize edildi</div>}
                                            {bulkResult.errors > 0 && <div style={{ color: C.red }}>✗ <strong>{bulkResult.errors}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "delete" && (
                                        <div style={{ fontSize: 11, color: C.textSub }}>🗑️ <strong>{bulkResult.deletedCount}</strong> ürün silindi</div>
                                    )}
                                    {bulkResult.type === "distribute" && (
                                        <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
                                            <div>✓ <strong>{bulkResult.success}</strong> başarılı</div>
                                            {bulkResult.skipped > 0 && <div>⏭️ <strong>{bulkResult.skipped}</strong> atlandı</div>}
                                            {bulkResult.error > 0 && <div style={{ color: C.red }}>✗ <strong>{bulkResult.error}</strong> hata</div>}
                                        </div>
                                    )}
                                    {bulkResult.type === "fields" && (
                                        <div style={{ fontSize: 11, color: C.textSub }}>
                                            ✓ <strong>{bulkResult.modifiedCount}</strong> ürünün {(bulkResult.fields || []).join(", ")} güncellendi
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    const tabs = [
        { id: "products", icon: "📦", label: "Ürünler", count: total },
        { id: "upload", icon: "➕", label: "Yükle & Dağıt" },
        { id: "pricestock", icon: "💰", label: "Fiyat & Stok" },
        { id: "bulk", icon: "📋", label: "Toplu İşlem", count: bulkSelected.size > 0 ? bulkSelected.size : undefined },
        { id: "sync", icon: "🔄", label: "Senkronizasyon" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: C.bg, padding: "clamp(10px, 2.5vw, 24px)", color: C.text, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: "clamp(18px, 3.5vw, 24px)", fontWeight: 800, margin: 0, marginBottom: 4, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    📦 Ürün Yönetim Merkezi
                </h1>
                <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>Ürünlerinizi yönetin, platformlara dağıtın, stok ve fiyat senkronizasyonu yapın</p>
            </div>

            {/* Dashboard Cards */}
            {renderDashCards()}

            {/* Tab Bar */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
                {tabs.map(t => (
                    <motion.button key={t.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setTab(t.id)}
                        style={{
                            background: tab === t.id ? `linear-gradient(135deg, ${C.accent}18, ${C.accent}08)` : C.glass,
                            border: tab === t.id ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                            borderRadius: 10, padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", transition: "all .2s"
                        }}>
                        <span style={{ fontSize: 14 }}>{t.icon}</span>
                        <span style={{ color: tab === t.id ? C.accent : C.textSub, fontSize: 12, fontWeight: 700 }}>{t.label}</span>
                        {t.count !== undefined && <span style={{ background: tab === t.id ? C.accent : "rgba(255,255,255,.08)", color: tab === t.id ? "#000" : C.text, padding: "1px 7px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{t.count}</span>}
                    </motion.button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}>
                    {tab === "products" && renderProducts()}
                    {tab === "upload" && renderUpload()}
                    {tab === "pricestock" && renderPriceStock()}
                    {tab === "bulk" && renderBulk()}
                    {tab === "sync" && renderSync()}
                </motion.div>
            </AnimatePresence>

            {/* Detail Modal */}
            {renderDetailModal()}

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 40, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 40, x: "-50%" }}
                        style={{ position: "fixed", bottom: 20, left: "50%", background: toast.type === "error" ? C.red : C.green, color: "#fff", padding: "10px 22px", borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 99999, boxShadow: `0 6px 24px ${toast.type === "error" ? C.red : C.green}50`, maxWidth: "90vw", textAlign: "center" }}>
                        {toast.type === "error" ? "❌ " : "✅ "}{toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const th = { padding: "10px 12px", textAlign: "left", color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", fontSize: 12 };

export default ProductManagementCenter;
