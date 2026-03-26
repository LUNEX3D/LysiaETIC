const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marketplace: { type: mongoose.Schema.Types.ObjectId, ref: "Marketplace" }, // Pazaryeri bilgisi
    marketplaceName: { type: String, default: "Diğer" }, // Pazaryeri adı (hızlı erişim için)
    totalPrice: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "Created" }, // Sipariş Durumu
    trackingNumber: { type: String, default: "" }, // Kargo Takip Numarası
    items: [
        {
            productName: { type: String, required: true },
            quantity: { type: Number, required: true },
            barcode: { type: String, required: true }, // **Barkod ekledik! Stokla eşleşsin!**
            imageUrl: { type: String, default: "https://via.placeholder.com/150" }, // **Varsayılan resim**
            price: { type: Number, required: true }, // **Fiyat bilgisi**
            category: { type: String, default: "Bilinmiyor" } // **Kategori**
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
