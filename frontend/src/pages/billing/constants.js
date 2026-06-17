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
        description: "QNB eSolutions ile e-Fatura, e-Arşiv, e-İrsaliye ve e-Defter işlemlerinizi yönetin. Türkiye'nin en büyük e-belge pazarında lider. Bağlantı uçları: connectortest / connector.qnbesolutions.com.tr (backend ile uyumlu).",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "Fatura Oluşturma", "Mükellef Sorgulama"],
        authType: "qnb",
        connectNote: "QNB portal kullanıcı adı ve şifreniz ile bağlanın. Test ortamında gerçek fatura kesilmez; canlıya geçmeden önce test faturası deneyin.",
        fieldGroups: [
            {
                title: "QNB Portal Girişi",
                subtitle: "eSolutions portalına giriş yaptığınız kullanıcı adı ve şifre",
                keys: ["username", "password"],
            },
        ],
        fields: [
            { key: "username", label: "Kullanıcı Adı", type: "text", required: true, placeholder: "VKN.portaltest veya portal kullanıcı adınız", hint: "QNB eSolutions portal giriş kullanıcı adınız" },
            { key: "password", label: "Şifre", type: "password", required: true, placeholder: "••••••••", hint: "Portal şifreniz — cihazınızda saklanmaz" },
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
        description: "Trendyol E-Faturam ile e-Fatura, e-Arşiv ve e-İrsaliye işlemlerinizi yönetin. Ortam adresleri backend (eInvoiceService) ile aynı: stage-apigateway.trendyolefaturam.com / apigateway.trendyolecozum.com.",
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
        description: "Sovos Bulut e-Fatura WS API v2.3 — Türkiye Fitbulut SOAP web servisi. Giden/gelen e-Fatura, e-Arşiv, e-İrsaliye, e-SMM, UBL gönderimi, zarf durumu ve mükellef sorgulama. Sovos portalından aldığınız web servis bilgileri ile bağlanın.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "e-SMM", "Giden Fatura", "Gelen Fatura", "Mükellef Sorgulama", "UBL Gönderimi"],
        authType: "sovos",
        fieldGroups: [
            {
                title: "Web Servis Kimliği",
                subtitle: "Sovos portal → Ayarlar → WS Kullanıcıları (portal e-postası değil)",
                keys: ["username", "password", "vknTckn"],
            },
            {
                title: "e-Fatura Etiketleri",
                subtitle: "Sovos → Ürün Ayarları → Etiket alanındaki urn:mail:... değerleri",
                keys: ["senderIdentifier", "receiverIdentifier"],
                optional: true,
            },
            {
                title: "e-Arşiv Ayarları",
                subtitle: "Yalnızca e-Arşiv veya şube bazlı kesim için",
                keys: ["branch", "faturaKodu"],
                optional: true,
            },
        ],
        fields: [
            { key: "username", label: "WS Kullanıcı Adı", type: "text", required: true, placeholder: "Sovos WS kullanıcısı", hint: "Portal → WS Kullanıcıları ekranından" },
            { key: "password", label: "WS Şifresi", type: "password", required: true, placeholder: "••••••••", hint: "Test ve canlı ortam şifreleri farklı olabilir" },
            { key: "vknTckn", label: "Firma VKN / TCKN", type: "text", required: true, placeholder: "10 veya 11 hane", hint: "Sovos kaydınızdaki vergi numarası ile aynı olmalı" },
            { key: "senderIdentifier", label: "GB Etiketi (e-Fatura)", type: "text", required: false, placeholder: "urn:mail:defaultgb@firma.com", hint: "e-Fatura için zorunlu. Yalnızca e-Arşiv → boş bırakın." },
            { key: "receiverIdentifier", label: "PK Etiketi (gelen)", type: "text", required: false, placeholder: "urn:mail:defaultpk@firma.com", hint: "Gelen e-Fatura listesi için" },
            { key: "branch", label: "e-Arşiv Şube", type: "text", required: false, placeholder: "default", hint: "Sovos portalındaki şube adı" },
            { key: "faturaKodu", label: "Seri Kodu", type: "text", required: false, placeholder: "LYS", hint: "Yerel fatura seri öneki (3 hane)" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "efaturawstest.fitbulut.com / earsivwstest.fitbulut.com" },
            { id: "production", label: "Canlı Ortam", url: "efaturaws.fitbulut.com / earsivws.fitbulut.com" },
        ],
        connectNote: "Aynı web servis kullanıcı/şifre ile e-Arşiv ve e-Fatura kullanılabilir. Yalnızca e-Arşiv lisansınız varsa GB etiketini boş bırakın; bağlantı otomatik olarak e-Arşiv servisine gider.",
        searchEndpoint: "/api/e-invoice/sovos/documents/search",
        capabilities: {
            createInvoice: true,
            createEArchive: true,
            createDespatch: true,
            createESmm: true,
            taxpayerQuery: true,
            downloadPdf: true,
            cancelInvoice: true,
            eArchiveReports: true,
        },
    },
    {
        id: "parasut",
        name: "Paraşüt",
        logo: "🪂",
        color: "#6366f1",
        description: "Paraşüt API v4 — OAuth 2.0 şifre akışı (apidocs.parasut.com). Base URL: https://api.parasut.com (backend parasutEInvoiceService ile uyumlu).",
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
            createDespatch: true,
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
        description: "Ödeal E-FaturaPos — docs.odeal.com. Kimlik: X-Service-Key. Test/Canlı kök adresleri backend odealEInvoiceService ile uyumlu (…/api/v1). Belge listesi işlem raporundan türetilir; sepet ve rapor API’leri ayrı uçlardadır.",
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
    { id: "e-invoice-out", label: "Giden e-Fatura", icon: "FaFileInvoice" },
    { id: "e-invoice-in", label: "Gelen e-Fatura", icon: "FaDownload" },
    { id: "e-despatch", label: "e-İrsaliye", icon: "FaTruck" },
    { id: "auto-invoice", label: "Otomatik Fatura", icon: "FaSyncAlt" },
    { id: "analysis", label: "Gelişmiş Analiz", icon: "FaChartBar" },
    { id: "providers", label: "Sağlayıcılar", icon: "FaLink" },
];

