const MarketingPopup = require("../../models/MarketingPopup");
const MarketingEvent = require("../../models/MarketingEvent");

async function listPopups(storeId) {
    return MarketingPopup.find({ storeId }).sort({ updatedAt: -1 }).lean();
}

async function getPopup(storeId, id) {
    return MarketingPopup.findOne({ _id: id, storeId }).lean();
}

async function createPopup(storeId, userId, body) {
    const doc = await MarketingPopup.create({
        storeId,
        userId,
        name: body.name,
        type: body.type || "modal",
        status: body.status || "draft",
        content: body.content || {},
        displayRules: body.displayRules || {},
    });
    return doc.toObject();
}

async function updatePopup(storeId, id, body) {
    const patch = {};
    for (const k of ["name", "type", "status", "content", "displayRules", "abVariant"]) {
        if (body[k] !== undefined) patch[k] = body[k];
    }
    return MarketingPopup.findOneAndUpdate({ _id: id, storeId }, { $set: patch }, { new: true }).lean();
}

async function deletePopup(storeId, id) {
    await MarketingPopup.deleteOne({ _id: id, storeId });
    return { ok: true };
}

async function listActiveForStorefront(storeId, path = "/") {
    const popups = await MarketingPopup.find({ storeId, status: "active" }).lean();
    return popups.filter((p) => {
        const includes = p.displayRules?.pathIncludes || [];
        if (!includes.length) return true;
        return includes.some((seg) => path.includes(seg));
    });
}

async function trackPopupView(storeId, popupId, email = "") {
    await MarketingPopup.updateOne({ _id: popupId, storeId }, { $inc: { "stats.views": 1 } });
    await MarketingEvent.create({
        storeId,
        type: "popup_view",
        channel: "POPUP",
        popupId,
        customerEmail: email,
    });
}

async function trackPopupConvert(storeId, popupId, email = "") {
    await MarketingPopup.updateOne({ _id: popupId, storeId }, { $inc: { "stats.conversions": 1 } });
    await MarketingEvent.create({
        storeId,
        type: "popup_convert",
        channel: "POPUP",
        popupId,
        customerEmail: email,
    });
}

module.exports = {
    listPopups,
    getPopup,
    createPopup,
    updatePopup,
    deletePopup,
    listActiveForStorefront,
    trackPopupView,
    trackPopupConvert,
};
