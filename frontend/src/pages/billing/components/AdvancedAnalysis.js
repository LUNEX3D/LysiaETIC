/**
 * Gelişmiş Analiz Bileşeni — Tamamen bağımsız, saf React
 * LysiaETIC
 *
 * Finansal sağlık skoru, tip/durum kırılımı, aylık trend,
 * müşteri analizi, haftanın günü, tutar dağılımı, KDV analizi.
 */
import React, { useState, useMemo } from "react";
import {
    FaChartPie, FaCheckCircle, FaCalendarAlt, FaBuilding,
    FaChartBar, FaChevronDown, FaChevronUp, FaExclamationTriangle,
    FaPercentage, FaCoins, FaFileInvoice, FaMoneyBillWave, FaHashtag,
} from "react-icons/fa";
import { colors } from "../styles";
import { fmtCurrency } from "../utils";
import { StatusBadge, Pill } from "./SharedUI";
// PROVIDERS, DOC_TYPES removed — unused

const TC = { "e-arsiv": colors.accent, "e-fatura": colors.orange, "e-fatura-gelen": colors.purple, "e-irsaliye": colors.pink };
const TL = { "e-arsiv": "e-Arşiv", "e-fatura": "e-Fatura", "e-fatura-gelen": "Gelen e-Fatura", "e-irsaliye": "e-İrsaliye" };

