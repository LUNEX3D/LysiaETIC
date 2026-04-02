const mongoose = require("mongoose");

/**
 * KULLANICI KATEGORİ HAFIZASI
 *
 * Kullanıcının kategori seçimlerini saklar.
 * Sistem bu verilerden öğrenerek gelecekte otomatik eşleştirme yapar.
 *
 * Akış:
 *   1. Ürün gelir → başlık/açıklama analiz edilir
 *   2. Önce bu koleksiyonda pattern aranır
 *   3. Eşleşme varsa → otomatik kategori atanır
 *   4. Eşleşme yoksa → kullanıcıya sorulur
 *   5. Kullanıcı seçer → bu koleksiyona kaydedilir
 *   6. Bir sonraki seferde otomatik eşleşir ✅
 *
 * Örnek:
 *   userId: "abc123"
 *   pattern: "iphone"
 *   internalCategoryId: → Telefon
 *   source: "user_selection"
 *   hitCount: 47  (47 kez bu pattern ile eşleşme yapıldı)
 */
const UserCategoryMemorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // Eşleşme pattern'i (küçük harf, trim)
    // Ürün başlığında veya açıklamasında bu kelime geçerse → bu kategori atanır
    pattern: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },

    // Atanacak dahili kategori
    internalCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InternalCategory",
        required: true
    },

    // Kaynak: nasıl oluşturuldu?
    source: {
        type: String,
        enum: ["user_selection", "auto_learned", "admin_rule"],
        default: "user_selection"
    },

    // Kaç kez bu pattern ile eşleşme yapıldı (güven skoru için)
    hitCount: {
        type: Number,
        default: 0
    },

    // Son kullanım tarihi
    lastUsedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Bir kullanıcı + pattern kombinasyonu benzersiz olmalı
UserCategoryMemorySchema.index(
    { userId: 1, pattern: 1 },
    { unique: true }
);

// Sık kullanılanları hızlı bulmak için
UserCategoryMemorySchema.index({ userId: 1, hitCount: -1 });

module.exports = mongoose.model("UserCategoryMemory", UserCategoryMemorySchema);
