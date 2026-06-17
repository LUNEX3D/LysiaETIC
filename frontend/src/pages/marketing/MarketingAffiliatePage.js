import React, { useCallback, useEffect, useState } from "react";
import { FaLink, FaPlus, FaCopy, FaTrash } from "react-icons/fa";
import { fetchAffiliates, createAffiliate, deleteAffiliate } from "../../services/marketingApi";
import { fetchStore } from "../../services/storeApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingDataTable,
    MarketingModal,
    MarketingField,
    MarketingAlert,
    MarketingSection,
} from "./components/MarketingUi";

const MarketingAffiliatePage = () => {
    const [items, setItems] = useState([]);
    const [storeSlug, setStoreSlug] = useState("");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [msg, setMsg] = useState("");
    const [form, setForm] = useState({ name: "", email: "", code: "", commissionType: "percent", commissionValue: 10 });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [aRes, storeRes] = await Promise.all([fetchAffiliates(), fetchStore().catch(() => null)]);
            setItems(aRes.affiliates || []);
            if (storeRes?.store?.slug) setStoreSlug(storeRes.store.slug);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const refUrl = (code) => `${window.location.origin}/shop/${storeSlug || "magaza"}?ref=${encodeURIComponent(code)}`;

    const copyLink = async (code) => {
        const url = refUrl(code);
        try {
            await navigator.clipboard.writeText(url);
            setMsg("Referans linki panoya kopyalandı.");
        } catch {
            setMsg(url);
        }
    };

    const columns = [
        { label: "Partner", key: "name", render: (r) => <strong>{r.name}</strong> },
        { label: "Kod", key: "code", render: (r) => <code className="mkt-code">{r.code}</code> },
        {
            label: "Komisyon",
            key: "comm",
            render: (r) => (r.commissionType === "fixed" ? `${r.commissionValue} ₺` : `%${r.commissionValue}`),
        },
        { label: "Tıklama", key: "clicks", render: (r) => r.stats?.clicks ?? 0 },
        { label: "Sipariş", key: "orders", render: (r) => r.stats?.orders ?? 0 },
        { label: "Ciro", key: "rev", render: (r) => `${(r.stats?.revenue ?? 0).toLocaleString("tr-TR")} ₺` },
        {
            label: "",
            key: "actions",
            render: (r) => (
                <div className="mkt-row-actions">
                    <button type="button" className="mkt-link" onClick={() => copyLink(r.code)} title="Linki kopyala">
                        <FaCopy /> Kopyala
                    </button>
                    <button
                        type="button"
                        className="mkt-link mkt-link--danger"
                        onClick={async () => {
                            if (window.confirm("Silinsin mi?")) {
                                await deleteAffiliate(r._id);
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
            title="Ortaklık programı"
            subtitle="Influencer veya iş ortaklarına özel link verin; getirdikleri satıştan komisyon kazanın."
            icon={FaLink}
            actions={
                <MarketingButton variant="primary" icon={FaPlus} onClick={() => setModal(true)}>
                    Affiliate Ekle
                </MarketingButton>
            }
        >
            {msg && (
                <MarketingAlert type="success" onClose={() => setMsg("")}>
                    {msg}
                </MarketingAlert>
            )}

            <MarketingSection>
                {loading ? (
                    <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
                ) : (
                    <div className="mkt-table-panel">
                        <MarketingDataTable
                            columns={columns}
                            rows={items.map((i) => ({ ...i, id: i._id }))}
                            emptyTitle="Henüz affiliate yok"
                            emptyHint="Her partner için benzersiz ?ref=KOD linki oluşturulur ve vitrinde otomatik takip edilir."
                        />
                    </div>
                )}
            </MarketingSection>

            <MarketingModal
                open={modal}
                onClose={() => setModal(false)}
                title="Yeni affiliate"
                footer={
                    <>
                        <MarketingButton variant="ghost" onClick={() => setModal(false)}>
                            İptal
                        </MarketingButton>
                        <MarketingButton
                            variant="primary"
                            onClick={async () => {
                                await createAffiliate(form);
                                setModal(false);
                                setForm({ name: "", email: "", code: "", commissionType: "percent", commissionValue: 10 });
                                load();
                            }}
                        >
                            Kaydet
                        </MarketingButton>
                    </>
                }
            >
                <MarketingField label="Partner adı">
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </MarketingField>
                <MarketingField label="E-posta">
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </MarketingField>
                <MarketingField label="Referans kodu (boş = otomatik)">
                    <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ORN2024" />
                </MarketingField>
                <MarketingField label="Komisyon">
                    <div className="mkt-settings-row-2">
                        <select
                            value={form.commissionType}
                            onChange={(e) => setForm((f) => ({ ...f, commissionType: e.target.value }))}
                        >
                            <option value="percent">Yüzde</option>
                            <option value="fixed">Sabit TL</option>
                        </select>
                        <input
                            type="number"
                            value={form.commissionValue}
                            onChange={(e) => setForm((f) => ({ ...f, commissionValue: Number(e.target.value) }))}
                        />
                    </div>
                </MarketingField>
            </MarketingModal>
        </MarketingPageShell>
    );
};

export default MarketingAffiliatePage;
