const mongoose = require("mongoose");

const MarketingAutomationSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        status: { type: String, enum: ["draft", "active", "paused"], default: "draft", index: true },
        trigger: {
            type: {
                type: String,
                enum: [
                    "customer_registered",
                    "order_placed",
                    "order_cancelled",
                    "cart_abandoned",
                    "product_viewed",
                    "product_favorited",
                    "order_delivered",
                    "birthday",
                    "days_since_last_order",
                ],
                required: true,
            },
            config: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        nodes: [
            {
                id: { type: String, required: true },
                type: { type: String, enum: ["trigger", "delay", "condition", "action"], required: true },
                position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
                config: { type: mongoose.Schema.Types.Mixed, default: {} },
            },
        ],
        edges: [{ from: String, to: String }],
        stats: {
            enrolled: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

MarketingAutomationSchema.index({ storeId: 1, status: 1 });

module.exports = mongoose.model("MarketingAutomation", MarketingAutomationSchema);
