import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaUndoAlt, FaSync, FaCheck, FaTimes, FaClock, FaSearch } from "react-icons/fa";
import {
    fetchClaims,
    fetchClaimReasons,
    approveClaim,
    rejectClaim,
    pendClaim,
} from "../services/claimsApi";

const MP_TABS = [
    { key: "trendyol", label: "Trendyol", match: /trendyol/i },
    { key: "hepsiburada", label: "Hepsiburada", match: /hepsi/i },
    { key: "n11", label: "N11", match: /^n11$/i },
    { key: "ciceksepeti", label: "ÇiçekSepeti", match: /cicek|çiçek/i },
];

const STATUS_OPTIONS = {
    trendyol: [
        { value: "", label: "Tümü" },
        { value: "WaitingInAction", label: "Aksiyon Bekliyor" },
        { value: "Created", label: "Oluşturuldu" },
        { value: "Accepted", label: "Onaylandı" },
        { value: "Rejected", label: "Reddedildi" },
        { value: "Cancelled", label: "İptal" },
    ],
    n11: [
        { value: "ALL", label: "Tümü" },
        { value: "REQUESTED", label: "Talep Geldi" },
        { value: "APPROVED", label: "Onaylandı" },
        { value: "DENIED", label: "Reddedildi" },
        { value: "PENDED", label: "Ertelendi" },
        { value: "CANCELLED", label: "İptal" },
    ],
    hepsiburada: [{ value: "", label: "Tümü" }],
    ciceksepeti: [{ value: "", label: "Tümü" }],
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        return new Intl.DateTimeFormat("tr-TR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        }).format(date);
    } catch {
        return String(d);
    }
};

const statusBadgeColor = (status) => {
    const s = String(status || "").toLowerCase();
    if (/accept|approved|onay/.test(s)) return { bg: "rgba(34,197,94,.15)", fg: "#22c55e" };
    if (/reject|denied|red/.test(s)) return { bg: "rgba(239,68,68,.15)", fg: "#ef4444" };
    if (/waiting|requested|created|bekl/.test(s)) return { bg: "rgba(251,191,36,.15)", fg: "#f59e0b" };
    if (/pend|ertelen/.test(s)) return { bg: "rgba(99,102,241,.15)", fg: "#818cf8" };
    if (/cancel|iptal/.test(s)) return { bg: "rgba(148,163,184,.15)", fg: "#94a3b8" };
    return { bg: "rgba(148,163,184,.12)", fg: "#cbd5e1" };
};

