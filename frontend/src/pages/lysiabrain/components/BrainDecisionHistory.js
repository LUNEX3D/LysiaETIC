/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Karar Geçmişi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/decision-history
 * Shows: executed/rejected decisions, success rate, profit from actions
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, HealthBar, EmptyState, LoadingState, ErrorState, PageHeader, Btn } from "./shared/SharedUI";

const BrainDecisionHistory = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [audit, setAudit] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [rollbackInFlight, setRollbackInFlight] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/decisions");
            if (res.data && res.data.success !== false) setData(res.data.decisionHistory);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    const loadAudit = useCallback(async () => {
        try {
            setAuditLoading(true);
            const res = await API.get("/ai-engine/audit?rollbackable=true&limit=30");
            if (res.data?.success) setAudit(res.data.items || []);
        } catch (e) { /* silent */ }
        finally { setAuditLoading(false); }
    }, []);

    const handleRollback = useCallback(async (auditId, title) => {
        if (!window.confirm(`Bu aksiyonu geri almak istediğinize emin misiniz?\n\n${title}`)) return;
        try {
            setRollbackInFlight(auditId);
            const res = await API.post(`/ai-engine/audit/${auditId}/rollback`, { reason: "Kullanıcı geri aldı (Dashtock AI)" });
            if (res.data?.success) {
                await loadAudit();
                await load();
            } else {
                onError?.(res.data?.message || "Geri alma başarısız");
            }
        } catch (e) {
            onError?.(e.response?.data?.message || "Geri alma başarısız");
        } finally {
            setRollbackInFlight(null);
        }
    }, [load, loadAudit, onError]);

    useEffect(() => { load(); loadAudit(); }, [load, loadAudit]);

    if (loading) return <LoadingState message={t("loading.decisions")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const recentExec = data.recentExecuted || [];
    const recentRej = data.recentRejected || [];

    const tldrDH = (() => {
        const total = data.totalDecisions || 0;
        const exec = data.executed || 0;
        const success = data.successRate || 0;
        if (total === 0) return "AI henüz karar geçmişine sahip değil — önerileri onaylamaya başla, burada izlenebilir hâle gelsin.";
        return `Toplam ${total} karar verildi, ${exec} tanesi uygulandı (başarı %${success}). Toplam üretilen kâr: ${fmt(data.totalProfitFromActions || 0)}. Aşağıda son uygulamalar ve geri alma seçenekleri var.`;
    })();
    const headerStatus = (data.successRate || 0) >= 70 ? "good" : (data.successRate || 0) >= 40 ? "info" : "warning";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="📜"
                title={t("dh.title") || "Karar Geçmişi"}
                subtitle={t("dh.subtitle") || "AI'nın geçmişteki tüm kararları, sonuçları ve geri alma seçeneği"}
                tldr={tldrDH}
                status={headerStatus}
                kpis={[
                    { label: "Toplam", value: fmtN(data.totalDecisions || 0), color: T.blue },
                    { label: "Uygulanan", value: fmtN(data.executed || 0), color: T.green },
                    { label: "Reddedilen", value: recentRej.length, color: T.red },
                    { label: "Başarı Oranı", value: `%${data.successRate || 0}`, color: T.accent },
                    { label: "AI Kazancı", value: fmt(data.totalProfitFromActions || 0), color: T.green },
                    { label: "Geri Alınabilir", value: audit.length, color: T.purple, hint: "Henüz rollback'lenmemiş aksiyonlar" },
                ]}
                actions={<Btn variant="ghost" size="sm" onClick={() => { load(); loadAudit(); }}>↻ Yenile</Btn>}
            />

            {/* Success Rate */}
            <Card glow>
                <CardHeader icon="📜" title={t("dh.title")} subtitle={t("dh.subtitle")} color={T.purple} />
                <HealthBar value={data.successRate || 0} label={t("dh.success_rate")} color={T.green} />
                <div style={{ display: "flex", gap: "0.85rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.greenDim, border: `1px solid ${T.green}20`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.green, fontFamily: T.fontMono }}>{fmtN(data.successfulExecutions || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.successful")}</div>
                    </div>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.yellowDim, border: `1px solid ${T.yellow}20`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.yellow, fontFamily: T.fontMono }}>{fmtN(data.pending || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.pending")}</div>
                    </div>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.textDim, fontFamily: T.fontMono }}>{fmtN(data.expired || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.expired")}</div>
                    </div>
                </div>
            </Card>

            {/* Recent Executed */}
            {recentExec.length > 0 && (
                <Card>
                    <CardHeader icon="✅" title={t("dh.recent_executed")} subtitle={t("dh.recent_executed_sub")} color={T.green} badge={`${recentExec.length}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {recentExec.map((r, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.65rem 0.85rem", borderRadius: T.rSm,
                                background: r.success ? `${T.green}06` : `${T.red}06`,
                                border: `1px solid ${r.success ? T.green + "15" : T.red + "15"}`,
                            }}>
                                <span style={{ fontSize: "1rem", flexShrink: 0 }}>{r.success ? "✅" : "❌"}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                                    {r.message && <div style={{ fontSize: "0.72rem", color: T.textDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</div>}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                                    {r.profitChange !== 0 && (
                                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: r.profitChange >= 0 ? T.green : T.red, fontFamily: T.fontMono }}>
                                            {r.profitChange >= 0 ? "+" : ""}{fmt(r.profitChange)}
                                        </span>
                                    )}
                                    {r.executedAt && <span style={{ fontSize: "0.6rem", color: T.textDim }}>{new Date(r.executedAt).toLocaleDateString("tr-TR")}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Recent Rejected */}
            {recentRej.length > 0 && (
                <Card>
                    <CardHeader icon="❌" title={t("dh.recent_rejected")} subtitle={t("dh.recent_rejected_sub")} color={T.red} badge={`${recentRej.length}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {recentRej.map((r, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.6rem 0.85rem", borderRadius: T.rSm,
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                            }}>
                                <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>🚫</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                                </div>
                                <Badge color={T.textDim} size="sm">{r.type?.replace(/_/g, " ")}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* AI Audit — Geri alınabilir aksiyonlar */}
            <Card>
                <CardHeader
                    icon="↩️"
                    title="Geri Alınabilir AI Aksiyonları"
                    subtitle="Son 180 günde uygulanmış fiyat/indirim aksiyonları — istediğinizi tek tıkla geri alabilirsiniz"
                    color={T.yellow}
                    badge={auditLoading ? "..." : String(audit.length)}
                />
                {audit.length === 0 ? (
                    <EmptyState icon="✅" title="Geri alınacak aksiyon yok" description="Tüm AI aksiyonları onaylanmış durumda veya bu modülde yer alan tipte değil." />
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {audit.map((a) => {
                            const before = a.before?.price ?? null;
                            const after = a.after?.price ?? null;
                            const dir = before != null && after != null ? (after >= before ? "▲" : "▼") : "·";
                            return (
                                <div key={a._id} style={{
                                    display: "flex", alignItems: "center", gap: "0.65rem",
                                    padding: "0.65rem 0.85rem", borderRadius: T.rSm,
                                    background: T.bgGlass, border: `1px solid ${T.border}`,
                                }}>
                                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                                        {a.actionType === "update_price" ? "💰" : a.actionType === "apply_discount" ? "🏷️" : "🔧"}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {a.decision?.title || a.target?.productName || a.target?.barcode}
                                        </div>
                                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>
                                            {before != null && after != null ? `${fmt(before)} ${dir} ${fmt(after)}` : a.actionType}
                                            {a.trigger === "autonomous_cycle" ? " · 🤖 otonom" : " · 👤 manuel"}
                                            {a.marketplaceSync?.failed > 0 ? ` · ${a.marketplaceSync.failed} pazaryeri hata` : ""}
                                            {a.createdAt ? ` · ${new Date(a.createdAt).toLocaleDateString("tr-TR")}` : ""}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRollback(a._id, a.decision?.title || a.target?.productName || "")}
                                        disabled={rollbackInFlight === a._id}
                                        style={{
                                            flexShrink: 0,
                                            padding: "0.45rem 0.75rem",
                                            border: `1px solid ${T.yellow}50`,
                                            background: rollbackInFlight === a._id ? T.bgGlass : `${T.yellow}15`,
                                            color: T.yellow,
                                            borderRadius: T.rSm,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            cursor: rollbackInFlight === a._id ? "wait" : "pointer",
                                        }}
                                    >
                                        {rollbackInFlight === a._id ? "..." : "↩️ Geri Al"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {recentExec.length === 0 && recentRej.length === 0 && (
                <Card>
                    <EmptyState icon="📜" title={t("dh.no_data")} description={t("dh.no_data_desc")} />
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainDecisionHistory);
