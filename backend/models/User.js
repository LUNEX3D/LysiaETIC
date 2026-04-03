const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
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
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true }
        },
        orderNotifications: { type: Boolean, default: true },
        stockNotifications: { type: Boolean, default: true },
        financeNotifications: { type: Boolean, default: true }
    },

    // Security Settings
    security: {
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: String },
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

    // ✅ FIX H14: Legacy trendyolCredentials kaldırıldı — Marketplace model kullanılıyor

}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);