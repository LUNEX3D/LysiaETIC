import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaChartPie, FaBox, FaPercentage, FaTruck, FaArchive,
    FaChevronDown, FaExclamationTriangle, FaSearch, FaSortAmountDown
} from "react-icons/fa";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const fmt = (v) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0));

const fmtNum = (v) => new Intl.NumberFormat("tr-TR").format(Number(v || 0));

const SOURCE_LABELS = {
    urun_merkezi_maliyet: "Ürün merkezi maliyeti",
    urun_merkezi_ortalama: "Ürün merkezi ort. komisyon",
    urun_merkezi_kargo: "Ürün merkezi kargo",
    pazaryeri_eslesme: "Pazaryeri komisyon %",
    gecmis_siparis: "Geçmiş sipariş ort.",
    gecmis_siparis_kargo: "Geçmiş sipariş kargo",
    varsayilan_pazaryeri: "Varsayılan pazaryeri oranı",
};

const QUALITY_BADGE = {
    complete: { label: "Tam veri", color: "#22c55e" },
    estimated: { label: "Tahmini", color: "#f59e0b" },
    partial: { label: "Eksik alan", color: "#f59e0b" },
    missing_cost: { label: "Maliyet eksik", color: "#ef4444" },
};

const MISSING_FIELD_LABELS = {
    maliyet: "Alış maliyeti",
    komisyon: "Pazaryeri komisyon %",
    kargo: "Kargo maliyeti",
    paketleme: "Paketleme maliyeti",
};

