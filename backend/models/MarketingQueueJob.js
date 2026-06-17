const mongoose = require("mongoose");

const MarketingQueueJobSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        kind: { type: String, enum: ["automation_resume", "campaign_send"], required: true },
        automationId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingAutomation", default: null },
        campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", default: null },
        startNodeId: { type: String, default: "" },
        context: { type: mongoose.Schema.Types.Mixed, default: {} },
        runAt: { type: Date, required: true, index: true },
        status: { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending", index: true },
        lastError: { type: String, default: "" },
    },
    { timestamps: true }
);

MarketingQueueJobSchema.index({ status: 1, runAt: 1 });

module.exports = mongoose.model("MarketingQueueJob", MarketingQueueJobSchema);
