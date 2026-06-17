const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBBlogCategorySchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        slug: { type: String, required: true, trim: true, lowercase: true },
        description: { type: String, default: "" },
        thumbnailUrl: { type: String, default: "" },
        color: { type: String, default: "#3b82f6" },
        sortOrder: { type: Number, default: 0 },
        postCount: { type: Number, default: 0 },
        translations: { type: Schema.Types.Mixed, default: () => ({}) },
    },
    { timestamps: true }
);

WBBlogCategorySchema.index({ siteId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model("WBBlogCategory", WBBlogCategorySchema);
