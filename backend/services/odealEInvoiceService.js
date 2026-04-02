const axios = require("axios");
const logger = require("../config/logger");

/**
 * ÖDEAL E-FATURAPOS API SERVİSİ — LysiaETIC
 *
 * Ödeal E-FaturaPos ve SadePos entegrasyonu.
 * API Docs: https://docs.odeal.com/entegrasyon/tr/guide/welcome
 *
 * Auth: Service Key (X-Service-Key header)
 *   - Ödeal'dan alınan servis anahtarı ile kimlik doğrulama
 *   - Merchant Key ile işyeri tanımlama
 *
 * Base URL:
 *   - Test:  https://stage.odealapp.com/api/v1
 *   - Prod:  https://api.odeal.com/api/v1
 *
 * Özellikler:
 *   - VUK 507 uyumlu e-belge oluşturma
 *   - e-Fatura & e-Arşiv otomatik oluşturma
 *   - Sepet yönetimi (SIMPLE, ADVANCE, CURRENT_ACCOUNT, FOOD_CARD)
 *   - İşlem raporlama ve sorgulama
 *   - Webhook (callback) bildirimleri
 *   - Birim servisi (adet, kg, lt vb.)
 */

// ═══════════════════════════════════════════════════════════════════════════
//  ORTAM AYARLARI
// ═══════════════════════════════════════════════════════════════════════════

const ENVIRONMENTS = {
    test: "https://stage.odealapp.com/api/v1",
    production: "https://api.odeal.com/api/v1",
};

const getBaseUrl = (env) => ENVIRONMENTS[env] || ENVIRONMENTS.test;

// ═══════════════════════════════════════════════════════════════════════════
//  YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ödeal API isteği gönder
 * @param {Object} opts
 * @param {string} opts.method - HTTP metodu (GET, POST, PUT, DELETE)
 * @param {string} opts.url - Tam URL
 * @param {string} opts.serviceKey - Ödeal Servis Anahtarı
 * @param {string} [opts.merchantKey] - İşyeri Anahtarı
 * @param {Object} [opts.data] - Request body
 * @param {Object} [opts.params] - Query parametreleri
 * @returns {Object} { success, data, status, error }
 */
const makeRequest = async ({ method, url, serviceKey, merchantKey, data, params }) => {
    try {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        if (serviceKey) {
            headers["X-Service-Key"] = serviceKey;
        }
        if (merchantKey) {
            headers["X-Merchant-Key"] = merchantKey;
        }

        const response = await axios({
            method,
            url,
            headers,
            data,
            params,
            timeout: 30000,
        });

        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const errData = error.response ? error.response.data : null;
        const errMsg = errData
            ? (errData.message || errData.error || errData.errorMessage || JSON.stringify(errData))
            : error.message;

        logger.error("[Odeal Service] API Hatası: " + method.toUpperCase() + " " + url + " → " + status + " " + errMsg);

        return {
            success: false,
            error: errMsg,
            status,
            data: errData,
        };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  1. KİMLİK DOĞRULAMA (Service Key Validation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Servis anahtarını doğrula — Ödeal API'ye basit bir istek atarak anahtarın geçerli olduğunu kontrol eder
 * @param {Object} params
 * @param {string} params.serviceKey - Ödeal Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {string} [params.env] - Ortam (test/production)
 * @returns {Object} { success, serviceKey, merchantKey, env }
 */
const validateServiceKey = async ({ serviceKey, merchantKey, env = "test" }) => {
    logger.info("[Odeal] Servis anahtarı doğrulanıyor, ortam: " + env);

    if (!serviceKey) {
        return { success: false, error: "Servis anahtarı gerekli", status: 400 };
    }

    const baseUrl = getBaseUrl(env);

    // Birim servisine istek atarak anahtarı doğrula
    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/units",
        serviceKey,
        merchantKey,
    });

    if (!result.success) {
        logger.error("[Odeal] Servis anahtarı doğrulama başarısız: " + result.error);
        return {
            success: false,
            error: "Servis anahtarı doğrulanamadı: " + result.error,
            status: result.status,
        };
    }

    logger.info("[Odeal] Servis anahtarı doğrulandı ✓");

    return {
        success: true,
        serviceKey,
        merchantKey: merchantKey || null,
        env,
        units: result.data, // Birim listesi bonus olarak döner
    };
};

// ═══════════════════════════════════════════════════════════════════════════
//  2. BİRİM SERVİSİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ürün birimlerini listele (adet, kg, lt vb.)
 * GET /api/v1/units
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const getUnits = async ({ serviceKey, merchantKey, env = "test" }) => {
    logger.info("[Odeal] Birim listesi çekiliyor");

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/units",
        serviceKey,
        merchantKey,
    });

    if (!result.success) {
        return { success: false, error: "Birim listesi alınamadı: " + result.error, status: result.status };
    }

    logger.info("[Odeal] Birim listesi alındı ✓");
    return { success: true, data: result.data };
};

