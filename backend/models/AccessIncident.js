/**
 * AccessIncident Model — LysiaETIC
 *
 * Kullanıcı erişim olaylarını tek bir akışta toplar:
 *   • rate_limit_429       — Aynı kullanıcı/IP rate-limit'i aştı
 *   • auth_failed          — Login parolası yanlış / 2FA hatalı
 *   • auth_token_invalid   — Geçersiz / süresi geçmiş token
 *   • blocked_attempt      — Bloklu kullanıcı erişim denedi
 *   • suspicious_activity  — Şüpheli davranış (ip değişimi, hızlı tarama)
 *   • auto_block           — Sistem otomatik blokladı
 *   • auto_unblock         — Süresi bitti, otomatik açıldı
 *   • admin_block          — Admin manuel blokladı
 *   • admin_unblock        — Admin manuel açtı
 *   • help_request         — Kullanıcı "engelim açın" talebi
 *
 * Bu kayıtlar admin tarafında "Erişim Kontrol Merkezi" sayfasında listelenir,
 * filtrelenir ve admin tek tıkla blokaj kaldırabilir.
 */

const mongoose = require("mongoose");

const AccessIncidentSchema = new mongoose.Schema({
    // İlgili kullanıcı — bilinmeyebilir (login öncesi rate-limit gibi)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
        default: null,
    },
    // Login denenmiş e-posta (userId çözülemediyse de yakalayalım)
    email: { type: String, default: "" },

    // Olay tipi
    type: {
        type: String,
        required: true,
        enum: [
            "rate_limit_429",
            "auth_failed",
            "auth_token_invalid",
            "blocked_attempt",
            "suspicious_activity",
            "auto_block",
            "auto_unblock",
            "admin_block",
            "admin_unblock",
            "help_request",
            // Subscription kaynaklı 403'ler — kullanıcı "erişim engelli" zannediyor
            // ama aslında abonelik/trial sorunu var
            "subscription_expired",
            "subscription_suspended",
            "trial_ended",
            "no_subscription",
            // Yetki kaynaklı 403'ler
            "admin_required",
            "role_denied",
        ],
        index: true,
    },

    // Önem derecesi
    severity: {
        type: String,
        enum: ["info", "warning", "error", "critical"],
        default: "warning",
        index: true,
    },

    // İnsan okunabilir açıklama
    description: { type: String, default: "" },

    // İstemci bilgileri
    ip: { type: String, default: "", index: true },
    userAgent: { type: String, default: "" },
    device: {
        browser: { type: String, default: "" },        // Chrome, Firefox, ...
        browserVersion: { type: String, default: "" },
        os: { type: String, default: "" },             // Windows 10, macOS, Android, ...
        deviceType: { type: String, default: "" },     // desktop | mobile | tablet | bot
        isBot: { type: Boolean, default: false },
    },
    // Coğrafi (opsiyonel — varsa ip API'sinden doldurulur)
    geo: {
        country: { type: String, default: "" },
        city: { type: String, default: "" },
        timezone: { type: String, default: "" },
    },

    // Hangi istek
    endpoint: { type: String, default: "" },
    method: { type: String, default: "" },
    statusCode: { type: Number, default: 0 },

    // Otomatik aksiyon alındı mı?
    autoActionTaken: { type: String, default: "" }, // "block_15m", "block_1h", "none"

    // Çözüm durumu
    resolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolutionNote: { type: String, default: "" },

    // Genişletilebilir meta
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// İndeksler
AccessIncidentSchema.index({ userId: 1, createdAt: -1 });
AccessIncidentSchema.index({ type: 1, createdAt: -1 });
AccessIncidentSchema.index({ severity: 1, resolved: 1, createdAt: -1 });
AccessIncidentSchema.index({ ip: 1, createdAt: -1 });
// 90 gün sonra otomatik sil (eski kayıtlar boğmasın)
AccessIncidentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("AccessIncident", AccessIncidentSchema);
