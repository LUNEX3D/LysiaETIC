import React, { useCallback, useEffect, useState } from "react";
import { FaChartBar } from "react-icons/fa";
import { fetchMarketingReports } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingPillTabs,
    MarketingSection,
    MarketingDataTable,
    MarketingStatCard,
    MarketingAlert,
    MarketingBadge,
} from "./components/MarketingUi";

const RANGES = [
    { id: "7d", label: "7 Gün" },
    { id: "30d", label: "30 Gün" },
    { id: "90d", label: "90 Gün" },
];

const EVENT_LABELS = {
    campaign_sent: "E-posta kampanyası",
    campaign_failed: "Başarısız gönderim",
    sms_sent: "SMS gönderildi",
    automation_step: "Otomasyon adımı",
    popup_view: "Popup görüntüleme",
    popup_convert: "Popup dönüşüm",
    affiliate_click: "Affiliate tıklama",
    affiliate_sale: "Affiliate satış",
    email_open: "E-posta açılma",
    email_click: "E-posta tıklama",
};

const MarketingReportsPage = () => {
    const [data, setData] = useState(null);
    const [range, setRange] = useState("30d");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchMarketingReports(range);
            setData(res);
        } catch (e) {
            setError(e.response?.data?.error || "Rapor yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        load();
    }, [load]);

    const columns = [
        { label: "Kampanya", key: "name", render: (r) => <strong>{r.name}</strong> },
        { label: "Tür", key: "type", render: (r) => (r.type === "SMS" ? "SMS" : "E-posta") },
        { label: "Durum", key: "status", render: (r) => <MarketingBadge status={r.status} /> },
        { label: "Gönderim", key: "sent", render: (r) => r.stats?.delivered ?? r.stats?.sent ?? 0 },
        { label: "Gelir", key: "rev", render: (r) => `${(r.stats?.revenue ?? 0).toLocaleString("tr-TR")} ₺` },
    ];

    return (
        <MarketingPageShell
            title="Sonuçlar"
            subtitle="Gönderdiğiniz mesajların ve kampanyaların özet performansı."
            icon={FaChartBar}
            actions={<MarketingPillTabs items={RANGES} value={range} onChange={setRange} />}
        >
            {error && <MarketingAlert type="error">{error}</MarketingAlert>}

            {loading ? (
                <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>
            ) : (
                <>
                    <div className="mkt-stat-grid mkt-stat-grid--compact">
                        {(data?.eventsByType || []).length === 0 ? (
                            <p className="mkt-empty mkt-empty--inline">Bu dönemde olay kaydı yok.</p>
                        ) : (
                            (data?.eventsByType || []).map((e) => (
                                <MarketingStatCard
                                    key={e._id}
                                    accent="teal"
                                    label={EVENT_LABELS[e._id] || e._id}
                                    value={e.count}
                                    hint={`${(e.revenue ?? 0).toLocaleString("tr-TR")} ₺ gelir`}
                                />
                            ))
                        )}
                    </div>

                    <MarketingSection title="Kampanya özeti">
                        <div className="mkt-table-panel">
                            <MarketingDataTable
                                columns={columns}
                                rows={(data?.campaigns || []).map((c) => ({ ...c, id: c._id }))}
                                emptyTitle="Bu dönemde kampanya yok"
                            />
                        </div>
                    </MarketingSection>
                </>
            )}
        </MarketingPageShell>
    );
};

export default MarketingReportsPage;
