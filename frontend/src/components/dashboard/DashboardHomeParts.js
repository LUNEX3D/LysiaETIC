import React from "react";
import { motion } from "framer-motion";
import {
    FaMoneyBillWave, FaClipboardList, FaBoxOpen, FaArrowRight,
    FaChartLine, FaStore, FaBell
} from "react-icons/fa";
import DashtockLogo from "../brand/DashtockLogo";
import PageHelpButton from "../help/PageHelpButton";

const MP_BRAND = {
    trendyol: { color: "#f27a1a", abbr: "TY", label: "Trendyol" },
    n11: { color: "#7b2d8e", abbr: "n11", label: "N11" },
    hepsiburada: { color: "#ff6000", abbr: "HB", label: "Hepsiburada" },
    ciceksepeti: { color: "#e91e63", abbr: "ÇS", label: "ÇiçekSepeti" },
    amazon: { color: "#ff9900", abbr: "AZ", label: "Amazon" },
    ozon: { color: "#005bff", abbr: "OZ", label: "Ozon" },
};

const normalizeMpBrandKey = (name = "") => {
    const n = String(name || "").toLowerCase().trim();
    if (n.includes("trendyol")) return "trendyol";
    if (n.includes("hepsi")) return "hepsiburada";
    if (n === "n11") return "n11";
    if (n.includes("cicek") || n.includes("çiçek")) return "ciceksepeti";
    if (n.includes("amazon")) return "amazon";
    if (n.includes("ozon")) return "ozon";
    return n;
};

/** Pazaryeri marka rozeti (küçük ikon) */
export const MarketplaceBrandIcon = ({ name, size = 22 }) => {
    const key = normalizeMpBrandKey(name);
    const brand = MP_BRAND[key] || {
        color: "#4ecdc4",
        abbr: String(name || "?").slice(0, 2).toUpperCase(),
        label: name,
    };
    return (
        <span
            className="dh-mp-brand"
            style={{ width: size, height: size, background: brand.color }}
            title={brand.label || name}
            aria-hidden
        >
            <span className="dh-mp-brand__txt">{brand.abbr}</span>
        </span>
    );
};

