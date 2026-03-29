const mongoose = require("mongoose");

/**
 * PAZARYERİ KATEGORİ MODELİ
 *
 * Pazaryerlerinden çekilen kategori ağaçlarını saklar
 */
const MarketplaceCategorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Pazaryeri bilgisi
    marketplaceName: {
        type: String,
        required: true,
        enum: ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"],
        index: true
    },

    // Kategori bilgileri
    categoryId: {
        type: String,
        required: true
    },

    categoryName: {
        type: String,
        required: true
    },

    // Kategori hiyerarşisi
    categoryPath: [{
        id: String,
        name: String
    }],

    // Kategori özellikleri
    attributes: [{
        attributeId: String,
        attributeName: String,
        isMandatory: Boolean,
        isVariant: Boolean,
        isSlicer: Boolean,
        isCustomValue: Boolean,
        attributeValues: [{
            id: String,
            value: String
        }]
    }],

    // Alt kategoriler
    subCategories: [{
        id: String,
        name: String
    }],

    // Çekme bilgileri
    pullInfo: {
        pulledAt: { type: Date, default: Date.now },
        lastSyncAt: { type: Date }
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Kompozit indeksler
MarketplaceCategorySchema.index({ userId: 1, marketplaceName: 1, categoryId: 1 }, { unique: true });
MarketplaceCategorySchema.index({ userId: 1, marketplaceName: 1 });

// Pazaryerine göre kategorileri bul
MarketplaceCategorySchema.statics.findByUserAndMarketplace = function(userId, marketplaceName) {
    return this.find({ userId, marketplaceName }).sort({ categoryPath: 1 });
};

// Kategori ID'sine göre bul
MarketplaceCategorySchema.statics.findByCategoryId = function(userId, marketplaceName, categoryId) {
    return this.findOne({ userId, marketplaceName, categoryId });
};

// Kök kategorileri bul (hiyerarşisi olmayan)
MarketplaceCategorySchema.statics.findRootCategories = function(userId, marketplaceName) {
    return this.find({
        userId,
        marketplaceName,
        categoryPath: { $size: 1 }
    });
};

module.exports = mongoose.model("MarketplaceCategory", MarketplaceCategorySchema);
