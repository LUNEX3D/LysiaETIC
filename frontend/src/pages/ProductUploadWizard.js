/**
 * ÜRÜN YÜKLE & DAĞIT — ProductUploadWizard.js
 *
 * Bağımsız sayfa (sidebar'dan erişilir):
 *   Adım 1: Temel Bilgiler (ad, barkod, SKU, fiyat, stok, marka)
 *   Adım 2: Görseller & Açıklama
 *   Adım 3: Ön İzleme
 *   Adım 4: Platform Kategori Seçimi (ağaç + arama) & Gönder
 */

import React, { useState, useEffect, useCallback, useRef, memo } from "react";
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
    createAndDistribute, suggestCodes, generateDescription, uploadProductImage
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import { getCategoryTree, searchCategories } from "../services/categoryCenterApi";
import "../styles/ProductUploadWizard.css";

/* ═══════════════════════════════════════════════════════════════
   SABİTLER
   ═══════════════════════════════════════════════════════════════ */
const PLATFORMS = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];
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

    return (
        <div>
            <div
                className={`puw-tree-node ${isSelected ? "selected" : ""} ${isLeaf ? "leaf" : ""}`}
                style={{ paddingLeft: 12 + depth * 20 }}
                onClick={() => {
                    if (hasChildren) onToggle(platformName, nodeId);
                    onSelect(platformName, {
                        id: nodeId,
                        name: nodeName,
                        path: node.path || node.fullPath || nodeName,
                        categoryId: nodeId,
                        categoryName: nodeName
                    });
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
                        const selectable = cId !== "" && cId !== "0";
                        const cName = c.name || c.categoryName || "";
                        const cPath = c.path || c.fullPath || "";
                        const isSel = selected?.id === cId;
                        return (
                            <div
                                key={`${platformName}-sr-${cId || i}`}
                                className={`puw-cat-result-item ${isSel ? "selected" : ""}`}
                                onClick={() => selectable && onSelect(platformName, { id: cId, name: cName, path: cPath })}
                                style={selectable ? {} : { opacity: 0.6, cursor: "not-allowed" }}
                                title={selectable ? "Kategoriyi seç" : "Bu sonuçta geçerli categoryId yok"}
                            >
                                <FaTag style={{ fontSize: 10, color: isSel ? "var(--puw-green)" : "var(--puw-text-dim)", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--puw-text)" }}>{cName}</div>
                                    {cPath && <div style={{ fontSize: 9, color: "var(--puw-text-dim)", marginTop: 1 }}>{cPath}</div>}
                                    {!selectable && <div style={{ fontSize: 9, color: "var(--puw-yellow)", marginTop: 1 }}>Bu kayıtta categoryId yok</div>}
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
        brand: "", imageUrls: [], targetMarketplaces: []
    });

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

    const ufSet = (k, v) => setUf(p => ({ ...p, [k]: v }));

    // ── Load Marketplaces ──
    useEffect(() => {
        getUserMarketplaces()
            .then(d => setMarketplaces((d || []).map(m => ({ ...m, name: m.marketplaceName }))))
            .catch(() => { setMarketplaces([]); });
    }, [userId]);

    /* ═══════════════════════════════════════════════════════════
       ADIM 1: TEMEL BİLGİLER — Handlers
       ═══════════════════════════════════════════════════════════ */
    const handleSuggestCodes = async () => {
        if (!uf.name.trim()) return showToast("Önce ürün adı girin", "error");
        setCodeLoading(true);
        try {
            const r = await suggestCodes(uf.name.trim(), uf.brand, "");
            setCodeSugg(r.suggestions);
        } catch { showToast("Ööneri alınamadı", "error"); }
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
                showToast("Bazi gorseller yuklenemedi", "error");
            }
        } catch (err) {
            showToast(err?.response?.data?.error || "Gorsel yukleme hatasi", "error");
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
                const r = await searchCategories(platformName, query.trim());
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
                    path: cat.path || cat.fullPath || cat.name || ""
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
        const activePlatforms = uf.targetMarketplaces.length > 0
            ? uf.targetMarketplaces
            : marketplaces.map(m => m.marketplaceName);

        activePlatforms.forEach(pName => {
            if (!catState[pName]?.tree?.length && !catState[pName]?.loading) {
                loadCategoryTree(pName);
            }
        });
    }, [step, uf.targetMarketplaces, marketplaces, catState, loadCategoryTree]);

    /* ═══════════════════════════════════════════════════════════
       ÜRÜN OLUŞTUR & DAĞIT
       ═══════════════════════════════════════════════════════════ */
    const handleCreate = async () => {
        if (!uf.name || !uf.barcode || !uf.sku || !uf.price) return showToast("Ad, barkod, SKU ve fiyat zorunlu", "error");
        setUploadLoading(true);
        setUploadResult(null);
        try {
            const remoteUrls = [...uf.imageUrls]
                .map((u) => (typeof u === "string" ? u.trim() : ""))
                .filter((u) => /^https?:\/\//i.test(u));
            const hasOnlyLocalFiles = remoteUrls.length === 0 && imgFiles.length > 0;
            if (hasOnlyLocalFiles && uf.targetMarketplaces.length > 0) {
                return showToast(
                    "Yerel dosya görselleri pazaryerine gönderilemez. Lütfen Adım 2'de en az 1 İadet https:// görsel URL ekleyin.",
                    "error"
                );
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
                        return showToast(
                            `${pName} için seçilen kategori geçersiz (categoryId yok). Lütfen ağaçtan başka bir kategori seçin.`,
                            "error"
                        );
                    }
                    platformCategories[pName] = {
                        categoryId: selectedId,
                        categoryName: cs.selected.name,
                        categoryPath: cs.selected.path
                    };
                }
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
                platformCategories
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
            } else if (partialFail) {
                setUploadResult({ success: true, message: msg, distributeWarning: true });
                showToast(msg, "error");
            } else {
                setUploadResult({ success: true, message: msg });
                showToast(msg);
            }
        } catch (e) {
            const errData = e.response?.data;
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
        setUf({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "0", brand: "", imageUrls: [], targetMarketplaces: [] });
        setImgFiles([]); setCodeSugg(null); setCatState({}); setStep(1); setUploadResult(null);
    };

    const toggleTarget = (p) => setUf(prev => {
        const t = [...prev.targetMarketplaces];
        const i = t.indexOf(p);
        if (i >= 0) t.splice(i, 1); else t.push(p);
        return { ...prev, targetMarketplaces: t };
    });

    /* ═══════════════════════════════════════════════════════════
       COMPUTED
       ═══════════════════════════════════════════════════════════ */
    const totalImgs = uf.imageUrls.length + imgFiles.length;
    const canSubmit = uf.name && uf.barcode && uf.sku && uf.price;
    const selectedPlatforms = uf.targetMarketplaces.length > 0 ? uf.targetMarketplaces : [];
    const missingCategories = selectedPlatforms.filter((pName) => !catState[pName]?.selected);
    const canDistributeNow = canSubmit && (selectedPlatforms.length === 0 || missingCategories.length === 0);
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
                        <p>Ürün bilgilerini girin, ön izleyin, platform kategorilerini seçin ve bağlı pazaryerlerinize gönderin.</p>
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
                                        <label><FaBox style={{ fontSize: 10 }} /> Ürün Adı <span className="required">*</span></label>
                                        <input value={uf.name} onChange={e => ufSet("name", e.target.value)} placeholder="Ürün başlığı..." />
                                    </div>
                                    <div className="puw-field">
                                        <label><FaTag style={{ fontSize: 10 }} /> Marka</label>
                                        <input value={uf.brand} onChange={e => ufSet("brand", e.target.value)} placeholder="Marka" />
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
                                                { icon: <FaTag />, label: "SKU", value: uf.sku || "—", color: "var(--puw-purple)" },
                                                { icon: <FaWarehouse />, label: "Stok", value: uf.stock || "0", color: "var(--puw-green)" },
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
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {marketplaces.map(mp => {
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
                                            ["Görseller", totalImgs > 0 ? `${totalImgs} İadet` : "Yok", totalImgs > 0 ? "var(--puw-green)" : "var(--puw-yellow)"],
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
                                <button className="puw-btn accent" onClick={() => setStep(4)} disabled={!canSubmit}>
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

                                        {/* Seçili platformlar yoksa uyarı */}
                                        {uf.targetMarketplaces.length === 0 && (
                                            <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)", marginBottom: 14 }}>
                                                <FaInfoCircle /> Henüz platform seçmediniz. Önceki adımdan platform seçebilir veya aşağıdan sadece kayıt oluşturabilirsiniz.
                                            </div>
                                        )}

                                        {/* Platform Kategori Panelleri */}
                                        <div className="puw-cat-panels-grid">
                                            {(uf.targetMarketplaces.length > 0 ? uf.targetMarketplaces : marketplaces.map(m => m.marketplaceName)).map(pName => (
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
                                    </div>

                                    {/* Kategori eksik uyarısı */}
                                    {missingCategories.length > 0 && (
                                        <div style={{ color: "var(--puw-yellow)", fontSize: 11, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
                                            <FaExclamationTriangle /> Dağıtım için kategori seçimi eksik: {missingCategories.join(", ")}
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
