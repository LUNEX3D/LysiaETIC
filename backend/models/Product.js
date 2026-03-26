const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    listPrice: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    description: { type: String, default: "Açıklama yok" },
    images: [{ type: String, default: "" }],  // ✅ Çoklu görsel desteği
    barcode: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    brandId: { type: Number, required: true },  // ✅ Marka ID
    categoryId: { type: Number, required: true },  // ✅ Kategori ID
    stockCode: { type: String, required: true },
    dimensionalWeight: { type: Number, required: true },
    currencyType: { type: String, default: "TRY" },
    listPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    cargoCompanyId: { type: Number, required: true },
    deliveryDuration: { type: Number, default: 3 },
    attributes: [{ attributeId: Number, attributeValueId: Number }],  // ✅ Varyantlar
}, { timestamps: true });

module.exports = mongoose.model("Product", ProductSchema);
