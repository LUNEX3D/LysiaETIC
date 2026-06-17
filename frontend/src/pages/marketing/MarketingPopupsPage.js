import React, { useCallback, useEffect, useState } from "react";
import { FaWindowMaximize, FaPlus, FaPlay, FaPause, FaTrash } from "react-icons/fa";
import { fetchPopups, createPopup, updatePopup, deletePopup } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingDataTable,
    MarketingBadge,
    MarketingModal,
    MarketingField,
    MarketingAlert,
    MarketingSection,
} from "./components/MarketingUi";

const TYPES = [
    { id: "modal", label: "Modal" },
    { id: "slide", label: "Slide" },
    { id: "top_banner", label: "Üst banner" },
    { id: "bottom_banner", label: "Alt banner" },
    { id: "announcement", label: "Duyuru çubuğu" },
];

const emptyForm = () => ({
    name: "",
    type: "modal",
    title: "",
    body: "",
    ctaText: "Abone ol",
    couponCode: "",
    delaySeconds: 5,
    exitIntent: false,
    publishActive: true,
    pathIncludes: "",
});

const MarketingPopupsPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState(emptyForm());

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchPopups();
            setItems(res.popups || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async () => {
        if (!form.name.trim()) {
            setError("Popup adı gerekli");
            return;
        }
        setError("");
        try {
            const paths = form.pathIncludes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            await createPopup({
                name: form.name,
                type: form.type,
                status: form.publishActive ? "active" : "draft",
                content: {
                    title: form.title,
                    body: form.body,
                    ctaText: form.ctaText,
                    couponCode: form.couponCode,
                    collectEmail: true,
                },
                displayRules: {
                    delaySeconds: Number(form.delaySeconds) || 5,
                    exitIntent: form.exitIntent,
                    onPageLoad: true,
                    pathIncludes: paths,
                },
            });
            setModal(false);
            setForm(emptyForm());
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        }
    };

    const columns = [
        { label: "Popup", key: "name", render: (r) => <strong>{r.name}</strong> },
        { label: "Tür", key: "type", render: (r) => TYPES.find((t) => t.id === r.type)?.label || r.type },
        { label: "Durum", key: "status", render: (r) => <MarketingBadge status={r.status} /> },
        { label: "Görüntülenme", key: "views", render: (r) => r.stats?.views ?? 0 },
        { label: "Dönüşüm", key: "conv", render: (r) => r.stats?.conversions ?? 0 },
        {
            label: "",
            key: "actions",
            render: (r) => (
                <div className="mkt-row-actions">
                    <button
                        type="button"
                        className="mkt-link"
                        onClick={async () => {
                            await updatePopup(r._id, { status: r.status === "active" ? "paused" : "active" });
                            load();
                        }}
                    >
                        {r.status === "active" ? <FaPause /> : <FaPlay />}
                    </button>
                    <button
                        type="button"
                        className="mkt-link mkt-link--danger"
                        onClick={async () => {
                            if (window.confirm("Silinsin mi?")) {
                                await deletePopup(r._id);
                                load();
                            }
                        }}
                    >
                        <FaTrash />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <MarketingPageShell
            title="Vitrin popup"
            subtitle="Mağaza sayfanızda ziyaretçilere indirim veya e-posta toplama penceresi gösterin."
            icon={FaWindowMaximize}
            actions={
                <MarketingButton variant="primary" icon={FaPlus} onClick={() => setModal(true)}>
                    Yeni Popup
                </MarketingButton>
            }
        >
            {error && <MarketingAlert type="error" onClose={() => setError("")}>{error}</MarketingAlert>}

            <MarketingSection>
                {loading ? (
                    <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
                ) : (
                    <div className="mkt-table-panel">
                        <MarketingDataTable
                            columns={columns}
                            rows={items.map((i) => ({ ...i, id: i._id }))}
                            emptyTitle="Henüz popup yok"
                            emptyHint="Mağaza vitrininde gösterilecek modal veya banner oluşturun."
                        />
                    </div>
                )}
            </MarketingSection>

            <MarketingModal
                wide
                open={modal}
                onClose={() => setModal(false)}
                title="Yeni popup"
                subtitle="Hemen yayınlamak için 'Vitrinde yayınla' işaretli bırakın."
                footer={
                    <>
                        <MarketingButton variant="ghost" onClick={() => setModal(false)}>
                            İptal
                        </MarketingButton>
                        <MarketingButton variant="primary" onClick={handleCreate}>
                            Kaydet
                        </MarketingButton>
                    </>
                }
            >
                <MarketingField label="Ad">
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </MarketingField>
                <MarketingField label="Tür">
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                        {TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </MarketingField>
                <MarketingField label="Başlık">
                    <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </MarketingField>
                <MarketingField label="Metin">
                    <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={3} />
                </MarketingField>
                <MarketingField label="CTA metni">
                    <input value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} />
                </MarketingField>
                <MarketingField label="Kupon kodu">
                    <input value={form.couponCode} onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value }))} />
                </MarketingField>
                <MarketingField label="Sayfa filtresi" hint="Virgülle ayırın. Boş = tüm sayfalar. Örn: /shop/magaza, /checkout">
                    <input
                        value={form.pathIncludes}
                        onChange={(e) => setForm((f) => ({ ...f, pathIncludes: e.target.value }))}
                        placeholder="/shop/, /checkout"
                    />
                </MarketingField>
                <MarketingField label="Gecikme (saniye)">
                    <input
                        type="number"
                        min={0}
                        value={form.delaySeconds}
                        onChange={(e) => setForm((f) => ({ ...f, delaySeconds: e.target.value }))}
                    />
                </MarketingField>
                <label className="mkt-check">
                    <input
                        type="checkbox"
                        checked={form.exitIntent}
                        onChange={(e) => setForm((f) => ({ ...f, exitIntent: e.target.checked }))}
                    />
                    Çıkış yaparken göster
                </label>
                <label className="mkt-check">
                    <input
                        type="checkbox"
                        checked={form.publishActive}
                        onChange={(e) => setForm((f) => ({ ...f, publishActive: e.target.checked }))}
                    />
                    Vitrinde hemen yayınla (aktif)
                </label>
            </MarketingModal>
        </MarketingPageShell>
    );
};

export default MarketingPopupsPage;
