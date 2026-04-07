/**
 * MarketplaceCategory Model
 *
 * Pazaryerlerinden çekilen kategori ağaçlarını saklar.
 * advancedProductPullService tarafından doldurulur.
 */

const mongoose = require("mongoose");

const MarketplaceCategorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    marketplaceName: {
        type: String,
        required: true
    },
    categoryId: {
        type: String,
        required: true
    },
    categoryName: {
        type: String,
        default: ""
    },
    categoryPath: {
        type: [String],
        default: []
    },
    attributes: {
        type: Array,
        default: []
    },
    subCategories: {
        type: Array,
        default: []
    }
}, { timestamps: true });

MarketplaceCategorySchema.index({ userId: 1, marketplaceName: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model("MarketplaceCategory", MarketplaceCategorySchema);
