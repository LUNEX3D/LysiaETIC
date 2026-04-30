/**
 * Faturalandırma Modülü — Sabitler
 * LysiaETIC
 */

/* ═══════════════════════════════════════════════════════════
   E-FATURA SAĞLAYICI TANIMLARI
   ═══════════════════════════════════════════════════════════ */
export const PROVIDERS = [
    {
        id: "qnb-esolutions",
        name: "QNB eSolutions",
        logo: "🏦",
        color: "#7c3aed",
        description: "QNB eSolutions ile e-Fatura, e-Arşiv, e-İrsaliye ve e-Defter işlemlerinizi yönetin. Türkiye'nin en büyük e-belge pazarında lider.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "Fatura Oluşturma", "Mükellef Sorgulama"],
        authType: "qnb",
        fields: [
            { key: "username", label: "Kullanıcı Adı", type: "text", required: true, hint: "QNB eSolutions kullanıcı adınız" },
            { key: "password", label: "Şifre", type: "password", required: true, hint: "QNB eSolutions şifreniz" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "connectortest.qnbesolutions.com.tr" },
            { id: "production", label: "Canlı Ortam", url: "connector.qnbesolutions.com.tr" },
        ],
        searchEndpoint: "/api/e-invoice/qnb/documents/search",
        capabilities: {
            createInvoice: true,
            createEArchive: true,
            createDespatch: true,
            taxpayerQuery: true,
            downloadPdf: true,
            cancelInvoice: true,
        },
    },
    {
        id: "trendyol-efaturam",
        name: "Trendyol E-Faturam",
        logo: "🛍️",
        color: "#f27a1a",
        description: "Trendyol E-Faturam ile e-Fatura, e-Arşiv ve e-İrsaliye işlemlerinizi yönetin.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "Mükellef Sorgulama"],
        authType: "trendyol",
        fields: [
            { key: "username", label: "Partner Kullanıcı Adı", type: "text", required: true, hint: "Trendyol E-Faturam partner hesabınız" },
            { key: "password", label: "Partner Şifre", type: "password", required: true, hint: "Partner hesap şifreniz" },
            { key: "customerUsername", label: "Müşteri Kullanıcı Adı", type: "text", required: true, hint: "Firma e-Fatura kullanıcı adı" },
            { key: "customerPassword", label: "Müşteri Şifre", type: "password", required: true, hint: "Firma e-Fatura şifresi" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "stage-apigateway.trendyolefaturam.com" },
            { id: "production", label: "Canlı Ortam", url: "apigateway.trendyolecozum.com" },
        ],
        searchEndpoint: "/api/e-invoice/trendyol/documents/search",
        capabilities: {
            createInvoice: true,
            createEArchive: true,
            createDespatch: true,
            taxpayerQuery: true,
            downloadPdf: false,
            cancelInvoice: true,
        },
    },
    {
        id: "sovos",
        name: "Sovos (Foriba)",
        logo: "🌐",
        color: "#10b981",
        description: "Sovos (eski Foriba) ile global e-Fatura, e-Arşiv ve e-İrsaliye entegrasyonu. OAuth 2.0 tabanlı güvenli API.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "e-Defter", "Global Uyum"],
        authType: "sovos",
        fields: [
            { key: "apiKey", label: "API Key", type: "text", required: true, hint: "Sovos Developer Hub'dan aldığınız API Key" },
            { key: "apiSecret", label: "API Secret", type: "password", required: true, hint: "Sovos Developer Hub'dan aldığınız Secret" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "api-test.sovos.com" },
            { id: "production", label: "Canlı Ortam", url: "api.sovos.com" },
        ],
        searchEndpoint: "/api/e-invoice/sovos/documents/search",
        capabilities: {
            createInvoice: true,
            createEArchive: true,
            createDespatch: true,
            taxpayerQuery: false,
            downloadPdf: true,
            cancelInvoice: false,
        },
    },
    {
        id: "parasut",
        name: "Paraşüt",
        logo: "🪂",
        color: "#6366f1",
        description: "Paraşüt ile muhasebe, e-Fatura, e-Arşiv ve e-SMM entegrasyonu. OAuth 2.0 tabanlı güvenli API.",
        features: ["e-Fatura", "e-Arşiv", "e-SMM", "Muhasebe", "Stok Yönetimi"],
        authType: "parasut",
        fields: [
            { key: "clientId", label: "Client ID", type: "text", required: true, hint: "Paraşüt'ten aldığınız Client ID" },
            { key: "clientSecret", label: "Client Secret", type: "password", required: true, hint: "Paraşüt'ten aldığınız Client Secret" },
            { key: "email", label: "E-posta", type: "email", required: true, hint: "Paraşüt hesap e-posta adresiniz" },
            { key: "password", label: "Şifre", type: "password", required: true, hint: "Paraşüt hesap şifreniz" },
        ],
        environments: [
            { id: "production", label: "Canlı Ortam", url: "api.parasut.com" },
        ],
        searchEndpoint: "/api/e-invoice/parasut/documents/search",
        capabilities: {
            createInvoice: true,
            createEArchive: true,
            createDespatch: false,
            taxpayerQuery: true,
            downloadPdf: true,
            cancelInvoice: false,
        },
    },
    {
        id: "odeal",
        name: "Ödeal E-FaturaPos",
        logo: "💳",
        color: "#e11d48",
        description: "Ödeal E-FaturaPos ile VUK 507 uyumlu e-Fatura, e-Arşiv ve ödeme entegrasyonu.",
        features: ["e-Fatura", "e-Arşiv", "Sepet Yönetimi", "Raporlama", "Webhook"],
        authType: "odeal",
        fields: [
            { key: "serviceKey", label: "Servis Anahtarı", type: "password", required: true, hint: "Ödeal'dan aldığınız Service Key" },
            { key: "merchantKey", label: "Merchant Key (İşyeri Anahtarı)", type: "password", required: false, hint: "İşyeri tanımlama anahtarı (opsiyonel)" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "stage.odealapp.com" },
            { id: "production", label: "Canlı Ortam", url: "api.odeal.com" },
        ],
        searchEndpoint: "/api/e-invoice/odeal/documents/search",
        capabilities: {
            createInvoice: false,
            createEArchive: false,
            createDespatch: false,
            taxpayerQuery: false,
            downloadPdf: false,
            cancelInvoice: false,
        },
    },
];

