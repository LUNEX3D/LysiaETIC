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
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../services/api";
import "../styles/SubscriptionPage.css";
import { validateCoupon } from "../services/couponApi";
import {
    FaCheckCircle, FaExclamationTriangle,
    FaHistory, FaInfoCircle, FaCreditCard, FaLock, FaTag,
    FaCrown, FaShieldAlt
} from "react-icons/fa";

const SubscriptionPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isStandalone = location.pathname === "/subscription";

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
    const paymentModalOpenRef = useRef(false);

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
    const [paytrIframeToken, setPaytrIframeToken] = useState(null);
    const [paytrCheckoutAmount, setPaytrCheckoutAmount] = useState(null);
    const [paytrPaymentUrl, setPaytrPaymentUrl] = useState("");
    const [paytrConfigured, setPaytrConfigured] = useState(null);
    const [paytrTestMode, setPaytrTestMode] = useState(false);
    const [pendingPayment, setPendingPayment] = useState(null);
    const [planDisplayName, setPlanDisplayName] = useState("");
    const [iframeLoading, setIframeLoading] = useState(true);
    const [paymentInstallment, setPaymentInstallment] = useState(0);
    const [installmentChoices, setInstallmentChoices] = useState([0, 2, 3, 4, 6, 9, 12]);
    const [paymentFlow, setPaymentFlow] = useState("direct");
    const [pendingPaymentId, setPendingPaymentId] = useState(null);
    const [cardType, setCardType] = useState("");
    const [binLookupLoading, setBinLookupLoading] = useState(false);
    const subscriptionRevisionRef = useRef(null);

    const PAYTR_DIRECT_HIDDEN_KEYS = new Set([
        "merchant_id", "user_ip", "merchant_oid", "email", "payment_amount", "payment_type",
        "installment_count", "currency", "test_mode", "non_3d", "merchant_ok_url", "merchant_fail_url",
        "user_name", "user_address", "user_phone", "user_basket", "debug_on", "client_lang",
        "paytr_token", "non3d_test_failed", "card_type",
    ]);

    // Yasal onay checkbox'ları (ödeme öncesi zorunlu)
    const [legalChecks, setLegalChecks] = useState({
        distanceSales: false,
        preliminaryInfo: false,
        paymentConsent: false,
    });
    const allLegalChecked = legalChecks.distanceSales && legalChecks.preliminaryInfo && legalChecks.paymentConsent;

    useEffect(() => {
        const styleId = "subscription-checkout-css";
        if (!document.getElementById(styleId)) {
            const el = document.createElement("style");
            el.id = styleId;
            el.textContent = `
              @keyframes subscriptionPaytrSpin { to { transform: rotate(360deg); } }
              .subscription-checkout-shell {
                max-width: 1080px !important;
                border-radius: 24px !important;
              }
              .subscription-checkout-grid {
                grid-template-columns: 272px minmax(0, 1fr) !important;
                overflow: hidden !important;
              }
              .subscription-checkout-payment {
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
                background: linear-gradient(180deg, #f1f5f9 0%, #e8edf4 100%);
              }
              .subscription-paytr-viewport {
                flex: 1;
                min-height: 0;
                overflow: auto;
                margin: 0 20px 12px;
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 1px 0 rgba(15,23,42,0.04), 0 8px 32px rgba(15,23,42,0.08);
                -webkit-overflow-scrolling: touch;
              }
              .subscription-paytr-viewport iframe {
                display: block;
                width: 100% !important;
                min-height: 640px;
                vertical-align: top;
              }
              @media (max-width: 900px) {
                .subscription-checkout-grid {
                  grid-template-columns: 1fr !important;
                  overflow-y: auto !important;
                }
                .subscription-checkout-aside {
                  border-right: none !important;
                  border-bottom: 1px solid rgba(148,163,184,0.12);
                }
                .subscription-paytr-viewport { margin: 0 12px 12px; min-height: 520px; }
              }
            `;
            document.head.appendChild(el);
        }
        loadAll();
        axios.get("/paytr/health")
            .then((r) => {
                setPaytrConfigured(!!r.data?.configured);
                setPaytrTestMode(String(r.data?.testMode) === "1");
                if (Array.isArray(r.data?.installmentChoices) && r.data.installmentChoices.length) {
                    setInstallmentChoices(r.data.installmentChoices);
                }
                if (r.data?.paymentFlow) setPaymentFlow(r.data.paymentFlow);
            })
            .catch(() => setPaytrConfigured(false));
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // PayTR callback sonrası abonelik — admin onayı gerekmez
    useEffect(() => {
        let syncTick = 0;
        const syncSubscription = async () => {
            if (document.hidden) return;
            syncTick += 1;
            try {
                const res = await axios.get("/paytr/subscription");
                if (!res.data?.success) return;

                const paytrNeedsSync =
                    res.data.pendingPayment
                    || (res.data.payments || []).some((p) =>
                        ["pending", "processing"].includes(p.status)
                        && p.transactionId
                    );
                if (paytrNeedsSync && syncTick % 3 === 1 && !paymentModalOpenRef.current) {
                    try {
                        await axios.post("/paytr/sync-subscription");
                    } catch {
                        /* callback gecikmiş olabilir */
                    }
                }

                const rev = res.data.subscriptionRevision;
                if (rev && rev === subscriptionRevisionRef.current) return;
                subscriptionRevisionRef.current = rev;

                const sub = res.data.subscription;
                setSubscription(sub);
                setPayments(res.data.payments || []);
                setPendingPayment(res.data.pendingPayment || null);
                if (res.data.installmentChoices?.length) {
                    setInstallmentChoices(res.data.installmentChoices);
                }
                if (res.data.paymentFlow) setPaymentFlow(res.data.paymentFlow);

                if (sub?.isActive && sub.plan !== "trial" && sub.status === "active") {
                    setSuccessMessage((prev) => prev || `${(res.data.planDisplayName || sub.plan).toString()} paketiniz aktif.`);
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                }
            } catch {
                /* sessiz */
            }
        };

        const interval = setInterval(syncSubscription, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!paytrIframeToken) return undefined;
        const scriptId = "paytr-iframe-resizer";
        const runResize = () => {
            if (typeof window.iFrameResize === "function") {
                window.iFrameResize({}, "#paytriframe");
            }
        };
        if (!document.getElementById(scriptId)) {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://www.paytr.com/js/iframeResizer.min.js";
            script.async = true;
            script.onload = runResize;
            document.body.appendChild(script);
        } else {
            runResize();
        }
        return undefined;
    }, [paytrIframeToken]);

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
                    setPendingPayment(res.data.pendingPayment || null);
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
                subscriptionRevisionRef.current = subRes.value.data.subscriptionRevision || null;
                setSubscription(subRes.value.data.subscription);
                setPayments(subRes.value.data.payments || []);
                setPendingPayment(subRes.value.data.pendingPayment || null);
                setPlanDisplayName(subRes.value.data.planDisplayName || "");
                if (subRes.value.data.installmentChoices?.length) {
                    setInstallmentChoices(subRes.value.data.installmentChoices);
                }
                if (subRes.value.data.paymentFlow) setPaymentFlow(subRes.value.data.paymentFlow);
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
                setPendingPayment(res.data.pendingPayment || null);
                setPlanDisplayName(res.data.planDisplayName || "");
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
        if (paytrConfigured === false) {
            setError(
                "Ödeme sistemi sunucuda yapılandırılmamış. Yönetici: sunucuda ~/LysiaETIC/backend/.env içine PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT ekleyip «pm2 restart backend» çalıştırmalı. (deploy.ps1 veya scripts/sync-backend-env.ps1)"
            );
            return;
        }

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
                preferredFlow: "iframe",
                ...(useCoupon ? { couponCode: useCoupon } : {})
            });

            if (res.data.paymentId) setPendingPaymentId(res.data.paymentId);
            if (res.data.orderId) {
                try {
                    sessionStorage.setItem("dashtock_paytr_oid", res.data.orderId);
                } catch {
                    /* private mode */
                }
            }

            if (res.data.success && res.data.flow === "iframe" && res.data.iframeToken) {
                setPaytrIframeToken(res.data.iframeToken);
                setPaytrFormData(null);
                setPaytrCheckoutAmount(res.data.amount ?? null);
                setPaytrPaymentUrl("");
                setPaymentCoupon(res.data.coupon || null);
                paymentFlowStartedRef.current = true;
                paymentModalOpenRef.current = true;
                setIframeLoading(true);
                setShowPaymentModal(true);
                startPollingSubscription();
            } else if (res.data.success && res.data.formData) {
                setPaytrIframeToken(null);
                setPaytrFormData(res.data.formData);
                setPaytrCheckoutAmount(res.data.amount ?? null);
                setPaytrPaymentUrl(res.data.paymentUrl);
                setPaymentCoupon(res.data.coupon || null);
                paymentFlowStartedRef.current = false;
                paymentModalOpenRef.current = true;
                setCardForm({ cc_owner: "", card_number: "", expiry_month: "", expiry_year: "", cvv: "" });
                setShowPaymentModal(true);
            } else if (res.data.success && res.data.message) {
                setSuccessMessage(res.data.message);
                setTimeout(() => loadSubscriptionStatus(), 1000);
            }
        } catch (err) {
            const data = err.response?.data || {};
            let errMsg = data.message || "Ödeme başlatılamadı";
            if (data.code === "PAYTR_NOT_CONFIGURED") {
                errMsg = data.message || "Ödeme sistemi henüz yapılandırılmamış. Sunucuda backend/.env + pm2 restart backend gerekir.";
            }
            if (data.code === "PAYTR_API_PERMISSION") {
                errMsg = data.message;
            }
            setError(errMsg);
            if (data.configHint) setPaytrConfigured(false);
        } finally {
            setPaymentLoading(false);
        }
    };

    const lookupCardBin = async (cardNumber) => {
        const digits = String(cardNumber || "").replace(/\s/g, "");
        if (digits.length < 6) {
            setCardType("");
            return null;
        }
        setBinLookupLoading(true);
        try {
            const res = await axios.post("/paytr/bin-lookup", { binNumber: digits.slice(0, 8) });
            if (res.data.success && res.data.cardType) {
                setCardType(res.data.cardType);
                return res.data.cardType;
            }
            setCardType("");
            setError(res.data?.message || "Kart taksit bilgisi alınamadı");
            return null;
        } catch (err) {
            setCardType("");
            setError(err.response?.data?.message || "BIN sorgusu başarısız");
            return null;
        } finally {
            setBinLookupLoading(false);
        }
    };

    // ── Kart bilgileri ile ödeme — PayTR Direkt API POST (https://www.paytr.com/odeme) ──
    const handleSubmitPayment = async (e) => {
        e.preventDefault();

        if (!cardForm.cc_owner.trim()) { setError("Kart sahibi adı zorunludur."); return; }
        const cleanCardNumber = cardForm.card_number.replace(/\s/g, "");
        if (!cleanCardNumber || cleanCardNumber.length < 15) { setError("Geçerli bir kart numarası girin."); return; }
        if (!cardForm.expiry_month) { setError("Son kullanma ayı seçin."); return; }
        if (!cardForm.expiry_year) { setError("Son kullanma yılı seçin."); return; }
        if (!cardForm.cvv || cardForm.cvv.length < 3) { setError("Geçerli bir CVV girin."); return; }

        setError("");
        setPaymentLoading(true);

        try {
            let resolvedCardType = cardType;
            if (paymentInstallment > 0) {
                resolvedCardType = await lookupCardBin(cleanCardNumber);
                if (!resolvedCardType) {
                    setPaymentLoading(false);
                    return;
                }
            }

            let formPayload = paytrFormData;
            if (pendingPaymentId) {
                const refresh = await axios.post("/paytr/refresh-direct-payment", {
                    paymentId: pendingPaymentId,
                    installmentCount: paymentInstallment,
                });
                if (refresh.data.success && refresh.data.formData) {
                    formPayload = refresh.data.formData;
                    setPaytrFormData(formPayload);
                    if (refresh.data.paymentUrl) setPaytrPaymentUrl(refresh.data.paymentUrl);
                }
            }

            if (!formRef.current || !formPayload) {
                setError("Ödeme formu hazır değil");
                return;
            }

            formRef.current.querySelectorAll('input[type="hidden"]').forEach((el) => el.remove());

            Object.entries({ ...formPayload, installment_count: String(paymentInstallment || 0) })
                .filter(([key]) => PAYTR_DIRECT_HIDDEN_KEYS.has(key))
                .filter(([key]) => key !== "card_type")
                .filter(([, value]) => value !== "" && value != null && value !== undefined)
                .forEach(([key, value]) => {
                    const inp = document.createElement("input");
                    inp.type = "hidden";
                    inp.name = key;
                    inp.value = String(value);
                    formRef.current.appendChild(inp);
                });

            if (paymentInstallment > 0 && resolvedCardType) {
                const ct = document.createElement("input");
                ct.type = "hidden";
                ct.name = "card_type";
                ct.value = resolvedCardType;
                formRef.current.appendChild(ct);
            }

            const cardInput = formRef.current.querySelector('input[name="card_number"]');
            if (cardInput) cardInput.value = cleanCardNumber;

            paymentFlowStartedRef.current = true;
            formRef.current.submit();
        } catch (err) {
            setError(err.response?.data?.message || "Ödeme başlatılamadı");
        } finally {
            setPaymentLoading(false);
        }
    };

    const installmentLabel = (n) => (n === 0 ? "Tek Çekim" : `${n} Taksit`);

    const handleInstallmentChange = async (count) => {
        setPaymentInstallment(count);
        setCardType("");
        if (!pendingPaymentId) return;

        if (paytrIframeToken) {
            setIframeLoading(true);
            try {
                const res = await axios.post("/paytr/update-payment-installment", {
                    paymentId: pendingPaymentId,
                    installmentCount: count,
                });
                if (res.data.iframeToken) setPaytrIframeToken(res.data.iframeToken);
            } catch (err) {
                setError(err.response?.data?.message || "Taksit seçeneği güncellenemedi");
            } finally {
                setIframeLoading(false);
            }
            return;
        }

        try {
            const res = await axios.post("/paytr/refresh-direct-payment", {
                paymentId: pendingPaymentId,
                installmentCount: count,
            });
            if (res.data.formData) {
                setPaytrFormData(res.data.formData);
                if (res.data.paymentUrl) setPaytrPaymentUrl(res.data.paymentUrl);
            }
            const digits = cardForm.card_number.replace(/\s/g, "");
            if (count > 0 && digits.length >= 6) await lookupCardBin(digits);
        } catch (err) {
            setError(err.response?.data?.message || "Taksit seçeneği güncellenemedi");
        }
    };

    const renderInstallmentPicker = () => (
        <div style={S.installmentPanel}>
            <label style={S.fieldLabel}>Ödeme şekli</label>
            <div style={S.installmentSegmented}>
                {installmentChoices.map((n) => (
                    <button
                        key={n}
                        type="button"
                        style={S.installmentSegment(paymentInstallment === n)}
                        onClick={() => handleInstallmentChange(n)}
                    >
                        {installmentLabel(n)}
                    </button>
                ))}
            </div>
            <p style={S.installmentHint}>
                {paymentInstallment === 0
                    ? "Tutar tek seferde kartınızdan tahsil edilir."
                    : `${paymentInstallment} eşit taksitte ödeme yapılır (banka oranları PayTR’de uygulanır).`}
            </p>
        </div>
    );

    const selectedPlanInfo = selectedPlan ? plans[selectedPlan] : null;
    const checkoutPlanName = selectedPlanInfo?.name || "Paket";
    const checkoutCycleLabel = billingCycle === "yearly" ? "Yıllık abonelik" : "Aylık abonelik";
    const checkoutAmountDisplay = paytrCheckoutAmount ?? paytrFormData?.payment_amount;

    const renderOrderSummary = () => (
        <aside className="subscription-checkout-aside" style={S.checkoutAside}>
            <div style={S.checkoutBrandRow}>
                <span style={S.checkoutBrandMark}>D</span>
                <div>
                    <div style={S.checkoutBrandName}>Dashtock</div>
                    <div style={S.checkoutBrandSub}>Güvenli ödeme</div>
                </div>
            </div>
            <div style={S.checkoutSteps}>
                <span style={S.checkoutStepActive}>1. Özet</span>
                <span style={S.checkoutStepDivider}>›</span>
                <span style={S.checkoutStepActive}>2. Ödeme</span>
            </div>
            <div style={S.orderCard}>
                <div style={S.orderCardLabel}>Seçilen paket</div>
                <div style={S.orderCardTitle}>{checkoutPlanName}</div>
                <div style={S.orderCardMeta}>{checkoutCycleLabel}</div>
                {paymentCoupon && (
                    <>
                        <div style={S.orderLine}>
                            <span>Liste fiyatı</span>
                            <span style={S.orderLineMuted}>₺{fmtPrice(paymentCoupon.originalAmount)}</span>
                        </div>
                        <div style={S.orderLine}>
                            <span>Kupon ({paymentCoupon.code})</span>
                            <span style={{ color: "#34d399" }}>−₺{fmtPrice(paymentCoupon.discountAmount)}</span>
                        </div>
                    </>
                )}
                <div style={S.orderTotalRow}>
                    <span>Toplam</span>
                    <span style={S.orderTotal}>₺{fmtPrice(checkoutAmountDisplay)}</span>
                </div>
            </div>
            <ul style={S.trustList}>
                <li style={S.trustListItem}><FaLock style={{ color: "#34d399", flexShrink: 0 }} /> 256-bit SSL · 3D Secure</li>
                <li style={S.trustListItem}><FaCreditCard style={{ color: "#818cf8", flexShrink: 0 }} /> PayTR lisanslı ödeme altyapısı</li>
                <li style={S.trustListItem}><FaCheckCircle style={{ color: "#34d399", flexShrink: 0 }} /> Kart bilgisi sunucularımızda tutulmaz</li>
            </ul>
            {!paytrIframeToken && paytrTestMode && (
                <div style={S.testModeNote}>
                    Test modu: Gerçek tahsilat yapılmaz. Canlıda PAYTR_TEST_MODE=0 yapın.
                </div>
            )}
        </aside>
    );

    const closePaymentModal = async () => {
        const pid = pendingPaymentId;
        paymentModalOpenRef.current = false;
        paymentFlowStartedRef.current = false;

        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        try {
            sessionStorage.removeItem("dashtock_paytr_oid");
        } catch {
            /* private mode */
        }

        setShowPaymentModal(false);
        setPaytrFormData(null);
        setPaytrIframeToken(null);
        setIframeLoading(false);
        setPaytrCheckoutAmount(null);
        setPaytrPaymentUrl("");
        setSelectedPlan(null);
        setPendingPaymentId(null);
        setCardType("");
        setCardForm({ cc_owner: "", card_number: "", expiry_month: "", expiry_year: "", cvv: "" });
        setLegalChecks({ distanceSales: false, preliminaryInfo: false, paymentConsent: false });

        if (pid) {
            try {
                const res = await axios.post("/paytr/cancel-payment", { paymentId: pid });
                if (res.data?.paymentStatus === "success") {
                    await loadSubscriptionStatus();
                    return;
                }
            } catch {
                /* sessiz */
            }
        }

        await loadSubscriptionStatus();
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
            <div className={`subscription-page subscription-page--loading${isStandalone ? " subscription-page--standalone" : ""}`}>
                Yükleniyor…
            </div>
        );
    }

    const sub = subscription || {};
    const isActive = sub.isActive || false;
    const isTrial = sub.plan === "trial" || sub.status === "trial";
    const daysLeft = sub.daysLeft ?? sub.trialDaysLeft ?? 0;
    const hasPaidActivation = Boolean(sub.lastPaymentId) && sub.plan !== "trial";
    const showAdminGrantNote = Boolean(sub.grantedBy) && isTrial && !hasPaidActivation;
    const planTitle = isTrial
        ? "Demo Sürümü"
        : (planDisplayName || plans[sub.plan]?.name || `${(sub.plan || "").toUpperCase()} Paketi`);

    const paymentStatusLabel = (p) => p.statusLabel || (
        p.status === "completed" ? "Başarılı"
            : p.status === "pending" ? "Bekliyor"
                : p.status === "processing" ? "İşleniyor"
                    : p.status === "refunded" ? "İade"
                        : "Başarısız"
    );

    // Yıl seçenekleri (şu anki yıl + 15 yıl)
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let i = 0; i < 15; i++) {
        const y = currentYear + i;
        yearOptions.push(String(y).slice(-2)); // "25", "26", ...
    }

    const stripPillClass = isTrial
        ? "sub-strip__pill sub-strip__pill--trial"
        : isActive
            ? "sub-strip__pill sub-strip__pill--active"
            : "sub-strip__pill sub-strip__pill--passive";

    const billingLabel = billingCycle === "yearly" ? "Yıllık faturalama" : "Aylık faturalama";
    const planCount = orderedPlanKeys.length;

    const PLAN_TIER_LABEL = { basic: "Başlangıç", pro: "Profesyonel", enterprise: "Kurumsal" };

    return (
        <div className={`subscription-page${isStandalone ? " subscription-page--standalone" : ""}`}>
            <div className="subscription-page__inner">
            <div className="sub-topbar">
                <div className="sub-topbar__title">
                    <div className="sub-topbar__icon" aria-hidden>
                        <FaCrown />
                    </div>
                    <div>
                        <h1>Abonelik & Paketler</h1>
                        <p>Güvenli ödeme · anında aktivasyon</p>
                    </div>
                </div>
                {isStandalone && (
                    <button type="button" className="sub-topbar__back" onClick={() => navigate("/dashboard")}>
                        ← Panele dön
                    </button>
                )}
            </div>

            <div className="sub-metrics">
                <div className={`sub-metric${isActive ? " sub-metric--highlight" : ""}`}>
                    <span className="sub-metric__label">Kalan süre</span>
                    <span className="sub-metric__value">{daysLeft}</span>
                    <span className="sub-metric__hint">gün</span>
                </div>
                <div className="sub-metric">
                    <span className="sub-metric__label">Aktif plan</span>
                    <span className="sub-metric__value sub-metric__value--sm">
                        {isTrial ? "Demo" : (sub.plan || "—").toString().toUpperCase()}
                    </span>
                    <span className="sub-metric__hint">{planTitle}</span>
                </div>
                <div className="sub-metric">
                    <span className="sub-metric__label">Dönem</span>
                    <span className="sub-metric__value sub-metric__value--sm">{billingLabel}</span>
                    <span className="sub-metric__hint">Fiyatlandırma görünümü</span>
                </div>
                <div className="sub-metric">
                    <span className="sub-metric__label">Paketler</span>
                    <span className="sub-metric__value sub-metric__value--sm">{planCount || "—"}</span>
                    <span className="sub-metric__hint">satın alınabilir plan</span>
                </div>
            </div>

            <div className="sub-trust">
                <span className="sub-trust__chip"><FaLock /> PayTR · 3D Secure</span>
                <span className="sub-trust__chip"><FaShieldAlt /> SSL</span>
                <span className="sub-trust__chip"><FaCreditCard /> Kart saklanmaz</span>
            </div>

            <div className="subscription-page__alerts">
            {paytrConfigured === false && (
                <div className="subscription-page__alert subscription-page__alert--config">
                    <FaExclamationTriangle style={{ flexShrink: 0, fontSize: 20, color: "#fbbf24" }} />
                    <div>
                        <strong>Ödeme sistemi henüz yapılandırılmamış</strong>
                        <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>
                            Paket satın alma kapalı. Demo sürümünüz çalışmaya devam eder; ücretli paket için sunucuda PayTR ayarı gerekir.
                            <code>ssh sunucu → nano ~/LysiaETIC/backend/.env → PAYTR_* → pm2 restart backend</code>
                            Windows: <code>powershell -File scripts/sync-backend-env.ps1</code>
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="subscription-page__alert subscription-page__alert--error">
                    <FaExclamationTriangle /> <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="subscription-page__alert subscription-page__alert--success">
                    <FaCheckCircle /> <span>{successMessage}</span>
                </div>
            )}

            {pendingPayment && isTrial && (
                <div className="subscription-page__alert subscription-page__alert--warn">
                    <FaExclamationTriangle style={{ flexShrink: 0 }} />
                    <div>
                        <strong style={{ color: "#fde68a" }}>Tamamlanmamış ödeme</strong>
                        <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>
                            ₺{fmtPrice(pendingPayment.amount)} — {pendingPayment.description}.
                            Ödeme ekranından işlemi tamamlayın.
                        </p>
                    </div>
                </div>
            )}
            </div>

            <div className="sub-strip">
                <div className={`sub-strip__status ${isActive ? "sub-strip__status--ok" : "sub-strip__status--warn"}`}>
                    <div className="sub-strip__status-icon">
                        {isActive ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    </div>
                    <div className="sub-strip__status-text">
                        <h3>{planTitle}</h3>
                        <p>
                            {isTrial && isActive
                                ? `Demo — ${daysLeft} gün kaldı. Ücretli pakete geçmek için aşağıdan seçin.`
                                : isActive
                                    ? `Abonelik aktif, ${daysLeft} gün kaldı.`
                                    : "Abonelik pasif veya ödeme tamamlanmadı."}
                        </p>
                        <span className={stripPillClass}>
                            {isTrial ? "Demo" : isActive ? "Aktif" : "Pasif"}
                        </span>
                        {showAdminGrantNote && (
                            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                                <FaInfoCircle /> {sub.grantNote || "Admin tarafından verildi"}
                            </p>
                        )}
                    </div>
                </div>
                <div className="sub-strip__controls">
                    <div className="sub-billing">
                        <button
                            type="button"
                            data-active={billingCycle === "monthly"}
                            onClick={() => setBillingCycle("monthly")}
                        >
                            Aylık
                        </button>
                        <button
                            type="button"
                            data-active={billingCycle === "yearly"}
                            onClick={() => setBillingCycle("yearly")}
                        >
                            Yıllık
                            <span className="save-badge">−%17</span>
                        </button>
                    </div>
                    <div className="sub-coupon">
                        <FaTag style={{ alignSelf: "center", color: "#818cf8", flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Kupon kodu"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        />
                        <button
                            type="button"
                            className="sub-coupon__btn sub-coupon__btn--apply"
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponInput.trim()}
                        >
                            {couponLoading ? "…" : "Uygula"}
                        </button>
                        {appliedCoupon && (
                            <button type="button" className="sub-coupon__btn sub-coupon__btn--clear" onClick={clearCoupon}>
                                ✕
                            </button>
                        )}
                    </div>
                    {couponMessage && (
                        <p className="sub-coupon__msg" style={{ color: appliedCoupon ? "#34d399" : "#f87171" }}>
                            {couponMessage}
                        </p>
                    )}
                </div>
            </div>

            <section className="sub-plans-section">
                <div className="sub-section-label">
                    <h2>Planınızı seçin</h2>
                    <p>Tüm planlarda PayTR güvenli ödeme ve anında aktivasyon</p>
                </div>

                <div className="sub-plans-grid">
                    {Object.keys(plans).length === 0 ? (
                        <div className="sub-plans-loading">Paketler yükleniyor…</div>
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
                        const isDisabled = paymentLoading || isCurrentPlan || isDowngrade || paytrConfigured === false;

                        let btnText = "Paketi Seç";
                        if (paymentLoading && selectedPlan === key) btnText = "Yükleniyor...";
                        else if (isCurrentPlan) btnText = "Aktif Paket";
                        else if (isDowngrade) btnText = "Mevcut Paket Daha Yüksek";
                        else if (hasActivePaid) btnText = "Yükselt";

                        const previewFeatures = features.slice(0, 5);
                        const hasMoreFeatures = features.length > 5;

                        return (
                            <article
                                key={key}
                                className={`plan-card${isPopular ? " plan-card--popular" : ""}${isCurrentPlan ? " plan-card--current" : ""}`}
                            >
                                {isCurrentPlan && (
                                    <span className="plan-card__ribbon plan-card__ribbon--current">Mevcut plan</span>
                                )}
                                {isPopular && !isCurrentPlan && (
                                    <span className="plan-card__ribbon">{plan.badge || "Önerilen"}</span>
                                )}
                                {!isPopular && plan.badge && !isCurrentPlan && (
                                    <span className="plan-card__ribbon">{plan.badge}</span>
                                )}
                                <div className="plan-card__tier">{PLAN_TIER_LABEL[key] || key}</div>
                                <h3 className="plan-card__name">{plan.name}</h3>
                                {plan.description && (
                                    <p className="plan-card__desc">{plan.description}</p>
                                )}
                                <div className="plan-card__price-block">
                                    <div className="plan-card__price">
                                        {discount ? (
                                            <>
                                                <span className="plan-card__price-old">₺{fmtPrice(price)}</span>
                                                <span className="plan-card__price-discount">₺{fmtPrice(discount.finalAmount)}</span>
                                            </>
                                        ) : (
                                            <>₺{fmtPrice(price)}</>
                                        )}
                                        <span className="plan-card__period">/{billingCycle === "yearly" ? "yıl" : "ay"}</span>
                                    </div>
                                </div>
                                {discount && (
                                    <div className="plan-card__coupon-tag">
                                        −₺{fmtPrice(discount.discountAmount)} · {appliedCoupon.code}
                                    </div>
                                )}
                                {!isExpanded && previewFeatures.length > 0 && (
                                    <ul className="plan-card__features">
                                        {previewFeatures.map((f, i) => (
                                            <li key={`${key}-prev-${i}`}>
                                                <FaCheckCircle /> <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {(hasMoreFeatures || Object.keys(featureGroups).length > 0) && (
                                    <button
                                        type="button"
                                        className="plan-card__more"
                                        onClick={() => setExpandedFeaturesByPlan((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    >
                                        {isExpanded ? "Özellikleri gizle" : `Tüm özellikler (${features.length})`}
                                    </button>
                                )}
                                {isExpanded && (
                                    <div className="plan-card__feature-groups">
                                        {Object.entries(featureGroups).map(([groupName, items]) => (
                                            <div key={groupName} className="plan-card__group">
                                                <div className="plan-card__group-title">{groupName}</div>
                                                {items.map((f, i) => (
                                                    <div key={`${groupName}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#cbd5e1", padding: "2px 0" }}>
                                                        <FaCheckCircle style={{ color: "#34d399", fontSize: 10, marginTop: 3, flexShrink: 0 }} />
                                                        <span>{f}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className={`plan-card__cta${!isDisabled && !isCurrentPlan ? " plan-card__cta--primary" : ""}`}
                                    onClick={() => !isDisabled && handleSelectPlan(key)}
                                    disabled={isDisabled}
                                >
                                    {btnText}
                                </button>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="sub-history-section">
                <div className="sub-history-card">
                <div className="sub-history-head">
                    <h2>
                        <FaHistory /> Ödeme geçmişi
                    </h2>
                    {payments.length > 0 && (
                        <span>{payments.length} işlem</span>
                    )}
                </div>
                    {payments.length === 0 ? (
                        <div className="subscription-history-empty">
                            <FaHistory />
                            Henüz ödeme kaydı yok.
                        </div>
                    ) : (
                        <div className="subscription-history-table-wrap">
                            <table className="subscription-history-table">
                                <thead>
                                    <tr>
                                        <th>Tarih</th>
                                        <th>Açıklama</th>
                                        <th>Referans</th>
                                        <th className="col-amount">Tutar</th>
                                        <th className="col-status">Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => {
                                        const statusKey = p.status === "processing" ? "pending" : p.status;
                                        return (
                                            <tr key={p._id}>
                                                <td className="col-meta">
                                                    {new Date(p.createdAt).toLocaleString("tr-TR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </td>
                                                <td className="col-desc">{p.description || "—"}</td>
                                                <td className="col-meta">{p.orderRef || "—"}</td>
                                                <td className="col-amount">₺{fmtPrice(p.amount)}</td>
                                                <td className="col-status">
                                                    <span
                                                        className="subscription-history-badge"
                                                        data-status={statusKey || "failed"}
                                                    >
                                                        {paymentStatusLabel(p)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {/* Kurumsal checkout — özet + ödeme (direct kart formu veya PayTR iframe yedek) */}
            {showPaymentModal && (paytrFormData || paytrIframeToken) && (
                <div style={S.modal} onClick={closePaymentModal} role="dialog" aria-modal="true">
                    <div className="subscription-checkout-shell" style={S.checkoutShell} onClick={(e) => e.stopPropagation()}>
                        <header style={S.checkoutTopBar}>
                            <div>
                                <h2 style={S.checkoutTopTitle}>Güvenli ödeme</h2>
                                <p style={S.checkoutTopSub}>
                                    {checkoutPlanName} · {checkoutCycleLabel}
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {paytrTestMode && paytrIframeToken && (
                                    <span style={S.testPill}>Test modu</span>
                                )}
                                <button type="button" style={S.modalCloseLight} onClick={closePaymentModal} aria-label="Kapat">×</button>
                            </div>
                        </header>

                        <div className="subscription-checkout-grid" style={S.checkoutGrid}>
                            {renderOrderSummary()}

                            <div
                                className={paytrIframeToken ? "subscription-checkout-payment" : ""}
                                style={paytrIframeToken ? S.checkoutPaymentPane : S.checkoutMain}
                            >
                                {paytrIframeToken ? (
                                    <>
                                        <div style={S.paytrPaneHead}>
                                            <div>
                                                <div style={S.paytrPaneTitle}>Kart ile ödeme</div>
                                                <div style={S.paytrPaneHint}>
                                                    Kart numarasını girdikten sonra banka ve taksit tablosu görünür.
                                                </div>
                                            </div>
                                            <div style={S.securePill}>
                                                <FaLock style={{ fontSize: 11 }} /> SSL · 3D Secure
                                            </div>
                                        </div>
                                        {paytrTestMode && (
                                            <div style={S.testBannerCompact}>
                                                Test ortamı: PayTR sarı uyarı bandı normaldir. Canlıda <code style={S.testCode}>PAYTR_TEST_MODE=0</code> yapın.
                                            </div>
                                        )}
                                        <div className="subscription-paytr-viewport" style={S.paytrViewport}>
                                            {iframeLoading && (
                                                <div style={S.iframeLoader}>
                                                    <div style={S.spinner} />
                                                    <span>PayTR yükleniyor…</span>
                                                </div>
                                            )}
                                            <iframe
                                                id="paytriframe"
                                                title="PayTR Ödeme"
                                                src={`https://www.paytr.com/odeme/guvenli/${paytrIframeToken}`}
                                                frameBorder="0"
                                                scrolling="no"
                                                style={{
                                                    width: "100%",
                                                    minHeight: 640,
                                                    border: "none",
                                                    background: "#fff",
                                                    opacity: iframeLoading ? 0 : 1,
                                                    transition: "opacity 0.3s ease",
                                                }}
                                                onLoad={() => setIframeLoading(false)}
                                            />
                                        </div>
                                        <div style={S.paytrPaneFoot}>
                                            <span>Visa</span>
                                            <span>Mastercard</span>
                                            <span>Troy</span>
                                            <span style={S.paytrFootBrand}>PayTR</span>
                                        </div>
                                    </>
                                ) : (
                                    <form
                                        ref={formRef}
                                        action={paytrPaymentUrl}
                                        method="POST"
                                        onSubmit={handleSubmitPayment}
                                        style={S.paymentForm}
                                    >
                                        <p style={S.paymentIntro}>Kart bilgilerinizi girin; işlem PayTR güvenli ödeme sayfasında tamamlanır.</p>
                                        {renderInstallmentPicker()}
                                        <div style={S.cardFieldsPanel}>
                            {Object.entries({
                                ...paytrFormData,
                                installment_count: String(paymentInstallment || 0),
                            })
                                .filter(([key]) => PAYTR_DIRECT_HIDDEN_KEYS.has(key))
                                .filter(([key]) => key !== "card_type" || (paymentInstallment > 0 && cardType))
                                .filter(([, value]) => value !== "" && value != null && value !== undefined)
                                .map(([key, value]) => (
                                    <input key={key} type="hidden" name={key} value={String(value)} />
                                ))}
                            {paymentInstallment > 0 && cardType ? (
                                <input type="hidden" name="card_type" value={cardType} />
                            ) : null}

                            <div style={S.formGroup}>
                                <label style={S.fieldLabel}>Kart üzerindeki ad soyad</label>
                                <input
                                    type="text"
                                    name="cc_owner"
                                    value={cardForm.cc_owner}
                                    onChange={(e) => setCardForm(p => ({ ...p, cc_owner: e.target.value.toUpperCase() }))}
                                    placeholder="AD SOYAD"
                                    style={S.fieldInput}
                                    maxLength={50}
                                    autoComplete="cc-name"
                                    required
                                />
                            </div>

                            <div style={S.formGroup}>
                                <label style={S.fieldLabel}>Kart numarası</label>
                                <input
                                    type="text"
                                    name="card_number"
                                    value={cardForm.card_number}
                                    onChange={(e) => {
                                        const formatted = formatCardNumber(e.target.value);
                                        setCardForm(p => ({ ...p, card_number: formatted }));
                                        setCardType("");
                                    }}
                                    onBlur={(e) => {
                                        if (paymentInstallment > 0) {
                                            lookupCardBin(e.target.value);
                                        }
                                    }}
                                    placeholder="0000 0000 0000 0000"
                                    style={S.fieldInput}
                                    maxLength={19}
                                    autoComplete="cc-number"
                                    inputMode="numeric"
                                    required
                                />
                            {paymentInstallment > 0 && (
                                <p style={S.installmentHint}>
                                    {binLookupLoading
                                        ? "Kart programı sorgulanıyor…"
                                        : cardType
                                            ? `Kart tipi: ${cardType} (PayTR taksit)`
                                            : "Taksitli ödeme için kart numarasını girdikten sonra BIN doğrulanır."}
                                </p>
                            )}
                            </div>

                            <div style={S.expiryGrid}>
                                <div style={S.formGroup}>
                                    <label style={S.fieldLabel}>Ay</label>
                                    <select
                                        name="expiry_month"
                                        value={cardForm.expiry_month}
                                        onChange={(e) => setCardForm(p => ({ ...p, expiry_month: e.target.value }))}
                                        style={S.fieldSelect}
                                        required
                                    >
                                        <option value="">Ay</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={String(m).padStart(2, "0")}>{String(m).padStart(2, "0")}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.fieldLabel}>Yıl</label>
                                    <select
                                        name="expiry_year"
                                        value={cardForm.expiry_year}
                                        onChange={(e) => setCardForm(p => ({ ...p, expiry_year: e.target.value }))}
                                        style={S.fieldSelect}
                                        required
                                    >
                                        <option value="">Yıl</option>
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>20{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={S.formGroup}>
                                    <label style={S.fieldLabel}>CVV</label>
                                    <input
                                        type="password"
                                        name="cvv"
                                        value={cardForm.cvv}
                                        onChange={(e) => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, "") }))}
                                        placeholder="•••"
                                        style={S.fieldInput}
                                        maxLength={4}
                                        autoComplete="cc-csc"
                                        inputMode="numeric"
                                        required
                                    />
                                </div>
                            </div>

                            </div>

                            {error && (
                                <div style={S.formError}>
                                    <FaExclamationTriangle /> {error}
                                </div>
                            )}

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

                            <button
                                type="submit"
                                style={{ ...S.payBtnPrimary, ...(!allLegalChecked || paymentLoading ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}
                                disabled={!allLegalChecked || paymentLoading}
                            >
                                <FaLock /> {paymentLoading ? "Yönlendiriliyor…" : `₺${fmtPrice(checkoutAmountDisplay)} — Ödemeyi tamamla`}
                            </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <footer style={S.checkoutBottomBar}>
                            <button type="button" style={S.checkoutGhostBtn} onClick={closePaymentModal}>Vazgeç</button>
                            <span style={S.checkoutBottomNote}>PayTR · 3D Secure · PCI-DSS uyumlu altyapı</span>
                        </footer>
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
        width: "100%",
        maxWidth: "100%",
        minHeight: 0,
        color: "#f1f5f9",
        fontFamily: "'Inter', sans-serif",
    },
    container: {
        width: "100%",
        maxWidth: "100%",
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
    configAlert: {
        display: "flex",
        gap: 14,
        padding: "18px 20px",
        marginBottom: 20,
        borderRadius: 14,
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(251,191,36,0.35)",
    },
    installmentPanel: { marginBottom: 16 },
    installmentSegmented: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 4,
        borderRadius: 12,
        background: "rgba(15,23,42,0.5)",
        border: "1px solid rgba(148,163,184,0.15)",
    },
    installmentSegment: (active) => ({
        flex: "1 1 auto",
        minWidth: 72,
        padding: "10px 12px",
        borderRadius: 8,
        border: "none",
        background: active ? "linear-gradient(135deg, #4f46e5, #6366f1)" : "transparent",
        color: active ? "#fff" : "#94a3b8",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 0.15s ease",
    }),
    installmentHint: {
        margin: "10px 0 0",
        fontSize: 11,
        color: "#64748b",
        lineHeight: 1.45,
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
    statusPill: (isTrial, isActive) => ({
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: isTrial
            ? "rgba(251,191,36,0.15)"
            : isActive
                ? "rgba(52,211,153,0.15)"
                : "rgba(248,113,113,0.12)",
        color: isTrial ? "#fbbf24" : isActive ? "#34d399" : "#f87171",
        border: `1px solid ${isTrial ? "rgba(251,191,36,0.35)" : isActive ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.25)"}`,
        flexShrink: 0,
    }),
    pendingBanner: {
        display: "flex",
        gap: 14,
        padding: "16px 18px",
        marginBottom: 20,
        borderRadius: 14,
        background: "rgba(251,191,36,0.08)",
        border: "1px solid rgba(251,191,36,0.25)",
        color: "#e2e8f0",
    },
    emptyHistory: {
        padding: "28px 20px",
        textAlign: "center",
        color: "#64748b",
        fontSize: 14,
        background: "rgba(15,23,42,0.5)",
        borderRadius: 14,
        border: "1px dashed rgba(99,102,241,0.2)",
    },
    historyList: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    historyCard: (status) => ({
        padding: "16px 18px",
        borderRadius: 14,
        background: "rgba(15,23,42,0.65)",
        border: `1px solid ${
            status === "completed"
                ? "rgba(52,211,153,0.2)"
                : status === "pending"
                    ? "rgba(251,191,36,0.25)"
                    : "rgba(99,102,241,0.12)"
        }`,
    }),
    historyCardTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
    },
    historyDesc: {
        fontSize: 14,
        fontWeight: 600,
        color: "#f1f5f9",
        marginBottom: 4,
    },
    historyMeta: {
        fontSize: 12,
        color: "#64748b",
    },
    historyAmount: {
        fontSize: 18,
        fontWeight: 800,
        color: "#fff",
        marginBottom: 6,
    },
    section: {
        marginBottom: "1.5rem",
        width: "100%",
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
        width: "100%",
        padding: "14px 16px",
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "12px",
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
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        width: "100%",
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
        borderRadius: "16px",
        padding: "22px 18px",
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
        fontSize: "32px",
        fontWeight: 800,
        color: "#fff",
        marginBottom: "16px",
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
        marginTop: 14,
        marginBottom: 4,
        padding: "14px 16px",
        background: "rgba(15,23,42,0.04)",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
        color: "#475569",
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
        background: "rgba(3,6,18,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
        backdropFilter: "blur(10px)",
    },
    checkoutShell: {
        width: "100%",
        maxWidth: 1080,
        maxHeight: "92vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderRadius: 24,
        background: "#0f172a",
        border: "1px solid rgba(148,163,184,0.2)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
    },
    checkoutTopBar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 24px",
        borderBottom: "1px solid rgba(148,163,184,0.12)",
        background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92))",
        flexShrink: 0,
    },
    checkoutTopTitle: {
        margin: 0,
        fontSize: 20,
        fontWeight: 800,
        color: "#f8fafc",
        letterSpacing: "-0.03em",
    },
    checkoutTopSub: {
        margin: "4px 0 0",
        fontSize: 13,
        color: "#94a3b8",
        fontWeight: 500,
    },
    testPill: {
        fontSize: 11,
        fontWeight: 700,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(245,158,11,0.15)",
        color: "#fbbf24",
        border: "1px solid rgba(251,191,36,0.35)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
    },
    modalCloseLight: {
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.2)",
        background: "rgba(15,23,42,0.6)",
        color: "#94a3b8",
        fontSize: 22,
        lineHeight: 1,
        cursor: "pointer",
    },
    checkoutGrid: {
        display: "grid",
        gridTemplateColumns: "272px minmax(0, 1fr)",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
    },
    checkoutAside: {
        padding: "24px 22px",
        background: "linear-gradient(165deg, #1e293b 0%, #0f172a 100%)",
        borderRight: "1px solid rgba(148,163,184,0.1)",
        overflowY: "auto",
    },
    checkoutPaymentPane: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
        overflow: "hidden",
        background: "linear-gradient(180deg, #f1f5f9 0%, #e8edf4 100%)",
    },
    paytrPaneHead: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 20px 10px",
        flexShrink: 0,
    },
    paytrPaneTitle: {
        fontSize: 16,
        fontWeight: 800,
        color: "#0f172a",
        letterSpacing: "-0.02em",
    },
    paytrPaneHint: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 4,
        lineHeight: 1.45,
        maxWidth: 420,
    },
    securePill: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        background: "#fff",
        border: "1px solid #e2e8f0",
        color: "#059669",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    },
    testBannerCompact: {
        margin: "0 20px 10px",
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(254,243,199,0.9)",
        border: "1px solid #fcd34d",
        color: "#92400e",
        fontSize: 11,
        lineHeight: 1.5,
        flexShrink: 0,
    },
    testCode: {
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        background: "rgba(0,0,0,0.06)",
        padding: "1px 4px",
        borderRadius: 4,
    },
    paytrViewport: {
        position: "relative",
        flex: 1,
        minHeight: 0,
        margin: "0 20px 10px",
        background: "#fff",
        borderRadius: 16,
        overflow: "auto",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04), 0 12px 40px rgba(15,23,42,0.1)",
    },
    paytrPaneFoot: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "12px 20px 16px",
        fontSize: 11,
        fontWeight: 600,
        color: "#94a3b8",
        flexShrink: 0,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
    },
    paytrFootBrand: {
        color: "#6366f1",
        fontWeight: 800,
    },
    checkoutBrandRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
    },
    checkoutBrandMark: {
        width: 40,
        height: 40,
        borderRadius: 12,
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        fontWeight: 800,
        fontSize: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    checkoutBrandName: { fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
    checkoutBrandSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
    checkoutSteps: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 16,
        color: "#64748b",
    },
    checkoutStepActive: { color: "#a5b4fc" },
    checkoutStepDivider: { color: "#334155" },
    orderCard: {
        padding: 18,
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.12)",
        marginBottom: 18,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
    },
    orderCardLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" },
    orderCardTitle: { fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 6 },
    orderCardMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
    orderLine: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginTop: 12 },
    orderLineMuted: { textDecoration: "line-through" },
    orderTotalRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid rgba(148,163,184,0.15)",
        fontSize: 13,
        fontWeight: 600,
        color: "#cbd5e1",
    },
    orderTotal: { fontSize: 22, fontWeight: 800, color: "#fff" },
    trustList: {
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontSize: 12,
        color: "#94a3b8",
    },
    trustListItem: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    testModeNote: {
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(251,191,36,0.25)",
        color: "#fcd34d",
        fontSize: 11,
        lineHeight: 1.45,
    },
    checkoutMain: {
        padding: "22px 24px 8px",
        background: "#0f1428",
        minWidth: 0,
    },
    paymentIntro: {
        margin: "0 0 16px",
        fontSize: 13,
        color: "#94a3b8",
        lineHeight: 1.5,
    },
    paymentForm: { display: "flex", flexDirection: "column", gap: 0 },
    cardFieldsPanel: {
        padding: 18,
        borderRadius: 14,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
    },
    fieldLabel: {
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "#475569",
        marginBottom: 6,
    },
    fieldInput: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        fontSize: 15,
        fontWeight: 500,
        outline: "none",
        boxSizing: "border-box",
    },
    fieldSelect: {
        width: "100%",
        padding: "12px 10px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        fontSize: 14,
        boxSizing: "border-box",
    },
    expiryGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
    },
    formError: {
        color: "#dc2626",
        fontSize: 13,
        margin: "12px 0",
        display: "flex",
        alignItems: "center",
        gap: 6,
    },
    payBtnPrimary: {
        width: "100%",
        marginTop: 16,
        padding: "15px 20px",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        boxShadow: "0 8px 24px rgba(79,70,229,0.35)",
    },
    checkoutBottomBar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 24px",
        borderTop: "1px solid rgba(148,163,184,0.12)",
        background: "#0f172a",
        flexShrink: 0,
        flexWrap: "wrap",
    },
    checkoutGhostBtn: {
        padding: "10px 16px",
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.25)",
        background: "transparent",
        color: "#94a3b8",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
    },
    checkoutBottomNote: { fontSize: 11, color: "#64748b" },
    checkoutModal: {
        width: "100%",
        maxWidth: 720,
        maxHeight: "94vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        background: "linear-gradient(165deg, rgba(17,24,49,0.98), rgba(10,12,24,0.98))",
        border: "1px solid rgba(99,102,241,0.28)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.08)",
    },
    checkoutHeader: {
        padding: "22px 24px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
    },
    checkoutEyebrow: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#818cf8",
        marginBottom: 6,
    },
    checkoutTitle: {
        margin: 0,
        fontSize: 20,
        fontWeight: 800,
        color: "#fff",
        display: "flex",
        alignItems: "center",
    },
    checkoutSummary: {
        margin: "0 20px 16px",
        padding: "16px 18px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))",
        border: "1px solid rgba(99,102,241,0.22)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    checkoutSummaryLabel: {
        display: "block",
        fontSize: 13,
        color: "#94a3b8",
        marginBottom: 4,
    },
    checkoutSummaryHint: {
        fontSize: 11,
        color: "#64748b",
    },
    checkoutSummaryAmount: {
        fontSize: 28,
        fontWeight: 800,
        color: "#fff",
        letterSpacing: "-0.02em",
    },
    iframeLoader: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "rgba(255,255,255,0.92)",
        color: "#475569",
        fontSize: 14,
        fontWeight: 600,
        zIndex: 2,
        borderRadius: 16,
    },
    spinner: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "3px solid #e2e8f0",
        borderTopColor: "#6366f1",
        animation: "subscriptionPaytrSpin 0.75s linear infinite",
    },
    checkoutFooter: {
        padding: "16px 24px 20px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        borderTop: "1px solid rgba(99,102,241,0.12)",
    },
    checkoutFooterNote: {
        flex: 1,
        minWidth: 200,
        fontSize: 11,
        color: "#64748b",
        lineHeight: 1.45,
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
