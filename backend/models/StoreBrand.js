const mongoose = require("mongoose");

const StoreBrandSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        sortOrder: { type: Number, default: 0 },
        sortCriteria: { type: String, default: "" },
        seo: {
            slug: { type: String, default: "" },
            pageTitle: { type: String, default: "" },
            metaDescription: { type: String, default: "" },
            noIndex: { type: Boolean, default: false },
            canonicalUrl: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

StoreBrandSchema.index({ storeId: 1, name: 1 });
StoreBrandSchema.index({ storeId: 1, "seo.slug": 1 });

module.exports = mongoose.model("StoreBrand", StoreBrandSchema);
