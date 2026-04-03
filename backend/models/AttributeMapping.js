const mongoose = require("mongoose");

/**
 * ATTRIBUTE (ÖZELLİK) EŞLEŞTİRME MODELİ
 *
 * Her kategori mapping'ine bağlı olarak, dahili özellik adlarını
 * pazaryeri özellik ID'leriyle eşleştirir.
 *
 * Örnek:
 *   categoryMappingId → "Telefon → Trendyol: Cep Telefonu"
 *   internalName: "Renk"
 *   platformAttributeId: "348"
 *   platformAttributeName: "Renk"
 *   isRequired: true
 *   defaultValue: null
 */
const AttributeMappingSchema = new mongoose.Schema({
    // Hangi kategori mapping'ine ait
    categoryMappingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InternalCategoryMapping",
        required: true,
        index: true
    },

    // Dahili özellik adı (kullanıcının sistemi)
    internalName: {
        type: String,
        required: true,
        trim: true
    },

    // Pazaryeri özellik bilgileri
    platformAttributeId: {
        type: String,
        default: null
    },

    platformAttributeName: {
        type: String,
        default: ""
    },

    // Özellik tipi
    attributeType: {
        type: String,
        enum: ["text", "number", "select", "multiselect", "boolean"],
        default: "text"
    },

    // Zorunlu mu?
    isRequired: {
        type: Boolean,
        default: false
    },

    // Varsayılan değer (opsiyonel)
    defaultValue: {
        type: String,
        default: null
    },

    // Seçenekler (select/multiselect için)
    options: [{
        platformValueId: String,
        platformValueName: String,
        internalValue: String
    }],

    // Aktif mi?
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Bir kategori mapping + dahili isim kombinasyonu benzersiz olmalı
AttributeMappingSchema.index(
    { categoryMappingId: 1, internalName: 1 },
    { unique: true }
);

module.exports = mongoose.model("AttributeMapping", AttributeMappingSchema);
