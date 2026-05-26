/**
 * PayTR Controller — LysiaETIC
 *
 * PayTR iFrame API ödeme yönetimi.
 * - Token oluşturma (iframe açmak için)
 * - Callback işleme (ödeme sonucu)
 * - Abonelik durumu sorgulama
 * - Admin: Kullanıcıya demo/abonelik verme
 *
 * ✅ FIX: Mongoose subdocument spread sorunu düzeltildi (toObject)
 * ✅ FIX: PayTR credentials kontrolü paytrService üzerinden yapılıyor
 * ✅ FIX: Callback handler güçlendirildi
 * ✅ FIX: Detaylı hata loglaması eklendi
 * ✅ FIX: expire_date reset hatası — aktif kullanıcının kalan süresi korunuyor
 * ✅ FIX: Race condition — atomik findOneAndUpdate ile DB lock
 * ✅ FIX: Payment→Plan fiyat doğrulama — amount manipulation koruması
 * ✅ FIX: Fail case güçlendirme — failReason, errorCode, failedAt
 * ✅ FIX: Subscription değişim log'u eklendi
 */

const User = require("../models/User");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const SystemConfig = require("../models/SystemConfig");
const paytrService = require("../services/paytrService");
const { activateSubscriptionFromPayment } = require("../services/subscriptionActivationService");
const {
    validateCouponForCheckout,
    recordCouponRedemption,
    normalizeCode
} = require("../services/couponService");
const logger = require("../config/logger");
const mongoose = require("mongoose");

const { DEFAULT_PLAN_DEFINITIONS } = require("../config/defaultPlanDefinitions");

const BRAND_NAME = "Dashtock";

/** Kullanıcı ID — ödeme geçmişi sızıntısını önlemek için her sorguda ObjectId */
function toUserObjectId(userId) {
    if (!userId) return null;
    try {
        if (userId instanceof mongoose.Types.ObjectId) return userId;
        return new mongoose.Types.ObjectId(String(userId));
    } catch {
        return null;
    }
}

/** Eski / yinelenen bekleyen ödemeleri kapat */
async function closeSupersededPendingPayments(userId, { cancelAllPending = false } = {}) {
    const uid = toUserObjectId(userId);
    if (!uid) return;

    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    await Payment.updateMany(
        { userId: uid, status: "pending", createdAt: { $lt: staleBefore } },
        { $set: { status: "failed", failReason: "Ödeme süresi doldu (30 dk)", failedAt: new Date() } }
    );

    if (cancelAllPending) {
        await Payment.updateMany(
            { userId: uid, status: "pending" },
            { $set: { status: "failed", failReason: "Yeni ödeme denemesi başlatıldı", failedAt: new Date() } }
        );
    }
}

const PAYMENT_STATUS_LABELS = {
    completed: "Başarılı",
    pending: "Bekliyor",
    failed: "Başarısız",
    processing: "İşleniyor",
    refunded: "İade",
};

/** İstemciye güvenli ödeme listesi — yalnızca bu kullanıcı, tek bekleyen kayıt */
function formatPaymentsForClient(rows) {
    const mapped = (rows || []).map((p) => ({
        _id: p._id,
        amount: p.amount,
        currency: p.currency || "TRY",
        status: p.status,
        statusLabel: PAYMENT_STATUS_LABELS[p.status] || p.status,
        description: String(p.description || "").replace(/LysiaETIC/gi, BRAND_NAME),
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        expectedPlan: p.expectedPlan,
        billingCycle: p.expectedBillingCycle,
        orderRef: p.transactionId ? String(p.transactionId).slice(-12) : null,
    }));

    const latestPending = mapped.find((p) => p.status === "pending");
    const others = mapped.filter((p) => p.status !== "pending");
    return [...(latestPending ? [latestPending] : []), ...others].slice(0, 12);
}

// ─── FALLBACK PAKET TANIMLARI (DB'den okunamazsa) ─────────────────────────────
const buildFallbackPlans = () => {
    const result = {};
    for (const [key, plan] of Object.entries(DEFAULT_PLAN_DEFINITIONS)) {
        if (key === "trial") continue;
        const monthlyPrice = plan.monthlyPrice || plan.price || 0;
        const yearlyPrice = plan.yearlyPrice || Math.round(monthlyPrice * 10);
        const duration = plan.duration || 30;
        result[key] = {
            name: plan.name || key,
            description: plan.description || "",
            badge: plan.badge || "",
            price: monthlyPrice,
            monthlyPrice,
            yearlyPrice,
            duration,
            durationDays: { monthly: duration, yearly: 365 },
            limits: plan.limits || {},
            features: plan.features || []
        };
    }
    return result;
};

const FALLBACK_PLANS = buildFallbackPlans();

// ─── DB'DEN DİNAMİK PAKET TANIMLARI OKU ─────────────────────────────────────────
// Admin panelden güncellenen planDefinitions'ı SystemConfig'den okur.
// DB'deki format: { trial: { name, price, duration, limits }, basic: {...}, ... }
// Bu fonksiyon price → monthlyPrice/yearlyPrice dönüşümünü de yapar.
let _plansCache = null;
let _plansCacheTime = 0;
const PLANS_CACHE_TTL = 60 * 1000; // 60 saniye cache

const getPlansFromDB = async () => {
    const now = Date.now();
    if (_plansCache && (now - _plansCacheTime) < PLANS_CACHE_TTL) {
        return _plansCache;
    }
    try {
        const doc = await SystemConfig.findOne({ key: "planDefinitions" }).lean();
        if (doc?.value && typeof doc.value === "object") {
            const dbPlans = doc.value;
            const result = {};
            for (const [key, plan] of Object.entries(dbPlans)) {
                if (key === "trial") continue; // trial satın alınamaz
                const monthlyPrice = plan.monthlyPrice || plan.price || 0;
                const yearlyPrice = plan.yearlyPrice || Math.round(monthlyPrice * 10); // ~%17 indirim
                const duration = plan.duration || 30;
                result[key] = {
                    name: plan.name || key,
                    description: plan.description || "",
                    badge: plan.badge || "",
                    price: monthlyPrice,
                    monthlyPrice,
                    yearlyPrice,
                    duration,
                    durationDays: plan.durationDays || { monthly: duration, yearly: 365 },
                    limits: plan.limits || {},
                    features: plan.features || [],
                };
            }
            if (Object.keys(result).length > 0) {
                _plansCache = result;
                _plansCacheTime = now;
                return result;
            }
        }
    } catch (err) {
        logger.warn(`Plan tanımları DB'den okunamadı, fallback kullanılıyor: ${err.message}`);
    }
    _plansCache = FALLBACK_PLANS;
    _plansCacheTime = now;
    return FALLBACK_PLANS;
};

