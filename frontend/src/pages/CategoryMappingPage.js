/**
 * KATEGORİ EŞLEŞTİRME MERKEZİ — LysiaETIC
 *
 * 3 Sekme:
 *   1. 📦 PY Kategorileri — Pazaryeri kategori ağaçlarını görüntüle & dışa aktar
 *   2. 🗺️ Ortak Merkez — 3 platformun Excel'lerini yükle, birleşik harita oluştur
 *   3. ✅ Eşleşen — Eşleşen kategorileri incele, düzenle, revize et
 *
 * Ürün dağıtımında UnifiedCategoryMap baz alınır:
 *   Ürün yüklenirken kategori adı → UnifiedCategoryMap'ten hedef platform ID'si bulunur.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    getInternalCategories, createInternalCategory, updateInternalCategory,
    deleteInternalCategory, seedInternalCategories,
    getCategoryMappings, saveCategoryMapping, bulkSaveMappings, deleteCategoryMapping,
    autoMatchCategory, learnCategory,
    getCategoryMemory, deleteCategoryMemory, getCategoryStats,
    fuzzyMatchCategory, autoMapAllCategories, getPlatformCategories, crossPlatformMatch,
    getUnmappedCategories, resolveUnmappedCategory, autoResolveUnmapped,
    smartResolve, smartResolveBatch, getResolverStats,
    getMarketplaceCategories, exportMarketplaceCategoriesExcel, exportMarketplaceCategoriesPDF,
    importUnifiedCategories, getUnifiedCategories, getUnifiedStats,
    mergeUnifiedCategories, deleteUnifiedCategory, exportUnifiedCategoriesExcel
} from "../services/categorySmartApi";

// ─── Renkler ────────────────────────────────────────────────────────────────
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

const MP_COLORS = { Trendyol: "#f97316", Hepsiburada: "#eab308", N11: "#a855f7", Amazon: "#f59e0b", "ÇiçekSepeti": "#ec4899" };
const MP_ICONS  = { Trendyol: "🟠", Hepsiburada: "🟡", N11: "🟣", Amazon: "🔶", "ÇiçekSepeti": "🌸" };
const ALL_MARKETPLACES = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];
const SOURCE_LABELS = {
    manual: { label: "Manuel", icon: "👤", color: C.blue },
    auto_fuzzy: { label: "Otomatik", icon: "🤖", color: C.green },
    auto_cross_platform: { label: "Çapraz", icon: "🔄", color: C.purple },
    auto_ai: { label: "AI", icon: "🧠", color: C.teal },
    auto_keyword: { label: "Anahtar Kelime", icon: "🔑", color: C.yellow },
    bulk_auto: { label: "Toplu", icon: "📦", color: C.orange },
};

// ─── Mini Bileşenler ────────────────────────────────────────────────────────
const Badge = ({ color, children, style }) => (
    <span style={{ background: color + "18", color, border: `1px solid ${color}30`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, ...style }}>{children}</span>
);

const Btn = ({ onClick, color = C.accent, outline, disabled, loading, small, children, style = {} }) => (
    <button onClick={onClick} disabled={disabled || loading}
        style={{
            background: outline ? "transparent" : color, color: outline ? color : "#fff",
            border: `1.5px solid ${color}`, borderRadius: 8,
            padding: small ? "5px 12px" : "8px 18px", fontSize: small ? 11 : 12, fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
            display: "inline-flex", alignItems: "center", gap: 6, transition: "all .15s", ...style
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
        style={{ background: "#0f1117", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: C.text, padding: "9px 14px", fontSize: 13, outline: "none", width: "100%", transition: "border .2s", ...style }}
        onFocus={e => { e.target.style.borderColor = C.accent + "60"; }} onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
        {...rest} />
);

const ScoreBar = ({ score, small }) => {
    const pct = Math.round((typeof score === "number" ? score : 0) * 100);
    const color = pct >= 80 ? C.green : pct >= 50 ? C.yellow : pct >= 30 ? "#f97316" : C.red;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: small ? 4 : 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s ease" }} />
            </div>
            <span style={{ color, fontSize: small ? 10 : 11, fontWeight: 700, minWidth: 28 }}>{pct}%</span>
        </div>
    );
};

const ConfidenceMeter = ({ level, score }) => {
    const config = {
        strong: { color: C.green, label: "Güçlü", icon: "✅" },
        medium: { color: C.yellow, label: "Orta", icon: "⚡" },
        weak:   { color: C.red, label: "Zayıf", icon: "⚠️" },
        none:   { color: C.textDim, label: "Yok", icon: "❌" }
    };
    const c = config[level] || config.none;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{c.icon}</span>
            <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.round(score * 100)}%`, height: "100%", background: c.color, borderRadius: 3, transition: "width .5s ease" }} />
            </div>
            <span style={{ color: c.color, fontSize: 12, fontWeight: 700, minWidth: 36 }}>{Math.round(score * 100)}%</span>
            <Badge color={c.color}>{c.label}</Badge>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 1: GENEL BAKIŞ
// ═══════════════════════════════════════════════════════════════════════════════
const OverviewTab = ({ stats, mappings, categories, onAutoMapAll, autoMapLoading, onSwitchTab }) => {
    const st = stats || {};
    const coverage = st.mappingCoverage || {};

    // Son eşleştirmeleri hesapla
    const recentMappings = [];
    for (const group of (mappings || [])) {
        const mps = group.marketplaces || {};
        for (const mp of Object.keys(mps)) {
            const d = mps[mp];
            recentMappings.push({
                catName: group.internalCategory?.name || "?",
                catIcon: group.internalCategory?.icon || "📁",
                mp,
                mpCatName: d.marketplaceCategoryName,
                source: d.matchSource,
                score: d.confidenceScore,
                isManual: d.isManualOverride,
                updatedAt: d.updatedAt
            });
        }
    }
    recentMappings.sort((a, b) => (b.updatedAt || "") > (a.updatedAt || "") ? 1 : -1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* İstatistik Kartları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {[
                    { icon: "📁", label: "Dahili Kategori", val: st.totalInternalCategories || 0, color: C.accent },
                    { icon: "🔗", label: "Toplam Mapping", val: st.totalMappings || 0, color: C.teal },
                    { icon: "👤", label: "Manuel", val: st.manualMappings || 0, color: C.blue },
                    { icon: "🤖", label: "Otomatik", val: st.autoMappings || 0, color: C.green },
                    { icon: "🧠", label: "Ogrenilen", val: st.totalMemories || 0, color: C.purple },
                    { icon: "⚠️", label: "Eslesmeyen", val: st.totalUnmapped || 0, color: C.red },
                    { icon: "✅", label: "Cozulmus", val: st.totalResolvedUnmapped || 0, color: C.green },
                    { icon: "📦", label: "Toplam Urun", val: st.totalProducts || 0, color: C.yellow },
                ].map(k => (
                    <Card key={k.label} style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${k.color}`, padding: "14px 16px" }}>
                        <span style={{ fontSize: 22 }}>{k.icon}</span>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                            <div style={{ color: C.textDim, fontSize: 10, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Pazaryeri Kapsama + Hizli Aksiyonlar yan yana */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Pazaryeri Kapsama Oranlari */}
                <Card>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📊</span>
                            <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Platform Kapsama</span>
                        </div>
                        <Btn small color={C.green} onClick={onAutoMapAll} loading={autoMapLoading}>
                            🤖 Tumunu Esle
                        </Btn>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {ALL_MARKETPLACES.map(mp => {
                            const data = coverage[mp] || { mapped: 0, total: st.totalInternalCategories || 0, percentage: 0 };
                            return (
                                <div key={mp} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 14, width: 20 }}>{MP_ICONS[mp]}</span>
                                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600, width: 90 }}>{mp}</span>
                                    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                                        <div style={{ width: `${data.percentage}%`, height: "100%", background: MP_COLORS[mp], borderRadius: 4, transition: "width .5s" }} />
                                    </div>
                                    <span style={{ color: MP_COLORS[mp], fontSize: 11, fontWeight: 700, minWidth: 70, textAlign: "right" }}>
                                        {data.mapped}/{data.total} ({data.percentage}%)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Hizli Aksiyonlar */}
                <Card>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>⚡</span> Hizli Aksiyonlar
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { key: "unmapped", icon: "⚠️", label: "Eslesmeyen Kategoriler", desc: "Urun dagitiminda basarisiz olan kategorileri cozun", color: C.orange, bg: C.orangeSoft },
                            { key: "mapping", icon: "🔗", label: "Kategori Eslestir", desc: "Dahili kategorileri pazaryerleriyle eslestirin", color: C.accent, bg: C.accentSoft },
                            { key: "cross", icon: "🔄", label: "Capraz Eslestirme", desc: "Bir platformu baz alarak digerleriyle eslestirin", color: C.purple, bg: C.purpleSoft },
                            { key: "categories", icon: "📁", label: "Kategori Yonet", desc: "Dahili kategorileri ekleyin, duzenleyin", color: C.teal, bg: C.tealSoft },
                            { key: "auto", icon: "🤖", label: "Otomatik Eslestir", desc: "Urun bilgisiyle otomatik kategori bulun", color: C.green, bg: C.greenSoft },
                        ].map(a => (
                            <button key={a.key} onClick={() => onSwitchTab(a.key)}
                                style={{ background: a.bg, border: `1px solid ${a.color}25`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, transition: "all .15s" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = a.color + "60"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = a.color + "25"; }}>
                                <span style={{ fontSize: 22 }}>{a.icon}</span>
                                <div>
                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{a.label}</div>
                                    <div style={{ color: C.textDim, fontSize: 10, marginTop: 1 }}>{a.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Acil Cozulmesi Gerekenler */}
            {st.urgentUnmapped && st.urgentUnmapped.length > 0 && (
                <Card style={{ borderLeft: `3px solid ${C.red}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>🔥</span>
                            <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Acil Cozulmesi Gerekenler</span>
                            <Badge color={C.red}>{st.urgentUnmapped.length} kategori</Badge>
                        </div>
                        <Btn small color={C.orange} onClick={() => onSwitchTab("unmapped")}>
                            ⚠️ Tumu Gor
                        </Btn>
                    </div>
                    <div style={{ color: C.textDim, fontSize: 11, marginBottom: 12 }}>
                        En cok urun dagitimi sirasinda basarisiz olan kategoriler (hit sayisina gore)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {st.urgentUnmapped.map((item, idx) => (
                            <div key={item._id} style={{
                                background: "rgba(239,68,68,0.08)",
                                border: `1px solid ${C.red}30`,
                                borderRadius: 8,
                                padding: "10px 12px",
                                display: "flex",
                                alignItems: "center",
                                gap: 10
                            }}>
                                <Badge color={C.red} style={{ minWidth: 24, justifyContent: "center" }}>
                                    #{idx + 1}
                                </Badge>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14 }}>{MP_ICONS[item.marketplace] || "📦"}</span>
                                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{item.categoryName}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Badge color={MP_COLORS[item.marketplace] || C.accent} style={{ fontSize: 10 }}>
                                            {item.marketplace}
                                        </Badge>
                                        <span style={{ color: C.textDim, fontSize: 10 }}>
                                            {item.hitCount} kez basarisiz
                                        </span>
                                        {item.sampleProducts && item.sampleProducts.length > 0 && (
                                            <span style={{ color: C.textDim, fontSize: 10 }}>
                                                • {item.sampleProducts.length} ornek urun
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Btn small color={C.green} onClick={() => onSwitchTab("unmapped")}>
                                    Coz
                                </Btn>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Son Eslestirmeler Tablosu */}
            {recentMappings.length > 0 && (
                <Card>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                        <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Tum Eslestirmeler</span>
                        <Badge color={C.accent}>{recentMappings.length} kayit</Badge>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {["Dahili Kategori", "Platform", "Platform Kategorisi", "Kaynak", "Skor"].map(h => (
                                        <th key={h} style={{ color: C.textDim, fontSize: 10, fontWeight: 700, padding: "8px 12px", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentMappings.slice(0, 50).map((m, i) => {
                                    const src = SOURCE_LABELS[m.source] || SOURCE_LABELS.manual;
                                    return (
                                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                            <td style={{ padding: "8px 12px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{ fontSize: 14 }}>{m.catIcon}</span>
                                                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{m.catName}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <Badge color={MP_COLORS[m.mp] || C.accent}>{MP_ICONS[m.mp]} {m.mp}</Badge>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <span style={{ color: C.text, fontSize: 12 }}>{m.mpCatName}</span>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <Badge color={src.color}>{src.icon} {src.label}</Badge>
                                            </td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <ScoreBar score={m.score} small />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 2: EŞLEŞTİRME (ANA EKRAN) — Tamamen yeniden tasarlandı
// ═══════════════════════════════════════════════════════════════════════════════
const MappingTab = ({ categories, mappings: parentMappings, onRefresh }) => {
    const [mappings, setMappings]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [selectedCat, setSelectedCat]   = useState(null);
    const [filterMP, setFilterMP]         = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // all, mapped, unmapped, auto, manual
    const [search, setSearch]             = useState("");
    const [editMode, setEditMode]         = useState(null);
    const [editSearch, setEditSearch]     = useState("");
    const [editResults, setEditResults]   = useState([]);
    const [editLoading, setEditLoading]   = useState(false);
    const [saving, setSaving]             = useState(false);
    const [msg, setMsg]                   = useState(null);
    const searchTimerRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCategoryMappings("");
            setMappings(res.mappings || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Fuzzy arama — debounced
    useEffect(() => {
        if (!editMode || !editSearch.trim() || editSearch.trim().length < 2) {
            setEditResults([]);
            return;
        }
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
            setEditLoading(true);
            try {
                const res = await fuzzyMatchCategory(editSearch.trim(), editMode, 10);
                setEditResults(res.matches || []);
            } catch { setEditResults([]); }
            setEditLoading(false);
        }, 400);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [editSearch, editMode]);

    const handleSelectMapping = async (cat, marketplace, match) => {
        setSaving(true);
        setMsg(null);
        try {
            await saveCategoryMapping({
                internalCategoryId: cat._id,
                marketplace,
                marketplaceCategoryId: match.categoryId,
                marketplaceCategoryName: match.categoryName,
                marketplaceCategoryPath: match.categoryPath || ""
            });
            setMsg({ type: "success", text: `${cat.name} -> ${marketplace}: ${match.categoryName} kaydedildi!` });
            setEditMode(null);
            setEditSearch("");
            setEditResults([]);
            load();
            onRefresh();
        } catch (e) {
            setMsg({ type: "error", text: e?.response?.data?.message || "Kaydetme hatasi" });
        }
        setSaving(false);
    };

    const handleDeleteMapping = async (id) => {
        try { await deleteCategoryMapping(id); load(); onRefresh(); } catch { /* ignore */ }
    };

    // Mapping'leri kategori bazli map'e cevir
    const mappingMap = {};
    for (const group of mappings) {
        if (group.internalCategory?._id) {
            mappingMap[group.internalCategory._id] = group;
        }
    }

    // Kategorileri filtrele
    const filteredCats = (categories || []).filter(c => {
        // Metin arama
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
            !(c.keywords || []).some(k => k.includes(search.toLowerCase()))) return false;

        const group = mappingMap[c._id];
        const mpData = group?.marketplaces || {};
        const mappedCount = Object.keys(mpData).length;

        // Platform filtresi
        if (filterMP && !mpData[filterMP]) return false;

        // Durum filtresi
        if (filterStatus === "mapped" && mappedCount === 0) return false;
        if (filterStatus === "unmapped" && mappedCount >= ALL_MARKETPLACES.length) return false;
        if (filterStatus === "auto") {
            const hasAuto = Object.values(mpData).some(d => !d.isManualOverride);
            if (!hasAuto) return false;
        }
        if (filterStatus === "manual") {
            const hasManual = Object.values(mpData).some(d => d.isManualOverride);
            if (!hasManual) return false;
        }

        return true;
    });

    // Ozet istatistikler
    const totalCats = (categories || []).length;
    const totalMapped = (categories || []).filter(c => {
        const g = mappingMap[c._id];
        return g && Object.keys(g.marketplaces || {}).length > 0;
    }).length;
    const totalFull = (categories || []).filter(c => {
        const g = mappingMap[c._id];
        return g && Object.keys(g.marketplaces || {}).length >= ALL_MARKETPLACES.length;
    }).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Ozet Bar */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: C.accent, fontSize: 13, fontWeight: 800 }}>{totalCats}</span>
                        <span style={{ color: C.textDim, fontSize: 10 }}>Kategori</span>
                    </div>
                    <div style={{ background: C.greenSoft, border: `1px solid ${C.green}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: C.green, fontSize: 13, fontWeight: 800 }}>{totalMapped}</span>
                        <span style={{ color: C.textDim, fontSize: 10 }}>Eslesmis</span>
                    </div>
                    <div style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: C.yellow, fontSize: 13, fontWeight: 800 }}>{totalFull}</span>
                        <span style={{ color: C.textDim, fontSize: 10 }}>Tam</span>
                    </div>
                    <div style={{ background: C.redSoft, border: `1px solid ${C.red}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: C.red, fontSize: 13, fontWeight: 800 }}>{totalCats - totalMapped}</span>
                        <span style={{ color: C.textDim, fontSize: 10 }}>Bos</span>
                    </div>
                </div>
            </div>

            {/* Filtre Bar */}
            <Card style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Input value={search} onChange={setSearch} placeholder="Kategori ara..." style={{ maxWidth: 220, flex: 1 }} />

                    <div style={{ height: 24, width: 1, background: C.border }} />

                    {/* Durum Filtresi */}
                    <div style={{ display: "flex", gap: 3 }}>
                        {[
                            { key: "all", label: "Tumu", color: C.accent },
                            { key: "mapped", label: "Eslesmis", color: C.green },
                            { key: "unmapped", label: "Eksik", color: C.red },
                            { key: "auto", label: "Otomatik", color: C.teal },
                            { key: "manual", label: "Manuel", color: C.blue },
                        ].map(f => (
                            <Btn key={f.key} small outline={filterStatus !== f.key} color={f.color}
                                onClick={() => setFilterStatus(f.key)} style={{ padding: "4px 10px", fontSize: 10 }}>
                                {f.label}
                            </Btn>
                        ))}
                    </div>

                    <div style={{ height: 24, width: 1, background: C.border }} />

                    {/* Platform Filtresi */}
                    <div style={{ display: "flex", gap: 3 }}>
                        <Btn small outline={filterMP !== ""} color={C.textSub} onClick={() => setFilterMP("")} style={{ padding: "4px 8px", fontSize: 10 }}>Tum Platform</Btn>
                        {ALL_MARKETPLACES.map(mp => (
                            <Btn key={mp} small outline={filterMP !== mp} color={MP_COLORS[mp]} onClick={() => setFilterMP(filterMP === mp ? "" : mp)} style={{ padding: "4px 8px", fontSize: 10 }}>
                                {MP_ICONS[mp]}
                            </Btn>
                        ))}
                    </div>
                </div>
            </Card>

            {msg && (
                <div style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: msg.type === "success" ? C.greenSoft : C.redSoft, color: msg.type === "success" ? C.green : C.red, border: `1px solid ${msg.type === "success" ? C.green : C.red}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{msg.text}</span>
                    <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>x</button>
                </div>
            )}

            {/* Kategori Listesi */}
            {loading ? (
                <div style={{ textAlign: "center", color: C.textDim, padding: 40 }}>Yukleniyor...</div>
            ) : filteredCats.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>📭</div>
                    <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>
                        {totalCats === 0 ? "Henuz kategori yok" : "Filtreye uygun kategori bulunamadi"}
                    </div>
                    <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>
                        {totalCats === 0 ? "Kategoriler sekmesinden dahili kategorileri olusturun" : "Filtre kriterlerini degistirin"}
                    </div>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {filteredCats.map(cat => {
                        const group = mappingMap[cat._id];
                        const isSelected = selectedCat === cat._id;
                        const mpData = group?.marketplaces || {};
                        const mappedCount = Object.keys(mpData).length;

                        return (
                            <Card key={cat._id} style={{
                                padding: 0,
                                border: isSelected ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                                overflow: "hidden",
                                transition: "all .15s"
                            }}>
                                {/* Kategori Basligi */}
                                <div
                                    onClick={() => setSelectedCat(isSelected ? null : cat._id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                                        cursor: "pointer", background: isSelected ? "rgba(99,102,241,0.04)" : "transparent",
                                        transition: "background .15s"
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                                >
                                    <span style={{ fontSize: 22 }}>{cat.icon || "📁"}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{cat.name}</div>
                                        {cat.keywords?.length > 0 && (
                                            <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                                                {cat.keywords.slice(0, 4).map((kw, i) => (
                                                    <span key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, padding: "0 5px", fontSize: 9, color: C.textDim }}>{kw}</span>
                                                ))}
                                                {cat.keywords.length > 4 && <span style={{ color: C.textDim, fontSize: 9 }}>+{cat.keywords.length - 4}</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Platform mini ikonlari — hangileri eslesmis */}
                                    <div style={{ display: "flex", gap: 3, marginRight: 8 }}>
                                        {ALL_MARKETPLACES.map(mp => {
                                            const d = mpData[mp];
                                            const src = d ? (SOURCE_LABELS[d.matchSource] || SOURCE_LABELS.manual) : null;
                                            return (
                                                <div key={mp} title={d ? `${mp}: ${d.marketplaceCategoryName} (${src?.label})` : `${mp}: Eslesmemis`}
                                                    style={{
                                                        width: 26, height: 26, borderRadius: 6,
                                                        background: d ? (MP_COLORS[mp] + "18") : "rgba(255,255,255,0.03)",
                                                        border: `1.5px solid ${d ? MP_COLORS[mp] + "50" : C.border}`,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: 12, position: "relative"
                                                    }}>
                                                    {d ? MP_ICONS[mp] : <span style={{ color: C.textDim, fontSize: 10 }}>-</span>}
                                                    {d && !d.isManualOverride && (
                                                        <span style={{ position: "absolute", top: -3, right: -3, fontSize: 8, background: C.card, borderRadius: "50%", width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${src?.color || C.green}` }}>
                                                            {src?.icon?.charAt(0) || "A"}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <Badge color={mappedCount >= 5 ? C.green : mappedCount >= 3 ? C.yellow : mappedCount > 0 ? C.orange : C.red}>
                                        {mappedCount}/{ALL_MARKETPLACES.length}
                                    </Badge>
                                    <span style={{ color: C.textDim, fontSize: 12, transform: isSelected ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>&#9660;</span>
                                </div>

                                {/* Genisletilmis Platform Eslesmeleri */}
                                {isSelected && (
                                    <div style={{ padding: "0 16px 14px 16px", display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${C.border}` }}>
                                        <div style={{ paddingTop: 12 }} />
                                        {ALL_MARKETPLACES.map(mp => {
                                            const data = mpData[mp];
                                            const isEditing = editMode === mp && selectedCat === cat._id;
                                            const src = data ? (SOURCE_LABELS[data.matchSource] || SOURCE_LABELS.manual) : null;

                                            return (
                                                <div key={mp} style={{
                                                    background: data ? (MP_COLORS[mp] + "06") : "rgba(255,255,255,0.015)",
                                                    border: `1px solid ${data ? (MP_COLORS[mp] + "20") : C.border}`,
                                                    borderRadius: 10, padding: "10px 14px",
                                                    borderLeft: `3px solid ${data ? MP_COLORS[mp] : "rgba(255,255,255,0.05)"}`
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ fontSize: 16 }}>{MP_ICONS[mp]}</span>
                                                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700, width: 90 }}>{mp}</span>

                                                        {data ? (
                                                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{data.marketplaceCategoryName}</div>
                                                                    <div style={{ display: "flex", gap: 4, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                                                                        {data.marketplaceCategoryId && (
                                                                            <span style={{ color: C.textDim, fontSize: 9, background: "rgba(255,255,255,0.04)", padding: "0 4px", borderRadius: 3 }}>ID: {data.marketplaceCategoryId}</span>
                                                                        )}
                                                                        <Badge color={src.color} style={{ fontSize: 9, padding: "1px 6px" }}>{src.icon} {src.label}</Badge>
                                                                        {typeof data.confidenceScore === "number" && (
                                                                            <span style={{ color: data.confidenceScore >= 0.8 ? C.green : data.confidenceScore >= 0.5 ? C.yellow : C.red, fontSize: 10, fontWeight: 700 }}>
                                                                                %{Math.round(data.confidenceScore * 100)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Btn small outline color={C.accent} onClick={(e) => { e.stopPropagation(); setEditMode(mp); setEditSearch(cat.name); }} style={{ padding: "3px 8px", fontSize: 10 }}>Degistir</Btn>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteMapping(data._id); }}
                                                                    style={{ background: C.redSoft, border: `1px solid ${C.red}20`, color: C.red, cursor: "pointer", fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}
                                                                    title="Sil">Sil</button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ color: C.textDim, fontSize: 12, flex: 1, fontStyle: "italic" }}>Eslestirme yok</span>
                                                                <Btn small color={MP_COLORS[mp]} onClick={(e) => { e.stopPropagation(); setEditMode(mp); setEditSearch(cat.name); }}>
                                                                    + Eslestir
                                                                </Btn>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Duzenleme / Arama Paneli */}
                                                    {isEditing && (
                                                        <div style={{ marginTop: 10, padding: 12, background: "rgba(0,0,0,0.25)", borderRadius: 10, border: `1px solid ${MP_COLORS[mp]}20` }}>
                                                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                                                <Input
                                                                    value={editSearch}
                                                                    onChange={setEditSearch}
                                                                    placeholder={`${mp} kategorisi ara...`}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <Btn small outline color={C.textDim} onClick={() => { setEditMode(null); setEditSearch(""); setEditResults([]); }}>Iptal</Btn>
                                                            </div>
                                                            {editLoading ? (
                                                                <div style={{ color: C.textDim, fontSize: 11, padding: 12, textAlign: "center" }}>Araniyor...</div>
                                                            ) : editResults.length > 0 ? (
                                                                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                                                                    {editResults.map((match, i) => (
                                                                        <button key={i}
                                                                            onClick={() => handleSelectMapping(cat, mp, match)}
                                                                            disabled={saving}
                                                                            style={{
                                                                                background: "rgba(255,255,255,0.03)",
                                                                                border: `1px solid ${C.border}`,
                                                                                borderRadius: 8, padding: "10px 14px",
                                                                                cursor: "pointer", textAlign: "left",
                                                                                display: "flex", alignItems: "center", gap: 10,
                                                                                transition: "all .1s"
                                                                            }}
                                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = MP_COLORS[mp] + "60"; e.currentTarget.style.background = MP_COLORS[mp] + "0a"; }}
                                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                                                        >
                                                                            <div style={{ width: 24, height: 24, borderRadius: 6, background: MP_COLORS[mp] + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: MP_COLORS[mp], fontWeight: 800 }}>
                                                                                {i + 1}
                                                                            </div>
                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{match.categoryName}</div>
                                                                                {match.categoryPath && match.categoryPath !== match.categoryName && (
                                                                                    <div style={{ color: C.textDim, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.categoryPath}</div>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ minWidth: 70 }}>
                                                                                <ScoreBar score={match.score} small />
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : editSearch.trim().length >= 2 ? (
                                                                <div style={{ color: C.textDim, fontSize: 11, padding: 12, textAlign: "center" }}>Sonuc bulunamadi</div>
                                                            ) : (
                                                                <div style={{ color: C.textDim, fontSize: 11, padding: 12, textAlign: "center" }}>En az 2 karakter girin...</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 3: ÇAPRAZ PLATFORM EŞLEŞTİRME — YENİ!
// ═══════════════════════════════════════════════════════════════════════════════
const CrossPlatformTab = ({ onRefresh }) => {
    const [sourcePlatform, setSourcePlatform] = useState("Trendyol");
    const [targetPlatforms, setTargetPlatforms] = useState(["Hepsiburada", "N11"]);
    const [minScore, setMinScore] = useState(0.45);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleMatch = async () => {
        if (!sourcePlatform || targetPlatforms.length === 0) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await crossPlatformMatch(sourcePlatform, targetPlatforms, minScore);
            setResult(res);
            onRefresh?.();
        } catch (e) {
            setResult({ success: false, message: e?.response?.data?.message || "Hata olustu" });
        }
        setLoading(false);
    };

    const toggleTarget = (mp) => {
        if (mp === sourcePlatform) return;
        setTargetPlatforms(prev =>
            prev.includes(mp) ? prev.filter(p => p !== mp) : [...prev, mp]
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Aciklama */}
            <Card style={{ background: C.purpleSoft, border: `1px solid ${C.purple}30` }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 28 }}>🔄</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Capraz Platform Eslestirme</div>
                        <div style={{ color: C.textSub, fontSize: 12, lineHeight: 1.6 }}>
                            Bir platformdaki kategori eslemelerinizi baz alarak diger platformlara otomatik eslestirme yapin.
                            <br />
                            <strong style={{ color: C.purple }}>Ornek:</strong> Trendyol'da "Cep Telefonu" olarak eslestirdiginiz dahili kategoriyi,
                            N11 ve Hepsiburada'da da benzer kategorilerle otomatik eslestirir.
                            <br />
                            <strong style={{ color: C.yellow }}>Not:</strong> Manuel eslestirmeleriniz korunur, sadece bos veya otomatik eslestirmeler guncellenir.
                        </div>
                    </div>
                </div>
            </Card>

            {/* Ayarlar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Kaynak Platform */}
                <Card>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>📍</span> Kaynak Platform (Baz)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {ALL_MARKETPLACES.map(mp => (
                            <button key={mp}
                                onClick={() => setSourcePlatform(mp)}
                                style={{
                                    background: sourcePlatform === mp ? (MP_COLORS[mp] + "15") : "rgba(255,255,255,0.02)",
                                    border: `1.5px solid ${sourcePlatform === mp ? MP_COLORS[mp] : C.border}`,
                                    borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 10, transition: "all .15s"
                                }}
                                onMouseEnter={e => { if (sourcePlatform !== mp) e.currentTarget.style.borderColor = MP_COLORS[mp] + "40"; }}
                                onMouseLeave={e => { if (sourcePlatform !== mp) e.currentTarget.style.borderColor = C.border; }}
                            >
                                <span style={{ fontSize: 20 }}>{MP_ICONS[mp]}</span>
                                <span style={{ color: C.text, fontSize: 13, fontWeight: 600, flex: 1 }}>{mp}</span>
                                {sourcePlatform === mp && <span style={{ color: MP_COLORS[mp], fontSize: 16 }}>✓</span>}
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Hedef Platformlar */}
                <Card>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🎯</span> Hedef Platformlar
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {ALL_MARKETPLACES.filter(mp => mp !== sourcePlatform).map(mp => {
                            const isSelected = targetPlatforms.includes(mp);
                            return (
                                <button key={mp}
                                    onClick={() => toggleTarget(mp)}
                                    style={{
                                        background: isSelected ? (MP_COLORS[mp] + "15") : "rgba(255,255,255,0.02)",
                                        border: `1.5px solid ${isSelected ? MP_COLORS[mp] : C.border}`,
                                        borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 10, transition: "all .15s"
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = MP_COLORS[mp] + "40"; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; }}
                                >
                                    <span style={{ fontSize: 20 }}>{MP_ICONS[mp]}</span>
                                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600, flex: 1 }}>{mp}</span>
                                    {isSelected && <span style={{ color: MP_COLORS[mp], fontSize: 16 }}>✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Minimum Skor */}
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Minimum Benzerlik Skoru:</span>
                    <input type="range" min="0.2" max="0.9" step="0.05" value={minScore}
                        onChange={e => setMinScore(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: C.purple }} />
                    <Badge color={C.purple}>%{Math.round(minScore * 100)}</Badge>
                </div>
                <div style={{ color: C.textDim, fontSize: 11 }}>
                    Dusuk skor = Daha fazla eslestirme (daha az kesin), Yuksek skor = Daha az eslestirme (daha kesin)
                </div>
            </Card>

            {/* Basla Butonu */}
            <Btn onClick={handleMatch} loading={loading} disabled={targetPlatforms.length === 0}
                color={C.purple} style={{ width: "100%", padding: "14px", fontSize: 14 }}>
                🔄 Capraz Eslestirmeyi Baslat
            </Btn>

            {/* Sonuc */}
            {result && (
                <Card style={{ border: `1.5px solid ${result.success ? C.green + "40" : C.red + "40"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 28 }}>{result.success ? "✅" : "❌"}</span>
                        <div>
                            <div style={{ color: result.success ? C.green : C.red, fontSize: 15, fontWeight: 700 }}>
                                {result.success ? "Capraz Eslestirme Tamamlandi!" : "Hata"}
                            </div>
                            {result.message && (
                                <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{result.message}</div>
                            )}
                        </div>
                    </div>

                    {result.success && (
                        <>
                            {/* Ozet */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 14 }}>
                                <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                                    <div style={{ color: C.accent, fontSize: 18, fontWeight: 800 }}>{result.totalSourceMappings || 0}</div>
                                    <div style={{ color: C.textDim, fontSize: 10 }}>Kaynak Mapping</div>
                                </div>
                                <div style={{ background: C.greenSoft, border: `1px solid ${C.green}30`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                                    <div style={{ color: C.green, fontSize: 18, fontWeight: 800 }}>{result.totalMatched || 0}</div>
                                    <div style={{ color: C.textDim, fontSize: 10 }}>Eslesti</div>
                                </div>
                                <div style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}30`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                                    <div style={{ color: C.yellow, fontSize: 18, fontWeight: 800 }}>{result.totalSkipped || 0}</div>
                                    <div style={{ color: C.textDim, fontSize: 10 }}>Atlandı</div>
                                </div>
                                <div style={{ background: C.blueSoft, border: `1px solid ${C.blue}30`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                                    <div style={{ color: C.blue, fontSize: 18, fontWeight: 800 }}>{result.totalManualSkipped || 0}</div>
                                    <div style={{ color: C.textDim, fontSize: 10 }}>Manuel Korundu</div>
                                </div>
                            </div>

                            {/* Platform Detaylari */}
                            {result.results?.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Platform Detaylari:</div>
                                    {result.results.map((r, i) => (
                                        <div key={i} style={{
                                            background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                                            borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${MP_COLORS[r.targetPlatform] || C.accent}`
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                <span style={{ fontSize: 18 }}>{MP_ICONS[r.targetPlatform]}</span>
                                                <span style={{ color: C.text, fontSize: 13, fontWeight: 700, flex: 1 }}>{r.targetPlatform}</span>
                                                <Badge color={r.status === "completed" ? C.green : C.yellow}>{r.status}</Badge>
                                            </div>
                                            <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.textSub }}>
                                                <span>✅ {r.matched || 0} eslesti</span>
                                                <span>⏭️ {r.skipped || 0} atlandi</span>
                                                {r.manualSkipped > 0 && <span>👤 {r.manualSkipped} manuel korundu</span>}
                                            </div>

                                            {/* Ornek Eslestirmeler */}
                                            {r.sampleMappings?.length > 0 && (
                                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                                                    <div style={{ color: C.textDim, fontSize: 10, marginBottom: 6 }}>Ornek Eslestirmeler:</div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        {r.sampleMappings.slice(0, 3).map((m, j) => (
                                                            <div key={j} style={{ fontSize: 10, color: C.textSub, display: "flex", alignItems: "center", gap: 6 }}>
                                                                <span>{m.icon}</span>
                                                                <span style={{ fontWeight: 600 }}>{m.internalCategory}</span>
                                                                <span style={{ color: C.textDim }}>→</span>
                                                                <span>{m.targetCategory}</span>
                                                                <ScoreBar score={m.score} small />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 4: DAHİLİ KATEGORİLER
// ═══════════════════════════════════════════════════════════════════════════════
const CategoriesTab = ({ categories, onRefresh }) => {
    const [newName, setNewName]       = useState("");
    const [newIcon, setNewIcon]       = useState("📁");
    const [newKeywords, setNewKeywords] = useState("");
    const [creating, setCreating]     = useState(false);
    const [seeding, setSeeding]       = useState(false);
    const [editId, setEditId]         = useState(null);
    const [editName, setEditName]     = useState("");
    const [editIcon, setEditIcon]     = useState("");
    const [editKeywords, setEditKeywords] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const [search, setSearch]         = useState("");
    const [msg, setMsg]               = useState(null);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true); setMsg(null);
        try {
            await createInternalCategory({
                name: newName.trim(),
                icon: newIcon || "📁",
                keywords: newKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
            });
            setNewName(""); setNewIcon("📁"); setNewKeywords("");
            setMsg({ type: "success", text: "Kategori oluşturuldu!" });
            onRefresh();
        } catch (e) { setMsg({ type: "error", text: e?.response?.data?.message || "Hata" }); }
        setCreating(false);
    };

    const handleSeed = async () => {
        setSeeding(true); setMsg(null);
        try {
            const res = await seedInternalCategories();
            setMsg({ type: "success", text: res.message });
            if (res.seeded) onRefresh();
        } catch (e) { setMsg({ type: "error", text: e?.response?.data?.message || "Hata" }); }
        setSeeding(false);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) return;
        try { await deleteInternalCategory(id); onRefresh(); } catch { /* ignore */ }
    };

    const startEdit = (cat) => {
        setEditId(cat._id);
        setEditName(cat.name);
        setEditIcon(cat.icon || "📁");
        setEditKeywords((cat.keywords || []).join(", "));
    };

    const handleEditSave = async () => {
        if (!editName.trim()) return;
        setEditSaving(true);
        try {
            await updateInternalCategory(editId, {
                name: editName.trim(),
                icon: editIcon,
                keywords: editKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
            });
            setEditId(null);
            onRefresh();
        } catch { /* ignore */ }
        setEditSaving(false);
    };

    const filtered = (categories || []).filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.keywords || []).some(k => k.includes(search.toLowerCase()))
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>➕</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Yeni Kategori Ekle</div>
                        <div style={{ color: C.textDim, fontSize: 10 }}>Anahtar kelimeler virgülle ayrılır</div>
                    </div>
                    <Btn small outline color={C.teal} onClick={handleSeed} loading={seeding}>🌱 Varsayılanları Yükle</Btn>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Input value={newIcon} onChange={setNewIcon} placeholder="📁" style={{ width: 50, textAlign: "center", flex: "none" }} />
                    <Input value={newName} onChange={setNewName} placeholder="Kategori adı..." style={{ flex: 1, minWidth: 140 }} />
                    <Input value={newKeywords} onChange={setNewKeywords} placeholder="Anahtar kelimeler (virgülle ayır)..." style={{ flex: 2, minWidth: 200 }} />
                    <Btn onClick={handleCreate} loading={creating} disabled={!newName.trim()} color={C.green}>💾 Ekle</Btn>
                </div>
                {msg && <div style={{ marginTop: 8, color: msg.type === "success" ? C.green : C.red, fontSize: 12, fontWeight: 600 }}>{msg.text}</div>}
            </Card>

            <Input value={search} onChange={setSearch} placeholder="🔍 Kategori veya anahtar kelime ara..." />

            {filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>📭</div>
                    <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>Henüz kategori yok</div>
                    <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>"Varsayılanları Yükle" butonuna basarak başlayın</div>
                </Card>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                    {filtered.map(cat => (
                        <Card key={cat._id} style={{ padding: "14px 16px", border: editId === cat._id ? `1.5px solid ${C.accent}` : `1px solid ${C.border}` }}>
                            {editId === cat._id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Input value={editIcon} onChange={setEditIcon} style={{ width: 50, textAlign: "center", flex: "none" }} />
                                        <Input value={editName} onChange={setEditName} placeholder="Ad" style={{ flex: 1 }} />
                                    </div>
                                    <Input value={editKeywords} onChange={setEditKeywords} placeholder="Anahtar kelimeler (virgülle)" />
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Btn small color={C.green} onClick={handleEditSave} loading={editSaving}>💾 Kaydet</Btn>
                                        <Btn small outline color={C.textDim} onClick={() => setEditId(null)}>İptal</Btn>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 20 }}>{cat.icon || "📁"}</span>
                                        <span style={{ color: C.text, fontSize: 14, fontWeight: 700, flex: 1 }}>{cat.name}</span>
                                        <Btn small outline color={C.accent} onClick={() => startEdit(cat)} style={{ padding: "3px 8px", fontSize: 10 }}>✏️</Btn>
                                        <Btn small outline color={C.red} onClick={() => handleDelete(cat._id, cat.name)} style={{ padding: "3px 8px", fontSize: 10 }}>🗑️</Btn>
                                    </div>
                                    {cat.keywords?.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {cat.keywords.slice(0, 8).map((kw, i) => (
                                                <span key={i} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 7px", fontSize: 10, color: C.textSub }}>{kw}</span>
                                            ))}
                                            {cat.keywords.length > 8 && <span style={{ color: C.textDim, fontSize: 10 }}>+{cat.keywords.length - 8}</span>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 4: OTOMATİK EŞLEŞTİR
// ═══════════════════════════════════════════════════════════════════════════════
const AutoMatchTab = ({ categories, onRefreshStats }) => {
    const [title, setTitle]           = useState("");
    const [description, setDesc]      = useState("");
    const [brand, setBrand]           = useState("");
    const [loading, setLoading]       = useState(false);
    const [result, setResult]         = useState(null);
    const [learnCatId, setLearnCatId] = useState("");
    const [learnMsg, setLearnMsg]     = useState(null);
    const [saving, setSaving]         = useState(false);

    const handleMatch = async () => {
        if (!title.trim()) return;
        setLoading(true); setResult(null); setLearnMsg(null);
        try {
            const res = await autoMatchCategory(title.trim(), description.trim(), "", brand.trim());
            setResult(res);
            if (res.matched && res.internalCategory?._id) {
                setLearnCatId(res.internalCategory._id);
            }
        } catch { setResult({ matched: false, confidence: 0, confidenceLevel: "none", source: "none" }); }
        setLoading(false);
    };

    const handleLearn = async () => {
        if (!learnCatId || !title.trim()) return;
        setSaving(true); setLearnMsg(null);
        try {
            const res = await learnCategory(title.trim().toLowerCase(), learnCatId);
            setLearnMsg({ type: "success", text: res.message || "Öğrenildi!" });
            onRefreshStats?.();
        } catch (e) {
            setLearnMsg({ type: "error", text: e?.response?.data?.message || "Kaydetme hatası" });
        }
        setSaving(false);
    };

    const flatCats = categories || [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 22 }}>🤖</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>Otomatik Kategori Eşleştirme</div>
                        <div style={{ color: C.textDim, fontSize: 11 }}>Ürün bilgilerini girin, sistem otomatik kategori bulsun. Bulamazsa siz seçin, sistem öğrensin.</div>
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <Input value={title} onChange={setTitle} placeholder="Ürün başlığı girin... (örn: iPhone 15 Pro Max 256GB)" onKeyDown={e => e.key === "Enter" && handleMatch()} />
                    </div>
                    <Input value={description} onChange={setDesc} placeholder="Açıklama (opsiyonel)" />
                    <Input value={brand} onChange={setBrand} placeholder="Marka (opsiyonel)" />
                </div>
                <Btn onClick={handleMatch} loading={loading} disabled={!title.trim()} style={{ width: "100%" }}>
                    🔍 Otomatik Eşleştir
                </Btn>
            </Card>

            {result && (
                <Card style={{ border: `1.5px solid ${result.matched ? C.green + "40" : C.yellow + "40"}` }}>
                    <div style={{ marginBottom: 12 }}>
                        <ConfidenceMeter level={result.confidenceLevel} score={result.confidence} />
                    </div>

                    {result.matched ? (
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                <span style={{ fontSize: 28 }}>{result.internalCategory?.icon || "📁"}</span>
                                <div>
                                    <div style={{ color: C.text, fontSize: 16, fontWeight: 800 }}>{result.internalCategory?.name || "?"}</div>
                                    <div style={{ color: C.textDim, fontSize: 11 }}>
                                        Kaynak: {result.source === "user_memory" ? "🧠 Öğrenme Hafızası" : "🔑 Anahtar Kelime"}
                                        {result.matchedPattern && <span> · Pattern: "{result.matchedPattern}"</span>}
                                    </div>
                                </div>
                            </div>

                            {result.marketplaceMappings?.length > 0 && (
                                <div style={{ marginTop: 10, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                    <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Pazaryeri Karşılıkları</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {result.marketplaceMappings.map((m, i) => (
                                            <Badge key={i} color={MP_COLORS[m.marketplace] || C.accent}>
                                                {MP_ICONS[m.marketplace] || "🔗"} {m.marketplace}: {m.marketplaceCategoryName}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 14, padding: 12, background: C.accentSoft, borderRadius: 10, border: `1px solid ${C.accent}25` }}>
                                <div style={{ color: C.textSub, fontSize: 11, marginBottom: 8 }}>
                                    ✅ Bu eşleşme doğruysa "Öğren" butonuna basın. Yanlışsa aşağıdan doğru kategoriyi seçin.
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <select value={learnCatId} onChange={e => setLearnCatId(e.target.value)}
                                        style={{ background: "#0f1117", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 12, outline: "none", flex: 1, minWidth: 180 }}>
                                        <option value="">Kategori seçin...</option>
                                        {flatCats.map(c => (
                                            <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                                        ))}
                                    </select>
                                    <Btn onClick={handleLearn} color={C.green} disabled={!learnCatId} loading={saving}>
                                        🧠 Öğren & Kaydet
                                    </Btn>
                                </div>
                                {learnMsg && (
                                    <div style={{ marginTop: 8, color: learnMsg.type === "success" ? C.green : C.red, fontSize: 12, fontWeight: 600 }}>
                                        {learnMsg.text}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 28 }}>🤷</span>
                                <div>
                                    <div style={{ color: C.yellow, fontSize: 15, fontWeight: 700 }}>Eşleşme Bulunamadı</div>
                                    <div style={{ color: C.textDim, fontSize: 11 }}>Lütfen doğru kategoriyi seçin. Sistem bir sonraki seferde otomatik eşleştirecek.</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <select value={learnCatId} onChange={e => setLearnCatId(e.target.value)}
                                    style={{ background: "#0f1117", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 12, outline: "none", flex: 1, minWidth: 180 }}>
                                    <option value="">Kategori seçin...</option>
                                    {flatCats.map(c => (
                                        <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                                    ))}
                                </select>
                                <Btn onClick={handleLearn} color={C.green} disabled={!learnCatId} loading={saving}>
                                    🧠 Öğren & Kaydet
                                </Btn>
                            </div>
                            {learnMsg && (
                                <div style={{ marginTop: 8, color: learnMsg.type === "success" ? C.green : C.red, fontSize: 12, fontWeight: 600 }}>
                                    {learnMsg.text}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 5: ÖĞRENME HAFIZASI
// ═══════════════════════════════════════════════════════════════════════════════
const MemoryTab = ({ stats, onRefreshStats }) => {
    const [memories, setMemories] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCategoryMemory();
            setMemories(res.memories || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id, pattern) => {
        if (!window.confirm(`"${pattern}" hafızadan silinsin mi?`)) return;
        try { await deleteCategoryMemory(id); load(); onRefreshStats?.(); } catch { /* ignore */ }
    };

    const filtered = memories.filter(m =>
        !search || m.pattern.includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase())
    );

    const st = stats || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {[
                    { icon: "🧠", label: "Öğrenilen Pattern", val: st.totalMemories || 0, color: C.purple },
                    { icon: "🤖", label: "Otomatik Eşleşme", val: st.totalAutoMatches || 0, color: C.green },
                ].map(k => (
                    <Card key={k.label} style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${k.color}`, padding: "14px 16px" }}>
                        <span style={{ fontSize: 22 }}>{k.icon}</span>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                            <div style={{ color: C.textDim, fontSize: 10, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                        </div>
                    </Card>
                ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>🧠 Öğrenme Hafızası</span>
                <Badge color={C.purple}>{memories.length} kayıt</Badge>
                <div style={{ flex: 1 }} />
                <Input value={search} onChange={setSearch} placeholder="🔍 Pattern ara..." style={{ maxWidth: 250 }} />
            </div>

            {loading ? (
                <div style={{ textAlign: "center", color: C.textDim, padding: 40 }}>⏳ Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>🧠</div>
                    <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>Henüz öğrenme verisi yok</div>
                    <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>Otomatik Eşleştir sekmesinden ürün eşleştirdikçe sistem öğrenecek</div>
                </Card>
            ) : (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                {["Pattern", "Kategori", "Kullanım", "Kaynak", "Son Kullanım", ""].map(h => (
                                    <th key={h} style={{ color: C.textDim, fontSize: 10, fontWeight: 700, padding: "10px 14px", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(m => (
                                <tr key={m._id} style={{ borderBottom: `1px solid ${C.border}` }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{ color: C.accent, fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>"{m.pattern}"</span>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>{m.icon}</span>
                                            <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{m.category}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <Badge color={m.hitCount >= 10 ? C.green : m.hitCount >= 3 ? C.yellow : C.textDim}>
                                            {m.hitCount}x
                                        </Badge>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{ color: C.textSub, fontSize: 11 }}>
                                            {m.source === "user_selection" ? "👤 Kullanıcı" : m.source === "auto_learned" ? "🤖 Otomatik" : "⚙️ Admin"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{ color: C.textDim, fontSize: 11 }}>
                                            {m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleDateString("tr-TR") : "—"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                                        <button onClick={() => handleDelete(m._id, m.pattern)}
                                            style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12 }}
                                            title="Sil">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {st.topPatterns?.length > 0 && (
                <Card>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏆 En Çok Kullanılan Patternler</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {st.topPatterns.map((p, i) => (
                            <div key={i} style={{
                                background: C.accentSoft, border: `1px solid ${C.accent}25`,
                                borderRadius: 8, padding: "6px 12px",
                                display: "flex", alignItems: "center", gap: 6
                            }}>
                                <span>{p.icon}</span>
                                <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>"{p.pattern}"</span>
                                <span style={{ color: C.textDim, fontSize: 10 }}>→ {p.category}</span>
                                <Badge color={C.green} style={{ fontSize: 9 }}>{p.hitCount}x</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 7: EŞLEŞMEMİŞ KATEGORİLER — Ürün dağıtımında başarısız olanlar
// v2: Akıllı öneri gösterimi + Toplu otomatik çözüm
// ═══════════════════════════════════════════════════════════════════════════════
const UnmappedTab = ({ categories, onRefresh }) => {
    const [unmapped, setUnmapped]           = useState([]);
    const [loading, setLoading]             = useState(true);
    const [filterMP, setFilterMP]           = useState("N11");
    const [showResolved, setShowResolved]   = useState(false);
    const [expandedId, setExpandedId]       = useState(null);
    const [selectedCatId, setSelectedCatId] = useState("");
    const [editSearch, setEditSearch]       = useState("");
    const [editResults, setEditResults]     = useState([]);
    const [editLoading, setEditLoading]     = useState(false);
    const [saving, setSaving]               = useState(false);
    const [msg, setMsg]                     = useState(null);
    const [autoResolving, setAutoResolving] = useState(false);
    const [autoResult, setAutoResult]       = useState(null);
    const searchTimerRef = useRef(null);

    // Yükleme
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getUnmappedCategories(filterMP, showResolved);
            setUnmapped(res.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [filterMP, showResolved]);

    useEffect(() => { load(); }, [load]);

    // Fuzzy arama — debounced
    const currentMP = useRef(filterMP);
    useEffect(() => { currentMP.current = filterMP; }, [filterMP]);

    useEffect(() => {
        const mp = currentMP.current;
        if (!expandedId || !editSearch.trim() || editSearch.trim().length < 2) {
            setEditResults([]);
            return;
        }
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
            setEditLoading(true);
            try {
                const res = await fuzzyMatchCategory(editSearch.trim(), mp, 10);
                setEditResults(res.matches || []);
            } catch { setEditResults([]); }
            setEditLoading(false);
        }, 400);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [editSearch, expandedId]);

    // Eşleştirme kaydet
    const handleResolve = async (unmappedItem, match) => {
        if (!selectedCatId) {
            setMsg({ type: "error", text: "Lütfen önce bir dahili kategori seçin (Adım 1)" });
            return;
        }
        const mCatName = (match && (match.categoryName || match.name)) || "";
        const mCatId   = (match && (match.categoryId || match.id)) || "";
        const mCatPath = (match && (match.categoryPath || match.path)) || "";
        if (!mCatName) {
            setMsg({ type: "error", text: "Platform kategorisi seçilemedi — tekrar deneyin" });
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            const res = await resolveUnmappedCategory({
                unmappedCategoryName: unmappedItem.categoryName || "",
                internalCategoryId: selectedCatId,
                marketplace: unmappedItem.targetMarketplace || filterMP,
                platformCategoryId: String(mCatId),
                platformCategoryName: mCatName,
                platformCategoryPath: mCatPath
            });
            setMsg({ type: "success", text: res.message || `"${unmappedItem.categoryName}" başarıyla eşleştirildi!` });
            setExpandedId(null);
            setEditSearch("");
            setEditResults([]);
            setSelectedCatId("");
            load();
            onRefresh?.();
        } catch (e) {
            setMsg({ type: "error", text: e?.response?.data?.message || "Kaydetme hatası oluştu" });
        }
        setSaving(false);
    };

    // Toplu otomatik çözüm
    const handleAutoResolve = async () => {
        if (!window.confirm(
            `${filterMP} için tüm eşleşmemiş kategoriler otomatik çözülmeye çalışılacak.\n` +
            `Yüksek güvenli eşleşmeler otomatik kaydedilir, düşük güvenliler öneri olarak gösterilir.\n\nDevam?`
        )) return;
        setAutoResolving(true);
        setAutoResult(null);
        setMsg(null);
        try {
            const res = await autoResolveUnmapped(filterMP, 0.6);
            setAutoResult(res);
            if (res.resolved > 0) {
                setMsg({ type: "success", text: `🤖 ${res.resolved} kategori otomatik çözüldü! ${res.skipped} tanesi manuel çözüm bekliyor.` });
                load();
                onRefresh?.();
            } else {
                setMsg({ type: "error", text: "Otomatik çözülebilecek kategori bulunamadı — manuel eşleştirme gerekli." });
            }
        } catch (e) {
            setMsg({ type: "error", text: e?.response?.data?.message || "Otomatik çözüm hatası" });
        }
        setAutoResolving(false);
    };

    // Öneri ile hızlı çözüm — suggestedCategories'den tek tıkla dahili kategori seç
    const handleQuickSuggest = (item, suggestion) => {
        const id = item.id || item._id;
        setExpandedId(id);
        setSelectedCatId(suggestion.categoryId || "");
        setEditSearch(item.categoryName || "");
        setEditResults([]);
    };

    // Paneli aç/kapa
    const toggleExpand = (item) => {
        const id = item.id || item._id;
        if (expandedId === id) {
            setExpandedId(null);
            setEditSearch("");
            setEditResults([]);
            setSelectedCatId("");
            return;
        }
        setExpandedId(id);
        setEditSearch(item.categoryName || "");
        setEditResults([]);
        setSelectedCatId("");
    };

    const unresolvedCount = unmapped.filter(u => !u.isResolved).length;
    const resolvedCount   = unmapped.filter(u => u.isResolved).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Açıklama */}
            <Card style={{ background: C.orangeSoft, border: `1px solid ${C.orange}30` }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 28 }}>⚠️</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Eşleşmemiş Kategoriler</div>
                        <div style={{ color: C.textSub, fontSize: 12, lineHeight: 1.6 }}>
                            Ürün dağıtımı sırasında kategori eşleşmesi bulunamayan ürünler burada listelenir.
                            <br />
                            <strong style={{ color: C.green }}>🤖 Tümünü Otomatik Çöz</strong> ile yüksek güvenli eşleşmeler otomatik kaydedilir.
                            <br />
                            Veya her bir kategori için: <strong style={{ color: C.orange }}>① Dahili kategori seçin</strong> →
                            <strong style={{ color: C.orange }}> ② Platform kategorisini arayıp seçin</strong>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Özet + Filtreler */}
            <Card style={{ padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ background: C.redSoft, border: `1px solid ${C.red}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: C.red, fontSize: 14, fontWeight: 800 }}>{unresolvedCount}</span>
                            <span style={{ color: C.textDim, fontSize: 10 }}>Bekleyen</span>
                        </div>
                        <div style={{ background: C.greenSoft, border: `1px solid ${C.green}30`, borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: C.green, fontSize: 14, fontWeight: 800 }}>{resolvedCount}</span>
                            <span style={{ color: C.textDim, fontSize: 10 }}>Çözülmüş</span>
                        </div>
                    </div>

                    <div style={{ height: 24, width: 1, background: C.border }} />

                    {/* Hedef Platform Filtresi */}
                    <div style={{ display: "flex", gap: 3 }}>
                        {ALL_MARKETPLACES.map(mp => (
                            <Btn key={mp} small outline={filterMP !== mp} color={MP_COLORS[mp]}
                                onClick={() => { setFilterMP(mp); setExpandedId(null); setAutoResult(null); }} style={{ padding: "4px 10px", fontSize: 10 }}>
                                {MP_ICONS[mp]} {mp}
                            </Btn>
                        ))}
                    </div>

                    <div style={{ height: 24, width: 1, background: C.border }} />

                    <Btn small outline={!showResolved} color={C.textSub}
                        onClick={() => setShowResolved(!showResolved)} style={{ padding: "4px 10px", fontSize: 10 }}>
                        {showResolved ? "✅ Çözülmüşleri Gizle" : "📋 Çözülmüşleri Göster"}
                    </Btn>

                    <div style={{ flex: 1 }} />

                    {/* Toplu Otomatik Çözüm Butonu */}
                    {unresolvedCount > 0 && (
                        <Btn small color={C.green} loading={autoResolving} onClick={handleAutoResolve} style={{ padding: "6px 14px" }}>
                            🤖 Tümünü Otomatik Çöz ({unresolvedCount})
                        </Btn>
                    )}
                </div>
            </Card>

            {/* Otomatik Çözüm Sonucu */}
            {autoResult && (
                <Card style={{ border: `1.5px solid ${autoResult.resolved > 0 ? C.green : C.yellow}40` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: autoResult.suggestions?.length > 0 ? 12 : 0 }}>
                        <span style={{ fontSize: 24 }}>{autoResult.resolved > 0 ? "✅" : "⚠️"}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                                Otomatik Çözüm: {autoResult.resolved} çözüldü, {autoResult.skipped} atlandı
                            </div>
                            <div style={{ color: C.textDim, fontSize: 11 }}>
                                Toplam {autoResult.total} kategori işlendi ({filterMP})
                            </div>
                        </div>
                        <button onClick={() => setAutoResult(null)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                    {/* Manuel çözüm gereken öneriler */}
                    {autoResult.suggestions?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ color: C.yellow, fontSize: 11, fontWeight: 700 }}>⚠️ Manuel çözüm gereken kategoriler:</div>
                            {autoResult.suggestions.map((s, i) => (
                                <div key={i} style={{
                                    background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                                    borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8
                                }}>
                                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600, flex: 1 }}>{s.categoryName}</span>
                                    <Badge color={C.yellow}>{s.hitCount}x</Badge>
                                    {s.internalCategory && (
                                        <Badge color={C.accent}>{s.internalCategory.icon} {s.internalCategory.name}</Badge>
                                    )}
                                    <span style={{ color: C.textDim, fontSize: 10 }}>{s.status === "no_internal_match" ? "Dahili kategori yok" : "Platform eşleşmesi yok"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Mesaj */}
            {msg && (
                <div style={{
                    padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: msg.type === "success" ? C.greenSoft : C.redSoft,
                    color: msg.type === "success" ? C.green : C.red,
                    border: `1px solid ${msg.type === "success" ? C.green : C.red}30`,
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{msg.type === "success" ? "✅" : "❌"}</span>
                        <span>{msg.text}</span>
                    </div>
                    <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
                </div>
            )}

            {/* Liste */}
            {loading ? (
                <div style={{ textAlign: "center", color: C.textDim, padding: 40 }}>⏳ Yükleniyor...</div>
            ) : unmapped.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 50 }}>
                    <div style={{ fontSize: 48 }}>🎉</div>
                    <div style={{ color: C.green, fontWeight: 700, fontSize: 16, marginTop: 10 }}>Tüm kategoriler eşleşmiş!</div>
                    <div style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>
                        {filterMP} için bekleyen eşleşmemiş kategori bulunmuyor.
                    </div>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {unmapped.map(item => {
                        const id = item.id || item._id;
                        const isExpanded = expandedId === id;
                        const mp = item.targetMarketplace || filterMP;
                        const suggestions = (item.suggestedCategories || []).filter(s => s.score >= 0.5);

                        return (
                            <Card key={id} style={{
                                padding: 0, overflow: "hidden",
                                border: item.isResolved
                                    ? `1px solid ${C.green}30`
                                    : isExpanded ? `1.5px solid ${C.orange}` : `1px solid ${C.border}`,
                                opacity: item.isResolved ? 0.6 : 1
                            }}>
                                {/* Başlık Satırı */}
                                <div
                                    onClick={() => !item.isResolved && toggleExpand(item)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                                        cursor: item.isResolved ? "default" : "pointer",
                                        background: isExpanded ? "rgba(249,115,22,0.04)" : "transparent",
                                        transition: "background .15s"
                                    }}
                                    onMouseEnter={e => { if (!item.isResolved && !isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                                    onMouseLeave={e => { if (!item.isResolved && !isExpanded) e.currentTarget.style.background = "transparent"; }}
                                >
                                    {/* Durum İkonu */}
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: item.isResolved ? C.greenSoft : C.redSoft,
                                        border: `1.5px solid ${item.isResolved ? C.green : C.red}30`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 18, flexShrink: 0
                                    }}>
                                        {item.isResolved ? "✅" : "❌"}
                                    </div>

                                    {/* Kategori Bilgisi */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{item.categoryName}</div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                                            <Badge color={MP_COLORS[mp] || C.accent}>
                                                {MP_ICONS[mp]} {mp}
                                            </Badge>
                                            <span style={{ color: C.textDim, fontSize: 10 }}>
                                                Kaynak: {item.source || "Trendyol"}
                                            </span>
                                            {(item.sampleProducts || []).length > 0 && (
                                                <span style={{ color: C.textDim, fontSize: 10, fontStyle: "italic" }}
                                                    title={(item.sampleProducts || []).join("\n")}>
                                                    📦 {(item.sampleProducts[0] || "").substring(0, 50)}{(item.sampleProducts[0] || "").length > 50 ? "..." : ""}
                                                </span>
                                            )}
                                        </div>
                                        {/* Akıllı Öneriler — satır içi */}
                                        {!item.isResolved && !isExpanded && suggestions.length > 0 && (
                                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                                <span style={{ color: C.textDim, fontSize: 10, lineHeight: "20px" }}>💡</span>
                                                {suggestions.slice(0, 3).map((s, si) => (
                                                    <button key={si}
                                                        onClick={(e) => { e.stopPropagation(); handleQuickSuggest(item, s); }}
                                                        style={{
                                                            background: C.accentSoft, border: `1px solid ${C.accent}25`,
                                                            borderRadius: 6, padding: "2px 8px", cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: 4,
                                                            transition: "all .1s", fontSize: 10
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + "60"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.accent + "25"; }}
                                                    >
                                                        <span>{s.icon || "📁"}</span>
                                                        <span style={{ color: C.text, fontWeight: 600 }}>{s.name}</span>
                                                        <span style={{ color: C.accent, fontWeight: 700 }}>{Math.round((s.score || 0) * 100)}%</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Hit Count */}
                                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                                        <div style={{
                                            background: (item.hitCount || 0) >= 5 ? C.redSoft : C.yellowSoft,
                                            border: `1px solid ${(item.hitCount || 0) >= 5 ? C.red : C.yellow}30`,
                                            borderRadius: 8, padding: "6px 12px"
                                        }}>
                                            <div style={{ color: (item.hitCount || 0) >= 5 ? C.red : C.yellow, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{item.hitCount || 0}x</div>
                                            <div style={{ color: C.textDim, fontSize: 9, marginTop: 2 }}>karşılaşma</div>
                                        </div>
                                    </div>

                                    {/* Tarih */}
                                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                                        <div style={{ color: C.textDim, fontSize: 10 }}>
                                            {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleDateString("tr-TR") : "—"}
                                        </div>
                                        <div style={{ color: C.textDim, fontSize: 9, marginTop: 2 }}>son görülme</div>
                                    </div>

                                    {/* Çözüldüyse bilgi */}
                                    {item.isResolved ? (
                                        <Badge color={C.green} style={{ flexShrink: 0 }}>
                                            ✅ {(item.resolvedWith && item.resolvedWith.categoryName) || "Çözüldü"}
                                        </Badge>
                                    ) : (
                                        <span style={{ color: C.textDim, fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", flexShrink: 0 }}>▼</span>
                                    )}
                                </div>

                                {/* ═══ Genişletilmiş Eşleştirme Paneli ═══ */}
                                {isExpanded && !item.isResolved && (
                                    <div style={{ padding: "0 18px 18px 18px", borderTop: `1px solid ${C.border}` }}>
                                        <div style={{ paddingTop: 14 }} />

                                        {/* ── Adım 1: Dahili Kategori Seç ── */}
                                        <div style={{
                                            marginBottom: 16, padding: 14, borderRadius: 10,
                                            background: selectedCatId ? C.greenSoft : "rgba(255,255,255,0.02)",
                                            border: `1.5px solid ${selectedCatId ? C.green + "40" : C.border}`,
                                            transition: "all .2s"
                                        }}>
                                            <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ background: selectedCatId ? C.green : C.accent, color: "#fff", width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                                                    {selectedCatId ? "✓" : "1"}
                                                </span>
                                                <span>Dahili Kategori Seçin</span>
                                                <span style={{ color: C.textDim, fontSize: 10, fontWeight: 400 }}>— "{item.categoryName}" hangi dahili kategoriye ait?</span>
                                            </div>
                                            {/* Öneri butonları */}
                                            {suggestions.length > 0 && (
                                                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                                                    <span style={{ color: C.textDim, fontSize: 10, lineHeight: "28px" }}>💡 Öneriler:</span>
                                                    {suggestions.map((s, si) => (
                                                        <button key={si}
                                                            onClick={() => setSelectedCatId(s.categoryId || "")}
                                                            style={{
                                                                background: selectedCatId === s.categoryId ? C.greenSoft : C.accentSoft,
                                                                border: `1.5px solid ${selectedCatId === s.categoryId ? C.green : C.accent}40`,
                                                                borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                                                                display: "flex", alignItems: "center", gap: 6,
                                                                transition: "all .15s"
                                                            }}
                                                        >
                                                            <span style={{ fontSize: 14 }}>{s.icon || "📁"}</span>
                                                            <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                                                            <span style={{
                                                                color: (s.score || 0) >= 0.8 ? C.green : (s.score || 0) >= 0.6 ? C.yellow : C.orange,
                                                                fontSize: 11, fontWeight: 700
                                                            }}>
                                                                {Math.round((s.score || 0) * 100)}%
                                                            </span>
                                                            {selectedCatId === s.categoryId && <span style={{ color: C.green }}>✓</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <select
                                                value={selectedCatId}
                                                onChange={e => setSelectedCatId(e.target.value)}
                                                style={{
                                                    width: "100%", background: "#0f1117",
                                                    border: `1.5px solid ${selectedCatId ? C.green + "60" : "rgba(255,255,255,0.12)"}`,
                                                    borderRadius: 8, color: C.text, padding: "10px 14px",
                                                    fontSize: 13, outline: "none", cursor: "pointer"
                                                }}
                                            >
                                                <option value="">— Dahili kategori seçin —</option>
                                                {(categories || []).map(c => (
                                                    <option key={c._id} value={c._id}>{c.icon || "📁"} {c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* ── Adım 2: Platform Kategorisi Ara ── */}
                                        <div style={{
                                            padding: 14, borderRadius: 10,
                                            background: "rgba(255,255,255,0.02)",
                                            border: `1.5px solid ${C.border}`,
                                            opacity: selectedCatId ? 1 : 0.5,
                                            pointerEvents: selectedCatId ? "auto" : "none",
                                            transition: "opacity .2s"
                                        }}>
                                            <div style={{ color: C.text, fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ background: C.accent, color: "#fff", width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>2</span>
                                                <span>{mp} Kategorisi Arayın</span>
                                                <span style={{ color: C.textDim, fontSize: 10, fontWeight: 400 }}>— en uygun platform kategorisini seçin</span>
                                            </div>

                                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                                <Input
                                                    value={editSearch}
                                                    onChange={setEditSearch}
                                                    placeholder={`${mp} kategorisi ara... (örn: ${item.categoryName})`}
                                                    style={{ flex: 1 }}
                                                />
                                                <Btn small outline color={C.textDim} onClick={() => { setExpandedId(null); setEditSearch(""); setEditResults([]); setSelectedCatId(""); }}>İptal</Btn>
                                            </div>

                                            {!selectedCatId && (
                                                <div style={{ padding: "10px 14px", borderRadius: 8, background: C.yellowSoft, border: `1px solid ${C.yellow}25`, display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span>☝️</span>
                                                    <span style={{ color: C.yellow, fontSize: 11, fontWeight: 600 }}>Önce yukarıdan dahili kategori seçin, sonra platform kategorisi arayabilirsiniz</span>
                                                </div>
                                            )}

                                            {selectedCatId && editLoading && (
                                                <div style={{ color: C.textDim, fontSize: 11, padding: 16, textAlign: "center" }}>🔍 Aranıyor...</div>
                                            )}

                                            {selectedCatId && !editLoading && editResults.length > 0 && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
                                                    {editResults.map((match, i) => {
                                                        const mName = (match && (match.categoryName || match.name)) || "—";
                                                        const mPath = (match && (match.categoryPath || match.path)) || "";
                                                        const mScore = (match && typeof match.score === "number") ? match.score : 0;

                                                        return (
                                                            <button key={i}
                                                                onClick={() => handleResolve(item, match)}
                                                                disabled={saving}
                                                                style={{
                                                                    background: "rgba(255,255,255,0.03)",
                                                                    border: `1px solid ${C.border}`,
                                                                    borderRadius: 8, padding: "10px 14px",
                                                                    cursor: saving ? "wait" : "pointer",
                                                                    textAlign: "left",
                                                                    display: "flex", alignItems: "center", gap: 10,
                                                                    transition: "all .1s"
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.green + "60"; e.currentTarget.style.background = C.greenSoft; }}
                                                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                                            >
                                                                <div style={{ width: 26, height: 26, borderRadius: 6, background: (MP_COLORS[mp] || C.accent) + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: MP_COLORS[mp] || C.accent, fontWeight: 800 }}>
                                                                    {i + 1}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{mName}</div>
                                                                    {mPath && mPath !== mName && (
                                                                        <div style={{ color: C.textDim, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mPath}</div>
                                                                    )}
                                                                </div>
                                                                <div style={{ minWidth: 70 }}>
                                                                    <ScoreBar score={mScore} small />
                                                                </div>
                                                                <span style={{ color: C.green, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                                                    {saving ? "⏳" : "✅ Eşleştir"}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {selectedCatId && !editLoading && editResults.length === 0 && editSearch.trim().length >= 2 && (
                                                <div style={{ color: C.textDim, fontSize: 11, padding: 16, textAlign: "center" }}>
                                                    Sonuç bulunamadı — farklı anahtar kelimeler deneyin
                                                </div>
                                            )}

                                            {selectedCatId && !editLoading && editSearch.trim().length < 2 && (
                                                <div style={{ color: C.textDim, fontSize: 11, padding: 16, textAlign: "center" }}>
                                                    En az 2 karakter girin...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 8: 📦 PAZAR YERİ KATEGORİLERİ — Listeleme & Export (Excel / PDF)
// ═══════════════════════════════════════════════════════════════════════════════
const MarketplaceCategoriesTab = ({ onRefresh }) => {
    const [mpFilter, setMpFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [leafOnly, setLeafOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(100);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [depthFilter, setDepthFilter] = useState(-1); // -1 = tümü
    const [sortBy, setSortBy] = useState("default"); // default, name, depth, id

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMarketplaceCategories(mpFilter, search, leafOnly, page, limit);
            setData(res);
        } catch (err) {
            console.error("Marketplace categories fetch error:", err);
            setData(null);
        }
        setLoading(false);
    }, [mpFilter, search, leafOnly, page, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const res = type === "excel"
                ? await exportMarketplaceCategoriesExcel(mpFilter, search, leafOnly)
                : await exportMarketplaceCategoriesPDF(mpFilter, search, leafOnly);

            const blob = new Blob([res.data], {
                type: type === "excel"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : "application/pdf"
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const dateStr = new Date().toISOString().slice(0, 10);
            const mpLabel = mpFilter === "all" ? "tum_platformlar" : mpFilter;
            a.href = url;
            a.download = type === "excel"
                ? `pazaryeri_kategorileri_${mpLabel}_${dateStr}.xlsx`
                : `pazaryeri_kategorileri_${mpLabel}_${dateStr}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(`Export ${type} error:`, err);
            alert(`Export hatası: ${err.message || "Bilinmeyen hata"}`);
        }
        setExporting(null);
    };

    const summary = data?.summary || {};
    const depthDistribution = data?.depthDistribution || {};
    const maxDepthVal = data?.maxDepth || 0;
    const deepestCategories = data?.deepestCategories || [];
    const rawCategories = data?.categories || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    // Client-side derinlik filtresi ve sıralama
    let categories = rawCategories;
    if (depthFilter >= 0) {
        categories = categories.filter(c => c.depth === depthFilter);
    }
    if (sortBy === "name") {
        categories = [...categories].sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
    } else if (sortBy === "depth") {
        categories = [...categories].sort((a, b) => (b.depth || 0) - (a.depth || 0));
    } else if (sortBy === "id") {
        categories = [...categories].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
    }

    const mpOptions = [
        { value: "all", label: "Tüm Platformlar", icon: "🌐" },
        { value: "Trendyol", label: "Trendyol", icon: "🟠" },
        { value: "N11", label: "N11", icon: "🟣" },
        { value: "Hepsiburada", label: "Hepsiburada", icon: "🟡" },
        { value: "ÇiçekSepeti", label: "ÇiçekSepeti", icon: "🌸" },
        { value: "Amazon", label: "Amazon", icon: "🔶" },
    ];

    // Derinlik renkleri
    const depthColor = (d) => {
        const colors = [C.blue, C.teal, C.green, C.yellow, C.orange, C.red, C.purple, C.pink, C.accent];
        return colors[Math.min(d, colors.length - 1)];
    };

    return (
        <div>
            {/* Başlık & Açıklama */}
            <Card style={{ marginBottom: 16, background: `${C.accent}08`, border: `1px solid ${C.accent}20` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>📦</span>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Pazar Yeri Kategorileri</div>
                        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
                            Trendyol, N11, ÇiçekSepeti, Hepsiburada ve Amazon'un kategori ağaçlarını burada görüntüleyebilirsiniz.
                            Platform seçerek filtreleyebilir, arama yapabilir ve <strong>Excel/PDF olarak dışa aktarabilirsiniz</strong>.
                            Bu kategorileri Ortak Merkez sekmesinde birleştirmek için kullanacaksınız.
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => fetchData()}
                            style={{
                                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                                color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
                                fontSize: 12, fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6
                            }}>
                            🔄 Yenile
                        </button>
                        <button onClick={() => handleExport("excel")} disabled={!!exporting || loading || total === 0}
                            style={{
                                background: exporting === "excel" ? C.greenSoft : "linear-gradient(135deg, #22c55e, #16a34a)",
                                color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
                                fontSize: 12, fontWeight: 700, cursor: total === 0 ? "not-allowed" : "pointer",
                                opacity: (!!exporting || loading || total === 0) ? 0.6 : 1,
                                display: "flex", alignItems: "center", gap: 6
                            }}>
                            {exporting === "excel" ? "⏳" : "📊"} Excel İndir
                        </button>
                        <button onClick={() => handleExport("pdf")} disabled={!!exporting || loading || total === 0}
                            style={{
                                background: exporting === "pdf" ? C.redSoft : "linear-gradient(135deg, #ef4444, #dc2626)",
                                color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
                                fontSize: 12, fontWeight: 700, cursor: total === 0 ? "not-allowed" : "pointer",
                                opacity: (!!exporting || loading || total === 0) ? 0.6 : 1,
                                display: "flex", alignItems: "center", gap: 6
                            }}>
                            {exporting === "pdf" ? "⏳" : "📄"} PDF İndir
                        </button>
                    </div>
                </div>
            </Card>

            {/* Filtreler */}
            <Card style={{ marginBottom: 16, padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Platform Seçimi */}
                    <div style={{ display: "flex", gap: 4 }}>
                        {mpOptions.map(opt => (
                            <button key={opt.value} onClick={() => { setMpFilter(opt.value); setPage(1); setExpandedRow(null); }}
                                style={{
                                    background: mpFilter === opt.value ? C.accentSoft : "transparent",
                                    border: `1px solid ${mpFilter === opt.value ? C.accent : C.border}`,
                                    color: mpFilter === opt.value ? C.accent : C.textDim,
                                    borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                                    transition: "all .15s"
                                }}>
                                <span>{opt.icon}</span> {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Arama */}
                    <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 200 }}>
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder="Kategori adı, yolu veya ID ile ara..."
                            style={{
                                flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                                borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12,
                                outline: "none"
                            }}
                        />
                        <button onClick={handleSearch}
                            style={{
                                background: C.accentSoft, border: `1px solid ${C.accent}40`,
                                color: C.accent, borderRadius: 8, padding: "7px 14px",
                                fontSize: 12, fontWeight: 700, cursor: "pointer"
                            }}>
                            🔍 Ara
                        </button>
                        {search && (
                            <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                                style={{
                                    background: C.redSoft, border: `1px solid ${C.red}30`,
                                    color: C.red, borderRadius: 8, padding: "7px 10px",
                                    fontSize: 11, cursor: "pointer"
                                }}>
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Yaprak Filtresi */}
                    <button onClick={() => { setLeafOnly(!leafOnly); setPage(1); }}
                        style={{
                            background: leafOnly ? C.tealSoft : "transparent",
                            border: `1px solid ${leafOnly ? C.teal : C.border}`,
                            color: leafOnly ? C.teal : C.textDim,
                            borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                        }}>
                        🍃 {leafOnly ? "Sadece Yaprak" : "Tümü"}
                    </button>

                    {/* Sıralama */}
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        style={{
                            background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                            borderRadius: 8, padding: "6px 10px", fontSize: 11, outline: "none", cursor: "pointer"
                        }}>
                        <option value="default">Sıralama: Varsayılan</option>
                        <option value="name">Ada Göre (A-Z)</option>
                        <option value="depth">Derinliğe Göre</option>
                        <option value="id">ID'ye Göre</option>
                    </select>
                </div>

                {/* Derinlik Filtresi */}
                {Object.keys(depthDistribution).length > 1 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginRight: 4 }}>DEPTİK:</span>
                        <button onClick={() => setDepthFilter(-1)}
                            style={{
                                background: depthFilter === -1 ? C.accentSoft : "transparent",
                                border: `1px solid ${depthFilter === -1 ? C.accent : C.border}`,
                                color: depthFilter === -1 ? C.accent : C.textDim,
                                borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer"
                            }}>
                            Tümü
                        </button>
                        {Object.entries(depthDistribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([d, count]) => {
                            const dNum = Number(d);
                            const dColor = depthColor(dNum);
                            return (
                                <button key={d} onClick={() => setDepthFilter(depthFilter === dNum ? -1 : dNum)}
                                    style={{
                                        background: depthFilter === dNum ? dColor + "20" : "transparent",
                                        border: `1px solid ${depthFilter === dNum ? dColor : C.border}`,
                                        color: depthFilter === dNum ? dColor : C.textDim,
                                        borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 4
                                    }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: dColor, display: "inline-block" }} />
                                    Seviye {d} <span style={{ opacity: 0.7 }}>({count})</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Özet Kartları */}
            {Object.keys(summary).length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    {Object.entries(summary).map(([mp, info]) => {
                        const color = MP_COLORS[mp] || C.accent;
                        const icon = MP_ICONS[mp] || "📦";
                        return (
                            <div key={mp} style={{
                                flex: "1 1 180px", background: color + "10", border: `1px solid ${color}30`,
                                borderRadius: 10, padding: "12px 16px", minWidth: 180
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    <span style={{ fontSize: 16 }}>{icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{mp}</span>
                                </div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{info.total}</div>
                                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>TOPLAM</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: C.green, lineHeight: 1 }}>{info.leaf}</div>
                                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>YAPRAK</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: C.yellow, lineHeight: 1 }}>{info.parent || (info.total - info.leaf)}</div>
                                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>ÜST</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: C.purple, lineHeight: 1 }}>{info.maxDepth || 0}</div>
                                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>MAKS DRN</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{info.avgDepth || 0}</div>
                                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>ORT DRN</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {/* Toplam */}
                    <div style={{
                        flex: "1 1 180px", background: C.accentSoft, border: `1px solid ${C.accent}30`,
                        borderRadius: 10, padding: "12px 16px", minWidth: 180
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>🌐</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>Toplam</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{total}</div>
                                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
                                    {search ? `"${search}" filtreli` : "kategori"}
                                </div>
                            </div>
                            {maxDepthVal > 0 && (
                                <div style={{ marginLeft: 8 }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: C.purple, lineHeight: 1 }}>{maxDepthVal}</div>
                                    <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>MAKS DERİNLİK</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Derinlik Dağılımı Grafiği */}
            {Object.keys(depthDistribution).length > 1 && (
                <Card style={{ marginBottom: 16, padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 14 }}>📊</span>
                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Derinlik Dağılımı</span>
                        {deepestCategories.length > 0 && (
                            <span style={{ color: C.textDim, fontSize: 10, marginLeft: 8 }}>
                                En derin: {deepestCategories[0]?.name} ({deepestCategories[0]?.marketplace}, seviye {deepestCategories[0]?.depth})
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
                        {Object.entries(depthDistribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([d, count]) => {
                            const maxCount = Math.max(...Object.values(depthDistribution));
                            const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            const dColor = depthColor(Number(d));
                            return (
                                <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                                    title={`Seviye ${d}: ${count} kategori`}>
                                    <span style={{ color: dColor, fontSize: 9, fontWeight: 700 }}>{count}</span>
                                    <div style={{
                                        width: "100%", maxWidth: 40, height: `${Math.max(heightPct, 4)}%`,
                                        background: `linear-gradient(180deg, ${dColor}, ${dColor}80)`,
                                        borderRadius: "4px 4px 0 0", minHeight: 4, transition: "height .3s"
                                    }} />
                                    <span style={{ color: C.textDim, fontSize: 9, fontWeight: 600 }}>S{d}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Yükleniyor */}
            {loading && (
                <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13 }}>Kategoriler çekiliyor...</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Bu işlem platformlara bağlı olarak biraz sürebilir.</div>
                </div>
            )}

            {/* Tablo */}
            {!loading && categories.length > 0 && (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: C.surface, borderBottom: `2px solid ${C.border}` }}>
                                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Platform</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Kategori ID</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".03em" }}>Kategori Adı</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Derinlik</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".03em" }}>Üst Kategori</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Alt Kat.</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Tür</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c, i) => {
                                    const mpColor = MP_COLORS[c.marketplace] || C.accent;
                                    const mpIcon = MP_ICONS[c.marketplace] || "📦";
                                    const dColor = depthColor(c.depth || 0);
                                    const isExpanded = expandedRow === `${c.marketplace}-${c.id}-${i}`;
                                    const rowKey = `${c.marketplace}-${c.id}-${i}`;

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr
                                                style={{
                                                    borderBottom: isExpanded ? "none" : `1px solid ${C.border}`,
                                                    background: isExpanded ? C.accentSoft : (i % 2 === 0 ? "transparent" : C.surface + "44"),
                                                    transition: "background .1s", cursor: "pointer"
                                                }}
                                                onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                                                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(99,102,241,0.06)"; }}
                                                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? "transparent" : C.surface + "44"; }}
                                            >
                                                <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                                                    <Badge color={mpColor}>{mpIcon} {c.marketplace}</Badge>
                                                </td>
                                                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: C.accent, fontWeight: 600 }}>
                                                    {c.id}
                                                </td>
                                                <td style={{ padding: "8px 12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                        {/* Derinlik girintisi */}
                                                        {(c.depth || 0) > 0 && (
                                                            <span style={{ display: "inline-block", width: Math.min(c.depth * 12, 48), borderLeft: `2px solid ${dColor}40`, height: 14, marginRight: 2, flexShrink: 0 }} />
                                                        )}
                                                        <span style={{ fontWeight: 600, color: C.text }}>{c.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                                    <span style={{
                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                        width: 24, height: 24, borderRadius: 6,
                                                        background: dColor + "18", color: dColor,
                                                        fontSize: 11, fontWeight: 800
                                                    }}>
                                                        {c.depth != null ? c.depth : 0}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "8px 12px" }}>
                                                    {c.parentName ? (
                                                        <span style={{ color: C.textSub, fontSize: 11 }}>
                                                            <span style={{ color: C.textDim, fontSize: 9, marginRight: 4 }}>↑</span>
                                                            {c.parentName}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: C.textDim, fontSize: 10, fontStyle: "italic" }}>— Kök —</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                                    {(c.childCount || 0) > 0 ? (
                                                        <Badge color={C.yellow} style={{ fontSize: 10 }}>{c.childCount}</Badge>
                                                    ) : (
                                                        <span style={{ color: C.textDim, fontSize: 10 }}>0</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                                    {c.isLeaf
                                                        ? <Badge color={C.green}>🍃 Yaprak</Badge>
                                                        : <Badge color={C.yellow}>📂 Üst ({c.childCount || 0})</Badge>
                                                    }
                                                </td>
                                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                                    <span style={{ color: C.textDim, fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", display: "inline-block", transition: "transform .2s" }}>▼</span>
                                                </td>
                                            </tr>

                                            {/* Genişletilmiş Detay Satırı */}
                                            {isExpanded && (
                                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                                    <td colSpan={8} style={{ padding: 0 }}>
                                                        <div style={{
                                                            padding: "14px 18px", background: "rgba(99,102,241,0.03)",
                                                            borderTop: `1px solid ${C.accent}20`
                                                        }}>
                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                                                {/* Sol: Tam Bilgi */}
                                                                <div>
                                                                    <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 8, letterSpacing: ".04em" }}>📋 Kategori Detayları</div>
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Kategori ID:</span>
                                                                            <span style={{ color: C.accent, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{c.id}</span>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Kategori Adı:</span>
                                                                            <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>{c.name}</span>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Platform:</span>
                                                                            <Badge color={mpColor}>{mpIcon} {c.marketplace}</Badge>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Derinlik:</span>
                                                                            <span style={{ color: dColor, fontSize: 11, fontWeight: 700 }}>Seviye {c.depth != null ? c.depth : 0}</span>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Üst Kategori:</span>
                                                                            <span style={{ color: C.text, fontSize: 11 }}>
                                                                                {c.parentName ? (
                                                                                    <>{c.parentName} <span style={{ color: C.textDim, fontSize: 9 }}>(ID: {c.parentId})</span></>
                                                                                ) : (
                                                                                    <span style={{ color: C.textDim, fontStyle: "italic" }}>Kök kategori (üst yok)</span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Alt Kategori:</span>
                                                                            <span style={{ color: (c.childCount || 0) > 0 ? C.yellow : C.textDim, fontSize: 11, fontWeight: 600 }}>
                                                                                {(c.childCount || 0) > 0 ? `${c.childCount} alt kategori` : "Yok (yaprak kategori)"}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: "flex", gap: 8 }}>
                                                                            <span style={{ color: C.textDim, fontSize: 11, minWidth: 100 }}>Tür:</span>
                                                                            {c.isLeaf
                                                                                ? <Badge color={C.green}>🍃 Yaprak — Ürün yüklenebilir</Badge>
                                                                                : <Badge color={C.yellow}>📂 Üst Kategori — Ürün yüklenemez</Badge>
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Sağ: Hiyerarşi Yolu (Breadcrumb) */}
                                                                <div>
                                                                    <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 8, letterSpacing: ".04em" }}>🗂️ Hiyerarşi Yolu</div>
                                                                    {(c.pathSegments || c.path?.split(" > ") || []).length > 0 ? (
                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                                                            {(c.pathSegments || c.path?.split(" > ") || []).map((seg, si, arr) => {
                                                                                const segColor = depthColor(si);
                                                                                const isLast = si === arr.length - 1;
                                                                                return (
                                                                                    <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: si * 16 }}>
                                                                                        <span style={{
                                                                                            width: 18, height: 18, borderRadius: 4,
                                                                                            background: segColor + "18", color: segColor,
                                                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                                            fontSize: 9, fontWeight: 800, flexShrink: 0
                                                                                        }}>
                                                                                            {si}
                                                                                        </span>
                                                                                        {si > 0 && (
                                                                                            <span style={{ color: C.textDim, fontSize: 10, marginRight: -2 }}>└</span>
                                                                                        )}
                                                                                        <span style={{
                                                                                            color: isLast ? C.text : C.textSub,
                                                                                            fontSize: 11,
                                                                                            fontWeight: isLast ? 700 : 400,
                                                                                            background: isLast ? C.accentSoft : "transparent",
                                                                                            padding: isLast ? "2px 8px" : "0",
                                                                                            borderRadius: isLast ? 4 : 0,
                                                                                            border: isLast ? `1px solid ${C.accent}30` : "none"
                                                                                        }}>
                                                                                            {isLast ? (c.isLeaf ? "🍃 " : "📂 ") : ""}{seg}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: C.textDim, fontSize: 11 }}>Yol bilgisi yok</span>
                                                                    )}

                                                                    {/* Tam yol kopyalama */}
                                                                    <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                                                        <span style={{ color: C.textDim, fontSize: 9, flexShrink: 0 }}>TAM YOL:</span>
                                                                        <span style={{ color: C.textSub, fontSize: 10, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                            {c.path}
                                                                        </span>
                                                                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.path || ""); }}
                                                                            style={{ background: C.accentSoft, border: `1px solid ${C.accent}30`, color: C.accent, borderRadius: 4, padding: "2px 8px", fontSize: 9, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>
                                                                            📋 Kopyala
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Sayfalama */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8
                    }}>
                        <div style={{ fontSize: 11, color: C.textDim }}>
                            Toplam <strong style={{ color: C.text }}>{total}</strong> kategori
                            {depthFilter >= 0 && <span> · <strong style={{ color: depthColor(depthFilter) }}>Seviye {depthFilter}</strong> filtreli ({categories.length} gösteriliyor)</span>}
                            {" "}· Sayfa <strong style={{ color: C.text }}>{page}</strong> / {totalPages}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setPage(1)} disabled={page <= 1}
                                style={{ background: C.surface, border: `1px solid ${C.border}`, color: page <= 1 ? C.textDim : C.text, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: page <= 1 ? "default" : "pointer" }}>
                                ⏮ İlk
                            </button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                style={{ background: C.surface, border: `1px solid ${C.border}`, color: page <= 1 ? C.textDim : C.text, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: page <= 1 ? "default" : "pointer" }}>
                                ◀ Önceki
                            </button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                style={{ background: C.surface, border: `1px solid ${C.border}`, color: page >= totalPages ? C.textDim : C.text, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: page >= totalPages ? "default" : "pointer" }}>
                                Sonraki ▶
                            </button>
                            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                                style={{ background: C.surface, border: `1px solid ${C.border}`, color: page >= totalPages ? C.textDim : C.text, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: page >= totalPages ? "default" : "pointer" }}>
                                Son ⏭
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Boş Durum */}
            {!loading && categories.length === 0 && data && (
                <Card style={{ padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Kategori Bulunamadı</div>
                    <div style={{ fontSize: 12, color: C.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
                        {search
                            ? `"${search}" aramasına uygun kategori bulunamadı. Farklı bir arama deneyin.`
                            : depthFilter >= 0
                                ? `Seviye ${depthFilter} derinliğinde kategori bulunamadı. Derinlik filtresini kaldırın.`
                                : "Seçili pazar yeri için kategori çekilemedi. Pazar yeri entegrasyonunuzun aktif olduğundan emin olun."
                        }
                    </div>
                    <button onClick={() => { setSearch(""); setSearchInput(""); setMpFilter("all"); setLeafOnly(false); setDepthFilter(-1); setPage(1); }}
                        style={{
                            marginTop: 16, background: C.accentSoft, border: `1px solid ${C.accent}40`,
                            color: C.accent, borderRadius: 8, padding: "8px 20px",
                            fontSize: 12, fontWeight: 700, cursor: "pointer"
                        }}>
                        🔄 Filtreleri Sıfırla
                    </button>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 9: 🗺️ BİRLEŞİK KATEGORİ MERKEZİ — Unified Category Map
// ═══════════════════════════════════════════════════════════════════════════════

const UnifiedCategoryTab = ({ onRefresh }) => {
    const [stats, setStats] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [matchType, setMatchType] = useState("");
    const [platformCountFilter, setPlatformCountFilter] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [pagination, setPagination] = useState(null);

    const [trendyolFile, setTrendyolFile] = useState(null);
    const [n11File, setN11File] = useState(null);
    const [ciceksepetiFile, setCiceksepetiFile] = useState(null);
    const [hepsiburadaFile, setHepsiburadaFile] = useState(null);
    const [amazonFile, setAmazonFile] = useState(null);
    const [clearExisting, setClearExisting] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const trendyolRef = useRef(null);
    const n11Ref = useRef(null);
    const ciceksepetiRef = useRef(null);
    const hepsiburadaRef = useRef(null);
    const amazonRef = useRef(null);

    const loadStats = useCallback(async () => {
        try {
            const res = await getUnifiedStats();
            setStats(res.stats);
        } catch (err) {
            console.error("Stats yükleme hatası:", err);
        }
    }, []);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getUnifiedCategories({
                search, matchType, platformCount: platformCountFilter, page, limit
            });
            setCategories(res.categories || []);
            setPagination(res.pagination || null);
        } catch (err) {
            console.error("Kategoriler yükleme hatası:", err);
            setCategories([]);
        }
        setLoading(false);
    }, [search, matchType, platformCountFilter, page, limit]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadCategories(); }, [loadCategories]);

    const handleSearch = () => { setSearch(searchInput); setPage(1); };

    const handleImport = async () => {
        if (!trendyolFile && !n11File && !ciceksepetiFile && !hepsiburadaFile && !amazonFile) {
            alert("En az bir platform Excel dosyası seçmelisiniz!");
            return;
        }

        if (!window.confirm(
            `${clearExisting ? "⚠️ MEVCUT TÜM VERİLER SİLİNECEK!\n\n" : ""}` +
            `Trendyol: ${trendyolFile ? "✅" : "❌"}  N11: ${n11File ? "✅" : "❌"}  ÇiçekSepeti: ${ciceksepetiFile ? "✅" : "❌"}  Hepsiburada: ${hepsiburadaFile ? "✅" : "❌"}  Amazon: ${amazonFile ? "✅" : "❌"}\n\nDevam?`
        )) return;

        setImporting(true);
        try {
            const formData = new FormData();
            if (trendyolFile) formData.append("trendyol", trendyolFile);
            if (n11File) formData.append("n11", n11File);
            if (ciceksepetiFile) formData.append("ciceksepeti", ciceksepetiFile);
            if (hepsiburadaFile) formData.append("hepsiburada", hepsiburadaFile);
            if (amazonFile) formData.append("amazon", amazonFile);
            formData.append("clearExisting", clearExisting ? "true" : "false");

            const res = await importUnifiedCategories(formData);
            alert(
                `✅ Import başarılı!\n\n` +
                `Yeni: ${res.result.dbResult.inserted}  Güncellenen: ${res.result.dbResult.updated}\n` +
                `3+ ortak: ${res.result.matchStats.exact3}  2'si ortak: ${res.result.matchStats.match2}  Tekil: ${res.result.matchStats.single}`
            );

            setTrendyolFile(null); setN11File(null); setCiceksepetiFile(null); setHepsiburadaFile(null); setAmazonFile(null); setClearExisting(false);
            if (trendyolRef.current) trendyolRef.current.value = "";
            if (n11Ref.current) n11Ref.current.value = "";
            if (ciceksepetiRef.current) ciceksepetiRef.current.value = "";
            if (hepsiburadaRef.current) hepsiburadaRef.current.value = "";
            if (amazonRef.current) amazonRef.current.value = "";
            loadStats(); loadCategories();
            if (onRefresh) onRefresh();
        } catch (err) {
            alert(`❌ Import hatası: ${err.response?.data?.message || err.message}`);
        }
        setImporting(false);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await exportUnifiedCategoriesExcel({ matchType, platformCount: platformCountFilter });
            const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `birlesik_kategoriler_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) { alert(`Export hatası: ${err.message}`); }
        setExporting(false);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" silinsin mi?`)) return;
        try { await deleteUnifiedCategory(id); loadCategories(); loadStats(); }
        catch (err) { alert(`Silme hatası: ${err.message}`); }
    };

    const mtColor = (t) => t === "exact" ? C.green : t === "2of3" ? C.yellow : t === "single" ? C.red : t === "manual" ? C.purple : C.textDim;
    const mtLabel = (t) => t === "exact" ? "3 Platform ✓" : t === "2of3" ? "2 Platform" : t === "single" ? "Tek Platform" : t === "manual" ? "Manuel" : t;

    return (
        <div>
            {/* Başlık & İstatistikler */}
            <div style={{ marginBottom: 20 }}>
                <Card style={{ marginBottom: 16, background: `${C.accent}08`, border: `1px solid ${C.accent}20` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 24 }}>🗺️</span>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Ortak Kategori Merkezi</div>
                            <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
                                PY Kategorileri sekmesinden indirdiğiniz <strong>5 platformun Excel dosyalarını</strong> (Trendyol, N11, ÇiçekSepeti, Hepsiburada, Amazon) buraya yükleyin.
                                Sistem kategori adlarını normalize ederek otomatik eşleştirir. Eşleşme sonuçlarını <strong>Eşleşen</strong> sekmesinden inceleyip revize edebilirsiniz.
                                <strong> Ürün dağıtımında bu harita otomatik kullanılır.</strong>
                            </div>
                        </div>
                    </div>
                </Card>

                {stats && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                        {[
                            { val: stats.total, label: "TOPLAM", color: C.accent },
                            { val: stats.exact3, label: "3 ORTAK", color: C.green },
                            { val: stats.match2, label: "2 ORTAK", color: C.yellow },
                            { val: stats.single, label: "TEKİL", color: C.red },
                        ].map(s => (
                            <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 8, padding: "10px 14px", minWidth: 80 }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>{s.label}</div>
                            </div>
                        ))}
                        <div style={{ borderLeft: `1px solid ${C.border}`, margin: "0 4px" }} />
                        {[
                            { val: stats.platforms?.trendyol || 0, label: "Trendyol", icon: "🟠", color: "#f97316" },
                            { val: stats.platforms?.n11 || 0, label: "N11", icon: "🟣", color: "#a855f7" },
                            { val: stats.platforms?.ciceksepeti || 0, label: "ÇiçekSepeti", icon: "🌸", color: "#ec4899" },
                            { val: stats.platforms?.hepsiburada || 0, label: "Hepsiburada", icon: "🟢", color: "#22c55e" },
                            { val: stats.platforms?.amazon || 0, label: "Amazon", icon: "🟡", color: "#f59e0b" },
                        ].map(p => (
                            <div key={p.label} style={{ background: `${p.color}10`, border: `1px solid ${p.color}30`, borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14 }}>{p.icon}</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.val}</div>
                                    <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>{p.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Import */}
            <Card style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 12px 0" }}>📤 Excel Import</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
                    {[
                        { label: "🟠 Trendyol", file: trendyolFile, setFile: setTrendyolFile, ref: trendyolRef },
                        { label: "🟣 N11", file: n11File, setFile: setN11File, ref: n11Ref },
                        { label: "🌸 ÇiçekSepeti", file: ciceksepetiFile, setFile: setCiceksepetiFile, ref: ciceksepetiRef },
                        { label: "🟢 Hepsiburada", file: hepsiburadaFile, setFile: setHepsiburadaFile, ref: hepsiburadaRef },
                        { label: "🟡 Amazon", file: amazonFile, setFile: setAmazonFile, ref: amazonRef },
                    ].map(item => (
                        <div key={item.label}>
                            <label style={{ fontSize: 11, color: C.textSub, fontWeight: 600, display: "block", marginBottom: 4 }}>{item.label}</label>
                            <input type="file" accept=".xlsx,.xls" ref={item.ref}
                                onChange={(e) => item.setFile(e.target.files[0] || null)}
                                style={{ width: "100%", padding: 6, fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }} />
                            {item.file && <div style={{ fontSize: 10, color: C.green, marginTop: 3 }}>✅ {item.file.name}</div>}
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSub, cursor: "pointer" }}>
                        <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} />
                        <span>⚠️ Sıfırdan oluştur</span>
                    </label>
                    <Btn onClick={handleImport} loading={importing} disabled={!trendyolFile && !n11File && !ciceksepetiFile && !hepsiburadaFile && !amazonFile}>
                        📤 İçe Aktar
                    </Btn>
                </div>
            </Card>

            {/* Filtreler */}
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={{ fontSize: 11, color: C.textSub, fontWeight: 600, display: "block", marginBottom: 4 }}>🔍 Arama</label>
                        <div style={{ display: "flex", gap: 6 }}>
                            <Input value={searchInput} onChange={setSearchInput} placeholder="Kategori adı veya yol..."
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                            <Btn onClick={handleSearch} small>Ara</Btn>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.textSub, fontWeight: 600, display: "block", marginBottom: 4 }}>Eşleşme</label>
                        <select value={matchType} onChange={(e) => { setMatchType(e.target.value); setPage(1); }}
                            style={{ padding: "8px 12px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }}>
                            <option value="">Tümü</option>
                            <option value="exact">✅ 3 Platform</option>
                            <option value="2of3">🟡 2 Platform</option>
                            <option value="single">🔴 Tek</option>
                            <option value="manual">🟣 Manuel</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.textSub, fontWeight: 600, display: "block", marginBottom: 4 }}>Platform</label>
                        <select value={platformCountFilter} onChange={(e) => { setPlatformCountFilter(e.target.value); setPage(1); }}
                            style={{ padding: "8px 12px", fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }}>
                            <option value="">Tümü</option>
                            <option value="3">3</option>
                            <option value="2">2</option>
                            <option value="1">1</option>
                        </select>
                    </div>
                    <Btn onClick={handleExport} loading={exporting} color={C.green} small>📥 Excel</Btn>
                    <Btn onClick={() => { loadStats(); loadCategories(); }} color={C.blue} outline small>🔄</Btn>
                </div>
            </Card>

            {/* Tablo */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                            <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                                {["ORTAK AD", "KÖK", "DURUM", "🟠", "🟣", "🌸", "🟢", "🟡", "İŞLEM"].map(h => (
                                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "ORTAK AD" || h === "KÖK" ? "left" : "center", color: C.textSub, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" style={{ padding: 40, textAlign: "center", color: C.textDim }}>⏳ Yükleniyor...</td></tr>
                            ) : categories.length === 0 ? (
                                <tr><td colSpan="9" style={{ padding: 40, textAlign: "center", color: C.textDim }}>
                                    {stats?.total === 0 ? "Henüz veri yok — yukarıdan Excel yükleyin." : "Filtrelere uygun sonuç yok."}
                                </td></tr>
                            ) : categories.map(cat => (
                                <tr key={cat._id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    onClick={() => { setSelectedCategory(cat); setShowDetail(true); }}>
                                    <td style={{ padding: "10px 12px", color: C.text, fontWeight: 600, maxWidth: 300 }}>
                                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.canonicalName}</div>
                                        {cat.canonicalPath && (
                                            <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{cat.canonicalPath}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: C.textSub, fontSize: 10 }}>{cat.rootCategory || "—"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                        <Badge color={mtColor(cat.matchType)}>{mtLabel(cat.matchType)}</Badge>
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{cat.trendyol?.categoryId ? "✅" : "❌"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{cat.n11?.categoryId ? "✅" : "❌"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{cat.ciceksepeti?.categoryId ? "✅" : "❌"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{cat.hepsiburada?.categoryId ? "✅" : "❌"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{cat.amazon?.categoryId ? "✅" : "❌"}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                            <Btn onClick={() => { setSelectedCategory(cat); setShowDetail(true); }} color={C.blue} outline small>🔍</Btn>
                                            <Btn onClick={() => handleDelete(cat._id, cat.canonicalName)} color={C.red} outline small>🗑️</Btn>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination && pagination.totalPages > 1 && (
                    <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: C.textSub }}>
                            {pagination.page}/{pagination.totalPages} — {pagination.total} kategori
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <Btn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} small>← Önceki</Btn>
                            <Btn onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} small>Sonraki →</Btn>
                        </div>
                    </div>
                )}
            </div>

            {/* Detay Modal */}
            {showDetail && selectedCategory && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 9999, padding: 20
                }} onClick={() => setShowDetail(false)}>
                    <div style={{
                        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                        maxWidth: 800, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 24
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "0 0 4px 0" }}>{selectedCategory.canonicalName}</h3>
                                {selectedCategory.canonicalPath && <div style={{ fontSize: 11, color: C.textDim }}>{selectedCategory.canonicalPath}</div>}
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <Badge color={mtColor(selectedCategory.matchType)}>{mtLabel(selectedCategory.matchType)}</Badge>
                                    <Badge color={C.accent}>{selectedCategory.platformCount}/5 Platform</Badge>
                                    <Badge color={selectedCategory.isLeaf ? C.green : C.yellow}>{selectedCategory.isLeaf ? "🍃 Yaprak" : "📁 Üst"}</Badge>
                                </div>
                            </div>
                            <button onClick={() => setShowDetail(false)}
                                style={{ background: "none", border: "none", color: C.textDim, fontSize: 20, cursor: "pointer" }}>✕</button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
                            {[
                                { key: "trendyol", label: "Trendyol", icon: "🟠", color: "#f97316", data: selectedCategory.trendyol },
                                { key: "n11", label: "N11", icon: "🟣", color: "#a855f7", data: selectedCategory.n11 },
                                { key: "ciceksepeti", label: "ÇiçekSepeti", icon: "🌸", color: "#ec4899", data: selectedCategory.ciceksepeti },
                                { key: "hepsiburada", label: "Hepsiburada", icon: "🟢", color: "#22c55e", data: selectedCategory.hepsiburada },
                                { key: "amazon", label: "Amazon", icon: "🟡", color: "#f59e0b", data: selectedCategory.amazon },
                            ].map(p => (
                                <div key={p.key} style={{
                                    background: C.surface, border: `1px solid ${p.data?.categoryId ? p.color + "40" : C.border}`,
                                    borderRadius: 8, padding: 12
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span>{p.icon}</span> {p.label}
                                        <span style={{ marginLeft: "auto" }}>{p.data?.categoryId ? "✅" : "❌"}</span>
                                    </div>
                                    {p.data?.categoryId ? (
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>ID: {p.data.categoryId}</div>
                                            <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 4 }}>{p.data.categoryName}</div>
                                            <div style={{ fontSize: 10, color: C.textSub, lineHeight: 1.5 }}>
                                                {(p.data.categoryPath || "").split(" > ").map((seg, i, arr) => (
                                                    <span key={i}>
                                                        <span style={{ color: i === arr.length - 1 ? p.color : C.textDim }}>{seg}</span>
                                                        {i < arr.length - 1 && <span style={{ color: C.textDim, margin: "0 3px" }}>›</span>}
                                                    </span>
                                                ))}
                                            </div>
                                            <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
                                                Derinlik: {p.data.depth} · {p.data.isLeaf ? "Yaprak" : "Üst"}
                                                {p.data.parentName && ` · Üst: ${p.data.parentName}`}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 11, color: C.textDim, padding: "8px 0", textAlign: "center" }}>Eşleşme yok</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 10: 🧠 SMART RESOLVER — Unified Pipeline Test & Monitor
// ═══════════════════════════════════════════════════════════════════════════════
const SmartResolverTab = ({ onRefresh }) => {
    const [testProduct, setTestProduct] = useState({ title: "", category: "", brand: "" });
    const [testMarketplace, setTestMarketplace] = useState("N11");
    const [resolveResult, setResolveResult] = useState(null);
    const [resolving, setResolving] = useState(false);
    const [resolverStats, setResolverStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [batchText, setBatchText] = useState("");
    const [batchResult, setBatchResult] = useState(null);
    const [batchResolving, setBatchResolving] = useState(false);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await getResolverStats();
            setResolverStats(res.stats || null);
        } catch { /* ignore */ }
        setStatsLoading(false);
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    const handleTestResolve = async () => {
        if (!testProduct.title && !testProduct.category) return;
        setResolving(true);
        setResolveResult(null);
        try {
            const res = await smartResolve(testProduct, testMarketplace);
            setResolveResult(res);
        } catch (err) {
            setResolveResult({ resolved: false, error: err.message });
        }
        setResolving(false);
    };

    const handleBatchResolve = async () => {
        if (!batchText.trim()) return;
        setBatchResolving(true);
        setBatchResult(null);
        try {
            const lines = batchText.split("\n").filter(l => l.trim());
            const products = lines.map(line => {
                const parts = line.split("|").map(p => p.trim());
                return { title: parts[0] || "", category: parts[1] || "", brand: parts[2] || "" };
            });
            const res = await smartResolveBatch(products, testMarketplace);
            setBatchResult(res);
        } catch (err) {
            setBatchResult({ error: err.message });
        }
        setBatchResolving(false);
    };

    const STEP_LABELS = {
        exact_mapping: { icon: "🎯", label: "Exact Mapping", color: C.green, desc: "Birebir eslestirme bulundu" },
        learned: { icon: "🧠", label: "Ogrenilmis", color: C.purple, desc: "Gecmis kararlardan ogrenildi" },
        hybrid_ai: { icon: "🤖", label: "Hybrid AI", color: C.accent, desc: "Embedding + Keyword + Historical" },
        fallback_fuzzy: { icon: "🔄", label: "Fallback (Fuzzy)", color: C.yellow, desc: "En yakin kategori (fuzzy)" },
        fallback_parent: { icon: "⬆️", label: "Fallback (Parent)", color: C.orange, desc: "Ust kategori kullanildi" },
        unresolved: { icon: "❌", label: "Cozulemedi", color: C.red, desc: "Hicbir adimda eslestirilemedi" }
    };

    const rs = resolverStats;
    const pipe = rs?.pipeline || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Pipeline Istatistikleri */}
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>🧠</span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Smart Resolver Pipeline</span>
                    <Btn small outline color={C.accent} onClick={loadStats} loading={statsLoading}>Yenile</Btn>
                </div>

                {rs ? (
                    <>
                        {/* Pipeline Adimlari Gorsel */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                            {[
                                { step: 1, icon: "🎯", label: "Exact", desc: "Birebir mapping" },
                                { step: 2, icon: "🧠", label: "Learned", desc: "Ogrenilmis" },
                                { step: 3, icon: "🤖", label: "Hybrid AI", desc: "Emb+Kw+Hist" },
                                { step: 4, icon: "🔄", label: "Fallback", desc: "Parent/Fuzzy" },
                            ].map((s, i) => (
                                <React.Fragment key={s.step}>
                                    <div style={{
                                        background: C.accentSoft, border: `1px solid ${C.accent}40`,
                                        borderRadius: 10, padding: "10px 14px", textAlign: "center", minWidth: 100
                                    }}>
                                        <div style={{ fontSize: 20 }}>{s.icon}</div>
                                        <div style={{ color: C.text, fontSize: 11, fontWeight: 700, marginTop: 4 }}>Step {s.step}: {s.label}</div>
                                        <div style={{ color: C.textDim, fontSize: 9, marginTop: 2 }}>{s.desc}</div>
                                    </div>
                                    {i < 3 && <span style={{ color: C.textDim, fontSize: 18 }}>→</span>}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Istatistik Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                            {[
                                { icon: "📁", label: "Kategori", val: pipe.totalCategories || 0, color: C.accent },
                                { icon: "🔗", label: "Mapping", val: pipe.totalMappings || 0, color: C.teal },
                                { icon: "🧠", label: "Hafiza", val: pipe.totalMemories || 0, color: C.purple },
                                { icon: "⚠️", label: "Bekleyen", val: pipe.totalUnmapped || 0, color: C.red },
                                { icon: "✅", label: "Cozulmus", val: pipe.totalResolved || 0, color: C.green },
                                { icon: "📅", label: "Bu Hafta", val: pipe.recentResolved || 0, color: C.blue },
                            ].map(k => (
                                <div key={k.label} style={{
                                    background: k.color + "10", border: `1px solid ${k.color}25`,
                                    borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8
                                }}>
                                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                                        <div style={{ color: C.textDim, fontSize: 9, fontWeight: 600, marginTop: 1 }}>{k.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Confidence Thresholds */}
                        {rs.confidence && (
                            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Badge color={C.green}>Auto-Apply: ≥{(rs.confidence.AUTO_APPLY * 100)}%</Badge>
                                <Badge color={C.yellow}>Suggest: ≥{(rs.confidence.SUGGEST * 100)}%</Badge>
                                <Badge color={C.purple}>Auto-Learn: ≥{(rs.confidence.AUTO_LEARN * 100)}% + {rs.confidence.MIN_LEARN_HITS} hit</Badge>
                                {rs.embeddingCache && <Badge color={C.blue}>Embedding Cache: {rs.embeddingCache.size}/{rs.embeddingCache.maxSize}</Badge>}
                            </div>
                        )}

                        {/* Source Dagilimi */}
                        {rs.sourceDistribution && Object.keys(rs.sourceDistribution).length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>KAYNAK DAGILIMI</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {Object.entries(rs.sourceDistribution).map(([src, count]) => (
                                        <Badge key={src} color={C.accent}>{src}: {count}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: 20 }}>
                        {statsLoading ? "Yukleniyor..." : "Istatistik yuklenemedi"}
                    </div>
                )}
            </Card>

            {/* Tek Urun Test */}
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>🧪</span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Pipeline Test — Tek Urun</span>
                </div>
                <div style={{ color: C.textDim, fontSize: 11, marginBottom: 12 }}>
                    Bir urun bilgisi girin, 4 adimli pipeline'in nasil calistigini gorun.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}>
                    <Input placeholder="Urun basligi (ornek: iPhone 15 Pro Max Kilif)"
                        value={testProduct.title}
                        onChange={e => setTestProduct(p => ({ ...p, title: e.target.value }))} />
                    <Input placeholder="Kategori (ornek: Telefon Kilifi)"
                        value={testProduct.category}
                        onChange={e => setTestProduct(p => ({ ...p, category: e.target.value }))} />
                    <Input placeholder="Marka (ornek: Apple)"
                        value={testProduct.brand}
                        onChange={e => setTestProduct(p => ({ ...p, brand: e.target.value }))} />
                    <select value={testMarketplace} onChange={e => setTestMarketplace(e.target.value)}
                        style={{
                            background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                            borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none"
                        }}>
                        {ALL_MARKETPLACES.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                    </select>
                </div>

                <Btn color={C.accent} onClick={handleTestResolve} loading={resolving}
                    disabled={!testProduct.title && !testProduct.category}>
                    🧠 Pipeline Calistir
                </Btn>

                {/* Sonuc */}
                {resolveResult && (
                    <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: resolveResult.resolved ? C.greenSoft : C.redSoft, border: `1px solid ${resolveResult.resolved ? C.green : C.red}30` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            {(() => {
                                const s = STEP_LABELS[resolveResult.source] || STEP_LABELS.unresolved;
                                return (
                                    <>
                                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                                        <div>
                                            <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                                                {resolveResult.resolved ? "Cozuldu" : "Cozulemedi"} — {s.label}
                                            </div>
                                            <div style={{ color: C.textDim, fontSize: 10 }}>{s.desc}</div>
                                        </div>
                                        <Badge color={s.color}>Step {resolveResult.step || 0}</Badge>
                                        <Badge color={resolveResult.confidence >= 0.85 ? C.green : resolveResult.confidence >= 0.6 ? C.yellow : C.red}>
                                            Guven: {Math.round((resolveResult.confidence || 0) * 100)}%
                                        </Badge>
                                        {resolveResult.autoApplied && <Badge color={C.green}>🚀 Auto-Applied</Badge>}
                                        {resolveResult.isFallback && <Badge color={C.orange}>⚠️ Fallback</Badge>}
                                        {resolveResult.resolveTime && <Badge color={C.textDim}>{resolveResult.resolveTime}ms</Badge>}
                                    </>
                                );
                            })()}
                        </div>

                        {resolveResult.resolved && resolveResult.marketplaceCategory && (
                            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 8 }}>
                                <div>
                                    <div style={{ color: C.textDim, fontSize: 9, fontWeight: 700 }}>DAHILI</div>
                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>
                                        {resolveResult.internalCategory?.icon || "📁"} {resolveResult.internalCategory?.name || "?"}
                                    </div>
                                </div>
                                <span style={{ color: C.accent, fontSize: 16 }}>→</span>
                                <div>
                                    <div style={{ color: C.textDim, fontSize: 9, fontWeight: 700 }}>{testMarketplace}</div>
                                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>
                                        {resolveResult.marketplaceCategory.name}
                                    </div>
                                    {resolveResult.marketplaceCategory.path && resolveResult.marketplaceCategory.path !== resolveResult.marketplaceCategory.name && (
                                        <div style={{ color: C.textDim, fontSize: 10 }}>{resolveResult.marketplaceCategory.path}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Hybrid Breakdown */}
                        {resolveResult.breakdown && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>HYBRID SKOR DETAYI</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[
                                        { label: "Embedding", val: resolveResult.breakdown.embedding, color: C.accent, weight: "50%" },
                                        { label: "Keyword", val: resolveResult.breakdown.keyword, color: C.green, weight: "30%" },
                                        { label: "Historical", val: resolveResult.breakdown.historical, color: C.purple, weight: "20%" },
                                    ].map(b => (
                                        <div key={b.label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ color: C.textDim, fontSize: 9, fontWeight: 700 }}>{b.label} ({b.weight})</span>
                                                <span style={{ color: b.color, fontSize: 11, fontWeight: 700 }}>{Math.round(b.val * 100)}%</span>
                                            </div>
                                            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                                                <div style={{ width: `${b.val * 100}%`, height: "100%", background: b.color, borderRadius: 2 }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Alternatifler */}
                        {resolveResult.alternatives && resolveResult.alternatives.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>ALTERNATİFLER</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {resolveResult.alternatives.map((alt, i) => (
                                        <Badge key={i} color={C.textSub}>{alt.name} ({Math.round(alt.score * 100)}%)</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Suggestions (cozulemedi ise) */}
                        {!resolveResult.resolved && resolveResult.suggestions && resolveResult.suggestions.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ color: C.textDim, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>ONERILER</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {resolveResult.suggestions.map((s, i) => (
                                        <Badge key={i} color={C.yellow}>{s.name} ({Math.round((s.score || 0) * 100)}%)</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Toplu Test */}
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>📦</span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Toplu Pipeline Test</span>
                </div>
                <div style={{ color: C.textDim, fontSize: 11, marginBottom: 8 }}>
                    Her satira bir urun yazin. Format: <code style={{ color: C.accent }}>baslik | kategori | marka</code>
                </div>
                <textarea value={batchText} onChange={e => setBatchText(e.target.value)}
                    placeholder={"iPhone 15 Pro Max Kilif | Telefon Aksesuari | Apple\nNike Air Max 90 | Spor Ayakkabi | Nike\nDekoratif Vazo | Ev Dekorasyon | "}
                    rows={5}
                    style={{
                        width: "100%", background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                        borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace",
                        resize: "vertical", outline: "none", boxSizing: "border-box"
                    }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <select value={testMarketplace} onChange={e => setTestMarketplace(e.target.value)}
                        style={{
                            background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                            borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none"
                        }}>
                        {ALL_MARKETPLACES.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                    </select>
                    <Btn color={C.teal} onClick={handleBatchResolve} loading={batchResolving}
                        disabled={!batchText.trim()}>
                        📦 Toplu Calistir
                    </Btn>
                </div>

                {/* Batch Sonuc */}
                {batchResult && !batchResult.error && batchResult.stats && (
                    <div style={{ marginTop: 14 }}>
                        {/* Stats Bar */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <Badge color={C.accent}>Toplam: {batchResult.stats.total}</Badge>
                            <Badge color={C.green}>Cozuldu: {batchResult.stats.resolved}</Badge>
                            <Badge color={C.purple}>Auto: {batchResult.stats.autoApplied}</Badge>
                            <Badge color={C.yellow}>Fallback: {batchResult.stats.fallback}</Badge>
                            <Badge color={C.red}>Basarisiz: {batchResult.stats.unresolved}</Badge>
                            <Badge color={batchResult.stats.successRate >= 80 ? C.green : batchResult.stats.successRate >= 50 ? C.yellow : C.red}>
                                Basari: %{batchResult.stats.successRate}
                            </Badge>
                        </div>

                        {/* Sonuc Tablosu */}
                        <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                        {["Urun", "Kaynak", "Step", "Dahili", "Platform Kategori", "Guven"].map(h => (
                                            <th key={h} style={{ color: C.textDim, fontSize: 10, fontWeight: 700, padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(batchResult.results || []).map((r, i) => {
                                        const s = STEP_LABELS[r.source] || STEP_LABELS.unresolved;
                                        return (
                                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                                <td style={{ padding: "6px 10px" }}>
                                                    <div style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{r.product?.title || "?"}</div>
                                                    <div style={{ color: C.textDim, fontSize: 9 }}>{r.product?.category || ""}</div>
                                                </td>
                                                <td style={{ padding: "6px 10px" }}><Badge color={s.color}>{s.icon} {s.label}</Badge></td>
                                                <td style={{ padding: "6px 10px" }}><Badge color={C.accent}>{r.step || 0}</Badge></td>
                                                <td style={{ padding: "6px 10px" }}>
                                                    <span style={{ color: C.text, fontSize: 11 }}>{r.internalCategory?.icon} {r.internalCategory?.name || "—"}</span>
                                                </td>
                                                <td style={{ padding: "6px 10px" }}>
                                                    <span style={{ color: C.text, fontSize: 11 }}>{r.marketplaceCategory?.name || "—"}</span>
                                                </td>
                                                <td style={{ padding: "6px 10px" }}>
                                                    <ScoreBar score={r.confidence} small />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {batchResult?.error && (
                    <div style={{ marginTop: 12, color: C.red, fontSize: 12 }}>❌ Hata: {batchResult.error}</div>
                )}
            </Card>

            {/* Acil Cozulmesi Gerekenler */}
            {rs?.urgentUnmapped && rs.urgentUnmapped.length > 0 && (
                <Card style={{ borderLeft: `3px solid ${C.red}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>🔥</span>
                        <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Acil Cozulmesi Gerekenler</span>
                        <Badge color={C.red}>{rs.urgentUnmapped.length}</Badge>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {rs.urgentUnmapped.map((item, idx) => (
                            <div key={item._id} style={{
                                display: "flex", alignItems: "center", gap: 10,
                                background: "rgba(239,68,68,0.06)", borderRadius: 8, padding: "8px 12px"
                            }}>
                                <Badge color={C.red}>#{idx + 1}</Badge>
                                <div style={{ flex: 1 }}>
                                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{item.categoryName}</span>
                                    <span style={{ color: C.textDim, fontSize: 10, marginLeft: 8 }}>{item.marketplace} · {item.hitCount}x basarisiz</span>
                                </div>
                                {item.suggestedCategories && item.suggestedCategories.length > 0 && (
                                    <div style={{ display: "flex", gap: 4 }}>
                                        {item.suggestedCategories.map((s, si) => (
                                            <Badge key={si} color={C.yellow} style={{ fontSize: 9 }}>{s.name} ({Math.round((s.score || 0) * 100)}%)</Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME: ✅ EŞLEŞEN KATEGORİLER — Revize & Düzenleme
// ═══════════════════════════════════════════════════════════════════════════════

const MatchedCategoriesTab = ({ onRefresh }) => {
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [matchType, setMatchType] = useState("");
    const [rootFilter, setRootFilter] = useState("");
    const [leafOnly, setLeafOnly] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [pagination, setPagination] = useState(null);

    // Modal
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [editNotes, setEditNotes] = useState("");
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);

    // Platform kategori seçimi
    const [editingPlatform, setEditingPlatform] = useState(null);
    const [platformCategories, setPlatformCategories] = useState([]);
    const [platformSearch, setPlatformSearchText] = useState("");
    const [platformLoading, setPlatformLoading] = useState(false);
    const [editedPlatforms, setEditedPlatforms] = useState({});

    const loadStats = useCallback(async () => {
        try { setStats((await getUnifiedStats()).stats); } catch (err) { console.error(err); }
    }, []);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const params = { search, matchType, page, limit };
            if (leafOnly) params.leafOnly = "true";
            if (rootFilter) params.rootCategory = rootFilter;
            const res = await getUnifiedCategories(params);
            setCategories(res.categories || []);
            setPagination(res.pagination || null);
        } catch (err) { console.error(err); setCategories([]); }
        setLoading(false);
    }, [search, matchType, rootFilter, leafOnly, page, limit]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadCategories(); }, [loadCategories]);

    const handleSearch = () => { setSearch(searchInput); setPage(1); };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" silinsin mi?`)) return;
        try { await deleteUnifiedCategory(id); loadCategories(); loadStats(); }
        catch (err) { alert(`Hata: ${err.message}`); }
    };

    const handleSaveEdit = async () => {
        if (!selectedCategory) return;
        setSaving(true);
        try {
            const API = (await import("../services/api")).default;
            const body = { canonicalName: editName || selectedCategory.canonicalName, notes: editNotes };
            if (editedPlatforms.trendyol !== undefined) body.trendyol = editedPlatforms.trendyol;
            if (editedPlatforms.n11 !== undefined) body.n11 = editedPlatforms.n11;
            if (editedPlatforms.ciceksepeti !== undefined) body.ciceksepeti = editedPlatforms.ciceksepeti;
            if (editedPlatforms.hepsiburada !== undefined) body.hepsiburada = editedPlatforms.hepsiburada;
            if (editedPlatforms.amazon !== undefined) body.amazon = editedPlatforms.amazon;

            await API.put(`/category-smart/unified/${selectedCategory._id}`, body);
            setShowDetail(false);
            loadCategories();
            loadStats();
        } catch (err) { alert(`Hata: ${err.response?.data?.message || err.message}`); }
        setSaving(false);
    };

    const openDetail = (cat) => {
        setSelectedCategory(cat);
        setEditName(cat.canonicalName || "");
        setEditNotes(cat.notes || "");
        setEditedPlatforms({});
        setEditingPlatform(null);
        setPlatformCategories([]);
        setPlatformSearchText("");
        setShowDetail(true);
    };

    const searchPlatformCategories = async (marketplace, query) => {
        if (!query || query.length < 2) { setPlatformCategories([]); return; }
        setPlatformLoading(true);
        try {
            const res = await getMarketplaceCategories(marketplace, query, false, 1, 50);
            setPlatformCategories(res.categories || []);
        } catch (err) { setPlatformCategories([]); }
        setPlatformLoading(false);
    };

    const openPlatformPicker = (key) => {
        setEditingPlatform(key);
        setPlatformSearchText("");
        setPlatformCategories([]);
    };

    const confirmPlatformSelection = (cat) => {
        if (!editingPlatform || !cat) return;
        setEditedPlatforms(prev => ({ ...prev, [editingPlatform]: {
            categoryId: String(cat.id), categoryName: cat.name,
            categoryPath: cat.path || cat.name, depth: cat.depth || 0,
            parentId: cat.parentId || null, parentName: cat.parentName || null,
            isLeaf: cat.isLeaf !== undefined ? cat.isLeaf : true
        }}));
        setEditingPlatform(null);
        setPlatformCategories([]);
        setPlatformSearchText("");
    };

    const removePlatformMapping = (key) => setEditedPlatforms(prev => ({ ...prev, [key]: null }));

    const getPlatformData = (key) => editedPlatforms[key] !== undefined ? editedPlatforms[key] : selectedCategory?.[key] || null;

    const mtColor = (t) => t === "exact" ? "#4ade80" : t === "2of3" ? "#fbbf24" : t === "single" ? "#f87171" : t === "manual" ? "#c084fc" : "#64748b";
    const mtLabel = (t) => t === "exact" ? "3/3" : t === "2of3" ? "2/3" : t === "single" ? "1/3" : t === "manual" ? "Manuel" : t;

    const rootCategories = (stats?.rootDistribution || []).slice(0, 20);
    const ss = { select: { padding: "7px 10px", fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, outline: "none" } };

    return (
        <div>
            {/* Bilgi */}
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 14, lineHeight: 1.6 }}>
                Eşleşen kategorileri inceleyin, eksik platformları manuel olarak eşleştirin. Ürün dağıtımında bu eşleşmeler otomatik kullanılır.
            </div>

            {/* Özet Sayılar */}
            {stats && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {[
                        { val: stats.total, label: "Toplam", mt: "" },
                        { val: stats.exact3, label: "3/3", mt: "exact" },
                        { val: stats.match2, label: "2/3", mt: "2of3" },
                        { val: stats.single, label: "1/3", mt: "single" },
                    ].map(s => (
                        <div key={s.label}
                            onClick={() => { setMatchType(matchType === s.mt ? "" : s.mt); setPage(1); }}
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
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                        {[
                            { val: stats.platforms?.trendyol || 0, label: "T", color: "#f97316" },
                            { val: stats.platforms?.n11 || 0, label: "N", color: "#a855f7" },
                            { val: stats.platforms?.ciceksepeti || 0, label: "Ç", color: "#ec4899" },
                            { val: stats.platforms?.hepsiburada || 0, label: "H", color: "#22c55e" },
                            { val: stats.platforms?.amazon || 0, label: "A", color: "#f59e0b" },
                        ].map(p => (
                            <span key={p.label} style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>{p.label}:{p.val}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Arama & Filtreler */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 6 }}>
                    <Input value={searchInput} onChange={setSearchInput} placeholder="Kategori ara..."
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        style={{ fontSize: 12, padding: "7px 12px" }} />
                    <Btn onClick={handleSearch} small>Ara</Btn>
                    {search && <Btn onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} color={C.red} outline small>✕</Btn>}
                </div>
                <select value={matchType} onChange={(e) => { setMatchType(e.target.value); setPage(1); }} style={ss.select}>
                    <option value="">Tüm Eşleşmeler</option>
                    <option value="exact">3/3 Platform</option>
                    <option value="2of3">2/3 Platform</option>
                    <option value="single">1/3 Platform</option>
                    <option value="manual">Manuel</option>
                </select>
                <Btn onClick={() => setShowAdvanced(!showAdvanced)} color={C.textSub} outline small>
                    {showAdvanced ? "▲ Kapat" : "▼ Filtre"}
                </Btn>
                <Btn onClick={() => { loadStats(); loadCategories(); }} color={C.textSub} outline small>↻</Btn>
            </div>

            {showAdvanced && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14, padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <select value={rootFilter} onChange={(e) => { setRootFilter(e.target.value); setPage(1); }} style={{ ...ss.select, minWidth: 150 }}>
                        <option value="">Tüm Kökler</option>
                        {rootCategories.map(r => <option key={r.name} value={r.name}>{r.name} ({r.count})</option>)}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSub, cursor: "pointer" }}>
                        <input type="checkbox" checked={leafOnly} onChange={(e) => { setLeafOnly(e.target.checked); setPage(1); }} />
                        Sadece yaprak
                    </label>
                    <Btn onClick={() => { setMatchType(""); setRootFilter(""); setLeafOnly(false); setSearch(""); setSearchInput(""); setPage(1); }} color={C.textDim} outline small>Temizle</Btn>
                </div>
            )}

            {/* Tablo */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: C.surface }}>
                            <th style={{ padding: "9px 12px", textAlign: "left", color: C.textSub, fontWeight: 600, fontSize: 11 }}>Kategori</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: C.textSub, fontWeight: 600, fontSize: 11, width: 50 }}>Durum</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: "#f97316", fontWeight: 600, fontSize: 11, width: 40 }}>T</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: "#a855f7", fontWeight: 600, fontSize: 11, width: 40 }}>N</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: "#ec4899", fontWeight: 600, fontSize: 11, width: 40 }}>Ç</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: "#22c55e", fontWeight: 600, fontSize: 11, width: 40 }}>H</th>
                            <th style={{ padding: "9px 12px", textAlign: "center", color: "#f59e0b", fontWeight: 600, fontSize: 11, width: 40 }}>A</th>
                            <th style={{ padding: "9px 8px", textAlign: "center", color: C.textSub, fontWeight: 600, fontSize: 11, width: 60 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ padding: 32, textAlign: "center", color: C.textDim }}>Yükleniyor...</td></tr>
                        ) : categories.length === 0 ? (
                            <tr><td colSpan="8" style={{ padding: 32, textAlign: "center", color: C.textDim }}>
                                {stats?.total === 0 ? "Henüz eşleşme yok. Ortak Merkez'den Excel yükleyin." : "Sonuç yok."}
                            </td></tr>
                        ) : categories.map(cat => (
                            <tr key={cat._id}
                                style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer", transition: "background .1s" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                onClick={() => openDetail(cat)}>
                                <td style={{ padding: "8px 12px" }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{cat.canonicalName}</div>
                                    {cat.rootCategory && <span style={{ fontSize: 10, color: C.textDim }}>{cat.rootCategory}</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: mtColor(cat.matchType) }}>{mtLabel(cat.matchType)}</span>
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                    {cat.trendyol?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                    {cat.n11?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                    {cat.ciceksepeti?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                    {cat.hepsiburada?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 11 }}>
                                    {cat.amazon?.categoryId ? <span style={{ color: "#4ade80" }}>✓</span> : <span style={{ color: "#475569" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 8px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                        <button onClick={() => openDetail(cat)} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", fontSize: 13, padding: 2 }} title="Düzenle">✏️</button>
                                        <button onClick={() => handleDelete(cat._id, cat.canonicalName)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, padding: 2 }} title="Sil">🗑</button>
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
                            <Btn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} small>‹</Btn>
                            <Btn onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} small>›</Btn>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ DÜZENLEME MODAL ═══ */}
            {showDetail && selectedCategory && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 10000
                }} onClick={() => setShowDetail(false)}>
                    <div style={{
                        background: "#141820", border: `1px solid ${C.border}`, borderRadius: 10,
                        width: "94%", maxWidth: 820, maxHeight: "88vh", overflow: "auto",
                        padding: "20px 24px"
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Başlık */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ flex: 1 }}>
                                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                    style={{ width: "100%", padding: "6px 10px", fontSize: 14, fontWeight: 700, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, outline: "none" }}
                                    onFocus={(e) => e.target.style.borderColor = C.accent + "60"}
                                    onBlur={(e) => e.target.style.borderColor = C.border} />
                                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: mtColor(selectedCategory.matchType), background: mtColor(selectedCategory.matchType) + "15", padding: "2px 8px", borderRadius: 4 }}>
                                        {mtLabel(selectedCategory.matchType)}
                                    </span>
                                    {selectedCategory.rootCategory && <span style={{ fontSize: 10, color: C.textDim }}>{selectedCategory.rootCategory}</span>}
                                    {selectedCategory.canonicalPath && <span style={{ fontSize: 10, color: C.textDim }}>· {selectedCategory.canonicalPath}</span>}
                                    {Object.keys(editedPlatforms).length > 0 && <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600, marginLeft: "auto" }}>● Değişiklik var</span>}
                                </div>
                            </div>
                            <button onClick={() => setShowDetail(false)}
                                style={{ background: "none", border: "none", color: C.textDim, fontSize: 18, cursor: "pointer", marginLeft: 12, padding: 4 }}>✕</button>
                        </div>

                        {/* Platform Kartları */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
                            {[
                                { key: "trendyol", label: "Trendyol", color: "#f97316", mpName: "Trendyol" },
                                { key: "n11", label: "N11", color: "#a855f7", mpName: "N11" },
                                { key: "ciceksepeti", label: "ÇiçekSepeti", color: "#ec4899", mpName: "ÇiçekSepeti" },
                                { key: "hepsiburada", label: "Hepsiburada", color: "#22c55e", mpName: "Hepsiburada" },
                                { key: "amazon", label: "Amazon", color: "#f59e0b", mpName: "Amazon" },
                            ].map(p => {
                                const data = getPlatformData(p.key);
                                const isEdited = editedPlatforms[p.key] !== undefined;
                                const isPickerOpen = editingPlatform === p.key;

                                return (
                                    <div key={p.key} style={{
                                        background: C.bg, borderRadius: 8, padding: 12,
                                        border: `1px solid ${isEdited ? "#fbbf24" + "60" : data?.categoryId ? p.color + "30" : C.border}`
                                    }}>
                                        {/* Başlık */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.label}</span>
                                            <span style={{ fontSize: 10, color: data?.categoryId ? "#4ade80" : "#f87171" }}>{data?.categoryId ? "✓" : "✗"}</span>
                                        </div>

                                        {/* İçerik */}
                                        {data?.categoryId ? (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginBottom: 2 }}>{data.categoryName}</div>
                                                <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.4 }}>
                                                    {(data.categoryPath || "").split(" > ").join(" › ")}
                                                </div>
                                                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>ID: {data.categoryId}</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, padding: "4px 0" }}>Eşleşme yok</div>
                                        )}

                                        {/* Butonlar */}
                                        {!isPickerOpen && (
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={() => openPlatformPicker(p.key)}
                                                    style={{ flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 600, background: p.color + "12", color: p.color, border: `1px solid ${p.color}30`, borderRadius: 5, cursor: "pointer" }}>
                                                    {data?.categoryId ? "Değiştir" : "Seç"}
                                                </button>
                                                {data?.categoryId && (
                                                    <button onClick={() => removePlatformMapping(p.key)}
                                                        style={{ padding: "5px 8px", fontSize: 10, background: "transparent", color: "#64748b", border: `1px solid ${C.border}`, borderRadius: 5, cursor: "pointer" }}>✗</button>
                                                )}
                                            </div>
                                        )}

                                        {/* Arama Paneli */}
                                        {isPickerOpen && (
                                            <div style={{ marginTop: 4 }}>
                                                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                                                    <input
                                                        value={platformSearch}
                                                        onChange={(e) => setPlatformSearchText(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && searchPlatformCategories(p.mpName, platformSearch)}
                                                        placeholder="Kategori ara..."
                                                        autoFocus
                                                        style={{ flex: 1, padding: "5px 8px", fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, outline: "none" }}
                                                    />
                                                    <button onClick={() => searchPlatformCategories(p.mpName, platformSearch)}
                                                        disabled={platformLoading}
                                                        style={{ padding: "5px 10px", fontSize: 10, fontWeight: 600, background: p.color, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
                                                        {platformLoading ? "..." : "Ara"}
                                                    </button>
                                                </div>

                                                {platformCategories.length > 0 && (
                                                    <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 5 }}>
                                                        {platformCategories.map((cat, idx) => (
                                                            <div key={cat.id || idx}
                                                                onClick={() => confirmPlatformSelection(cat)}
                                                                style={{ padding: "6px 8px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                                                <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{cat.name}</div>
                                                                <div style={{ fontSize: 9, color: C.textDim }}>{(cat.path || "").split(" > ").join(" › ")}</div>
                                                                <div style={{ fontSize: 9, color: C.textDim }}>ID: {cat.id} · {cat.isLeaf ? "Yaprak" : "Üst"}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {!platformLoading && platformSearch.length >= 2 && platformCategories.length === 0 && (
                                                    <div style={{ fontSize: 10, color: C.textDim, padding: 6, textAlign: "center" }}>Sonuç yok</div>
                                                )}
                                                <button onClick={() => { setEditingPlatform(null); setPlatformCategories([]); setPlatformSearchText(""); }}
                                                    style={{ width: "100%", marginTop: 4, padding: "4px 0", fontSize: 10, background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 5, cursor: "pointer" }}>
                                                    İptal
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Not */}
                        <div style={{ marginBottom: 14 }}>
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Not ekleyin (isteğe bağlı)..."
                                rows={2}
                                style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, resize: "vertical", outline: "none" }} />
                        </div>

                        {/* Alt Bar */}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            {Object.keys(editedPlatforms).length > 0 && (
                                <span style={{ fontSize: 10, color: "#fbbf24", marginRight: "auto" }}>
                                    {Object.keys(editedPlatforms).length} değişiklik
                                </span>
                            )}
                            <button onClick={() => setShowDetail(false)}
                                style={{ padding: "7px 16px", fontSize: 12, background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>İptal</button>
                            <button onClick={handleSaveEdit} disabled={saving}
                                style={{ padding: "7px 20px", fontSize: 12, fontWeight: 600, background: C.accent, color: "#fff", border: "none", borderRadius: 6, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANA SAYFA BİLEŞENİ
// ═══════════════════════════════════════════════════════════════════════════════

const CategoryMappingPage = () => {
    const [tab, setTab] = useState("marketplace");

    const tabs = [
        { key: "marketplace", label: "PY Kategorileri",  icon: "📦" },
        { key: "unified",     label: "Ortak Merkez",     icon: "🗺️" },
        { key: "matched",     label: "Eşleşen",          icon: "✅" },
    ];

    return (
        <div style={{
            minHeight: "100vh", background: C.bg, color: C.text,
            fontFamily: "'Inter', -apple-system, sans-serif", padding: "16px 20px"
        }}>
            {/* Başlık */}
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: "0 0 2px 0" }}>
                    Kategori Eşleştirme
                </h1>
                <p style={{ color: C.textDim, fontSize: 11, margin: 0 }}>
                    Pazaryeri kategorilerini yönetin ve eşleştirin.
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
                                border: "none", borderBottom: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
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
            {tab === "marketplace" && <MarketplaceCategoriesTab onRefresh={() => {}} />}
            {tab === "unified"     && <UnifiedCategoryTab onRefresh={() => {}} />}
            {tab === "matched"     && <MatchedCategoriesTab onRefresh={() => {}} />}
        </div>
    );
};

export default CategoryMappingPage;
