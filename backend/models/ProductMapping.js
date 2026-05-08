const mongoose = require("mongoose");

/**
 * ÜRÜN EŞLEŞTİRME MODELİ
 *
 * Bir ürünün farklı pazaryerlerindeki karşılıklarını tutar
 * Örnek: Trendyol'da "TY-123" olan ürün, N11'de "N11-456" olabilir
 */
const ProductMappingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Ana ürün bilgileri (Master Data)
    masterProduct: {
        name: { type: String, required: true },
        barcode: { type: String, required: true, index: true },
        sku: { type: String, required: true },
        description: { type: String },
        images: [{ type: String }],
        price: { type: Number, required: true },
        listPrice: { type: Number },
        stock: { type: Number, required: true, default: 0 },
        vatRate: { type: Number, default: 20 },
        /** Ay cinsinden; 0 = garantisiz; üst sınır HB/katalog ile uyumlu (masterProductAdapter sıkıştırır) */
        garantiSuresi: { type: Number, min: 0, max: 120 },
        category: { type: String },
        brand: { type: String },
        /** N11: paneldeki kargo şablonunun adı (ürün bazlı; boşsa entegrasyon credential kullanılır) */
        shipmentTemplate: { type: String },
        // Maliyet bilgileri (AI Brain tarafından kullanılır)
        costPrice: { type: Number, default: 0 },
        shippingCost: { type: Number, default: 0 },
        packagingCost: { type: Number, default: 0 },
        // Pazaryerinden gelen tüm özellikler (Trendyol satır listesi vb.) kaybolmasın diye Mixed
        attributes: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({})
        }
    },

    // Pazaryeri bazlı eşleştirmeler
    marketplaceMappings: [{
        marketplaceName: {
            type: String,
            required: true
        },
        marketplaceProductId: { type: String }, // Pazaryerindeki ürün ID
        marketplaceSku: { type: String }, // Pazaryerindeki SKU
        marketplaceBarcode: { type: String }, // Pazaryerindeki barkod
        categoryId: { type: String }, // Pazaryerine özel kategori ID
        categoryName: { type: String }, // Pazaryerine özel kategori adı
        categoryPath: [{ type: String }], // Kategori hiyerarşisi

        // Pazaryerine özel fiyatlandırma
        price: { type: Number },
        listPrice: { type: Number },
        commissionRate: { type: Number },

        // Pazaryerine özel stok
        stock: { type: Number },

        // Pazaryerine özel özellikler
        customAttributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },

        // Durum bilgileri
        isActive: { type: Boolean, default: true },
        isSynced: { type: Boolean, default: false },
        lastSyncDate: { type: Date },
        syncStatus: {
            type: String,
            enum: ["pending", "syncing", "synced", "error"],
            default: "pending"
        },
        syncError: { type: String },

        // N11 asenkron task takibi
        n11TaskId:     { type: String },   // IN_QUEUE sonrası dönen task ID
        n11TaskStatus: { type: String },   // COMPLETED / REJECT / FAILED / IN_QUEUE

        // Trendyol ürün yükleme batch takibi (batchRequestId — kuyruk sonucu ayrı sorgulanır)
        trendyolBatchRequestId: { type: String },
        trendyolBatchStatus: { type: String }, // IN_PROGRESS / COMPLETED / API'den gelen ham status

        // Hepsiburada ürün yükleme tracking takibi (import/listing kuyruğu sonucu)
        hepsiburadaTrackingId: { type: String },
        hepsiburadaTrackingStatus: { type: String }, // QUEUED / PROCESSING / COMPLETED / FAILED / API ham status
        /** true = vitrinde satışa hazır (MATCHED / Satışa Hazır); MPOP "İncelenecek" vb. için false veya alan yok */
        hepsiburadaListingReady: { type: Boolean },

        // Pazaryerinden çekilme tarihi
        pulledFromMarketplace: { type: Boolean, default: false },
        pullDate: { type: Date }
    }],

    // Otomatik senkronizasyon ayarları
    autoSync: {
        enabled: { type: Boolean, default: true },
        syncStock: { type: Boolean, default: true },
        syncPrice: { type: Boolean, default: true },
        syncInterval: { type: Number, default: 300 } // Saniye cinsinden (5 dakika)
    },

    // Stok takip bilgileri
    stockTracking: {
        totalStock: { type: Number, default: 0 },
        reservedStock: { type: Number, default: 0 },
        availableStock: { type: Number, default: 0 },
        safetyStock: { type: Number, default: 0 },       // 🛡️ Güvenlik stoğu — platformlara (total - safety) gönderilir
        lowStockThreshold: { type: Number, default: 10 },
        isLowStock: { type: Boolean, default: false },
        isOutOfStock: { type: Boolean, default: false }
    },

    // Satış istatistikleri
    salesStats: {
        totalSales: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        lastSaleDate: { type: Date },
        bestSellingMarketplace: { type: String }
    },

    // Varyant grubu (panel — ürün ailesi / Trendyol model kodu hizalama)
    variantGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VariantGroup",
        default: null,
        index: true
    },

    // Log ve geçmiş
    syncHistory: [{
        date: { type: Date, default: Date.now },
        action: { type: String }, // "stock_update", "price_update", "product_created", etc.
        marketplace: { type: String },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        status: { type: String, enum: ["success", "error"] },
        message: { type: String }
    }],

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// İndeksler
ProductMappingSchema.index({ userId: 1, "masterProduct.barcode": 1 }, { unique: true });
ProductMappingSchema.index({ userId: 1, "masterProduct.sku": 1 });
ProductMappingSchema.index({ "marketplaceMappings.marketplaceName": 1, "marketplaceMappings.marketplaceProductId": 1 });