/* ═══════════════════════════════════════════════════════════
   SEKME TANIMLARI
   ═══════════════════════════════════════════════════════════ */
export const TABS = [
    { id: "overview", label: "Genel Bakış", icon: "FaFileInvoiceDollar" },
    { id: "invoices", label: "Tüm Belgeler", icon: "FaFileInvoice" },
    { id: "e-archive", label: "e-Arşiv", icon: "FaClipboardList" },
    { id: "e-invoice", label: "e-Fatura", icon: "FaFileInvoiceDollar" },
    { id: "e-despatch", label: "e-İrsaliye", icon: "FaTruck" },
    { id: "auto-invoice", label: "Otomatik Fatura", icon: "FaSyncAlt" },
    { id: "analysis", label: "Gelişmiş Analiz", icon: "FaChartBar" },
    { id: "providers", label: "Sağlayıcılar", icon: "FaLink" },
];

/* ═══════════════════════════════════════════════════════════
   BELGE TİPLERİ & DURUM HARİTALARI
   ═══════════════════════════════════════════════════════════ */
export const DOC_TYPES = {
    "e-arsiv": { color: "#00f0ff", label: "e-Arşiv" },
    "e-fatura": { color: "#ff8c00", label: "e-Fatura" },
    "e-fatura-gelen": { color: "#a855f7", label: "Gelen e-Fatura" },
    "e-irsaliye": { color: "#ff61d8", label: "e-İrsaliye" },
};

