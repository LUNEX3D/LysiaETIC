/**
 * KATEGORİ EŞLEŞTİRME SAYFASI
 *
 * Sekmeler:
 *   1. Eşleştirilmemiş Kategoriler — mapping bekleyen kategoriler, önerilerle
 *   2. Kayıtlı Mapping'ler         — mevcut eşleştirmeler, düzenleme/silme
 *   3. Ürün Gönderme               — seçili ürünü platforma göre revize edip gönder
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    getUnmappedCategories,
    getUnmappedStats,
    getCategoryMappings,
    saveCategoryMapping,
    deleteCategoryMapping,
    getN11Categories,
} from "../services/categoryMappingApi";

// ─── Renkler & Sabitler ───────────────────────────────────────────────────────
const COLORS = {
    bg:        "#0f1117",
    card:      "#1a1f2e",
    cardBorder:"rgba(255,255,255,0.07)",
    accent:    "#6f2da8",
    accentSoft:"rgba(111,45,168,0.15)",
    teal:      "#0f766e",
    tealSoft:  "rgba(15,118,110,0.15)",
    warn:      "#f59e0b",
    warnSoft:  "rgba(245,158,11,0.12)",
    danger:    "#ef4444",
    dangerSoft:"rgba(239,68,68,0.12)",
    success:   "#22c55e",
    successSoft:"rgba(34,197,94,0.12)",
    text:      "#e2e8f0",
    textMuted: "#64748b",
    textSub:   "#94a3b8",
};

// ─── Yardımcı Bileşenler ──────────────────────────────────────────────────────

const Badge = ({ color, children }) => (
    <span style={{
        background: color + "22", color, border: `1px solid ${color}44`,
        borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600
    }}>{children}</span>
);

const Btn = ({ onClick, color = COLORS.accent, outline, disabled, children, style = {} }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        style={{
            background:   outline ? "transparent" : color,
            color:        outline ? color : "#fff",
            border:       `1.5px solid ${color}`,
            borderRadius: 8, padding: "7px 18px",
            fontWeight: 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1, transition: "all .15s",
            ...style
        }}
    >{children}</button>
);

const Input = ({ value, onChange, placeholder, style = {} }) => (
    <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
            background: "#0f1117", border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: COLORS.text, padding: "8px 14px",
            fontSize: 13, outline: "none", width: "100%", ...style
        }}
    />
);

const Card = ({ children, style = {} }) => (
    <div style={{
        background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 14, padding: "1.25rem", ...style
    }}>{children}</div>
);

const ScoreDot = ({ score }) => {
    const color = score >= 0.85 ? COLORS.success : score >= 0.7 ? COLORS.warn : COLORS.danger;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            color, fontWeight: 700, fontSize: 13
        }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {Math.round(score * 100)}%
        </span>
    );
};

// ─── Ağaç Kategori Seçici ─────────────────────────────────────────────────────

// Ağaçta eşleşen düğüm var mı? (recursive)
const hasMatchingDescendant = (cats, q) => {
    if (!cats || !q) return false;
    return cats.some(c =>
        (c.name || c.categoryName || "").toLowerCase().includes(q) ||
        hasMatchingDescendant(c.subCategories, q)
    );
};

// Tek bir ağaç düğümü (açılır/kapanır)
const CategoryTreeNode = ({ node, depth, search, onSelect, selectedId }) => {
    const hasChildren = node.subCategories && node.subCategories.length > 0;
    const isLeaf = !hasChildren;

    // Arama yoksa kapalı başla; arama varsa ve bu dal eşleşiyorsa aç
    const q = search.toLowerCase();
    const name = node.name || node.categoryName || "";
    const id   = String(node.id || node.categoryId || "");

    const matchesSelf  = q ? name.toLowerCase().includes(q) : false;
    const matchesChild = q ? hasMatchingDescendant(node.subCategories, q) : false;
    const shouldOpen   = q ? (matchesSelf || matchesChild) : false;

    const [open, setOpen] = useState(false);

    // Arama değişince otomatik aç/kapat
    useEffect(() => {
        setOpen(shouldOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Arama varsa: sadece eşleşen dal görünsün
    if (q && !matchesSelf && !matchesChild) return null;

    const isSelected = selectedId === id;

    return (
        <div style={{ marginLeft: depth * 14 }}>
            <div
                onClick={() => {
                    if (isLeaf) onSelect(id, name);
                    else setOpen(o => !o);
                }}
                style={{
                    display:       "flex",
                    alignItems:    "center",
                    gap:           7,
                    padding:       "7px 10px",
                    borderRadius:  7,
                    cursor:        "pointer",
                    background:    isSelected
                        ? COLORS.accentSoft
                        : "transparent",
                    border:        isSelected
                        ? `1px solid ${COLORS.accent}55`
                        : "1px solid transparent",
                    transition:    "all .12s",
                    userSelect:    "none",
                }}
                onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
            >
                {/* Ok ikonu */}
                {hasChildren ? (
                    <span style={{
                        fontSize: 11, color: COLORS.textMuted,
                        transition: "transform .15s",
                        display: "inline-block",
                        transform: open ? "rotate(90deg)" : "rotate(0deg)"
                    }}>▶</span>
                ) : (
                    <span style={{ width: 11, display: "inline-block" }} />
                )}

                {/* Klasör / yaprak ikonu */}
                <span style={{ fontSize: 14 }}>
                    {hasChildren ? (open ? "📂" : "📁") : "🏷️"}
                </span>

                {/* İsim */}
                <span style={{
                    fontSize:   13,
                    fontWeight: isLeaf ? 500 : 600,
                    color:      isSelected ? COLORS.accent : COLORS.text,
                    flex:       1,
                }}>
                    {name}
                </span>

                {/* ID etiketi (sadece yaprak) */}
                {isLeaf && (
                    <span style={{
                        fontSize: 10, color: COLORS.textMuted,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 4, padding: "1px 5px"
                    }}>
                        #{id}
                    </span>
                )}

                {/* Seçildi işareti */}
                {isSelected && (
                    <span style={{ color: COLORS.success, fontSize: 14 }}>✓</span>
                )}
            </div>

            {/* Alt kategoriler */}
            {hasChildren && open && (
                <div style={{
                    borderLeft: `1.5px solid rgba(255,255,255,0.07)`,
                    marginLeft: 16,
                    marginTop:  2,
                    marginBottom: 2,
                }}>
                    {node.subCategories.map((child, i) => (
                        <CategoryTreeNode
                            key={child.id || i}
                            node={child}
                            depth={0}
                            search={search}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Açılır panel + arama + ağaç
const CategoryTreePicker = ({ categories, selectedId, selectedName, onSelect, loading }) => {
    const [open, setOpen]     = useState(false);
    const [search, setSearch] = useState("");
    const ref                 = useRef(null);

    // Dışarı tıklayınca kapat
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSelect = (id, name) => {
        onSelect(id, name);
        setOpen(false);
        setSearch("");
    };

    return (
        <div ref={ref} style={{ position: "relative", width: "100%" }}>
            {/* Tetikleyici buton */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width:        "100%",
                    background:   "#0f1117",
                    border:       `1.5px solid ${open ? COLORS.accent : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8,
                    color:        selectedName ? COLORS.text : COLORS.textMuted,
                    padding:      "9px 14px",
                    fontSize:     13,
                    textAlign:    "left",
                    cursor:       "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "space-between",
                    gap:          8,
                    transition:   "border-color .15s",
                }}
            >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {loading
                        ? "⏳ Kategoriler yükleniyor..."
                        : selectedName
                            ? `🏷️ ${selectedName}`
                            : "📁 N11 kategorisi seçin..."
                    }
                </span>
                <span style={{
                    fontSize: 11, color: COLORS.textMuted,
                    transition: "transform .15s",
                    transform: open ? "rotate(180deg)" : "rotate(0deg)"
                }}>▼</span>
            </button>

            {/* Açılır panel */}
            {open && !loading && (
                <div style={{
                    position:     "absolute",
                    top:          "calc(100% + 6px)",
                    left:         0,
                    right:        0,
                    zIndex:       9999,
                    background:   "#161b2e",
                    border:       `1.5px solid ${COLORS.accent}55`,
                    borderRadius: 10,
                    boxShadow:    "0 8px 32px rgba(0,0,0,0.5)",
                    overflow:     "hidden",
                }}>
                    {/* Arama kutusu */}
                    <div style={{
                        padding:      "10px 12px",
                        borderBottom: `1px solid rgba(255,255,255,0.07)`,
                        background:   "#0f1117",
                        position:     "sticky",
                        top:          0,
                        zIndex:       1,
                    }}>
                        <div style={{ position: "relative" }}>
                            <span style={{
                                position: "absolute", left: 10, top: "50%",
                                transform: "translateY(-50%)",
                                color: COLORS.textMuted, fontSize: 14, pointerEvents: "none"
                            }}>🔍</span>
                            <input
                                autoFocus
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Kategori ara... (örn: Takı, Aksesuar)"
                                style={{
                                    width:        "100%",
                                    background:   "rgba(255,255,255,0.05)",
                                    border:       `1px solid rgba(255,255,255,0.1)`,
                                    borderRadius: 7,
                                    color:        COLORS.text,
                                    padding:      "8px 12px 8px 34px",
                                    fontSize:     13,
                                    outline:      "none",
                                    boxSizing:    "border-box",
                                }}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    style={{
                                        position: "absolute", right: 8, top: "50%",
                                        transform: "translateY(-50%)",
                                        background: "none", border: "none",
                                        color: COLORS.textMuted, cursor: "pointer", fontSize: 14
                                    }}
                                >✕</button>
                            )}
                        </div>
                        {search && (
                            <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 5 }}>
                                "{search}" için sonuçlar gösteriliyor
                            </div>
                        )}
                    </div>

                    {/* Kategori ağacı */}
                    <div style={{
                        maxHeight:  380,
                        overflowY:  "auto",
                        padding:    "6px 4px",
                    }}>
                        {categories.length === 0 ? (
                            <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 24, fontSize: 13 }}>
                                Kategori bulunamadı
                            </div>
                        ) : (
                            categories.map((cat, i) => (
                                <CategoryTreeNode
                                    key={cat.id || i}
                                    node={cat}
                                    depth={0}
                                    search={search}
                                    onSelect={handleSelect}
                                    selectedId={selectedId}
                                />
                            ))
                        )}
                    </div>

                    {/* Alt bilgi */}
                    <div style={{
                        padding:    "8px 14px",
                        borderTop:  `1px solid rgba(255,255,255,0.07)`,
                        background: "#0f1117",
                        fontSize:   11,
                        color:      COLORS.textMuted,
                        display:    "flex",
                        justifyContent: "space-between",
                    }}>
                        <span>📁 Ana başlığa tıklayarak alt kategorileri açın</span>
                        <span>🏷️ Yaprak kategoriye tıklayarak seçin</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Sekme 1: Eşleştirilmemiş Kategoriler ────────────────────────────────────

const UnmappedTab = ({ onMapped }) => {
    const [items, setItems]           = useState([]);
    const [stats, setStats]           = useState(null);
    const [loading, setLoading]       = useState(true);
    const [mappingId, setMappingId]   = useState(null);
    const [n11CatTree, setN11CatTree] = useState([]);   // ham ağaç yapısı
    const [catsLoading, setCatsLoading] = useState(false);
    const [search, setSearch]         = useState("");

    // Mapping form state
    const [selCatId, setSelCatId]     = useState("");
    const [selCatName, setSelCatName] = useState("");
    const [saving, setSaving]         = useState(false);
    const [msg, setMsg]               = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, sRes] = await Promise.all([
                getUnmappedCategories(false),
                getUnmappedStats()
            ]);
            setItems(uRes.data || []);
            setStats(sRes.stats || null);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadN11Cats = async () => {
        if (n11CatTree.length > 0) return;
        setCatsLoading(true);
        try {
            const res = await getN11Categories();
            setN11CatTree(res.categories || []);
        } catch { setN11CatTree([]); }
        setCatsLoading(false);
    };

    const openMapping = async (item) => {
        setMappingId(item.id);
        setSelCatId("");
        setSelCatName("");
        setMsg(null);
        await loadN11Cats();
    };

    const handleCatSelect = (id, name) => {
        setSelCatId(id);
        setSelCatName(name);
    };

    const handleSave = async (sourceCategory) => {
        if (!selCatId) { setMsg({ type: "error", text: "N11 kategorisi seçin" }); return; }
        setSaving(true);
        try {
            await saveCategoryMapping(sourceCategory, parseInt(selCatId), selCatName);
            setMsg({ type: "success", text: "✅ Mapping kaydedildi!" });
            setTimeout(() => {
                setMappingId(null);
                load();
                onMapped && onMapped();
            }, 1000);
        } catch (e) {
            setMsg({ type: "error", text: e?.response?.data?.message || "Kaydetme hatası" });
        }
        setSaving(false);
    };

    const filtered = items.filter(i =>
        !search || i.categoryName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            {/* İstatistik Kartları */}
            {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
                    {[
                        { icon: "⚠️", label: "Eşleştirilmemiş", val: stats.totalUnmapped,  color: COLORS.warn,    desc: "Mapping bekliyor" },
                        { icon: "✅", label: "Çözüldü",          val: stats.totalResolved,  color: COLORS.success, desc: "Başarıyla eşleştirildi" },
                        { icon: "📊", label: "Toplam",           val: (stats.totalUnmapped||0)+(stats.totalResolved||0), color: COLORS.accent, desc: "Tüm kategoriler" },
                        { icon: "🏆", label: "En Çok Karşılaşılan", val: stats.topUnmappedCategories?.[0]?.categoryName || "—", color: "#06b6d4", desc: `${stats.topUnmappedCategories?.[0]?.hitCount || 0}x görüldü`, isText: true },
                    ].map((k, i) => (
                        <Card key={i} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            borderLeft: `3px solid ${k.color}`,
                            padding: "14px 16px"
                        }}>
                            <span style={{ fontSize: 22, flexShrink: 0 }}>{k.icon}</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontSize: k.isText ? 13 : 24, fontWeight: 800, color: k.color,
                                    lineHeight: 1, marginBottom: 3,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                }}>{k.val}</div>
                                <div style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: 600 }}>{k.label}</div>
                                <div style={{ color: COLORS.textFaint || "#334155", fontSize: 10, marginTop: 1 }}>{k.desc}</div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Arama */}
            <div style={{ marginBottom: 16 }}>
                <Input value={search} onChange={setSearch} placeholder="🔍 Kategori ara..." />
            </div>

            {loading ? (
                <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 40 }}>Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>🎉</div>
                    <div style={{ color: COLORS.success, fontWeight: 700, marginTop: 8 }}>
                        Tüm kategoriler eşleştirilmiş!
                    </div>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filtered.map(item => (
                        <Card key={item.id} style={{
                            border: mappingId === item.id
                                ? `1.5px solid ${COLORS.accent}`
                                : `1px solid ${COLORS.cardBorder}`
                        }}>
                            {/* Kategori Başlık Satırı */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>
                                            📂 {item.categoryName}
                                        </span>
                                        <Badge color={COLORS.warn}>{item.source}</Badge>
                                        <Badge color={COLORS.accent}>N11</Badge>
                                        <Badge color={COLORS.textMuted}>{item.hitCount}x karşılaşıldı</Badge>
                                    </div>
                                    {/* Örnek Ürünler */}
                                    {item.sampleProducts?.length > 0 && (
                                        <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                                            Örnek: {item.sampleProducts.join(" · ")}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {mappingId === item.id ? (
                                        <Btn outline color={COLORS.textMuted} onClick={() => setMappingId(null)}>İptal</Btn>
                                    ) : (
                                        <Btn onClick={() => openMapping(item)}>🔗 Eşleştir</Btn>
                                    )}
                                </div>
                            </div>

                            {/* Öneriler */}
                            {item.suggestedCategories?.length > 0 && (
                                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    <span style={{ color: COLORS.textMuted, fontSize: 12, alignSelf: "center" }}>Öneriler:</span>
                                    {item.suggestedCategories.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (mappingId !== item.id) openMapping(item);
                                                // Öneriyi seç — n11Cats yüklendikten sonra
                                                setSelCatName(s.name);
                                            }}
                                            style={{
                                                background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}44`,
                                                borderRadius: 6, color: COLORS.text, padding: "3px 10px",
                                                fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                                            }}
                                        >
                                            {s.name} <ScoreDot score={s.score} />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Mapping Formu */}
                            {mappingId === item.id && (
                                <div style={{
                                    marginTop: 14, padding: 14,
                                    background: COLORS.accentSoft,
                                    borderRadius: 10, border: `1px solid ${COLORS.accent}33`
                                }}>
                                    <div style={{ color: COLORS.text, fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
                                        🔗 "{item.categoryName}" → N11 Kategori Eşleştir
                                    </div>

                                    {catsLoading ? (
                                        <div style={{ color: COLORS.textMuted, fontSize: 13 }}>⏳ N11 kategorileri yükleniyor...</div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                            <CategoryTreePicker
                                                categories={n11CatTree}
                                                selectedId={selCatId}
                                                selectedName={selCatName}
                                                onSelect={handleCatSelect}
                                                loading={catsLoading}
                                            />
                                            {selCatName && (
                                                <div style={{
                                                    color: COLORS.success, fontSize: 13,
                                                    background: COLORS.successSoft,
                                                    borderRadius: 7, padding: "7px 12px",
                                                    display: "flex", alignItems: "center", gap: 6
                                                }}>
                                                    ✅ Seçilen: <strong>{selCatName}</strong>
                                                    <span style={{ color: COLORS.textMuted, fontSize: 11 }}>(ID: {selCatId})</span>
                                                </div>
                                            )}
                                            {msg && (
                                                <div style={{
                                                    color: msg.type === "success" ? COLORS.success : COLORS.danger,
                                                    fontSize: 13, fontWeight: 600
                                                }}>{msg.text}</div>
                                            )}
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <Btn
                                                    onClick={() => handleSave(item.categoryName)}
                                                    disabled={saving || !selCatId}
                                                    color={COLORS.success}
                                                >
                                                    {saving ? "Kaydediliyor..." : "💾 Kaydet"}
                                                </Btn>
                                                <Btn outline color={COLORS.textMuted} onClick={() => setMappingId(null)}>
                                                    İptal
                                                </Btn>
                                            </div>
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

// ─── Sekme 2: Kayıtlı Mapping'ler ────────────────────────────────────────────

const MappedTab = ({ onChanged }) => {
    const [items, setItems]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCategoryMappings();
            setItems(res.mappings || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`"${name}" mapping'ini silmek istediğinize emin misiniz?`)) return;
        setDeleting(id);
        try {
            await deleteCategoryMapping(id);
            await load();
            onChanged && onChanged();
        } catch { /* ignore */ }
        setDeleting(null);
    };

    const filtered = items.filter(i =>
        !search ||
        (i.sourceName || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.n11CategoryName || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            {/* Üst Bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{
                    flex: 1, minWidth: 200,
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#0f1117", border: "1.5px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "8px 12px"
                }}>
                    <span style={{ color: COLORS.textMuted }}>🔍</span>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Kaynak veya N11 kategori ara..."
                        style={{ background: "none", border: "none", outline: "none", color: COLORS.text, fontSize: 13, width: "100%" }}
                    />
                </div>
                <div style={{
                    background: `${COLORS.success}12`, border: `1px solid ${COLORS.success}33`,
                    borderRadius: 8, padding: "8px 14px", fontSize: 12,
                    color: COLORS.success, fontWeight: 700
                }}>
                    ✅ {filtered.length} mapping kayıtlı
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", color: COLORS.textMuted, padding: 40 }}>⏳ Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 48 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Henüz mapping yok</div>
                    <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
                        Eşleştirilmemiş sekmesinden kategori eşleştirmesi yapın.
                    </div>
                </Card>
            ) : (
                <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${COLORS.cardBorder}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: `${COLORS.card}cc` }}>
                                {[
                                    { label: "Kaynak Kategori", w: "auto" },
                                    { label: "→ N11 Kategori",  w: "auto" },
                                    { label: "N11 ID",          w: 100 },
                                    { label: "Durum",           w: 90 },
                                    { label: "İşlem",           w: 80 },
                                ].map(h => (
                                    <th key={h.label} style={{
                                        color: COLORS.textMuted, fontSize: 11, fontWeight: 700,
                                        padding: "11px 14px", textAlign: "left",
                                        borderBottom: `1px solid ${COLORS.cardBorder}`,
                                        textTransform: "uppercase", letterSpacing: "0.04em",
                                        width: h.w !== "auto" ? h.w : undefined
                                    }}>{h.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item, idx) => (
                                <tr key={item.id} style={{
                                    borderBottom: idx < filtered.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none",
                                    transition: "background .12s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <td style={{ padding: "12px 14px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: COLORS.warn, display: "inline-block", flexShrink: 0
                                            }} />
                                            <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>
                                                {item.sourceName}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                background: COLORS.accent, display: "inline-block", flexShrink: 0
                                            }} />
                                            <span style={{ color: COLORS.textSub, fontSize: 13 }}>
                                                {item.n11CategoryName || "—"}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <Badge color={COLORS.accent}>#{item.n11CategoryId}</Badge>
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <Badge color={item.isActive ? COLORS.success : COLORS.danger}>
                                            {item.isActive ? "✅ Aktif" : "❌ Pasif"}
                                        </Badge>
                                    </td>
                                    <td style={{ padding: "12px 14px" }}>
                                        <Btn
                                            outline color={COLORS.danger}
                                            disabled={deleting === item.id}
                                            onClick={() => handleDelete(item.id, item.sourceName)}
                                            style={{ padding: "5px 12px", fontSize: 12 }}
                                        >
                                            {deleting === item.id ? "⏳" : "🗑️ Sil"}
                                        </Btn>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

const CategoryMappingPage = () => {
    const [activeTab, setActiveTab]         = useState("unmapped");
    const [unmappedCount, setUnmappedCount] = useState(0);
    const [mappedCount, setMappedCount]     = useState(0);

    const refreshCount = useCallback(async () => {
        try {
            const [uRes, mRes] = await Promise.all([
                getUnmappedStats(),
                getCategoryMappings()
            ]);
            setUnmappedCount(uRes.stats?.totalUnmapped || 0);
            setMappedCount((mRes.mappings || []).length);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { refreshCount(); }, [refreshCount]);

    const tabConfig = [
        { key: "unmapped", label: "Eşleştirilmemiş", icon: "⚠️", badge: unmappedCount, badgeColor: COLORS.warn },
        { key: "mapped",   label: "Kayıtlı Mapping", icon: "✅", badge: mappedCount,   badgeColor: COLORS.success },
    ];

    return (
        <div style={{
            minHeight: "100vh",
            background: COLORS.bg,
            color: COLORS.text,
            fontFamily: "Space Grotesk, Inter, sans-serif",
            padding: "20px 20px"
        }}>
            {/* ── Başlık ── */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 10 }}>
                        🗂️ Kategori Eşleştirme Merkezi
                    </h1>
                    <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                        Platformlar arası kategori eşleştirmelerini yönetin. Eşleştirilmemiş kategoriler otomatik tespit edilir.
                        Eşleştirme yapılmadan ürün dağıtımı yapılamaz.
                    </p>
                </div>
                {/* Özet Sayaçlar */}
                <div style={{ display: "flex", gap: 10 }}>
                    <div style={{
                        background: `${COLORS.warn}12`, border: `1px solid ${COLORS.warn}33`,
                        borderRadius: 10, padding: "10px 16px", textAlign: "center", minWidth: 80
                    }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.warn, lineHeight: 1 }}>{unmappedCount}</div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontWeight: 600 }}>EŞLEŞTİRİLMEMİŞ</div>
                    </div>
                    <div style={{
                        background: `${COLORS.success}12`, border: `1px solid ${COLORS.success}33`,
                        borderRadius: 10, padding: "10px 16px", textAlign: "center", minWidth: 80
                    }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.success, lineHeight: 1 }}>{mappedCount}</div>
                        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontWeight: 600 }}>KAYITLI MAPPİNG</div>
                    </div>
                </div>
            </div>

            {/* ── Sekmeler ── */}
            <div style={{
                display: "flex", gap: 0,
                marginBottom: 20,
                borderBottom: `1px solid ${COLORS.cardBorder}`,
                background: `${COLORS.card}88`,
                borderRadius: "10px 10px 0 0",
                overflow: "hidden"
            }}>
                {tabConfig.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                flex: 1,
                                background: isActive ? COLORS.accentSoft : "transparent",
                                border: "none",
                                borderBottom: isActive ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                                color: isActive ? COLORS.text : COLORS.textMuted,
                                padding: "13px 18px",
                                fontSize: 13, fontWeight: isActive ? 700 : 500,
                                cursor: "pointer", transition: "all .15s",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 7
                            }}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            {tab.badge !== null && tab.badge > 0 && (
                                <span style={{
                                    background: tab.badgeColor,
                                    color: tab.key === "unmapped" ? "#000" : "#fff",
                                    borderRadius: 999, padding: "1px 8px",
                                    fontSize: 11, fontWeight: 800, lineHeight: 1.4
                                }}>{tab.badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Sekme İçerikleri ── */}
            {activeTab === "unmapped" && <UnmappedTab onMapped={refreshCount} />}
            {activeTab === "mapped"   && <MappedTab   onChanged={refreshCount} />}
        </div>
    );
};

export default CategoryMappingPage;
