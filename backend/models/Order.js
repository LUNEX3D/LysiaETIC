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
    /** Pazaryeri brüt satış (Trendyol: Satış tutarı) — totalPrice genelde faturalanacak net */
    grossOrderAmount: { type: Number, default: 0 },
    sellerDiscountTotal: { type: Number, default: 0 },
    tyDiscountTotal: { type: Number, default: 0 },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "Created" },
    /** Ana sayfa sekmesi: new | processing | shipping | delivered | cancelled | returned */
    statusBucket: { type: String, default: "new" },
    trackingNumber: { type: String, default: "" },
    /** Kargo firması adı (pazaryeri API) */
    cargoCompany: { type: String, default: "" },
    /** Trendyol ortak etiket / kargo takip no (cargoTrackingNumber) */
    cargoTrackingNumber: { type: String, default: "" },
    /** Hepsiburada paket numarası (etiket API için) */
    packageNumber: { type: String, default: "" },
    /** Trendyol shipment package id */
    shipmentPackageId: { type: String, default: "" },
    /** ÇiçekSepeti alt sipariş numarası (orderItemId) */
    orderItemId: { type: String, default: "" },
    /** Trendyol / pazaryeri kargo takip sayfası (Express etiket yazdırma) */
    cargoTrackingLink: { type: String, default: "" },

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
    // ── Ham fatura adresi (B2B bilgileri için) ──────────────────────────────
    // Pazaryerlerinden gelen invoiceAddress raw verisi (VKN, vergi dairesi, firma adı)
    // buildCustomerFromOrder bu alandan VKN çıkarır
    _rawInvoiceAddress: {
        fullName: { type: String, default: "" },
        company: { type: String, default: "" },
        taxNumber: { type: String, default: "" },
        taxOffice: { type: String, default: "" },
        city: { type: String, default: "" },
        district: { type: String, default: "" },
        fullAddress: { type: String, default: "" },
    },

    // ── Pazaryeri fatura durumu ───────────────────────────────────────────────
    // Pazaryerinde zaten fatura kesilmiş mi? (Trendyol "Invoiced" status veya invoiceLink dolu)
    // Mükerrer fatura engeli için kullanılır
    marketplaceInvoiced: { type: Boolean, default: false },
    // Pazaryeri tarafından döndürülen fatura PDF URL'si (Trendyol invoiceLink vb.)
    // X kullanıcı sistemimize geçmeden önce panelden fatura yüklediyse buraya dolar
    invoiceUrl: { type: String, default: "" },
    // Fatura bilgisinin nereden geldiğini izleme — UI'da şeffaflık ve AI guardrail için
    // marketplace_api: API'den invoiceLink döndü
    // marketplace_status: status "Invoiced" ama link yok
    // einvoice_match: kendi e-fatura sağlayıcımızla eşleşti
    // manual_bulk: kullanıcı toplu işaretledi
    // legacy_assumed: belirli tarihten önce faturalı varsayıldı
    // lysia_generated: LysiaETIC otomatik kesti
    invoiceSource: {
        type: String,
        enum: ["", "marketplace_api", "marketplace_status", "einvoice_match", "manual_bulk", "legacy_assumed", "lysia_generated"],
        default: "",
    },
    // Son fatura durumu senkronizasyon zamanı (sync sırasında set edilir)
    invoiceCheckedAt: { type: Date },
    // Kurumsal fatura mı? (Trendyol commercial flag — B2B/mikro ihracat ayırt etmek için)
    commercialInvoice: { type: Boolean, default: false },
    // Mikro ihracat ETGB (gümrük) numarası (Trendyol micro=true ise)
    etgbNo: { type: String, default: "" },
    etgbDate: { type: Date },

    // ── Uluslararası sipariş bilgisi (mikro ihracat) ─────────────────────────
    // Teslimat ülkesi Türkiye dışı ise mikro ihracat faturası kesilir
    shippingCountry: { type: String, default: "Turkiye" },

    items: [
        {
            productName: { type: String, required: true },
            quantity: { type: Number, required: true },
            barcode: { type: String, required: true },
            /** Pazaryeri satıcı SKU (Trendyol merchantSku vb.) — stok görseli eşlemesi için */
            sku: { type: String, default: "" },
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

    // ── Bildirim takibi ───────────────────────────────────────────────────────
    // Yeni sipariş bilgilendirme e-postası gönderildiyse zamanı (idempotent — çift mail engeli)
    newOrderEmailSentAt: { type: Date },

    // ── İade/İptal bilgisi ──────────────────────────────────────────────────
    isReturned:    { type: Boolean, default: false },
    isCancelled:   { type: Boolean, default: false },
    returnDate:    { type: Date },
    cancelDate:    { type: Date },
    returnReason:  { type: String },
    cancelReason:  { type: String },

}, { timestamps: true });

OrderSchema.index({ user: 1, orderDate: -1 });
OrderSchema.index({ user: 1, orderDate: -1, marketplaceName: 1 });
OrderSchema.index({ user: 1, marketplaceName: 1 });
OrderSchema.index({ user: 1, trackingNumber: 1, marketplaceName: 1 });
OrderSchema.index({ user: 1, status: 1 });
OrderSchema.index({ user: 1, statusBucket: 1, orderDate: -1 });

module.exports = mongoose.model("Order", OrderSchema);
