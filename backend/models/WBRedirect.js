const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBRedirectSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },

        fromPath: { type: String, required: true, trim: true },
        toPath: { type: String, required: true, trim: true },

        type: { type: String, enum: ["301", "302"], default: "301" },
        isActive: { type: Boolean, default: true, index: true },

        matchType: { type: String, enum: ["exact", "prefix", "regex"], default: "exact" },
        regexPattern: { type: String, default: "" },
        isCaseSensitive: { type: Boolean, default: false },

        createdBy: { type: String, enum: ["manual", "system"], default: "manual" },
        sourcePageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        reason: { type: String, default: "" },

        hitCount: { type: Number, default: 0 },
        lastHitAt: { type: Date, default: null },

        expiresAt: { type: Date, default: null },
    },
    { timestamps: true }
);

WBRedirectSchema.index({ siteId: 1, fromPath: 1 }, { unique: true });
WBRedirectSchema.index({ siteId: 1, isActive: 1 });

module.exports = mongoose.model("WBRedirect", WBRedirectSchema);
