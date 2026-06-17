/**
 * Sipariş pazarlama atfı — checkout / ödeme sırasında
 */
function buildMarketingSource(ctx = {}) {
    if (!ctx?.channel) return undefined;
    return {
        channel: ctx.channel,
        campaignId: ctx.campaignId || null,
        automationId: ctx.automationId || null,
        popupId: ctx.popupId || null,
        affiliateId: ctx.affiliateId || null,
        refCode: ctx.refCode || "",
        attributedAt: new Date(),
    };
}

function parseAttributionFromCheckout(body = {}) {
    const channel = String(body.marketingChannel || body.mktChannel || "").toUpperCase();
    if (!channel) return null;
    return buildMarketingSource({
        channel,
        campaignId: body.marketingCampaignId || body.mktCampaignId,
        automationId: body.marketingAutomationId,
        popupId: body.marketingPopupId || body.mktPopupId,
        affiliateId: body.marketingAffiliateId,
        refCode: body.ref || body.refCode,
    });
}

module.exports = { buildMarketingSource, parseAttributionFromCheckout };
