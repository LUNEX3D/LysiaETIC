/**
 * AutoInvoiceConfig Model — LysiaETIC
 *
 * Kullanıcı bazlı otomatik fatura kesme ayarları.
 * Pazaryerinden sipariş sync edildiğinde, bu ayarlara göre
 * otomatik e-Arşiv / e-Fatura kesilir.
 *
 * Her kullanıcının tek bir config kaydı olur.
 */
const mongoose = require("mongoose");

const AutoInvoiceConfigSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },

    // ── Genel Ayarlar ─────────────────────────────────────────────────────
    enabled: { type: Boolean, default: false },

    // Hangi e-fatura sağlayıcısı kullanılacak
    provider: {
        type: String,
        enum: ["qnb", "trendyol", "sovos", "parasut", "odeal"],
        default: "qnb"
    },

    // Hangi pazaryerlerinde otomatik fatura kesilsin
    // Boş array = tümü aktif
    enabledMarketplaces: [{
        type: String,
        enum: ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA"]
    }],

    // Hangi sipariş durumlarında fatura kesilsin
    // Varsayılan: sadece kargoya verilmiş siparişler
    triggerStatuses: [{
        type: String,
        default: ["Shipped", "Delivered"]
    }],

    // ── Belge Ayarları ────────────────────────────────────────────────────
    documentType: {
        type: String,
        enum: ["EARSIVFATURA", "TICARIFATURA", "TEMELFATURA"],
        default: "EARSIVFATURA"
    },

    invoiceTypeCode: {
        type: String,
        enum: ["SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH", "IHRACKAYITLI"],
        default: "SATIS"
    },

    // Fatura seri kodu (QNB faturaNoUret için)
    invoiceSeriesCode: { type: String, default: "LYS" },

    currency: { type: String, default: "TRY" },

    // Gönderim şekli (e-Arşiv için)
    sendingType: {
        type: String,
        enum: ["ELEKTRONIK", "KAGIT"],
        default: "ELEKTRONIK"
    },

    // ── Satıcı (Firma) Bilgileri ──────────────────────────────────────────
    // Faturadaki satıcı bilgileri — kullanıcının kendi firma bilgileri
    supplier: {
        vkn: { type: String, default: "" },          // VKN veya TCKN
        name: { type: String, default: "" },          // Firma adı
        taxOffice: { type: String, default: "" },     // Vergi dairesi
        street: { type: String, default: "" },        // Adres
        district: { type: String, default: "" },      // İlçe
        city: { type: String, default: "" },          // İl
        country: { type: String, default: "Turkiye" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
        firstName: { type: String, default: "" },     // TCKN ise ad
        lastName: { type: String, default: "" },      // TCKN ise soyad
    },

    // ── Alıcı Varsayılan Bilgileri ───────────────────────────────────────
    // Pazaryeri siparişlerinde müşteri bilgisi genelde sınırlıdır
    // Bu alanlar, müşteri bilgisi eksik olduğunda kullanılır
    // Pazaryeri siparişlerinde müşteri VKN/TCKN bilgisi genelde gelmez
    // Kullanıcı kendi varsayılan alıcı bilgisini tanımlamalıdır
    // NOT: QNB "Nihai Tüketici" adını kabul etmez — gerçek bir isim gerekir
    defaultCustomer: {
        vkn: { type: String, default: "12345678901" },
        name: { type: String, default: "" },
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        city: { type: String, default: "Istanbul" },
        district: { type: String, default: "Merkez" },
        country: { type: String, default: "Turkiye" },
    },

    // ── QNB Bağlantı Bilgileri ────────────────────────────────────────────
    // QNB oturum bilgileri (her seferinde login yapılır veya cache'lenir)
    qnbCredentials: {
        username: { type: String, default: "" },
        password: { type: String, default: "" },
        env: { type: String, enum: ["test", "production"], default: "test" },
    },

    // ── KDV Ayarları ──────────────────────────────────────────────────────
    defaultVatRate: { type: Number, default: 20 },

    // ── Fatura Notu ───────────────────────────────────────────────────────
    defaultNote: { type: String, default: "" },

    // ── İstatistikler ─────────────────────────────────────────────────────
    stats: {
        totalInvoicesCreated: { type: Number, default: 0 },
        lastInvoiceDate: { type: Date },
        lastError: { type: String, default: "" },
        lastErrorDate: { type: Date },
        consecutiveErrors: { type: Number, default: 0 },
    },

}, { timestamps: true });

module.exports = mongoose.model("AutoInvoiceConfig", AutoInvoiceConfigSchema);
