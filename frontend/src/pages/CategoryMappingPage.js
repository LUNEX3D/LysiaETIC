/**
 * AKILLI KATEGORİ EŞLEŞTİRME MERKEZİ
 *
 * 4 Sekme:
 *   1. 🤖 Otomatik Eşleştir — Ürün başlığı gir, sistem otomatik kategori bulsun
 *   2. 📁 Dahili Kategoriler — Sistem kategorilerini yönet
 *   3. 🔗 Pazaryeri Mapping — Dahili kategori → pazaryeri eşleştirmeleri
 *   4. 🧠 Öğrenme Hafızası — Sistem ne öğrendi, istatistikler
 */

import React, { useState, useEffect, useCallback } from "react";
import {
    getInternalCategories, createInternalCategory, updateInternalCategory,
    deleteInternalCategory, seedInternalCategories,
    getCategoryMappings, saveCategoryMapping, deleteCategoryMapping,
    autoMatchCategory, learnCategory,
    getCategoryMemory, deleteCategoryMemory, getCategoryStats
} from "../services/categorySmartApi";

// ─── Renkler ────────────────────────────────────────────────────────────────
const C = {
    bg: "#0f1117", surface: "#1a1f2e", card: "#1a1f2e",
    border: "rgba(255,255,255,0.07)", borderHover: "rgba(99,102,241,0.4)",
    accent: "#6366f1", accentSoft: "rgba(99,102,241,0.12)",
    teal: "#0f766e", tealSoft: "rgba(15,118,110,0.12)",
    green: "#22c55e", greenSoft: "rgba(34,197,94,0.10)",
    yellow: "#f59e0b", yellowSoft: "rgba(245,158,11,0.10)",
    red: "#ef4444", redSoft: "rgba(239,68,68,0.10)",
    blue: "#3b82f6", blueSoft: "rgba(59,130,246,0.10)",
    purple: "#a855f7",
    text: "#e2e8f0", textSub: "#94a3b8", textDim: "#64748b",
};

const MP_COLORS = { Trendyol: "#f97316", Hepsiburada: "#eab308", N11: "#a855f7", Amazon: "#f59e0b", ÇiçekSepeti: "#ec4899" };
const MP_ICONS  = { Trendyol: "🟠", Hepsiburada: "🟡", N11: "🟣", Amazon: "🔶", ÇiçekSepeti: "🌸" };
const ALL_MARKETPLACES = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];

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
        onFocus={e => e.target.style.borderColor = C.accent + "60"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
        {...rest} />
);

