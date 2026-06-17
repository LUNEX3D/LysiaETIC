const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBThemeInstallSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        themeId: { type: Schema.Types.ObjectId, ref: "WBTheme", required: true, index: true },
        themeVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", required: true },

        status: {
            type: String,
            enum: ["active", "preview", "inactive", "rollback_available"],
            default: "active",
            index: true,
        },

        installedAt: { type: Date, default: Date.now },
        lastUpdatedAt: { type: Date, default: null },

        customizations: {
            variables: { type: Schema.Types.Mixed, default: () => ({}) },
            headerSettings: { type: Schema.Types.Mixed, default: () => ({}) },
            footerSettings: { type: Schema.Types.Mixed, default: () => ({}) },
            cssOverrides: { type: String, default: "" },
            jsOverrides: { type: String, default: "" },
        },

        pendingUpdate: {
            available: { type: Boolean, default: false },
            targetVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", default: null },
            targetVersion: { type: String, default: "" },
            breakingChanges: { type: Boolean, default: false },
            checkedAt: { type: Date, default: null },
            changelog: { type: String, default: "" },
        },

        rollbackVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", default: null },
        rollbackCustomizations: { type: Schema.Types.Mixed, default: null },

        purchase: {
            isPaid: { type: Boolean, default: false },
            paidAt: { type: Date, default: null },
            amount: { type: Number, default: 0 },
            currency: { type: String, default: "TRY" },
            transactionId: { type: String, default: "" },
            licenseKey: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

WBThemeInstallSchema.index({ siteId: 1 }, { unique: true });
WBThemeInstallSchema.index({ themeId: 1, status: 1 });

module.exports = mongoose.model("WBThemeInstall", WBThemeInstallSchema);
