const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBThemeAssetSchema = new Schema(
    {
        themeVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", required: true, index: true },
        themeId: { type: Schema.Types.ObjectId, ref: "WBTheme", required: true, index: true },

        key: { type: String, required: true, trim: true },

        assetType: {
            type: String,
            required: true,
            enum: ["css", "js", "image", "font", "json", "svg", "other"],
            index: true,
        },

        role: {
            type: String,
            enum: ["main", "critical", "deferred", "optional", "config"],
            default: "optional",
        },

        storageProvider: { type: String, enum: ["local", "s3", "cloudinary"], default: "local" },
        storageKey: { type: String, default: "" },
        publicUrl: { type: String, default: "" },
        cdnUrl: { type: String, default: "" },

        contentHash: { type: String, default: "" },
        fileSizeBytes: { type: Number, default: 0 },
        contentType: { type: String, default: "" },

        isCompressed: { type: Boolean, default: false },
        compressionType: { type: String, enum: ["gzip", "brotli", "none"], default: "none" },
        sourceMapUrl: { type: String, default: "" },

        inlineContent: { type: String, default: "" },
        isInlined: { type: Boolean, default: false },

        loadOrder: { type: Number, default: 0 },
        loadCondition: { type: String, default: "" },
    },
    { timestamps: true }
);

WBThemeAssetSchema.index({ themeVersionId: 1, key: 1 }, { unique: true });
WBThemeAssetSchema.index({ themeVersionId: 1, assetType: 1, role: 1 });

module.exports = mongoose.model("WBThemeAsset", WBThemeAssetSchema);
