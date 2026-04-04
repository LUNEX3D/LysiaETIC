const mongoose = require("mongoose");

/**
 * PENDING DELETION MODELİ
 *
 * Trendyol gibi platformlarda ürün silme işlemi hemen yapılamaz.
 * Trendyol kuralı: Ürün önce arşive alınmalı, en az 1 gün arşivde kalmalı,
 * ancak ondan sonra DELETE API çağrısı ile tamamen silinebilir.
 *
 * Bu model arşive alınmış ama henüz silinemeyen ürünleri takip eder.
 * Cron job (stockCronService) periyodik olarak kontrol edip 25+ saat
 * arşivde kalanları DELETE ile tamamen siler.
 */
const PendingDeletionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Platform bilgisi
    marketplace: {
        type: String,
        required: true,
        enum: ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon"]
    },

    // Ürün tanımlayıcıları
    barcode: {
        type: String,
        required: true
    },
    sku: String,
    productName: String,

    // Platform credential bilgileri (silme işlemi için gerekli)
    // Not: Credential'lar Marketplace koleksiyonundan çekilecek, burada saklanmaz
    marketplaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Marketplace"
    },

    // Arşive alınma zamanı — DELETE için en az 25 saat beklenmeli
    archivedAt: {
        type: Date,
        required: true,
        default: Date.now
    },

    // Silme denemesi sayısı
    attempts: {
        type: Number,
        default: 0
    },

    // Son deneme zamanı
    lastAttemptAt: Date,

    // Son hata mesajı
    lastError: String,

    // Durum
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },

    // Tamamlanma zamanı
    completedAt: Date

}, {
    timestamps: true
});

// İndeksler
PendingDeletionSchema.index({ status: 1, archivedAt: 1 });
PendingDeletionSchema.index({ userId: 1, marketplace: 1, barcode: 1 }, { unique: true });

// 25+ saat arşivde kalan ve henüz silinmemiş ürünleri bul
PendingDeletionSchema.statics.findReadyForDeletion = function () {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    return this.find({
        status: "pending",
        archivedAt: { $lte: twentyFiveHoursAgo },
        attempts: { $lt: 5 } // Maksimum 5 deneme
    }).sort({ archivedAt: 1 });
};

// Bekleyen tüm silme işlemlerini bul (kullanıcı bazlı)
PendingDeletionSchema.statics.findPendingByUser = function (userId) {
    return this.find({
        userId,
        status: "pending"
    }).sort({ archivedAt: 1 });
};

module.exports = mongoose.model("PendingDeletion", PendingDeletionSchema);