/** Hero — karşılama + canlı özet */
export const DashboardHero = ({
    BRAND_NAME, greeting, dateStr, timeStr, activeChannels, planDisplayName,
    opsScore, dashboardLoading, isDark, isMobile, C,
    unreadCount, onNotifToggle, language
}) => (
    <header
        className={`dh-hero dh-hero--premium${isDark ? "" : " dh-hero--light"}`}
        style={isDark ? undefined : { background: "linear-gradient(165deg, #f0f9ff 0%, #f8fafc 50%, #eef2ff 100%)" }}
    >
        <div className="dh-hero__mesh" aria-hidden />
        <div className="dh-hero__glow dh-hero__glow--a" aria-hidden />
        <div className="dh-hero__glow dh-hero__glow--b" aria-hidden />
        <div className="dh-hero__glow dh-hero__glow--c" aria-hidden />

        <div className="dh-hero__inner">
            <div className="dh-hero__left">
                <div className="dh-hero__brand-row">
                    <div className="dh-hero__logo-wrap">
                        <DashtockLogo size={isMobile ? 28 : 36} />
                    </div>
                    <p className="dh-hero__eyebrow">{BRAND_NAME}</p>
                </div>
                <h1 className="dh-hero__title">
                    {greeting}
                    {dashboardLoading && <span className="dh-hero__loader" />}
                </h1>
                <div className="dh-hero__meta">
                    <span className="dh-hero__pill">{dateStr}</span>
                    <span className="dh-hero__pill dh-hero__pill--live">
                        <span className="dh-hero__pill-dot" />
                        {timeStr}
                    </span>
                    <span className="dh-hero__pill">
                        {activeChannels} {language === "en" ? "channels" : "kanal"}
                    </span>
                    {planDisplayName && (
                        <span className="dh-hero__pill dh-hero__pill--plan">{planDisplayName}</span>
                    )}
                </div>
            </div>

            <div className="dh-hero__right">
                <div className="dh-hero__score" title={language === "en" ? "Operations health" : "Operasyon sağlığı"}>
                    <svg className="dh-hero__ring" viewBox="0 0 36 36">
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="3"
                        />
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="url(#dhScoreGrad)"
                            strokeWidth="3"
                            strokeDasharray={`${opsScore}, 100`}
                            strokeLinecap="round"
                        />
                        <defs>
                            <linearGradient id="dhScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#4ecdc4" />
                                <stop offset="100%" stopColor="#a78bfa" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="dh-hero__score-text">
                        <span className="dh-hero__score-val">{opsScore}</span>
                        <span className="dh-hero__score-lbl">{language === "en" ? "Health" : "Sağlık"}</span>
                    </div>
                </div>
                <div className="dashboard-header-actions">
                    <PageHelpButton pageId="dashboard" variant="inline" className="dashboard-header-icon-btn" ariaLabel="Yardım" />
                    <span className="dashboard-header-notif-wrap">
                        <button
                            type="button"
                            className={`dashboard-header-icon-btn dh-hero__notif${unreadCount > 0 ? " dashboard-header-icon-btn--alert" : ""}`}
                            onClick={onNotifToggle}
                            aria-label="Bildirimler"
                        >
                            <FaBell />
                        </button>
                        {unreadCount > 0 && (
                            <span className="dashboard-header-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                        )}
                    </span>
                </div>
            </div>
        </div>
    </header>
);

/** Öne çıkan 3 metrik */
export const DashboardSpotlight = ({
    revenue,
    revenueSub,
    revenueBreakdown,
    marketplaceDayRevenue,
    fmtCurrency,
    orders,
    ordersSub,
    products,
    productsSub,
    onFinance,
    onOrders,
    onProducts,
    language,
}) => (
    <div className="dh-spotlight">
        <motion.button type="button" className="dh-spotlight__card dh-spotlight__card--revenue" onClick={onFinance}
            whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
            <div className="dh-spotlight__icon"><FaMoneyBillWave /></div>
            <p className="dh-spotlight__label">
                {language === "en" ? "Revenue (last 24h)" : "Son 24 saat ciro"}
            </p>
            <p className="dh-spotlight__value">{revenue}</p>
            {marketplaceDayRevenue?.length > 0 ? (
                <div className="dh-spotlight__mp-row" onClick={(e) => e.stopPropagation()} role="presentation">
                    {marketplaceDayRevenue.map((row) => (
                        <span key={row.name} className="dh-spotlight__mp-chip" title={row.name}>
                            <MarketplaceBrandIcon name={row.name} size={20} />
                            <span className="dh-spotlight__mp-amt">
                                {fmtCurrency ? fmtCurrency(row.revenue, language) : row.revenue}
                            </span>
                        </span>
                    ))}
                </div>
            ) : null}
            {revenueBreakdown?.length > 0 ? (
                <div className="dh-spotlight__breakdown">
                    {revenueBreakdown.map((row) => (
                        <span key={row.label} className="dh-spotlight__breakdown-item">
                            <span className="dh-spotlight__breakdown-lbl">{row.label}</span>
                            <span className="dh-spotlight__breakdown-val">{row.value}</span>
                        </span>
                    ))}
                </div>
            ) : (
                <p className="dh-spotlight__sub">{revenueSub}</p>
            )}
            <span className="dh-spotlight__cta"><FaArrowRight /></span>
        </motion.button>
        <motion.button type="button" className="dh-spotlight__card dh-spotlight__card--orders" onClick={onOrders}
            whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
            <div className="dh-spotlight__icon"><FaClipboardList /></div>
            <p className="dh-spotlight__label">{language === "en" ? "Orders" : "Siparişler"}</p>
            <p className="dh-spotlight__value">{orders}</p>
            <p className="dh-spotlight__sub">{ordersSub}</p>
            <span className="dh-spotlight__cta"><FaArrowRight /></span>
        </motion.button>
        <motion.button type="button" className="dh-spotlight__card dh-spotlight__card--products" onClick={onProducts}
            whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}>
            <div className="dh-spotlight__icon"><FaBoxOpen /></div>
            <p className="dh-spotlight__label">{language === "en" ? "Products" : "Ürünler"}</p>
            <p className="dh-spotlight__value">{products}</p>
            <p className="dh-spotlight__sub">{productsSub}</p>
            <span className="dh-spotlight__cta"><FaArrowRight /></span>
        </motion.button>
    </div>
);

/** Pazaryeri kartları */
export const DashboardMarketplaceGrid = ({ entries, fmtCurrency, language, statusColor, statusLabel, t, C }) => {
    if (!entries.length) return null;
    return (
        <div className="dh-panel">
            <div className="dh-panel__head">
                <div className="dh-panel__title">
                    <span className="dh-panel__title-icon"><FaStore /></span>
                    {t("dashboard.marketplaceStatus")}
                </div>
                <span className="dh-panel__badge">{entries.length} {t("dashboard.channel")}</span>
            </div>
            <div className="dh-mp-grid">
                {entries.map(([name, mp], idx) => (
                    <motion.div
                        key={name}
                        className="dh-mp-card"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * idx }}
                    >
                        <div className="dh-mp-card__top">
                            <div className="dh-mp-card__dot" style={{ background: statusColor(mp.status, C), boxShadow: `0 0 12px ${statusColor(mp.status, C)}66` }} />
                            <span className="dh-mp-card__name">{name}</span>
                            <span className={`dh-mp-card__status dh-mp-card__status--${mp.status || "unknown"}`}>
                                {statusLabel(mp.status, t)}
                            </span>
                        </div>
                        <div className="dh-mp-card__stats">
                            <div>
                                <span className="dh-mp-card__stat-lbl">{t("dashboard.orders")}</span>
                                <span className="dh-mp-card__stat-val">{mp.orders || 0}</span>
                            </div>
                            <div>
                                <span className="dh-mp-card__stat-lbl">{t("dashboard.revenue")}</span>
                                <span className="dh-mp-card__stat-val dh-mp-card__stat-val--money">
                                    {fmtCurrency(mp.revenue || 0, language)}
                                </span>
                            </div>
                            <div>
                                <span className="dh-mp-card__stat-lbl">{t("dashboard.errors")}</span>
                                <span className={`dh-mp-card__stat-val ${(mp.errors || 0) > 0 ? "dh-mp-card__stat-val--err" : ""}`}>
                                    {mp.errors || 0}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/** Gelişmiş trend grafiği */
export const DashboardTrendChart = ({
    trends, orderTrendMax, revenueTrendMax, trendOrderTotal, trendRevenueTotal,
    fmtCurrency, fmtNum, language, t, C, isMobile
}) => (
    <div className="dh-panel dh-panel--chart">
        <div className="dh-panel__head">
            <div className="dh-panel__title">
                <span className="dh-panel__title-icon"><FaChartLine /></span>
                {t("dashboard.weeklyTrend")}
            </div>
            <span className="dh-panel__badge">
                {fmtNum(trendOrderTotal, language)} · {fmtCurrency(trendRevenueTotal, language)}
            </span>
        </div>
        {trends.labels.length > 0 ? (
            <>
                <div className="dh-chart-legend">
                    <span><i className="dh-chart-legend__dot dh-chart-legend__dot--orders" />{t("dashboard.orders")}</span>
                    <span><i className="dh-chart-legend__dot dh-chart-legend__dot--rev" />{t("dashboard.revenue")}</span>
                </div>
                <div className="dh-chart" style={{ height: isMobile ? 140 : 200 }}>
                    {trends.labels.map((label, i) => {
                        const ord = trends.orderCounts[i] || 0;
                        const rev = trends.revenueTotals[i] || 0;
                        const oH = ord > 0 ? Math.max((ord / orderTrendMax) * 100, 8) : 0;
                        const rH = rev > 0 ? Math.max((rev / revenueTrendMax) * 100, 8) : 0;
                        return (
                            <div key={`${label}-${i}`} className="dh-chart__col">
                                <div className="dh-chart__bars">
                                    <motion.div
                                        className="dh-chart__bar dh-chart__bar--rev"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${rH}%` }}
                                        transition={{ delay: 0.15 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                                        title={fmtCurrency(trends.revenueTotals[i] || 0, language)}
                                    />
                                    <motion.div
                                        className="dh-chart__bar dh-chart__bar--ord"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${oH}%` }}
                                        transition={{ delay: 0.2 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                                        title={String(trends.orderCounts[i] || 0)}
                                    />
                                </div>
                                <span className="dh-chart__label">{label}</span>
                            </div>
                        );
                    })}
                </div>
            </>
        ) : (
            <div className="dh-empty">
                <FaChartLine className="dh-empty__icon" />
                <p>{t("dashboard.noData")}</p>
            </div>
        )}
    </div>
);

/** Sipariş akışı — timeline */
export const DashboardOrderTimeline = ({
    orders, fmtCurrency, language, onViewAll, t, C
}) => (
    <div className="dh-panel dh-panel--feed">
        <div className="dh-panel__head">
            <div className="dh-panel__title">
                <span className="dh-panel__title-icon dh-panel__title-icon--live" />
                {t("dashboard.recentOrders")}
            </div>
            <button type="button" className="dh-panel__link" onClick={onViewAll}>
                {t("dashboard.viewAll")} <FaArrowRight />
            </button>
        </div>
        <div className="dh-feed">
            {orders.length > 0 ? orders.map((o, i) => (
                <motion.div
                    key={`${o.orderNumber}-${i}`}
                    className="dh-feed__item"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i }}
                >
                    <div className="dh-feed__rail">
                        <div className="dh-feed__dot" />
                        {i < orders.length - 1 && <div className="dh-feed__line" />}
                    </div>
                    <div className="dh-feed__body">
                        <div className="dh-feed__row">
                            <span className="dh-feed__mp">{o.marketplace}</span>
                            <span className="dh-feed__price">{fmtCurrency(o.totalPrice || 0, language)}</span>
                        </div>
                        <div className="dh-feed__row dh-feed__row--sub">
                            <span className="dh-feed__id">#{o.orderNumber || "—"}</span>
                            <span className="dh-feed__time">
                                {o.orderDate
                                    ? new Date(o.orderDate).toLocaleString(language === "en" ? "en-US" : "tr-TR", {
                                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                    })
                                    : ""}
                            </span>
                        </div>
                    </div>
                </motion.div>
            )) : (
                <div className="dh-empty dh-empty--sm">
                    <FaClipboardList className="dh-empty__icon" />
                    <p>{t("dashboard.noOrders")}</p>
                </div>
            )}
        </div>
    </div>
);
