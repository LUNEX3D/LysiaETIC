const mongoose = require("mongoose");

/**
 * STOK SENKRONİZASYON LOG MODELİ
 *
 * Tüm stok değişikliklerini ve senkronizasyon işlemlerini loglar
 * Gerçek zamanlı bildirim sistemi için kullanılır
 */
const StockSyncLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // İşlem tipi
    actionType: {
        type: String,
        required: true,
        enum: [
            "stock_update",      // Stok güncelleme
            "price_update",      // Fiyat güncelleme
            "product_created",   // Yeni ürün oluşturma
            "product_pending",   // Ürün kuyrukta (N11/Trendyol batch)
            "product_deleted",   // Ürün silme
            "product_synced",    // Ürün senkronizasyonu
            "order_placed",      // Sipariş verildi
            "auto_sync",         // Otomatik senkronizasyon
            "manual_sync",       // Manuel senkronizasyon
            "webhook_order",     // ✅ FIX #3: Webhook ile gelen sipariş
            "bulk_update",       // Toplu güncelleme
            "bulk_delete"        // Toplu silme
        ]
    },

    // Ürün bilgileri
    product: {
        productMappingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductMapping"
        },
        barcode: { type: String, required: true },
        sku: { type: String },
        name: { type: String }
    },

    // Pazaryeri bilgisi
    marketplace: {
        name: { type: String },
        productId: { type: String }
    },

    // Değişiklik detayları
    changes: {
        field: { type: String }, // "stock", "price", "status", etc.
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        difference: { type: Number } // Sayısal değişiklikler için
    },

    // Sipariş bilgisi (eğer sipariş kaynaklıysa)
    order: {
        orderId: { type: String },
        orderNumber: { type: String },
        marketplace: { type: String },
        quantity: { type: Number }
    },

    // İşlem durumu
    status: {
        type: String,
        enum: ["pending", "processing", "success", "error", "partial"],
        default: "pending"
    },

    // Hata bilgisi
    error: {
        message: { type: String },
        code: { type: String },
        details: { type: mongoose.Schema.Types.Mixed }
    },

    // Etkilenen pazaryerleri
    affectedMarketplaces: [{
        name: { type: String },
        syncStatus: { type: String, enum: ["pending", "success", "error", "skipped"] },
        syncedAt: { type: Date },
        error: { type: String }
    }],

    // Bildirim durumu
    notification: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        read: { type: Boolean, default: false },
        readAt: { type: Date },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium"
        }
    },

    // İşlem süresi
    processingTime: { type: Number }, // Milisaniye cinsinden

    // Metadata
    timestamp: { type: Date, default: Date.now, index: true },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// İndeksler
StockSyncLogSchema.index({ userId: 1, timestamp: -1 });
StockSyncLogSchema.index({ "product.barcode": 1, timestamp: -1 });
StockSyncLogSchema.index({ actionType: 1, status: 1 });
StockSyncLogSchema.index({ "notification.sent": 1, "notification.read": 1 });

// ✅ FIX #8: TTL Index — 90 günden eski logları otomatik sil
// MongoDB TTL index: createdAt alanı 90 gün (7.776.000 saniye) geçince otomatik silinir
// Bu sayede StockSyncLog koleksiyonu sınırsız büyümez
StockSyncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ✅ FIX #8: Sipariş tekrar işleme kontrolü için compound index (performans)
// isOrderAlreadyProcessed() fonksiyonu bu alanları sorgular
StockSyncLogSchema.index({
    userId: 1,
    "order.orderId": 1,
    "product.barcode": 1,
    "marketplace.name": 1,
    actionType: 1,
    status: 1
});

// Bildirimi okundu olarak işaretle
StockSyncLogSchema.methods.markAsRead = function() {
    this.notification.read = true;
    this.notification.readAt = new Date();
    return this.save();
};

// Kritik log mu kontrol et
StockSyncLogSchema.methods.isCritical = function() {
    return this.notification.priority === "critical" ||
           this.status === "error" ||
           (this.changes.field === "stock" && this.changes.newValue === 0);
};

module.exports = mongoose.model("StockSyncLog", StockSyncLogSchema);
