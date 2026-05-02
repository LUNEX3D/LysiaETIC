/**
 * Varyant grubu — aynı model / katalog altında renk–beden vb. ürün ailesi
 * Trendyol productMainId ve ileride diğer MP senkronları için ortak kimlik
 */
const mongoose = require("mongoose");

const VariantGroupSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    notes: {
        type: String,
        default: "",
        maxlength: 2000
    },
    /** Trendyol: tüm üyelerde aynı productMainId (model kodu) kullanılmalı */
    trendyolProductMainId: {
        type: String,
        default: "",
        trim: true,
        maxlength: 120
    },
    /** ProductMapping _id listesi */
    memberIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductMapping"
    }],
    dimensionHint: {
        colorLabel: { type: String, default: "Renk", trim: true },
        sizeLabel: { type: String, default: "Beden", trim: true }
    }
}, { timestamps: true });

VariantGroupSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("VariantGroup", VariantGroupSchema);
