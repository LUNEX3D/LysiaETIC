/**
 * Kupon API — kullanıcı ödeme akışı
 */
const {
    validateCouponForCheckout,
    normalizeCode
} = require("../services/couponService");

exports.validate = async (req, res) => {
    try {
        const { code, plan, billingCycle, baseAmount } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!plan || !billingCycle) {
            return res.status(400).json({ success: false, message: "Paket ve ödeme periyodu gerekli" });
        }

        const result = await validateCouponForCheckout({
            code,
            userId,
            plan,
            billingCycle,
            baseAmount: Number(baseAmount) || 0
        });

        if (!result.valid) {
            return res.status(400).json({ success: false, message: result.message });
        }

        return res.json({
            success: true,
            message: result.message,
            coupon: result.coupon,
            originalAmount: result.originalAmount,
            discountAmount: result.discountAmount,
            finalAmount: result.finalAmount
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Kupon doğrulanamadı" });
    }
};

exports.normalizeCodePreview = async (req, res) => {
    const code = normalizeCode(req.query.code);
    return res.json({ success: true, code });
};
