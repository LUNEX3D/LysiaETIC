/**
 * Admin — Kupon & kampanya yönetimi
 */
const PromotionCoupon = require("../../models/PromotionCoupon");
const CouponRedemption = require("../../models/CouponRedemption");
const User = require("../../models/User");
const {
    normalizeCode,
    getCouponStats
} = require("../../services/couponService");

const PLAN_OPTIONS = ["basic", "pro", "enterprise"];

exports.getStats = async (req, res) => {
    try {
        const stats = await getCouponStats();
        const campaigns = await PromotionCoupon.distinct("campaignTag", {
            campaignTag: { $ne: "" }
        });
        return res.json({ success: true, stats, campaigns: campaigns.filter(Boolean) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.listCoupons = async (req, res) => {
    try {
        const { q, campaign, active, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (campaign) filter.campaignTag = campaign;
        if (active === "true") filter.isActive = true;
        if (active === "false") filter.isActive = false;

        if (q && String(q).trim()) {
            const regex = new RegExp(String(q).trim(), "i");
            filter.$or = [{ code: regex }, { name: regex }, { description: regex }, { campaignTag: regex }];
        }

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const [coupons, total] = await Promise.all([
            PromotionCoupon.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            PromotionCoupon.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            coupons,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)) || 1
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCoupon = async (req, res) => {
    try {
        const coupon = await PromotionCoupon.findById(req.params.id).lean();
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Kupon bulunamadı" });
        }
        return res.json({ success: true, coupon });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const body = req.body || {};
        const code = normalizeCode(body.code);
        if (!code || code.length < 3) {
            return res.status(400).json({ success: false, message: "Kupon kodu en az 3 karakter olmalı" });
        }

        const exists = await PromotionCoupon.findOne({ code });
        if (exists) {
            return res.status(400).json({ success: false, message: "Bu kupon kodu zaten var" });
        }

        if (!["percent", "fixed"].includes(body.type)) {
            return res.status(400).json({ success: false, message: "İndirim tipi percent veya fixed olmalı" });
        }

        const value = Number(body.value);
        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({ success: false, message: "Geçerli indirim değeri girin" });
        }
        if (body.type === "percent" && value > 100) {
            return res.status(400).json({ success: false, message: "Yüzde indirim en fazla 100 olabilir" });
        }

        const applicablePlans = Array.isArray(body.applicablePlans)
            ? body.applicablePlans.filter((p) => PLAN_OPTIONS.includes(p))
            : [];

        const applicableBillingCycles = Array.isArray(body.applicableBillingCycles)
            ? body.applicableBillingCycles.filter((c) => ["monthly", "yearly"].includes(c))
            : [];

        const coupon = await PromotionCoupon.create({
            code,
            name: String(body.name || code).trim(),
            description: String(body.description || "").trim(),
            campaignTag: String(body.campaignTag || "").trim(),
            type: body.type,
            value,
            maxDiscountAmount: body.maxDiscountAmount != null && body.maxDiscountAmount !== ""
                ? Number(body.maxDiscountAmount)
                : null,
            minPurchaseAmount: Number(body.minPurchaseAmount) || 0,
            applicablePlans,
            applicableBillingCycles,
            usageLimit: body.usageLimit != null && body.usageLimit !== ""
                ? Number(body.usageLimit)
                : null,
            perUserLimit: Math.max(1, Number(body.perUserLimit) || 1),
            validFrom: body.validFrom ? new Date(body.validFrom) : null,
            validUntil: body.validUntil ? new Date(body.validUntil) : null,
            isActive: body.isActive !== false,
            createdBy: req.user?._id || req.user?.id
        });

        return res.status(201).json({ success: true, message: "Kupon oluşturuldu", coupon });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Kupon kodu zaten kayıtlı" });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const coupon = await PromotionCoupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Kupon bulunamadı" });
        }

        const body = req.body || {};
        if (body.code) {
            const code = normalizeCode(body.code);
            if (code !== coupon.code) {
                const exists = await PromotionCoupon.findOne({ code, _id: { $ne: coupon._id } });
                if (exists) {
                    return res.status(400).json({ success: false, message: "Bu kupon kodu kullanılıyor" });
                }
                coupon.code = code;
            }
        }

        if (body.name != null) coupon.name = String(body.name).trim();
        if (body.description != null) coupon.description = String(body.description).trim();
        if (body.campaignTag != null) coupon.campaignTag = String(body.campaignTag).trim();
        if (body.type != null) coupon.type = body.type;
        if (body.value != null) coupon.value = Number(body.value);
        if (body.maxDiscountAmount !== undefined) {
            coupon.maxDiscountAmount = body.maxDiscountAmount === "" || body.maxDiscountAmount == null
                ? null
                : Number(body.maxDiscountAmount);
        }
        if (body.minPurchaseAmount != null) coupon.minPurchaseAmount = Number(body.minPurchaseAmount) || 0;
        if (body.applicablePlans != null) {
            coupon.applicablePlans = Array.isArray(body.applicablePlans)
                ? body.applicablePlans.filter((p) => PLAN_OPTIONS.includes(p))
                : [];
        }
        if (body.applicableBillingCycles != null) {
            coupon.applicableBillingCycles = Array.isArray(body.applicableBillingCycles)
                ? body.applicableBillingCycles.filter((c) => ["monthly", "yearly"].includes(c))
                : [];
        }
        if (body.usageLimit !== undefined) {
            coupon.usageLimit = body.usageLimit === "" || body.usageLimit == null
                ? null
                : Number(body.usageLimit);
        }
        if (body.perUserLimit != null) coupon.perUserLimit = Math.max(1, Number(body.perUserLimit) || 1);
        if (body.validFrom !== undefined) coupon.validFrom = body.validFrom ? new Date(body.validFrom) : null;
        if (body.validUntil !== undefined) coupon.validUntil = body.validUntil ? new Date(body.validUntil) : null;
        if (body.isActive != null) coupon.isActive = !!body.isActive;

        await coupon.save();
        return res.json({ success: true, message: "Kupon güncellendi", coupon });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await PromotionCoupon.findByIdAndDelete(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Kupon bulunamadı" });
        }
        return res.json({ success: true, message: "Kupon silindi" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleCoupon = async (req, res) => {
    try {
        const coupon = await PromotionCoupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Kupon bulunamadı" });
        }
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        return res.json({
            success: true,
            message: coupon.isActive ? "Kupon aktifleştirildi" : "Kupon pasifleştirildi",
            isActive: coupon.isActive
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.listRedemptions = async (req, res) => {
    try {
        const { couponId, page = 1, limit = 40 } = req.query;
        const filter = {};
        if (couponId) filter.couponId = couponId;

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const [rows, total] = await Promise.all([
            CouponRedemption.find(filter)
                .sort({ redeemedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            CouponRedemption.countDocuments(filter)
        ]);

        const userIds = [...new Set(rows.map((r) => String(r.userId)))];
        const users = await User.find({ _id: { $in: userIds } })
            .select("name email")
            .lean();
        const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

        const enriched = rows.map((r) => ({
            ...r,
            user: userMap[String(r.userId)] || null
        }));

        return res.json({
            success: true,
            redemptions: enriched,
            pagination: { page: Number(page), limit: Number(limit), total }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
