/**
 * WBTranslation.js — Yapısal Çeviri Sistemi
 * Mevcut Mixed JSON yaklaşımının yerini alır.
 * Her entity (sayfa, blog yazısı, menü, site ayarları) için dil bazlı çeviriler.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;

const TranslationFieldSchema = new Schema(
    {
        fieldPath: { type: String, required: true },
        originalText: { type: String, default: "" },
        translatedText: { type: String, default: "" },
        status: {
            type: String,
            enum: ["pending", "machine", "human_reviewed", "approved"],
            default: "pending",
        },
        translatedBy: {
            type: String,
            default: "ai",
        },
        translatedAt: { type: Date, default: null },
        lastCheckedAt: { type: Date, default: null },
    },
    { _id: false }
);

const WBTranslationSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },

        entityType: {
            type: String,
            required: true,
            enum: ["page", "blog_post", "blog_category", "navigation", "site_settings", "product_page"],
            index: true,
        },
        entityId: { type: Schema.Types.ObjectId, required: true, index: true },

        languageCode: { type: String, required: true, trim: true, lowercase: true, index: true },

        fields: { type: [TranslationFieldSchema], default: [] },

        completionPercent: { type: Number, default: 0, min: 0, max: 100 },
        approvedCount: { type: Number, default: 0 },
        pendingCount: { type: Number, default: 0 },
        totalFields: { type: Number, default: 0 },

        lastSyncedAt: { type: Date, default: null },
        lastSyncedEntityVersion: { type: Number, default: 0 },

        translatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

WBTranslationSchema.index({ siteId: 1, entityType: 1, entityId: 1, languageCode: 1 }, { unique: true });
WBTranslationSchema.index({ siteId: 1, languageCode: 1, completionPercent: 1 });

module.exports = mongoose.model("WBTranslation", WBTranslationSchema);
