/**
 * Ödeme başarılı — kullanıcıya e-posta + PayTR dekont bilgileri
 */

const Payment = require("../models/Payment");
const User = require("../models/User");
const paytrService = require("./paytrService");
const { sendPaymentSuccessEmail } = require("./emailService");
const { DEFAULT_PLAN_DEFINITIONS } = require("../config/defaultPlanDefinitions");
const logger = require("../config/logger");

function planDisplayName(planKey) {
    return DEFAULT_PLAN_DEFINITIONS[planKey]?.name || String(planKey || "").toUpperCase();
}

/**
 * PayTR durum sorgusundan dekont alanları (müşteriye PDF API yok — e-postada özet)
 */
async function loadPaytrReceipt(merchantOid) {
    const query = await paytrService.queryOrderStatus(merchantOid);
    if (!query.apiOk || !query.paid) {
        return { fromPaytr: false };
    }
    return {
        fromPaytr: true,
        paymentDate: query.paymentDate,
        amount: query.paymentTotal || query.paymentAmount,
        amountTl: query.paymentTotalTl,
        currency: query.currency || "TL",
        installment: query.installment,
        cardBrand: query.cardBrand,
        isTest: query.raw?.test_mode === "1" || query.raw?.is_test === 1,
    };
}

/**
 * Ödeme tamamlandıktan sonra bir kez e-posta gönderir (idempotent)
 */
async function notifyPaymentSuccessEmail(paymentId) {
    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) return { sent: false, reason: "payment_not_found" };

        if (payment.metadata?.paymentSuccessEmailSent) {
            return { sent: false, reason: "already_sent" };
        }

        if (payment.status !== "completed") {
            return { sent: false, reason: "not_completed" };
        }

        const user = await User.findById(payment.userId).select("name email subscription");
        if (!user?.email) {
            return { sent: false, reason: "no_email" };
        }

        const plan = payment.expectedPlan || payment.metadata?.plan;
        const billingCycle = payment.expectedBillingCycle || payment.metadata?.billingCycle || "monthly";
        const sub = user.subscription?.toObject?.() || user.subscription || {};

        let receipt = payment.metadata?.paytrReceipt || {};
        if (payment.paymentMethod === "paytr" && payment.transactionId) {
            const paytrReceipt = await loadPaytrReceipt(payment.transactionId);
            if (paytrReceipt.fromPaytr) {
                receipt = paytrReceipt;
            }
        }

        const callbackRaw = payment.metadata?.paytrResponse || {};
        if (!receipt.cardBrand && callbackRaw.kart_marka) {
            receipt.cardBrand = callbackRaw.kart_marka;
        }
        if (!receipt.installment && callbackRaw.taksit != null) {
            receipt.installment = callbackRaw.taksit;
        }

        const mail = await sendPaymentSuccessEmail(user, {
            payment: {
                amount: payment.amount,
                currency: payment.currency || "TRY",
                transactionId: payment.transactionId,
                description: payment.description,
                paidAt: payment.paidAt || payment.updatedAt,
                invoiceNumber: payment.invoiceNumber,
            },
            subscription: {
                plan,
                planName: planDisplayName(plan),
                billingCycle,
                endDate: sub.endDate,
            },
            receipt,
        });

        if (mail.success) {
            await Payment.updateOne(
                { _id: payment._id },
                {
                    $set: {
                        "metadata.paymentSuccessEmailSent": new Date().toISOString(),
                        "metadata.paytrReceipt": receipt,
                        "metadata.paymentSuccessEmailId": mail.id || null,
                    },
                }
            );
            logger.info(`Ödeme onay e-postası gönderildi: ${user.email} — ${payment.transactionId || payment._id}`);
            return { sent: true, emailId: mail.id };
        }

        logger.warn(`Ödeme onay e-postası gönderilemedi: ${user.email} — ${mail.error}`);
        return { sent: false, reason: "resend_error", error: mail.error };
    } catch (err) {
        logger.error(`notifyPaymentSuccessEmail: ${err.message}`, { paymentId });
        return { sent: false, reason: "exception", error: err.message };
    }
}

module.exports = { notifyPaymentSuccessEmail, loadPaytrReceipt };
