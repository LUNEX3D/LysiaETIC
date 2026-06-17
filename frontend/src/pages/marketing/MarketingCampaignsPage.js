import React, { useCallback, useEffect, useState } from "react";
import { FaEnvelope, FaSms, FaPlus } from "react-icons/fa";
import {
    fetchCampaigns,
    createCampaign,
    sendCampaign,
    deleteCampaign,
    fetchSegments,
    fetchMarketingTemplates,
} from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingDataTable,
    MarketingBadge,
    MarketingModal,
    MarketingField,
    MarketingAlert,
    MarketingSection,
    MarketingInfoBox,
    MarketingWizardSteps,
    MarketingCampaignCard,
    MarketingEmptyState,
} from "./components/MarketingUi";

const TEMPLATE_OPTIONS = [
    { key: "discount", label: "İndirim", desc: "Özel fiyat duyurusu" },
    { key: "new_product", label: "Yeni ürün", desc: "Koleksiyon tanıtımı" },
    { key: "abandoned_cart", label: "Sepet hatırlatma", desc: "Terk edilen sepet" },
    { key: "special_day", label: "Özel gün", desc: "Kutlama mesajı" },
    { key: "announcement", label: "Duyuru", desc: "Genel bilgilendirme" },
    { key: "coupon", label: "Kupon", desc: "Kod paylaşımı" },
    { key: "custom", label: "Kendin yaz", desc: "Boş şablon" },
];

const WIZARD_STEPS_EMAIL = ["Kampanya", "Mesaj", "Hedef kitle", "Zamanlama"];
const WIZARD_STEPS_SMS = ["Kampanya", "Mesaj", "Hedef kitle", "Zamanlama"];

const emptyForm = () => ({
    name: "",
    subject: "",
    content: "",
    templateKey: "discount",
    segmentId: "",
    scheduledAt: "",
    sendNow: true,
});

