const mongoose = require("mongoose");

/**
 * PAZARYERİ ÜRÜN MODELİ
 *
 * Pazaryerlerinden çekilen ürünlerin ham verilerini saklar
 * Kullanıcı bazlı, pazaryeri bazlı ürün kataloğu
 */
const MarketplaceProductSchema = new mongoose.Schema({
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

    // Pazaryerindeki ürün bilgileri (Ham veri)
    marketplaceProductId: {
        type: String,
        required: false,   // N11'de boş gelebilir — zorunlu değil
        default: "",
        index: true
    },

    // Ürün temel bilgileri
    barcode: {
        type: String,
        required: false,   // Fallback ile doldurulur
        default: "",
        index: true
    },

    sku: {
        type: String,
        required: false,
        default: ""
    },

    name: {
        type: String,
        required: false,
        default: "İsimsiz Ürün"
    },

    description: {
        type: String
    },

    // Fiyat bilgileri
    price: {
        type: Number,
        required: false,
        default: 0
    },

    listPrice: {
        type: Number
    },

    // Stok bilgisi
    stock: {
        type: Number,
        required: false,
        default: 0
    },

    // Kategori bilgileri
    category: {
        id: String,
        name: String,
        path: [String]
    },

    // Görseller
    images: [{
        url: String,
        order: Number
    }],

    // Özellikler
    attributes: {
        color: String,
        size: String,
        weight: Number,
        brand: String,
        // Diğer pazaryerine özel özellikler
        custom: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        }
    },

    // Pazaryerine özel alanlar
    marketplaceData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Durum bilgileri
    status: {
        type: String,
        enum: ["active", "inactive", "pending", "rejected"],
        default: "active"
    },

    // Çekme bilgileri
    pullInfo: {
        pulledAt: { type: Date, default: Date.now },
        lastSyncAt: { type: Date },
        syncCount: { type: Number, default: 1 }
    },

    // Eşleşme bilgisi
    mappingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductMapping"
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Kompozit indeksler — barcode boş olabilir, unique index kaldırıldı
MarketplaceProductSchema.index({ userId: 1, marketplaceName: 1, barcode: 1 });
MarketplaceProductSchema.index({ userId: 1, marketplaceName: 1, marketplaceProductId: 1 });
MarketplaceProductSchema.index({ userId: 1, barcode: 1 });

// Pazaryerine göre ürünleri bul
MarketplaceProductSchema.statics.findByUserAndMarketplace = function(userId, marketplaceName) {
    return this.find({ userId, marketplaceName });
};

// Barkoda göre ürünü bul
MarketplaceProductSchema.statics.findByBarcode = function(userId, barcode) {
    return this.find({ userId, barcode });
};

// Pazaryerine göre ürün sayısı
MarketplaceProductSchema.statics.countByMarketplace = function(userId, marketplaceName) {
    return this.countDocuments({ userId, marketplaceName });
};

module.exports = mongoose.model("MarketplaceProduct", MarketplaceProductSchema);
