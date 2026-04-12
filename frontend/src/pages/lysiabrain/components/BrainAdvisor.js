/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Akıllı Danışman Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n + responsive + pagination + error handling
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import API from "../../../services/api";
import { T, fmt, fmtP, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, ScoreRing, StatCard, EmptyState, LoadingState, ErrorState, IconBox, Input } from "./shared/SharedUI";

const SEV_COLOR = { critical: T.red, high: T.yellow, medium: T.blue, low: T.textDim };
const SEV_DIM = { critical: T.redDim, high: T.yellowDim, medium: T.blueDim, low: T.bgGlass };

const PAGE_SIZE = 30;

const BrainAdvisor = ({ t, onError }) => {
    const { isMobile, isTablet } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [products, setProducts] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [expandedProduct, setExpandedProduct] = useState(null);
    const [actionLoading, setActionLoading] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const searchTimer = useRef(null);

    const loadProducts = useCallback(async (append = false) => {
        try {
            if (append) setLoadingMore(true); else setLoading(true);
            setError(null);
            const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: append ? String(products.length) : "0" });
            if (filter !== "all") params.set("status", filter);
            if (search.trim()) params.set("search", search.trim());
            const res = await API.get(`/ai-engine/advisor/products?${params}`);
            if (res.data.success) {
                const newProducts = res.data.products || [];
                if (append) setProducts(prev => [...prev, ...newProducts]);
                else setProducts(newProducts);
                setSummary(res.data.summary || null);
                setHasMore(newProducts.length >= PAGE_SIZE);
            } else {
                setError(res.data.message || t("error.data_load_fail"));
            }
        } catch (e) {
            setError(e.response?.data?.message || t("error.data_load_fail"));
        } finally { setLoading(false); setLoadingMore(false); }
    }, [filter, search, products.length, t]);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => { loadProducts(false); }, [filter]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const handleSearch = (val) => {
        setSearch(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => loadProducts(false), 500);
    };

    const handleAction = async (payload) => {
        if (!payload) return;
        const key = `${payload.barcode}_${payload.type}`;
        setActionLoading(key);
        try {
            if (payload.type === "update_price") {
                await API.post("/ai-engine/simulate/apply", { products: [{ barcode: payload.barcode, newPrice: payload.newPrice, oldPrice: 0 }] });
                loadProducts(false);
            }
        } catch (e) { onError?.(e.response?.data?.message || t("error.execute_fail")); }
        finally { setActionLoading(""); }
    };

    const STATUS_CFG = {
        critical: { label: t("adv.status.critical"), color: T.red, emoji: "🚨" },
        warning: { label: t("adv.status.warning"), color: T.yellow, emoji: "⚠️" },
        healthy: { label: t("adv.status.healthy"), color: T.blue, emoji: "✅" },
        star: { label: t("adv.status.star"), color: T.green, emoji: "⭐" },
    };

    if (loading && products.length === 0) return <LoadingState message={t("loading.advisor")} />;
    if (error && products.length === 0) return <ErrorState message={error} onRetry={() => loadProducts(false)} />;

    const filters = [
        { id: "all", label: t("adv.all"), count: summary?.total || 0, color: T.accent },
        { id: "critical", label: `🚨 ${t("adv.status.critical")}`, count: summary?.critical || 0, color: T.red },
        { id: "warning", label: `⚠️ ${t("adv.status.warning")}`, count: summary?.warning || 0, color: T.yellow },
        { id: "healthy", label: `✅ ${t("adv.status.healthy")}`, count: summary?.healthy || 0, color: T.blue },
        { id: "star", label: `⭐ ${t("adv.status.star")}`, count: summary?.star || 0, color: T.green },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {summary && (
                <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                    <StatCard icon="📦" label={t("adv.total")} value={summary.total} color={T.accent} />
                    <StatCard icon="🚨" label={t("adv.critical")} value={summary.totalRootCauses} color={T.red} />
                    <StatCard icon="💡" label={t("adv.solutions")} value={summary.totalSolutions} color={T.green} />
                    {!isMobile && <StatCard icon="⚡" label={t("adv.actionable")} value={summary.actionableCount} color={T.purple} />}
                    {!isMobile && <StatCard icon="❌" label={t("adv.mistakes")} value={summary.totalMistakes} color={T.yellow} />}
                </div>
            )}

            <Card style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {filters.map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} style={{
                            background: filter === f.id ? `${f.color}15` : T.bgGlass,
                            border: `1px solid ${filter === f.id ? f.color + "35" : T.border}`,
                            borderRadius: T.rSm, padding: isMobile ? "6px 10px" : "8px 14px", cursor: "pointer",
                            fontSize: isMobile ? "0.72rem" : "0.8rem", fontWeight: filter === f.id ? 700 : 500,
                            color: filter === f.id ? f.color : T.textDim,
                            display: "flex", alignItems: "center", gap: 6,
                            transition: "all 0.2s", fontFamily: "inherit",
                        }}>
                            {f.label}
                            <span style={{
                                padding: "2px 7px", borderRadius: T.rFull,
                                fontSize: "0.68rem", fontWeight: 800,
                                background: filter === f.id ? `${f.color}20` : T.borderLight,
                                color: filter === f.id ? f.color : T.textMuted,
                            }}>{f.count}</span>
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <Input value={search} onChange={e => handleSearch(e.target.value)} placeholder={t("adv.search")} icon="⌕" style={{ minWidth: isMobile ? "100%" : 200, flex: isMobile ? "1 1 100%" : 1 }} />
                </div>
            </Card>

            {products.length === 0 ? (
                <EmptyState icon="📦" title={t("adv.no_product")} description={search ? t("adv.no_search") : t("adv.no_analyze")} />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {products.map((product) => {
                        const cfg = STATUS_CFG[product.status] || STATUS_CFG.warning;
                        const isExp = expandedProduct === product.barcode;
                        return (
                            <Card key={product.barcode} noPad style={{
                                borderColor: isExp ? `${cfg.color}30` : undefined,
                                boxShadow: isExp ? `0 0 20px ${cfg.color}10` : undefined,
                            }}>
                                <div onClick={() => setExpandedProduct(p => p === product.barcode ? null : product.barcode)}
                                    role="button" tabIndex={0} aria-expanded={isExp}
                                    onKeyDown={e => { if (e.key === "Enter") setExpandedProduct(p => p === product.barcode ? null : product.barcode); }}
                                    style={{ padding: isMobile ? "0.75rem" : "1rem 1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: isMobile ? "0.65rem" : "1rem" }}>
                                    <ScoreRing score={product.healthScore} size={isMobile ? 42 : 52} thickness={isMobile ? 2.5 : 3} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <span style={{ fontSize: isMobile ? "0.82rem" : "0.92rem", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 180 : 320 }}>{product.name}</span>
                                            <Badge color={cfg.color} size="sm">{cfg.emoji} {cfg.label}</Badge>
                                        </div>
                                        <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "1rem", marginTop: 6, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "0.78rem", color: T.textDim }}>💰 {fmt(product.price)}</span>
                                            <span style={{ fontSize: "0.78rem", color: T.textDim }}>📦 {t("adv.stock")}: {product.stock}</span>
                                            {!isMobile && <span style={{ fontSize: "0.78rem", color: T.textDim }}>📊 {t("adv.sales")}: {product.totalSold}/90g</span>}
                                            {!isMobile && product.costPrice > 0 && <span style={{ fontSize: "0.78rem", fontWeight: 600, color: product.profitMargin >= 0 ? T.green : T.red }}>📈 {t("adv.margin")}: {fmtP(product.profitMargin)}</span>}
                                        </div>
                                    </div>
                                    {!isMobile && (
                                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                            {product.rootCauses?.length > 0 && <Badge color={T.red} size="sm">{product.rootCauses.length} {t("adv.issue")}</Badge>}
                                            {product.solutions?.length > 0 && <Badge color={T.green} size="sm">{product.solutions.length} {t("adv.solution")}</Badge>}
                                        </div>
                                    )}
                                    <div style={{
                                        width: 28, height: 28, borderRadius: T.rSm,
                                        background: T.bgGlass, border: `1px solid ${T.border}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: T.textMuted, fontSize: "0.7rem", flexShrink: 0,
                                        transition: "transform 0.25s", transform: isExp ? "rotate(180deg)" : "none",
                                    }} aria-hidden="true">▼</div>
                                </div>

                                {isExp && (
                                    <div style={{ padding: isMobile ? "0 0.75rem 0.75rem" : "0 1.25rem 1.25rem", borderTop: `1px solid ${T.border}` }}>
                                        {/* AI Verdict */}
                                        <div style={{ borderRadius: T.rSm, padding: "1rem 1.15rem", margin: "1rem 0", background: `${cfg.color}08`, border: `1px solid ${cfg.color}18` }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 8 }}>
                                                <span aria-hidden="true">🤖</span>
                                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: cfg.color }}>{t("adv.ai_verdict")}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: "0.86rem", color: T.textSec, lineHeight: 1.65 }}>{product.aiVerdict}</p>
                                        </div>

                                        {/* Root Causes */}
                                        {product.rootCauses?.length > 0 && (
                                            <div style={{ marginBottom: "1.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
                                                    <IconBox icon="❌" color={T.red} size={32} />
                                                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: T.red }}>{t("adv.root_cause")} {product.totalSold === 0 ? t("adv.why_not_selling") : t("adv.low_perf")}?</h4>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                                    {product.rootCauses.map((cause, i) => {
                                                        const sc = SEV_COLOR[cause.severity] || T.blue;
                                                        const sbg = SEV_DIM[cause.severity] || T.bgGlass;
                                                        return (
                                                            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.95rem 1rem", background: sbg, borderLeft: `3px solid ${sc}`, borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start" }}>
                                                                <span style={{ fontSize: "1.1rem", flexShrink: 0 }} aria-hidden="true">{cause.icon}</span>
                                                                <div>
                                                                    <div style={{ fontWeight: 700, fontSize: "0.86rem", color: T.text }}>{cause.title}</div>
                                                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{cause.detail}</div>
                                                                    {cause.impact && <div style={{ fontSize: "0.76rem", color: T.yellow, marginTop: 6, fontWeight: 600 }}>⚡ {cause.impact}</div>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Solutions */}
                                        {product.solutions?.length > 0 && (
                                            <div style={{ marginBottom: "1.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
                                                    <IconBox icon="✅" color={T.green} size={32} />
                                                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: T.green }}>{t("adv.solutions_title")}</h4>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                                    {product.solutions.map((sol, i) => (
                                                        <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.95rem 1rem", background: T.greenDim, borderLeft: `3px solid ${T.green}`, borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start" }}>
                                                            <span style={{ fontSize: "1.1rem", flexShrink: 0 }} aria-hidden="true">{sol.icon}</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: T.text }}>{sol.title}</div>
                                                                <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{sol.detail}</div>
                                                                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                                                    {sol.projectedSalesIncrease > 0 && <Badge color={T.green} size="sm">+{sol.projectedSalesIncrease} {t("adv.sales_month")}</Badge>}
                                                                    {sol.projectedRevenue > 0 && <Badge color={T.blue} size="sm">+{fmt(sol.projectedRevenue)}</Badge>}
                                                                    {sol.confidence > 0 && <Badge color={T.purple} size="sm">{t("rec.confidence")}: %{sol.confidence}</Badge>}
                                                                </div>
                                                            </div>
                                                            {sol.actionable && sol.actionPayload && (
                                                                <Btn color={T.green} variant="solid" size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); handleAction(sol.actionPayload); }}
                                                                    disabled={actionLoading === `${sol.actionPayload.barcode}_${sol.actionPayload.type}`}>
                                                                    {actionLoading === `${sol.actionPayload.barcode}_${sol.actionPayload.type}` ? "⏳" : "⚡"} {t("adv.apply")}
                                                                </Btn>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Mistakes */}
                                        {product.mistakes?.length > 0 && (
                                            <div style={{ marginBottom: "1rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.7rem" }}>
                                                    <IconBox icon="⚠️" color={T.yellow} size={32} />
                                                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: T.yellow }}>{t("adv.fixes_needed")}</h4>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                                    {product.mistakes.map((m, i) => (
                                                        <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.95rem 1rem", background: T.yellowDim, borderLeft: `3px solid ${T.yellow}`, borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start" }}>
                                                            <span style={{ fontSize: "1.1rem", flexShrink: 0 }} aria-hidden="true">{m.icon}</span>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: T.text }}>{m.title}</div>
                                                                <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{m.detail}</div>
                                                                <div style={{ fontSize: "0.76rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>→ {m.fix}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Projected Impact */}
                                        {(product.projectedImpact?.salesIncrease > 0 || product.projectedImpact?.revenueIncrease > 0) && (
                                            <div style={{ borderRadius: T.rSm, padding: "1rem 1.15rem", background: T.accentDim, border: `1px solid ${T.accent}18` }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                    <span aria-hidden="true">💡</span>
                                                    <span style={{ fontSize: "0.83rem", fontWeight: 700, color: T.accent }}>{t("adv.projected")}:</span>
                                                </div>
                                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                    {product.projectedImpact.salesIncrease > 0 && <Badge color={T.green}>+{product.projectedImpact.salesIncrease} {t("adv.sales_month")}</Badge>}
                                                    {product.projectedImpact.revenueIncrease > 0 && <Badge color={T.blue}>+{fmt(product.projectedImpact.revenueIncrease)}</Badge>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}

                    {/* Load More */}
                    {hasMore && (
                        <div style={{ textAlign: "center", padding: "0.5rem" }}>
                            <Btn color={T.accent} variant="ghost" onClick={() => loadProducts(true)} disabled={loadingMore}>
                                {loadingMore ? "⏳" : "↓"} {t("adv.load_more")}
                            </Btn>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(BrainAdvisor);