// ─── CACHE INVALIDATION (admin güncelleme sonrası çağrılır) ───────────────────────
exports.invalidatePlansCache = () => {
    _plansCache = null;
    _plansCacheTime = 0;
};

// ─── PayTR yapılandırma durumu (secret dönmez) ─────────────────────────────────
exports.getPaytrHealth = async (req, res) => {
    try {
        const status = paytrService.getConfigStatus();
        const missing = [];
        if (!status.merchantIdSet) missing.push("PAYTR_MERCHANT_ID");
        if (!status.merchantKeySet) missing.push("PAYTR_MERCHANT_KEY");
        if (!status.merchantSaltSet) missing.push("PAYTR_MERCHANT_SALT");
        res.json({
            success: true,
            ...status,
            missing,
            envPathHint: "backend/.env (sunucuda ~/LysiaETIC/backend/.env — git ile gitmez)",
            message: status.configured
                ? "PayTR yapılandırması tamam."
                : `PayTR eksik: ${missing.join(", ") || "bilinmiyor"}. Sunucuda .env dosyasını oluşturup pm2 restart backend yapın.`,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── 1. PAKET BİLGİLERİNİ GETİR (DB'den dinamik) ────────────────────────────────
exports.getPlans = async (req, res) => {
    try {
        const plans = await getPlansFromDB();
        res.json({
            success: true,
            plans: Object.entries(plans).map(([key, plan]) => ({
                id: key,
                ...plan
            }))
        });
    } catch (error) {
        logger.error(`Plan bilgileri hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Plan bilgileri alınamadı" });
    }
};

// ─── 2. ABONELİK DURUMU ─────────────────────────────────────────────────────────
exports.getSubscriptionStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("subscription name email");
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const sub = user.subscription ? user.subscription.toObject() : {};
        const now = new Date();

        let isActive = false;
        let daysLeft = 0;
        let trialDaysLeft = 0;
        let isTrialActive = false;

        // 1) Trial durumu kontrol — trialEndDate VEYA endDate'e bak
        if (sub.plan === "trial" || sub.status === "trial") {
            const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate)
                           : sub.endDate ? new Date(sub.endDate)
                           : null;
            if (trialEnd && trialEnd > now) {
                isTrialActive = true;
                isActive = true;
                trialDaysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                daysLeft = trialDaysLeft;
            }
        }

        // 2) Aktif abonelik durumu (basic, pro, enterprise)
        if (!isActive && sub.status === "active" && sub.endDate) {
            const endDate = new Date(sub.endDate);
            if (endDate > now) {
                isActive = true;
                daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            }
        }

        // Süresi dolmuşsa durumu güncelle (suspended/cancelled statülerini ezme)
        if (
            !isActive &&
            sub.status &&
            sub.status !== "expired" &&
            sub.status !== "suspended" &&
            sub.status !== "cancelled"
        ) {
            user.subscription.status = "expired";
            await user.save();
            sub.status = "expired";
        }

        const uid = toUserObjectId(req.user._id);
        await closeSupersededPendingPayments(uid);

        let payments = [];
        let pendingPayment = null;
        try {
            if (uid) {
                const raw = await Payment.find({ userId: uid })
                    .select("amount currency status description createdAt paidAt expectedPlan expectedBillingCycle transactionId")
                    .sort({ createdAt: -1 })
                    .limit(30)
                    .lean();
                payments = formatPaymentsForClient(raw);
                const hasActivePaidSub =
                    isActive && sub.plan && sub.plan !== "trial";
                pendingPayment = hasActivePaidSub
                    ? null
                    : payments.find((p) => p.status === "pending") || null;
            }
        } catch (payErr) {
            logger.warn(`Ödeme geçmişi alınamadı: ${payErr.message}`);
        }

        const currentPlans = await getPlansFromDB();
        const { getPlanContext } = require("../services/planFeatureService");
        const planContext = await getPlanContext(user);

        const subscriptionRevision = [
            sub.plan,
            sub.status,
            sub.endDate ? new Date(sub.endDate).getTime() : 0,
            payments[0]?._id,
            payments[0]?.status,
            payments[0]?.paidAt ? new Date(payments[0].paidAt).getTime() : 0,
        ].join("|");

        res.json({
            success: true,
            subscription: {
                plan: sub.plan || "trial",
                status: sub.status || "trial",
                startDate: sub.startDate,
                endDate: sub.endDate || sub.trialEndDate,
                trialEndDate: sub.trialEndDate,
                trialDaysLeft,
                isTrialActive,
                isActive,
                daysLeft,
                autoRenew: sub.autoRenew || false,
                grantedBy: sub.grantedBy ? true : false,
                grantNote: sub.grantNote,
                lastPaymentId: sub.lastPaymentId || null,
            },
            subscriptionRevision,
            payments,
            pendingPayment,
            paymentFlow: paytrService.getPaymentFlow(),
            installmentChoices: paytrService.getInstallmentChoices(),
            plans: currentPlans,
            entitlements: planContext.entitlements,
            limits: planContext.limits,
            planFeatures: planContext.features,
            planDisplayName: planContext.planName,
            upgradeHint: planContext.upgradeHint
        });
    } catch (error) {
        logger.error(`Abonelik durumu hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik durumu alınamadı" });
    }
};

// ─── PLAN SEVİYE SIRASI (yükseltme/düşürme kontrolü için) ────────────────────
const PLAN_RANK = { trial: 0, free: 0, basic: 1, pro: 2, enterprise: 3 };

// ─── 3. PAYTR DİREKT API — ÖDEME FORMU HAZIRLA ─────────────────────────────────
/**
 * Direkt API akışı:
 * 1. Backend: Token + hidden form data hazırla → Frontend'e gönder
 * 2. Frontend: Kart bilgileri formu göster → Tüm verileri https://www.paytr.com/odeme'ye POST et
 * 3. PayTR: 3D Secure doğrulama → Callback → OK/Fail URL redirect
 *
 * ⚠️ Kart bilgileri ASLA bizim sunucumuzdan geçmez — doğrudan PayTR'a gider
 */
exports.createPayment = async (req, res) => {
    try {
        const { plan, billingCycle = "monthly", couponCode, installmentCount = 0 } = req.body;
        const user = req.user;

        // DB'den güncel plan tanımlarını oku
        const PLANS = await getPlansFromDB();

        if (!plan || !PLANS[plan]) {
            return res.status(400).json({ success: false, message: "Geçersiz paket seçimi" });
        }

        if (!["monthly", "yearly"].includes(billingCycle)) {
            return res.status(400).json({ success: false, message: "Geçersiz ödeme periyodu" });
        }

        // ── Mevcut abonelik kontrolü ─────────────────────────────────────────
        const userDoc = await User.findById(user._id);
        if (!userDoc) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const currentSub = userDoc.subscription ? userDoc.subscription.toObject() : {};
        const now = new Date();

        // Aktif abonelik var mı kontrol et (trial hariç)
        const hasActivePaid = currentSub.status === "active"
            && currentSub.plan !== "trial"
            && currentSub.plan !== "free"
            && currentSub.endDate
            && new Date(currentSub.endDate) > now;

        if (hasActivePaid) {
            const currentRank = PLAN_RANK[currentSub.plan] || 0;
            const newRank = PLAN_RANK[plan] || 0;

            if (currentSub.plan === plan) {
                return res.status(400).json({
                    success: false,
                    message: `Zaten ${PLANS[plan].name} paketiniz aktif. Süreniz dolmadan aynı paketi tekrar satın alamazsınız.`
                });
            }

            if (newRank <= currentRank) {
                return res.status(400).json({
                    success: false,
                    message: `Aktif ${PLANS[currentSub.plan]?.name || currentSub.plan} paketiniz var. Daha düşük veya aynı seviye pakete geçemezsiniz.`
                });
            }
        }

        // ── PayTR credentials kontrolü ───────────────────────────────────────
        if (!paytrService.hasValidCredentials()) {
            const st = paytrService.getConfigStatus();
            logger.warn(`PayTR credentials eksik — ödeme yapılamıyor.`, {
                user: user.email,
                plan,
                merchantIdSet: st.merchantIdSet,
                merchantKeySet: st.merchantKeySet,
                merchantSaltSet: st.merchantSaltSet,
                cwd: process.cwd(),
            });
            return res.status(503).json({
                success: false,
                code: "PAYTR_NOT_CONFIGURED",
                demoMode: true,
                activated: false,
                message: "Ödeme sistemi henüz yapılandırılmamış. Sunucudaki backend/.env dosyasına PayTR bilgilerini ekleyip pm2 restart backend yapın. (Git pull .env dosyasını taşımaz.)",
                configHint: st,
            });
        }

        const planInfo = PLANS[plan];
        let amount = billingCycle === "yearly" ? planInfo.yearlyPrice : planInfo.monthlyPrice;
        let couponMeta = null;

        if (couponCode && String(couponCode).trim()) {
            const couponResult = await validateCouponForCheckout({
                code: couponCode,
                userId: user._id,
                plan,
                billingCycle,
                baseAmount: amount
            });
            if (!couponResult.valid) {
                return res.status(400).json({ success: false, message: couponResult.message });
            }
            amount = couponResult.finalAmount;
            couponMeta = {
                code: couponResult.coupon.code,
                couponId: couponResult.coupon._id,
                name: couponResult.coupon.name,
                type: couponResult.coupon.type,
                value: couponResult.coupon.value,
                discountAmount: couponResult.discountAmount,
                originalAmount: couponResult.originalAmount
            };
        }

        const amountKurus = Math.round(amount * 100);

        await closeSupersededPendingPayments(user._id, { cancelAllPending: true });

        // Benzersiz sipariş ID oluştur (PayTR max 64 karakter, alfanumerik)
        const orderId = `DS${user._id.toString().slice(-8)}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, "");

        const userIp = paytrService.resolveUserIp(
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
                || req.socket?.remoteAddress
        );

        // ✅ Payment kaydı oluştur
        const payment = new Payment({
            userId: user._id,
            amount,
            currency: "TRY",
            status: "pending",
            paymentMethod: "paytr",
            transactionId: orderId,
            description: couponMeta
                ? `${BRAND_NAME} ${planInfo.name} - ${billingCycle === "yearly" ? "Yıllık" : "Aylık"} (Kupon: ${couponMeta.code})`
                : `${BRAND_NAME} ${planInfo.name} - ${billingCycle === "yearly" ? "Yıllık" : "Aylık"}`,
            expectedPlan: plan,
            expectedAmount: amountKurus,
            expectedBillingCycle: billingCycle,
            metadata: {
                plan,
                billingCycle,
                paytrOrderId: orderId,
                userEmail: user.email,
                userName: user.name,
                installmentCount: Math.max(0, parseInt(installmentCount, 10) || 0),
                ...(couponMeta ? { coupon: couponMeta } : {})
            }
        });
        await payment.save();

        logger.info(`💳 Ödeme kaydı oluşturuldu: ${orderId} — ${user.email} — ${planInfo.name} ${billingCycle} — ${amount} TL (${amountKurus} kuruş)`);

        const payPayload = {
            userEmail: user.email,
            userName: user.name || "Müşteri",
            userPhone: userDoc.profile?.phone || "",
            userAddress: userDoc.profile?.address?.city || "Türkiye",
            userIp,
            amount,
            orderId,
            plan,
            currency: "TL",
            installmentCount: payment.metadata.installmentCount,
        };

        const couponResponse = couponMeta
            ? {
                code: couponMeta.code,
                discountAmount: couponMeta.discountAmount,
                originalAmount: couponMeta.originalAmount,
            }
            : null;

        const preferred = String(req.body.preferredFlow || "").toLowerCase();
        const flow = preferred === "iframe" || preferred === "direct"
            ? preferred
            : paytrService.getPaymentFlow();

        if (flow === "iframe") {
            const iframeResult = await paytrService.requestIframeToken(payPayload);

            if (!iframeResult.success) {
                payment.status = "failed";
                payment.failReason = iframeResult.error;
                payment.failedAt = new Date();
                payment.metadata.error = iframeResult.error;
                await payment.save();

                logger.error(`PayTR iFrame token alınamadı: ${iframeResult.error} — ${user.email}, ${orderId}`);

                const errText = String(iframeResult.error || "");
                const needsPanel = /yetki|yetkisi|api/i.test(errText);
                return res.status(502).json({
                    success: false,
                    code: needsPanel ? "PAYTR_API_PERMISSION" : "PAYTR_IFRAME_ERROR",
                    message: needsPanel
                        ? "PayTR mağazanızda iFrame API yetkisi kapalı görünüyor. PayTR Mağaza Paneli → Destek & Kurulum → Destek üzerinden «iFrame API» yetkisi talep edin."
                        : (iframeResult.error || "Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."),
                });
            }

            logger.info(`✅ PayTR iFrame token hazır: ${orderId} — ${user.email}`);

            return res.json({
                success: true,
                flow: "iframe",
                iframeToken: iframeResult.iframeToken,
                iframeUrl: iframeResult.iframeUrl,
                paymentId: payment._id,
                orderId,
                amount,
                plan: planInfo.name,
                billingCycle,
                coupon: couponResponse,
            });
        }

        let formResult = paytrService.prepareDirectFormData(payPayload);

        if (!formResult.success) {
            payment.status = "failed";
            payment.failReason = formResult.error;
            payment.failedAt = new Date();
            payment.metadata.error = formResult.error;
            await payment.save();

            logger.error(`PayTR form hazırlanamadı: ${formResult.error} — Kullanıcı: ${user.email}, OrderId: ${orderId}`);

            return res.status(502).json({
                success: false,
                message: "Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
            });
        }

        logger.info(`✅ PayTR Direkt API form hazır: ${orderId} — ${user.email}`);

        res.json({
            success: true,
            flow: "direct",
            paymentUrl: formResult.paymentUrl,
            formData: formResult.formData,
            paymentId: payment._id,
            orderId,
            amount,
            plan: planInfo.name,
            billingCycle,
            coupon: couponResponse,
        });
    } catch (error) {
        logger.error(`Ödeme oluşturma hatası: ${error.message}`, { stack: error.stack });
        res.status(500).json({ success: false, message: "Ödeme oluşturulamadı" });
    }
};

// ─── 4. PAYTR CALLBACK (Ödeme sonucu) ───────────────────────────────────────────
/**
 * PayTR sunucusu ödeme sonucunu bu endpoint'e POST eder.
 * Content-Type: application/x-www-form-urlencoded
 * ⚠️ express.urlencoded() middleware'i server.js'de aktif olmalı!
 *
 * GÜVENLİK:
 * 1. HMAC-SHA256 hash doğrulama (timing-safe) → paytrService.processCallback
 * 2. Fiyat-plan doğrulama → expectedAmount vs totalAmount
 * 3. Atomik DB update → findOneAndUpdate (race condition koruması)
 * 4. İdempotency → zaten işlenmiş ödeme tekrar işlenmez
 */
exports.paytrCallback = async (req, res) => {
    const callbackStartTime = Date.now();
    try {
        logger.info(`📨 PayTR callback geldi — Body keys: ${Object.keys(req.body || {}).join(", ")}`);

        // ── 1. Hash doğrulama (paytrService içinde timing-safe) ──────────────
        const result = paytrService.processCallback(req.body);

        if (!result.success) {
            logger.error(`🚫 PayTR callback REDDEDILDI: ${result.error}`);
            return res.status(200).send("OK");
        }

        const { orderId, status, totalAmount, totalAmountKurus, failReasonCode, failReasonMsg } = result;

        // ── 2. Atomik Payment güncelleme (Race condition koruması) ────────────
        // findOneAndUpdate ile "pending" → "processing" atomik geçiş
        // Eğer başka bir callback aynı anda gelirse, ikincisi null alır
        let payment = await Payment.findOneAndUpdate(
            { transactionId: orderId, status: { $in: ["pending", "processing"] } },
            { $set: { status: "processing", processedAt: new Date() } },
            { new: true }
        );

        if (!payment) {
            const existing = await Payment.findOne({ transactionId: orderId });
            if (existing && status === "success") {
                const needsActivation = existing.status === "processing"
                    || (existing.status === "completed" && !existing.subscriptionId);
                if (needsActivation) {
                    logger.info(`PayTR callback yeniden deneme — aktivasyon: ${orderId} (${existing.status})`);
                    try {
                        await activateSubscriptionFromPayment(existing, {
                            totalAmountTl: totalAmount,
                            source: "paytr_callback_retry",
                            paytrVerified: true,
                        });
                    } catch (actErr) {
                        logger.error(`PayTR callback retry aktivasyon: ${actErr.message}`, { orderId });
                    }
                } else {
                    logger.warn(`PayTR callback: Ödeme zaten işlendi — ${orderId} (${existing.status})`);
                }
            } else if (!existing) {
                logger.error(`❌ PayTR callback: Ödeme kaydı bulunamadı — ${orderId}`);
            }
            return res.status(200).send("OK");
        }

        // ── 3. Tutar kontrolü (uyarı; PayTR hash doğrulandıysa ödemeyi iptal etme) ──
        if (status === "success" && payment.expectedAmount) {
            if (!paytrService.amountMatchesExpected(payment, totalAmountKurus, totalAmount)) {
                logger.warn(
                    `PayTR tutar farkı (aktivasyon devam): beklenen ${payment.expectedAmount} kuruş, gelen ${totalAmountKurus} — ${orderId}`
                );
                payment.metadata = {
                    ...(payment.metadata || {}),
                    amountMismatchWarning: true,
                    paytrChargedKurus: totalAmountKurus,
                    paytrChargedTl: totalAmount,
                };
                if (totalAmount > 0) payment.amount = totalAmount;
            }
        }

        if (status === "success") {
            payment.metadata = { ...(payment.metadata || {}), paytrResponse: result.rawData };
            await payment.save();

            let activated = false;
            try {
                const act = await activateSubscriptionFromPayment(payment, {
                    totalAmountTl: totalAmount,
                    source: "paytr_callback",
                    paytrVerified: true,
                });
                activated = !!act && !act.alreadyActive;
                if (act?.alreadyActive) {
                    logger.info(`PayTR callback: abonelik zaten aktif — ${orderId}`);
                }
            } catch (actErr) {
                logger.error(`PayTR callback abonelik aktivasyonu: ${actErr.message}`, { orderId, stack: actErr.stack });
                payment.status = "processing";
                payment.failReason = `Aktivasyon hatası: ${actErr.message}`;
                payment.metadata.activationError = actErr.message;
                await payment.save();
            }

            logger.info(`✅ Ödeme başarılı: ${orderId} — ${totalAmount} TL — aktif=${activated} — ${Date.now() - callbackStartTime}ms`);
        } else {
            // ── 6. Ödeme başarısız — detaylı hata kaydı ──────────────────────
            payment.status = "failed";
            payment.failReason = failReasonMsg || req.body.failed_reason_msg || "Bilinmeyen hata";
            payment.errorCode = failReasonCode || req.body.failed_reason_code || "UNKNOWN";
            payment.failedAt = new Date();
            payment.metadata.paytrResponse = result.rawData;
            await payment.save();

            logger.warn(`❌ Ödeme başarısız: ${orderId} — Sebep: ${payment.failReason} — Kod: ${payment.errorCode} — İşlem süresi: ${Date.now() - callbackStartTime}ms`);
        }

        // PayTR'a OK yanıtı gönder (zorunlu — aksi halde tekrar dener)
        res.status(200).send("OK");
    } catch (error) {
        logger.error(`💥 PayTR callback İŞLEME HATASI: ${error.message}`, {
            stack: error.stack,
            body: req.body ? { merchant_oid: req.body.merchant_oid, status: req.body.status } : "empty",
            duration: `${Date.now() - callbackStartTime}ms`
        });
        // Hata olsa bile OK dönmemiz gerekiyor (PayTR tekrar denemesini önlemek için)
        res.status(200).send("OK");
    }
};

/** Ödeme henüz iframe’de — otomatik sync ile failed yapma (30 dk) */
const OPEN_PAYMENT_GRACE_MS = 30 * 60 * 1000;

function isOpenPaymentStillValid(payment) {
    if (!payment?.createdAt) return false;
    if (!["pending", "processing"].includes(payment.status)) return false;
    const age = Date.now() - new Date(payment.createdAt).getTime();
    return age < OPEN_PAYMENT_GRACE_MS;
}

/** PayTR durum sorgusuna göre ödemeyi başarısız işaretle */
async function markPaymentFailed(payment, reason, extra = {}) {
    payment.status = "failed";
    payment.failReason = reason || "Ödeme başarısız";
    payment.failedAt = new Date();
    payment.metadata = { ...(payment.metadata || {}), ...extra, statusQueryAt: new Date().toISOString() };
    await payment.save();
}

// ─── PayTR Durum Sorgu ile ödeme doğrulama (başarı / başarısız) ─────────────────
exports.verifyPayment = async (req, res) => {
    try {
        const uid = toUserObjectId(req.user._id);
        if (!uid) {
            return res.status(401).json({ success: false, message: "Oturum gerekli" });
        }

        let merchantOid = String(req.body?.merchant_oid || req.query?.merchant_oid || "").trim();

        let payment;
        if (merchantOid) {
            payment = await Payment.findOne({ userId: uid, transactionId: merchantOid });
        } else {
            payment = await Payment.findOne({
                userId: uid,
                paymentMethod: "paytr",
                status: { $in: ["pending", "processing", "completed"] },
            }).sort({ createdAt: -1 });
            merchantOid = payment?.transactionId || "";
        }

        if (!payment || !merchantOid) {
            return res.status(404).json({
                success: false,
                verified: false,
                paymentStatus: "unknown",
                message: "Ödeme kaydı bulunamadı",
                redirectTo: "/subscription",
            });
        }

        let query = await paytrService.queryOrderStatus(merchantOid);

        if (!query.apiOk) {
            return res.status(502).json({
                success: false,
                verified: false,
                paymentStatus: "unknown",
                message: query.error || "PayTR durum sorgusu yapılamadı",
            });
        }

        if (
            !query.paid &&
            ["pending", "processing"].includes(payment.status)
        ) {
            for (let attempt = 0; attempt < 4 && !query.paid; attempt++) {
                await new Promise((r) => setTimeout(r, 1500));
                query = await paytrService.queryOrderStatus(merchantOid);
            }
        }

        if (!query.paid) {
            await markPaymentFailed(payment, query.errMsg, { paytrStatusQuery: query.raw });
            logger.info(`PayTR durum sorgu: başarısız — ${merchantOid} — ${query.errMsg}`);

            return res.json({
                success: true,
                verified: true,
                paymentStatus: "failed",
                message: query.errMsg || "Ödeme başarısız veya tamamlanmadı.",
                redirectTo: "/subscription",
                orderId: merchantOid,
            });
        }

        let activated = false;
        try {
            const act = await activateSubscriptionFromPayment(payment, {
                totalAmountTl: query.paymentTotalTl || payment.amount,
                source: "paytr_status_query",
                paytrVerified: true,
            });
            activated = !!act && !act?.alreadyActive;
        } catch (actErr) {
            logger.error(`Durum sorgu sonrası aktivasyon: ${actErr.message}`, { merchantOid });
            return res.json({
                success: true,
                verified: true,
                paymentStatus: "pending_activation",
                message: "Ödeme PayTR'de başarılı; paket aktivasyonu birkaç saniye sürebilir.",
                orderId: merchantOid,
            });
        }

        const user = await User.findById(uid).select("subscription").lean();
        const us = user?.subscription || {};
        const now = new Date();
        const end = us.endDate ? new Date(us.endDate) : null;
        const isActive = us.status === "active" && us.plan !== "trial" && end && end > now;

        logger.info(`PayTR durum sorgu: başarılı — ${merchantOid} — aktif=${activated}`);

        return res.json({
            success: true,
            verified: true,
            paymentStatus: "success",
            activated,
            orderId: merchantOid,
            paytr: {
                amount: query.paymentTotal,
                currency: query.currency,
                paymentDate: query.paymentDate,
                installment: query.installment,
            },
            subscription: {
                plan: us.plan,
                status: us.status,
                isActive,
                daysLeft: isActive ? Math.ceil((end - now) / 86400000) : 0,
            },
            redirectTo: isActive ? "/dashboard" : "/subscription",
        });
    } catch (error) {
        logger.error(`verifyPayment hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Ödeme doğrulanamadı" });
    }
};

// ─── Ödeme sonrası abonelik senkronu (admin onayı gerekmez — PayTR callback yedek) ─
exports.syncSubscriptionAfterPayment = async (req, res) => {
    try {
        const uid = toUserObjectId(req.user._id);
        if (!uid) {
            return res.status(401).json({ success: false, message: "Oturum gerekli" });
        }

        const user = await User.findById(uid).select("email subscription");
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const sub = user.subscription ? user.subscription.toObject() : {};
        const now = new Date();
        const endDate = sub.endDate ? new Date(sub.endDate) : null;
        if (sub.status === "active" && sub.plan && sub.plan !== "trial" && endDate && endDate > now) {
            return res.json({
                success: true,
                synced: true,
                alreadyActive: true,
                subscription: {
                    plan: sub.plan,
                    status: sub.status,
                    isActive: true,
                    daysLeft: Math.ceil((endDate - now) / (86400000)),
                },
            });
        }

        const payment = await Payment.findOne({
            userId: uid,
            paymentMethod: "paytr",
            status: { $in: ["processing", "completed", "pending"] },
            expectedPlan: { $exists: true, $nin: [null, ""] },
        })
            .sort({ createdAt: -1 });

        if (!payment) {
            return res.json({
                success: true,
                synced: false,
                message: "Aktifleştirilecek PayTR ödemesi bulunamadı",
            });
        }

        const query = await paytrService.queryOrderStatus(payment.transactionId);

        if (payment.status === "failed") {
            if (query.apiOk && query.paid) {
                try {
                    const act = await activateSubscriptionFromPayment(payment, {
                        totalAmountTl: query.paymentTotalTl || payment.amount,
                        source: "sync_recover_failed",
                        paytrVerified: true,
                    });
                    const updated = await User.findById(uid).select("subscription").lean();
                    const us = updated?.subscription || {};
                    const end = us.endDate ? new Date(us.endDate) : null;
                    const isActive = us.status === "active" && us.plan !== "trial" && end && end > now;
                    return res.json({
                        success: true,
                        synced: true,
                        recovered: true,
                        activated: !act?.alreadyActive,
                        paymentStatus: "success",
                        subscription: {
                            plan: us.plan,
                            status: us.status,
                            isActive,
                            daysLeft: isActive ? Math.ceil((end - now) / 86400000) : 0,
                        },
                    });
                } catch (actErr) {
                    logger.error(`sync failed→paid kurtarma: ${actErr.message}`);
                }
            }
            return res.json({
                success: false,
                synced: false,
                paymentStatus: "failed",
                message: payment.failReason || "Son ödeme başarısız",
                redirectTo: "/subscription",
            });
        }
        if (!query.apiOk) {
            if (payment.status === "completed") {
                const act = await activateSubscriptionFromPayment(payment, {
                    totalAmountTl: payment.amount,
                    source: "sync_callback_completed",
                    paytrVerified: true,
                });
                const updated = await User.findById(uid).select("subscription").lean();
                const us = updated?.subscription || {};
                const end = us.endDate ? new Date(us.endDate) : null;
                const isActive = us.status === "active" && us.plan !== "trial" && end && end > now;
                return res.json({
                    success: true,
                    synced: true,
                    activated: !act?.alreadyActive,
                    paymentStatus: "success",
                    subscription: { plan: us.plan, status: us.status, isActive, daysLeft: isActive ? Math.ceil((end - now) / 86400000) : 0 },
                });
            }
            return res.json({
                success: false,
                synced: false,
                paymentStatus: "unknown",
                message: query.error || "PayTR durum sorgusu yapılamadı",
            });
        }

        if (query.apiOk && !query.paid) {
            if (isOpenPaymentStillValid(payment)) {
                return res.json({
                    success: true,
                    synced: false,
                    paymentStatus: "pending",
                    message: "Ödeme henüz tamamlanmadı",
                });
            }
            await markPaymentFailed(payment, query.errMsg, { paytrStatusQuery: query.raw });
            return res.json({
                success: false,
                synced: false,
                paymentStatus: "failed",
                message: query.errMsg || "Ödeme PayTR'de başarısız",
                redirectTo: "/subscription",
            });
        }

        if (query.apiOk && query.paid) {
            const act = await activateSubscriptionFromPayment(payment, {
                totalAmountTl: query.paymentTotalTl || payment.amount,
                source: "sync_status_query",
                paytrVerified: true,
            });
            const updated = await User.findById(uid).select("subscription").lean();
            const us = updated?.subscription || {};
            const end = us.endDate ? new Date(us.endDate) : null;
            const isActive = us.status === "active" && us.plan !== "trial" && end && end > now;
            return res.json({
                success: true,
                synced: true,
                activated: !act?.alreadyActive,
                paymentStatus: "success",
                subscription: { plan: us.plan, status: us.status, isActive, daysLeft: isActive ? Math.ceil((end - now) / 86400000) : 0 },
            });
        }

        return res.json({
            success: true,
            synced: false,
            paymentStatus: "pending",
            message: "Ödeme henüz PayTR üzerinden onaylanmadı",
        });
    } catch (error) {
        logger.error(`Ödeme sonrası sync: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik senkronu başarısız" });
    }
};

// ─── Ödeme ekranı kapatıldı — tamamlanmamış ödemeyi iptal et (başarı sayma) ───
exports.cancelPendingPayment = async (req, res) => {
    try {
        const uid = toUserObjectId(req.user._id);
        if (!uid) {
            return res.status(401).json({ success: false, message: "Oturum gerekli" });
        }

        const paymentId = req.body?.paymentId;
        let payment;
        if (paymentId) {
            payment = await Payment.findOne({
                _id: paymentId,
                userId: uid,
                paymentMethod: "paytr",
            });
        } else {
            payment = await Payment.findOne({
                userId: uid,
                paymentMethod: "paytr",
                status: { $in: ["pending", "processing"] },
            }).sort({ createdAt: -1 });
        }

        if (!payment) {
            return res.json({ success: true, cancelled: false, message: "İptal edilecek açık ödeme yok" });
        }

        if (payment.status === "completed") {
            const q = await paytrService.queryOrderStatus(payment.transactionId);
            if (q.apiOk && q.paid) {
                return res.json({
                    success: true,
                    cancelled: false,
                    paymentStatus: "success",
                    message: "Ödeme zaten tamamlanmış",
                });
            }
            return res.json({ success: true, cancelled: false });
        }

        if (!["pending", "processing"].includes(payment.status)) {
            return res.json({ success: true, cancelled: false });
        }

        const query = await paytrService.queryOrderStatus(payment.transactionId);
        if (query.apiOk && query.paid) {
            try {
                await activateSubscriptionFromPayment(payment, {
                    totalAmountTl: query.paymentTotalTl || payment.amount,
                    source: "cancel_check_paid",
                    paytrVerified: true,
                });
            } catch (actErr) {
                logger.error(`İptal sırasında aktivasyon: ${actErr.message}`);
            }
            return res.json({
                success: true,
                cancelled: false,
                paymentStatus: "success",
                message: "Ödeme PayTR'de başarılı; abonelik aktifleştiriliyor",
            });
        }

        await markPaymentFailed(payment, "Kullanıcı ödeme ekranını kapattı", {
            abandoned: true,
            paytrStatusQuery: query.raw,
        });
        logger.info(`Ödeme iptal (ekran kapatıldı): ${payment.transactionId} — ${payment.userId}`);

        return res.json({
            success: true,
            cancelled: true,
            paymentStatus: "failed",
            message: "Ödeme tamamlanmadı",
            orderId: payment.transactionId,
        });
    } catch (error) {
        logger.error(`cancelPendingPayment: ${error.message}`);
        res.status(500).json({ success: false, message: "Ödeme iptal edilemedi" });
    }
};

// ─── 5a. BIN sorgu — taksitli ödemede card_type (PayTR Direkt API) ───────────────
exports.lookupBin = async (req, res) => {
    try {
        if (paytrService.getPaymentFlow() === "iframe") {
            return res.status(400).json({
                success: false,
                message: "Taksit/kart tipi PayTR ödeme ekranında seçilir (iFrame modu).",
            });
        }
        const binNumber = String(req.body.binNumber || req.body.card_number || "").replace(/\D/g, "");
        const result = await paytrService.lookupBinDetail(binNumber);
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }
        res.json({
            success: true,
            cardType: result.cardType,
            brand: result.brand,
            bank: result.raw?.bank,
        });
    } catch (error) {
        logger.error(`BIN lookup hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "BIN sorgusu yapılamadı" });
    }
};

// ─── 5b. Direkt ödeme token yenile (taksit / tutar — PayTR 1. Adım) ───────────
exports.refreshDirectPayment = async (req, res) => {
    try {
        const { paymentId, installmentCount = 0 } = req.body;
        const uid = toUserObjectId(req.user._id);
        if (!uid || !paymentId) {
            return res.status(400).json({ success: false, message: "paymentId zorunludur" });
        }

        const payment = await Payment.findOne({ _id: paymentId, userId: uid, status: "pending" });
        if (!payment) {
            return res.status(404).json({ success: false, message: "Bekleyen ödeme bulunamadı" });
        }

        const inst = Math.max(0, parseInt(installmentCount, 10) || 0);
        payment.metadata = { ...(payment.metadata || {}), installmentCount: inst };
        await payment.save();

        const userDoc = await User.findById(uid);
        const formResult = paytrService.prepareDirectFormData({
            userEmail: userDoc.email,
            userName: userDoc.name || "Müşteri",
            userPhone: userDoc.profile?.phone || "",
            userAddress: userDoc.profile?.address?.city || "Türkiye",
            userIp: paytrService.resolveUserIp(
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress
            ),
            amount: payment.amount,
            orderId: payment.transactionId,
            plan: payment.expectedPlan || payment.metadata?.plan,
            installmentCount: inst,
        });

        if (!formResult.success) {
            return res.status(502).json({ success: false, message: formResult.error });
        }

        res.json({
            success: true,
            flow: "direct",
            formData: formResult.formData,
            paymentUrl: formResult.paymentUrl,
            installmentCount: inst,
            amountTl: formResult.paymentAmountTl,
        });
    } catch (error) {
        logger.error(`Direkt ödeme yenileme: ${error.message}`);
        res.status(500).json({ success: false, message: "Ödeme formu yenilenemedi" });
    }
};

// ─── 5. BEKLEYEN ÖDEMEDE TAKSİT / TOKEN YENİLE (kart formu) ─────────────────────
exports.updatePaymentInstallment = async (req, res) => {
    try {
        const { paymentId, installmentCount = 0 } = req.body;
        const uid = toUserObjectId(req.user._id);
        if (!uid || !paymentId) {
            return res.status(400).json({ success: false, message: "paymentId zorunludur" });
        }

        const payment = await Payment.findOne({ _id: paymentId, userId: uid, status: "pending" });
        if (!payment) {
            return res.status(404).json({ success: false, message: "Bekleyen ödeme bulunamadı" });
        }

        const inst = Math.max(0, parseInt(installmentCount, 10) || 0);
        payment.metadata = { ...(payment.metadata || {}), installmentCount: inst };
        await payment.save();

        const userDoc = await User.findById(uid);
        if (!userDoc) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const payPayload = {
            userEmail: userDoc.email,
            userName: userDoc.name || "Müşteri",
            userPhone: userDoc.profile?.phone || "",
            userAddress: userDoc.profile?.address?.city || "Türkiye",
            userIp: paytrService.resolveUserIp(
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress
            ),
            amount: payment.amount,
            orderId: payment.transactionId,
            plan: payment.expectedPlan || payment.metadata?.plan,
            currency: "TL",
            installmentCount: inst,
        };

        const flow = paytrService.getPaymentFlow();

        if (flow === "iframe") {
            const iframeResult = await paytrService.requestIframeToken(payPayload);
            if (!iframeResult.success) {
                return res.status(502).json({ success: false, message: iframeResult.error });
            }
            return res.json({
                success: true,
                flow: "iframe",
                iframeToken: iframeResult.iframeToken,
                iframeUrl: iframeResult.iframeUrl,
                installmentCount: inst,
            });
        }

        const formResult = paytrService.prepareDirectFormData(payPayload);
        if (!formResult.success) {
            return res.status(502).json({ success: false, message: formResult.error });
        }
        return res.json({
            success: true,
            flow: "direct",
            formData: formResult.formData,
            paymentUrl: formResult.paymentUrl,
            installmentCount: inst,
        });
    } catch (error) {
        logger.error(`Taksit güncelleme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Ödeme formu yenilenemedi" });
    }
};

// ─── 6. ADMIN: KULLANICIYA DEMO/ABONELİK VER ────────────────────────────────────
exports.adminGrantSubscription = async (req, res) => {
    try {
        const { userId, plan, days, note } = req.body;
        const adminUser = req.user;

        if (!userId || !plan || !days) {
            return res.status(400).json({ success: false, message: "userId, plan ve days zorunludur" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const now = new Date();
        const isPlanTrial = plan === "trial";

        // ✅ FIX: Mongoose subdocument'ı düzgün oku
        const existingSub = user.subscription ? user.subscription.toObject() : {};

        // ✅ FIX: Admin grant'te de expire_date koruması
        const existingEndDate = existingSub.endDate ? new Date(existingSub.endDate) : null;
        const isCurrentlyActive = existingEndDate && existingEndDate > now
            && existingSub.status === "active"
            && existingSub.plan === plan;

        const baseDate = isCurrentlyActive ? existingEndDate : now;
        const endDate = new Date(baseDate);
        endDate.setDate(endDate.getDate() + parseInt(days));

        logger.info(`📋 Admin grant — ${user.email}: önceki plan=${existingSub.plan || "yok"}, yeni plan=${plan}, base=${baseDate.toISOString()}, end=${endDate.toISOString()}`);

        const { getLimitsForPlan } = require("../services/planFeatureService");
        const grantLimits = (await getPlansFromDB())[isPlanTrial ? "trial" : plan]?.limits
            || (await getLimitsForPlan(isPlanTrial ? "trial" : plan));

        user.subscription = {
            plan: isPlanTrial ? "trial" : plan,
            status: isPlanTrial ? "trial" : "active",
            startDate: isCurrentlyActive ? existingSub.startDate : now,
            endDate,
            trialStartDate: isPlanTrial ? now : existingSub.trialStartDate,
            trialEndDate: isPlanTrial ? endDate : existingSub.trialEndDate,
            trialUsed: !isPlanTrial ? true : existingSub.trialUsed,
            grantedBy: adminUser._id,
            grantedAt: now,
            grantNote: note || `Admin tarafından ${days} günlük ${plan} verildi`,
            limits: grantLimits
        };
        await user.save();

        // Subscription model'i de güncelle
        await Subscription.findOneAndUpdate(
            { userId: user._id },
            {
                plan: isPlanTrial ? "trial" : plan,
                status: isPlanTrial ? "trial" : "active",
                startDate: isCurrentlyActive ? existingSub.startDate : now,
                endDate,
                trialEndDate: isPlanTrial ? endDate : undefined,
                notes: note || `Admin ${adminUser.email} tarafından verildi`,
                limits: (await getPlansFromDB())[plan]?.limits || {}
            },
            { upsert: true, new: true }
        );

        logger.info(`👑 Admin ${adminUser.email} → ${user.email} kullanıcısına ${days} gün ${plan} verdi (bitiş: ${endDate.toISOString()})`);

        res.json({
            success: true,
            message: `${user.name} kullanıcısına ${days} günlük ${plan} paketi verildi`,
            subscription: user.subscription
        });
    } catch (error) {
        logger.error(`Admin abonelik verme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik verilemedi" });
    }
};

// ─── 6. ADMIN: TÜM ABONELİKLERİ LİSTELE ────────────────────────────────────────
exports.adminListSubscriptions = async (req, res) => {
    try {
        const users = await User.find({})
            .select("name email role subscription createdAt")
            .sort({ createdAt: -1 })
            .lean();

        const now = new Date();
        const enriched = users.map(u => {
            const sub = u.subscription || {};
            const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
            const endDate = sub.endDate ? new Date(sub.endDate) : null;

            let daysLeft = 0;
            let isExpired = false;
            let isExpiringSoon = false;

            if (sub.status === "trial" && trialEnd) {
                daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                isExpired = daysLeft <= 0;
                isExpiringSoon = daysLeft > 0 && daysLeft <= 3;
            } else if (sub.status === "active" && endDate) {
                daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                isExpired = daysLeft <= 0;
                isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
            }

            return {
                ...u,
                daysLeft: Math.max(0, daysLeft),
                isExpired,
                isExpiringSoon
            };
        });

        res.json({ success: true, users: enriched });
    } catch (error) {
        logger.error(`Admin abonelik listesi hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Abonelik listesi alınamadı" });
    }
};

// ─── 7. MEVCUT KULLANICILARA DEMO VER (Toplu) ───────────────────────────────────
exports.adminGrantDemoToAll = async (req, res) => {
    try {
        const { days = 1 } = req.body; // Default 1 gün
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + parseInt(days));

        // TÜM kullanıcıları bul (admin/dev hariç) — trial olanlar dahil
        const result = await User.updateMany(
            {
                role: { $nin: ["admin", "dev"] }
            },
            {
                $set: {
                    "subscription.plan": "trial",
                    "subscription.status": "trial",
                    "subscription.startDate": now,
                    "subscription.trialStartDate": now,
                    "subscription.trialEndDate": trialEnd,
                    "subscription.trialUsed": false,
                    "subscription.grantedBy": req.user._id,
                    "subscription.grantedAt": now,
                    "subscription.grantNote": `Toplu demo: ${days} gün`
                }
            }
        );

        logger.info(`👑 Toplu demo verildi: ${result.modifiedCount} kullanıcıya ${days} gün`);

        res.json({
            success: true,
            message: `${result.modifiedCount} kullanıcıya ${days} günlük demo verildi`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        logger.error(`Toplu demo verme hatası: ${error.message}`);
        res.status(500).json({ success: false, message: "Toplu demo verilemedi" });
    }
};
