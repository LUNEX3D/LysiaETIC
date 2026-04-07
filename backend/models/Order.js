/**
 * Order Model — LysiaETIC
 * ✅ Maliyet, komisyon, kâr alanları eklendi
 * ✅ İade/iptal takibi eklendi
 */
const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marketplace: { type: mongoose.Schema.Types.ObjectId, ref: "Marketplace" },
    marketplaceName: { type: String, default: "Diğer" },
    totalPrice: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "Created" },
    trackingNumber: { type: String, default: "" },

    // ── Müşteri bilgileri (fatura için) ─────────────────────────────────────
    customerName: { type: String, default: "" },
    customerAddress: {
        city: { type: String, default: "" },
        district: { type: String, default: "" },
        street: { type: String, default: "" },
        country: { type: String, default: "Turkiye" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
    },

    items: [
        {
            productName: { type: String, required: true },
            quantity: { type: Number, required: true },
            barcode: { type: String, required: true },
            imageUrl: { type: String, default: "https://via.placeholder.com/150" },
            price: { type: Number, required: true },
            category: { type: String, default: "Bilinmiyor" },
            // ── Maliyet alanları (sipariş anında ürün bilgisinden kopyalanır) ──
            costPrice:      { type: Number, default: 0 },   // Birim maliyet
            commissionRate: { type: Number, default: 0 },   // Komisyon oranı (%)
            commissionAmount: { type: Number, default: 0 }, // Komisyon tutarı (TL)
            shippingCost:   { type: Number, default: 0 },   // Kargo maliyeti
            netProfit:      { type: Number, default: 0 },   // Net kâr (bu kalem için)
        }
    ],

    // ── Sipariş seviyesi maliyet özeti ──────────────────────────────────────
    costSummary: {
        totalCost:       { type: Number, default: 0 },   // Toplam ürün maliyeti
        totalCommission: { type: Number, default: 0 },   // Toplam komisyon
        totalShipping:   { type: Number, default: 0 },   // Toplam kargo
        totalPackaging:  { type: Number, default: 0 },   // Toplam paketleme
        totalOtherCost:  { type: Number, default: 0 },   // Diğer giderler
        grossProfit:     { type: Number, default: 0 },   // Brüt kâr (ciro - maliyet)
        netProfit:       { type: Number, default: 0 },   // Net kâr (brüt - komisyon - kargo - diğer)
        profitMargin:    { type: Number, default: 0 },   // Kâr marjı (%)
    },

    // ── Fatura bilgisi ───────────────────────────────────────────────────────
    invoiceId:     { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    invoiceNumber: { type: String, default: "" },
    invoiceStatus: { type: String, enum: ["", "pending", "created", "error"], default: "" },

    // ── İade/İptal bilgisi ──────────────────────────────────────────────────
    isReturned:    { type: Boolean, default: false },
    isCancelled:   { type: Boolean, default: false },
    returnDate:    { type: Date },
    cancelDate:    { type: Date },
    returnReason:  { type: String },
    cancelReason:  { type: String },

}, { timestamps: true });

OrderSchema.index({ user: 1, orderDate: -1 });
OrderSchema.index({ user: 1, marketplaceName: 1 });
OrderSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Order", OrderSchema);
