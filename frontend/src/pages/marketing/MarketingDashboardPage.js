import React, { useCallback, useEffect, useState } from "react";
import {
    Area,
    AreaChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    FaChartLine,
    FaBullhorn,
    FaEnvelope,
    FaSms,
    FaRobot,
    FaPercentage,
    FaPaperPlane,
    FaUsers,
    FaWindowMaximize,
    FaLink,
    FaArrowRight,
    FaMagic,
} from "react-icons/fa";
import { fetchMarketingDashboard } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingPillTabs,
    MarketingStatCard,
    MarketingSection,
    MarketingAlert,
    MarketingSkeletonGrid,
    MarketingButton,
    MarketingBadge,
} from "./components/MarketingUi";

const fmtTry = (v) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(
        Number(v) || 0
    );

const RANGES = [
    { id: "7d", label: "7 Gün" },
    { id: "30d", label: "30 Gün" },
    { id: "90d", label: "90 Gün" },
];

const QUICK_LINKS = [
    { panel: "mkt-campaigns-email", icon: FaEnvelope, label: "E-posta kampanyası", desc: "Şablon + segment", accent: "blue" },
    { panel: "mkt-automations", icon: FaRobot, label: "Otomasyon kur", desc: "Hoş geldin akışı", accent: "purple" },
    { panel: "mkt-segments", icon: FaUsers, label: "Segment oluştur", desc: "VIP müşteriler", accent: "teal" },
    { panel: "mkt-popups", icon: FaWindowMaximize, label: "Popup yayınla", desc: "E-posta topla", accent: "amber" },
];

const CHANNEL_COLORS = {
    EMAIL: "#3b82f6",
    SMS: "#f59e0b",
    AUTOMATION: "#8b5cf6",
    POPUP: "#f43f5e",
    AFFILIATE: "#14b8a6",
};

