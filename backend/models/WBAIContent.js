const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBAIContentSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        jobId: { type: Schema.Types.ObjectId, ref: "WBAIJob", required: true, index: true },

        contentType: {
            type: String,
            required: true,
            enum: [
                "page_layout",
                "blog_post",
                "product_description",
                "product_faq",
                "product_specs",
                "seo_meta",
                "category_description",
                "banner_content",
                "color_palette",
                "email_template",
                "alt_text",
                "translation",
            ],
            index: true,
        },

        title: { type: String, default: "" },
        content: { type: Schema.Types.Mixed, required: true },
        prompt: { type: String, default: "" },

        modelUsed: { type: String, default: "" },
        tokensUsed: { type: Number, default: 0 },

        appliedTo: {
            type: { type: String, enum: ["page", "section", "product", "blog_post", "site_seo", "popup", null], default: null },
            targetId: { type: Schema.Types.ObjectId, default: null },
            sectionId: { type: String, default: "" },
            appliedAt: { type: Date, default: null },
        },

        tags: [{ type: String, trim: true }],
        isSaved: { type: Boolean, default: false, index: true },
        isArchived: { type: Boolean, default: false },

        rating: { type: Number, default: null, min: 1, max: 5 },
    },
    { timestamps: true }
);

WBAIContentSchema.index({ siteId: 1, contentType: 1, createdAt: -1 });
WBAIContentSchema.index({ siteId: 1, isSaved: 1 });

module.exports = mongoose.model("WBAIContent", WBAIContentSchema);
