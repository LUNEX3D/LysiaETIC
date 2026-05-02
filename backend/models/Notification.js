/**
 * Notification Model — LysiaETIC
 *
 * Birleşik bildirim sistemi:
 *   • order    — Pazaryerlerinden gelen sipariş bildirimleri
 *   • admin    — Admin tarafından gönderilen bildirimler
 *   • ai       — AI sistemi tarafından oluşturulan bildirimler
 *   • stock    — Stok değişiklik bildirimleri
 *   • system   — Sistem bildirimleri (bakım, güncelleme vb.)
 */
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    // Hedef kullanıcı (null = tüm kullanıcılara broadcast)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
        default: null
    },

    // Bildirim tipi
    type: {
        type: String,
        required: true,
        enum: ["order", "admin", "ai", "stock", "system"],
        index: true
    },

    // Öncelik
    priority: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "medium"
    },

    // İçerik
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: "🔔" },

    // Sipariş bildirimi detayları
    orderData: {
        orderNumber: String,
        marketplace: String,
        totalPrice: Number,
        itemCount: Number,
        customerName: String,
        status: String,
        /** Siparişin pazaryeri / DB tarihi — bildirim yalnızca bu gün İstanbul takvimine göre “bugün” ise gösterilir */
        orderDate: Date,
    },

    // AI bildirimi detayları
    aiData: {
        category: { type: String, enum: ["recommendation", "alert", "insight", "risk", "opportunity"] },
        actionRequired: { type: Boolean, default: false },
        relatedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductMapping" },
        confidence: Number,  // 0-100
        suggestedAction: String
    },

    // Admin bildirimi detayları
    adminData: {
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        targetAudience: { type: String, enum: ["all", "active", "trial", "specific"], default: "all" },
        targetPlan: String,
        expiresAt: Date
    },

    // Stok bildirimi detayları
    stockData: {
        barcode: String,
        productName: String,
        marketplace: String,
        oldStock: Number,
        newStock: Number,
        field: String  // "stock", "price"
    },

    // Okunma durumu — kullanıcı bazlı
    readBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now }
    }],

    // Tek kullanıcıya özel bildirimler için basit read flag
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    // Silinme (dismiss)
    dismissedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // Link — tıklandığında yönlendirilecek panel
    actionLink: { type: String },  // örn: "orders", "inventory", "advanced-ai"

    // Meta
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// İndeksler
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ "adminData.targetAudience": 1, isActive: 1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 gün sonra otomatik sil

module.exports = mongoose.model("Notification", NotificationSchema);
