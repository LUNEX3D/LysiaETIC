const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBProductReviewSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        productId: { type: Schema.Types.ObjectId, required: true, index: true },
        orderId: { type: Schema.Types.ObjectId, default: null },

        reviewer: {
            userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            name: { type: String, required: true, trim: true, maxlength: 100 },
            email: { type: String, default: "", trim: true, lowercase: true },
            avatarUrl: { type: String, default: "" },
        },

        rating: { type: Number, required: true, min: 1, max: 5, index: true },
        title: { type: String, default: "", trim: true, maxlength: 200 },
        body: { type: String, required: true, trim: true, maxlength: 2000 },

        images: [
            {
                url: { type: String, required: true },
                thumbnailUrl: { type: String, default: "" },
                altText: { type: String, default: "" },
            },
        ],

        verifiedPurchase: { type: Boolean, default: false, index: true },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "spam"],
            default: "pending",
            index: true,
        },

        sellerResponse: {
            text: { type: String, default: "" },
            respondedAt: { type: Date, default: null },
            respondedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        },

        votes: {
            helpful: { type: Number, default: 0 },
            notHelpful: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },

        source: {
            type: String,
            enum: ["web", "app", "import", "api"],
            default: "web",
        },

        ipAddress: { type: String, default: "" },
        language: { type: String, default: "tr" },

        moderationNote: { type: String, default: "" },
        moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        moderatedAt: { type: Date, default: null },

        isFeatured: { type: Boolean, default: false, index: true },
    },
    { timestamps: true }
);

WBProductReviewSchema.index({ siteId: 1, productId: 1, status: 1 });
WBProductReviewSchema.index({ siteId: 1, status: 1, createdAt: -1 });
WBProductReviewSchema.index({ siteId: 1, rating: 1, status: 1 });

module.exports = mongoose.model("WBProductReview", WBProductReviewSchema);
