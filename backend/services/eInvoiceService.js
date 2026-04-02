const axios = require("axios");
const logger = require("../config/logger");

/**
 * E-FATURA SERVİSİ — LysiaETIC
 *
 * Trendyol E-Faturam API entegrasyonu
 * Desteklenen belgeler: e-Arsiv, e-Fatura (Giden/Gelen), e-Irsaliye
 *
 * Ortamlar:
 *   TEST : https://stage-apigateway.trendyolefaturam.com
 *   PROD : https://apigateway.trendyolecozum.com
 */

const ENVIRONMENTS = {
    test: "https://stage-apigateway.trendyolefaturam.com",
    production: "https://apigateway.trendyolecozum.com"
};

const getBaseUrl = (env) => ENVIRONMENTS[env] || ENVIRONMENTS.test;

const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");

const buildHeaders = (token) => ({
    "Content-Type": "application/json",
    "Authorization": "Bearer " + cleanAscii(token)
});

// 1. Partner Login
const partnerLogin = async ({ username, password, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(baseUrl + "/api/auth/signin", {
            username: cleanAscii(username),
            password: cleanAscii(password)
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 15000
        });

        logger.info("[E-Fatura] Partner login basarili");
        return {
            success: true,
            accessToken: response.data && (response.data.accessToken || response.data.token),
            data: response.data
        };
    } catch (error) {
        logger.error("[E-Fatura] Partner login hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// 2. Customer Login
const customerLogin = async ({ partnerToken, customerUsername, customerPassword, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(baseUrl + "/api/invoice/partners/customer/signin", {
            username: cleanAscii(customerUsername),
            password: cleanAscii(customerPassword)
        }, {
            headers: buildHeaders(partnerToken),
            timeout: 15000
        });

        logger.info("[E-Fatura] Musteri login basarili");
        return {
            success: true,
            userId: response.data && response.data.userId,
            companyId: response.data && response.data.companyId,
            partnerCustomerId: response.data && response.data.partnerCustomerId,
            accessToken: response.data && (response.data.accessToken || response.data.token),
            data: response.data
        };
    } catch (error) {
        logger.error("[E-Fatura] Musteri login hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// 3. E-Arsiv Fatura Olustur
const createEArchiveInvoice = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/invoice/documents/earchive",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );

        logger.info("[E-Fatura] E-Arsiv fatura olusturuldu");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] E-Arsiv olusturma hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// 4. E-Arsiv Fatura Durumu Sorgula
const getEArchiveStatus = async ({ token, invoiceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/invoice/documents/earchive/" + invoiceId + "/status",
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] E-Arsiv durum sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 5. E-Arsiv Fatura Iptal
const cancelEArchiveInvoice = async ({ token, invoiceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/invoice/documents/earchive/" + invoiceId + "/cancel",
            {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        logger.info("[E-Fatura] E-Arsiv iptal edildi: " + invoiceId);
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] E-Arsiv iptal hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 6. Giden E-Fatura Olustur
const createOutgoingEInvoice = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/invoice/documents/outgoing-einvoice",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[E-Fatura] Giden e-Fatura olusturuldu");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] Giden e-Fatura hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 7. Gelen E-Fatura Listele
const searchIncomingEInvoices = async ({ token, searchParams, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/invoice/documents/incoming-einvoice/search",
            searchParams,
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] Gelen e-Fatura arama hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 8. E-Irsaliye Olustur
const createDespatchAdvice = async ({ token, despatchData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/invoice/documents/despatch-advice",
            despatchData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[E-Fatura] E-Irsaliye olusturuldu");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] E-Irsaliye hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 9. Mukellef Sorgulama
const getTaxpayerList = async ({ token, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/taxpayers/download-url",
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] Mukellef sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 10. Firma Bilgileri
const getCorporateInfo = async ({ token, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/invoice/partners/corporate-info",
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] Firma bilgi hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// 11. Belge Arama (Genel)
const searchDocuments = async ({ token, searchParams, documentType, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        var endpoint;
        switch (documentType) {
            case "outgoing-einvoice":
                endpoint = "/api/invoice/documents/outgoing-einvoice/search";
                break;
            case "incoming-einvoice":
                endpoint = "/api/invoice/documents/incoming-einvoice/search";
                break;
            case "despatch-advice":
                endpoint = "/api/invoice/documents/despatch-advice/search";
                break;
            default:
                endpoint = "/api/invoice/documents/earchive/search";
        }

        const response = await axios.post(
            baseUrl + endpoint,
            searchParams,
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[E-Fatura] " + (documentType || "earchive") + " arama hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

module.exports = {
    partnerLogin,
    customerLogin,
    createEArchiveInvoice,
    getEArchiveStatus,
    cancelEArchiveInvoice,
    createOutgoingEInvoice,
    searchIncomingEInvoices,
    createDespatchAdvice,
    getTaxpayerList,
    getCorporateInfo,
    searchDocuments,
    ENVIRONMENTS
};
