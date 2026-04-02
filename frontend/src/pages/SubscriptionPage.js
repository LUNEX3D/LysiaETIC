/**
 * SubscriptionPage — Kullanıcı Abonelik & Ödeme Sayfası
 *
 * - Mevcut abonelik durumu
 * - Kalan gün sayısı
 * - Paket seçimi (aylık / yıllık)
 * - PayTR iframe ile ödeme
 * - Ödeme geçmişi
 *
 * ✅ FIX: PayTR iframe postMessage dinleniyor
 * ✅ FIX: Ödeme sonrası otomatik yenileme
 * ✅ FIX: Hata mesajları iyileştirildi
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../services/api";
import {
    FaCheckCircle, FaExclamationTriangle,
    FaHistory, FaInfoCircle
} from "react-icons/fa";

const SubscriptionPage = () => {
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [plans, setPlans] = useState({});
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [iframeUrl, setIframeUrl] = useState("");
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const pollIntervalRef = useRef(null);

    const navigate = useNavigate();

    useEffect(() => {
        loadAll();
        return () => {
            // Cleanup: polling interval'ı temizle
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── PayTR iframe postMessage dinleyicisi ─────────────────────────────────
    useEffect(() => {
        const handleMessage = (event) => {
            // PayTR iframe'den gelen mesajları dinle
            if (event.origin && event.origin.includes("paytr.com")) {
                try {
                    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                    if (data.status === "success" || data.payment_status === "success") {
                        setShowPaymentModal(false);
                        setIframeUrl("");
                        setSuccessMessage("Ödemeniz başarıyla tamamlandı! Aboneliğiniz aktifleştiriliyor...");
                        // Callback'in işlenmesi için biraz bekle, sonra durumu yenile
                        startPollingSubscription();
                    } else if (data.status === "failed" || data.payment_status === "failed") {
                        setShowPaymentModal(false);
                        setIframeUrl("");
                        setError("Ödeme işlemi başarısız oldu. Lütfen tekrar deneyin.");
                    }
                } catch {
                    // JSON parse edilemezse string mesaj olabilir
                    if (typeof event.data === "string") {
                        if (event.data.includes("success")) {
                            setShowPaymentModal(false);
                            setIframeUrl("");
                            setSuccessMessage("Ödemeniz başarıyla tamamlandı! Aboneliğiniz aktifleştiriliyor...");
                            startPollingSubscription();
                        } else if (event.data.includes("fail")) {
                            setShowPaymentModal(false);
                            setIframeUrl("");
                            setError("Ödeme işlemi başarısız oldu. Lütfen tekrar deneyin.");
                        }
                    }
                }
            }
        };

        if (showPaymentModal) {
            window.addEventListener("message", handleMessage);
        }

        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [showPaymentModal]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Ödeme sonrası abonelik durumunu polling ile kontrol et ────────────────
    const startPollingSubscription = useCallback(() => {
        let attempts = 0;
        const maxAttempts = 15; // 15 deneme x 2 saniye = 30 saniye

        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await axios.get("/paytr/subscription");
                if (res.data.success) {
                    const sub = res.data.subscription;
                    setSubscription(sub);
                    setPayments(res.data.payments || []);
                    if (res.data.plans && Object.keys(res.data.plans).length > 0) {
                        setPlans(res.data.plans);
                    }

                    // Abonelik aktifleştiyse polling'i durdur
                    if (sub.isActive && sub.plan !== "trial" && sub.status === "active") {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        setSuccessMessage(`${sub.plan.toUpperCase()} paketiniz başarıyla aktifleştirildi! 🎉`);
                    }
                }
            } catch (err) {
                console.warn("Polling hatası:", err.message);
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                // Son bir kez daha yenile
                loadSubscriptionStatus();
            }
        }, 2000);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Planları ve abonelik durumunu paralel yükle
    const loadAll = async () => {
        setLoading(true);
        setError("");
        try {
            // İki isteği paralel at — biri başarısız olsa diğeri çalışsın
            const [subRes, plansRes] = await Promise.allSettled([
                axios.get("/paytr/subscription"),
                axios.get("/paytr/plans")
            ]);

            // Abonelik durumu
            if (subRes.status === "fulfilled" && subRes.value.data.success) {
                setSubscription(subRes.value.data.subscription);
                setPayments(subRes.value.data.payments || []);
                // Subscription endpoint'inden gelen planları da al
                if (subRes.value.data.plans && Object.keys(subRes.value.data.plans).length > 0) {
                    setPlans(subRes.value.data.plans);
                }
            } else {
                console.warn("Abonelik durumu alınamadı:", subRes.reason?.message || "Bilinmeyen hata");
            }

            // Planlar — subscription'dan gelemediyse public endpoint'ten al
            if (plansRes.status === "fulfilled" && plansRes.value.data.success) {
                const plansArr = plansRes.value.data.plans || [];
                // Array formatından obje formatına çevir (frontend Object.entries bekliyor)
                if (Array.isArray(plansArr) && plansArr.length > 0) {
                    const plansObj = {};
                    plansArr.forEach(p => { plansObj[p.id] = p; });
                    setPlans(prev => Object.keys(prev).length > 0 ? prev : plansObj);
                }
            }

            // Her iki istek de başarısız olduysa hata göster
            if (subRes.status === "rejected" && plansRes.status === "rejected") {
                setError("Abonelik bilgileri ve paketler yüklenemedi. Lütfen sayfayı yenileyin.");
            }
        } catch (err) {
            console.error("loadAll hatası:", err);
            setError("Veriler yüklenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    // Sadece abonelik durumunu yenile (plan seçimi sonrası)
    const loadSubscriptionStatus = async () => {
        try {
            const res = await axios.get("/paytr/subscription");
            if (res.data.success) {
                setSubscription(res.data.subscription);
                setPayments(res.data.payments || []);
                if (res.data.plans && Object.keys(res.data.plans).length > 0) {
                    setPlans(res.data.plans);
                }
            }
        } catch (err) {
            console.warn("Abonelik durumu yenilenemedi:", err.message);
        }
    };

    // Plan seviye sırası — backend ile aynı
    const PLAN_RANK = { trial: 0, free: 0, basic: 1, pro: 2, enterprise: 3 };

    const handleSelectPlan = async (planId) => {
        setSelectedPlan(planId);
        setPaymentLoading(true);
        setError("");
        setSuccessMessage("");

        try {
            const res = await axios.post("/paytr/create-payment", {
                plan: planId,
                billingCycle
            });

            if (res.data.iframeUrl) {
                setIframeUrl(res.data.iframeUrl);
                setShowPaymentModal(true);
            } else if (res.data.success && res.data.message) {
                setSuccessMessage(res.data.message);
                setTimeout(() => loadSubscriptionStatus(), 1000);
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || "Ödeme başlatılamadı";
            setError(errMsg);
        } finally {
            setPaymentLoading(false);
        }
    };

    const closePaymentModal = () => {
        setShowPaymentModal(false);
        setIframeUrl("");
        setSelectedPlan(null);
        // Ödeme sonrası durumu polling ile yenile (callback'in işlenmesini bekle)
        startPollingSubscription();
    };

    if (loading) {
        return (
            <div style={S.page}>
                <div style={S.loading}>Yükleniyor...</div>
            </div>
        );
    }

    const sub = subscription || {};
    const isActive = sub.isActive || false;
    const isTrial = sub.plan === "trial" || sub.status === "trial";
    const daysLeft = sub.daysLeft || sub.trialDaysLeft || 0;

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div>
                    <h1 style={S.title}>Abonelik & Paketler</h1>
                    <p style={S.subtitle}>Planınızı yönetin ve ödemelerinizi görüntüleyin</p>
                </div>
                <button style={S.backBtn} onClick={() => navigate("/dashboard")}>
                    ← Panele Dön
                </button>
            </div>

            {error && (
                <div style={S.alert}>
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            {successMessage && (
                <div style={{
                    padding: "16px 20px",
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    borderRadius: "12px",
                    color: "#34d399",
                    marginBottom: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                }}>
                    <FaCheckCircle /> {successMessage}
                </div>
            )}

            {/* Current Subscription Status */}
            <div style={S.statusCard(isActive, isTrial)}>
                <div style={S.statusIcon(isActive)}>
                    {isActive ? <FaCheckCircle /> : <FaExclamationTriangle />}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={S.statusTitle}>
                        {isTrial ? "Demo Sürümü" : `${sub.plan?.toUpperCase()} Paketi`}
                    </div>
                    <div style={S.statusDesc}>
                        {isActive
                            ? `${daysLeft} gün kaldı`
                            : "Aboneliğiniz sona ermiş"}
                    </div>
                    {sub.grantedBy && (
                        <div style={S.grantNote}>
                            <FaInfoCircle /> {sub.grantNote || "Admin tarafından verildi"}
                        </div>
                    )}
                </div>
                {!isActive && (
                    <div style={S.statusBadge}>Süresi Dolmuş</div>
                )}
            </div>

            {/* Plans */}
            <div style={S.section}>
                <h2 style={S.sectionTitle}>Paket Seçin</h2>
                <div style={S.billingToggle}>
                    <button
                        style={S.toggleBtn(billingCycle === "monthly")}
                        onClick={() => setBillingCycle("monthly")}
                    >
                        Aylık
                    </button>
                    <button
                        style={S.toggleBtn(billingCycle === "yearly")}
                        onClick={() => setBillingCycle("yearly")}
                    >
                        Yıllık <span style={S.saveBadge}>%17 İndirim</span>
                    </button>
                </div>

                <div style={S.plansGrid}>
                    {Object.keys(plans).length === 0 ? (
                        <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                            Paketler yükleniyor...
                        </div>
                    ) : Object.entries(plans).map(([key, plan]) => {
                        const lim = plan.limits || {};
                        const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                        const isCurrentPlan = sub.plan === key && isActive;
                        const isPopular = key === "pro";

                        // Aktif ücretli paketi varsa, aynı veya alt seviye paketleri devre dışı bırak
                        const hasActivePaid = isActive && sub.plan !== "trial" && sub.plan !== "free";
                        const currentRank = PLAN_RANK[sub.plan] || 0;
                        const thisRank = PLAN_RANK[key] || 0;
                        const isDowngrade = hasActivePaid && thisRank <= currentRank;
                        const isDisabled = paymentLoading || isCurrentPlan || isDowngrade;

                        let btnText = "Paketi Seç";
                        if (paymentLoading && selectedPlan === key) btnText = "Yükleniyor...";
                        else if (isCurrentPlan) btnText = "Aktif Paket";
                        else if (isDowngrade) btnText = "Mevcut Paket Daha Yüksek";
                        else if (hasActivePaid) btnText = "Yükselt";

                        return (
                            <div key={key} style={S.planCard(isPopular, isCurrentPlan)}>
                                {isPopular && !isCurrentPlan && <div style={S.popularBadge}>EN POPÜLER</div>}
                                {isCurrentPlan && <div style={S.currentBadge}>Mevcut Paketiniz</div>}
                                <div style={S.planName}>{plan.name}</div>
                                <div style={S.planPrice}>
                                    ₺{price}
                                    <span style={S.planPeriod}>/{billingCycle === "yearly" ? "yıl" : "ay"}</span>
                                </div>
                                <ul style={S.planFeatures}>
                                    <li>✓ {lim.maxProducts === -1 ? "Sınırsız" : (lim.maxProducts || 0)} ürün</li>
                                    <li>✓ {lim.maxOrders === -1 ? "Sınırsız" : (lim.maxOrders || 0)} sipariş/ay</li>
                                    <li>✓ {lim.maxMarketplaces === -1 ? "Sınırsız" : (lim.maxMarketplaces || 0)} pazaryeri</li>
                                    <li>✓ {lim.maxUsers === -1 ? "Sınırsız" : (lim.maxUsers || 0)} kullanıcı</li>
                                </ul>
                                <button
                                    style={{...S.planBtn(isPopular, isCurrentPlan), ...(isDisabled && !isCurrentPlan ? { opacity: 0.4, cursor: "not-allowed" } : {})}}
                                    onClick={() => !isDisabled && handleSelectPlan(key)}
                                    disabled={isDisabled}
                                >
                                    {btnText}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
                <div style={S.section}>
                    <h2 style={S.sectionTitle}>
                        <FaHistory /> Ödeme Geçmişi
                    </h2>
                    <div style={S.table}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={S.tableHeader}>
                                    <th style={S.th}>Tarih</th>
                                    <th style={S.th}>Açıklama</th>
                                    <th style={S.th}>Tutar</th>
                                    <th style={S.th}>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p._id} style={S.tableRow}>
                                        <td style={S.td}>{new Date(p.createdAt).toLocaleDateString("tr-TR")}</td>
                                        <td style={S.td}>{p.description}</td>
                                        <td style={S.td}>₺{p.amount}</td>
                                        <td style={S.td}>
                                            <span style={S.statusBadgeSmall(p.status)}>
                                                {p.status === "completed" ? "Başarılı" : p.status === "pending" ? "Bekliyor" : "Başarısız"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PayTR iFrame Modal */}
            {showPaymentModal && (
                <div style={S.modal} onClick={closePaymentModal}>
                    <div style={S.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={S.modalHeader}>
                            <h3 style={S.modalTitle}>Ödeme</h3>
                            <button style={S.modalClose} onClick={closePaymentModal}>×</button>
                        </div>
                        <iframe
                            src={iframeUrl}
                            style={S.iframe}
                            frameBorder="0"
                            scrolling="yes"
                            title="PayTR Ödeme"
                        />
                        <div style={S.modalFooter}>
                            <button style={S.modalCancelBtn} onClick={closePaymentModal}>
                                İptal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const S = {
    page: {
        minHeight: "100vh",
        background: "#06080f",
        color: "#f1f5f9",
        padding: "40px 24px",
        fontFamily: "'Inter', sans-serif",
    },
    loading: {
        textAlign: "center",
        padding: "60px 20px",
        fontSize: "16px",
        color: "#64748b",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "32px",
        flexWrap: "wrap",
        gap: "16px",
    },
    title: {
        fontSize: "32px",
        fontWeight: 800,
        margin: 0,
        color: "#fff",
    },
    subtitle: {
        fontSize: "15px",
        color: "#64748b",
        margin: "8px 0 0",
    },
    backBtn: {
        padding: "12px 24px",
        background: "rgba(99,102,241,0.1)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "12px",
        color: "#818cf8",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    alert: {
        padding: "16px 20px",
        background: "rgba(248,113,113,0.1)",
        border: "1px solid rgba(248,113,113,0.2)",
        borderRadius: "12px",
        color: "#f87171",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    statusCard: (isActive, isTrial) => ({
        background: isActive
            ? "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(34,197,94,0.05))"
            : "linear-gradient(135deg, rgba(248,113,113,0.08), rgba(239,68,68,0.05))",
        border: `1px solid ${isActive ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "32px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
    }),
    statusIcon: (isActive) => ({
        width: "56px",
        height: "56px",
        borderRadius: "14px",
        background: isActive ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
        color: isActive ? "#34d399" : "#f87171",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        flexShrink: 0,
    }),
    statusTitle: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "4px",
    },
    statusDesc: {
        fontSize: "14px",
        color: "#94a3b8",
    },
    grantNote: {
        fontSize: "12px",
        color: "#64748b",
        marginTop: "8px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    statusBadge: {
        padding: "8px 16px",
        background: "rgba(248,113,113,0.15)",
        border: "1px solid rgba(248,113,113,0.3)",
        borderRadius: "10px",
        color: "#f87171",
        fontSize: "13px",
        fontWeight: 700,
    },
    section: {
        marginBottom: "48px",
    },
    sectionTitle: {
        fontSize: "22px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    billingToggle: {
        display: "flex",
        gap: "12px",
        marginBottom: "32px",
        justifyContent: "center",
    },
    toggleBtn: (active) => ({
        padding: "12px 24px",
        background: active ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "rgba(99,102,241,0.08)",
        border: active ? "none" : "1px solid rgba(99,102,241,0.15)",
        borderRadius: "12px",
        color: active ? "#fff" : "#818cf8",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    }),
    saveBadge: {
        padding: "3px 8px",
        background: "rgba(52,211,153,0.2)",
        borderRadius: "6px",
        fontSize: "11px",
        color: "#34d399",
    },
    plansGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "20px",
        maxWidth: "1100px",
        margin: "0 auto",
    },
    planCard: (isPopular, isCurrent) => ({
        background: isPopular
            ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
            : "rgba(17,22,49,0.7)",
        border: isPopular
            ? "1.5px solid rgba(99,102,241,0.35)"
            : isCurrent
                ? "1.5px solid rgba(52,211,153,0.35)"
                : "1px solid rgba(99,102,241,0.08)",
        borderRadius: "18px",
        padding: "32px 24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
    }),
    popularBadge: {
        position: "absolute",
        top: "-12px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 700,
        padding: "5px 16px",
        borderRadius: "20px",
        letterSpacing: "0.05em",
    },
    currentBadge: {
        position: "absolute",
        top: "-12px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(135deg, #34d399, #22c55e)",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 700,
        padding: "5px 16px",
        borderRadius: "20px",
    },
    planName: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "12px",
    },
    planPrice: {
        fontSize: "36px",
        fontWeight: 800,
        color: "#fff",
        marginBottom: "24px",
    },
    planPeriod: {
        fontSize: "16px",
        fontWeight: 500,
        color: "#64748b",
    },
    planFeatures: {
        listStyle: "none",
        padding: 0,
        margin: "0 0 24px",
        flex: 1,
    },
    planBtn: (isPopular, isCurrent) => ({
        width: "100%",
        padding: "14px",
        borderRadius: "12px",
        border: isPopular || isCurrent ? "none" : "1px solid rgba(99,102,241,0.3)",
        background: isPopular || isCurrent
            ? "linear-gradient(135deg, #6366f1, #7c3aed)"
            : "transparent",
        color: isPopular || isCurrent ? "#fff" : "#818cf8",
        fontSize: "14px",
        fontWeight: 700,
        cursor: isCurrent ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: isCurrent ? 0.6 : 1,
    }),
    table: {
        background: "rgba(17,22,49,0.7)",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
    },
    tableHeader: {
        background: "rgba(99,102,241,0.08)",
    },
    th: {
        padding: "16px",
        textAlign: "left",
        fontSize: "13px",
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    tableRow: {
        borderBottom: "1px solid rgba(99,102,241,0.05)",
    },
    td: {
        padding: "16px",
        fontSize: "14px",
        color: "#e2e8f0",
    },
    statusBadgeSmall: (status) => ({
        padding: "4px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        background: status === "completed"
            ? "rgba(52,211,153,0.15)"
            : status === "pending"
                ? "rgba(251,191,36,0.15)"
                : "rgba(248,113,113,0.15)",
        color: status === "completed"
            ? "#34d399"
            : status === "pending"
                ? "#fbbf24"
                : "#f87171",
    }),
    modal: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
    },
    modalContent: {
        background: "#0c0f1a",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "800px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(99,102,241,0.15)",
    },
    modalHeader: {
        padding: "24px",
        borderBottom: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    modalTitle: {
        fontSize: "20px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
    },
    modalClose: {
        background: "none",
        border: "none",
        color: "#64748b",
        fontSize: "32px",
        cursor: "pointer",
        padding: 0,
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    iframe: {
        width: "100%",
        height: "600px",
        border: "none",
    },
    modalFooter: {
        padding: "20px 24px",
        borderTop: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        justifyContent: "flex-end",
    },
    modalCancelBtn: {
        padding: "12px 24px",
        background: "rgba(248,113,113,0.1)",
        border: "1px solid rgba(248,113,113,0.2)",
        borderRadius: "12px",
        color: "#f87171",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
    },
};

export default SubscriptionPage;
