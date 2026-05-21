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
const {
    validateCouponForCheckout,
    recordCouponRedemption,
    normalizeCode
} = require("../services/couponService");
const logger = require("../config/logger");
const mongoose = require("mongoose");

const { DEFAULT_PLAN_DEFINITIONS } = require("../config/defaultPlanDefinitions");

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

        // Ödeme geçmişi
        let payments = [];
        try {
            payments = await Payment.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
        } catch (payErr) {
            logger.warn(`Ödeme geçmişi alınamadı: ${payErr.message}`);
        }

        const currentPlans = await getPlansFromDB();
        const { getPlanContext } = require("../services/planFeatureService");
        const planContext = await getPlanContext(user);

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
                grantNote: sub.grantNote
            },
            payments,
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
        const { plan, billingCycle = "monthly", couponCode } = req.body;
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
            logger.warn(`PayTR credentials eksik — ödeme yapılamıyor. Kullanıcı: ${user.email}, Plan: ${plan}`);
            return res.status(503).json({
                success: false,
                demoMode: true,
                activated: false,
                message: "Ödeme sistemi henüz yapılandırılmamış. Lütfen daha sonra tekrar deneyin veya yönetici ile iletişime geçin."
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

        // Benzersiz sipariş ID oluştur (PayTR max 64 karakter, alfanumerik)
        const orderId = `LE${user._id.toString().slice(-8)}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, "");

        // Kullanıcı IP'si
        const userIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
            || req.socket?.remoteAddress?.replace("::ffff:", "")
            || "85.34.78.112";

        // ✅ Payment kaydı oluştur
        const payment = new Payment({
            userId: user._id,
            amount,
            currency: "TRY",
            status: "pending",
            paymentMethod: "paytr",
            transactionId: orderId,
            description: couponMeta
                ? `LysiaETIC ${planInfo.name} - ${billingCycle === "yearly" ? "Yıllık" : "Aylık"} (Kupon: ${couponMeta.code})`
                : `LysiaETIC ${planInfo.name} - ${billingCycle === "yearly" ? "Yıllık" : "Aylık"}`,
            expectedPlan: plan,
            expectedAmount: amountKurus,
            expectedBillingCycle: billingCycle,
            metadata: {
                plan,
                billingCycle,
                paytrOrderId: orderId,
                userEmail: user.email,
                userName: user.name,
                ...(couponMeta ? { coupon: couponMeta } : {})
            }
        });
        await payment.save();

        logger.info(`💳 Ödeme kaydı oluşturuldu: ${orderId} — ${user.email} — ${planInfo.name} ${billingCycle} — ${amount} TL (${amountKurus} kuruş)`);

        // ── PayTR Direkt API form verilerini hazırla ─────────────────────────
        const formResult = paytrService.prepareDirectFormData({
            userEmail: user.email,
            userName: user.name || "Müşteri",
            userPhone: userDoc.profile?.phone || "",
            userAddress: userDoc.profile?.address?.city || "Türkiye",
            userIp,
            amount,
            orderId,
            plan,
            currency: "TL"
        });

        if (!formResult.success) {
            payment.status = "failed";
            payment.failReason = formResult.error;
            payment.failedAt = new Date();
            payment.metadata.error = formResult.error;
            await payment.save();

            logger.error(`PayTR form hazırlanamadı: ${formResult.error} — Kullanıcı: ${user.email}, OrderId: ${orderId}`);

            return res.status(502).json({
                success: false,
                message: `Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.`
            });
        }

        logger.info(`✅ PayTR Direkt API form hazır: ${orderId} — ${user.email}`);

        // Frontend'e form verilerini gönder
        // Frontend bu verileri + kart bilgilerini hidden form ile PayTR'a POST edecek
        res.json({
            success: true,
            paymentUrl: formResult.paymentUrl,
            formData: formResult.formData,
            paymentId: payment._id,
            orderId,
            amount,
            plan: planInfo.name,
            billingCycle,
            coupon: couponMeta
                ? {
                    code: couponMeta.code,
                    discountAmount: couponMeta.discountAmount,
                    originalAmount: couponMeta.originalAmount
                }
                : null
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
        const payment = await Payment.findOneAndUpdate(
            { transactionId: orderId, status: "pending" },
            { $set: { status: "processing", processedAt: new Date() } },
            { new: true }
        );

        if (!payment) {
            // Ya bulunamadı ya da zaten işleniyor/işlenmiş
            const existing = await Payment.findOne({ transactionId: orderId }).lean();
            if (existing) {
                logger.warn(`⚡ PayTR callback: Ödeme zaten işleniyor/işlenmiş — ${orderId} (mevcut status: ${existing.status})`);
            } else {
                logger.error(`❌ PayTR callback: Ödeme kaydı bulunamadı — ${orderId}`);
            }
            return res.status(200).send("OK");
        }

        // ── 3. Fiyat-plan doğrulama (amount manipulation koruması) ───────────
        if (status === "success" && payment.expectedAmount) {
            if (totalAmountKurus !== payment.expectedAmount) {
                logger.error(`💀 TUTAR UYUŞMAZLIĞI! Beklenen: ${payment.expectedAmount} kuruş, Gelen: ${totalAmountKurus} kuruş — OrderId: ${orderId}`);
                // Tutarı kaydet ama abonelik aktifleştirme — manuel inceleme gerekli
                payment.status = "failed";
                payment.failReason = `Tutar uyuşmazlığı: beklenen ${payment.expectedAmount}, gelen ${totalAmountKurus}`;
                payment.errorCode = "AMOUNT_MISMATCH";
                payment.failedAt = new Date();
                payment.metadata.paytrResponse = result.rawData;
                await payment.save();
                logger.error(`💀 Ödeme AMOUNT_MISMATCH nedeniyle reddedildi — ${orderId}. Manuel inceleme gerekli!`);
                return res.status(200).send("OK");
            }
        }

        if (status === "success") {
            // ── 4. Ödeme başarılı — transaction ile atomik güncelle ───────────
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    payment.status = "completed";
                    payment.paidAt = new Date();
                    payment.metadata.paytrResponse = result.rawData;
                    await payment.save({ session });

                    const user = await User.findById(payment.userId).session(session);
                    if (!user) {
                        logger.error(`❌ PayTR callback: Kullanıcı bulunamadı — userId: ${payment.userId}, orderId: ${orderId}`);
                        return;
                    }

                    const plan = payment.expectedPlan || payment.metadata.plan;
                    const billingCycle = payment.expectedBillingCycle || payment.metadata.billingCycle || "monthly";
                    const now = new Date();
                    const existingSub = user.subscription ? user.subscription.toObject() : {};
                    const existingEndDate = existingSub.endDate ? new Date(existingSub.endDate) : null;
                    const isCurrentlyActive = existingEndDate && existingEndDate > now
                        && existingSub.status === "active"
                        && existingSub.plan === plan;
                    const baseDate = isCurrentlyActive ? existingEndDate : now;
                    const endDate = new Date(baseDate);
                    if (billingCycle === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);
                    else endDate.setMonth(endDate.getMonth() + 1);

                    logger.info(`📋 Abonelik değişimi — ${user.email}:`, {
                        onceki: {
                            plan: existingSub.plan || "yok",
                            status: existingSub.status || "yok",
                            endDate: existingSub.endDate ? new Date(existingSub.endDate).toISOString() : "yok"
                        },
                        yeni: {
                            plan,
                            status: "active",
                            baseDate: baseDate.toISOString(),
                            endDate: endDate.toISOString(),
                            sureEklendi: isCurrentlyActive ? "mevcut süreye eklendi" : "şimdiden başlatıldı"
                        }
                    });

                    const planLimits = (await getPlansFromDB())[plan]?.limits || {};
                    user.subscription = {
                        ...existingSub,
                        plan,
                        status: "active",
                        startDate: isCurrentlyActive ? existingSub.startDate : now,
                        endDate,
                        trialUsed: true,
                        lastPaymentId: payment._id.toString(),
                        autoRenew: true,
                        limits: planLimits
                    };
                    delete user.subscription.trialStartDate;
                    delete user.subscription.trialEndDate;
                    delete user.subscription.grantedBy;
                    delete user.subscription.grantedAt;
                    delete user.subscription.grantNote;
                    await user.save({ session });

                    const subDoc = await Subscription.findOneAndUpdate(
                        { userId: user._id },
                        {
                            plan,
                            status: "active",
                            startDate: isCurrentlyActive ? existingSub.startDate : now,
                            endDate,
                            price: totalAmount,
                            billingCycle,
                            lastPaymentDate: now,
                            nextPaymentDate: endDate,
                            paymentMethod: "paytr",
                            limits: (await getPlansFromDB())[plan]?.limits || {}
                        },
                        { upsert: true, new: true, session }
                    );

                    payment.subscriptionId = subDoc._id;
                    await payment.save({ session });

                    if (payment.metadata?.coupon?.couponId) {
                        await recordCouponRedemption({
                            couponId: payment.metadata.coupon.couponId,
                            userId: user._id,
                            paymentId: payment._id,
                            code: payment.metadata.coupon.code,
                            plan,
                            billingCycle,
                            originalAmount: payment.metadata.coupon.originalAmount,
                            discountAmount: payment.metadata.coupon.discountAmount,
                            finalAmount: payment.amount
                        });
                    }

                    logger.info(`🎉 Abonelik aktifleştirildi: ${user.email} → ${plan} (${billingCycle}) — Bitiş: ${endDate.toISOString()} — Toplam işlem: ${Date.now() - callbackStartTime}ms`);
                });
            } finally {
                session.endSession();
            }

            logger.info(`✅ Ödeme başarılı: ${orderId} — ${totalAmount} TL — İşlem süresi: ${Date.now() - callbackStartTime}ms`);
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

// ─── 5. ADMIN: KULLANICIYA DEMO/ABONELİK VER ────────────────────────────────────
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