// ═══════════════════════════════════════════════════════════════════════════
//  3. SEPET SERVİSİ (Basket)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sepet oluştur — E-FaturaPos ve SadePos için ana servis
 * POST /api/v1/basket
 *
 * Sepet Türleri:
 *   - SIMPLE: Standart ürün satışı
 *   - ADVANCE: Avans tahsilatı
 *   - CURRENT_ACCOUNT: Cari hesap
 *   - FOOD_CARD: Yemek kartı
 *
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {Object} params.basketData - Sepet verisi
 * @param {string} params.basketData.basketType - Sepet türü (SIMPLE, ADVANCE, CURRENT_ACCOUNT, FOOD_CARD)
 * @param {Array} params.basketData.items - Sepet kalemleri
 * @param {Object} [params.basketData.customer] - Müşteri bilgileri
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const createBasket = async ({ serviceKey, merchantKey, basketData, env = "test" }) => {
    logger.info("[Odeal] Sepet oluşturuluyor, tür: " + (basketData.basketType || "SIMPLE"));

    if (!basketData || !basketData.items || basketData.items.length === 0) {
        return { success: false, error: "Sepet kalemleri gerekli", status: 400 };
    }

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "POST",
        url: baseUrl + "/basket",
        serviceKey,
        merchantKey,
        data: basketData,
    });

    if (!result.success) {
        return { success: false, error: "Sepet oluşturulamadı: " + result.error, status: result.status };
    }

    logger.info("[Odeal] Sepet oluşturuldu ✓ ID: " + (result.data.basketId || result.data.id || "N/A"));
    return { success: true, data: result.data };
};

/**
 * Sepet listele
 * GET /api/v1/basket
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {Object} [params.filters] - Filtreler
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const listBaskets = async ({ serviceKey, merchantKey, filters, env = "test" }) => {
    logger.info("[Odeal] Sepetler listeleniyor");

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/basket",
        serviceKey,
        merchantKey,
        params: filters || {},
    });

    if (!result.success) {
        return { success: false, error: "Sepet listesi alınamadı: " + result.error, status: result.status };
    }

    logger.info("[Odeal] Sepet listesi alındı ✓ Adet: " + (Array.isArray(result.data) ? result.data.length : "N/A"));
    return { success: true, data: result.data };
};

/**
 * Sepet sil
 * DELETE /api/v1/basket/:basketId
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {string} params.basketId - Sepet ID
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success }
 */
const deleteBasket = async ({ serviceKey, merchantKey, basketId, env = "test" }) => {
    logger.info("[Odeal] Sepet siliniyor: " + basketId);

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "DELETE",
        url: baseUrl + "/basket/" + basketId,
        serviceKey,
        merchantKey,
    });

    if (!result.success) {
        return { success: false, error: "Sepet silinemedi: " + result.error, status: result.status };
    }

    logger.info("[Odeal] Sepet silindi ✓");
    return { success: true, data: result.data };
};

// ═══════════════════════════════════════════════════════════════════════════
//  4. KONFİGÜRASYON SERVİSİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Entegrasyon konfigürasyonu kaydet
 * POST /api/v1/configuration
 *
 * Callback URL'leri ve webhook ayarlarını kaydeder.
 *
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {Object} params.configData - Konfigürasyon verisi
 * @param {string} [params.configData.callbackUrl] - Callback URL
 * @param {string} [params.configData.webhookSecret] - Webhook secret
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const saveConfiguration = async ({ serviceKey, merchantKey, configData, env = "test" }) => {
    logger.info("[Odeal] Konfigürasyon kaydediliyor");

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "POST",
        url: baseUrl + "/configuration",
        serviceKey,
        merchantKey,
        data: configData,
    });

    if (!result.success) {
        return { success: false, error: "Konfigürasyon kaydedilemedi: " + result.error, status: result.status };
    }

    logger.info("[Odeal] Konfigürasyon kaydedildi ✓");
    return { success: true, data: result.data };
};

