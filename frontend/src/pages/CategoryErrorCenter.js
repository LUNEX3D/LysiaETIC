/**
 * KATEGORİ HATA MERKEZİ — CategoryErrorCenter.js
 *
 * Ürün dağıtımında kategori hatası alan ürünleri yönetir:
 *   • Hata listesi (platform filtreli)
 *   • İlgili platformun gerçek kategorilerini açılır-kapanır ağaçta arama/seçme
 *   • Kategori seçimi → kaydet → tekrar gönder
 *
 * Akış:
 *   Ürün → Platform → Kategori Hatası → Bu Sayfa → Doğru Kategori Seç → Kaydet & Gönder
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    getCategoryErrors,
    getCategoryErrorStats,
    searchPlatformCategories,
    resolveCategoryError,
    retryCategoryError,
    deleteCategoryError,
    clearResolvedErrors
} from "../services/categoryErrorApi";

/* ═══════════════════════════════════════════════════════════════════════════
   RENKLER & SABİTLER
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
    bg: "#0f1117", surface: "#1a1f2e", card: "#1a1f2e", cardHover: "#1e2438",
    border: "rgba(255,255,255,0.07)", borderHover: "rgba(99,102,241,0.4)",
    accent: "#6366f1", accentSoft: "rgba(99,102,241,0.12)",
    teal: "#0f766e", tealSoft: "rgba(15,118,110,0.12)",
    green: "#22c55e", greenSoft: "rgba(34,197,94,0.10)",
    yellow: "#f59e0b", yellowSoft: "rgba(245,158,11,0.10)",
    red: "#ef4444", redSoft: "rgba(239,68,68,0.10)",
    blue: "#3b82f6", blueSoft: "rgba(59,130,246,0.10)",
    purple: "#a855f7", purpleSoft: "rgba(168,85,247,0.10)",
    orange: "#f97316", orangeSoft: "rgba(249,115,22,0.10)",
    pink: "#ec4899",
    text: "#e2e8f0", textSub: "#94a3b8", textDim: "#64748b",
};

const MP_COLORS = { Trendyol: "#f97316", Hepsiburada: "#22c55e", N11: "#a855f7", Amazon: "#f59e0b", "ÇiçekSepeti": "#ec4899" };
const MP_ICONS  = { Trendyol: "🟠", Hepsiburada: "🟢", N11: "🟣", Amazon: "🟡", "ÇiçekSepeti": "🌸" };
const PLATFORMS = ["Trendyol", "N11", "ÇiçekSepeti", "Hepsiburada", "Amazon"];

const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/* ═══════════════════════════════════════════════════════════════════════════
   MİNİ BİLEŞENLER
   ═══════════════════════════════════════════════════════════════════════════ */
const Badge = ({ color, children, style }) => (
    <span style={{
        background: color + "18", color, border: `1px solid ${color}30`,
        borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700,
        whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, ...style
    }}>{children}</span>
);