const S = {
    page: { padding: "24px", color: "#e2e8f0", minHeight: "70vh" },
    title: { display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 800, marginBottom: 4 },
    sub: { color: "#94a3b8", fontSize: 13, marginBottom: 20 },
    tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
    tab: (active) => ({
        padding: "8px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
        border: active ? "1px solid rgba(99,102,241,.6)" : "1px solid rgba(148,163,184,.2)",
        background: active ? "rgba(99,102,241,.18)" : "rgba(30,41,59,.5)",
        color: active ? "#a5b4fc" : "#94a3b8",
    }),
    bar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
    input: {
        background: "rgba(15,23,42,.7)", border: "1px solid rgba(148,163,184,.25)", color: "#e2e8f0",
        padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none",
    },
    btn: (variant = "primary") => ({
        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
        fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
        background:
            variant === "primary" ? "#6366f1" :
            variant === "success" ? "rgba(34,197,94,.85)" :
            variant === "danger" ? "rgba(239,68,68,.85)" :
            variant === "warn" ? "rgba(245,158,11,.85)" :
            "rgba(51,65,85,.8)",
        color: "#fff",
    }),
    tableWrap: {
        background: "rgba(15,23,42,.55)", border: "1px solid rgba(148,163,184,.15)",
        borderRadius: 14, overflow: "auto",
    },
    th: {
        textAlign: "left", padding: "12px 14px", fontSize: 11, textTransform: "uppercase",
        letterSpacing: ".06em", color: "#94a3b8", borderBottom: "1px solid rgba(148,163,184,.15)",
        whiteSpace: "nowrap",
    },
    td: { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid rgba(148,163,184,.08)", verticalAlign: "top" },
    modalOverlay: {
        position: "fixed", inset: 0, background: "rgba(2,6,23,.75)", zIndex: 11000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    },
    modal: {
        background: "#0f172a", border: "1px solid rgba(148,163,184,.25)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 520, color: "#e2e8f0",
    },
};

const ReturnsManagementPage = ({ marketplaces = [] }) => {
    const availableTabs = useMemo(() => {
        const names = (marketplaces || []).map((m) => String(m.marketplaceName || m.name || ""));
        const tabs = MP_TABS.filter((t) => names.some((n) => t.match.test(n)));
        return tabs.length > 0 ? tabs : MP_TABS;
    }, [marketplaces]);

    const [activeTab, setActiveTab] = useState(availableTabs[0]?.key || "trendyol");
    const [status, setStatus] = useState("");
    const [orderNumber, setOrderNumber] = useState("");
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [actionBusy, setActionBusy] = useState(false);

    const [modal, setModal] = useState(null);
    const [reasons, setReasons] = useState([]);
    const [reasonId, setReasonId] = useState("");
    const [description, setDescription] = useState("");
    const [pendDays, setPendDays] = useState(3);
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (!availableTabs.some((t) => t.key === activeTab)) {
            setActiveTab(availableTabs[0]?.key || "trendyol");
        }
    }, [availableTabs, activeTab]);

    const loadClaims = useCallback(async () => {
        setLoading(true);
        setError("");
        setInfo("");
        try {
            const result = await fetchClaims({
                marketplace: activeTab,
                status: status || undefined,
                orderNumber: orderNumber || undefined,
                size: 50,
            });
            if (result.success) {
                setClaims(result.claims || []);
                if ((result.claims || []).length === 0) setInfo("Bu kriterlerde iade talebi bulunamadı.");
            } else {
                setClaims([]);
                setError(result.error || result.message || "İade talepleri alınamadı");
            }
        } catch (e) {
            setClaims([]);
            setError(e.response?.data?.message || e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [activeTab, status, orderNumber]);

    useEffect(() => {
        setStatus(activeTab === "n11" ? "ALL" : "");
        setClaims([]);
    }, [activeTab]);

    useEffect(() => {
        loadClaims();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const openModal = async (type, claim) => {
        setModal({ type, claim });
        setReasonId("");
        setDescription("");
        setFile(null);
        setReasons([]);
        if (type === "reject" && (activeTab === "trendyol" || activeTab === "n11" || activeTab === "hepsiburada")) {
            try {
                const r = await fetchClaimReasons({ marketplace: activeTab, type: "reject" });
                if (r.success) setReasons(r.reasons || []);
            } catch { /* sebep listesi opsiyonel */ }
        }
        if (type === "pend") {
            try {
                const r = await fetchClaimReasons({ marketplace: "n11", type: "pending" });
                if (r.success) setReasons(r.reasons || []);
            } catch { /* opsiyonel */ }
        }
    };

    const handleApprove = async (claim) => {
        if (!window.confirm(`${claim.claimNumber || claim.claimId} numaralı iade talebi ONAYLANACAK. Emin misiniz?`)) return;
        setActionBusy(true);
        setError("");
        try {
            const result = await approveClaim({
                marketplace: activeTab,
                claimId: claim.claimId,
                orderNumber: claim.orderNumber || "",
                lineItemIds: (claim.items || []).map((it) => it.claimLineItemId).filter(Boolean),
            });
            if (result.success) {
                setInfo(result.message || (result.invoiceCancel?.cancelled
                    ? "İade onaylandı — e-Arşiv faturası iptal edildi."
                    : "İade talebi onaylandı."));
                await loadClaims();
            } else {
                setError(result.error || result.message || "Onay başarısız");
            }
        } catch (e) {
            setError(e.response?.data?.error || e.response?.data?.message || e.message);
        } finally {
            setActionBusy(false);
        }
    };

    const handleModalSubmit = async () => {
        if (!modal) return;
        const { type, claim } = modal;
        setActionBusy(true);
        setError("");
        try {
            let result;
            if (type === "reject") {
                if (!reasonId) {
                    setError("Red sebebi seçin.");
                    setActionBusy(false);
                    return;
                }
                result = await rejectClaim({
                    marketplace: activeTab,
                    claimId: claim.claimId,
                    reasonId,
                    description,
                    lineItemIds: (claim.items || []).map((it) => it.claimLineItemId).filter(Boolean),
                    file: activeTab === "trendyol" ? file : undefined,
                });
            } else {
                result = await pendClaim({
                    claimId: claim.claimId,
                    reasonId,
                    dayCount: pendDays,
                    note: description,
                });
            }
            if (result.success) {
                setInfo(type === "reject" ? "İade talebi reddedildi / itiraz oluşturuldu." : "İade talebi ertelendi.");
                setModal(null);
                await loadClaims();
            } else {
                setError(result.error || result.message || "İşlem başarısız");
            }
        } catch (e) {
            setError(e.response?.data?.error || e.response?.data?.message || e.message);
        } finally {
            setActionBusy(false);
        }
    };

    const canAct = (claim) => {
        const s = String(claim.status || "").toLowerCase();
        if (activeTab === "trendyol") return /waitinginaction/.test(s) || (claim.items || []).some((it) => /waitinginaction/i.test(it.status || ""));
        if (activeTab === "n11") return /requested|pended/.test(s);
        return true;
    };

    return (
        <div style={S.page}>
            <div style={S.title}>
                <FaUndoAlt style={{ color: "#818cf8" }} /> İade Yönetimi
            </div>
            <div style={S.sub}>
                Pazaryeri iade taleplerini görüntüleyin, onaylayın veya reddedin. Son 30 günün talepleri listelenir.
            </div>

            <div style={S.tabs}>
                {availableTabs.map((t) => (
                    <div key={t.key} style={S.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
                        {t.label}
                    </div>
                ))}
            </div>

            <div style={S.bar}>
                <select style={S.input} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {(STATUS_OPTIONS[activeTab] || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <input
                    style={{ ...S.input, width: 180 }}
                    placeholder="Sipariş no ile ara"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadClaims()}
                />
                <button style={S.btn("primary")} onClick={loadClaims} disabled={loading}>
                    {loading ? <FaSync className="fa-spin" /> : <FaSearch />} {loading ? "Yükleniyor..." : "Listele"}
                </button>
            </div>

            {error && (
                <div style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", color: "#fca5a5", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
                    {error}
                </div>
            )}
            {info && !error && (
                <div style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", color: "#a5b4fc", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
                    {info}
                </div>
            )}

            <div style={S.tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={S.th}>Talep / Sipariş</th>
                            <th style={S.th}>Müşteri</th>
                            <th style={S.th}>Ürün</th>
                            <th style={S.th}>Sebep</th>
                            <th style={S.th}>Tarih</th>
                            <th style={S.th}>Durum</th>
                            <th style={S.th}>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {claims.map((c, idx) => {
                            const badge = statusBadgeColor(c.status);
                            return (
                                <tr key={`${c.claimId}-${idx}`}>
                                    <td style={S.td}>
                                        <div style={{ fontWeight: 700 }}>{c.claimNumber || c.claimId}</div>
                                        <div style={{ color: "#94a3b8", fontSize: 12 }}>Sipariş: {c.orderNumber || "—"}</div>
                                    </td>
                                    <td style={S.td}>{c.customerName || "—"}</td>
                                    <td style={S.td}>
                                        {(c.items || []).slice(0, 3).map((it, i) => (
                                            <div key={i} style={{ marginBottom: 4 }}>
                                                <div style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {it.productName || it.sku || "—"}
                                                </div>
                                                <div style={{ color: "#64748b", fontSize: 11 }}>
                                                    {it.quantity ? `${it.quantity} adet` : ""} {it.barcode || it.sku || ""}
                                                </div>
                                            </div>
                                        ))}
                                    </td>
                                    <td style={S.td}>
                                        <div style={{ maxWidth: 200 }}>
                                            {c.reason || (c.items || [])[0]?.customerReason || "—"}
                                        </div>
                                    </td>
                                    <td style={S.td}>{fmtDate(c.claimDate)}</td>
                                    <td style={S.td}>
                                        <span style={{ background: badge.bg, color: badge.fg, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                                            {c.status || "—"}
                                        </span>
                                    </td>
                                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                                        {canAct(c) ? (
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button style={S.btn("success")} disabled={actionBusy} onClick={() => handleApprove(c)} title="İadeyi onayla">
                                                    <FaCheck />
                                                </button>
                                                <button style={S.btn("danger")} disabled={actionBusy} onClick={() => openModal("reject", c)} title="İadeyi reddet">
                                                    <FaTimes />
                                                </button>
                                                {activeTab === "n11" && (
                                                    <button style={S.btn("warn")} disabled={actionBusy} onClick={() => openModal("pend", c)} title="İadeyi ertele">
                                                        <FaClock />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: "#64748b", fontSize: 12 }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {claims.length === 0 && !loading && (
                            <tr>
                                <td style={{ ...S.td, textAlign: "center", color: "#64748b", padding: 32 }} colSpan={7}>
                                    İade talebi bulunamadı
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modal && (
                <div style={S.modalOverlay} onClick={() => !actionBusy && setModal(null)}>
                    <div style={S.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
                            {modal.type === "reject" ? "İade Talebini Reddet" : "İade Talebini Ertele"}
                            <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>
                                #{modal.claim.claimNumber || modal.claim.claimId}
                            </span>
                        </div>

                        <div style={{ display: "grid", gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                                    {modal.type === "reject" ? "Red Sebebi" : "Erteleme Sebebi"}
                                </label>
                                <select style={{ ...S.input, width: "100%" }} value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
                                    <option value="">Seçin...</option>
                                    {reasons.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {modal.type === "pend" && (
                                <div>
                                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Erteleme Gün Sayısı</label>
                                    <input
                                        type="number" min={1} max={30}
                                        style={{ ...S.input, width: "100%" }}
                                        value={pendDays}
                                        onChange={(e) => setPendDays(parseInt(e.target.value, 10) || 1)}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Açıklama</label>
                                <textarea
                                    style={{ ...S.input, width: "100%", minHeight: 70, resize: "vertical" }}
                                    maxLength={500}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detaylı açıklama (maks. 500 karakter)"
                                />
                            </div>

                            {modal.type === "reject" && activeTab === "trendyol" && (
                                <div>
                                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                                        Kanıt Dosyası (pdf/jpeg) — çoğu red sebebi için zorunlu
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        style={{ fontSize: 13, color: "#94a3b8" }}
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                            <button style={S.btn("neutral")} disabled={actionBusy} onClick={() => setModal(null)}>Vazgeç</button>
                            <button
                                style={S.btn(modal.type === "reject" ? "danger" : "warn")}
                                disabled={actionBusy}
                                onClick={handleModalSubmit}
                            >
                                {actionBusy ? "İşleniyor..." : modal.type === "reject" ? "Reddet" : "Ertele"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnsManagementPage;
