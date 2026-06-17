const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBMediaSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        url: { type: String, required: true },
        thumbnailUrl: { type: String, default: "" },

        type: {
            type: String,
            required: true,
            enum: ["image", "video", "document", "audio", "other"],
            index: true,
        },
        mimeType: { type: String, default: "" },
        originalName: { type: String, default: "" },
        fileName: { type: String, required: true },

        size: { type: Number, default: 0 },
        dimensions: {
            width: { type: Number, default: 0 },
            height: { type: Number, default: 0 },
        },

        altText: { type: String, default: "" },
        caption: { type: String, default: "" },
        folder: { type: String, default: "root", index: true },

        storageProvider: { type: String, enum: ["local", "s3", "cloudinary"], default: "local" },
        storageKey: { type: String, default: "" },

        tags: [{ type: String, trim: true }],
        usageCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

WBMediaSchema.index({ siteId: 1, type: 1, createdAt: -1 });
WBMediaSchema.index({ siteId: 1, folder: 1 });

module.exports = mongoose.model("WBMedia", WBMediaSchema);