// ═══════════════════════════════════════════════════════════════════════════
//  5. RAPOR SERVİSİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * İşlem raporlarını sorgula
 * GET /api/v1/report/transactions
 *
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {Object} [params.filters] - Filtreler
 * @param {string} [params.filters.startDate] - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} [params.filters.endDate] - Bitiş tarihi (YYYY-MM-DD)
 * @param {string} [params.filters.transactionType] - İşlem tipi
 * @param {string} [params.filters.status] - Belge durumu
 * @param {number} [params.filters.minAmount] - Minimum tutar
 * @param {number} [params.filters.maxAmount] - Maksimum tutar
 * @param {number} [params.page] - Sayfa numarası
 * @param {number} [params.pageSize] - Sayfa boyutu
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const getTransactionReport = async ({ serviceKey, merchantKey, filters, page, pageSize, env = "test" }) => {
    logger.info("[Odeal] İşlem raporu sorgulanıyor");

    const baseUrl = getBaseUrl(env);
    const queryParams = { ...(filters || {}) };
    if (page) queryParams.page = page;
    if (pageSize) queryParams.pageSize = pageSize;

    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/report/transactions",
        serviceKey,
        merchantKey,
        params: queryParams,
    });

    if (!result.success) {
        return { success: false, error: "Rapor alınamadı: " + result.error, status: result.status };
    }

    logger.info("[Odeal] İşlem raporu alındı ✓");
    return { success: true, data: result.data };
};

// ═══════════════════════════════════════════════════════════════════════════
//  6. BELGE ARAMA (searchDocuments — Diğer sağlayıcılarla uyumlu)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Belge arama — BillingPage'in fetchAllDocuments fonksiyonuyla uyumlu
 *
 * Diğer sağlayıcılarla aynı arayüzü sağlar:
 *   - documentType: earchive, outgoing-einvoice, incoming-einvoice, despatch-advice
 *   - searchParams: tarih aralığı, durum vb.
 *
 * Ödeal'da tüm belgeler rapor servisi üzerinden gelir.
 * Bu fonksiyon rapor verisini normalize ederek döner.
 *
 * @param {Object} params
 * @param {string} params.token - Servis Anahtarı (serviceKey olarak kullanılır)
 * @param {Object} [params.searchParams] - Arama parametreleri
 * @param {string} [params.documentType] - Belge tipi
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const searchDocuments = async ({ token, searchParams, documentType, env = "test" }) => {
    logger.info("[Odeal] Belge arama: " + (documentType || "tümü") + ", ortam: " + env);

    const serviceKey = token; // Frontend'den gelen token aslında serviceKey

    // Tarih filtresi oluştur (varsayılan: son 90 gün)
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const filters = {
        startDate: (searchParams && searchParams.startDate) || defaultStart.toISOString().split("T")[0],
        endDate: (searchParams && searchParams.endDate) || now.toISOString().split("T")[0],
    };

    // Belge tipi filtresi
    if (documentType) {
        const typeMap = {
            "earchive": "E_ARCHIVE",
            "outgoing-einvoice": "E_INVOICE",
            "incoming-einvoice": "E_INVOICE_INCOMING",
            "despatch-advice": "E_DESPATCH",
        };
        if (typeMap[documentType]) {
            filters.documentType = typeMap[documentType];
        }
    }

    if (searchParams && searchParams.status) {
        filters.status = searchParams.status;
    }

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/report/transactions",
        serviceKey,
        params: filters,
    });

    if (!result.success) {
        logger.warn("[Odeal] Belge arama başarısız: " + result.error);
        return { success: true, data: [] }; // Hata durumunda boş dizi dön (diğer sağlayıcılarla uyumlu)
    }

    // Veriyi normalize et
    const rawData = result.data;
    const transactions = Array.isArray(rawData)
        ? rawData
        : (rawData.transactions || rawData.items || rawData.content || rawData.data || []);

    const normalized = transactions.map((tx, idx) => {
        // Ödeal belge tipini LysiaETIC formatına çevir
        let localType = "e-arsiv"; // varsayılan
        const txType = (tx.documentType || tx.type || tx.transactionType || "").toUpperCase();
        if (txType.includes("INVOICE") && txType.includes("INCOMING")) {
            localType = "e-fatura-gelen";
        } else if (txType.includes("INVOICE") || txType === "E_INVOICE") {
            localType = "e-fatura";
        } else if (txType.includes("DESPATCH") || txType.includes("IRSALIYE")) {
            localType = "e-irsaliye";
        } else if (txType.includes("ARCHIVE") || txType === "E_ARCHIVE") {
            localType = "e-arsiv";
        }

        // Durum normalize
        let localStatus = (tx.status || tx.documentStatus || tx.state || "").toLowerCase();
        const statusMap = {
            "success": "approved",
            "successful": "approved",
            "completed": "approved",
            "approved": "approved",
            "pending": "pending",
            "waiting": "waiting",
            "processing": "pending",
            "cancelled": "cancelled",
            "canceled": "cancelled",
            "failed": "failed",
            "error": "failed",
            "refunded": "cancelled",
        };
        localStatus = statusMap[localStatus] || localStatus || "pending";

        return {
            id: tx.id || tx.transactionId || tx.referenceId || tx.uuid || ("odeal-" + documentType + "-" + idx),
            type: localType,
            number: tx.invoiceNumber || tx.documentNumber || tx.receiptNumber || tx.referenceNumber || tx.number || "",
            date: tx.transactionDate || tx.date || tx.createdAt || tx.invoiceDate || "",
            customer: tx.customerName || tx.receiverName || tx.merchantName || tx.title || "",
            vkn: tx.taxNumber || tx.vkn || tx.tckn || tx.receiverTaxNumber || "",
            amount: Number(tx.amount || tx.subtotal || tx.netAmount || 0),
            tax: Number(tx.taxAmount || tx.vatAmount || tx.kdv || 0),
            total: Number(tx.totalAmount || tx.total || tx.grandTotal || tx.payableAmount || tx.amount || 0),
            status: localStatus,
            currency: tx.currency || tx.currencyCode || "TRY",
            provider: "odeal",
            raw: tx,
        };
    });

    logger.info("[Odeal] Belge arama tamamlandı ✓ " + normalized.length + " belge bulundu");
    return { success: true, data: normalized };
};

