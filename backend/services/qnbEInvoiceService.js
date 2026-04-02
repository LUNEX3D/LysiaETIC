const axios = require("axios");
const logger = require("../config/logger");

/**
 * QNB eSolutions E-FATURA SERVİSİ — LysiaETIC
 *
 * QNB eFinans (eSolutions) API entegrasyonu
 * Desteklenen belgeler: e-Fatura, e-Arşiv, e-İrsaliye, e-Defter
 *
 * QNB eSolutions SOAP tabanlı bir API kullanır ancak REST wrapper ile de erişilebilir.
 * Doküman: https://www.qnbesolutions.com.tr/api-docs-tr-final.html
 *
 * Ortamlar:
 *   TEST : https://testapi.qnbefinans.com
 *   PROD : https://api.qnbefinans.com
 *
 * Kimlik Doğrulama: Cookie Container veya SOAP Header (username/password)
 * REST API: Basic Auth (Base64 encoded username:password)
 */

const ENVIRONMENTS = {
    test: "https://testapi.qnbefinans.com",
    production: "https://api.qnbefinans.com"
};

const getBaseUrl = (env) => ENVIRONMENTS[env] || ENVIRONMENTS.test;

const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");

const buildHeaders = (token) => ({
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": "Bearer " + cleanAscii(token)
});

const buildBasicAuth = (username, password) => {
    const encoded = Buffer.from(cleanAscii(username) + ":" + cleanAscii(password)).toString("base64");
    return "Basic " + encoded;
};

// ─── 1. Oturum Aç (Login) ─────────────────────────────────────────────────
const login = async ({ username, password, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(baseUrl + "/api/auth/login", {
            username: cleanAscii(username),
            password: cleanAscii(password)
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": buildBasicAuth(username, password)
            },
            timeout: 15000
        });

        logger.info("[QNB E-Fatura] Login basarili");
        return {
            success: true,
            accessToken: response.data && (response.data.token || response.data.accessToken || response.data.sessionId),
            sessionId: response.data && response.data.sessionId,
            data: response.data
        };
    } catch (error) {
        logger.error("[QNB E-Fatura] Login hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && (error.response.data.message || error.response.data.error)) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 2. e-Fatura Kayıtlı Kullanıcı Sorgulama ─────────────────────────────
const checkEInvoiceUser = async ({ token, vkn, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/einvoice/user-check/" + cleanAscii(vkn),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Kullanici sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 3. e-Fatura Gönderme ──────────────────────────────────────────────────
const sendEInvoice = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/einvoice/send",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[QNB E-Fatura] e-Fatura gonderildi");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] e-Fatura gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 4. e-Fatura Durum Sorgulama ───────────────────────────────────────────
const getEInvoiceStatus = async ({ token, invoiceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/einvoice/status/" + cleanAscii(invoiceId),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Durum sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 5. Giden e-Fatura İndirme ─────────────────────────────────────────────
const downloadOutgoingEInvoice = async ({ token, invoiceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/einvoice/outgoing/download/" + cleanAscii(invoiceId),
            { headers: buildHeaders(token), timeout: 15000, responseType: "arraybuffer" }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Giden fatura indirme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 6. Gelen e-Fatura Listeleme ───────────────────────────────────────────
const listIncomingEInvoices = async ({ token, searchParams, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/einvoice/incoming/list",
            searchParams || {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Gelen fatura listeleme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 7. Gelen e-Fatura İndirme ─────────────────────────────────────────────
const downloadIncomingEInvoice = async ({ token, invoiceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/einvoice/incoming/download/" + cleanAscii(invoiceId),
            { headers: buildHeaders(token), timeout: 15000, responseType: "arraybuffer" }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Gelen fatura indirme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 8. e-Arşiv Fatura Gönderme ────────────────────────────────────────────
const sendEArchive = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/earchive/send",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[QNB E-Fatura] e-Arsiv fatura gonderildi");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] e-Arsiv gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 9. e-İrsaliye Kayıtlı Kullanıcı Sorgulama ────────────────────────────
const checkDespatchUser = async ({ token, vkn, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/despatch/user-check/" + cleanAscii(vkn),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Irsaliye kullanici sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 10. e-İrsaliye Gönderme ───────────────────────────────────────────────
const sendDespatch = async ({ token, despatchData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/despatch/send",
            despatchData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[QNB E-Fatura] e-Irsaliye gonderildi");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] e-Irsaliye gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 11. e-İrsaliye Durum Sorgulama ────────────────────────────────────────
const getDespatchStatus = async ({ token, despatchId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/api/despatch/status/" + cleanAscii(despatchId),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Irsaliye durum sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 12. Gelen e-İrsaliye Listeleme ────────────────────────────────────────
const listIncomingDespatches = async ({ token, searchParams, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/despatch/incoming/list",
            searchParams || {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] Gelen irsaliye listeleme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 13. Belge Arama (Genel) ───────────────────────────────────────────────
const searchDocuments = async ({ token, searchParams, documentType, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        var endpoint;
        switch (documentType) {
            case "outgoing-einvoice":
                endpoint = "/api/einvoice/outgoing/list";
                break;
            case "incoming-einvoice":
                endpoint = "/api/einvoice/incoming/list";
                break;
            case "despatch-advice":
                endpoint = "/api/despatch/outgoing/list";
                break;
            case "incoming-despatch":
                endpoint = "/api/despatch/incoming/list";
                break;
            default:
                endpoint = "/api/earchive/list";
        }

        const response = await axios.post(
            baseUrl + endpoint,
            searchParams || {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[QNB E-Fatura] " + (documentType || "earchive") + " arama hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

module.exports = {
    login,
    checkEInvoiceUser,
    sendEInvoice,
    getEInvoiceStatus,
    downloadOutgoingEInvoice,
    listIncomingEInvoices,
    downloadIncomingEInvoice,
    sendEArchive,
    checkDespatchUser,
    sendDespatch,
    getDespatchStatus,
    listIncomingDespatches,
    searchDocuments,
    ENVIRONMENTS
};