/** Pazaryeri adını kategori kuralı için normalize et (Türkçe karakter / büyük-küçük) */
const normMp = (name) =>
    String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/ı/g, "i");

/** Listelenmiş veya senkronlanmış kanallarda yaprak kategori ID zorunlu platformlar */
const MARKETPLACES_REQUIRING_CATEGORY_ID = ["trendyol", "hepsiburada", "n11"];

ProductMappingSchema.pre("validate", function(next) {
    try {
        if (!/^(1|true|yes)$/i.test(String(process.env.PRODUCT_MAPPING_REQUIRE_CATEGORY_ID || ""))) {
            return next();
        }
        const maps = this.marketplaceMappings || [];
        for (let i = 0; i < maps.length; i++) {
            const m = maps[i];
            if (m == null) continue;
            const inactive = m.isActive === false;
            const cid = m.categoryId != null ? String(m.categoryId).trim() : "";
            const listed =
                (m.marketplaceProductId && String(m.marketplaceProductId).trim() !== "") ||
                m.isSynced === true ||
                m.syncStatus === "synced" ||
                m.syncStatus === "syncing";
            if (inactive || !listed) continue;

            const key = normMp(m.marketplaceName);
            const needsCat = MARKETPLACES_REQUIRING_CATEGORY_ID.some((p) => key.includes(p));
            if (needsCat && !cid) {
                return next(
                    new Error(
                        `Pazaryeri "${m.marketplaceName}" için yaprak kategori ID (categoryId) zorunludur (ürün listelenmiş veya senkron durumunda).`
                    )
                );
            }
        }
        next();
    } catch (e) {
        next(e);
    }
});

// Stok durumunu güncelle
ProductMappingSchema.methods.updateStockStatus = function() {
    const totalStock    = this.stockTracking.totalStock || 0;
    const reservedStock = this.stockTracking.reservedStock || 0;
    const availableStock = totalStock - reservedStock;

    this.stockTracking.availableStock = Math.max(0, availableStock);
    this.stockTracking.isOutOfStock = availableStock <= 0;
    this.stockTracking.isLowStock = availableStock > 0 && availableStock <= this.stockTracking.lowStockThreshold;
};

// 🛡️ Pazaryerlerine gönderilecek stok = totalStock - reservedStock - safetyStock
ProductMappingSchema.methods.getMarketplaceStock = function() {
    const total    = this.stockTracking.totalStock || 0;
    const reserved = this.stockTracking.reservedStock || 0;
    const safety   = this.stockTracking.safetyStock || 0;
    return Math.max(0, total - reserved - safety);
};

// Sync geçmişi ekle
ProductMappingSchema.methods.addSyncLog = function(action, marketplace, oldValue, newValue, status, message) {
    this.syncHistory.push({
        date: new Date(),
        action,
        marketplace,
        oldValue,
        newValue,
        status,
        message
    });

    // 🛡️ FIX #10: syncHistory sınırsız büyümeyi önle — son 50 log'u tut
    if (this.syncHistory.length > 50) {
        this.syncHistory = this.syncHistory.slice(-50);
    }
};

module.exports = mongoose.model("ProductMapping", ProductMappingSchema);
