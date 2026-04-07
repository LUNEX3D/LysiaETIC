const mongoose = require("mongoose");

/**
 * KATEGORİ HATA LOGU MODELİ
 *
 * Ürün dağıtımında kategori eşleştirmesi başarısız olan ürünleri takip eder.
 * Kullanıcı bu listeyi görerek:
 *   1. İlgili platformun gerçek kategorilerini arar/seçer
 *   2. Doğru kategoriyi kaydeder
 *   3. Ürünü tekrar gönderir
 *
 * Akış:
 *   distributeProductToMarketplaces() → kategori hatası
 *   → CategoryErrorLog'a kaydet
 *   → Kullanıcı UI'dan düzeltir → ürün tekrar dağıtılır
 *   → isResolved = true
 */
const CategoryErrorLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Ürün referansı
    productMappingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductMapping",
        required: true,
        index: true
    },

    // Ürün bilgileri (hızlı erişim için denormalize)
    productName: {
        type: String,
        required: true
    },
    productBarcode: {
        type: String,
        default: ""
    },
    productSku: {
        type: String,
        default: ""
    },
    productCategory: {
        type: String,
        default: ""
    },
    productImage: {
        type: String,
        default: ""
    },

    // Hata veren platform
    marketplace: {
        type: String,
        required: true,
        enum: ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"],
        index: true
    },

    // Hata mesajı
    errorMessage: {
        type: String,
        required: true
    },

    // Hata tipi
    errorType: {
        type: String,
        enum: ["CATEGORY_MAPPING_MISSING", "CATEGORY_REJECTED", "CATEGORY_INVALID", "OTHER"],
        default: "CATEGORY_MAPPING_MISSING"
    },

    // Kullanıcı tarafından seçilen doğru kategori
    resolvedCategoryId: {
        type: String,
        default: null
    },
    resolvedCategoryName: {
        type: String,
        default: null
    },
    resolvedCategoryPath: {
        type: String,
        default: null
    },

    // Çözüm durumu
    isResolved: {
        type: Boolean,
        default: false,
        index: true
    },
    resolvedAt: {
        type: Date,
        default: null
    },

    // Tekrar gönderim durumu
    retryStatus: {
        type: String,
        enum: ["pending", "retrying", "success", "failed", null],
        default: null
    },
    retryMessage: {
        type: String,
        default: null
    },
    retryAt: {
        type: Date,
        default: null
    },

    // Kaç kez bu hata oluştu
    hitCount: {
        type: Number,
        default: 1
    },

    // İlk tespit
    detectedAt: {
        type: Date,
        default: Date.now
    },

    // Son tespit
    lastSeenAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Aynı ürün + platform kombinasyonu tek kayıt
CategoryErrorLogSchema.index(
    { userId: 1, productMappingId: 1, marketplace: 1 },
    { unique: true }
);

CategoryErrorLogSchema.index({ userId: 1, isResolved: 1, marketplace: 1 });

module.exports = mongoose.model("CategoryErrorLog", CategoryErrorLogSchema);