const MarketingDashboardPage = ({ onNavigate }) => {
    const [range, setRange] = useState("7d");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchMarketingDashboard(range);
            setData(res);
        } catch (e) {
            setError(e.response?.data?.error || "Dashboard yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        load();
    }, [load]);

    const c = data?.cards || {};
    const chartHasValues = (data?.chart || []).some((d) => d.total > 0 || d.marketing > 0);
    const chartMax = Math.max(...(data?.chart || []).map((d) => Math.max(d.total, d.marketing)), 100);

    return (
        <MarketingPageShell
            variant="hero"
            title="Genel bakış"
            subtitle="Satışlarınızın ne kadarının e-posta, SMS ve ortaklık linklerinden geldiğini buradan takip edin."
            icon={FaBullhorn}
            actions={<MarketingPillTabs items={RANGES} value={range} onChange={setRange} />}
        >
            {error && <MarketingAlert type="error">{error}</MarketingAlert>}

            {loading && <MarketingSkeletonGrid count={8} />}

            {!loading && data && (
                <div className="mkt-dashboard">
                    {!data.hasActivity && (
                        <div className="mkt-onboard-banner">
                            <div className="mkt-onboard-banner__icon">
                                <FaMagic />
                            </div>
                            <div className="mkt-onboard-banner__text">
                                <h3>Hoş geldiniz — buradan başlayın</h3>
                                <p>
                                    Önce «Kurulum» menüsünden e-posta ve SMS ayarlarını yapın, ardından ilk kampanyanızı
                                    oluşturun. Satışlar otomatik olarak raporlanır.
                                </p>
                            </div>
                            <MarketingButton variant="primary" onClick={() => onNavigate?.("mkt-campaigns-email")}>
                                İlk kampanyayı oluştur
                            </MarketingButton>
                        </div>
                    )}

                    <div className="mkt-stat-grid mkt-stat-grid--hero">
                        <MarketingStatCard
                            accent="teal"
                            icon={FaChartLine}
                            label="Toplam ciro"
                            value={fmtTry(c.totalRevenue)}
                            hint={`${c.totalOrders ?? 0} sipariş`}
                        />
                        <MarketingStatCard
                            accent="purple"
                            icon={FaBullhorn}
                            label="Pazarlamadan gelen"
                            value={fmtTry(c.marketingRevenue)}
                            hint={`%${c.marketingShare ?? 0} pay · ${c.marketingOrders ?? 0} sipariş`}
                        />
                    </div>

                    <div className="mkt-stat-grid mkt-stat-grid--compact">
                        <MarketingStatCard accent="blue" icon={FaEnvelope} label="E-posta" value={fmtTry(c.emailRevenue)} />
                        <MarketingStatCard accent="amber" icon={FaSms} label="SMS" value={fmtTry(c.smsRevenue)} />
                        <MarketingStatCard accent="purple" icon={FaRobot} label="Otomasyon" value={fmtTry(c.automationRevenue)} />
                        <MarketingStatCard accent="teal" icon={FaPercentage} label="Dönüşüm" value={`${c.conversionRate ?? 0}%`} />
                    </div>

                    <div className="mkt-dashboard__main">
                        <div className="mkt-dashboard__chart-col">
                            <MarketingSection
                                title="Ciro trendi"
                                action={
                                    <span className="mkt-dashboard__meta">
                                        {chartHasValues ? "Günlük kırılım" : "Henüz satış yok — çizgiler sıfırda"}
                                    </span>
                                }
                            >
                                <div className="mkt-panel mkt-chart-panel mkt-chart-panel--filled">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={data.chart || []} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="mktGradTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.25} />
                                                    <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="mktGradMkt" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="var(--ec-accent)" stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor="var(--ec-accent)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 10, fill: "var(--ec-muted)" }}
                                                axisLine={false}
                                                tickLine={false}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: "var(--ec-muted)" }}
                                                axisLine={false}
                                                tickLine={false}
                                                domain={[0, chartMax]}
                                                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: "var(--ec-card)",
                                                    border: "1px solid var(--ec-border)",
                                                    borderRadius: 10,
                                                }}
                                                formatter={(v) => fmtTry(v)}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                            <Area
                                                type="monotone"
                                                dataKey="total"
                                                name="Toplam"
                                                stroke="#64748b"
                                                strokeWidth={2}
                                                fill="url(#mktGradTotal)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="marketing"
                                                name="Pazarlama"
                                                stroke="var(--ec-accent)"
                                                strokeWidth={2.5}
                                                fill="url(#mktGradMkt)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </MarketingSection>

                            <div className="mkt-dashboard__mini-row">
                                <div className="mkt-mini-stat">
                                    <FaPaperPlane />
                                    <div>
                                        <span>Gönderilen e-posta</span>
                                        <strong>{c.emailsSent ?? 0}</strong>
                                    </div>
                                </div>
                                <div className="mkt-mini-stat">
                                    <FaSms />
                                    <div>
                                        <span>Gönderilen SMS</span>
                                        <strong>{c.smsSent ?? 0}</strong>
                                    </div>
                                </div>
                                <div className="mkt-mini-stat">
                                    <FaBullhorn />
                                    <div>
                                        <span>Aktif kampanya</span>
                                        <strong>{c.activeCampaigns ?? 0}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <aside className="mkt-dashboard__side">
                            <MarketingSection title="Kanal dağılımı">
                                <div className="mkt-panel mkt-channel-panel">
                                    {(data.channelBreakdown || []).map((ch) => (
                                        <div key={ch.id} className="mkt-channel-row">
                                            <div className="mkt-channel-row__head">
                                                <span style={{ color: CHANNEL_COLORS[ch.id] }}>{ch.label}</span>
                                                <strong>{fmtTry(ch.revenue)}</strong>
                                            </div>
                                            <div className="mkt-channel-row__track">
                                                <div
                                                    className="mkt-channel-row__fill"
                                                    style={{
                                                        width: `${Math.max(ch.barPct, ch.revenue > 0 ? 8 : 0)}%`,
                                                        background: CHANNEL_COLORS[ch.id],
                                                    }}
                                                />
                                            </div>
                                            <span className="mkt-channel-row__pct">
                                                {c.marketingRevenue > 0 ? `%${ch.pct} pazarlama cirosu` : "—"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </MarketingSection>

                            <MarketingSection title="Modül özeti">
                                <div className="mkt-module-grid">
                                    <button type="button" className="mkt-module-tile" onClick={() => onNavigate?.("mkt-automations")}>
                                        <FaRobot />
                                        <span>{data.modules?.automationsActive ?? 0} aktif otomasyon</span>
                                    </button>
                                    <button type="button" className="mkt-module-tile" onClick={() => onNavigate?.("mkt-segments")}>
                                        <FaUsers />
                                        <span>{data.modules?.segments ?? 0} segment</span>
                                    </button>
                                    <button type="button" className="mkt-module-tile" onClick={() => onNavigate?.("mkt-popups")}>
                                        <FaWindowMaximize />
                                        <span>{data.modules?.popupsActive ?? 0} aktif popup</span>
                                    </button>
                                    <button type="button" className="mkt-module-tile" onClick={() => onNavigate?.("mkt-affiliate")}>
                                        <FaLink />
                                        <span>{data.modules?.affiliatesActive ?? 0} affiliate</span>
                                    </button>
                                </div>
                            </MarketingSection>
                        </aside>
                    </div>

                    <MarketingSection title="Hızlı başlangıç">
                        <div className="mkt-quick-grid">
                            {QUICK_LINKS.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <button
                                        key={link.panel}
                                        type="button"
                                        className={`mkt-quick-card mkt-quick-card--${link.accent}`}
                                        onClick={() => onNavigate?.(link.panel)}
                                    >
                                        <span className="mkt-quick-card__icon">
                                            <Icon />
                                        </span>
                                        <span className="mkt-quick-card__text">
                                            <strong>{link.label}</strong>
                                            <small>{link.desc}</small>
                                        </span>
                                        <FaArrowRight className="mkt-quick-card__arrow" />
                                    </button>
                                );
                            })}
                        </div>
                    </MarketingSection>

                    <MarketingSection
                        title="Son kampanyalar"
                        action={
                            <button type="button" className="mkt-link" onClick={() => onNavigate?.("mkt-campaigns-email")}>
                                Tümünü gör
                            </button>
                        }
                    >
                        <div className="mkt-panel mkt-recent-panel">
                            {(data.recentCampaigns || []).length === 0 ? (
                                <p className="mkt-recent-empty">Henüz kampanya yok. Hızlı başlangıç kartlarından birini kullanın.</p>
                            ) : (
                                <ul className="mkt-recent-list">
                                    {data.recentCampaigns.map((camp) => (
                                        <li key={camp.id} className="mkt-recent-item">
                                            <div className="mkt-recent-item__main">
                                                <strong>{camp.name}</strong>
                                                <span>
                                                    {camp.type === "SMS" ? "SMS" : "E-posta"} · {camp.sent} gönderim
                                                </span>
                                            </div>
                                            <MarketingBadge status={camp.status} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </MarketingSection>
                </div>
            )}
        </MarketingPageShell>
    );
};

export default MarketingDashboardPage;