const AdvancedAnalysis = React.memo(({ invoices, onInvoiceClick }) => {
    const [openSections, setOpenSections] = useState({
        score: true,
        type: true,
        status: true,
        month: true,
        customer: true,
        tax: true,
        day: true,
        range: true,
        provider: true,
        extremes: true,
    });
    const toggleSection = (id) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

    const data = useMemo(() => {
        if (!invoices || invoices.length === 0) return null;

        const totalAmount = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const totalTax = invoices.reduce((s, i) => s + (Number(i.tax) || 0), 0);
        const n = invoices.length;
        const allTotals = invoices.map((i) => Number(i.total) || 0);
        const avgAmount = n > 0 ? totalAmount / n : 0;
        const maxAmount = allTotals.length > 0 ? Math.max(...allTotals) : 0;
        const minAmount = allTotals.length > 0 ? Math.min(...allTotals) : 0;
        const sortedTotals = [...allTotals].sort((a, b) => a - b);
        const medianAmount =
            sortedTotals.length > 0
                ? sortedTotals.length % 2 === 1
                    ? sortedTotals[Math.floor(sortedTotals.length / 2)]
                    : (sortedTotals[sortedTotals.length / 2 - 1] + sortedTotals[sortedTotals.length / 2]) / 2
                : 0;
        const netAmount = totalAmount - totalTax;
        const taxRate = netAmount > 0 ? (totalTax / netAmount) * 100 : 0;
        const variance =
            n > 1 ? allTotals.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / n : 0;
        const stdDev = Math.sqrt(variance);

        // Tip kırılımı
        const byType = {};
        invoices.forEach((inv) => {
            const t = inv.type || "diger";
            if (!byType[t]) byType[t] = { count: 0, total: 0, tax: 0, items: [] };
            byType[t].count++;
            byType[t].total += inv.total || 0;
            byType[t].tax += inv.tax || 0;
            byType[t].items.push(inv);
        });

        // Durum kırılımı
        const byStatus = {};
        invoices.forEach((inv) => {
            const s = inv.status || "bilinmiyor";
            if (!byStatus[s]) byStatus[s] = { count: 0, total: 0, items: [] };
            byStatus[s].count++;
            byStatus[s].total += inv.total || 0;
            byStatus[s].items.push(inv);
        });

        // Müşteri kırılımı
        const custMap = {};
        invoices.forEach((inv) => {
            const c = inv.customer || "Belirtilmemiş";
            if (!custMap[c]) custMap[c] = { count: 0, total: 0, tax: 0, vkn: inv.vkn || "", types: {}, items: [] };
            custMap[c].count++;
            custMap[c].total += inv.total || 0;
            custMap[c].tax += inv.tax || 0;
            custMap[c].types[inv.type || "diger"] = (custMap[c].types[inv.type || "diger"] || 0) + 1;
            custMap[c].items.push(inv);
        });
        const allCustomers = Object.entries(custMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);
        const topCustomers = allCustomers.slice(0, 20);

        // Pareto
        let paretoRunning = 0;
        let pareto80Count = 0;
        const pareto80Threshold = totalAmount * 0.8;
        for (const cust of allCustomers) {
            paretoRunning += cust.total;
            pareto80Count++;
            if (paretoRunning >= pareto80Threshold) break;
        }
        const paretoRatio = allCustomers.length > 0 ? (pareto80Count / allCustomers.length) * 100 : 0;

        // Aylık kırılım
        const monthMap = {};
        invoices.forEach((inv) => {
            if (!inv.date) return;
            try {
                const d = new Date(inv.date);
                if (isNaN(d.getTime())) return;
                const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
                const label = d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
                if (!monthMap[key]) monthMap[key] = { key, label, count: 0, total: 0, tax: 0, types: {} };
                monthMap[key].count++;
                monthMap[key].total += inv.total || 0;
                monthMap[key].tax += inv.tax || 0;
                monthMap[key].types[inv.type || "diger"] = (monthMap[key].types[inv.type || "diger"] || 0) + 1;
            } catch { /* skip */ }
        });
        const monthly = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
        const monthlyGrowth = monthly.map((m, i) => {
            if (i === 0) return { ...m, growth: null };
            const prev = monthly[i - 1].total;
            return { ...m, growth: prev > 0 ? ((m.total - prev) / prev) * 100 : null };
        });

        // Haftanın günü
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const byDayOfWeek = Array(7).fill(null).map(() => ({ count: 0, total: 0 }));
        invoices.forEach((inv) => {
            if (!inv.date) return;
            try {
                const d = new Date(inv.date);
                if (!isNaN(d.getTime())) { byDayOfWeek[d.getDay()].count++; byDayOfWeek[d.getDay()].total += inv.total || 0; }
            } catch { /* skip */ }
        });
        const dayData = byDayOfWeek.map((d, i) => ({ name: dayNames[i], ...d }));
        const busiestDay = dayData.reduce((best, d) => (d.count > best.count ? d : best), dayData[0]);

        // Tutar dağılım
        const ranges = [
            { label: "0 - 1.000 ₺", min: 0, max: 1000, count: 0, total: 0, color: colors.blue },
            { label: "1.000 - 5.000 ₺", min: 1000, max: 5000, count: 0, total: 0, color: colors.accent },
            { label: "5.000 - 25.000 ₺", min: 5000, max: 25000, count: 0, total: 0, color: colors.green },
            { label: "25.000 - 100.000 ₺", min: 25000, max: 100000, count: 0, total: 0, color: colors.orange },
            { label: "100.000 ₺+", min: 100000, max: Infinity, count: 0, total: 0, color: colors.red },
        ];
        invoices.forEach((inv) => {
            const t = inv.total || 0;
            for (const r of ranges) { if (t >= r.min && t < r.max) { r.count++; r.total += t; break; } }
        });

        // Sağlayıcı
        const byProvider = {};
        invoices.forEach((inv) => {
            const p = inv.provider || "bilinmiyor";
            if (!byProvider[p]) byProvider[p] = { count: 0, total: 0 };
            byProvider[p].count++;
            byProvider[p].total += inv.total || 0;
        });

        // Sağlık skoru
        let healthScore = 50;
        if (allCustomers.length >= 5) healthScore += 8;
        if (allCustomers.length >= 10) healthScore += 5;
        if (monthly.length >= 3) healthScore += 7;
        if (monthly.length >= 6) healthScore += 5;
        const recentGrowths = monthlyGrowth.filter((m) => m.growth !== null).slice(-3);
        const avgGrowth = recentGrowths.length > 0 ? recentGrowths.reduce((s, m) => s + m.growth, 0) / recentGrowths.length : 0;
        if (avgGrowth > 10) healthScore += 10;
        else if (avgGrowth > 0) healthScore += 5;
        else if (avgGrowth < -10) healthScore -= 10;
        const approvedCount = (byStatus["approved"]?.count || 0) + (byStatus["succeed"]?.count || 0) + (byStatus["completed"]?.count || 0) + (byStatus["sent"]?.count || 0);
        const approvalRate = invoices.length > 0 ? (approvedCount / invoices.length) * 100 : 0;
        if (approvalRate > 90) healthScore += 10;
        else if (approvalRate > 70) healthScore += 5;
        else if (approvalRate < 50) healthScore -= 10;
        if (paretoRatio < 20) healthScore -= 5;
        healthScore = Math.max(0, Math.min(100, healthScore));
        const healthLabel = healthScore >= 80 ? "Mükemmel" : healthScore >= 60 ? "İyi" : healthScore >= 40 ? "Orta" : "Dikkat";
        const healthColor = healthScore >= 80 ? colors.green : healthScore >= 60 ? colors.accent : healthScore >= 40 ? colors.yellow : colors.red;

        const sortedByTotal = [...invoices].filter((i) => (i.total || 0) > 0).sort((a, b) => (b.total || 0) - (a.total || 0));

        return {
            totalAmount, totalTax, netAmount, avgAmount, maxAmount, minAmount, medianAmount, taxRate, stdDev,
            byType, byStatus, topCustomers, allCustomers, monthly, monthlyGrowth, byProvider,
            paretoRatio, pareto80Count, dayData, busiestDay, ranges,
            top5: sortedByTotal.slice(0, 5), bottom5: sortedByTotal.slice(-5).reverse(),
            healthScore, healthLabel, healthColor, approvalRate, avgGrowth,
        };
    }, [invoices]);

    if (!data) {
        return (
            <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: colors.dim }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📊</div>
                <p style={{ color: colors.muted, fontSize: "1rem", fontWeight: 600 }}>Analiz için veri yok</p>
                <p style={{ fontSize: "0.82rem" }}>Gelişmiş analiz görüntülemek için önce belgelerinizin yüklenmesi gerekiyor.</p>
            </div>
        );
    }

    const pct = (val, max) => (max > 0 ? Math.min((val / max) * 100, 100) : 0);
    const maxTypeTotal = Math.max(...Object.values(data.byType).map((d) => d.total), 1);
    const maxMonthTotal = data.monthly.length > 0 ? Math.max(...data.monthly.map((d) => d.total), 1) : 1;
    const maxCustTotal = data.topCustomers.length > 0 ? data.topCustomers[0].total : 1;
    // maxDayCount, maxRangeCount removed — unused

    const ACard = ({ children, style: s }) => (
        <div style={{ background: colors.cardGradient, border: "1px solid " + colors.border, borderRadius: 16, marginBottom: "1rem", overflow: "hidden", ...s }}>{children}</div>
    );

    const SectionHead = ({ id, icon, title, color, badge, subtitle }) => (
        <div onClick={() => toggleSection(id)}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.25rem", cursor: "pointer", userSelect: "none", borderBottom: openSections[id] ? "1px solid " + colors.glassBr : "none" }}>
            <div style={{ background: color + "20", padding: "0.5rem", borderRadius: 10, fontSize: "0.95rem", display: "flex", color }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <span style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>{title}</span>
                {subtitle && <p style={{ color: colors.dim, fontSize: "0.68rem", margin: "0.1rem 0 0" }}>{subtitle}</p>}
            </div>
            {badge && <span style={{ background: color + "15", border: "1px solid " + color + "25", borderRadius: 6, padding: "0.15rem 0.5rem", color, fontSize: "0.7rem", fontWeight: 700 }}>{badge}</span>}
            <FaChevronDown style={{ color: colors.dim, fontSize: "0.7rem", transform: openSections[id] ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease" }} />
        </div>
    );

    const Bar = ({ value, max, color, height }) => (
        <div style={{ height: height || 7, background: colors.glass, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct(value, max) + "%", background: "linear-gradient(90deg, " + color + ", " + color + "aa)", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
    );

    return (
        <div>
            {/* Finansal Sağlık Skoru */}
            <ACard>
                <div style={{ padding: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                        <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, transform: "rotate(-90deg)" }}>
                            <circle cx="60" cy="60" r="52" fill="none" stroke={colors.glass} strokeWidth="8" />
                            <circle cx="60" cy="60" r="52" fill="none" stroke={data.healthColor} strokeWidth="8"
                                strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - data.healthScore / 100)}
                                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: data.healthColor, fontSize: "1.8rem", fontWeight: 900, lineHeight: 1 }}>{data.healthScore}</span>
                            <span style={{ color: colors.dim, fontSize: "0.6rem", fontWeight: 600, marginTop: 2 }}>{data.healthLabel}</span>
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.15rem" }}>Finansal Sağlık Skoru</h3>
                        <p style={{ color: colors.dim, fontSize: "0.75rem", margin: "0 0 0.85rem" }}>Fatura verilerinize dayalı genel değerlendirme</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            {[
                                { label: "Onay Oranı", value: "%" + data.approvalRate.toFixed(0), color: data.approvalRate > 80 ? colors.green : data.approvalRate > 50 ? colors.yellow : colors.red },
                                { label: "Müşteri Çeşitliliği", value: data.allCustomers.length + " müşteri", color: data.allCustomers.length >= 5 ? colors.green : colors.yellow },
                                { label: "Ort. Büyüme", value: (data.avgGrowth >= 0 ? "+" : "") + data.avgGrowth.toFixed(1) + "%", color: data.avgGrowth > 0 ? colors.green : data.avgGrowth < -5 ? colors.red : colors.yellow },
                                { label: "Düzenlilik", value: data.monthly.length + " aktif ay", color: data.monthly.length >= 3 ? colors.green : colors.yellow },
                            ].map((item) => (
                                <div key={item.label} style={{ background: colors.glass, borderRadius: 8, padding: "0.5rem 0.65rem" }}>
                                    <span style={{ color: colors.dim, fontSize: "0.62rem", fontWeight: 600 }}>{item.label}</span>
                                    <p style={{ color: item.color, fontSize: "0.88rem", fontWeight: 700, margin: "0.1rem 0 0" }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ACard>

            {/* KPI Kartları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.7rem", marginBottom: "1.25rem" }}>
                {[
                    { icon: <FaFileInvoice />, label: "Toplam Belge", value: invoices.length, color: colors.accent },
                    { icon: <FaMoneyBillWave />, label: "Brüt Ciro", value: fmtCurrency(data.totalAmount), color: colors.green },
                    { icon: <FaCoins />, label: "Net Ciro", value: fmtCurrency(data.netAmount), color: colors.green },
                    { icon: <FaPercentage />, label: "Toplam KDV", value: fmtCurrency(data.totalTax), color: colors.purple },
                    { icon: <FaChartBar />, label: "Ortalama", value: fmtCurrency(data.avgAmount), color: colors.blue },
                    { icon: <FaChevronUp />, label: "En Yüksek", value: fmtCurrency(data.maxAmount), color: colors.green },
                    { icon: <FaChevronDown />, label: "En Düşük", value: fmtCurrency(data.minAmount), color: colors.yellow },
                    { icon: <FaHashtag />, label: "Medyan", value: fmtCurrency(data.medianAmount), color: colors.orange },
                    { icon: <FaPercentage />, label: "Ort. KDV", value: "%" + data.taxRate.toFixed(1), color: colors.pink },
                    { icon: <FaBuilding />, label: "Müşteri", value: data.allCustomers.length, color: colors.blue },
                ].map((k) => (
                    <div key={k.label} style={{ background: colors.cardGradient, border: "1px solid " + k.color + "22", borderRadius: 12, padding: "0.9rem", position: "relative", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.35rem" }}>
                            <span style={{ color: k.color, fontSize: "0.8rem" }}>{k.icon}</span>
                            <span style={{ color: colors.dim, fontSize: "0.66rem", fontWeight: 600 }}>{k.label}</span>
                        </div>
                        <p style={{ color: "#fff", fontSize: "1.08rem", fontWeight: 800, margin: 0 }}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Belge Tipi Kırılımı */}
            <ACard>
                <SectionHead id="type" icon={<FaChartPie />} title="Belge Tipi Kırılımı" color={colors.accent} badge={Object.keys(data.byType).length + " tip"} />
                {openSections["type"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: "1rem", gap: 2 }}>
                            {Object.entries(data.byType).map(([type, d]) => (
                                <div key={type} title={(TL[type] || type) + ": " + d.count + " belge"} style={{ flex: d.count, background: TC[type] || colors.dim, transition: "flex 0.3s" }} />
                            ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                            {Object.entries(data.byType).map(([type, d]) => {
                                const typeColor = TC[type] || colors.dim;
                                const pctVal = invoices.length > 0 ? ((d.count / invoices.length) * 100).toFixed(1) : "0";
                                return (
                                    <div key={type}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: typeColor, flexShrink: 0 }} />
                                                <Pill color={typeColor}>{TL[type] || type}</Pill>
                                                <span style={{ color: colors.muted, fontSize: "0.75rem" }}>{d.count} belge</span>
                                                <span style={{ color: colors.dim, fontSize: "0.68rem" }}>(%{pctVal})</span>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700 }}>{fmtCurrency(d.total)}</span>
                                                {d.tax > 0 && <span style={{ color: colors.dim, fontSize: "0.68rem", marginLeft: "0.5rem" }}>KDV: {fmtCurrency(d.tax)}</span>}
                                            </div>
                                        </div>
                                        <Bar value={d.total} max={maxTypeTotal} color={typeColor} height={7} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Durum Dağılımı */}
            <ACard>
                <SectionHead id="status" icon={<FaCheckCircle />} title="Durum Dağılımı" color={colors.green} badge={Object.keys(data.byStatus).length + " durum"} />
                {openSections["status"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                            {Object.entries(data.byStatus).map(([status, d]) => (
                                <div key={status} style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 12, padding: "0.9rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                                        <StatusBadge status={status} />
                                        <span style={{ color: "#fff", fontSize: "1rem", fontWeight: 800 }}>{d.count}</span>
                                    </div>
                                    <p style={{ color: colors.muted, fontSize: "0.78rem", margin: "0 0 0.4rem", fontWeight: 600 }}>{fmtCurrency(d.total)}</p>
                                    <Bar value={d.count} max={invoices.length} color={colors.accent} height={5} />
                                    <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0.25rem 0 0" }}>Toplam belgelerin %{(invoices.length > 0 ? (d.count / invoices.length * 100) : 0).toFixed(1)}'i</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Aylık Ciro Trendi */}
            <ACard>
                <SectionHead id="month" icon={<FaCalendarAlt />} title="Aylık Ciro Trendi" color={colors.blue} badge={data.monthly.length + " ay"} />
                {openSections["month"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        {data.monthlyGrowth.length > 0 ? (
                            <>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: "1rem", padding: "0 0.25rem" }}>
                                    {data.monthlyGrowth.map((m) => (
                                        <div key={m.key} title={m.label + ": " + fmtCurrency(m.total)}
                                            style={{ flex: 1, background: "linear-gradient(to top, " + colors.blue + ", " + colors.blue + "60)", borderRadius: "4px 4px 0 0", height: pct(m.total, maxMonthTotal) + "%", minHeight: 4, transition: "height 0.3s", cursor: "pointer" }} />
                                    ))}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {data.monthlyGrowth.map((m) => (
                                        <div key={m.key}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ color: colors.text, fontSize: "0.84rem", fontWeight: 600 }}>{m.label}</span>
                                                    {m.growth !== null && (
                                                        <span style={{ background: (m.growth >= 0 ? colors.green : colors.red) + "15", border: "1px solid " + (m.growth >= 0 ? colors.green : colors.red) + "30", borderRadius: 5, padding: "0.1rem 0.4rem", fontSize: "0.62rem", fontWeight: 700, color: m.growth >= 0 ? colors.green : colors.red }}>
                                                            {m.growth >= 0 ? "▲" : "▼"} {Math.abs(m.growth).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                    <span style={{ color: colors.dim, fontSize: "0.7rem" }}>{m.count} belge</span>
                                                    <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700 }}>{fmtCurrency(m.total)}</span>
                                                </div>
                                            </div>
                                            <Bar value={m.total} max={maxMonthTotal} color={colors.blue} height={8} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : <p style={{ color: colors.dim, fontSize: "0.82rem" }}>Tarih bilgisi olan belge bulunamadı.</p>}
                    </div>
                )}
            </ACard>

            {/* Müşteri Analizi */}
            <ACard>
                <SectionHead id="customer" icon={<FaBuilding />} title="Müşteri Analizi" color={colors.orange} badge={"Top " + data.topCustomers.length}
                    subtitle={"Pareto: Cironun %80'i " + data.pareto80Count + " müşteriden (%" + data.paretoRatio.toFixed(0) + ")"} />
                {openSections["customer"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        {data.paretoRatio < 30 && data.allCustomers.length > 3 && (
                            <div style={{ background: colors.yellow + "10", border: "1px solid " + colors.yellow + "25", borderRadius: 10, padding: "0.65rem 0.85rem", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaExclamationTriangle style={{ color: colors.yellow, flexShrink: 0, fontSize: "0.85rem" }} />
                                <span style={{ color: colors.yellow, fontSize: "0.75rem" }}>
                                    <strong>Yoğunlaşma Riski:</strong> Cironuzun %80'i sadece {data.pareto80Count} müşteriden geliyor.
                                </span>
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {data.topCustomers.map((cust, i) => (
                                <div key={cust.name + i} style={{ background: i < 3 ? colors.orange + "06" : "transparent", border: "1px solid " + (i < 3 ? colors.orange + "20" : colors.glassBr), borderRadius: 12, padding: "0.75rem 0.95rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ color: i < 3 ? colors.orange : colors.dim, fontSize: "0.75rem", fontWeight: 800, minWidth: 24, textAlign: "center" }}>
                                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}
                                            </span>
                                            <div>
                                                <p style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>{cust.name}</p>
                                                {cust.vkn && <p style={{ color: colors.dim, fontSize: "0.62rem", margin: 0, fontFamily: "monospace" }}>{cust.vkn}</p>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <p style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>{fmtCurrency(cust.total)}</p>
                                            <p style={{ color: colors.dim, fontSize: "0.62rem", margin: 0 }}>{cust.count} belge • %{(data.totalAmount > 0 ? (cust.total / data.totalAmount * 100) : 0).toFixed(1)} pay</p>
                                        </div>
                                    </div>
                                    <Bar value={cust.total} max={maxCustTotal} color={i < 3 ? colors.orange : colors.dim} height={5} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Haftanın günü */}
            <ACard>
                <SectionHead id="day" icon={<FaCalendarAlt />} title="Haftanın Günü Dağılımı" color={colors.yellow} subtitle="Fatura kesim / belge tarihi" />
                {openSections["day"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <p style={{ color: colors.dim, fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
                            En yoğun gün: <strong style={{ color: colors.muted }}>{data.busiestDay.name}</strong> ({data.busiestDay.count} belge)
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {data.dayData.map((d) => {
                                const maxC = Math.max(...data.dayData.map((x) => x.count), 1);
                                return (
                                    <div key={d.name}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ color: colors.muted, fontSize: "0.78rem" }}>{d.name}</span>
                                            <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600 }}>{d.count} • {fmtCurrency(d.total)}</span>
                                        </div>
                                        <Bar value={d.count} max={maxC} color={colors.yellow} height={6} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Tutar dilimleri */}
            <ACard>
                <SectionHead id="range" icon={<FaCoins />} title="Tutar Dilimleri" color={colors.accent} />
                {openSections["range"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                            {data.ranges.map((r) => {
                                const maxRc = Math.max(...data.ranges.map((x) => x.count), 1);
                                return (
                                    <div key={r.label}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ color: r.color, fontSize: "0.78rem", fontWeight: 600 }}>{r.label}</span>
                                            <span style={{ color: colors.dim, fontSize: "0.72rem" }}>{r.count} belge • {fmtCurrency(r.total)}</span>
                                        </div>
                                        <Bar value={r.count} max={maxRc} color={r.color} height={6} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Sağlayıcı */}
            <ACard>
                <SectionHead id="provider" icon={<FaBuilding />} title="Sağlayıcı Dağılımı" color={colors.purple} badge={Object.keys(data.byProvider).length + " kaynak"} />
                {openSections["provider"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {Object.entries(data.byProvider).map(([pid, d]) => {
                                const maxP = Math.max(...Object.values(data.byProvider).map((x) => x.total), 1);
                                const label = pid === "qnb-esolutions" ? "QNB eSolutions" : pid === "trendyol-efaturam" ? "Trendyol E-Faturam" : pid === "sovos" ? "Sovos" : pid === "parasut" ? "Paraşüt" : pid === "odeal" ? "Ödeal" : pid;
                                return (
                                    <div key={pid}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ color: colors.muted, fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>
                                            <span style={{ color: colors.dim, fontSize: "0.72rem" }}>{d.count} belge • {fmtCurrency(d.total)}</span>
                                        </div>
                                        <Bar value={d.total} max={maxP} color={colors.purple} height={6} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* Uç değerler */}
            <ACard>
                <SectionHead id="extremes" icon={<FaChartBar />} title="En Yüksek / En Düşük Belgeler" color={colors.green} subtitle={onInvoiceClick ? "Satıra tıklayarak detay açın" : undefined} />
                {openSections["extremes"] && (
                    <div style={{ padding: "1.15rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                            <div>
                            <p style={{ color: colors.green, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase" }}>En yüksek tutarlar</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                {data.top5.length === 0 && <p style={{ color: colors.dim, fontSize: "0.75rem" }}>Tutarı sıfırdan büyük belge yok.</p>}
                                {data.top5.map((inv) => (
                                    <div
                                        key={inv.id}
                                        role={onInvoiceClick ? "button" : undefined}
                                        onClick={() => onInvoiceClick?.(inv)}
                                        onKeyDown={(e) => e.key === "Enter" && onInvoiceClick?.(inv)}
                                        tabIndex={onInvoiceClick ? 0 : undefined}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 8,
                                            padding: "0.5rem 0.65rem",
                                            cursor: onInvoiceClick ? "pointer" : "default",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                                            <span style={{ color: colors.muted, fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.number || inv.id}</span>
                                            <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 700 }}>{fmtCurrency(inv.total || 0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p style={{ color: colors.yellow, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase" }}>En düşük tutarlar (sıfırdan büyük)</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                {data.bottom5.length === 0 && <p style={{ color: colors.dim, fontSize: "0.75rem" }}>Gösterilecek belge yok.</p>}
                                {data.bottom5.map((inv) => (
                                    <div
                                        key={inv.id}
                                        role={onInvoiceClick ? "button" : undefined}
                                        onClick={() => onInvoiceClick?.(inv)}
                                        onKeyDown={(e) => e.key === "Enter" && onInvoiceClick?.(inv)}
                                        tabIndex={onInvoiceClick ? 0 : undefined}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 8,
                                            padding: "0.5rem 0.65rem",
                                            cursor: onInvoiceClick ? "pointer" : "default",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                                            <span style={{ color: colors.muted, fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.number || inv.id}</span>
                                            <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 700 }}>{fmtCurrency(inv.total || 0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </ACard>

            {/* KDV Analizi */}
            <ACard>
                <SectionHead id="tax" icon={<FaPercentage />} title="KDV & Vergi Analizi" color={colors.purple} />
                {openSections["tax"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                            {[
                                { label: "Toplam KDV", value: fmtCurrency(data.totalTax), color: colors.purple },
                                { label: "Net Tutar (KDV Hariç)", value: fmtCurrency(data.netAmount), color: colors.green },
                                { label: "Efektif KDV Oranı", value: "%" + data.taxRate.toFixed(2), color: colors.orange },
                                { label: "KDV / Brüt Oran", value: "%" + (data.totalAmount > 0 ? (data.totalTax / data.totalAmount * 100).toFixed(2) : "0"), color: colors.pink },
                            ].map((item) => (
                                <div key={item.label} style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.85rem", textAlign: "center" }}>
                                    <p style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 600, margin: "0 0 0.2rem" }}>{item.label}</p>
                                    <p style={{ color: item.color, fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>
        </div>
    );
});

AdvancedAnalysis.displayName = "AdvancedAnalysis";

export default AdvancedAnalysis;
