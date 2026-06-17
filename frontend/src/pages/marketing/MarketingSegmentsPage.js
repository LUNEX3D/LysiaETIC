import React, { useCallback, useEffect, useState } from "react";
import { FaUsers, FaPlus, FaSync, FaTrash } from "react-icons/fa";
import {
    fetchSegments,
    createSegment,
    deleteSegment,
    previewSegment,
    refreshSegment,
} from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingDataTable,
    MarketingModal,
    MarketingField,
    MarketingAlert,
    MarketingSection,
    MarketingInfoBox,
} from "./components/MarketingUi";

const FIELD_OPTIONS = [
    { id: "totalOrders", label: "Toplam sipariş" },
    { id: "totalSpent", label: "Toplam harcama (₺)" },
    { id: "lastOrderDaysAgo", label: "Son sipariş (gün)" },
    { id: "marketingEmailConsent", label: "E-posta izni (=1)" },
];

const OPS = [
    { id: ">", label: ">" },
    { id: ">=", label: "≥" },
    { id: "<", label: "<" },
    { id: "==", label: "=" },
];

const MarketingSegmentsPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [modal, setModal] = useState(false);
    const [name, setName] = useState("");
    const [rules, setRules] = useState([{ field: "totalOrders", operator: ">", value: 3 }]);
    const [preview, setPreview] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchSegments();
            setItems(res.segments || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const rulePayload = { logic: "and", rules };

    const columns = [
        { label: "Segment", key: "name", render: (r) => <strong>{r.name}</strong> },
        { label: "Üye", key: "count", render: (r) => `${r.cachedCount ?? 0} kişi` },
        {
            label: "Son güncelleme",
            key: "at",
            render: (r) => (r.lastCountedAt ? new Date(r.lastCountedAt).toLocaleString("tr-TR") : "—"),
        },
        {
            label: "",
            key: "actions",
            render: (r) => (
                <div className="mkt-row-actions">
                    <button type="button" className="mkt-link" onClick={() => refreshSegment(r._id).then(load)}>
                        <FaSync />
                    </button>
                    <button
                        type="button"
                        className="mkt-link mkt-link--danger"
                        onClick={async () => {
                            if (window.confirm("Silinsin mi?")) {
                                await deleteSegment(r._id);
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
            title="Müşteri grupları"
            subtitle="Belirli kurallara uyan müşterileri gruplayın; kampanyalarda bu grubu hedefleyin."
            icon={FaUsers}
            actions={
                <MarketingButton variant="primary" icon={FaPlus} onClick={() => setModal(true)}>
                    Segment Oluştur
                </MarketingButton>
            }
        >
            {error && <MarketingAlert type="error">{error}</MarketingAlert>}

            <MarketingInfoBox title="Segment nedir?" variant="tip">
                Örneğin «3’ten fazla sipariş verenler» veya «son 30 günde alışveriş yapmayanlar» gibi gruplar
                oluşturursunuz. Kampanya gönderirken bu grubu seçebilirsiniz.
            </MarketingInfoBox>

            <MarketingSection>
                {loading ? (
                    <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
                ) : (
                    <div className="mkt-table-panel">
                        <MarketingDataTable
                            columns={columns}
                            rows={items.map((i) => ({ ...i, id: i._id }))}
                            emptyTitle="Henüz segment yok"
                            emptyHint="Kurallarla canlı güncellenen hedef kitleler oluşturun."
                        />
                    </div>
                )}
            </MarketingSection>

            <MarketingModal
                open={modal}
                onClose={() => setModal(false)}
                title="Yeni müşteri grubu"
                subtitle="Eklediğiniz tüm kurallar birlikte uygulanır (hepsi geçerli olmalı)."
                wide
                footer={
                    <>
                        <MarketingButton variant="ghost" onClick={() => previewSegment(rulePayload).then(setPreview)}>
                            Önizle
                        </MarketingButton>
                        <MarketingButton
                            variant="primary"
                            onClick={async () => {
                                await createSegment({ name, rules: rulePayload });
                                setModal(false);
                                setName("");
                                load();
                            }}
                        >
                            Kaydet
                        </MarketingButton>
                    </>
                }
            >
                <MarketingField label="Segment adı">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP Müşteriler" />
                </MarketingField>

                <div className="mkt-segment-rules">
                    {rules.map((r, idx) => (
                        <div key={idx} className="mkt-rule-row">
                            <select
                                value={r.field}
                                onChange={(e) => {
                                    const next = [...rules];
                                    next[idx] = { ...next[idx], field: e.target.value };
                                    setRules(next);
                                }}
                            >
                                {FIELD_OPTIONS.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={r.operator}
                                onChange={(e) => {
                                    const next = [...rules];
                                    next[idx] = { ...next[idx], operator: e.target.value };
                                    setRules(next);
                                }}
                            >
                                {OPS.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={r.value}
                                onChange={(e) => {
                                    const next = [...rules];
                                    next[idx] = { ...next[idx], value: e.target.value };
                                    setRules(next);
                                }}
                            />
                            <button type="button" className="mkt-link mkt-link--danger" onClick={() => setRules(rules.filter((_, i) => i !== idx))}>
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" className="mkt-link" onClick={() => setRules([...rules, { field: "totalSpent", operator: ">", value: 1000 }])}>
                    + Kural ekle
                </button>
                {preview && <div className="mkt-preview-box">{preview.count} müşteri eşleşiyor</div>}
            </MarketingModal>
        </MarketingPageShell>
    );
};

export default MarketingSegmentsPage;
