const mongoose = require("mongoose");

/**
 * UNMAPPED CATEGORY MODELİ
 *
 * Kategori mapping'i bulunamayan ürünlerin kategorilerini saklar.
 * Kullanıcı daha sonra bu listeyi görerek manuel mapping yapabilir.
 *
 * Akış:
 *   uploadProductToN11() → kategori bulunamadı
 *   → saveUnmappedCategory() çağrılır
 *   → Bu koleksiyona kaydedilir (duplicate yok)
 *   → GET /api/marketplace/n11/unmapped-categories ile listelenir
 *   → Kullanıcı mapping yapar → CategoryMapping'e kaydedilir
 *   → Bir sonraki yüklemede artık bulunur
 */
const UnmappedCategorySchema = new mongoose.Schema({
    userId: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      "User",
        required: true,
        index:    true
    },

    // Eşleştirilemeyen kategori adı (Trendyol'dan gelen)
    categoryName: {
        type:     String,
        required: true,
        trim:     true
    },

    // Kaynak pazaryeri
    source: {
        type:    String,
        default: "Trendyol",
        enum:    ["Trendyol", "Hepsiburada", "Manuel", "ÇiçekSepeti"]
    },

    // Hedef pazaryeri (mapping yapılacak yer)
    targetMarketplace: {
        type:    String,
        default: "N11",
        enum:    ["N11", "Hepsiburada", "Amazon", "ÇiçekSepeti"]
    },

    // İlk tespit tarihi
    detectedAt: {
        type:    Date,
        default: Date.now
    },

    // Son tespit tarihi (aynı kategori tekrar gelirse güncellenir)
    lastSeenAt: {
        type:    Date,
        default: Date.now
    },

    // Kaç kez bu kategoriyle karşılaşıldı
    hitCount: {
        type:    Number,
        default: 1
    },

    // Otomatik öneri sistemi tarafından üretilen öneriler
    suggestedCategories: [{
        name:        { type: String },   // "Takı > Küpe"
        categoryId:  { type: String },   // N11 kategori ID (varsa)
        score:       { type: Number },   // 0.0 - 1.0 güven skoru
        matchReason: { type: String }    // "title_keyword", "category_name", "brand"
    }],

    // Kullanıcı bu kategoriyi çözdü mü?
    isResolved: {
        type:    Boolean,
        default: false
    },

    // Çözüm tarihi
    resolvedAt: {
        type: Date
    },

    // Hangi N11 kategorisiyle çözüldü
    resolvedWith: {
        categoryId:   { type: String },
        categoryName: { type: String }
    },

    // Bu kategoriyle karşılaşılan örnek ürün başlıkları (debug için)
    sampleProducts: [{
        type: String
    }]

}, { timestamps: true });

// Composite unique index — aynı kullanıcı + kategori + hedef pazaryeri kombinasyonu tek kayıt
UnmappedCategorySchema.index(
    { userId: 1, categoryName: 1, targetMarketplace: 1 },
    { unique: true }
);

UnmappedCategorySchema.index({ userId: 1, isResolved: 1 });
UnmappedCategorySchema.index({ userId: 1, targetMarketplace: 1, isResolved: 1 });

module.exports = mongoose.model("UnmappedCategory", UnmappedCategorySchema);
