const crypto = require("crypto");
const Store = require("../models/Store");
const StoreOrder = require("../models/StoreOrder");
const StorePaymentSettings = require("../models/StorePaymentSettings");
const storeCartService = require("./storeCartService");
const storeProductService = require("./storeProductService");
const storePaytr = require("./storePaytrService");
const { APP_URL } = require("../config/domain");
const { parseAttributionFromCheckout } = require("./marketing/marketingAttributionService");
const affiliateService = require("./marketing/marketingAffiliateService");

async function nextOrderNumber(storeId) {
    const count = await StoreOrder.countDocuments({ storeId });
    const y = new Date().getFullYear();
    return `WEB-${y}-${String(count + 1).padStart(5, "0")}`;
}

function calcShipping(store, subtotal) {
    const s = store.settings || {};
    const flat = Number(s.flatShippingCost) || 0;
    const freeOver = Number(s.freeShippingOver) || 0;
    if (freeOver > 0 && subtotal >= freeOver) return 0;
    return flat;
}

async function createCheckout(store, sessionId, customer, shippingAddress, userIp, marketingBody = {}) {
    const cart = await storeCartService.getCartWithProducts(store._id, sessionId);
    if (!cart.items?.length) return { error: "Sepet boş" };
    const minOrder = Number(store.settings?.minOrderAmount) || 0;
    if (minOrder > 0 && cart.subtotal < minOrder) {
        return { error: `Minimum sipariş tutarı ${minOrder} TL` };
    }

    const paySettings = await StorePaymentSettings.findOne({ storeId: store._id }).lean();
    if (!paySettings?.paytr?.enabled || !storePaytr.hasValidCreds(paySettings)) {
        return { error: "Mağaza ödemesi yapılandırılmamış" };
    }

    const shippingCost = calcShipping(store, cart.subtotal);
    const total = Math.round((cart.subtotal + shippingCost) * 100) / 100;
    const orderNumber = await nextOrderNumber(store._id);
    const guestToken = crypto.randomBytes(24).toString("hex");
    const paytrOid = `STR${String(store._id).slice(-8)}${Date.now().toString(36)}`.slice(0, 64);

    const lineItems = [];
    for (const item of cart.items) {
        const sp = await require("../models/StoreProduct").findById(item.storeProductId).lean();
        lineItems.push({
            storeProductId: item.storeProductId,
            productMappingId: sp?.productMappingId,
            title: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            barcode: sp?.barcode || "",
        });
    }

    const marketingSource = parseAttributionFromCheckout(marketingBody);
    const refCode = marketingBody?.ref || marketingBody?.refCode;
    let affiliateId = marketingSource?.affiliateId;

    if (!affiliateId && refCode) {
        const aff = await affiliateService.findByCode(store._id, refCode);
        if (aff) affiliateId = aff._id;
    }

    const orderPayload = {
        storeId: store._id,
        userId: store.userId,
        orderNumber,
        status: "pending_payment",
        customer: {
            name: String(customer.name || "").trim(),
            email: String(customer.email || "").trim().toLowerCase(),
            phone: String(customer.phone || "").trim(),
        },
        shippingAddress: shippingAddress || {},
        lineItems,
        subtotal: cart.subtotal,
        shippingCost,
        total,
        payment: {
            provider: "paytr",
            status: "pending",
            paytrMerchantOid: paytrOid,
        },
        guestToken,
    };

    if (marketingSource) orderPayload.marketingSource = marketingSource;
    else if (affiliateId) {
        orderPayload.marketingSource = {
            channel: "AFFILIATE",
            affiliateId,
            refCode: String(refCode || "").toUpperCase(),
            attributedAt: new Date(),
        };
    }

    const order = await StoreOrder.create(orderPayload);

    const base = APP_URL || "http://localhost:3000";
    const tokenResult = await storePaytr.requestStoreIframeToken(paySettings, {
        userEmail: order.customer.email,
        userName: order.customer.name,
        userPhone: order.customer.phone,
        userAddress: [shippingAddress?.line, shippingAddress?.district, shippingAddress?.city].filter(Boolean).join(" "),
        userIp,
        amount: total,
        orderId: paytrOid,
        storeName: store.name,
        okUrl: `${base}/shop/${store.slug}/order/success?token=${guestToken}`,
        failUrl: `${base}/shop/${store.slug}/order/failed?token=${guestToken}`,
    });

    if (!tokenResult.success) {
        await StoreOrder.updateOne({ _id: order._id }, { status: "failed", "payment.status": "failed" });
        return { error: tokenResult.error || "Ödeme başlatılamadı" };
    }

    return {
        orderId: order._id,
        orderNumber,
        guestToken,
        total,
        iframeUrl: tokenResult.iframeUrl,
        iframeToken: tokenResult.iframeToken,
    };
}

async function handlePaytrCallback(callbackData) {
    const oid = callbackData.merchant_oid;
    const order = await StoreOrder.findOne({ "payment.paytrMerchantOid": oid });
    if (!order) {
        return { ok: false, reason: "order_not_found" };
    }
    const paySettings = await StorePaymentSettings.findOne({ storeId: order.storeId }).lean();
    const creds = storePaytr.resolveCreds(paySettings);
    if (!storePaytr.verifyCallback(creds, callbackData)) {
        return { ok: false, reason: "hash_invalid" };
    }

    if (callbackData.status === "success") {
        if (order.payment.status === "paid") return { ok: true, duplicate: true };
        order.payment.status = "paid";
        order.payment.paidAt = new Date();
        order.status = "processing";
        await order.save();

        for (const line of order.lineItems) {
            await storeProductService.decrementStock(line.storeProductId, line.quantity);
        }
        await Store.updateOne(
            { _id: order.storeId },
            { $inc: { "stats.totalOrders": 1, "stats.totalRevenue": order.total } }
        );
        await storeCartService.clearCart(order.storeId, "paid-" + order._id);

        if (order.marketingSource?.affiliateId) {
            await affiliateService.attributeOrderSale(
                order.storeId,
                order._id,
                order.marketingSource.affiliateId,
                order.total
            );
        }

        try {
            const automationService = require("./marketing/marketingAutomationService");
            await automationService.runAutomationForEvent(order.storeId, "order_placed", {
                customerEmail: order.customer?.email,
                customerPhone: order.customer?.phone,
                customerName: order.customer?.name,
                orderId: order._id,
            });
        } catch {
            /* ignore */
        }

        return { ok: true, paid: true };
    }

    order.payment.status = "failed";
    order.status = "failed";
    await order.save();
    return { ok: true, paid: false };
}

async function getOrderByGuestToken(storeId, token) {
    return StoreOrder.findOne({ storeId, guestToken: token }).lean();
}

module.exports = {
    createCheckout,
    handlePaytrCallback,
    getOrderByGuestToken,
    calcShipping,
};
