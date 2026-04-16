/**
 * CategoryCache Model — LysiaETIC
 *
 * Pazaryeri API'lerinden çekilen kategori ağaçlarını cache'ler.
 * Her kullanıcı + pazaryeri kombinasyonu için ayrı cache kaydı tutulur.
 *
 * TTL: 24 saat (kategoriler nadiren değişir)
 * Bu sayede her arama/tree isteğinde canlı API çağrısı yapılmaz.
 */

const mongoose = require("mongoose");

const CategoryCacheSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    marketplaceName: {
        type: String,
        required: true
    },
    // Flat kategori listesi (API'den gelen ham veri — normalize edilmiş)
    categories: {
        type: Array,
        default: []
    },
    // Toplam kategori sayısı
    totalCount: {
        type: Number,
        default: 0
    },
    // Cache oluşturulma zamanı
    cachedAt: {
        type: Date,
        default: Date.now
    },
    // Cache süresi dolma zamanı (TTL)
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // MongoDB TTL index — otomatik siler
    }
}, {
    timestamps: true,
    collection: "categorycaches"
});

// Kullanıcı + pazaryeri bazında tek cache kaydı
CategoryCacheSchema.index({ userId: 1, marketplaceName: 1 }, { unique: true });

module.exports = mongoose.model("CategoryCache", CategoryCacheSchema);
