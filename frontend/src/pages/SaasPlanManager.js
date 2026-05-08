/**
 * SaasPlanManager - Admin Paket Yönetimi Sayfası
 *
 * Admin panelden tüm paketlerin fiyatlarını, limitlerini, özelliklerini,
 * açıklamalarını ve badge'lerini yönetme.
 *
 *  v2: özellik ekleme artık A-Z katalogdan seçmeli (checkbox)
 *        + özel özellik yazma desteği korunuyor
 *
 * Buradan yapılan değişiklikler:
 *   - Ana sayfa (HomePage) paket kartlarına yansır
 *   - Kullanıcı abonelik sayfasına (SubscriptionPage) yansır
 *   - PayTR ödeme tutarlarına yansır
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    FaCrown, FaSave, FaEdit, FaTimes, FaSync, FaCheckCircle,
    FaExclamationTriangle, FaPlus, FaTrash, FaDollarSign,
    FaBoxOpen, FaClipboardList, FaPlug, FaCode, FaUsers,
    FaClock, FaShieldAlt, FaChartBar, FaInfoCircle, FaEye,
    FaTag, FaListUl, FaStar, FaGlobe, FaSearch, FaCheck,
    FaRobot, FaTruck, FaFileInvoice, FaChartLine, FaHeadset,
    FaCogs, FaBrain, FaWarehouse, FaBell, FaKey, FaPencilAlt
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getSystemConfig, updatePlanDefinitions } from "../services/saasAdminApi";

/*
   A-Z ÖZELLİK KATALOĞU
   Platformdaki tüm özellikler kategorilere ayrılmıştır.
   Admin buradan checkbox ile seçerek paketlere özellik ekler.
*/
const FEATURE_CATALOG = [
    {
        category: "Dashboard & Raporlama",
        icon: <FaChartBar style={{ fontSize: 11 }} />,
        items: [
            "Dashboard erişimi",
            "Temel raporlama",
            "Gelişmiş raporlama",
            "Gerçek zamanlı metrikler",
            "Kâr/zarar analizi",
            "Excel/PDF dışa aktarım",
        ],
    },
    {
        category: "Ürün Yönetimi",
        icon: <FaBoxOpen style={{ fontSize: 11 }} />,
        items: [
            "Temel ürün yönetimi",
            "Toplu ürün düzenleme",
            "Varyant yönetimi",
            "Barkod/SKU yönetimi",
            "Ürün performans takibi",
        ],
    },
    {
        category: "Sipariş Yönetimi",
        icon: <FaClipboardList style={{ fontSize: 11 }} />,
        items: [
            "Sipariş görüntüleme",
            "Sipariş durum takibi",
            "Toplu sipariş aksiyonları",
            "İade/iptal yönetimi",
            "Sipariş bildirimleri",
        ],
    },
    {
        category: "Pazaryeri Entegrasyonları",
        icon: <FaPlug style={{ fontSize: 11 }} />,
        items: [
            "Trendyol entegrasyonu",
            "Hepsiburada entegrasyonu",
            "N11 entegrasyonu",
            "Amazon entegrasyonu",
            "ÇiçekSepeti entegrasyonu",
            "Çoklu pazaryeri yönetimi",
            "Webhook desteği",
        ],
    },
    {
        category: "AI & Otomasyon",
        icon: <FaBrain style={{ fontSize: 11 }} />,
        items: [
            "AI Asistan (LysiaBrain)",
            "AI destekli analiz",
            "AI fiyat önerileri",
            "AI stok tahmini",
            "AI radar fırsat taraması",
            "Otomatik sipariş önerileri",
        ],
    },
    {
        category: "Kargo & Lojistik",
        icon: <FaTruck style={{ fontSize: 11 }} />,
        items: [
            "Kargo takibi",
            "Çoklu kargo firması desteği",
            "Kargo maliyet analizi",
            "Teslimat performans raporu",
        ],
    },
    {
        category: "Fatura & Finans",
        icon: <FaFileInvoice style={{ fontSize: 11 }} />,
        items: [
            "E-fatura entegrasyonu",
            "Otomatik faturalama",
            "Gelir/gider takibi",
            "Ödeme takibi",
            "Finans dashboard",
        ],
    },
    {
        category: "Güvenlik & Yönetim",
        icon: <FaShieldAlt style={{ fontSize: 11 }} />,
        items: [
            "İki faktörlü doğrulama (2FA)",
            "Rol bazlı yetkilendirme",
            "API key yönetimi",
            "Aktivite logları",
        ],
    },
    {
        category: "Destek & SLA",
        icon: <FaHeadset style={{ fontSize: 11 }} />,
        items: [
            "E-posta desteği",
            "Öncelikli destek",
            "7/24 destek",
            "Canlı chat desteği",
            "SLA garantisi",
        ],
    },
    {
        category: "Kurumsal Özellikler",
        icon: <FaCogs style={{ fontSize: 11 }} />,
        items: [
            "Özel entegrasyonlar",
            "White-label seçeneği",
            "Özel domain desteği",
            "Sınırsız ürün/sipariş",
            "Sınırsız kullanıcı",
            "Beta özelliklere erken erişim",
        ],
    },
];

