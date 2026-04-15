/**
 * AutoOrderConfig Model — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Her kullanıcı + pazaryeri için otomatik sipariş işleme ayarları.
 * - Birincil kargo şirketi (primaryCargo)
 * - Yedek kargo şirketi (fallbackCargo) — birincil başarısız olursa
 * - Otomatik işleme açık/kapalı (enabled)
 * - İşlem geçmişi (son çalışma, başarı/hata sayıları)
 * ═══════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const AutoOrderConfigSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    marketplace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Marketplace",
        required: true
    },
    marketplaceName: {
        type: String,
        required: true,
        trim: true
    },

    // ── Otomatik işleme açık/kapalı ──
    enabled: {
        type: Boolean,
        default: false
    },

    // ── Kargo şirketi ayarları ──
    // Trendyol: cargoCompanyId (sayısal) — API'den dönen kargo şirketi listesi
    // Hepsiburada: cargoCompany (string) — "Yurtiçi Kargo", "Aras Kargo" vb.
    // ÇiçekSepeti: kargo entegrasyonu CS tarafından yönetilir
    primaryCargo: {
        id: { type: String, default: "" },       // Kargo şirketi ID veya kodu
        name: { type: String, default: "" },      // Kargo şirketi adı (gösterim için)
    },
    fallbackCargo: {
        id: { type: String, default: "" },
        name: { type: String, default: "" },
    },

    // ── İşlem istatistikleri ──
    stats: {
        lastRun: { type: Date },                  // Son çalışma zamanı
        totalProcessed: { type: Number, default: 0 },
        totalSuccess: { type: Number, default: 0 },
        totalFailed: { type: Number, default: 0 },
        totalFallbackUsed: { type: Number, default: 0 },
        lastError: { type: String, default: "" },
    },

    // ── Son işlenen siparişler (son 50) ──
    recentOrders: [{
        orderNumber: String,
        status: { type: String, enum: ["success", "failed", "fallback_success", "fallback_failed"] },
        cargoUsed: String,
        error: String,
        processedAt: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

// Bir kullanıcı + pazaryeri için tek config
AutoOrderConfigSchema.index({ user: 1, marketplace: 1 }, { unique: true });
AutoOrderConfigSchema.index({ user: 1, marketplaceName: 1 });

const AutoOrderConfig = mongoose.model("AutoOrderConfig", AutoOrderConfigSchema);

// Startup'ta yanlış index'leri temizle
// MongoDB'de eski "user_1" unique index varsa düşür (compound olmalı)
(async () => {
    try {
        const col = AutoOrderConfig.collection;
        const indexes = await col.indexes();
        for (const idx of indexes) {
            // "user_1" adlı ve sadece { user: 1 } olan unique index'i düşür
            if (idx.name === "user_1" && idx.unique && !idx.key.marketplace) {
                await col.dropIndex("user_1");
                console.log("[AutoOrderConfig] ⚠️ Eski 'user_1' unique index düşürüldü — doğru compound index kullanılacak");
            }
        }
    } catch (e) {
        // Collection henüz yoksa veya index yoksa sessizce geç
        if (!e.message?.includes("ns not found") && !e.message?.includes("index not found")) {
            console.warn("[AutoOrderConfig] Index temizleme hatası:", e.message);
        }
    }
})();

module.exports = AutoOrderConfig;
