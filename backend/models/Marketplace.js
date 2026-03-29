const mongoose = require("mongoose");

const MarketplaceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    marketplaceName: {
        type: String,
        required: true
    },
    credentials: {
        type: Object,
        default: {}
    }
}, { timestamps: true });

MarketplaceSchema.index({ userId: 1, marketplaceName: 1 });

module.exports = mongoose.model("Marketplace", MarketplaceSchema);