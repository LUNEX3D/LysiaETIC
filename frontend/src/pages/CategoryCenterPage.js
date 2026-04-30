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
    getMarketplaces, searchCategories,
    getHepsiburadaCategoryTree, exportHepsiburadaCategoriesExcel,
    autoMatch, autoMatchReset, autoMatchPrepare, autoMatchApprove
} from "../services/categoryCenterApi";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaSitemap, FaSearch, FaTimes, FaCheck, FaSpinner,
    FaExclamationTriangle, FaSave, FaChevronLeft, FaChevronRight,
    FaEdit, FaTable, FaChartBar, FaFileExcel, FaDownload,
    FaChevronDown, FaChevronRight as FaChevronRightIcon, FaFolder, FaFolderOpen, FaLeaf,
    FaMagic
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
                                // HB kategorilerinde: leaf+available → ürün açılabilir
                                // leaf===undefined (diğer platformlar) → seçilebilir, leaf===false (parent) → seçilemez
                                const isSelectable = item.leaf === true || item.leaf === undefined || item.leaf === null;
                                const isHBLeafAvailable = item.leaf && item.available !== false;
                                const isHBParent = item.leaf === false || item.hasChildren;
                                return (
                                    <div
                                        key={`${item.id}-${idx}`}
                                        onClick={() => {
                                            if (isSelectable) setSelected({ id: item.id, name: item.name, path: item.path });
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "0.35rem",
                                            padding: "0.35rem 0.5rem", borderRadius: 6,
                                            cursor: isSelectable ? "pointer" : "not-allowed",
                                            opacity: isSelectable ? 1 : 0.5,
                                            background: isPicked ? `${platform.color}15` : "transparent",
                                            borderLeft: isPicked ? `3px solid ${platform.color}` : "3px solid transparent",
                                            transition: "all 0.12s", marginBottom: "0.1rem",
                                        }}
                                        onMouseEnter={(e) => { if (!isPicked && isSelectable) e.currentTarget.style.background = `${platform.color}08`; }}
                                        onMouseLeave={(e) => { if (!isPicked) e.currentTarget.style.background = isPicked ? `${platform.color}15` : "transparent"; }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                color: isPicked ? platform.color : isHBParent ? C.muted : C.text,
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
                                        {/* Leaf + Available badge (ürün açılabilir) */}
                                        {isHBLeafAvailable && (
                                            <span style={{
                                                background: `${C.green}18`, color: C.green,
                                                fontSize: "0.5rem", fontWeight: 700, padding: "0.08rem 0.25rem",
                                                borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em",
                                            }}>
                                                ✓ LEAF
                                            </span>
                                        )}
                                        {/* Sadece leaf ama available değil */}
                                        {item.leaf && item.available === false && (
                                            <span style={{
                                                background: `${C.yellow || "#f59e0b"}18`, color: C.yellow || "#f59e0b",
                                                fontSize: "0.5rem", fontWeight: 700, padding: "0.08rem 0.25rem",
                                                borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em",
                                            }}>
                                                LEAF
                                            </span>
                                        )}
                                        {/* Parent kategori badge */}
                                        {isHBParent && (
                                            <span style={{
                                                background: `${C.dim}15`, color: C.dim,
                                                fontSize: "0.48rem", fontWeight: 600, padding: "0.08rem 0.25rem",
                                                borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em",
                                            }}>
                                                ÜST
                                            </span>
                                        )}
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
// 🌳 HB KATEGORİ AĞACI BİLEŞENİ
// ═══════════════════════════════════════════════════════════════
const HBCategoryTreeNode = ({ node, depth = 0, searchQuery, C, expandAll }) => {
    const [isExpanded, setIsExpanded] = useState(depth === 0);
    const hasChildren = node.children && node.children.length > 0;
    const isLeaf = node.leaf === true;

    // expandAll değiştiğinde tüm node'ları aç/kapat
    useEffect(() => {
        if (expandAll !== undefined) {
            setIsExpanded(expandAll);
        }
    }, [expandAll]);

    const toggleExpand = () => {
        if (hasChildren) setIsExpanded(!isExpanded);
    };

    return (
        <div style={{ marginLeft: depth > 0 ? "1.2rem" : 0 }}>
            <div
                onClick={toggleExpand}
                style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    padding: "0.35rem 0.5rem", borderRadius: 6,
                    cursor: hasChildren ? "pointer" : "default",
                    background: isExpanded && hasChildren ? `${C.accent}08` : "transparent",
                    transition: "background 0.15s",
                    borderLeft: isLeaf ? `2px solid ${C.green}40` : hasChildren ? `2px solid ${C.accent}40` : "2px solid transparent",
                }}
                onMouseEnter={(e) => { if (hasChildren) e.currentTarget.style.background = `${C.accent}12`; }}
                onMouseLeave={(e) => { if (hasChildren) e.currentTarget.style.background = isExpanded && hasChildren ? `${C.accent}08` : "transparent"; }}
            >
                {/* Expand/Collapse Icon */}
                {hasChildren ? (
                    isExpanded ? (
                        <FaChevronDown style={{ color: C.accent, fontSize: "0.65rem", flexShrink: 0 }} />
                    ) : (
                        <FaChevronRightIcon style={{ color: C.dim, fontSize: "0.65rem", flexShrink: 0 }} />
                    )
                ) : (
                    <div style={{ width: "0.65rem", flexShrink: 0 }} />
                )}

                {/* Folder/Leaf Icon */}
                {isLeaf ? (
                    <FaLeaf style={{ color: C.green, fontSize: "0.7rem", flexShrink: 0 }} />
                ) : hasChildren ? (
                    isExpanded ? (
                        <FaFolderOpen style={{ color: C.accent, fontSize: "0.75rem", flexShrink: 0 }} />
                    ) : (
                        <FaFolder style={{ color: C.muted, fontSize: "0.75rem", flexShrink: 0 }} />
                    )
                ) : (
                    <FaFolder style={{ color: C.dim, fontSize: "0.75rem", flexShrink: 0, opacity: 0.5 }} />
                )}

                {/* Category Name */}
                <span style={{
                    color: isLeaf ? C.green : hasChildren ? C.text : C.dim,
                    fontSize: "0.78rem", fontWeight: isLeaf ? 600 : hasChildren ? 500 : 400,
                    flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "normal", wordBreak: "break-word",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    lineHeight: "1.35",
                }}>
                    {node.displayName || node.name}
                </span>

                {/* Category ID Badge */}
                <span style={{
                    color: C.dim, fontSize: "0.58rem", fontFamily: "monospace",
                    background: `${C.text}08`, padding: "0.1rem 0.3rem", borderRadius: 4, flexShrink: 0,
                }}>
                    {node.categoryId}
                </span>

                {/* Leaf Badge */}
                {isLeaf && (
                    <span style={{
                        background: `${C.green}18`, color: C.green,
                        fontSize: "0.55rem", fontWeight: 700, padding: "0.1rem 0.3rem",
                        borderRadius: 4, flexShrink: 0,
                    }}>
                        LEAF
                    </span>
                )}

                {/* Children Count */}
                {hasChildren && (
                    <span style={{
                        color: C.dim, fontSize: "0.6rem",
                        background: `${C.accent}12`, padding: "0.1rem 0.3rem", borderRadius: 4, flexShrink: 0,
                    }}>
                        {node.children.length}
                    </span>
                )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <div style={{ marginTop: "0.15rem" }}>
                    {node.children.map((child) => (
                        <HBCategoryTreeNode
                            key={child.categoryId}
                            node={child}
                            depth={depth + 1}
                            searchQuery={searchQuery}
                            C={C}
                            expandAll={expandAll}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 🏠 ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════
const CategoryCenterPage = ({ userId }) => {
    const { theme: C, t, resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";

    // Tab State
    const [activeTab, setActiveTab] = useState("mappings"); // "mappings" | "hb-categories"

    // Mappings State
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
    const [popup, setPopup] = useState(null);
    const [exporting, setExporting] = useState(false);
    const searchTimerRef = useRef(null);
    const limit = 50;

    // HB Categories State
    const [hbTree, setHbTree] = useState([]);
    const [hbLoading, setHbLoading] = useState(false);
    const [hbError, setHbError] = useState("");
    const [hbSearchQuery, setHbSearchQuery] = useState("");
    const [hbSearchInput, setHbSearchInput] = useState("");
    const [hbStats, setHbStats] = useState({ flatCount: 0, treeRootCount: 0 });
    const [hbExporting, setHbExporting] = useState(false);
    const [expandedAll, setExpandedAll] = useState(undefined); // undefined = kullanıcı henüz tıklamadı
    const hbSearchTimerRef = useRef(null);

    // Auto-Match Wizard State
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardLoading, setWizardLoading] = useState(false);
    const [wizardSuggestions, setWizardSuggestions] = useState([]);
    const [wizardIndex, setWizardIndex] = useState(0);
    const [wizardPaused, setWizardPaused] = useState(false);
    const [wizardSaving, setWizardSaving] = useState(false);
    const [wizardStats, setWizardStats] = useState({ approved: 0, skipped: 0, manual: 0 });
    const [wizardManualMode, setWizardManualMode] = useState(false);
    const [wizardSearchQuery, setWizardSearchQuery] = useState("");
    const [wizardSearchResults, setWizardSearchResults] = useState([]);
    const [wizardSearchLoading, setWizardSearchLoading] = useState(false);
    const [wizardSelectedAlt, setWizardSelectedAlt] = useState(null);
    const wizardSearchTimer = useRef(null);
    const [showAutoMatchMenu, setShowAutoMatchMenu] = useState(false);

    // Auto-match dropdown dışına tıklayınca kapat
    useEffect(() => {
        if (!showAutoMatchMenu) return;
        const handleClickOutside = () => setShowAutoMatchMenu(false);
        const timer = setTimeout(() => document.addEventListener("click", handleClickOutside), 10);
        return () => { clearTimeout(timer); document.removeEventListener("click", handleClickOutside); };
    }, [showAutoMatchMenu]);

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
            // ✅ FIX: Tüm Türkçe karakterleri normalize et (tutarlı eşleşme)
            const key = p.name.toLowerCase().replace(/[çöüğışÇÖÜĞİŞ\s]/g, (m) => {
                const map2 = { "ç": "c", "ö": "o", "ü": "u", "ğ": "g", "ı": "i", "ş": "s", " ": "" };
                return map2[m.toLowerCase()] || "";
            });
            map[key] = p.integrated;
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

    // HB Kategorileri yükle
    const loadHBCategories = useCallback(async (q = "") => {
        setHbLoading(true);
        setHbError("");
        try {
            const res = await getHepsiburadaCategoryTree(q);
            setHbTree(res?.data?.tree || []);
            setHbStats({
                flatCount: res?.data?.flatCount || 0,
                treeRootCount: res?.data?.treeRootCount || 0
            });
        } catch (err) {
            const errMsg = err?.response?.data?.message || err.message || t("categoryCenter.treeError");
            setHbError(errMsg);
            setHbTree([]);
        } finally {
            setHbLoading(false);
        }
    }, [t]);

    // HB kategorileri tab'a geçince yükle
    // ✅ FIX: hbError koşulu kaldırıldı — hata sonrası tekrar tıklayınca yeniden yüklenebilsin
    useEffect(() => {
        if (activeTab === "hb-categories" && hbTree.length === 0 && !hbLoading) {
            setHbError(""); // Önceki hatayı temizle
            loadHBCategories(hbSearchQuery);
        }
    }, [activeTab, hbTree.length, hbLoading, hbSearchQuery, loadHBCategories]);

    // HB arama (debounced)
    const handleHBSearchInput = useCallback((val) => {
        setHbSearchInput(val);
        if (hbSearchTimerRef.current) clearTimeout(hbSearchTimerRef.current);
        hbSearchTimerRef.current = setTimeout(() => {
            setHbSearchQuery(val);
            loadHBCategories(val);
        }, 600);
    }, [loadHBCategories]);

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

    // ── Wizard: Başlat ──
    const startWizard = useCallback(async (selectedPlatforms = []) => {
        setShowAutoMatchMenu(false);
        setWizardOpen(true);
        setWizardLoading(true);
        setWizardIndex(0);
        setWizardPaused(false);
        setWizardStats({ approved: 0, skipped: 0, manual: 0 });
        setWizardManualMode(false);
        setWizardSelectedAlt(null);
        setWizardSearchQuery("");
        setWizardSearchResults([]);
        try {
            const res = await autoMatchPrepare(selectedPlatforms);
            const suggestions = res?.data?.suggestions || [];
            setWizardSuggestions(suggestions);
            if (suggestions.length === 0) {
                setWizardPaused(true);
            }
        } catch (err) {
            console.error("Wizard prepare hatası:", err);
            setWizardSuggestions([]);
        } finally {
            setWizardLoading(false);
        }
    }, []);

    // ── Wizard: Onayla ──
    const wizardApprove = useCallback(async (categoryId, categoryPath) => {
        const current = wizardSuggestions[wizardIndex];
        if (!current) return;
        setWizardSaving(true);
        try {
            await autoMatchApprove(current.mappingId, current.platform, categoryId, categoryPath);
            setWizardStats(prev => ({ ...prev, approved: prev.approved + 1 }));
            setWizardManualMode(false);
            setWizardSelectedAlt(null);
            setWizardSearchQuery("");
            setWizardSearchResults([]);
            setWizardIndex(prev => prev + 1);
        } catch (err) {
            console.error("Wizard approve hatası:", err);
        } finally {
            setWizardSaving(false);
        }
    }, [wizardSuggestions, wizardIndex]);

    // ── Wizard: Atla ──
    const wizardSkip = useCallback(() => {
        setWizardStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
        setWizardManualMode(false);
        setWizardSelectedAlt(null);
        setWizardSearchQuery("");
        setWizardSearchResults([]);
        setWizardIndex(prev => prev + 1);
    }, []);

    // ── Wizard: Manuel Arama ──
    const wizardSearch = useCallback((val) => {
        setWizardSearchQuery(val);
        if (wizardSearchTimer.current) clearTimeout(wizardSearchTimer.current);
        if (!val || val.trim().length < 2) { setWizardSearchResults([]); return; }
        wizardSearchTimer.current = setTimeout(async () => {
            const current = wizardSuggestions[wizardIndex];
            if (!current) return;
            setWizardSearchLoading(true);
            try {
                const platformLabel = current.platform === "ciceksepeti" ? "ÇiçekSepeti"
                    : current.platform === "n11" ? "N11"
                    : current.platform === "hepsiburada" ? "Hepsiburada" : current.platform;
                const res = await searchCategories(platformLabel, val.trim());
                setWizardSearchResults(res?.data?.results || []);
            } catch { setWizardSearchResults([]); }
            finally { setWizardSearchLoading(false); }
        }, 400);
    }, [wizardSuggestions, wizardIndex]);

    // ── Wizard: Kapat ──
    const closeWizard = useCallback(() => {
        setWizardOpen(false);
        setWizardSuggestions([]);
        setWizardIndex(0);
        setWizardManualMode(false);
        setWizardSelectedAlt(null);
        setWizardSearchQuery("");
        setWizardSearchResults([]);
        // Tabloyu ve stats'ı yenile
        loadMappings(page, searchQuery);
        getMappingStats().then(r => setStats(r?.data || null)).catch(() => {});
    }, [page, searchQuery, loadMappings]);

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
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "normal", wordBreak: "break-word",
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                        lineHeight: "1.35",
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
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "normal", wordBreak: "break-word",
                            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                            lineHeight: "1.35",
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

                    {/* 🤖 Otomatik Eşleştirme Butonu */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                        <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setShowAutoMatchMenu(!showAutoMatchMenu)}
                            disabled={wizardOpen}
                            style={{
                                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                border: "none", borderRadius: 8,
                                padding: "0.4rem 0.75rem", cursor: wizardOpen ? "not-allowed" : "pointer",
                                color: "#fff", fontSize: "0.75rem", fontWeight: 700,
                                display: "flex", alignItems: "center", gap: "0.3rem",
                                whiteSpace: "nowrap",
                                opacity: wizardOpen ? 0.6 : 1,
                                boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
                            }}
                        >
                            <FaMagic />
                            Otomatik Eşleştir
                        </motion.button>

                        {/* Dropdown Menü */}
                        {showAutoMatchMenu && !wizardOpen && (
                            <div style={{
                                position: "absolute", top: "calc(100% + 4px)", right: 0,
                                background: isDark ? C.card : "#fff",
                                border: `1px solid ${C.border}`,
                                borderRadius: 10, padding: "0.4rem",
                                boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                                zIndex: 100, minWidth: 240,
                            }}>
                                <div style={{ padding: "0.3rem 0.5rem", color: C.dim, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Tek Tek Onayla (Sihirbaz)
                                </div>
                                <button onClick={() => startWizard([])} style={{
                                    width: "100%", textAlign: "left", background: "transparent", border: "none",
                                    padding: "0.4rem 0.5rem", borderRadius: 6, cursor: "pointer",
                                    color: C.text, fontSize: "0.76rem", fontWeight: 500,
                                    display: "flex", alignItems: "center", gap: "0.35rem",
                                }}>
                                    <FaMagic style={{ color: "#6366f1", fontSize: "0.7rem" }} />
                                    Tüm Platformlar
                                </button>
                                {["n11", "ciceksepeti", "hepsiburada"].map(pk => {
                                    const pf = PLATFORMS.find(p => p.key === pk);
                                    return (
                                        <button key={pk} onClick={() => startWizard([pk])} style={{
                                            width: "100%", textAlign: "left", background: "transparent", border: "none",
                                            padding: "0.4rem 0.5rem", borderRadius: 6, cursor: "pointer",
                                            color: C.text, fontSize: "0.76rem", fontWeight: 500,
                                            display: "flex", alignItems: "center", gap: "0.35rem",
                                        }}>
                                            <span style={{ fontSize: "0.8rem" }}>{pf?.icon}</span>
                                            Sadece {pf?.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    </div>
                </div>

                {/* İstatistikler — sadece mappings tab'ında */}
                {activeTab === "mappings" && <StatsBar stats={stats} C={C} isDark={isDark} t={t} />}

                {/* ── TAB BAR ── */}
                <div style={{
                    display: "flex", gap: "0.3rem", marginTop: "0.5rem",
                }}>
                    {[
                        { id: "mappings", label: t("categoryCenter.title"), icon: <FaTable style={{ fontSize: "0.7rem" }} /> },
                        { id: "hb-categories", label: t("categoryCenter.hbCategories"), icon: <span style={{ fontSize: "0.85rem" }}>🟧</span> },
                    ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.35rem",
                                    padding: "0.45rem 0.85rem",
                                    background: isActive
                                        ? (tab.id === "hb-categories" ? "rgba(255,96,0,0.12)" : `${C.accent}15`)
                                        : "transparent",
                                    border: `1px solid ${isActive
                                        ? (tab.id === "hb-categories" ? "rgba(255,96,0,0.3)" : `${C.accent}30`)
                                        : C.border}`,
                                    borderBottom: isActive ? "none" : `1px solid ${C.border}`,
                                    borderRadius: "8px 8px 0 0",
                                    cursor: "pointer",
                                    color: isActive
                                        ? (tab.id === "hb-categories" ? "#FF6000" : C.accent)
                                        : C.dim,
                                    fontSize: "0.78rem", fontWeight: isActive ? 700 : 500,
                                    transition: "all 0.15s",
                                    fontFamily: "inherit",
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                TAB 1: MAPPINGS (Eşleştirme Tablosu)
               ═══════════════════════════════════════════════════════ */}
            {activeTab === "mappings" && (
                <>
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
                                    gridTemplateColumns: "50px 1.2fr 1fr 1fr 1.2fr 1fr",
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
                                                gridTemplateColumns: "50px 1.2fr 1fr 1fr 1.2fr 1fr",
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
                </>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 2: HB KATEGORİLERİ (Ağaç Görünümü)
               ═══════════════════════════════════════════════════════ */}
            {activeTab === "hb-categories" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* ── HB Header: Arama + Butonlar + İstatistikler ── */}
                    <div style={{
                        padding: "0.6rem 1rem",
                        borderBottom: `1px solid ${C.border}`,
                        background: isDark ? "rgba(255,96,0,0.03)" : "rgba(255,96,0,0.02)",
                        flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            {/* Arama */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.4rem",
                                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                padding: "0.35rem 0.6rem", flex: "1 1 200px", minWidth: 0, maxWidth: 400,
                            }}>
                                {hbLoading ? (
                                    <FaSpinner style={{ color: "#FF6000", fontSize: "0.72rem", animation: "cc-spin 1s linear infinite", flexShrink: 0 }} />
                                ) : (
                                    <FaSearch style={{ color: C.dim, fontSize: "0.72rem", flexShrink: 0 }} />
                                )}
                                <input
                                    type="text" value={hbSearchInput}
                                    onChange={(e) => handleHBSearchInput(e.target.value)}
                                    placeholder={t("categoryCenter.searchPlaceholder")}
                                    style={{
                                        flex: 1, background: "transparent", border: "none", outline: "none",
                                        color: C.text, fontSize: "0.78rem", fontFamily: "inherit",
                                    }}
                                />
                                {hbSearchInput && (
                                    <FaTimes
                                        style={{ color: C.dim, fontSize: "0.65rem", cursor: "pointer", flexShrink: 0 }}
                                        onClick={() => { setHbSearchInput(""); setHbSearchQuery(""); loadHBCategories(""); }}
                                    />
                                )}
                            </div>

                            {/* Tümünü Aç/Kapat */}
                            <button
                                onClick={() => setExpandedAll(prev => prev === true ? false : true)}
                                style={{
                                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                    border: `1px solid ${C.border}`, borderRadius: 8,
                                    padding: "0.35rem 0.65rem", cursor: "pointer",
                                    color: C.text, fontSize: "0.72rem", fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                    whiteSpace: "nowrap", fontFamily: "inherit",
                                }}
                            >
                                {expandedAll === true ? <FaChevronDown style={{ fontSize: "0.6rem" }} /> : <FaChevronRightIcon style={{ fontSize: "0.6rem" }} />}
                                {expandedAll === true ? t("categoryCenter.collapseAll") : t("categoryCenter.expandAll")}
                            </button>

                            {/* Yenile */}
                            <button
                                onClick={() => loadHBCategories(hbSearchQuery)}
                                disabled={hbLoading}
                                style={{
                                    background: "rgba(255,96,0,0.1)",
                                    border: `1px solid rgba(255,96,0,0.25)`, borderRadius: 8,
                                    padding: "0.35rem 0.65rem", cursor: hbLoading ? "not-allowed" : "pointer",
                                    color: "#FF6000", fontSize: "0.72rem", fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                    whiteSpace: "nowrap", fontFamily: "inherit",
                                    opacity: hbLoading ? 0.6 : 1,
                                }}
                            >
                                {hbLoading ? <FaSpinner style={{ animation: "cc-spin 1s linear infinite" }} /> : <FaSitemap style={{ fontSize: "0.65rem" }} />}
                                {hbLoading ? t("categoryCenter.loadingTree") : "Yenile"}
                            </button>

                            {/* Excel Export */}
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={async () => {
                                    setHbExporting(true);
                                    try {
                                        await exportHepsiburadaCategoriesExcel(hbSearchQuery);
                                    } catch (err) {
                                        console.error("HB Export hatası:", err);
                                    } finally {
                                        setHbExporting(false);
                                    }
                                }}
                                disabled={hbExporting || hbLoading}
                                style={{
                                    background: "#1D6F42",
                                    border: "none", borderRadius: 8,
                                    padding: "0.35rem 0.65rem", cursor: (hbExporting || hbLoading) ? "not-allowed" : "pointer",
                                    color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                    whiteSpace: "nowrap", flexShrink: 0,
                                    opacity: (hbExporting || hbLoading) ? 0.6 : 1,
                                    boxShadow: "0 2px 8px rgba(29,111,66,0.3)",
                                    fontFamily: "inherit",
                                }}
                            >
                                {hbExporting ? (
                                    <FaSpinner style={{ animation: "cc-spin 1s linear infinite" }} />
                                ) : (
                                    <FaFileExcel />
                                )}
                                {t("categoryCenter.exportHbExcel")}
                            </motion.button>
                        </div>

                        {/* İstatistikler */}
                        {hbStats.flatCount > 0 && (
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                                {[
                                    { label: t("categoryCenter.totalCategories"), value: hbStats.flatCount, color: "#FF6000" },
                                    { label: t("categoryCenter.rootCategories"), value: hbStats.treeRootCount, color: C.accent },
                                ].map((item, i) => (
                                    <div key={i} style={{
                                        background: `${item.color}10`,
                                        border: `1px solid ${item.color}25`,
                                        borderRadius: 8, padding: "0.2rem 0.5rem",
                                        display: "flex", alignItems: "center", gap: "0.3rem",
                                    }}>
                                        <span style={{ color: item.color, fontSize: "0.85rem", fontWeight: 800 }}>
                                            {item.value.toLocaleString()}
                                        </span>
                                        <span style={{ color: C.dim, fontSize: "0.6rem", fontWeight: 600 }}>
                                            {item.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── HB Loading ── */}
                    {hbLoading && hbTree.length === 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#FF6000" }}>
                            <FaSpinner style={{ animation: "cc-spin 1s linear infinite", marginRight: "0.5rem", fontSize: "1.2rem" }} />
                            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t("categoryCenter.loadingTree")}</span>
                        </div>
                    )}

                    {/* ── HB Error ── */}
                    {hbError && !hbLoading && (
                        <div style={{
                            margin: "1rem", padding: "0.65rem 0.85rem",
                            background: `${C.red}12`, border: `1px solid ${C.red}30`,
                            borderRadius: 8, color: C.red, fontSize: "0.78rem",
                            display: "flex", alignItems: "center", gap: "0.4rem",
                        }}>
                            <FaExclamationTriangle /> {hbError}
                        </div>
                    )}

                    {/* ── HB Ağaç Görünümü ── */}
                    {!hbLoading && !hbError && hbTree.length > 0 && (
                        <div style={{
                            flex: 1, overflow: "auto", padding: "0.5rem 0.75rem",
                        }}>
                            <div style={{
                                border: `1px solid ${C.border}`,
                                borderRadius: 8, overflow: "hidden",
                                background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                            }}>
                                <div style={{ padding: "0.5rem" }}>
                                    {hbTree.map((rootNode) => (
                                        <HBCategoryTreeNode
                                            key={rootNode.categoryId}
                                            node={rootNode}
                                            depth={0}
                                            searchQuery={hbSearchQuery}
                                            C={C}
                                            expandAll={expandedAll}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── HB Boş durum ── */}
                    {!hbLoading && !hbError && hbTree.length === 0 && hbStats.flatCount === 0 && (
                        <div style={{ padding: "3rem 2rem", textAlign: "center", color: C.dim }}>
                            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}>🟧</span>
                            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, margin: "0 0 0.2rem" }}>
                                {t("categoryCenter.noHbIntegration")}
                            </p>
                            <p style={{ fontSize: "0.72rem", margin: 0 }}>
                                {t("categoryCenter.addHbFirst")}
                            </p>
                        </div>
                    )}
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

            {/* ═══════════════════════════════════════════════════════
                🤖 EŞLEŞTİRME SİHİRBAZI (WIZARD MODAL)
               ═══════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {wizardOpen && (() => {
                    const current = wizardSuggestions[wizardIndex];
                    const isFinished = !wizardLoading && wizardIndex >= wizardSuggestions.length;
                    const platformInfo = current ? PLATFORMS.find(p => p.key === current.platform) : null;
                    const progress = wizardSuggestions.length > 0 ? ((wizardIndex) / wizardSuggestions.length) * 100 : 0;

                    return (
                        <motion.div
                            key="wizard-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: "fixed", inset: 0, zIndex: 10000,
                                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "1rem",
                            }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                style={{
                                    background: isDark ? C.card : "#fff",
                                    border: `1px solid ${C.border}`,
                                    borderTop: "3px solid #6366f1",
                                    borderRadius: 14, width: "100%", maxWidth: 680,
                                    maxHeight: "90vh", display: "flex", flexDirection: "column",
                                    boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
                                }}
                            >
                                {/* ── Wizard Header ── */}
                                <div style={{
                                    padding: "0.75rem 1rem", borderBottom: `1px solid ${C.border}`,
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <FaMagic style={{ color: "#6366f1", fontSize: "1rem" }} />
                                        <span style={{ color: C.text, fontWeight: 800, fontSize: "0.95rem" }}>
                                            Eşleştirme Sihirbazı
                                        </span>
                                        {wizardSuggestions.length > 0 && !isFinished && (
                                            <span style={{
                                                background: `${C.accent}15`, color: C.accent,
                                                fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.4rem",
                                                borderRadius: 6,
                                            }}>
                                                {wizardIndex + 1} / {wizardSuggestions.length}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        {/* İstatistikler */}
                                        <span style={{ fontSize: "0.6rem", color: "#22c55e", fontWeight: 700 }}>
                                            ✓ {wizardStats.approved}
                                        </span>
                                        <span style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: 700 }}>
                                            ⏭ {wizardStats.skipped}
                                        </span>
                                        <span style={{ fontSize: "0.6rem", color: "#6366f1", fontWeight: 700 }}>
                                            ✎ {wizardStats.manual}
                                        </span>
                                        <div style={{ width: 1, height: 16, background: C.border, margin: "0 0.2rem" }} />
                                        <FaTimes
                                            onClick={closeWizard}
                                            style={{ color: C.dim, cursor: "pointer", fontSize: "0.9rem" }}
                                        />
                                    </div>
                                </div>

                                {/* ── Progress Bar ── */}
                                <div style={{ height: 3, background: `${C.border}`, flexShrink: 0 }}>
                                    <div style={{
                                        height: "100%", width: `${progress}%`,
                                        background: "linear-gradient(90deg, #6366f1, #22c55e)",
                                        transition: "width 0.3s ease",
                                    }} />
                                </div>

                                {/* ── İçerik ── */}
                                <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>

                                    {/* Loading */}
                                    {wizardLoading && (
                                        <div style={{ padding: "3rem", textAlign: "center", color: C.dim }}>
                                            <FaSpinner style={{ fontSize: "2rem", animation: "cc-spin 1s linear infinite", color: "#6366f1", marginBottom: "0.5rem" }} />
                                            <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
                                                Eşleştirme önerileri hazırlanıyor...
                                            </p>
                                            <p style={{ fontSize: "0.7rem", margin: "0.2rem 0 0", color: C.dim }}>
                                                Canlı API'lerden kategoriler çekiliyor
                                            </p>
                                        </div>
                                    )}

                                    {/* Hiç öneri yok */}
                                    {!wizardLoading && wizardSuggestions.length === 0 && (
                                        <div style={{ padding: "3rem", textAlign: "center", color: C.dim }}>
                                            <FaCheck style={{ fontSize: "2.5rem", color: "#22c55e", marginBottom: "0.5rem" }} />
                                            <p style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, margin: "0.5rem 0 0" }}>
                                                Tüm kategoriler zaten eşleştirilmiş!
                                            </p>
                                            <p style={{ fontSize: "0.72rem", margin: "0.3rem 0 0" }}>
                                                Boş eşleştirme bulunamadı.
                                            </p>
                                        </div>
                                    )}

                                    {/* Tamamlandı */}
                                    {isFinished && wizardSuggestions.length > 0 && (
                                        <div style={{ padding: "2rem", textAlign: "center" }}>
                                            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎉</div>
                                            <p style={{ fontSize: "1.1rem", fontWeight: 800, color: C.text, margin: "0 0 0.5rem" }}>
                                                Eşleştirme Tamamlandı!
                                            </p>
                                            <div style={{
                                                display: "flex", justifyContent: "center", gap: "1.5rem",
                                                margin: "1rem 0",
                                            }}>
                                                <div style={{ textAlign: "center" }}>
                                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#22c55e" }}>{wizardStats.approved}</div>
                                                    <div style={{ fontSize: "0.68rem", color: C.dim, fontWeight: 600 }}>Onaylanan</div>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b" }}>{wizardStats.skipped}</div>
                                                    <div style={{ fontSize: "0.68rem", color: C.dim, fontWeight: 600 }}>Atlanan</div>
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#6366f1" }}>{wizardStats.manual}</div>
                                                    <div style={{ fontSize: "0.68rem", color: C.dim, fontWeight: 600 }}>Manuel</div>
                                                </div>
                                            </div>
                                            <button onClick={closeWizard} style={{
                                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                                border: "none", borderRadius: 10, padding: "0.6rem 2rem",
                                                color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                                                boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                                            }}>
                                                Kapat
                                            </button>
                                        </div>
                                    )}

                                    {/* ── Aktif Öneri Kartı ── */}
                                    {!wizardLoading && current && !isFinished && (
                                        <div>
                                            {/* Master Kategori */}
                                            <div style={{
                                                background: isDark ? "rgba(243,132,26,0.08)" : "rgba(243,132,26,0.05)",
                                                border: "1px solid rgba(243,132,26,0.2)",
                                                borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: "0.75rem",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.3rem" }}>
                                                    <span style={{ fontSize: "0.85rem" }}>🟠</span>
                                                    <span style={{ color: "#F27A1A", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                        Trendyol (Master)
                                                    </span>
                                                    <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: "monospace", marginLeft: "auto" }}>
                                                        ID: {current.masterId}
                                                    </span>
                                                </div>
                                                <div style={{ color: C.text, fontSize: "0.88rem", fontWeight: 700 }}>
                                                    {current.masterPath}
                                                </div>
                                            </div>

                                            {/* Hedef Platform */}
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: "0.3rem",
                                                marginBottom: "0.5rem",
                                            }}>
                                                <span style={{ color: C.dim, fontSize: "0.7rem" }}>→</span>
                                                <span style={{ fontSize: "0.85rem" }}>{platformInfo?.icon}</span>
                                                <span style={{ color: platformInfo?.color, fontSize: "0.75rem", fontWeight: 700 }}>
                                                    {platformInfo?.label}
                                                </span>
                                                <span style={{ color: C.dim, fontSize: "0.65rem" }}>eşleştirmesi:</span>
                                            </div>

                                            {/* Manuel mod değilse: Öneri + Alternatifler */}
                                            {!wizardManualMode ? (
                                                <div>
                                                    {/* Ana Öneri */}
                                                    <div
                                                        onClick={() => setWizardSelectedAlt(null)}
                                                        style={{
                                                            background: wizardSelectedAlt === null
                                                                ? `${platformInfo?.color}12`
                                                                : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                                            border: `2px solid ${wizardSelectedAlt === null ? platformInfo?.color : C.border}`,
                                                            borderRadius: 10, padding: "0.65rem 0.8rem", marginBottom: "0.4rem",
                                                            cursor: "pointer", transition: "all 0.15s",
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                            {wizardSelectedAlt === null && <FaCheck style={{ color: platformInfo?.color, fontSize: "0.65rem", flexShrink: 0 }} />}
                                                            <span style={{
                                                                background: `${platformInfo?.color}18`, color: platformInfo?.color,
                                                                fontSize: "0.55rem", fontWeight: 700, padding: "0.1rem 0.35rem",
                                                                borderRadius: 4, flexShrink: 0,
                                                            }}>
                                                                ÖNERİ — Skor: {current.suggestion.score}
                                                            </span>
                                                            <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: "monospace", marginLeft: "auto" }}>
                                                                ID: {current.suggestion.id}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: C.text, fontSize: "0.82rem", fontWeight: 600, marginTop: "0.25rem" }}>
                                                            {current.suggestion.path}
                                                        </div>
                                                    </div>

                                                    {/* Alternatifler */}
                                                    {current.alternatives && current.alternatives.length > 0 && (
                                                        <>
                                                            <div style={{ color: C.dim, fontSize: "0.6rem", fontWeight: 600, margin: "0.5rem 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                                Alternatifler
                                                            </div>
                                                            {current.alternatives.map((alt, ai) => (
                                                                <div
                                                                    key={ai}
                                                                    onClick={() => setWizardSelectedAlt(alt)}
                                                                    style={{
                                                                        background: wizardSelectedAlt?.id === alt.id
                                                                            ? `${platformInfo?.color}12`
                                                                            : "transparent",
                                                                        border: `1px solid ${wizardSelectedAlt?.id === alt.id ? platformInfo?.color : C.border}`,
                                                                        borderRadius: 8, padding: "0.45rem 0.7rem", marginBottom: "0.25rem",
                                                                        cursor: "pointer", transition: "all 0.12s",
                                                                    }}
                                                                >
                                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                        {wizardSelectedAlt?.id === alt.id && <FaCheck style={{ color: platformInfo?.color, fontSize: "0.55rem", flexShrink: 0 }} />}
                                                                        <span style={{ color: C.dim, fontSize: "0.52rem", fontWeight: 600 }}>
                                                                            Skor: {alt.score}
                                                                        </span>
                                                                        <span style={{ color: C.dim, fontSize: "0.52rem", fontFamily: "monospace", marginLeft: "auto" }}>
                                                                            ID: {alt.id}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ color: C.text, fontSize: "0.75rem", fontWeight: 500, marginTop: "0.15rem" }}>
                                                                        {alt.path}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                /* ── Manuel Arama Modu ── */
                                                <div>
                                                    <div style={{
                                                        display: "flex", alignItems: "center", gap: "0.4rem",
                                                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                                        border: `1px solid ${C.border}`, borderRadius: 8,
                                                        padding: "0.4rem 0.6rem", marginBottom: "0.5rem",
                                                    }}>
                                                        {wizardSearchLoading ? (
                                                            <FaSpinner style={{ color: platformInfo?.color, fontSize: "0.75rem", animation: "cc-spin 1s linear infinite", flexShrink: 0 }} />
                                                        ) : (
                                                            <FaSearch style={{ color: C.dim, fontSize: "0.75rem", flexShrink: 0 }} />
                                                        )}
                                                        <input
                                                            autoFocus
                                                            type="text" value={wizardSearchQuery}
                                                            onChange={(e) => wizardSearch(e.target.value)}
                                                            placeholder={`${platformInfo?.label} kategorisi ara...`}
                                                            style={{
                                                                flex: 1, background: "transparent", border: "none", outline: "none",
                                                                color: C.text, fontSize: "0.82rem", fontFamily: "inherit",
                                                            }}
                                                        />
                                                        {wizardSearchQuery && (
                                                            <FaTimes
                                                                style={{ color: C.dim, fontSize: "0.65rem", cursor: "pointer", flexShrink: 0 }}
                                                                onClick={() => { setWizardSearchQuery(""); setWizardSearchResults([]); }}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Arama Sonuçları */}
                                                    <div style={{ maxHeight: 250, overflowY: "auto" }}>
                                                        {wizardSearchResults.map((item, idx) => {
                                                            const isPicked = wizardSelectedAlt?.id === String(item.id);
                                                            const isSelectable = item.leaf === true || item.leaf === undefined || item.leaf === null;
                                                            return (
                                                                <div
                                                                    key={`${item.id}-${idx}`}
                                                                    onClick={() => {
                                                                        if (isSelectable) setWizardSelectedAlt({ id: String(item.id), path: item.path || item.name, name: item.name });
                                                                    }}
                                                                    style={{
                                                                        padding: "0.4rem 0.6rem", borderRadius: 6,
                                                                        cursor: isSelectable ? "pointer" : "not-allowed",
                                                                        opacity: isSelectable ? 1 : 0.5,
                                                                        background: isPicked ? `${platformInfo?.color}12` : "transparent",
                                                                        borderLeft: isPicked ? `3px solid ${platformInfo?.color}` : "3px solid transparent",
                                                                        marginBottom: "0.15rem", transition: "all 0.1s",
                                                                    }}
                                                                >
                                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                                        {isPicked && <FaCheck style={{ color: platformInfo?.color, fontSize: "0.55rem", flexShrink: 0 }} />}
                                                                        <span style={{ color: C.text, fontSize: "0.76rem", fontWeight: isPicked ? 700 : 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                            {item.name}
                                                                        </span>
                                                                        {item.leaf && (
                                                                            <span style={{ background: `${C.green}18`, color: C.green, fontSize: "0.48rem", fontWeight: 700, padding: "0.08rem 0.2rem", borderRadius: 3, flexShrink: 0 }}>
                                                                                LEAF
                                                                            </span>
                                                                        )}
                                                                        <span style={{ color: C.dim, fontSize: "0.52rem", fontFamily: "monospace", flexShrink: 0 }}>
                                                                            {item.id}
                                                                        </span>
                                                                    </div>
                                                                    {item.path && (
                                                                        <div style={{ color: C.dim, fontSize: "0.6rem", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                            {item.path}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {wizardSearchQuery.length >= 2 && wizardSearchResults.length === 0 && !wizardSearchLoading && (
                                                            <div style={{ padding: "1.5rem", textAlign: "center", color: C.dim, fontSize: "0.75rem" }}>
                                                                🔍 "{wizardSearchQuery}" için sonuç bulunamadı
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── Wizard Footer ── */}
                                {!wizardLoading && !isFinished && current && (
                                    <div style={{
                                        padding: "0.65rem 1rem", borderTop: `1px solid ${C.border}`,
                                        display: "flex", alignItems: "center", gap: "0.4rem",
                                        flexWrap: "wrap",
                                    }}>
                                        {/* Sol: Manuel / Öneriler toggle */}
                                        <button
                                            onClick={() => {
                                                setWizardManualMode(!wizardManualMode);
                                                setWizardSelectedAlt(null);
                                                setWizardSearchQuery("");
                                                setWizardSearchResults([]);
                                            }}
                                            style={{
                                                background: wizardManualMode ? `${C.accent}12` : "transparent",
                                                border: `1px solid ${wizardManualMode ? C.accent : C.border}`,
                                                borderRadius: 8, padding: "0.4rem 0.7rem", cursor: "pointer",
                                                color: wizardManualMode ? C.accent : C.text, fontSize: "0.72rem", fontWeight: 600,
                                                display: "flex", alignItems: "center", gap: "0.25rem",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {wizardManualMode ? (
                                                <><FaChevronLeft style={{ fontSize: "0.55rem" }} /> Önerilere Dön</>
                                            ) : (
                                                <><FaSearch style={{ fontSize: "0.55rem" }} /> Manuel Ara</>
                                            )}
                                        </button>

                                        <div style={{ flex: 1 }} />

                                        {/* Atla */}
                                        <button
                                            onClick={wizardSkip}
                                            style={{
                                                background: "transparent", border: `1px solid ${C.border}`,
                                                borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer",
                                                color: "#f59e0b", fontSize: "0.75rem", fontWeight: 600,
                                                display: "flex", alignItems: "center", gap: "0.25rem",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            Atla ⏭
                                        </button>

                                        {/* Onayla */}
                                        <button
                                            onClick={() => {
                                                const chosen = wizardSelectedAlt || current.suggestion;
                                                if (chosen) {
                                                    if (wizardManualMode) {
                                                        setWizardStats(prev => ({ ...prev, manual: prev.manual + 1 }));
                                                    }
                                                    wizardApprove(chosen.id, chosen.path || chosen.name);
                                                }
                                            }}
                                            disabled={wizardSaving || (wizardManualMode && !wizardSelectedAlt)}
                                            style={{
                                                background: (wizardManualMode && !wizardSelectedAlt)
                                                    ? `${C.muted}30`
                                                    : "linear-gradient(135deg, #22c55e, #16a34a)",
                                                border: "none", borderRadius: 8,
                                                padding: "0.4rem 1.2rem", cursor: (wizardSaving || (wizardManualMode && !wizardSelectedAlt)) ? "not-allowed" : "pointer",
                                                color: (wizardManualMode && !wizardSelectedAlt) ? C.dim : "#fff",
                                                fontSize: "0.78rem", fontWeight: 700,
                                                display: "flex", alignItems: "center", gap: "0.3rem",
                                                opacity: wizardSaving ? 0.6 : 1,
                                                boxShadow: (wizardManualMode && !wizardSelectedAlt) ? "none" : "0 3px 12px rgba(34,197,94,0.3)",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {wizardSaving ? <FaSpinner style={{ animation: "cc-spin 1s linear infinite" }} /> : <FaCheck />}
                                            Onayla ✓
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

            <style>{`@keyframes cc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default CategoryCenterPage;
