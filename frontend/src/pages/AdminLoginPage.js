import React, { useCallback, useEffect, useState } from "react";
import {
    FaSave, FaSync, FaImage, FaTrash, FaPlus, FaEye, FaToggleOn, FaToggleOff,
    FaSignInAlt, FaBuilding, FaParagraph,
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import {
    getLoginPageConfig,
    updateLoginPageConfig,
    addLoginPagePartner,
    updateLoginPagePartner,
    deleteLoginPagePartner,
    seedLoginPagePartnerTemplate,
} from "../services/saasAdminApi";
import { resolveUploadUrl } from "../utils/resolveUploadUrl";
import PartnerMarquee from "../components/auth/PartnerMarquee";
import "../styles/login.css";

const field = (label, value, onChange, opts = {}) => (
    <label className="lp-admin-field">
        <span>{label}</span>
        {opts.multiline ? (
            <textarea rows={opts.rows || 3} value={value || ""} onChange={(e) => onChange(e.target.value)} />
        ) : (
            <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} />
        )}
    </label>
);

const AdminLoginPage = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [tab, setTab] = useState("hero");
    const [partnerForm, setPartnerForm] = useState({ name: "", website: "", logo: null });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getLoginPageConfig();
            setConfig(res.data.data);
        } catch (e) {
            setError(e.response?.data?.message || "Ayarlar yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const patch = (path, value) => {
        setConfig((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            const keys = path.split(".");
            let cur = next;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!cur[keys[i]]) cur[keys[i]] = {};
                cur = cur[keys[i]];
            }
            cur[keys[keys.length - 1]] = value;
            return next;
        });
    };

    const highlights = config?.sections?.features?.highlights || [];

    const patchHighlight = (index, key, value) => {
        const next = highlights.map((item, i) => (i === index ? { ...item, [key]: value } : item));
        patch("sections.features.highlights", next);
    };

    const addHighlight = () => {
        patch("sections.features.highlights", [
            ...highlights,
            { icon: "✨", title: "Yeni özellik", text: "", tags: [] },
        ]);
    };

    const removeHighlight = (index) => {
        patch("sections.features.highlights", highlights.filter((_, i) => i !== index));
    };

    const saveTexts = async () => {
        setSaving(true);
        setMessage("");
        setError("");
        try {
            const res = await updateLoginPageConfig({
                hero: config.hero,
                partners: {
                    enabled: config.partners?.enabled,
                    kicker: config.partners?.kicker,
                    title: config.partners?.title,
                    subtitle: config.partners?.subtitle,
                    useTemplateWhenEmpty: config.partners?.useTemplateWhenEmpty !== false,
                },
                sections: config.sections,
            });
            setConfig(res.data.data);
            setMessage("Giriş sayfası metinleri kaydedildi.");
        } catch (e) {
            setError(e.response?.data?.message || "Kayıt başarısız");
        } finally {
            setSaving(false);
        }
    };

    const submitPartner = async (e) => {
        e.preventDefault();
        if (!partnerForm.name.trim()) {
            setError("Firma adı zorunlu");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("name", partnerForm.name.trim());
            fd.append("website", partnerForm.website.trim());
            if (partnerForm.logo) fd.append("logo", partnerForm.logo);
            const res = await addLoginPagePartner(fd);
            setConfig(res.data.data);
            setPartnerForm({ name: "", website: "", logo: null });
            setMessage("Referans firma eklendi.");
        } catch (e) {
            setError(e.response?.data?.message || "Firma eklenemedi");
        } finally {
            setSaving(false);
        }
    };

    const togglePartner = async (p) => {
        const fd = new FormData();
        fd.append("active", String(!p.active));
        fd.append("name", p.name);
        fd.append("website", p.website || "");
        fd.append("order", String(p.order || 0));
        try {
            const res = await updateLoginPagePartner(p._id, fd);
            setConfig(res.data.data);
        } catch (e) {
            setError(e.response?.data?.message || "Güncelleme başarısız");
        }
    };

    const removePartner = async (id) => {
        if (!window.confirm("Bu referans firmayı kaldırmak istediğinize emin misiniz?")) return;
        try {
            const res = await deleteLoginPagePartner(id);
            setConfig(res.data.data);
            setMessage("Firma kaldırıldı.");
        } catch (e) {
            setError(e.response?.data?.message || "Silinemedi");
        }
    };

    const applyPartnerTemplate = async (replace = false) => {
        if (replace && !window.confirm("Mevcut firmalar silinip hazır şablon yüklenecek. Emin misiniz?")) return;
        setSaving(true);
        setError("");
        try {
            const res = await seedLoginPagePartnerTemplate(replace);
            setConfig(res.data.data);
            setMessage("Hazır referans şablonu yüklendi.");
        } catch (e) {
            setError(e.response?.data?.message || "Şablon yüklenemedi");
        } finally {
            setSaving(false);
        }
    };

    const previewPartners = config?.partners?.items?.length
        ? config.partners.items.filter((p) => p.active !== false).map((p) => ({
            ...p,
            logoUrl: resolveUploadUrl(p.logoUrl),
        }))
        : (config?.partners?.templatePreview || []).map((p, i) => ({
            ...p,
            order: i,
            isTemplate: true,
            logoUrl: resolveUploadUrl(p.logoUrl),
        }));

    const tabs = [
        { id: "hero", label: "Hero & Giriş", icon: <FaSignInAlt /> },
        { id: "features", label: "Özellikler", icon: <FaParagraph /> },
        { id: "pricing", label: "Fiyatlandırma", icon: <FaParagraph /> },
        { id: "about", label: "Hakkımızda", icon: <FaParagraph /> },
        { id: "contact", label: "İletişim", icon: <FaParagraph /> },
        { id: "partners", label: "Referans Firmalar", icon: <FaBuilding /> },
    ];

    return (
        <AdminLayout
            title="Giriş Sayfası Yönetimi"
            subtitle="Login ekranı metinleri, sekmeler ve referans firma logoları"
            actions={
                <div className="ap-actions">
                    <a href="/login" target="_blank" rel="noopener noreferrer" className="ap-btn ap-btn--ghost">
                        <FaEye /> Önizle
                    </a>
                    <button type="button" className="ap-btn ap-btn--ghost" onClick={load} disabled={loading}>
                        <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                    </button>
                    {tab !== "partners" && (
                        <button type="button" className="ap-btn ap-btn--primary" onClick={saveTexts} disabled={saving || !config}>
                            <FaSave /> Kaydet
                        </button>
                    )}
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}
            {message && <div className="ap-alert ap-alert--success">{message}</div>}
            {loading && !config && <div className="ap-loading">Yükleniyor...</div>}

            {config && (
                <>
                    <div className="lp-admin-tabs">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={`lp-admin-tab${tab === t.id ? " lp-admin-tab--active" : ""}`}
                                onClick={() => setTab(t.id)}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="lp-admin-panel">
                        {tab === "hero" && (
                            <>
                                <h3>Ana giriş hero metinleri</h3>
                                {field("Satır 1", config.hero?.titleLine1, (v) => patch("hero.titleLine1", v))}
                                {field("Satır 2", config.hero?.titleLine2, (v) => patch("hero.titleLine2", v))}
                                {field("Vurgu (italik)", config.hero?.titleEmphasis, (v) => patch("hero.titleEmphasis", v))}
                                {field("Açıklama 1", config.hero?.description1, (v) => patch("hero.description1", v), { multiline: true })}
                                {field("Açıklama 2", config.hero?.description2, (v) => patch("hero.description2", v), { multiline: true })}
                            </>
                        )}

                        {tab === "features" && (
                            <>
                                <h3>Özellikler sekmesi</h3>
                                {field("Rozet", config.sections?.features?.badge, (v) => patch("sections.features.badge", v))}
                                {field("Başlık", config.sections?.features?.title, (v) => patch("sections.features.title", v))}
                                {field("Başlık vurgu", config.sections?.features?.titleAccent, (v) => patch("sections.features.titleAccent", v))}
                                {field("Açıklama", config.sections?.features?.description, (v) => patch("sections.features.description", v), { multiline: true, rows: 4 })}
                                {field("CTA başlık", config.sections?.features?.ctaTitle, (v) => patch("sections.features.ctaTitle", v))}
                                {field("CTA metin", config.sections?.features?.ctaText, (v) => patch("sections.features.ctaText", v), { multiline: true })}

                                <div className="lp-admin-features-head">
                                    <h4>Özellik kartları</h4>
                                    <button type="button" className="ap-btn ap-btn--ghost" onClick={addHighlight}>
                                        <FaPlus /> Kart ekle
                                    </button>
                                </div>
                                <div className="lp-admin-feature-list">
                                    {highlights.map((item, index) => (
                                        <div key={`${item.title}-${index}`} className="lp-admin-feature-card">
                                            <div className="lp-admin-feature-card-head">
                                                <strong>Kart {index + 1}</strong>
                                                <button
                                                    type="button"
                                                    className="ap-btn ap-btn--ghost"
                                                    onClick={() => removeHighlight(index)}
                                                    title="Kartı kaldır"
                                                >
                                                    <FaTrash color="#ef4444" />
                                                </button>
                                            </div>
                                            {field("İkon (emoji)", item.icon, (v) => patchHighlight(index, "icon", v))}
                                            {field("Başlık", item.title, (v) => patchHighlight(index, "title", v))}
                                            {field("Açıklama", item.text, (v) => patchHighlight(index, "text", v), { multiline: true, rows: 2 })}
                                            {field(
                                                "Etiketler (virgülle)",
                                                (item.tags || []).join(", "),
                                                (v) => patchHighlight(index, "tags", v.split(",").map((s) => s.trim()).filter(Boolean))
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {tab === "pricing" && (
                            <>
                                <h3>Fiyatlandırma sekmesi</h3>
                                {field("Rozet", config.sections?.pricing?.badge, (v) => patch("sections.pricing.badge", v))}
                                {field("Başlık", config.sections?.pricing?.title, (v) => patch("sections.pricing.title", v))}
                                {field("Başlık vurgu", config.sections?.pricing?.titleAccent, (v) => patch("sections.pricing.titleAccent", v))}
                                {field("Açıklama", config.sections?.pricing?.description, (v) => patch("sections.pricing.description", v), { multiline: true, rows: 3 })}
                                {field("Not", config.sections?.pricing?.note, (v) => patch("sections.pricing.note", v), { multiline: true })}
                                <p className="lp-admin-hint">Paket fiyatları PayTR planlarından otomatik çekilir.</p>
                            </>
                        )}

                        {tab === "about" && (
                            <>
                                <h3>Hakkımızda sekmesi</h3>
                                {field("Rozet", config.sections?.about?.badge, (v) => patch("sections.about.badge", v))}
                                {field("Başlık", config.sections?.about?.title, (v) => patch("sections.about.title", v))}
                                {field("Başlık vurgu", config.sections?.about?.titleAccent, (v) => patch("sections.about.titleAccent", v))}
                                {field("Açıklama", config.sections?.about?.description, (v) => patch("sections.about.description", v), { multiline: true, rows: 4 })}
                                {field("Madde 1", config.sections?.about?.points?.[0], (v) => {
                                    const pts = [...(config.sections?.about?.points || [])];
                                    pts[0] = v;
                                    patch("sections.about.points", pts);
                                })}
                                {field("Madde 2", config.sections?.about?.points?.[1], (v) => {
                                    const pts = [...(config.sections?.about?.points || [])];
                                    pts[1] = v;
                                    patch("sections.about.points", pts);
                                })}
                                {field("Madde 3", config.sections?.about?.points?.[2], (v) => {
                                    const pts = [...(config.sections?.about?.points || [])];
                                    pts[2] = v;
                                    patch("sections.about.points", pts);
                                })}
                                {field("Madde 4", config.sections?.about?.points?.[3], (v) => {
                                    const pts = [...(config.sections?.about?.points || [])];
                                    pts[3] = v;
                                    patch("sections.about.points", pts);
                                })}
                            </>
                        )}

                        {tab === "contact" && (
                            <>
                                <h3>İletişim sekmesi</h3>
                                {field("Rozet", config.sections?.contact?.badge, (v) => patch("sections.contact.badge", v))}
                                {field("Başlık", config.sections?.contact?.title, (v) => patch("sections.contact.title", v))}
                                {field("Başlık vurgu", config.sections?.contact?.titleAccent, (v) => patch("sections.contact.titleAccent", v))}
                                {field("Açıklama", config.sections?.contact?.description, (v) => patch("sections.contact.description", v), { multiline: true })}
                                {field("Telefon", config.sections?.contact?.phone, (v) => patch("sections.contact.phone", v))}
                                {field("E-posta", config.sections?.contact?.email, (v) => patch("sections.contact.email", v))}
                                {field("Adres", config.sections?.contact?.address, (v) => patch("sections.contact.address", v), { multiline: true })}
                                {field("Çalışma saatleri", config.sections?.contact?.workingHours, (v) => patch("sections.contact.workingHours", v))}
                                {field("WhatsApp", config.sections?.contact?.whatsapp, (v) => patch("sections.contact.whatsapp", v))}
                            </>
                        )}

                        {tab === "partners" && (
                            <>
                                <div className="lp-admin-partners-head">
                                    <h3>Referans firmalar (kayan logo bandı)</h3>
                                    <label className="lp-admin-toggle">
                                        <input
                                            type="checkbox"
                                            checked={config.partners?.enabled !== false}
                                            onChange={(e) => patch("partners.enabled", e.target.checked)}
                                        />
                                        Bandı göster
                                    </label>
                                </div>

                                {config.partners?.usingTemplate && (
                                    <div className="lp-admin-template-banner">
                                        Şu an <strong>hazır şablon</strong> gösteriliyor (Trendyol, Hepsiburada, Amazon…).
                                        Kendi logolarınızı ekleyebilir veya şablonu kalıcı olarak yükleyebilirsiniz.
                                    </div>
                                )}

                                <div className="lp-admin-marquee-preview">
                                    <p className="lp-admin-hint" style={{ marginTop: 0 }}>Canlı önizleme</p>
                                    <div className="lp-admin-marquee-preview-inner">
                                        <PartnerMarquee
                                            partners={config.partners}
                                            items={previewPartners}
                                        />
                                    </div>
                                </div>

                                {field("Üst etiket (kicker)", config.partners?.kicker, (v) => patch("partners.kicker", v))}
                                {field("Band başlığı", config.partners?.title, (v) => patch("partners.title", v))}
                                {field("Alt başlık", config.partners?.subtitle, (v) => patch("partners.subtitle", v), { multiline: true })}
                                <label className="lp-admin-toggle" style={{ marginBottom: "1rem" }}>
                                    <input
                                        type="checkbox"
                                        checked={config.partners?.useTemplateWhenEmpty !== false}
                                        onChange={(e) => patch("partners.useTemplateWhenEmpty", e.target.checked)}
                                    />
                                    Firma yokken hazır şablonu göster
                                </label>

                                <div className="lp-admin-template-actions">
                                    <button
                                        type="button"
                                        className="ap-btn ap-btn--primary"
                                        disabled={saving}
                                        onClick={() => applyPartnerTemplate(false)}
                                    >
                                        <FaImage /> Hazır şablonu yükle
                                    </button>
                                    {(config.partners?.items || []).length > 0 && (
                                        <button
                                            type="button"
                                            className="ap-btn ap-btn--ghost"
                                            disabled={saving}
                                            onClick={() => applyPartnerTemplate(true)}
                                        >
                                            Şablonla değiştir
                                        </button>
                                    )}
                                </div>

                                <form className="lp-admin-partner-form" onSubmit={submitPartner}>
                                    <h4><FaPlus /> Yeni firma ekle</h4>
                                    <div className="lp-admin-partner-form-grid">
                                        {field("Firma adı", partnerForm.name, (v) => setPartnerForm((p) => ({ ...p, name: v })))}
                                        {field("Web sitesi (opsiyonel)", partnerForm.website, (v) => setPartnerForm((p) => ({ ...p, website: v })))}
                                        <label className="lp-admin-field">
                                            <span>Logo (opsiyonel — PNG/JPG/WEBP)</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setPartnerForm((p) => ({ ...p, logo: e.target.files?.[0] || null }))}
                                            />
                                        </label>
                                    </div>
                                    <button type="submit" className="ap-btn ap-btn--primary" disabled={saving}>
                                        <FaImage /> {partnerForm.logo ? "Logo yükle & ekle" : "Firma ekle"}
                                    </button>
                                </form>

                                <div className="lp-admin-partner-list">
                                    {(config.partners?.items || []).length === 0 ? (
                                        <p className="lp-admin-hint">Henüz özel firma yok — giriş sayfasında hazır şablon gösteriliyor.</p>
                                    ) : (
                                        config.partners.items.map((p) => (
                                            <div key={p._id} className={`lp-admin-partner-row${p.active === false ? " lp-admin-partner-row--off" : ""}`}>
                                                <div className="lp-admin-partner-logo">
                                                    {p.logoUrl ? (
                                                        <img src={resolveUploadUrl(p.logoUrl)} alt={p.name} />
                                                    ) : (
                                                        <span>{p.name?.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="lp-admin-partner-meta">
                                                    <strong>{p.name}</strong>
                                                    {p.website && <small>{p.website}</small>}
                                                </div>
                                                <div className="lp-admin-partner-actions">
                                                    <button type="button" className="ap-btn ap-btn--ghost" onClick={() => togglePartner(p)} title="Aktif/Pasif">
                                                        {p.active !== false ? <FaToggleOn color="#22c55e" /> : <FaToggleOff />}
                                                    </button>
                                                    <button type="button" className="ap-btn ap-btn--ghost" onClick={() => removePartner(p._id)} title="Sil">
                                                        <FaTrash color="#ef4444" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <button type="button" className="ap-btn ap-btn--primary" style={{ marginTop: 16 }} onClick={saveTexts} disabled={saving}>
                                    <FaSave /> Band ayarlarını kaydet
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminLoginPage;
