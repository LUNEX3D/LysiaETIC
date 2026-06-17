/**
 * E-Ticaret → Giriş (ikas özet paneli, gerçek mağaza verisi)
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaCalendarAlt,
    FaExchangeAlt,
    FaGlobe,
    FaUser,
    FaIdCard,
    FaBox,
    FaArrowRight,
} from "react-icons/fa";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { fetchStoreDashboard } from "../../services/storeApi";
import EcFilterDropdown from "../../components/ecommerce/EcFilterDropdown";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import "../../styles/ecommerceHome.css";
import EcommerceSetupChecklist from "../../components/ecommerce/platform/EcommerceSetupChecklist";
import { getActiveEcSite } from "../../utils/ecStoreContext";

const DATE_PRESETS = [
    { value: "today", label: "Bugün" },
    { value: "yesterday", label: "Dün" },
    { value: "this_week", label: "Bu Hafta" },
    { value: "last_week", label: "Geçen Hafta" },
    { value: "this_month", label: "Bu Ay" },
    { value: "last_month", label: "Geçen Ay" },
    { value: "last_7_days", label: "Son 7 Gün" },
    { value: "last_30_days", label: "Son 30 Gün" },
    { value: "last_3_months", label: "Son 3 Ay" },
    { value: "last_6_months", label: "Son 6 Ay" },
    { value: "this_year", label: "Bu Yıl" },
    { value: "custom", label: "Özel Tarih", keepOpen: true },
];

const CURRENCY_OPTIONS = [
    {
        value: "store",
        label: "Mağaza Para Birimi (₺)",
        triggerLabel: "Mağaza Para Birimi (₺)",
        description: "Tüm siparişlerin, TRY mağaza para birimine çevrilmiş hali",
    },
    { value: "eur", label: "EUR (€) Satışlarım", triggerLabel: "EUR (€) Satışlarım" },
    { value: "try", label: "TRY (₺) Satışlarım", triggerLabel: "TRY (₺) Satışlarım" },
];

const fmtTry = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 2,
        }).format(Number(v || 0));
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
};

const fmtPct = (v) => {
    const n = Number(v) || 0;
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
};

const ChangeBadge = ({ pct, show }) => {
    if (!show) return null;
    const n = Number(pct) || 0;
    const cls =
        n > 0 ? "ec-home__kpi-change--up" : n < 0 ? "ec-home__kpi-change--down" : "ec-home__kpi-change--flat";
    return <span className={`ec-home__kpi-change ${cls}`}>{fmtPct(n)}</span>;
};

const EcommerceHomePage = ({ onNavigate }) => {
    const { C } = useDashtockTheme();
    const [preset, setPreset] = useState("last_30_days");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [channel, setChannel] = useState("all");
    const [currencyMode, setCurrencyMode] = useState("store");
    const [compare, setCompare] = useState(true);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = {
                preset,
                channel,
                currencyMode,
                compare: compare ? "1" : "0",
            };
            if (preset === "custom" && customStart && customEnd) {
                params.startDate = customStart;
                params.endDate = customEnd;
            }
            const res = await fetchStoreDashboard(params);
            if (!res.hasStore) {
                setData(null);
                setError("Önce mağazanızı oluşturun (Satış Kanalları).");
                return;
            }
            setData(res);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [preset, customStart, customEnd, channel, currencyMode, compare]);

    useEffect(() => {
        if (preset === "custom" && (!customStart || !customEnd)) return;
        load();
    }, [load, preset, customStart, customEnd]);

    const channelOptions = useMemo(() => {
        const domain = data?.store?.domain || "Mağaza";
        return [
            { value: "all", label: "Tüm Satış Kanalları", triggerLabel: "Tüm Satış Kanalları" },
            {
                value: "website",
                label: domain,
                triggerLabel: domain,
                icon: <FaGlobe />,
            },
            {
                value: "manual",
                label: "Manuel Sipariş",
                triggerLabel: "Manuel Sipariş",
                icon: <FaUser />,
            },
        ];
    }, [data?.store?.domain]);

    const dateOptions = useMemo(
        () =>
            DATE_PRESETS.map((p) => ({
                ...p,
                triggerLabel: p.label,
            })),
        []
    );

    const chartMax = useMemo(() => {
        if (!data?.chart?.length) return 4;
        const max = Math.max(...data.chart.map((p) => p.sales), 0);
        return max <= 0 ? 4 : Math.ceil(max * 1.2);
    }, [data]);

    const customDateFooter = preset === "custom" && (
        <div className="ec-filter-dd__custom" onClick={(e) => e.stopPropagation()}>
            <label>
                Başlangıç
                <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                />
            </label>
            <label>
                Bitiş
                <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                />
            </label>
            <button
                type="button"
                className="ec-home__btn-primary ec-filter-dd__apply"
                disabled={!customStart || !customEnd}
                onClick={() => load()}
            >
                Uygula
            </button>
        </div>
    );

    const homeShell = (children, extraClass = "") => (
        <div className={`ec-home ec-home--ikas ec-home--full${extraClass}`}>{children}</div>
    );

    if (loading && !data) {
        return homeShell(<div className="ec-home__loading">Özet yükleniyor…</div>);
    }

    if (error && !data) {
        return homeShell(
            <div className="ec-home__card">
                <p>{error}</p>
                {onNavigate && (
                    <button
                        type="button"
                        className="ec-home__btn-primary"
                        onClick={() => onNavigate("ec-wb-my-themes")}
                    >
                        Mağaza Merkezine git
                    </button>
                )}
            </div>
        );
    }

    if (!data) return null;

    const { kpis, chart, channels, topSellers, growth, account, visitors, operations } = data;
    const showCompare = compare && data.filters?.compare !== false;

    const activeSiteId = getActiveEcSite()?.id;

    return homeShell(
            <>
                {onNavigate && activeSiteId && (
                    <EcommerceSetupChecklist siteId={activeSiteId} onNavigate={onNavigate} />
                )}

                <div className="ec-home__filters">
                    <EcFilterDropdown
                        label="Tüm Satış Kanalları"
                        options={channelOptions}
                        value={channel}
                        onChange={setChannel}
                    />
                    <EcFilterDropdown
                        label="Mağaza Para Birimi (₺)"
                        options={CURRENCY_OPTIONS}
                        value={currencyMode}
                        onChange={setCurrencyMode}
                        wide
                    />
                    <EcFilterDropdown
                        label="Son 30 Gün"
                        icon={FaCalendarAlt}
                        options={dateOptions}
                        value={preset}
                        onChange={(v) => setPreset(v)}
                        footer={customDateFooter}
                    />
                    <button
                        type="button"
                        className={`ec-home__compare-btn ${compare ? "ec-home__compare-btn--on" : ""}`}
                        onClick={() => setCompare((c) => !c)}
                        title="Önceki dönemle karşılaştır"
                    >
                        <FaExchangeAlt /> Önceki döneme göre
                    </button>
                    <span className="ec-home__visitor">
                        <span
                            className={`ec-home__visitor-dot${
                                visitors?.hasTracking ? " ec-home__visitor-dot--live" : ""
                            }`}
                        />
                        {visitors?.hasTracking ? `${visitors.sessions} oturum` : "Ziyaretçi Yok"}
                        <FaArrowRight style={{ fontSize: 10 }} />
                    </span>
                </div>

                {account?.showVerifyBanner && (
                    <div className="ec-home__banner">
                        <div className="ec-home__banner-icon">
                            <FaIdCard />
                        </div>
                        <div className="ec-home__banner-text">
                            <h3>Ödemenizi Alabilmeniz için Hesabınızı Doğrulayın</h3>
                            <p>
                                Satışa başladınız; ödemelerinizi alabilmek için PayTR bilgilerinizi girin ve ödemeyi
                                etkinleştirin.
                            </p>
                        </div>
                        <div className="ec-home__banner-actions">
                            <button
                                type="button"
                                className="ec-home__btn-primary"
                                onClick={() => onNavigate?.("store-seller-verify")}
                            >
                                Hesabımı Doğrula
                            </button>
                            <span className="ec-home__banner-hint">Yaklaşık 3 dakika sürer</span>
                        </div>
                    </div>
                )}

                <div className="ec-home__analytics ec-home__card">
                    <div className="ec-home__kpis">
                        <div className="ec-home__kpi">
                            <label>Toplam Satış</label>
                            <strong>{fmtTry(kpis.totalSales.value)}</strong>
                            <ChangeBadge pct={kpis.totalSales.changePct} show={showCompare} />
                        </div>
                        <div className="ec-home__kpi">
                            <label>Sipariş Sayısı</label>
                            <strong>{kpis.orderCount.value}</strong>
                            <ChangeBadge pct={kpis.orderCount.changePct} show={showCompare} />
                        </div>
                        <div className="ec-home__kpi">
                            <label>Oturum Sayısı</label>
                            <strong>{kpis.sessions.value}</strong>
                            <ChangeBadge pct={kpis.sessions.changePct} show={showCompare} />
                        </div>
                        <div className="ec-home__kpi">
                            <label>Dönüşüm Oranı</label>
                            <strong>%{Number(kpis.conversionRate.value).toFixed(2)}</strong>
                            <ChangeBadge pct={kpis.conversionRate.changePct} show={showCompare} />
                        </div>
                        <div className="ec-home__kpi">
                            <label>İadeler</label>
                            <strong>{fmtTry(kpis.returns.value)}</strong>
                            <ChangeBadge pct={kpis.returns.changePct} show={showCompare} />
                        </div>
                    </div>

                    <div className="ec-home__chart-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--ec-home-chart-grid)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: "var(--ec-home-chart-tick)" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "var(--ec-home-chart-tick)" }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, chartMax]}
                                    tickFormatter={(v) => `${v}₺`}
                                />
                                <Tooltip
                                    formatter={(value) => [fmtTry(value), "Satış"]}
                                    contentStyle={{
                                        borderRadius: 8,
                                        border: "1px solid var(--ec-border)",
                                        background: "var(--ec-card)",
                                        color: "var(--ec-text)",
                                        fontSize: 12,
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="sales"
                                    stroke={C.accent}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: C.accent }}
                                    activeDot={{ r: 5, fill: C.accent }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="ec-home__channels ec-home__channels--inline">
                        {channels.map((ch) => (
                            <div key={ch.id} className="ec-home__channel">
                                <div className="ec-home__channel-icon">
                                    {ch.id === "website" ? <FaGlobe /> : <FaUser />}
                                </div>
                                <div className="ec-home__channel-body">
                                    <strong>{ch.label}</strong>
                                    <span>
                                        <ChangeBadge pct={ch.changePct} show={showCompare} />
                                    </span>
                                </div>
                                <div className="ec-home__channel-sales">
                                    <em>{ch.sharePct}%</em>
                                    <strong>{fmtTry(ch.sales)}</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ec-home__grid-bottom">
                    <div className="ec-home__card ec-home__card--panel">
                        <div className="ec-home__panel-head">
                            <h3>En Çok Satanlar</h3>
                        </div>
                        {topSellers.length === 0 ? (
                            <div className="ec-home__empty">
                                <FaBox size={48} />
                                <p>
                                    <strong>Seçilen tarihte henüz satışınız bulunmamaktadır</strong>
                                </p>
                                <p style={{ fontSize: "0.8rem", marginTop: 8 }}>
                                    Çok satanlar listesini görebilmek için farklı bir tarih aralığı seçin veya mağazanızı
                                    yayınlayın.
                                </p>
                            </div>
                        ) : (
                            topSellers.map((p, i) => (
                                <div key={`${p.title}-${i}`} className="ec-home__top-row">
                                    <span className="ec-home__top-rank">{i + 1}</span>
                                    <div className="ec-home__top-info">
                                        <strong>{p.title}</strong>
                                        <span>
                                            {p.quantity} adet · {fmtTry(p.revenue)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                        {operations?.awaitingShipment > 0 && (
                            <button
                                type="button"
                                className="ec-home__ship-bar"
                                onClick={() => onNavigate?.("ec-orders")}
                            >
                                <FaBox />
                                Kargolanmayı Bekleyen {operations.awaitingShipment} Siparişin Var
                                <span className="ec-home__ship-bar-cta">Siparişleri Kargola</span>
                            </button>
                        )}
                    </div>

                    <div className="ec-home__card">
                        <div className="ec-home__panel-head">
                            <h3>Büyüme Metrikleri</h3>
                        </div>
                        {[
                            { key: "avgReturnRate", label: "Ort. İade Oranı", format: (v) => `%${Number(v).toFixed(2)}` },
                            { key: "avgProductPrice", label: "Ort. Ürün Fiyatı", format: fmtTry },
                            { key: "avgOrderAmount", label: "Ort. Sipariş Tutarı", format: fmtTry },
                            { key: "avgBasketSize", label: "Ort. Sepet Büyüklüğü", format: (v) => Number(v).toFixed(2) },
                        ].map(({ key, label, format }) => {
                            const m = growth[key];
                            return (
                                <div key={key} className="ec-home__metric-row">
                                    <label>{label}</label>
                                    <div className="ec-home__metric-values">
                                        <strong>{format(m.value)}</strong>
                                        <ChangeBadge pct={m.changePct} show={showCompare} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </>,
            loading ? " ec-home--refreshing" : ""
    );
};

export default EcommerceHomePage;
