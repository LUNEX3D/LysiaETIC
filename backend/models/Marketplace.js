    const mongoose = require("mongoose");

    const MarketplaceSchema = new mongoose.Schema({
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        marketplaceName: {
            type: String,
            required: true
        },
        credentials: {
            type: Object,
            required: true
        }
    }, { timestamps: true });

    const marketplaceSchema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        marketplaceName: { type: String, required: true },
        credentials: { type: Object, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    });
    module.exports = mongoose.model("Marketplace", MarketplaceSchema);