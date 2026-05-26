/**
 * Ödeme tamamlandığında kullanıcı aboneliğini aktifleştirir.
 * PayTR: callback / durum sorgu / verify — admin onayı gerekmez (paytrVerified).
 * Havale vb.: admin manuel onay (completed + adminId).
 */

const mongoose = require("mongoose");
const User = require("../models/User");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const logger = require("../config/logger");
const { recordCouponRedemption } = require("./couponService");
const { notifyPaymentSuccessEmail } = require("./paymentNotificationService");

/**
 * @param {import("../models/Payment")} payment — completed veya onaylanacak ödeme
 * @param {{ totalAmountTl?: number, source?: string }} opts
 */
async function activateSubscriptionFromPayment(payment, opts = {}) {
    const totalAmountTl = opts.totalAmountTl ?? Number(payment.amount) ?? 0;
    const source = opts.source || "payment";

    const session = await mongoose.startSession();
    try {
        let result = null;
        await session.withTransaction(async () => {
            const freshPayment = await Payment.findById(payment._id).session(session);
            if (!freshPayment) {
                throw new Error("Ödeme kaydı bulunamadı");
            }
            if (
                ["pending", "processing", "failed"].includes(freshPayment.status)
                && !opts.paytrVerified
                && !opts.adminId
            ) {
                throw new Error("Ödeme henüz onaylanmadı");
            }

            if (freshPayment.status === "completed" && freshPayment.subscriptionId) {
                const userCheck = await User.findById(freshPayment.userId).session(session).select("subscription").lean();
                const sub = userCheck?.subscription || {};
                if (sub.status === "active" && sub.plan && sub.plan !== "trial") {
                    result = { alreadyActive: true, userId: freshPayment.userId };
                    return;
                }
            }

            freshPayment.status = "completed";
            freshPayment.paidAt = freshPayment.paidAt || new Date();
            if (opts.adminId) {
                freshPayment.metadata = {
                    ...(freshPayment.metadata || {}),
                    adminApprovedBy: String(opts.adminId),
                    adminApprovedAt: new Date().toISOString(),
                };
            }
            await freshPayment.save({ session });

            const user = await User.findById(freshPayment.userId).session(session);
            if (!user) {
                throw new Error("Kullanıcı bulunamadı");
            }

            const plan = freshPayment.expectedPlan || freshPayment.metadata?.plan;
            const billingCycle = freshPayment.expectedBillingCycle || freshPayment.metadata?.billingCycle || "monthly";
            if (!plan || plan === "trial") {
                throw new Error("Geçersiz paket bilgisi (expectedPlan eksik)");
            }

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

            let planLimits = {};
            try {
                const SystemConfig = require("../models/SystemConfig");
                const doc = await SystemConfig.findOne({ key: "planDefinitions" }).lean();
                planLimits = doc?.value?.[plan]?.limits || {};
            } catch {
                /* fallback limits */
            }

            user.subscription = {
                ...existingSub,
                plan,
                status: "active",
                startDate: isCurrentlyActive ? existingSub.startDate : now,
                endDate,
                trialUsed: true,
                lastPaymentId: freshPayment._id.toString(),
                autoRenew: true,
                limits: planLimits,
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
                    price: totalAmountTl,
                    billingCycle,
                    lastPaymentDate: now,
                    nextPaymentDate: endDate,
                    paymentMethod: freshPayment.paymentMethod || "paytr",
                    limits: planLimits,
                },
                { upsert: true, new: true, session }
            );

            freshPayment.subscriptionId = subDoc._id;
            await freshPayment.save({ session });

            if (freshPayment.metadata?.coupon?.couponId) {
                await recordCouponRedemption({
                    couponId: freshPayment.metadata.coupon.couponId,
                    userId: user._id,
                    paymentId: freshPayment._id,
                    code: freshPayment.metadata.coupon.code,
                    plan,
                    billingCycle,
                    originalAmount: freshPayment.metadata.coupon.originalAmount,
                    discountAmount: freshPayment.metadata.coupon.discountAmount,
                    finalAmount: freshPayment.amount,
                });
            }

            logger.info(`Abonelik aktifleştirildi (${source}): ${user.email} → ${plan} (${billingCycle})`);
            result = {
                userId: user._id,
                email: user.email,
                plan,
                billingCycle,
                endDate,
                subscription: user.subscription,
                paymentId: freshPayment._id,
                sendSuccessEmail: !opts.skipSuccessEmail,
            };
        });

        if (result && !result.alreadyActive && result.sendSuccessEmail !== false && result.paymentId) {
            const pid = result.paymentId;
            setImmediate(() => {
                notifyPaymentSuccessEmail(pid).catch((e) => {
                    logger.error(`Ödeme e-postası arka plan: ${e.message}`, { paymentId: pid });
                });
            });
        }

        return result;
    } finally {
        session.endSession();
    }
}

/** Tam iade sonrası aboneliği sonlandır (admin PayTR iade) */
async function deactivateSubscriptionAfterRefund(userId, opts = {}) {
    const uid = userId?._id || userId;
    if (!uid) return { updated: false };

    const user = await User.findById(uid);
    if (!user) return { updated: false };

    const now = new Date();
    const existing = user.subscription ? user.subscription.toObject() : {};

    user.subscription = {
        ...existing,
        status: "expired",
        endDate: now,
        autoRenew: false,
    };
    await user.save();

    await Subscription.findOneAndUpdate(
        { userId: user._id },
        {
            status: "expired",
            endDate: now,
            autoRenew: false,
        }
    );

    logger.info(`Abonelik iade sonrası sonlandırıldı: ${user.email} — ${opts.source || "refund"}`);
    return { updated: true, userId: user._id, email: user.email };
}

module.exports = { activateSubscriptionFromPayment, deactivateSubscriptionAfterRefund };
