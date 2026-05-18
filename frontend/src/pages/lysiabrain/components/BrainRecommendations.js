/**
 * LYSIA BRAIN — AI Önerileri
 * Okunaklı kart düzeni + AI Fiyat / AI Stok / Diğer sınıflandırması
 */
import React, { useState, useMemo, useEffect } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, EmptyState } from "./shared/SharedUI";

/** actionPayload.params üzerinden fiyat-aksiyon detaylarını çıkar */
export function getActionPriceDetails(rec) {
    const params = rec?.actionPayload?.params || {};
    const actionType = String(rec?.actionPayload?.actionType || "").toLowerCase();

    const round = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);

    if (actionType === "update_price") {
        const oldPrice = round(params.oldPrice);
        const newPrice = round(params.newPrice);
        if (oldPrice && newPrice && oldPrice !== newPrice) {
            const diff = newPrice - oldPrice;
            const pct = oldPrice > 0 ? Math.round((diff / oldPrice) * 100) : 0;
            return {
                kind: "price_change",
                direction: diff > 0 ? "up" : "down",
                oldPrice, newPrice, diff, pct,
                label: diff > 0 ? "Fiyat Artışı" : "Fiyat Düşüşü",
            };
        }
    }
    if (actionType === "apply_discount") {
        const oldPrice = round(params.oldPrice);
        const newPrice = round(params.newPrice);
        const discountPercent = Math.round(params.discountPercent || 0);
        if (oldPrice && newPrice) {
            return {
                kind: "discount",
                direction: "down",
                oldPrice, newPrice,
                discountPercent,
                label: `İndirim %${discountPercent}`,
            };
        }
        if (discountPercent > 0) {
            return { kind: "discount_only", discountPercent, label: `İndirim %${discountPercent}` };
        }
    }
    if (actionType === "create_stock_order") {
        const qty = params.suggestedQty || params.qty || params.restockQty;
        if (qty) return { kind: "restock", qty, label: `${qty} adet sipariş` };
    }
    return null;
}

/** Backend category + type + actionPayload üzerinden öneri ailesi */
export function getRecommendationKind(rec) {
    const cat = String(rec.category || "").toLowerCase();
    const typ = String(rec.type || "").toLowerCase();
    const act = String(rec.actionPayload?.actionType || "").toLowerCase();

    const priceActs = ["update_price", "apply_discount", "mark_inactive"];
    const isPrice =
        cat === "pricing" ||
        typ.includes("price") ||
        typ.includes("pricing") ||
        typ === "dynamic_pricing" ||
        typ === "loss_detection" ||
        typ === "inventory_pressure" ||
        priceActs.includes(act);

    const isStock =
        cat === "stock" ||
        typ.includes("stock") ||
        typ.includes("restock") ||
        act === "create_stock_order";

    if (isPrice && !isStock) return "price";
    if (isStock && !isPrice) return "stock";
    if (isPrice && isStock) return cat === "stock" ? "stock" : "price";
    return "other";
}

