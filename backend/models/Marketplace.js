/**
 * Marketplace Model — LysiaETIC
 * ✅ FIX: marketplaceName enum eklendi
 * ✅ FIX: credentials validation eklendi
 * ✅ FIX: unique compound index (userId + marketplaceName)
 */
const mongoose = require("mongoose");

const MARKETPLACE_ENUM = [
    "Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti",
    "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA",
];

/** Frontend / API'den gelen "n11" → "N11" (enum doğrulamasından önce) */
function normalizeMarketplaceName(name) {
    if (!name) return name;
    const raw = String(name).trim();
    const n = raw.toLowerCase();
    if (n === "n11") return "N11";
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    if (n === "amazon") return "Amazon";
    for (const v of MARKETPLACE_ENUM) {
        if (n === v.toLowerCase()) return v;
    }
    return raw;
}

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
        enum: MARKETPLACE_ENUM,
        trim: true,
        set: normalizeMarketplaceName,
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

const Marketplace = mongoose.model("Marketplace", MarketplaceSchema);

module.exports = Marketplace;
module.exports.normalizeMarketplaceName = normalizeMarketplaceName;
module.exports.MARKETPLACE_ENUM = MARKETPLACE_ENUM;