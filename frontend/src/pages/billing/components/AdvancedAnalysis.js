/**
 * Gelişmiş Analiz — sade vergi & fatura özeti (Türkiye)
 */
import React, { useMemo, useEffect, useState, useCallback } from "react";
import { FaChartPie, FaPercentage, FaCoins, FaFileInvoice, FaInfoCircle, FaSyncAlt } from "react-icons/fa";
import API from "../../../services/api";
import { colors } from "../styles";
import { fmtCurrency, loadAllBillingDocuments, isCancelledInvoiceStatus, resolveInvoiceTotals } from "../utils";
import { BILLING_DOCUMENTS_API } from "../constants";
import { GlassCard, Pill, LoadingState } from "./SharedUI";

/** Basitleştirilmiş gelir vergisi dilimleri (2024/25 tarzı — bilgilendirme amaçlı) */
const estimateIncomeTaxTr = (annualNetProfit) => {
    const p = Math.max(0, Number(annualNetProfit) || 0);
    if (p <= 0) return 0;
    const brackets = [
        { limit: 110000, rate: 0.15 },
        { limit: 230000, rate: 0.20 },
        { limit: 870000, rate: 0.27 },
        { limit: 3000000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ];
    let remaining = p;
    let tax = 0;
    let prev = 0;
    for (const b of brackets) {
        const slice = Math.min(remaining, b.limit - prev);
        if (slice <= 0) break;
        tax += slice * b.rate;
        remaining -= slice;
        prev = b.limit;
        if (remaining <= 0) break;
    }
    return tax;
};

const buildAnalysisData = (invoices) => {
    if (!invoices?.length) return null;

    const active = invoices.filter((i) => !isCancelledInvoiceStatus(i));
    const cancelled = invoices.filter((i) => isCancelledInvoiceStatus(i));

    const sumField = (list, pick) =>
        list.reduce((s, inv) => {
            const t = resolveInvoiceTotals(inv);
            return s + pick(t);
        }, 0);

    const grossIncl = sumField(active, (t) => t.total);
    const totalVat = sumField(active, (t) => t.tax);
    const netExcl = sumField(active, (t) => t.amount);

    const byType = {};
    active.forEach((inv) => {
        const t = resolveInvoiceTotals(inv);
        const type = inv.type || "diger";
        if (!byType[type]) byType[type] = { count: 0, total: 0, vat: 0 };
        byType[type].count++;
        byType[type].total += t.total;
        byType[type].vat += t.tax;
    });

    const monthKey = (d) => {
        try {
            const dt = new Date(d);
            return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
        } catch { return ""; }
    };
    const monthMap = {};
    active.forEach((inv) => {
        const k = monthKey(inv.date);
        if (!k) return;
        const t = resolveInvoiceTotals(inv);
        if (!monthMap[k]) monthMap[k] = { total: 0, vat: 0, count: 0 };
        monthMap[k].total += t.total;
        monthMap[k].vat += t.tax;
        monthMap[k].count++;
    });
    const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
    const lastMonth = months.length ? months[months.length - 1][1] : null;
    const annualNetProjection = lastMonth ? (lastMonth.total - lastMonth.vat) * 12 : netExcl;
    const annualVatProjection = lastMonth ? lastMonth.vat * 12 : totalVat;

    return {
        count: active.length,
        cancelledCount: cancelled.length,
        grossIncl,
        netExcl,
        totalVat,
        byType,
        months,
        annualNetProjection,
        annualVatProjection,
        kurumlarEstimate: annualNetProjection * 0.25,
        gelirVergisiEstimate: estimateIncomeTaxTr(annualNetProjection),
    };
};

const AdvancedAnalysis = React.memo(({ invoices: propInvoices = [], onRefresh, parentLoading = false }) => {
    const [localInvoices, setLocalInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statsHint, setStatsHint] = useState(null);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        setStatsHint(null);
        try {
            const [docs, statsRes] = await Promise.all([
                loadAllBillingDocuments(
                    (path, config) => API.get(path, config),
                    BILLING_DOCUMENTS_API.list,
                    { maxPages: 50 }
                ),
                API.get("/auto-invoice/stats").catch(() => null),
            ]);
            setLocalInvoices(docs);
            if (statsRes?.data?.success && statsRes.data.data) {
                const st = statsRes.data.data;
                if (docs.length === 0 && (st.totalInvoices || 0) > 0) {
                    setStatsHint({
                        totalInvoices: st.totalInvoices,
                        totalAmount: st.totalAmount || 0,
                    });
                }
            }
        } catch {
            setLocalInvoices([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const invoices = propInvoices.length > 0 ? propInvoices : localInvoices;

    useEffect(() => {
        if (propInvoices.length > 0) return;
        loadDocuments();
    }, [propInvoices.length, loadDocuments]);

    const data = useMemo(() => buildAnalysisData(invoices), [invoices]);

    const handleRefresh = async () => {
        if (onRefresh) {
            await onRefresh();
        }
        if (propInvoices.length === 0) {
            await loadDocuments();
        }
    };

    if ((loading || parentLoading) && !data) {
        return <LoadingState message="Analiz verileri yükleniyor..." sub="Kesilmiş faturalar veritabanından okunuyor." />;
    }

    if (!data) {
        return (
            <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", color: colors.textMuted }}>
                <FaChartPie style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.5 }} />
                <p style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "#e2e8f0" }}>Analiz için fatura verisi yok</p>
                <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", lineHeight: 1.6, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                    Gelişmiş analiz, Dashtock üzerinden kesilen e-Arşiv / e-Fatura kayıtlarına dayanır.
                    Henüz fatura kesmediyseniz <strong>Otomatik Fatura</strong> sekmesinden sipariş faturalayın
                    veya Sovos/QNB bağlantısından <strong>Yenile</strong> ile belgeleri senkronize edin.
                </p>
                {statsHint && (
                    <p style={{ color: colors.yellow, fontSize: "0.82rem", marginBottom: "1rem" }}>
                        Sistemde {statsHint.totalInvoices} fatura kaydı var ({fmtCurrency(statsHint.totalAmount)}).
                        Liste yüklenemedi — yenilemeyi deneyin.
                    </p>
                )}
                <button
                    type="button"
                    onClick={handleRefresh}
                    style={{
                        background: colors.accent + "20",
                        border: "1px solid " + colors.accent + "50",
                        borderRadius: 10,
                        padding: "0.55rem 1.1rem",
                        color: colors.accent,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <FaSyncAlt /> Verileri yenile
                </button>
            </div>
        );
    }

    const kpi = (label, value, sub, color) => (
        <GlassCard animate={false} style={{ padding: "1rem 1.15rem" }}>
            <p style={{ color: colors.dim, fontSize: "0.72rem", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
            <p style={{ color: color || colors.accent, fontSize: "1.35rem", fontWeight: 800, margin: "0.35rem 0 0" }}>{value}</p>
            {sub && <p style={{ color: colors.textMuted, fontSize: "0.72rem", margin: "0.35rem 0 0" }}>{sub}</p>}
        </GlassCard>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FaChartPie style={{ color: colors.accent }} />
                    <h3 style={{ color: "#fff", margin: 0, fontSize: "1.1rem" }}>Fatura & Vergi Özeti</h3>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        padding: "0.4rem 0.75rem",
                        color: colors.muted,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <FaSyncAlt /> Yenile
                </button>
            </div>

            <p style={{ color: colors.dim, fontSize: "0.78rem", margin: 0 }}>
                {data.count} aktif fatura, {data.cancelledCount} iptal — toplam {invoices.length} kayıt.
                {data.grossIncl <= 0 && data.count > 0 && (
                    <span style={{ color: colors.yellow }}>
                        {" "}Tutarlar DB&apos;de boş görünüyor; Sovos senkronu veya fatura detayından güncellenmesi gerekebilir.
                    </span>
                )}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                {kpi("Aktif fatura", data.count, "İptal hariç", colors.accent)}
                {kpi("KDV dahil ciro", fmtCurrency(data.grossIncl), "Kesilen faturalar", colors.green)}
                {kpi("KDV hariç matrah", fmtCurrency(data.netExcl), "Vergiler hariç", colors.orange)}
                {kpi("Tahmini KDV", fmtCurrency(data.totalVat), "Dönem toplamı", colors.yellow)}
                {kpi("İptal edilen", data.cancelledCount, "Sovos / kayıt", colors.red)}
            </div>

            <GlassCard animate={false}>
                <h4 style={{ color: colors.muted, fontSize: "0.85rem", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaPercentage /> Yıllık vergi tahmini (bilgilendirme)
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                    {kpi("Yıllık KDV (projeksiyon)", fmtCurrency(data.annualVatProjection), "Son ay × 12", colors.yellow)}
                    {kpi("Gelir vergisi (şahıs)", fmtCurrency(data.gelirVergisiEstimate), "Basitleştirilmiş dilim", colors.purple)}
                    {kpi("Kurumlar vergisi (Ltd/AŞ)", fmtCurrency(data.kurumlarEstimate), "%25 — kâr üzerinden", colors.blue)}
                </div>
                <p style={{ color: colors.dim, fontSize: "0.72rem", margin: "0.85rem 0 0", lineHeight: 1.5 }}>
                    <FaInfoCircle style={{ marginRight: 4 }} />
                    Tahminler yalnızca fatura verilerinize dayanır; gider, stopaj ve istisnalar dahil değildir. Resmi beyan için mali müşavirinize danışın.
                </p>
            </GlassCard>

            <GlassCard animate={false}>
                <h4 style={{ color: colors.muted, fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                    <FaFileInvoice style={{ marginRight: 6 }} /> Belge tipi kırılımı
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {Object.entries(data.byType).map(([type, row]) => (
                        <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid " + colors.glassBr }}>
                            <span><Pill color={colors.accent}>{type}</Pill> {row.count} adet</span>
                            <span style={{ color: colors.green, fontWeight: 700 }}>{fmtCurrency(row.total)}</span>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {data.months.length > 0 && (
                <GlassCard animate={false}>
                    <h4 style={{ color: colors.muted, fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                        <FaCoins style={{ marginRight: 6 }} /> Aylık trend
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {data.months.slice(-6).map(([key, row]) => (
                            <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                                <span style={{ color: colors.textMuted }}>{key}</span>
                                <span style={{ color: "#fff", fontWeight: 600 }}>{fmtCurrency(row.total)} <span style={{ color: colors.dim }}>(KDV {fmtCurrency(row.vat)})</span></span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}
        </div>
    );
});

AdvancedAnalysis.displayName = "AdvancedAnalysis";
export default AdvancedAnalysis;