/*
   FeaturePickerModal — Checkbox ile özellik seçme modalı
*/
const FeaturePickerModal = ({ currentFeatures, onSave, onClose }) => {
    const [selected, setSelected] = useState(new Set(currentFeatures || []));
    const [search, setSearch] = useState("");
    const [expandedCats, setExpandedCats] = useState(new Set(FEATURE_CATALOG.map(c => c.category)));
    const [customFeature, setCustomFeature] = useState("");
    const searchRef = useRef(null);

    // Arama sonulaürün filtrele
    const filteredCatalog = useMemo(() => {
        if (!search.trim()) return FEATURE_CATALOG;
        const q = search.toLowerCase().trim();
        return FEATURE_CATALOG.map(cat => ({
            ...cat,
            items: cat.items.filter(item => item.toLowerCase().includes(q)),
        })).filter(cat => cat.items.length > 0);
    }, [search]);

    // Seili says
    const selectedCount = selected.size;
    const totalAvailable = FEATURE_CATALOG.reduce((sum, cat) => sum + cat.items.length, 0);

    const toggleFeature = (feat) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(feat)) next.delete(feat);
            else next.add(feat);
            return next;
        });
    };

    const toggleCategory = (cat) => {
        const allInCat = cat.items;
        const allSelected = allInCat.every(f => selected.has(f));
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) {
                allInCat.forEach(f => next.delete(f));
            } else {
                allInCat.forEach(f => next.add(f));
            }
            return next;
        });
    };

    const toggleExpandCat = (catName) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(catName)) next.delete(catName);
            else next.add(catName);
            return next;
        });
    };

    const handleAddCustom = () => {
        const trimmed = customFeature.trim();
        if (trimmed && !selected.has(trimmed)) {
            setSelected(prev => new Set([...prev, trimmed]));
            setCustomFeature("");
        }
    };

    const selectAll = () => {
        const all = new Set(selected);
        FEATURE_CATALOG.forEach(cat => cat.items.forEach(f => all.add(f)));
        setSelected(all);
    };

    const deselectAll = () => {
    // Sadece katalogdaki özellikleri kaldır, özel eklenenler kalsın
        const catalogItems = new Set(FEATURE_CATALOG.flatMap(c => c.items));
        setSelected(prev => new Set([...prev].filter(f => !catalogItems.has(f))));
    };

    // Özel (katalogda olmayan) özellikler
    const catalogItemsSet = useMemo(() => new Set(FEATURE_CATALOG.flatMap(c => c.items)), []);
    const customFeatures = useMemo(() => [...selected].filter(f => !catalogItemsSet.has(f)), [selected, catalogItemsSet]);

    // Modal açılınca arama kutusuna odaklan
    useEffect(() => {
        setTimeout(() => searchRef.current?.focus(), 100);
    }, []);

    return (
        <div style={modalOverlay} onClick={onClose}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={modalHeader}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                            <FaListUl style={{ color: "#818cf8" }} /> Özellik Kataloğu
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                            {selectedCount} özellik seçili / {totalAvailable} mevcut
                        </div>
                    </div>
                    <button onClick={onClose} style={modalCloseBtn}><FaTimes /></button>
                </div>

                {/* Arama + Toplu İşlem */}
                <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                        <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 12 }} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Özellik ara..."
                            style={{ ...inputStyle, width: "100%", paddingLeft: 32, fontSize: 12 }}
                        />
                    </div>
                    <button onClick={selectAll} style={modalSmBtn} title="Tümünü Seç">
                        <FaCheck style={{ fontSize: 9 }} /> Tüm
                    </button>
                    <button onClick={deselectAll} style={{ ...modalSmBtn, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }} title="Tümünü Kaldır">
                        <FaTimes style={{ fontSize: 9 }} /> Temizle
                    </button>
                </div>

                {/* Katalog Listesi */}
                <div style={modalBody}>
                    {filteredCatalog.map((cat) => {
                        const isExpanded = expandedCats.has(cat.category);
                        const selectedInCat = cat.items.filter(f => selected.has(f)).length;
                        const allInCatSelected = selectedInCat === cat.items.length;
                        const someInCatSelected = selectedInCat > 0 && !allInCatSelected;

                        return (
                            <div key={cat.category} style={{ marginBottom: 4 }}>
                                {/* Kategori Başlığı */}
                                <div
                                    style={catHeader}
                                    onClick={() => toggleExpandCat(cat.category)}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }}>
                                        <span style={{ fontSize: 14, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}></span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{cat.category}</span>
                                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>
                                            ({selectedInCat}/{cat.items.length})
                                        </span>
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                                        style={{
                                            ...checkboxStyle,
                                            background: allInCatSelected ? "#6366f1" : someInCatSelected ? "rgba(99,102,241,0.4)" : "transparent",
                                            borderColor: allInCatSelected || someInCatSelected ? "#6366f1" : "#475569",
                                        }}
                                        title={allInCatSelected ? "Tümünü kaldır" : "Tümünü seç"}
                                    >
                                        {allInCatSelected && <FaCheck style={{ fontSize: 8, color: "#fff" }} />}
                                        {someInCatSelected && !allInCatSelected && <span style={{ fontSize: 10, color: "#fff", lineHeight: 1 }}></span>}
                                    </div>
                                </div>

                                {/* Özellik Listesi */}
                                {isExpanded && (
                                    <div style={{ paddingLeft: 12 }}>
                                        {cat.items.map((feat) => {
                                            const isSelected = selected.has(feat);
                                            return (
                                                <div
                                                    key={feat}
                                                    style={{
                                                        ...featureRow,
                                                        background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
                                                    }}
                                                    onClick={() => toggleFeature(feat)}
                                                >
                                                    <div
                                                        style={{
                                                            ...checkboxStyle,
                                                            width: 16, height: 16,
                                                            background: isSelected ? "#6366f1" : "transparent",
                                                            borderColor: isSelected ? "#6366f1" : "#475569",
                                                        }}
                                                    >
                                                        {isSelected && <FaCheck style={{ fontSize: 8, color: "#fff" }} />}
                                                    </div>
                                                    <span style={{ fontSize: 12, color: isSelected ? "#e2e8f0" : "#94a3b8" }}>
                                                        {feat}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredCatalog.length === 0 && (
                        <div style={{ textAlign: "center", padding: 30, color: "#64748b", fontSize: 13 }}>
                            <FaSearch style={{ fontSize: 20, marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                            "{search}" ile eşleşen özellik bulunamadı
                        </div>
                    )}

                    {/* Özel Eklenen Özellikler */}
                    {customFeatures.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ ...catHeader, cursor: "default" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <FaPencilAlt style={{ fontSize: 11, color: "#fbbf24" }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Özel Eklenen</span>
                                    <span style={{ fontSize: 10, color: "#64748b" }}>({customFeatures.length})</span>
                                </div>
                            </div>
                            <div style={{ paddingLeft: 12 }}>
                                {customFeatures.map((feat) => (
                                    <div key={feat} style={{ ...featureRow, background: "rgba(251,191,36,0.06)" }}>
                                        <div style={{ ...checkboxStyle, width: 16, height: 16, background: "#f59e0b", borderColor: "#f59e0b" }}>
                                            <FaCheck style={{ fontSize: 8, color: "#fff" }} />
                                        </div>
                                        <span style={{ fontSize: 12, color: "#fbbf24", flex: 1 }}>{feat}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelected(prev => { const n = new Set(prev); n.delete(feat); return n; }); }}
                                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2, fontSize: 10 }}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Özel Özellik Ekleme */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(99,102,241,0.15)", display: "flex", gap: 8 }}>
                    <input
                        type="text"
                        value={customFeature}
                        onChange={e => setCustomFeature(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddCustom()}
                        placeholder="Özel özellik yaz ve ekle..."
                        style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                    />
                    <button
                        onClick={handleAddCustom}
                        disabled={!customFeature.trim()}
                        style={{
                            ...modalSmBtn,
                            opacity: customFeature.trim() ? 1 : 0.4,
                            color: "#fbbf24",
                            borderColor: "rgba(251,191,36,0.3)",
                        }}
                    >
                        <FaPlus style={{ fontSize: 9 }} /> Ekle
                    </button>
                </div>

                {/* Footer */}
                <div style={modalFooter}>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                        <FaInfoCircle style={{ fontSize: 10 }} /> Seçilen özellikler paket kartında görünecek
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={onClose} style={{ ...modalSmBtn, padding: "8px 16px", fontSize: 12 }}>
                            <FaTimes style={{ fontSize: 10 }} /> İptal
                        </button>
                        <button
                            onClick={() => onSave([...selected])}
                            style={{
                                padding: "8px 20px", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                                background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "#fff",
                                border: "none", borderRadius: 8, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                            }}
                        >
                            <FaCheck style={{ fontSize: 10 }} /> {selectedCount} Özelliği Kaydet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* 
   ANA COMPONENT  SaasPlanManager
    */
const SaasPlanManager = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState({ text: "", type: "" });
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({});
    const [previewCycle, setPreviewCycle] = useState("monthly");
    const [featurePickerPlan, setFeaturePickerPlan] = useState(null); // Hangi plan için picker ak

    const loadConfig = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getSystemConfig();
            setConfig(res.data);
            setDraft(JSON.parse(JSON.stringify(res.data.planDefinitions || {})));
        } catch (err) {
            console.error(err);
            setError("Paket bilgileri alınamadı.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    //  Field Handlers 
    const handleField = (planKey, field, value) => {
        setDraft(prev => ({
            ...prev,
            [planKey]: { ...prev[planKey], [field]: value }
        }));
    };

    const handleLimit = (planKey, limitKey, value) => {
        setDraft(prev => ({
            ...prev,
            [planKey]: {
                ...prev[planKey],
                limits: { ...prev[planKey].limits, [limitKey]: parseInt(value) || 0 }
            }
        }));
    };

    const handleRemoveFeature = (planKey, index) => {
        setDraft(prev => {
            const features = [...(prev[planKey].features || [])];
            features.splice(index, 1);
            return { ...prev, [planKey]: { ...prev[planKey], features } };
        });
    };

    //  Feature Picker kaydet 
    const handleFeaturePickerSave = (planKey, selectedFeatures) => {
        setDraft(prev => ({
            ...prev,
            [planKey]: { ...prev[planKey], features: selectedFeatures }
        }));
        setFeaturePickerPlan(null);
    };

    //  Save 
    const handleSave = async () => {
        setSaving(true);
        setMessage({ text: "", type: "" });
        try {
            // price alanını monthlyPrice ile senkronize et
            const toSave = JSON.parse(JSON.stringify(draft));
            for (const [, plan] of Object.entries(toSave)) {
                plan.price = plan.monthlyPrice || plan.price || 0;
                // Boş feature alanlarını temizle
                if (Array.isArray(plan.features)) {
                    plan.features = plan.features.filter(f => f && f.trim());
                }
            }
            await updatePlanDefinitions(toSave);
            setMessage({ text: "Paket tanımları başarıyla güncellendi! Değişiklikler ana sayfa ve abonelik sayfasına anında yansıyacak.", type: "success" });
            setEditing(false);
            loadConfig();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "Paket tanımları güncellenemedi", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraft(JSON.parse(JSON.stringify(config?.planDefinitions || {})));
        setEditing(false);
    };

    //  Helpers 
    const planColors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
    const planIcons = { trial: <FaClock />, basic: <FaBoxOpen />, pro: <FaChartBar />, enterprise: <FaShieldAlt /> };

    const limitLabels = {
        maxProducts: { label: "Maks ürün", icon: <FaBoxOpen /> },
        maxOrders: { label: "Maks Sipariş/Ay", icon: <FaClipboardList /> },
        maxMarketplaces: { label: "Maks Pazaryeri", icon: <FaPlug /> },
        maxApiCalls: { label: "API ar/Ay", icon: <FaCode /> },
        maxUsers: { label: "Maks Kullanıcı", icon: <FaUsers /> },
    };

    const fmtPrice = (n) => {
        if (!n && n !== 0) return "0";
        return "" + Number(n).toLocaleString("tr-TR");
    };

    // Katalogdaki tüm özellikler (set) — bir özelliğin katalogda olup olmadığını kontrol etmek için
    const catalogItemsSet = useMemo(() => new Set(FEATURE_CATALOG.flatMap(c => c.items)), []);

    const plans = editing ? draft : (config?.planDefinitions || {});

    return (
        <AdminLayout
            title="Paket Yönetimi"
            subtitle="Abonelik paketlerinin fiyatlarını, limitlerini ve özelliklerini yönetin — değişiklikler anında yansır."
            actions={
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="ap-btn ap-btn--ghost" onClick={loadConfig} disabled={loading}>
                        <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                    </button>
                </div>
            }
        >
            {/* Messages */}
            {message.text && (
                <div className={`ap-alert ${message.type === "success" ? "ap-alert--success" : "ap-alert--error"}`}>
                    {message.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {message.text}
                </div>
            )}
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && !config && <div className="ap-loading">Yükleniyor...</div>}

            {config && (
                <>
                    {/*  TOOLBAR  */}
                    <div className="ap-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div className="ap-kpi-icon ap-kpi-icon--purple" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20 }}>
                                <FaCrown />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>Abonelik Paketleri</div>
                                <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>
                                    Fiyatları, limitleri, özellikleri ve açıklamaları buradan yönetin.
                                    Değişiklikler ana sayfa ve kullanıcı paket seçim sayfasına anında yansır.
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {editing ? (
                                <>
                                    <button className="ap-btn ap-btn--ghost" onClick={handleCancel} disabled={saving}>
                                        <FaTimes /> İptal
                                    </button>
                                    <button className="ap-btn ap-btn--primary" onClick={handleSave} disabled={saving}>
                                        <FaSave /> {saving ? "Kaydediliyor..." : "Tüm Değişiklikleri Kaydet"}
                                    </button>
                                </>
                            ) : (
                                <button className="ap-btn ap-btn--primary" onClick={() => setEditing(true)}>
                                    <FaEdit /> Paketleri Dzenle
                                </button>
                            )}
                        </div>
                    </div>

                    {/*  PAKET KARTLARI  */}
                    {Object.entries(plans).map(([key, plan]) => {
                        const color = planColors[key] || "purple";
                        return (
                            <div key={key} className="ap-card" style={{ position: "relative" }}>
                                {/* Plan Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div className={`ap-kpi-icon ap-kpi-icon--${color}`} style={{ width: 48, height: 48, borderRadius: 14, fontSize: 20 }}>
                                            {planIcons[key] || <FaCrown />}
                                        </div>
                                        <div>
                                            {editing ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <label style={labelSm}>Paket Ad</label>
                                                        <input
                                                            type="text"
                                                            value={plan.name || ""}
                                                            onChange={(e) => handleField(key, "name", e.target.value)}
                                                            style={{ ...inputStyle, width: 180, fontSize: 15, fontWeight: 700 }}
                                                            placeholder="Paket ad"
                                                        />
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <label style={labelSm}><FaTag style={{ fontSize: 10 }} /> Badge</label>
                                                        <input
                                                            type="text"
                                                            value={plan.badge || ""}
                                                            onChange={(e) => handleField(key, "badge", e.target.value)}
                                                            style={{ ...inputStyle, width: 180 }}
                                                            placeholder='r: "EN POPLER", "ZEL"'
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span className={`ap-badge ap-badge--${color}`} style={{ fontSize: 14, padding: "6px 16px" }}>
                                                            {plan.name}
                                                        </span>
                                                        {plan.badge && (
                                                            <span className="ap-badge ap-badge--yellow" style={{ fontSize: 10, padding: "3px 8px" }}>
                                                                {plan.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "var(--ap-muted)", marginTop: 4 }}>
                                                        {plan.description || "Aklama eklenmemi"}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fiyat Blm */}
                                    <div style={{ textAlign: "right" }}>
                                        {editing ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <label style={labelSm}>Aylık</label>
                                                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ap-text)" }}></span>
                                                    <input
                                                        type="number"
                                                        value={plan.monthlyPrice ?? plan.price ?? 0}
                                                        onChange={(e) => handleField(key, "monthlyPrice", parseFloat(e.target.value) || 0)}
                                                        style={{ ...inputStyle, width: 100, fontSize: 18, fontWeight: 800, textAlign: "right" }}
                                                        min="0"
                                                    />
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <label style={labelSm}>Yıllık</label>
                                                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ap-text)" }}></span>
                                                    <input
                                                        type="number"
                                                        value={plan.yearlyPrice ?? 0}
                                                        onChange={(e) => handleField(key, "yearlyPrice", parseFloat(e.target.value) || 0)}
                                                        style={{ ...inputStyle, width: 100, fontSize: 18, fontWeight: 800, textAlign: "right" }}
                                                        min="0"
                                                    />
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <label style={labelSm}>Sre</label>
                                                    <input
                                                        type="number"
                                                        value={plan.duration ?? 30}
                                                        onChange={(e) => handleField(key, "duration", parseInt(e.target.value) || 0)}
                                                        style={{ ...inputStyle, width: 60, textAlign: "center" }}
                                                        min="1"
                                                    />
                                                    <span style={{ fontSize: 11, color: "var(--ap-muted)" }}>gn</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--ap-text)" }}>
                                                    {fmtPrice(plan.monthlyPrice || plan.price)}
                                                    <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ap-muted)" }}>/ay</span>
                                                </div>
                                                <div style={{ fontSize: 14, color: "var(--ap-muted)", marginTop: 2 }}>
                                                    {fmtPrice(plan.yearlyPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 10))}
                                                    <span style={{ fontSize: 11 }}>/yl</span>
                                                    {(plan.monthlyPrice || plan.price) > 0 && (
                                                        <span className="ap-badge ap-badge--green" style={{ fontSize: 10, padding: "2px 6px", marginLeft: 6 }}>
                                                            %{Math.round(100 - ((plan.yearlyPrice || Math.round((plan.monthlyPrice || plan.price) * 10)) / ((plan.monthlyPrice || plan.price) * 12)) * 100)} indirim
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--ap-muted)", marginTop: 4 }}>
                                                    <FaClock style={{ fontSize: 9 }} /> {plan.duration || 30} gn
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Aklama (editing) */}
                                {editing && (
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ ...labelSm, marginBottom: 4, display: "block" }}>
                                            <FaInfoCircle style={{ fontSize: 10 }} /> Paket Açıklaması
                                        </label>
                                        <input
                                            type="text"
                                            value={plan.description || ""}
                                            onChange={(e) => handleField(key, "description", e.target.value)}
                                            style={{ ...inputStyle, width: "100%" }}
                                            placeholder="Bu paket hakkında kısa açıklama..."
                                        />
                                    </div>
                                )}

                                {/* İki Sütun: Limitler + Özellikler */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                    {/* Limitler */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-text2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                            <FaShieldAlt style={{ fontSize: 12 }} /> Kullanım Limitleri
                                        </div>
                                        <div className="ap-list" style={{ margin: 0 }}>
                                            {Object.entries(limitLabels).map(([limitKey, { label, icon }]) => (
                                                <div key={limitKey} className="ap-row" style={{ padding: "8px 10px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ap-muted)" }}>
                                                        {icon} {label}
                                                    </div>
                                                    {editing ? (
                                                        <input
                                                            type="number"
                                                            value={plan.limits?.[limitKey] ?? 0}
                                                            onChange={(e) => handleLimit(key, limitKey, e.target.value)}
                                                            style={{ ...inputStyle, width: 100, textAlign: "right" }}
                                                            min="0"
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                                                            {(plan.limits?.[limitKey] ?? 0) >= 999999
                                                                ? "Sınırsız"
                                                                : (plan.limits?.[limitKey] || 0).toLocaleString("tr-TR")}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Özellikler */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-text2)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <FaListUl style={{ fontSize: 12 }} /> Paket özellikleri
                                                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ap-muted)" }}>
                                                    ({(plan.features || []).length} özellik)
                                                </span>
                                            </div>
                                            {editing && (
                                                <button
                                                    onClick={() => setFeaturePickerPlan(key)}
                                                    style={{
                                                        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                                                        border: "none",
                                                        borderRadius: 6,
                                                        color: "#fff",
                                                        padding: "5px 12px",
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 5,
                                                        fontFamily: "inherit",
                                                    }}
                                                >
                                                    <FaPlus style={{ fontSize: 9 }} /> Katalogdan Se
                                                </button>
                                            )}
                                        </div>
                                        {editing ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                {(plan.features || []).length === 0 ? (
                                                    <div
                                                        onClick={() => setFeaturePickerPlan(key)}
                                                        style={{
                                                            border: "2px dashed rgba(99,102,241,0.3)",
                                                            borderRadius: 10,
                                                            padding: "20px 16px",
                                                            textAlign: "center",
                                                            cursor: "pointer",
                                                            transition: "all 0.2s",
                                                        }}
                                                    >
                                                        <FaPlus style={{ fontSize: 16, color: "#6366f1", marginBottom: 6 }} />
                                                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
                                                            Katalogdan özellik seçmek için tıklayın
                                                        </div>
                                                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                                                            {FEATURE_CATALOG.reduce((s, c) => s + c.items.length, 0)} özellik mevcut
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {(plan.features || []).map((feat, idx) => {
                                                            const isFromCatalog = catalogItemsSet.has(feat);
                                                            return (
                                                                <div key={idx} style={{
                                                                    display: "flex", alignItems: "center", gap: 6,
                                                                    padding: "5px 8px", borderRadius: 6,
                                                                    background: "rgba(99,102,241,0.04)",
                                                                    transition: "background 0.15s",
                                                                }}>
                                                                    <FaCheckCircle style={{
                                                                        color: isFromCatalog ? "var(--ap-green)" : "#f59e0b",
                                                                        fontSize: 11, flexShrink: 0
                                                                    }} />
                                                                    <span style={{ flex: 1, fontSize: 12, color: "var(--ap-text)" }}>
                                                                        {feat}
                                                                    </span>
                                                                    {!isFromCatalog && (
                                                                        <span style={{
                                                                            fontSize: 9, color: "#f59e0b", background: "rgba(245,158,11,0.1)",
                                                                            padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                                                                        }}>
                                                                            ÖZEL
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleRemoveFeature(key, idx)}
                                                                        style={{
                                                                            background: "none", border: "none",
                                                                            color: "var(--ap-red)", cursor: "pointer",
                                                                            padding: 3, fontSize: 10, opacity: 0.6,
                                                                            transition: "opacity 0.15s",
                                                                        }}
                                                                        onMouseEnter={e => e.target.style.opacity = 1}
                                                                        onMouseLeave={e => e.target.style.opacity = 0.6}
                                                                        title="Özelliği kaldır"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                {(plan.features || []).length === 0 ? (
                                                    <div style={{ fontSize: 12, color: "var(--ap-muted)", fontStyle: "italic" }}>
                                                        Henüz özellik eklenmemiş
                                                    </div>
                                                ) : (
                                                    (plan.features || []).map((feat, idx) => (
                                                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ap-text)", padding: "4px 0" }}>
                                                            <FaCheckCircle style={{ color: "var(--ap-green)", fontSize: 11, flexShrink: 0 }} />
                                                            {feat}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/*  ÖNİZLEME  */}
                    {!editing && (
                        <div className="ap-card">
                            <div className="ap-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <FaEye /> Kullanıcı Görünüm Önizleme
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        className={`ap-btn ap-btn--sm ${previewCycle === "monthly" ? "ap-btn--primary" : "ap-btn--ghost"}`}
                                        onClick={() => setPreviewCycle("monthly")}
                                    >
                                        Aylık
                                    </button>
                                    <button
                                        className={`ap-btn ap-btn--sm ${previewCycle === "yearly" ? "ap-btn--primary" : "ap-btn--ghost"}`}
                                        onClick={() => setPreviewCycle("yearly")}
                                    >
                                        Yıllık
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                                {Object.entries(plans).filter(([k]) => k !== "trial").map(([key, plan]) => {
                                    const price = previewCycle === "yearly"
                                        ? (plan.yearlyPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 10))
                                        : (plan.monthlyPrice || plan.price || 0);
                                    const isPopular = plan.badge === "EN POPÜLER";
                                    return (
                                        <div key={key} style={{
                                            background: isPopular ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))" : "var(--ap-surface)",
                                            border: isPopular ? "1.5px solid rgba(99,102,241,0.35)" : "1px solid var(--ap-border)",
                                            borderRadius: 16,
                                            padding: "24px 20px",
                                            position: "relative",
                                            textAlign: "center",
                                        }}>
                                            {plan.badge && (
                                                <div style={{
                                                    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                                                    background: isPopular ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "linear-gradient(135deg, #34d399, #22c55e)",
                                                    color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
                                                }}>
                                                    {plan.badge}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ap-text)", marginBottom: 4 }}>{plan.name}</div>
                                            <div style={{ fontSize: 11, color: "var(--ap-muted)", marginBottom: 16, minHeight: 30 }}>{plan.description}</div>
                                            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--ap-text)", marginBottom: 4 }}>
                                                {fmtPrice(price)}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--ap-muted)", marginBottom: 16 }}>
                                                /{previewCycle === "yearly" ? "yıl" : "ay"}
                                            </div>
                                            <div style={{ textAlign: "left" }}>
                                                {(plan.features || []).map((f, i) => (
                                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ap-text)", padding: "3px 0" }}>
                                                        <FaCheckCircle style={{ color: "var(--ap-green)", fontSize: 10, flexShrink: 0 }} /> {f}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{
                                                marginTop: 16, padding: "10px 16px", borderRadius: 10,
                                                background: isPopular ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "var(--ap-primary-soft)",
                                                color: isPopular ? "#fff" : "var(--ap-primary)",
                                                fontSize: 13, fontWeight: 700, textAlign: "center",
                                            }}>
                                                Paketi Se
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/*  BİLGİ BANNER  */}
                    <div className="ap-alert ap-alert--info">
                        <FaInfoCircle />
                        <div>
                            <strong>Nasıl çalışır?</strong> Burada yaptığınız değişiklikler kaydedildiğinde:
                            <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 12 }}>
                                <li><FaGlobe style={{ fontSize: 10 }} /> <strong>Ana sayfa</strong> — Paket kartları güncel fiyat ve özelliklerle gösterilir.</li>
                                <li><FaStar style={{ fontSize: 10 }} /> <strong>Abonelik sayfası</strong> — Kullanıcılar güncel fiyatlarla paket satın alır.</li>
                                <li><FaDollarSign style={{ fontSize: 10 }} /> <strong>PayTR ödemeleri</strong> — Ödeme tutarları güncel fiyatlara göre hesaplanır.</li>
                                <li><FaShieldAlt style={{ fontSize: 10 }} /> <strong>Mevcut abonelikler</strong> — Etkilenmez, yalnızca yeni abonelikler güncel tanımlarla oluşur.</li>
                            </ul>
                        </div>
                    </div>
                </>
            )}

            {/*  FEATURE PICKER MODAL  */}
            {featurePickerPlan && (
                <FeaturePickerModal
                    currentFeatures={draft[featurePickerPlan]?.features || []}
                    onSave={(features) => handleFeaturePickerSave(featurePickerPlan, features)}
                    onClose={() => setFeaturePickerPlan(null)}
                />
            )}
        </AdminLayout>
    );
};

//  Shared Styles 
const inputStyle = {
    padding: "8px 12px",
    background: "rgba(12,15,26,0.9)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 8,
    color: "#f1f5f9",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
};

const labelSm = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ap-muted)",
    whiteSpace: "nowrap",
    minWidth: 50,
};

//  Modal Styles 
const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: 20,
};

const modalContent = {
    background: "#0f1419", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 16, width: "100%", maxWidth: 640,
    maxHeight: "85vh", display: "flex", flexDirection: "column",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
};

const modalHeader = {
    padding: "16px 20px", borderBottom: "1px solid rgba(99,102,241,0.15)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
};

const modalCloseBtn = {
    background: "none", border: "none", color: "#94a3b8",
    fontSize: 16, cursor: "pointer", padding: 4,
};

const modalBody = {
    flex: 1, overflowY: "auto", padding: "12px 20px",
    scrollbarWidth: "thin", scrollbarColor: "#334155 transparent",
};

const modalFooter = {
    padding: "12px 20px", borderTop: "1px solid rgba(99,102,241,0.15)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
};

const modalSmBtn = {
    padding: "6px 12px", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
    background: "transparent", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 6, color: "#818cf8", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 4,
};

const catHeader = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
    transition: "background 0.15s",
    background: "rgba(99,102,241,0.04)",
    marginBottom: 2,
};

const featureRow = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", borderRadius: 6, cursor: "pointer",
    transition: "background 0.15s",
};

const checkboxStyle = {
    width: 18, height: 18, borderRadius: 4,
    border: "1.5px solid #475569", display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, cursor: "pointer", transition: "all 0.15s",
};

export default SaasPlanManager;
