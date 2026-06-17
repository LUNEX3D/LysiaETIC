/**
 * İade onayı sonrası e-Arşiv fatura otomatik iptali + bildirim
 */
const logger = require("../config/logger");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const sovosEArchiveService = require("./sovosEArchiveService");
const sovosService = require("./sovosEInvoiceService");
const qnbService = require("./qnbEInvoiceService");
const { sendReturnInvoiceCancelledEmail } = require("./emailService");

const clean = (s) => String(s || "").trim();

const findOrderForReturn = async (userId, { orderNumber, claimId, marketplace }) => {
    const mp = clean(marketplace);
    const on = clean(orderNumber);
    if (!on) return null;

    const queries = [
        { user: userId, trackingNumber: on },
        { user: userId, orderNumber: on },
        { user: userId, trackingNumber: String(claimId || "") },
    ].filter((q) => q.trackingNumber || q.orderNumber);

    for (const q of queries) {
        const order = await Order.findOne(q).lean();
        if (order) return order;
    }

    if (mp) {
        return Order.findOne({
            user: userId,
            marketplaceName: new RegExp(mp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
            $or: [{ trackingNumber: on }, { orderNumber: on }],
        }).lean();
    }
    return null;
};

const resolveInvoiceCancelAmount = (invoice) => {
    const totals = invoice.totals || {};
    const lineExt = Number(totals.lineExtensionAmount || 0);
    if (lineExt > 0) return lineExt;
    const lines = invoice.lines || [];
    if (lines.length) {
        return Number(lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unitPrice || l.price || 0), 0).toFixed(2));
    }
    return Number(totals.payableAmount || totals.taxInclusiveAmount || 0);
};

const cancelEArchiveForOrder = async (userId, order, invoice) => {
    const config = await AutoInvoiceConfig.findOne({ userId }).lean();
    const provider = invoice.provider || config?.provider || "qnb";
    const totalAmount = resolveInvoiceCancelAmount(invoice);

    if (!(totalAmount > 0)) {
        return { success: false, error: "İptal tutarı bulunamadı" };
    }

    if (provider === "sovos") {
        const creds = config?.sovosCredentials || {};
        const session = await sovosService.restoreSession({
            username: creds.username,
            password: creds.password,
            vknTckn: creds.vknTckn || invoice.supplier?.vkn,
            env: creds.env || config?.env || "test",
            branch: creds.branch || "default",
        });
        if (!session.success) {
            return { success: false, error: "Sovos oturumu açılamadı: " + session.error };
        }
        try {
            const result = await sovosEArchiveService.cancelInvoice({
                sessionId: session.sessionId,
                vkn: invoice.supplier?.vkn || creds.vknTckn,
                invoiceNumber: invoice.invoiceNumber,
                uuid: invoice.uuid,
                totalAmount,
                cancelDate: invoice.issueDate || new Date(),
                branch: creds.branch || "default",
                custInvID: invoice.custInvId || invoice.orderNumber || order.trackingNumber || "",
                orderNumber: invoice.orderNumber || order.trackingNumber || "",
            });
            if (!result.success) {
                return result;
            }
            await Invoice.updateOne(
                { _id: invoice._id },
                {
                    status: "cancelled",
                    "providerResponse.sovosCancelled": true,
                    "providerResponse.resultText": result.data?.message || "İade sonrası otomatik iptal",
                }
            );
            return { success: true, provider: "sovos", data: result.data };
        } finally {
            await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
        }
    }

    if (provider === "qnb") {
        const qnb = config?.qnbCredentials || {};
        const earsivUser = qnb.earsivUsername || qnb.username;
        const earsivPass = qnb.earsivPassword || qnb.password;
        if (!earsivUser || !earsivPass) {
            return { success: false, error: "QNB e-Arşiv kimlik bilgisi eksik" };
        }
        const login = await qnbService.login({
            username: earsivUser,
            password: earsivPass,
            env: config?.env || "test",
            service: "earsiv",
        });
        if (!login.success) {
            return { success: false, error: "e-Arşiv oturumu açılamadı" };
        }
        try {
            const cancel = await qnbService.cancelEArchiveInvoice({
                sessionId: login.sessionId,
                vkn: invoice.supplier?.vkn,
                uuid: invoice.uuid,
                faturaNo: invoice.invoiceNumber,
                env: config?.env || "test",
            });
            if (!cancel.success) {
                return cancel;
            }
            await Invoice.updateOne(
                { _id: invoice._id },
                { status: "cancelled", "providerResponse.sovosCancelled": true }
            );
            return { success: true, provider: "qnb" };
        } finally {
            await qnbService.logout({ sessionId: login.sessionId, env: config?.env, service: "earsiv" }).catch(() => {});
        }
    }

    return { success: false, error: "Bu sağlayıcı için otomatik iptal desteklenmiyor" };
};

