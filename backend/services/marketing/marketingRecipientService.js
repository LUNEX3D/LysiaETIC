const StoreCustomer = require("../../models/StoreCustomer");
const MarketingSegment = require("../../models/MarketingSegment");
const { listSegmentMembers } = require("./segmentEvaluator");

function normalizePhone(phone, countryCode = "+90") {
    let digits = String(phone || "").replace(/\D/g, "");
    const cc = String(countryCode || "+90").replace(/\D/g, "");
    if (digits.startsWith(cc)) digits = digits.slice(cc.length);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && digits.startsWith("5")) return digits;
    if (digits.length === 11 && digits.startsWith("05")) return digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : "";
}

async function listEmailMarketingRecipients(storeId, limit = 2000) {
    const rows = await StoreCustomer.find({
        storeId,
        marketingEmailConsent: true,
        email: { $exists: true, $ne: "" },
    })
        .select("email firstName lastName marketingEmailConsent phone phoneCountryCode")
        .limit(limit)
        .lean();

    return rows
        .map((c) => ({
            email: String(c.email || "").trim().toLowerCase(),
            name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim(),
            marketingEmailConsent: true,
            phone: normalizePhone(c.phone, c.phoneCountryCode),
        }))
        .filter((r) => r.email);
}

async function listSmsMarketingRecipients(storeId, limit = 2000) {
    const rows = await StoreCustomer.find({
        storeId,
        phone: { $exists: true, $ne: "" },
    })
        .select("email firstName lastName marketingEmailConsent phone phoneCountryCode")
        .limit(limit)
        .lean();

    return rows
        .map((c) => ({
            email: String(c.email || "").trim().toLowerCase(),
            name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim(),
            marketingEmailConsent: !!c.marketingEmailConsent,
            phone: normalizePhone(c.phone, c.phoneCountryCode),
        }))
        .filter((r) => r.phone);
}

async function resolveCampaignRecipients(storeId, campaign) {
    if (campaign.segmentId) {
        const seg = await MarketingSegment.findOne({ _id: campaign.segmentId, storeId }).lean();
        if (!seg) return [];
        return listSegmentMembers(storeId, seg, 2000);
    }
    if (campaign.type === "SMS") return listSmsMarketingRecipients(storeId);
    return listEmailMarketingRecipients(storeId);
}

module.exports = {
    normalizePhone,
    listEmailMarketingRecipients,
    listSmsMarketingRecipients,
    resolveCampaignRecipients,
};
