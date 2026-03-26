// models/MarketplaceIntegration.js
const mongoose = require("mongoose");

const MarketplaceIntegrationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marketplaceName: { type: String, required: true }, // "Trendyol"
    sellerId: { type: String, required: true },
    apiKey: { type: String, required: true },
    apiSecret: { type: String, required: true },
    // Diğer pazar yerleri için farklı alanlar ekleyebilirsin
}, { timestamps: true });

module.exports = mongoose.model("MarketplaceIntegration", MarketplaceIntegrationSchema);
