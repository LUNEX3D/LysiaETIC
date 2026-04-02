const axios = require("axios");
const logger = require("../config/logger");

/**
 * SOVOS (Foriba) E-FATURA SERVİSİ — LysiaETIC
 *
 * Sovos Indirect Tax API entegrasyonu (eski adı: Foriba / COAPI)
 * Desteklenen belgeler: e-Fatura, e-Arşiv, e-İrsaliye, e-Defter
 *
 * Doküman: https://docs.sovos.com/en/indirect-tax/indirect-tax-products/einvoicing/indirect-tax-api
 * Türkiye Portal: https://api.fitbulut.com/servis/#/eFatura
 *
 * Kimlik Doğrulama: OAuth 2.0 (client_credentials)
 *   - API Key + Secret → Base64 encode → Basic Auth header
 *   - POST /oauth/token → access_token (1 saat geçerli)
 *
 * Ortamlar:
 *   TEST : https://api-test.sovos.com
 *   TLS  : https://api-test-tls.sovos.com (TLS gerektiren ülkeler için)
 *   PROD : https://api.sovos.com
 *
 * Türkiye Yerel (fitbulut):
 *   TEST : https://apitest.fitbulut.com
 *   PROD : https://api.fitbulut.com
 */

const ENVIRONMENTS = {
    test: "https://api-test.sovos.com",
    production: "https://api.sovos.com"
};

const TR_ENVIRONMENTS = {
    test: "https://apitest.fitbulut.com",
    production: "https://api.fitbulut.com"
};

const getBaseUrl = (env) => ENVIRONMENTS[env] || ENVIRONMENTS.test;
const getTrBaseUrl = (env) => TR_ENVIRONMENTS[env] || TR_ENVIRONMENTS.test;

const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");

const buildHeaders = (token) => ({
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": "Bearer " + cleanAscii(token)
});

