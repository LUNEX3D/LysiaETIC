const mongoose = require("mongoose");

/**
 * DAHİLİ KATEGORİ MODELİ
 *
 * Sistemimizin kendi kategori ağacı.
 * Pazaryerlerinden bağımsız, basit ve ölçeklenebilir.
 *
 * Örnek:
 *   Telefon (parentId: null)
 *   Ayakkabı (parentId: null)
 *     Spor Ayakkabı (parentId: Ayakkabı._id)
 *   Takı (parentId: null)
 *     Küpe (parentId: Takı._id)
 */
const InternalCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    // Üst kategori (null = kök kategori)
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InternalCategory",
        default: null,
        index: true
    },

    // URL-dostu slug
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Anahtar kelimeler — otomatik eşleştirme için
    // Örn: ["iphone", "samsung", "telefon", "cep telefonu", "akıllı telefon"]
    keywords: [{
        type: String,
        lowercase: true,
        trim: true
    }],

    // Kategori ikonu (emoji)
    icon: {
        type: String,
        default: "📁"
    },

    // Sıralama
    sortOrder: {
        type: Number,
        default: 0
    },

    // Aktif mi?
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Slug oluşturma helper
InternalCategorySchema.statics.generateSlug = function (name) {
    return name
        .toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
};

module.exports = mongoose.model("InternalCategory", InternalCategorySchema);
