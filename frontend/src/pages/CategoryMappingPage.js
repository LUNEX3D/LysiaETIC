/**
 * KATEGORİ EŞLEŞTİRME MERKEZİ — LysiaETIC (v2 — Temiz & Kullanışlı)
 *
 * 4 Sekme:
 *   1. 📦 PY Kategorileri — Pazaryeri kategori ağaçlarını görüntüle & dışa aktar
 *   2. 🗺️ Ortak Merkez — Platformların Excel'lerini yükle, birleşik harita oluştur
 *   3. ✅ Eşleşen — Eşleşen kategorileri incele, düzenle, revize et
 *   4. 🔧 Manuel Eşleştir — Eksik platform eşleşmelerini tamamla
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    getMarketplaceCategories, getMarketplaceCategoriesTree,
    exportMarketplaceCategoriesExcel, exportMarketplaceCategoriesPDF,
    importUnifiedCategories, getUnifiedCategories, getUnifiedStats,
    deleteUnifiedCategory, exportUnifiedCategoriesExcel,
    suggestPlatformCategory, getIncompleteCategories, updateUnifiedCategory
} from "../services/categorySmartApi";
import { useApp } from "../context/AppContext";

/* ═══════════════════════════════════════════════════════════════════════════
   RENKLER & SABITLER
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

const PLATFORM_META = [
    { key: "trendyol",    label: "Trendyol",    icon: "🟠", color: "#f97316", mpName: "Trendyol" },
    { key: "n11",         label: "N11",         icon: "🟣", color: "#a855f7", mpName: "N11" },
    { key: "ciceksepeti", label: "ÇiçekSepeti", icon: "🌸", color: "#ec4899", mpName: "ÇiçekSepeti" },
    { key: "hepsiburada", label: "Hepsiburada", icon: "🟢", color: "#22c55e", mpName: "Hepsiburada" },
    { key: "amazon",      label: "Amazon",      icon: "🟡", color: "#f59e0b", mpName: "Amazon" },
];

const DEPTH_COLORS = [C.blue, C.teal, C.green, C.yellow, C.orange, C.red, C.purple, C.pink, C.accent];
const depthColor = (d) => DEPTH_COLORS[Math.min(d, DEPTH_COLORS.length - 1)];

/* ═══════════════════════════════════════════════════════════════════════════
   ORTAK MİNİ BİLEŞENLER
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

const Input = ({ value, onChange, placeholder, style = {}, ...rest }) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
            background: "#0f1117", border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: C.text, padding: "9px 14px", fontSize: 13,
            outline: "none", width: "100%", transition: "border .2s", ...style
        }}
        onFocus={e => { e.target.style.borderColor = C.accent + "60"; }}
        onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
        {...rest} />
);

const Msg = ({ msg, onClose }) => {
    if (!msg) return null;
    const isOk = msg.type === "success";
    return (
        <div style={{
            padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: isOk ? C.greenSoft : C.redSoft,
            color: isOk ? C.green : C.red,
            border: `1px solid ${isOk ? C.green : C.red}30`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12
        }}>
            <span>{isOk ? "✅" : "❌"} {msg.text}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEKME 1: 📦 PAZAR YERİ KATEGORİLERİ
   ═══════════════════════════════════════════════════════════════════════════ */

const TreeNode = ({ node, depth = 0, expandedNodes, toggleNode, searchQuery }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(String(node.id));
    const isMatched = node._matched;
    const dColor = depthColor(depth);

    const highlightText = (text) => {
        if (!searchQuery || !text) return text;
        const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase());
        if (idx === -1) return text;
        return (
            <span>
                {text.substring(0, idx)}
                <span style={{ background: "#f59e0b40", color: "#f59e0b", fontWeight: 800, borderRadius: 2, padding: "0 2px" }}>
                    {text.substring(idx, idx + searchQuery.length)}
                </span>
                {text.substring(idx + searchQuery.length)}
            </span>
        );
    };

    return (
        <div>
            <div
                onClick={() => hasChildren && toggleNode(String(node.id))}
                style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: `5px 8px 5px ${depth * 22 + 8}px`,
                    cursor: hasChildren ? "pointer" : "default",
                    borderRadius: 6, margin: "1px 0",
                    background: isMatched ? "#f59e0b12" : "transparent",
                    borderLeft: isMatched ? "2px solid #f59e0b" : "2px solid transparent",
                    transition: "background .1s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isMatched ? "#f59e0b18" : "rgba(99,102,241,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isMatched ? "#f59e0b12" : "transparent"; }}
            >
                {hasChildren ? (
                    <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        background: dColor + "18", color: dColor, fontSize: 10, fontWeight: 800,
                        transition: "transform .15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)"
                    }}>▶</span>
                ) : (
                    <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        background: C.greenSoft, color: C.green, fontSize: 10
                    }}>🍃</span>
                )}
                <span style={{ fontSize: 12, fontWeight: hasChildren ? 700 : 500, color: hasChildren ? C.text : C.textSub, flex: 1 }}>
                    {highlightText(node.name)}
                </span>
                {hasChildren && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: dColor, background: dColor + "14", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>
                        {node.children.length}
                    </span>
                )}
                <span style={{ fontSize: 9, fontFamily: "monospace", color: C.textDim, flexShrink: 0, opacity: 0.6 }}>#{node.id}</span>
            </div>
            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child, ci) => (
                        <TreeNode key={`${child.id}-${ci}`} node={child} depth={depth + 1}
                            expandedNodes={expandedNodes} toggleNode={toggleNode} searchQuery={searchQuery} />
                    ))}
                </div>
            )}
        </div>
    );
};