// ═══════════════════════════════════════════════════════════════════════════
//  7. WEBHOOK CALLBACK DOĞRULAMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Webhook callback verisini doğrula ve işle
 *
 * Ödeal, ödeme/iptal/iade ve e-fatura olaylarını callback URL'ye POST eder.
 *
 * @param {Object} params
 * @param {Object} params.payload - Callback verisi
 * @param {string} [params.webhookSecret] - Webhook secret (doğrulama için)
 * @returns {Object} { success, event, data }
 */
const processCallback = async ({ payload, webhookSecret }) => {
    logger.info("[Odeal] Webhook callback işleniyor");

    if (!payload) {
        return { success: false, error: "Callback verisi boş" };
    }

    // Event tipini belirle
    const eventType = payload.eventType || payload.event || payload.type || "unknown";
    const transactionId = payload.transactionId || payload.id || payload.referenceId || null;

    logger.info("[Odeal] Callback event: " + eventType + ", txId: " + transactionId);

    return {
        success: true,
        event: eventType,
        transactionId,
        data: payload,
    };
};

// ═══════════════════════════════════════════════════════════════════════════
//  8. İŞLEM DETAYI SORGULAMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tek bir işlemin detayını sorgula
 * GET /api/v1/report/transactions/:transactionId
 *
 * @param {Object} params
 * @param {string} params.serviceKey - Servis Anahtarı
 * @param {string} [params.merchantKey] - İşyeri Anahtarı
 * @param {string} params.transactionId - İşlem ID
 * @param {string} [params.env] - Ortam
 * @returns {Object} { success, data }
 */
const getTransactionDetail = async ({ serviceKey, merchantKey, transactionId, env = "test" }) => {
    logger.info("[Odeal] İşlem detayı sorgulanıyor: " + transactionId);

    const baseUrl = getBaseUrl(env);
    const result = await makeRequest({
        method: "GET",
        url: baseUrl + "/report/transactions/" + transactionId,
        serviceKey,
        merchantKey,
    });

    if (!result.success) {
        return { success: false, error: "İşlem detayı alınamadı: " + result.error, status: result.status };
    }

    logger.info("[Odeal] İşlem detayı alındı ✓");
    return { success: true, data: result.data };
};

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    // Auth
    validateServiceKey,

    // Birim
    getUnits,

    // Sepet
    createBasket,
    listBaskets,
    deleteBasket,

    // Konfigürasyon
    saveConfiguration,

    // Rapor
    getTransactionReport,
    getTransactionDetail,

    // Belge Arama (BillingPage uyumlu)
    searchDocuments,

    // Webhook
    processCallback,
};