const BrainRecommendations = ({ recommendations, recSummary, refreshing, onApprove, onReject, onExecute, onGenerate, onExplain, onBulkApprove, onBulkReject, t }) => {
    const { isMobile, isTablet } = useResponsive();
    const [recFilter, setRecFilter] = useState("pending");
    const [kindFilter, setKindFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [lastAction, setLastAction] = useState(null);
    const [ctaHint, setCtaHint] = useState(null);
    const [autonomyStatus, setAutonomyStatus] = useState(null);

    // Otonom kuralları durumunu yükle (banner için)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await API.get("/ai-engine/autonomy-config/status");
                if (!cancelled && res.data?.status) setAutonomyStatus(res.data.status);
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Dashboard'dan "Fix Now" CTA ile gelinmişse ön-filtre uygula
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("pazaryonet_ai.tabFilter.recommendations");
            if (!raw) return;
            const parsed = JSON.parse(raw);
            // 5 dakikadan eskiyse yok say
            if (!parsed?.ts || Date.now() - parsed.ts > 5 * 60 * 1000) {
                sessionStorage.removeItem("pazaryonet_ai.tabFilter.recommendations");
                return;
            }
            const f = parsed.filter || {};
            if (typeof f.type === "string") {
                const types = f.type.split(",").map(s => s.trim().toLowerCase());
                const priceTypes = new Set(["loss_detection", "price_optimization", "dynamic_pricing", "inventory_pressure", "dead_product"]);
                const stockTypes = new Set(["restock", "stock_order", "stockout_risk"]);
                if (types.some(t => priceTypes.has(t))) setKindFilter("price");
                else if (types.some(t => stockTypes.has(t))) setKindFilter("stock");
                setCtaHint(`Dashboard yönlendirmesi: ${types.join(", ")}`);
            }
            sessionStorage.removeItem("pazaryonet_ai.tabFilter.recommendations");
        } catch { /* sessionStorage yok */ }
    }, []);

    const PRI = {
        critical: { color: T.red, label: t("rec.priority.critical"), icon: "🔴", bg: T.redDim },
        high: { color: T.yellow, label: t("rec.priority.high"), icon: "🟡", bg: T.yellowDim },
        medium: { color: T.blue, label: t("rec.priority.medium"), icon: "🔵", bg: T.blueDim },
        low: { color: T.textDim, label: t("rec.priority.low"), icon: "⚪", bg: T.bgGlass },
    };

    const CAT = {
        pricing: `💰 ${t("rec.cat.pricing")}`,
        stock: `📦 ${t("rec.cat.stock")}`,
        performance: `📊 ${t("rec.cat.performance")}`,
        financial: `💵 ${t("rec.cat.financial")}`,
        strategy: `◈ ${t("rec.cat.strategy")}`,
    };

    const KIND = {
        price: {
            key: "price",
            label: t("rec.kind.price_short"),
            long: t("rec.kind.price"),
            icon: "💹",
            accent: "#f59e0b",
            accentDim: "rgba(245, 158, 11, 0.12)",
            border: "rgba(245, 158, 11, 0.45)",
        },
        stock: {
            key: "stock",
            label: t("rec.kind.stock_short"),
            long: t("rec.kind.stock"),
            icon: "📦",
            accent: "#06b6d4",
            accentDim: "rgba(6, 182, 212, 0.12)",
            border: "rgba(6, 182, 212, 0.45)",
        },
        other: {
            key: "other",
            label: t("rec.kind.other_short"),
            long: t("rec.kind.other"),
            icon: "🧭",
            accent: "#a78bfa",
            accentDim: "rgba(167, 139, 250, 0.12)",
            border: "rgba(167, 139, 250, 0.45)",
        },
    };

    const byStatus = useMemo(
        () => recommendations.filter(r => (recFilter === "all" ? true : r.status === recFilter)),
        [recommendations, recFilter]
    );

    const kindCounts = useMemo(() => {
        const c = { all: byStatus.length, price: 0, stock: 0, other: 0 };
        for (const r of byStatus) {
            c[getRecommendationKind(r)]++;
        }
        return c;
    }, [byStatus]);

    const filtered = useMemo(() => {
        let list = byStatus;
        if (kindFilter !== "all") list = list.filter(r => getRecommendationKind(r) === kindFilter);
        if (catFilter !== "all") list = list.filter(r => r.category === catFilter);
        return list;
    }, [byStatus, kindFilter, catFilter]);

    const cats = useMemo(
        () => [...new Set(byStatus.map(r => r.category).filter(Boolean))],
        [byStatus]
    );

    const pendingIds = useMemo(() => recommendations.filter(r => r.status === "pending").map(r => r._id), [recommendations]);
    const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => { setSelected(p => p.size === pendingIds.length ? new Set() : new Set(pendingIds)); };
    const bulkApprove = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkApprove([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const bulkReject = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkReject([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const rejectAll = async () => { if (!pendingIds.length) return; setBulkLoading(true); try { await onBulkReject(pendingIds); } finally { setSelected(new Set()); setBulkLoading(false); } };

    const handleApproveWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onApprove(recId);
            setLastAction({ recId, action: "approved", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };
    const handleRejectWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onReject(recId);
            setLastAction({ recId, action: "rejected", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };
    const handleExecuteWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onExecute(recId);
            setLastAction({ recId, action: "executed", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };

    const statusFilters = [
        { id: "pending", label: t("rec.pending"), count: recSummary.pending, color: T.yellow },
        { id: "approved", label: t("rec.approved"), count: recSummary.approved, color: T.green },
        { id: "executed", label: t("rec.executed"), count: recSummary.executed, color: T.accent },
        { id: "rejected", label: t("rec.rejected"), count: recSummary.rejected, color: T.red },
        { id: "all", label: t("rec.all"), count: recommendations.length, color: T.textDim },
    ];

    const pillBtn = (isActive, color, borderColor) => ({
        background: isActive ? (borderColor ? `${color}22` : `${color}1f`) : T.bgGlass,
        border: `1px solid ${isActive ? (borderColor || `${color}55`) : T.border}`,
        borderRadius: T.rFull,
        padding: isMobile ? "7px 13px" : "8px 16px",
        cursor: "pointer",
        fontSize: isMobile ? T.fz.xs : T.fz.sm,
        fontWeight: isActive ? 700 : 600,
        color: isActive ? color : T.textSec,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "inherit",
        boxShadow: isActive ? `0 0 0 1px ${color}30, 0 2px 8px ${color}15` : "none",
        // transition lysia-btn class'ı tarafından sağlanır
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.35rem", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            <Card glow style={{
                background: `linear-gradient(145deg, ${T.bgCard} 0%, rgba(0,212,170,0.04) 100%)`,
                border: `1px solid ${T.borderGlow}`,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.1rem" }}>
                    <div>
                        <CardHeader icon="✨" title={t("rec.title")} subtitle={t("rec.subtitle")} color={T.accent} />
                        <p style={{
                            margin: "0.65rem 0 0",
                            fontSize: "0.8rem",
                            color: T.textDim,
                            lineHeight: 1.55,
                            maxWidth: "min(720px, 100%)",
                        }}>
                            {t("rec.classify_hint")}
                        </p>
                    </div>
                    <Btn color={T.accent} variant="solid" onClick={onGenerate} disabled={refreshing} style={{ flexShrink: 0 }}>
                        {refreshing ? `⏳ ${t("rec.generating")}` : `↻ ${t("rec.generate")}`}
                    </Btn>
                </div>

                {/* Otonomi Mode Banner — kullanıcı modunu net görsün */}
                {autonomyStatus && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: autonomyStatus.mode === "autonomous" ? `${T.red}10` : autonomyStatus.mode === "supervised" ? `${T.yellow}10` : `${T.green}10`,
                        border: `1px solid ${autonomyStatus.mode === "autonomous" ? T.red : autonomyStatus.mode === "supervised" ? T.yellow : T.green}40`,
                        borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: T.fz.sm,
                        flexWrap: "wrap",
                    }}>
                        <span style={{ fontSize: "1.2rem" }}>
                            {autonomyStatus.mode === "autonomous" ? "🤖" : autonomyStatus.mode === "supervised" ? "👁️" : "✋"}
                        </span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <b style={{ color: autonomyStatus.mode === "autonomous" ? T.red : autonomyStatus.mode === "supervised" ? T.yellow : T.green }}>
                                {autonomyStatus.mode === "autonomous" ? "Tam Otonom Mod" : autonomyStatus.mode === "supervised" ? "Denetimli Mod" : "Manuel Mod"}
                            </b>
                            <span style={{ color: T.textDim, marginLeft: 8 }}>
                                {autonomyStatus.mode === "autonomous" ? "Düşük etki + yüksek güvenli öneriler otomatik uygulanır." : autonomyStatus.mode === "supervised" ? "Kritik aksiyonlar onay bekler — sen onaylayınca uygulanır." : "Hiçbir öneri otomatik uygulanmaz; her şeyi sen onaylarsın."}
                            </span>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => { try { window.dispatchEvent(new CustomEvent("lysia-goto-tab", { detail: "autonomy" })); } catch {} }}>🎛️ Modu Değiştir</Btn>
                    </div>
                )}

                {ctaHint && (
                    <div style={{ background: `${T.accent}15`, border: `1px solid ${T.accent}40`, borderRadius: 8, padding: "0.65rem 0.85rem", marginBottom: "0.9rem", fontSize: "0.78rem", color: T.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span><b style={{ color: T.accent }}>↻</b> {ctaHint}</span>
                        <button onClick={() => { setCtaHint(null); setKindFilter("all"); }} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSec, fontSize: "0.7rem", padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>Filtreyi kaldır</button>
                    </div>
                )}

                <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                    Durum
                </div>
                <div role="tablist" aria-label="Status filters" style={{ display: "flex", gap: 8, marginBottom: "1.1rem", flexWrap: "wrap" }}>
                    {statusFilters.map(f => (
                        <button key={f.id} type="button" role="tab" aria-selected={recFilter === f.id} onClick={() => { setRecFilter(f.id); setSelected(new Set()); }} className="lysia-btn lysia-focus" style={pillBtn(recFilter === f.id, f.color)}>
                            {f.label}
                            <span style={{
                                minWidth: 22,
                                textAlign: "center",
                                padding: "1px 8px",
                                borderRadius: T.rFull,
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                background: recFilter === f.id ? `${f.color}28` : T.borderLight,
                                color: recFilter === f.id ? f.color : T.textMuted,
                            }}>{f.count}</span>
                        </button>
                    ))}
                </div>

                <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                    {t("rec.kind.label")}
                </div>
                <div role="tablist" aria-label="Recommendation kind" style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
                    {[
                        { id: "all", label: t("rec.kind.all"), count: kindCounts.all, cfg: null },
                        { id: "price", label: `${KIND.price.icon} ${KIND.price.label}`, count: kindCounts.price, cfg: KIND.price },
                        { id: "stock", label: `${KIND.stock.icon} ${KIND.stock.label}`, count: kindCounts.stock, cfg: KIND.stock },
                        { id: "other", label: `${KIND.other.icon} ${KIND.other.label}`, count: kindCounts.other, cfg: KIND.other },
                    ].map(row => (
                        <button
                            key={row.id}
                            type="button"
                            role="tab"
                            aria-selected={kindFilter === row.id}
                            onClick={() => { setKindFilter(row.id); setCatFilter("all"); }}
                            className="lysia-btn lysia-focus"
                            style={pillBtn(kindFilter === row.id, row.cfg?.accent || T.accent, row.cfg?.border)}
                        >
                            {row.label}
                            <span style={{
                                minWidth: 22,
                                textAlign: "center",
                                padding: "1px 8px",
                                borderRadius: T.rFull,
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                background: kindFilter === row.id ? (row.cfg ? `${row.cfg.accent}28` : `${T.accent}28`) : T.borderLight,
                                color: kindFilter === row.id ? (row.cfg?.accent || T.accent) : T.textMuted,
                            }}>{row.count}</span>
                        </button>
                    ))}
                </div>

                {recFilter === "pending" && recSummary.pending > 0 && (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        padding: "0.85rem 1rem",
                        background: T.bgGlass,
                        border: `1px solid ${T.accent}22`,
                        borderRadius: T.rSm,
                        marginBottom: "1rem",
                        flexWrap: "wrap",
                    }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.8rem", color: T.textSec, fontWeight: 600 }}>
                            <input type="checkbox" checked={selected.size > 0 && selected.size === pendingIds.length} onChange={selectAll} style={{ accentColor: T.accent }} />
                            {t("rec.select_all")}
                        </label>
                        {selected.size > 0 && (
                            <>
                                <Badge color={T.accent}>{selected.size} {t("rec.selected")}</Badge>
                                <Btn color={T.green} size="sm" onClick={bulkApprove} disabled={bulkLoading}>✅ {t("rec.bulk_approve")}</Btn>
                                <Btn color={T.red} size="sm" onClick={bulkReject} disabled={bulkLoading}>❌ {t("rec.bulk_reject")}</Btn>
                            </>
                        )}
                        <div style={{ marginLeft: "auto" }}>
                            <Btn color={T.red} size="sm" variant="solid" onClick={rejectAll} disabled={bulkLoading}>
                                {bulkLoading ? "⏳" : "🗑️"} {t("rec.reject_all")}
                            </Btn>
                        </div>
                    </div>
                )}

                {kindFilter === "all" && cats.length > 1 && (
                    <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                            {t("rec.detail_cat")}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => setCatFilter("all")} className="lysia-btn lysia-focus" style={pillBtn(catFilter === "all", T.textDim)}>{t("rec.all")}</button>
                            {cats.map(c => (
                                <button key={c} type="button" onClick={() => setCatFilter(c)} className="lysia-btn lysia-focus" style={pillBtn(catFilter === c, T.blue)}>
                                    {CAT[c] || c}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {filtered.length === 0 ? (
                    <EmptyState
                        icon="📋"
                        title={recFilter === "pending" ? t("rec.all_done") : t("rec.no_category")}
                        description={t("rec.use_button")}
                    />
                ) : (
                    <div className="lysia-anim-stagger" style={{
                        display: "grid",
                        gridTemplateColumns: isMobile || isTablet ? "1fr" : "repeat(auto-fill, minmax(min(100%, 400px), 1fr))",
                        gap: "1rem",
                        width: "100%",
                        alignItems: "stretch",
                    }}>
                        {filtered.map((rec) => {
                            const pc = PRI[rec.priority] || PRI.medium;
                            const isSel = selected.has(rec._id);
                            const kind = getRecommendationKind(rec);
                            const kc = KIND[kind];
                            return (
                                <article
                                    key={rec._id}
                                    className="lysia-hover-lift"
                                    style={{
                                        borderRadius: T.rMd,
                                        border: `1px solid ${isSel ? T.accent + "55" : T.border}`,
                                        background: isSel ? T.accentDim : T.bgCard,
                                        boxShadow: isSel ? `0 8px 28px ${T.accent}10` : T.shadow,
                                        overflow: "hidden",
                                        transition: "box-shadow 0.25s, border-color 0.2s",
                                    }}
                                >
                                    <div style={{
                                        display: "flex",
                                        alignItems: "stretch",
                                        minHeight: 4,
                                        background: `linear-gradient(90deg, ${kc.accent}, ${pc.color}88)`,
                                    }} aria-hidden="true" />
                                    <div style={{ padding: isMobile ? "1rem" : "1.15rem 1.35rem" }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                            {rec.status === "pending" && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSel}
                                                    onChange={() => toggle(rec._id)}
                                                    aria-label={`Select: ${rec.title}`}
                                                    style={{ marginTop: 6, cursor: "pointer", accentColor: T.accent, flexShrink: 0 }}
                                                />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                                                    <span style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        fontSize: "0.68rem",
                                                        fontWeight: 800,
                                                        letterSpacing: "0.06em",
                                                        textTransform: "uppercase",
                                                        color: kc.accent,
                                                        background: kc.accentDim,
                                                        border: `1px solid ${kc.border}`,
                                                        padding: "4px 10px",
                                                        borderRadius: T.rFull,
                                                    }}>
                                                        {kc.icon} {kc.long}
                                                    </span>
                                                    <Badge color={pc.color} size="sm">{pc.icon} {pc.label}</Badge>
                                                    {rec.category && (
                                                        <Badge color={T.blue} size="sm">{CAT[rec.category] || rec.category}</Badge>
                                                    )}
                                                </div>
                                                <h3 style={{
                                                    margin: 0,
                                                    fontSize: isMobile ? "0.95rem" : "1.02rem",
                                                    fontWeight: 800,
                                                    color: T.text,
                                                    lineHeight: 1.35,
                                                    letterSpacing: "-0.02em",
                                                }}>
                                                    {rec.title}
                                                </h3>
                                                <div style={{
                                                    marginTop: "0.65rem",
                                                    padding: "0.75rem 0.9rem",
                                                    borderRadius: T.rSm,
                                                    background: "rgba(255,255,255,0.03)",
                                                    border: `1px solid ${T.borderLight}`,
                                                    fontSize: "0.84rem",
                                                    color: T.textSec,
                                                    lineHeight: 1.65,
                                                }}>
                                                    {rec.description}
                                                </div>

                                                {/* Fiyat aksiyon detayı: şu an / değişim / onaylarsan */}
                                                {(() => {
                                                    const det = getActionPriceDetails(rec);
                                                    if (!det) return null;
                                                    if (det.kind === "price_change" || det.kind === "discount") {
                                                        const dirColor = det.direction === "down" ? T.green : T.red;
                                                        const showPct = det.kind === "discount"
                                                            ? `-%${det.discountPercent}`
                                                            : `${det.pct > 0 ? "+" : ""}%${det.pct}`;
                                                        return (
                                                            <div style={{
                                                                marginTop: "0.65rem",
                                                                padding: "0.75rem 0.9rem",
                                                                borderRadius: T.rSm,
                                                                background: `${dirColor}10`,
                                                                border: `1px solid ${dirColor}40`,
                                                                display: "grid",
                                                                gridTemplateColumns: "1fr auto 1fr",
                                                                gap: "0.5rem",
                                                                alignItems: "center",
                                                            }}>
                                                                <div style={{ textAlign: "center" }}>
                                                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Şu anki fiyat</div>
                                                                    <div style={{ fontSize: "1.05rem", color: T.text, fontWeight: 800, fontFamily: T.fontMono, textDecoration: det.direction === "down" ? "line-through" : "none", opacity: det.direction === "down" ? 0.6 : 1 }}>
                                                                        {fmt(det.oldPrice)}
                                                                    </div>
                                                                </div>
                                                                <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
                                                                    <div style={{ fontSize: "1.4rem", color: dirColor, fontWeight: 900 }}>→</div>
                                                                    <Badge color={dirColor} size="sm">{showPct}</Badge>
                                                                </div>
                                                                <div style={{ textAlign: "center" }}>
                                                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Onaylarsan</div>
                                                                    <div style={{ fontSize: "1.15rem", color: dirColor, fontWeight: 900, fontFamily: T.fontMono }}>
                                                                        {fmt(det.newPrice)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    if (det.kind === "discount_only") {
                                                        return (
                                                            <div style={{
                                                                marginTop: "0.65rem",
                                                                padding: "0.6rem 0.85rem",
                                                                borderRadius: T.rSm,
                                                                background: `${T.green}10`,
                                                                border: `1px solid ${T.green}40`,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.5rem",
                                                                fontSize: "0.82rem",
                                                                color: T.text,
                                                            }}>
                                                                <Badge color={T.green} size="sm">-%{det.discountPercent}</Badge>
                                                                <span style={{ color: T.textSec }}>İndirim uygulanacak (mevcut fiyat üzerinden)</span>
                                                            </div>
                                                        );
                                                    }
                                                    if (det.kind === "restock") {
                                                        return (
                                                            <div style={{
                                                                marginTop: "0.65rem",
                                                                padding: "0.6rem 0.85rem",
                                                                borderRadius: T.rSm,
                                                                background: `${T.blue}10`,
                                                                border: `1px solid ${T.blue}40`,
                                                                fontSize: "0.82rem",
                                                                color: T.text,
                                                            }}>
                                                                📦 Önerilen sipariş: <b style={{ color: T.blue }}>{det.qty} adet</b>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                {/* Guardrail / Otonomi Kuralı izi (kullanıcı neden bu öneri böyle göründüğünü görsün) */}
                                                {(rec.guardrailNote || rec.ruleTrace?.clampApplied || rec.ruleTrace?.source === "category" || (Array.isArray(rec.blockReasons) && rec.blockReasons.length > 0)) && (
                                                    <div style={{
                                                        marginTop: "0.65rem",
                                                        padding: "0.55rem 0.8rem",
                                                        borderRadius: T.rSm,
                                                        background: rec.blocked ? `${T.red}10` : `${T.cyan}10`,
                                                        border: `1px dashed ${rec.blocked ? T.red : T.cyan}50`,
                                                        fontSize: "0.74rem",
                                                        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                                                    }}>
                                                        <span style={{ fontSize: "0.9rem" }} aria-hidden="true">🎛️</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            {rec.blocked && Array.isArray(rec.blockReasons) && rec.blockReasons.length > 0 && (
                                                                <div style={{ color: T.red, fontWeight: 700, marginBottom: 2 }}>
                                                                    Otonomi kuralı engelledi: {rec.blockReasons.join(" · ")}
                                                                </div>
                                                            )}
                                                            {rec.guardrailNote && (
                                                                <div style={{ color: T.textSec }}>
                                                                    <b style={{ color: T.cyan }}>Kural uygulandı:</b> {rec.guardrailNote}
                                                                </div>
                                                            )}
                                                            {rec.ruleTrace?.source === "category" && rec.ruleTrace?.targetMargin && !rec.guardrailNote && (
                                                                <div style={{ color: T.textSec }}>
                                                                    <b style={{ color: T.purple }}>Kategori kuralı:</b> hedef marj %{rec.ruleTrace.targetMargin}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => { try { window.dispatchEvent(new CustomEvent("lysia-goto-tab", { detail: "autonomy" })); } catch {} }}
                                                            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textSec, fontSize: "0.68rem", padding: "3px 8px", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}>
                                                            Kurallara git
                                                        </button>
                                                    </div>
                                                )}

                                                {rec.confidenceScore > 0 && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "0.75rem", fontSize: "0.74rem", color: T.textMuted }}>
                                                        <span style={{ fontWeight: 700 }}>{t("rec.confidence")}</span>
                                                        <div style={{ flex: 1, maxWidth: 120, height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                                            <div style={{
                                                                height: "100%",
                                                                width: `${Math.min(100, rec.confidenceScore)}%`,
                                                                borderRadius: T.rFull,
                                                                background: rec.confidenceScore >= 80 ? T.green : rec.confidenceScore >= 60 ? T.accent : T.yellow,
                                                            }} />
                                                        </div>
                                                        <span style={{ fontWeight: 800, fontFamily: T.fontMono }}>{rec.confidenceScore}%</span>
                                                    </div>
                                                )}
                                                {rec.impact && (rec.impact.profitChange !== 0 || rec.impact.revenueChange !== 0) && (
                                                    <div style={{ display: "flex", gap: 8, marginTop: "0.65rem", flexWrap: "wrap" }}>
                                                        {rec.impact.profitChange !== 0 && (
                                                            <Badge color={rec.impact.profitChange > 0 ? T.green : T.red} size="sm">
                                                                {rec.impact.profitChange > 0 ? "📈" : "📉"} {t("rec.profit")}: {fmt(Math.abs(rec.impact.profitChange))}
                                                            </Badge>
                                                        )}
                                                        {rec.impact.revenueChange !== 0 && (
                                                            <Badge color={rec.impact.revenueChange > 0 ? T.green : T.red} size="sm">
                                                                {rec.impact.revenueChange > 0 ? "📈" : "📉"} {t("rec.revenue")}: {fmt(Math.abs(rec.impact.revenueChange))}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 8,
                                            marginTop: "1rem",
                                            paddingTop: "1rem",
                                            borderTop: `1px solid ${T.border}`,
                                            alignItems: "center",
                                        }}>
                                            <Btn color={T.blue} variant="ghost" size="sm" onClick={() => onExplain(rec._id)}>
                                                🔍 {t("rec.explain") || "Analiz et"}
                                            </Btn>
                                            {lastAction?.recId === rec._id && (
                                                <Badge color={lastAction.action === "approved" ? T.green : lastAction.action === "executed" ? T.accent : T.red} size="sm">
                                                    {lastAction.action === "approved" ? `✅ ${t("rec.approved_ok") || "Onaylandı!"}` : lastAction.action === "executed" ? `⚡ ${t("rec.executed_ok") || "Uygulandı!"}` : `🚫 ${t("rec.rejected_ok") || "Reddedildi!"}`}
                                                </Badge>
                                            )}
                                            {rec.status === "pending" && (
                                                <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", marginLeft: isMobile ? 0 : "auto" }}>
                                                    <Btn color={T.green} onClick={() => handleApproveWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ flex: isMobile ? 1 : "initial", minWidth: isMobile ? 0 : 120 }}>
                                                        {actionLoading === rec._id ? "⏳" : "✔️"} {t("rec.approve")}
                                                    </Btn>
                                                    <Btn color={T.red} variant="ghost" onClick={() => handleRejectWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ flex: isMobile ? 1 : "initial" }}>
                                                        {actionLoading === rec._id ? "⏳" : "✕"} {t("rec.reject")}
                                                    </Btn>
                                                </div>
                                            )}
                                            {rec.status === "approved" && (
                                                <Btn color={T.accent} variant="solid" onClick={() => handleExecuteWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto" }}>
                                                    {actionLoading === rec._id ? "⏳" : "⚡"} {t("rec.execute")}
                                                </Btn>
                                            )}
                                            {(rec.status === "executed" || rec.status === "rejected") && (
                                                <Badge color={rec.status === "executed" ? T.green : T.red} style={{ marginLeft: isMobile ? 0 : "auto" }}>
                                                    {rec.status === "executed" ? `✅ ${t("rec.executed_badge")}` : `🚫 ${t("rec.rejected_badge")}`}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default React.memo(BrainRecommendations);
