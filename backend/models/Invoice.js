/**
 * Invoice Model — LysiaETIC
 *
 * Kesilen e-Arşiv / e-Fatura / e-İrsaliye belgelerinin kaydı.
 * Otomatik veya manuel fatura kesimlerinin tümü burada saklanır.
 * Order modeli ile ilişkilendirilir (orderId).
 */
const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // ── Sipariş İlişkisi ──────────────────────────────────────────────────
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        index: true
    },
    orderNumber: { type: String, default: "" },       // Pazaryeri sipariş numarası
    custInvId: { type: String, default: "" },          // Sovos/QNB müşteri fatura ID (CustInvID)
    marketplaceName: { type: String, default: "" },    // Trendyol, Hepsiburada, N11...

    // ── Fatura Bilgileri ──────────────────────────────────────────────────
    invoiceNumber: { type: String, required: true },   // ABC2026000000001
    uuid: { type: String, required: true },            // ETTN (UUID)
    envUuid: { type: String, default: "" },           // Sovos zarf UUID (getEnvelopeStatus)
    profileId: {                                        // Belge profili
        type: String,
        enum: ["EARSIVFATURA", "TICARIFATURA", "TEMELFATURA", "IRSALIYE", "IHRACAT", "YOLCUBERABERFATURA"],
        default: "EARSIVFATURA"
    },
    invoiceTypeCode: {                                  // Fatura tipi
        type: String,
        enum: ["SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH", "IHRACKAYITLI"],
        default: "SATIS"
    },
    issueDate: { type: Date, default: Date.now },
    currency: { type: String, default: "TRY" },

    // ── Sağlayıcı Bilgisi ────────────────────────────────────────────────
    provider: {
        type: String,
        enum: ["qnb", "trendyol", "sovos", "parasut", "odeal", "manual"],
        default: "qnb"
    },
    env: { type: String, enum: ["test", "production"], default: "test" },

    // ── Satıcı Bilgileri ──────────────────────────────────────────────────
    supplier: {
        vkn: { type: String, default: "" },
        name: { type: String, default: "" },
        taxOffice: { type: String, default: "" },
    },

    // ── Alıcı Bilgileri ──────────────────────────────────────────────────
    customer: {
        vkn: { type: String, default: "" },
        name: { type: String, default: "" },
        taxOffice: { type: String, default: "" },
    },

    // ── Tutar Bilgileri ──────────────────────────────────────────────────
    totals: {
        lineExtensionAmount: { type: Number, default: 0 },  // KDV hariç toplam
        totalTax: { type: Number, default: 0 },              // Toplam KDV
        taxInclusiveAmount: { type: Number, default: 0 },    // KDV dahil toplam
        payableAmount: { type: Number, default: 0 },         // Ödenecek tutar
        totalDiscount: { type: Number, default: 0 },         // Toplam indirim
    },

    // ── Kalem Bilgileri ──────────────────────────────────────────────────
    lines: [{
        name: { type: String, default: "" },
        quantity: { type: Number, default: 1 },
        unit: { type: String, default: "adet" },
        unitPrice: { type: Number, default: 0 },
        vatRate: { type: Number, default: 20 },
        discountAmount: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
        vatAmount: { type: Number, default: 0 },
    }],

    // ── Durum ─────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ["created", "sent", "accepted", "rejected", "cancelled", "error"],
        default: "created"
    },

    /** Gelen / giden belge yönü (e-Fatura listeleme ve kabul/red için) */
    direction: {
        type: String,
        enum: ["incoming", "outgoing"],
        default: "outgoing",
    },

    // ── Oluşturma Yöntemi ─────────────────────────────────────────────────
    createdBy: {
        type: String,
        enum: ["auto", "manual", "batch-script"],
        default: "manual"
    },

    // ── Fatura Görüntüleme URL'si (QNB tarafından döndürülür) ────────────
    faturaURL: { type: String, default: "" },

    // ── QNB Yanıt Bilgileri ───────────────────────────────────────────────
    providerResponse: {
        resultCode: { type: String, default: "" },
        resultText: { type: String, default: "" },
        islemId: { type: String, default: "" },
        belgeOid: { type: String, default: "" },
        signedDocument: { type: Boolean, default: false },
        sovosCancelled: { type: Boolean, default: false },
        cancelCode: { type: String, default: "" },
    },

    // ── Hata Bilgisi ──────────────────────────────────────────────────────
    errorMessage: { type: String, default: "" },

    // ── QNB'nin atadığı gerçek fatura numarası (farklıysa) ──────────────
    qnbInvoiceNumber: { type: String, default: "" },

    // ── Not ───────────────────────────────────────────────────────────────
    note: { type: String, default: "" },

}, { timestamps: true });

// Compound index: bir siparişe birden fazla fatura kesilmesini önle
InvoiceSchema.index({ orderId: 1, profileId: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ uuid: 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);