// ─── 1. OAuth Token Al ─────────────────────────────────────────────────────
const getAccessToken = async ({ apiKey, apiSecret, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const credentials = Buffer.from(cleanAscii(apiKey) + ":" + cleanAscii(apiSecret)).toString("base64");

        const response = await axios.post(
            baseUrl + "/oauth/token",
            "grant_type=client_credentials",
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + credentials
                },
                timeout: 15000
            }
        );

        logger.info("[Sovos] OAuth token alindi, expires_in: " + (response.data && response.data.expires_in));
        return {
            success: true,
            accessToken: response.data && response.data.access_token,
            expiresIn: response.data && response.data.expires_in,
            tokenType: response.data && response.data.token_type,
            data: response.data
        };
    } catch (error) {
        logger.error("[Sovos] OAuth token hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && (error.response.data.message || error.response.data.error_description || error.response.data.error)) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 2. Belge Gönder (SBD - Standard Business Document) ────────────────────
const sendDocument = async ({ token, documentData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/v1/documents",
            documentData,
            { headers: buildHeaders(token), timeout: 30000 }
        );

        logger.info("[Sovos] Belge gonderildi, referenceId: " + (response.data && response.data.data && response.data.data.referenceId));
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] Belge gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 3. Belge Durumu Sorgula ────────────────────────────────────────────────
const getDocumentStatus = async ({ token, referenceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/v1/documents/" + cleanAscii(referenceId) + "/status",
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] Belge durum sorgu hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 4. Belge İndir ────────────────────────────────────────────────────────
const downloadDocument = async ({ token, referenceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/v1/documents/" + cleanAscii(referenceId),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] Belge indirme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 5. Uygulama Yanıtlarını Al (Application Responses) ────────────────────
const getApplicationResponses = async ({ token, env, params }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const queryParams = new URLSearchParams(params || {}).toString();
        const url = baseUrl + "/v1/application-responses" + (queryParams ? "?" + queryParams : "");

        const response = await axios.get(url, {
            headers: buildHeaders(token),
            timeout: 15000
        });
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] Uygulama yanitlari hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 6. Uygulama Yanıtını Onayla (Acknowledge) ─────────────────────────────
const acknowledgeResponse = async ({ token, responseId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.put(
            baseUrl + "/v1/application-responses/" + cleanAscii(responseId) + "/acknowledge",
            {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] Yanit onaylama hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 7. e-Arşiv Belge Gönder ───────────────────────────────────────────────
const sendEArchive = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/v1/archived-documents",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[Sovos] e-Arsiv belge gonderildi");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] e-Arsiv gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 8. e-Arşiv Belge İndir ────────────────────────────────────────────────
const getArchivedDocument = async ({ token, referenceId, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/v1/archived-documents/" + cleanAscii(referenceId),
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] e-Arsiv indirme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 9. API Durumu Kontrol ──────────────────────────────────────────────────
const checkApiStatus = async ({ apiKey, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        const response = await axios.get(
            baseUrl + "/v1/status",
            {
                headers: {
                    "Accept": "application/json",
                    "x-api-key": cleanAscii(apiKey)
                },
                timeout: 10000
            }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] API durum kontrol hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 10. Türkiye Yerel API — e-Fatura Gönder (fitbulut) ────────────────────
const sendTrEInvoice = async ({ token, invoiceData, env }) => {
    try {
        const baseUrl = getTrBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/einvoice/send",
            invoiceData,
            { headers: buildHeaders(token), timeout: 30000 }
        );
        logger.info("[Sovos TR] e-Fatura gonderildi");
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos TR] e-Fatura gonderme hatasi:", error.response ? error.response.data : error.message);
        return {
            success: false,
            error: (error.response && error.response.data && error.response.data.message) || error.message,
            status: error.response && error.response.status
        };
    }
};

// ─── 11. Türkiye Yerel API — Gelen e-Fatura Listele (fitbulut) ─────────────
const listTrIncomingEInvoices = async ({ token, searchParams, env }) => {
    try {
        const baseUrl = getTrBaseUrl(env);
        const response = await axios.post(
            baseUrl + "/api/einvoice/incoming/list",
            searchParams || {},
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos TR] Gelen fatura listeleme hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

// ─── 12. Belge Arama (Genel) ───────────────────────────────────────────────
const searchDocuments = async ({ token, searchParams, documentType, env }) => {
    try {
        const baseUrl = getBaseUrl(env);
        var endpoint;
        switch (documentType) {
            case "outgoing-einvoice":
                endpoint = "/v1/documents?documentType=outgoing-einvoice";
                break;
            case "incoming-einvoice":
                endpoint = "/v1/documents?documentType=incoming-einvoice";
                break;
            case "despatch-advice":
                endpoint = "/v1/documents?documentType=despatch-advice";
                break;
            default:
                endpoint = "/v1/archived-documents";
        }

        // Eğer earchive ise farklı endpoint
        if (documentType === "earchive" || !documentType) {
            const response = await axios.get(
                baseUrl + "/v1/archived-documents",
                {
                    headers: buildHeaders(token),
                    params: searchParams || {},
                    timeout: 15000
                }
            );
            return { success: true, data: response.data };
        }

        const queryParams = new URLSearchParams(searchParams || {}).toString();
        const url = endpoint + (queryParams ? "&" + queryParams : "");

        const response = await axios.get(
            baseUrl + url,
            { headers: buildHeaders(token), timeout: 15000 }
        );
        return { success: true, data: response.data };
    } catch (error) {
        logger.error("[Sovos] " + (documentType || "earchive") + " arama hatasi:", error.response ? error.response.data : error.message);
        return { success: false, error: (error.response && error.response.data && error.response.data.message) || error.message };
    }
};

module.exports = {
    getAccessToken,
    sendDocument,
    getDocumentStatus,
    downloadDocument,
    getApplicationResponses,
    acknowledgeResponse,
    sendEArchive,
    getArchivedDocument,
    checkApiStatus,
    sendTrEInvoice,
    listTrIncomingEInvoices,
    searchDocuments,
    ENVIRONMENTS,
    TR_ENVIRONMENTS
};
