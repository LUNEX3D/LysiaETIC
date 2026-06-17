const StoreTransfer = require("../models/StoreTransfer");

function normalizeLines(lines) {
    return (lines || [])
        .filter((l) => l.title || l.productId)
        .map((l) => ({
            productId: l.productId || undefined,
            title: String(l.title || "").trim(),
            variantBarcode: String(l.variantBarcode || "").trim(),
            fromBranchStock: Math.max(0, Number(l.fromBranchStock) || 0),
            quantity: Math.max(0, Number(l.quantity) || 0),
            scannedCode: String(l.scannedCode || "").trim(),
        }));
}

async function nextTransferNumber(storeId) {
    const count = await StoreTransfer.countDocuments({ storeId });
    return `TR-${String(count + 1).padStart(5, "0")}`;
}

async function listStoreTransfers(storeId) {
    const transfers = await StoreTransfer.find({ storeId }).sort({ createdAt: -1 }).lean();
    return transfers.map((t) => ({
        ...t,
        itemCount: Array.isArray(t.lines) ? t.lines.length : 0,
    }));
}

async function getStoreTransfer(storeId, id) {
    const transfer = await StoreTransfer.findOne({ _id: id, storeId }).lean();
    if (!transfer) return { error: "Transfer bulunamadı" };
    return { transfer };
}

async function createStoreTransfer(storeId, body) {
    const waybillNumber = String(body.waybillNumber || "").trim();
    const fromBranch = String(body.fromBranch || "").trim();
    const toBranch = String(body.toBranch || "").trim();
    if (!waybillNumber) return { error: "İrsaliye no gerekli" };
    if (!fromBranch) return { error: "Çıkış şubesi gerekli" };
    if (!toBranch) return { error: "Giriş şubesi gerekli" };
    if (fromBranch === toBranch) return { error: "Çıkış ve giriş şubesi farklı olmalı" };

    const lines = normalizeLines(body.lines);
    const approve = body.approve === true;
    const transferNumber = await nextTransferNumber(storeId);

    const transfer = await StoreTransfer.create({
        storeId,
        transferNumber,
        waybillNumber,
        fromBranch,
        toBranch,
        status: approve ? "confirmed" : "draft",
        lines,
        importFilters: body.importFilters || {},
        timeline: Array.isArray(body.timeline) ? body.timeline : [],
        notes: String(body.notes || "").trim(),
    });

    return { transfer };
}

async function updateStoreTransfer(storeId, id, body) {
    const transfer = await StoreTransfer.findOne({ _id: id, storeId });
    if (!transfer) return { error: "Transfer bulunamadı" };

    if (body.waybillNumber != null) {
        const w = String(body.waybillNumber).trim();
        if (!w) return { error: "İrsaliye no gerekli" };
        transfer.waybillNumber = w;
    }
    if (body.fromBranch != null) {
        const f = String(body.fromBranch).trim();
        if (!f) return { error: "Çıkış şubesi gerekli" };
        transfer.fromBranch = f;
    }
    if (body.toBranch != null) {
        const t = String(body.toBranch).trim();
        if (!t) return { error: "Giriş şubesi gerekli" };
        transfer.toBranch = t;
    }
    if (transfer.fromBranch === transfer.toBranch) {
        return { error: "Çıkış ve giriş şubesi farklı olmalı" };
    }
    if (body.lines != null) transfer.lines = normalizeLines(body.lines);
    if (body.timeline != null) transfer.timeline = body.timeline;
    if (body.importFilters != null) transfer.importFilters = body.importFilters;
    if (body.notes != null) transfer.notes = String(body.notes).trim();

    if (body.approve === true && transfer.status === "draft") {
        transfer.status = "confirmed";
    }

    await transfer.save();
    return { transfer };
}

module.exports = {
    listStoreTransfers,
    getStoreTransfer,
    createStoreTransfer,
    updateStoreTransfer,
};
