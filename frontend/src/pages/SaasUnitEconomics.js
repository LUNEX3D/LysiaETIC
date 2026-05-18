import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaCoins,
    FaSync,
    FaSearch,
    FaExclamationTriangle,
    FaChartPie,
    FaArrowDown,
    FaArrowUp,
    FaCog,
    FaUser,
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getUnitEconomics, updateUnitEconomicsRates } from "../services/saasAdminApi";

const DRIVER_COLORS = {
    aws: "#ff9900",
    mongodb: "#00ed64",
    syncCron: "var(--ap-cyan)",
    dataOps: "var(--ap-blue)",
    ai: "var(--ap-yellow)",
    support: "var(--ap-red)",
};

const fmt = (n) => `₺${(n ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

const planBadge = (plan) => {
    const colors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green", free: "yellow" };
    return colors[plan] || "blue";
};

const SaasUnitEconomics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("cost");
    const [showRates, setShowRates] = useState(false);
    const [rateDraft, setRateDraft] = useState(null);
    const [savingRates, setSavingRates] = useState(false);

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError("");
        try {
            const res = await getUnitEconomics(refresh);
            const payload = res.data?.data ?? res.data;
            setData(payload);
            if (payload?.rates) setRateDraft({ ...payload.rates });
        } catch (err) {
            console.error(err);
            setError("Maliyet verileri alınamadı.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(false);
    }, [load]);

    const users = useMemo(() => {
        const list = data?.users || [];
        const q = search.trim().toLowerCase();
        let filtered = q
            ? list.filter(
                  (u) =>
                      u.name?.toLowerCase().includes(q) ||
                      u.email?.toLowerCase().includes(q)
              )
            : list;
        filtered = [...filtered];
        if (sortBy === "cost") filtered.sort((a, b) => b.estimatedCost - a.estimatedCost);
        else if (sortBy === "margin") filtered.sort((a, b) => a.margin - b.margin);
        else if (sortBy === "sync") filtered.sort((a, b) => (b.metrics?.syncLogs30d || 0) - (a.metrics?.syncLogs30d || 0));
        else if (sortBy === "ai") filtered.sort((a, b) => (b.breakdown?.ai || 0) - (a.breakdown?.ai || 0));
        return filtered;
    }, [data, search, sortBy]);

    const handleSaveRates = async () => {
        if (!rateDraft) return;
        setSavingRates(true);
        try {
            const res = await updateUnitEconomicsRates(rateDraft);
            const payload = res.data?.data ?? res.data;
            setData(payload);
            setShowRates(false);
        } catch (e) {
            setError("Oranlar kaydedilemedi.");
        } finally {
            setSavingRates(false);
        }
    };

    const summary = data?.summary;
    const drivers = data?.costDrivers || [];

    return (
        <AdminLayout
            title="Birim Ekonomisi"
            subtitle="Kullanıcı başı tahmini maliyet — canlı kullanım metriklerine göre (son 30 gün)"
            actions={
                <button type="button" className="ap-btn ap-btn--ghost" onClick={() => load(true)} disabled={loading}>
                    <FaSync className={loading ? "ap-spin" : ""} /> Yenile
                </button>
            }
        >
            {error && (
                <div className="ap-alert ap-alert--error">
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            <div className="ap-alert" style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.25)", fontSize: 12 }}>
                Tahminler <strong>gerçek fatura değil</strong>. Sabit bulut:{" "}
                <strong style={{ color: "#ff9900" }}>AWS {fmt(data?.cloudCosts?.awsMonthlyTry)}</strong>
                {" + "}
                <strong style={{ color: "#00a35c" }}>MongoDB {fmt(data?.cloudCosts?.mongodbMonthlyTry)}</strong>
                {(data?.cloudCosts?.mongodbVariableMonthlyTry || 0) > 0 && (
                    <> + değişken MongoDB <strong>{fmt(data.cloudCosts.mongodbVariableMonthlyTry)}</strong></>
                )}
                {" "}/ ay (aktif kullanıcıya bölünür). LLM:{" "}
                <strong>{data?.llmMode === "openai" ? "OpenAI (ücretli)" : "Ollama / kural"}</strong>.
                {data?.generatedAt && (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                        Güncelleme: {new Date(data.generatedAt).toLocaleString("tr-TR")}
                    </span>
                )}
            </div>

            {data?.cloudCosts && summary && (
                <div className="ap-kpi-grid" style={{ marginBottom: 12 }}>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon" style={{ background: "rgba(255,153,0,0.15)", color: "#ff9900", fontSize: 11, fontWeight: 800 }}>AWS</div>
                        <div className="ap-kpi-label">AWS aylık (sabit)</div>
                        <div className="ap-kpi-val">{fmt(data.cloudCosts.awsMonthlyTry)}</div>
                        <div className="ap-kpi-sub">Tahsis: {fmt(summary.totalAwsAllocated)}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon" style={{ background: "rgba(0,237,100,0.12)", color: "#00a35c", fontSize: 11, fontWeight: 800 }}>MDB</div>
                        <div className="ap-kpi-label">MongoDB (Atlas)</div>
                        <div className="ap-kpi-val">
                            {fmt((data.cloudCosts.mongodbMonthlyTry || 0) + (data.cloudCosts.mongodbVariableMonthlyTry || 0))}
                        </div>
                        <div className="ap-kpi-sub">
                            Sabit {fmt(data.cloudCosts.mongodbMonthlyTry)} + veri {fmt(data.cloudCosts.mongodbVariableMonthlyTry)}
                        </div>
                    </div>
                </div>
            )}

            {summary && (
                <div className="ap-kpi-grid">
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--red"><FaCoins /></div>
                        <div className="ap-kpi-label">Toplam tahmini maliyet</div>
                        <div className="ap-kpi-val">{fmt(summary.totalEstimatedCost)}</div>
                        <div className="ap-kpi-sub">/ ay (tüm firmalar)</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--green"><FaChartPie /></div>
                        <div className="ap-kpi-label">Tahmini gelir (MRR)</div>
                        <div className="ap-kpi-val">{fmt(summary.totalRevenue)}</div>
                        <div className="ap-kpi-sub">Brüt marj: {fmt(summary.totalMargin)}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--purple"><FaUser /></div>
                        <div className="ap-kpi-label">Ort. maliyet / kullanıcı</div>
                        <div className="ap-kpi-val">{fmt(summary.avgCostPerUser)}</div>
                        <div className="ap-kpi-sub">Aktif: {fmt(summary.avgCostActiveUser)} ({summary.activeUsers} aktif)</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaArrowUp /></div>
                        <div className="ap-kpi-label">En yüksek maliyet kalemi</div>
                        <div className="ap-kpi-val" style={{ fontSize: 16 }}>{summary.topCostDriver?.label || "—"}</div>
                        <div className="ap-kpi-sub">%{summary.topCostDriver?.pct || 0} pay</div>
                    </div>
                </div>
            )}

            {drivers.length > 0 && (
                <div className="ap-card" style={{ marginBottom: 16 }}>
                    <div className="ap-card-head">Maliyet dağılımı — nerede en çok harcıyoruz?</div>
                    <div style={{ padding: "12px 16px 16px" }}>
                        {drivers.map((d) => (
                            <div key={d.key} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                    <span>{d.label}</span>
                                    <span style={{ fontWeight: 700 }}>{fmt(d.totalTry)} <span style={{ opacity: 0.6 }}>(%{d.pct})</span></span>
                                </div>
                                <div className="ap-chart-bar-track" style={{ height: 10, borderRadius: 4 }}>
                                    <div
                                        style={{
                                            width: `${Math.max(d.pct, 2)}%`,
                                            height: "100%",
                                            borderRadius: 4,
                                            background: DRIVER_COLORS[d.key] || "var(--ap-accent)",
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="ap-card" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    className="ap-btn ap-btn--ghost"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    onClick={() => {
                        setShowRates((v) => !v);
                        if (!rateDraft && data?.rates) setRateDraft({ ...data.rates });
                    }}
                >
                    <FaCog /> Maliyet oranlarını düzenle {showRates ? "▲" : "▼"}
                </button>
                {showRates && rateDraft && (
                    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {[
                            ["monthlyAwsCostTry", "AWS aylık sabit (₺)"],
                            ["monthlyMongodbCostTry", "MongoDB Atlas aylık (₺)"],
                            ["per1kMongodbUnitsTry", "1.000 MongoDB birim (₺)"],
                            ["perMarketplaceCronTry", "Pazaryeri / ay (₺)"],
                            ["per1kSyncLogsTry", "1.000 sync log (₺)"],
                            ["per1kOrders30dTry", "1.000 sipariş (₺)"],
                            ["per1kProductsTry", "1.000 ürün (₺)"],
                            ["perAiUserMessageTry", "AI mesaj (₺)"],
                            ["perAiActionTry", "AI aksiyon (₺)"],
                            ["perOpenTicketTry", "Açık ticket (₺)"],
                            ["paymentFeeRate", "Ödeme komisyonu (0-1)"],
                        ].map(([key, label]) => (
                            <label key={key} style={{ fontSize: 11 }}>
                                <span style={{ display: "block", marginBottom: 4, color: "var(--ap-text-dim)" }}>{label}</span>
                                <input
                                    className="ap-input"
                                    type="number"
                                    step="any"
                                    value={rateDraft[key] ?? ""}
                                    onChange={(e) =>
                                        setRateDraft((r) => ({
                                            ...r,
                                            [key]: e.target.value === "" ? "" : Number(e.target.value),
                                        }))
                                    }
                                />
                            </label>
                        ))}
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                            <button type="button" className="ap-btn ap-btn--primary" disabled={savingRates} onClick={handleSaveRates}>
                                Kaydet ve yeniden hesapla
                            </button>
                            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setRateDraft({ ...data.rates })}>
                                Sıfırla
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Firma veya e-posta ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="cost">En yüksek maliyet</option>
                        <option value="margin">En düşük marj</option>
                        <option value="sync">En çok sync log</option>
                        <option value="ai">En çok AI maliyeti</option>
                    </select>
                    <span className="ap-toolbar-count">{users.length} firma</span>
                </div>
            </div>

            {loading && !data && <div className="ap-loading">Hesaplanıyor...</div>}

            {!loading && users.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Plan</th>
                                    <th>Tahmini maliyet</th>
                                    <th style={{ color: "#ff9900" }}>AWS</th>
                                    <th style={{ color: "#00a35c" }}>MongoDB</th>
                                    <th>Gelir</th>
                                    <th>Marj</th>
                                    <th>En yüksek kalem</th>
                                    <th>MP</th>
                                    <th>Sync (30g)</th>
                                    <th>AI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const neg = u.margin < 0;
                                    const top = u.topCostDriver;
                                    return (
                                        <tr key={u.userId}>
                                            <td>
                                                <Link to="/admin/tenants" style={{ fontWeight: 600, color: "var(--ap-text)" }}>
                                                    {u.name}
                                                </Link>
                                                <div style={{ fontSize: 10, color: "var(--ap-text-dim)" }}>{u.email}</div>
                                            </td>
                                            <td>
                                                <span className={`ap-badge ap-badge--${planBadge(u.plan)}`}>{u.plan}</span>
                                                {!u.isActive && (
                                                    <span className="ap-badge ap-badge--yellow" style={{ marginLeft: 4 }}>pasif</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 700, color: "var(--ap-red)" }}>{fmt(u.estimatedCost)}</td>
                                            <td style={{ color: "#ff9900" }}>{fmt(u.breakdown?.aws)}</td>
                                            <td style={{ color: "#00a35c" }} title={`Sabit ${fmt(u.breakdown?.mongodbFixed)} + veri ${fmt(u.breakdown?.mongodbVariable)}`}>
                                                {fmt(u.breakdown?.mongodb)}
                                            </td>
                                            <td>{fmt(u.revenue)}</td>
                                            <td style={{ color: neg ? "var(--ap-red)" : "var(--ap-green)", fontWeight: 600 }}>
                                                {neg ? <FaArrowDown style={{ fontSize: 9 }} /> : <FaArrowUp style={{ fontSize: 9 }} />}{" "}
                                                {fmt(u.margin)}
                                                {u.marginPct != null && (
                                                    <span style={{ fontSize: 10, opacity: 0.7 }}> (%{u.marginPct})</span>
                                                )}
                                            </td>
                                            <td>
                                                {top && (
                                                    <span className="ap-badge" style={{ background: `${DRIVER_COLORS[top.key]}22`, color: DRIVER_COLORS[top.key] }}>
                                                        {drivers.find((d) => d.key === top.key)?.label?.split(" ")[0] || top.key}: {fmt(top.amount)}
                                                    </span>
                                                )}
                                            </td>
                                            <td>{u.metrics?.marketplaces ?? 0}</td>
                                            <td>{(u.metrics?.syncLogs30d ?? 0).toLocaleString("tr-TR")}</td>
                                            <td>{fmt(u.breakdown?.ai)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasUnitEconomics;

