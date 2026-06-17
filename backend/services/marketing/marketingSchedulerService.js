const MarketingCampaign = require("../../models/MarketingCampaign");
const logger = require("../../config/logger");

async function processScheduledCampaigns() {
    const due = await MarketingCampaign.find({
        status: "scheduled",
        scheduledAt: { $lte: new Date() },
    })
        .select("_id storeId")
        .limit(10)
        .lean();

    const campaignService = require("./marketingCampaignService");
    for (const c of due) {
        try {
            await campaignService.sendCampaign(c.storeId, c._id, { fromScheduler: true });
        } catch (e) {
            logger.warn("[Marketing scheduler] campaign", c._id, e.message);
        }
    }
}

function startMarketingScheduler() {
    const tick = async () => {
        await processScheduledCampaigns();
    };
    tick().catch(() => {});
    return setInterval(() => tick().catch((e) => logger.warn("[Marketing scheduler]", e.message)), 60 * 1000);
}

module.exports = { processScheduledCampaigns, startMarketingScheduler };
