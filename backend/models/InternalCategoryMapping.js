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
