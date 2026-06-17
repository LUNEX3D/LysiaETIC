/**
 * PayoutDashboard — Hak Ediş raporu arayüzü
 * Pazaryeri tahsilatı, kesinti dağılımı ve sipariş detayları
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    FaHandHoldingUsd, FaStore, FaSync, FaDownload, FaSearch,
    FaBalanceScale, FaExclamationTriangle, FaCheckCircle, FaUndoAlt,
    FaTruck, FaPercent, FaReceipt, FaBox, FaShieldAlt, FaChartPie,
    FaArrowRight, FaInfoCircle, FaGlobe,
} from "react-icons/fa";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const TOOLTIP_STYLE = {
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "12px",
    color: "#e2e8f0",
    fontSize: "0.82rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

const DEDUCTION_COLORS = {
    commission: "#f59e0b",
    cargo: "#3b82f6",
    packaging: "#8b5cf6",
    platformFee: "#ec4899",
    internationalFee: "#06b6d4",
    stopaj: "#64748b",
};

const MP_COLORS = {
    trendyol: "#f27a1a",
    hepsiburada: "#ff6000",
    n11: "#7b2d8e",
    ciceksepeti: "#e31837",
    amazon: "#ff9900",
    pazarama: "#00a651",
    pttavm: "#005baa",
    diger: "#64748b",
};

const fmtCurrency = (v) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
const fmtNumber = (v) => new Intl.NumberFormat("tr-TR").format(Number(v || 0));
const fmtPercent = (v) => `%${Number(v || 0).toFixed(1)}`;

const sourceLabel = (r) => {
    if (r.commissionSource === "settlement") return "Settlement";
    if (r.commissionSource === "api") return "Resmi API";
    if (r.dataQuality === "actual") return "Gerçek";
    return "Tahmin";
};

const PayoutDashboard = ({
    payout,
    payoutReconcile,
    commissionAnalysis,
    payoutFilter,
    setPayoutFilter,
    payoutMarketplace,
    setPayoutMarketplace,
    onReconcile,
    reconciling,
    onExport,
    loading = false,
}) => {
    const [search, setSearch] = useState("");

    const data = payout || {};
    const s = data.summary || {};
    const rows = data.rows || [];
    const audit = data.audit || {};
    const platforms = data.platformBreakdown || [];
    const voided = data.voided || {};
    const rec = payoutReconcile;
    const commByMp = commissionAnalysis?.byMarketplace || [];
    const mpOptions = data.availableMarketplaces || platforms.map((p) => ({ key: p.key, name: p.name }));

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (payoutFilter === "missing") return (r.missingFields || []).length > 0;
            if (payoutFilter === "estimated") return r.dataQuality === "estimated";
            if (payoutFilter === "actual") return r.dataQuality === "actual";
            return true;
        }).filter((r) => {
            if (!q) return true;
            return (
                String(r.orderNo || "").toLowerCase().includes(q) ||
                String(r.platform || "").toLowerCase().includes(q) ||
                String(r.customerName || "").toLowerCase().includes(q)
            );
        });
    }, [rows, payoutFilter, search]);

    const deductionPie = useMemo(() => {
        const items = [
            { name: "Komisyon", value: s.commission || 0, key: "commission" },
            { name: "Kargo", value: s.cargo || 0, key: "cargo" },
            { name: "Paketleme", value: s.packaging || 0, key: "packaging" },
            { name: "Platform", value: s.platformFee || 0, key: "platformFee" },
            { name: "Uluslararası", value: s.internationalFee || 0, key: "internationalFee" },
            { name: "Stopaj", value: s.stopaj || 0, key: "stopaj" },
        ].filter((i) => i.value > 0);
        return items;
    }, [s]);

    const retentionPct = s.grossSale > 0 ? ((s.netPayout / s.grossSale) * 100) : 0;
    const dataQualityPct = audit.totalOrders > 0
        ? ((audit.actualCount / audit.totalOrders) * 100)
        : 0;

    const recStatusLabel = { ok: "Mutabık", warning: "Küçük Sapma", mismatch: "Uyumsuz" };
    const recStatusClass = { ok: "ok", warning: "warn", mismatch: "bad" };

    const filterTabs = [
        { id: "all", label: "Tümü", count: rows.length },
        { id: "actual", label: "Gerçek", count: rows.filter((r) => r.dataQuality === "actual").length },
        { id: "estimated", label: "Tahmin", count: rows.filter((r) => r.dataQuality === "estimated").length },
        { id: "missing", label: "Eksik", count: rows.filter((r) => (r.missingFields || []).length > 0).length },
    ];

    if (loading && !payout) {
        return (
            <div className="payout-page payout-loading">
                <div className="payout-loading-spinner" />
                <p>Hak ediş verileri yükleniyor…</p>
            </div>
        );
    }

    return (
        <div className="payout-page">
            {/* Üst başlık + pazaryeri seçici */}
            <header className="payout-topbar">
                <div className="payout-topbar-intro">
                    <div className="payout-topbar-icon"><FaHandHoldingUsd /></div>
                    <div>
                        <h2 className="payout-title">Hak Ediş Raporu</h2>
                        <p className="payout-subtitle">Pazaryerlerinden tahsil edeceğiniz net tutar ve kesintiler</p>
                    </div>
                </div>
                <div className="payout-topbar-actions">
                    <button type="button" className="payout-btn payout-btn-ghost" onClick={onExport} disabled={!rows.length}>
                        <FaDownload /> CSV
                    </button>
                    <button type="button" className="payout-btn payout-btn-primary" onClick={onReconcile} disabled={reconciling}>
                        <FaSync className={reconciling ? "spinning" : ""} /> Trendyol Mutabakat
                    </button>
                </div>
            </header>

            {/* Pazaryeri chip'leri */}
            <div className="payout-mp-bar">
                <FaStore className="payout-mp-bar-icon" />
                <button
                    type="button"
                    className={`payout-mp-chip ${payoutMarketplace === "all" ? "active" : ""}`}
                    onClick={() => setPayoutMarketplace("all")}
                >
                    Tümü
                </button>
                {mpOptions.map((mp) => (
                    <button
                        key={mp.key}
                        type="button"
                        className={`payout-mp-chip ${payoutMarketplace === mp.key ? "active" : ""}`}
                        style={{ "--mp-color": MP_COLORS[mp.key] || MP_COLORS.diger }}
                        onClick={() => setPayoutMarketplace(mp.key)}
                    >
                        <span className="payout-mp-dot" />
                        {mp.name}
                    </button>
                ))}
            </div>

            {/* Hero — net hak ediş */}
            <motion.section
                className="payout-hero"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <div className="payout-hero-content">
                    <span className="payout-hero-label">Net Hak Ediş</span>
                    <div className="payout-hero-amount">{fmtCurrency(s.netPayout)}</div>
                    <div className="payout-hero-stats">
                        <div className="payout-hero-stat">
                            <span className="payout-hero-stat-val">{fmtNumber(s.orders)}</span>
                            <span className="payout-hero-stat-lbl">Aktif sipariş</span>
                        </div>
                        <div className="payout-hero-divider" />
                        <div className="payout-hero-stat">
                            <span className="payout-hero-stat-val payout-stat-green">{fmtCurrency(s.deliveredPayout)}</span>
                            <span className="payout-hero-stat-lbl">Teslim edilen</span>
                        </div>
                        <div className="payout-hero-divider" />
                        <div className="payout-hero-stat">
                            <span className="payout-hero-stat-val payout-stat-amber">{fmtCurrency(s.pendingPayout)}</span>
                            <span className="payout-hero-stat-lbl">Bekleyen</span>
                        </div>
                        <div className="payout-hero-divider" />
                        <div className="payout-hero-stat">
                            <span className="payout-hero-stat-val">{fmtPercent(retentionPct)}</span>
                            <span className="payout-hero-stat-lbl">Elde kalma</span>
                        </div>
                    </div>
                </div>

                {/* Brüt → Kesinti → Net akışı */}
                <div className="payout-flow">
                    <div className="payout-flow-step">
                        <span>Brüt Satış</span>
                        <strong>{fmtCurrency(s.grossSale)}</strong>
                    </div>
                    <FaArrowRight className="payout-flow-arrow" />
                    <div className="payout-flow-step payout-flow-deduct">
                        <span>Toplam Kesinti</span>
                        <strong className="payout-stat-red">{fmtCurrency(s.totalDeductions)}</strong>
                    </div>
                    <FaArrowRight className="payout-flow-arrow" />
                    <div className="payout-flow-step payout-flow-net">
                        <span>Net Hak Ediş</span>
                        <strong className="payout-stat-green">{fmtCurrency(s.netPayout)}</strong>
                    </div>
                </div>
            </motion.section>

            {/* Kesinti metrik kartları */}
            <div className="payout-metrics">
                {[
                    { icon: FaPercent, label: "Komisyon", value: s.commission, sub: `Ort. ${fmtPercent(s.commissionRate)}`, color: "amber" },
                    { icon: FaTruck, label: "Kargo", value: s.cargo, color: "blue" },
                    { icon: FaBox, label: "Paketleme", value: s.packaging, color: "purple" },
                    { icon: FaReceipt, label: "Platform Bedeli", value: s.platformFee, color: "pink" },
                    { icon: FaGlobe, label: "Uluslararası Bedel", value: s.internationalFee, color: "cyan" },
                    { icon: FaShieldAlt, label: "Stopaj", value: s.stopaj, sub: (audit.apiStopajCount || 0) > 0 ? "Resmi API" : "Tahmini %1", color: "slate" },
                    { icon: FaHandHoldingUsd, label: "Brüt Satış", value: s.grossSale, color: "teal" },
                ].map((m, i) => (
                    <motion.div
                        key={m.label}
                        className={`payout-metric-card payout-metric-${m.color}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                    >
                        <div className="payout-metric-icon"><m.icon /></div>
                        <div className="payout-metric-body">
                            <span className="payout-metric-label">{m.label}</span>
                            <span className="payout-metric-value">{fmtCurrency(m.value)}</span>
                            {m.sub && <span className="payout-metric-sub">{m.sub}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Ana grid: grafik + platform + doğrulama */}
            <div className="payout-main-grid">
                {/* Sol: grafikler + platform */}
                <div className="payout-col-left">
                    {deductionPie.length > 0 && (
                        <div className="payout-panel">
                            <div className="payout-panel-head">
                                <FaChartPie /><h3>Kesinti Dağılımı</h3>
                            </div>
                            <div className="payout-panel-body payout-chart-split">
                                <div className="payout-donut-wrap">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={deductionPie}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={85}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {deductionPie.map((entry) => (
                                                    <Cell key={entry.key} fill={DEDUCTION_COLORS[entry.key]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={TOOLTIP_STYLE}
                                                formatter={(v) => [fmtCurrency(v), ""]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="payout-donut-center">
                                        <span>Toplam</span>
                                        <strong>{fmtCurrency(s.totalDeductions)}</strong>
                                    </div>
                                </div>
                                <ul className="payout-legend">
                                    {deductionPie.map((d) => (
                                        <li key={d.key}>
                                            <span className="payout-legend-dot" style={{ background: DEDUCTION_COLORS[d.key] }} />
                                            <span className="payout-legend-name">{d.name}</span>
                                            <span className="payout-legend-val">{fmtCurrency(d.value)}</span>
                                            <span className="payout-legend-pct">
                                                {s.totalDeductions > 0 ? fmtPercent((d.value / s.totalDeductions) * 100) : "—"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {commByMp.length > 0 && (
                        <div className="payout-panel">
                            <div className="payout-panel-head">
                                <FaStore /><h3>Pazaryeri Kesintileri</h3>
                            </div>
                            <div className="payout-panel-body">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={commByMp} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                        <YAxis stroke="#94a3b8" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)} />
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmtCurrency(v), n]} />
                                        <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                                        <Bar dataKey="commission" fill="#f59e0b" name="Komisyon" stackId="a" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="shipping" fill="#3b82f6" name="Kargo" stackId="a" />
                                        <Bar dataKey="packaging" fill="#8b5cf6" name="Paketleme" stackId="a" />
                                        <Bar dataKey="otherCost" fill="#ef4444" name="Diğer" stackId="a" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {platforms.length > 0 && (
                        <div className="payout-panel">
                            <div className="payout-panel-head">
                                <FaStore /><h3>Platform Özeti</h3>
                            </div>
                            <div className="payout-platform-grid">
                                {platforms.map((p) => {
                                    const mpColor = MP_COLORS[p.key] || MP_COLORS.diger;
                                    const share = s.netPayout > 0 ? (p.netPayout / s.netPayout) * 100 : 0;
                                    return (
                                        <div key={p.key} className="payout-platform-card" style={{ "--mp-color": mpColor }}>
                                            <div className="payout-platform-card-head">
                                                <span className="payout-platform-name">{p.name}</span>
                                                <span className="payout-platform-share">{fmtPercent(share)}</span>
                                            </div>
                                            <div className="payout-platform-net">{fmtCurrency(p.netPayout)}</div>
                                            <div className="payout-platform-bar">
                                                <div className="payout-platform-bar-fill" style={{ width: `${Math.min(share, 100)}%` }} />
                                            </div>
                                            <div className="payout-platform-meta">
                                                <span>{fmtNumber(p.orders)} sipariş</span>
                                                <span>Kom. {fmtCurrency(p.commission)}</span>
                                            </div>
                                            <div className="payout-platform-badges">
                                                {p.actualCount > 0 && (
                                                    <span className="payout-badge payout-badge-ok">{p.actualCount} gerçek</span>
                                                )}
                                                {p.estimatedCount > 0 && (
                                                    <span className="payout-badge payout-badge-warn">{p.estimatedCount} tahmin</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sağ: veri kalitesi + mutabakat */}
                <div className="payout-col-right">
                    <div className="payout-panel payout-panel-quality">
                        <div className="payout-panel-head">
                            <FaBalanceScale /><h3>Veri Kalitesi</h3>
                        </div>
                        <div className="payout-panel-body">
                            <div className="payout-quality-ring-wrap">
                                <svg className="payout-quality-ring" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
                                    <circle
                                        cx="60" cy="60" r="52" fill="none"
                                        stroke="url(#payoutGrad)" strokeWidth="10"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(dataQualityPct / 100) * 327} 327`}
                                        transform="rotate(-90 60 60)"
                                    />
                                    <defs>
                                        <linearGradient id="payoutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#4ecdc4" />
                                            <stop offset="100%" stopColor="#3b82f6" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="payout-quality-ring-label">
                                    <strong>{fmtPercent(dataQualityPct)}</strong>
                                    <span>Gerçek veri</span>
                                </div>
                            </div>

                            <div className="payout-quality-grid">
                                {[
                                    { label: "Gerçek", val: audit.actualCount, cls: "ok" },
                                    { label: "Settlement", val: audit.settlementCount || 0, cls: "ok" },
                                    { label: "Resmi API", val: audit.apiEnrichedCount || 0, cls: "ok" },
                                    { label: "API Kargo", val: audit.apiCargoCount || 0, cls: "ok" },
                                    { label: "API Platform", val: audit.apiPlatformFeeCount || 0, cls: "ok" },
                                    { label: "API Stopaj", val: audit.apiStopajCount || 0, cls: "ok" },
                                    { label: "Tahmini", val: audit.estimatedCount, cls: "warn" },
                                    { label: "Eksik kargo", val: audit.missingCargoCount || 0, cls: "bad" },
                                    { label: "Eksik komisyon", val: audit.missingCommissionCount || 0, cls: "bad" },
                                    { label: "İptal / İade", val: (audit.cancelledCount || 0) + (audit.returnedCount || 0), cls: "neutral" },
                                ].map((item) => (
                                    <div key={item.label} className={`payout-q-item payout-q-${item.cls}`}>
                                        <span className="payout-q-val">{fmtNumber(item.val)}</span>
                                        <span className="payout-q-lbl">{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            {audit.financeApiLoaded && (
                                <div className="payout-api-load">
                                    <FaInfoCircle />
                                    <span>
                                        API: TY {fmtNumber(audit.financeApiLoaded.trendyol || 0)} ·
                                        HB {fmtNumber(audit.financeApiLoaded.hepsiburada || 0)} ·
                                        N11 {fmtNumber(audit.financeApiLoaded.n11 || 0)} ·
                                        CS {fmtNumber(audit.financeApiLoaded.ciceksepeti || 0)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!audit.settlementEnriched && (
                        <div className="payout-alert payout-alert-warn">
                            <FaExclamationTriangle />
                            <p>Resmi finans API verisi yüklenemedi. Komisyon ve kargo tahmin ediliyor olabilir.</p>
                        </div>
                    )}

                    {(audit.missingCargoCount > 0 || audit.missingCommissionCount > 0) && (
                        <div className="payout-alert payout-alert-warn">
                            <FaExclamationTriangle />
                            <p>
                                {audit.missingCargoCount > 0 && `${fmtNumber(audit.missingCargoCount)} siparişte kargo eksik. `}
                                {audit.missingCommissionCount > 0 && `${fmtNumber(audit.missingCommissionCount)} siparişte komisyon tahmini/eksik.`}
                            </p>
                        </div>
                    )}

                    {rec?.available && (
                        <div className="payout-panel payout-reconcile">
                            <div className="payout-panel-head">
                                <FaCheckCircle /><h3>Trendyol Mutabakat</h3>
                                <span className={`payout-rec-badge payout-rec-${recStatusClass[rec.status] || "warn"}`}>
                                    {recStatusLabel[rec.status] || rec.status}
                                </span>
                            </div>
                            <div className="payout-rec-grid">
                                <div><span>Gerçek komisyon</span><strong>{fmtCurrency(rec.actualCommission)}</strong></div>
                                <div><span>Hesaplanan</span><strong>{fmtCurrency(rec.computedCommission)}</strong></div>
                                <div><span>Fark</span><strong className={Math.abs(rec.delta) > 0 ? "payout-stat-red" : "payout-stat-green"}>{fmtCurrency(rec.delta)}</strong></div>
                                <div><span>Fark oranı</span><strong>{fmtPercent(rec.deltaPct)}</strong></div>
                            </div>
                        </div>
                    )}

                    {rec && !rec.available && rec.reason && (
                        <div className="payout-alert payout-alert-info">
                            <FaInfoCircle /><p>Mutabakat: {rec.reason}</p>
                        </div>
                    )}

                    {voided.count > 0 && (
                        <div className="payout-alert payout-alert-neutral">
                            <FaUndoAlt />
                            <p>{fmtNumber(voided.count)} iptal/iade — {fmtCurrency(voided.netPayout)} hak edişten düşülür</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sipariş tablosu */}
            <section className="payout-orders-section">
                <div className="payout-orders-head">
                    <div>
                        <h3>Sipariş Detayları</h3>
                        <p>{fmtNumber(filteredRows.length)} kayıt · {search ? `"${search}" araması` : "Tüm siparişler"}</p>
                    </div>
                    <div className="payout-orders-tools">
                        <div className="payout-search">
                            <FaSearch />
                            <input
                                type="search"
                                placeholder="Sipariş no, platform veya müşteri ara…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="payout-segmented">
                            {filterTabs.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={payoutFilter === f.id ? "active" : ""}
                                    onClick={() => setPayoutFilter(f.id)}
                                >
                                    {f.label}
                                    <span className="payout-seg-count">{f.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {filteredRows.length > 0 ? (
                    <div className="payout-table-wrap">
                        <table className="payout-table">
                            <thead>
                                <tr>
                                    <th>Sipariş</th>
                                    <th>Platform</th>
                                    <th>Tarih</th>
                                    <th className="payout-th-num">Brüt</th>
                                    <th className="payout-th-num">Komisyon</th>
                                    <th className="payout-th-num">Kargo</th>
                                    <th className="payout-th-num">Diğer</th>
                                    <th className="payout-th-num">Net Hak Ediş</th>
                                    <th>Kaynak</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.slice(0, 500).map((r, idx) => {
                                    const other = (r.packaging || 0) + (r.platformFee || 0) + (r.internationalFee || 0) + (r.stopaj || 0);
                                    const isVoid = r.isCancelled || r.isReturned;
                                    return (
                                        <tr key={r.orderId || idx} className={isVoid ? "payout-row-void" : ""}>
                                            <td className="payout-td-order">
                                                <span className="payout-order-no">{r.orderNo}</span>
                                                {r.firstProduct && (
                                                    <span className="payout-order-product">{r.firstProduct}</span>
                                                )}
                                                {r.isCancelled && <span className="payout-tag payout-tag-cancel">İptal</span>}
                                                {r.isReturned && <span className="payout-tag payout-tag-return">İade</span>}
                                            </td>
                                            <td>
                                                <span
                                                    className="payout-platform-pill"
                                                    style={{ "--mp-color": MP_COLORS[r.platformKey] || MP_COLORS.diger }}
                                                >
                                                    {r.platform}
                                                </span>
                                            </td>
                                            <td className="payout-td-date">
                                                {r.date ? new Date(r.date).toLocaleDateString("tr-TR") : "—"}
                                            </td>
                                            <td className="payout-td-num payout-stat-green">{fmtCurrency(r.grossSale)}</td>
                                            <td className="payout-td-num payout-stat-amber">
                                                {fmtCurrency(r.commission)}
                                                {r.commissionRate > 0 && (
                                                    <span className="payout-rate">{fmtPercent(r.commissionRate)}</span>
                                                )}
                                            </td>
                                            <td className="payout-td-num">{fmtCurrency(r.cargo)}</td>
                                            <td className="payout-td-num payout-td-other">
                                                {fmtCurrency(other)}
                                                {r.stopajEstimated && <span className="payout-est">~</span>}
                                            </td>
                                            <td className={`payout-td-num payout-td-net ${r.netPayout >= 0 ? "payout-stat-green" : "payout-stat-red"}`}>
                                                <strong>{fmtCurrency(r.netPayout)}</strong>
                                            </td>
                                            <td className="payout-td-source">
                                                <span className={`payout-src payout-src-${r.dataQuality}`}>
                                                    {sourceLabel(r)}
                                                </span>
                                                {(r.missingFields || []).slice(0, 2).map((mf, i) => (
                                                    <span key={i} className="payout-src payout-src-missing">
                                                        {mf.startsWith("tahmini") ? mf : `${mf} yok`}
                                                    </span>
                                                ))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredRows.length > 500 && (
                            <p className="payout-table-foot">İlk 500 satır gösteriliyor. Tümü için CSV indirin.</p>
                        )}
                    </div>
                ) : (
                    <div className="payout-empty">
                        <FaHandHoldingUsd />
                        <h4>Veri bulunamadı</h4>
                        <p>Seçili dönem veya filtreye uygun hak ediş kaydı yok.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default PayoutDashboard;
