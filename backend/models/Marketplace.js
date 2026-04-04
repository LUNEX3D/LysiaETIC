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
        enum: ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA"],
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

// 🛡️ Pre-save hook: marketplaceName normalizasyonu
// "n11" → "N11" gibi tutarsızlıkları otomatik düzelt
MarketplaceSchema.pre("save", function (next) {
    if (this.marketplaceName) {
        const n = this.marketplaceName.trim().toLowerCase();
        if (n === "n11") this.marketplaceName = "N11";
        else if (n === "trendyol") this.marketplaceName = "Trendyol";
        else if (n === "hepsiburada") this.marketplaceName = "Hepsiburada";
        else if (n === "çiçeksepeti" || n === "ciceksepeti") this.marketplaceName = "ÇiçekSepeti";
        else if (n === "amazon") this.marketplaceName = "Amazon";
    }
    next();
});

// Unique compound index — bir kullanıcı aynı pazaryerini iki kez ekleyemez
MarketplaceSchema.index({ userId: 1, marketplaceName: 1 }, { unique: true });

module.exports = mongoose.model("Marketplace", MarketplaceSchema);