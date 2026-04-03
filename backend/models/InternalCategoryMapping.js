const mongoose = require("mongoose");

/**
 * DAHİLİ KATEGORİ → PAZARYERİ EŞLEŞTİRME MODELİ
 *
 * Her dahili kategorinin her pazaryerindeki karşılığını tutar.
 *
 * Örnek:
 *   Telefon → Trendyol: "Cep Telefonu" (ID: 293)
 *   Telefon → N11: "Akıllı Telefon" (ID: 1002345)
 *   Ayakkabı → Trendyol: "Spor Ayakkabı" (ID: 442)
 *
 * Ürün dağıtımında bu merkez baz alınır:
 *   Kullanıcı "X ürünü Y platformuna gönder" dediğinde
 *   ürünün dahili kategorisi → bu tablodan hedef platform kategorisi bulunur
 */
const InternalCategoryMappingSchema = new mongoose.Schema({
    // Dahili kategori referansı
    internalCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InternalCategory",
        required: true,
        index: true
    },

    // Hedef pazaryeri
    marketplace: {
        type: String,
        required: true,
        enum: ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"],
        index: true
    },

    // Pazaryerindeki kategori bilgileri
    marketplaceCategoryId: {
        type: String,
        default: null
    },

    marketplaceCategoryName: {
        type: String,
        required: true,
        trim: true
    },

    // Tam kategori yolu (opsiyonel)
    // Örn: "Elektronik > Telefon > Akıllı Telefon"
    marketplaceCategoryPath: {
        type: String,
        default: ""
    },

    // Güven skoru (0.0 - 1.0) — otomatik eşleştirmede üretilir
    confidenceScore: {
        type: Number,
        default: 1.0,
        min: 0,
        max: 1
    },

    // Kullanıcı manuel override yaptı mı?
    // true ise otomatik eşleştirme bu kaydı DEĞİŞTİRMEZ
    isManualOverride: {
        type: Boolean,
        default: false
    },

    // Eşleştirme kaynağı
    matchSource: {
        type: String,
        enum: ["manual", "manual_unmapped_resolve", "auto_fuzzy", "auto_ai", "auto_keyword", "auto_cross_platform", "auto_batch_resolve", "bulk_auto"],
        default: "manual"
    },

    // Aktif mi?
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Bir dahili kategori + pazaryeri kombinasyonu benzersiz olmalı
InternalCategoryMappingSchema.index(
    { internalCategoryId: 1, marketplace: 1 },
    { unique: true }
);

module.exports = mongoose.model("InternalCategoryMapping", InternalCategoryMappingSchema);
