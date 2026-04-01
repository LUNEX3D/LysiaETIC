/**
 * Product Model — LysiaETIC
 * ✅ FIX #15: userId field eklendi — multi-tenant desteği
 */
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    // ✅ FIX #15: Ürün sahibi — controller'lar userId ile sorgulama yapıyor
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    name:              { type: String, required: true },
    description:       { type: String, default: "Açıklama yok" },
    images:            [{ type: String }],
    barcode:           { type: String, required: true },
    stockCode:         { type: String, required: true },
    sku:               { type: String },

    // Kategori & Marka
    category:          { type: String, required: true },
    categoryId:        { type: Number, required: true },
    brandId:           { type: Number, required: true },

    // Fiyatlandırma
    price:             { type: Number, required: true },
    listPrice:         { type: Number, required: true },
    salePrice:         { type: Number, required: true },
    currencyType:      { type: String, default: "TRY" },
    vatRate:           { type: Number, required: true },

    // Stok & Kargo
    stock:             { type: Number, required: true, default: 0 },
    dimensionalWeight: { type: Number, required: true },
    cargoCompanyId:    { type: Number, required: true },
    deliveryDuration:  { type: Number, default: 3 },

    // Durum
    status:            { type: String, enum: ["active", "passive", "draft"], default: "active" },

    // Varyantlar / Özellikler
    attributes: [{ attributeId: Number, attributeValueId: Number }],
}, { timestamps: true });

// Compound index: kullanıcı + barkod benzersiz olmalı
ProductSchema.index({ userId: 1, barcode: 1 }, { unique: true });

module.exports = mongoose.model("Product", ProductSchema);
