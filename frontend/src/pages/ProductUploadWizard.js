/**
 * ÜRÜN YÜKLE & DAĞIT — ProductUploadWizard.js
 *
 * Bağımsız sayfa (sidebar'dan erişilir):
 *   Adım 1: Temel Bilgiler (ad, barkod, SKU, fiyat, stok, marka)
 *   Adım 2: Görseller & Açıklama
 *   Adım 3: Ön İzleme
 *   Adım 4: Platform Kategori Seçimi (ağaç + arama) & Gönder
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBox, FaSearch, FaPlus, FaEdit, FaTrash, FaCheck, FaTimes,
    FaChevronRight, FaChevronDown, FaTag, FaBarcode, FaDollarSign,
    FaWarehouse, FaStore, FaMagic, FaArrowRight, FaArrowLeft,
    FaSave, FaCloudUploadAlt, FaImage, FaFolderOpen, FaRocket,
    FaCheckCircle, FaTimesCircle, FaInfoCircle, FaSpinner, FaEye,
    FaSitemap, FaGlobe, FaExclamationTriangle, FaCubes
} from "react-icons/fa";
import {
    createAndDistribute, suggestCodes, generateDescription, uploadProductImage,
    getTrendyolCategoryAttributes, searchTrendyolBrands
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import { getCategoryTree, searchCategories } from "../services/categoryCenterApi";
import { logUiClientError, logUserActivity } from "../services/errorCenterLog";
import "../styles/ProductUploadWizard.css";

/* ═══════════════════════════════════════════════════════════════
   SABİTLER
   ═══════════════════════════════════════════════════════════════ */
const PLATFORMS = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];
/** Ürün oluşturma API’si olan pazaryerleri (Amazon vb. listede gösterilmez / dağıtılmaz). */
const SUPPORTED_UPLOAD_MARKETPLACES = new Set(["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti"]);

/** Backend `productSyncService.normalizeMarketplaceName` ile aynı — DB’de "n11" kayıtlı olsa bile hedef listede görünsün */
const normalizeMarketplaceName = (name) => {
    if (!name) return "";
    const n = String(name).trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return String(name).trim();
};
/** Bu pazaryerlerine dağıtım için en az bir herkese açık görsel URL gerekir (backend ile uyumlu). */
const PLATFORMS_NEED_IMAGE_URL = new Set(["Trendyol", "N11", "ÇiçekSepeti"]);