const ConfidenceMeter = ({ level, score }) => {
    const config = {
        strong: { color: C.green, label: "Güçlü Eşleşme", icon: "✅" },
        medium: { color: C.yellow, label: "Orta Eşleşme", icon: "⚡" },
        weak:   { color: C.red, label: "Zayıf Eşleşme", icon: "⚠️" },
        none:   { color: C.textDim, label: "Eşleşme Yok", icon: "❌" }
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
// SEKME 1: OTOMATİK EŞLEŞTİR
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
            {/* Giriş Formu */}
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

            {/* Sonuç */}
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

                            {/* Pazaryeri Mapping'leri */}
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

                            {/* Öğrenme Butonu */}
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
// SEKME 2: DAHİLİ KATEGORİLER
// ═══════════════════════════════════════════════════════════════════════════════
const InternalCategoriesTab = ({ categories, tree, onRefresh }) => {
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
        try {
            await deleteInternalCategory(id);
            onRefresh();
        } catch { /* ignore */ }
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
            {/* Yeni Kategori Oluştur */}
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

            {/* Arama */}
            <Input value={search} onChange={setSearch} placeholder="🔍 Kategori veya anahtar kelime ara..." />

            {/* Kategori Listesi */}
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
// SEKME 3: PAZARYERİ MAPPING
// ═══════════════════════════════════════════════════════════════════════════════
const MappingsTab = ({ categories, onRefresh }) => {
    const [mappings, setMappings]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [addCatId, setAddCatId]     = useState("");
    const [addMP, setAddMP]           = useState("Trendyol");
    const [addName, setAddName]       = useState("");
    const [addId, setAddId]           = useState("");
    const [addPath, setAddPath]       = useState("");
    const [saving, setSaving]         = useState(false);
    const [msg, setMsg]               = useState(null);
    const [filterMP, setFilterMP]     = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCategoryMappings(filterMP);
            setMappings(res.mappings || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [filterMP]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!addCatId || !addName.trim()) return;
        setSaving(true); setMsg(null);
        try {
            await saveCategoryMapping({
                internalCategoryId: addCatId,
                marketplace: addMP,
                marketplaceCategoryId: addId || null,
                marketplaceCategoryName: addName.trim(),
                marketplaceCategoryPath: addPath || ""
            });
            setAddName(""); setAddId(""); setAddPath("");
            setMsg({ type: "success", text: "Mapping kaydedildi!" });
            load();
        } catch (e) { setMsg({ type: "error", text: e?.response?.data?.message || "Hata" }); }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        try { await deleteCategoryMapping(id); load(); } catch { /* ignore */ }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Yeni Mapping Ekle */}
            <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>🔗</span>
                    <div>
                        <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Yeni Pazaryeri Eşleştirmesi</div>
                        <div style={{ color: C.textDim, fontSize: 10 }}>Dahili kategoriyi pazaryeri kategorisiyle eşleştirin</div>
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <select value={addCatId} onChange={e => setAddCatId(e.target.value)}
                        style={{ background: "#0f1117", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 12, outline: "none" }}>
                        <option value="">Dahili kategori seçin...</option>
                        {(categories || []).map(c => (
                            <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                        ))}
                    </select>
                    <select value={addMP} onChange={e => setAddMP(e.target.value)}
                        style={{ background: "#0f1117", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 12, outline: "none" }}>
                        {ALL_MARKETPLACES.map(mp => (
                            <option key={mp} value={mp}>{MP_ICONS[mp]} {mp}</option>
                        ))}
                    </select>
                    <Input value={addName} onChange={setAddName} placeholder="Pazaryeri kategori adı (örn: Cep Telefonu)" />
                    <Input value={addId} onChange={setAddId} placeholder="Kategori ID (opsiyonel)" />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Input value={addPath} onChange={setAddPath} placeholder="Kategori yolu (opsiyonel, örn: Elektronik > Telefon)" style={{ flex: 1 }} />
                    <Btn onClick={handleSave} loading={saving} disabled={!addCatId || !addName.trim()} color={C.green}>💾 Kaydet</Btn>
                </div>
                {msg && <div style={{ marginTop: 8, color: msg.type === "success" ? C.green : C.red, fontSize: 12, fontWeight: 600 }}>{msg.text}</div>}
            </Card>

            {/* Filtre */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn small outline={filterMP !== ""} color={C.accent} onClick={() => setFilterMP("")}>Tümü</Btn>
                {ALL_MARKETPLACES.map(mp => (
                    <Btn key={mp} small outline={filterMP !== mp} color={MP_COLORS[mp] || C.accent} onClick={() => setFilterMP(mp)}>
                        {MP_ICONS[mp]} {mp}
                    </Btn>
                ))}
            </div>

            {/* Mapping Listesi */}
            {loading ? (
                <div style={{ textAlign: "center", color: C.textDim, padding: 40 }}>⏳ Yükleniyor...</div>
            ) : mappings.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40 }}>📭</div>
                    <div style={{ color: C.textSub, fontWeight: 600, marginTop: 8 }}>Henüz mapping yok</div>
                    <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>Yukarıdan yeni eşleştirme ekleyin</div>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {mappings.map((group, gi) => (
                        <Card key={gi} style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 20 }}>{group.internalCategory?.icon || "📁"}</span>
                                <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{group.internalCategory?.name || "?"}</span>
                                {group.internalCategory?.keywords?.length > 0 && (
                                    <span style={{ color: C.textDim, fontSize: 10 }}>({group.internalCategory.keywords.slice(0, 3).join(", ")})</span>
                                )}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {Object.entries(group.marketplaces).map(([mp, data]) => (
                                    <div key={mp} style={{
                                        background: (MP_COLORS[mp] || C.accent) + "08",
                                        border: `1px solid ${(MP_COLORS[mp] || C.accent)}25`,
                                        borderRadius: 10, padding: "8px 12px",
                                        display: "flex", alignItems: "center", gap: 8, minWidth: 200
                                    }}>
                                        <span style={{ fontSize: 14 }}>{MP_ICONS[mp] || "🔗"}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{mp}</div>
                                            <div style={{ color: C.textSub, fontSize: 11 }}>{data.marketplaceCategoryName}</div>
                                            {data.marketplaceCategoryId && <div style={{ color: C.textDim, fontSize: 9 }}>ID: {data.marketplaceCategoryId}</div>}
                                        </div>
                                        <button onClick={() => handleDelete(data._id)}
                                            style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12, padding: 2 }}
                                            title="Sil">✕</button>
                                    </div>
                                ))}
                                {/* Eksik pazaryerleri göster */}
                                {ALL_MARKETPLACES.filter(mp => !group.marketplaces[mp]).map(mp => (
                                    <div key={mp} style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: `1px dashed ${C.border}`,
                                        borderRadius: 10, padding: "8px 12px",
                                        display: "flex", alignItems: "center", gap: 8, minWidth: 200, opacity: 0.5
                                    }}>
                                        <span style={{ fontSize: 14 }}>{MP_ICONS[mp] || "🔗"}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: C.textDim, fontSize: 12 }}>{mp}</div>
                                            <div style={{ color: C.textDim, fontSize: 10 }}>Eşleştirilmemiş</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEKME 4: ÖĞRENME HAFIZASI
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
            {/* İstatistik Kartları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {[
                    { icon: "📁", label: "Dahili Kategori", val: st.totalInternalCategories || 0, color: C.accent },
                    { icon: "🔗", label: "Pazaryeri Mapping", val: st.totalMappings || 0, color: C.teal },
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

            {/* Mapping Coverage */}
            {st.mappingCoverage && Object.keys(st.mappingCoverage).length > 0 && (
                <Card>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Pazaryeri Kapsama Oranı</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(st.mappingCoverage).map(([mp, data]) => (
                            <div key={mp} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 14, width: 20 }}>{MP_ICONS[mp] || "🔗"}</span>
                                <span style={{ color: C.text, fontSize: 12, fontWeight: 600, width: 100 }}>{mp}</span>
                                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ width: `${data.percentage}%`, height: "100%", background: MP_COLORS[mp] || C.accent, borderRadius: 4, transition: "width .5s" }} />
                                </div>
                                <span style={{ color: MP_COLORS[mp] || C.accent, fontSize: 12, fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                                    {data.mapped}/{data.total} ({data.percentage}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Hafıza Listesi */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: -6 }}>
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
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
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

            {/* En Çok Kullanılan Patternler */}
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
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════════════════
const CategoryMappingPage = () => {
    const [tab, setTab]             = useState("match");
    const [categories, setCategories] = useState([]);
    const [tree, setTree]           = useState([]);
    const [stats, setStats]         = useState(null);

    const loadCategories = useCallback(async () => {
        try {
            const res = await getInternalCategories();
            setCategories(res.flat || []);
            setTree(res.categories || []);
        } catch { /* ignore */ }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const res = await getCategoryStats();
            setStats(res.stats || null);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadCategories(); loadStats(); }, [loadCategories, loadStats]);

    const tabs = [
        { key: "match",      label: "Otomatik Eşleştir", icon: "🤖", desc: "Ürün gir, kategori bul" },
        { key: "categories", label: "Dahili Kategoriler", icon: "📁", desc: "Sistem kategorileri" },
        { key: "mappings",   label: "Pazaryeri Mapping",  icon: "🔗", desc: "Kategori eşleştirmeleri" },
        { key: "memory",     label: "Öğrenme Hafızası",   icon: "🧠", desc: "İstatistik & hafıza" },
    ];

    return (
        <div style={{
            minHeight: "100vh", background: C.bg, color: C.text,
            fontFamily: "Space Grotesk, Inter, sans-serif", padding: "20px 20px"
        }}>
            {/* Başlık */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 10 }}>
                        🧠 Akıllı Kategori Eşleştirme Merkezi
                    </h1>
                    <p style={{ color: C.textDim, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                        Sistem kullanıcı kararlarından öğrenir ve zamanla daha akıllı hale gelir. Ürün ekledikçe manuel iş azalır.
                    </p>
                </div>
                {/* Mini İstatistikler */}
                <div style={{ display: "flex", gap: 8 }}>
                    {[
                        { val: stats?.totalInternalCategories || 0, label: "KATEGORİ", color: C.accent },
                        { val: stats?.totalMappings || 0, label: "MAPPİNG", color: C.teal },
                        { val: stats?.totalMemories || 0, label: "ÖĞRENME", color: C.purple },
                    ].map(s => (
                        <div key={s.label} style={{
                            background: s.color + "10", border: `1px solid ${s.color}30`,
                            borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 70
                        }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                            <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, fontWeight: 700 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sekmeler */}
            <div style={{
                display: "flex", gap: 0, marginBottom: 20,
                borderBottom: `1px solid ${C.border}`,
                background: `${C.card}88`, borderRadius: "10px 10px 0 0", overflow: "hidden"
            }}>
                {tabs.map(t => {
                    const isActive = tab === t.key;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, background: isActive ? C.accentSoft : "transparent",
                                border: "none", borderBottom: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
                                color: isActive ? C.text : C.textDim,
                                padding: "13px 12px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                                cursor: "pointer", transition: "all .15s",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                            </div>
                            <span style={{ fontSize: 9, color: isActive ? C.textSub : C.textDim }}>{t.desc}</span>
                        </button>
                    );
                })}
            </div>

            {/* Sekme İçerikleri */}
            {tab === "match"      && <AutoMatchTab categories={categories} onRefreshStats={loadStats} />}
            {tab === "categories" && <InternalCategoriesTab categories={categories} tree={tree} onRefresh={() => { loadCategories(); loadStats(); }} />}
            {tab === "mappings"   && <MappingsTab categories={categories} onRefresh={loadStats} />}
            {tab === "memory"     && <MemoryTab stats={stats} onRefreshStats={loadStats} />}
        </div>
    );
};

export default CategoryMappingPage;
