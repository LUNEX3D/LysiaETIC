const StoreOrder = require("../models/StoreOrder");
const StoreOrderLabel = require("../models/StoreOrderLabel");

function nextOrderNumber(storeId) {
    const tail = String(storeId).slice(-4);
    return `${Date.now().toString().slice(-6)}${tail}`;
}

async function listOrders(storeId, { draft, q, limit = 200 } = {}) {
    const filter = { storeId };
    if (draft === true) filter.isDraft = true;
    else if (draft === false) filter.isDraft = { $ne: true };
    let query = StoreOrder.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const rows = await query;
    if (!q) return rows;
    const needle = String(q).trim().toLowerCase();
    return rows.filter((o) => {
        if (String(o.orderNumber || "").toLowerCase().includes(needle)) return true;
        if (o.customer?.name?.toLowerCase().includes(needle)) return true;
        if (o.customer?.email?.toLowerCase().includes(needle)) return true;
        return false;
    });
}

async function getOrder(storeId, orderId) {
    return StoreOrder.findOne({ _id: orderId, storeId }).lean();
}

async function patchOrder(storeId, orderId, body) {
    const order = await StoreOrder.findOne({ _id: orderId, storeId });
    if (!order) return { error: "Sipariş yok" };
    if (body.status) order.status = body.status;
    if (body.trackingNumber !== undefined) order.trackingNumber = body.trackingNumber;
    if (body.shippingCarrier !== undefined) order.shippingCarrier = body.shippingCarrier;
    if (body.labelIds !== undefined) order.labelIds = body.labelIds;
    if (body.isDraft !== undefined) order.isDraft = !!body.isDraft;
    if (body.comment?.trim()) {
        order.timeline = order.timeline || [];
        order.timeline.push({
            type: "comment",
            actor: body.actorName || "Personel",
            message: body.comment.trim(),
            createdAt: new Date(),
        });
    }
    await order.save();
    return { order: order.toObject() };
}

async function createManualOrder(storeId, userId, payload) {
    const orderNumber = payload.orderNumber || nextOrderNumber(storeId);
    const lineItems = (payload.lineItems || []).map((li) => ({
        storeProductId: li.storeProductId,
        title: li.title || "Ürün",
        quantity: Number(li.quantity) || 1,
        unitPrice: Number(li.unitPrice) || 0,
        barcode: li.barcode || "",
    }));
    const subtotal =
        payload.subtotal != null
            ? Number(payload.subtotal)
            : lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
    const shippingCost = Number(payload.shippingCost) || 0;
    const taxAmount = Number(payload.taxAmount) || 0;
    const total = payload.total != null ? Number(payload.total) : subtotal + shippingCost + taxAmount;
    const doc = await StoreOrder.create({
        storeId,
        userId,
        orderNumber: String(orderNumber),
        status: payload.isDraft ? "pending_payment" : payload.status || "processing",
        isDraft: !!payload.isDraft,
        customer: {
            name: payload.customer?.name || "Misafir",
            email: payload.customer?.email || "",
            phone: payload.customer?.phone || "",
        },
        shippingAddress: payload.shippingAddress || {},
        billingAddress: payload.billingAddress || payload.shippingAddress || {},
        lineItems,
        subtotal,
        shippingCost,
        taxAmount,
        total,
        currency: payload.currency || "TRY",
        source: "manual",
        salesChannel: payload.salesChannel || "Manuel Sipariş",
        payment: {
            status: payload.paymentStatus || "pending",
            provider: payload.paymentProvider || "manual",
        },
        timeline: [
            {
                type: "created",
                actor: payload.actorName || "Personel",
                message: payload.isDraft ? "Taslak sipariş oluşturuldu" : "Manuel sipariş oluşturuldu",
                createdAt: new Date(),
            },
        ],
    });
    return { order: doc.toObject() };
}

async function listOrderLabels(storeId) {
    return StoreOrderLabel.find({ storeId }).sort({ name: 1 }).lean();
}

async function createOrderLabel(storeId, userId, name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return { error: "Etiket adı gerekli" };
    try {
        const doc = await StoreOrderLabel.create({ storeId, userId, name: trimmed });
        return { label: doc.toObject() };
    } catch (e) {
        if (e.code === 11000) return { error: "Bu etiket zaten var" };
        throw e;
    }
}

async function deleteOrderLabel(storeId, labelId) {
    const doc = await StoreOrderLabel.findOneAndDelete({ _id: labelId, storeId });
    if (!doc) return { error: "Etiket yok" };
    await StoreOrder.updateMany({ storeId }, { $pull: { labelIds: doc._id } });
    return { ok: true };
}

async function bulkUpdateOrderLabels(storeId, orderIds, labelIds, mode = "add") {
    const ids = (orderIds || []).filter(Boolean);
    if (!ids.length) return { error: "Sipariş seçin" };
    const labelObjectIds = (labelIds || []).filter(Boolean);
    const orders = await StoreOrder.find({ storeId, _id: { $in: ids } });
    if (!orders.length) return { error: "Sipariş bulunamadı" };
    for (const order of orders) {
        if (mode === "clear") {
            order.labelIds = [];
        } else if (mode === "replace") {
            order.labelIds = labelObjectIds;
        } else {
            const merged = new Set([
                ...(order.labelIds || []).map((x) => String(x)),
                ...labelObjectIds.map((x) => String(x)),
            ]);
            order.labelIds = [...merged];
        }
        await order.save();
    }
    return { updated: orders.length };
}

module.exports = {
    listOrders,
    getOrder,
    patchOrder,
    createManualOrder,
    listOrderLabels,
    createOrderLabel,
    deleteOrderLabel,
    bulkUpdateOrderLabels,
};
