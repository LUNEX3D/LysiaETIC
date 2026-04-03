/**
 * Marketplace Model — LysiaETIC
 * ✅ FIX: marketplaceName enum eklendi
 * ✅ FIX: credentials validation eklendi
 * ✅ FIX: unique compound index (userId + marketplaceName)
 */
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
        required: true,
        enum: ["Trendyol", "Hepsiburada", "n11", "N11", "ÇiçekSepeti", "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA"],
        trim: true
    },
    credentials: {
        type: Object,
        required: true,
        validate: {
            validator: function(v) {
                return v && typeof v === "object" && Object.keys(v).length > 0;
            },
            message: "Credentials boş olamaz!"
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Unique compound index — bir kullanıcı aynı pazaryerini iki kez ekleyemez
MarketplaceSchema.index({ userId: 1, marketplaceName: 1 }, { unique: true });

module.exports = mongoose.model("Marketplace", MarketplaceSchema);