const FinanceProfitPanel = ({ data, loading, C }) => {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("netProfit");
    const [expanded, setExpanded] = useState(null);
    const [zoneFilter, setZoneFilter] = useState("all");

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: C.muted }}>
                <div className="fin-profit-spinner" />
                <p style={{ marginTop: "1rem" }}>Kâr/zarar hesaplanıyor…</p>
            </div>
        );
    }

    if (!data) return null;

    const { summary, products, waterfall, heatmapLegend, topProfit, topLoss, hints } = data;

    if (!products?.length) {
        return (
            <div className="fin-profit-empty">
                <FaExclamationTriangle style={{ fontSize: "2.5rem", color: "#f59e0b", marginBottom: "1rem" }} />
                <p>{hints || "Bu dönemde analiz edilecek sipariş bulunamadı."}</p>
            </div>
        );
    }

    const filtered = products
        .filter((p) => {
            if (zoneFilter !== "all" && p.profitZone !== zoneFilter) return false;
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
                (p.name || "").toLowerCase().includes(q) ||
                (p.barcode || "").toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            if (sortKey === "name") return (a.name || "").localeCompare(b.name || "", "tr");
            if (sortKey === "margin") return (b.profitMargin || 0) - (a.profitMargin || 0);
            if (sortKey === "revenue") return (b.totalRevenue || 0) - (a.totalRevenue || 0);
            return (b.netProfit || 0) - (a.netProfit || 0);
        });

    const waterfallChart = (waterfall || []).map((w) => ({
        name: w.label,
        value: Math.abs(w.value),
        signed: w.value,
        fill:
            w.type === "positive" ? "#22c55e"
                : w.type === "result" ? (w.value >= 0 ? "#8b5cf6" : "#ef4444")
                    : "#f59e0b",
    }));

    const cardBg = "linear-gradient(135deg, rgba(26,31,53,0.6) 0%, rgba(15,20,25,0.6) 100%)";

    return (
        <div className="fin-profit">
            {hints && (
                <div className="fin-profit-hint">
                    <FaExclamationTriangle /> {hints}
                </div>
            )}

            {/* Özet */}
            <div className="fin-profit-kpis">
                {[
                    { label: "Net kâr", value: fmt(summary.netProfit), sub: `%${summary.profitMargin} marj`, color: summary.netProfit >= 0 ? "#22c55e" : "#ef4444" },
                    { label: "Brüt ciro", value: fmt(summary.totalRevenue), sub: `${fmtNum(summary.totalSold)} adet`, color: "#4ecdc4" },
                    { label: "Komisyon", value: fmt(summary.totalCommission), sub: `Ort. %${summary.avgCommissionRate}`, color: "#f59e0b" },
                    { label: "Kargo", value: fmt(summary.totalShipping), sub: "Gönderi maliyeti", color: "#06b6d4" },
                    { label: "Ürün maliyeti", value: fmt(summary.totalProductCost), sub: "Alış / üretim", color: "#94a3b8" },
                    { label: "Paketleme", value: fmt(summary.totalPackaging), sub: "Birim × adet", color: "#a78bfa" },
                ].map((k) => (
                    <div key={k.label} className="fin-profit-kpi" style={{ borderColor: `${k.color}35` }}>
                        <span className="fin-profit-kpi__label">{k.label}</span>
                        <strong style={{ color: k.color }}>{k.value}</strong>
                        <span className="fin-profit-kpi__sub">{k.sub}</span>
                    </div>
                ))}
            </div>

            {/* Kâr haritası — bölge özeti */}
            <div className="fin-profit-section" style={{ background: cardBg }}>
                <h3><FaChartPie /> Kâr / zarar haritası</h3>
                <div className="fin-profit-zones">
                    {(heatmapLegend || []).map((z) => (
                        <button
                            key={z.id}
                            type="button"
                            className={`fin-profit-zone-btn${zoneFilter === z.id ? " fin-profit-zone-btn--active" : ""}`}
                            style={{ borderColor: z.color, background: zoneFilter === z.id ? `${z.color}22` : "transparent" }}
                            onClick={() => setZoneFilter(zoneFilter === z.id ? "all" : z.id)}
                        >
                            <span className="fin-profit-zone-btn__dot" style={{ background: z.color }} />
                            <span>{z.label}</span>
                            <strong style={{ color: z.color }}>{summary.heatmap?.[z.id] || 0}</strong>
                            <span className="fin-profit-zone-btn__hint">ürün</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`fin-profit-zone-btn${zoneFilter === "all" ? " fin-profit-zone-btn--active" : ""}`}
                        onClick={() => setZoneFilter("all")}
                    >
                        Tümü <strong>{summary.productCount}</strong>
                    </button>
                </div>

                <div className="fin-profit-heatmap">
                    {filtered.slice(0, 48).map((p) => (
                        <motion.button
                            key={p.barcode}
                            type="button"
                            className="fin-profit-tile"
                            style={{
                                borderColor: `${p.profitZoneColor}55`,
                                background: `linear-gradient(145deg, ${p.profitZoneColor}18, rgba(15,23,42,0.9))`,
                            }}
                            onClick={() => setExpanded(expanded === p.barcode ? null : p.barcode)}
                            whileHover={{ y: -2 }}
                        >
                            <span className="fin-profit-tile__name" title={p.name}>{p.name}</span>
                            <span className="fin-profit-tile__profit" style={{ color: p.profitZoneColor }}>
                                {fmt(p.netProfit)}
                            </span>
                            <span className="fin-profit-tile__margin">%{p.profitMargin}</span>
                        </motion.button>
                    ))}
                </div>
                {filtered.length > 48 && (
                    <p className="fin-profit-more">+{filtered.length - 48} ürün — arama veya filtre ile daraltın</p>
                )}
            </div>

            <div className="fin-profit-split">
                {/* Gider şelalesi */}
                <div className="fin-profit-section" style={{ background: cardBg }}>
                    <h3>Gider dağılımı</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={waterfallChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(v, _n, props) => [fmt(props.payload.signed), "Tutar"]}
                                contentStyle={{ background: "rgba(10,14,26,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                {waterfallChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top kâr / zarar */}
                <div className="fin-profit-section" style={{ background: cardBg }}>
                    <h3>Öne çıkanlar</h3>
                    <div className="fin-profit-tops">
                        <div>
                            <h4 style={{ color: "#22c55e" }}>En kârlı</h4>
                            {(topProfit || []).map((p) => (
                                <div key={p.barcode} className="fin-profit-top-row">
                                    <span>{p.name}</span>
                                    <strong style={{ color: "#22c55e" }}>{fmt(p.netProfit)}</strong>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h4 style={{ color: "#ef4444" }}>Zararda</h4>
                            {(topLoss || []).length === 0 ? (
                                <p className="fin-profit-top-empty">Zararlı ürün yok 🎉</p>
                            ) : (
                                topLoss.map((p) => (
                                    <div key={p.barcode} className="fin-profit-top-row">
                                        <span>{p.name}</span>
                                        <strong style={{ color: "#ef4444" }}>{fmt(p.netProfit)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detay tablo */}
            <div className="fin-profit-section fin-profit-table-wrap" style={{ background: cardBg }}>
                <div className="fin-profit-table-head">
                    <h3><FaBox /> Ürün bazlı ince hesap</h3>
                    <div className="fin-profit-table-tools">
                        <div className="fin-profit-search">
                            <FaSearch />
                            <input
                                type="search"
                                placeholder="Ürün veya barkod ara…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="fin-profit-select">
                            <option value="netProfit">Net kâra göre</option>
                            <option value="margin">Marja göre</option>
                            <option value="revenue">Ciroya göre</option>
                            <option value="name">İsme göre</option>
                        </select>
                    </div>
                </div>

                <div className="fin-profit-table-scroll">
                    <table className="fin-profit-table">
                        <thead>
                            <tr>
                                <th>Ürün</th>
                                <th>Adet</th>
                                <th>Ciro</th>
                                <th>Maliyet</th>
                                <th>Komisyon</th>
                                <th>Kargo</th>
                                <th>Paket</th>
                                <th>Net kâr</th>
                                <th>Marj</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <React.Fragment key={p.barcode}>
                                    <tr
                                        className={p.netProfit < 0 ? "fin-profit-row--loss" : ""}
                                        onClick={() => setExpanded(expanded === p.barcode ? null : p.barcode)}
                                    >
                                        <td>
                                            <div className="fin-profit-prod">
                                                <span className="fin-profit-prod__name">{p.name}</span>
                                                <span className="fin-profit-prod__bc">{p.barcode}</span>
                                                {QUALITY_BADGE[p.dataQuality] && (
                                                    <span
                                                        className="fin-profit-badge-warn"
                                                        style={{
                                                            background: `${QUALITY_BADGE[p.dataQuality].color}22`,
                                                            color: QUALITY_BADGE[p.dataQuality].color,
                                                        }}
                                                    >
                                                        {QUALITY_BADGE[p.dataQuality].label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{fmtNum(p.totalSold)}</td>
                                        <td>{fmt(p.totalRevenue)}</td>
                                        <td>{fmt(p.totalProductCost)}</td>
                                        <td>{fmt(p.totalCommission)} <small>%{p.commissionRate}</small></td>
                                        <td>{fmt(p.totalShipping)}</td>
                                        <td>{fmt(p.totalPackaging)}</td>
                                        <td style={{ color: p.profitZoneColor, fontWeight: 700 }}>{fmt(p.netProfit)}</td>
                                        <td style={{ color: p.profitZoneColor }}>%{p.profitMargin}</td>
                                        <td><FaChevronDown style={{ transform: expanded === p.barcode ? "rotate(180deg)" : "none" }} /></td>
                                    </tr>
                                    <AnimatePresence>
                                        {expanded === p.barcode && (
                                            <tr className="fin-profit-detail-row">
                                                <td colSpan={10}>
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="fin-profit-detail"
                                                    >
                                                        <div className="fin-profit-detail-grid">
                                                            <div>
                                                                <h5><FaSortAmountDown /> Birim başına (1 adet)</h5>
                                                                <ul>
                                                                    <li>Satış fiyatı: <strong>{fmt(p.unitBreakdown.salePrice)}</strong></li>
                                                                    <li>Ürün maliyeti: <strong>{fmt(p.unitBreakdown.productCost)}</strong></li>
                                                                    <li>Komisyon (%{p.unitBreakdown.commissionRate}): <strong>{fmt(p.unitBreakdown.commission)}</strong></li>
                                                                    <li>Kargo: <strong>{fmt(p.unitBreakdown.shipping)}</strong></li>
                                                                    <li>Paketleme: <strong>{fmt(p.unitBreakdown.packaging)}</strong></li>
                                                                    <li className="fin-profit-detail-total">Net kâr / adet: <strong style={{ color: p.profitZoneColor }}>{fmt(p.unitBreakdown.netProfit)}</strong></li>
                                                                </ul>
                                                            </div>
                                                            <div>
                                                                <h5><FaPercentage /> Toplam giderler</h5>
                                                                <ul>
                                                                    <li>Maliyet: {fmt(p.costBreakdown.productCost)}</li>
                                                                    <li>Komisyon: {fmt(p.costBreakdown.commission)}</li>
                                                                    <li>Kargo: {fmt(p.costBreakdown.shipping)}</li>
                                                                    <li>Paketleme: {fmt(p.costBreakdown.packaging)}</li>
                                                                    <li>Toplam gider: <strong>{fmt(p.costBreakdown.totalExpenses)}</strong></li>
                                                                </ul>
                                                            </div>
                                                            {p.marketplaceCommissions?.length > 0 && (
                                                                <div>
                                                                    <h5><FaTruck /> Pazaryeri komisyonları</h5>
                                                                    <ul>
                                                                        {p.marketplaceCommissions.map((m) => (
                                                                            <li key={m.name}>
                                                                                {m.name}:{" "}
                                                                                {m.configured
                                                                                    ? `%${m.commissionRate}`
                                                                                    : "Tanımlı değil (Ürün Merkezi)"}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h5><FaArchive /> Diğer</h5>
                                                                <ul>
                                                                    <li>Kategori: {p.category}</li>
                                                                    <li>Sipariş: {p.orderCount}</li>
                                                                    <li>İade oranı: %{p.returnRate}</li>
                                                                    <li>Stok: {fmtNum(p.currentStock)}</li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                        {(p.calculationSources?.length > 0 || p.missingFields?.length > 0) && (
                                                            <div className="fin-profit-sources">
                                                                {p.calculationSources?.length > 0 && (
                                                                    <p>
                                                                        <strong>Kullanılan kaynak:</strong>{" "}
                                                                        {p.calculationSources.map((s) => SOURCE_LABELS[s] || s).join(", ")}
                                                                    </p>
                                                                )}
                                                                {p.missingFields?.length > 0 && (
                                                                    <p className="fin-profit-sources--warn">
                                                                        <strong>Tam hesap için eksik:</strong>{" "}
                                                                        {p.missingFields
                                                                            .map((f) => MISSING_FIELD_LABELS[f] || f)
                                                                            .join(", ")}{" "}
                                                                        — Ürün Merkezi → ürün kartı ve pazaryeri eşleştirmeleri.
                                                                    </p>
                                                                )}
                                                                {!p.mappingFound && (
                                                                    <p className="fin-profit-sources--warn">
                                                                        Sipariş barkodu ürün merkezi ile eşleşmedi; maliyet/komisyon otomatik bulunamadı.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="fin-profit-formula">
                                                            Net kâr = Ciro − (Maliyet + Komisyon + Kargo + Paketleme)
                                                        </p>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinanceProfitPanel;
