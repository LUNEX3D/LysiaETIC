const mongoose = require("mongoose");

/**
 * KATEGORİ EŞLEŞTİRME MODELİ
 *
 * Farklı pazaryerlerindeki kategori karşılıklarını tutar
 * Örnek: "Elektronik > Telefon" kategorisi her pazaryerinde farklı ID'ye sahip olabilir
 */
const CategoryMappingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Ana kategori bilgisi (Kullanıcının kendi kategori sistemi)
    masterCategory: {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        parentCategory: { type: String },
        level: { type: Number, default: 0 }, // 0: Ana kategori, 1: Alt kategori, vb.
        path: [{ type: String }], // ["Elektronik", "Telefon", "Akıllı Telefon"]
        description: { type: String }
    },

    // Pazaryeri bazlı kategori eşleştirmeleri
    marketplaceCategories: [{
        marketplaceName: {
            type: String,
            required: true,
            enum: ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"]
        },
        categoryId: { type: String, required: true }, // Pazaryerindeki kategori ID
        categoryName: { type: String, required: true }, // Pazaryerindeki kategori adı
        categoryPath: [{ type: String }], // Kategori hiyerarşisi
        parentCategoryId: { type: String },

        // Pazaryerine özel gereksinimler
        requiredAttributes: [{
            attributeId: { type: String },
            attributeName: { type: String },
            attributeType: { type: String }, // "text", "number", "select", "multiselect"
            isRequired: { type: Boolean, default: false },
            options: [{ type: String }] // Select/multiselect için seçenekler
        }],

        // Komisyon oranı (varsa)
        commissionRate: { type: Number },

        // Durum
        isActive: { type: Boolean, default: true },
        lastUpdated: { type: Date, default: Date.now }
    }],

    // İstatistikler
    stats: {
        productCount: { type: Number, default: 0 }, // Bu kategorideki ürün sayısı
        totalSales: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 }
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// İndeksler
CategoryMappingSchema.index({ userId: 1, "masterCategory.slug": 1 }, { unique: true });
CategoryMappingSchema.index({ "marketplaceCategories.marketplaceName": 1, "marketplaceCategories.categoryId": 1 });

// Pazaryeri kategorisi bul
CategoryMappingSchema.methods.getMarketplaceCategory = function(marketplaceName) {
    return this.marketplaceCategories.find(mc => mc.marketplaceName === marketplaceName);
};

// Pazaryeri kategorisi ekle veya güncelle
CategoryMappingSchema.methods.setMarketplaceCategory = function(marketplaceName, categoryData) {
    const existingIndex = this.marketplaceCategories.findIndex(mc => mc.marketplaceName === marketplaceName);

    if (existingIndex >= 0) {
        // Mongoose subdocument'ta spread çalışmaz — alanları tek tek güncelle
        const existing = this.marketplaceCategories[existingIndex];
        if (categoryData.categoryId)   existing.categoryId   = categoryData.categoryId;
        if (categoryData.categoryName) existing.categoryName = categoryData.categoryName;
        if (categoryData.categoryPath) existing.categoryPath = categoryData.categoryPath;
        if (categoryData.parentCategoryId) existing.parentCategoryId = categoryData.parentCategoryId;
        if (categoryData.requiredAttributes) existing.requiredAttributes = categoryData.requiredAttributes;
        if (categoryData.commissionRate !== undefined) existing.commissionRate = categoryData.commissionRate;
        if (categoryData.isActive !== undefined) existing.isActive = categoryData.isActive;
        existing.lastUpdated = new Date();
        this.marketplaceCategories[existingIndex] = existing;
    } else {
        this.marketplaceCategories.push({
            marketplaceName,
            categoryId:        categoryData.categoryId        || "",
            categoryName:      categoryData.categoryName      || "",
            categoryPath:      categoryData.categoryPath      || [],
            parentCategoryId:  categoryData.parentCategoryId  || null,
            requiredAttributes: categoryData.requiredAttributes || [],
            commissionRate:    categoryData.commissionRate    || null,
            isActive:          categoryData.isActive !== undefined ? categoryData.isActive : true,
            lastUpdated:       new Date()
        });
    }
};

module.exports = mongoose.model("CategoryMapping", CategoryMappingSchema);
