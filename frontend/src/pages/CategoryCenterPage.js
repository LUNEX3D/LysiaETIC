/**
 * CategoryCenterPage — LysiaETIC
 *
 * Kategori Merkezi: Excel şablonuna benzer tablo düzeni.
 * Master (Trendyol) kategorileri satırlarda, diğer pazaryerleri sütunlarda.
 * Eşleştirilmiş kategoriler gösterilir + canlı API'den kategori seçimi yapılabilir.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useApp } from "../context/AppContext";
import {
    getMappings, getMappingStats, updateMapping, exportMappingsExcel,
    getMarketplaces, searchCategories
} from "../services/categoryCenterApi";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaSitemap, FaSearch, FaTimes, FaCheck, FaSpinner,
    FaExclamationTriangle, FaSave, FaChevronLeft, FaChevronRight,
    FaEdit, FaTable, FaChartBar, FaFileExcel, FaDownload
} from "react-icons/fa";

// ═══════════════════════════════════════════════════════════════
// 🎨 Platform Konfigürasyonu
// ═══════════════════════════════════════════════════════════════
const PLATFORMS = [
    { key: "trendyol",    label: "Trendyol",     icon: "🟠", color: "#F27A1A", idField: "trendyolId",    pathField: "trendyolPath" },
    { key: "n11",         label: "N11",           icon: "🟣", color: "#7B2D8E", idField: "n11Id",         pathField: "n11Path" },
    { key: "ciceksepeti", label: "ÇiçekSepeti",   icon: "🌸", color: "#E91E63", idField: "ciceksepetiId", pathField: "ciceksepetiPath" },
    { key: "hepsiburada", label: "Hepsiburada",   icon: "🟧", color: "#FF6000", idField: "hepsiburadaId", pathField: "hepsiburadaPath" },
    { key: "amazon",      label: "Amazon",        icon: "📦", color: "#FF9900", idField: "amazonId",      pathField: "amazonPath" },
];

// ═══════════════════════════════════════════════════════════════
// 🔍 Kategori Arama Popup
// ═══════════════════════════════════════════════════════════════
const CategorySearchPopup = ({ platform, mappingId, currentId, currentPath, C, isDark, t, onSave, onClose }) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(currentId ? { id: currentId, path: currentPath } : null);
    const [saving, setSaving] = useState(false);
    const timerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSearch = useCallback((val) => {
        setQuery(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!val || val.trim().length < 2) { setResults([]); return; }
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const apiName = platform.key === "ciceksepeti" ? "ÇiçekSepeti"
                    : platform.label;
                const res = await searchCategories(apiName, val.trim());
                setResults(res?.data?.results || []);
            } catch { setResults([]); }
            finally { setLoading(false); }
        }, 400);
    }, [platform]);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await onSave(mappingId, {
                [platform.idField]: Number(selected.id) || selected.id,
                [platform.pathField]: selected.path || selected.name || ""
            });
            onClose();
        } catch (err) {
            console.error("Kaydetme hatası:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "1rem",
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: isDark ? C.card : "#fff",
                    border: `1px solid ${C.border}`,
                    borderTop: `3px solid ${platform.color}`,
                    borderRadius: 12, width: "100%", maxWidth: 520,
                    maxHeight: "80vh", display: "flex", flexDirection: "column",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.3)`,
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "0.75rem 1rem", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>{platform.icon}</span>
                        <span style={{ color: platform.color, fontWeight: 800, fontSize: "0.9rem" }}>
                            {platform.label}
                        </span>
                        <span style={{ color: C.dim, fontSize: "0.75rem" }}>
                            — {t("categoryCenter.pickCategory")}
                        </span>
                    </div>
                    <FaTimes
                        onClick={onClose}
                        style={{ color: C.dim, cursor: "pointer", fontSize: "0.85rem" }}
                    />
                </div>

                {/* Search */}
                <div style={{ padding: "0.6rem 1rem", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: "0.4rem 0.6rem",
                    }}>
                        {loading ? (
                            <FaSpinner style={{ color: platform.color, fontSize: "0.75rem", animation: "cc-spin 1s linear infinite", flexShrink: 0 }} />
                        ) : (
                            <FaSearch style={{ color: C.dim, fontSize: "0.75rem", flexShrink: 0 }} />
                        )}
                        <input
                            ref={inputRef}
                            type="text" value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={t("categoryCenter.searchPlaceholder")}
                            style={{
                                flex: 1, background: "transparent", border: "none", outline: "none",
                                color: C.text, fontSize: "0.82rem", fontFamily: "inherit",
                            }}
                        />
                        {query && (
                            <FaTimes
                                style={{ color: C.dim, fontSize: "0.65rem", cursor: "pointer", flexShrink: 0 }}
                                onClick={() => { setQuery(""); setResults([]); }}
                            />
                        )}
                    </div>
                </div>

                {/* Selected */}
                {selected && (
                    <div style={{
                        padding: "0.4rem 1rem", background: `${platform.color}08`,
                        borderBottom: `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", gap: "0.3rem",
                    }}>
                        <FaCheck style={{ color: platform.color, fontSize: "0.6rem", flexShrink: 0 }} />
                        <span style={{
                            color: platform.color, fontSize: "0.72rem", fontWeight: 700,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                        }}>
                            {selected.path || selected.name}
                        </span>
                        <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: "monospace", flexShrink: 0 }}>
                            ID: {selected.id}
                        </span>
                        <FaTimes
                            style={{ color: C.dim, fontSize: "0.55rem", cursor: "pointer", flexShrink: 0 }}
                            onClick={() => setSelected(null)}
                        />
                    </div>
                )}

                {/* Results */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0.4rem 0.5rem", minHeight: 120 }}>
                    {query.length >= 2 && results.length > 0 && (
                        <>
                            <div style={{ padding: "0.2rem 0.4rem", color: C.muted, fontSize: "0.62rem", fontWeight: 600 }}>
                                🔍 {results.length} {t("categoryCenter.resultsFound")}
                            </div>
                            {results.map((item, idx) => {
                                const isPicked = String(selected?.id) === String(item.id);
                                return (
                                    <div
                                        key={`${item.id}-${idx}`}
                                        onClick={() => setSelected({ id: item.id, name: item.name, path: item.path })}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "0.35rem",
                                            padding: "0.35rem 0.5rem", borderRadius: 6, cursor: "pointer",
                                            background: isPicked ? `${platform.color}15` : "transparent",
                                            borderLeft: isPicked ? `3px solid ${platform.color}` : "3px solid transparent",
                                            transition: "all 0.12s", marginBottom: "0.1rem",
                                        }}
                                        onMouseEnter={(e) => { if (!isPicked) e.currentTarget.style.background = `${platform.color}08`; }}
                                        onMouseLeave={(e) => { if (!isPicked) e.currentTarget.style.background = "transparent"; }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                color: isPicked ? platform.color : C.text,
                                                fontSize: "0.76rem", fontWeight: isPicked ? 700 : 500,
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {item.name}
                                            </div>
                                            {item.path && (
                                                <div style={{
                                                    color: C.dim, fontSize: "0.6rem",
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                }}>
                                                    {item.path}
                                                </div>
                                            )}
                                        </div>
                                        <span style={{
                                            color: C.dim, fontSize: "0.55rem", fontFamily: "monospace",
                                            background: `${C.text}08`, padding: "0.1rem 0.25rem", borderRadius: 3, flexShrink: 0,
                                        }}>
                                            {item.id}
                                        </span>
                                        {isPicked && <FaCheck style={{ color: platform.color, fontSize: "0.55rem", flexShrink: 0 }} />}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {query.length >= 2 && results.length === 0 && !loading && (
                        <div style={{ padding: "2rem", textAlign: "center", color: C.dim }}>
                            <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.3rem" }}>🔍</span>
                            <p style={{ fontSize: "0.75rem", margin: 0 }}>
                                &quot;{query}&quot; {t("categoryCenter.noResults")}
                            </p>
                        </div>
                    )}

                    {query.length < 2 && (
                        <div style={{ padding: "2rem", textAlign: "center", color: C.dim }}>
                            <FaSearch style={{ fontSize: "1.5rem", marginBottom: "0.3rem", color: C.muted }} />
                            <p style={{ fontSize: "0.75rem", margin: 0 }}>
                                {t("categoryCenter.searchHint")}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: "0.6rem 1rem", borderTop: `1px solid ${C.border}`,
                    display: "flex", justifyContent: "flex-end", gap: "0.5rem",
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent", border: `1px solid ${C.border}`,
                            borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer",
                            color: C.text, fontSize: "0.78rem", fontWeight: 600,
                        }}
                    >
                        {t("common.cancel")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selected || saving}
                        style={{
                            background: selected ? platform.color : `${C.muted}30`,
                            border: "none", borderRadius: 8,
                            padding: "0.4rem 1rem", cursor: selected ? "pointer" : "not-allowed",
                            color: selected ? "#fff" : C.dim,
                            fontSize: "0.78rem", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            opacity: saving ? 0.6 : 1,
                        }}
                    >
                        {saving ? <FaSpinner style={{ animation: "cc-spin 1s linear infinite" }} /> : <FaSave />}
                        {t("common.save")}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 📊 İSTATİSTİK KARTLARI
// ═══════════════════════════════════════════════════════════════
const StatsBar = ({ stats, C, isDark, t }) => {
    if (!stats) return null;

    const items = [
        { label: t("categoryCenter.statTotal"), value: stats.totalRows, color: C.accent },
        { label: t("categoryCenter.statUnique"), value: stats.uniqueMasters, color: C.purple },
        { label: "🟠 Trendyol", value: stats.coverage?.trendyol || 0, color: "#F27A1A" },
        { label: "🟣 N11", value: stats.coverage?.n11 || 0, color: "#7B2D8E" },
        { label: "🌸 ÇiçekSepeti", value: stats.coverage?.ciceksepeti || 0, color: "#E91E63" },
        { label: "🟧 Hepsiburada", value: stats.coverage?.hepsiburada || 0, color: "#FF6000" },
        { label: "📦 Amazon", value: stats.coverage?.amazon || 0, color: "#FF9900" },
    ];

    return (
        <div style={{
            display: "flex", gap: "0.4rem", flexWrap: "wrap",
            padding: "0.5rem 0",
        }}>
            {items.map((item, i) => (
                <div key={i} style={{
                    background: `${item.color}10`,
                    border: `1px solid ${item.color}25`,
                    borderRadius: 8, padding: "0.3rem 0.6rem",
                    display: "flex", alignItems: "center", gap: "0.3rem",
                }}>
                    <span style={{ color: item.color, fontSize: "0.9rem", fontWeight: 800 }}>
                        {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                    </span>
                    <span style={{ color: C.dim, fontSize: "0.62rem", fontWeight: 600 }}>
                        {item.label}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 🏠 ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════
const CategoryCenterPage = ({ userId }) => {
    const { theme: C, t, resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";

    // State
    const [mappings, setMappings] = useState([]);
    const [stats, setStats] = useState(null);
    const [platforms, setPlatforms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [popup, setPopup] = useState(null); // { mappingId, platform, currentId, currentPath }
    const [exporting, setExporting] = useState(false);
    const searchTimerRef = useRef(null);
    const limit = 50;

    // Platformları yükle (entegrasyon durumu)
    useEffect(() => {
        const load = async () => {
            try {
                const res = await getMarketplaces();
                setPlatforms(res?.data?.platforms || []);
            } catch (err) {
                console.error("Platform yükleme hatası:", err);
            }
        };
        load();
    }, [userId]);

    // İstatistikleri yükle
    useEffect(() => {
        const load = async () => {
            try {
                const res = await getMappingStats();
                setStats(res?.data || null);
            } catch (err) {
                console.error("Stats yükleme hatası:", err);
            }
        };
        load();
    }, []);

    // Eşleştirmeleri yükle
    const loadMappings = useCallback(async (p, q) => {
        setLoading(true);
        setError("");
        try {
            const res = await getMappings(p, limit, q);
            setMappings(res?.data || []);
            setTotalPages(res?.pagination?.totalPages || 1);
            setTotalRows(res?.pagination?.total || 0);
        } catch (err) {
            setError(err?.response?.data?.message || err.message || t("categoryCenter.loadError"));
            setMappings([]);
        } finally {
            setLoading(false);
        }
    }, [t, limit]);

    useEffect(() => {
        loadMappings(page, searchQuery);
    }, [page, searchQuery, loadMappings]);

    // Arama (debounced)
    const handleSearchInput = useCallback((val) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setPage(1);
            setSearchQuery(val);
        }, 500);
    }, []);

    // Platform entegrasyon durumu
    const platformIntegrated = useMemo(() => {
        const map = {};
        for (const p of platforms) {
            const key = p.name.toLowerCase().replace(/[çö\s]/g, (m) =>
                m === "ç" ? "c" : m === "ö" ? "o" : ""
            );
            map[key] = p.integrated;
            // Ayrıca tam isimle de ekle
            map[p.name.toLowerCase().replace(/\s+/g, "")] = p.integrated;
        }
        return map;
    }, [platforms]);

    const isIntegrated = (platformKey) => {
        if (platformKey === "trendyol") return platformIntegrated["trendyol"] || false;
        if (platformKey === "n11") return platformIntegrated["n11"] || false;
        if (platformKey === "ciceksepeti") return platformIntegrated["ciceksepeti"] || platformIntegrated["çiçeksepeti"] || false;
        if (platformKey === "hepsiburada") return platformIntegrated["hepsiburada"] || false;
        if (platformKey === "amazon") return platformIntegrated["amazon"] || false;
        return false;
    };

    // Popup kaydetme
    const handlePopupSave = useCallback(async (mappingId, updates) => {
        const res = await updateMapping(mappingId, updates);
        // Tabloyu güncelle
        setMappings(prev => prev.map(m => m._id === mappingId ? { ...m, ...updates } : m));
        // Stats'ı yenile
        try {
            const statsRes = await getMappingStats();
            setStats(statsRes?.data || null);
        } catch { /* ignore */ }
        return res;
    }, []);

    // Hücre render
    const renderCell = (mapping, platform) => {
        const id = mapping[platform.idField];
        const path = mapping[platform.pathField] || "";
        const hasValue = id !== null && id !== undefined;

        // Trendyol = master, sadece göster
        if (platform.key === "trendyol") {
            return (
                <div style={{
                    display: "flex", flexDirection: "column", gap: "0.1rem",
                    padding: "0.25rem 0.4rem", minHeight: 36,
                    justifyContent: "center",
                }}>
                    <span style={{
                        color: C.text, fontSize: "0.7rem", fontWeight: 600,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                        {path || mapping.masterPath || "—"}
                    </span>
                    {id && (
                        <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: "monospace" }}>
                            ID: {id}
                        </span>
                    )}
                </div>
            );
        }

        // Diğer platformlar — düzenlenebilir
        return (
            <div
                onClick={() => {
                    if (isIntegrated(platform.key)) {
                        setPopup({
                            mappingId: mapping._id,
                            platform,
                            currentId: id,
                            currentPath: path,
                        });
                    }
                }}
                style={{
                    display: "flex", alignItems: "center", gap: "0.3rem",
                    padding: "0.25rem 0.4rem", minHeight: 36,
                    cursor: isIntegrated(platform.key) ? "pointer" : "default",
                    borderRadius: 4,
                    transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                    if (isIntegrated(platform.key)) e.currentTarget.style.background = `${platform.color}08`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
                {hasValue ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            color: C.text, fontSize: "0.68rem", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {path || "—"}
                        </div>
                        <div style={{ color: C.dim, fontSize: "0.52rem", fontFamily: "monospace" }}>
                            ID: {id}
                        </div>
                    </div>
                ) : (
                    <span style={{
                        color: C.dim, fontSize: "0.65rem", fontStyle: "italic",
                        flex: 1,
                    }}>
                        {isIntegrated(platform.key) ? t("categoryCenter.clickToMap") : t("categoryCenter.notConnected")}
                    </span>
                )}
                {isIntegrated(platform.key) && (
                    <FaEdit style={{
                        color: hasValue ? platform.color : C.dim,
                        fontSize: "0.55rem", flexShrink: 0, opacity: 0.6,
                    }} />
                )}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

            {/* ── HEADER ── */}
            <div style={{
                background: isDark
                    ? "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)",
                borderBottom: `1px solid ${C.border}`,
                padding: "0.75rem 1.25rem",
                flexShrink: 0,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{
                            background: `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)`,
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            fontSize: "1.25rem", fontWeight: 800, margin: 0,
                            display: "flex", alignItems: "center", gap: "0.4rem",
                        }}>
                            <FaSitemap style={{ WebkitTextFillColor: C.accent }} />
                            {t("categoryCenter.title")}
                        </h1>
                        <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.1rem 0 0" }}>
                            {t("categoryCenter.subtitle")}
                        </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 220px", maxWidth: 520 }}>
                    {/* Arama */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: "0.35rem 0.6rem", flex: 1, minWidth: 0,
                    }}>
                        <FaSearch style={{ color: C.dim, fontSize: "0.72rem", flexShrink: 0 }} />
                        <input
                            type="text" value={searchInput}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            placeholder={t("categoryCenter.searchPlaceholder")}
                            style={{
                                flex: 1, background: "transparent", border: "none", outline: "none",
                                color: C.text, fontSize: "0.78rem", fontFamily: "inherit",
                            }}
                        />
                        {searchInput && (
                            <FaTimes
                                style={{ color: C.dim, fontSize: "0.65rem", cursor: "pointer", flexShrink: 0 }}
                                onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1); }}
                            />
                        )}
                    </div>

                    {/* Excel Export */}
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={async () => {
                            setExporting(true);
                            try {
                                await exportMappingsExcel(searchQuery);
                            } catch (err) {
                                console.error("Export hatası:", err);
                            } finally {
                                setExporting(false);
                            }
                        }}
                        disabled={exporting}
                        style={{
                            background: "#1D6F42",
                            border: "none", borderRadius: 8,
                            padding: "0.4rem 0.75rem", cursor: exporting ? "not-allowed" : "pointer",
                            color: "#fff", fontSize: "0.75rem", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            whiteSpace: "nowrap", flexShrink: 0,
                            opacity: exporting ? 0.6 : 1,
                            boxShadow: "0 2px 8px rgba(29,111,66,0.3)",
                        }}
                    >
                        {exporting ? (
                            <FaSpinner style={{ animation: "cc-spin 1s linear infinite" }} />
                        ) : (
                            <FaFileExcel />
                        )}
                        {t("categoryCenter.exportExcel")}
                    </motion.button>
                    </div>
                </div>

                {/* İstatistikler */}
                <StatsBar stats={stats} C={C} isDark={isDark} t={t} />
            </div>

            {/* ── LOADING / ERROR ── */}
            {loading && mappings.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: C.dim }}>
                    <FaSpinner style={{ animation: "cc-spin 1s linear infinite", marginRight: "0.5rem" }} />
                    {t("common.loading")}
                </div>
            )}

            {error && !loading && (
                <div style={{
                    margin: "1rem", padding: "0.65rem 0.85rem",
                    background: `${C.red}12`, border: `1px solid ${C.red}30`,
                    borderRadius: 8, color: C.red, fontSize: "0.78rem",
                    display: "flex", alignItems: "center", gap: "0.4rem",
                }}>
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            {/* ── EXCEL TABLO ── */}
            {(!loading || mappings.length > 0) && !error && (
                <div style={{
                    flex: 1, overflow: "auto", padding: "0.5rem 0.75rem",
                }}>
                    <div style={{
                        minWidth: 900,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8, overflow: "hidden",
                    }}>
                        {/* Tablo Başlığı */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "50px 1fr 1fr 1fr 1fr 1fr",
                            background: isDark
                                ? "linear-gradient(135deg, #1e2337 0%, #171b2e 100%)"
                                : "linear-gradient(135deg, #f8f9fb 0%, #eef0f4 100%)",
                            borderBottom: `2px solid ${C.border}`,
                            position: "sticky", top: 0, zIndex: 10,
                        }}>
                            {/* # sütunu */}
                            <div style={{
                                padding: "0.5rem 0.4rem", textAlign: "center",
                                color: C.dim, fontSize: "0.65rem", fontWeight: 700,
                                borderRight: `1px solid ${C.border}`,
                            }}>
                                #
                            </div>
                            {/* Platform sütunları */}
                            {PLATFORMS.map((p, i) => (
                                <div key={p.key} style={{
                                    padding: "0.45rem 0.5rem",
                                    borderRight: i < PLATFORMS.length - 1 ? `1px solid ${C.border}` : "none",
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                    background: `${p.color}06`,
                                }}>
                                    <span style={{ fontSize: "0.85rem" }}>{p.icon}</span>
                                    <span style={{
                                        color: p.color, fontSize: "0.72rem", fontWeight: 800,
                                        whiteSpace: "nowrap",
                                    }}>
                                        {p.label}
                                    </span>
                                    {p.key === "trendyol" && (
                                        <span style={{
                                            background: `${p.color}18`, borderRadius: 4,
                                            padding: "0 0.25rem", fontSize: "0.5rem",
                                            fontWeight: 700, color: p.color,
                                        }}>
                                            MASTER
                                        </span>
                                    )}
                                    {p.key !== "trendyol" && isIntegrated(p.key) && (
                                        <span style={{
                                            background: `${C.green}18`, borderRadius: 4,
                                            padding: "0 0.25rem", fontSize: "0.5rem",
                                            fontWeight: 700, color: C.green,
                                        }}>
                                            ✓
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Tablo Satırları */}
                        {mappings.map((row, idx) => {
                            const rowNum = (page - 1) * limit + idx + 1;
                            const hasN11 = row.n11Id !== null && row.n11Id !== undefined;
                            const hasCS = row.ciceksepetiId !== null && row.ciceksepetiId !== undefined;
                            const hasHB = row.hepsiburadaId !== null && row.hepsiburadaId !== undefined;
                            const hasAZ = row.amazonId !== null && row.amazonId !== undefined;
                            const matchCount = [hasN11, hasCS, hasHB, hasAZ].filter(Boolean).length;

                            return (
                                <div
                                    key={row._id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "50px 1fr 1fr 1fr 1fr 1fr",
                                        borderBottom: `1px solid ${C.border}`,
                                        background: idx % 2 === 0
                                            ? "transparent"
                                            : isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)",
                                        transition: "background 0.1s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)"; }}
                                >
                                    {/* Satır numarası */}
                                    <div style={{
                                        padding: "0.3rem 0.3rem", textAlign: "center",
                                        color: C.dim, fontSize: "0.58rem", fontFamily: "monospace",
                                        borderRight: `1px solid ${C.border}`,
                                        display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center",
                                    }}>
                                        <span>{rowNum}</span>
                                        {matchCount > 0 && (
                                            <div style={{
                                                display: "flex", gap: "1px", marginTop: "0.15rem",
                                            }}>
                                                {[hasN11, hasCS, hasHB, hasAZ].map((has, di) => (
                                                    <div key={di} style={{
                                                        width: 4, height: 4, borderRadius: "50%",
                                                        background: has ? PLATFORMS[di + 1].color : `${C.dim}30`,
                                                    }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Platform hücreleri */}
                                    {PLATFORMS.map((p, i) => (
                                        <div key={p.key} style={{
                                            borderRight: i < PLATFORMS.length - 1 ? `1px solid ${C.border}` : "none",
                                            minWidth: 0,
                                        }}>
                                            {renderCell(row, p)}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        {/* Boş durum */}
                        {mappings.length === 0 && !loading && (
                            <div style={{
                                padding: "3rem 2rem", textAlign: "center", color: C.dim,
                                gridColumn: "1 / -1",
                            }}>
                                <FaTable style={{ fontSize: "2rem", marginBottom: "0.5rem", color: C.muted }} />
                                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, margin: "0 0 0.2rem" }}>
                                    {searchQuery ? t("categoryCenter.noResults") : t("categoryCenter.noData")}
                                </p>
                                {!searchQuery && (
                                    <p style={{ fontSize: "0.72rem", margin: 0 }}>
                                        {t("categoryCenter.importHint")}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
                <div style={{
                    padding: "0.5rem 1rem",
                    borderTop: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    flexShrink: 0,
                    background: isDark ? C.card : "#fafbfc",
                }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        style={{
                            background: "transparent", border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: "0.3rem 0.5rem", cursor: page <= 1 ? "not-allowed" : "pointer",
                            color: page <= 1 ? C.dim : C.text, fontSize: "0.72rem",
                            display: "flex", alignItems: "center", gap: "0.2rem",
                            opacity: page <= 1 ? 0.4 : 1,
                        }}
                    >
                        <FaChevronLeft style={{ fontSize: "0.55rem" }} />
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        {/* Sayfa numaraları */}
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 7) {
                                pageNum = i + 1;
                            } else if (page <= 4) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 6 + i;
                            } else {
                                pageNum = page - 3 + i;
                            }
                            const isActive = pageNum === page;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    style={{
                                        background: isActive ? C.accent : "transparent",
                                        border: isActive ? "none" : `1px solid ${C.border}`,
                                        borderRadius: 6, padding: "0.25rem 0.5rem",
                                        cursor: "pointer", color: isActive ? "#fff" : C.text,
                                        fontSize: "0.72rem", fontWeight: isActive ? 700 : 500,
                                        minWidth: 28,
                                    }}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        style={{
                            background: "transparent", border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: "0.3rem 0.5rem", cursor: page >= totalPages ? "not-allowed" : "pointer",
                            color: page >= totalPages ? C.dim : C.text, fontSize: "0.72rem",
                            display: "flex", alignItems: "center", gap: "0.2rem",
                            opacity: page >= totalPages ? 0.4 : 1,
                        }}
                    >
                        <FaChevronRight style={{ fontSize: "0.55rem" }} />
                    </button>

                    <span style={{ color: C.dim, fontSize: "0.65rem", marginLeft: "0.5rem" }}>
                        {totalRows.toLocaleString()} {t("categoryCenter.totalRecords")}
                    </span>
                </div>
            )}

            {/* ── POPUP ── */}
            <AnimatePresence>
                {popup && (
                    <CategorySearchPopup
                        platform={popup.platform}
                        mappingId={popup.mappingId}
                        currentId={popup.currentId}
                        currentPath={popup.currentPath}
                        C={C}
                        isDark={isDark}
                        t={t}
                        onSave={handlePopupSave}
                        onClose={() => setPopup(null)}
                    />
                )}
            </AnimatePresence>

            <style>{`@keyframes cc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default CategoryCenterPage;
