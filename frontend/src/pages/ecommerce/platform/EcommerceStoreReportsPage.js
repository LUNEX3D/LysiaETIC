import React, { useCallback, useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { fetchStoreDashboard } from "../../../services/storeApi";
import "../../../styles/ecommerceHome.css";
import "../../../styles/ecommercePlatform.css";

const fmtTry = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(v || 0));
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
};

export default function EcommerceStoreReportsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchStoreDashboard({ preset: "last_30_days", compare: "1" });
            if (!res.hasStore) {
                setError("Mağaza bulunamadı. Önce mağazanızı yayınlayın.");
                setData(null);
                return;
            }
            setData(res);
            setError("");
        } catch (e) {
            setError(e.response?.data?.error || "Rapor yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) return <div className="ec-platform-settings--loading">Analitik yükleniyor…</div>;
    if (error && !data) {
        return (
            <div className="ec-platform-settings">
                <p>{error}</p>
            </div>
        );
    }

    const kpi = data?.kpis || {};
    const chart = data?.chart || [];

    return (
        <div className="ec-platform-settings">
            <header className="ec-platform-settings__hero">
                <h1>Mağaza analitiği</h1>
                <p>Son 30 gün — yalnızca web mağaza kanalı (İkas / Shopify Analytics benzeri).</p>
            </header>
            <div className="ec-platform-reports-kpis">
                <article>
                    <span>Net satış</span>
                    <strong>{fmtTry(kpi.netSales)}</strong>
                </article>
                <article>
                    <span>Sipariş</span>
                    <strong>{kpi.orders ?? 0}</strong>
                </article>
                <article>
                    <span>Ortalama sepet</span>
                    <strong>{fmtTry(kpi.averageOrderValue)}</strong>
                </article>
                <article>
                    <span>Dönüşüm</span>
                    <strong>{kpi.conversionRate != null ? `${Number(kpi.conversionRate).toFixed(2)}%` : "—"}</strong>
                </article>
            </div>
            {chart.length > 0 && (
                <div className="ec-platform-reports-chart">
                    <h3>Satış trendi</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e3e3e7" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => fmtTry(v)} />
                            <Line type="monotone" dataKey="sales" stroke="#008060" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
