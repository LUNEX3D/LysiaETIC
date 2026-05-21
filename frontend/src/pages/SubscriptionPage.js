/**
 * SubscriptionPage — Kullanıcı Abonelik & Ödeme Sayfası
 *
 * - Mevcut abonelik durumu
 * - Kalan gün sayısı
 * - Paket seçimi (aylık / yıllık)
 * - PayTR Direkt API ile ödeme (3D Secure)
 * - Ödeme geçmişi
 *
 * ✅ PayTR Direkt API — Kart bilgileri doğrudan PayTR'a POST edilir
 * ✅ Kart bilgileri ASLA bizim sunucumuzdan geçmez
 * ✅ 3D Secure doğrulama aktif
 * ✅ Ödeme sonrası polling ile abonelik durumu kontrol
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../services/api";
import { validateCoupon } from "../services/couponApi";
import {
    FaCheckCircle, FaExclamationTriangle,
    FaHistory, FaInfoCircle, FaCreditCard, FaLock, FaTag
} from "react-icons/fa";

const SubscriptionPage = () => {
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState(null);
    const [payments, setPayments] = useState([]);
    const [plans, setPlans] = useState({});
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponMessage, setCouponMessage] = useState("");
    const [paymentCoupon, setPaymentCoupon] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [expandedFeaturesByPlan, setExpandedFeaturesByPlan] = useState({});
    const pollIntervalRef = useRef(null);
    const formRef = useRef(null);
    const paymentFlowStartedRef = useRef(false);

    // Kart bilgileri state
    const [cardForm, setCardForm] = useState({
        cc_owner: "",
        card_number: "",
        expiry_month: "",
        expiry_year: "",
        cvv: ""
    });

    // PayTR form verileri (backend'den gelir)
    const [paytrFormData, setPaytrFormData] = useState(null);
    const [paytrPaymentUrl, setPaytrPaymentUrl] = useState("");

    // Yasal onay checkbox'ları (ödeme öncesi zorunlu)
    const [legalChecks, setLegalChecks] = useState({
        distanceSales: false,
        preliminaryInfo: false,
        paymentConsent: false,
    });
    const allLegalChecked = legalChecks.distanceSales && legalChecks.preliminaryInfo && legalChecks.paymentConsent;

    const navigate = useNavigate();

    useEffect(() => {
        loadAll();
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Ödeme sonrası abonelik durumunu polling ile kontrol et ────────────────
    const startPollingSubscription = useCallback(() => {
        let attempts = 0;
        const maxAttempts = 15;

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
                loadSubscriptionStatus();
            }
        }, 2000);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setAppliedCoupon(null);
        setCouponMessage("");
        setPaymentCoupon(null);
    }, [billingCycle]);

    const getPlanBaseAmount = (planKey) => {
        const plan = plans[planKey];
        if (!plan) return 0;
        const monthlyPrice = Number(plan.monthlyPrice ?? plan.price ?? 0);
        const yearlyPrice = Number(plan.yearlyPrice ?? Math.round(monthlyPrice * 10));
        return billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
    };

    const handleApplyCoupon = async () => {
        const code = couponInput.trim();
        if (!code) {
            setCouponMessage("Kupon kodu girin");
            return;
        }
        if (orderedPlanKeys.length === 0) {
            setCouponMessage("Paketler yüklenene kadar bekleyin");
            return;
        }

        setCouponLoading(true);
        setCouponMessage("");
        setAppliedCoupon(null);
        setPaymentCoupon(null);

        try {
            const results = await Promise.all(
                orderedPlanKeys.map(async (planKey) => {
                    const baseAmount = getPlanBaseAmount(planKey);
                    try {
                        const data = await validateCoupon(code, planKey, billingCycle, baseAmount);
                        if (data.success) {
                            return {
                                planKey,
                                discountAmount: data.discountAmount,
                                finalAmount: data.finalAmount,
                                originalAmount: data.originalAmount,
                                name: data.coupon?.name || data.coupon?.code
                            };
                        }
                    } catch {
                        return null;
                    }
                    return null;
                })
            );

            const planDiscounts = {};
            results.filter(Boolean).forEach((r) => {
                planDiscounts[r.planKey] = r;
            });

            if (Object.keys(planDiscounts).length === 0) {
                setCouponMessage("Kupon geçersiz veya seçili periyot/paketler için uygun değil");
                return;
            }

            setAppliedCoupon({ code: code.toUpperCase(), planDiscounts });
            const count = Object.keys(planDiscounts).length;
            setCouponMessage(
                count === orderedPlanKeys.length
                    ? `"${code.toUpperCase()}" tüm paketlerde geçerli — indirimli fiyatlar gösteriliyor`
                    : `"${code.toUpperCase()}" ${count} pakette geçerli`
            );
        } catch (err) {
            setCouponMessage(err.response?.data?.message || "Kupon doğrulanamadı");
        } finally {
            setCouponLoading(false);
        }
    };

    const clearCoupon = () => {
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponMessage("");
        setPaymentCoupon(null);
    };

    const loadAll = async () => {
        setLoading(true);
        setError("");
        try {
            const [subRes, plansRes] = await Promise.allSettled([
                axios.get("/paytr/subscription"),
                axios.get("/paytr/plans")
            ]);

            if (subRes.status === "fulfilled" && subRes.value.data.success) {
                setSubscription(subRes.value.data.subscription);
                setPayments(subRes.value.data.payments || []);
                if (subRes.value.data.plans && Object.keys(subRes.value.data.plans).length > 0) {
                    setPlans(subRes.value.data.plans);
                }
            }

            if (plansRes.status === "fulfilled" && plansRes.value.data.success) {
                const plansArr = plansRes.value.data.plans || [];
                if (Array.isArray(plansArr) && plansArr.length > 0) {
                    const plansObj = {};
                    plansArr.forEach(p => { plansObj[p.id] = p; });
                    setPlans(plansObj);
                }
            }

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

    const PLAN_RANK = { trial: 0, free: 0, basic: 1, pro: 2, enterprise: 3 };
    const orderedPlanKeys = Object.keys(plans)
        .filter((k) => k !== "trial")
        .sort((a, b) => {
            const ra = PLAN_RANK[a] ?? 999;
            const rb = PLAN_RANK[b] ?? 999;
            if (ra !== rb) return ra - rb;
            return String(plans[a]?.name || a).localeCompare(String(plans[b]?.name || b), "tr");
        });

    const fmtPrice = (n) => {
        const val = Number(n || 0);
        return new Intl.NumberFormat("tr-TR").format(val);
    };

    const FEATURE_LABELS = {
        dashboard: "Dashboard erişimi",
        orders: "Sipariş yönetimi",
        products: "Ürün yönetimi",
        analytics: "Analitik",
        cargo: "Kargo takibi",
        ai: "AI özellikleri",
        radar: "Radar içgörüleri",
        autoorder: "Otomatik sipariş",
        einvoice: "E-fatura",
        all: "Tüm özellikler",
    };

    const normalizeFeatureText = (feature) => {
        const raw = String(feature || "").trim();
        if (!raw) return "";
        const lower = raw.toLowerCase().replace(/\s+/g, "");
        if (FEATURE_LABELS[lower]) return FEATURE_LABELS[lower];
        // camelCase / snake-case / slug metinleri okunaklı hale getir
        return raw
            .replace(/[_-]+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\s+/g, " ")
            .trim();
    };

    const formatLimit = (n) => (n >= 999999 || n >= 999 ? "Sınırsız" : Number(n || 0).toLocaleString("tr-TR"));

    const normalizePlanFeatures = (plan) => {
        const lim = plan?.limits || {};
        const limitSummary = [
            `${formatLimit(lim.maxProducts)} ürün kapasitesi`,
            `${formatLimit(lim.maxOrders)} sipariş/ay`,
            `${formatLimit(lim.maxMarketplaces)} pazaryeri bağlantısı`,
            `${formatLimit(lim.maxUsers)} kullanıcı hesabı`,
        ];

        if (Array.isArray(plan?.features) && plan.features.length > 0) {
            const mapped = plan.features
                .map(normalizeFeatureText)
                .filter(Boolean);
            return [...new Set([...limitSummary, ...mapped])];
        }
        return limitSummary;
    };

    const categorizeFeature = (feature) => {
        const l = feature.toLowerCase();
        if (l.includes("kapasite") || l.includes("bağlantı") || l.includes("hesabı") || l.includes("sipariş/ay")) {
            return "Paket Limitleri";
        }
        if (l.includes("dashboard") || l.includes("rapor") || l.includes("analitik") || l.includes("metrik")) {
            return "Raporlama & Analitik";
        }
        if (l.includes("sipariş") || l.includes("kargo") || l.includes("teslimat")) return "Sipariş & Lojistik";
        if (l.includes("ürün") || l.includes("pazaryeri") || l.includes("entegrasyon") || l.includes("trendyol") || l.includes("hepsiburada") || l.includes("amazon") || l.includes("n11")) {
            return "Ürün & Pazaryeri";
        }
        if (l.includes("ai") || l.includes("radar") || l.includes("otomatik")) return "AI & Otomasyon";
        if (l.includes("fatura") || l.includes("finans") || l.includes("gelir")) return "Finans & Faturalama";
        if (l.includes("destek") || l.includes("sla") || l.includes("chat")) return "Destek & SLA";
        if (l.includes("api") || l.includes("kullanıcı") || l.includes("sınırsız") || l.includes("white-label") || l.includes("2fa")) {
            return "Altyapı & Kurumsal";
        }
        return "Genel Özellikler";
    };

    const buildFeatureGroups = (features) => {
        const groups = {};
        features.forEach((f) => {
            const key = categorizeFeature(f);
            if (!groups[key]) groups[key] = [];
            groups[key].push(f);
        });
        return groups;
    };

    // ── Plan seçildiğinde backend'den form verilerini al ─────────────────────
    const handleSelectPlan = async (planId) => {
        setSelectedPlan(planId);
        setPaymentLoading(true);
        setError("");
        setSuccessMessage("");

        try {
            const useCoupon = appliedCoupon?.planDiscounts?.[planId]
                ? appliedCoupon.code
                : undefined;

            const res = await axios.post("/paytr/create-payment", {
                plan: planId,
                billingCycle,
                ...(useCoupon ? { couponCode: useCoupon } : {})
            });

            if (res.data.success && res.data.formData) {
                // Direkt API — form verilerini kaydet ve kart formu modal'ını aç
                setPaytrFormData(res.data.formData);
                setPaytrPaymentUrl(res.data.paymentUrl);
                setPaymentCoupon(res.data.coupon || null);
                paymentFlowStartedRef.current = false;
                setCardForm({ cc_owner: "", card_number: "", expiry_month: "", expiry_year: "", cvv: "" });
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

    // ── Kart bilgileri ile ödeme yap — hidden form ile PayTR'a POST ──────────
    const handleSubmitPayment = (e) => {
        e.preventDefault();

        // Validasyon
        if (!cardForm.cc_owner.trim()) { setError("Kart sahibi adı zorunludur."); return; }
        if (!cardForm.card_number.replace(/\s/g, "") || cardForm.card_number.replace(/\s/g, "").length < 15) { setError("Geçerli bir kart numarası girin."); return; }
        if (!cardForm.expiry_month) { setError("Son kullanma ayı seçin."); return; }
        if (!cardForm.expiry_year) { setError("Son kullanma yılı seçin."); return; }
        if (!cardForm.cvv || cardForm.cvv.length < 3) { setError("Geçerli bir CVV girin."); return; }

        setError("");

        // Kart numarasındaki boşlukları temizle (PayTR boşluksuz bekler)
        const cleanCardNumber = cardForm.card_number.replace(/\s/g, "");

        // Hidden form'daki card_number input'unu güncelle
        if (formRef.current) {
            const cardInput = formRef.current.querySelector('input[name="card_number"]');
            if (cardInput) {
                cardInput.value = cleanCardNumber;
            }
            paymentFlowStartedRef.current = true;
            // Kart bilgileri ASLA bizim sunucumuzdan geçmez — doğrudan PayTR'a gider
            formRef.current.submit();
        }
    };

    const closePaymentModal = () => {
        setShowPaymentModal(false);
        setPaytrFormData(null);
        setPaytrPaymentUrl("");
        setSelectedPlan(null);
        setCardForm({ cc_owner: "", card_number: "", expiry_month: "", expiry_year: "", cvv: "" });
        setLegalChecks({ distanceSales: false, preliminaryInfo: false, paymentConsent: false });
        if (paymentFlowStartedRef.current) {
            startPollingSubscription();
        }
        paymentFlowStartedRef.current = false;
    };

    // Kart numarası formatlama (4'lü gruplar)
    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || "";
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(" ") : v;
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
    const daysLeft = sub.daysLeft ?? sub.trialDaysLeft ?? 0;
    const hasPaidActivation = Boolean(sub.lastPaymentId) && sub.plan !== "trial";
    const showAdminGrantNote = Boolean(sub.grantedBy) && isTrial && !hasPaidActivation;

    // Yıl seçenekleri (şu anki yıl + 15 yıl)
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let i = 0; i < 15; i++) {
        const y = currentYear + i;
        yearOptions.push(String(y).slice(-2)); // "25", "26", ...
    }

    return (
        <div style={S.page}>
            <div style={S.container}>
            {/* Header */}
            <div style={S.headerCard}>
                <div style={S.header}>
                    <div>
                        <h1 style={S.title}>Abonelik & Paketler</h1>
                        <p style={S.subtitle}>Planınızı yönetin ve ödemelerinizi güvenle görüntüleyin</p>
                    </div>
                    <button style={S.backBtn} onClick={() => navigate("/dashboard")}>
                        ← Panele Dön
                    </button>
                </div>
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
                    {showAdminGrantNote && (
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
                <p style={S.sectionSub}>İhtiyacınıza göre plan seçin, detayları açıp karşılaştırın.</p>
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

                <div style={S.couponBox}>
                    <div style={S.couponTitle}>
                        <FaTag style={{ color: "#818cf8" }} /> İndirim Kuponu
                    </div>
                    <p style={S.couponHint}>
                        Satın alma öncesi kupon kodunuzu girin. Geçerli paketlerde indirimli fiyat otomatik gösterilir.
                    </p>
                    <div style={S.couponRow}>
                        <input
                            type="text"
                            style={S.couponInput}
                            placeholder="Örn. YAZ2026"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        />
                        <button
                            type="button"
                            style={S.couponApplyBtn}
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponInput.trim()}
                        >
                            {couponLoading ? "Kontrol…" : "Uygula"}
                        </button>
                        {appliedCoupon && (
                            <button type="button" style={S.couponClearBtn} onClick={clearCoupon}>
                                Kaldır
                            </button>
                        )}
                    </div>
                    {couponMessage && (
                        <div style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: appliedCoupon ? "#34d399" : "#f87171"
                        }}>
                            {couponMessage}
                        </div>
                    )}
                </div>

                <div style={S.plansGrid}>
                    {Object.keys(plans).length === 0 ? (
                        <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                            Paketler yükleniyor...
                        </div>
                    ) : orderedPlanKeys.map((key) => {
                        const plan = plans[key];
                        const monthlyPrice = Number(plan.monthlyPrice ?? plan.price ?? 0);
                        const yearlyPrice = Number(plan.yearlyPrice ?? Math.round(monthlyPrice * 10));
                        const price = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
                        const discount = appliedCoupon?.planDiscounts?.[key];
                        const features = normalizePlanFeatures(plan);
                        const featureGroups = buildFeatureGroups(features);
                        const isExpanded = !!expandedFeaturesByPlan[key];
                        const isCurrentPlan = sub.plan === key && isActive;
                        const isPopular = key === "pro" || (plan.badge || "").includes("POPÜLER");

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
                                {isPopular && !isCurrentPlan && <div style={S.popularBadge}>{plan.badge || "EN POPÜLER"}</div>}
                                {!isPopular && plan.badge && !isCurrentPlan && <div style={S.popularBadge}>{plan.badge}</div>}
                                {isCurrentPlan && <div style={S.currentBadge}>Mevcut Paketiniz</div>}
                                <div style={S.planName}>{plan.name}</div>
                                {plan.description && (
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, lineHeight: 1.5 }}>
                                        {plan.description}
                                    </div>
                                )}
                                <div style={S.planPrice}>
                                    {discount ? (
                                        <>
                                            <span style={S.planPriceOld}>₺{fmtPrice(price)}</span>
                                            <span style={{ color: "#34d399" }}>₺{fmtPrice(discount.finalAmount)}</span>
                                        </>
                                    ) : (
                                        <>₺{fmtPrice(price)}</>
                                    )}
                                    <span style={S.planPeriod}>/{billingCycle === "yearly" ? "yıl" : "ay"}</span>
                                </div>
                                {discount && (
                                    <div style={S.couponBadge}>
                                        −₺{fmtPrice(discount.discountAmount)} ({appliedCoupon.code})
                                    </div>
                                )}
                                <div style={{ ...S.planFeatures, listStyle: "none", padding: 0 }}>
                                    <button
                                        type="button"
                                        style={S.featureToggleBtn}
                                        onClick={() => setExpandedFeaturesByPlan((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    >
                                        <span style={{ fontWeight: 700 }}>Paket Özellikleri ({features.length})</span>
                                        <span style={{ color: "#818cf8" }}>{isExpanded ? "Gizle ▲" : "Detayları Göster ▼"}</span>
                                    </button>

                                    {isExpanded && (
                                        <div style={S.featureGroupsWrap}>
                                            {Object.entries(featureGroups).map(([groupName, items]) => (
                                                <div key={groupName} style={S.featureGroupCard}>
                                                    <div style={S.featureGroupTitle}>{groupName}</div>
                                                    {items.map((f, i) => (
                                                        <div key={`${groupName}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#e2e8f0", padding: "3px 0", lineHeight: 1.4 }}>
                                                            <FaCheckCircle style={{ color: "#34d399", fontSize: 12, flexShrink: 0, marginTop: 3 }} />
                                                            <span>{f}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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

            {/* ═══════════════════════════════════════════════════════════════
               KART BİLGİLERİ MODAL — PayTR Direkt API
               Kart bilgileri hidden form ile doğrudan PayTR'a POST edilir
               ═══════════════════════════════════════════════════════════════ */}
            {showPaymentModal && paytrFormData && (
                <div style={S.modal} onClick={closePaymentModal}>
                    <div style={S.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={S.modalHeader}>
                            <h3 style={S.modalTitle}>
                                <FaCreditCard style={{ marginRight: 8 }} /> Güvenli Ödeme
                            </h3>
                            <button style={S.modalClose} onClick={closePaymentModal}>×</button>
                        </div>

                        {/* Güvenlik bilgisi */}
                        <div style={{
                            padding: "12px 16px", margin: "0 24px",
                            background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)",
                            borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px",
                        }}>
                            <FaLock style={{ color: "#34d399", fontSize: "14px", flexShrink: 0 }} />
                            <span style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 }}>
                                Kart bilgileriniz 256-bit SSL şifreleme ile korunur ve doğrudan PayTR güvenli ödeme altyapısına iletilir.
                                Bilgileriniz sunucularımızda saklanmaz. 3D Secure doğrulama aktiftir.
                            </span>
                        </div>

                        {/* Ödeme özeti */}
                        <div style={{
                            padding: "12px 16px", margin: "12px 24px 0",
                            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                            borderRadius: "10px",
                        }}>
                            {paymentCoupon && (
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                                    <span>Liste fiyatı</span>
                                    <span style={{ textDecoration: "line-through" }}>₺{fmtPrice(paymentCoupon.originalAmount)}</span>
                                </div>
                            )}
                            {paymentCoupon && (
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#34d399", marginBottom: 8 }}>
                                    <span>Kupon ({paymentCoupon.code})</span>
                                    <span>−₺{fmtPrice(paymentCoupon.discountAmount)}</span>
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#94a3b8", fontSize: "13px" }}>Ödenecek tutar</span>
                                <span style={{ color: "#fff", fontSize: "20px", fontWeight: 800 }}>
                                    ₺{paytrFormData.payment_amount}
                                </span>
                            </div>
                        </div>

                        {/* Kart formu — PayTR'a POST edilecek hidden form */}
                        <form
                            ref={formRef}
                            action={paytrPaymentUrl}
                            method="POST"
                            style={{ padding: "20px 24px" }}
                            onSubmit={handleSubmitPayment}
                        >
                            {/* Hidden fields — backend'den gelen PayTR form verileri */}
                            {Object.entries(paytrFormData).map(([key, value]) => (
                                <input key={key} type="hidden" name={key} value={value} />
                            ))}

                            {/* Kart Sahibi */}
                            <div style={S.formGroup}>
                                <label style={S.label}>Kart Sahibi Adı</label>
                                <input
                                    type="text"
                                    name="cc_owner"
                                    value={cardForm.cc_owner}
                                    onChange={(e) => setCardForm(p => ({ ...p, cc_owner: e.target.value.toUpperCase() }))}
                                    placeholder="AD SOYAD"
                                    style={S.input}
                                    maxLength={50}
                                    autoComplete="cc-name"
                                    required
                                />
                            </div>

                            {/* Kart Numarası */}
                            <div style={S.formGroup}>
                                <label style={S.label}>Kart Numarası</label>
                                <input
                                    type="text"
                                    name="card_number"
                                    value={cardForm.card_number}
                                    onChange={(e) => setCardForm(p => ({ ...p, card_number: formatCardNumber(e.target.value) }))}
                                    placeholder="0000 0000 0000 0000"
                                    style={S.input}
                                    maxLength={19}
                                    autoComplete="cc-number"
                                    inputMode="numeric"
                                    required
                                />
                            </div>

                            {/* Son Kullanma + CVV */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Ay</label>
                                    <select
                                        name="expiry_month"
                                        value={cardForm.expiry_month}
                                        onChange={(e) => setCardForm(p => ({ ...p, expiry_month: e.target.value }))}
                                        style={S.select}
                                        required
                                    >
                                        <option value="">Ay</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={String(m).padStart(2, "0")}>{String(m).padStart(2, "0")}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>Yıl</label>
                                    <select
                                        name="expiry_year"
                                        value={cardForm.expiry_year}
                                        onChange={(e) => setCardForm(p => ({ ...p, expiry_year: e.target.value }))}
                                        style={S.select}
                                        required
                                    >
                                        <option value="">Yıl</option>
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>20{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.label}>CVV</label>
                                    <input
                                        type="password"
                                        name="cvv"
                                        value={cardForm.cvv}
                                        onChange={(e) => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, "") }))}
                                        placeholder="•••"
                                        style={S.input}
                                        maxLength={4}
                                        autoComplete="cc-csc"
                                        inputMode="numeric"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <FaExclamationTriangle /> {error}
                                </div>
                            )}

                            {/* ═══ Yasal Onay Checkbox'ları — PayTR Zorunlu ═══ */}
                            <div style={S.legalSection}>
                                <div style={S.legalCheck} onClick={() => setLegalChecks(p => ({ ...p, preliminaryInfo: !p.preliminaryInfo }))}>
                                    <div style={S.legalCheckbox(legalChecks.preliminaryInfo)}>
                                        {legalChecks.preliminaryInfo && <span style={{ fontSize: "11px" }}>✓</span>}
                                    </div>
                                    <span style={S.legalCheckText}>
                                        <a href="/preliminary-info" target="_blank" rel="noopener noreferrer" style={S.legalLink} onClick={e => e.stopPropagation()}>Ön Bilgilendirme Formu</a>'nu okudum ve kabul ediyorum.
                                    </span>
                                </div>
                                <div style={S.legalCheck} onClick={() => setLegalChecks(p => ({ ...p, distanceSales: !p.distanceSales }))}>
                                    <div style={S.legalCheckbox(legalChecks.distanceSales)}>
                                        {legalChecks.distanceSales && <span style={{ fontSize: "11px" }}>✓</span>}
                                    </div>
                                    <span style={S.legalCheckText}>
                                        <a href="/distance-sales" target="_blank" rel="noopener noreferrer" style={S.legalLink} onClick={e => e.stopPropagation()}>Mesafeli Satış Sözleşmesi</a>'ni okudum ve kabul ediyorum.
                                    </span>
                                </div>
                                <div style={S.legalCheck} onClick={() => setLegalChecks(p => ({ ...p, paymentConsent: !p.paymentConsent }))}>
                                    <div style={S.legalCheckbox(legalChecks.paymentConsent)}>
                                        {legalChecks.paymentConsent && <span style={{ fontSize: "11px" }}>✓</span>}
                                    </div>
                                    <span style={S.legalCheckText}>
                                        Ödeme yükümlülüğü altına girdiğimi kabul ediyorum.
                                    </span>
                                </div>
                            </div>

                            {/* Ödeme butonu */}
                            <button type="submit" style={{...S.payBtn, ...(!allLegalChecked ? { opacity: 0.45, cursor: "not-allowed" } : {})}} disabled={!allLegalChecked}>
                                <FaLock /> ₺{paytrFormData.payment_amount} Güvenli Ödeme Yap
                            </button>
                        </form>

                        <div style={S.modalFooter}>
                            <button style={S.modalCancelBtn} onClick={closePaymentModal}>
                                İptal
                            </button>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "11px" }}>
                                <FaLock style={{ fontSize: "10px" }} /> PayTR Güvenli Ödeme Altyapısı
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const S = {
    page: {
        minHeight: "100vh",
        background: "radial-gradient(1200px 500px at 20% -10%, rgba(99,102,241,0.12), transparent), radial-gradient(900px 400px at 100% 10%, rgba(16,185,129,0.08), transparent), #06080f",
        color: "#f1f5f9",
        padding: "32px 20px 48px",
        fontFamily: "'Inter', sans-serif",
    },
    container: {
        maxWidth: "1200px",
        margin: "0 auto",
    },
    headerCard: {
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(99,102,241,0.14)",
        borderRadius: "18px",
        padding: "20px 22px",
        marginBottom: "18px",
        backdropFilter: "blur(8px)",
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
        flexWrap: "wrap",
        gap: "16px",
    },
    title: {
        fontSize: "34px",
        fontWeight: 800,
        margin: 0,
        color: "#fff",
        letterSpacing: "-0.02em",
    },
    subtitle: {
        fontSize: "15px",
        color: "#94a3b8",
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
        borderRadius: "18px",
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
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    sectionSub: {
        fontSize: "13px",
        color: "#94a3b8",
        margin: "0 0 22px",
    },
    billingToggle: {
        display: "flex",
        gap: "8px",
        marginBottom: "32px",
        justifyContent: "center",
        background: "rgba(15,23,42,0.62)",
        border: "1px solid rgba(99,102,241,0.16)",
        borderRadius: "14px",
        padding: "6px",
        width: "fit-content",
        marginLeft: "auto",
        marginRight: "auto",
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
    couponBox: {
        maxWidth: 560,
        margin: "0 auto 28px",
        padding: "18px 20px",
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "14px",
    },
    couponTitle: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 15,
        fontWeight: 700,
        color: "#e2e8f0",
        marginBottom: 6,
    },
    couponHint: {
        fontSize: 12,
        color: "#94a3b8",
        margin: "0 0 12px",
        lineHeight: 1.5,
    },
    couponRow: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
    },
    couponInput: {
        flex: "1 1 180px",
        padding: "12px 14px",
        background: "rgba(30,41,59,0.8)",
        border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: 10,
        color: "#fff",
        fontSize: 14,
        fontFamily: "inherit",
        letterSpacing: "0.06em",
    },
    couponApplyBtn: {
        padding: "12px 20px",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        border: "none",
        borderRadius: 10,
        color: "#fff",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    couponClearBtn: {
        padding: "12px 16px",
        background: "transparent",
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 10,
        color: "#94a3b8",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    planPriceOld: {
        textDecoration: "line-through",
        color: "#64748b",
        fontSize: 16,
        marginRight: 8,
        fontWeight: 500,
    },
    couponBadge: {
        fontSize: 11,
        color: "#34d399",
        marginTop: 4,
        marginBottom: 8,
        fontWeight: 600,
    },
    plansGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "20px",
        maxWidth: "1150px",
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
        borderRadius: "20px",
        padding: "32px 24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(6px)",
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
        fontSize: "20px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "12px",
    },
    planPrice: {
        fontSize: "40px",
        fontWeight: 800,
        color: "#fff",
        marginBottom: "24px",
        letterSpacing: "-0.02em",
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
    featureToggleBtn: {
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
        border: "1px solid rgba(99,102,241,0.2)",
        background: "rgba(99,102,241,0.08)",
        borderRadius: "10px",
        color: "#c7d2fe",
        padding: "10px 12px",
        fontSize: "13px",
        cursor: "pointer",
        marginBottom: "10px",
        fontFamily: "inherit",
    },
    featureGroupsWrap: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    featureGroupCard: {
        border: "1px solid rgba(99,102,241,0.12)",
        background: "rgba(15,23,42,0.55)",
        borderRadius: "10px",
        padding: "10px 12px",
    },
    featureGroupTitle: {
        fontSize: "12px",
        fontWeight: 700,
        color: "#a5b4fc",
        marginBottom: "6px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    },
    planBtn: (isPopular, isCurrent) => ({
        width: "100%",
        padding: "14px 16px",
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
        transition: "all 0.2s",
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
    // ── Legal Checks (Ödeme Modal) ──
    legalSection: {
        marginTop: "8px",
        marginBottom: "16px",
        padding: "14px 16px",
        background: "rgba(99,102,241,0.04)",
        border: "1px solid rgba(99,102,241,0.1)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    legalCheck: {
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        cursor: "pointer",
        userSelect: "none",
    },
    legalCheckbox: (checked) => ({
        width: "20px",
        height: "20px",
        minWidth: "20px",
        borderRadius: "6px",
        border: checked ? "none" : "2px solid rgba(99,102,241,0.3)",
        background: checked ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        transition: "all 0.2s",
        marginTop: "1px",
        flexShrink: 0,
    }),
    legalCheckText: {
        fontSize: "12px",
        color: "#94a3b8",
        lineHeight: 1.5,
    },
    legalLink: {
        color: "#818cf8",
        textDecoration: "underline",
        fontWeight: 600,
    },
    // ── Modal ──
    modal: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
        backdropFilter: "blur(4px)",
    },
    modalContent: {
        background: "#0c0f1a",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "480px",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(99,102,241,0.15)",
    },
    modalHeader: {
        padding: "24px 24px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    modalTitle: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        display: "flex",
        alignItems: "center",
    },
    modalClose: {
        background: "none",
        border: "none",
        color: "#64748b",
        fontSize: "28px",
        cursor: "pointer",
        padding: 0,
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    modalFooter: {
        padding: "16px 24px 20px",
        borderTop: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    modalCancelBtn: {
        padding: "10px 20px",
        background: "rgba(248,113,113,0.1)",
        border: "1px solid rgba(248,113,113,0.2)",
        borderRadius: "10px",
        color: "#f87171",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    // ── Form ──
    formGroup: {
        marginBottom: "14px",
    },
    label: {
        display: "block",
        fontSize: "12px",
        fontWeight: 600,
        color: "#94a3b8",
        marginBottom: "6px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    input: {
        width: "100%",
        padding: "12px 14px",
        background: "rgba(15,23,42,0.8)",
        border: "1.5px solid rgba(99,102,241,0.15)",
        borderRadius: "10px",
        color: "#f1f5f9",
        fontSize: "15px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace, inherit",
        letterSpacing: "0.05em",
        outline: "none",
        transition: "border-color 0.2s",
        boxSizing: "border-box",
    },
    select: {
        width: "100%",
        padding: "12px 14px",
        background: "rgba(15,23,42,0.8)",
        border: "1.5px solid rgba(99,102,241,0.15)",
        borderRadius: "10px",
        color: "#f1f5f9",
        fontSize: "15px",
        fontFamily: "inherit",
        outline: "none",
        cursor: "pointer",
        appearance: "auto",
        boxSizing: "border-box",
    },
    payBtn: {
        width: "100%",
        padding: "16px",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        border: "none",
        borderRadius: "12px",
        color: "#fff",
        fontSize: "16px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        marginTop: "8px",
        boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
        transition: "transform 0.15s, box-shadow 0.15s",
    },
};

export default SubscriptionPage;
