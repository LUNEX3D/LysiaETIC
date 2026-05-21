/**
 * Kupon doğrulama ve indirim hesaplama — SaaS abonelik ödemeleri
 */
const PromotionCoupon = require("../models/PromotionCoupon");
const CouponRedemption = require("../models/CouponRedemption");

const normalizeCode = (code) => String(code || "").trim().toUpperCase().replace(/\s+/g, "");

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const calculateDiscount = (coupon, baseAmount) => {
    const base = roundMoney(baseAmount);
    if (base <= 0) {
        return { discountAmount: 0, finalAmount: 0 };
    }

    let discountAmount = 0;
    if (coupon.type === "percent") {
        const pct = Math.min(100, Math.max(0, Number(coupon.value) || 0));
        discountAmount = base * (pct / 100);
        if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
    } else {
        discountAmount = Math.min(base - 1, Math.max(0, Number(coupon.value) || 0));
    }

    discountAmount = roundMoney(discountAmount);
    const finalAmount = roundMoney(Math.max(1, base - discountAmount));
    return { discountAmount, finalAmount };
};

const validateCouponForCheckout = async ({
    code,
    userId,
    plan,
    billingCycle,
    baseAmount
}) => {
    const normalized = normalizeCode(code);
    if (!normalized) {
        return { valid: false, message: "Kupon kodu girin" };
    }

    const coupon = await PromotionCoupon.findOne({ code: normalized }).lean();
    if (!coupon) {
        return { valid: false, message: "Kupon kodu bulunamadı" };
    }

    if (!coupon.isActive) {
        return { valid: false, message: "Bu kupon artık aktif değil" };
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
        return { valid: false, message: "Kupon henüz geçerli değil" };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
        return { valid: false, message: "Kupon süresi dolmuş" };
    }

    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, message: "Kupon kullanım limiti dolmuş" };
    }

    if (Array.isArray(coupon.applicablePlans) && coupon.applicablePlans.length > 0) {
        if (!coupon.applicablePlans.includes(plan)) {
            return {
                valid: false,
                message: "Bu kupon seçtiğiniz paket için geçerli değil"
            };
        }
    }

    if (Array.isArray(coupon.applicableBillingCycles) && coupon.applicableBillingCycles.length > 0) {
        if (!coupon.applicableBillingCycles.includes(billingCycle)) {
            return {
                valid: false,
                message: "Bu kupon seçtiğiniz ödeme periyodu için geçerli değil"
            };
        }
    }

    const base = roundMoney(baseAmount);
    if (coupon.minPurchaseAmount > 0 && base < coupon.minPurchaseAmount) {
        return {
            valid: false,
            message: `Bu kupon için minimum tutar ${coupon.minPurchaseAmount} TL`
        };
    }

    if (userId) {
        const userUsage = await CouponRedemption.countDocuments({
            couponId: coupon._id,
            userId
        });
        const perUserLimit = coupon.perUserLimit ?? 1;
        if (userUsage >= perUserLimit) {
            return { valid: false, message: "Bu kuponu kullanım limitiniz doldu" };
        }
    }

    const { discountAmount, finalAmount } = calculateDiscount(coupon, base);
    if (finalAmount < 1) {
        return { valid: false, message: "İndirim sonrası ödeme tutarı geçersiz" };
    }

    return {
        valid: true,
        coupon: {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            type: coupon.type,
            value: coupon.value,
            campaignTag: coupon.campaignTag
        },
        originalAmount: base,
        discountAmount,
        finalAmount,
        message: "Kupon uygulandı"
    };
};

const recordCouponRedemption = async ({
    couponId,
    userId,
    paymentId,
    code,
    plan,
    billingCycle,
    originalAmount,
    discountAmount,
    finalAmount
}) => {
    if (!couponId || !userId) return;

    const existing = paymentId
        ? await CouponRedemption.findOne({ paymentId }).lean()
        : null;
    if (existing) return;

    await CouponRedemption.create({
        couponId,
        userId,
        paymentId: paymentId || null,
        code: normalizeCode(code),
        plan,
        billingCycle,
        originalAmount,
        discountAmount,
        finalAmount
    });

    await PromotionCoupon.findByIdAndUpdate(couponId, { $inc: { usageCount: 1 } });
};

const getCouponStats = async () => {
    const [total, active, expired, redemptions] = await Promise.all([
        PromotionCoupon.countDocuments(),
        PromotionCoupon.countDocuments({ isActive: true }),
        PromotionCoupon.countDocuments({
            validUntil: { $lt: new Date() }
        }),
        CouponRedemption.countDocuments()
    ]);

    const topCoupons = await PromotionCoupon.find()
        .sort({ usageCount: -1 })
        .limit(5)
        .select("code name usageCount usageLimit campaignTag isActive")
        .lean();

    const totalDiscount = await CouponRedemption.aggregate([
        { $group: { _id: null, sum: { $sum: "$discountAmount" } } }
    ]);

    return {
        total,
        active,
        expired,
        redemptions,
        totalDiscountGiven: totalDiscount[0]?.sum || 0,
        topCoupons
    };
};

module.exports = {
    normalizeCode,
    calculateDiscount,
    validateCouponForCheckout,
    recordCouponRedemption,
    getCouponStats
};
