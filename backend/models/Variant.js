/**
 * Variant Model — LysiaETIC
 * ✅ FIX #6: Boş dosya dolduruldu
 *
 * Ürün varyantları (renk, beden, boyut vb.)
 */
const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    sku: { type: String, required: true },
    barcode: { type: String, required: true },
    title: { type: String, default: "" },

    // Varyant özellikleri
    attributes: [{
        name: { type: String, required: true },   // "Renk", "Beden"
        value: { type: String, required: true }    // "Kırmızı", "XL"
    }],

    // Fiyat & Stok
    price: { type: Number, required: true },
    listPrice: { type: Number },
    salePrice: { type: Number },
    stock: { type: Number, default: 0 },

    // Görsel
    images: [{ type: String }],

    // Durum
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index: bir ürünün varyantları
VariantSchema.index({ product: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model("Variant", VariantSchema);