/** Sekme bazlı belge listesi başlıkları */
export const TAB_DOC_META = {
    invoices: {
        title: "Tüm Belgeler",
        description: "Bağlı sağlayıcıdan ve LysiaETIC kayıtlarından gelen tüm e-belgeler.",
        defaultCreateType: "e-arsiv",
    },
    "e-archive": {
        title: "e-Arşiv Faturaları",
        description: "Bireysel müşteri ve e-Fatura mükellefi olmayan alıcılara kesilen faturalar. VKN/TCKN girildiğinde mükellef değilse otomatik e-Arşiv önerilir.",
        tip: "Nihai tüketici için TCKN 11111111111 veya gerçek TCKN ile e-Arşiv kesilir.",
        emptyTitle: "e-Arşiv faturası bulunamadı",
        emptyDescription: "Henüz e-Arşiv kaydı yok. Yeni Belge ile manuel fatura oluşturabilir veya Otomatik Fatura sekmesinden pazaryeri siparişlerini faturalayabilirsiniz.",
        defaultCreateType: "e-arsiv",
    },
    "e-invoice-out": {
        title: "Giden e-Fatura",
        description: "Müşterilerinize kestiğiniz e-Fatura belgeleri (giden kutusu).",
        tip: "Kurumsal alıcı VKN'si ile Yeni Belge oluşturabilirsiniz.",
        emptyTitle: "Giden e-Fatura bulunamadı",
        emptyDescription: "Bu dönemde giden e-Fatura kaydı yok.",
        defaultCreateType: "e-fatura",
    },
    "e-invoice-in": {
        title: "Gelen e-Fatura",
        description: "Tedarikçilerden size gelen e-Fatura belgeleri (gelen kutusu). Sovos Yenile ile senkronize edilir.",
        tip: "Gelen faturalar salt okunurdur; kabul/red işlemleri sağlayıcı portalından yapılır.",
        emptyTitle: "Gelen e-Fatura bulunamadı",
        emptyDescription: "Gelen kutuda belge yok. Sovos bağlantısı ve PK etiketi ayarlarını kontrol edin.",
        defaultCreateType: "e-fatura-gelen",
        viewOnly: true,
    },
    "e-despatch": {
        title: "e-İrsaliye Belgeleri",
        description: "Giden e-İrsaliye kayıtları.",
        emptyTitle: "e-İrsaliye bulunamadı",
        emptyDescription: "Bağlı sağlayıcınızda e-İrsaliye kaydı bulunamadı.",
        defaultCreateType: "e-irsaliye",
    },
};

