const MarketingQueueJob = require("../../models/MarketingQueueJob");
const logger = require("../../config/logger");

async function enqueueAutomationResume(storeId, automationId, startNodeId, context, runAt) {
    return MarketingQueueJob.create({
        storeId,
        kind: "automation_resume",
        automationId,
        startNodeId,
        context,
        runAt: runAt || new Date(),
        status: "pending",
    });
}

async function processDueJobs() {
    const now = new Date();
    const jobs = await MarketingQueueJob.find({
        status: "pending",
        runAt: { $lte: now },
    })
        .sort({ runAt: 1 })
        .limit(20)
        .lean();

    const automationService = require("./marketingAutomationService");
    const campaignService = require("./marketingCampaignService");

    for (const job of jobs) {
        const claimed = await MarketingQueueJob.findOneAndUpdate(
            { _id: job._id, status: "pending" },
            { $set: { status: "processing" } },
            { new: true }
        );
        if (!claimed) continue;

        try {
            if (job.kind === "automation_resume") {
                await automationService.resumeWorkflowFromNode(
                    job.storeId,
                    job.automationId,
                    job.startNodeId,
                    job.context || {}
                );
            } else if (job.kind === "campaign_send" && job.campaignId) {
                await campaignService.sendCampaign(job.storeId, job.campaignId, { fromQueue: true });
            }
            await MarketingQueueJob.updateOne({ _id: job._id }, { $set: { status: "done" } });
        } catch (e) {
            logger.warn("[Marketing queue]", job._id, e.message);
            await MarketingQueueJob.updateOne(
                { _id: job._id },
                { $set: { status: "failed", lastError: e.message } }
            );
        }
    }
}

function startMarketingQueueWorker() {
    const tick = () => processDueJobs().catch((e) => logger.warn("[Marketing queue tick]", e.message));
    tick();
    return setInterval(tick, 60 * 1000);
}

module.exports = { enqueueAutomationResume, processDueJobs, startMarketingQueueWorker };
