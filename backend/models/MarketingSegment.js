const mongoose = require("mongoose");

const MarketingSegmentSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        isDynamic: { type: Boolean, default: true },
        rules: {
            logic: { type: String, enum: ["and", "or"], default: "and" },
            rules: [
                {
                    field: { type: String, required: true },
                    operator: { type: String, required: true },
                    value: { type: mongoose.Schema.Types.Mixed },
                },
            ],
        },
        cachedCount: { type: Number, default: 0 },
        lastCountedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

MarketingSegmentSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.model("MarketingSegment", MarketingSegmentSchema);