const MarketplaceCategoriesTab = () => {
    const [mpFilter, setMpFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [viewMode, setViewMode] = useState("tree");
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(null);

    // Tablo
    const [page, setPage] = useState(1);
    const [limit] = useState(100);
    const [data, setData] = useState(null);

    // Ağaç
    const [treeData, setTreeData] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [treeLoading, setTreeLoading] = useState(false);

    const fetchTableData = useCallback(async () => {
        if (viewMode !== "table") return;
        setLoading(true);
        try { setData(await getMarketplaceCategories(mpFilter, search, false, page, limit)); }
        catch { setData(null); }
        setLoading(false);
    }, [mpFilter, search, page, limit, viewMode]);

    const fetchTreeData = useCallback(async () => {
        if (viewMode !== "tree") return;
        setTreeLoading(true);
        try {
            const res = await getMarketplaceCategoriesTree(mpFilter, search);
            setTreeData(res);
            if (search && res?.trees) {
                const allIds = new Set();
                const collect = (nodes) => { for (const n of nodes) { if (n.children?.length) { allIds.add(String(n.id)); collect(n.children); } } };
                Object.values(res.trees).forEach(roots => collect(roots));
                setExpandedNodes(allIds);
            }
        } catch { setTreeData(null); }
        setTreeLoading(false);
    }, [mpFilter, search, viewMode]);

    useEffect(() => { fetchTableData(); }, [fetchTableData]);
    useEffect(() => { fetchTreeData(); }, [fetchTreeData]);

    const handleSearch = () => { setSearch(searchInput); setPage(1); };
    const handleClear = () => { setSearch(""); setSearchInput(""); setPage(1); };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const res = type === "excel"
                ? await exportMarketplaceCategoriesExcel(mpFilter, search, false)
                : await exportMarketplaceCategoriesPDF(mpFilter, search, false);
            const blob = new Blob([res.data], {
                type: type === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf"
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `kategoriler_${mpFilter}_${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) { alert(`Export hatası: ${err.message}`); }
        setExporting(null);
    };

    const toggleNode = useCallback((nodeId) => {
        setExpandedNodes(prev => { const next = new Set(prev); if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId); return next; });
    }, []);

    const expandAll = useCallback(() => {
        if (!treeData?.trees) return;
        const allIds = new Set();
        const collect = (nodes) => { for (const n of nodes) { if (n.children?.length) { allIds.add(String(n.id)); collect(n.children); } } };
        Object.values(treeData.trees).forEach(roots => collect(roots));
        setExpandedNodes(allIds);
    }, [treeData]);

    const collapseAll = useCallback(() => setExpandedNodes(new Set()), []);

    const summary = viewMode === "table" ? (data?.summary || {}) : (treeData?.summary || {});
    const total = viewMode === "table" ? (data?.total || 0) : (treeData?.totalCategories || 0);
    const totalPages = data?.totalPages || 1;
    const categories = data?.categories || [];
    const isLoading = viewMode === "tree" ? treeLoading : loading;

    const mpOptions = [
        { value: "all", label: "Tümü", icon: "🌐" },
        ...PLATFORM_META.map(p => ({ value: p.mpName, label: p.label, icon: p.icon }))
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Üst Bar */}
            <Card style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Görünüm */}
                    <div style={{ display: "flex", gap: 0, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                        {[{ key: "tree", label: "🌳 Ağaç", color: C.green }, { key: "table", label: "📋 Tablo", color: C.accent }].map(v => (
                            <button key={v.key} onClick={() => setViewMode(v.key)}
                                style={{
                                    background: viewMode === v.key ? v.color : "transparent",
                                    color: viewMode === v.key ? "#fff" : C.textDim,
                                    border: "none", padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer"
                                }}>{v.label}</button>
                        ))}
                    </div>

                    {/* Platform */}
                    <div style={{ display: "flex", gap: 3 }}>
                        {mpOptions.map(opt => (
                            <button key={opt.value} onClick={() => { setMpFilter(opt.value); setPage(1); setExpandedNodes(new Set()); }}
                                style={{
                                    background: mpFilter === opt.value ? C.accentSoft : "transparent",
                                    border: `1px solid ${mpFilter === opt.value ? C.accent : C.border}`,
                                    color: mpFilter === opt.value ? C.accent : C.textDim,
                                    borderRadius: 6, padding: "5px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 3
                                }}>{opt.icon} {opt.label}</button>
                        ))}
                    </div>

                    {/* Arama */}
                    <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 180 }}>
                        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder="Kategori ara..."
                            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 11, outline: "none" }} />
                        <Btn small onClick={handleSearch}>🔍</Btn>
                        {search && <Btn small outline color={C.red} onClick={handleClear}>✕</Btn>}
                    </div>

                    {/* Ağaç kontrolleri */}
                    {viewMode === "tree" && (
                        <div style={{ display: "flex", gap: 3 }}>
                            <Btn small outline color={C.green} onClick={expandAll}>Tümünü Aç</Btn>
                            <Btn small outline color={C.red} onClick={collapseAll}>Kapat</Btn>
                        </div>
                    )}

                    {/* Export */}
                    <Btn small color={C.green} onClick={() => handleExport("excel")} loading={exporting === "excel"} disabled={total === 0}>📊 Excel</Btn>
                    <Btn small color={C.red} onClick={() => handleExport("pdf")} loading={exporting === "pdf"} disabled={total === 0}>📄 PDF</Btn>
                </div>
            </Card>

            {/* Özet */}
            {Object.keys(summary).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(summary).map(([mp, info]) => {
                        const color = MP_COLORS[mp] || C.accent;
                        return (
                            <div key={mp} style={{ flex: "1 1 160px", background: color + "10", border: `1px solid ${color}30`, borderRadius: 10, padding: "10px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                    <span style={{ fontSize: 14 }}>{MP_ICONS[mp] || "📦"}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color }}>{mp}</span>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <div><div style={{ fontSize: 16, fontWeight: 800, color }}>{info.total || info.totalCategories || 0}</div><div style={{ fontSize: 9, color: C.textDim }}>Toplam</div></div>
                                    <div><div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{info.leaf || info.leafCount || 0}</div><div style={{ fontSize: 9, color: C.textDim }}>Yaprak</div></div>
                                </div>
                            </div>
                        );
                    })}
                    <div style={{ flex: "1 1 120px", background: C.accentSoft, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14 }}>🌐</span>
                        <div><div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{total}</div><div style={{ fontSize: 9, color: C.textDim }}>Toplam</div></div>
                    </div>
                </div>
            )}

            {/* Yükleniyor */}
            {isLoading && <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>⏳ Kategoriler yükleniyor...</div>}

            {/* Ağaç Görünümü */}
            {viewMode === "tree" && !treeLoading && treeData && (
                Object.keys(treeData.trees || {}).length > 0 ? (
                    Object.entries(treeData.trees).map(([mpName, roots]) => {
                        const mpColor = MP_COLORS[mpName] || C.accent;
                        const mpSummary = treeData.summary?.[mpName] || {};
                        return (
                            <Card key={mpName} style={{ padding: 0, overflow: "hidden" }}>
                                <div style={{ padding: "10px 16px", background: `${mpColor}10`, borderBottom: `1px solid ${mpColor}25`, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{MP_ICONS[mpName]}</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: mpColor }}>{mpName}</span>
                                    <Badge color={mpColor}>{mpSummary.totalCategories || roots.length}</Badge>
                                    <Badge color={C.green}>{mpSummary.leafCount || 0} yaprak</Badge>
                                </div>
                                <div style={{ padding: "6px 4px", maxHeight: 500, overflowY: "auto" }}>
                                    {roots.map((root, ri) => (
                                        <TreeNode key={`${root.id}-${ri}`} node={root} depth={0}
                                            expandedNodes={expandedNodes} toggleNode={toggleNode} searchQuery={search} />
                                    ))}
                                </div>
                            </Card>
                        );
                    })
                ) : (
                    <Card style={{ textAlign: "center", padding: 40 }}>
                        <div style={{ fontSize: 40 }}>📭</div>
                        <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>Kategori bulunamadı</div>
                    </Card>
                )
            )}

            {/* Tablo Görünümü */}
            {viewMode === "table" && !loading && categories.length > 0 && (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: C.surface, borderBottom: `2px solid ${C.border}` }}>
                                    {["Platform", "ID", "Kategori Adı", "Derinlik", "Üst Kategori", "Tür"].map(h => (
                                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c, i) => {
                                    const mpColor = MP_COLORS[c.marketplace] || C.accent;
                                    const dColor = depthColor(c.depth || 0);
                                    return (
                                        <tr key={`${c.marketplace}-${c.id}-${i}`} style={{ borderBottom: `1px solid ${C.border}` }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.04)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                            <td style={{ padding: "8px 12px" }}><Badge color={mpColor}>{MP_ICONS[c.marketplace]} {c.marketplace}</Badge></td>
                                            <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>{c.id}</td>
                                            <td style={{ padding: "8px 12px", fontWeight: 600, color: C.text }}>{c.name}</td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, background: dColor + "18", color: dColor, fontSize: 10, fontWeight: 800 }}>{c.depth ?? 0}</span>
                                            </td>
                                            <td style={{ padding: "8px 12px", color: C.textSub, fontSize: 11 }}>{c.parentName || "— Kök —"}</td>
                                            <td style={{ padding: "8px 12px" }}>{c.isLeaf ? <Badge color={C.green}>🍃 Yaprak</Badge> : <Badge color={C.yellow}>📂 Üst</Badge>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Sayfalama */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 11, color: C.textDim }}>Toplam {total} · Sayfa {page}/{totalPages}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                            <Btn small outline disabled={page <= 1} onClick={() => setPage(1)}>⏮</Btn>
                            <Btn small outline disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</Btn>
                            <Btn small outline disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>▶</Btn>
                            <Btn small outline disabled={page >= totalPages} onClick={() => setPage(totalPages)}>⏭</Btn>
                        </div>
                    </div>
                </Card>
            )}

            {viewMode === "table" && !loading && categories.length === 0 && data && (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>📭</div>
                    <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>Kategori bulunamadı</div>
                </Card>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEKME 2: 🗺️ ORTAK MERKEZ — Unified Category Map
   ═══════════════════════════════════════════════════════════════════════════ */

const UnifiedCategoryTab = ({ onRefresh }) => {
    const [stats, setStats] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [matchType, setMatchType] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [pagination, setPagination] = useState(null);
    const [msg, setMsg] = useState(null);

    // Import dosyaları
    const fileRefs = useRef({});
    const [files, setFiles] = useState({});
    const [clearExisting, setClearExisting] = useState(false);

    // Detay modal
    const [selectedCat, setSelectedCat] = useState(null);

    const loadStats = useCallback(async () => {
        try { setStats((await getUnifiedStats()).stats); } catch { /* */ }
    }, []);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getUnifiedCategories({ search, matchType, page, limit });
            setCategories(res.categories || []);
            setPagination(res.pagination || null);
        } catch { setCategories([]); }
        setLoading(false);
    }, [search, matchType, page, limit]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadCategories(); }, [loadCategories]);

    const handleImport = async () => {
        const hasFile = Object.values(files).some(Boolean);
        if (!hasFile) { setMsg({ type: "error", text: "En az bir platform Excel dosyası seçin!" }); return; }
        if (!window.confirm(`Import başlatılsın mı?${clearExisting ? "\n⚠️ Mevcut veriler silinecek!" : ""}`)) return;

        setImporting(true); setMsg(null);
        try {
            const formData = new FormData();
            if (files.trendyol) formData.append("trendyol", files.trendyol);
            if (files.n11) formData.append("n11", files.n11);
            if (files.ciceksepeti) formData.append("ciceksepeti", files.ciceksepeti);
            if (files.hepsiburada) formData.append("hepsiburada", files.hepsiburada);
            if (files.amazon) formData.append("amazon", files.amazon);
            formData.append("clearExisting", clearExisting ? "true" : "false");

            const res = await importUnifiedCategories(formData);
            setMsg({ type: "success", text: `Import başarılı! Yeni: ${res.result.dbResult.inserted}, Güncellenen: ${res.result.dbResult.updated}` });
            setFiles({}); setClearExisting(false);
            Object.values(fileRefs.current).forEach(ref => { if (ref) ref.value = ""; });
            loadStats(); loadCategories(); onRefresh?.();
        } catch (err) { setMsg({ type: "error", text: err.response?.data?.message || err.message }); }
        setImporting(false);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await exportUnifiedCategoriesExcel({ matchType });
            const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `birlesik_kategoriler_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (err) { alert(`Export hatası: ${err.message}`); }
        setExporting(false);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" silinsin mi?`)) return;
        try { await deleteUnifiedCategory(id); loadCategories(); loadStats(); }
        catch (err) { alert(`Hata: ${err.message}`); }
    };

    const mtColor = (t) => t === "exact" ? C.green : t === "2of3" ? C.yellow : t === "single" ? C.red : t === "manual" ? C.purple : C.textDim;
    const mtLabel = (t) => t === "exact" ? "3+ Platform ✓" : t === "2of3" ? "2 Platform" : t === "single" ? "Tek Platform" : t === "manual" ? "Manuel" : t;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Açıklama */}
            <Card style={{ background: C.accentSoft, border: `1px solid ${C.accent}30`, padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 24 }}>🗺️</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Ortak Kategori Merkezi</div>
                        <div style={{ color: C.textSub, fontSize: 11, lineHeight: 1.5 }}>
                            Platformların Excel dosyalarını yükleyin, sistem kategori adlarını normalize ederek otomatik eşleştirir.
                            <strong> Ürün dağıtımında bu harita kullanılır.</strong>
                        </div>
                    </div>
                </div>
            </Card>

            <Msg msg={msg} onClose={() => setMsg(null)} />

            {/* İstatistikler */}
            {stats && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                        { val: stats.total, label: "Toplam", color: C.accent },
                        { val: stats.exact3, label: "3+ Ortak", color: C.green },
                        { val: stats.match2, label: "2 Ortak", color: C.yellow },
                        { val: stats.single, label: "Tekil", color: C.red },
                    ].map(s => (
                        <div key={s.label} style={{ background: s.color + "10", border: `1px solid ${s.color}30`, borderRadius: 8, padding: "8px 14px" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                    <div style={{ borderLeft: `1px solid ${C.border}`, margin: "0 2px" }} />
                    {PLATFORM_META.map(p => (
                        <div key={p.key} style={{ background: p.color + "10", border: `1px solid ${p.color}30`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12 }}>{p.icon}</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{stats.platforms?.[p.key] || 0}</div>
                                <div style={{ fontSize: 9, color: C.textDim }}>{p.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Import */}
            <Card>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📤 Excel Import</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
                    {PLATFORM_META.map(p => (
                        <div key={p.key}>
                            <label style={{ fontSize: 10, color: C.textSub, fontWeight: 600, display: "block", marginBottom: 3 }}>{p.icon} {p.label}</label>
                            <input type="file" accept=".xlsx,.xls" ref={el => { fileRefs.current[p.key] = el; }}
                                onChange={e => setFiles(prev => ({ ...prev, [p.key]: e.target.files[0] || null }))}
                                style={{ width: "100%", padding: 5, fontSize: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }} />
                            {files[p.key] && <div style={{ fontSize: 9, color: C.green, marginTop: 2 }}>✅ {files[p.key].name}</div>}
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSub, cursor: "pointer" }}>
                        <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} />
                        ⚠️ Sıfırdan oluştur
                    </label>
                    <Btn onClick={handleImport} loading={importing} disabled={!Object.values(files).some(Boolean)}>📤 İçe Aktar</Btn>
                </div>
            </Card>

            {/* Filtreler */}
            <Card style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 180, display: "flex", gap: 4 }}>
                        <Input value={searchInput} onChange={setSearchInput} placeholder="Kategori ara..."
                            onKeyDown={e => e.key === "Enter" && (() => { setSearch(searchInput); setPage(1); })()} style={{ fontSize: 12, padding: "7px 10px" }} />
                        <Btn small onClick={() => { setSearch(searchInput); setPage(1); }}>Ara</Btn>
                        {search && <Btn small outline color={C.red} onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>✕</Btn>}
                    </div>
                    <select value={matchType} onChange={e => { setMatchType(e.target.value); setPage(1); }}
                        style={{ padding: "7px 10px", fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, outline: "none" }}>
                        <option value="">Tüm Eşleşmeler</option>
                        <option value="exact">✅ 3+ Platform</option>
                        <option value="2of3">🟡 2 Platform</option>
                        <option value="single">🔴 Tek</option>
                        <option value="manual">🟣 Manuel</option>
                    </select>
                    <Btn small color={C.green} onClick={handleExport} loading={exporting}>📥 Excel</Btn>
                    <Btn small outline onClick={() => { loadStats(); loadCategories(); }}>🔄</Btn>
                </div>
            </Card>

            {/* Tablo */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                        <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                            {["Ortak Ad", "Kök", "Durum", ...PLATFORM_META.map(p => p.icon), "İşlem"].map(h => (
                                <th key={h} style={{ padding: "9px 10px", textAlign: h === "Ortak Ad" || h === "Kök" ? "left" : "center", color: C.textSub, fontWeight: 700, fontSize: 10 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="9" style={{ padding: 32, textAlign: "center", color: C.textDim }}>⏳ Yükleniyor...</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan="9" style={{ padding: 32, textAlign: "center", color: C.textDim }}>
                                {stats?.total === 0 ? "Henüz veri yok — yukarıdan Excel yükleyin." : "Sonuç yok."}
                            </td></tr>
                        ) : categories.map(cat => (
                            <tr key={cat._id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.cardHover; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                onClick={() => setSelectedCat(cat)}>
                                <td style={{ padding: "9px 10px", color: C.text, fontWeight: 600, maxWidth: 280 }}>
                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.canonicalName}</div>
                                    {cat.canonicalPath && <div style={{ fontSize: 9, color: C.textDim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{cat.canonicalPath}</div>}
                                </td>
                                <td style={{ padding: "9px 10px", color: C.textSub, fontSize: 10 }}>{cat.rootCategory || "—"}</td>
                                <td style={{ padding: "9px 10px", textAlign: "center" }}><Badge color={mtColor(cat.matchType)}>{mtLabel(cat.matchType)}</Badge></td>
                                {PLATFORM_META.map(p => (
                                    <td key={p.key} style={{ padding: "9px 6px", textAlign: "center", fontSize: 12 }}>
                                        {cat[p.key]?.categoryId ? <span style={{ color: C.green }}>✅</span> : <span style={{ color: C.textDim }}>❌</span>}
                                    </td>
                                ))}
                                <td style={{ padding: "9px 8px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                    <Btn small outline color={C.red} onClick={() => handleDelete(cat._id, cat.canonicalName)}>🗑️</Btn>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {pagination && pagination.totalPages > 1 && (
                    <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: C.textDim }}>{pagination.page}/{pagination.totalPages} — {pagination.total} kategori</span>
                        <div style={{ display: "flex", gap: 4 }}>
                            <Btn small outline disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</Btn>
                            <Btn small outline disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</Btn>
                        </div>
                    </div>
                )}
            </div>

            {/* Detay Modal */}
            {selectedCat && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}
                    onClick={() => setSelectedCat(null)}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, maxWidth: 750, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 20 }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>{selectedCat.canonicalName}</h3>
                                {selectedCat.canonicalPath && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{selectedCat.canonicalPath}</div>}
                                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                    <Badge color={mtColor(selectedCat.matchType)}>{mtLabel(selectedCat.matchType)}</Badge>
                                    <Badge color={C.accent}>{selectedCat.platformCount}/5 Platform</Badge>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCat(null)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 18, cursor: "pointer" }}>✕</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                            {PLATFORM_META.map(p => {
                                const d = selectedCat[p.key];
                                return (
                                    <div key={p.key} style={{ background: C.surface, border: `1px solid ${d?.categoryId ? p.color + "40" : C.border}`, borderRadius: 8, padding: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                                            {p.icon} {p.label} <span style={{ marginLeft: "auto" }}>{d?.categoryId ? "✅" : "❌"}</span>
                                        </div>
                                        {d?.categoryId ? (
                                            <div>
                                                <div style={{ fontSize: 10, color: C.textDim }}>ID: {d.categoryId}</div>
                                                <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginTop: 2 }}>{d.categoryName}</div>
                                                <div style={{ fontSize: 9, color: C.textSub, marginTop: 2, lineHeight: 1.4 }}>{(d.categoryPath || "").split(" > ").join(" › ")}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10, color: C.textDim, padding: "6px 0", textAlign: "center" }}>Eşleşme yok</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEKME 3: ✅ EŞLEŞEN KATEGORİLER
   ═══════════════════════════════════════════════════════════════════════════ */

const MatchedCategoriesTab = ({ onRefresh }) => {
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [matchType, setMatchType] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [pagination, setPagination] = useState(null);

    // Düzenleme modal
    const [editCat, setEditCat] = useState(null);
    const [editName, setEditName] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editedPlatforms, setEditedPlatforms] = useState({});
    const [editingPlatform, setEditingPlatform] = useState(null);
    const [platformSearch, setPlatformSearch] = useState("");
    const [platformResults, setPlatformResults] = useState([]);
    const [platformLoading, setPlatformLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadStats = useCallback(async () => {
        try { setStats((await getUnifiedStats()).stats); } catch { /* */ }
    }, []);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getUnifiedCategories({ search, matchType, page, limit });
            setCategories(res.categories || []);
            setPagination(res.pagination || null);
        } catch { setCategories([]); }
        setLoading(false);
    }, [search, matchType, page, limit]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadCategories(); }, [loadCategories]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" silinsin mi?`)) return;
        try { await deleteUnifiedCategory(id); loadCategories(); loadStats(); } catch { /* */ }
    };

    const openEdit = (cat) => {
        setEditCat(cat);
        setEditName(cat.canonicalName || "");
        setEditNotes(cat.notes || "");
        setEditedPlatforms({});
        setEditingPlatform(null);
        setPlatformResults([]);
        setPlatformSearch("");
    };

    const searchPlatform = async (mpName, query) => {
        if (!query || query.length < 2) { setPlatformResults([]); return; }
        setPlatformLoading(true);
        try { setPlatformResults((await getMarketplaceCategories(mpName, query, false, 1, 50)).categories || []); }
        catch { setPlatformResults([]); }
        setPlatformLoading(false);
    };

    const selectPlatform = (cat) => {
        if (!editingPlatform) return;
        setEditedPlatforms(prev => ({
            ...prev,
            [editingPlatform]: {
                categoryId: String(cat.id), categoryName: cat.name,
                categoryPath: cat.path || cat.name, depth: cat.depth || 0,
                parentId: cat.parentId || null, parentName: cat.parentName || null,
                isLeaf: cat.isLeaf !== undefined ? cat.isLeaf : true
            }
        }));
        setEditingPlatform(null); setPlatformResults([]); setPlatformSearch("");
    };

    const removePlatform = (key) => setEditedPlatforms(prev => ({ ...prev, [key]: null }));

    const handleSave = async () => {
        if (!editCat) return;
        setSaving(true);
        try {
            const body = { canonicalName: editName, notes: editNotes };
            PLATFORM_META.forEach(p => { if (editedPlatforms[p.key] !== undefined) body[p.key] = editedPlatforms[p.key]; });
            await updateUnifiedCategory(editCat._id, body);
            setEditCat(null); loadCategories(); loadStats(); onRefresh?.();
        } catch (err) { alert(`Hata: ${err.response?.data?.message || err.message}`); }
        setSaving(false);
    };

    const getPlatformData = (key) => editedPlatforms[key] !== undefined ? editedPlatforms[key] : editCat?.[key] || null;

    const mtColor = (t) => t === "exact" ? C.green : t === "2of3" ? C.yellow : t === "single" ? C.red : t === "manual" ? C.purple : C.textDim;
    const mtLabel = (t) => t === "exact" ? "3/3" : t === "2of3" ? "2/3" : t === "single" ? "1/3" : t === "manual" ? "Manuel" : t;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Bilgi */}
            <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>
                Eşleşen kategorileri inceleyin, eksik platformları manuel olarak eşleştirin. <strong>Ürün dağıtımında bu eşleşmeler otomatik kullanılır.</strong>
            </div>

            {/* Özet */}
            {stats && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                        { val: stats.total, label: "Toplam", mt: "" },
                        { val: stats.exact3, label: "3/3", mt: "exact" },
                        { val: stats.match2, label: "2/3", mt: "2of3" },
                        { val: stats.single, label: "1/3", mt: "single" },
                    ].map(s => (
                        <div key={s.label} onClick={() => { setMatchType(matchType === s.mt ? "" : s.mt); setPage(1); }}
                            style={{
                                padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                                background: matchType === s.mt ? C.accent + "18" : C.surface,
                                border: `1px solid ${matchType === s.mt ? C.accent + "50" : C.border}`,
                                transition: "all .15s"
                            }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: matchType === s.mt ? C.accent : C.text }}>{s.val}</span>
                            <span style={{ fontSize: 10, color: C.textDim, marginLeft: 6 }}>{s.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Arama */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Input value={searchInput} onChange={setSearchInput} placeholder="Kategori ara..."
                    onKeyDown={e => e.key === "Enter" && (() => { setSearch(searchInput); setPage(1); })()}
                    style={{ flex: 1, fontSize: 12, padding: "7px 12px" }} />
                <Btn small onClick={() => { setSearch(searchInput); setPage(1); }}>Ara</Btn>
                {search && <Btn small outline color={C.red} onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>✕</Btn>}
                <Btn small outline onClick={() => { loadStats(); loadCategories(); }}>🔄</Btn>
            </div>

            {/* Tablo */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: C.surface }}>
                            <th style={{ padding: "9px 12px", textAlign: "left", color: C.textSub, fontWeight: 600, fontSize: 11 }}>Kategori</th>
                            <th style={{ padding: "9px 8px", textAlign: "center", color: C.textSub, fontWeight: 600, fontSize: 11, width: 50 }}>Durum</th>
                            {PLATFORM_META.map(p => (
                                <th key={p.key} style={{ padding: "9px 6px", textAlign: "center", color: p.color, fontWeight: 600, fontSize: 11, width: 36 }}>{p.icon.charAt(0) === "🟠" ? "T" : p.label.charAt(0)}</th>
                            ))}
                            <th style={{ padding: "9px 8px", textAlign: "center", width: 60 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ padding: 32, textAlign: "center", color: C.textDim }}>⏳ Yükleniyor...</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan="8" style={{ padding: 32, textAlign: "center", color: C.textDim }}>Sonuç yok.</td></tr>
                        ) : categories.map(cat => (
                            <tr key={cat._id} style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer", transition: "background .1s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                onClick={() => openEdit(cat)}>
                                <td style={{ padding: "8px 12px" }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{cat.canonicalName}</div>
                                    {cat.rootCategory && <span style={{ fontSize: 10, color: C.textDim }}>{cat.rootCategory}</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: mtColor(cat.matchType) }}>{mtLabel(cat.matchType)}</span>
                                </td>
                                {PLATFORM_META.map(p => (
                                    <td key={p.key} style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                        {cat[p.key]?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                    </td>
                                ))}
                                <td style={{ padding: "8px 8px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                                        <button onClick={() => openEdit(cat)} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", fontSize: 12 }}>✏️</button>
                                        <button onClick={() => handleDelete(cat._id, cat.canonicalName)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12 }}>🗑</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {pagination && pagination.totalPages > 1 && (
                    <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: C.textDim }}>{pagination.page}/{pagination.totalPages} · {pagination.total} kayıt</span>
                        <div style={{ display: "flex", gap: 4 }}>
                            <Btn small outline disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</Btn>
                            <Btn small outline disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</Btn>
                        </div>
                    </div>
                )}
            </div>

            {/* Düzenleme Modal */}
            {editCat && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}
                    onClick={() => setEditCat(null)}>
                    <div style={{ background: "#141820", border: `1px solid ${C.border}`, borderRadius: 10, width: "94%", maxWidth: 800, maxHeight: "88vh", overflow: "auto", padding: "20px 24px" }}
                        onClick={e => e.stopPropagation()}>
                        {/* Başlık */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                    style={{ width: "100%", padding: "6px 10px", fontSize: 14, fontWeight: 700, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, outline: "none" }} />
                                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                                    <Badge color={mtColor(editCat.matchType)}>{mtLabel(editCat.matchType)}</Badge>
                                    {editCat.rootCategory && <span style={{ fontSize: 10, color: C.textDim }}>{editCat.rootCategory}</span>}
                                    {Object.keys(editedPlatforms).length > 0 && <span style={{ fontSize: 10, color: C.yellow, fontWeight: 600, marginLeft: "auto" }}>● Değişiklik var</span>}
                                </div>
                            </div>
                            <button onClick={() => setEditCat(null)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 18, cursor: "pointer", marginLeft: 12 }}>✕</button>
                        </div>

                        {/* Platform Kartları */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 14 }}>
                            {PLATFORM_META.map(p => {
                                const data = getPlatformData(p.key);
                                const isEdited = editedPlatforms[p.key] !== undefined;
                                const isPicking = editingPlatform === p.key;

                                return (
                                    <div key={p.key} style={{
                                        background: C.bg, borderRadius: 8, padding: 10,
                                        border: `1px solid ${isEdited ? C.yellow + "60" : data?.categoryId ? p.color + "30" : C.border}`
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.icon} {p.label}</span>
                                            <span style={{ fontSize: 10, color: data?.categoryId ? C.green : C.red }}>{data?.categoryId ? "✓" : "✗"}</span>
                                        </div>

                                        {data?.categoryId ? (
                                            <div style={{ marginBottom: 6 }}>
                                                <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{data.categoryName}</div>
                                                <div style={{ fontSize: 9, color: C.textDim }}>{(data.categoryPath || "").split(" > ").join(" › ")}</div>
                                                <div style={{ fontSize: 9, color: C.textDim }}>ID: {data.categoryId}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>Eşleşme yok</div>
                                        )}

                                        {!isPicking && (
                                            <div style={{ display: "flex", gap: 3 }}>
                                                <button onClick={() => { setEditingPlatform(p.key); setPlatformSearch(""); setPlatformResults([]); }}
                                                    style={{ flex: 1, padding: "4px 0", fontSize: 10, fontWeight: 600, background: p.color + "12", color: p.color, border: `1px solid ${p.color}30`, borderRadius: 5, cursor: "pointer" }}>
                                                    {data?.categoryId ? "Değiştir" : "Seç"}
                                                </button>
                                                {data?.categoryId && (
                                                    <button onClick={() => removePlatform(p.key)}
                                                        style={{ padding: "4px 6px", fontSize: 10, background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 5, cursor: "pointer" }}>✗</button>
                                                )}
                                            </div>
                                        )}

                                        {isPicking && (
                                            <div style={{ marginTop: 4 }}>
                                                <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                                                    <input value={platformSearch} onChange={e => setPlatformSearch(e.target.value)}
                                                        onKeyDown={e => e.key === "Enter" && searchPlatform(p.mpName, platformSearch)}
                                                        placeholder="Ara..." autoFocus
                                                        style={{ flex: 1, padding: "4px 6px", fontSize: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, outline: "none" }} />
                                                    <button onClick={() => searchPlatform(p.mpName, platformSearch)} disabled={platformLoading}
                                                        style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, background: p.color, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                                                        {platformLoading ? "..." : "Ara"}
                                                    </button>
                                                </div>
                                                {platformResults.length > 0 && (
                                                    <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 4 }}>
                                                        {platformResults.map((cat, idx) => (
                                                            <div key={cat.id || idx} onClick={() => selectPlatform(cat)}
                                                                style={{ padding: "5px 6px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                                                <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{cat.name}</div>
                                                                <div style={{ fontSize: 9, color: C.textDim }}>ID: {cat.id} · {cat.isLeaf ? "Yaprak" : "Üst"}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <button onClick={() => { setEditingPlatform(null); setPlatformResults([]); }}
                                                    style={{ width: "100%", marginTop: 3, padding: "3px 0", fontSize: 9, background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer" }}>İptal</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Not */}
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            placeholder="Not ekleyin (isteğe bağlı)..." rows={2}
                            style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, resize: "vertical", outline: "none", marginBottom: 14, boxSizing: "border-box" }} />

                        {/* Kaydet */}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {Object.keys(editedPlatforms).length > 0 && <span style={{ fontSize: 10, color: C.yellow, marginRight: "auto" }}>{Object.keys(editedPlatforms).length} değişiklik</span>}
                            <Btn outline color={C.textSub} onClick={() => setEditCat(null)}>İptal</Btn>
                            <Btn onClick={handleSave} loading={saving}>💾 Kaydet</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEKME 4: 🔧 MANUEL EŞLEŞTİR — Eksik platform eşleşmelerini tamamla
   ═══════════════════════════════════════════════════════════════════════════ */

const ManualMatchTab = ({ onRefresh }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [limit] = useState(30);
    const [missingPlatform, setMissingPlatform] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");

    const [expandedId, setExpandedId] = useState(null);
    const [activePlatform, setActivePlatform] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [sugLoading, setSugLoading] = useState(false);
    const [sugSearch, setSugSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const sugTimerRef = useRef(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getIncompleteCategories({ missingPlatform: missingPlatform || undefined, page, limit });
            setCategories(res.categories || []);
            setPagination(res.pagination || null);
            setStats(res.summary || null);
        } catch { setCategories([]); }
        setLoading(false);
    }, [missingPlatform, page, limit]);

    const loadSearchData = useCallback(async () => {
        if (!search) { loadData(); return; }
        setLoading(true);
        try {
            const res = await getUnifiedCategories({ search, page, limit });
            const incomplete = (res.categories || []).filter(c => c.platformCount < 5).map(cat => {
                const missing = [], existing = [];
                PLATFORM_META.forEach(p => { if (cat[p.key]?.categoryId) existing.push(p.key); else missing.push(p.key); });
                return { ...cat, missingPlatforms: missing, existingPlatforms: existing, completionRate: Math.round((existing.length / 5) * 100) };
            });
            setCategories(incomplete);
            setPagination(res.pagination || null);
        } catch { setCategories([]); }
        setLoading(false);
    }, [search, page, limit, loadData]);

    useEffect(() => { if (search) loadSearchData(); else loadData(); }, [search, loadData, loadSearchData]);

    // Öneri arama (debounced)
    useEffect(() => {
        if (!expandedId || !activePlatform || !sugSearch.trim() || sugSearch.trim().length < 2) { setSuggestions([]); return; }
        if (sugTimerRef.current) clearTimeout(sugTimerRef.current);
        sugTimerRef.current = setTimeout(async () => {
            setSugLoading(true);
            try {
                const mp = PLATFORM_META.find(p => p.key === activePlatform);
                setSuggestions((await suggestPlatformCategory(sugSearch.trim(), mp?.mpName || activePlatform, 8)).suggestions || []);
            } catch { setSuggestions([]); }
            setSugLoading(false);
        }, 400);
        return () => { if (sugTimerRef.current) clearTimeout(sugTimerRef.current); };
    }, [sugSearch, expandedId, activePlatform]);

    const handleMatch = async (cat, platformKey, match) => {
        setSaving(true); setMsg(null);
        try {
            const body = {};
            body[platformKey] = {
                categoryId: String(match.categoryId || match.id),
                categoryName: match.categoryName || match.name,
                categoryPath: match.categoryPath || match.path || "",
                depth: match.depth || 0, parentId: match.parentId || null,
                parentName: match.parentName || null,
                isLeaf: match.isLeaf !== undefined ? match.isLeaf : true
            };
            await updateUnifiedCategory(cat._id, body);
            setMsg({ type: "success", text: `✅ "${cat.canonicalName}" → ${PLATFORM_META.find(p => p.key === platformKey)?.label}: "${match.categoryName || match.name}" eşleştirildi!` });

            setCategories(prev => prev.map(c => {
                if (c._id !== cat._id) return c;
                const updated = { ...c, [platformKey]: body[platformKey] };
                updated.missingPlatforms = (c.missingPlatforms || []).filter(p => p !== platformKey);
                updated.existingPlatforms = [...(c.existingPlatforms || []), platformKey];
                updated.platformCount = (c.platformCount || 0) + 1;
                if (updated.missingPlatforms.length === 0) return null;
                return updated;
            }).filter(Boolean));

            const remaining = (cat.missingPlatforms || []).filter(p => p !== platformKey);
            if (remaining.length > 0) { setActivePlatform(remaining[0]); setSugSearch(cat.canonicalName || ""); setSuggestions([]); }
            else { setExpandedId(null); setActivePlatform(null); setSugSearch(""); setSuggestions([]); }
            onRefresh?.();
        } catch (err) { setMsg({ type: "error", text: err?.response?.data?.message || err.message }); }
        setSaving(false);
    };

    const handleAutoSuggest = async (cat, platformKey) => {
        setExpandedId(cat._id);
        setActivePlatform(platformKey);
        setSugSearch(cat.canonicalName || "");
        setSuggestions([]);
        setSugLoading(true);
        try {
            const mp = PLATFORM_META.find(p => p.key === platformKey);
            setSuggestions((await suggestPlatformCategory(cat.canonicalName || "", mp?.mpName || platformKey, 8)).suggestions || []);
        } catch { setSuggestions([]); }
        setSugLoading(false);
    };

    const toggleRow = (cat) => {
        if (expandedId === cat._id) { setExpandedId(null); setActivePlatform(null); setSugSearch(""); setSuggestions([]); return; }
        setExpandedId(cat._id);
        const first = (cat.missingPlatforms || [])[0] || null;
        setActivePlatform(first);
        setSugSearch(cat.canonicalName || "");
        setSuggestions([]);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Açıklama */}
            <Card style={{ background: C.orangeSoft, border: `1px solid ${C.orange}30`, padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 22 }}>🔧</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Manuel Eşleştirme</div>
                        <div style={{ color: C.textSub, fontSize: 11, lineHeight: 1.5 }}>
                            Eksik platform eşleşmelerini tamamlayın. Bir kategoriye tıklayın, eksik platformu seçin ve uygun kategoriyi arayıp eşleştirin.
                        </div>
                    </div>
                </div>
            </Card>

            <Msg msg={msg} onClose={() => setMsg(null)} />

            {/* İstatistik + Filtreler */}
            <Card style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {stats && (
                        <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
                            <Badge color={C.red}>{stats.totalIncomplete || 0} eksik</Badge>
                            <Badge color={C.accent}>Ort. %{stats.avgCompletionRate || 0}</Badge>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 3 }}>
                        <Btn small outline={missingPlatform !== ""} color={C.textSub} onClick={() => { setMissingPlatform(""); setPage(1); }} style={{ padding: "4px 8px", fontSize: 10 }}>Tümü</Btn>
                        {PLATFORM_META.map(p => (
                            <Btn key={p.key} small outline={missingPlatform !== p.key} color={p.color}
                                onClick={() => { setMissingPlatform(missingPlatform === p.key ? "" : p.key); setPage(1); }}
                                style={{ padding: "4px 8px", fontSize: 10 }}>{p.icon}</Btn>
                        ))}
                    </div>

                    <div style={{ flex: 1, minWidth: 150, display: "flex", gap: 4 }}>
                        <Input value={searchInput} onChange={setSearchInput} placeholder="Kategori ara..."
                            onKeyDown={e => e.key === "Enter" && (() => { setSearch(searchInput); setPage(1); })()}
                            style={{ fontSize: 11, padding: "6px 10px" }} />
                        <Btn small onClick={() => { setSearch(searchInput); setPage(1); }}>🔍</Btn>
                        {search && <Btn small outline color={C.red} onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>✕</Btn>}
                    </div>

                    <Btn small outline onClick={() => { if (search) loadSearchData(); else loadData(); }}>🔄</Btn>
                </div>
            </Card>

            {/* Liste */}
            {loading ? (
                <div style={{ textAlign: "center", color: C.textDim, padding: 40 }}>⏳ Yükleniyor...</div>
            ) : categories.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 50 }}>
                    <div style={{ fontSize: 48 }}>🎉</div>
                    <div style={{ color: C.green, fontWeight: 700, fontSize: 16, marginTop: 10 }}>
                        {search ? "Aramayla eşleşen eksik kategori yok" : "Tüm kategoriler tamamlanmış!"}
                    </div>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {categories.map(cat => {
                        const isExpanded = expandedId === cat._id;
                        const missing = cat.missingPlatforms || [];
                        const existing = cat.existingPlatforms || [];

                        return (
                            <Card key={cat._id} style={{ padding: 0, overflow: "hidden", border: isExpanded ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`, transition: "all .15s" }}>
                                {/* Satır */}
                                <div onClick={() => toggleRow(cat)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                                        cursor: "pointer", background: isExpanded ? "rgba(99,102,241,0.04)" : "transparent", transition: "background .15s"
                                    }}
                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? "rgba(99,102,241,0.04)" : "transparent"; }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{cat.canonicalName}</div>
                                        {cat.rootCategory && <span style={{ color: C.textDim, fontSize: 10 }}>{cat.rootCategory}</span>}
                                    </div>
                                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                                        {PLATFORM_META.map(p => {
                                            const has = existing.includes(p.key);
                                            const miss = missing.includes(p.key);
                                            return (
                                                <div key={p.key}
                                                    onClick={e => { if (miss) { e.stopPropagation(); handleAutoSuggest(cat, p.key); } }}
                                                    title={has ? `${p.label}: ✅` : `${p.label}: ❌ Eksik`}
                                                    style={{
                                                        width: 26, height: 26, borderRadius: 6,
                                                        background: has ? p.color + "18" : "rgba(255,255,255,0.02)",
                                                        border: `1.5px solid ${has ? p.color + "50" : miss ? C.red + "40" : C.border}`,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: 11, cursor: miss ? "pointer" : "default"
                                                    }}>
                                                    {has ? <span>{p.icon}</span> : <span style={{ color: C.red, fontSize: 10, fontWeight: 800 }}>+</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <Badge color={missing.length >= 3 ? C.red : missing.length >= 2 ? C.orange : C.yellow}>{missing.length} eksik</Badge>
                                    <span style={{ color: C.textDim, fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▼</span>
                                </div>

                                {/* Genişletilmiş Panel */}
                                {isExpanded && (
                                    <div style={{ padding: "0 16px 16px 16px", borderTop: `1px solid ${C.border}` }}>
                                        <div style={{ paddingTop: 12 }} />
                                        {/* Platform sekmeleri */}
                                        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                                            {missing.map(pKey => {
                                                const pm = PLATFORM_META.find(p => p.key === pKey);
                                                if (!pm) return null;
                                                const isActive = activePlatform === pKey;
                                                return (
                                                    <button key={pKey} onClick={() => { setActivePlatform(pKey); setSugSearch(cat.canonicalName || ""); setSuggestions([]); }}
                                                        style={{
                                                            background: isActive ? pm.color + "15" : "rgba(255,255,255,0.02)",
                                                            border: `1.5px solid ${isActive ? pm.color : C.border}`,
                                                            borderRadius: 8, padding: "7px 12px", cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: 5, transition: "all .15s"
                                                        }}>
                                                        <span style={{ fontSize: 13 }}>{pm.icon}</span>
                                                        <span style={{ color: isActive ? pm.color : C.textSub, fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{pm.label}</span>
                                                        <span style={{ color: C.red, fontSize: 9 }}>eksik</span>
                                                    </button>
                                                );
                                            })}
                                            {existing.length > 0 && (
                                                <>
                                                    <div style={{ width: 1, background: C.border, margin: "0 4px" }} />
                                                    {existing.map(pKey => {
                                                        const pm = PLATFORM_META.find(p => p.key === pKey);
                                                        if (!pm) return null;
                                                        return (
                                                            <div key={pKey} title={`${pm.label}: ${cat[pKey]?.categoryName || "?"}`}
                                                                style={{ background: pm.color + "10", border: `1px solid ${pm.color}25`, borderRadius: 8, padding: "7px 10px", display: "flex", alignItems: "center", gap: 4, opacity: 0.7 }}>
                                                                <span style={{ fontSize: 11 }}>{pm.icon}</span>
                                                                <span style={{ color: C.textDim, fontSize: 10, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat[pKey]?.categoryName || "?"}</span>
                                                                <span style={{ color: C.green, fontSize: 9 }}>✓</span>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </div>

                                        {/* Arama & Sonuçlar */}
                                        {activePlatform && (() => {
                                            const pm = PLATFORM_META.find(p => p.key === activePlatform);
                                            if (!pm) return null;
                                            return (
                                                <div style={{ padding: 12, borderRadius: 10, background: pm.color + "06", border: `1.5px solid ${pm.color}25` }}>
                                                    <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                                                        <span style={{ fontSize: 14 }}>{pm.icon}</span>
                                                        <span style={{ color: pm.color, fontSize: 12, fontWeight: 700 }}>{pm.label} kategorisi seçin</span>
                                                        <div style={{ flex: 1 }} />
                                                        <Btn small outline color={C.textDim} onClick={() => { setExpandedId(null); setActivePlatform(null); }}>Kapat</Btn>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                                        <Input value={sugSearch} onChange={setSugSearch}
                                                            placeholder={`${pm.label} kategorisi ara...`} style={{ flex: 1 }} />
                                                        <Btn small color={pm.color} onClick={() => handleAutoSuggest(cat, activePlatform)} loading={sugLoading}>🔍 Öner</Btn>
                                                    </div>

                                                    {sugLoading ? (
                                                        <div style={{ color: C.textDim, fontSize: 11, padding: 14, textAlign: "center" }}>🔍 Aranıyor...</div>
                                                    ) : suggestions.length > 0 ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                                                            {suggestions.map((match, i) => {
                                                                const mName = match.categoryName || match.name || "—";
                                                                const mPath = match.categoryPath || match.path || "";
                                                                const mScore = typeof match.score === "number" ? match.score : 0;
                                                                const scoreColor = mScore >= 0.7 ? C.green : mScore >= 0.45 ? C.yellow : C.orange;
                                                                return (
                                                                    <button key={i} onClick={() => handleMatch(cat, activePlatform, match)} disabled={saving}
                                                                        style={{
                                                                            background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                                                                            borderRadius: 8, padding: "10px 14px", cursor: saving ? "wait" : "pointer",
                                                                            textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "all .1s"
                                                                        }}
                                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = pm.color + "60"; e.currentTarget.style.background = pm.color + "08"; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                                                                        <div style={{ width: 24, height: 24, borderRadius: 6, background: pm.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: pm.color, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{mName}</div>
                                                                            {mPath && mPath !== mName && <div style={{ color: C.textDim, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mPath}</div>}
                                                                            {match.isLeaf !== undefined && <span style={{ fontSize: 9, color: match.isLeaf ? C.green : C.yellow }}>{match.isLeaf ? "🍃 Yaprak" : "📂 Üst"}</span>}
                                                                        </div>
                                                                        <div style={{ minWidth: 60 }}>
                                                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                                                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                                                                                    <div style={{ width: `${Math.round(mScore * 100)}%`, height: "100%", background: scoreColor, borderRadius: 2 }} />
                                                                                </div>
                                                                                <span style={{ color: scoreColor, fontSize: 10, fontWeight: 700 }}>%{Math.round(mScore * 100)}</span>
                                                                            </div>
                                                                        </div>
                                                                        <span style={{ color: C.green, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{saving ? "⏳" : "✅"}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : sugSearch.trim().length >= 2 ? (
                                                        <div style={{ color: C.textDim, fontSize: 11, padding: 14, textAlign: "center" }}>Sonuç bulunamadı — farklı kelimeler deneyin</div>
                                                    ) : (
                                                        <div style={{ color: C.textDim, fontSize: 11, padding: 14, textAlign: "center" }}>En az 2 karakter girin veya "Öner" butonuna tıklayın</div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Sayfalama */}
            {pagination && pagination.totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>Sayfa {pagination.page}/{pagination.totalPages} · {pagination.total} eksik</span>
                    <div style={{ display: "flex", gap: 4 }}>
                        <Btn small outline disabled={page <= 1} onClick={() => setPage(1)}>⏮</Btn>
                        <Btn small outline disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</Btn>
                        <Btn small outline disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</Btn>
                        <Btn small outline disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}>⏭</Btn>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ANA SAYFA BİLEŞENİ
   ═══════════════════════════════════════════════════════════════════════════ */

const CategoryMappingPage = () => {
    const { theme: _theme } = useApp();
    void _theme;
    const [tab, setTab] = useState("marketplace");

    const tabs = [
        { key: "marketplace", label: "PY Kategorileri",  icon: "📦" },
        { key: "unified",     label: "Ortak Merkez",     icon: "🗺️" },
        { key: "matched",     label: "Eşleşen",          icon: "✅" },
        { key: "manual",      label: "Manuel Eşleştir",  icon: "🔧" },
    ];

    return (
        <div style={{
            minHeight: "100vh", background: C.bg, color: C.text,
            fontFamily: "'Inter', -apple-system, sans-serif", padding: "16px 20px"
        }}>
            {/* Başlık */}
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 2px 0" }}>
                    Kategori Eşleştirme Merkezi
                </h1>
                <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>
                    Pazaryeri kategorilerini yönetin, eşleştirin ve ürün dağıtımı için hazırlayın.
                </p>
            </div>

            {/* Sekmeler */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                {tabs.map(t => {
                    const isActive = tab === t.key;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{
                                background: "transparent",
                                border: "none",
                                borderBottom: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
                                color: isActive ? C.text : C.textDim,
                                padding: "10px 20px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                                cursor: "pointer", transition: "all .15s",
                                display: "flex", alignItems: "center", gap: 6
                            }}>
                            <span style={{ fontSize: 13 }}>{t.icon}</span>
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Sekme İçerikleri */}
            {tab === "marketplace" && <MarketplaceCategoriesTab />}
            {tab === "unified"     && <UnifiedCategoryTab onRefresh={() => {}} />}
            {tab === "matched"     && <MatchedCategoriesTab onRefresh={() => {}} />}
            {tab === "manual"      && <ManualMatchTab onRefresh={() => {}} />}
        </div>
    );
};

export default CategoryMappingPage;