export const STATUS_MAP = {
    approved: { color: "#00ff88", label: "Onaylandı" },
    succeed: { color: "#00ff88", label: "Başarılı" },
    completed: { color: "#00ff88", label: "Tamamlandı" },
    created: { color: "#00ff88", label: "Oluşturuldu" },
    sent: { color: "#3b82f6", label: "Gönderildi" },
    waiting: { color: "#ffcc00", label: "Beklemede" },
    pending: { color: "#ffcc00", label: "Beklemede" },
    queued: { color: "#ffcc00", label: "Sırada" },
    cancelled: { color: "#ff3366", label: "İptal" },
    failed: { color: "#ff3366", label: "Başarısız" },
    error: { color: "#ff3366", label: "Hata" },
    received: { color: "#a855f7", label: "Alındı" },
    draft: { color: "#4a5568", label: "Taslak" },
};

/* ═══════════════════════════════════════════════════════════
   SAĞLAYICI BAZLI BELGE TİPLERİ
   ═══════════════════════════════════════════════════════════ */
export const PROVIDER_DOC_TYPES = {
    qnb: [
        { apiType: "earchive", localType: "e-arsiv" },
        // e-Fatura/e-İrsaliye: ayrı credentials gerekir
    ],
    trendyol: [
        { apiType: "earchive", localType: "e-arsiv" },
        { apiType: "outgoing-einvoice", localType: "e-fatura" },
        { apiType: "incoming-einvoice", localType: "e-fatura-gelen" },
        { apiType: "despatch-advice", localType: "e-irsaliye" },
    ],
    sovos: [
        { apiType: "earchive", localType: "e-arsiv" },
        { apiType: "outgoing-einvoice", localType: "e-fatura" },
        { apiType: "incoming-einvoice", localType: "e-fatura-gelen" },
        { apiType: "despatch-advice", localType: "e-irsaliye" },
    ],
    parasut: [
        { apiType: "earchive", localType: "e-arsiv" },
        { apiType: "outgoing-einvoice", localType: "e-fatura" },
        { apiType: "incoming-einvoice", localType: "e-fatura-gelen" },
        { apiType: "despatch-advice", localType: "e-irsaliye" },
    ],
    odeal: [
        { apiType: "earchive", localType: "e-arsiv" },
        { apiType: "outgoing-einvoice", localType: "e-fatura" },
        { apiType: "incoming-einvoice", localType: "e-fatura-gelen" },
    ],
};

/* ═══════════════════════════════════════════════════════════
   VARSAYILAN FATURA FORMU
   ═══════════════════════════════════════════════════════════ */
export const DEFAULT_INVOICE_FORM = {
    customerName: "",
    customerVkn: "",
    customerFirstName: "",
    customerLastName: "",
    customerStreet: "",
    customerDistrict: "",
    customerCity: "Istanbul",
    customerTaxOffice: "",
    customerEmail: "",
    customerPhone: "",
    lines: [{ name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }],
    note: "",
    currency: "TRY",
    sendingType: "ELEKTRONIK",
};

export const UNIT_OPTIONS = ["adet", "kg", "lt", "m", "m2", "paket", "kutu", "saat", "gun", "ay"];
export const VAT_RATES = [0, 1, 10, 20];

/* ═══════════════════════════════════════════════════════════
   PAZARYERI LİSTESİ (Otomatik Fatura)
   ═══════════════════════════════════════════════════════════ */
export const ALL_MARKETPLACES = ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon", "Amazon Türkiye", "Amazon Europe"];
export const ALL_TRIGGER_STATUSES = [
    "Created", "Picking", "Shipped", "Delivered", "Invoiced",
    "New", "Approved", "Processing", "Packed", "ReadyToShip",
    "Completed", "Yeni", "Hazırlanıyor", "Onaylandı", "Kargoda",
    "Kargoya Verildi", "Teslim Edildi", "Tamamlandı",
];