/**
 * İade onayı sonrası — ilgili siparişin e-Arşiv faturasını iptal et
 */
const cancelInvoiceAfterReturnApproval = async ({
    userId,
    marketplace,
    orderNumber,
    claimId,
}) => {
    const stats = { cancelled: false, skipped: false, message: "" };

    try {
        const order = await findOrderForReturn(userId, { orderNumber, claimId, marketplace });
        if (!order) {
            stats.skipped = true;
            stats.message = "Sipariş bulunamadı — fatura iptali atlandı";
            return stats;
        }

        let invoice = null;
        if (order.invoiceId) {
            invoice = await Invoice.findOne({ _id: order.invoiceId, userId }).lean();
        }
        if (!invoice) {
            invoice = await Invoice.findOne({
                userId,
                $or: [
                    { orderId: order._id },
                    { orderNumber: order.trackingNumber },
                    { custInvId: order.trackingNumber },
                ],
                status: { $ne: "cancelled" },
            }).sort({ createdAt: -1 }).lean();
        }

        if (!invoice) {
            stats.skipped = true;
            stats.message = "Bu sipariş için aktif fatura yok";
            return stats;
        }

        if (invoice.status === "cancelled") {
            stats.skipped = true;
            stats.message = "Fatura zaten iptal edilmiş";
            return stats;
        }

        const profile = String(invoice.profileId || "").toUpperCase();
        if (!profile.includes("EARSIV")) {
            stats.skipped = true;
            stats.message = "Yalnızca e-Arşiv faturalar iade sonrası otomatik iptal edilir";
            return stats;
        }

        const cancelResult = await cancelEArchiveForOrder(userId, order, invoice);
        if (!cancelResult.success) {
            stats.message = cancelResult.error || "İptal başarısız";
            logger.warn("[ReturnInvoiceCancel] İptal başarısız order=" + order.trackingNumber + " — " + stats.message);
            return stats;
        }

        await Order.updateOne(
            { _id: order._id },
            { isReturned: true, invoiceStatus: "cancelled" }
        );

        stats.cancelled = true;
        stats.message = "Fatura iade onayı sonrası iptal edildi";
        stats.invoiceNumber = invoice.invoiceNumber;

        const user = await User.findById(userId).select("email name companyInfo").lean();
        if (user?.email) {
            await sendReturnInvoiceCancelledEmail(user, {
                order,
                invoice,
                marketplace: marketplace || order.marketplaceName,
            }).catch((err) => {
                logger.warn("[ReturnInvoiceCancel] E-posta gönderilemedi: " + err.message);
            });
        }

        logger.info(
            "[ReturnInvoiceCancel] ✅ İade → fatura iptal — order=" + (order.trackingNumber || orderNumber) +
            " fatura=" + invoice.invoiceNumber
        );
        return stats;
    } catch (error) {
        logger.error("[ReturnInvoiceCancel] Hata: " + error.message);
        stats.message = error.message;
        return stats;
    }
};

module.exports = {
    cancelInvoiceAfterReturnApproval,
    findOrderForReturn,
};
