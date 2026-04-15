const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    surname: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: {
        type: String,
        // ✅ FIX #16: Geçersiz "users" enum değeri kaldırıldı
        enum: ["admin", "dev", "moderator", "seller", "user"],
        default: "user"
    },

    // Email Verification
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },

    // Password Reset
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },

    // Google OAuth
    googleId: { type: String },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },

    // Profile Information
    profile: {
        avatar: { type: String },
        phone: { type: String },
        company: { type: String },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: { type: String, default: "TR" }
        },
        taxInfo: {
            taxNumber: String,
            taxOffice: String
        }
    },

    // User Preferences
    preferences: {
        language: { type: String, default: "tr" },
        timezone: { type: String, default: "Europe/Istanbul" },
        currency: { type: String, default: "TRY" },
        dateFormat: { type: String, enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"], default: "DD/MM/YYYY" },
        tablePageSize: { type: Number, enum: [10, 25, 50, 100], default: 25 },

        // Bildirim Tercihleri
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true }
        },
        orderNotifications: { type: Boolean, default: true },
        stockNotifications: { type: Boolean, default: true },
        financeNotifications: { type: Boolean, default: true },
        syncErrorNotifications: { type: Boolean, default: true },
        lowStockAlertThreshold: { type: Number, default: 10 },

        // Ürün Eşleştirme Öncelik Sırası
        productMatchPriority: {
            primary:   { type: String, enum: ["sku", "barcode", "name"], default: "sku" },
            secondary: { type: String, enum: ["sku", "barcode", "name"], default: "barcode" },
            tertiary:  { type: String, enum: ["sku", "barcode", "name"], default: "name" }
        },

        // Ürün Yönetimi Varsayılanları
        defaultSafetyStock: { type: Number, default: 0 },
        defaultVatRate: { type: Number, enum: [0, 1, 10, 20], default: 20 },
        autoSyncEnabled: { type: Boolean, default: true },
        autoSyncStock: { type: Boolean, default: true },
        autoSyncPrice: { type: Boolean, default: true },
        autoSyncInterval: { type: Number, enum: [5, 10, 15, 30, 60], default: 5 },

        // Pazaryeri Ayarları
        platformPriceMultipliers: {
            Trendyol: { type: Number, default: 0 },
            Hepsiburada: { type: Number, default: 0 },
            N11: { type: Number, default: 0 },
            Amazon: { type: Number, default: 0 },
            ÇiçekSepeti: { type: Number, default: 0 }
        },
        platformCommissionRates: {
            Trendyol: { type: Number, default: 0 },
            Hepsiburada: { type: Number, default: 0 },
            N11: { type: Number, default: 0 },
            Amazon: { type: Number, default: 0 },
            ÇiçekSepeti: { type: Number, default: 0 }
        }
    },

    // Security Settings
    security: {
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: String },
        twoFactorCode: { type: String },
        twoFactorCodeExpires: { type: Date },
        twoFactorBackupCodes: [{ type: String }],
        lastPasswordChange: { type: Date },
        loginHistory: [{
            ip: String,
            device: String,
            location: String,
            timestamp: { type: Date, default: Date.now }
        }]
    },

    // API Keys
    apiKeys: [{
        name: String,
        key: String,
        createdAt: { type: Date, default: Date.now },
        lastUsed: Date,
        permissions: [String]
    }],

    // Subscription Info
    subscription: {
        plan: { type: String, enum: ["free", "trial", "basic", "pro", "enterprise"], default: "trial" },
        status: { type: String, enum: ["active", "trial", "cancelled", "expired", "suspended"], default: "trial" },
        startDate: { type: Date, default: Date.now },
        endDate: Date,
        trialStartDate: { type: Date },
        trialEndDate: { type: Date },
        trialUsed: { type: Boolean, default: false },
        lastPaymentId: String,
        autoRenew: { type: Boolean, default: false },
        grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin tarafından verildi mi
        grantedAt: Date,
        grantNote: String
    },

    // ✅ LEGAL: Yasal belge onay kaydı — KVKK/GDPR uyumlu
    legalAcceptance: {
        accepted: { type: Boolean, default: false },
        privacyPolicy: { type: Boolean, default: false },
        termsOfService: { type: Boolean, default: false },
        cookiePolicy: { type: Boolean, default: false },
        acceptedAt: { type: Date },
        acceptedVersion: { type: String, default: "1.0" },
        ipAddress: { type: String },
        userAgent: { type: String }
    },

    // ✅ SEC #2: Refresh token DB'de saklanıyor — revoke desteği
    refreshTokens: [{
        token: { type: String, required: true },
        device: { type: String, default: "unknown" },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true }
    }],

    // ✅ FIX H14: Legacy trendyolCredentials kaldırıldı — Marketplace model kullanılıyor

}, { timestamps: true });

// ✅ SEC #2: Süresi dolmuş refresh token'ları otomatik temizle
UserSchema.methods.cleanExpiredTokens = function () {
    const now = new Date();
    this.refreshTokens = (this.refreshTokens || []).filter(rt => rt.expiresAt > now);
    return this;
};

// ✅ SEC #2: Belirli bir refresh token'ı revoke et
UserSchema.methods.revokeRefreshToken = function (token) {
    this.refreshTokens = (this.refreshTokens || []).filter(rt => rt.token !== token);
    return this;
};

// ✅ SEC #2: Tüm refresh token'ları revoke et (şifre değişikliği, güvenlik ihlali)
UserSchema.methods.revokeAllRefreshTokens = function () {
    this.refreshTokens = [];
    return this;
};

module.exports = mongoose.model("User", UserSchema);