/* ═══════════════════════════════════════════════════════════
   BELGE TİPLERİ & DURUM HARİTALARI
   ═══════════════════════════════════════════════════════════ */
export const DOC_TYPES = {
    "e-arsiv": { color: "#00f0ff", label: "e-Arşiv" },
    "e-fatura": { color: "#ff8c00", label: "e-Fatura" },
    "e-fatura-gelen": { color: "#a855f7", label: "Gelen e-Fatura" },
    "e-irsaliye": { color: "#ff61d8", label: "e-İrsaliye" },
    "e-irsaliye-gelen": { color: "#ec4899", label: "Gelen e-İrsaliye" },
    "e-smm": { color: "#14b8a6", label: "e-SMM" },
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
    rejected: { color: "#ff3366", label: "Reddedildi" },
    accepted: { color: "#00ff88", label: "Kabul Edildi" },
};

/** Belge listesi API — sağlayıcıdan bağımsız route adları */
export const BILLING_DOCUMENTS_API = {
    list: "/auto-invoice/documents",
    preview: (documentId) => "/auto-invoice/documents/" + encodeURIComponent(documentId) + "/preview",
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
        { apiType: "incoming-despatch", localType: "e-irsaliye-gelen" },
        { apiType: "e-smm", localType: "e-smm" },
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

/** GB etiketi resmi Sovos formatında mı? (urn:mail:...) */
export const isValidSovosGbIdentifier = (identifier) => {
    const s = String(identifier || "").trim();
    if (!s) return false;
    return /^urn:mail:[^@\s]+@[^@\s]+$/i.test(s);
};

/** Sağlayıcı yeteneklerine göre belge tipleri (e-Arşiv-only Sovos → yalnızca e-Arşiv) */
export const getProviderDocTypes = (provider) => {
    if (!provider) return [];
    const authType = provider.authType || "trendyol";
    if (authType === "sovos") {
        const caps = provider.capabilities || {};
        const types = [];
        if (caps.earsiv !== false) {
            types.push({ apiType: "earchive", localType: "e-arsiv" });
        }
        const gb = String(provider.senderIdentifier || "").trim();
        const pk = String(provider.receiverIdentifier || "").trim();
        const canEfatura = caps.efatura === true && isValidSovosGbIdentifier(gb);
        if (canEfatura) {
            types.push({ apiType: "outgoing-einvoice", localType: "e-fatura" });
            if (caps.edespatch !== false) {
                types.push({ apiType: "despatch-advice", localType: "e-irsaliye" });
            }
        }
        if (canEfatura && pk) {
            types.push({ apiType: "incoming-einvoice", localType: "e-fatura-gelen" });
            if (caps.edespatch !== false) {
                types.push({ apiType: "incoming-despatch", localType: "e-irsaliye-gelen" });
            }
        }
        if (caps.earsiv !== false && caps.esmm !== false) {
            types.push({ apiType: "e-smm", localType: "e-smm" });
        }
        return types.length ? types : [{ apiType: "earchive", localType: "e-arsiv" }];
    }
    return PROVIDER_DOC_TYPES[authType] || PROVIDER_DOC_TYPES.trendyol;
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
    lines: [{ name: "", quantity: 1, unit: "Adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }],
    note: "",
    currency: "TRY",
    sendingType: "ELEKTRONIK",
};

export const UNIT_OPTIONS = ["Adet", "kg", "lt", "m", "m2", "paket", "kutu", "saat", "gun", "ay"];
export const VAT_RATES = [0, 1, 10, 20];

/* ═══════════════════════════════════════════════════════════
   PAZARYERI LİSTESİ (Otomatik Fatura)
   ═══════════════════════════════════════════════════════════ */
export const ALL_MARKETPLACES = ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon", "Amazon Türkiye", "Amazon Europe"];

/** Pazaryeri sipariş durumları — değer API kodu, etiket Türkçe */
export const TRIGGER_STATUS_OPTIONS = [
    { value: "Created", label: "Oluşturuldu" },
    { value: "Picking", label: "Toplanıyor" },
    { value: "Invoiced", label: "Faturalandı" },
    { value: "Shipped", label: "Kargoya verildi" },
    { value: "Delivered", label: "Teslim edildi" },
    { value: "New", label: "Yeni sipariş" },
    { value: "Approved", label: "Onaylandı" },
    { value: "Processing", label: "İşleniyor" },
    { value: "Packed", label: "Paketlendi" },
    { value: "ReadyToShip", label: "Kargoya hazır" },
    { value: "Completed", label: "Tamamlandı" },
    { value: "Yeni", label: "Yeni sipariş (TR)" },
    { value: "Hazırlanıyor", label: "Hazırlanıyor" },
    { value: "Onaylandı", label: "Onaylandı (TR)" },
    { value: "Kargoda", label: "Kargoda" },
    { value: "Kargoya Verildi", label: "Kargoya verildi (TR)" },
    { value: "Teslim Edildi", label: "Teslim edildi (TR)" },
    { value: "Tamamlandı", label: "Tamamlandı (TR)" },
];

export const ALL_TRIGGER_STATUSES = TRIGGER_STATUS_OPTIONS.map((o) => o.value);

export const getTriggerStatusLabel = (value) => {
    const row = TRIGGER_STATUS_OPTIONS.find((o) => o.value === value);
    return row ? row.label : value;
};

/** Belge tipi seçenekleri */
export const DOCUMENT_TYPE_OPTIONS = [
    { value: "EARSIVFATURA", label: "e-Arşiv Fatura", requiresEfatura: false },
    { value: "TICARIFATURA", label: "e-Fatura — Ticari Fatura", requiresEfatura: true },
    { value: "TEMELFATURA", label: "e-Fatura — Temel Fatura", requiresEfatura: true },
    { value: "IHRACAT", label: "e-Fatura — İhracat", requiresEfatura: true },
    { value: "YOLCUBERABERFATURA", label: "e-Fatura — Yolcu Beraber", requiresEfatura: true },
];

export const getDocumentTypeLabel = (value) => {
    const row = DOCUMENT_TYPE_OPTIONS.find((o) => o.value === value);
    return row ? row.label : value;
};

export const getSovosProfileLabel = (capabilities) => {
    if (!capabilities) return "Henüz doğrulanmadı";
    const parts = [];
    if (capabilities.efatura) parts.push("e-Fatura");
    if (capabilities.earsiv) parts.push("e-Arşiv");
    if (capabilities.edespatch === false) parts.push("e-İrsaliye kapalı");
    else if (capabilities.edespatch === true) parts.push("e-İrsaliye");
    if (capabilities.esmm === false) parts.push("e-SMM kapalı");
    else if (capabilities.esmm === true) parts.push("e-SMM");
    if (!parts.length) return "Henüz doğrulanmadı";
    return parts.join(" + ");
};

/** e-Arşiv fatura açıklama şablonları */
export const INVOICE_DESCRIPTION_TEMPLATES = [
    {
        id: "thanks",
        label: "Teşekkür",
        text: "Alışverişiniz için teşekkür ederiz. İyi günlerde kullanmanızı dileriz.",
    },
    {
        id: "order_ref",
        label: "Sipariş",
        text: "Bu fatura pazaryeri siparişinize istinaden düzenlenmiştir.",
    },
    {
        id: "payment",
        label: "Ödeme",
        text: "Ödeme ilgili pazaryeri üzerinden tahsil edilmiştir.",
    },
    {
        id: "return",
        label: "İade",
        text: "İade ve değişim işlemleri için 14 gün içinde müşteri hizmetlerimizle iletişime geçebilirsiniz.",
    },
    {
        id: "warranty",
        label: "Garanti",
        text: "Ürünlerimiz yasal garanti kapsamındadır.",
    },
    {
        id: "distance_sale",
        label: "Mesafeli satış",
        text: "6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamında mesafeli satış sözleşmesine istinaden düzenlenmiştir.",
    },
    {
        id: "contact",
        label: "İletişim",
        text: "Sorularınız için müşteri hizmetlerimizle iletişime geçebilirsiniz.",
    },
    {
        id: "e_archive",
        label: "e-Arşiv",
        text: "Bu belge 397 Seri No.lu VUK Genel Tebliği kapsamında elektronik ortamda düzenlenmiş e-Arşiv faturadır.",
    },
];

/** Otomatik fatura sağlayıcı etiketi */
export const getProviderDisplayName = (provider) => {
    if (provider === "sovos") return "Sovos";
    if (provider === "qnb") return "QNB eSolutions";
    return "E-Belge Sağlayıcı";
};
