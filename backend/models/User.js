const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["admin", "dev", "moderator", "seller", "user", "users"], // 'users' geçici olarak eklendi - düzeltilecek
        default: "user"
    },

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
        plan: { type: String, enum: ["free", "basic", "pro", "enterprise"], default: "free" },
        status: { type: String, enum: ["active", "cancelled", "expired"], default: "active" },
        startDate: Date,
        endDate: Date
    },

    // Trendyol Bilgileri (Legacy - will be moved to Marketplace model)
    trendyolCredentials: {
        apiKey: { type: String },
        apiSecret: { type: String },
        sellerId: { type: String }
    }

}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);