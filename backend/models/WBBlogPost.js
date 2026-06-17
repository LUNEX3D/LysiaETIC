const mongoose = require("mongoose");
const { Schema } = mongoose;

const BlogSeoSchema = new Schema(
    {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        keywords: { type: String, default: "" },
        ogImage: { type: String, default: "" },
        canonicalUrl: { type: String, default: "" },
        noIndex: { type: Boolean, default: false },
    },
    { _id: false }
);

const WBBlogPostSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        categoryId: { type: Schema.Types.ObjectId, ref: "WBBlogCategory", default: null, index: true },

        title: { type: String, required: true, trim: true, maxlength: 300 },
        slug: { type: String, required: true, trim: true, lowercase: true },
        excerpt: { type: String, default: "", maxlength: 500 },
        content: { type: String, default: "" },
        thumbnailUrl: { type: String, default: "" },

        author: {
            userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            name: { type: String, default: "" },
            avatarUrl: { type: String, default: "" },
            bio: { type: String, default: "" },
        },

        status: { type: String, enum: ["draft", "published", "archived", "scheduled"], default: "draft", index: true },
        publishedAt: { type: Date, default: null, index: true },
        scheduledAt: { type: Date, default: null },

        tags: [{ type: String, trim: true, lowercase: true }],

        readingTimeMinutes: { type: Number, default: 0 },

        seo: { type: BlogSeoSchema, default: () => ({}) },

        translations: { type: Schema.Types.Mixed, default: () => ({}) },

        stats: {
            views: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            shares: { type: Number, default: 0 },
        },

        isFeatured: { type: Boolean, default: false, index: true },
        allowComments: { type: Boolean, default: true },
    },
    { timestamps: true }
);

WBBlogPostSchema.index({ siteId: 1, slug: 1 }, { unique: true });
WBBlogPostSchema.index({ siteId: 1, status: 1, publishedAt: -1 });
WBBlogPostSchema.index({ siteId: 1, tags: 1 });

module.exports = mongoose.model("WBBlogPost", WBBlogPostSchema);
