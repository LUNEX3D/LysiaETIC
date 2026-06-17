const StorePurchase = require("../models/StorePurchase");

function lineTotal(line) {
    return Number(line.quantity || 0) * Number(line.unitCost || 0);
}

function computeTotals(lines, { vatRate = 0, shippingCost = 0, adjustments = [] } = {}) {
    const subtotal = (lines || []).reduce((s, l) => s + lineTotal(l), 0);
    const vatAmount = subtotal * (Number(vatRate) / 100);
    const adjSum = (adjustments || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const totalCost = subtotal + vatAmount + Number(shippingCost || 0) + adjSum;
    return { subtotal, vatAmount, totalCost };
}

async function nextPurchaseNumber(storeId) {
    const count = await StorePurchase.countDocuments({ storeId });
    return `SA-${String(count + 1).padStart(5, "0")}`;
}

function normalizeLines(lines) {
    return (lines || [])
        .filter((l) => l.title || l.productId)
        .map((l) => ({
            productId: l.productId || undefined,
            title: String(l.title || "").trim(),
            quantity: Math.max(0, Number(l.quantity) || 0),
            unitCost: Math.max(0, Number(l.unitCost) || 0),
        }));
}

async function listStorePurchases(storeId) {
    const purchases = await StorePurchase.find({ storeId })
        .sort({ createdAt: -1 })
        .lean();
    return purchases.map((p) => ({
        ...p,
        itemCount: Array.isArray(p.lines) ? p.lines.length : 0,
    }));
}

async function getStorePurchase(storeId, id) {
    const purchase = await StorePurchase.findOne({ _id: id, storeId }).lean();
    if (!purchase) return { error: "Satın alma bulunamadı" };
    return { purchase };
}

async function createStorePurchase(storeId, body) {
    const supplierName = String(body.supplierName || "").trim();
    const branchName = String(body.branchName || "").trim();
    const referenceNumber = String(body.referenceNumber || "").trim();
    if (!supplierName) return { error: "Tedarikçi gerekli" };
    if (!branchName) return { error: "Sevk şubesi gerekli" };
    if (!referenceNumber) return { error: "Referans numarası gerekli" };

    const lines = normalizeLines(body.lines);
    const vatRate = Number(body.vatRate) || 0;
    const shippingCost = Number(body.shippingCost) || 0;
    const adjustments = Array.isArray(body.adjustments) ? body.adjustments : [];
    const totals = computeTotals(lines, { vatRate, shippingCost, adjustments });

    const approve = body.approve === true;
    const purchaseNumber = await nextPurchaseNumber(storeId);

    const purchase = await StorePurchase.create({
        storeId,
        purchaseNumber,
        supplierName,
        branchName,
        referenceNumber,
        currency: body.currency || "TRY",
        status: approve ? "ordered" : "draft",
        lines,
        subtotal: totals.subtotal,
        vatRate,
        vatAmount: totals.vatAmount,
        shippingCost,
        adjustments,
        totalCost: totals.totalCost,
        expectedShipmentAt: body.expectedShipmentAt || null,
        trackingNumber: String(body.trackingNumber || "").trim(),
        shippingCompany: String(body.shippingCompany || "").trim(),
        notes: String(body.notes || "").trim(),
        timeline: Array.isArray(body.timeline) ? body.timeline : [],
    });

    return { purchase };
}

async function updateStorePurchase(storeId, id, body) {
    const purchase = await StorePurchase.findOne({ _id: id, storeId });
    if (!purchase) return { error: "Satın alma bulunamadı" };

    if (body.supplierName != null) {
        const s = String(body.supplierName).trim();
        if (!s) return { error: "Tedarikçi gerekli" };
        purchase.supplierName = s;
    }
    if (body.branchName != null) {
        const b = String(body.branchName).trim();
        if (!b) return { error: "Sevk şubesi gerekli" };
        purchase.branchName = b;
    }
    if (body.referenceNumber != null) {
        const r = String(body.referenceNumber).trim();
        if (!r) return { error: "Referans numarası gerekli" };
        purchase.referenceNumber = r;
    }
    if (body.currency != null) purchase.currency = body.currency;
    if (body.expectedShipmentAt !== undefined) {
        purchase.expectedShipmentAt = body.expectedShipmentAt || null;
    }
    if (body.trackingNumber != null) purchase.trackingNumber = String(body.trackingNumber).trim();
    if (body.shippingCompany != null) purchase.shippingCompany = String(body.shippingCompany).trim();
    if (body.notes != null) purchase.notes = String(body.notes).trim();
    if (body.timeline != null) purchase.timeline = body.timeline;

    if (body.lines != null) purchase.lines = normalizeLines(body.lines);
    if (body.vatRate != null) purchase.vatRate = Number(body.vatRate) || 0;
    if (body.shippingCost != null) purchase.shippingCost = Number(body.shippingCost) || 0;
    if (body.adjustments != null) purchase.adjustments = body.adjustments;

    const totals = computeTotals(purchase.lines, {
        vatRate: purchase.vatRate,
        shippingCost: purchase.shippingCost,
        adjustments: purchase.adjustments,
    });
    purchase.subtotal = totals.subtotal;
    purchase.vatAmount = totals.vatAmount;
    purchase.totalCost = totals.totalCost;

    if (body.approve === true && purchase.status === "draft") {
        purchase.status = "ordered";
    }

    await purchase.save();
    return { purchase };
}

module.exports = {
    listStorePurchases,
    getStorePurchase,
    createStorePurchase,
    updateStorePurchase,
    computeTotals,
};