const MarketingCampaignsPage = ({ campaignType = "EMAIL" }) => {
    const [items, setItems] = useState([]);
    const [segments, setSegments] = useState([]);
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [modal, setModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [sendingId, setSendingId] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const isEmail = campaignType === "EMAIL";
    const Icon = isEmail ? FaEnvelope : FaSms;
    const wizardSteps = isEmail ? WIZARD_STEPS_EMAIL : WIZARD_STEPS_SMS;

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [cRes, sRes, tRes] = await Promise.all([
                fetchCampaigns({ type: campaignType }),
                fetchSegments(),
                fetchMarketingTemplates(),
            ]);
            setItems(cRes.campaigns || []);
            setSegments(sRes.segments || []);
            setTemplates(tRes.templates || {});
        } catch (e) {
            setError(e.response?.data?.error || "Liste yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [campaignType]);

    useEffect(() => {
        load();
    }, [load]);

    const openWizard = () => {
        setForm(emptyForm());
        setWizardStep(1);
        setModal(true);
    };

    const applyTemplate = (key) => {
        const tpl = templates[key];
        setForm((f) => ({
            ...f,
            templateKey: key,
            subject: isEmail ? tpl?.subject || f.subject : f.subject,
            content: tpl?.content || f.content,
        }));
    };

    const validateStep = () => {
        if (wizardStep === 1 && !form.name.trim()) {
            setError("Lütfen kampanyanıza bir ad verin.");
            return false;
        }
        if (wizardStep === 2) {
            if (isEmail && !form.subject.trim()) {
                setError("E-posta konusu zorunludur.");
                return false;
            }
            if (!form.content.trim()) {
                setError("Mesaj metnini yazın veya bir şablon seçin.");
                return false;
            }
        }
        setError("");
        return true;
    };

    const nextStep = () => {
        if (!validateStep()) return;
        setWizardStep((s) => Math.min(s + 1, 4));
    };

    const prevStep = () => {
        setError("");
        setWizardStep((s) => Math.max(s - 1, 1));
    };

    const handleCreate = async () => {
        if (!validateStep()) return;
        try {
            await createCampaign({
                name: form.name,
                subject: form.subject,
                content: form.content,
                templateKey: form.templateKey,
                type: campaignType,
                status: !form.sendNow && form.scheduledAt ? "scheduled" : "draft",
                scheduledAt: !form.sendNow && form.scheduledAt ? form.scheduledAt : null,
                segmentId: form.segmentId || null,
            });
            setModal(false);
            setSuccess(
                !form.sendNow && form.scheduledAt
                    ? "Kampanyanız planlandı. Belirlediğiniz saatte otomatik gönderilir."
                    : "Kampanya kaydedildi. Listeden «Şimdi gönder» ile iletebilirsiniz."
            );
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        }
    };

    const handleSend = async (id) => {
        if (!window.confirm("Mesaj şimdi gönderilsin mi? Bu işlem geri alınamaz.")) return;
        setSendingId(id);
        setError("");
        setSuccess("");
        try {
            const res = await sendCampaign(id);
            setSuccess(`${res.delivered ?? res.sent ?? 0} kişiye ulaştı.`);
            if (res.errors?.length) setError(`Bazı alıcılara ulaşılamadı: ${res.errors[0]}`);
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Gönderilemedi");
        } finally {
            setSendingId(null);
        }
    };

    const previewText = (form.content || "")
        .replace(/\{\{name\}\}/gi, "Ayşe")
        .replace(/\{\{coupon\}\}/gi, "HOSGELDIN")
        .replace(/\{\{discount\}\}/gi, "15");

    const columns = [
        { label: "Kampanya adı", key: "name", render: (r) => <strong>{r.name}</strong> },
        ...(isEmail ? [{ label: "Konu", key: "subject", render: (r) => r.subject || "—" }] : []),
        { label: "Durum", key: "status", render: (r) => <MarketingBadge status={r.status} /> },
        {
            label: "Gönderilen",
            key: "sent",
            render: (r) => r.stats?.delivered ?? r.stats?.sent ?? 0,
        },
        { label: "Dönüşüm", key: "conv", render: (r) => r.stats?.converted ?? 0 },
    ];

    return (
        <MarketingPageShell
            title={isEmail ? "E-posta gönder" : "SMS gönder"}
            subtitle={
                isEmail
                    ? "Müşterilerinize tek seferlik e-posta hazırlayın ve gönderin."
                    : "Kayıtlı telefon numaralarına toplu SMS gönderin."
            }
            icon={Icon}
            actions={
                <MarketingButton variant="primary" icon={FaPlus} onClick={openWizard}>
                    Yeni kampanya
                </MarketingButton>
            }
        >
            {error && !modal && <MarketingAlert type="error" onClose={() => setError("")}>{error}</MarketingAlert>}
            {success && <MarketingAlert type="success" onClose={() => setSuccess("")}>{success}</MarketingAlert>}

            {!loading && items.length === 0 && (
                <MarketingInfoBox title="İlk kampanyanızı oluşturun" variant="tip">
                    Adım adım sihirbaz sizi yönlendirir. E-posta için müşterilerin pazarlama izni, SMS için telefon
                    numarası kayıtlı olmalıdır. Gönderim ayarlarını «Kurulum» menüsünden yapabilirsiniz.
                </MarketingInfoBox>
            )}

            <MarketingSection title={items.length ? "Kampanyalarınız" : undefined}>
                {loading ? (
                    <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
                ) : items.length <= 6 ? (
                    <div className="mkt-campaign-cards">
                        {items.length === 0 ? (
                            <MarketingEmptyState
                                title="Henüz kampanya yok"
                                hint="Yukarıdaki «Yeni kampanya» ile birkaç dakikada ilk mesajınızı hazırlayın."
                                action={
                                    <MarketingButton variant="primary" icon={FaPlus} onClick={openWizard}>
                                        Kampanya oluştur
                                    </MarketingButton>
                                }
                            />
                        ) : (
                            items.map((c) => (
                                <MarketingCampaignCard
                                    key={c._id}
                                    campaign={c}
                                    isEmail={isEmail}
                                    sending={sendingId === c._id}
                                    onSend={() => handleSend(c._id)}
                                    onDelete={async () => {
                                        if (window.confirm("Bu kampanya silinsin mi?")) {
                                            await deleteCampaign(c._id);
                                            load();
                                        }
                                    }}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="mkt-table-panel">
                        <MarketingDataTable
                            columns={[
                                ...columns,
                                {
                                    label: "",
                                    key: "actions",
                                    render: (r) =>
                                        r.status !== "sent" && r.status !== "sending" ? (
                                            <MarketingButton
                                                size="sm"
                                                variant="primary"
                                                disabled={sendingId === r._id}
                                                onClick={() => handleSend(r._id)}
                                            >
                                                {sendingId === r._id ? "Gönderiliyor…" : "Gönder"}
                                            </MarketingButton>
                                        ) : null,
                                },
                            ]}
                            rows={items.map((i) => ({ ...i, id: i._id }))}
                            emptyTitle="Henüz kampanya yok"
                            action={
                                <MarketingButton variant="primary" icon={FaPlus} onClick={openWizard}>
                                    Kampanya oluştur
                                </MarketingButton>
                            }
                        />
                    </div>
                )}
            </MarketingSection>

            <MarketingModal
                wide
                open={modal}
                onClose={() => setModal(false)}
                title={isEmail ? "Yeni e-posta kampanyası" : "Yeni SMS kampanyası"}
                subtitle="Sihirbaz adımlarını takip edin; istediğiniz zaman geri dönebilirsiniz."
                footer={
                    <div className="mkt-wizard-foot">
                        {wizardStep > 1 ? (
                            <MarketingButton variant="ghost" onClick={prevStep}>
                                Geri
                            </MarketingButton>
                        ) : (
                            <MarketingButton variant="ghost" onClick={() => setModal(false)}>
                                Vazgeç
                            </MarketingButton>
                        )}
                        <div className="mkt-wizard-foot__right">
                            {wizardStep < 4 ? (
                                <MarketingButton variant="primary" onClick={nextStep}>
                                    Devam et
                                </MarketingButton>
                            ) : (
                                <MarketingButton variant="primary" onClick={handleCreate}>
                                    Kampanyayı kaydet
                                </MarketingButton>
                            )}
                        </div>
                    </div>
                }
            >
                {error && modal && <MarketingAlert type="error">{error}</MarketingAlert>}
                <MarketingWizardSteps steps={wizardSteps} current={wizardStep} />

                {wizardStep === 1 && (
                    <div className="mkt-wizard-panel">
                        <MarketingField label="Kampanya adı" hint="Sadece sizin göreceğiniz bir isim (ör. Bahar indirimi)">
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Örn. Bahar indirimi"
                                autoFocus
                            />
                        </MarketingField>
                    </div>
                )}

                {wizardStep === 2 && (
                    <div className="mkt-wizard-panel mkt-wizard-panel--split">
                        <div>
                            <MarketingField label="Hazır şablon seçin">
                                <div className="mkt-template-grid mkt-template-grid--cards">
                                    {TEMPLATE_OPTIONS.map((t) => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            className={`mkt-template-card${form.templateKey === t.key ? " active" : ""}`}
                                            onClick={() => applyTemplate(t.key)}
                                        >
                                            <strong>{t.label}</strong>
                                            <small>{t.desc}</small>
                                        </button>
                                    ))}
                                </div>
                            </MarketingField>
                            {isEmail && (
                                <MarketingField label="Konu satırı">
                                    <input
                                        value={form.subject}
                                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                                        placeholder="Örn. Size özel %15 indirim"
                                    />
                                </MarketingField>
                            )}
                            <MarketingField label="Mesaj" hint="{{name}} ve {{coupon}} müşteri adına otomatik dolar.">
                                <textarea
                                    value={form.content}
                                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                                    rows={5}
                                />
                            </MarketingField>
                        </div>
                        <aside className="mkt-preview-box">
                            <span className="mkt-preview-box__label">Önizleme</span>
                            {isEmail && form.subject && <p className="mkt-preview-box__subject">Konu: {form.subject}</p>}
                            <p className="mkt-preview-box__body">{previewText || "Mesajınız burada görünür…"}</p>
                        </aside>
                    </div>
                )}

                {wizardStep === 3 && (
                    <div className="mkt-wizard-panel">
                        <MarketingInfoBox title="Kime gönderilecek?" variant="tip">
                            {isEmail
                                ? "Segment seçmezseniz, pazarlama e-postasına izin vermiş tüm müşteriler hedeflenir."
                                : "Segment seçmezseniz, telefon numarası kayıtlı tüm müşteriler hedeflenir."}
                        </MarketingInfoBox>
                        <MarketingField label="Müşteri grubu (isteğe bağlı)">
                            <select value={form.segmentId} onChange={(e) => setForm((f) => ({ ...f, segmentId: e.target.value }))}>
                                <option value="">Herkes (varsayılan)</option>
                                {segments.map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.name} — {s.cachedCount} kişi
                                    </option>
                                ))}
                            </select>
                        </MarketingField>
                        {segments.length === 0 && (
                            <p className="mkt-field__hint">
                                İsterseniz önce «Müşteri grupları» bölümünden VIP veya sadık müşteri segmenti oluşturabilirsiniz.
                            </p>
                        )}
                    </div>
                )}

                {wizardStep === 4 && (
                    <div className="mkt-wizard-panel">
                        <MarketingField label="Ne zaman gönderilsin?">
                            <div className="mkt-radio-cards">
                                <label className={`mkt-radio-card${form.sendNow ? " active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="when"
                                        checked={form.sendNow}
                                        onChange={() => setForm((f) => ({ ...f, sendNow: true, scheduledAt: "" }))}
                                    />
                                    <strong>Şimdi değil, sonra gönderirim</strong>
                                    <span>Listeye kaydedilir; «Şimdi gönder» ile iletirsiniz.</span>
                                </label>
                                <label className={`mkt-radio-card${!form.sendNow ? " active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="when"
                                        checked={!form.sendNow}
                                        onChange={() => setForm((f) => ({ ...f, sendNow: false }))}
                                    />
                                    <strong>Belirli bir tarihte gönder</strong>
                                    <span>Otomatik gönderim için tarih seçin.</span>
                                </label>
                            </div>
                        </MarketingField>
                        {!form.sendNow && (
                            <MarketingField label="Gönderim tarihi ve saati">
                                <input
                                    type="datetime-local"
                                    value={form.scheduledAt}
                                    onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                                />
                            </MarketingField>
                        )}
                    </div>
                )}
            </MarketingModal>
        </MarketingPageShell>
    );
};

export default MarketingCampaignsPage;
