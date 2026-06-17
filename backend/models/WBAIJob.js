const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBAIJobSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        jobType: {
            type: String,
            required: true,
            enum: [
                "landing_page_generator",
                "blog_writer",
                "product_description",
                "seo_meta_generator",
                "category_description",
                "banner_generator",
                "color_palette_generator",
                "conversion_suggestions",
                "ab_test_suggestions",
                "alt_text_generator",
                "translation_auto",
                "product_faq_generator",
                "product_specs_writer",
                "email_template_writer",
                "seo_helper",
            ],
            index: true,
        },

        status: {
            type: String,
            enum: ["queued", "processing", "completed", "failed", "cancelled"],
            default: "queued",
            index: true,
        },

        priority: { type: Number, default: 5, min: 1, max: 10 },

        input: {
            prompt: { type: String, default: "" },
            context: { type: Schema.Types.Mixed, default: () => ({}) },
            parameters: {
                tone: { type: String, enum: ["professional", "casual", "friendly", "formal", "enthusiastic"], default: "professional" },
                language: { type: String, default: "tr" },
                wordCount: { type: Number, default: 200 },
                targetAudience: { type: String, default: "" },
                keywords: [{ type: String }],
                seoOptimized: { type: Boolean, default: true },
            },
            targetField: { type: String, default: "" },
            targetEntityType: { type: String, default: "" },
            targetEntityId: { type: Schema.Types.ObjectId, default: null },
        },

        output: {
            generatedContent: { type: Schema.Types.Mixed, default: null },
            contentType: { type: String, enum: ["html", "text", "json", "sections_array", "palette", "meta"], default: "text" },
            tokensUsed: { type: Number, default: 0 },
            promptTokens: { type: Number, default: 0 },
            completionTokens: { type: Number, default: 0 },
            modelUsed: { type: String, default: "" },
            generationTimeMs: { type: Number, default: 0 },
        },

        quality: {
            userRating: { type: Number, default: null, min: 1, max: 5 },
            userFeedback: { type: String, default: "" },
            wasApplied: { type: Boolean, default: false },
            appliedAt: { type: Date, default: null },
        },

        bullMQJobId: { type: String, default: "", index: true },
        queue: { type: String, enum: ["wb-ai-fast", "wb-ai-standard", "wb-ai-heavy", "wb-ai-analysis"], default: "wb-ai-standard" },

        errorMessage: { type: String, default: "" },
        retryCount: { type: Number, default: 0 },
        maxRetries: { type: Number, default: 2 },

        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

WBAIJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
WBAIJobSchema.index({ siteId: 1, jobType: 1, status: 1 });

module.exports = mongoose.model("WBAIJob", WBAIJobSchema);
