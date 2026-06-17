import React, { useCallback, useEffect, useState } from "react";
import { FaRobot, FaPlus, FaMagic, FaPlay, FaPause, FaEdit, FaTrash } from "react-icons/fa";
import { fetchAutomations, createAutomation, updateAutomation, deleteAutomation } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingDataTable,
    MarketingBadge,
    MarketingAlert,
    MarketingSection,
} from "./components/MarketingUi";

const TRIGGERS = {
    customer_registered: "Kayıt oldu",
    order_placed: "Sipariş verdi",
    order_cancelled: "Sipariş iptal",
    cart_abandoned: "Sepet terk",
    order_delivered: "Teslim edildi",
    days_since_last_order: "30 gün sessiz",
};

const MarketingAutomationsPage = ({ onNavigate }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchAutomations();
            setItems(res.automations || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const columns = [
        { label: "Otomasyon", key: "name", render: (r) => <strong>{r.name}</strong> },
        {
            label: "Tetikleyici",
            key: "trigger",
            render: (r) => TRIGGERS[r.trigger?.type] || r.trigger?.type,
        },
        {
            label: "Durum",
            key: "status",
            render: (r) => <MarketingBadge status={r.status} />,
        },
        { label: "Tamamlanan", key: "done", render: (r) => r.stats?.completed ?? 0 },
        {
            label: "",
            key: "actions",
            render: (r) => (
                <div className="mkt-row-actions">
                    <button type="button" className="mkt-link" onClick={() => onNavigate?.(`mkt-automation-${r._id}`)}>
                        <FaEdit style={{ marginRight: 4 }} /> Düzenle
                    </button>
                    <button
                        type="button"
                        className="mkt-link"
                        onClick={async () => {
                            await updateAutomation(r._id, { status: r.status === "active" ? "paused" : "active" });
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
                                await deleteAutomation(r._id);
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
            title="Otomatik mesajlar"
            subtitle="Müşteri kayıt olduğunda veya sipariş verdiğinde otomatik e-posta/SMS gönderin."
            icon={FaRobot}
            actions={
                <div className="mkt-btn-group">
                    <MarketingButton
                        variant="ghost"
                        icon={FaMagic}
                        onClick={async () => {
                            const res = await createAutomation({ name: "Hoş geldin serisi", useWelcomeTemplate: true });
                            onNavigate?.(`mkt-automation-${res.automation._id}`);
                        }}
                    >
                        Hoş geldin şablonu
                    </MarketingButton>
                    <MarketingButton
                        variant="primary"
                        icon={FaPlus}
                        onClick={async () => {
                            const res = await createAutomation({
                                name: "Yeni otomasyon",
                                trigger: { type: "customer_registered", config: {} },
                                nodes: [],
                                edges: [],
                            });
                            onNavigate?.(`mkt-automation-${res.automation._id}`);
                        }}
                    >
                        Yeni Otomasyon
                    </MarketingButton>
                </div>
            }
        >
            {error && <MarketingAlert type="error">{error}</MarketingAlert>}
            <MarketingSection>
                {loading ? (
                    <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
                ) : (
                    <div className="mkt-table-panel">
                        <MarketingDataTable
                            columns={columns}
                            rows={items.map((i) => ({ ...i, id: i._id }))}
                            emptyTitle="Henüz otomasyon yok"
                            emptyHint="Hoş geldin şablonu ile tek tıkla başlayın veya sıfırdan akış oluşturun."
                        />
                    </div>
                )}
            </MarketingSection>
        </MarketingPageShell>
    );
};

export default MarketingAutomationsPage;
