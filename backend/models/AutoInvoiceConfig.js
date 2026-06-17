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
        enum: [
            "Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti",
            "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA",
            "eBay", "PttAVM", "Ozon", "Diğer"
        ]
    }],

    // Hangi sipariş durumlarında fatura kesilsin
    // Varsayılan: sadece kargoya verilmiş siparişler
    triggerStatuses: [{
        type: String,
        default: ["Shipped", "Delivered"]
    }],

    /**
     * Sipariş tarihinden kaç tam gün sonra otomatik kesim yapılsın (0 = gecikme yok).
     * Takvim günü — İstanbul yerel tarihine göre sipariş günü + N gün sonrası aşılmadan kesilmez.
     * Manuel / "Tümünü Faturala" bu gecikmeyi uygulamaz.
     */
    invoiceDelayDays: { type: Number, default: 0, min: 0, max: 90 },

    /**
     * Pazaryeri paneline fatura otomatik yükleme (API entegrasyonu hazır olunca).
     * Şu an yalnızca bayrak; kesim yine QNB'de yapılır.
     */
    autoUploadInvoiceToMarketplace: { type: Boolean, default: false },

    // ── Pazaryeri Bazlı Ayarlar ─────────────────────────────────────────
    // Her pazaryeri için ayrı KDV oranı, fatura notu vb. tanımlanabilir
    // Tanımlanmamışsa genel ayarlar (defaultVatRate, defaultNote) kullanılır
    marketplaceSettings: {
        type: Map,
        of: new mongoose.Schema({
            vatRate: { type: Number },           // Pazaryerine özel KDV oranı
            note: { type: String, default: "" }, // Pazaryerine özel fatura notu
            pricesIncludeVat: { type: Boolean },  // KDV dahil mi?
            invoiceSeriesCode: { type: String },  // Pazaryerine özel seri kodu
            /** Bu pazaryeri için gecikme (tanımsızsa invoiceDelayDays) */
            invoiceDelayDays: { type: Number, min: 0, max: 90 },
        }, { _id: false }),
        default: {}
    },

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
        vkn: { type: String, default: "11111111111" },
        name: { type: String, default: "" },
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        city: { type: String, default: "Istanbul" },
        district: { type: String, default: "Merkez" },
        country: { type: String, default: "Turkiye" },
    },

    // ── QNB Bağlantı Bilgileri ────────────────────────────────────────────
    // ⚠️ e-Arşiv ve e-Fatura FARKLI ortamlar — FARKLI credentials!
    //   Her kullanıcı QNB'den aldığı kullanıcı adı/şifreyi olduğu gibi girer.
    qnbCredentials: {
        // Eski alan (geriye uyumluluk — e-Fatura olarak kullanılır)
        username: { type: String, default: "" },
        password: { type: String, default: "" },
        // e-Arşiv ayrı credentials
        earsivUsername: { type: String, default: "" },
        earsivPassword: { type: String, default: "" },
        // e-Fatura ayrı credentials
        efaturaUsername: { type: String, default: "" },
        efaturaPassword: { type: String, default: "" },
        env: { type: String, enum: ["test", "production"], default: "test" },
    },

    // ── Sovos (Foriba) Bulut e-Fatura WS ───────────────────────────────────
    sovosCredentials: {
        username: { type: String, default: "" },
        password: { type: String, default: "" },
        vknTckn: { type: String, default: "" },
        senderIdentifier: { type: String, default: "" },
        receiverIdentifier: { type: String, default: "" },
        branch: { type: String, default: "default" },
        env: { type: String, enum: ["test", "production"], default: "test" },
        capabilities: {
            efatura: { type: Boolean, default: false },
            earsiv: { type: Boolean, default: false },
            edespatch: { type: Boolean, default: undefined },
            esmm: { type: Boolean, default: undefined },
        },
        verifiedAt: { type: Date },
    },

    // ── KDV Ayarları ──────────────────────────────────────────────────────
    defaultVatRate: { type: Number, default: 20 },

    // Pazaryeri fiyatları KDV dahil mi?
    // true  → Fiyat KDV dahildir, fatura keserken KDV ters hesaplanır
    //         Örn: 229,99 TL (KDV dahil) → KDV hariç: 191,66 + KDV: 38,33 = 229,99
    // false → Fiyat KDV hariçtir, üzerine KDV eklenir
    //         Örn: 229,99 TL (KDV hariç) → KDV hariç: 229,99 + KDV: 46,00 = 275,99
    // Türkiye'deki pazaryerlerinde fiyatlar genelde KDV DAHİLDİR!
    pricesIncludeVat: { type: Boolean, default: true },

    // ── Fatura Notu ───────────────────────────────────────────────────────
    defaultNote: { type: String, default: "" },

    // ── e-Arşiv Görsel/Açıklama Ayarları ─────────────────────────────────
    // Not: Resmi Foriba örneğinde logo/imza zorunlu alan değildir.
    // Bu alanlar XSLT/önizleme şablonlarında kullanılmak üzere opsiyoneldir.
    eArchiveVisuals: {
        logoUrl: { type: String, default: "" },
        signatureUrl: { type: String, default: "" },
        signatureName: { type: String, default: "" },
        invoiceDescription: { type: String, default: "" },
    },

    // ── Otomatik Fatura Başlangıç Tarihi ──────────────────────────────────
    // Bu tarihten ÖNCE oluşan siparişler otomatik faturalanmaz.
    // Kullanıcı sistemi aktif ettiğinde set edilir — daha önce manuel
    // kesilmiş faturaların mükerrer kesilmesini engeller.
    // Kullanıcı ayarlardan değiştirebilir.
    autoInvoiceStartDate: { type: Date },

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