const Btn = ({ onClick, color = C.accent, outline, disabled, loading, small, children, style = {} }) => (
    <button onClick={onClick} disabled={disabled || loading}
        style={{
            background: outline ? "transparent" : color,
            color: outline ? color : "#fff",
            border: `1.5px solid ${color}`, borderRadius: 8,
            padding: small ? "5px 12px" : "8px 18px",
            fontSize: small ? 11 : 12, fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            display: "inline-flex", alignItems: "center", gap: 6,
            transition: "all .15s", ...style
        }}>
        {loading && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
        {children}
    </button>
);

const Card = ({ children, style = {} }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", ...style }}>{children}</div>
);

const Spinner = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", color: C.textDim, gap: 8 }}>
        <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid ${C.accent}30`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        Yükleniyor...
    </div>
);

const Empty = ({ icon = "📭", title, desc }) => (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.textDim }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>{title}</div>
        {desc && <div style={{ fontSize: 12 }}>{desc}</div>}
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   KATEGORİ AĞACI BİLEŞENİ — Açılır-Kapanır + Arama
   ═══════════════════════════════════════════════════════════════════════════ */
const CategoryTreeBrowser = ({ marketplace, onSelect, selectedId }) => {
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [treeNodes, setTreeNodes] = useState({}); // { [parentId]: categories[] }
    const [expanded, setExpanded] = useState(new Set());
    const [loadingNode, setLoadingNode] = useState("");
    const [rootsLoaded, setRootsLoaded] = useState(false);
    const searchTimer = useRef(null);

    // Root kategorileri yükle
    useEffect(() => {
        if (!marketplace) return;
        setTreeNodes({});
        setExpanded(new Set());
        setRootsLoaded(false);
        setSearch("");
        setSearchResults([]);

        (async () => {
            setLoadingNode("root");
            try {
                const res = await searchPlatformCategories(marketplace, {});
                setTreeNodes({ root: res.categories || [] });
                setRootsLoaded(true);
            } catch { /* ignore */ }
            finally { setLoadingNode(""); }
        })();
    }, [marketplace]);

    // Arama
    const handleSearch = (q) => {
        setSearch(q);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!q.trim()) { setSearchResults([]); return; }
        searchTimer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await searchPlatformCategories(marketplace, { search: q.trim() });
                setSearchResults(res.categories || []);
            } catch { setSearchResults([]); }
            finally { setSearchLoading(false); }
        }, 400);
    };

    // Node aç/kapa
    const toggleNode = async (nodeId) => {
        const newExp = new Set(expanded);
        if (newExp.has(nodeId)) {
            newExp.delete(nodeId);
            setExpanded(newExp);
            return;
        }
        newExp.add(nodeId);
        setExpanded(newExp);

        // Child'ları yükle (henüz yüklenmemişse)
        if (!treeNodes[nodeId]) {
            setLoadingNode(nodeId);
            try {
                const res = await searchPlatformCategories(marketplace, { parentId: nodeId });
                setTreeNodes(prev => ({ ...prev, [nodeId]: res.categories || [] }));
            } catch { /* ignore */ }
            finally { setLoadingNode(""); }
        }
    };

    // Ağaç node render
    const renderNode = (cat, depth = 0) => {
        const isExp = expanded.has(cat.id);
        const isSelected = selectedId === cat.id;
        const children = treeNodes[cat.id] || [];
        const isLoading = loadingNode === cat.id;

        return (
            <div key={cat.id}>
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 10px", paddingLeft: 10 + depth * 20,
                        borderRadius: 8, cursor: "pointer",
                        background: isSelected ? C.accentSoft : "transparent",
                        border: isSelected ? `1px solid ${C.accent}40` : "1px solid transparent",
                        transition: "all .15s",
                        fontSize: 13, color: isSelected ? C.accent : C.text,
                    }}
                    onClick={() => {
                        if (cat.hasChildren) toggleNode(cat.id);
                        onSelect(cat);
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.cardHover; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                    {/* Expand/Collapse icon */}
                    {cat.hasChildren ? (
                        <span style={{
                            display: "inline-flex", width: 18, height: 18, alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: C.textDim, transition: "transform .2s",
                            transform: isExp ? "rotate(90deg)" : "rotate(0deg)"
                        }}>▶</span>
                    ) : (
                        <span style={{ width: 18, display: "inline-block" }} />
                    )}

                    {/* Leaf icon */}
                    <span style={{ fontSize: 13 }}>{cat.isLeaf ? "📄" : "📁"}</span>

                    {/* Name */}
                    <span style={{ flex: 1, fontWeight: isSelected ? 700 : 400 }}>{cat.name}</span>

                    {/* Leaf badge */}
                    {cat.isLeaf && (
                        <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 4,
                            background: C.greenSoft, color: C.green, fontWeight: 700
                        }}>LEAF</span>
                    )}

                    {isLoading && (
                        <span style={{
                            display: "inline-block", width: 12, height: 12,
                            border: `2px solid ${C.accent}30`, borderTop: `2px solid ${C.accent}`,
                            borderRadius: "50%", animation: "spin .7s linear infinite"
                        }} />
                    )}
                </div>

                {/* Children */}
                {isExp && children.length > 0 && (
                    <div>{children.map(child => renderNode(child, depth + 1))}</div>
                )}
            </div>
        );
    };

    const mpColor = MP_COLORS[marketplace] || C.accent;

    return (
        <div style={{ border: `1px solid ${mpColor}30`, borderRadius: 12, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
                background: `linear-gradient(135deg, ${mpColor}15, ${mpColor}08)`,
                padding: "12px 16px", borderBottom: `1px solid ${mpColor}20`,
                display: "flex", alignItems: "center", gap: 8
            }}>
                <span style={{ fontSize: 18 }}>{MP_ICONS[marketplace] || "📁"}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: mpColor }}>{marketplace} Kategorileri</span>
            </div>

            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
                <input
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder={`${marketplace} kategorilerinde ara...`}
                    style={{
                        width: "100%", background: C.bg, border: `1.5px solid ${C.border}`,
                        borderRadius: 8, color: C.text, padding: "9px 14px", fontSize: 13,
                        outline: "none", transition: "border .2s", boxSizing: "border-box"
                    }}
                    onFocus={e => { e.target.style.borderColor = mpColor + "60"; }}
                    onBlur={e => { e.target.style.borderColor = C.border; }}
                />
            </div>

            {/* Content */}
            <div style={{ maxHeight: 400, overflowY: "auto", padding: "6px" }}>
                {search.trim() ? (
                    // Arama sonuçları
                    searchLoading ? <Spinner /> :
                    searchResults.length === 0 ? (
                        <Empty icon="🔍" title="Sonuç bulunamadı" desc={`"${search}" ile eşleşen kategori yok`} />
                    ) : (
                        searchResults.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => onSelect(cat)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                                    background: selectedId === cat.id ? C.accentSoft : "transparent",
                                    border: selectedId === cat.id ? `1px solid ${C.accent}40` : "1px solid transparent",
                                    transition: "all .15s", fontSize: 13, color: C.text,
                                }}
                                onMouseEnter={e => { if (selectedId !== cat.id) e.currentTarget.style.background = C.cardHover; }}
                                onMouseLeave={e => { if (selectedId !== cat.id) e.currentTarget.style.background = "transparent"; }}
                            >
                                <span>{cat.isLeaf ? "📄" : "📁"}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: selectedId === cat.id ? 700 : 500 }}>{cat.name}</div>
                                    {cat.path && cat.path !== cat.name && (
                                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{cat.path}</div>
                                    )}
                                </div>
                                {cat.isLeaf && (
                                    <span style={{
                                        fontSize: 9, padding: "1px 6px", borderRadius: 4,
                                        background: C.greenSoft, color: C.green, fontWeight: 700
                                    }}>LEAF</span>
                                )}
                            </div>
                        ))
                    )
                ) : (
                    // Ağaç görünümü
                    loadingNode === "root" ? <Spinner /> :
                    !rootsLoaded ? <Empty icon="📁" title="Kategoriler yükleniyor..." /> :
                    (treeNodes.root || []).length === 0 ? (
                        <Empty icon="📭" title="Kategori bulunamadı" desc={`${marketplace} için kategori verisi yok`} />
                    ) : (
                        (treeNodes.root || []).map(cat => renderNode(cat, 0))
                    )
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   HATA ÇÖZÜMLEME MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const ResolveModal = ({ error, onClose, onResolved }) => {
    const [selectedCat, setSelectedCat] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    if (!error) return null;

    const handleResolve = async () => {
        if (!selectedCat) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await resolveCategoryError({
                errorId: error._id,
                categoryId: selectedCat.id,
                categoryName: selectedCat.name,
                categoryPath: selectedCat.path || selectedCat.name,
                autoRetry: true
            });
            setResult(res);
            if (res.success) {
                setTimeout(() => { onResolved(); onClose(); }, 1500);
            }
        } catch (err) {
            setResult({ success: false, message: err.response?.data?.error || err.message });
        } finally { setLoading(false); }
    };

    const mpColor = MP_COLORS[error.marketplace] || C.accent;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20
        }} onClick={onClose}>
            <div style={{
                background: C.surface, borderRadius: 18, width: "100%", maxWidth: 800,
                maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
                border: `1px solid ${C.border}`, boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", gap: 12
                }}>
                    <span style={{ fontSize: 24 }}>🔧</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Kategori Eşleştir & Gönder</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                            Doğru kategoriyi seçin, kaydedin ve ürünü tekrar gönderin
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: "transparent", border: "none", color: C.textDim,
                        fontSize: 20, cursor: "pointer", padding: 4
                    }}>✕</button>
                </div>

                {/* Product Info */}
                <div style={{
                    padding: "16px 24px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", gap: 14, background: C.bg
                }}>
                    {error.productImage ? (
                        <img src={error.productImage} alt="" style={{
                            width: 50, height: 50, borderRadius: 8, objectFit: "cover",
                            border: `1px solid ${C.border}`
                        }} />
                    ) : (
                        <div style={{
                            width: 50, height: 50, borderRadius: 8, background: C.card,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20, border: `1px solid ${C.border}`
                        }}>📦</div>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{error.productName}</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                            {error.productBarcode && <span>Barkod: {error.productBarcode}</span>}
                            {error.productSku && <span style={{ marginLeft: 12 }}>SKU: {error.productSku}</span>}
                        </div>
                        {error.productCategory && (
                            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                                Mevcut Kategori: <span style={{ color: C.yellow }}>{error.productCategory}</span>
                            </div>
                        )}
                    </div>
                    <Badge color={mpColor}>{MP_ICONS[error.marketplace]} {error.marketplace}</Badge>
                </div>

                {/* Error Message */}
                <div style={{
                    padding: "10px 24px", background: C.redSoft,
                    borderBottom: `1px solid ${C.red}20`,
                    fontSize: 12, color: C.red, display: "flex", alignItems: "center", gap: 8
                }}>
                    <span>⚠️</span>
                    <span style={{ flex: 1 }}>{error.errorMessage}</span>
                    <Badge color={C.red} style={{ fontSize: 10 }}>×{error.hitCount}</Badge>
                </div>

                {/* Category Tree Browser */}
                <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
                    <CategoryTreeBrowser
                        marketplace={error.marketplace}
                        onSelect={setSelectedCat}
                        selectedId={selectedCat?.id}
                    />
                </div>

                {/* Selected Category + Actions */}
                <div style={{
                    padding: "16px 24px", borderTop: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", gap: 12, background: C.bg
                }}>
                    {selectedCat ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.textDim }}>Seçilen:</span>
                            <Badge color={C.green}>
                                📄 {selectedCat.name}
                            </Badge>
                            {selectedCat.path && selectedCat.path !== selectedCat.name && (
                                <span style={{ fontSize: 10, color: C.textDim }}>{selectedCat.path}</span>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1, fontSize: 12, color: C.textDim }}>
                            ↑ Yukarıdan bir kategori seçin
                        </div>
                    )}

                    {result && (
                        <Badge color={result.success ? C.green : C.red}>
                            {result.success ? "✅ Başarılı" : "❌ " + (result.message || "Hata")}
                        </Badge>
                    )}

                    <Btn color={C.accent} outline onClick={onClose} small>İptal</Btn>
                    <Btn
                        color={C.green}
                        disabled={!selectedCat}
                        loading={loading}
                        onClick={handleResolve}
                    >
                        ✅ Kaydet & Gönder
                    </Btn>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════════════════ */
const CategoryErrorCenter = () => {
    const [errors, setErrors] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalUnresolved, setTotalUnresolved] = useState(0);
    const [platformSummary, setPlatformSummary] = useState({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [filterPlatform, setFilterPlatform] = useState("");
    const [filterResolved, setFilterResolved] = useState("false");
    const [resolveTarget, setResolveTarget] = useState(null); // error object for modal
    const [actionLoading, setActionLoading] = useState("");
    const [toast, setToast] = useState(null);

    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // Hataları yükle
    const loadErrors = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = { page: p, limit: 30 };
            if (filterPlatform) params.marketplace = filterPlatform;
            if (filterResolved) params.resolved = filterResolved;
            const res = await getCategoryErrors(params);
            setErrors(res.errors || []);
            setTotal(res.total || 0);
            setTotalUnresolved(res.totalUnresolved || 0);
            setPlatformSummary(res.platformSummary || {});
            setPage(res.page || 1);
            setTotalPages(res.totalPages || 1);
        } catch { showToast("Hatalar yüklenemedi", "error"); }
        finally { setLoading(false); }
    }, [filterPlatform, filterResolved, showToast]);

    // İstatistikleri yükle
    const loadStats = useCallback(async () => {
        try {
            const res = await getCategoryErrorStats();
            setStats(res.stats || null);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadErrors(1); loadStats(); }, [filterPlatform, filterResolved]); // eslint-disable-line

    // Tekrar gönder
    const handleRetry = async (errorId) => {
        setActionLoading(`retry-${errorId}`);
        try {
            const res = await retryCategoryError(errorId);
            if (res.success) {
                showToast("Ürün başarıyla gönderildi ✅");
            } else {
                showToast(res.message || "Gönderim başarısız", "error");
            }
            loadErrors(page);
        } catch (e) {
            showToast(e.response?.data?.error || "Tekrar gönderim hatası", "error");
        } finally { setActionLoading(""); }
    };

    // Sil
    const handleDelete = async (id) => {
        setActionLoading(`del-${id}`);
        try {
            await deleteCategoryError(id);
            showToast("Kayıt silindi");
            loadErrors(page);
            loadStats();
        } catch { showToast("Silinemedi", "error"); }
        finally { setActionLoading(""); }
    };

    // Çözülmüşleri temizle
    const handleClearResolved = async () => {
        setActionLoading("clear");
        try {
            const res = await clearResolvedErrors();
            showToast(res.message || "Temizlendi");
            loadErrors(page);
            loadStats();
        } catch { showToast("Temizleme hatası", "error"); }
        finally { setActionLoading(""); }
    };

    const st = stats || {};

    return (
        <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "24px 0" }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 10000,
                    background: toast.type === "error" ? C.red : C.green,
                    color: "#fff", padding: "12px 20px", borderRadius: 10,
                    fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    animation: "slideIn .3s ease"
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                    <span style={{ fontSize: 32 }}>⚠️</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>
                            Kategori Hata Merkezi
                        </h1>
                        <p style={{ margin: 0, fontSize: 13, color: C.textDim }}>
                            Ürün dağıtımında kategori hatası alan ürünleri düzeltin ve tekrar gönderin
                        </p>
                    </div>
                    <div style={{ flex: 1 }} />
                    {(st.resolved || 0) > 0 && (
                        <Btn color={C.textDim} outline small
                            loading={actionLoading === "clear"}
                            onClick={handleClearResolved}>
                            🗑️ Çözülmüşleri Temizle ({st.resolved})
                        </Btn>
                    )}
                </div>

                {/* Stats Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                    <Card style={{ background: `linear-gradient(135deg, ${C.red}08, ${C.red}04)`, borderColor: `${C.red}20` }}>
                        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Çözülmemiş</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{totalUnresolved}</div>
                    </Card>
                    <Card style={{ background: `linear-gradient(135deg, ${C.green}08, ${C.green}04)`, borderColor: `${C.green}20` }}>
                        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Çözülmüş</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{st.resolved || 0}</div>
                    </Card>
                    {PLATFORMS.map(pl => {
                        const cnt = platformSummary[pl] || 0;
                        if (cnt === 0 && !filterPlatform) return null;
                        return (
                            <Card key={pl} style={{
                                background: `linear-gradient(135deg, ${MP_COLORS[pl]}08, ${MP_COLORS[pl]}04)`,
                                borderColor: `${MP_COLORS[pl]}20`,
                                cursor: "pointer",
                                outline: filterPlatform === pl ? `2px solid ${MP_COLORS[pl]}` : "none"
                            }} onClick={() => setFilterPlatform(filterPlatform === pl ? "" : pl)}>
                                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>
                                    {MP_ICONS[pl]} {pl}
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: MP_COLORS[pl] }}>{cnt}</div>
                            </Card>
                        );
                    })}
                </div>

                {/* Filters */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <select
                        value={filterPlatform}
                        onChange={e => setFilterPlatform(e.target.value)}
                        style={{
                            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 8,
                            color: C.text, padding: "8px 14px", fontSize: 13, outline: "none"
                        }}
                    >
                        <option value="">Tüm Platformlar</option>
                        {PLATFORMS.map(pl => <option key={pl} value={pl}>{MP_ICONS[pl]} {pl}</option>)}
                    </select>

                    <select
                        value={filterResolved}
                        onChange={e => setFilterResolved(e.target.value)}
                        style={{
                            background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 8,
                            color: C.text, padding: "8px 14px", fontSize: 13, outline: "none"
                        }}
                    >
                        <option value="false">Çözülmemiş</option>
                        <option value="true">Çözülmüş</option>
                        <option value="">Tümü</option>
                    </select>

                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: C.textDim }}>
                        {total} kayıt ({page}/{totalPages})
                    </span>
                </div>

                {/* Error List */}
                {loading ? <Spinner /> :
                errors.length === 0 ? (
                    <Card>
                        <Empty
                            icon={filterResolved === "false" ? "🎉" : "📭"}
                            title={filterResolved === "false" ? "Kategori hatası yok!" : "Kayıt bulunamadı"}
                            desc={filterResolved === "false"
                                ? "Tüm ürünler başarıyla dağıtılmış"
                                : "Filtre kriterlerine uygun kayıt yok"}
                        />
                    </Card>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {errors.map(err => {
                            const mpColor = MP_COLORS[err.marketplace] || C.accent;
                            const isRetrying = actionLoading === `retry-${err._id}`;
                            const isDeleting = actionLoading === `del-${err._id}`;

                            return (
                                <Card key={err._id} style={{
                                    borderLeft: `4px solid ${err.isResolved ? C.green : mpColor}`,
                                    transition: "all .2s"
                                }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                        {/* Product Image */}
                                        {err.productImage ? (
                                            <img src={err.productImage} alt="" style={{
                                                width: 48, height: 48, borderRadius: 8, objectFit: "cover",
                                                border: `1px solid ${C.border}`, flexShrink: 0
                                            }} />
                                        ) : (
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 8, background: C.bg,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 20, border: `1px solid ${C.border}`, flexShrink: 0
                                            }}>📦</div>
                                        )}

                                        {/* Product Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                                                    {err.productName}
                                                </span>
                                                <Badge color={mpColor}>{MP_ICONS[err.marketplace]} {err.marketplace}</Badge>
                                                {err.isResolved && <Badge color={C.green}>✅ Çözüldü</Badge>}
                                                {err.retryStatus === "success" && <Badge color={C.green}>🚀 Gönderildi</Badge>}
                                                {err.retryStatus === "failed" && <Badge color={C.red}>❌ Gönderim Başarısız</Badge>}
                                                {err.hitCount > 1 && <Badge color={C.yellow}>×{err.hitCount}</Badge>}
                                            </div>

                                            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                                                {err.productBarcode && <span>Barkod: {err.productBarcode}</span>}
                                                {err.productSku && <span>SKU: {err.productSku}</span>}
                                                {err.productCategory && <span>Kategori: <span style={{ color: C.yellow }}>{err.productCategory}</span></span>}
                                            </div>

                                            {/* Error message */}
                                            <div style={{
                                                marginTop: 8, padding: "6px 10px", borderRadius: 6,
                                                background: C.redSoft, fontSize: 11, color: C.red,
                                                lineHeight: 1.5, wordBreak: "break-word"
                                            }}>
                                                ⚠️ {err.errorMessage}
                                            </div>

                                            {/* Resolved info */}
                                            {err.resolvedCategoryName && (
                                                <div style={{
                                                    marginTop: 6, padding: "6px 10px", borderRadius: 6,
                                                    background: C.greenSoft, fontSize: 11, color: C.green,
                                                }}>
                                                    ✅ Seçilen: {err.resolvedCategoryName}
                                                    {err.resolvedCategoryPath && err.resolvedCategoryPath !== err.resolvedCategoryName && (
                                                        <span style={{ color: C.textDim, marginLeft: 8 }}>({err.resolvedCategoryPath})</span>
                                                    )}
                                                </div>
                                            )}

                                            <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>
                                                İlk tespit: {fmtDate(err.detectedAt)} • Son: {fmtDate(err.lastSeenAt)}
                                                {err.retryAt && <span> • Gönderim: {fmtDate(err.retryAt)}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                                            {!err.isResolved && (
                                                <Btn color={C.accent} small onClick={() => setResolveTarget(err)}>
                                                    🔧 Düzelt
                                                </Btn>
                                            )}
                                            {err.isResolved && err.retryStatus !== "success" && (
                                                <Btn color={C.green} small loading={isRetrying}
                                                    onClick={() => handleRetry(err._id)}>
                                                    🚀 Tekrar Gönder
                                                </Btn>
                                            )}
                                            <Btn color={C.red} outline small loading={isDeleting}
                                                onClick={() => handleDelete(err._id)}>
                                                🗑️
                                            </Btn>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                        <Btn color={C.accent} outline small disabled={page <= 1}
                            onClick={() => loadErrors(page - 1)}>
                            ◀ Önceki
                        </Btn>
                        <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: C.textSub }}>
                            {page} / {totalPages}
                        </span>
                        <Btn color={C.accent} outline small disabled={page >= totalPages}
                            onClick={() => loadErrors(page + 1)}>
                            Sonraki ▶
                        </Btn>
                    </div>
                )}
            </div>

            {/* Resolve Modal */}
            <ResolveModal
                error={resolveTarget}
                onClose={() => setResolveTarget(null)}
                onResolved={() => { loadErrors(page); loadStats(); }}
            />

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>
        </div>
    );
};

export default CategoryErrorCenter;