/** Trendyol / N11 için http görsel adreslerini https’e çevir (API kuralları). */
const normalizePublicImageUrls = (urls, targets) => {
    const upgrade = targets.some((p) => p === "Trendyol" || p === "N11");
    if (!upgrade) return urls;
    return urls.map((u) => {
        if (/^http:\/\//i.test(u)) return `https://${u.slice(7)}`;
        return u;
    });
};
const PL_COLOR = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#8b5cf6", Amazon: "#f59e0b", ÇiçekSepeti: "#ec4899" };
const PL_SHORT = { Trendyol: "TY", Hepsiburada: "HB", N11: "N11", Amazon: "AZ", ÇiçekSepeti: "ÇS" };
const PL_ICON = { Trendyol: "🟠", Hepsiburada: "🔶", N11: "🟣", Amazon: "🟡", ÇiçekSepeti: "🌸" };

/* ═══════════════════════════════════════════════════════════════
   YARDIMCI: API response'dan kategori dizisini çıkar
   Backend ok() → { success, message, data: { categories, results, ... } }
   categoryCenterApi.js return res.data → { success, message, data: {...} }
   ═══════════════════════════════════════════════════════════════ */
const extractCategories = (r) => {
    if (!r) return [];
    // r = { success, data: { categories: [...] } }  (getCategoryTree)
    // r = { success, data: { results: [...] } }      (searchCategories)
    // r = { success, data: { tree: [...] } }          (HB tree endpoint)
    const d = r.data || r;
    return d?.categories || d?.results || d?.tree || d?.data?.categories || d?.data?.results || d?.data?.tree || [];
};

/** Hepsiburada: yalnızca yaprak + listelenebilir katalog kategorisi (kampanya/HC değil) */
const isHbListableCategory = (cat) =>
    cat?.canListProduct === true ||
    (cat?.canListProduct !== false && cat?.leaf === true && cat?.available !== false);

const canSelectPlatformCategory = (platformName, node, hasChildren) => {
    if (platformName === "Trendyol") return !hasChildren;
    if (platformName === "Hepsiburada") return !hasChildren && isHbListableCategory(node);
    return !hasChildren || platformName !== "Trendyol";
};

/* ═══════════════════════════════════════════════════════════════
   DIŞ BİLEŞEN: TreeNode (memo ile — re-render'da unmount olmaz)
   ═══════════════════════════════════════════════════════════════ */
const TreeNode = memo(({ platformName, node, depth = 0, expanded, selected, onToggle, onSelect }) => {
    const nodeId = String(node.id || node.categoryId || "");
    const isExpanded = expanded?.has(nodeId);
    const children = node.subCategories || node.children || [];
    const hasChildren = children.length > 0 || node.hasChildren;
    const isLeaf = !hasChildren;
    const isSelected = selected?.id === nodeId;
    const nodeName = node.name || node.categoryName || "";
    const treeSelectable = canSelectPlatformCategory(platformName, node, hasChildren);

    return (
        <div>
            <div
                className={`puw-tree-node ${isSelected ? "selected" : ""} ${isLeaf ? "leaf" : ""}`}
                style={{ paddingLeft: 12 + depth * 20, opacity: platformName === "Hepsiburada" && !treeSelectable ? 0.55 : 1 }}
                onClick={() => {
                    if (hasChildren) onToggle(platformName, nodeId);
                    if (canSelectPlatformCategory(platformName, node, hasChildren)) {
                        onSelect(platformName, {
                            id: nodeId,
                            name: nodeName,
                            path: node.path || node.fullPath || nodeName,
                            categoryId: nodeId,
                            categoryName: nodeName,
                            canListProduct: node.canListProduct,
                            leaf: node.leaf,
                            available: node.available
                        });
                    }
                }}
            >
                <span className="puw-tree-toggle">
                    {hasChildren ? (
                        isExpanded ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />
                    ) : <span style={{ width: 10 }} />}
                </span>
                <span className="puw-tree-icon" style={{ color: isLeaf ? "var(--puw-green)" : "var(--puw-yellow)" }}>
                    {isLeaf ? <FaTag /> : <FaFolderOpen />}
                </span>
                <span className="puw-tree-name">{nodeName}</span>
                {isSelected && <FaCheckCircle style={{ color: "var(--puw-green)", fontSize: 11, marginLeft: "auto", flexShrink: 0 }} />}
            </div>
            {isExpanded && children.length > 0 && (
                <div>
                    {children.map((child, ci) => (
                        <TreeNode key={child.id || child.categoryId || ci} platformName={platformName} node={child} depth={depth + 1}
                            expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
});
TreeNode.displayName = "TreeNode";

/* ═══════════════════════════════════════════════════════════════
   DIŞ BİLEŞEN: PlatformCategoryPanel (memo ile — input focus korunur)
   ═══════════════════════════════════════════════════════════════ */
const PlatformCategoryPanel = memo(({ platformName, ps, onSearch, onSelect, onClear, onToggle, onLoadTree }) => {
    const plColor = PL_COLOR[platformName] || "var(--puw-accent)";
    const tree = ps.tree || [];
    const isLoading = ps.loading;
    const searchQ = ps.searchQ || "";
    const searchResults = ps.searchResults || [];
    const searchLoading = ps.searchLoading;
    const selected = ps.selected;
    const inputRef = useRef(null);

    return (
        <div className="puw-platform-cat-panel" style={{ borderColor: plColor + "30" }}>
            {/* Header */}
            <div className="puw-platform-cat-header">
                <span className="puw-platform-cat-icon" style={{ background: plColor + "15", color: plColor }}>
                    {PL_ICON[platformName] || <FaStore />}
                </span>
                <div style={{ flex: 1 }}>
                    <div className="puw-platform-cat-title" style={{ color: plColor }}>{platformName}</div>
                    <div className="puw-platform-cat-sub">
                        {selected ? (
                            <span style={{ color: "var(--puw-green)" }}><FaCheckCircle style={{ fontSize: 9 }} /> {selected.name}</span>
                        ) : "Kategori seçilmedi"}
                    </div>
                </div>
                {selected && (
                    <button className="puw-btn sm muted" onClick={() => onClear(platformName)} title="Temizle">
                        <FaTimes />
                    </button>
                )}
                {!tree.length && !isLoading && (
                    <button className="puw-btn sm" style={{ background: plColor, color: "#fff" }}
                        onClick={() => onLoadTree(platformName)}>
                        <FaFolderOpen /> Yükle
                    </button>
                )}
            </div>

            {/* Selected Category Badge */}
            {selected && (
                <div className="puw-cat-selected-badge" style={{ borderColor: plColor + "30", background: plColor + "08" }}>
                    <FaCheckCircle style={{ color: "var(--puw-green)", fontSize: 12, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--puw-text)" }}>{selected.name}</div>
                        {selected.path && selected.path !== selected.name && (
                            <div style={{ fontSize: 10, color: "var(--puw-text-dim)", marginTop: 2 }}>{selected.path}</div>
                        )}
                    </div>
                    <button className="puw-btn sm muted" onClick={() => onClear(platformName)} style={{ padding: "2px 6px" }}>
                        <FaTimes style={{ fontSize: 9 }} />
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="puw-cat-search-wrap">
                <span className="icon"><FaSearch /></span>
                <input
                    ref={inputRef}
                    className="puw-cat-search"
                    value={searchQ}
                    onChange={e => onSearch(platformName, e.target.value)}
                    placeholder={`${platformName} kategorilerinde ara...`}
                />
                <span className="puw-cat-search-spinner">
                    {searchLoading && <FaSpinner className="puw-spin" />}
                </span>
            </div>

            {/* Search Results */}
            {searchQ.trim().length >= 2 && searchResults.length > 0 ? (
                <div className="puw-cat-results">
                    {searchResults.slice(0, 50).map((c, i) => {
                        const rawId = c.id || c.categoryId;
                        const cId = rawId !== undefined && rawId !== null ? String(rawId) : "";
                        const tyParent = platformName === "Trendyol" && c.hasChildren === true;
                        const hbNotListable = platformName === "Hepsiburada" && !isHbListableCategory(c);
                        const selectable = cId !== "" && cId !== "0" && !tyParent && !hbNotListable;
                        const cName = c.name || c.categoryName || "";
                        const cPath = c.path || c.fullPath || "";
                        const isSel = selected?.id === cId;
                        const blockTitle = tyParent
                            ? "Trendyol üst düzey kategori — ağaçta alt dalı açın veya yaprak sonucu seçin."
                            : hbNotListable
                                ? "Hepsiburada listelenebilir yaprak kategori değil (kampanya/üst düğüm)"
                            : !cId || cId === "0"
                                ? "Bu sonuçta geçerli categoryId yok"
                                : "Kategoriyi seç";
                        return (
                            <div
                                key={`${platformName}-sr-${cId || i}`}
                                className={`puw-cat-result-item ${isSel ? "selected" : ""}`}
                                onClick={() => selectable && onSelect(platformName, {
                                    id: cId, name: cName, path: cPath,
                                    canListProduct: c.canListProduct, leaf: c.leaf, available: c.available
                                })}
                                style={selectable ? {} : { opacity: 0.6, cursor: "not-allowed" }}
                                title={blockTitle}
                            >
                                <FaTag style={{ fontSize: 10, color: isSel ? "var(--puw-green)" : "var(--puw-text-dim)", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--puw-text)" }}>{cName}</div>
                                    {cPath && <div style={{ fontSize: 9, color: "var(--puw-text-dim)", marginTop: 1 }}>{cPath}</div>}
                                    {tyParent && (
                                        <div style={{ fontSize: 9, color: "var(--puw-yellow)", marginTop: 1 }}>Üst düzey — yaprak kategori seçin</div>
                                    )}
                                    {!selectable && !tyParent && <div style={{ fontSize: 9, color: "var(--puw-yellow)", marginTop: 1 }}>Bu kayıtta categoryId yok</div>}
                                </div>
                                {isSel && <FaCheckCircle style={{ color: "var(--puw-green)", fontSize: 11, flexShrink: 0 }} />}
                            </div>
                        );
                    })}
                </div>
            ) : searchQ.trim().length >= 2 && !searchLoading && searchResults.length === 0 ? (
                <div style={{ color: "var(--puw-text-dim)", fontSize: 11, textAlign: "center", padding: "12px 0" }}>Sonuç bulunamadı</div>
            ) : null}

            {/* Tree */}
            {(!searchQ.trim() || searchQ.trim().length < 2) && (
                <div className="puw-cat-tree-container">
                    {isLoading ? (
                        <div className="puw-cat-tree-loading">
                            <FaSpinner className="puw-spin" /> Kategoriler yükleniyor...
                        </div>
                    ) : tree.length === 0 ? (
                        <div className="puw-cat-tree-empty">
                            <FaFolderOpen style={{ fontSize: 20, opacity: 0.3 }} />
                            <div>Kategori bulunamadı</div>
                            <button className="puw-btn sm" style={{ background: plColor, color: "#fff", marginTop: 6 }}
                                onClick={() => onLoadTree(platformName)}>
                                <FaFolderOpen /> Tekrar Dene
                            </button>
                        </div>
                    ) : (
                        tree.map((node, ni) => (
                            <TreeNode key={node.id || node.categoryId || ni} platformName={platformName} node={node} depth={0}
                                expanded={ps.expanded} selected={ps.selected} onToggle={onToggle} onSelect={onSelect} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
});
PlatformCategoryPanel.displayName = "PlatformCategoryPanel";

const fmt = (v) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0)); }
    catch { return `${Number(v || 0).toFixed(2)} ₺`; }
};

/* ═══════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════ */
const ProductUploadWizard = ({ userId }) => {
    // ── Wizard Step ──
    const [step, setStep] = useState(1);

    // ── Product Data ──
    const [uf, setUf] = useState({
        name: "", barcode: "", sku: "", description: "",
        price: "", listPrice: "", stock: "0",
        brand: "", imageUrls: [], targetMarketplaces: [],
        vatRate: "20",
        dimensionalWeight: "1",
        trendyolBrandId: "",
        trendyolCargoCompanyId: "10",
        n11ShipmentTemplate: ""
    });

    /** Trendyol getCategoryAttributes satırları + seçimler */
    const [tyAttrState, setTyAttrState] = useState({ loading: false, error: null, rows: [] });
    const [tySelections, setTySelections] = useState({});

    // ── Upload State ──
    const [uploadLoading, setUploadLoading] = useState(false);
    const [codeSugg, setCodeSugg] = useState(null);
    const [codeLoading, setCodeLoading] = useState(false);
    const [descLoading, setDescLoading] = useState(false);
    const [imgUploading, setImgUploading] = useState(false);
    const [descTone, setDescTone] = useState("professional");
    const [imgFiles, setImgFiles] = useState([]);
    const [imgUrlInput, setImgUrlInput] = useState("");
    const fileRef = useRef(null);

    // ── Marketplace State ──
    const [marketplaces, setMarketplaces] = useState([]);

    // ── Category State (per platform) ──
    // { Trendyol: { tree: [...], expanded: Set, selected: { id, name, path }, searchQ: "", searchResults: [], loading: false, searchLoading: false } }
    const [catState, setCatState] = useState({});
    const catSearchTimers = useRef({});

    // ── Toast ──
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); }, []);

    // ── Upload Result ──
    const [uploadResult, setUploadResult] = useState(null);

    /** Trendyol marka araması (Adım 1) */
    const [tyBrandSuggest, setTyBrandSuggest] = useState({ loading: false, list: [], open: false });
    const tyBrandSearchTimer = useRef(null);
    const tyBrandPickedRef = useRef(null);

    const ufSet = (k, v) => setUf(p => ({ ...p, [k]: v }));

    const hasTrendyolIntegration = useMemo(
        () => marketplaces.some((m) => m.marketplaceName === "Trendyol"),
        [marketplaces]
    );

    const runTyBrandSearch = useCallback(async (q) => {
        if (!hasTrendyolIntegration) return;
        const t = String(q || "").trim();
        if (t.length < 2) {
            setTyBrandSuggest((s) => ({ ...s, list: [], loading: false, open: false }));
            return;
        }
        setTyBrandSuggest((s) => ({ ...s, loading: true, open: true }));
        try {
            const r = await searchTrendyolBrands({ name: t, size: 35 });
            const brands = r?.data?.brands || [];
            setTyBrandSuggest((s) => ({ ...s, list: Array.isArray(brands) ? brands : [], loading: false, open: true }));
        } catch {
            setTyBrandSuggest((s) => ({ ...s, list: [], loading: false, open: false }));
        }
    }, [hasTrendyolIntegration]);

    const onBrandInputChange = (e) => {
        const v = e.target.value;
        ufSet("brand", v);
        if (tyBrandPickedRef.current && String(tyBrandPickedRef.current.name || "").trim() !== v.trim()) {
            tyBrandPickedRef.current = null;
            ufSet("trendyolBrandId", "");
        }
        if (tyBrandSearchTimer.current) clearTimeout(tyBrandSearchTimer.current);
        tyBrandSearchTimer.current = setTimeout(() => runTyBrandSearch(v), 380);
    };

    const pickTyBrand = (b) => {
        if (!b || b.id == null) return;
        tyBrandPickedRef.current = { id: b.id, name: b.name };
        ufSet("brand", String(b.name || ""));
        ufSet("trendyolBrandId", String(b.id));
        setTyBrandSuggest((s) => ({ ...s, open: false, list: [] }));
    };

    const clearTyBrandPick = () => {
        tyBrandPickedRef.current = null;
        ufSet("trendyolBrandId", "");
        setTyBrandSuggest((s) => ({ ...s, open: false }));
        showToast("Trendyol marka ID sıfırlandı (7651 Diğer + kategori özellikleri).", "success");
    };

    // ── Load Marketplaces ──
    useEffect(() => {
        getUserMarketplaces()
            .then((d) => {
                const raw = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
                const list = raw.map((m) => ({
                    ...m,
                    marketplaceName: normalizeMarketplaceName(m.marketplaceName),
                    name: normalizeMarketplaceName(m.marketplaceName)
                }));
                setMarketplaces(list);
                const names = list
                    .map((m) => m.marketplaceName)
                    .filter(Boolean)
                    .filter((n) => SUPPORTED_UPLOAD_MARKETPLACES.has(n));
                if (names.length === 0) return;
                setUf((prev) => {
                    const kept = prev.targetMarketplaces.filter((t) => SUPPORTED_UPLOAD_MARKETPLACES.has(t));
                    if (kept.length > 0) return { ...prev, targetMarketplaces: kept };
                    return { ...prev, targetMarketplaces: names };
                });
            })
            .catch(() => { setMarketplaces([]); });
    }, [userId]);

    const integrationNames = useMemo(
        () =>
            marketplaces
                .map((m) => m.marketplaceName)
                .filter(Boolean)
                .filter((n) => SUPPORTED_UPLOAD_MARKETPLACES.has(n)),
        [marketplaces]
    );

    const uploadableMarketplaces = useMemo(
        () => marketplaces.filter((m) => SUPPORTED_UPLOAD_MARKETPLACES.has(m.marketplaceName)),
        [marketplaces]
    );

    const n11MarketplaceRecord = useMemo(
        () => marketplaces.find((m) => m.marketplaceName === "N11"),
        [marketplaces]
    );

    const n11ShipmentBlocked = useMemo(() => {
        if (!uf.targetMarketplaces.includes("N11")) return false;
        const h = n11MarketplaceRecord?.integrationHints;
        if (h?.requiresShipmentTemplate !== true) return false;
        const fromIntegration = h?.shipmentTemplateConfigured === true;
        const fromWizard = Boolean(String(uf.n11ShipmentTemplate || "").trim());
        return !fromIntegration && !fromWizard;
    }, [uf.targetMarketplaces, n11MarketplaceRecord, uf.n11ShipmentTemplate]);

    /** Trendyol kategori özellikleri: önce zorunlu, sonra ada göre (panelde taranabilir) */
    const trendyolAttrRowsSorted = useMemo(() => {
        const rows = tyAttrState.rows;
        if (!Array.isArray(rows) || rows.length === 0) return [];
        return [...rows].sort((a, b) => {
            const ra = a.required ? 0 : 1;
            const rb = b.required ? 0 : 1;
            if (ra !== rb) return ra - rb;
            const na = String(a.attribute?.name || "").toLowerCase();
            const nb = String(b.attribute?.name || "").toLowerCase();
            return na.localeCompare(nb, "tr");
        });
    }, [tyAttrState.rows]);

    const tyAttrStats = useMemo(() => {
        const rows = tyAttrState.rows || [];
        let req = 0;
        let opt = 0;
        for (const r of rows) {
            if (r.required) req += 1;
            else opt += 1;
        }
        return { req, opt, total: rows.length };
    }, [tyAttrState.rows]);

    const trendyolManualAttrsOk = useMemo(() => {
        if (!uf.targetMarketplaces.includes("Trendyol") || !tyAttrState.rows?.length) return true;
        for (const row of tyAttrState.rows) {
            if (!row.required) continue;
            const aid = row.attribute?.id;
            if (aid == null) continue;
            const sel = tySelections[String(aid)] || { mode: "auto" };
            if (!sel.mode || sel.mode === "auto") continue;
            if (sel.mode === "value" && (sel.valueId == null || sel.valueId === "")) return false;
            if (sel.mode === "custom" && !String(sel.customText || "").trim()) return false;
        }
        return true;
    }, [uf.targetMarketplaces, tyAttrState.rows, tySelections]);

    const trendyolAttrGateOk = useMemo(() => {
        if (!uf.targetMarketplaces.includes("Trendyol")) return true;
        if (!catState.Trendyol?.selected?.id) return false;
        if (tyAttrState.loading) return false;
        if (tyAttrState.error) return false;
        if (!tyAttrState.rows?.length) return false;
        return true;
    }, [uf.targetMarketplaces, catState.Trendyol?.selected?.id, tyAttrState]);

    const n11TitleOk = useMemo(() => {
        if (!uf.targetMarketplaces.includes("N11")) return true;
        return uf.name.trim().length >= 15;
    }, [uf.targetMarketplaces, uf.name]);

    const pricePositive = useMemo(() => {
        const p = Number(uf.price);
        return !Number.isNaN(p) && p > 0;
    }, [uf.price]);

    /* ═══════════════════════════════════════════════════════════
       ADIM 1: TEMEL BİLGİLER — Handlers
       ═══════════════════════════════════════════════════════════ */
    const handleSuggestCodes = async () => {
        if (!uf.name.trim()) return showToast("Önce ürün adı girin", "error");
        setCodeLoading(true);
        try {
            const r = await suggestCodes(uf.name.trim(), uf.brand, "");
            setCodeSugg(r.suggestions);
        } catch { showToast("Öneri alınamadı", "error"); }
        finally { setCodeLoading(false); }
    };

    /* ═══════════════════════════════════════════════════════════
       ADIM 2: GÖRSELLER & AÇIKLAMA — Handlers
       ═══════════════════════════════════════════════════════════ */
    const handleGenDesc = async () => {
        if (!uf.name.trim()) return showToast("Önce ürün adı girin", "error");
        setDescLoading(true);
        try {
            const r = await generateDescription({
                productName: uf.name.trim(), brand: uf.brand,
                price: uf.price || undefined, tone: descTone
            });
            ufSet("description", r.description);
            showToast("Açıklama oluşturuldu");
        } catch { showToast("Açıklama hatası", "error"); }
        finally { setDescLoading(false); }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (fileRef.current) fileRef.current.value = "";
        if (files.length === 0) return;
        const remain = Math.max(0, 8 - (uf.imageUrls.length + imgFiles.length));
        const toUpload = files.slice(0, remain);
        if (toUpload.length === 0) {
            showToast("Maksimum 8 gorsel ekleyebilirsiniz", "error");
            return;
        }
        setImgUploading(true);
        try {
            const uploİadedUrls = [];
            for (const file of toUpload) {
                const r = await uploadProductImage(file);
                if (r?.url) uploİadedUrls.push(r.url);
            }
            if (uploİadedUrls.length > 0) {
                ufSet("imageUrls", [...uf.imageUrls, ...uploİadedUrls].slice(0, 8));
                showToast(`${uploİadedUrls.length} gorsel yuklendi`);
            }
            if (uploİadedUrls.length < toUpload.length) {
                logUiClientError("product_upload", "Bazı görseller yüklenemedi", { path: "/product-upload/image" });
                showToast("Bazi gorseller yuklenemedi", "error");
            }
        } catch (err) {
            const imgErr = err?.response?.data?.error || "Gorsel yukleme hatasi";
            logUiClientError("product_upload", imgErr, { path: "/product-upload/image" });
            showToast(imgErr, "error");
        } finally {
            setImgUploading(false);
        }
    };
    const handleAddImgUrl = () => {
        const u = imgUrlInput.trim();
        if (!u || !u.startsWith("http")) return;
        ufSet("imageUrls", [...uf.imageUrls, u].slice(0, 8));
        setImgUrlInput("");
    };
    const removeImg = (t, i) => {
        if (t === "file") setImgFiles(p => { const n = [...p]; if (n[i]?.preview) URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n; });
        else ufSet("imageUrls", uf.imageUrls.filter((_, idx) => idx !== i));
    };

    /* ═══════════════════════════════════════════════════════════
       ADIM 4: KATEGORİ AĞACI — Handlers
       ═══════════════════════════════════════════════════════════ */

    // Kategori ağacını yükle (platform bazlı)
    const loadCategoryTree = useCallback(async (platformName) => {
        setCatState(prev => ({
            ...prev,
            [platformName]: { ...(prev[platformName] || {}), loading: true, tree: prev[platformName]?.tree || [] }
        }));
        try {
            const r = await getCategoryTree(platformName);
            const cats = extractCategories(r);
            setCatState(prev => ({
                ...prev,
                [platformName]: {
                    ...(prev[platformName] || {}),
                    tree: cats,
                    loading: false,
                    expanded: prev[platformName]?.expanded || new Set(),
                    selected: prev[platformName]?.selected || null,
                    searchQ: prev[platformName]?.searchQ || "",
                    searchResults: prev[platformName]?.searchResults || [],
                    searchLoading: false
                }
            }));
        } catch {
            setCatState(prev => ({
                ...prev,
                [platformName]: { ...(prev[platformName] || {}), loading: false, tree: [] }
            }));
        }
    }, []);

    // Kategori arama
    const handleCatSearch = useCallback((platformName, query) => {
        setCatState(prev => ({
            ...prev,
            [platformName]: { ...(prev[platformName] || {}), searchQ: query }
        }));

        if (catSearchTimers.current[platformName]) clearTimeout(catSearchTimers.current[platformName]);

        if (!query.trim() || query.trim().length < 2) {
            setCatState(prev => ({
                ...prev,
                [platformName]: { ...(prev[platformName] || {}), searchResults: [], searchLoading: false }
            }));
            return;
        }

        setCatState(prev => ({
            ...prev,
            [platformName]: { ...(prev[platformName] || {}), searchLoading: true }
        }));

        catSearchTimers.current[platformName] = setTimeout(async () => {
            try {
                const r = await searchCategories(platformName, query.trim(), { listingOnly: true });
                const results = extractCategories(r);
                setCatState(prev => ({
                    ...prev,
                    [platformName]: { ...(prev[platformName] || {}), searchResults: results, searchLoading: false }
                }));
            } catch {
                setCatState(prev => ({
                    ...prev,
                    [platformName]: { ...(prev[platformName] || {}), searchResults: [], searchLoading: false }
                }));
            }
        }, 500);
    }, []);

    // Kategori seç
    const selectCategory = useCallback((platformName, cat) => {
        setCatState(prev => ({
            ...prev,
            [platformName]: {
                ...(prev[platformName] || {}),
                selected: {
                    id: cat.id || cat.categoryId,
                    name: cat.name || cat.categoryName || "",
                    path: cat.path || cat.fullPath || cat.name || "",
                    canListProduct: cat.canListProduct,
                    leaf: cat.leaf,
                    available: cat.available
                }
            }
        }));
    }, []);

    // Kategori seçimini temizle
    const clearCategory = useCallback((platformName) => {
        setCatState(prev => ({
            ...prev,
            [platformName]: { ...(prev[platformName] || {}), selected: null }
        }));
    }, []);

    // Ağaç node'unu aç/kapa
    const toggleTreeNode = useCallback((platformName, nodeId) => {
        setCatState(prev => {
            const ps = prev[platformName] || {};
            const expanded = new Set(ps.expanded || []);
            if (expanded.has(nodeId)) expanded.delete(nodeId);
            else expanded.add(nodeId);
            return { ...prev, [platformName]: { ...ps, expanded } };
        });
    }, []);

    // Step 4'e geçince aktif platformların kategorilerini yükle
    useEffect(() => {
        if (step !== 4) return;
        const activePlatforms = uf.targetMarketplaces;

        activePlatforms.forEach(pName => {
            if (!catState[pName]?.tree?.length && !catState[pName]?.loading) {
                loadCategoryTree(pName);
            }
        });
    }, [step, uf.targetMarketplaces, marketplaces, catState, loadCategoryTree]);

    // Trendyol: leaf kategori seçilince özellik listesini çek
    useEffect(() => {
        if (step !== 4 || !uf.targetMarketplaces.includes("Trendyol")) {
            setTyAttrState({ loading: false, error: null, rows: [] });
            return;
        }
        const sel = catState.Trendyol?.selected;
        if (!sel?.id) {
            setTyAttrState({ loading: false, error: null, rows: [] });
            setTySelections({});
            return;
        }
        let cancelled = false;
        setTySelections({});
        setTyAttrState({ loading: true, error: null, rows: [] });
        (async () => {
            try {
                const r = await getTrendyolCategoryAttributes(String(sel.id));
                if (cancelled) return;
                const rows = r?.data?.categoryAttributes || [];
                setTyAttrState({
                    loading: false,
                    error: null,
                    rows: Array.isArray(rows) ? rows : []
                });
            } catch (e) {
                if (cancelled) return;
                setTyAttrState({
                    loading: false,
                    error: e.response?.data?.error || e.message || "Özellik listesi alınamadı",
                    rows: []
                });
            }
        })();
        return () => { cancelled = true; };
    }, [step, uf.targetMarketplaces, catState.Trendyol?.selected?.id]);

    // Trendyol: Marka özelliği özel metin kabul ediyorsa form markasını doldur (liste eşleşmezse yanlış büyük marka seçilmesin)
    useEffect(() => {
        if (step !== 4 || !uf.targetMarketplaces.includes("Trendyol")) return;
        if (tyAttrState.loading || tyAttrState.error || !tyAttrState.rows?.length) return;
        const brand = String(uf.brand || "").trim();
        if (!brand) return;
        setTySelections((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const row of tyAttrState.rows) {
                if (!row.required || !row.allowCustom) continue;
                const attr = row.attribute || {};
                const aid = attr.id;
                if (aid == null) continue;
                const aname = String(attr.name || "").toLowerCase();
                const isMarka =
                    aname === "marka" ||
                    aname === "brand" ||
                    (aname.includes("marka") && !aname.includes("web color") && !aname.includes("webcolor"));
                if (!isMarka) continue;
                const k = String(aid);
                const cur = prev[k];
                if (cur?.mode === "value") continue;
                if (cur?.mode === "custom" && String(cur.customText || "").trim()) continue;
                next[k] = { mode: "custom", customText: brand };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [step, uf.targetMarketplaces, uf.brand, tyAttrState.rows, tyAttrState.loading, tyAttrState.error]);

    const buildTrendyolAttributesPayload = useCallback(() => {
        const out = [];
        for (const row of tyAttrState.rows) {
            const aid = row.attribute?.id;
            if (aid == null) continue;
            const sel = tySelections[String(aid)] || { mode: "auto" };
            if (!sel.mode || sel.mode === "auto") continue;
            if (sel.mode === "value" && sel.valueId != null && sel.valueId !== "") {
                out.push({ attributeId: Number(aid), attributeValueId: Number(sel.valueId) });
            }
            if (sel.mode === "custom" && sel.customText && String(sel.customText).trim()) {
                out.push({ attributeId: Number(aid), customAttributeValue: String(sel.customText).trim() });
            }
        }
        return out;
    }, [tyAttrState.rows, tySelections]);

    const setTySel = (attrId, patch) => {
        const k = String(attrId);
        setTySelections((prev) => ({
            ...prev,
            [k]: { ...(prev[k] || { mode: "auto" }), ...patch }
        }));
    };

    /* ═══════════════════════════════════════════════════════════
       ÜRÜN OLUŞTUR & DAĞIT
       ═══════════════════════════════════════════════════════════ */
    const handleCreate = async () => {
        const toastErr = (msg) => {
            logUiClientError("product_upload", String(msg), { path: "/product-upload" });
            showToast(msg, "error");
        };
        if (!uf.name || !uf.barcode || !uf.sku || !uf.price) {
            toastErr("Ad, barkod, SKU ve fiyat zorunlu");
            return;
        }
        if (!pricePositive) {
            toastErr("Satış fiyatı 0'dan büyük olmalıdır.");
            return;
        }
        if (uf.targetMarketplaces.includes("Trendyol")) {
            const t = uf.name.trim();
            if (t.length > 100) {
                toastErr("Trendyol ürün adı en fazla 100 karakter olabilir");
                return;
            }
        }
        if (uf.targetMarketplaces.includes("N11") && uf.name.trim().length < 15) {
            toastErr("N11: Ürün adı en az 15 karakter olmalıdır.");
            return;
        }
        if (n11ShipmentBlocked) {
            toastErr(
                "N11: Kargo şablon adı gerekli. Bu adımdaki N11 alanına yazın veya pazaryeri entegrasyonunda tanımlayın."
            );
            return;
        }
        if (uf.targetMarketplaces.includes("Trendyol")) {
            if (!trendyolAttrGateOk) {
                if (tyAttrState.loading) {
                    toastErr("Trendyol kategori özellikleri yükleniyor; lütfen bekleyin.");
                    return;
                }
                if (tyAttrState.error) {
                    toastErr(`Trendyol özellik listesi: ${tyAttrState.error}`);
                    return;
                }
                if (!catState.Trendyol?.selected?.id) {
                    toastErr("Trendyol için yaprak kategori seçin.");
                    return;
                }
                toastErr("Trendyol: Bu kategoride özellik listesi yok veya eksik — yaprak kategori seçin.");
                return;
            }
            if (!trendyolManualAttrsOk) {
                toastErr(
                    "Trendyol: Zorunlu özelliklerde \"Listeden seç\" veya \"Özel metin\" seçtiyseniz değerleri doldurun."
                );
                return;
            }
        }
        setUploadLoading(true);
        setUploadResult(null);
        try {
            let remoteUrls = [...uf.imageUrls]
                .map((u) => (typeof u === "string" ? u.trim() : ""))
                .filter((u) => /^https?:\/\//i.test(u));
            remoteUrls = normalizePublicImageUrls(remoteUrls, uf.targetMarketplaces);
            const hasOnlyLocalFiles = remoteUrls.length === 0 && imgFiles.length > 0;
            if (hasOnlyLocalFiles && uf.targetMarketplaces.length > 0) {
                toastErr(
                    "Yerel dosya görselleri pazaryerine gönderilemez. Lütfen Adım 2'de en az 1 adet https:// görsel URL ekleyin."
                );
                return;
            }
            const platformsNeedingImages = uf.targetMarketplaces.filter((p) =>
                PLATFORMS_NEED_IMAGE_URL.has(p)
            );
            if (platformsNeedingImages.length > 0 && remoteUrls.length === 0) {
                toastErr(
                    `${platformsNeedingImages.join(", ")} için Adım 2'de en az bir görsel URL (http veya https) ekleyin.`
                );
                return;
            }
            if (uf.targetMarketplaces.includes("N11")) {
                const hasHttpsImage = remoteUrls.some((u) => /^https:\/\//i.test(u));
                if (!hasHttpsImage) {
                    toastErr("N11 en az bir https:// ile başlayan görsel URL zorunlu kılar.");
                    return;
                }
            }
            const imgs = remoteUrls;

            // Platform kategori bilgilerini ekle
            const platformCategories = {};
            for (const pName of (uf.targetMarketplaces.length > 0 ? uf.targetMarketplaces : [])) {
                const cs = catState[pName];
                if (cs?.selected) {
                    const selectedId = String(cs.selected.id || "").trim();
                    const validCategoryId = /^\d+$/.test(selectedId) && Number(selectedId) > 0;
                    if (!validCategoryId) {
                        toastErr(
                            `${pName} için seçilen kategori geçersiz (categoryId yok). Lütfen ağaçtan başka bir kategori seçin.`
                        );
                        return;
                    }
                    if (pName === "Hepsiburada" && !isHbListableCategory(cs.selected)) {
                        toastErr(
                            "Hepsiburada için listelenebilir yaprak katalog kategorisi seçin (kampanya veya üst düğüm değil)."
                        );
                        return;
                    }
                    platformCategories[pName] = {
                        categoryId: selectedId,
                        categoryName: cs.selected.name,
                        categoryPath: cs.selected.path
                    };
                }
            }

            let marketplaceExtras = undefined;
            if (uf.targetMarketplaces.includes("Trendyol")) {
                marketplaceExtras = { Trendyol: {} };
                if (uf.trendyolBrandId.trim()) {
                    marketplaceExtras.Trendyol.brandId = Number(uf.trendyolBrandId);
                }
                if (uf.trendyolCargoCompanyId.trim()) {
                    marketplaceExtras.Trendyol.cargoCompanyId = Number(uf.trendyolCargoCompanyId);
                }
                const tyAttrs = buildTrendyolAttributesPayload();
                if (tyAttrs.length > 0) marketplaceExtras.Trendyol.trendyolAttributes = tyAttrs;
            }

            const r = await createAndDistribute({
                name: uf.name.trim(),
                barcode: uf.barcode.trim(),
                sku: uf.sku.trim(),
                description: uf.description.trim(),
                price: Number(uf.price),
                listPrice: uf.listPrice ? Number(uf.listPrice) : Number(uf.price),
                stock: Number(uf.stock) || 0,
                brand: uf.brand.trim(),
                images: imgs,
                targetMarketplaces: uf.targetMarketplaces,
                platformCategories,
                vatRate: uf.vatRate !== "" ? Number(uf.vatRate) : 20,
                dimensionalWeight: uf.dimensionalWeight !== "" ? Number(uf.dimensionalWeight) : undefined,
                marketplaceExtras,
                n11ShipmentTemplate: uf.targetMarketplaces.includes("N11")
                    ? String(uf.n11ShipmentTemplate || "").trim()
                    : ""
            });

            const dist = r.distributeResults || [];
            const distFailed = dist.filter((x) => x.success === false);
            const allMarketplacesFailed =
                uf.targetMarketplaces.length > 0 && dist.length > 0 && distFailed.length === dist.length;
            const partialFail = distFailed.length > 0 && !allMarketplacesFailed;

            const msg = r.message || "Ürün oluşturuldu!";

            if (allMarketplacesFailed) {
                setUploadResult({ success: false, message: msg });
                showToast(msg, "error");
                for (const row of distFailed) {
                    const mp = row.marketplaceName || row.platform || row.marketplace || "pazaryeri";
                    const detail = row.message || row.error || row.reason || row.detail || "Dağıtım başarısız";
                    logUiClientError("marketplace", `${mp}: ${detail}`, { path: `/dagitim/${mp}`, meta: row });
                }
            } else if (partialFail) {
                setUploadResult({ success: true, message: msg, distributeWarning: true });
                showToast(msg, "error");
                for (const row of distFailed) {
                    const mp = row.marketplaceName || row.platform || row.marketplace || "pazaryeri";
                    const detail = row.message || row.error || row.reason || row.detail || "Dağıtım başarısız";
                    logUiClientError("marketplace", `${mp}: ${detail}`, { path: `/dagitim/${mp}`, meta: row });
                }
                logUserActivity(
                    "product_upload",
                    "Ürün kaydedildi — kısmi pazaryeri hatası",
                    msg,
                    "warning",
                    { sku: uf.sku.trim(), barcode: uf.barcode.trim(), targets: [...uf.targetMarketplaces] }
                );
            } else {
                setUploadResult({ success: true, message: msg });
                showToast(msg);
                logUserActivity(
                    "product_upload",
                    "Ürün oluşturuldu / dağıtıldı",
                    msg,
                    "success",
                    { sku: uf.sku.trim(), barcode: uf.barcode.trim(), targets: [...uf.targetMarketplaces] }
                );
            }
        } catch (e) {
            const errData = e.response?.data;
            const errMsg =
                e.response?.status === 409 && errData?.error
                    ? String(errData.error)
                    : String(errData?.error || e.message || "Kayıt hatası");
            logUiClientError("product_upload", errMsg, {
                path: "/product-upload/create",
                meta: { status: e.response?.status, type: errData?.type, conflicts: errData?.conflicts },
            });
            if (e.response?.status === 409 && errData?.type) {
                const conflict = errData.conflicts?.[errData.type];
                const conflictInfo = conflict ? ` → Mevcut: "${conflict.name}"` : "";
                setUploadResult({ success: false, message: `${errData.error}${conflictInfo}` });
                showToast(`⚠️ ${errData.error}${conflictInfo}`, "error");
            } else {
                setUploadResult({ success: false, message: errData?.error || e.message });
                showToast("Hata: " + (errData?.error || e.message), "error");
            }
        } finally { setUploadLoading(false); }
    };

    const resetWizard = () => {
        const defaultTargets = marketplaces
            .map((m) => m.marketplaceName)
            .filter(Boolean)
            .filter((n) => SUPPORTED_UPLOAD_MARKETPLACES.has(n));
        setUf({
            name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "0",
            brand: "", imageUrls: [], targetMarketplaces: defaultTargets,
            vatRate: "20", dimensionalWeight: "1", trendyolBrandId: "", trendyolCargoCompanyId: "10",
            n11ShipmentTemplate: ""
        });
        setImgFiles([]); setCodeSugg(null); setCatState({}); setStep(1); setUploadResult(null);
        setTyAttrState({ loading: false, error: null, rows: [] }); setTySelections({});
        setTyBrandSuggest({ loading: false, list: [], open: false });
        tyBrandPickedRef.current = null;
    };

    const toggleTarget = useCallback((p) => {
        setUf((prev) => {
            const t = [...prev.targetMarketplaces];
            const i = t.indexOf(p);
            if (i >= 0) {
                if (t.length <= 1 && integrationNames.length > 0) {
                    showToast("Dağıtım için en az bir pazaryeri seçili olmalıdır.", "error");
                    return prev;
                }
                t.splice(i, 1);
            } else {
                t.push(p);
            }
            return { ...prev, targetMarketplaces: t };
        });
    }, [integrationNames.length, showToast]);

    /* ═══════════════════════════════════════════════════════════
       COMPUTED
       ═══════════════════════════════════════════════════════════ */
    const totalImgs = uf.imageUrls.length + imgFiles.length;
    const canSubmit = uf.name && uf.barcode && uf.sku && uf.price;
    const selectedPlatforms = uf.targetMarketplaces;
    const missingCategories = selectedPlatforms.filter((pName) => !catState[pName]?.selected);
    /** Dağıtım yoksa yalnızca ürün kaydı; dağıtım varsa kategori + platform kuralları. */
    const canDistributeNow =
        canSubmit &&
        pricePositive &&
        (selectedPlatforms.length === 0 ||
            (missingCategories.length === 0 &&
                !n11ShipmentBlocked &&
                n11TitleOk &&
                trendyolAttrGateOk &&
                trendyolManualAttrsOk));
    const allImages = [...uf.imageUrls.map((u, i) => ({ type: "url", src: u, idx: i })), ...imgFiles.map((f, i) => ({ type: "file", src: f.preview, idx: i }))];

    /* ═══════════════════════════════════════════════════════════
       YARDIMCI BİLEŞENLER
       ═══════════════════════════════════════════════════════════ */
    const Pill = ({ color, children }) => (
        <span className="puw-pill" style={{ background: color + "15", color, border: `1px solid ${color}30` }}>{children}</span>
    );

    /* ═══════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════ */
    const steps = [
        { num: 1, label: "Temel Bilgiler", icon: <FaEdit />, desc: "Ad, fiyat, stok, barkod" },
        { num: 2, label: "Görseller & Açıklama", icon: <FaImage />, desc: "Fotoğraf ve ürün açıklaması" },
        { num: 3, label: "Ön İzleme", icon: <FaEye />, desc: "Ürün bilgilerini kontrol edin" },
        { num: 4, label: "Kategori & Gönder", icon: <FaRocket />, desc: "Platform kategorileri seçin" },
    ];

    return (
        <div className="puw-root">
            <div className="puw-shell">
            {/* Header */}
            <header className="puw-header">
                <div className="puw-header-inner">
                    <div>
                        <h1><FaCloudUploadAlt /> Ürün Yükle & Dağıt</h1>
                        <p>Ürün bilgilerini girin, ön izleyin, platform kategorilerini seçin. Bağlı mağazalar varsayılan olarak hedefdir; gönderim seçtiğiniz pazaryerlerine yapılır.</p>
                    </div>
                    <span className="puw-hero-badge">Sihirbaz · 4 adım</span>
                </div>
            </header>

            {/* Steps Bar */}
            <div className="puw-steps-wrap">
                <div className="puw-steps" role="tablist" aria-label="Ürün yükleme adımları">
                    {steps.map(s => (
                        <button
                            key={s.num}
                            type="button"
                            role="tab"
                            aria-selected={step === s.num}
                            aria-current={step === s.num ? "step" : undefined}
                            className={`puw-step ${step === s.num ? "active" : ""} ${step > s.num ? "done" : ""}`}
                            onClick={() => setStep(s.num)}
                        >
                            <span className="step-num">
                                {step > s.num ? <FaCheck /> : s.icon}
                            </span>
                            <div>
                                <div className="step-label">Adım {s.num}</div>
                                <div className="step-desc">{s.label}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

                    {/* ═══════════════════════════════════════════
                        ADIM 1: TEMEL BİLGİLER
                        ═══════════════════════════════════════════ */}
                    {step === 1 && (
                        <div className="puw-step-content puw-step-content--wide-split">
                            <div className="puw-card">
                                <div className="puw-card-header">
                                    <span className="icon"><FaEdit /></span>
                                    <div><div className="title">Temel Bilgiler</div><div className="subtitle">Ürün adı, fiyat, stok ve marka</div></div>
                                </div>
                                <div className="puw-grid-2">
                                    <div className="puw-field full">
                                        <label>
                                            <FaBox style={{ fontSize: 10 }} /> Ürün Adı <span className="required">*</span>
                                            <span style={{ fontWeight: 400, color: "var(--puw-text-dim)", marginLeft: 8 }}>
                                                ({uf.name.length}/100 — Trendyol; N11 için en az 15 karakter)
                                            </span>
                                        </label>
                                        <input value={uf.name} onChange={e => ufSet("name", e.target.value)} placeholder="Ürün başlığı..." maxLength={100} />
                                    </div>
                                    <div className="puw-field full">
                                        <label>
                                            <FaTag style={{ fontSize: 10 }} /> Marka
                                            {hasTrendyolIntegration && (
                                                <span style={{ fontWeight: 400, color: "var(--puw-text-dim)", marginLeft: 8 }}>
                                                    (Trendyol hesabı bağlı — yazınca listeden seçebilirsiniz)
                                                </span>
                                            )}
                                        </label>
                                        {hasTrendyolIntegration ? (
                                            <div className="puw-brand-ty-wrap">
                                                <div className="puw-brand-input-row">
                                                    <input
                                                        className="puw-input"
                                                        value={uf.brand}
                                                        onChange={onBrandInputChange}
                                                        onFocus={() => {
                                                            if (uf.brand.trim().length >= 2) {
                                                                setTyBrandSuggest((s) => ({ ...s, open: s.list.length > 0 }));
                                                            }
                                                        }}
                                                        placeholder="Örn. lysiaaccessory — yazınca Trendyol marka listesinde aranır"
                                                        autoComplete="off"
                                                    />
                                                    {tyBrandSuggest.loading && (
                                                        <FaSpinner className="puw-spin puw-brand-spinner" />
                                                    )}
                                                    {tyBrandSuggest.open && tyBrandSuggest.list.length > 0 && (
                                                        <ul className="puw-brand-dd" role="listbox">
                                                            {tyBrandSuggest.list.map((b) => (
                                                                <li
                                                                    key={b.id}
                                                                    role="option"
                                                                    className="puw-brand-dd-item"
                                                                    onMouseDown={(ev) => ev.preventDefault()}
                                                                    onClick={() => pickTyBrand(b)}
                                                                >
                                                                    <span className="puw-brand-dd-name">{b.name}</span>
                                                                    <span className="puw-brand-dd-id">#{b.id}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <div className="puw-brand-actions">
                                                    {uf.trendyolBrandId ? (
                                                        <span className="puw-brand-badge ok">
                                                            <FaCheckCircle style={{ marginRight: 6 }} />
                                                            Trendyol marka ID: <strong>{uf.trendyolBrandId}</strong>
                                                        </span>
                                                    ) : (
                                                        <span className="puw-brand-badge muted">
                                                            <FaInfoCircle style={{ marginRight: 6 }} />
                                                            Listeden seçim yok — üst marka varsayılan 7651 (Diğer); kategori &quot;Marka&quot; özelliği yine önemlidir.
                                                        </span>
                                                    )}
                                                    <button type="button" className="puw-btn sm muted" onClick={clearTyBrandPick}>
                                                        Listede yok / özel marka
                                                    </button>
                                                    <a
                                                        href="https://partner.trendyol.com/"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="puw-link-inline"
                                                    >
                                                        Yeni marka başvurusu (Trendyol Satıcı) ↗
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <input value={uf.brand} onChange={(e) => ufSet("brand", e.target.value)} placeholder="Marka" />
                                        )}
                                    </div>
                                    <div className="puw-field">
                                        <label><FaWarehouse style={{ fontSize: 10 }} /> Stok</label>
                                        <input type="number" value={uf.stock} onChange={e => ufSet("stock", e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="puw-field">
                                        <label><FaDollarSign style={{ fontSize: 10 }} /> Satış Fiyatı (₺) <span className="required">*</span></label>
                                        <input type="number" value={uf.price} onChange={e => ufSet("price", e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="puw-field">
                                        <label><FaTag style={{ fontSize: 10 }} /> Liste Fiyatı (₺)</label>
                                        <input type="number" value={uf.listPrice} onChange={e => ufSet("listPrice", e.target.value)} placeholder="Boş = satış fiyatı" />
                                    </div>
                                    <div className="puw-field">
                                        <label>KDV (%) <span style={{ color: "var(--puw-text-dim)", fontWeight: 400 }}>Trendyol</span></label>
                                        <select value={uf.vatRate} onChange={e => ufSet("vatRate", e.target.value)} className="puw-input">
                                            {["0", "1", "10", "20"].map((v) => (
                                                <option key={v} value={v}>{v}%</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="puw-field">
                                        <label>Desi (ağırlık) <span style={{ color: "var(--puw-text-dim)", fontWeight: 400 }}>Trendyol dimensionalWeight</span></label>
                                        <input type="number" min="0.1" step="0.1" value={uf.dimensionalWeight} onChange={e => ufSet("dimensionalWeight", e.target.value)} placeholder="1" />
                                    </div>
                                </div>
                            </div>

                            <div className="puw-card">
                                <div className="puw-card-header">
                                    <span className="icon"><FaBarcode /></span>
                                    <div style={{ flex: 1 }}><div className="title">Barkod & SKU</div><div className="subtitle">Manuel girin veya AI öneri alın</div></div>
                                    <button className="puw-btn sm purple" onClick={handleSuggestCodes} disabled={!uf.name.trim() || codeLoading}>
                                        {codeLoading ? <span className="spinner" /> : <FaMagic />} Öneri
                                    </button>
                                </div>
                                <div className="puw-grid-2">
                                    <div className="puw-field">
                                        <label><FaBarcode style={{ fontSize: 10 }} /> Barkod <span className="required">*</span></label>
                                        <input value={uf.barcode} onChange={e => ufSet("barcode", e.target.value)} placeholder="Benzersiz barkod" />
                                    </div>
                                    <div className="puw-field">
                                        <label><FaTag style={{ fontSize: 10 }} /> SKU <span className="required">*</span></label>
                                        <input value={uf.sku} onChange={e => ufSet("sku", e.target.value)} placeholder="Stok kodu" />
                                    </div>
                                </div>
                                {codeSugg && (
                                    <div className="puw-grid-2" style={{ marginTop: 12 }}>
                                        <div>
                                            <div className="puw-sugg-label">Barkod önerileri</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                {(codeSugg.barcodes || []).map((b, i) => (
                                                    <button key={i} className={`puw-code-chip ${!b.available ? "unavailable" : ""}`}
                                                        onClick={() => b.available && ufSet("barcode", b.value)} disabled={!b.available}>
                                                        {b.available ? <FaCheck style={{ fontSize: 8 }} /> : <FaTimes style={{ fontSize: 8 }} />} {b.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="puw-sugg-label">SKU önerileri</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                {(codeSugg.skus || []).map((s, i) => (
                                                    <button key={i} className={`puw-code-chip ${!s.available ? "unavailable" : ""}`}
                                                        onClick={() => s.available && ufSet("sku", s.value)} disabled={!s.available}>
                                                        {s.available ? <FaCheck style={{ fontSize: 8 }} /> : <FaTimes style={{ fontSize: 8 }} />} {s.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="puw-nav">
                                <div />
                                <button className="puw-btn accent" onClick={() => setStep(2)} disabled={!uf.name.trim()}>
                                    İleri <FaArrowRight />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════
                        ADIM 2: GÖRSELLER & AÇIKLAMA
                        ═══════════════════════════════════════════ */}
                    {step === 2 && (
                        <div className="puw-step-content puw-step-content--wide-split">
                            <div className="puw-card">
                                <div className="puw-card-header">
                                    <span className="icon"><FaImage /></span>
                                    <div><div className="title">Görseller</div><div className="subtitle">Dosya veya URL (maks. 8)</div></div>
                                    <Pill color="var(--puw-accent)">{totalImgs}/8</Pill>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                    <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
                                    <button className="puw-btn sm purple" onClick={() => fileRef.current?.click()} disabled={totalImgs >= 8 || imgUploading}>
                                        {imgUploading ? <span className="spinner" /> : <FaFolderOpen />} Dosya
                                    </button>
                                    <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 180 }}>
                                        <input className="puw-input" value={imgUrlInput} onChange={e => setImgUrlInput(e.target.value)}
                                            placeholder="https://... görsel URL" onKeyDown={e => e.key === "Enter" && handleAddImgUrl()} />
                                        <button className="puw-btn sm green" onClick={handleAddImgUrl} disabled={!imgUrlInput.trim() || totalImgs >= 8}><FaPlus /></button>
                                    </div>
                                </div>
                                {imgFiles.length > 0 && (
                                    <div style={{ color: "var(--puw-yellow)", fontSize: 10, marginBottom: 8 }}>
                                        <FaInfoCircle style={{ marginRight: 4 }} />
                                        Yerel dosyalar yalnızca ön izleme içindir. Pazaryeri yüklemesi için https:// görsel URL ekleyin.
                                    </div>
                                )}
                                {totalImgs > 0 ? (
                                    <div className="puw-img-grid">
                                        {allImages.map((img, i) => (
                                            <div key={`${img.type}-${img.idx}`} className="puw-img-item">
                                                <img src={img.src} alt="" onError={e => e.target.style.display = "none"} />
                                                <button className="remove-btn" onClick={() => removeImg(img.type, img.idx)}><FaTimes /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="puw-img-dropzone" onClick={() => fileRef.current?.click()}>
                                        <div className="icon"><FaImage /></div>
                                        <div className="text">Tıklayın veya URL yapıştırın</div>
                                    </div>
                                )}
                            </div>

                            <div className="puw-card">
                                <div className="puw-card-header">
                                    <span className="icon"><FaEdit /></span>
                                    <div style={{ flex: 1 }}><div className="title">Açıklama</div><div className="subtitle">Yazın veya AI ile oluşturun</div></div>
                                </div>
                                <div className="puw-tone-group" style={{ marginBottom: 10 }}>
                                    <span style={{ color: "var(--puw-text-dim)", fontSize: 9, fontWeight: 700 }}><FaMagic /> Ton:</span>
                                    {[{ id: "professional", l: "Profesyonel" }, { id: "friendly", l: "Samimi" }, { id: "luxury", l: "Lüks" }, { id: "minimal", l: "Minimal" }].map(t => (
                                        <button key={t.id} className={`puw-tone-btn ${descTone === t.id ? "active" : ""}`} onClick={() => setDescTone(t.id)}>{t.l}</button>
                                    ))}
                                    <div style={{ flex: 1 }} />
                                    <button className="puw-btn sm purple" onClick={handleGenDesc} disabled={!uf.name.trim() || descLoading}>
                                        {descLoading ? <span className="spinner" /> : <FaMagic />} Oluştur
                                    </button>
                                </div>
                                <div className="puw-field">
                                    <textarea value={uf.description} onChange={e => ufSet("description", e.target.value)} placeholder="Ürün açıklaması..." rows={8} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                    <span style={{ color: "var(--puw-text-dim)", fontSize: 9 }}>{uf.description.length} karakter</span>
                                    {uf.description && <button onClick={() => ufSet("description", "")} style={{ background: "none", border: "none", color: "var(--puw-text-dim)", cursor: "pointer", fontSize: 10 }}><FaTrash style={{ fontSize: 9 }} /> Temizle</button>}
                                </div>
                            </div>

                            <div className="puw-nav">
                                <button className="puw-btn muted" onClick={() => setStep(1)}><FaArrowLeft /> Geri</button>
                                <button className="puw-btn accent" onClick={() => setStep(3)}>Ön İzleme <FaArrowRight /></button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════
                        ADIM 3: ÖN İZLEME
                        ═══════════════════════════════════════════ */}
                    {step === 3 && (
                        <div className="puw-step-content">
                            <div className="puw-preview-layout">
                                {/* Sol: Ürün Kartı */}
                                <div className="puw-card puw-preview-card">
                                    <div className="puw-preview-header">
                                        <FaEye style={{ color: "var(--puw-accent)" }} />
                                        <span>Ürün Ön İzleme</span>
                                    </div>

                                    {/* Görseller */}
                                    {allImages.length > 0 && (
                                        <div className="puw-preview-images">
                                            <div className="puw-preview-main-img">
                                                <img src={allImages[0].src} alt="" />
                                            </div>
                                            {allImages.length > 1 && (
                                                <div className="puw-preview-thumbs">
                                                    {allImages.slice(1, 5).map((img, i) => (
                                                        <img key={i} src={img.src} alt="" className="puw-preview-thumb" />
                                                    ))}
                                                    {allImages.length > 5 && (
                                                        <div className="puw-preview-thumb-more">+{allImages.length - 5}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Ürün Bilgileri */}
                                    <div className="puw-preview-info">
                                        <h2 className="puw-preview-name">{uf.name || "Ürün Adı"}</h2>
                                        {uf.brand && <div className="puw-preview-brand">{uf.brand}</div>}

                                        <div className="puw-preview-price-row">
                                            <span className="puw-preview-price">{uf.price ? fmt(uf.price) : "—"}</span>
                                            {uf.listPrice && uf.listPrice !== uf.price && (
                                                <span className="puw-preview-list-price">{fmt(uf.listPrice)}</span>
                                            )}
                                        </div>

                                        <div className="puw-preview-details">
                                            {[
                                                { icon: <FaBarcode />, label: "Barkod", value: uf.barcode || "—", color: "var(--puw-accent)" },
                                                { icon: <FaTag />, label: "SKU / model (productMainId)", value: uf.sku || "—", color: "var(--puw-purple)" },
                                                { icon: <FaWarehouse />, label: "Stok", value: uf.stock || "0", color: "var(--puw-green)" },
                                                { icon: <FaDollarSign />, label: "KDV / Desi (TY)", value: `${uf.vatRate || "20"}% · ${uf.dimensionalWeight || "1"} desi`, color: "var(--puw-orange)" },
                                                { icon: <FaImage />, label: "Görseller", value: `${totalImgs} adet`, color: "var(--puw-blue)" },
                                            ].map(d => (
                                                <div key={d.label} className="puw-preview-detail-row">
                                                    <span className="puw-preview-detail-icon" style={{ color: d.color }}>{d.icon}</span>
                                                    <span className="puw-preview-detail-label">{d.label}</span>
                                                    <span className="puw-preview-detail-value" style={{ color: d.color }}>{d.value}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {uf.description && (
                                            <div className="puw-preview-desc">
                                                <div className="puw-preview-desc-label"><FaEdit style={{ fontSize: 10 }} /> Açıklama</div>
                                                <div className="puw-preview-desc-text">{uf.description}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sağ: Platform Seçimi & Özet */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                    <div className="puw-card">
                                        <div style={{ color: "var(--puw-text)", fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                            <FaRocket style={{ color: "var(--puw-purple)" }} /> Hedef Platformlar
                                        </div>
                                        {uploadableMarketplaces.length === 0 && marketplaces.length > 0 && (
                                            <div style={{ color: "var(--puw-yellow)", fontSize: 11, padding: "8px 10px", marginBottom: 8, borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)" }}>
                                                <FaInfoCircle style={{ marginRight: 6 }} />
                                                Bağlı hesaplarda ürün yüklemesi için Trendyol, Hepsiburada, N11 veya ÇiçekSepeti entegrasyonu gerekir (Amazon vb. bu sihirbazda dağıtılmaz).
                                            </div>
                                        )}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {uploadableMarketplaces.map(mp => {
                                                const sel = uf.targetMarketplaces.includes(mp.marketplaceName);
                                                const plColor = PL_COLOR[mp.marketplaceName] || "var(--puw-accent)";
                                                return (
                                                    <div key={mp._id} className={`puw-target-item ${sel ? "selected" : ""}`}
                                                        style={sel ? { background: plColor + "12", borderColor: plColor } : {}}
                                                        onClick={() => toggleTarget(mp.marketplaceName)}>
                                                        <span style={{ color: plColor, fontSize: 14 }}><FaStore /></span>
                                                        <span className="puw-target-name">{mp.marketplaceName}</span>
                                                        <span className="puw-target-check" style={sel ? { borderColor: plColor, background: plColor } : {}}>
                                                            {sel && <FaCheck />}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Durum Özeti */}
                                    <div className="puw-card puw-summary-card">
                                        <div className="puw-sugg-label" style={{ marginBottom: 8 }}>DURUM ÖZETİ</div>
                                        {[
                                            ["Ürün Adı", uf.name ? "✓" : "✗", uf.name ? "var(--puw-green)" : "var(--puw-red)"],
                                            ["Barkod", uf.barcode ? "✓" : "✗", uf.barcode ? "var(--puw-green)" : "var(--puw-red)"],
                                            ["SKU", uf.sku ? "✓" : "✗", uf.sku ? "var(--puw-green)" : "var(--puw-red)"],
                                            ["Fiyat", uf.price ? fmt(uf.price) : "✗", uf.price ? "var(--puw-green)" : "var(--puw-red)"],
                                            ["Görseller", totalImgs > 0 ? `${totalImgs} adet` : "Yok", totalImgs > 0 ? "var(--puw-green)" : "var(--puw-yellow)"],
                                            ["Açıklama", uf.description ? "✓" : "Yok", uf.description ? "var(--puw-green)" : "var(--puw-yellow)"],
                                            ["Platformlar", uf.targetMarketplaces.length > 0 ? `${uf.targetMarketplaces.length} seçili` : "Seçilmedi", uf.targetMarketplaces.length > 0 ? "var(--puw-green)" : "var(--puw-yellow)"],
                                        ].map(([k, v, c]) => (
                                            <div key={k} className="puw-summary-row">
                                                <span className="key">{k}</span>
                                                <span className="val" style={{ color: c }}>{v}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {!canSubmit && (
                                        <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
                                            <FaExclamationTriangle /> Ad, barkod, SKU ve fiyat zorunlu
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="puw-nav">
                                <button className="puw-btn muted" onClick={() => setStep(2)}><FaArrowLeft /> Geri</button>
                                <button className="puw-btn accent" onClick={() => setStep(4)} disabled={!canSubmit || !pricePositive}>
                                    Kategori Seçimi <FaArrowRight />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════
                        ADIM 4: KATEGORİ SEÇİMİ & GÖNDER
                        ═══════════════════════════════════════════ */}
                    {step === 4 && (
                        <div className="puw-step-content">
                            {/* Başarılı sonuç */}
                            {uploadResult?.success ? (
                                <div className="puw-card" style={{ textAlign: "center", padding: "2rem" }}>
                                    {uploadResult.distributeWarning ? (
                                        <>
                                            <FaExclamationTriangle style={{ fontSize: 48, color: "var(--puw-yellow)", marginBottom: 12 }} />
                                            <h2 style={{ color: "var(--puw-text)", fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Ürün kaydedildi — pazaryeri kısmen başarısız</h2>
                                        </>
                                    ) : (
                                        <>
                                            <FaCheckCircle style={{ fontSize: 48, color: "var(--puw-green)", marginBottom: 12 }} />
                                            <h2 style={{ color: "var(--puw-text)", fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Ürün Başarıyla Oluşturuldu!</h2>
                                        </>
                                    )}
                                    <p style={{ color: "var(--puw-text-dim)", fontSize: 12, marginBottom: 20 }}>{uploadResult.message}</p>
                                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                                        <button className="puw-btn accent" onClick={resetWizard}><FaPlus /> Yeni Ürün Ekle</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="puw-card">
                                        <div className="puw-card-header">
                                            <span className="icon"><FaSitemap /></span>
                                            <div>
                                                <div className="title">Platform Kategori Seçimi</div>
                                                <div className="subtitle">Her platform için ürün kategorisini arayarak veya ağaçtan seçin</div>
                                            </div>
                                        </div>

                                        {uf.targetMarketplaces.includes("N11") && n11ShipmentBlocked && (
                                            <div style={{ color: "var(--puw-red)", fontSize: 11, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", marginBottom: 14, borderRadius: 8, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
                                                <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                                                <span>
                                                    N11 için <strong>kargo şablon adı</strong> gerekir. Aşağıdaki alana N11 panelindeki şablon adını yazın veya pazaryeri entegrasyonunda <strong>Kargo Şablon Adı</strong> alanını doldurun (birebir aynı metin).
                                                </span>
                                            </div>
                                        )}
                                        {uf.targetMarketplaces.includes("N11") && (
                                            <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)" }}>
                                                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--puw-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <FaStore style={{ color: "#8b5cf6" }} /> N11 kargo şablonu
                                                </div>
                                                <label className="puw-field" style={{ display: "block", marginBottom: 6 }}>
                                                    <span style={{ fontSize: 11, color: "var(--puw-text-dim)", display: "block", marginBottom: 4 }}>Şablon adı (panel ile aynı)</span>
                                                    <input
                                                        className="puw-input"
                                                        type="text"
                                                        value={uf.n11ShipmentTemplate}
                                                        onChange={(e) => ufSet("n11ShipmentTemplate", e.target.value)}
                                                        placeholder="Örn: STANDART"
                                                        autoComplete="off"
                                                        disabled={uploadLoading}
                                                    />
                                                </label>
                                                <div style={{ fontSize: 10, color: "var(--puw-text-dim)", lineHeight: 1.45 }}>
                                                    Boş bırakırsanız entegrasyonda kayıtlı şablon kullanılır. Bu ürün için farklı bir şablon kullanacaksanız buraya yazın; ürün kaydına da işlenir.
                                                </div>
                                            </div>
                                        )}
                                            <div style={{ color: "var(--puw-text-dim)", fontSize: 11, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", marginBottom: 14, borderRadius: 8, border: "1px solid rgba(255,96,0,0.2)", background: "rgba(255,96,0,0.05)" }}>
                                                <FaInfoCircle style={{ flexShrink: 0, marginTop: 2 }} />
                                                <span>
                                                    Hepsiburada bu akışta stok/fiyat <strong>listing</strong> satırı gönderir; ürünün Hepsiburada kataloğunda tanımlı olması ve barkod/SKU eşleşmesi gerekir.
                                                </span>
                                            </div>
                                        )}

                                        {/* Seçili platformlar yoksa uyarı */}
                                        {integrationNames.length > 0 && uf.targetMarketplaces.length === 0 && (
                                            <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)", marginBottom: 14 }}>
                                                <FaInfoCircle /> En az bir hedef pazaryeri seçin (önceki adım). Bağlı hesabınız yoksa ürün yalnızca programda kaydedilir.
                                            </div>
                                        )}

                                        {/* Platform Kategori Panelleri */}
                                        <div className="puw-cat-panels-grid">
                                            {uf.targetMarketplaces.map(pName => (
                                                <PlatformCategoryPanel
                                                    key={pName}
                                                    platformName={pName}
                                                    ps={catState[pName] || {}}
                                                    onSearch={handleCatSearch}
                                                    onSelect={selectCategory}
                                                    onClear={clearCategory}
                                                    onToggle={toggleTreeNode}
                                                    onLoadTree={loadCategoryTree}
                                                />
                                            ))}
                                        </div>

                                        {uf.targetMarketplaces.includes("Trendyol") && (
                                            <div className="puw-card puw-ty-api-card">
                                                <div className="puw-card-header puw-ty-api-card__head">
                                                    <span className="icon puw-ty-api-card__icon"><FaStore /></span>
                                                    <div>
                                                        <div className="title puw-ty-api-card__title">Trendyol: Marka, kargo ve kategori özellikleri</div>
                                                    </div>
                                                </div>
                                                {!catState.Trendyol?.selected?.id ? (
                                                    <div className="puw-ty-api-banner puw-ty-api-banner--warn">
                                                        <FaInfoCircle />
                                                        <span>
                                                            Önce yukarıdan Trendyol için <strong>en alt seviye</strong> kategoriyi seçin; ardından zorunlu ürün özellikleri listelenir.
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="puw-grid-2 puw-ty-api-grid">
                                                            <div className="puw-field">
                                                                <label>Trendyol marka kodu</label>
                                                                <input
                                                                    className="puw-input"
                                                                    value={uf.trendyolBrandId}
                                                                    onChange={(e) => {
                                                                        const n = e.target.value.replace(/\D/g, "");
                                                                        ufSet("trendyolBrandId", n);
                                                                        tyBrandPickedRef.current = null;
                                                                    }}
                                                                    placeholder="Adım 1’de marka seçtiyseniz dolu gelir; yoksa 7651 (Diğer)"
                                                                />
                                                                {uf.brand.trim() && uf.trendyolBrandId.trim() && (
                                                                    <div className="puw-ty-api-field-note">
                                                                        Adım 1 marka adı: <strong>{uf.brand.trim()}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="puw-field">
                                                                <label>Kargo firması kodu</label>
                                                                <input
                                                                    className="puw-input"
                                                                    value={uf.trendyolCargoCompanyId}
                                                                    onChange={(e) => ufSet("trendyolCargoCompanyId", e.target.value.replace(/\D/g, ""))}
                                                                    placeholder="10"
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="puw-ty-api-hint">
                                                            Marka ve kargo kodlarını Trendyol Satıcı Paneli’nden kontrol edebilirsiniz. Adım 1&apos;de girdiğiniz <strong>KDV</strong> ve <strong>desi</strong> bilgileri de gönderime dahil edilir. Tablodaki alanlar seçtiğiniz kategoriye göre gelir.
                                                        </p>
                                                        {tyAttrState.loading && (
                                                            <div className="puw-ty-api-loading">
                                                                <FaSpinner className="puw-spin" /> Kategori özellikleri yükleniyor…
                                                            </div>
                                                        )}
                                                        {tyAttrState.error && !tyAttrState.loading && (
                                                            <div className="puw-ty-api-banner puw-ty-api-banner--err">
                                                                <FaExclamationTriangle />{tyAttrState.error}
                                                            </div>
                                                        )}
                                                        {!tyAttrState.loading && !tyAttrState.error && tyAttrState.rows.length === 0 && (
                                                            <div className="puw-ty-api-banner puw-ty-api-banner--warn">
                                                                Bu kategori için özellik listesi boş döndü — ara kategori seçmiş olabilirsiniz; ürün yüklemek için en alt seviye kategori seçin.
                                                            </div>
                                                        )}
                                                        {tyAttrState.rows.length > 0 && (
                                                            <div className="puw-ty-attr-wrap">
                                                                <div className="puw-ty-attr-wrap__title">
                                                                    Kategoriye özel ürün özellikleri
                                                                </div>
                                                                <div className="puw-ty-api-meta">
                                                                    <span><strong>{tyAttrStats.req}</strong> zorunlu</span>
                                                                    <span className="puw-ty-api-meta-sep">·</span>
                                                                    <span><strong>{tyAttrStats.opt}</strong> isteğe bağlı</span>
                                                                    <span className="puw-ty-api-meta-sep">·</span>
                                                                    <span>toplam <strong>{tyAttrStats.total}</strong> satır</span>
                                                                </div>
                                                                <p className="puw-ty-attr-wrap__hint">
                                                                    Zorunlu satırlar üstte ve turuncu çizgiyle işaretli. &quot;Otomatik&quot; uygun varsayılanı kullanır; net olması gereken yerlerde &quot;Listeden seç&quot; veya &quot;Özel metin&quot; kullanın.
                                                                </p>
                                                                <div className="puw-ty-attr-table-scroll">
                                                                    <table className="puw-ty-attr-table">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Özellik</th>
                                                                                <th>Zorunlu</th>
                                                                                <th>Özel / liste</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {trendyolAttrRowsSorted.map((row, ri) => {
                                                                                const attr = row.attribute || {};
                                                                                const aid = attr.id;
                                                                                const aname = attr.name || `#${aid}`;
                                                                                const sel = tySelections[String(aid)] || { mode: "auto" };
                                                                                const vals = row.attributeValues || [];
                                                                                const hasVals = vals.length > 0;
                                                                                return (
                                                                                    <tr
                                                                                        key={`ty-a-${aid}-${ri}`}
                                                                                        className={row.required ? "puw-ty-attr-row--required" : "puw-ty-attr-row--optional"}
                                                                                    >
                                                                                        <td title={aname}>{aname}</td>
                                                                                        <td>
                                                                                            {row.required ? (
                                                                                                <span className="puw-ty-attr-req">Evet</span>
                                                                                            ) : (
                                                                                                <span className="puw-ty-attr-opt">Hayır</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td>
                                                                                            <select
                                                                                                className="puw-input puw-ty-attr-select"
                                                                                                value={sel.mode || "auto"}
                                                                                                onChange={(e) => {
                                                                                                    const m = e.target.value;
                                                                                                    if (m === "auto") {
                                                                                                        setTySel(aid, { mode: "auto", valueId: undefined, customText: undefined });
                                                                                                    } else {
                                                                                                        setTySel(aid, { mode: m, valueId: undefined, customText: undefined });
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                <option value="auto">Otomatik (sistem önerisi)</option>
                                                                                                {hasVals && <option value="value">Listeden seç</option>}
                                                                                                {row.allowCustom && <option value="custom">Özel metin</option>}
                                                                                            </select>
                                                                                            {sel.mode === "value" && (
                                                                                                <select
                                                                                                    className="puw-input puw-ty-attr-select puw-ty-attr-nested"
                                                                                                    value={sel.valueId ?? ""}
                                                                                                    onChange={(e) => setTySel(aid, { valueId: e.target.value })}
                                                                                                >
                                                                                                    <option value="">— Değer seçin —</option>
                                                                                                    {vals.map((v) => (
                                                                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                                                                    ))}
                                                                                                </select>
                                                                                            )}
                                                                                            {sel.mode === "custom" && (
                                                                                                <input
                                                                                                    className="puw-input puw-ty-attr-custom-input"
                                                                                                    placeholder="Özel değer"
                                                                                                    value={sel.customText || ""}
                                                                                                    onChange={(e) => setTySel(aid, { customText: e.target.value })}
                                                                                                />
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Kategori eksik uyarısı */}
                                    {missingCategories.length > 0 && (
                                        <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
                                            <FaExclamationTriangle /> Dağıtım için kategori seçimi eksik: {missingCategories.join(", ")}
                                        </div>
                                    )}
                                    {uf.targetMarketplaces.includes("N11") && !n11TitleOk && (
                                        <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
                                            <FaExclamationTriangle /> N11: Ürün adı en az 15 karakter olmalı (Adım 1).
                                        </div>
                                    )}
                                    {uf.targetMarketplaces.includes("Trendyol") && !trendyolManualAttrsOk && tyAttrState.rows?.length > 0 && (
                                        <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
                                            <FaExclamationTriangle /> Trendyol: Manuel seçtiğiniz zorunlu özelliklerde değer eksik.
                                        </div>
                                    )}

                                    {/* Hata mesajı */}
                                    {uploadResult?.success === false && (
                                        <div style={{ color: "var(--puw-red)", fontSize: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(239,68,68,0.06)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                                            <FaTimesCircle /> {uploadResult.message}
                                        </div>
                                    )}

                                    {/* Gönder Butonu */}
                                    <div className="puw-nav">
                                        <button className="puw-btn muted" onClick={() => setStep(3)}><FaArrowLeft /> Geri</button>
                                        <button className="puw-btn accent puw-submit-btn" onClick={handleCreate} disabled={!canDistributeNow || uploadLoading}>
                                            {uploadLoading ? <span className="spinner" /> : uf.targetMarketplaces.length > 0 ? <FaRocket /> : <FaSave />}
                                            {uf.targetMarketplaces.length > 0 ? `Oluştur & ${uf.targetMarketplaces.length} Platforma Dağıt` : "Kaydet"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`puw-toast ${toast.type}`}
                        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}>
                        {toast.type === "error" ? <FaTimesCircle /> : <FaCheckCircle />} {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductUploadWizard;
